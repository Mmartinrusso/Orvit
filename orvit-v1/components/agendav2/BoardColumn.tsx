'use client';

import { Plus, MoreHorizontal, CircleDot, Loader2, Asterisk, ClipboardCheck, Circle } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { TaskCard } from './TaskCard';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import type { AgendaTask, AgendaTaskStatus } from '@/lib/agenda/types';

const COLUMN_CONFIG: Record<AgendaTaskStatus, {
  label: string;
  short: string;
  description: string;
  icon: typeof Circle;
  iconColor: string;
  pillBg: string;
  pillBorder: string;
  labelColor: string;
  dotColor: string;
}> = {
  PENDING:     { label: 'Por hacer',   short: '○', description: 'Sin empezar',    icon: CircleDot,      iconColor: '#9CA3AF', pillBg: '#F3F4F6',  pillBorder: '#E5E7EB', labelColor: '#6B7280', dotColor: '#9CA3AF' },
  IN_PROGRESS: { label: 'En progreso', short: '◐', description: 'En curso',       icon: Loader2,        iconColor: '#7C3AED', pillBg: '#F5F3FF',  pillBorder: '#DDD6FE', labelColor: '#5B21B6', dotColor: '#7C3AED' },
  WAITING:     { label: 'En revisión', short: '★', description: 'Aguardando ok',  icon: Asterisk,       iconColor: '#D97706', pillBg: '#FFFBEB',  pillBorder: '#FDE68A', labelColor: '#92400E', dotColor: '#D97706' },
  COMPLETED:   { label: 'Completado',  short: '✓', description: 'Finalizado',     icon: ClipboardCheck, iconColor: '#059669', pillBg: '#ECFDF5',  pillBorder: '#A7F3D0', labelColor: '#065F46', dotColor: '#059669' },
  CANCELLED:   { label: 'Cancelado',   short: '✕', description: 'Descartado',     icon: Circle,         iconColor: '#9CA3AF', pillBg: '#F3F4F6',  pillBorder: '#E5E7EB', labelColor: '#6B7280', dotColor: '#9CA3AF' },
};

interface BoardColumnProps {
  status: AgendaTaskStatus;
  tasks: AgendaTask[];
  onTaskClick: (task: AgendaTask) => void;
  onStatusChange: (task: AgendaTask, status: AgendaTaskStatus) => void;
  onDelete: (task: AgendaTask) => void;
  onEdit?: (task: AgendaTask) => void;
  onDuplicate?: (task: AgendaTask) => Promise<void>;
  onCreateTask?: (status: AgendaTaskStatus) => void;
  isSelectMode?: boolean;
  selectedIds?: Set<number>;
  onToggleSelect?: (id: number) => void;
  columnIndex?: number;
  deletingIds?: Set<number>;
  newestTaskId?: number | null;
}

