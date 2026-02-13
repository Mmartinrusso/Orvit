'use client';

import React, { useMemo } from 'react';
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
        <h3 className="text-xs font-semibold text-gray-900">Información de Ejecución</h3>
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
        <h3 className="text-xs font-semibold text-gray-900">Información de Ejecución</h3>
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
        <Card className="bg-gradient-to-r from-green-50 to-emerald-50 border-green-200">
          <CardContent className="py-4">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-full bg-green-100 flex items-center justify-center">
                  <Play className="h-6 w-6 text-green-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-green-900">Listo para ejecutar</h3>
                  <p className="text-sm text-green-700">
                    {totals.totalItems} tareas • {totals.totalDurationLabel} estimado
                  </p>
                </div>
              </div>
              <Button
                onClick={onExecute}
                size="lg"
                className="bg-green-600 hover:bg-green-700 text-white shadow-lg"
              >
                <Play className="h-4 w-4 mr-2" />
                Iniciar Ejecución
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Métricas rápidas */}
      <div className={`grid gap-3 ${totals.phasesCount > 0 ? 'grid-cols-3' : 'grid-cols-2'}`}>
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-center">
          <Timer className="h-5 w-5 text-blue-600 mx-auto mb-1" />
          <p className="text-lg font-bold text-blue-900">{totals.totalDurationLabel}</p>
          <p className="text-[10px] text-blue-700 uppercase tracking-wide">Tiempo Total</p>
        </div>
        <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-center">
          <SquareCheckBig className="h-5 w-5 text-green-600 mx-auto mb-1" />
          <p className="text-lg font-bold text-green-900">{totals.totalItems}</p>
          <p className="text-[10px] text-green-700 uppercase tracking-wide">Items</p>
        </div>
        {totals.phasesCount > 0 && (
          <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 text-center">
            <Layers className="h-5 w-5 text-orange-600 mx-auto mb-1" />
            <p className="text-lg font-bold text-orange-900">{totals.phasesCount}</p>
            <p className="text-[10px] text-orange-700 uppercase tracking-wide">Fases</p>
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
                  className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  {/* Indicador de paso */}
                  <div className="flex flex-col items-center">
                    <div className="w-7 h-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold">
                      {index + 1}
                    </div>
                    {index < phasesData.length - 1 && (
                      <div className="w-0.5 h-4 bg-gray-200 mt-1" />
                    )}
                  </div>

                  {/* Contenido de la fase */}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm text-gray-900 truncate">
                      {safeText(phase.name)}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs text-gray-500">
                        {phase.itemsCount} items
                      </span>
                      <span className="text-gray-300">•</span>
                      <span className="text-xs text-gray-500 flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {phase.durationLabel}
                      </span>
                    </div>
                  </div>

                  <ChevronRight className="h-4 w-4 text-gray-400 flex-shrink-0" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Acciones secundarias */}
      <div className="flex flex-wrap gap-2">
        {canViewHistory && onViewHistory && (
          <Button
            variant="outline"
            onClick={onViewHistory}
            size="sm"
            className="text-xs"
          >
            <History className="h-3.5 w-3.5 mr-1.5" />
            Ver Historial
          </Button>
        )}
        {canEdit && onEdit && (
          <Button
            variant="outline"
            onClick={onEdit}
            size="sm"
            className="text-xs"
          >
            <PenLine className="h-3.5 w-3.5 mr-1.5" />
            Editar
          </Button>
        )}
      </div>
    </div>
  );
}

