'use client';

import React, { useState, useMemo, useCallback } from 'react';
import {
  DndContext,
  DragEndEvent,
  DragStartEvent,
  DragOverlay,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { useDroppable } from '@dnd-kit/core';
import { Skeleton } from '@/components/ui/skeleton';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  CircleDot,
  AlertCircle,
  Loader2,
  CheckCircle2,
  XCircle,
  Plus,
  MoreHorizontal,
} from 'lucide-react';
import {
  FailureCard,
  FailureCardOverlay,
  type FailureOccurrence,
} from './FailureCard';

// ── Column definitions ──

interface ColumnDef {
  status: string;
  label: string;
  description: string;
  icon: React.ElementType;
  iconColor: string;
  pillBg: string;
  pillBorder: string;
  dotColor: string;
}

const COLUMNS: ColumnDef[] = [
  {
    status: 'REPORTED',
    label: 'Reportada',
    description: 'Sin asignar',
    icon: CircleDot,
    iconColor: '#9CA3AF',
    pillBg: '#F3F4F6',
    pillBorder: '#E5E7EB',
    dotColor: '#9CA3AF',
  },
  {
    status: 'OPEN',
    label: 'Abierta',
    description: 'Asignada',
    icon: AlertCircle,
    iconColor: '#3B82F6',
    pillBg: '#EFF6FF',
    pillBorder: '#BFDBFE',
    dotColor: '#3B82F6',
  },
  {
    status: 'IN_PROGRESS',
    label: 'En Proceso',
    description: 'En curso',
    icon: Loader2,
    iconColor: '#7C3AED',
    pillBg: '#F5F3FF',
    pillBorder: '#DDD6FE',
    dotColor: '#7C3AED',
  },
  {
    status: 'RESOLVED',
    label: 'Resuelta',
    description: 'Finalizada',
    icon: CheckCircle2,
    iconColor: '#059669',
    pillBg: '#ECFDF5',
    pillBorder: '#A7F3D0',
    dotColor: '#059669',
  },
  {
    status: 'CANCELLED',
    label: 'Cancelada',
    description: 'Descartada',
    icon: XCircle,
    iconColor: '#9CA3AF',
    pillBg: '#F3F4F6',
    pillBorder: '#E5E7EB',
    dotColor: '#9CA3AF',
  },
];

// ── Props ──

interface FailuresBoardViewProps {
  failures: FailureOccurrence[];
  isLoading?: boolean;
  onSelectFailure?: (id: number) => void;
  onEditFailure?: (id: number) => void;
  onDeleteFailure?: (id: number) => void;
  onCreateWorkOrder?: (id: number) => void;
  onResolveFailure?: (id: number) => void;
  onLinkDuplicate?: (id: number) => void;
  onStatusChange?: (failureId: number, newStatus: string) => void;
  onCreateIncident?: () => void;
  canCreate?: boolean;
  canEdit?: boolean;
  canDelete?: boolean;
  selectionMode?: boolean;
  selectedIds?: number[];
  onToggleSelect?: (id: number) => void;
}

// ── Droppable Column ──

