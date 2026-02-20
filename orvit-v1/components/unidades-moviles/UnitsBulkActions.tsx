'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  X,
  CheckSquare,
  Wrench,
  CalendarClock,
  Settings,
  Trash2,
  ChevronDown,
  AlertTriangle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { UnidadMovil } from './UnitCard';

interface UnitsBulkActionsProps {
  selectedUnits: UnidadMovil[];
  onClearSelection: () => void;
  onBulkCreateWorkOrder?: (units: UnidadMovil[]) => void;
  onBulkScheduleService?: (units: UnidadMovil[]) => void;
  onBulkChangeStatus?: (units: UnidadMovil[], status: string) => void;
  onBulkDelete?: (units: UnidadMovil[]) => void;
  canEdit?: boolean;
  canDelete?: boolean;
  className?: string;
}

export function UnitsBulkActions({
  selectedUnits,
  onClearSelection,
  onBulkCreateWorkOrder,
  onBulkScheduleService,
  onBulkChangeStatus,
  onBulkDelete,
  canEdit = false,
  canDelete = false,
  className,
}: UnitsBulkActionsProps) {
  const [showDeleteConfirm, setShowDeleteConfirm] = React.useState(false);

  if (selectedUnits.length === 0) return null;

  const handleBulkDelete = () => {
    onBulkDelete?.(selectedUnits);
    setShowDeleteConfirm(false);
    onClearSelection();
  };

  return (
    <>
      <div
        className={cn(
          'fixed bottom-4 left-1/2 -translate-x-1/2 z-50',
          'flex items-center gap-2 px-4 py-3 rounded-xl',
          'bg-background border shadow-lg',
          'animate-in slide-in-from-bottom-4 duration-300',
          className
        )}
      >
        {/* Selection count */}
        <div className="flex items-center gap-2 pr-3 border-r">
          <CheckSquare className="h-4 w-4 text-primary" />
          <span className="text-sm font-medium">
            {selectedUnits.length} {selectedUnits.length === 1 ? 'seleccionada' : 'seleccionadas'}
          </span>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1.5">
          {/* Create Work Orders */}
          {onBulkCreateWorkOrder && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                onBulkCreateWorkOrder(selectedUnits);
                onClearSelection();
              }}
              className="h-8 text-xs"
            >
              <Wrench className="h-3.5 w-3.5 mr-1.5" />
              Crear OTs
            </Button>
          )}

          {/* Schedule Service */}
          {onBulkScheduleService && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                onBulkScheduleService(selectedUnits);
                onClearSelection();
              }}
              className="h-8 text-xs"
            >
              <CalendarClock className="h-3.5 w-3.5 mr-1.5" />
              Programar Service
            </Button>
          )}

          {/* Change Status */}
          {canEdit && onBulkChangeStatus && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-8 text-xs">
                  <Settings className="h-3.5 w-3.5 mr-1.5" />
                  Cambiar Estado
                  <ChevronDown className="h-3 w-3 ml-1" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="center">
                <DropdownMenuItem onClick={() => {
                  onBulkChangeStatus(selectedUnits, 'ACTIVO');
                  onClearSelection();
                }}>
                  <Badge className="bg-success-muted text-success border-success/20 text-[10px] mr-2">
                    Activo
                  </Badge>
                  Marcar como Activo
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => {
                  onBulkChangeStatus(selectedUnits, 'MANTENIMIENTO');
                  onClearSelection();
                }}>
                  <Badge className="bg-warning-muted text-warning-muted-foreground border-warning-muted-foreground/20 text-[10px] mr-2">
                    Mant.
                  </Badge>
                  En Mantenimiento
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => {
                  onBulkChangeStatus(selectedUnits, 'FUERA_SERVICIO');
                  onClearSelection();
                }}>
                  <Badge className="bg-destructive/10 text-destructive border-destructive/20 text-[10px] mr-2">
                    Fuera
                  </Badge>
                  Fuera de Servicio
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => {
                  onBulkChangeStatus(selectedUnits, 'DESHABILITADO');
                  onClearSelection();
                }}>
                  <Badge className="bg-muted text-muted-foreground text-[10px] mr-2">
                    Baja
                  </Badge>
                  Dar de Baja
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          {/* Delete */}
          {canDelete && onBulkDelete && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowDeleteConfirm(true)}
              className="h-8 text-xs text-destructive hover:text-destructive hover:bg-destructive/10"
            >
              <Trash2 className="h-3.5 w-3.5 mr-1.5" />
              Eliminar
            </Button>
          )}
        </div>

        {/* Clear selection */}
        <Button
          variant="ghost"
          size="sm"
          onClick={onClearSelection}
          className="h-8 w-8 p-0 ml-2"
        >
          <X className="h-4 w-4" />
          <span className="sr-only">Limpiar selección</span>
        </Button>
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              ¿Eliminar {selectedUnits.length} unidades?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. Se eliminarán permanentemente las siguientes unidades:
              <ul className="mt-2 space-y-1 text-xs">
                {selectedUnits.slice(0, 5).map(u => (
                  <li key={u.id} className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-destructive" />
                    {u.nombre} ({u.patente})
                  </li>
                ))}
                {selectedUnits.length > 5 && (
                  <li className="text-muted-foreground">
                    ... y {selectedUnits.length - 5} más
                  </li>
                )}
              </ul>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="h-9 text-xs">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleBulkDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 h-9 text-xs"
            >
              Eliminar {selectedUnits.length} unidades
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

export default UnitsBulkActions;
