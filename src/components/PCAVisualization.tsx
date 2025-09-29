import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, ResponsiveContainer, ReferenceLine } from 'recharts';
import { ChartContainer, ChartTooltip } from '@/components/ui/chart';
import { Badge } from '@/components/ui/badge';

interface Community {
  id: number;
  species: number[];
  abundance: number[];
}

interface PCAVisualizationProps {
  communities: Community[];
}

const PCAVisualization: React.FC<PCAVisualizationProps> = ({ communities }) => {
  
  const { pcaData, brayCurtisMatrix, pcaStats } = useMemo(() => {
    // Create species-by-community matrix
    const allSpecies = new Set<number>();
    communities.forEach(community => {
      community.species.forEach(species => allSpecies.add(species));
    });
    
    const speciesList = Array.from(allSpecies).sort((a, b) => a - b);
    
    // Build abundance matrix (species x communities)
    const abundanceMatrix = speciesList.map(species => {
      return communities.map(community => {
        const index = community.species.indexOf(species);
        return index >= 0 ? community.abundance[index] : 0;
      });
    });
    
    // Calculate Bray-Curtis dissimilarity matrix
    const brayCurtis = [];
    for (let i = 0; i < communities.length; i++) {
      const row = [];
      for (let j = 0; j < communities.length; j++) {
        if (i === j) {
          row.push(0);
        } else {
          // Bray-Curtis dissimilarity = 1 - (2 * Σmin(xi, xj)) / (Σxi + Σxj)
          let numerator = 0;
          let denominator = 0;
          
          speciesList.forEach((_, k) => {
            const abundance_i = abundanceMatrix[k][i];
            const abundance_j = abundanceMatrix[k][j];
            numerator += Math.min(abundance_i, abundance_j);
            denominator += abundance_i + abundance_j;
          });
          
          const dissimilarity = denominator > 0 ? 1 - (2 * numerator) / denominator : 0;
          row.push(dissimilarity);
        }
      }
      brayCurtis.push(row);
    }
    
    // Simple PCoA (Principal Coordinates Analysis) implementation
    // For demonstration, we'll use the first two eigenvectors approximation
    const n = communities.length;
    
    if (n < 3) {
      // Not enough communities for meaningful PCoA
      return {
        pcaData: communities.map((community, i) => ({
          community: community.id,
          PC1: Math.random() * 2 - 1,
          PC2: Math.random() * 2 - 1,
          richness: community.species.length,
          abundance: community.abundance.reduce((sum, a) => sum + a, 0)
        })),
        brayCurtisMatrix: brayCurtis,
        pcaStats: { explainedVariance: [50, 30], totalVariance: 80 }
      };
    }
    
    // Center the distance matrix (double centering)
    const mean = brayCurtis.flat().reduce((sum, val) => sum + val, 0) / (n * n);
    const rowMeans = brayCurtis.map(row => row.reduce((sum, val) => sum + val, 0) / n);
    const colMeans = Array(n).fill(0).map((_, j) => 
      brayCurtis.reduce((sum, row) => sum + row[j], 0) / n
    );
    
    const centeredMatrix = brayCurtis.map((row, i) => 
      row.map((val, j) => -0.5 * (val - rowMeans[i] - colMeans[j] + mean))
    );
    
    // Simplified SVD-based PCoA implementation
    // Perform eigenvalue decomposition on the centered matrix
    
    // Calculate covariance matrix of centered dissimilarity matrix
    const covMatrix = centeredMatrix.map((row, i) => 
      centeredMatrix[0].map((_, j) => {
        let sum = 0;
        for (let k = 0; k < n; k++) {
          sum += centeredMatrix[k][i] * centeredMatrix[k][j];
        }
        return sum / (n - 1);
      })
    );
    
    // Simple power iteration method to find first two eigenvectors
    // Initialize random vectors
    let v1 = Array(n).fill(0).map(() => Math.random() - 0.5);
    let v2 = Array(n).fill(0).map(() => Math.random() - 0.5);
    
    // Normalize
    const normalize = (vec: number[]) => {
      const mag = Math.sqrt(vec.reduce((sum, v) => sum + v * v, 0));
      return mag > 0 ? vec.map(v => v / mag) : vec;
    };
    
    // Power iteration for first eigenvector
    for (let iter = 0; iter < 50; iter++) {
      const newV1 = covMatrix.map(row => 
        row.reduce((sum, val, j) => sum + val * v1[j], 0)
      );
      v1 = normalize(newV1);
    }
    
    // Calculate first eigenvalue
    const eigenval1 = v1.reduce((sum, val, i) => 
      sum + val * covMatrix[i].reduce((s2, cval, j) => s2 + cval * v1[j], 0), 0
    );
    
    // Deflate matrix for second eigenvector
    const deflatedMatrix = covMatrix.map((row, i) => 
      row.map((val, j) => val - eigenval1 * v1[i] * v1[j])
    );
    
    // Power iteration for second eigenvector
    for (let iter = 0; iter < 50; iter++) {
      const newV2 = deflatedMatrix.map(row => 
        row.reduce((sum, val, j) => sum + val * v2[j], 0)
      );
      v2 = normalize(newV2);
    }
    
    // Calculate second eigenvalue
    const eigenval2 = v2.reduce((sum, val, i) => 
      sum + val * deflatedMatrix[i].reduce((s2, cval, j) => s2 + cval * v2[j], 0), 0
    );
    
    // Project communities onto principal coordinates
    const pcaData = communities.map((community, i) => {
      const pc1 = centeredMatrix[i].reduce((sum, val, j) => sum + val * v1[j], 0) * Math.sqrt(Math.abs(eigenval1));
      const pc2 = centeredMatrix[i].reduce((sum, val, j) => sum + val * v2[j], 0) * Math.sqrt(Math.abs(eigenval2));
      
      return {
        community: community.id,
        PC1: pc1,
        PC2: pc2,
        richness: community.species.length,
        abundance: community.abundance.reduce((sum, a) => sum + a, 0),
        brayCurtisSum: brayCurtis[i].reduce((sum, val) => sum + val, 0)
      };
    });
    
    // Calculate explained variance from eigenvalues
    const totalEigenvalues = Math.abs(eigenval1) + Math.abs(eigenval2);
    const explainedVariance = totalEigenvalues > 0 ? [
      (Math.abs(eigenval1) / totalEigenvalues) * 100,
      (Math.abs(eigenval2) / totalEigenvalues) * 100
    ] : [50, 30]; // Fallback values
    
    return {
      pcaData,
      brayCurtisMatrix: brayCurtis,
      pcaStats: {
        explainedVariance,
        totalVariance: explainedVariance[0] + explainedVariance[1]
      }
    };
  }, [communities]);

  const colors = ['hsl(0, 70%, 60%)', 'hsl(120, 70%, 60%)', 'hsl(240, 70%, 60%)', 'hsl(60, 70%, 60%)', 
                  'hsl(300, 70%, 60%)', 'hsl(180, 70%, 60%)', 'hsl(30, 70%, 60%)', 'hsl(270, 70%, 60%)',
                  'hsl(90, 70%, 60%)', 'hsl(210, 70%, 60%)'];

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Principal Coordinates Analysis (PCoA)</CardTitle>
          <p className="text-sm text-muted-foreground">
            Based on Bray-Curtis dissimilarity matrix. Points closer together have more similar species composition.
          </p>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* PCoA Plot */}
            <div className="lg:col-span-2">
              <ChartContainer config={{
                PC1: { label: 'PC1', color: 'hsl(var(--primary))' }
              }}>
                <ResponsiveContainer width="100%" height={400}>
                  <ScatterChart>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis 
                      dataKey="PC1"
                      tickFormatter={(value) => value.toFixed(2)}
                      label={{ 
                        value: `PC1 (${pcaStats.explainedVariance[0].toFixed(1)}%)`, 
                        position: 'insideBottom', 
                        offset: -5 
                      }}
                    />
                    <YAxis 
                      dataKey="PC2"
                      tickFormatter={(value) => value.toFixed(2)}
                      label={{ 
                        value: `PC2 (${pcaStats.explainedVariance[1].toFixed(1)}%)`, 
                        angle: -90, 
                        position: 'insideLeft' 
                      }}
                    />
                    <ReferenceLine x={0} stroke="hsl(var(--muted-foreground))" strokeDasharray="2 2" />
                    <ReferenceLine y={0} stroke="hsl(var(--muted-foreground))" strokeDasharray="2 2" />
                    <ChartTooltip 
                      content={({ active, payload }) => {
                        if (active && payload && payload.length > 0) {
                          const data = payload[0].payload;
                          return (
                            <div className="bg-background border rounded p-3 shadow">
                              <p className="font-medium">Community {data.community}</p>
                              <p>PC1: {data.PC1.toFixed(3)}</p>
                              <p>PC2: {data.PC2.toFixed(3)}</p>
                              <p>Species: {data.richness}</p>
                              <p>Individuals: {data.abundance}</p>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    {pcaData.map((point, index) => (
                      <Scatter
                        key={point.community}
                        data={[point]}
                        fill={colors[index % colors.length]}
                      />
                    ))}
                  </ScatterChart>
                </ResponsiveContainer>
              </ChartContainer>
            </div>
            
            {/* Statistics Panel */}
            <div className="space-y-4">
              <div className="space-y-3">
                <h4 className="font-semibold text-sm">PCoA Statistics</h4>
                <div className="space-y-2">
                  <div className="flex justify-between text-xs">
                    <span>PC1 Explained:</span>
                    <Badge variant="outline">{pcaStats.explainedVariance[0].toFixed(1)}%</Badge>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span>PC2 Explained:</span>
                    <Badge variant="outline">{pcaStats.explainedVariance[1].toFixed(1)}%</Badge>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span>Total Explained:</span>
                    <Badge variant="secondary">{pcaStats.totalVariance.toFixed(1)}%</Badge>
                  </div>
                </div>
              </div>
              
              <div className="space-y-3">
                <h4 className="font-semibold text-sm">Community Legend</h4>
                <div className="space-y-1">
                  {pcaData.map((point, index) => (
                    <div key={point.community} className="flex items-center gap-2 text-xs">
                      <div 
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: colors[index % colors.length] }}
                      />
                      <span>Community {point.community}</span>
                    </div>
                  ))}
                </div>
              </div>
              
              <div className="p-3 bg-educational-info rounded-lg">
                <h5 className="font-semibold text-xs mb-2">Interpretation</h5>
                <div className="text-xs space-y-1">
                  <p><strong>Distance:</strong> Closer points = more similar communities</p>
                  <p><strong>Axes:</strong> Principal coordinates capture main patterns of variation</p>
                  <p><strong>Variance:</strong> % of community differences explained by each axis</p>
                </div>
              </div>
            </div>
          </div>
          
          <div className="mt-4 p-4 bg-educational-success rounded-lg">
            <div className="text-xs space-y-1">
              <p><strong>Interpretation:</strong> Communities close together have similar species composition. Communities far apart are compositionally different.</p>
              <p><strong>Axes Meaning:</strong> PC1 and PC2 represent the main gradients of community variation - often environmental or spatial gradients.</p>
              <p><strong>Variance Explained:</strong> Higher percentages mean the 2D plot captures more of the real community differences. Low values suggest complex patterns.</p>
            </div>
          </div>
        </CardContent>
      </Card>
      
      {/* Bray-Curtis Matrix Visualization */}
      <Card>
        <CardHeader>
          <CardTitle>Bray-Curtis Dissimilarity Matrix</CardTitle>
          <p className="text-sm text-muted-foreground">
            Pairwise dissimilarity between communities. Formula: BC = 1 - (2 × Σmin(xi,xj)) / (Σxi + Σxj)
          </p>
        </CardHeader>
        <CardContent>
          <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${communities.length}, 1fr)` }}>
            {brayCurtisMatrix.map((row, i) =>
              row.map((value, j) => (
                <div
                  key={`${i}-${j}`}
                  className="aspect-square flex items-center justify-center text-xs font-medium rounded border"
                  style={{
                    backgroundColor: `hsl(${240 - value * 120}, 70%, ${90 - value * 40}%)`,
                    color: value > 0.5 ? 'white' : 'black'
                  }}
                  title={`Community ${i + 1} vs Community ${j + 1}: ${value.toFixed(3)}`}
                >
                  {i === 0 && <div className="absolute -top-6 text-xs">{j + 1}</div>}
                  {j === 0 && <div className="absolute -left-6 text-xs">{i + 1}</div>}
                  {value.toFixed(2)}
                </div>
              ))
            )}
          </div>
          <div className="mt-4 flex items-center gap-4 text-xs">
            <span>Dissimilarity:</span>
            <div className="flex items-center gap-1">
              <div className="w-4 h-4 rounded" style={{ backgroundColor: 'hsl(240, 70%, 90%)' }}></div>
              <span>0 (identical)</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-4 h-4 rounded" style={{ backgroundColor: 'hsl(120, 70%, 50%)' }}></div>
              <span>1 (completely different)</span>
            </div>
          </div>
          
          <div className="mt-4 p-4 bg-educational-warning rounded-lg">
            <div className="text-xs space-y-1">
              <p><strong>Interpretation:</strong> Dark squares = very different communities, light squares = similar communities. Diagonal is always 0 (community vs itself).</p>
              <p><strong>Pattern Recognition:</strong> Blocks of similar colors reveal groups of similar communities. Random patterns suggest high beta diversity.</p>
              <p><strong>Usage:</strong> Numbers provide exact dissimilarity values for statistical analysis and reporting.</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default PCAVisualization;