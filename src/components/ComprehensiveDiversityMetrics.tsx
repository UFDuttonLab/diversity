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
    const meanAlphaShannon = alphaMetrics.reduce((sum, m) => sum + m.shannon, 0) / alphaMetrics.length;
    const meanAlphaSimpson = alphaMetrics.reduce((sum, m) => sum + m.simpsonDiversity, 0) / alphaMetrics.length;
    
    // Gamma diversity - pool all abundances across communities
    const allSpecies = new Set<number>();
    communities.forEach(community => {
      community.species.forEach(species => allSpecies.add(species));
    });
    const gammaRichness = allSpecies.size;
    
    // Pool abundances for gamma Shannon and Simpson
    const pooledAbundances = new Map<number, number>();
    let totalIndividuals = 0;
    
    communities.forEach(community => {
      community.species.forEach((species, idx) => {
        const count = community.abundance[idx];
        pooledAbundances.set(species, (pooledAbundances.get(species) || 0) + count);
        totalIndividuals += count;
      });
    });
    
    // Gamma Shannon: H'γ = -Σ(pi_pooled × ln(pi_pooled))
    let gammaShannon = 0;
    pooledAbundances.forEach(count => {
      if (count > 0) {
        const pi = count / totalIndividuals;
        gammaShannon -= pi * Math.log(pi);
      }
    });
    
    // Gamma Simpson: Dγ = 1 - Σ(pi_pooled²)
    let gammaSimpsonD = 0;
    pooledAbundances.forEach(count => {
      if (count > 0) {
        const pi = count / totalIndividuals;
        gammaSimpsonD += pi * pi;
      }
    });
    const gammaSimpson = 1 - gammaSimpsonD;
    
    // Additive partitioning for Shannon: βH' = H'γ - H'α
    const betaShannon = gammaShannon - meanAlphaShannon;
    
    // Multiplicative partitioning for Simpson using effective numbers
    // Effective numbers: ᴰD = 1/(1-D) = 1/Σ(pi²)
    const effectiveGammaSimpson = 1 / gammaSimpsonD;
    const effectiveAlphaSimpson = 1 / (1 - meanAlphaSimpson);
    const betaSimpsonMultiplicative = effectiveGammaSimpson / effectiveAlphaSimpson;
    
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
      meanAlphaRichness,
      gammaShannon,
      meanAlphaShannon,
      betaShannon,
      gammaSimpson,
      meanAlphaSimpson,
      betaSimpsonMultiplicative,
      effectiveGammaSimpson,
      effectiveAlphaSimpson
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
              <div className="mb-4 p-4 bg-educational-info rounded-lg">
                <h4 className="font-semibold text-sm mb-2">Gamma Diversity</h4>
                <p className="text-xs text-muted-foreground">
                  Gamma diversity measures total diversity across all communities in a region. It includes richness-based (species counts) 
                  and abundance-based (Shannon, Simpson) metrics that reveal different aspects of regional biodiversity.
                </p>
              </div>
              
              <div className="space-y-4">
                {/* Gamma Richness */}
                <div className="p-6 border rounded-lg space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="font-medium">Gamma Richness (γ)</h4>
                    <Badge variant="secondary" className="text-lg px-3 py-1">{betaMetrics.gammaRichness}</Badge>
                  </div>
                  
                  <div className="text-sm text-muted-foreground space-y-2">
                    <div className="p-3 bg-background rounded">
                      <strong>Formula:</strong> γ = total number of species across all communities
                    </div>
                    
                    <div className="pt-2 border-t border-muted/20">
                      <h5 className="font-semibold mb-2">Interpretation:</h5>
                      <p>Total regional species pool. Ignores abundances - only counts presence/absence.</p>
                    </div>
                  </div>
                </div>

                {/* Gamma Shannon */}
                <div className="p-6 border rounded-lg space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="font-medium">Gamma Shannon (H'γ)</h4>
                    <Badge variant="secondary" className="text-lg px-3 py-1">{betaMetrics.gammaShannon.toFixed(3)}</Badge>
                  </div>
                  
                  <div className="text-sm text-muted-foreground space-y-2">
                    <div className="p-3 bg-background rounded">
                      <strong>Formula:</strong> H'γ = -Σ(pi_pooled × ln(pi_pooled))
                    </div>
                    
                    <div className="pt-2 border-t border-muted/20">
                      <h5 className="font-semibold mb-2">Interpretation:</h5>
                      <p>
                        Regional Shannon diversity calculated from pooled abundances across all communities. 
                        Accounts for both species identity and relative abundance at the regional scale.
                      </p>
                    </div>
                    
                    <div className="pt-2 border-t border-muted/20 text-xs">
                      <strong>Mean Alpha Shannon:</strong> {betaMetrics.meanAlphaShannon.toFixed(3)}<br/>
                      <strong>Mathematical property:</strong> H'γ ≥ H'α (gamma is always ≥ mean alpha)
                    </div>
                  </div>
                </div>

                {/* Gamma Simpson */}
                <div className="p-6 border rounded-lg space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="font-medium">Gamma Simpson (1-Dγ)</h4>
                    <Badge variant="secondary" className="text-lg px-3 py-1">{betaMetrics.gammaSimpson.toFixed(3)}</Badge>
                  </div>
                  
                  <div className="text-sm text-muted-foreground space-y-2">
                    <div className="p-3 bg-background rounded">
                      <strong>Formula:</strong> 1-Dγ = 1 - Σ(pi_pooled²)
                    </div>
                    
                    <div className="pt-2 border-t border-muted/20">
                      <h5 className="font-semibold mb-2">Interpretation:</h5>
                      <p>
                        Regional Simpson diversity from pooled abundances. Emphasizes contribution of common species 
                        across the entire region. Less sensitive to rare species than Shannon.
                      </p>
                    </div>
                    
                    <div className="pt-2 border-t border-muted/20 text-xs">
                      <strong>Mean Alpha Simpson:</strong> {betaMetrics.meanAlphaSimpson.toFixed(3)}<br/>
                      <strong>Effective number of species (gamma):</strong> {betaMetrics.effectiveGammaSimpson.toFixed(2)}
                    </div>
                  </div>
                </div>

                {/* Diversity Partitioning */}
                <div className="p-6 border rounded-lg space-y-4 bg-educational-info">
                  <h4 className="font-semibold">Diversity Partitioning</h4>
                  
                  <div className="space-y-4 text-sm">
                    {/* Richness Partitioning */}
                    <div className="space-y-2">
                      <h5 className="font-semibold text-xs uppercase">Richness-Based Partitioning</h5>
                      <div className="space-y-2 text-xs">
                        <div className="p-3 bg-background rounded">
                          <strong>Multiplicative:</strong> γ = α̅ × β<br/>
                          <span className="text-muted-foreground">
                            {betaMetrics.gammaRichness} = {betaMetrics.meanAlphaRichness.toFixed(2)} × {betaMetrics.whittakerBeta.toFixed(2)}
                          </span>
                        </div>
                        <div className="p-3 bg-background rounded">
                          <strong>Additive:</strong> γ = α̅ + β<br/>
                          <span className="text-muted-foreground">
                            {betaMetrics.gammaRichness} = {betaMetrics.meanAlphaRichness.toFixed(2)} + {betaMetrics.additiveBeta.toFixed(2)}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Shannon Partitioning */}
                    <div className="space-y-2 pt-2 border-t border-muted/20">
                      <h5 className="font-semibold text-xs uppercase">Shannon-Based Partitioning (Additive)</h5>
                      <div className="p-3 bg-background rounded text-xs">
                        <strong>Formula:</strong> H'γ = H'α + βH'<br/>
                        <strong>Between-community diversity:</strong> βH' = H'γ - H'α<br/>
                        <span className="text-muted-foreground">
                          {betaMetrics.gammaShannon.toFixed(3)} = {betaMetrics.meanAlphaShannon.toFixed(3)} + {betaMetrics.betaShannon.toFixed(3)}
                        </span>
                        <p className="mt-2 text-muted-foreground">
                          Shannon diversity partitions additively. βH' represents the diversity gained from comparing communities.
                          Higher values indicate greater turnover in species composition and abundance.
                        </p>
                      </div>
                    </div>

                    {/* Simpson Partitioning */}
                    <div className="space-y-2 pt-2 border-t border-muted/20">
                      <h5 className="font-semibold text-xs uppercase">Simpson-Based Partitioning (Multiplicative)</h5>
                      <div className="p-3 bg-background rounded text-xs">
                        <strong>Formula:</strong> ᴰDγ = ᴰDα × βD<br/>
                        <strong>True beta diversity:</strong> βD = ᴰDγ / ᴰDα<br/>
                        <span className="text-muted-foreground">
                          {betaMetrics.effectiveGammaSimpson.toFixed(2)} = {betaMetrics.effectiveAlphaSimpson.toFixed(2)} × {betaMetrics.betaSimpsonMultiplicative.toFixed(2)}
                        </span>
                        <p className="mt-2 text-muted-foreground">
                          Using effective numbers (Hill numbers), Simpson diversity partitions multiplicatively. 
                          βD = {betaMetrics.betaSimpsonMultiplicative.toFixed(2)} means the region contains {betaMetrics.betaSimpsonMultiplicative.toFixed(2)}× 
                          as many "effective communities" as expected if all communities were identical.
                        </p>
                      </div>
                    </div>

                    {/* Key Insights */}
                    <div className="pt-2 border-t border-muted/20">
                      <h5 className="font-semibold text-xs mb-2">Key Insights</h5>
                      <ul className="space-y-1 text-xs text-muted-foreground list-disc list-inside">
                        <li>Richness only counts species; Shannon/Simpson also consider abundances</li>
                        <li>High gamma but low alpha = high turnover between communities</li>
                        <li>Similar gamma and alpha values = homogeneous communities</li>
                        <li>Shannon β measures information gain; Simpson β measures effective distinctness</li>
                      </ul>
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