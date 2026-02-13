'use client';

/**
 * AISuggestionsPanel - Panel de sugerencias inteligentes
 *
 * Muestra:
 * - Soluciones similares del historial
 * - Patrones de fallas detectados
 * - Recomendaciones basadas en datos
 *
 * P5.4: Sugerencias basadas en IA
 */

import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format, formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  Sparkles,
  Lightbulb,
  History,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  ExternalLink,
  Copy,
  ThumbsUp,
  ThumbsDown,
  RefreshCw,
  Loader2,
  Wrench,
  Clock,
  User
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger
} from '@/components/ui/tooltip';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';

// ============================================================
// TIPOS
// ============================================================

interface SimilarSolution {
  id: number;
  title: string;
  description: string;
  outcome: 'FUNCIONÓ' | 'PARCIAL' | 'NO_FUNCIONÓ';
  effectiveness: number;
  usageCount: number;
  lastUsedAt: string;
  performedBy?: { id: number; name: string };
  machine?: { id: number; name: string };
  component?: { id: number; name: string };
  similarity: number;
}

interface FailurePattern {
  type: string;
  title: string;
  description: string;
  occurrences: number;
  lastOccurrence: string;
  trend: 'UP' | 'DOWN' | 'STABLE';
  severity: 'LOW' | 'MEDIUM' | 'HIGH';
}

interface Recommendation {
  type: 'IMMEDIATE' | 'PREVENTIVE' | 'INVESTIGATION';
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
  title: string;
  description: string;
  estimatedTime?: number;
  confidence: number;
}

interface AISuggestionsPanelProps {
  failureOccurrenceId?: number;
  workOrderId?: number;
  machineId?: number;
  componentId?: number;
  onApplySolution?: (solution: SimilarSolution) => void;
  className?: string;
}

// ============================================================
// COMPONENTES AUXILIARES
// ============================================================

