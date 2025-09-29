import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Info } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface Community {
  id: number;
  species: number[];
  abundance: number[];
}

interface ComprehensiveDiversityMetricsProps {
  communities: Community[];
}

const ComprehensiveDiversityMetrics: React.FC<ComprehensiveDiversityMetricsProps> = ({ communities }) => {
  // Alpha diversity calculations
  const calculateAlphaDiversity = (community: Community) => {
    const total = community.abundance.reduce((sum, count) => sum + count, 0);
    const S = community.species.length; // Species richness
    
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
    
    // Inverse Simpson (Simpson's reciprocal index)
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
      richness: S,
      shannon,
      simpsonDiversity,
      inverseSimpson,
      pielou,
      bergerParker,
      fishersAlpha,
      margalef,
      menhinick
    };
  };

  // Beta diversity calculations
  const calculateBetaDiversity = () => {
    const alphaMetrics = communities.map(calculateAlphaDiversity);
    const meanAlphaRichness = alphaMetrics.reduce((sum, m) => sum + m.richness, 0) / alphaMetrics.length;
    
    // Gamma diversity
    const allSpecies = new Set<number>();
    communities.forEach(community => {
      community.species.forEach(species => allSpecies.add(species));
    });
    const gammaRichness = allSpecies.size;
    
    // Whittaker's beta: β = γ/α̅
    const whittakerBeta = gammaRichness / meanAlphaRichness;
    
    // Additive beta: β = γ - α̅
    const additiveBeta = gammaRichness - meanAlphaRichness;
    
    // Harrison's beta: β = (γ - α̅)/(γ - 1)
    const harrisonBeta = gammaRichness > 1 ? (gammaRichness - meanAlphaRichness) / (gammaRichness - 1) : 0;
    
    // Williams' beta: β = (γ - α̅)/γ
    const williamsBeta = gammaRichness > 0 ? (gammaRichness - meanAlphaRichness) / gammaRichness : 0;
    
    // Routledge's beta: β = (γ² - Σα²)/(2αγ(n-1))
    const sumAlphaSquared = alphaMetrics.reduce((sum, m) => sum + m.richness * m.richness, 0);
    const routledgeBeta = communities.length > 1 ? 
      (gammaRichness * gammaRichness - sumAlphaSquared) / (2 * meanAlphaRichness * gammaRichness * (communities.length - 1)) : 0;
    
    // Jaccard similarity/dissimilarity
    let totalJaccardSimilarity = 0;
    let comparisons = 0;
    
    for (let i = 0; i < communities.length; i++) {
      for (let j = i + 1; j < communities.length; j++) {
        const species1 = new Set(communities[i].species);
        const species2 = new Set(communities[j].species);
        const intersection = new Set([...species1].filter(x => species2.has(x)));
        const union = new Set([...species1, ...species2]);
        
        if (union.size > 0) {
          totalJaccardSimilarity += intersection.size / union.size;
          comparisons++;
        }
      }
    }
    
    const meanJaccardSimilarity = comparisons > 0 ? totalJaccardSimilarity / comparisons : 0;
    const meanJaccardDissimilarity = 1 - meanJaccardSimilarity;
    
    // Sørensen similarity/dissimilarity
    let totalSorensenSimilarity = 0;
    
    for (let i = 0; i < communities.length; i++) {
      for (let j = i + 1; j < communities.length; j++) {
        const species1 = new Set(communities[i].species);
        const species2 = new Set(communities[j].species);
        const intersection = new Set([...species1].filter(x => species2.has(x)));
        
        if ((species1.size + species2.size) > 0) {
          totalSorensenSimilarity += (2 * intersection.size) / (species1.size + species2.size);
        }
      }
    }
    
    const meanSorensenSimilarity = comparisons > 0 ? totalSorensenSimilarity / comparisons : 0;
    const meanSorensenDissimilarity = 1 - meanSorensenSimilarity;
    
    return {
      whittakerBeta,
      additiveBeta,
      harrisonBeta,
      williamsBeta,
      routledgeBeta,
      jaccardSimilarity: meanJaccardSimilarity,
      jaccardDissimilarity: meanJaccardDissimilarity,
      sorensenSimilarity: meanSorensenSimilarity,
      sorensenDissimilarity: meanSorensenDissimilarity,
      gammaRichness,
      meanAlphaRichness
    };
  };

  const alphaMetrics = communities.map(calculateAlphaDiversity);
  const betaMetrics = calculateBetaDiversity();

  const MetricCard = ({ title, value, formula, interpretation, whenToUse, relatedMetrics }: { 
    title: string; 
    value: number; 
    formula: string; 
    interpretation: string;
    whenToUse: string;
    relatedMetrics: string;
  }) => (
    <div className="p-4 border rounded-lg space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="font-medium text-sm">{title}</h4>
        <Badge variant="outline">{value.toFixed(3)}</Badge>
      </div>
      <div className="text-xs text-muted-foreground space-y-2">
        <div><strong>Formula:</strong> {formula}</div>
        <div><strong>Meaning:</strong> {interpretation}</div>
        <div className="pt-1 border-t border-muted/20">
          <div><strong>When to use:</strong> {whenToUse}</div>
        </div>
        <div className="pt-1 border-t border-muted/20">
          <div><strong>Related metrics:</strong> {relatedMetrics}</div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Comprehensive Diversity Analysis</CardTitle>
          <p className="text-sm text-muted-foreground">
            Complete overview of alpha, beta, and gamma diversity metrics with formulas and interpretations
          </p>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="alpha" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="alpha">Alpha Diversity</TabsTrigger>
              <TabsTrigger value="beta">Beta Diversity</TabsTrigger>
              <TabsTrigger value="gamma">Gamma Diversity</TabsTrigger>
            </TabsList>
            
            <TabsContent value="alpha" className="space-y-4">
              <div className="mb-4 p-4 bg-educational-info rounded-lg">
                <h4 className="font-semibold text-sm mb-2">Individual Community Alpha Diversity</h4>
                <p className="text-xs text-muted-foreground">
                  Alpha diversity measures within-community diversity. Each community has its own values - averaging doesn't make ecological sense.
                </p>
              </div>
              
              <div className="space-y-6">
                {/* Species Richness */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="font-medium text-sm">Species Richness (S)</h4>
                    <Badge variant="outline">Range: {Math.min(...alphaMetrics.map(m => m.richness))} - {Math.max(...alphaMetrics.map(m => m.richness))}</Badge>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                    {alphaMetrics.map((metrics, idx) => (
                      <div key={idx} className="p-2 border rounded text-center">
                        <div className="text-xs text-muted-foreground">Community {communities[idx].id}</div>
                        <div className="font-semibold">{metrics.richness}</div>
                      </div>
                    ))}
                  </div>
                  <div className="text-xs text-muted-foreground space-y-1">
                    <div><strong>Formula:</strong> S = number of species</div>
                    <div><strong>When to use:</strong> When you only need to know how many different species are present. Best for simple comparisons between sites.</div>
                    <div><strong>Related metrics:</strong> Margalef and Menhinick indices adjust richness for sample size. Fisher's alpha provides sample-size independent richness.</div>
                  </div>
                </div>

                {/* Shannon Index */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="font-medium text-sm">Shannon Index (H')</h4>
                    <Badge variant="outline">Range: {Math.min(...alphaMetrics.map(m => m.shannon)).toFixed(3)} - {Math.max(...alphaMetrics.map(m => m.shannon)).toFixed(3)}</Badge>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                    {alphaMetrics.map((metrics, idx) => (
                      <div key={idx} className="p-2 border rounded text-center">
                        <div className="text-xs text-muted-foreground">Community {communities[idx].id}</div>
                        <div className="font-semibold">{metrics.shannon.toFixed(3)}</div>
                      </div>
                    ))}
                  </div>
                  <div className="text-xs text-muted-foreground space-y-1">
                    <div><strong>Formula:</strong> H' = -Σ(pi × ln(pi))</div>
                    <div><strong>When to use:</strong> When you want to consider both the number of species AND how evenly distributed they are. Best general-purpose diversity index.</div>
                    <div><strong>Related metrics:</strong> Higher values than Simpson index. Related to Pielou's evenness (J' = H'/ln(S)). More sensitive to rare species than Simpson.</div>
                  </div>
                </div>

                {/* Simpson Diversity */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="font-medium text-sm">Simpson Diversity (1-D)</h4>
                    <Badge variant="outline">Range: {Math.min(...alphaMetrics.map(m => m.simpsonDiversity)).toFixed(3)} - {Math.max(...alphaMetrics.map(m => m.simpsonDiversity)).toFixed(3)}</Badge>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                    {alphaMetrics.map((metrics, idx) => (
                      <div key={idx} className="p-2 border rounded text-center">
                        <div className="text-xs text-muted-foreground">Community {communities[idx].id}</div>
                        <div className="font-semibold">{metrics.simpsonDiversity.toFixed(3)}</div>
                      </div>
                    ))}
                  </div>
                  <div className="text-xs text-muted-foreground space-y-1">
                    <div><strong>Formula:</strong> 1-D = 1 - Σ(pi²)</div>
                    <div><strong>When to use:</strong> When you want to emphasize the contribution of common species. Less sensitive to rare species than Shannon index.</div>
                    <div><strong>Related metrics:</strong> Inverse Simpson (1/D) gives effective number of species. More weight to dominant species than Shannon index.</div>
                  </div>
                </div>

                {/* Pielou's Evenness */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="font-medium text-sm">Pielou's Evenness (J')</h4>
                    <Badge variant="outline">Range: {Math.min(...alphaMetrics.map(m => m.pielou)).toFixed(3)} - {Math.max(...alphaMetrics.map(m => m.pielou)).toFixed(3)}</Badge>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                    {alphaMetrics.map((metrics, idx) => (
                      <div key={idx} className="p-2 border rounded text-center">
                        <div className="text-xs text-muted-foreground">Community {communities[idx].id}</div>
                        <div className="font-semibold">{metrics.pielou.toFixed(3)}</div>
                      </div>
                    ))}
                  </div>
                  <div className="text-xs text-muted-foreground space-y-1">
                    <div><strong>Formula:</strong> J' = H'/ln(S)</div>
                    <div><strong>When to use:</strong> When you want to separate the effects of richness from evenness. Values range 0-1, making comparisons easy.</div>
                    <div><strong>Related metrics:</strong> Normalizes Shannon index by maximum possible value. Inversely related to Berger-Parker dominance. Independent of richness.</div>
                  </div>
                </div>
              </div>
            </TabsContent>
            
            <TabsContent value="beta" className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <MetricCard
                  title="Whittaker's Beta"
                  value={betaMetrics.whittakerBeta}
                  formula="βw = γ/α̅"
                  interpretation="Multiplicative partitioning of diversity"
                  whenToUse="When you want to understand how many times more diverse the region is than the average local community. Classic beta diversity measure."
                  relatedMetrics="Related to additive beta by γ = α̅ × βw. Values >1 indicate turnover. Fundamental to diversity partitioning theory."
                />
                <MetricCard
                  title="Additive Beta"
                  value={betaMetrics.additiveBeta}
                  formula="βa = γ - α̅"
                  interpretation="Additive partitioning of diversity"
                  whenToUse="When you want to know how many 'extra' species exist due to turnover between communities. Easy to interpret."
                  relatedMetrics="Related to Whittaker's beta by γ = α̅ + βa. Same units as alpha and gamma diversity (species number)."
                />
                <MetricCard
                  title="Harrison's Beta"
                  value={betaMetrics.harrisonBeta}
                  formula="βh = (γ - α̅)/(γ - 1)"
                  interpretation="Standardized beta diversity (0-1)"
                  whenToUse="When you want a standardized measure that ranges 0-1 for easy comparison across studies with different species pools."
                  relatedMetrics="Standardized version of additive beta. 0 = no turnover, 1 = complete turnover. Comparable across different systems."
                />
                <MetricCard
                  title="Williams' Beta"
                  value={betaMetrics.williamsBeta}
                  formula="βw = (γ - α̅)/γ"
                  interpretation="Proportion of regional diversity due to turnover"
                  whenToUse="When you want to know what fraction of regional diversity is due to between-community differences rather than local diversity."
                  relatedMetrics="Also ranges 0-1. Complementary to Harrison's beta but normalized by gamma instead of gamma-1."
                />
                <MetricCard
                  title="Routledge's Beta"
                  value={betaMetrics.routledgeBeta}
                  formula="βr = (γ² - Σα²)/(2αγ(n-1))"
                  interpretation="Variance in species composition"
                  whenToUse="When you want to measure variance in community composition. Particularly useful for detecting environmental gradients."
                  relatedMetrics="Based on variance concept rather than simple differences. More sensitive to outlier communities than other measures."
                />
                <MetricCard
                  title="Jaccard Dissimilarity"
                  value={betaMetrics.jaccardDissimilarity}
                  formula="βj = 1 - |A∩B|/|A∪B|"
                  interpretation="Species turnover (presence/absence)"
                  whenToUse="When you only have presence/absence data or want to ignore abundance differences. Focus purely on species turnover."
                  relatedMetrics="Related to Sørensen but more influenced by rare species. Range 0-1. Commonly used in community ecology."
                />
                <MetricCard
                  title="Sørensen Dissimilarity"
                  value={betaMetrics.sorensenDissimilarity}
                  formula="βs = 1 - 2|A∩B|/(|A|+|B|)"
                  interpretation="Alternative measure of species turnover"
                  whenToUse="Alternative to Jaccard when you want to weight shared species more heavily. Less sensitive to rare species."
                  relatedMetrics="Similar to Jaccard but gives more weight to shared species. Generally gives lower values than Jaccard for same data."
                />
              </div>
              
              <div className="p-4 bg-educational-info rounded-lg">
                <h4 className="font-semibold text-sm mb-2">Beta Diversity Relationships</h4>
                <div className="text-xs space-y-1">
                  <p><strong>Multiplicative:</strong> γ = α̅ × βw (diversity components multiply)</p>
                  <p><strong>Additive:</strong> γ = α̅ + βa (diversity components add)</p>
                  <p><strong>Standardized:</strong> βh and βw range from 0-1 for easy comparison</p>
                  <p><strong>Similarity-based:</strong> Jaccard and Sørensen measure compositional overlap</p>
                </div>
              </div>
            </TabsContent>
            
            <TabsContent value="gamma" className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <MetricCard
                    title="Gamma Richness (γ)"
                    value={betaMetrics.gammaRichness}
                    formula="γ = total unique species"
                    interpretation="Regional species pool"
                    whenToUse="When you want to understand the total species diversity available across all local communities in a region."
                    relatedMetrics="Sum of alpha diversity plus species added by beta diversity. Connected to alpha and beta by γ = α̅ × βw or γ = α̅ + βa."
                  />
                  
                  <div className="p-4 border rounded-lg space-y-3">
                    <h4 className="font-medium text-sm">Species Accumulation</h4>
                    <div className="space-y-2">
                      {communities.map((community, index) => (
                        <div key={community.id} className="flex justify-between text-xs">
                          <span>Community {community.id}:</span>
                          <span>{community.species.length} species</span>
                        </div>
                      ))}
                    </div>
                    <div className="pt-2 border-t text-xs">
                      <div className="flex justify-between font-medium">
                        <span>Total (γ):</span>
                        <span>{betaMetrics.gammaRichness} species</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Mean (α̅):</span>
                        <span>{betaMetrics.meanAlphaRichness.toFixed(1)} species</span>
                      </div>
                    </div>
                  </div>
                </div>
                
                <div className="p-4 bg-educational-success rounded-lg space-y-3">
                  <h4 className="font-semibold text-sm">Diversity Partitioning</h4>
                  <div className="text-xs space-y-2">
                    <p><strong>Total Diversity (γ):</strong> {betaMetrics.gammaRichness} species</p>
                    <p><strong>Average Local Diversity (α̅):</strong> {betaMetrics.meanAlphaRichness.toFixed(1)} species</p>
                    <p><strong>Between-community Diversity (β):</strong> {betaMetrics.additiveBeta.toFixed(1)} species</p>
                    <div className="pt-2 border-t">
                      <p><strong>Interpretation:</strong></p>
                      <p>
                        {betaMetrics.additiveBeta > betaMetrics.meanAlphaRichness 
                          ? "High turnover - communities are compositionally distinct"
                          : betaMetrics.additiveBeta > betaMetrics.meanAlphaRichness * 0.5
                          ? "Moderate turnover - some species overlap between communities"
                          : "Low turnover - communities share many species"
                        }
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
};

export default ComprehensiveDiversityMetrics;