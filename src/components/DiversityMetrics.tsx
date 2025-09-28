import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Info } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

interface Community {
  id: number;
  species: number[];
  abundance: number[];
}

interface DiversityMetricsProps {
  communities: Community[];
}

const DiversityMetrics: React.FC<DiversityMetricsProps> = ({ communities }) => {
  // Calculate Shannon diversity for a community
  const calculateShannon = (abundance: number[]): number => {
    const total = abundance.reduce((sum, count) => sum + count, 0);
    let shannon = 0;
    
    abundance.forEach(count => {
      if (count > 0) {
        const proportion = count / total;
        shannon -= proportion * Math.log(proportion);
      }
    });
    
    return shannon;
  };

  // Calculate Simpson diversity for a community
  const calculateSimpson = (abundance: number[]): number => {
    const total = abundance.reduce((sum, count) => sum + count, 0);
    let simpson = 0;
    
    abundance.forEach(count => {
      if (count > 0) {
        const proportion = count / total;
        simpson += proportion * proportion;
      }
    });
    
    return 1 - simpson; // Simpson's diversity index (1-D)
  };

  // Alpha diversity calculations
  const alphaRichness = communities.map(c => c.species.length);
  const meanAlphaRichness = alphaRichness.reduce((sum, r) => sum + r, 0) / alphaRichness.length;
  
  const alphaShannon = communities.map(c => calculateShannon(c.abundance));
  const meanAlphaShannon = alphaShannon.reduce((sum, s) => sum + s, 0) / alphaShannon.length;
  
  const alphaSimpson = communities.map(c => calculateSimpson(c.abundance));
  const meanAlphaSimpson = alphaSimpson.reduce((sum, s) => sum + s, 0) / alphaSimpson.length;

  // Gamma diversity calculation
  const allSpecies = new Set<number>();
  communities.forEach(community => {
    community.species.forEach(species => allSpecies.add(species));
  });
  const gammaRichness = allSpecies.size;

  // Beta diversity calculations
  const betaWhittaker = gammaRichness / meanAlphaRichness;
  
  // Jaccard similarity between communities
  const calculateJaccardSimilarity = (comm1: Community, comm2: Community): number => {
    const species1 = new Set(comm1.species);
    const species2 = new Set(comm2.species);
    
    const intersection = new Set([...species1].filter(x => species2.has(x)));
    const union = new Set([...species1, ...species2]);
    
    return intersection.size / union.size;
  };

  // Calculate mean Jaccard dissimilarity
  let totalComparisons = 0;
  let totalJaccardSimilarity = 0;
  
  for (let i = 0; i < communities.length; i++) {
    for (let j = i + 1; j < communities.length; j++) {
      totalJaccardSimilarity += calculateJaccardSimilarity(communities[i], communities[j]);
      totalComparisons++;
    }
  }
  
  const meanJaccardSimilarity = totalComparisons > 0 ? totalJaccardSimilarity / totalComparisons : 0;
  const meanJaccardDissimilarity = 1 - meanJaccardSimilarity;

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {/* Alpha Diversity */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <CardTitle className="text-lg">Alpha Diversity</CardTitle>
            <Tooltip>
              <TooltipTrigger>
                <Info className="w-4 h-4 text-muted-foreground" />
              </TooltipTrigger>
              <TooltipContent>
                <div className="max-w-xs">
                  Local diversity within individual communities. Higher values indicate more species coexisting locally.
                </div>
              </TooltipContent>
            </Tooltip>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm font-medium">Species Richness</span>
              <Badge variant="outline">{meanAlphaRichness.toFixed(1)}</Badge>
            </div>
            <div className="text-xs text-muted-foreground">
              Range: {Math.min(...alphaRichness)} - {Math.max(...alphaRichness)}
            </div>
          </div>
          
          <div>
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm font-medium">Shannon Index</span>
              <Badge variant="outline">{meanAlphaShannon.toFixed(2)}</Badge>
            </div>
            <div className="text-xs text-muted-foreground">
              Accounts for abundance & evenness
            </div>
          </div>
          
          <div>
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm font-medium">Simpson Index</span>
              <Badge variant="outline">{meanAlphaSimpson.toFixed(2)}</Badge>
            </div>
            <div className="text-xs text-muted-foreground">
              Probability two individuals differ
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Beta Diversity */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <CardTitle className="text-lg">Beta Diversity</CardTitle>
            <Tooltip>
              <TooltipTrigger>
                <Info className="w-4 h-4 text-muted-foreground" />
              </TooltipTrigger>
              <TooltipContent>
                <div className="max-w-xs">
                  Variation in species composition between communities. Higher values indicate greater turnover between sites.
                </div>
              </TooltipContent>
            </Tooltip>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm font-medium">Whittaker's β</span>
              <Badge variant="outline">{betaWhittaker.toFixed(2)}</Badge>
            </div>
            <div className="text-xs text-muted-foreground">
              γ diversity / mean α diversity
            </div>
          </div>
          
          <div>
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm font-medium">Jaccard Dissimilarity</span>
              <Badge variant="outline">{meanJaccardDissimilarity.toFixed(2)}</Badge>
            </div>
            <div className="text-xs text-muted-foreground">
              Mean species turnover (0-1)
            </div>
          </div>
          
          <div className="p-3 bg-educational-info rounded-lg">
            <div className="text-xs">
              <strong>Interpretation:</strong><br />
              {betaWhittaker < 1.5 ? "Low turnover - similar communities" :
               betaWhittaker < 2.5 ? "Moderate turnover" :
               "High turnover - distinct communities"}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Gamma Diversity */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <CardTitle className="text-lg">Gamma Diversity</CardTitle>
            <Tooltip>
              <TooltipTrigger>
                <Info className="w-4 h-4 text-muted-foreground" />
              </TooltipTrigger>
              <TooltipContent>
                <div className="max-w-xs">
                  Total diversity across all communities in the region. Represents the complete species pool.
                </div>
              </TooltipContent>
            </Tooltip>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm font-medium">Total Species</span>
              <Badge variant="outline" className="text-lg font-bold">
                {gammaRichness}
              </Badge>
            </div>
            <div className="text-xs text-muted-foreground">
              Unique species across all communities
            </div>
          </div>
          
          <div className="space-y-2">
            <div className="text-xs font-medium">Species Distribution:</div>
            {communities.map((community, index) => (
              <div key={community.id} className="flex justify-between text-xs">
                <span>Community {community.id}:</span>
                <span>{community.species.length} species</span>
              </div>
            ))}
          </div>
          
          <div className="p-3 bg-educational-success rounded-lg">
            <div className="text-xs">
              <strong>Species Accumulation:</strong><br />
              {((gammaRichness / meanAlphaRichness - 1) * 100).toFixed(0)}% more species regionally than locally
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default DiversityMetrics;