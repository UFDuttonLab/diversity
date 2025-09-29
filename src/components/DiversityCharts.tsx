import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, ScatterChart, Scatter, LineChart, Line, PieChart, Pie, Cell } from 'recharts';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';

interface Community {
  id: number;
  species: number[];
  abundance: number[];
}

interface DiversityChartsProps {
  communities: Community[];
}

const DiversityCharts: React.FC<DiversityChartsProps> = ({ communities }) => {
  // Calculate metrics for visualization
  const calculateMetrics = () => {
    return communities.map(community => {
      const total = community.abundance.reduce((sum, count) => sum + count, 0);
      const S = community.species.length;
      
      // Shannon index
      let shannon = 0;
      community.abundance.forEach(count => {
        if (count > 0) {
          const pi = count / total;
          shannon -= pi * Math.log(pi);
        }
      });
      
      // Simpson diversity
      let simpson = 0;
      community.abundance.forEach(count => {
        if (count > 0) {
          const pi = count / total;
          simpson += pi * pi;
        }
      });
      const simpsonDiversity = 1 - simpson;
      
      // Pielou's evenness
      const pielou = S > 1 ? shannon / Math.log(S) : 0;
      
      return {
        community: `Community ${community.id}`,
        richness: S,
        shannon: shannon,
        simpson: simpsonDiversity,
        pielou: pielou,
        abundance: total
      };
    });
  };

  // Rank-abundance data
  const getRankAbundanceData = () => {
    return communities.map(community => {
      const sortedAbundances = [...community.abundance]
        .map((abundance, index) => ({ 
          species: community.species[index], 
          abundance 
        }))
        .sort((a, b) => b.abundance - a.abundance)
        .map((item, rank) => ({
          rank: rank + 1,
          abundance: item.abundance,
          species: item.species,
          community: community.id,
          logAbundance: Math.log(item.abundance)
        }));
      
      return {
        communityId: community.id,
        data: sortedAbundances
      };
    });
  };

  // Species accumulation data
  const getSpeciesAccumulation = () => {
    const allSpecies = new Set();
    return communities.map((community, index) => {
      community.species.forEach(species => allSpecies.add(species));
      return {
        communities: index + 1,
        cumulativeSpecies: allSpecies.size,
        localSpecies: community.species.length
      };
    });
  };

  // Beta diversity heatmap data
  const getBetaMatrix = () => {
    const matrix = [];
    for (let i = 0; i < communities.length; i++) {
      for (let j = 0; j < communities.length; j++) {
        const species1 = new Set(communities[i].species);
        const species2 = new Set(communities[j].species);
        const intersection = new Set([...species1].filter(x => species2.has(x)));
        const union = new Set([...species1, ...species2]);
        
        const jaccard = union.size > 0 ? intersection.size / union.size : 0;
        const dissimilarity = 1 - jaccard;
        
        matrix.push({
          community1: i + 1,
          community2: j + 1,
          similarity: jaccard,
          dissimilarity: dissimilarity
        });
      }
    }
    return matrix;
  };

  const metricsData = calculateMetrics();
  const rankAbundanceData = getRankAbundanceData();
  const accumulationData = getSpeciesAccumulation();
  const betaMatrix = getBetaMatrix();

  const colors = {
    primary: 'hsl(var(--primary))',
    secondary: 'hsl(var(--secondary))',
    accent: 'hsl(var(--accent))',
    muted: 'hsl(var(--muted))'
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Alpha Diversity Metrics */}
      <Card>
        <CardHeader>
          <CardTitle>Alpha Diversity Comparison</CardTitle>
        </CardHeader>
        <CardContent>
          <ChartContainer config={{ 
            richness: { label: 'Species Richness', color: colors.primary },
            shannon: { label: 'Shannon Index', color: colors.secondary },
            simpson: { label: 'Simpson Diversity', color: colors.accent }
          }}>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={metricsData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="community" />
                <YAxis />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="richness" fill={colors.primary} name="Species Richness" />
                <Bar dataKey="shannon" fill={colors.secondary} name="Shannon Index" />
                <Bar dataKey="simpson" fill={colors.accent} name="Simpson Diversity" />
              </BarChart>
            </ResponsiveContainer>
          </ChartContainer>
          
          <div className="mt-4 p-3 bg-educational-info rounded-lg">
            <div className="text-xs space-y-1">
              <p><strong>Interpretation:</strong> Different metrics can rank communities differently - richness only counts species, Shannon weighs rare species more, Simpson emphasizes dominant species.</p>
              <p><strong>Pattern Recognition:</strong> Look for communities where metrics agree vs. disagree - disagreement reveals important ecological differences in evenness.</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Species Accumulation Curve */}
      <Card>
        <CardHeader>
          <CardTitle>Species Accumulation</CardTitle>
        </CardHeader>
        <CardContent>
          <ChartContainer config={{
            cumulativeSpecies: { label: 'Cumulative Species', color: colors.primary },
            localSpecies: { label: 'Local Species', color: colors.secondary }
          }}>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={accumulationData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="communities" label={{ value: 'Number of Communities', position: 'insideBottom', offset: -5 }} />
                <YAxis label={{ value: 'Species Count', angle: -90, position: 'insideLeft' }} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Line 
                  type="monotone" 
                  dataKey="cumulativeSpecies" 
                  stroke={colors.primary} 
                  strokeWidth={3}
                  name="Cumulative Species (γ)"
                />
                <Line 
                  type="monotone" 
                  dataKey="localSpecies" 
                  stroke={colors.secondary} 
                  strokeWidth={2}
                  strokeDasharray="5 5"
                  name="Local Species (α)"
                />
              </LineChart>
            </ResponsiveContainer>
          </ChartContainer>
          
          <div className="mt-4 p-3 bg-educational-success rounded-lg">
            <div className="text-xs space-y-1">
              <p><strong>Interpretation:</strong> Steep cumulative curve = high beta diversity (communities are different). Flat curve = low beta diversity (communities are similar).</p>
              <p><strong>Pattern Recognition:</strong> Compare the gap between cumulative and local species - larger gaps indicate more species turnover between communities.</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Rank-Abundance Plot */}
      <Card>
        <CardHeader>
          <CardTitle>Rank-Abundance Curves</CardTitle>
        </CardHeader>
        <CardContent>
          <ChartContainer config={{
            abundance: { label: 'Abundance', color: colors.primary }
          }}>
            <ResponsiveContainer width="100%" height={300}>
              <ScatterChart
                margin={{ top: 20, right: 20, bottom: 60, left: 60 }}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  type="number"
                  dataKey="rank" 
                  label={{ value: 'Species Rank', position: 'insideBottom', offset: -5 }}
                  domain={['dataMin', 'dataMax']}
                />
                <YAxis 
                  type="number"
                  dataKey="abundance"
                  scale="log"
                  domain={['dataMin', 'dataMax']}
                  label={{ value: 'Abundance (log scale)', angle: -90, position: 'insideLeft' }}
                />
                <ChartTooltip 
                  content={({ active, payload }) => {
                    if (active && payload && payload.length > 0) {
                      const data = payload[0].payload;
                      return (
                        <div className="bg-background border rounded p-2 shadow">
                          <p>Community {data.community}</p>
                          <p>Rank: {data.rank}</p>
                          <p>Species {data.species}: {data.abundance} individuals</p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                {rankAbundanceData.map((community, index) => (
                  <Scatter
                    key={community.communityId}
                    data={community.data}
                    fill={`hsl(${(index * 60) % 360}, 70%, 60%)`}
                    name={`Community ${community.communityId}`}
                  />
                ))}
              </ScatterChart>
            </ResponsiveContainer>
          </ChartContainer>
          
          <div className="mt-4 p-3 bg-educational-warning rounded-lg">
            <div className="text-xs space-y-3">
              <div>
                <p className="font-semibold mb-1">What Are Rank-Abundance Curves?</p>
                <p>These curves show how evenly species abundances are distributed in each community. Species are ranked from most to least abundant (rank 1 = most common) and plotted against their abundance on a log scale.</p>
              </div>
              
              <div>
                <p className="font-semibold mb-1">Reading the Patterns:</p>
                <p><strong>Steep slopes:</strong> High dominance - a few species make up most individuals (uneven community)</p>
                <p><strong>Gentle slopes:</strong> High evenness - species have more similar abundances (balanced community)</p>
                <p><strong>Long tails:</strong> Many rare species present (high richness but with rare species)</p>
                <p><strong>Short curves:</strong> Few species total (low richness)</p>
              </div>
              
              <div>
                <p className="font-semibold mb-1">Ecological Meaning:</p>
                <p><strong>Parallel curves:</strong> Communities have similar organization patterns despite different species</p>
                <p><strong>Convergent curves:</strong> Communities become more similar in rare species</p>
                <p><strong>Divergent curves:</strong> Communities differ in both dominant and rare species patterns</p>
              </div>
              
              <div>
                <p className="font-semibold mb-1">Real-World Context:</p>
                <p>Disturbed habitats often show steep curves (few dominant species). Mature, stable communities typically show gentler slopes (more even distribution). Harsh environments may have short curves (few species can survive).</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Evenness vs Richness */}
      <Card>
        <CardHeader>
          <CardTitle>Evenness vs Richness</CardTitle>
        </CardHeader>
        <CardContent>
          <ChartContainer config={{
            richness: { label: 'Species Richness', color: colors.primary }
          }}>
            <ResponsiveContainer width="100%" height={300}>
              <ScatterChart data={metricsData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="pielou" 
                  label={{ value: "Pielou's Evenness", position: 'insideBottom', offset: -5 }}
                  domain={[0, 1]}
                  tickFormatter={(value) => value.toFixed(2)}
                />
                <YAxis 
                  dataKey="richness"
                  label={{ value: 'Species Richness', angle: -90, position: 'insideLeft' }}
                />
                <ChartTooltip 
                  content={({ active, payload }) => {
                    if (active && payload && payload.length > 0) {
                      const data = payload[0].payload;
                      return (
                        <div className="bg-background border rounded p-2 shadow">
                          <p>{data.community}</p>
                          <p>Evenness: {data.pielou.toFixed(3)}</p>
                          <p>Richness: {data.richness}</p>
                          <p>Shannon: {data.shannon.toFixed(3)}</p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Scatter dataKey="richness" fill={colors.primary} />
              </ScatterChart>
            </ResponsiveContainer>
          </ChartContainer>
          
          <div className="mt-4 p-3 bg-educational-success rounded-lg">
            <div className="text-xs space-y-1">
              <p><strong>Interpretation:</strong> Top-right = high richness + high evenness (ideal). Top-left = high richness but uneven. Bottom-right = few species but very even.</p>
              <p><strong>Pattern Recognition:</strong> Points spread across the plot indicate communities achieve diversity through different mechanisms - some via richness, others via evenness.</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default DiversityCharts;