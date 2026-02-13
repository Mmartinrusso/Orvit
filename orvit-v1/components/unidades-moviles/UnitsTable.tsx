'use client';

import React from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Eye,
  Edit,
  Trash2,
  MoreVertical,
  Copy,
  Wrench,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
} from 'lucide-react';
import { UnidadMovil } from './UnitCard';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Skeleton } from '@/components/ui/skeleton';

interface UnitsTableProps {
  unidades: UnidadMovil[];
  loading?: boolean;
  onView: (unidad: UnidadMovil) => void;
  onEdit?: (unidad: UnidadMovil) => void;
  onDelete?: (unidad: UnidadMovil) => void;
  onDuplicate?: (unidad: UnidadMovil) => void;
  onCreateWorkOrder?: (unidad: UnidadMovil) => void;
  canEdit?: boolean;
  canDelete?: boolean;
  sortBy?: string;
  onSort?: (column: string) => void;
  className?: string;
}

const estadoLabels: Record<string, string> = {
  'ACTIVO': 'Activo',
  'MANTENIMIENTO': 'En reparación',
  'FUERA_SERVICIO': 'Fuera de servicio',
  'DESHABILITADO': 'Baja',
};

const estadoColors: Record<string, string> = {
  'ACTIVO': 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20',
  'MANTENIMIENTO': 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20',
  'FUERA_SERVICIO': 'bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/20',
  'DESHABILITADO': 'bg-muted text-muted-foreground border-border',
};

const formatMeter = (km: number) => {
  return `${km.toLocaleString()} km`;
};

const formatNextService = (date?: string | Date) => {
  if (!date) return 'Sin programar';
  try {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    const now = new Date();
    const diffDays = Math.ceil((dateObj.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    
    if (diffDays < 0) {
      return 'Vencido';
    } else if (diffDays === 0) {
      return 'Hoy';
    } else if (diffDays <= 7) {
      return `en ${diffDays} día${diffDays > 1 ? 's' : ''}`;
    } else {
      return format(dateObj, 'dd MMM yyyy', { locale: es });
    }
  } catch {
    return 'Sin programar';
  }
};

export function UnitsTable({
  unidades,
  loading = false,
  onView,
  onEdit,
  onDelete,
  onDuplicate,
  onCreateWorkOrder,
  canEdit = false,
  canDelete = false,
  sortBy,
  onSort,
  className,
}: UnitsTableProps) {
  const getSortIcon = (column: string) => {
    if (!sortBy || !sortBy.startsWith(column)) return <ArrowUpDown className="h-3 w-3 ml-1" />;
    if (sortBy.endsWith('-asc')) return <ArrowUp className="h-3 w-3 ml-1" />;
    return <ArrowDown className="h-3 w-3 ml-1" />;
  };

  const handleSort = (column: string) => {
    if (!onSort) return;
    const currentSort = sortBy || '';
    if (currentSort === `${column}-asc`) {
      onSort(`${column}-desc`);
    } else {
      onSort(`${column}-asc`);
    }
  };

  if (loading) {
    return (
      <div className={cn('space-y-2', className)}>
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    );
  }

  if (unidades.length === 0) {
    return null; // Empty state se maneja en el componente padre
  }

  return (
    <div className={cn('rounded-md border', className)}>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="h-10 text-xs">
              <button
                onClick={() => handleSort('name')}
                className="flex items-center hover:text-foreground"
              >
                Unidad
                {getSortIcon('name')}
              </button>
            </TableHead>
            <TableHead className="h-10 text-xs">
              <button
                onClick={() => handleSort('estado')}
                className="flex items-center hover:text-foreground"
              >
                Estado
                {getSortIcon('estado')}
              </button>
            </TableHead>
            <TableHead className="h-10 text-xs">Sector</TableHead>
            <TableHead className="h-10 text-xs">
              <button
                onClick={() => handleSort('meter')}
                className="flex items-center hover:text-foreground"
              >
                Medidor
                {getSortIcon('meter')}
              </button>
            </TableHead>
            <TableHead className="h-10 text-xs">OTs abiertas</TableHead>
            <TableHead className="h-10 text-xs">
              <button
                onClick={() => handleSort('next-service')}
                className="flex items-center hover:text-foreground"
              >
                Próximo service
                {getSortIcon('next-service')}
              </button>
            </TableHead>
            <TableHead className="h-10 text-xs w-[100px]">Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {unidades.map((unidad) => (
            <TableRow
              key={unidad.id}
              className="cursor-pointer hover:bg-muted/50"
              onClick={() => onView(unidad)}
            >
              <TableCell className="text-xs">
                <div>
                  <div className="font-medium">{unidad.nombre}</div>
                  <div className="text-muted-foreground text-[11px]">
                    {unidad.tipo} • {unidad.marca} {unidad.modelo}
                  </div>
                </div>
              </TableCell>
              <TableCell>
                <Badge
                  variant="outline"
                  className={cn('text-[10px] px-2 py-0.5 h-5 border', estadoColors[unidad.estado])}
                >
                  {estadoLabels[unidad.estado] || unidad.estado}
                </Badge>
              </TableCell>
              <TableCell className="text-xs">
                {unidad.sector?.name || 'Sin asignar'}
              </TableCell>
              <TableCell className="text-xs">
                {unidad.kilometraje !== null && unidad.kilometraje !== undefined
                  ? formatMeter(unidad.kilometraje)
                  : 'Sin dato'}
              </TableCell>
              <TableCell className="text-xs">
                {unidad.workOrdersCount ? (
                  <Badge variant="secondary" className="text-[10px]">
                    {unidad.workOrdersCount}
                  </Badge>
                ) : (
                  <span className="text-muted-foreground">0</span>
                )}
              </TableCell>
              <TableCell className="text-xs">
                {unidad.proximoMantenimiento ? (
                  <span>{formatNextService(unidad.proximoMantenimiento)}</span>
                ) : (
                  <span className="text-muted-foreground">Sin programar</span>
                )}
              </TableCell>
              <TableCell onClick={(e) => e.stopPropagation()}>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon">
                      <MoreVertical className="h-4 w-4" />
                      <span className="sr-only">Acciones</span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-48">
                    <DropdownMenuItem onClick={() => onView(unidad)}>
                      <Eye className="h-4 w-4 mr-2" />
                      Ver detalles
                    </DropdownMenuItem>
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
                    {onCreateWorkOrder && (
                      <DropdownMenuItem onClick={() => onCreateWorkOrder(unidad)}>
                        <Wrench className="h-4 w-4 mr-2" />
                        Crear OT
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuSeparator />
                    {canDelete && onDelete && (
                      <DropdownMenuItem
                        onClick={() => onDelete(unidad)}
                        className="text-destructive focus:text-destructive"
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Eliminar
                      </DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

