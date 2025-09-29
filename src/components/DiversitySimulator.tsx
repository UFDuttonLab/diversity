import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Slider } from '@/components/ui/slider';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Info, RotateCcw } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import CommunityVisualization from './CommunityVisualization';
import ComprehensiveDiversityMetrics from './ComprehensiveDiversityMetrics';
import AlphaComparison from './AlphaComparison';
import DiversityCharts from './DiversityCharts';
import PCAVisualization from './PCAVisualization';
import PresetScenarios from './PresetScenarios';

interface SimulationParams {
  speciesRichness: number;
  numCommunities: number;
  individualsPerCommunity: number;
  evenness: number;
}

interface Community {
  id: number;
  species: number[];
  abundance: number[];
}

const DiversitySimulator: React.FC = () => {
  const [params, setParams] = useState<SimulationParams>({
    speciesRichness: 20,
    numCommunities: 4,
    individualsPerCommunity: 100,
    evenness: 0.5,
  });

  const [communities, setCommunities] = useState<Community[]>([]);

  // Generate communities based on parameters
  const generateCommunities = useMemo(() => {
    const newCommunities: Community[] = [];
    
    for (let i = 0; i < params.numCommunities; i++) {
      const community: Community = {
        id: i + 1,
        species: [],
        abundance: [],
      };

      // Determine which species are present in this community
      const speciesPool = Array.from({ length: params.speciesRichness }, (_, i) => i + 1);
      
      // Randomly select subset of species for this community (beta diversity effect)
      const numSpeciesInCommunity = Math.max(
        1,
        Math.floor(params.speciesRichness * (0.3 + Math.random() * 0.7))
      );
      
      const communitySpecies = speciesPool
        .sort(() => Math.random() - 0.5)
        .slice(0, numSpeciesInCommunity);

      // Generate abundance distribution
      const abundances: number[] = [];
      let totalIndividuals = 0;

      communitySpecies.forEach((speciesId, index) => {
        let abundance: number;
        
        if (params.evenness > 0.8) {
          // High evenness - nearly equal abundances
          abundance = Math.floor(params.individualsPerCommunity / communitySpecies.length);
        } else if (params.evenness < 0.2) {
          // Low evenness - very uneven distribution
          if (index === 0) {
            abundance = Math.floor(params.individualsPerCommunity * 0.6);
          } else {
            abundance = Math.max(1, Math.floor(Math.random() * 10));
          }
        } else {
          // Moderate evenness
          const base = params.individualsPerCommunity / communitySpecies.length;
          const variation = base * (1 - params.evenness);
          abundance = Math.max(1, Math.floor(base + (Math.random() - 0.5) * variation * 2));
        }
        
        abundances.push(abundance);
        totalIndividuals += abundance;
      });

      // Normalize to exact total
      const scaleFactor = params.individualsPerCommunity / totalIndividuals;
      const normalizedAbundances = abundances.map(a => Math.max(1, Math.round(a * scaleFactor)));
      
      community.species = communitySpecies;
      community.abundance = normalizedAbundances;
      
      newCommunities.push(community);
    }

    return newCommunities;
  }, [params]);

  useEffect(() => {
    setCommunities(generateCommunities);
  }, [generateCommunities]);

  const updateParam = (key: keyof SimulationParams, value: number) => {
    setParams(prev => ({ ...prev, [key]: value }));
  };

  const applyPreset = (preset: SimulationParams) => {
    setParams(preset);
  };


  return (
    <TooltipProvider>
      <div className="flex flex-col min-h-screen bg-background">
        {/* Header */}
        <header className="border-b bg-card">
          <div className="container mx-auto px-4 py-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold text-foreground">
                  Diversity Simulator
                </h1>
                <p className="text-muted-foreground mt-1">
                  Explore Alpha, Beta & Gamma Diversity
                </p>
              </div>
              
              <div className="flex items-center gap-3">
                <Dialog>
                  <DialogTrigger asChild>
                    <Button variant="outline" size="sm">
                      <Info className="w-4 h-4 mr-2" />
                      Help
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-2xl">
                    <DialogHeader>
                      <DialogTitle>How to Use This Tool</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 text-sm">
                      <div>
                        <h4 className="font-semibold">Alpha Diversity (α)</h4>
                        <p>The number of species in a single local community. Alpha diversity metrics like Shannon-Wiener and Simpson indices combine both species richness (how many species) and evenness (how evenly distributed they are). Higher values indicate more diverse local communities.</p>
                      </div>
                      <div>
                        <h4 className="font-semibold">Beta Diversity (β)</h4>
                        <p>Measures how species composition changes between communities. High beta diversity means communities share few species in common. Beta diversity connects alpha and gamma diversity through the multiplicative relationship: γ = α × β.</p>
                      </div>
                      <div>
                        <h4 className="font-semibold">Gamma Diversity (γ)</h4>
                        <p>The total species richness across all communities in a landscape. Gamma diversity represents the regional species pool and is influenced by both local diversity (alpha) and community differentiation (beta).</p>
                      </div>
                      <div>
                        <h4 className="font-semibold">How They Connect</h4>
                        <p><strong>Key relationship:</strong> γ = α × β. When communities are very similar (low β), gamma diversity approaches the average alpha diversity. When communities are completely different (high β), gamma can be much larger than any individual community's alpha diversity.</p>
                      </div>
                      <div>
                        <h4 className="font-semibold">Measurement Insights</h4>
                        <p><strong>Species richness</strong> counts unique species. <strong>Shannon index</strong> weighs abundant species more heavily. <strong>Simpson index</strong> emphasizes dominant species. <strong>Pielou's evenness</strong> shows how equally abundant species are, independent of richness.</p>
                      </div>
                      <div>
                        <h4 className="font-semibold">Using the Controls</h4>
                        <p>Adjust the sliders to see how different parameters affect diversity patterns. Try the preset scenarios to explore common ecological patterns. Watch how changing evenness affects different diversity indices differently.</p>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <div className="flex-1 container mx-auto px-4 py-6">
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            {/* Controls Sidebar */}
            <div className="lg:col-span-1 space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Simulation Parameters</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Species Richness */}
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <Label>Species Richness</Label>
                      <Tooltip>
                        <TooltipTrigger>
                          <Info className="w-4 h-4 text-muted-foreground" />
                        </TooltipTrigger>
                        <TooltipContent>
                          Total number of species in the regional pool
                        </TooltipContent>
                      </Tooltip>
                    </div>
                    <Slider
                      value={[params.speciesRichness]}
                      onValueChange={([value]) => updateParam('speciesRichness', value)}
                      min={2}
                      max={100}
                      step={1}
                      className="w-full"
                    />
                    <Input
                      type="number"
                      value={params.speciesRichness}
                      onChange={(e) => updateParam('speciesRichness', parseInt(e.target.value) || 0)}
                      min={2}
                      max={100}
                      className="w-full"
                    />
                  </div>

                  {/* Number of Communities */}
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <Label>Communities</Label>
                      <Tooltip>
                        <TooltipTrigger>
                          <Info className="w-4 h-4 text-muted-foreground" />
                        </TooltipTrigger>
                        <TooltipContent>
                          Number of local communities to simulate
                        </TooltipContent>
                      </Tooltip>
                    </div>
                    <Slider
                      value={[params.numCommunities]}
                      onValueChange={([value]) => updateParam('numCommunities', value)}
                      min={2}
                      max={10}
                      step={1}
                      className="w-full"
                    />
                    <div className="text-center text-sm font-medium">
                      {params.numCommunities}
                    </div>
                  </div>

                  {/* Sample Size */}
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <Label>Sample Size</Label>
                      <Tooltip>
                        <TooltipTrigger>
                          <Info className="w-4 h-4 text-muted-foreground" />
                        </TooltipTrigger>
                        <TooltipContent>
                          Number of individuals sampled per community
                        </TooltipContent>
                      </Tooltip>
                    </div>
                    <Slider
                      value={[params.individualsPerCommunity]}
                      onValueChange={([value]) => updateParam('individualsPerCommunity', value)}
                      min={10}
                      max={500}
                      step={10}
                      className="w-full"
                    />
                    <div className="text-center text-sm font-medium">
                      {params.individualsPerCommunity}
                    </div>
                  </div>

                  {/* Evenness */}
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <Label>Evenness</Label>
                      <Tooltip>
                        <TooltipTrigger>
                          <Info className="w-4 h-4 text-muted-foreground" />
                        </TooltipTrigger>
                        <TooltipContent>
                          How evenly individuals are distributed among species
                        </TooltipContent>
                      </Tooltip>
                    </div>
                    <Slider
                      value={[params.evenness]}
                      onValueChange={([value]) => updateParam('evenness', value)}
                      min={0}
                      max={1}
                      step={0.1}
                      className="w-full"
                    />
                    <div className="text-center text-sm font-medium">
                      {(params.evenness * 100).toFixed(0)}%
                    </div>
                  </div>

                  <Button 
                    onClick={() => setParams({
                      speciesRichness: 20,
                      numCommunities: 4,
                      individualsPerCommunity: 100,
                      evenness: 0.5,
                    })}
                    variant="outline"
                    size="sm"
                    className="w-full"
                  >
                    <RotateCcw className="w-4 h-4 mr-2" />
                    Reset
                  </Button>
                </CardContent>
              </Card>

              <PresetScenarios onApplyPreset={applyPreset} />
            </div>

            {/* Main Visualization Area */}
            <div className="lg:col-span-3 space-y-6">
              <ComprehensiveDiversityMetrics communities={communities} />
              <AlphaComparison communities={communities} />
              <DiversityCharts communities={communities} />
              <PCAVisualization communities={communities} />
              <CommunityVisualization communities={communities} />
            </div>
          </div>
        </div>

        {/* Footer */}
        <footer className="border-t bg-card py-4">
          <div className="container mx-auto px-4">
            <div className="text-center">
              <p className="text-sm text-muted-foreground">
                Developed by{" "}
                <a 
                  href="https://ufduttonlab.github.io" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  Dutton Lab at UF
                </a>
              </p>
            </div>
          </div>
        </footer>
      </div>
    </TooltipProvider>
  );
};

export default DiversitySimulator;