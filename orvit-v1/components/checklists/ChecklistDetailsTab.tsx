'use client';

import React, { useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { 
  FileText, 
  Settings, 
  Building, 
  Calendar,
  AlertCircle
} from 'lucide-react';
import { useChecklistDetail } from '@/hooks/mantenimiento/use-checklist-detail';

interface ChecklistDetailsTabProps {
  checklist?: {
    id: number;
    title: string;
    description?: string | null;
    frequency: string;
    category: string;
    isActive: boolean;
    estimatedTotalTime: number;
    machineId?: number | null;
    sectorId?: number | null;
    companyId: number;
    items?: Array<{
      id: string;
      estimatedTime?: number;
      phaseId?: string;
    }>;
    phases?: Array<{
      id: string;
      name: string;
      items?: Array<{
        id: string;
        estimatedTime?: number;
      }>;
    }>;
    sector?: {
      id: number;
      name: string;
      description?: string;
    } | null;
    machine?: {
      id: number;
      name: string;
      type: string;
    } | null;
    company?: {
      id: number;
      name: string;
    } | null;
    createdAt: string;
    updatedAt: string;
  } | null;
  checklistId?: number;
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
    'MONTHLY': 'Mensual',
    'QUARTERLY': 'Trimestral',
    'YEARLY': 'Anual',
    'ON_DEMAND': 'Bajo demanda',
  };
  
  return frequencyMap[frequency] || frequency;
}

export function ChecklistDetailsTab({ checklist: checklistProp, checklistId }: ChecklistDetailsTabProps) {
  const queryClient = useQueryClient();
  
  // Si no se pasa checklist como prop, usar el hook
  const { data: checklistData, isLoading, error, refetch } = useChecklistDetail(
    checklistProp ? undefined : checklistId
  );
  
  const checklist = checklistProp || checklistData?.checklist;

  // Calcular estadísticas
  const stats = useMemo(() => {
    if (!checklist) {
      return {
        totalItems: 0,
        totalMinutes: 0,
        phasesCount: 0,
      };
    }

    let totalItems = 0;
    let totalMinutes = 0;
    let phasesCount = 0;

    if (checklist.phases && checklist.phases.length > 0) {
      phasesCount = checklist.phases.length;
      totalItems = checklist.phases.reduce((sum, phase) => sum + (phase.items?.length || 0), 0);
      totalMinutes = checklist.phases.reduce((sum, phase) => {
        return sum + (phase.items?.reduce((phaseSum, item) => phaseSum + (item.estimatedTime || 0), 0) || 0);
      }, 0);
    } else if (checklist.items && checklist.items.length > 0) {
      totalItems = checklist.items.length;
      totalMinutes = checklist.items.reduce((sum, item) => sum + (item.estimatedTime || 0), 0);
      phasesCount = 1;
    }

    if (checklist.estimatedTotalTime && checklist.estimatedTotalTime > totalMinutes) {
      totalMinutes = checklist.estimatedTotalTime;
    }

    return {
      totalItems,
      totalMinutes,
      phasesCount: phasesCount || 1,
    };
  }, [checklist]);

  // Estados de carga
  if (isLoading && !checklistProp) {
    return (
      <div className="space-y-4">
        <h3 className="text-xs font-semibold text-foreground">Detalles Técnicos</h3>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-4 w-32" />
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-3">
                  <Skeleton className="h-16" />
                  <Skeleton className="h-16" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (error && !checklistProp) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Error al cargar los detalles</AlertTitle>
        <AlertDescription className="flex items-center justify-between">
          <span>No se pudieron cargar los detalles del checklist.</span>
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

  if (!checklist) {
    return (
      <div className="space-y-4">
        <h3 className="text-xs font-semibold text-foreground">Detalles Técnicos</h3>
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <FileText className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-sm text-muted-foreground">No hay información del checklist</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h3 className="text-xs font-semibold text-foreground">Detalles Técnicos</h3>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {/* A) Información del Checklist */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <FileText className="h-3.5 w-3.5" />
              Información del Checklist
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground">ID</label>
                <p className="mt-1 text-xs text-foreground font-mono">{checklist.id}</p>
              </div>
              
              <div>
                <label className="text-xs font-medium text-muted-foreground">Título</label>
                <p className="mt-1 text-xs text-foreground">{safeText(checklist.title)}</p>
              </div>
              
              <div>
                <label className="text-xs font-medium text-muted-foreground">Categoría</label>
                <p className="mt-1 text-xs text-foreground">{getCategoryLabel(checklist.category)}</p>
              </div>
              
              <div>
                <label className="text-xs font-medium text-muted-foreground">Frecuencia</label>
                <p className="mt-1 text-xs text-foreground">{getFrequencyLabel(checklist.frequency)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* B) Configuración */}
        <Card>
          <CardHeader>
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
                        ? 'bg-success-muted text-success text-xs border-success/20'
                        : 'bg-muted text-foreground text-xs border-border'
                    }
                    variant="outline"
                  >
                    {checklist.isActive ? 'Activo' : 'Inactivo'}
                  </Badge>
                </div>
              </div>
              
              <div>
                <label className="text-xs font-medium text-muted-foreground">Tiempo Total</label>
                <p className="mt-1 text-xs text-foreground font-bold">
                  {formatDuration(stats.totalMinutes)}
                </p>
              </div>
              
              <div>
                <label className="text-xs font-medium text-muted-foreground">Total Items</label>
                <p className="mt-1 text-xs text-foreground font-bold">
                  {stats.totalItems}
                </p>
              </div>
              
              <div>
                <label className="text-xs font-medium text-muted-foreground">Fases</label>
                <p className="mt-1 text-xs text-foreground font-bold">
                  {stats.phasesCount}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* C) Ubicación */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <Building className="h-3.5 w-3.5" />
              Ubicación
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Sector</label>
              <p className="mt-1 text-xs text-foreground">
                {safeText(checklist.sector?.name)}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* D) Fechas */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <Calendar className="h-3.5 w-3.5" />
              Fechas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground">Creado</label>
                <p className="mt-1 text-xs text-foreground">
                  {formatDateTime(checklist.createdAt)}
                </p>
              </div>
              
              <div>
                <label className="text-xs font-medium text-muted-foreground">Última Actualización</label>
                <p className="mt-1 text-xs text-foreground">
                  {formatDateTime(checklist.updatedAt)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

