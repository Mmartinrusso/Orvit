'use client';

import { useState, useMemo } from 'react';
import { LayoutGrid, AlignJustify, BarChart2, Filter } from 'lucide-react';
import { BoardColumn } from './BoardColumn';
import { TaskCalendarStrip } from './TaskCalendarStrip';
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

import { format, parseISO } from 'date-fns';
import type { AgendaTask, AgendaTaskStatus } from '@/lib/agenda/types';
import { toast } from 'sonner';

const BOARD_COLUMNS: AgendaTaskStatus[] = ['PENDING', 'IN_PROGRESS', 'WAITING', 'COMPLETED'];

interface BoardViewProps {
  tasks: AgendaTask[];
  onTaskClick: (task: AgendaTask) => void;
  onTaskStatusChange: (taskId: number, status: AgendaTaskStatus) => Promise<void>;
  onTaskDelete: (task: AgendaTask) => void;
  onCreateTask: (status: AgendaTaskStatus) => void;
  isLoading: boolean;
}

export function BoardView({
  tasks,
  onTaskClick,
  onTaskStatusChange,
  onTaskDelete,
  onCreateTask,
  isLoading,
}: BoardViewProps) {
  const [activeDragTask, setActiveDragTask] = useState<AgendaTask | null>(null);
  const [hoveredDate, setHoveredDate] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    })
  );

  // Filter tasks when a calendar date is hovered
  const visibleTasks = useMemo(() => {
    if (!hoveredDate) return tasks;
    return tasks.filter(t => {
      if (!t.dueDate) return false;
      return format(parseISO(t.dueDate), 'yyyy-MM-dd') === hoveredDate;
    });
  }, [tasks, hoveredDate]);

  const tasksByStatus = useMemo(() => {
    const map: Record<AgendaTaskStatus, AgendaTask[]> = {
      PENDING: [],
      IN_PROGRESS: [],
      WAITING: [],
      COMPLETED: [],
      CANCELLED: [],
    };
    visibleTasks.forEach(task => {
      if (map[task.status]) {
        map[task.status].push(task);
      }
    });
    return map;
  }, [visibleTasks]);

  function handleDragStart(event: DragStartEvent) {
    const taskId = Number(event.active.id);
    const task = tasks.find(t => t.id === taskId);
    if (task) setActiveDragTask(task);
  }

  async function handleDragEnd(event: DragEndEvent) {
    setActiveDragTask(null);
    const { active, over } = event;
    if (!over) return;

    const taskId = Number(active.id);
    const overId = over.id as string;

    // If dropped on a column
    const targetStatus = BOARD_COLUMNS.find(s => s === overId) as AgendaTaskStatus | undefined;
    if (targetStatus) {
      const task = tasks.find(t => t.id === taskId);
      if (task && task.status !== targetStatus) {
        try {
          await onTaskStatusChange(taskId, targetStatus);
        } catch {
          toast.error('Error al mover la tarea');
        }
      }
      return;
    }

    // If dropped on another task (find its status)
    const overTask = tasks.find(t => t.id === Number(overId));
    if (overTask) {
      const task = tasks.find(t => t.id === taskId);
      if (task && task.status !== overTask.status) {
        try {
          await onTaskStatusChange(taskId, overTask.status);
        } catch {
          toast.error('Error al mover la tarea');
        }
      }
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        {/* Calendar skeleton */}
        <div className="bg-muted/30 rounded-xl h-32 animate-pulse" />
        {/* Board skeleton */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px' }}>
          {BOARD_COLUMNS.map(col => (
            <div key={col} className="space-y-2">
              <div className="h-8 bg-muted/40 rounded-lg animate-pulse" />
              {[1, 2, 3].map(i => (
                <div key={i} className="h-28 bg-muted/30 rounded-lg animate-pulse" />
              ))}
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Task Calendar Strip — hover a date to filter board below */}
      <TaskCalendarStrip tasks={tasks} onTaskClick={onTaskClick} onHoverDate={setHoveredDate} />

      {/* All Task section header — matches Synchro layout */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: '17px', fontWeight: 700, color: '#050505' }}>
          All Task
          {hoveredDate && (
            <span style={{ fontSize: '12px', fontWeight: 500, color: '#9C9CAA', marginLeft: '10px' }}>
              — {format(parseISO(hoveredDate), 'd MMM yyyy')}
            </span>
          )}
        </span>

        {/* View switcher — flat inline buttons with text labels */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0', border: '1px solid #E4E4E4', borderRadius: '10px', overflow: 'hidden', background: '#FFFFFF' }}>
          {/* Spreadsheet (disabled) */}
          <button disabled style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '7px 14px', border: 'none', borderRight: '1px solid #E4E4E4', background: 'transparent', color: '#C0C0C8', cursor: 'not-allowed', fontSize: '12px', fontWeight: 500 }}>
            <AlignJustify className="h-3.5 w-3.5" />
            Spreadsheet
          </button>
          {/* Timeline (disabled) */}
          <button disabled style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '7px 14px', border: 'none', borderRight: '1px solid #E4E4E4', background: 'transparent', color: '#C0C0C8', cursor: 'not-allowed', fontSize: '12px', fontWeight: 500 }}>
            <BarChart2 className="h-3.5 w-3.5" />
            Timeline
          </button>
          {/* Kanban (active) */}
          <button style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '7px 14px', border: 'none', borderRight: '1px solid #E4E4E4', background: '#F6F6F6', color: '#050505', cursor: 'default', fontSize: '12px', fontWeight: 600 }}>
            <LayoutGrid className="h-3.5 w-3.5" />
            Kanban
          </button>
          {/* Filter */}
          <button
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '7px 12px', border: 'none', background: 'transparent', color: '#9C9CAA', cursor: 'pointer' }}
            onMouseEnter={e => { e.currentTarget.style.background = '#F6F6F6'; e.currentTarget.style.color = '#575456'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#9C9CAA'; }}
          >
            <Filter className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Kanban board */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', alignItems: 'start' }}>
          {BOARD_COLUMNS.map(status => (
            <BoardColumn
              key={status}
              status={status}
              tasks={tasksByStatus[status]}
              onTaskClick={onTaskClick}
              onStatusChange={(task, newStatus) => onTaskStatusChange(task.id, newStatus)}
              onDelete={onTaskDelete}
              onCreateTask={onCreateTask}
            />
          ))}
        </div>

        <DragOverlay>
          {activeDragTask ? (
            <div className="opacity-90 rotate-2 scale-105">
              <div className="bg-card border border-border rounded-lg p-3 shadow-xl w-72">
                <p className="text-xs font-semibold text-foreground mb-1">
                  {activeDragTask.category || 'Sin categoría'}
                </p>
                <p className="text-sm text-foreground">{activeDragTask.title}</p>
              </div>
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
}
