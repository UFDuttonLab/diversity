import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface SimulationParams {
  speciesRichness: number;
  numCommunities: number;
  individualsPerCommunity: number;
  evenness: number;
}

interface PresetScenariosProps {
  onApplyPreset: (params: SimulationParams) => void;
}

const PresetScenarios: React.FC<PresetScenariosProps> = ({ onApplyPreset }) => {
  const presets = [
    {
      name: "High Evenness",
      description: "Many species with similar abundances",
      badge: "Educational",
      params: {
        speciesRichness: 25,
        numCommunities: 4,
        individualsPerCommunity: 100,
        evenness: 0.9,
      },
    },
    {
      name: "Low Evenness",
      description: "Few dominant species, many rare ones",
      badge: "Real-world",
      params: {
        speciesRichness: 30,
        numCommunities: 4,
        individualsPerCommunity: 100,
        evenness: 0.1,
      },
    },
    {
      name: "High Turnover",
      description: "Different species in each community",
      badge: "Beta Focus",
      params: {
        speciesRichness: 50,
        numCommunities: 6,
        individualsPerCommunity: 80,
        evenness: 0.6,
      },
    },
    {
      name: "Small Pools",
      description: "Limited regional species diversity",
      badge: "Island-like",
      params: {
        speciesRichness: 8,
        numCommunities: 3,
        individualsPerCommunity: 60,
        evenness: 0.7,
      },
    },
    {
      name: "Large Scale",
      description: "Continental-scale diversity patterns",
      badge: "Large Scale",
      params: {
        speciesRichness: 80,
        numCommunities: 8,
        individualsPerCommunity: 200,
        evenness: 0.4,
      },
    },
    {
      name: "Nested Pattern",
      description: "Species-poor sites are subsets of rich sites",
      badge: "Ecological",
      params: {
        speciesRichness: 35,
        numCommunities: 5,
        individualsPerCommunity: 120,
        evenness: 0.5,
      },
    },
  ];

  const getBadgeVariant = (badge: string) => {
    switch (badge) {
      case "Educational": return "default";
      case "Real-world": return "secondary";
      case "Beta Focus": return "outline";
      case "Island-like": return "outline";
      case "Large Scale": return "secondary";
      case "Ecological": return "default";
      default: return "outline";
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Preset Scenarios</CardTitle>
        <p className="text-sm text-muted-foreground">
          Explore common ecological patterns
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        {presets.map((preset, index) => (
          <div
            key={index}
            className="border rounded-lg p-3 space-y-2 hover:bg-muted/50 transition-colors"
          >
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <h4 className="font-medium text-sm">{preset.name}</h4>
                  <Badge 
                    variant={getBadgeVariant(preset.badge)}
                    className="text-xs"
                  >
                    {preset.badge}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  {preset.description}
                </p>
              </div>
            </div>
            
            <div className="flex items-center justify-between">
              <div className="text-xs text-muted-foreground">
                {preset.params.speciesRichness} species • {preset.params.numCommunities} communities
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => onApplyPreset(preset.params)}
                className="text-xs h-7 px-2"
              >
                Apply
              </Button>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
};

export default PresetScenarios;