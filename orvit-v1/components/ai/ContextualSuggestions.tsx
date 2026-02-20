'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Lightbulb,
  Wrench,
  AlertTriangle,
  TrendingUp,
  Clock,
  Package,
  ChevronRight,
  RefreshCw
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface Suggestion {
  id: string;
  type: 'action' | 'insight' | 'warning' | 'opportunity';
  title: string;
  description: string;
  actionLabel?: string;
  actionUrl?: string;
  priority: number;
  entities?: Array<{ type: string; id: number; name: string }>;
}

interface ContextualSuggestionsProps {
  companyId: number;
  context?: {
    machineId?: number;
    workOrderId?: number;
    failureId?: number;
    page?: string;
  };
  onEntityClick?: (type: string, id: number) => void;
}

const suggestionTypeConfig = {
  action: {
    icon: Wrench,
    color: 'text-primary',
    bgColor: 'bg-primary/10',
  },
  insight: {
    icon: Lightbulb,
    color: 'text-warning-muted-foreground',
    bgColor: 'bg-warning-muted',
  },
  warning: {
    icon: AlertTriangle,
    color: 'text-destructive',
    bgColor: 'bg-destructive/10',
  },
  opportunity: {
    icon: TrendingUp,
    color: 'text-success',
    bgColor: 'bg-success/10',
  },
};

export function ContextualSuggestions({ companyId, context, onEntityClick }: ContextualSuggestionsProps) {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchSuggestions();
  }, [companyId, context?.machineId, context?.workOrderId]);

  const fetchSuggestions = async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Build suggestions based on context
      const contextualSuggestions: Suggestion[] = [];

      // Fetch alerts for context-aware suggestions
      const alertsResponse = await fetch('/api/ai/suggestions');
      const alertsData = await alertsResponse.json();

      if (alertsData.alerts && alertsData.alerts.length > 0) {
        // Convert alerts to suggestions format
        alertsData.alerts.slice(0, 5).forEach((alert: any, index: number) => {
          let suggestionType: Suggestion['type'] = 'insight';

          if (alert.type === 'RISK') suggestionType = 'warning';
          else if (alert.type === 'OPPORTUNITY') suggestionType = 'opportunity';
          else if (alert.type === 'REMINDER') suggestionType = 'action';

          contextualSuggestions.push({
            id: `alert-${index}`,
            type: suggestionType,
            title: alert.title,
            description: alert.description,
            actionLabel: alert.suggestedAction,
            actionUrl: alert.actionUrl,
            priority: alert.priority === 'HIGH' ? 3 : alert.priority === 'MEDIUM' ? 2 : 1,
            entities: alert.relatedEntities,
          });
        });
      }

      // Add static contextual suggestions based on page/context
      if (context?.machineId) {
        contextualSuggestions.push({
          id: 'machine-history',
          type: 'insight',
          title: 'Ver historial completo',
          description: 'Analiza el historial de fallas y mantenimientos de esta máquina',
          actionLabel: 'Ver historial',
          actionUrl: `/mantenimiento/maquinas/${context.machineId}?tab=history`,
          priority: 1,
        });
      }

      if (context?.workOrderId) {
        contextualSuggestions.push({
          id: 'similar-wos',
          type: 'insight',
          title: 'OTs similares',
          description: 'Revisa órdenes de trabajo similares para obtener referencias',
          actionLabel: 'Ver similares',
          priority: 1,
        });
      }

      // Add general suggestions if no specific context
      if (!context?.machineId && !context?.workOrderId) {
        contextualSuggestions.push({
          id: 'kpi-overview',
          type: 'opportunity',
          title: 'Resumen de KPIs',
          description: 'Revisa los indicadores clave de mantenimiento',
          actionLabel: 'Ver dashboard',
          actionUrl: '/mantenimiento',
          priority: 1,
        });
      }

      // Sort by priority (highest first)
      contextualSuggestions.sort((a, b) => b.priority - a.priority);

      setSuggestions(contextualSuggestions);
    } catch (err) {
      console.error('Error fetching suggestions:', err);
      setError('No se pudieron cargar las sugerencias');
    } finally {
      setIsLoading(false);
    }
  };

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-32 text-center">
        <AlertTriangle className="h-8 w-8 text-muted-foreground mb-2" />
        <p className="text-sm text-muted-foreground">{error}</p>
        <Button variant="outline" size="sm" onClick={fetchSuggestions} className="mt-2">
          <RefreshCw className="h-4 w-4 mr-2" />
          Reintentar
        </Button>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <Card key={i}>
            <CardContent className="p-4">
              <div className="flex gap-3">
                <Skeleton className="h-10 w-10 rounded-lg" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-full" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (suggestions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-32 text-center text-muted-foreground">
        <Lightbulb className="h-12 w-12 mb-4 opacity-50" />
        <p className="text-sm">No hay sugerencias en este momento</p>
        <p className="text-xs mt-1">Las sugerencias aparecerán basadas en tu actividad</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium flex items-center gap-2">
          <Lightbulb className="h-4 w-4" />
          Sugerencias Contextuales
        </h3>
        <Button
          variant="ghost"
          size="sm"
          onClick={fetchSuggestions}
          className="h-8 w-8 p-0"
        >
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>

      {suggestions.map((suggestion) => {
        const config = suggestionTypeConfig[suggestion.type];
        const Icon = config.icon;

        return (
          <Card
            key={suggestion.id}
            className={cn(
              'cursor-pointer transition-all hover:shadow-md',
              suggestion.actionUrl && 'hover:border-primary/50'
            )}
            onClick={() => {
              if (suggestion.actionUrl) {
                window.location.href = suggestion.actionUrl;
              }
            }}
          >
            <CardContent className="p-4">
              <div className="flex gap-3">
                <div className={cn('p-2 rounded-lg shrink-0', config.bgColor)}>
                  <Icon className={cn('h-5 w-5', config.color)} />
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="font-medium text-sm mb-1">{suggestion.title}</h4>
                  <p className="text-xs text-muted-foreground mb-2">
                    {suggestion.description}
                  </p>

                  {suggestion.entities && suggestion.entities.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-2">
                      {suggestion.entities.slice(0, 3).map((entity, idx) => (
                        <Badge
                          key={idx}
                          variant="secondary"
                          className="text-xs cursor-pointer"
                          onClick={(e) => {
                            e.stopPropagation();
                            onEntityClick?.(entity.type, entity.id);
                          }}
                        >
                          {entity.name}
                        </Badge>
                      ))}
                    </div>
                  )}

                  {suggestion.actionLabel && (
                    <div className="flex items-center text-xs text-primary font-medium">
                      {suggestion.actionLabel}
                      <ChevronRight className="h-3 w-3 ml-1" />
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}

      <div className="pt-2 border-t">
        <p className="text-xs text-muted-foreground text-center">
          Las sugerencias se actualizan automáticamente según tu contexto
        </p>
      </div>
    </div>
  );
}

export default ContextualSuggestions;
