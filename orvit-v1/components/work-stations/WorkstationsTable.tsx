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
import { Checkbox } from '@/components/ui/checkbox';
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
  FileText,
  Power,
  PowerOff,
  Settings,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
} from 'lucide-react';
import { WorkStation } from './WorkstationCard';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Skeleton } from '@/components/ui/skeleton';

interface WorkstationsTableProps {
  workstations: WorkStation[];
  loading?: boolean;
  onView: (workstation: WorkStation) => void;
  onEdit?: (workstation: WorkStation) => void;
  onDelete?: (workstation: WorkStation) => void;
  onDuplicate?: (workstation: WorkStation) => void;
  onManageMachines?: (workstation: WorkStation) => void;
  onAddInstructive?: (workstation: WorkStation) => void;
  onToggleStatus?: (workstation: WorkStation) => void;
  canEdit?: boolean;
  canDelete?: boolean;
  sortBy?: string;
  onSort?: (column: string) => void;
  selectionMode?: boolean;
  selectedIds?: number[];
  onToggleSelection?: (id: number) => void;
  className?: string;
}

import { statusLabels, statusColors } from './workstation.helpers';

const formatDate = (date: string) => {
  try {
    return format(new Date(date), 'dd MMM yyyy', { locale: es });
  } catch {
    return 'Sin fecha';
  }
};

export function WorkstationsTable({
  workstations,
  loading = false,
  onView,
  onEdit,
  onDelete,
  onDuplicate,
  onManageMachines,
  onAddInstructive,
  onToggleStatus,
  canEdit = false,
  canDelete = false,
  sortBy,
  onSort,
  selectionMode = false,
  selectedIds = [],
  onToggleSelection,
  className,
}: WorkstationsTableProps) {
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

  if (workstations.length === 0) {
    return null; // Empty state se maneja en el componente padre
  }

  const handleRowClick = (workstation: WorkStation) => {
    if (selectionMode && onToggleSelection) {
      onToggleSelection(workstation.id);
    } else {
      onView(workstation);
    }
  };

  return (
    <div className={cn('rounded-md border overflow-x-auto', className)}>
      <Table>
        <TableHeader>
          <TableRow>
            {selectionMode && (
              <TableHead className="h-10 w-[40px]" />
            )}
            <TableHead className="h-10 text-xs">
              <button
                onClick={() => handleSort('name')}
                className="flex items-center hover:text-foreground"
              >
                Puesto
                {getSortIcon('name')}
              </button>
            </TableHead>
            <TableHead className="h-10 text-xs">
              <button
                onClick={() => handleSort('status')}
                className="flex items-center hover:text-foreground"
              >
                Estado
                {getSortIcon('status')}
              </button>
            </TableHead>
            <TableHead className="h-10 text-xs">Instructivos</TableHead>
            <TableHead className="h-10 text-xs">Máquinas</TableHead>
            <TableHead className="h-10 text-xs">
              <button
                onClick={() => handleSort('created')}
                className="flex items-center hover:text-foreground"
              >
                Creado
                {getSortIcon('created')}
              </button>
            </TableHead>
            {!selectionMode && (
              <TableHead className="h-10 text-xs w-[100px]">Acciones</TableHead>
            )}
          </TableRow>
        </TableHeader>
        <TableBody>
          {workstations.map((workstation) => (
            <TableRow
              key={workstation.id}
              className={cn(
                "cursor-pointer hover:bg-muted/50",
                selectionMode && selectedIds.includes(workstation.id) && "bg-primary/5"
              )}
              onClick={() => handleRowClick(workstation)}
            >
              {selectionMode && (
                <TableCell className="w-[40px]" onClick={(e) => e.stopPropagation()}>
                  <Checkbox
                    checked={selectedIds.includes(workstation.id)}
                    onCheckedChange={() => onToggleSelection?.(workstation.id)}
                  />
                </TableCell>
              )}
              <TableCell className="text-xs">
                <div>
                  <div className="font-medium">{workstation.name}</div>
                  <div className="text-muted-foreground text-[11px]">
                    {workstation.code}
                  </div>
                </div>
              </TableCell>
              <TableCell>
                <Badge
                  variant="outline"
                  className={cn('text-[10px] px-2 py-0.5 h-5 border', statusColors[workstation.status])}
                >
                  {statusLabels[workstation.status] || workstation.status}
                </Badge>
              </TableCell>
              <TableCell className="text-xs">
                {workstation.instructives?.length || 0}
              </TableCell>
              <TableCell className="text-xs">
                {workstation.machines?.length || 0}
              </TableCell>
              <TableCell className="text-xs">
                {formatDate(workstation.createdAt)}
              </TableCell>
              {!selectionMode && (
                <TableCell onClick={(e) => e.stopPropagation()}>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon">
                        <MoreVertical className="h-4 w-4" />
                        <span className="sr-only">Acciones</span>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-48">
                      <DropdownMenuItem onClick={() => onView(workstation)}>
                        <Eye className="h-4 w-4 mr-2" />
                        Ver detalle
                      </DropdownMenuItem>
                      {canEdit && onEdit && (
                        <DropdownMenuItem onClick={() => onEdit(workstation)}>
                          <Edit className="h-4 w-4 mr-2" />
                          Editar
                        </DropdownMenuItem>
                      )}
                      {onDuplicate && (
                        <DropdownMenuItem onClick={() => onDuplicate(workstation)}>
                          <Copy className="h-4 w-4 mr-2" />
                          Duplicar
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuSeparator />
                      {onManageMachines && (
                        <DropdownMenuItem onClick={() => onManageMachines(workstation)}>
                          <Settings className="h-4 w-4 mr-2" />
                          Gestionar máquinas
                        </DropdownMenuItem>
                      )}
                      {onAddInstructive && (
                        <DropdownMenuItem onClick={() => onAddInstructive(workstation)}>
                          <FileText className="h-4 w-4 mr-2" />
                          Agregar instructivo
                        </DropdownMenuItem>
                      )}
                      {onToggleStatus && (
                        <DropdownMenuItem onClick={() => onToggleStatus(workstation)}>
                          {workstation.status === 'ACTIVE' ? (
                            <>
                              <PowerOff className="h-4 w-4 mr-2" />
                              Desactivar
                            </>
                          ) : (
                            <>
                              <Power className="h-4 w-4 mr-2" />
                              Activar
                            </>
                          )}
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuSeparator />
                      {canDelete && onDelete && (
                        <DropdownMenuItem
                          onClick={() => onDelete(workstation)}
                          className="text-destructive focus:text-destructive"
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Eliminar
                        </DropdownMenuItem>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              )}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

