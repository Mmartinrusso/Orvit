'use client';

import React from 'react';
import { WorkstationCard, WorkStation } from './WorkstationCard';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

interface WorkstationsGridProps {
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
  selectionMode?: boolean;
  selectedIds?: number[];
  onToggleSelection?: (id: number) => void;
  className?: string;
}

export function WorkstationsGrid({
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
  selectionMode = false,
  selectedIds = [],
  onToggleSelection,
  className,
}: WorkstationsGridProps) {
  if (loading) {
    return (
      <div className={cn('grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3', className)}>
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-[260px] rounded-xl" />
        ))}
      </div>
    );
  }

  if (workstations.length === 0) {
    return null; // Empty state se maneja en el componente padre
  }

  return (
    <div className={cn('grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3', className)}>
      {workstations.map((workstation) => (
        <WorkstationCard
          key={workstation.id}
          workstation={workstation}
          onView={onView}
          onEdit={onEdit}
          onDelete={onDelete}
          onDuplicate={onDuplicate}
          onManageMachines={onManageMachines}
          onAddInstructive={onAddInstructive}
          onToggleStatus={onToggleStatus}
          canEdit={canEdit}
          canDelete={canDelete}
          selectionMode={selectionMode}
          isSelected={selectedIds.includes(workstation.id)}
          onToggleSelection={onToggleSelection}
        />
      ))}
    </div>
  );
}

