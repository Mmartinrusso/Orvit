'use client';

import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
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
  Building2,
  Eye,
  Edit,
  Trash2,
  MoreVertical,
  Copy,
  FileText,
  Wrench,
  Power,
  PowerOff,
  Settings,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

export interface WorkStation {
  id: number;
  name: string;
  description?: string;
  code: string;
  status: 'ACTIVE' | 'INACTIVE' | 'MAINTENANCE';
  sectorId: number;
  companyId: number;
  createdAt: string;
  updatedAt: string;
  sector: {
    id: number;
    name: string;
  };
  instructives?: {
    id: number;
    title: string;
    fileName?: string;
  }[];
  machines?: {
    id: number;
    name: string;
  }[];
}

interface WorkstationCardProps {
  workstation: WorkStation;
  onView: (workstation: WorkStation) => void;
  onEdit?: (workstation: WorkStation) => void;
  onDelete?: (workstation: WorkStation) => void;
  onDuplicate?: (workstation: WorkStation) => void;
  onManageMachines?: (workstation: WorkStation) => void;
  onAddInstructive?: (workstation: WorkStation) => void;
  onToggleStatus?: (workstation: WorkStation) => void;
  canEdit?: boolean;
  canDelete?: boolean;
  selectionMode?: boolean;
  isSelected?: boolean;
  onToggleSelection?: (id: number) => void;
  className?: string;
}

import { statusLabels, statusColors } from './workstation.helpers';

export function WorkstationCard({
  workstation,
  onView,
  onEdit,
  onDelete,
  onDuplicate,
  onManageMachines,
  onAddInstructive,
  onToggleStatus,
  canEdit = false,
  canDelete = false,
  selectionMode = false,
  isSelected = false,
  onToggleSelection,
  className,
}: WorkstationCardProps) {
  const instructivesCount = workstation.instructives?.length || 0;
  const machinesCount = workstation.machines?.length || 0;

  const formatDate = (date: string) => {
    try {
      return format(new Date(date), 'dd MMM yyyy', { locale: es });
    } catch {
      return 'Sin fecha';
    }
  };

  const handleCardClick = () => {
    if (selectionMode && onToggleSelection) {
      onToggleSelection(workstation.id);
    } else {
      onView(workstation);
    }
  };

  return (
    <Card
      className={cn(
        'group relative transition-all duration-200 border-border bg-card rounded-xl overflow-hidden hover:shadow-md hover:border-border/80 cursor-pointer',
        selectionMode && isSelected && 'ring-2 ring-primary border-primary',
        className
      )}
      onClick={handleCardClick}
    >
      <CardContent className="p-4 pt-5">
        {/* Header: Nombre + Badge Estado */}
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            {selectionMode ? (
              <div onClick={(e) => e.stopPropagation()}>
                <Checkbox
                  checked={isSelected}
                  onCheckedChange={() => onToggleSelection?.(workstation.id)}
                  className="shrink-0"
                />
              </div>
            ) : (
              <div className="p-1.5 rounded-md bg-primary/10 text-primary shrink-0">
                <Building2 className="h-3.5 w-3.5" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-sm text-foreground line-clamp-2">
                {workstation.name || 'Sin nombre'}
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                {workstation.code}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <Badge
              variant="outline"
              className={cn('text-xs px-2 py-0 h-5 border shrink-0', statusColors[workstation.status])}
            >
              {statusLabels[workstation.status] || workstation.status}
            </Badge>
            {!selectionMode && (
            <div className="contents" onClick={(e) => e.stopPropagation()}>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0 opacity-70 group-hover:opacity-100 transition-opacity"
                >
                  <MoreVertical className="h-3.5 w-3.5" />
                  <span className="sr-only">Más opciones</span>
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
            </div>
            )}
          </div>
        </div>

        {/* Descripción */}
        <div className="mb-3">
          {workstation.description ? (
            <p className="text-xs text-muted-foreground line-clamp-2">
              {workstation.description}
            </p>
          ) : (
            <p className="text-xs text-muted-foreground italic">Sin descripción</p>
          )}
        </div>

        {/* Métricas */}
        <div className="grid grid-cols-2 gap-2 mb-3">
          <div className="flex items-center gap-1.5 text-xs">
            <FileText className="h-3 w-3 text-muted-foreground shrink-0" />
            <span className="text-muted-foreground">Instructivos:</span>
            <span className="font-normal text-foreground">{instructivesCount}</span>
          </div>
          <div className="flex items-center gap-1.5 text-xs">
            <Wrench className="h-3 w-3 text-muted-foreground shrink-0" />
            <span className="text-muted-foreground">Máquinas:</span>
            <span className="font-normal text-foreground">{machinesCount}</span>
          </div>
        </div>

        {/* Footer: Info + Acciones */}
        <div className="flex items-center justify-between text-xs text-muted-foreground pt-2 border-t border-border/50 mb-2">
          <span>Creado {formatDate(workstation.createdAt)}</span>
        </div>

        {/* Acciones */}
        {!selectionMode && (
          <div className="flex items-center gap-2">
            <Button
              variant="default"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                onView(workstation);
              }}
              className="h-8 text-xs flex-1"
            >
              <Eye className="h-3.5 w-3.5 mr-1" />
              Ver
            </Button>
            {canEdit && onEdit && (
              <Button
                variant="outline"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  onEdit(workstation);
                }}
                className="h-8 text-xs flex-1"
              >
                <Edit className="h-3.5 w-3.5 mr-1" />
                Editar
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

