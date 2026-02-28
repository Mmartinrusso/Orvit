'use client';

import { Plus, MoreHorizontal, CircleDot, Loader2, Asterisk, ClipboardCheck, Circle, GripVertical } from 'lucide-react';
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
  icon: typeof Circle;
  iconColor: string;
  pillBg: string;
  pillBorder: string;
  labelColor: string;
}> = {
  PENDING:     { label: 'Por hacer',    icon: CircleDot,      iconColor: '#8A8A98', pillBg: '#F2F2F4',  pillBorder: '#E0E0E6', labelColor: '#4A4A58' },
  IN_PROGRESS: { label: 'En progreso', icon: Loader2,        iconColor: '#5880A8', pillBg: '#EEF3F8',  pillBorder: '#CCDAE8', labelColor: '#3A5878' },
  WAITING:     { label: 'En revisión', icon: Asterisk,       iconColor: '#8A7840', pillBg: '#F5F2EA',  pillBorder: '#DED5B0', labelColor: '#685C30' },
  COMPLETED:   { label: 'Completado',  icon: ClipboardCheck, iconColor: '#508070', pillBg: '#EDF4F0',  pillBorder: '#C2D4C8', labelColor: '#305848' },
  CANCELLED:   { label: 'Cancelado',   icon: Circle,         iconColor: '#9A7070', pillBg: '#F5F0F0',  pillBorder: '#E0C8C8', labelColor: '#704848' },
};

interface BoardColumnProps {
  status: AgendaTaskStatus;
  tasks: AgendaTask[];
  onTaskClick: (task: AgendaTask) => void;
  onStatusChange: (task: AgendaTask, status: AgendaTaskStatus) => void;
  onDelete: (task: AgendaTask) => void;
  onEdit?: (task: AgendaTask) => void;
  onCreateTask?: (status: AgendaTaskStatus) => void;
  isSelectMode?: boolean;
  selectedIds?: Set<number>;
  onToggleSelect?: (id: number) => void;
  columnIndex?: number;
}

export function BoardColumn({ status, tasks, onTaskClick, onStatusChange, onDelete, onEdit, onCreateTask, isSelectMode, selectedIds, onToggleSelect, columnIndex = 0 }: BoardColumnProps) {
  const config = COLUMN_CONFIG[status];
  const Icon = config.icon;
  const { setNodeRef, isOver } = useDroppable({ id: status });

  return (
    <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column' }}>
      {/* Column Header — gray outer container */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          padding: '5px 6px 5px 8px',
          background: '#F2F2F2',
          borderRadius: '10px',
          marginBottom: '12px',
        }}
      >
        {/* Grip handle */}
        <GripVertical
          className="h-3.5 w-3.5 shrink-0 cursor-grab"
          style={{ color: '#B0B0BC' }}
        />

        {/* Inner colored pill — icon + label */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '5px',
            padding: '3px 9px',
            borderRadius: '7px',
            background: config.pillBg,
            border: `1px solid ${config.pillBorder}`,
          }}
        >
          <Icon className="h-3.5 w-3.5 shrink-0" style={{ color: config.iconColor }} />
          <span style={{ fontSize: '13px', fontWeight: 600, color: config.labelColor, whiteSpace: 'nowrap' }}>
            {config.label}
          </span>
        </div>

        {/* Count */}
        <span style={{ fontSize: '13px', fontWeight: 700, color: '#9C9CAA' }}>
          {tasks.length}
        </span>

        {/* Spacer */}
        <div style={{ flex: 1 }} />

        {/* Actions */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              style={{ height: 26, width: 26, borderRadius: 7, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'transparent', border: 'none', color: '#9C9CAA', cursor: 'pointer', transition: 'background 120ms ease' }}
              onMouseEnter={e => { e.currentTarget.style.background = '#E6E6E6'; e.currentTarget.style.color = '#575456'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#9C9CAA'; }}
            >
              <MoreHorizontal className="h-3.5 w-3.5" />
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
        <button
          onClick={() => onCreateTask?.(status)}
          style={{ height: 26, width: 26, borderRadius: 7, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'transparent', border: 'none', color: '#9C9CAA', cursor: 'pointer', transition: 'background 120ms ease' }}
          onMouseEnter={e => { e.currentTarget.style.background = '#E6E6E6'; e.currentTarget.style.color = '#575456'; }}
          onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#9C9CAA'; }}
        >
          <Plus className="h-3.5 w-3.5" strokeWidth={2.5} />
        </button>
      </div>

      {/* Cards container */}
      <div
        ref={setNodeRef}
        style={{
          flex: 1,
          borderRadius: '16px',
          padding: '10px',
          minHeight: '160px',
          background: isOver ? 'rgba(48, 112, 168, 0.04)' : '#FAFAFA',
          border: isOver ? '2px dashed #3070A8' : '1px solid transparent',
          display: 'flex',
          flexDirection: 'column',
          gap: '10px',
          transition: 'all 150ms ease',
        }}
      >
        <SortableContext items={tasks.map(t => t.id.toString())} strategy={verticalListSortingStrategy}>
          {tasks.map((task, cardIndex) => (
            <TaskCard
              key={task.id}
              task={task}
              onClick={onTaskClick}
              onStatusChange={onStatusChange}
              onDelete={onDelete}
              onEdit={onEdit}
              isSelectMode={isSelectMode}
              isSelected={selectedIds?.has(task.id)}
              onSelect={onToggleSelect}
              animationDelay={(columnIndex + cardIndex) * 110}
            />
          ))}
        </SortableContext>

        {/* Empty state */}
        {tasks.length === 0 && (
          <button
            onClick={() => onCreateTask?.(status)}
            className="w-full flex flex-col items-center justify-center py-8 text-center transition-colors"
            style={{
              borderRadius: '12px',
              border: '1.5px dashed #E4E4E4',
              background: 'transparent',
            }}
            onMouseEnter={e => (e.currentTarget.style.background = '#F6F6F6')}
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
