'use client';

import React, { useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  Cog,
  Edit,
  Trash2,
  Plus,
  AlertTriangle,
  ClipboardList,
  CheckCircle,
  QrCode,
  MapPin,
  Calendar,
  CalendarDays,
  MoreVertical,
  X,
  Settings,
  Wrench,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Machine, MachineStatus } from '@/lib/types';
import { formatDate } from '@/lib/date-utils';
import { cn } from '@/lib/utils';

interface MachineDetailHeaderProps {
  machine: Machine;
  sectorName?: string;
  stats: {
    pendingOrders: number;
    openFailures: number;
    completedOrders: number;
    preventiveOrders: number;
    lastMaintenance?: Date | string | null;
  };
  onEdit?: () => void;
  onDelete?: () => void;
  onDisassemble?: () => void;
  onNewOrder?: () => void;
  onNewPreventive?: () => void;
  onNewCorrective?: () => void;
  onReportFailure?: () => void;
  onShowQR?: () => void;
  onClose?: () => void;
  canEdit?: boolean;
  canDelete?: boolean;
  canDisassemble?: boolean;
  canCreateOrder?: boolean;
  canReportFailure?: boolean;
}

export function MachineDetailHeader({
  machine,
  sectorName,
  stats,
  onEdit,
  onDelete,
  onDisassemble,
  onNewOrder,
  onNewPreventive,
  onNewCorrective,
  onReportFailure,
  onShowQR,
  onClose,
  canEdit = false,
  canDelete = false,
  canDisassemble = false,
  canCreateOrder = false,
  canReportFailure = false,
}: MachineDetailHeaderProps) {
  // KPIs cerradas por defecto en móvil (en desktop siempre visibles via CSS)
  const [showKpis, setShowKpis] = useState(false);

  const getMachineStatusBadge = (status: MachineStatus | string) => {
    switch (status) {
      case MachineStatus.ACTIVE:
      case 'ACTIVE':
        return <Badge variant="default" className="bg-success text-success-foreground text-xs px-1.5 py-0">Activo</Badge>;
      case MachineStatus.OUT_OF_SERVICE:
      case 'OUT_OF_SERVICE':
        return <Badge variant="secondary" className="bg-warning text-warning-foreground text-xs px-1.5 py-0">Fuera de servicio</Badge>;
      case MachineStatus.DECOMMISSIONED:
      case 'DECOMMISSIONED':
        return <Badge variant="destructive" className="text-xs px-1.5 py-0">Baja</Badge>;
      default:
        return null;
    }
  };

  const lastMaintenanceFormatted = useMemo(() => {
    if (!stats.lastMaintenance) return 'Sin registro';
    try {
      const date = new Date(stats.lastMaintenance);
      return formatDate(date);
    } catch {
      return 'Sin registro';
    }
  }, [stats.lastMaintenance]);

  return (
    <div className="w-full space-y-3 overflow-hidden">
      {/* Primera fila: Info de máquina + botones */}
      <div className="flex items-center gap-4">
        {/* Machine Photo/Icon */}
        <div className="relative shrink-0">
          {(machine.imageUrl || machine.logo) ? (
            <img
              src={machine.imageUrl || machine.logo}
              alt={machine.name}
              className="w-12 h-12 rounded-lg object-cover border border-border"
            />
          ) : (
            <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center border border-border">
              <Cog className="h-6 w-6 text-primary" />
            </div>
          )}
          {/* Status indicator */}
          <div className={cn('absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-background',
            machine.status === 'ACTIVE' || machine.status === MachineStatus.ACTIVE
              ? 'bg-success'
              : machine.status === 'OUT_OF_SERVICE' || machine.status === MachineStatus.OUT_OF_SERVICE
                ? 'bg-warning'
                : 'bg-destructive'
          )} />
        </div>

        {/* Name + Meta */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-semibold break-words sm:truncate">{machine.name}</h2>
            <span className="hidden sm:inline-flex shrink-0">{getMachineStatusBadge(machine.status)}</span>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            {sectorName && (
              <span className="flex items-center gap-0.5">
                <MapPin className="h-3 w-3" />
                {sectorName}
              </span>
            )}
            {machine.brand && <span>• {machine.brand}</span>}
            {machine.serialNumber && <span className="font-mono hidden sm:inline">• {machine.serialNumber}</span>}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-1 shrink-0">
          {(canCreateOrder || canReportFailure) && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="default" size="sm" className="h-7 text-xs px-2 sm:px-3">
                  <Plus className="h-3.5 w-3.5 sm:mr-1" />
                  <span className="hidden sm:inline">Nuevo</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {canCreateOrder && onNewPreventive && (
                  <DropdownMenuItem onClick={onNewPreventive}>
                    <CalendarDays className="h-4 w-4 mr-2 text-info" />
                    Nuevo Preventivo
                  </DropdownMenuItem>
                )}
                {canCreateOrder && onNewCorrective && (
                  <DropdownMenuItem onClick={onNewCorrective}>
                    <Wrench className="h-4 w-4 mr-2 text-warning" />
                    Nuevo Correctivo
                  </DropdownMenuItem>
                )}
                {canCreateOrder && (onNewPreventive || onNewCorrective) && (onNewOrder || (canReportFailure && onReportFailure)) && (
                  <DropdownMenuSeparator />
                )}
                {canCreateOrder && onNewOrder && (
                  <DropdownMenuItem onClick={onNewOrder}>
                    <ClipboardList className="h-4 w-4 mr-2" />
                    Nueva OT
                  </DropdownMenuItem>
                )}
                {canReportFailure && onReportFailure && (
                  <DropdownMenuItem onClick={onReportFailure}>
                    <AlertTriangle className="h-4 w-4 mr-2 text-destructive" />
                    Nueva Falla
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
          {onShowQR && (
            <Button variant="ghost" size="icon" onClick={onShowQR} className="h-8 w-8">
              <QrCode className="h-4 w-4" />
            </Button>
          )}
          {/* Menú de 3 puntitos — siempre visible en mobile, en desktop solo si hay permisos */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className={cn('h-8 w-8', !(canEdit || canDelete || canDisassemble) && 'sm:hidden')}
              >
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {/* Toggle KPIs — solo en mobile */}
              <DropdownMenuItem onClick={() => setShowKpis(!showKpis)} className="sm:hidden">
                <ClipboardList className="h-4 w-4 mr-2" />
                {showKpis ? 'Ocultar KPIs' : 'Ver KPIs'}
              </DropdownMenuItem>
              {(canEdit || canDelete || canDisassemble) && <DropdownMenuSeparator className="sm:hidden" />}
              {canEdit && onEdit && (
                <DropdownMenuItem onClick={onEdit}>
                  <Edit className="h-4 w-4 mr-2" />
                  Editar
                </DropdownMenuItem>
              )}
              {canDisassemble && onDisassemble && (
                <DropdownMenuItem onClick={onDisassemble}>
                  <Settings className="h-4 w-4 mr-2" />
                  Desarmar Máquina
                </DropdownMenuItem>
              )}
              {(canEdit || canDisassemble) && canDelete && <DropdownMenuSeparator />}
              {canDelete && onDelete && (
                <DropdownMenuItem onClick={onDelete} className="text-destructive focus:text-destructive">
                  <Trash2 className="h-4 w-4 mr-2" />
                  Eliminar
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
          {/* Botón cerrar */}
          {onClose && (
            <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8">
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      <div className={cn('grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2', !showKpis ? 'hidden sm:grid' : '')}>
        {/* OT Pendientes */}
        <Card className={cn('p-3',
          stats.pendingOrders > 0
            ? 'bg-warning-muted border-warning-muted'
            : 'bg-muted/30 border-border/50'
        )}>
          <div className="flex items-center gap-2">
            <ClipboardList className={cn('h-5 w-5', stats.pendingOrders > 0 ? 'text-warning' : 'text-muted-foreground')} />
            <div>
              <p className="text-xs text-muted-foreground leading-none">OT Pendientes</p>
              <p className={cn('text-xl font-bold leading-tight', stats.pendingOrders > 0 ? 'text-warning' : 'text-foreground')}>
                {stats.pendingOrders}
              </p>
            </div>
          </div>
        </Card>

        {/* Fallas Abiertas */}
        <Card className={cn('p-3',
          stats.openFailures > 0
            ? 'bg-destructive/10 border-destructive/20'
            : 'bg-muted/30 border-border/50'
        )}>
          <div className="flex items-center gap-2">
            <AlertTriangle className={cn('h-5 w-5', stats.openFailures > 0 ? 'text-destructive' : 'text-muted-foreground')} />
            <div>
              <p className="text-xs text-muted-foreground leading-none">Fallas Abiertas</p>
              <p className={cn('text-xl font-bold leading-tight', stats.openFailures > 0 ? 'text-destructive' : 'text-foreground')}>
                {stats.openFailures}
              </p>
            </div>
          </div>
        </Card>

        {/* Completas */}
        <Card className="p-3 bg-muted/30 border-border/50">
          <div className="flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-muted-foreground" />
            <div>
              <p className="text-xs text-muted-foreground leading-none">Completas (7d)</p>
              <p className="text-xl font-bold text-foreground leading-tight">{stats.completedOrders}</p>
            </div>
          </div>
        </Card>

        {/* Preventivos */}
        <Card className="p-3 bg-muted/30 border-border/50">
          <div className="flex items-center gap-2">
            <CalendarDays className="h-5 w-5 text-muted-foreground" />
            <div>
              <p className="text-xs text-muted-foreground leading-none">Preventivos (7d)</p>
              <p className="text-xl font-bold text-foreground leading-tight">{stats.preventiveOrders}</p>
            </div>
          </div>
        </Card>

        {/* Último Mantenimiento */}
        <Card className="p-3 bg-muted/30 border-border/50">
          <div className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-muted-foreground" />
            <div>
              <p className="text-xs text-muted-foreground leading-none">Últ. Mantenimiento</p>
              <p className="text-sm font-bold text-foreground leading-tight">{lastMaintenanceFormatted}</p>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
