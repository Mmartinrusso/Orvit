'use client';

import React, { useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import {
  Info,
  Settings,
  Building,
  Calendar,
  Clock,
  CheckSquare,
  Layers,
  AlertCircle,
  FileText,
  Cpu,
  Truck,
  CalendarCheck,
  User,
  History,
  TrendingUp
} from 'lucide-react';
import { useChecklistDetail } from '@/hooks/maintenance/use-checklist-detail';

interface ChecklistOverviewTabProps {
  checklistId: number;
}

// Utilidades
function formatMinutes(totalMinutes: number | null | undefined): string {
  if (!totalMinutes || totalMinutes === 0) return '—';
  
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  
  if (hours === 0) {
    return `${minutes}min`;
  }
  
  if (minutes === 0) {
    return `${hours}h`;
  }
  
  return `${hours}h ${minutes}min`;
}

function formatDateTime(dateString: string | null | undefined): string {
  if (!dateString) return '—';
  
  try {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('es-AR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  } catch {
    return '—';
  }
}

function safeText(text: string | null | undefined): string {
  return text && text.trim() ? text.trim() : '—';
}

function mapStatusToLabel(isActive: boolean | null | undefined): { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' } {
  if (isActive === true) {
    return { label: 'Activo', variant: 'default' };
  }
  if (isActive === false) {
    return { label: 'Inactivo', variant: 'secondary' };
  }
  return { label: '—', variant: 'outline' };
}

function getCategoryLabel(category: string | null | undefined): string {
  if (!category) return '—';
  
  const categoryMap: Record<string, string> = {
    'MAINTENANCE': 'Mantenimiento',
    'PREVENTIVE': 'Preventivo',
    'CORRECTIVE': 'Correctivo',
    'PREDICTIVE': 'Predictivo',
    'EMERGENCY': 'Emergencia',
  };
  
  return categoryMap[category] || category;
}

function getFrequencyLabel(frequency: string | null | undefined): string {
  if (!frequency) return '—';

  const frequencyMap: Record<string, string> = {
    'DAILY': 'Diario',
    'WEEKLY': 'Semanal',
    'BIWEEKLY': 'Quincenal',
    'MONTHLY': 'Mensual',
    'BIMONTHLY': 'Bimestral',
    'QUARTERLY': 'Trimestral',
    'SEMIANNUAL': 'Semestral',
    'YEARLY': 'Anual',
    'ANNUAL': 'Anual',
    'ON_DEMAND': 'Bajo demanda',
    'CUSTOM': 'Personalizado',
  };

  return frequencyMap[frequency] || frequency;
}

function getFrequencyColor(frequency: string | null | undefined): string {
  if (!frequency) return 'bg-gray-50 text-gray-700 border-gray-200';

  const colorMap: Record<string, string> = {
    'DAILY': 'bg-red-50 text-red-700 border-red-200',
    'WEEKLY': 'bg-orange-50 text-orange-700 border-orange-200',
    'BIWEEKLY': 'bg-yellow-50 text-yellow-700 border-yellow-200',
    'MONTHLY': 'bg-blue-50 text-blue-700 border-blue-200',
    'BIMONTHLY': 'bg-indigo-50 text-indigo-700 border-indigo-200',
    'QUARTERLY': 'bg-purple-50 text-purple-700 border-purple-200',
    'SEMIANNUAL': 'bg-pink-50 text-pink-700 border-pink-200',
    'YEARLY': 'bg-green-50 text-green-700 border-green-200',
    'ANNUAL': 'bg-green-50 text-green-700 border-green-200',
    'ON_DEMAND': 'bg-gray-50 text-gray-700 border-gray-200',
  };

  return colorMap[frequency] || 'bg-gray-50 text-gray-700 border-gray-200';
}

export function ChecklistOverviewTab({ checklistId }: ChecklistOverviewTabProps) {
  const queryClient = useQueryClient();
  const { data, isLoading, error, refetch } = useChecklistDetail(checklistId);

  // Calcular estadísticas
  const stats = useMemo(() => {
    if (!data?.checklist) {
      return {
        totalItems: 0,
        estimatedMinutes: 0,
        phasesCount: 0,
      };
    }

    const checklist = data.checklist;
    
    // Priorizar campos agregados del checklist si existen
    let totalItems = 0;
    let estimatedMinutes = 0;
    let phasesCount = 0;

    // Si hay fases, calcular desde ahí
    if (checklist.phases && checklist.phases.length > 0) {
      phasesCount = checklist.phases.length;
      totalItems = checklist.phases.reduce((sum, phase) => sum + (phase.items?.length || 0), 0);
      estimatedMinutes = checklist.phases.reduce((sum, phase) => {
        return sum + (phase.items?.reduce((phaseSum, item) => phaseSum + (item.estimatedTime || 0), 0) || 0);
      }, 0);
    } 
    // Si no hay fases pero hay items directos
    else if (checklist.items && checklist.items.length > 0) {
      totalItems = checklist.items.length;
      estimatedMinutes = checklist.items.reduce((sum, item) => sum + (item.estimatedTime || 0), 0);
      phasesCount = 1; // Asumir 1 fase si no hay estructura de fases
    }

    // Si estimatedTotalTime existe y es mayor, usarlo (puede incluir overhead)
    if (checklist.estimatedTotalTime && checklist.estimatedTotalTime > estimatedMinutes) {
      estimatedMinutes = checklist.estimatedTotalTime;
    }

    return {
      totalItems,
      estimatedMinutes,
      phasesCount: phasesCount || 1, // Mínimo 1 fase
    };
  }, [data]);

  // Estados de carga
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i}>
            <CardHeader>
              <Skeleton className="h-4 w-32" />
            </CardHeader>
            <CardContent className="space-y-3">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Error al cargar el checklist</AlertTitle>
        <AlertDescription className="flex items-center justify-between">
          <span>No se pudo cargar la información del checklist.</span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              queryClient.invalidateQueries({ queryKey: ['checklist-detail', checklistId] });
              refetch();
            }}
            className="ml-4"
          >
            Reintentar
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  if (!data?.checklist) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <FileText className="h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-sm text-muted-foreground">No hay información del checklist</p>
        </CardContent>
      </Card>
    );
  }

  const checklist = data.checklist;
  const statusInfo = mapStatusToLabel(checklist.isActive);

  return (
    <div className="space-y-4">
      {/* Descripción (si existe) */}
      {checklist.description && (
        <Card className="bg-muted/30">
          <CardContent className="py-3 px-4">
            <p className="text-sm text-muted-foreground leading-relaxed">
              {checklist.description}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Métricas principales - en una sola fila */}
      <div className={`grid gap-3 ${stats.phasesCount > 0 ? 'grid-cols-2 sm:grid-cols-4' : 'grid-cols-3'}`}>
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
          <div className="flex items-center gap-2">
            <Clock className="h-3.5 w-3.5 text-blue-600" />
            <span className="text-[10px] font-medium text-blue-800 uppercase tracking-wide">Tiempo</span>
          </div>
          <p className="text-lg font-bold text-blue-900 mt-1">
            {formatMinutes(stats.estimatedMinutes)}
          </p>
        </div>

        <div className="bg-green-50 border border-green-200 rounded-lg p-3">
          <div className="flex items-center gap-2">
            <CheckSquare className="h-3.5 w-3.5 text-green-600" />
            <span className="text-[10px] font-medium text-green-800 uppercase tracking-wide">Items</span>
          </div>
          <p className="text-lg font-bold text-green-900 mt-1">
            {stats.totalItems}
          </p>
        </div>

        {stats.phasesCount > 0 && (
          <div className="bg-orange-50 border border-orange-200 rounded-lg p-3">
            <div className="flex items-center gap-2">
              <Layers className="h-3.5 w-3.5 text-orange-600" />
              <span className="text-[10px] font-medium text-orange-800 uppercase tracking-wide">Fases</span>
            </div>
            <p className="text-lg font-bold text-orange-900 mt-1">
              {stats.phasesCount}
            </p>
          </div>
        )}

        <div className={`border rounded-lg p-3 ${getFrequencyColor(checklist.frequency)}`}>
          <div className="flex items-center gap-2">
            <Calendar className="h-3.5 w-3.5" />
            <span className="text-[10px] font-medium uppercase tracking-wide">Frecuencia</span>
          </div>
          <p className="text-lg font-bold mt-1">
            {getFrequencyLabel(checklist.frequency)}
          </p>
        </div>
      </div>

      {/* Información detallada */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Equipo / Ubicación */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm">
              {checklist.machine ? (
                <Cpu className="h-3.5 w-3.5" />
              ) : (
                <Building className="h-3.5 w-3.5" />
              )}
              {checklist.machine ? 'Equipo Asignado' : 'Ubicación'}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {checklist.machine ? (
              <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Cpu className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="font-medium text-sm">{checklist.machine.name}</p>
                  <p className="text-xs text-muted-foreground">{checklist.machine.type || 'Máquina'}</p>
                </div>
              </div>
            ) : checklist.sector ? (
              <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Building className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="font-medium text-sm">{checklist.sector.name}</p>
                  {checklist.sector.description && (
                    <p className="text-xs text-muted-foreground">{checklist.sector.description}</p>
                  )}
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Sin asignación específica</p>
            )}

            {checklist.machine && checklist.sector && (
              <div className="pt-2 border-t">
                <label className="text-xs font-medium text-muted-foreground">Sector</label>
                <p className="text-sm">{checklist.sector.name}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Configuración y Estado */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Settings className="h-3.5 w-3.5" />
              Configuración
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground">Estado</label>
                <div className="mt-1">
                  <Badge
                    className={
                      checklist.isActive
                        ? 'bg-green-100 text-green-800 text-xs border-green-200'
                        : 'bg-gray-100 text-gray-800 text-xs border-gray-200'
                    }
                    variant="outline"
                  >
                    {statusInfo.label}
                  </Badge>
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground">Categoría</label>
                <div className="mt-1">
                  <Badge className="bg-orange-100 text-orange-800 text-xs border-orange-200" variant="outline">
                    {getCategoryLabel(checklist.category)}
                  </Badge>
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground">Creado</label>
                <p className="mt-1 text-xs text-foreground">
                  {formatDateTime(checklist.createdAt)}
                </p>
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground">Actualizado</label>
                <p className="mt-1 text-xs text-foreground">
                  {formatDateTime(checklist.updatedAt)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Última ejecución (si existe) */}
      {(checklist as any).lastExecutionDate && (
        <Card className="border-green-200 bg-green-50/50">
          <CardContent className="py-3 px-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-full bg-green-100 flex items-center justify-center">
                  <CalendarCheck className="h-4 w-4 text-green-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-green-900">Última ejecución</p>
                  <p className="text-xs text-green-700">
                    {formatDateTime((checklist as any).lastExecutionDate)}
                    {(checklist as any).lastExecutedBy && (
                      <span className="ml-2">por {(checklist as any).lastExecutedBy}</span>
                    )}
                  </p>
                </div>
              </div>
              {(checklist as any).executionCount && (
                <div className="text-right">
                  <p className="text-lg font-bold text-green-900">{(checklist as any).executionCount}</p>
                  <p className="text-[10px] text-green-700 uppercase tracking-wide">ejecuciones</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

