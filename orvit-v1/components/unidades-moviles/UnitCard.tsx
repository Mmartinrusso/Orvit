'use client';

import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider,
} from '@/components/ui/tooltip';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Truck,
  Edit,
  Trash2,
  MoreVertical,
  Copy,
  Wrench,
  MapPin,
  Gauge,
  Calendar,
  AlertCircle,
  AlertTriangle,
  Zap,
  CalendarClock,
  RefreshCw,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

export interface UnidadMovil {
  id: number;
  nombre: string;
  tipo: string;
  marca: string;
  modelo: string;
  año: number;
  patente: string;
  kilometraje: number;
  estado: 'ACTIVO' | 'MANTENIMIENTO' | 'FUERA_SERVICIO' | 'DESHABILITADO';
  sectorId?: number;
  sector?: {
    id: number;
    name: string;
  };
  proximoMantenimiento?: string | Date;
  ultimoMantenimiento?: string | Date;
  workOrdersCount?: number;
  failuresCount?: number;
  companyId: number;
  createdAt: string;
  updatedAt: string;
  kmUpdateFrequencyDays?: number | null;
  ultimaLecturaKm?: string | Date | null;
}

interface UnitCardProps {
  unidad: UnidadMovil;
  onView: (unidad: UnidadMovil) => void;
  onEdit?: (unidad: UnidadMovil) => void;
  onDelete?: (unidad: UnidadMovil) => void;
  onDuplicate?: (unidad: UnidadMovil) => void;
  onCreateWorkOrder?: (unidad: UnidadMovil) => void;
  onReportFailure?: (unidad: UnidadMovil) => void;
  onScheduleService?: (unidad: UnidadMovil) => void;
  onLoadKilometraje?: (unidad: UnidadMovil) => void;
  canEdit?: boolean;
  canDelete?: boolean;
  canReportFailure?: boolean;
  selected?: boolean;
  onSelect?: (unidad: UnidadMovil, selected: boolean) => void;
  showQuickActions?: boolean;
  className?: string;
}

const estadoLabels: Record<string, string> = {
  'ACTIVO': 'Activo',
  'MANTENIMIENTO': 'En reparación',
  'FUERA_SERVICIO': 'Fuera de servicio',
  'DESHABILITADO': 'Baja',
};

const estadoColors: Record<string, string> = {
  'ACTIVO': 'bg-success-muted text-success border-success/20',
  'MANTENIMIENTO': 'bg-warning-muted text-warning-muted-foreground border-warning-muted-foreground/20',
  'FUERA_SERVICIO': 'bg-destructive/10 text-destructive border-destructive/20',
  'DESHABILITADO': 'bg-muted text-muted-foreground border-border',
};