export function BoardColumn({ status, tasks, onTaskClick, onStatusChange, onDelete, onEdit, onDuplicate, onCreateTask, isSelectMode, selectedIds, onToggleSelect, columnIndex = 0, deletingIds, newestTaskId }: BoardColumnProps) {
  const config = COLUMN_CONFIG[status];
  const Icon = config.icon;
  const { setNodeRef, isOver } = useDroppable({ id: status });

  // Progress: COMPLETED column = 100%, others = 0%
  const progress = status === 'COMPLETED' ? (tasks.length > 0 ? 100 : 0) : 0;

  return (
    <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column' }}>
      {/* Column Header — card style (matching FixedTasksView frequency columns) */}
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
          {/* Colored badge with short symbol */}
          <div
            style={{
              width: '30px', height: '30px', borderRadius: '8px',
              background: config.pillBg, border: `1px solid ${config.pillBorder}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}
          >
            <Icon className="h-3.5 w-3.5" style={{ color: config.iconColor }} />
          </div>

          {/* Title + description */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontSize: '13px', fontWeight: 700, color: '#111827', lineHeight: 1.2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {config.label}
            </p>
            <p style={{ fontSize: '11px', color: '#9CA3AF', marginTop: '1px' }}>{config.description}</p>
          </div>

          {/* Count */}
          <span style={{ fontSize: '13px', fontWeight: 700, color: '#9CA3AF', flexShrink: 0 }}>
            {tasks.length}
          </span>

          {/* Actions dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                style={{ height: 22, width: 22, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'transparent', border: 'none', color: '#C8C8D0', cursor: 'pointer', transition: 'background 100ms ease', flexShrink: 0 }}
                onMouseEnter={e => { e.currentTarget.style.background = '#F0F0F4'; e.currentTarget.style.color = '#6B7280'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#C8C8D0'; }}
              >
                <MoreHorizontal className="h-3 w-3" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem className="text-xs" onClick={() => onCreateTask?.(status)}>
                Agregar tarea
              </DropdownMenuItem>
              {isSelectMode && tasks.length > 0 && (
                <DropdownMenuItem className="text-xs" onClick={() => tasks.forEach(t => onToggleSelect?.(t.id))}>
                  Seleccionar todos ({tasks.length})
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* + button */}
          <button
            onClick={() => onCreateTask?.(status)}
            style={{ height: 22, width: 22, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'transparent', border: 'none', color: '#C8C8D0', cursor: 'pointer', transition: 'background 100ms ease', flexShrink: 0 }}
            onMouseEnter={e => { e.currentTarget.style.background = '#F0F0F4'; e.currentTarget.style.color = '#111827'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#C8C8D0'; }}
          >
            <Plus className="h-3 w-3" strokeWidth={2.5} />
          </button>
        </div>

        {/* Progress bar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{ flex: 1, height: '3px', borderRadius: '999px', background: '#F0F0F0', overflow: 'hidden' }}>
            <div style={{ height: '100%', borderRadius: '999px', background: config.dotColor, width: `${progress}%`, transition: 'width 500ms ease' }} />
          </div>
          <span style={{ fontSize: '10px', color: '#9CA3AF', fontWeight: 600, flexShrink: 0 }}>{progress}%</span>
        </div>
      </div>

      {/* Cards container */}
      <style>{`
        @keyframes card-delete-out {
          0%   { opacity: 1; transform: translateX(0)    scale(1);    }
          100% { opacity: 0; transform: translateX(28px) scale(0.94); }
        }
      `}</style>
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
        <SortableContext items={tasks.map(t => t.id.toString())} strategy={verticalListSortingStrategy}>
          {tasks.map((task, cardIndex) => {
            const isDeleting = deletingIds?.has(task.id) ?? false;
            const isNew = newestTaskId === task.id;
            return (
              <div
                key={task.id}
                style={{
                  animation: isDeleting
                    ? 'card-delete-out 300ms cubic-bezier(0.4,0,1,1) forwards'
                    : undefined,
                  pointerEvents: isDeleting ? 'none' : undefined,
                }}
              >
                <TaskCard
                  task={task}
                  onClick={onTaskClick}
                  onStatusChange={onStatusChange}
                  onDelete={onDelete}
                  onEdit={onEdit}
                  onDuplicate={onDuplicate}
                  isSelectMode={isSelectMode}
                  isSelected={selectedIds?.has(task.id)}
                  onSelect={onToggleSelect}
                  animationDelay={isNew ? 0 : (columnIndex + cardIndex) * 110}
                  isNew={isNew}
                />
              </div>
            );
          })}
        </SortableContext>

        {/* Empty state */}
        {tasks.length === 0 && (
          <button
            onClick={() => onCreateTask?.(status)}
            className="w-full flex flex-col items-center justify-center py-8 text-center transition-colors"
            style={{
              borderRadius: '12px',
              border: '1.5px dashed #E5E7EB',
              background: 'transparent',
            }}
            onMouseEnter={e => (e.currentTarget.style.background = '#F9FAFB')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
          >
            <Icon className="h-5 w-5 mb-2 opacity-30" style={{ color: config.iconColor }} />
            <p style={{ fontSize: '11px', color: '#9C9CAA' }}>+ Agregar tarea</p>
          </button>
        )}
      </div>
    </div>
  );
}
