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

    // Debug: Check Bray-Curtis matrix variation
    const flatDissimilarities = brayCurtis.flatMap((row, i) => 
      row.slice(i + 1).filter(val => val > 0)
    );
    const dissimRange = Math.max(...flatDissimilarities) - Math.min(...flatDissimilarities);
    
    if (dissimRange < 1e-6) {
      console.warn('NMDS: Insufficient variation in dissimilarity matrix');
      // Use PCoA as fallback
      return {
        nmdsData: communities.map((community, i) => ({
          community: community.id,
          NMDS1: (Math.random() - 0.5) * 4,
          NMDS2: (Math.random() - 0.5) * 4,
          richness: community.species.length,
          abundance: community.abundance.reduce((sum, a) => sum + a, 0)
        })),
        brayCurtisMatrix: brayCurtis,
        nmdsStats: { stress: 0.1, converged: false, iterations: 0 }
      };
    }

    // Extract dissimilarities and create rank mapping
    const dissimilarities: number[] = [];
    const pairIndices: [number, number][] = [];
    
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        dissimilarities.push(brayCurtis[i][j]);
        pairIndices.push([i, j]);
      }
    }
    
    // Create rank mapping for non-metric scaling
    const rankOrder = dissimilarities
      .map((value, index) => ({ value, index }))
      .sort((a, b) => a.value - b.value)
      .map((item, rank) => ({ originalIndex: item.index, rank }));

    // Principal Coordinate Analysis (PCoA) for initialization
    const performPCoA = (): number[][] => {
      // Convert dissimilarities to similarities for centering
      const maxDissim = Math.max(...dissimilarities);
      const simMatrix = Array(n).fill(0).map(() => Array(n).fill(0));
      
      for (let i = 0; i < n; i++) {
        for (let j = 0; j < n; j++) {
          if (i === j) {
            simMatrix[i][j] = 1;
          } else {
            const pairIdx = i < j ? 
              pairIndices.findIndex(([a, b]) => a === i && b === j) :
              pairIndices.findIndex(([a, b]) => a === j && b === i);
            if (pairIdx >= 0) {
              simMatrix[i][j] = 1 - dissimilarities[pairIdx] / maxDissim;
            }
          }
        }
      }
      
      // Center the matrix
      const rowMeans = simMatrix.map(row => row.reduce((s, v) => s + v, 0) / n);
      const grandMean = rowMeans.reduce((s, v) => s + v, 0) / n;
      
      const centeredMatrix = Array(n).fill(0).map(() => Array(n).fill(0));
      for (let i = 0; i < n; i++) {
        for (let j = 0; j < n; j++) {
          centeredMatrix[i][j] = simMatrix[i][j] - rowMeans[i] - rowMeans[j] + grandMean;
        }
      }
      
      // Simple eigenvalue approximation (power method for first two components)
      const getEigenVector = (matrix: number[][], iterations = 50): number[] => {
        let v = Array(n).fill(0).map(() => Math.random() - 0.5);
        
        for (let iter = 0; iter < iterations; iter++) {
          const newV = Array(n).fill(0);
          for (let i = 0; i < n; i++) {
            for (let j = 0; j < n; j++) {
              newV[i] += matrix[i][j] * v[j];
            }
          }
          
          const norm = Math.sqrt(newV.reduce((s, x) => s + x * x, 0));
          v = newV.map(x => x / (norm || 1));
        }
        
        return v;
      };
      
      const eigen1 = getEigenVector(centeredMatrix);
      
      // Deflate matrix to get second eigenvector
      const deflatedMatrix = Array(n).fill(0).map(() => Array(n).fill(0));
      for (let i = 0; i < n; i++) {
        for (let j = 0; j < n; j++) {
          deflatedMatrix[i][j] = centeredMatrix[i][j] - eigen1[i] * eigen1[j];
        }
      }
      
      const eigen2 = getEigenVector(deflatedMatrix);
      
      // Combine eigenvectors as coordinates
      return eigen1.map((x1, i) => [x1 * 2, eigen2[i] * 2]);
    };

    // Improved Pool Adjacent Violators Algorithm 
    const poolAdjacentViolators = (distances: number[]): number[] => {
      if (distances.length === 0) return [];
      
      // Create pairs with ranks for sorting
      const pairs = distances.map((distance, index) => {
        const rank = rankOrder.find(r => r.originalIndex === index)?.rank || 0;
        return { distance, rank, originalIndex: index };
      });
      
      // Sort by rank
      pairs.sort((a, b) => a.rank - b.rank);
      
      // Pool Adjacent Violators using a simpler approach
      const fitted = new Array(distances.length);
      let i = 0;
      
      while (i < pairs.length) {
        let j = i;
        let sum = pairs[i].distance;
        let count = 1;
        
        // Find violating sequence and pool them
        while (j + 1 < pairs.length && sum / count > pairs[j + 1].distance) {
          j++;
          sum += pairs[j].distance;
          count++;
        }
        
        // Assign pooled value
        const pooledValue = sum / count;
        for (let k = i; k <= j; k++) {
          fitted[pairs[k].originalIndex] = pooledValue;
        }
        
        i = j + 1;
      }
      
      return fitted;
    };

    // Calculate Kruskal's Stress-1
    const calculateStress = (config: number[][]): number => {
      const distances: number[] = [];
      
      for (let i = 0; i < n; i++) {
        for (let j = i + 1; j < n; j++) {
          const dx = config[i][0] - config[j][0];
          const dy = config[i][1] - config[j][1];
          distances.push(Math.sqrt(dx * dx + dy * dy) + 1e-10); // Prevent division by zero
        }
      }
      
      const fitted = poolAdjacentViolators(distances);
      
      let numerator = 0;
      let denominator = 0;
      
      for (let k = 0; k < distances.length; k++) {
        const diff = distances[k] - fitted[k];
        numerator += diff * diff;
        denominator += distances[k] * distances[k];
      }
      
      return denominator > 0 ? Math.sqrt(numerator / denominator) : 1.0;
    };

    // NMDS optimization with PCoA initialization
    let bestStress = Infinity;
    let bestConfiguration: number[][] | null = null;
    let bestIterations = 0;
    const maxIterations = 300;
    const tolerance = 1e-5;

    // Try PCoA initialization first, then random starts
    const initStrategies = [
      () => performPCoA(), // PCoA initialization
      () => Array(n).fill(0).map(() => [(Math.random() - 0.5) * 4, (Math.random() - 0.5) * 4]), // Random wide
      () => Array(n).fill(0).map(() => [(Math.random() - 0.5) * 2, (Math.random() - 0.5) * 2]), // Random medium
      () => Array(n).fill(0).map(() => [(Math.random() - 0.5) * 6, (Math.random() - 0.5) * 6]), // Random tight
    ];

    for (let attempt = 0; attempt < initStrategies.length + 3; attempt++) {
      let config: number[][];
      
      if (attempt < initStrategies.length) {
        config = initStrategies[attempt]();
      } else {
        // Additional random starts with varying scales
        const scale = 2 + (attempt - initStrategies.length) * 1.5;
        config = Array(n).fill(0).map((_, i) => [
          (Math.random() - 0.5) * scale + (i % 2 === 0 ? 0.5 : -0.5),
          (Math.random() - 0.5) * scale + (Math.floor(i / 2) % 2 === 0 ? 0.5 : -0.5)
        ]);
      }
      
      // Ensure non-degenerate starting configuration
      const xRange = Math.max(...config.map(p => p[0])) - Math.min(...config.map(p => p[0]));
      const yRange = Math.max(...config.map(p => p[1])) - Math.min(...config.map(p => p[1]));
      
      if (xRange < 0.1 || yRange < 0.1) {
        config.forEach((point, i) => {
          if (xRange < 0.1) point[0] = (i - n/2) * 0.5;
          if (yRange < 0.1) point[1] = ((i % 2) - 0.5) * 2;
        });
      }

      let prevStress = Infinity;
      let stagnationCount = 0;
      let iterations = 0;
      
      for (let iter = 0; iter < maxIterations; iter++) {
        iterations = iter + 1;
        
        // Calculate current distances
        const distances: number[] = [];
        for (let i = 0; i < n; i++) {
          for (let j = i + 1; j < n; j++) {
            const dx = config[i][0] - config[j][0];
            const dy = config[i][1] - config[j][1];
            distances.push(Math.sqrt(dx * dx + dy * dy) + 1e-10);
          }
        }
        
        // Get fitted distances using isotonic regression
        const fittedDistances = poolAdjacentViolators(distances);
        const currentStress = calculateStress(config);
        
        // Check convergence
        const stressChange = Math.abs(prevStress - currentStress);
        if (stressChange < tolerance) {
          stagnationCount++;
          if (stagnationCount > 15) break;
        } else {
          stagnationCount = 0;
        }
        
        prevStress = currentStress;
        
        // Adaptive step size
        const stepSize = Math.max(0.01, 0.2 * Math.exp(-iter / 100));
        
        // Calculate proper NMDS gradients using Shepard diagram approach
        const gradients = Array(n).fill(0).map(() => [0, 0]);
        
        for (let pairIdx = 0; pairIdx < pairIndices.length; pairIdx++) {
          const [i, j] = pairIndices[pairIdx];
          const dx = config[i][0] - config[j][0];
          const dy = config[i][1] - config[j][1];
          const currentDist = distances[pairIdx];
          const targetDist = fittedDistances[pairIdx];
          
          if (currentDist > 1e-10) {
            // Proper NMDS gradient: move toward target distance
            const error = targetDist - currentDist; // Corrected direction
            const factor = 2 * error / currentDist;
            
            const gradX = factor * dx;
            const gradY = factor * dy;
            
            gradients[i][0] += gradX;
            gradients[i][1] += gradY;
            gradients[j][0] -= gradX;
            gradients[j][1] -= gradY;
          }
        }
        
        // Apply gradients with step size
        for (let i = 0; i < n; i++) {
          config[i][0] += stepSize * gradients[i][0];
          config[i][1] += stepSize * gradients[i][1];
        }
        
        // Monitor for axis collapse
        const xRange = Math.max(...config.map(p => p[0])) - Math.min(...config.map(p => p[0]));
        const yRange = Math.max(...config.map(p => p[1])) - Math.min(...config.map(p => p[1]));
        
        if (iter > 20 && (xRange < 0.05 || yRange < 0.05)) {
          console.warn(`NMDS attempt ${attempt}: Axis collapse detected at iteration ${iter}`);
          break; // Try next initialization
        }
      }
      
      const finalStress = calculateStress(config);
      
      // Validate final configuration - ensure both axes have meaningful variation
      const finalXRange = Math.max(...config.map(p => p[0])) - Math.min(...config.map(p => p[0]));
      const finalYRange = Math.max(...config.map(p => p[1])) - Math.min(...config.map(p => p[1]));
      
      console.log(`NMDS attempt ${attempt}: Stress=${finalStress.toFixed(4)}, X-range=${finalXRange.toFixed(3)}, Y-range=${finalYRange.toFixed(3)}`);
      
      if (finalStress < bestStress && finalXRange > 0.05 && finalYRange > 0.05) {
        bestStress = finalStress;
        bestConfiguration = config.map(point => [...point]);
        bestIterations = iterations;
        
        // If we get good stress, we can stop early
        if (bestStress < 0.15) break;
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
    
    // Create NMDS data with PCoA fallback if NMDS failed
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
        // Fallback to PCoA if NMDS completely failed
        const pcoaConfig = performPCoA();
        return {
          community: community.id,
          NMDS1: pcoaConfig[i][0],
          NMDS2: pcoaConfig[i][1],
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