function SolutionCard({
  solution,
  onApply,
  onCopy
}: {
  solution: SimilarSolution;
  onApply?: () => void;
  onCopy: () => void;
}) {
  const outcomeColors = {
    'FUNCIONÓ': 'bg-green-100 text-green-700 border-green-200',
    'PARCIAL': 'bg-yellow-100 text-yellow-700 border-yellow-200',
    'NO_FUNCIONÓ': 'bg-red-100 text-red-700 border-red-200'
  };

  const outcomeLabels = {
    'FUNCIONÓ': 'Funcionó',
    'PARCIAL': 'Parcial',
    'NO_FUNCIONÓ': 'No funcionó'
  };

  return (
    <div className="p-4 border rounded-lg hover:border-blue-200 hover:bg-blue-50/30 transition-colors">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          {/* Título y match */}
          <div className="flex items-center gap-2">
            <p className="font-medium text-gray-900 truncate">{solution.title}</p>
            <Badge variant="outline" className="text-xs shrink-0">
              {solution.similarity}% match
            </Badge>
          </div>

          {/* Descripción */}
          <p className="text-sm text-gray-600 mt-1 line-clamp-2">
            {solution.description}
          </p>

          {/* Metadata */}
          <div className="flex flex-wrap items-center gap-3 mt-2">
            <Badge
              variant="outline"
              className={cn('text-xs', outcomeColors[solution.outcome])}
            >
              {outcomeLabels[solution.outcome]}
            </Badge>

            {solution.effectiveness && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger className="flex items-center gap-1 text-xs text-gray-500">
                    <ThumbsUp className="h-3 w-3" />
                    {solution.effectiveness}/5
                  </TooltipTrigger>
                  <TooltipContent>Efectividad promedio</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}

            <span className="flex items-center gap-1 text-xs text-gray-500">
              <History className="h-3 w-3" />
              {solution.usageCount}x usado
            </span>

            <span className="flex items-center gap-1 text-xs text-gray-500">
              <Clock className="h-3 w-3" />
              {formatDistanceToNow(new Date(solution.lastUsedAt), {
                addSuffix: true,
                locale: es
              })}
            </span>
          </div>

          {/* Contexto */}
          {(solution.machine || solution.component) && (
            <div className="flex items-center gap-2 mt-2 text-xs text-gray-500">
              <Wrench className="h-3 w-3" />
              {[solution.machine?.name, solution.component?.name]
                .filter(Boolean)
                .join(' → ')}
            </div>
          )}
        </div>

        {/* Acciones */}
        <div className="flex flex-col gap-1 shrink-0">
          {onApply && (
            <Button
              variant="outline"
              size="sm"
              className="h-8"
              onClick={onApply}
            >
              Aplicar
              <ChevronRight className="h-3 w-3 ml-1" />
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            className="h-8 text-gray-500"
            onClick={onCopy}
          >
            <Copy className="h-3 w-3 mr-1" />
            Copiar
          </Button>
        </div>
      </div>
    </div>
  );
}

function PatternCard({ pattern }: { pattern: FailurePattern }) {
  const severityColors = {
    LOW: 'bg-green-100 text-green-700',
    MEDIUM: 'bg-yellow-100 text-yellow-700',
    HIGH: 'bg-red-100 text-red-700'
  };

  const trendIcons = {
    UP: <TrendingUp className="h-3 w-3 text-red-500" />,
    DOWN: <TrendingUp className="h-3 w-3 text-green-500 rotate-180" />,
    STABLE: <span className="w-3 h-0.5 bg-gray-400" />
  };

  return (
    <div className="p-3 border rounded-lg bg-orange-50/30 border-orange-200">
      <div className="flex items-start gap-3">
        <div className={cn(
          'shrink-0 w-8 h-8 rounded-full flex items-center justify-center',
          severityColors[pattern.severity]
        )}>
          <AlertTriangle className="h-4 w-4" />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="font-medium text-gray-900">{pattern.title}</p>
            {trendIcons[pattern.trend]}
          </div>
          <p className="text-sm text-gray-600 mt-0.5">{pattern.description}</p>
          <div className="flex items-center gap-3 mt-2 text-xs text-gray-500">
            <span>{pattern.occurrences} ocurrencias</span>
            <span>•</span>
            <span>
              Última: {formatDistanceToNow(new Date(pattern.lastOccurrence), {
                addSuffix: true,
                locale: es
              })}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

function RecommendationCard({ recommendation }: { recommendation: Recommendation }) {
  const typeColors = {
    IMMEDIATE: 'bg-red-100 text-red-700',
    PREVENTIVE: 'bg-blue-100 text-blue-700',
    INVESTIGATION: 'bg-purple-100 text-purple-700'
  };

  const typeLabels = {
    IMMEDIATE: 'Inmediata',
    PREVENTIVE: 'Preventiva',
    INVESTIGATION: 'Investigar'
  };

  const priorityColors = {
    HIGH: 'border-red-300',
    MEDIUM: 'border-yellow-300',
    LOW: 'border-green-300'
  };

  return (
    <div className={cn(
      'p-3 border-l-4 rounded-r-lg bg-gray-50',
      priorityColors[recommendation.priority]
    )}>
      <div className="flex items-start gap-3">
        <div className={cn(
          'shrink-0 px-2 py-1 rounded text-xs font-medium',
          typeColors[recommendation.type]
        )}>
          {typeLabels[recommendation.type]}
        </div>

        <div className="flex-1 min-w-0">
          <p className="font-medium text-gray-900">{recommendation.title}</p>
          <p className="text-sm text-gray-600 mt-0.5">{recommendation.description}</p>

          <div className="flex items-center gap-4 mt-2">
            {recommendation.estimatedTime && (
              <span className="text-xs text-gray-500 flex items-center gap-1">
                <Clock className="h-3 w-3" />
                ~{recommendation.estimatedTime} min
              </span>
            )}
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500">Confianza:</span>
              <Progress value={recommendation.confidence} className="w-16 h-1.5" />
              <span className="text-xs text-gray-600">{recommendation.confidence}%</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Skeleton className="h-5 w-5 rounded-full" />
        <Skeleton className="h-4 w-32" />
      </div>
      <Skeleton className="h-24 w-full" />
      <Skeleton className="h-24 w-full" />
      <Skeleton className="h-16 w-full" />
    </div>
  );
}

// ============================================================
// COMPONENTE PRINCIPAL
// ============================================================

export function AISuggestionsPanel({
  failureOccurrenceId,
  workOrderId,
  machineId,
  componentId,
  onApplySolution,
  className
}: AISuggestionsPanelProps) {
  const [feedback, setFeedback] = useState<Record<number, 'up' | 'down'>>({});

  // Fetch sugerencias
  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ['ai-suggestions', failureOccurrenceId, workOrderId, machineId, componentId],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (workOrderId) params.set('workOrderId', String(workOrderId));
      if (machineId) params.set('machineId', String(machineId));
      if (componentId) params.set('componentId', String(componentId));

      const endpoint = failureOccurrenceId
        ? `/api/failure-occurrences/${failureOccurrenceId}/suggestions`
        : `/api/ai/suggestions?${params.toString()}`;

      const res = await fetch(endpoint);
      if (!res.ok) throw new Error('Error al cargar sugerencias');
      return res.json();
    },
    enabled: !!(failureOccurrenceId || machineId || componentId),
    staleTime: 60000 // 1 minuto
  });

  const handleCopySolution = (solution: SimilarSolution) => {
    const text = `${solution.title}\n\n${solution.description}`;
    navigator.clipboard.writeText(text);
    toast.success('Copiado al portapapeles');
  };

  const handleFeedback = (solutionId: number, type: 'up' | 'down') => {
    setFeedback(prev => ({ ...prev, [solutionId]: type }));
    toast.success(type === 'up' ? 'Gracias por tu feedback positivo' : 'Feedback registrado');
    // TODO: Enviar feedback al servidor
  };

  const similarSolutions = data?.similarSolutions || [];
  const patterns = data?.patterns || [];
  const recommendations = data?.recommendations || [];

  if (isLoading) {
    return (
      <div className={cn('p-4', className)}>
        <LoadingSkeleton />
      </div>
    );
  }

  if (error) {
    return (
      <div className={cn('p-4', className)}>
        <div className="flex flex-col items-center py-8 text-center">
          <AlertTriangle className="h-8 w-8 text-red-500 mb-2" />
          <p className="text-gray-600 mb-4">Error al cargar sugerencias</p>
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Reintentar
          </Button>
        </div>
      </div>
    );
  }

  const hasContent = similarSolutions.length > 0 || patterns.length > 0 || recommendations.length > 0;

  return (
    <div className={cn('space-y-6', className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-purple-600" />
          <h3 className="font-medium">Sugerencias Inteligentes</h3>
          {data?.confidence && (
            <Badge variant="outline" className="text-xs">
              {data.confidence}% confianza
            </Badge>
          )}
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => refetch()}
          disabled={isFetching}
        >
          {isFetching ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4" />
          )}
        </Button>
      </div>

      {!hasContent ? (
        <div className="text-center py-8 bg-gray-50 rounded-lg border border-dashed">
          <Lightbulb className="h-10 w-10 text-gray-300 mx-auto mb-2" />
          <p className="text-gray-500 text-sm">No hay sugerencias disponibles</p>
          <p className="text-xs text-gray-400 mt-1">
            Las sugerencias aparecerán basadas en el historial
          </p>
        </div>
      ) : (
        <>
          {/* Soluciones similares */}
          {similarSolutions.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <History className="h-4 w-4 text-blue-600" />
                <h4 className="text-sm font-medium text-gray-700">
                  Soluciones Similares
                </h4>
                <Badge variant="secondary" className="text-xs">
                  {similarSolutions.length}
                </Badge>
              </div>

              <div className="space-y-2">
                {similarSolutions.slice(0, 3).map((solution: SimilarSolution) => (
                  <SolutionCard
                    key={solution.id}
                    solution={solution}
                    onApply={onApplySolution ? () => onApplySolution(solution) : undefined}
                    onCopy={() => handleCopySolution(solution)}
                  />
                ))}
              </div>

              {similarSolutions.length > 3 && (
                <Button variant="link" size="sm" className="w-full">
                  Ver {similarSolutions.length - 3} más
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              )}
            </div>
          )}

          {/* Patrones detectados */}
          {patterns.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-orange-600" />
                <h4 className="text-sm font-medium text-gray-700">
                  Patrones Detectados
                </h4>
              </div>

              <div className="space-y-2">
                {patterns.map((pattern: FailurePattern, idx: number) => (
                  <PatternCard key={idx} pattern={pattern} />
                ))}
              </div>
            </div>
          )}

          {/* Recomendaciones */}
          {recommendations.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Lightbulb className="h-4 w-4 text-yellow-600" />
                <h4 className="text-sm font-medium text-gray-700">
                  Recomendaciones
                </h4>
              </div>

              <div className="space-y-2">
                {recommendations.map((rec: Recommendation, idx: number) => (
                  <RecommendationCard key={idx} recommendation={rec} />
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* Footer */}
      {hasContent && (
        <div className="pt-4 border-t text-center">
          <p className="text-xs text-gray-400">
            Sugerencias generadas basadas en el historial de mantenimiento.
            {data?.lastUpdated && (
              <> Actualizado {formatDistanceToNow(new Date(data.lastUpdated), {
                addSuffix: true,
                locale: es
              })}</>
            )}
          </p>
        </div>
      )}
    </div>
  );
}

export default AISuggestionsPanel;
