'use client';

import React, { useMemo } from 'react';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Clock,
  SquareCheckBig,
  Layers,
  Play,
  History,
  PenLine,
  AlertCircle,
  ChevronRight,
  CalendarCheck,
  Timer
} from 'lucide-react';

interface ChecklistExecutionTabProps {
  checklist?: {
    id: number;
    title?: string;
    phases?: Array<{
      id?: string;
      name?: string;
      order?: number;
      items?: Array<{
        id?: string;
        estimatedTime?: number;
      }>;
      itemsCount?: number;
      estimatedMinutes?: number;
      durationLabel?: string;
    }>;
    items?: Array<{
      id?: string;
      phaseName?: string;
      phaseOrder?: number;
      estimatedTime?: number;
    }>;
    totalMinutes?: number;
    totalDurationLabel?: string;
  } | null;
  isLoading?: boolean;
  error?: Error | null;
  onRetry?: () => void;
  onExecute?: () => void;
  onViewHistory?: () => void;
  onEdit?: () => void;
  canExecute?: boolean;
  canEdit?: boolean;
  canViewHistory?: boolean;
}

// Utilidades
function formatDuration(minutes: number | null | undefined): string {
  if (!minutes || minutes === 0) return '—';
  
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  
  if (hours === 0) {
    return `${mins}min`;
  }
  
  if (mins === 0) {
    return `${hours}h`;
  }
  
  return `${hours}h ${mins}min`;
}

function safeText(text: string | null | undefined): string {
  return text && text.trim() ? text.trim() : '—';
}

