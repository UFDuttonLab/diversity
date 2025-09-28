import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, LineChart, Line } from 'recharts';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';

interface Community {
  id: number;
  species: number[];
  abundance: number[];
}

interface AlphaComparisonProps {
  communities: Community[];
}

const AlphaComparison: React.FC<AlphaComparisonProps> = ({ communities }) => {
  // Calculate all alpha diversity metrics for each community
  const calculateAllMetrics = () => {
    return communities.map(community => {
      const total = community.abundance.reduce((sum, count) => sum + count, 0);
      const S = community.species.length;
      
      // Shannon index: H' = -Σ(pi * ln(pi))
      let shannon = 0;
      community.abundance.forEach(count => {
        if (count > 0) {
          const pi = count / total;
          shannon -= pi * Math.log(pi);
        }
      });
      
      // Simpson index: D = Σ(pi²), Simpson diversity = 1-D
      let simpson = 0;
      community.abundance.forEach(count => {
        if (count > 0) {
          const pi = count / total;
          simpson += pi * pi;
        }
      });
      const simpsonDiversity = 1 - simpson;
      const inverseSimpson = 1 / simpson;
      
      // Pielou's evenness: J' = H'/ln(S)
      const pielou = S > 1 ? shannon / Math.log(S) : 0;
      
      // Berger-Parker dominance: max(pi)
      const bergerParker = Math.max(...community.abundance) / total;
      
      // Fisher's alpha (approximation)
      const fishersAlpha = S > 1 ? (S - 1) / Math.log(total) : 0;
      
      // Margalef's richness: (S-1)/ln(N)
      const margalef = total > 1 ? (S - 1) / Math.log(total) : 0;
      
      // Menhinick's richness: S/√N
      const menhinick = S / Math.sqrt(total);
      
      return {
        community: `Community ${community.id}`,
        communityId: community.id,
        richness: S,
        shannon: parseFloat(shannon.toFixed(3)),
        simpsonDiversity: parseFloat(simpsonDiversity.toFixed(3)),
        inverseSimpson: parseFloat(inverseSimpson.toFixed(3)),
        pielou: parseFloat(pielou.toFixed(3)),
        bergerParker: parseFloat(bergerParker.toFixed(3)),
        fishersAlpha: parseFloat(fishersAlpha.toFixed(3)),
        margalef: parseFloat(margalef.toFixed(3)),
        menhinick: parseFloat(menhinick.toFixed(3))
      };
    });
  };

  const metricsData = calculateAllMetrics();

  const colors = {
    primary: 'hsl(var(--primary))',
    secondary: 'hsl(var(--secondary))',
    accent: 'hsl(var(--accent))',
    muted: 'hsl(var(--muted))'
  };

  return (
    <div className="space-y-6">
      {/* Comparison Table */}
      <Card>
        <CardHeader>
          <CardTitle>Alpha Diversity Metrics by Community</CardTitle>
          <p className="text-sm text-muted-foreground">
            Compare diversity metrics across all communities
          </p>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-2 font-medium">Community</th>
                  <th className="text-center p-2 font-medium">Richness (S)</th>
                  <th className="text-center p-2 font-medium">Shannon (H')</th>
                  <th className="text-center p-2 font-medium">Simpson (1-D)</th>
                  <th className="text-center p-2 font-medium">Inverse Simpson</th>
                  <th className="text-center p-2 font-medium">Pielou's (J')</th>
                  <th className="text-center p-2 font-medium">Berger-Parker</th>
                  <th className="text-center p-2 font-medium">Fisher's α</th>
                  <th className="text-center p-2 font-medium">Margalef</th>
                  <th className="text-center p-2 font-medium">Menhinick</th>
                </tr>
              </thead>
              <tbody>
                {metricsData.map((metrics, index) => (
                  <tr key={metrics.communityId} className={index % 2 === 0 ? 'bg-muted/20' : ''}>
                    <td className="p-2 font-medium">{metrics.community}</td>
                    <td className="p-2 text-center">
                      <Badge variant="outline">{metrics.richness}</Badge>
                    </td>
                    <td className="p-2 text-center">
                      <Badge variant="secondary">{metrics.shannon}</Badge>
                    </td>
                    <td className="p-2 text-center">
                      <Badge variant="secondary">{metrics.simpsonDiversity}</Badge>
                    </td>
                    <td className="p-2 text-center">
                      <Badge variant="secondary">{metrics.inverseSimpson}</Badge>
                    </td>
                    <td className="p-2 text-center">
                      <Badge variant="secondary">{metrics.pielou}</Badge>
                    </td>
                    <td className="p-2 text-center">
                      <Badge variant="outline">{metrics.bergerParker}</Badge>
                    </td>
                    <td className="p-2 text-center">
                      <Badge variant="outline">{metrics.fishersAlpha}</Badge>
                    </td>
                    <td className="p-2 text-center">
                      <Badge variant="outline">{metrics.margalef}</Badge>
                    </td>
                    <td className="p-2 text-center">
                      <Badge variant="outline">{metrics.menhinick}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          
          <div className="mt-4 p-3 bg-educational-info rounded-lg">
            <h5 className="font-semibold text-sm mb-2">Why This Table Matters</h5>
            <div className="text-xs space-y-1">
              <p><strong>Design Choice:</strong> Table format allows precise comparison of numerical values across multiple metrics simultaneously.</p>
              <p><strong>Interpretation:</strong> Look for patterns - do communities rank similarly across metrics? Differences reveal whether diversity comes from richness vs. evenness.</p>
              <p><strong>Usage:</strong> Use this to identify which metric best captures the diversity pattern you're interested in for your specific research question.</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Visual Charts for Key Metrics */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Richness and Shannon Comparison */}
        <Card>
          <CardHeader>
            <CardTitle>Richness vs Shannon Diversity</CardTitle>
          </CardHeader>
          <CardContent>
            <ChartContainer config={{
              richness: { label: 'Species Richness', color: colors.primary },
              shannon: { label: 'Shannon Index', color: colors.secondary }
            }}>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={metricsData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="community" />
                  <YAxis />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar dataKey="richness" fill={colors.primary} name="Species Richness" />
                  <Bar dataKey="shannon" fill={colors.secondary} name="Shannon Index" />
                </BarChart>
              </ResponsiveContainer>
            </ChartContainer>
            
            <div className="mt-3 p-3 bg-educational-info rounded-lg">
              <div className="text-xs space-y-1">
                <p><strong>Why side-by-side bars?</strong> Directly compares richness (species count) vs Shannon (richness + evenness combined).</p>
                <p><strong>Key insight:</strong> When bars are similar height, diversity comes from richness. When Shannon is much lower than richness, community has low evenness.</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Evenness Comparison */}
        <Card>
          <CardHeader>
            <CardTitle>Evenness Metrics Comparison</CardTitle>
          </CardHeader>
          <CardContent>
            <ChartContainer config={{
              pielou: { label: "Pielou's Evenness", color: colors.accent },
              bergerParker: { label: 'Berger-Parker Dominance', color: colors.muted }
            }}>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={metricsData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="community" />
                  <YAxis domain={[0, 1]} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Line 
                    type="monotone" 
                    dataKey="pielou" 
                    stroke={colors.accent} 
                    strokeWidth={3}
                    name="Pielou's Evenness (higher = more even)"
                  />
                  <Line 
                    type="monotone" 
                    dataKey="bergerParker" 
                    stroke={colors.muted} 
                    strokeWidth={3}
                    strokeDasharray="5 5"
                    name="Berger-Parker Dominance (higher = less even)"
                  />
                </LineChart>
              </ResponsiveContainer>
            </ChartContainer>
            
            <div className="mt-3 p-3 bg-educational-warning rounded-lg">
              <div className="text-xs space-y-1">
                <p><strong>Why line chart?</strong> Shows how evenness metrics change across communities - trends are easier to see than in bar charts.</p>
                <p><strong>Key insight:</strong> Pielou's and Berger-Parker should move in opposite directions - high evenness = low dominance. Look for exceptions!</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Simpson Indices */}
        <Card>
          <CardHeader>
            <CardTitle>Simpson-based Indices</CardTitle>
          </CardHeader>
          <CardContent>
            <ChartContainer config={{
              simpsonDiversity: { label: 'Simpson Diversity', color: colors.primary },
              inverseSimpson: { label: 'Inverse Simpson', color: colors.secondary }
            }}>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={metricsData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="community" />
                  <YAxis />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar dataKey="simpsonDiversity" fill={colors.primary} name="Simpson Diversity (1-D)" />
                  <Bar dataKey="inverseSimpson" fill={colors.secondary} name="Inverse Simpson (1/D)" />
                </BarChart>
              </ResponsiveContainer>
            </ChartContainer>
            
            <div className="mt-3 p-3 bg-educational-success rounded-lg">
              <div className="text-xs space-y-1">
                <p><strong>Why both Simpson indices?</strong> Simpson diversity (1-D) ranges 0-1, Inverse Simpson (1/D) gives "effective species number".</p>
                <p><strong>Key insight:</strong> Inverse Simpson is easier to interpret - it tells you how many equally-abundant species would give the same diversity.</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Richness Indices */}
        <Card>
          <CardHeader>
            <CardTitle>Richness-based Indices</CardTitle>
          </CardHeader>
          <CardContent>
            <ChartContainer config={{
              fishersAlpha: { label: "Fisher's Alpha", color: colors.accent },
              margalef: { label: "Margalef's Index", color: colors.muted },
              menhinick: { label: "Menhinick's Index", color: colors.primary }
            }}>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={metricsData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="community" />
                  <YAxis />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Line 
                    type="monotone" 
                    dataKey="fishersAlpha" 
                    stroke={colors.accent} 
                    strokeWidth={2}
                    name="Fisher's Alpha"
                  />
                  <Line 
                    type="monotone" 
                    dataKey="margalef" 
                    stroke={colors.muted} 
                    strokeWidth={2}
                    name="Margalef's Index"
                  />
                  <Line 
                    type="monotone" 
                    dataKey="menhinick" 
                    stroke={colors.primary} 
                    strokeWidth={2}
                    name="Menhinick's Index"
                  />
                </LineChart>
              </ResponsiveContainer>
            </ChartContainer>
            
            <div className="mt-3 p-3 bg-educational-info rounded-lg">
              <div className="text-xs space-y-1">
                <p><strong>Why line chart for richness indices?</strong> These metrics correct richness for sample size - lines show if corrections change community rankings.</p>
                <p><strong>Key insight:</strong> If lines cross, different sample-size corrections give different answers about which community is most diverse.</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AlphaComparison;