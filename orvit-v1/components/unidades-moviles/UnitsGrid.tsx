'use client';

import React from 'react';
import { UnitCard, UnidadMovil } from './UnitCard';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { CheckSquare, Square, X } from 'lucide-react';

interface UnitsGridProps {
  unidades: UnidadMovil[];
  loading?: boolean;
  onView: (unidad: UnidadMovil) => void;
  onEdit?: (unidad: UnidadMovil) => void;
  onDelete?: (unidad: UnidadMovil) => void;
  onDuplicate?: (unidad: UnidadMovil) => void;
  onCreateWorkOrder?: (unidad: UnidadMovil) => void;
  onReportFailure?: (unidad: UnidadMovil) => void;
  onScheduleService?: (unidad: UnidadMovil) => void;
  canEdit?: boolean;
  canDelete?: boolean;
  canReportFailure?: boolean;
  showQuickActions?: boolean;
  // Bulk selection
  selectionMode?: boolean;
  selectedUnits?: number[];
  onSelectionChange?: (ids: number[]) => void;
  className?: string;
}

export function UnitsGrid({
  unidades,
  loading = false,
  onView,
  onEdit,
  onDelete,
  onDuplicate,
  onCreateWorkOrder,
  onReportFailure,
  onScheduleService,
  canEdit = false,
  canDelete = false,
  canReportFailure = false,
  showQuickActions = true,
  selectionMode = false,
  selectedUnits = [],
  onSelectionChange,
  className,
}: UnitsGridProps) {
  const handleSelect = (unidad: UnidadMovil, selected: boolean) => {
    if (!onSelectionChange) return;

    if (selected) {
      onSelectionChange([...selectedUnits, unidad.id]);
    } else {
      onSelectionChange(selectedUnits.filter(id => id !== unidad.id));
    }
  };

  const handleSelectAll = () => {
    if (!onSelectionChange) return;
    onSelectionChange(unidades.map(u => u.id));
  };

  const handleDeselectAll = () => {
    if (!onSelectionChange) return;
    onSelectionChange([]);
  };

  if (loading) {
    return (
      <div className={cn('grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3', className)}>
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-[280px] rounded-xl" />
        ))}
      </div>
    );
  }

  if (unidades.length === 0) {
    return null; // Empty state se maneja en el componente padre
  }

  return (
    <div className={cn('space-y-3', className)}>
      {/* Selection toolbar */}
      {selectionMode && onSelectionChange && (
        <div className="flex items-center justify-between px-2 py-2 bg-muted/50 rounded-lg border">
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">
              {selectedUnits.length} de {unidades.length} seleccionadas
            </span>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleSelectAll}
              className="h-7 text-xs"
              disabled={selectedUnits.length === unidades.length}
            >
              <CheckSquare className="h-3.5 w-3.5 mr-1" />
              Todas
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleDeselectAll}
              className="h-7 text-xs"
              disabled={selectedUnits.length === 0}
            >
              <X className="h-3.5 w-3.5 mr-1" />
              Ninguna
            </Button>
          </div>
        </div>
      )}

      {/* Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
        {unidades.map((unidad) => (
          <UnitCard
            key={unidad.id}
            unidad={unidad}
            onView={onView}
            onEdit={onEdit}
            onDelete={onDelete}
            onDuplicate={onDuplicate}
            onCreateWorkOrder={onCreateWorkOrder}
            onReportFailure={onReportFailure}
            onScheduleService={onScheduleService}
            canEdit={canEdit}
            canDelete={canDelete}
            canReportFailure={canReportFailure}
            showQuickActions={showQuickActions}
            selected={selectedUnits.includes(unidad.id)}
            onSelect={selectionMode ? handleSelect : undefined}
          />
        ))}
      </div>
    </div>
  );
}
