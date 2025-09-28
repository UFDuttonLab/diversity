import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface Community {
  id: number;
  species: number[];
  abundance: number[];
}

interface CommunityVisualizationProps {
  communities: Community[];
}

const CommunityVisualization: React.FC<CommunityVisualizationProps> = ({ communities }) => {
  const getSpeciesColor = (speciesId: number): string => {
    const colors = [
      'bg-species-1',
      'bg-species-2', 
      'bg-species-3',
      'bg-species-4',
      'bg-species-5',
      'bg-species-6',
      'bg-species-7',
      'bg-species-8',
    ];
    return colors[(speciesId - 1) % colors.length];
  };

  const getSpeciesTextColor = (speciesId: number): string => {
    // Most species colors are bright, so use dark text
    return 'text-foreground';
  };

  const renderCommunityBar = (community: Community) => {
    const totalIndividuals = community.abundance.reduce((sum, count) => sum + count, 0);
    
    return (
      <div className="space-y-3">
        {/* Stacked bar visualization */}
        <div className="h-12 flex rounded-lg overflow-hidden border">
          {community.species.map((speciesId, index) => {
            const percentage = (community.abundance[index] / totalIndividuals) * 100;
            return (
              <div
                key={speciesId}
                className={`${getSpeciesColor(speciesId)} flex items-center justify-center`}
                style={{ width: `${percentage}%` }}
                title={`Species ${speciesId}: ${community.abundance[index]} individuals (${percentage.toFixed(1)}%)`}
              >
                {percentage > 8 && (
                  <span className={`text-xs font-medium ${getSpeciesTextColor(speciesId)}`}>
                    {speciesId}
                  </span>
                )}
              </div>
            );
          })}
        </div>
        
        {/* Species list with abundances */}
        <div className="flex flex-wrap gap-1">
          {community.species.map((speciesId, index) => (
            <Badge
              key={speciesId}
              variant="secondary"
              className="text-xs"
            >
              S{speciesId}: {community.abundance[index]}
            </Badge>
          ))}
        </div>
        
        {/* Community stats */}
        <div className="text-xs text-muted-foreground space-y-1">
          <div>Species: {community.species.length}</div>
          <div>Individuals: {totalIndividuals}</div>
        </div>
      </div>
    );
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Community Composition</CardTitle>
        <p className="text-sm text-muted-foreground">
          Each bar shows species composition. Numbers represent species IDs, bar width shows relative abundance.
        </p>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {communities.map((community) => (
            <div key={community.id} className="space-y-3">
              <h4 className="font-semibold text-sm text-foreground">
                Community {community.id}
              </h4>
              {renderCommunityBar(community)}
            </div>
          ))}
        </div>
        
        {/* Legend */}
        <div className="mt-6 pt-4 border-t">
          <h5 className="text-sm font-medium mb-3">Species Legend</h5>
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2">
            {Array.from({ length: 8 }, (_, i) => i + 1).map((speciesId) => (
              <div key={speciesId} className="flex items-center gap-2">
                <div
                  className={`w-4 h-4 rounded ${getSpeciesColor(speciesId)} border`}
                />
                <span className="text-xs">S{speciesId}</span>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default CommunityVisualization;