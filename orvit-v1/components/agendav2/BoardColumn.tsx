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
  pillBg: string;
  pillText: string;
  iconColor: string;
}> = {
  PENDING: {
    label: 'To-do',
    icon: CircleDot,
    pillBg: '#F6F6F6',
    pillText: '#050505',
    iconColor: '#575456',
  },
  IN_PROGRESS: {
    label: 'In Progress',
    icon: Loader2,
    pillBg: '#D0E0F0',
    pillText: '#3070A8',
    iconColor: '#3070A8',
  },
  WAITING: {
    label: 'In Review',
    icon: Asterisk,
    pillBg: '#F9F0DB',
    pillText: '#907840',
    iconColor: '#907840',
  },
  COMPLETED: {
    label: 'Completed',
    icon: ClipboardCheck,
    pillBg: '#D0EFE0',
    pillText: '#568177',
    iconColor: '#568177',
  },
  CANCELLED: {
    label: 'Cancelled',
    icon: Circle,
    pillBg: '#F9E4E2',
    pillText: '#ED8A94',
    iconColor: '#ED8A94',
  },
};

interface BoardColumnProps {
  status: AgendaTaskStatus;
  tasks: AgendaTask[];
  onTaskClick: (task: AgendaTask) => void;
  onStatusChange: (task: AgendaTask, status: AgendaTaskStatus) => void;
  onDelete: (task: AgendaTask) => void;
  onCreateTask?: (status: AgendaTaskStatus) => void;
}

export function BoardColumn({ status, tasks, onTaskClick, onStatusChange, onDelete, onCreateTask }: BoardColumnProps) {
  const config = COLUMN_CONFIG[status];
  const Icon = config.icon;
  const { setNodeRef, isOver } = useDroppable({ id: status });

  return (
    <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column' }}>
      {/* Column Header */}
      <div className="flex items-center gap-1.5 mb-4 px-1">
        {/* Drag handle — always visible, subtle */}
        <GripVertical
          className="h-3 w-3 shrink-0 cursor-grab"
          style={{ color: '#C8C8D0' }}
        />
        {/* Status pill */}
        <div
          className="flex items-center gap-1.5 px-2.5 py-1"
          style={{
            background: config.pillBg,
            borderRadius: '999px',
          }}
        >
          <Icon className="h-3.5 w-3.5 shrink-0" style={{ color: config.iconColor }} />
          <span
            className="text-[12px]"
            style={{ fontWeight: 600, color: config.pillText, whiteSpace: 'nowrap' }}
          >
            {config.label}
          </span>
        </div>

        {/* Count */}
        <span className="text-[12px] font-bold" style={{ color: '#9C9CAA' }}>
          {tasks.length}
        </span>

        {/* Actions */}
        <div className="ml-auto flex items-center gap-0.5">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className="h-7 w-7 rounded-[10px] flex items-center justify-center transition-colors"
                style={{ color: '#9C9CAA' }}
                onMouseEnter={e => { e.currentTarget.style.background = '#F6F6F6'; e.currentTarget.style.color = '#575456'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#9C9CAA'; }}
              >
                <MoreHorizontal className="h-3.5 w-3.5" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem className="text-xs" onClick={() => onCreateTask?.(status)}>
                Agregar tarea
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <button
            onClick={() => onCreateTask?.(status)}
            className="h-7 w-7 rounded-[10px] flex items-center justify-center transition-colors"
            style={{ color: '#9C9CAA' }}
            onMouseEnter={e => { e.currentTarget.style.background = '#F6F6F6'; e.currentTarget.style.color = '#575456'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#9C9CAA'; }}
          >
            <Plus className="h-3.5 w-3.5" strokeWidth={2.5} />
          </button>
        </div>
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
          {tasks.map(task => (
            <TaskCard
              key={task.id}
              task={task}
              onClick={onTaskClick}
              onStatusChange={onStatusChange}
              onDelete={onDelete}
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
