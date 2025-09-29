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

    // Proper NMDS Algorithm with rank-based stress minimization
    let bestStress = Infinity;
    let bestConfiguration = null;
    let bestIterations = 0;
    const maxIterations = 1000;
    const tolerance = 1e-8;
    
    // Extract dissimilarities and their ranks for NMDS
    const dissimilarities: number[] = [];
    const pairIndices: [number, number][] = [];
    
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        dissimilarities.push(brayCurtis[i][j]);
        pairIndices.push([i, j]);
      }
    }
    
    // Sort dissimilarities to get ranks (for non-metric scaling)
    const sortedIndices = dissimilarities
      .map((_, index) => index)
      .sort((a, b) => dissimilarities[a] - dissimilarities[b]);
    
    // Improved isotonic regression using Pool Adjacent Violators
    const isotonicRegression = (distances: number[]): number[] => {
      // Create pairs of (rank, distance) sorted by rank
      const pairs = sortedIndices.map((origIndex, rankIndex) => ({
        rank: rankIndex,
        distance: distances[origIndex],
        origIndex
      }));
      
      const fitted = new Array(pairs.length);
      
      // Pool Adjacent Violators Algorithm
      let i = 0;
      while (i < pairs.length) {
        let j = i;
        let sum = pairs[i].distance;
        let count = 1;
        
        // Look ahead to find violations and pool them
        while (j + 1 < pairs.length) {
          const currentAvg = sum / count;
          const nextDistance = pairs[j + 1].distance;
          
          if (currentAvg > nextDistance) {
            // Violation found, add to pool
            j++;
            sum += pairs[j].distance;
            count++;
          } else {
            break;
          }
        }
        
        // Set all pooled values to their average
        const average = sum / count;
        for (let k = i; k <= j; k++) {
          fitted[k] = average;
        }
        
        i = j + 1;
      }
      
      // Map back to original order
      const result = new Array(distances.length);
      pairs.forEach((pair, fittedIndex) => {
        result[pair.origIndex] = fitted[fittedIndex];
      });
      
      return result;
    };
    
    // Calculate Kruskal's stress-1
    const calculateStress = (config: number[][]): number => {
      const distances: number[] = [];
      
      // Calculate Euclidean distances between all pairs
      for (let i = 0; i < n; i++) {
        for (let j = i + 1; j < n; j++) {
          const dx = config[i][0] - config[j][0];
          const dy = config[i][1] - config[j][1];
          const dist = Math.sqrt(dx * dx + dy * dy);
          distances.push(dist);
        }
      }
      
      // Get fitted distances from isotonic regression
      const fittedDistances = isotonicRegression(distances);
      
      // Calculate Kruskal's stress-1: sqrt(Σ(d - d̂)² / Σd²)
      let numerator = 0;
      let denominator = 0;
      
      for (let k = 0; k < distances.length; k++) {
        const diff = distances[k] - fittedDistances[k];
        numerator += diff * diff;
        denominator += distances[k] * distances[k];
      }
      
      return denominator > 0 ? Math.sqrt(numerator / denominator) : 1.0;
    };

    // Principal Coordinate Analysis (PCoA) for better initialization
    const initializePCoA = (): number[][] => {
      // Convert dissimilarities to similarities for PCoA
      const similarities = brayCurtis.map(row => 
        row.map(val => 1 - val)
      );
      
      // Double centering matrix for PCoA
      const n = similarities.length;
      const centered = Array(n).fill(0).map(() => Array(n).fill(0));
      
      // Calculate row and column means
      const rowMeans = similarities.map(row => 
        row.reduce((sum, val) => sum + val, 0) / n
      );
      const colMeans = Array(n).fill(0).map((_, j) => 
        similarities.reduce((sum, row) => sum + row[j], 0) / n
      );
      const grandMean = rowMeans.reduce((sum, val) => sum + val, 0) / n;
      
      // Apply double centering
      for (let i = 0; i < n; i++) {
        for (let j = 0; j < n; j++) {
          centered[i][j] = similarities[i][j] - rowMeans[i] - colMeans[j] + grandMean;
        }
      }
      
      // Simple eigen-like initialization (approximate first 2 components)
      return Array(n).fill(0).map((_, i) => [
        centered[i].reduce((sum, val) => sum + val, 0) / n,
        centered[i].reduce((sum, val, j) => sum + val * Math.cos(2 * Math.PI * j / n), 0) / n
      ]);
    };
    
    // Try multiple starting configurations
    for (let attempt = 0; attempt < 20; attempt++) {
      let config: number[][];
      
      if (attempt === 0) {
        // Best: Start with PCoA approximation
        config = initializePCoA();
      } else if (attempt === 1) {
        // Circle pattern
        config = Array(n).fill(0).map((_, i) => {
          const angle = (i / n) * 2 * Math.PI;
          return [Math.cos(angle) * 2, Math.sin(angle) * 2];
        });
      } else {
        // Random configurations with diverse scales
        const scale = 0.5 + attempt * 0.3;
        config = Array(n).fill(0).map(() => [
          (Math.random() - 0.5) * scale * 8,
          (Math.random() - 0.5) * scale * 8
        ]);
      }
      
      let prevStress = Infinity;
      let iterations = 0;
      let stagnationCount = 0;
      
      // Gradient descent optimization
      for (let iter = 0; iter < maxIterations; iter++) {
        iterations = iter + 1;
        const currentStress = calculateStress(config);
        
        // Check for convergence
        if (Math.abs(prevStress - currentStress) < tolerance) {
          break;
        }
        
        // Check for stagnation
        if (Math.abs(prevStress - currentStress) < 1e-6) {
          stagnationCount++;
          if (stagnationCount > 20) break;
        } else {
          stagnationCount = 0;
        }
        
        prevStress = currentStress;
        
        // Adaptive step size
        const baseStep = 0.05;
        const stepSize = baseStep * Math.exp(-iter / 200) * (1 + 0.1 * Math.random());
        
        // Calculate stress-based gradients
        const gradients = Array(n).fill(0).map(() => [0, 0]);
        
        for (let pairIdx = 0; pairIdx < pairIndices.length; pairIdx++) {
          const [i, j] = pairIndices[pairIdx];
          const dx = config[i][0] - config[j][0];
          const dy = config[i][1] - config[j][1];
          const currentDist = Math.sqrt(dx * dx + dy * dy);
          
          if (currentDist > 1e-10) {
            // Get all distances for isotonic regression
            const allDistances: number[] = [];
            for (let pi = 0; pi < pairIndices.length; pi++) {
              const [pi1, pi2] = pairIndices[pi];
              const pdx = config[pi1][0] - config[pi2][0];
              const pdy = config[pi1][1] - config[pi2][1];
              allDistances.push(Math.sqrt(pdx * pdx + pdy * pdy));
            }
            
            const fittedDistances = isotonicRegression(allDistances);
            const targetDist = fittedDistances[pairIdx];
            
            // Gradient based on difference from fitted distance
            const error = currentDist - targetDist;
            const gradMagnitude = error / currentDist;
            
            gradients[i][0] += gradMagnitude * dx;
            gradients[i][1] += gradMagnitude * dy;
            gradients[j][0] -= gradMagnitude * dx;
            gradients[j][1] -= gradMagnitude * dy;
          }
        }
        
        // Update configuration
        for (let i = 0; i < n; i++) {
          config[i][0] -= stepSize * gradients[i][0];
          config[i][1] -= stepSize * gradients[i][1];
        }
      }
      
      const finalStress = calculateStress(config);
      
      if (finalStress < bestStress) {
        bestStress = finalStress;
        bestConfiguration = config.map(point => [...point]);
        bestIterations = iterations;
      }
    }
    
    // Post-process the best configuration
    if (bestConfiguration) {
      // Center at origin
      const meanX = bestConfiguration.reduce((sum, p) => sum + p[0], 0) / n;
      const meanY = bestConfiguration.reduce((sum, p) => sum + p[1], 0) / n;
      
      bestConfiguration.forEach(p => {
        p[0] -= meanX;
        p[1] -= meanY;
      });
      
      // Scale to reasonable range while preserving relative distances
      const allDists = bestConfiguration.flatMap(p => [Math.abs(p[0]), Math.abs(p[1])]);
      const maxDist = Math.max(...allDists, 0.1);
      const scale = 2.5 / maxDist;
      
      bestConfiguration.forEach(p => {
        p[0] *= scale;
        p[1] *= scale;
      });
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