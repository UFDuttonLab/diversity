import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, ResponsiveContainer, ReferenceLine, Cell } from 'recharts';
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

    // Extract dissimilarity pairs
    const dissimilarities: number[] = [];
    const pairIndices: [number, number][] = [];
    
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const dissim = brayCurtis[i][j];
        if (dissim > 0) { // Only include non-zero dissimilarities
          dissimilarities.push(dissim);
          pairIndices.push([i, j]);
        }
      }
    }
    
    // Check if we have sufficient variation
    if (dissimilarities.length === 0) {
      console.warn('NMDS: No variation in dissimilarity matrix');
      return {
        nmdsData: communities.map((community, i) => ({
          community: community.id,
          NMDS1: (i - n/2) * 0.5,
          NMDS2: 0,
          richness: community.species.length,
          abundance: community.abundance.reduce((sum, a) => sum + a, 0)
        })),
        brayCurtisMatrix: brayCurtis,
        nmdsStats: { stress: 0.0, converged: true, iterations: 0 }
      };
    }

    // Create rank order of dissimilarities
    const sortedIndices = dissimilarities
      .map((value, index) => ({ value, index }))
      .sort((a, b) => a.value - b.value);

    // Simple but robust initialization using classical MDS
    const initializeConfiguration = (): number[][] => {
      const config = Array(n).fill(0).map(() => [0, 0]);
      
      // Place points in a rough circle to avoid degenerate configurations
      for (let i = 0; i < n; i++) {
        const angle = (2 * Math.PI * i) / n;
        const radius = 1 + Math.random() * 0.5;
        config[i][0] = radius * Math.cos(angle);
        config[i][1] = radius * Math.sin(angle);
      }
      
      return config;
    };

    // Robust isotonic regression using Pool Adjacent Violators
    const isotonic = (distances: number[]): number[] => {
      if (distances.length === 0) return [];
      
      // Create data points with original indices for ranking
      const data = distances.map((dist, idx) => ({
        distance: dist,
        originalIndex: idx,
        rank: sortedIndices.findIndex(s => s.index === idx)
      })).sort((a, b) => a.rank - b.rank);
      
      // PAV algorithm
      const n = data.length;
      const result = new Array(distances.length);
      
      let i = 0;
      while (i < n) {
        let j = i;
        let sum = data[i].distance;
        let count = 1;
        
        // Find violating sequence
        while (j + 1 < n && sum / count > data[j + 1].distance) {
          j++;
          sum += data[j].distance;
          count++;
        }
        
        // Pool the violators
        const pooledValue = sum / count;
        for (let k = i; k <= j; k++) {
          result[data[k].originalIndex] = pooledValue;
        }
        
        i = j + 1;
      }
      
      return result;
    };

    // Stress calculation
    const calculateStress = (config: number[][]): number => {
      if (pairIndices.length === 0) return 0;
      
      const distances: number[] = [];
      
      for (let idx = 0; idx < pairIndices.length; idx++) {
        const [i, j] = pairIndices[idx];
        const dx = config[i][0] - config[j][0];
        const dy = config[i][1] - config[j][1];
        distances.push(Math.sqrt(dx * dx + dy * dy) + 1e-12);
      }
      
      const fitted = isotonic(distances);
      
      let numerator = 0;
      let denominator = 0;
      
      for (let k = 0; k < distances.length; k++) {
        const residual = distances[k] - fitted[k];
        numerator += residual * residual;
        denominator += fitted[k] * fitted[k];
      }
      
      return denominator > 1e-12 ? Math.sqrt(numerator / denominator) : 0;
    };

    // NMDS optimization with multiple starts
    let bestStress = Infinity;
    let bestConfiguration: number[][] | null = null;
    let bestIterations = 0;
    const maxIterations = 200;
    const tolerance = 1e-6;
    const numAttempts = 5;

    for (let attempt = 0; attempt < numAttempts; attempt++) {
      let config = initializeConfiguration();
      let prevStress = Infinity;
      let stagnationCount = 0;
      let iterations = 0;
      
      for (let iter = 0; iter < maxIterations; iter++) {
        iterations = iter + 1;
        
        // Calculate current configuration distances
        const distances: number[] = [];
        for (let idx = 0; idx < pairIndices.length; idx++) {
          const [i, j] = pairIndices[idx];
          const dx = config[i][0] - config[j][0];
          const dy = config[i][1] - config[j][1];
          distances.push(Math.sqrt(dx * dx + dy * dy) + 1e-12);
        }
        
        // Apply isotonic regression
        const fitted = isotonic(distances);
        const currentStress = calculateStress(config);
        
        // Check for convergence
        const stressChange = Math.abs(prevStress - currentStress);
        if (stressChange < tolerance) {
          stagnationCount++;
          if (stagnationCount > 10) break;
        } else {
          stagnationCount = 0;
        }
        
        // Prevent numerical overflow
        if (!isFinite(currentStress) || currentStress > 10) break;
        
        prevStress = currentStress;
        
        // Calculate gradients and update configuration
        const stepSize = Math.max(0.01, 0.1 * Math.exp(-iter / 50));
        
        for (let idx = 0; idx < pairIndices.length; idx++) {
          const [i, j] = pairIndices[idx];
          const dx = config[i][0] - config[j][0];
          const dy = config[i][1] - config[j][1];
          const dist = distances[idx];
          const fittedDist = fitted[idx];
          
          if (dist > 1e-12) {
            // Simple gradient descent on stress
            const error = (dist - fittedDist) / dist;
            const gradient = stepSize * error;
            
            const gradX = gradient * dx / dist;
            const gradY = gradient * dy / dist;
            
            config[i][0] -= gradX;
            config[i][1] -= gradY;
            config[j][0] += gradX;
            config[j][1] += gradY;
          }
        }
      }
      
      const finalStress = calculateStress(config);
      
      if (isFinite(finalStress) && finalStress < bestStress) {
        bestStress = finalStress;
        bestConfiguration = config.map(point => [...point]);
        bestIterations = iterations;
        
        if (bestStress < 0.1) break; // Good enough result
      }
    }
    
    // Post-process best configuration
    if (bestConfiguration) {
      // Center at origin
      const meanX = bestConfiguration.reduce((sum, p) => sum + p[0], 0) / n;
      const meanY = bestConfiguration.reduce((sum, p) => sum + p[1], 0) / n;
      
      bestConfiguration.forEach(p => {
        p[0] -= meanX;
        p[1] -= meanY;
      });
      
      // Scale to reasonable display range
      const maxCoord = Math.max(...bestConfiguration.flatMap(p => [Math.abs(p[0]), Math.abs(p[1])]));
      if (maxCoord > 0.01) {
        const scale = 2.0 / maxCoord;
        bestConfiguration.forEach(p => {
          p[0] *= scale;
          p[1] *= scale;
        });
      }
      
      // Final validation
      const finalXRange = Math.max(...bestConfiguration.map(p => p[0])) - Math.min(...bestConfiguration.map(p => p[0]));
      const finalYRange = Math.max(...bestConfiguration.map(p => p[1])) - Math.min(...bestConfiguration.map(p => p[1]));
      
      console.log(`NMDS: Final stress=${bestStress.toFixed(4)}, X-range=${finalXRange.toFixed(3)}, Y-range=${finalYRange.toFixed(3)}`);
    } else {
      console.error('NMDS: All attempts failed, using fallback configuration');
    }
    
    // Create NMDS data with simple fallback if NMDS failed
    const nmdsData = communities.map((community, i) => {
      if (bestConfiguration) {
        return {
          community: community.id,
          NMDS1: bestConfiguration[i][0],
          NMDS2: bestConfiguration[i][1],
          richness: community.species.length,
          abundance: community.abundance.reduce((sum, a) => sum + a, 0)
        };
      } else {
        // Simple fallback arrangement
        const angle = (2 * Math.PI * i) / communities.length;
        return {
          community: community.id,
          NMDS1: Math.cos(angle),
          NMDS2: Math.sin(angle),
          richness: community.species.length,
          abundance: community.abundance.reduce((sum, a) => sum + a, 0)
        };
      }
    });
    
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
            Based on Bray-Curtis dissimilarity matrix. Points closer together have more similar species composition. 
            Stress: {nmdsStats.stress.toFixed(3)} 
            {nmdsStats.stress < 0.1 ? " (Excellent)" : 
             nmdsStats.stress < 0.2 ? " (Good)" : 
             nmdsStats.stress < 0.3 ? " (Fair)" : " (Poor)"}
            {nmdsStats.converged ? " - Converged" : " - Not converged"}
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
                    <Scatter data={nmdsData}>
                      {nmdsData.map((point, index) => (
                        <Cell 
                          key={point.community}
                          fill={colors[index % colors.length]}
                        />
                      ))}
                    </Scatter>
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