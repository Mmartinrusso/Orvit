'use client';

import { useQuery } from '@tanstack/react-query';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  AlertTriangle,
  Clock,
  TrendingUp,
  CheckCircle2,
  History,
} from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';
import { es } from 'date-fns/locale';

interface RecurrenceData {
  recurrence: {
    isRecurrent: boolean;
    recurrenceCount: number;
    windowDays: number;
    avgDaysBetweenFailures: number | null;
  };
  previousOccurrences: Array<{
    id: number;
    title: string;
    status: string;
    priority: string;
    reportedAt: string;
    resolvedAt?: string;
    daysAgo: number;
    lastSolution?: {
      id: number;
      diagnosis: string;
      solution: string;
      outcome: string;
      effectiveness?: number;
      performedBy?: { name: string };
    };
  }>;
  effectiveSolutions: Array<{
    id: number;
    diagnosis: string;
    solution: string;
    outcome: string;
    effectiveness: number;
    performedBy?: { name: string };
  }>;
}

interface RecurrencePanelProps {
  failureId: number;
}

const priorityColors: Record<string, string> = {
  P1: 'bg-destructive/10 text-destructive',
  P2: 'bg-warning-muted text-warning-muted-foreground',
  P3: 'bg-warning-muted text-warning-muted-foreground',
  P4: 'bg-info-muted text-info-muted-foreground',
};

/**
 * Panel de reincidencia para mostrar historial de fallas similares
 */
export function RecurrencePanel({ failureId }: RecurrencePanelProps) {
  const { data, isLoading, error } = useQuery<RecurrenceData>({
    queryKey: ['failure-recurrence', failureId],
    queryFn: async () => {
      const res = await fetch(`/api/failure-occurrences/${failureId}/recurrence`);
      if (!res.ok) throw new Error('Error al cargar reincidencia');
      return res.json();
    },
    enabled: !!failureId,
    staleTime: 60000, // Cache por 1 minuto
  });

  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <p className="text-sm text-muted-foreground text-center py-4">
        Error al cargar historial de reincidencia
      </p>
    );
  }

  const { recurrence, previousOccurrences, effectiveSolutions } = data;

  return (
    <div className="space-y-4">
      {/* Alerta de reincidencia */}
      {recurrence.isRecurrent && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Falla Recurrente</AlertTitle>
          <AlertDescription>
            Esta falla ha ocurrido {recurrence.recurrenceCount} veces en los
            últimos {recurrence.windowDays} días.
            {recurrence.avgDaysBetweenFailures && (
              <span className="block mt-1 text-sm">
                Promedio: cada {recurrence.avgDaysBetweenFailures} días
              </span>
            )}
          </AlertDescription>
        </Alert>
      )}

      {/* Estadísticas rápidas */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-lg border p-3 text-center">
          <p className="text-2xl font-bold">{previousOccurrences.length}</p>
          <p className="text-xs text-muted-foreground">Fallas anteriores</p>
        </div>
        <div className="rounded-lg border p-3 text-center">
          <p className="text-2xl font-bold">
            {recurrence.avgDaysBetweenFailures ?? '-'}
          </p>
          <p className="text-xs text-muted-foreground">Días promedio</p>
        </div>
      </div>

      {/* Soluciones efectivas sugeridas */}
      {effectiveSolutions.length > 0 && (
        <div>
          <h4 className="text-sm font-medium mb-2 flex items-center gap-1">
            <TrendingUp className="h-4 w-4 text-success" />
            Soluciones Efectivas
          </h4>
          <div className="space-y-2">
            {effectiveSolutions.map((solution) => (
              <div
                key={solution.id}
                className="rounded-lg border border-success-muted bg-success-muted p-3"
              >
                <div className="flex items-center justify-between mb-1">
                  <Badge variant="outline" className="bg-success-muted">
                    Efectividad: {solution.effectiveness}/5
                  </Badge>
                </div>
                <p className="text-sm font-medium">{solution.solution}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Diagnóstico: {solution.diagnosis}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Historial de fallas */}
      <div>
        <h4 className="text-sm font-medium mb-2 flex items-center gap-1">
          <History className="h-4 w-4" />
          Historial
        </h4>
        {previousOccurrences.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            No hay fallas anteriores registradas
          </p>
        ) : (
          <div className="space-y-2">
            {previousOccurrences.map((occ) => (
              <div key={occ.id} className="rounded-lg border p-3">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1">
                    <p className="text-sm font-medium line-clamp-1">
                      {occ.title}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Hace {occ.daysAgo} días •{' '}
                      {format(new Date(occ.reportedAt), 'd MMM yyyy', {
                        locale: es,
                      })}
                    </p>
                  </div>
                  <div className="flex gap-1">
                    <Badge
                      variant="outline"
                      className={priorityColors[occ.priority] || ''}
                    >
                      {occ.priority}
                    </Badge>
                    <Badge
                      variant={
                        occ.status === 'RESOLVED' ? 'secondary' : 'destructive'
                      }
                    >
                      {occ.status === 'RESOLVED' ? (
                        <CheckCircle2 className="h-3 w-3 mr-1" />
                      ) : (
                        <Clock className="h-3 w-3 mr-1" />
                      )}
                      {occ.status}
                    </Badge>
                  </div>
                </div>

                {/* Última solución aplicada */}
                {occ.lastSolution && (
                  <div className="mt-2 pt-2 border-t text-xs">
                    <p className="text-muted-foreground">
                      <span className="font-medium">Solución:</span>{' '}
                      {occ.lastSolution.solution}
                    </p>
                    {occ.lastSolution.effectiveness && (
                      <p className="text-muted-foreground mt-1">
                        Efectividad: {occ.lastSolution.effectiveness}/5
                      </p>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
