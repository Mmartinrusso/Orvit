'use client';

import { useClientScore } from '@/hooks/use-client-analytics';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

interface ClientScoreBadgeProps {
  clientId: string;
  showTooltip?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export function ClientScoreBadge({ clientId, showTooltip = true, size = 'md' }: ClientScoreBadgeProps) {
  const { data, isLoading } = useClientScore(clientId);

  if (isLoading) {
    return <Skeleton className={cn(
      'rounded-full',
      size === 'sm' && 'h-5 w-12',
      size === 'md' && 'h-6 w-14',
      size === 'lg' && 'h-8 w-16'
    )} />;
  }

  if (!data) return null;

  const getColorClass = () => {
    if (data.score >= 90) return 'bg-green-100 text-green-800 hover:bg-green-200';
    if (data.score >= 75) return 'bg-blue-100 text-blue-800 hover:bg-blue-200';
    if (data.score >= 60) return 'bg-orange-100 text-orange-800 hover:bg-orange-200';
    return 'bg-red-100 text-red-800 hover:bg-red-200';
  };

  const badge = (
    <Badge
      variant="outline"
      className={cn(
        'font-semibold cursor-help border-0',
        getColorClass(),
        size === 'sm' && 'text-xs px-2 py-0.5',
        size === 'md' && 'text-sm px-2.5 py-1',
        size === 'lg' && 'text-base px-3 py-1.5'
      )}
    >
      {data.score}
    </Badge>
  );

  if (!showTooltip) return badge;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          {badge}
        </TooltipTrigger>
        <TooltipContent className="max-w-xs">
          <div className="space-y-2">
            <div>
              <p className="font-semibold text-sm">{data.category}</p>
              <p className="text-xs text-muted-foreground">Score: {data.score}/100</p>
            </div>
            <div className="text-xs space-y-1">
              <p><strong>Puntualidad:</strong> {data.breakdown.punctuality.toFixed(1)}/40</p>
              <p><strong>Volumen:</strong> {data.breakdown.volume.toFixed(1)}/30</p>
              <p><strong>Antigüedad:</strong> {data.breakdown.seniority.toFixed(1)}/15</p>
              <p><strong>Consistencia:</strong> {data.breakdown.consistency.toFixed(1)}/10</p>
            </div>
            {data.badges.length > 0 && (
              <div className="flex flex-wrap gap-1 pt-2 border-t">
                {data.badges.map((badge, i) => (
                  <Badge key={i} variant="secondary" className="text-xs">
                    {badge}
                  </Badge>
                ))}
              </div>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
