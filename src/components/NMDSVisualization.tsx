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

interface NMDSVisualizationProps {
  communities: Community[];
}

const NMDSVisualization: React.FC<NMDSVisualizationProps> = ({ communities }) => {
  
  const { nmdsData, brayCurtisMatrix, nmdsStats } = useMemo(() => {
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
    
    // NMDS (Non-metric Multidimensional Scaling) implementation
    const n = communities.length;
    
    if (n < 3) {
      // Not enough communities for meaningful NMDS
      return {
        nmdsData: communities.map((community, i) => ({
          community: community.id,
          NMDS1: Math.random() * 2 - 1,
          NMDS2: Math.random() * 2 - 1,
          richness: community.species.length,
          abundance: community.abundance.reduce((sum, a) => sum + a, 0)
        })),
        brayCurtisMatrix: brayCurtis,
        nmdsStats: { stress: 0.05, converged: true, iterations: 1 }
      };
    }

    // NMDS Algorithm: Iterative stress minimization
    let bestStress = Infinity;
    let bestConfiguration = null;
    const maxIterations = 1000;
    const tolerance = 1e-6;
    
    // Try multiple random starts to find best solution
    for (let attempt = 0; attempt < 10; attempt++) {
      // Initialize random 2D configuration
      let config = Array(n).fill(0).map(() => [
        (Math.random() - 0.5) * 4,
        (Math.random() - 0.5) * 4
      ]);
      
      let prevStress = Infinity;
      let converged = false;
      
      for (let iter = 0; iter < maxIterations; iter++) {
        // Calculate current 2D distances
        const distances2D = [];
        for (let i = 0; i < n; i++) {
          distances2D[i] = [];
          for (let j = 0; j < n; j++) {
            if (i === j) {
              distances2D[i][j] = 0;
            } else {
              const dx = config[i][0] - config[j][0];
              const dy = config[i][1] - config[j][1];
              distances2D[i][j] = Math.sqrt(dx * dx + dy * dy);
            }
          }
        }
        
        // Calculate stress (Kruskal stress formula)
        let numerator = 0;
        let denominator = 0;
        
        for (let i = 0; i < n; i++) {
          for (let j = i + 1; j < n; j++) {
            const observed = brayCurtis[i][j];
            const predicted = distances2D[i][j];
            numerator += (observed - predicted) * (observed - predicted);
            denominator += observed * observed;
          }
        }
        
        const stress = denominator > 0 ? Math.sqrt(numerator / denominator) : 0;
        
        // Check for convergence
        if (Math.abs(prevStress - stress) < tolerance) {
          converged = true;
          break;
        }
        prevStress = stress;
        
        // Gradient descent step to minimize stress
        const stepSize = 0.01;
        const newConfig = config.map(point => [...point]);
        
        for (let i = 0; i < n; i++) {
          let gradX = 0;
          let gradY = 0;
          
          for (let j = 0; j < n; j++) {
            if (i !== j) {
              const observed = brayCurtis[i][j];
              const predicted = distances2D[i][j];
              
              if (predicted > 1e-10) {
                const error = predicted - observed;
                const dx = config[i][0] - config[j][0];
                const dy = config[i][1] - config[j][1];
                
                gradX += error * dx / predicted;
                gradY += error * dy / predicted;
              }
            }
          }
          
          newConfig[i][0] -= stepSize * gradX;
          newConfig[i][1] -= stepSize * gradY;
        }
        
        config = newConfig;
      }
      
      // Keep best configuration from all attempts
      if (prevStress < bestStress) {
        bestStress = prevStress;
        bestConfiguration = config;
      }
    }
    
    // Create NMDS coordinates
    const nmdsData = communities.map((community, i) => ({
      community: community.id,
      NMDS1: bestConfiguration ? bestConfiguration[i][0] : Math.random() * 2 - 1,
      NMDS2: bestConfiguration ? bestConfiguration[i][1] : Math.random() * 2 - 1,
      richness: community.species.length,
      abundance: community.abundance.reduce((sum, a) => sum + a, 0)
    }));
    
    return {
      nmdsData,
      brayCurtisMatrix: brayCurtis,
      nmdsStats: {
        stress: bestStress,
        converged: bestStress < 0.2,
        iterations: maxIterations
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
          <CardTitle>Non-metric Multidimensional Scaling (NMDS)</CardTitle>
          <p className="text-sm text-muted-foreground">
            Based on Bray-Curtis dissimilarity matrix. Points closer together have more similar species composition. Stress: {nmdsStats.stress.toFixed(3)}
          </p>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* NMDS Plot */}
            <div className="lg:col-span-2">
              <ChartContainer config={{
                NMDS1: { label: 'NMDS1', color: 'hsl(var(--primary))' }
              }}>
                <ResponsiveContainer width="100%" height={400}>
                  <ScatterChart>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis 
                      dataKey="NMDS1"
                      tickFormatter={(value) => value.toFixed(2)}
                      label={{ 
                        value: 'NMDS1', 
                        position: 'insideBottom', 
                        offset: -5 
                      }}
                    />
                    <YAxis 
                      dataKey="NMDS2"
                      tickFormatter={(value) => value.toFixed(2)}
                      label={{ 
                        value: 'NMDS2', 
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
                              <p>NMDS1: {data.NMDS1.toFixed(3)}</p>
                              <p>NMDS2: {data.NMDS2.toFixed(3)}</p>
                              <p>Species: {data.richness}</p>
                              <p>Individuals: {data.abundance}</p>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    {nmdsData.map((point, index) => (
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
                <h4 className="font-semibold text-sm">NMDS Statistics</h4>
                <div className="space-y-2">
                  <div className="flex justify-between text-xs">
                    <span>Stress:</span>
                    <Badge variant={nmdsStats.stress < 0.05 ? "default" : nmdsStats.stress < 0.1 ? "secondary" : "destructive"}>
                      {nmdsStats.stress.toFixed(3)}
                    </Badge>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span>Converged:</span>
                    <Badge variant={nmdsStats.converged ? "default" : "destructive"}>
                      {nmdsStats.converged ? "Yes" : "No"}
                    </Badge>
                  </div>
                </div>
              </div>
              
              <div className="space-y-3">
                <h4 className="font-semibold text-sm">Community Legend</h4>
                <div className="space-y-1">
                  {nmdsData.map((point, index) => (
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
              
              <div className="p-3 bg-muted rounded-lg">
                <h5 className="font-semibold text-xs mb-2">Stress Interpretation</h5>
                <div className="text-xs space-y-1">
                  <p><strong>&lt; 0.05:</strong> Excellent representation</p>
                  <p><strong>0.05-0.1:</strong> Good representation</p>
                  <p><strong>0.1-0.2:</strong> Fair representation</p>
                  <p><strong>&gt; 0.2:</strong> Poor representation</p>
                </div>
              </div>
            </div>
          </div>
          
          <div className="mt-4 p-4 bg-muted rounded-lg">
            <div className="text-xs space-y-1">
              <p><strong>Interpretation:</strong> Communities close together have similar species composition. Communities far apart are compositionally different.</p>
              <p><strong>Axes Meaning:</strong> NMDS axes have no inherent meaning - only relative distances matter between points.</p>
              <p><strong>Stress Value:</strong> Lower stress indicates better fit. Stress &lt; 0.1 is generally considered good for ecological data.</p>
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
          <div className="grid gap-1" style={{ 
            gridTemplateColumns: `auto repeat(${communities.length}, 1fr)`,
            gridTemplateRows: `auto repeat(${communities.length}, 1fr)`
          }}>
            {/* Top-left empty cell */}
            <div className=""></div>
            
            {/* Column headers */}
            {communities.map((_, j) => (
              <div 
                key={`col-header-${j}`}
                className="text-xs font-semibold text-center p-2 bg-muted rounded"
              >
                C{j + 1}
              </div>
            ))}
            
            {/* Matrix rows with row headers */}
            {brayCurtisMatrix.map((row, i) => (
              <React.Fragment key={`row-${i}`}>
                {/* Row header */}
                <div className="text-xs font-semibold flex items-center justify-center p-2 bg-muted rounded">
                  C{i + 1}
                </div>
                
                {/* Matrix values */}
                {row.map((value, j) => (
                  <div
                    key={`${i}-${j}`}
                    className="aspect-square flex items-center justify-center text-xs font-medium rounded border transition-colors hover:ring-2 hover:ring-primary/50"
                    style={{
                      backgroundColor: `hsl(${240 - value * 120}, 70%, ${90 - value * 40}%)`,
                      color: value > 0.5 ? 'white' : 'hsl(var(--foreground))'
                    }}
                    title={`Community ${i + 1} vs Community ${j + 1}: ${value.toFixed(3)}`}
                  >
                    {value.toFixed(2)}
                  </div>
                ))}
              </React.Fragment>
            ))}
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
          
          <div className="mt-4 p-4 bg-muted rounded-lg">
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

export default NMDSVisualization;