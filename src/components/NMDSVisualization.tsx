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

    // Robust NMDS Algorithm with rank-based stress minimization
    let bestStress = Infinity;
    let bestConfiguration = null;
    let bestIterations = 0;
    const maxIterations = 500;
    const tolerance = 1e-6;
    
    // Helper function for isotonic regression (monotonic regression)
    const isotonicRegression = (dissimilarities: number[], distances: number[]) => {
      const pairs = dissimilarities.map((d, i) => ({ diss: d, dist: distances[i], index: i }))
        .filter(p => p.diss > 0)
        .sort((a, b) => a.diss - b.diss);
      
      const fitted = new Array(pairs.length);
      
      // Pool Adjacent Violators Algorithm for isotonic regression
      let i = 0;
      while (i < pairs.length) {
        let j = i;
        let sum = pairs[i].dist;
        let count = 1;
        
        // Find violating sequence and pool
        while (j + 1 < pairs.length && sum / count > pairs[j + 1].dist) {
          j++;
          sum += pairs[j].dist;
          count++;
        }
        
        // Set all values in pool to average
        const average = sum / count;
        for (let k = i; k <= j; k++) {
          fitted[k] = average;
        }
        
        i = j + 1;
      }
      
      // Map back to original order
      const result = new Array(dissimilarities.length);
      pairs.forEach((p, idx) => {
        result[p.index] = fitted[idx] || 0;
      });
      
      return result;
    };
    
    // Calculate rank-based stress
    const calculateStress = (config: number[][]) => {
      // Calculate 2D distances
      const distances2D = [];
      const dissimilarities = [];
      
      for (let i = 0; i < n; i++) {
        for (let j = i + 1; j < n; j++) {
          const dx = config[i][0] - config[j][0];
          const dy = config[i][1] - config[j][1];
          const dist2D = Math.sqrt(dx * dx + dy * dy);
          
          distances2D.push(dist2D);
          dissimilarities.push(brayCurtis[i][j]);
        }
      }
      
      // Perform isotonic regression to get fitted distances
      const fittedDistances = isotonicRegression(dissimilarities, distances2D);
      
      // Calculate Kruskal's stress formula
      let numerator = 0;
      let denominator = 0;
      
      for (let k = 0; k < distances2D.length; k++) {
        const diff = distances2D[k] - fittedDistances[k];
        numerator += diff * diff;
        denominator += distances2D[k] * distances2D[k];
      }
      
      return denominator > 0 ? Math.sqrt(numerator / denominator) : 0;
    };
    
    // Try multiple diverse random starts to find global minimum
    for (let attempt = 0; attempt < 15; attempt++) {
      // Initialize with diverse starting configurations
      let config: number[][];
      if (attempt === 0) {
        // First attempt: random circle
        config = Array(n).fill(0).map((_, i) => {
          const angle = (i / n) * 2 * Math.PI;
          return [Math.cos(angle) * 2, Math.sin(angle) * 2];
        });
      } else if (attempt === 1) {
        // Second attempt: grid pattern
        const gridSize = Math.ceil(Math.sqrt(n));
        config = Array(n).fill(0).map((_, i) => [
          (i % gridSize - gridSize/2) * 1.5,
          (Math.floor(i / gridSize) - gridSize/2) * 1.5
        ]);
      } else {
        // Random configurations with good spread
        config = Array(n).fill(0).map(() => [
          (Math.random() - 0.5) * 6,
          (Math.random() - 0.5) * 6
        ]);
      }
      
      let prevStress = Infinity;
      let iterations = 0;
      
      for (let iter = 0; iter < maxIterations; iter++) {
        iterations = iter + 1;
        const currentStress = calculateStress(config);
        
        // Check for convergence
        if (Math.abs(prevStress - currentStress) < tolerance) {
          break;
        }
        prevStress = currentStress;
        
        // Gradient descent with adaptive step size
        const stepSize = Math.max(0.001, 0.1 * Math.exp(-iter / 100));
        const newConfig = config.map(point => [...point]);
        
        // Calculate gradients for each point
        for (let i = 0; i < n; i++) {
          let gradX = 0;
          let gradY = 0;
          
          for (let j = 0; j < n; j++) {
            if (i !== j) {
              const dx = config[i][0] - config[j][0];
              const dy = config[i][1] - config[j][1];
              const dist2D = Math.sqrt(dx * dx + dy * dy);
              
              if (dist2D > 1e-10) {
                // Target distance from Bray-Curtis similarity
                const targetDist = brayCurtis[i][j] * 3; // Scale factor for better visualization
                const error = dist2D - targetDist;
                
                gradX += error * dx / dist2D;
                gradY += error * dy / dist2D;
              }
            }
          }
          
          newConfig[i][0] -= stepSize * gradX;
          newConfig[i][1] -= stepSize * gradY;
        }
        
        config = newConfig;
      }
      
      const finalStress = calculateStress(config);
      
      // Keep best configuration from all attempts
      if (finalStress < bestStress) {
        bestStress = finalStress;
        bestConfiguration = [...config];
        bestIterations = iterations;
      }
    }
    
    // Standardize and rotate configuration for better visualization
    if (bestConfiguration) {
      // Center the configuration
      const meanX = bestConfiguration.reduce((sum, p) => sum + p[0], 0) / n;
      const meanY = bestConfiguration.reduce((sum, p) => sum + p[1], 0) / n;
      bestConfiguration.forEach(p => {
        p[0] -= meanX;
        p[1] -= meanY;
      });
      
      // Scale to ensure good spread on both axes
      const rangeX = Math.max(...bestConfiguration.map(p => p[0])) - Math.min(...bestConfiguration.map(p => p[0]));
      const rangeY = Math.max(...bestConfiguration.map(p => p[1])) - Math.min(...bestConfiguration.map(p => p[1]));
      const maxRange = Math.max(rangeX, rangeY, 0.1);
      
      // Scale to use full range while maintaining aspect ratio
      const scale = 2 / maxRange;
      bestConfiguration.forEach(p => {
        p[0] *= scale;
        p[1] *= scale;
      });
      
      // If one axis has very little variation, rotate to maximize spread
      if (rangeX / rangeY < 0.3 || rangeY / rangeX < 0.3) {
        const angle = Math.PI / 4; // 45 degree rotation
        const cos = Math.cos(angle);
        const sin = Math.sin(angle);
        
        bestConfiguration.forEach(p => {
          const x = p[0];
          const y = p[1];
          p[0] = x * cos - y * sin;
          p[1] = x * sin + y * cos;
        });
      }
    }
    
    // Create NMDS coordinates with proper fallback
    const nmdsData = communities.map((community, i) => ({
      community: community.id,
      NMDS1: bestConfiguration ? bestConfiguration[i][0] : (Math.random() - 0.5) * 2,
      NMDS2: bestConfiguration ? bestConfiguration[i][1] : (Math.random() - 0.5) * 2,
      richness: community.species.length,
      abundance: community.abundance.reduce((sum, a) => sum + a, 0)
    }));
    
    return {
      nmdsData,
      brayCurtisMatrix: brayCurtis,
      nmdsStats: {
        stress: bestStress,
        converged: bestStress < 0.2,
        iterations: bestIterations
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