export function ChecklistExecutionTab({
  checklist,
  isLoading = false,
  error = null,
  onRetry,
  onExecute,
  onViewHistory,
  onEdit,
  canExecute = true,
  canEdit = true,
  canViewHistory = true,
}: ChecklistExecutionTabProps) {
  
  // Derivar datos de fases
  const phasesData = useMemo(() => {
    if (!checklist) return [];

    // Si hay phases directas, usarlas
    if (checklist.phases && checklist.phases.length > 0) {
      return checklist.phases
        .map((phase, index) => {
          const itemsCount = phase.itemsCount ?? phase.items?.length ?? 0;
          const estimatedMinutes = phase.estimatedMinutes ?? 
            (phase.items?.reduce((sum, item) => sum + (item.estimatedTime || 0), 0) || 0);
          
          return {
            id: phase.id || `phase_${index}`,
            name: phase.name || `Fase ${(phase.order ?? index) + 1}`,
            order: phase.order ?? index,
            itemsCount,
            estimatedMinutes,
            durationLabel: phase.durationLabel || formatDuration(estimatedMinutes),
          };
        })
        .sort((a, b) => a.order - b.order);
    }

    // Si no hay phases, derivar desde items agrupando por phaseName
    if (checklist.items && checklist.items.length > 0) {
      const phasesMap = new Map<string, {
        name: string;
        order: number;
        items: typeof checklist.items;
      }>();

      checklist.items.forEach((item) => {
        const phaseName = item.phaseName || 'Sin fase';
        const phaseOrder = item.phaseOrder ?? 0;

        if (!phasesMap.has(phaseName)) {
          phasesMap.set(phaseName, {
            name: phaseName,
            order: phaseOrder,
            items: [],
          });
        }

        phasesMap.get(phaseName)!.items.push(item);
      });

      return Array.from(phasesMap.values())
        .sort((a, b) => a.order - b.order)
        .map((phase, index) => {
          const itemsCount = phase.items.length;
          const estimatedMinutes = phase.items.reduce(
            (sum, item) => sum + (item.estimatedTime || 0),
            0
          );

          return {
            id: `derived_phase_${index}`,
            name: phase.name,
            order: phase.order,
            itemsCount,
            estimatedMinutes,
            durationLabel: formatDuration(estimatedMinutes),
          };
        });
    }

    return [];
  }, [checklist]);

  // Calcular totales
  const totals = useMemo(() => {
    if (!checklist) {
      return {
        totalMinutes: 0,
        totalDurationLabel: '—',
        totalItems: 0,
        phasesCount: 0,
      };
    }

    const totalMinutes = checklist.totalMinutes ?? 
      phasesData.reduce((sum, phase) => sum + phase.estimatedMinutes, 0);
    
    const totalDurationLabel = checklist.totalDurationLabel || formatDuration(totalMinutes);
    
    const totalItems = phasesData.reduce((sum, phase) => sum + phase.itemsCount, 0);
    
    const phasesCount = phasesData.length;

    return {
      totalMinutes,
      totalDurationLabel,
      totalItems,
      phasesCount,
    };
  }, [checklist, phasesData]);

  // Estados de carga
  if (isLoading) {
    return (
      <div className="space-y-4">
        <h3 className="text-xs font-semibold text-foreground">Información de Ejecución</h3>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {/* Card izquierda - Resumen */}
          <Card>
            <CardHeader>
              <Skeleton className="h-4 w-32" />
            </CardHeader>
            <CardContent className="space-y-3">
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
            </CardContent>
          </Card>

          {/* Card derecha - Fases */}
          <Card>
            <CardHeader>
              <Skeleton className="h-4 w-40" />
            </CardHeader>
            <CardContent className="space-y-2">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </CardContent>
          </Card>

          {/* Card acciones */}
          <Card className="lg:col-span-2">
            <CardContent className="pt-6">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Error al cargar la información de ejecución</AlertTitle>
        <AlertDescription className="flex items-center justify-between">
          <span>No se pudo cargar la información del checklist.</span>
          {onRetry && (
            <Button
              variant="outline"
              size="sm"
              onClick={onRetry}
              className="ml-4"
            >
              Reintentar
            </Button>
          )}
        </AlertDescription>
      </Alert>
    );
  }

  if (!checklist) {
    return (
      <div className="space-y-4">
        <h3 className="text-xs font-semibold text-foreground">Información de Ejecución</h3>
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <AlertCircle className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-sm text-muted-foreground">No hay información del checklist</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Botón principal de ejecución prominente */}
      {canExecute && onExecute && (
        <Card className="bg-success-muted border-success/20">
          <CardContent className="py-4">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-full bg-success-muted flex items-center justify-center">
                  <Play className="h-6 w-6 text-success" />
                </div>
                <div>
                  <h3 className="font-semibold text-foreground">Listo para ejecutar</h3>
                  <p className="text-sm text-success">
                    {totals.totalItems} tareas • {totals.totalDurationLabel} estimado
                  </p>
                </div>
              </div>
              <Button
                onClick={onExecute}
                size="lg"
                className="bg-success hover:bg-success/90 text-success-foreground shadow-lg"
              >
                <Play className="h-4 w-4 mr-2" />
                Iniciar Ejecución
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Métricas rápidas */}
      <div className={cn('grid gap-3', totals.phasesCount > 0 ? 'grid-cols-3' : 'grid-cols-2')}>
        <div className="bg-info-muted border border-info-muted-foreground/20 rounded-lg p-3 text-center">
          <Timer className="h-5 w-5 text-info-muted-foreground mx-auto mb-1" />
          <p className="text-lg font-bold text-foreground">{totals.totalDurationLabel}</p>
          <p className="text-xs text-info-muted-foreground uppercase tracking-wide">Tiempo Total</p>
        </div>
        <div className="bg-success-muted border border-success/20 rounded-lg p-3 text-center">
          <SquareCheckBig className="h-5 w-5 text-success mx-auto mb-1" />
          <p className="text-lg font-bold text-foreground">{totals.totalItems}</p>
          <p className="text-xs text-success uppercase tracking-wide">Items</p>
        </div>
        {totals.phasesCount > 0 && (
          <div className="bg-warning-muted border border-warning-muted-foreground/20 rounded-lg p-3 text-center">
            <Layers className="h-5 w-5 text-warning-muted-foreground mx-auto mb-1" />
            <p className="text-lg font-bold text-foreground">{totals.phasesCount}</p>
            <p className="text-xs text-warning-muted-foreground uppercase tracking-wide">Fases</p>
          </div>
        )}
      </div>

      {/* Secuencia de fases */}
      {phasesData.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Layers className="h-4 w-4" />
              Secuencia de Ejecución
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1">
              {phasesData.map((phase, index) => (
                <div
                  key={phase.id}
                  className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-accent transition-colors"
                >
                  {/* Indicador de paso */}
                  <div className="flex flex-col items-center">
                    <div className="w-7 h-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold">
                      {index + 1}
                    </div>
                    {index < phasesData.length - 1 && (
                      <div className="w-0.5 h-4 bg-border mt-1" />
                    )}
                  </div>

                  {/* Contenido de la fase */}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm text-foreground truncate">
                      {safeText(phase.name)}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs text-muted-foreground">
                        {phase.itemsCount} items
                      </span>
                      <span className="text-border">•</span>
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {phase.durationLabel}
                      </span>
                    </div>
                  </div>

                  <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

    </div>
  );
}