export function UnitCard({
  unidad,
  onView,
  onEdit,
  onDelete,
  onDuplicate,
  onCreateWorkOrder,
  onReportFailure,
  onScheduleService,
  onLoadKilometraje,
  canEdit = false,
  canDelete = false,
  canReportFailure = false,
  selected = false,
  onSelect,
  showQuickActions = true,
  className,
}: UnitCardProps) {
  const formatMeter = (km: number) => {
    return `${km.toLocaleString()} km`;
  };

  const formatNextService = (date?: string | Date) => {
    if (!date) return null;
    try {
      const dateObj = typeof date === 'string' ? new Date(date) : date;
      const now = new Date();
      const diffDays = Math.ceil((dateObj.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

      if (diffDays < 0) {
        return { text: 'Vencido', isOverdue: true };
      } else if (diffDays === 0) {
        return { text: 'Hoy', isOverdue: false };
      } else if (diffDays <= 7) {
        return { text: `en ${diffDays} día${diffDays > 1 ? 's' : ''}`, isOverdue: false };
      } else {
        return { text: format(dateObj, 'dd MMM', { locale: es }), isOverdue: false };
      }
    } catch {
      return null;
    }
  };

  const nextService = formatNextService(unidad.proximoMantenimiento);
  const sectorName = unidad.sector?.name || 'Sin asignar';
  const workOrdersCount = unidad.workOrdersCount || 0;

  // Check urgency status
  const isOverdue = nextService?.isOverdue || false;
  const needsAttention = unidad.estado === 'FUERA_SERVICIO' || isOverdue;

  // Km reading overdue check
  const kmReadingOverdue = (() => {
    if (!unidad.kmUpdateFrequencyDays) return null;
    const lastRead = unidad.ultimaLecturaKm ? new Date(unidad.ultimaLecturaKm) : null;
    if (!lastRead) return { daysLate: unidad.kmUpdateFrequencyDays, nextExpected: null };
    const daysSinceLast = Math.floor((Date.now() - lastRead.getTime()) / (1000 * 60 * 60 * 24));
    if (daysSinceLast >= unidad.kmUpdateFrequencyDays) {
      return { daysLate: daysSinceLast - unidad.kmUpdateFrequencyDays, nextExpected: null };
    }
    return null;
  })();

  const handleCardClick = () => {
    onView(unidad);
  };

  return (
    <TooltipProvider delayDuration={300}>
      <Card
        onClick={handleCardClick}
        className={cn(
          'group relative transition-all duration-200 border-border bg-card rounded-xl overflow-hidden cursor-pointer',
          'hover:shadow-md hover:border-primary/30',
          needsAttention && 'border-l-4 border-l-destructive',
          selected && 'ring-2 ring-primary border-primary',
          className
        )}
      >

        {/* Selection checkbox */}
        {onSelect && (
          <div className="absolute top-2 left-2 z-10">
            <input
              type="checkbox"
              checked={selected}
              onChange={(e) => onSelect(unidad, e.target.checked)}
              onClick={(e) => e.stopPropagation()}
              className="h-4 w-4 rounded border-border text-primary focus:ring-primary cursor-pointer"
            />
          </div>
        )}

        <CardContent className={cn('p-4 pt-5', onSelect && 'pt-8')}>
          {/* Header: Nombre + Alerta + Badge Estado */}
          <div className="flex items-start justify-between gap-2 mb-2">
            <h3 className="font-semibold text-sm text-foreground line-clamp-2 flex-1">
              {unidad.nombre || 'Sin nombre'}
            </h3>
            <div className="flex items-center gap-1.5 shrink-0">
              {needsAttention && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="p-1 rounded-full bg-destructive/10">
                      <AlertTriangle className="h-3.5 w-3.5 text-destructive" />
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="text-xs">
                      {isOverdue ? 'Mantenimiento vencido' : 'Requiere atención'}
                    </p>
                  </TooltipContent>
                </Tooltip>
              )}
              <Badge
                variant="outline"
                className={cn('text-xs px-2 py-0 h-5 border', estadoColors[unidad.estado])}
              >
                {estadoLabels[unidad.estado] || unidad.estado}
              </Badge>
            </div>
          </div>

          {/* Subheader: Tipo + Marca/Modelo */}
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-3 flex-wrap">
            <div className="flex items-center gap-1">
              <Truck className="h-3 w-3 shrink-0" />
              <span className="truncate">{unidad.tipo || 'Sin tipo'}</span>
            </div>
            <span className="text-border">·</span>
            <span className="truncate">
              {unidad.marca || 'Sin marca'} {unidad.modelo || ''}
            </span>
          </div>

          {/* Body: datos clave */}
          <div className="space-y-2 mb-3">
            {/* Sector */}
            <div className="flex items-center gap-1.5 text-xs">
              <MapPin className="h-3 w-3 text-muted-foreground shrink-0" />
              <span className="text-muted-foreground">Sector:</span>
              <span className="font-normal text-foreground">{sectorName}</span>
            </div>

            {/* Medidor */}
            <div className="flex items-center gap-1.5 text-xs">
              <Gauge className="h-3 w-3 text-muted-foreground shrink-0" />
              <span className="text-muted-foreground">Medidor:</span>
              <span className="font-normal text-foreground flex-1">
                {unidad.kilometraje !== null && unidad.kilometraje !== undefined
                  ? formatMeter(unidad.kilometraje)
                  : 'Sin dato'}
              </span>
              {kmReadingOverdue && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div
                      className="flex items-center gap-0.5 text-warning-muted-foreground cursor-pointer"
                      onClick={(e) => { e.stopPropagation(); onLoadKilometraje?.(unidad); }}
                    >
                      <RefreshCw className="h-3 w-3" />
                      <span className="text-warning-muted-foreground">Actualizar km</span>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="text-xs">
                      {kmReadingOverdue.daysLate > 0
                        ? `Lectura de km atrasada ${kmReadingOverdue.daysLate} día${kmReadingOverdue.daysLate !== 1 ? 's' : ''}`
                        : 'Falta registrar el km inicial'}
                    </p>
                  </TooltipContent>
                </Tooltip>
              )}
            </div>

            {/* Próximo service */}
            <div className="flex items-center gap-1.5 text-xs">
              <Calendar className="h-3 w-3 text-muted-foreground shrink-0" />
              <span className="text-muted-foreground">Próximo service:</span>
              {nextService ? (
                <span className={cn(
                  'font-medium',
                  nextService.isOverdue ? 'text-destructive' : 'text-foreground'
                )}>
                  {nextService.text}
                </span>
              ) : (
                <span className="font-normal text-muted-foreground">Sin programar</span>
              )}
            </div>

            {/* OTs abiertas (si hay) */}
            {workOrdersCount > 0 && (
              <div className="flex items-center gap-1.5 text-xs">
                <AlertCircle className="h-3 w-3 text-muted-foreground shrink-0" />
                <span className="text-muted-foreground">
                  {workOrdersCount} {workOrdersCount === 1 ? 'OT abierta' : 'OTs abiertas'}
                </span>
              </div>
            )}
          </div>

          {/* Footer: Acciones */}
          <div className="flex items-center gap-2 pt-2 border-t border-border/50">
            {canEdit && onEdit && (
              <Button
                variant="outline"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  onEdit(unidad);
                }}
                className="h-8 text-xs flex-1"
              >
                <Edit className="h-3.5 w-3.5 mr-1" />
                Editar
              </Button>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className={cn('h-8 p-0', canEdit && onEdit ? 'w-8' : 'flex-1')}
                  onClick={(e) => e.stopPropagation()}
                >
                  <MoreVertical className="h-3.5 w-3.5" />
                  {!(canEdit && onEdit) && <span className="ml-1 text-xs">Acciones</span>}
                  <span className="sr-only">Más opciones</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                {canEdit && onEdit && (
                  <DropdownMenuItem onClick={() => onEdit(unidad)}>
                    <Edit className="h-4 w-4 mr-2" />
                    Editar
                  </DropdownMenuItem>
                )}
                {onDuplicate && (
                  <DropdownMenuItem onClick={() => onDuplicate(unidad)}>
                    <Copy className="h-4 w-4 mr-2" />
                    Duplicar
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                {onCreateWorkOrder && (
                  <DropdownMenuItem onClick={() => onCreateWorkOrder(unidad)}>
                    <Wrench className="h-4 w-4 mr-2" />
                    Crear OT
                  </DropdownMenuItem>
                )}
                {canReportFailure && onReportFailure && (
                  <DropdownMenuItem onClick={() => onReportFailure(unidad)}>
                    <Zap className="h-4 w-4 mr-2" />
                    Reportar Falla
                  </DropdownMenuItem>
                )}
                {onScheduleService && (
                  <DropdownMenuItem onClick={() => onScheduleService(unidad)}>
                    <CalendarClock className="h-4 w-4 mr-2" />
                    Programar Service
                  </DropdownMenuItem>
                )}
                {onLoadKilometraje && (
                  <DropdownMenuItem onClick={() => onLoadKilometraje(unidad)}>
                    <Gauge className="h-4 w-4 mr-2" />
                    Cargar Kilometraje
                  </DropdownMenuItem>
                )}
                {canDelete && onDelete && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={() => onDelete(unidad)}
                      className="text-destructive focus:text-destructive"
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Eliminar
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </CardContent>
      </Card>
    </TooltipProvider>
  );
}