function BoardColumn({
  column,
  failures,
  total,
  isOver,
  onSelectFailure,
  onEditFailure,
  onDeleteFailure,
  onCreateWorkOrder,
  onResolveFailure,
  onLinkDuplicate,
  onStatusChange,
  onCreateIncident,
  canCreate,
  canEdit,
  canDelete,
  selectionMode,
  selectedIds,
  onToggleSelect,
  columnIndex,
}: {
  column: ColumnDef;
  failures: FailureOccurrence[];
  total: number;
  isOver: boolean;
  onSelectFailure?: (id: number) => void;
  onEditFailure?: (id: number) => void;
  onDeleteFailure?: (id: number) => void;
  onCreateWorkOrder?: (id: number) => void;
  onResolveFailure?: (id: number) => void;
  onLinkDuplicate?: (id: number) => void;
  onStatusChange?: (failureId: number, newStatus: string) => void;
  onCreateIncident?: () => void;
  canCreate?: boolean;
  canEdit?: boolean;
  canDelete?: boolean;
  selectionMode?: boolean;
  selectedIds?: number[];
  onToggleSelect?: (id: number) => void;
  columnIndex: number;
}) {
  const { setNodeRef } = useDroppable({ id: column.status });
  const Icon = column.icon;
  const pct = total > 0 ? Math.round((failures.length / total) * 100) : 0;

  return (
    <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column' }}>
      {/* Column Header — card style matching agenda BoardColumn */}
      <div
        style={{
          background: '#FFFFFF',
          border: '1px solid #EBEBEB',
          borderRadius: '10px',
          padding: '10px 12px',
          marginBottom: '8px',
          transition: 'border-color 120ms',
        }}
      >
        {/* Top row: badge + title/subtitle + count + actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
          {/* Colored badge with icon */}
          <div
            style={{
              width: '30px',
              height: '30px',
              borderRadius: '8px',
              background: column.pillBg,
              border: `1px solid ${column.pillBorder}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <Icon className="h-3.5 w-3.5" style={{ color: column.iconColor }} />
          </div>

          {/* Title + description */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{
              fontSize: '13px',
              fontWeight: 700,
              color: '#111827',
              lineHeight: 1.2,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}>
              {column.label}
            </p>
            <p style={{ fontSize: '11px', color: '#9CA3AF', marginTop: '1px' }}>
              {column.description}
            </p>
          </div>

          {/* Count */}
          <span style={{
            fontSize: '13px',
            fontWeight: 700,
            color: '#9CA3AF',
            flexShrink: 0,
          }}>
            {failures.length}
          </span>

          {/* Actions dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                style={{
                  height: 22,
                  width: 22,
                  borderRadius: 6,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: 'transparent',
                  border: 'none',
                  color: '#C8C8D0',
                  cursor: 'pointer',
                  transition: 'background 100ms ease',
                  flexShrink: 0,
                }}
                onMouseEnter={e => { e.currentTarget.style.background = '#F0F0F4'; e.currentTarget.style.color = '#6B7280'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#C8C8D0'; }}
              >
                <MoreHorizontal className="h-3 w-3" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {canCreate && onCreateIncident && (
                <DropdownMenuItem className="text-xs" onClick={() => onCreateIncident()}>
                  Crear incidente
                </DropdownMenuItem>
              )}
              {selectionMode && failures.length > 0 && (
                <DropdownMenuItem className="text-xs" onClick={() => failures.forEach(f => onToggleSelect?.(f.id))}>
                  Seleccionar todos ({failures.length})
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* + button */}
          {canCreate && onCreateIncident && (
            <button
              onClick={() => onCreateIncident()}
              style={{
                height: 22,
                width: 22,
                borderRadius: 6,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'transparent',
                border: 'none',
                color: '#C8C8D0',
                cursor: 'pointer',
                transition: 'background 100ms ease',
                flexShrink: 0,
              }}
              onMouseEnter={e => { e.currentTarget.style.background = '#F0F0F4'; e.currentTarget.style.color = '#111827'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#C8C8D0'; }}
            >
              <Plus className="h-3 w-3" strokeWidth={2.5} />
            </button>
          )}
        </div>

        {/* Progress bar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{
            flex: 1,
            height: '3px',
            borderRadius: '999px',
            background: '#F0F0F0',
            overflow: 'hidden',
          }}>
            <div style={{
              height: '100%',
              borderRadius: '999px',
              background: column.dotColor,
              width: `${pct}%`,
              transition: 'width 500ms ease',
            }} />
          </div>
          <span style={{
            fontSize: '10px',
            color: '#9CA3AF',
            fontWeight: 600,
            flexShrink: 0,
          }}>
            {pct}%
          </span>
        </div>
      </div>

      {/* Cards container */}
      <div
        ref={setNodeRef}
        style={{
          flex: 1,
          borderRadius: '12px',
          padding: '6px 4px',
          minHeight: '160px',
          background: isOver ? 'rgba(124, 58, 237, 0.04)' : 'transparent',
          border: isOver ? '2px dashed #7C3AED' : '2px solid transparent',
          display: 'flex',
          flexDirection: 'column',
          gap: '10px',
          transition: 'all 150ms ease',
        }}
      >
        <SortableContext
          items={failures.map(f => f.id)}
          strategy={verticalListSortingStrategy}
        >
          {failures.map((failure, cardIndex) => (
            <FailureCard
              key={failure.id}
              failure={failure}
              onSelect={onSelectFailure}
              onEdit={onEditFailure}
              onDelete={onDeleteFailure}
              onCreateWorkOrder={onCreateWorkOrder}
              onResolve={onResolveFailure}
              onLinkDuplicate={onLinkDuplicate}
              onStatusChange={onStatusChange}
              canCreate={canCreate}
              canEdit={canEdit}
              canDelete={canDelete}
              selectionMode={selectionMode}
              isSelected={selectedIds?.includes(failure.id)}
              onToggleSelect={onToggleSelect}
              animationDelay={(columnIndex + cardIndex) * 110}
            />
          ))}
        </SortableContext>

        {/* Empty state */}
        {failures.length === 0 && !isOver && (
          <button
            onClick={() => onCreateIncident?.()}
            style={{
              width: '100%',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '32px 0',
              borderRadius: '12px',
              border: '1.5px dashed #E5E7EB',
              background: 'transparent',
              cursor: canCreate ? 'pointer' : 'default',
              transition: 'background 120ms ease',
            }}
            onMouseEnter={e => { if (canCreate) e.currentTarget.style.background = '#F9FAFB'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
          >
            <Icon className="h-5 w-5 mb-2" style={{ color: column.iconColor, opacity: 0.3 }} />
            <p style={{ fontSize: '11px', color: '#9C9CAA' }}>
              {canCreate ? '+ Crear incidente' : 'Sin incidentes'}
            </p>
          </button>
        )}
      </div>
    </div>
  );
}

const EMPTY_IDS: number[] = [];
const COLUMN_STATUSES = new Set(COLUMNS.map(c => c.status));

// ── Board ──

export function FailuresBoardView({
  failures,
  isLoading = false,
  onSelectFailure,
  onEditFailure,
  onDeleteFailure,
  onCreateWorkOrder,
  onResolveFailure,
  onLinkDuplicate,
  onStatusChange,
  onCreateIncident,
  canCreate = true,
  canEdit = true,
  canDelete = false,
  selectionMode = false,
  selectedIds = EMPTY_IDS,
  onToggleSelect,
}: FailuresBoardViewProps) {
  const [activeDragFailure, setActiveDragFailure] = useState<FailureOccurrence | null>(null);
  const [overColumnId, setOverColumnId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  // Group failures by status
  const columnData = useMemo(() => {
    const grouped: Record<string, FailureOccurrence[]> = {};
    for (const col of COLUMNS) {
      grouped[col.status] = [];
    }
    for (const f of failures) {
      const status = f.status;
      if (grouped[status]) {
        grouped[status].push(f);
      } else {
        grouped['REPORTED']?.push(f);
      }
    }
    return grouped;
  }, [failures]);

  // O(1) lookup map for drag handlers
  const failureMap = useMemo(() => {
    const map = new Map<number | string, FailureOccurrence>();
    for (const f of failures) map.set(f.id, f);
    return map;
  }, [failures]);

  const handleDragStart = useCallback((event: DragStartEvent) => {
    const failure = failureMap.get(event.active.id as number);
    if (failure) setActiveDragFailure(failure);
  }, [failureMap]);

  const handleDragOver = useCallback((event: any) => {
    const overId = event.over?.id;
    if (!overId) {
      setOverColumnId(null);
      return;
    }
    if (COLUMN_STATUSES.has(overId as string)) {
      setOverColumnId(overId as string);
    } else {
      const card = failureMap.get(overId);
      if (card) setOverColumnId(card.status);
    }
  }, [failureMap]);

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    setActiveDragFailure(null);
    setOverColumnId(null);

    const { active, over } = event;
    if (!over) return;

    const failure = failureMap.get(active.id as number);
    if (!failure) return;

    let targetStatus: string | null = null;
    if (COLUMN_STATUSES.has(over.id as string)) {
      targetStatus = over.id as string;
    } else {
      const targetCard = failureMap.get(over.id as number);
      if (targetCard) targetStatus = targetCard.status;
    }

    if (targetStatus && targetStatus !== failure.status) {
      onStatusChange?.(failure.id, targetStatus);
    }
  }, [failureMap, onStatusChange]);

  const handleDragCancel = useCallback(() => {
    setActiveDragFailure(null);
    setOverColumnId(null);
  }, []);

  // Loading skeleton
  if (isLoading) {
    return (
      <div className="grid grid-cols-5 gap-4">
        {COLUMNS.map((col) => (
          <div key={col.status} className="space-y-2">
            <Skeleton className="h-[72px] w-full rounded-[10px]" />
            {[...Array(3)].map((_, i) => (
              <Skeleton key={i} className="h-32 w-full rounded-[10px]" />
            ))}
          </div>
        ))}
      </div>
    );
  }

  return (
    <>
    <style>{`
      @keyframes card-cascade-in {
        from { transform: translate(-10px, -10px); opacity: 0; }
        to   { transform: translate(0, 0);          opacity: 1; }
      }
      @keyframes card-new-in {
        0%   { opacity: 0; transform: translateY(-14px) scale(0.97); }
        100% { opacity: 1; transform: translateY(0)    scale(1);    }
      }
    `}</style>
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <div className="grid grid-cols-5 gap-4 overflow-x-auto min-w-[1300px]">
        {COLUMNS.map((col, colIndex) => (
          <BoardColumn
            key={col.status}
            column={col}
            failures={columnData[col.status] || []}
            total={failures.length}
            isOver={overColumnId === col.status}
            onSelectFailure={onSelectFailure}
            onEditFailure={onEditFailure}
            onDeleteFailure={onDeleteFailure}
            onCreateWorkOrder={onCreateWorkOrder}
            onResolveFailure={onResolveFailure}
            onLinkDuplicate={onLinkDuplicate}
            onStatusChange={onStatusChange}
            onCreateIncident={onCreateIncident}
            canCreate={canCreate}
            canEdit={canEdit}
            canDelete={canDelete}
            selectionMode={selectionMode}
            selectedIds={selectedIds}
            onToggleSelect={onToggleSelect}
            columnIndex={colIndex}
          />
        ))}
      </div>

      <DragOverlay>
        {activeDragFailure && (
          <FailureCardOverlay failure={activeDragFailure} />
        )}
      </DragOverlay>
    </DndContext>
    </>
  );
}
