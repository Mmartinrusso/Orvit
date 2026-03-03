'use client';

/**
 * FixedTasksView — Tareas Fijas en AgendaV2
 *
 * Kanban por frecuencia (diaria → anual) con diseño Synchro:
 * colores, cards, animaciones, filtros y DnD entre columnas.
 */

import React, { useState, useMemo, useRef, useEffect } from 'react';
import { format, isPast } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  Clock, FileText, Calendar, Play, Edit2, Trash2,
  Plus, Search, X, CheckCircle2, RotateCcw, Repeat,
  SlidersHorizontal, BarChart3,
} from 'lucide-react';
import { toast } from 'sonner';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  DndContext, DragEndEvent, DragStartEvent, DragOverlay,
  closestCenter, PointerSensor, useSensor, useSensors,
} from '@dnd-kit/core';
import { snapCenterToCursor } from '@dnd-kit/modifiers';
import { SortableContext, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { useDroppable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { useFixedTasks } from '@/hooks/use-fixed-tasks';
import { FixedTasksViewSkeleton } from './TaskCardSkeleton';
import { FixedTaskFormSheet } from './FixedTaskFormSheet';
import { FixedTaskDetailSheet } from './FixedTaskDetailSheet';
import { TaskExecutionModal } from '@/components/tasks/task-execution-modal';
import { useAuth } from '@/contexts/AuthContext';

// ── Types ─────────────────────────────────────────────────────────────────────

interface FixedTask {
  id: string;
  title: string;
  description: string;
  frequency: 'diaria' | 'semanal' | 'quincenal' | 'mensual' | 'trimestral' | 'semestral' | 'anual';
  assignedTo: { id: string; name: string };
  department: string;
  instructives: { id: string; title: string; content: string; attachments?: string[] }[];
  estimatedTime: number;
  priority: 'baja' | 'media' | 'alta';
  isActive: boolean;
  executionTime?: string;
  lastExecuted?: string;
  nextExecution: string;
  createdAt: string;
  completedAt?: string;
  isCompleted?: boolean;
}

interface ExecutionData {
  actualTime: number;
  notes: string;
  attachments: File[];
  executedBy: string;
  completedAt: string;
}

// ── Design tokens ─────────────────────────────────────────────────────────────

const PRIORITY_CHIP = {
  baja:  { bg: '#F3F4F6', text: '#6B7280', label: 'Baja' },
  media: { bg: '#EFF6FF', text: '#1D4ED8', label: 'Media' },
  alta:  { bg: '#FEF3C7', text: '#D97706', label: 'Alta' },
};

const FREQ_COLUMNS: {
  key: FixedTask['frequency'];
  title: string;
  shortTitle: string;
  description: string;
  pillBg: string;
  pillBorder: string;
  labelColor: string;
  iconColor: string;
  dotColor: string;
}[] = [
  { key: 'diaria',     title: 'Diarias',      shortTitle: 'D',  description: 'Cada día',      pillBg: '#EDF4F0', pillBorder: '#C2D4C8', labelColor: '#305848', iconColor: '#508070', dotColor: '#508070' },
  { key: 'semanal',    title: 'Semanales',    shortTitle: 'S',  description: 'Cada semana',   pillBg: '#EEF3F8', pillBorder: '#CCDAE8', labelColor: '#3A5878', iconColor: '#5880A8', dotColor: '#5880A8' },
  { key: 'quincenal',  title: 'Quincenales',  shortTitle: 'Q',  description: 'Cada 15 días', pillBg: '#F5F2EA', pillBorder: '#DED5B0', labelColor: '#685C30', iconColor: '#8A7840', dotColor: '#8A7840' },
  { key: 'mensual',    title: 'Mensuales',    shortTitle: 'M',  description: 'Cada mes',      pillBg: '#F3EFF8', pillBorder: '#D8CBE8', labelColor: '#584878', iconColor: '#806898', dotColor: '#806898' },
  { key: 'trimestral', title: 'Trimestrales', shortTitle: 'T',  description: 'Cada 3 meses', pillBg: '#FAF0EB', pillBorder: '#E8D0C0', labelColor: '#784838', iconColor: '#A86848', dotColor: '#A86848' },
  { key: 'semestral',  title: 'Semestrales',  shortTitle: 'Se', description: 'Cada 6 meses', pillBg: '#EBF4F4', pillBorder: '#B8D8D8', labelColor: '#305858', iconColor: '#508080', dotColor: '#508080' },
  { key: 'anual',      title: 'Anuales',      shortTitle: 'A',  description: 'Cada año',      pillBg: '#F0EEF8', pillBorder: '#C8C4D8', labelColor: '#484858', iconColor: '#686878', dotColor: '#686878' },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatTime(minutes: number): string {
  if (minutes < 60) return `${minutes}min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}min` : `${h}h`;
}

function getInitials(name: string) {
  return name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase();
}

// ── Drag ghost card (shown in DragOverlay) ────────────────────────────────────

function DragGhostCard({ task }: { task: FixedTask }) {
  const prio = PRIORITY_CHIP[task.priority];
  const col  = FREQ_COLUMNS.find(c => c.key === task.frequency);
  return (
    <div style={{
      width: '300px', padding: '16px 18px', borderRadius: '8px',
      background: '#FFFFFF', border: '1.5px solid #7C3AED',
      boxShadow: '0 12px 32px rgba(0,0,0,.18)',
      opacity: 0.95, transform: 'rotate(1.5deg)',
      cursor: 'grabbing',
    }}>
      {col && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '6px' }}>
          <span style={{ width: '14px', height: '14px', borderRadius: '4px', background: col.iconColor, color: '#FFF', fontSize: '7px', fontWeight: 800, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
            {col.shortTitle}
          </span>
          <span style={{ fontSize: '10px', fontWeight: 600, color: col.labelColor }}>{col.title}</span>
        </div>
      )}
      <p className="line-clamp-2" style={{ fontSize: '13px', fontWeight: 600, color: '#111827', marginBottom: '8px', lineHeight: 1.4 }}>
        {task.title}
      </p>
      <span style={{ fontSize: '12px', fontWeight: 500, padding: '3px 10px', borderRadius: '999px', background: prio.bg, color: prio.text }}>
        {prio.label}
      </span>
    </div>
  );
}

// ── KPI Card ──────────────────────────────────────────────────────────────────

function KpiCard({ label, value, accent, icon: Icon }: { label: string; value: string; accent: string; icon: React.ElementType }) {
  return (
    <div style={{
      flex: '1 1 120px',
      background: '#FFFFFF',
      border: '1px solid #EBEBEB',
      borderRadius: '12px',
      padding: '16px 18px',
      boxShadow: '0 1px 3px rgba(0,0,0,.04)',
      animation: 'kpi-in 200ms ease both',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
        <p style={{ fontSize: '11px', fontWeight: 600, color: '#9CA3AF', letterSpacing: '0.05em', textTransform: 'uppercase' }}>{label}</p>
        <Icon className="h-4 w-4" style={{ color: '#D1D5DB' }} />
      </div>
      <p style={{ fontSize: '28px', fontWeight: 700, color: accent, lineHeight: 1 }}>{value}</p>
    </div>
  );
}

// ── FixedTaskCard (sortable) ──────────────────────────────────────────────────

function FixedTaskCard({
  task, colIndex, cardIndex, onClick, onEdit, onDelete, onExecute, currentUserId,
}: {
  task: FixedTask;
  colIndex: number;
  cardIndex: number;
  onClick: (t: FixedTask) => void;
  onEdit: (t: FixedTask) => void;
  onDelete: (id: string) => void;
  onExecute: (t: FixedTask) => void;
  currentUserId?: string;
}) {
  const [hovered, setHovered] = useState(false);
  const priorityConf = PRIORITY_CHIP[task.priority] ?? PRIORITY_CHIP.media;
  const isOverdue    = !task.isCompleted && isPast(new Date(task.nextExecution));
  const canExecute   = !task.isCompleted && task.isActive && String(task.assignedTo.id) === String(currentUserId);

  // ── DnD (single-div pattern — no wrapper) ──
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id });

  return (
    <div
      ref={setNodeRef}
      onClick={() => onClick(task)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        // DnD transform (must be first so visual styles can override if needed)
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.3 : 1,
        // Visual styles
        position: 'relative',
        background: task.isCompleted ? '#FAFAFA' : '#FFFFFF',
        border: `1.5px solid ${hovered && !task.isCompleted && !isDragging ? '#D8D8E0' : '#D8D8DE'}`,
        borderRadius: '8px',
        padding: '16px 18px',
        cursor: isDragging ? 'grabbing' : 'pointer',
        userSelect: 'none',
        boxShadow: hovered && !task.isCompleted && !isDragging
          ? '0 2px 8px rgba(0,0,0,.08), 0 8px 28px rgba(0,0,0,.10)'
          : '0 1px 3px rgba(0,0,0,.06), 0 4px 16px rgba(0,0,0,.07)',
        animation: isDragging ? 'none' : 'ftcard-in 180ms ease both',
        animationDelay: isDragging ? '0ms' : `${cardIndex * 30}ms`,
        zIndex: isDragging ? 5 : undefined,
      }}
      {...attributes}
      {...listeners}
    >
        {/* Hover action buttons */}
        <div
          style={{ position: 'absolute', top: '10px', right: '10px', display: 'flex', gap: '2px', opacity: hovered && !isDragging ? 1 : 0, transition: 'opacity 120ms ease' }}
          onClick={e => e.stopPropagation()}
          onPointerDown={e => e.stopPropagation()}
        >
          {canExecute && (
            <button
              onClick={() => onExecute(task)}
              title="Ejecutar"
              style={{ height: '22px', width: '22px', borderRadius: '6px', border: 'none', background: '#EDE9FE', color: '#7C3AED', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'background 100ms ease' }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = '#7C3AED'; (e.currentTarget as HTMLButtonElement).style.color = '#FFF'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = '#EDE9FE'; (e.currentTarget as HTMLButtonElement).style.color = '#7C3AED'; }}
            >
              <Play className="h-2.5 w-2.5" />
            </button>
          )}
          <button
            onClick={() => onEdit(task)}
            title="Editar"
            style={{ height: '22px', width: '22px', borderRadius: '6px', border: 'none', background: '#F0F0F0', color: '#9CA3AF', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'background 100ms ease' }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = '#E0E0E0'; (e.currentTarget as HTMLButtonElement).style.color = '#6B7280'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = '#F0F0F0'; (e.currentTarget as HTMLButtonElement).style.color = '#9CA3AF'; }}
          >
            <Edit2 className="h-2.5 w-2.5" />
          </button>
          <button
            onClick={() => onDelete(task.id)}
            title="Eliminar"
            style={{ height: '22px', width: '22px', borderRadius: '6px', border: 'none', background: '#F0F0F0', color: '#9CA3AF', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'background 100ms ease' }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = '#FEE2E2'; (e.currentTarget as HTMLButtonElement).style.color = '#DC2626'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = '#F0F0F0'; (e.currentTarget as HTMLButtonElement).style.color = '#9CA3AF'; }}
          >
            <Trash2 className="h-2.5 w-2.5" />
          </button>
        </div>

        {/* Status badges */}
        {task.isCompleted && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '8px' }}>
            <CheckCircle2 className="h-3 w-3" style={{ color: '#508070' }} />
            <span style={{ fontSize: '12px', fontWeight: 600, color: '#508070' }}>Completada</span>
          </div>
        )}
        {!task.isActive && !task.isCompleted && (
          <div style={{ marginBottom: '8px' }}>
            <span style={{ fontSize: '12px', fontWeight: 500, padding: '2px 10px', borderRadius: '999px', background: '#FEE2E2', color: '#DC2626' }}>Inactiva</span>
          </div>
        )}

        {/* Title */}
        <p className="line-clamp-2" style={{ fontSize: '18px', fontWeight: 600, color: task.isCompleted ? '#9CA3AF' : '#111827', textDecoration: task.isCompleted ? 'line-through' : 'none', lineHeight: 1.3, letterSpacing: '-0.02em', marginBottom: '6px', paddingRight: hovered ? '60px' : '0', transition: 'padding 120ms ease' }}>
          {task.title}
        </p>

        {/* Description */}
        <p className="line-clamp-2" style={{ fontSize: '13px', color: '#6B7280', lineHeight: '20px', marginBottom: '12px' }}>
          {task.description}
        </p>

        {/* Assignee box */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 10px', background: '#F9FAFB', borderRadius: '8px', marginBottom: '12px', border: '1px solid #F3F4F6' }}>
          <Avatar style={{ height: '26px', width: '26px', flexShrink: 0 }}>
            <AvatarFallback style={{ background: '#EDE9FE', color: '#7C3AED', fontSize: '8px', fontWeight: 700 }}>
              {getInitials(task.assignedTo.name)}
            </AvatarFallback>
          </Avatar>
          <div style={{ minWidth: 0 }}>
            <p style={{ fontSize: '13px', fontWeight: 500, color: '#111827', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{task.assignedTo.name}</p>
            <p style={{ fontSize: '11px', color: '#9CA3AF' }}>{task.department}</p>
          </div>
        </div>

        {/* Meta row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '10px' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', color: '#9CA3AF' }}>
            <Clock className="h-3 w-3" />{task.executionTime ?? formatTime(task.estimatedTime)}
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', color: '#9CA3AF' }}>
            <FileText className="h-3 w-3" />{task.instructives.length}
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', color: isOverdue ? '#DC2626' : '#9CA3AF' }}>
            <Calendar className="h-3 w-3" />{format(new Date(task.nextExecution), 'd MMM', { locale: es })}
          </span>
        </div>

        {/* Reset info */}
        {task.isCompleted && task.completedAt && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 10px', background: '#F3F4F6', borderRadius: '8px', marginBottom: '12px' }}>
            <RotateCcw className="h-3 w-3 shrink-0" style={{ color: '#9CA3AF' }} />
            <span style={{ fontSize: '12px', color: '#6B7280' }}>
              Reinicio: {format(new Date(task.nextExecution), "d 'de' MMM", { locale: es })}
            </span>
          </div>
        )}

        {/* Footer */}
        <div style={{ borderTop: '1px solid #E4E4E8', paddingTop: '10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: '12px', fontWeight: 500, padding: '3px 10px', borderRadius: '999px', background: priorityConf.bg, color: priorityConf.text }}>
            {priorityConf.label}
          </span>
          {isOverdue && !task.isCompleted && (
            <span style={{ fontSize: '12px', fontWeight: 600, color: '#DC2626' }}>Vencida</span>
          )}
        </div>
    </div>
  );
}

// ── Droppable Column ──────────────────────────────────────────────────────────

function DroppableCol({
  col, colIdx, tasks, onTaskClick, onEditTask, onDeleteTask, onExecuteTask, onCreateTask, currentUserId,
}: {
  col: typeof FREQ_COLUMNS[number];
  colIdx: number;
  tasks: FixedTask[];
  onTaskClick: (t: FixedTask) => void;
  onEditTask: (t: FixedTask) => void;
  onDeleteTask: (id: string) => void;
  onExecuteTask: (t: FixedTask) => void;
  onCreateTask: (freq: string) => void;
  currentUserId?: string;
}) {
  const doneCount = tasks.filter(t => t.isCompleted).length;
  const progress  = tasks.length > 0 ? Math.round((doneCount / tasks.length) * 100) : 0;
  const { setNodeRef, isOver } = useDroppable({ id: col.key });

  return (
    <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column' }}>
      {/* Column header card */}
      <div style={{
        background: '#FFFFFF',
        border: `1px solid ${isOver ? col.pillBorder : '#EBEBEB'}`,
        borderRadius: '10px',
        padding: '10px 12px',
        marginBottom: '8px',
        transition: 'border-color 120ms ease',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: tasks.length > 0 ? '10px' : '0' }}>
          {/* Letter badge */}
          <div style={{
            width: '30px', height: '30px', borderRadius: '8px',
            background: col.pillBg, border: `1px solid ${col.pillBorder}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}>
            <span style={{ fontSize: '12px', fontWeight: 800, color: col.labelColor }}>{col.shortTitle}</span>
          </div>
          {/* Title + subtitle */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontSize: '13px', fontWeight: 700, color: '#111827', lineHeight: 1.2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{col.title}</p>
            <p style={{ fontSize: '11px', color: '#9CA3AF', marginTop: '1px' }}>{col.description}</p>
          </div>
          {/* Count */}
          <span style={{ fontSize: '13px', fontWeight: 700, color: '#9CA3AF', flexShrink: 0 }}>{tasks.length}</span>
          {/* Plus */}
          <button
            onClick={() => onCreateTask(col.key)}
            style={{ height: 22, width: 22, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'transparent', border: 'none', color: '#C8C8D0', cursor: 'pointer', transition: 'all 100ms ease', flexShrink: 0 }}
            onMouseEnter={e => { e.currentTarget.style.background = col.pillBg; e.currentTarget.style.color = col.labelColor; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#C8C8D0'; }}
          >
            <Plus className="h-3 w-3" strokeWidth={2.5} />
          </button>
        </div>
        {/* Progress bar */}
        {tasks.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ flex: 1, height: '3px', borderRadius: '999px', background: '#F0F0F0', overflow: 'hidden' }}>
              <div style={{ height: '100%', borderRadius: '999px', background: col.dotColor, width: `${progress}%`, transition: 'width 500ms ease' }} />
            </div>
            <span style={{ fontSize: '10px', color: '#9CA3AF', fontWeight: 600, flexShrink: 0 }}>{progress}%</span>
          </div>
        )}
      </div>

      {/* Droppable area */}
      <div
        ref={setNodeRef}
        style={{
          flex: 1,
          borderRadius: '12px',
          border: isOver ? '2px dashed #7C3AED' : '2px solid transparent',
          background: isOver ? 'rgba(124,58,237,0.03)' : 'transparent',
          transition: 'border-color 120ms ease, background 120ms ease',
          minHeight: '80px',
        }}
      >
        <ScrollArea style={{ maxHeight: 'calc(100vh - 340px)', minHeight: '200px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', padding: '4px' }}>
            <SortableContext items={tasks.map(t => t.id)} strategy={verticalListSortingStrategy}>
              {tasks.map((task, cardIdx) => (
                <FixedTaskCard
                  key={task.id}
                  task={task}
                  colIndex={colIdx}
                  cardIndex={cardIdx}
                  onClick={onTaskClick}
                  onEdit={onEditTask}
                  onDelete={onDeleteTask}
                  onExecute={onExecuteTask}
                  currentUserId={currentUserId}
                />
              ))}
            </SortableContext>

            {/* Empty state */}
            {tasks.length === 0 && (
              <button
                onClick={() => onCreateTask(col.key)}
                style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '32px 12px', borderRadius: '10px', border: `1.5px dashed ${isOver ? '#7C3AED' : '#E5E7EB'}`, background: 'transparent', cursor: 'pointer', transition: 'background 120ms ease, border-color 120ms ease' }}
                onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = '#F4F4F6'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; }}
              >
                <span style={{ fontSize: '13px', color: '#9CA3AF' }}>+ Agregar tarea</span>
              </button>
            )}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}

// ── FixedTasksView ────────────────────────────────────────────────────────────

export function FixedTasksView() {
  const { tasks, loading, createTask, updateTask, completeTask, deleteTask, refetch } = useFixedTasks();
  const { user } = useAuth();

  // ── Filters ────────────────────────────────────────────────────────────
  const [search, setSearch]           = useState('');
  const [filterStatus, setFilterStatus] = useState<'todos' | 'pendientes' | 'completadas' | 'inactivas'>('todos');
  const [filterPriority, setFilterPriority] = useState<('baja' | 'media' | 'alta')[]>([]);
  const [filterAssignees, setFilterAssignees] = useState<string[]>([]);
  const [showFilter, setShowFilter] = useState(false);
  const filterRef = useRef<HTMLDivElement>(null);

  function togglePriority(p: 'baja' | 'media' | 'alta') {
    setFilterPriority(prev => prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p]);
  }
  function toggleAssignee(id: string) {
    setFilterAssignees(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  }
  const activeFilterCount = (filterStatus !== 'todos' ? 1 : 0) + filterPriority.length + filterAssignees.length;

  const assignees = useMemo(() => {
    const seen = new Set<string>();
    const result: { id: string; name: string }[] = [];
    (tasks as unknown as FixedTask[]).forEach(t => {
      if (!seen.has(t.assignedTo.id)) {
        seen.add(t.assignedTo.id);
        result.push(t.assignedTo);
      }
    });
    return result;
  }, [tasks]);

  const filtered = useMemo(() => {
    let result = tasks as unknown as FixedTask[];
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(t => t.title.toLowerCase().includes(q) || t.description.toLowerCase().includes(q));
    }
    if (filterStatus !== 'todos') {
      if (filterStatus === 'pendientes')  result = result.filter(t => !t.isCompleted && t.isActive);
      if (filterStatus === 'completadas') result = result.filter(t => t.isCompleted);
      if (filterStatus === 'inactivas')   result = result.filter(t => !t.isActive);
    }
    if (filterPriority.length > 0) {
      result = result.filter(t => filterPriority.includes(t.priority));
    }
    if (filterAssignees.length > 0) {
      result = result.filter(t => filterAssignees.includes(t.assignedTo.id));
    }
    return result;
  }, [tasks, search, filterStatus, filterPriority, filterAssignees]);

  // ── KPIs ───────────────────────────────────────────────────────────────
  const allTasks  = tasks as unknown as FixedTask[];
  const total     = allTasks.length;
  const pending   = allTasks.filter(t => !t.isCompleted && t.isActive).length;
  const completed = allTasks.filter(t => t.isCompleted).length;
  const rate      = total > 0 ? Math.round((completed / total) * 100) : 0;

  // ── DnD ────────────────────────────────────────────────────────────────
  const [activeDragTask, setActiveDragTask] = useState<FixedTask | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  function handleDragStart(event: DragStartEvent) {
    const task = (tasks as unknown as FixedTask[]).find(t => t.id === event.active.id);
    if (task) setActiveDragTask(task);
  }

  async function handleDragEnd(event: DragEndEvent) {
    setActiveDragTask(null);
    const { active, over } = event;
    if (!over) return;

    const taskId = active.id as string;
    const newFreq = over.id as FixedTask['frequency'];

    // Check if dropped onto a column (not another card)
    const isColumn = FREQ_COLUMNS.some(c => c.key === newFreq);
    if (!isColumn) {
      // Dropped on another task — find that task's column
      const overTask = (tasks as unknown as FixedTask[]).find(t => t.id === over.id);
      if (!overTask) return;
      if (overTask.frequency === activeDragTask?.frequency) return;
      try {
        await updateTask(taskId, { frequency: overTask.frequency });
      } catch {
        toast.error('Error al mover la tarea');
      }
      return;
    }

    const draggingTask = (tasks as unknown as FixedTask[]).find(t => t.id === taskId);
    if (!draggingTask || draggingTask.frequency === newFreq) return;
    try {
      await updateTask(taskId, { frequency: newFreq });
    } catch {
      toast.error('Error al mover la tarea');
    }
  }

  // ── Modal state ────────────────────────────────────────────────────────
  const [selectedTask,  setSelectedTask]  = useState<FixedTask | null>(null);
  const [isDetailOpen,  setIsDetailOpen]  = useState(false);
  const [isFormOpen,    setIsFormOpen]    = useState(false);
  const [defaultFreq,   setDefaultFreq]   = useState('');
  const [editingTask,   setEditingTask]   = useState<FixedTask | null>(null);
  const [executingTask, setExecutingTask] = useState<FixedTask | null>(null);
  const [isExecuteOpen, setIsExecuteOpen] = useState(false);

  // ── Handlers ──────────────────────────────────────────────────────────

  function handleTaskClick(task: FixedTask) { setSelectedTask(task); setIsDetailOpen(true); }

  function handleEditTask(task: FixedTask) {
    setEditingTask(task);
    setIsDetailOpen(false);
    setDefaultFreq(task.frequency);
    setIsFormOpen(true);
  }

  async function handleDeleteTask(taskId: string) {
    try {
      await deleteTask(taskId);
      toast.success('Tarea eliminada');
      if (selectedTask?.id === taskId) { setIsDetailOpen(false); setSelectedTask(null); }
    } catch { toast.error('Error al eliminar'); }
  }

  function handleCreateTask(frequency: string) {
    setEditingTask(null);
    setDefaultFreq(frequency);
    setIsFormOpen(true);
  }

  function handleExecuteTask(task: FixedTask) { setExecutingTask(task); setIsExecuteOpen(true); }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async function handleFormSubmit(taskData: any) {
    try {
      if (editingTask) { await updateTask(editingTask.id, taskData); toast.success('Tarea actualizada'); }
      else             { await createTask(taskData);                  toast.success('Tarea fija creada'); }
      setIsFormOpen(false);
      setEditingTask(null);
    } catch { toast.error('Error al guardar'); }
  }

  async function handleExecutionComplete(taskId: string, executionData: ExecutionData) {
    try {
      await completeTask(taskId, {
        userId: user?.id?.toString(),
        duration: executionData.actualTime > 0 ? executionData.actualTime : null,
        notes: executionData.notes || '',
        attachments: executionData.attachments || [],
      });
      toast.success('Tarea ejecutada');
      setIsExecuteOpen(false);
      setExecutingTask(null);
    } catch { toast.error('Error al ejecutar'); }
  }

  // Click-outside to close filter popover
  useEffect(() => {
    if (!showFilter) return;
    function handler(e: MouseEvent) {
      if (filterRef.current && !filterRef.current.contains(e.target as Node)) {
        setShowFilter(false);
      }
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showFilter]);

  // ── Loading skeleton ───────────────────────────────────────────────────

  if (loading) {
    return <FixedTasksViewSkeleton />;
  }

  // ── Empty state ───────────────────────────────────────────────────────

  if (total === 0) {
    return (
      <>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '80px 20px', gap: '16px' }}>
          <div style={{ width: '64px', height: '64px', borderRadius: '16px', background: '#F0F0F0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Repeat className="h-7 w-7" style={{ color: '#C0C0C8' }} />
          </div>
          <div style={{ textAlign: 'center' }}>
            <p style={{ fontSize: '16px', fontWeight: 700, color: '#111827' }}>Sin tareas fijas</p>
            <p style={{ fontSize: '13px', color: '#9CA3AF', marginTop: '4px' }}>Las tareas fijas se repiten automáticamente según su frecuencia</p>
          </div>
          <button
            onClick={() => handleCreateTask('')}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 18px', background: '#111827', color: '#FFF', borderRadius: '10px', border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: 600 }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = '#1a1a1a'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = '#111827'; }}
          >
            <Plus className="h-4 w-4" strokeWidth={2.5} />
            Nueva tarea fija
          </button>
        </div>
        <FixedTaskFormSheet
          isOpen={isFormOpen}
          onClose={() => { setIsFormOpen(false); setEditingTask(null); }}
          onSubmit={handleFormSubmit}
          frequency={defaultFreq}
          editingTask={editingTask}
        />
      </>
    );
  }

  // ── Main render ───────────────────────────────────────────────────────

  return (
    <>
      <style>{`
        @keyframes kpi-in {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        @keyframes ftcard-in {
          from { opacity: 0; transform: translateY(-4px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes filter-popup-in {
          from { opacity: 0; transform: translateY(-4px) scale(0.99); }
          to   { opacity: 1; transform: translateY(0)    scale(1);    }
        }
      `}</style>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

        {/* ── KPI cards ── */}
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <KpiCard label="Total"       value={String(total)}     accent="#111827" icon={Repeat} />
          <KpiCard label="Pendientes"  value={String(pending)}   accent="#111827" icon={Clock} />
          <KpiCard label="Completadas" value={String(completed)} accent="#508070" icon={CheckCircle2} />
          <KpiCard label="Progreso"    value={`${rate}%`}        accent={rate >= 80 ? '#508070' : rate >= 40 ? '#8A7840' : '#A86848'} icon={BarChart3} />
        </div>

        {/* ── Search + filters + create ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>

          {/* Row 1: search + filter button + create */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ position: 'relative', flex: 1 }}>
              <Search className="h-3.5 w-3.5" style={{ position: 'absolute', left: '11px', top: '50%', transform: 'translateY(-50%)', color: '#9CA3AF', pointerEvents: 'none' }} />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Buscar tareas..."
                style={{ width: '100%', height: '38px', paddingLeft: '34px', paddingRight: search ? '32px' : '12px', borderRadius: '9px', border: '1px solid #E5E7EB', background: '#FFFFFF', fontSize: '14px', color: '#111827', outline: 'none', transition: 'border-color 120ms ease' }}
                onFocus={e => { e.currentTarget.style.borderColor = '#9CA3AF'; }}
                onBlur={e => { e.currentTarget.style.borderColor = '#E4E4E8'; }}
              />
              {search && (
                <button onClick={() => setSearch('')} style={{ position: 'absolute', right: '9px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#9CA3AF', padding: '2px' }}>
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>

            {/* Filter button with popover — INLINE with search */}
            <div ref={filterRef} style={{ position: 'relative' }}>
              <button
                onClick={() => setShowFilter(v => !v)}
                style={{
                  display: 'flex', alignItems: 'center', gap: '6px',
                  height: '38px', padding: '0 13px', borderRadius: '9px',
                  border: `1px solid ${showFilter || activeFilterCount > 0 ? '#111827' : '#E5E7EB'}`,
                  background: showFilter || activeFilterCount > 0 ? '#111827' : '#FFFFFF',
                  color: showFilter || activeFilterCount > 0 ? '#FFFFFF' : '#6B7280',
                  fontSize: '13px', fontWeight: 500, cursor: 'pointer',
                  transition: 'all 120ms ease',
                }}
              >
                <SlidersHorizontal className="h-3.5 w-3.5" />
                Filtros
                {activeFilterCount > 0 && (
                  <span style={{
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                    height: '16px', minWidth: '16px', padding: '0 4px', borderRadius: '999px',
                    background: 'rgba(255,255,255,0.2)', color: '#FFFFFF',
                    fontSize: '10px', fontWeight: 700,
                  }}>
                    {activeFilterCount}
                  </span>
                )}
              </button>

              {/* Popover */}
              {showFilter && (
                <div style={{
                  position: 'absolute', top: 'calc(100% + 6px)', left: 0,
                  width: '280px', background: '#FFFFFF',
                  border: '1px solid #EBEBEB', borderRadius: '12px',
                  boxShadow: '0 8px 24px rgba(0,0,0,.10)',
                  zIndex: 50, padding: '14px',
                  animation: 'filter-popup-in 180ms cubic-bezier(0.22,1,0.36,1) both',
                }}>
                  {/* Status */}
                  <p style={{ fontSize: '10px', fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '8px' }}>Estado</p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '14px' }}>
                    {(['todos', 'pendientes', 'completadas', 'inactivas'] as const).map(s => {
                      const active = filterStatus === s;
                      const labels = { todos: 'Todas', pendientes: 'Pendientes', completadas: 'Completadas', inactivas: 'Inactivas' };
                      return (
                        <button
                          key={s}
                          onClick={() => setFilterStatus(s)}
                          style={{
                            height: '28px', padding: '0 12px', borderRadius: '7px',
                            border: `1px solid ${active ? '#111827' : '#E5E7EB'}`,
                            background: active ? '#111827' : '#FFFFFF',
                            color: active ? '#FFF' : '#6B7280',
                            fontSize: '13px', fontWeight: 500, cursor: 'pointer',
                            transition: 'all 120ms ease', whiteSpace: 'nowrap',
                          }}
                        >
                          {labels[s]}
                        </button>
                      );
                    })}
                  </div>

                  <div style={{ height: '1px', background: '#F0F0F0', marginBottom: '14px' }} />

                  {/* Priority */}
                  <p style={{ fontSize: '10px', fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '8px' }}>Prioridad</p>
                  <div style={{ display: 'flex', gap: '6px', marginBottom: '14px' }}>
                    {(['alta', 'media', 'baja'] as const).map(p => {
                      const conf = PRIORITY_CHIP[p];
                      const active = filterPriority.includes(p);
                      return (
                        <button
                          key={p}
                          onClick={() => togglePriority(p)}
                          style={{
                            height: '28px', padding: '0 12px', borderRadius: '7px',
                            border: `1.5px solid ${active ? conf.text : '#E5E7EB'}`,
                            background: active ? conf.bg : '#FFFFFF',
                            color: active ? conf.text : '#6B7280',
                            fontSize: '13px', fontWeight: 500, cursor: 'pointer',
                            transition: 'all 120ms ease',
                          }}
                        >
                          {conf.label}
                        </button>
                      );
                    })}
                  </div>

                  {/* Assignees */}
                  {assignees.length > 0 && (
                    <>
                      <div style={{ height: '1px', background: '#F0F0F0', marginBottom: '14px' }} />
                      <p style={{ fontSize: '10px', fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '8px' }}>Responsable</p>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', maxHeight: '160px', overflowY: 'auto', marginBottom: '4px' }}>
                        {assignees.map(a => {
                          const active = filterAssignees.includes(a.id);
                          return (
                            <button
                              key={a.id}
                              onClick={() => toggleAssignee(a.id)}
                              style={{
                                display: 'flex', alignItems: 'center', gap: '8px',
                                padding: '6px 8px', borderRadius: '8px',
                                border: `1px solid ${active ? '#111827' : 'transparent'}`,
                                background: active ? '#111827' : 'transparent',
                                cursor: 'pointer', transition: 'all 120ms ease', textAlign: 'left',
                              }}
                              onMouseEnter={e => { if (!active) (e.currentTarget as HTMLButtonElement).style.background = '#F4F4F6'; }}
                              onMouseLeave={e => { if (!active) (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; }}
                            >
                              <Avatar style={{ height: '22px', width: '22px', flexShrink: 0 }}>
                                <AvatarFallback style={{ background: active ? 'rgba(255,255,255,0.15)' : '#F0F0F0', color: active ? '#FFF' : '#6B7280', fontSize: '8px', fontWeight: 700 }}>
                                  {getInitials(a.name)}
                                </AvatarFallback>
                              </Avatar>
                              <span style={{ fontSize: '13px', fontWeight: 500, color: active ? '#FFF' : '#111827', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                                {a.name}
                              </span>
                              {active && <CheckCircle2 className="h-3.5 w-3.5" style={{ color: '#FFF', flexShrink: 0 }} />}
                            </button>
                          );
                        })}
                      </div>
                    </>
                  )}

                  {/* Clear button */}
                  {activeFilterCount > 0 && (
                    <div style={{ borderTop: '1px solid #F0F0F0', paddingTop: '10px', marginTop: '10px' }}>
                      <button
                        onClick={() => { setFilterStatus('todos'); setFilterPriority([]); setFilterAssignees([]); }}
                        style={{ width: '100%', height: '30px', borderRadius: '8px', border: '1px solid #E4E4E8', background: 'transparent', color: '#6B7280', fontSize: '12px', fontWeight: 600, cursor: 'pointer', transition: 'background 120ms ease' }}
                        onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = '#F4F4F6'; }}
                        onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; }}
                      >
                        Limpiar filtros
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Search result count */}
            {search && <span style={{ fontSize: '12px', color: '#9CA3AF', whiteSpace: 'nowrap' }}>{filtered.length} resultado{filtered.length !== 1 ? 's' : ''}</span>}

            <button
              onClick={() => handleCreateTask('')}
              style={{ display: 'flex', alignItems: 'center', gap: '6px', height: '38px', padding: '0 16px', background: '#050505', color: '#FFF', borderRadius: '9px', border: 'none', cursor: 'pointer', fontSize: '14px', fontWeight: 600, transition: 'opacity 120ms ease', flexShrink: 0 }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.opacity = '0.82'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.opacity = '1'; }}
            >
              <Plus className="h-3.5 w-3.5" strokeWidth={2.5} />
              Nueva tarea
            </button>
          </div>

          {/* Row 2: active filter pills — only shown when filters active */}
          {activeFilterCount > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
              {filterStatus !== 'todos' && (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', height: '26px', padding: '0 10px', borderRadius: '8px', background: '#F0F0F0', fontSize: '12px', fontWeight: 600, color: '#6B7280' }}>
                  {{ todos: 'Todas', pendientes: 'Pendientes', completadas: 'Completadas', inactivas: 'Inactivas' }[filterStatus]}
                  <button onClick={() => setFilterStatus('todos')} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', color: '#9CA3AF' }}>
                    <X className="h-3 w-3" />
                  </button>
                </span>
              )}
              {filterPriority.map(p => (
                <span key={p} style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', height: '26px', padding: '0 10px', borderRadius: '8px', background: PRIORITY_CHIP[p].bg, fontSize: '12px', fontWeight: 600, color: PRIORITY_CHIP[p].text }}>
                  {PRIORITY_CHIP[p].label}
                  <button onClick={() => togglePriority(p)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', color: PRIORITY_CHIP[p].text }}>
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
              {filterAssignees.map(id => {
                const a = assignees.find(x => x.id === id);
                if (!a) return null;
                return (
                  <span key={id} style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', height: '26px', padding: '0 10px', borderRadius: '8px', background: '#F0F0F0', fontSize: '12px', fontWeight: 600, color: '#374151' }}>
                    {a.name.split(' ')[0]}
                    <button onClick={() => toggleAssignee(id)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', color: '#6B7280' }}>
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                );
              })}
            </div>
          )}
        </div>

        {/* ── Kanban columns (DnD) ── */}
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <div style={{ overflowX: 'auto', paddingBottom: '4px', marginLeft: '-2px', paddingLeft: '2px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(220px, 1fr))', gap: '14px' }}>
            {FREQ_COLUMNS.map((col, colIdx) => {
              const colTasks = filtered.filter(t => t.frequency === col.key);
              return (
                <DroppableCol
                  key={col.key}
                  col={col}
                  colIdx={colIdx}
                  tasks={colTasks}
                  onTaskClick={handleTaskClick}
                  onEditTask={handleEditTask}
                  onDeleteTask={handleDeleteTask}
                  onExecuteTask={handleExecuteTask}
                  onCreateTask={handleCreateTask}
                  currentUserId={user?.id?.toString()}
                />
              );
            })}
          </div>
          </div>

          {/* Drag overlay */}
          <DragOverlay modifiers={[snapCenterToCursor]}>
            {activeDragTask ? <DragGhostCard task={activeDragTask} /> : null}
          </DragOverlay>
        </DndContext>
      </div>

      {/* ── Detail sheet ── */}
      <FixedTaskDetailSheet
        task={selectedTask}
        isOpen={isDetailOpen}
        onClose={() => { setIsDetailOpen(false); setSelectedTask(null); }}
        onEdit={handleEditTask}
        onExecute={handleExecuteTask}
        onDelete={handleDeleteTask}
        onTaskUpdated={refetch}
        currentUserId={user?.id?.toString()}
      />

      {/* ── Create / Edit sheet ── */}
      <FixedTaskFormSheet
        isOpen={isFormOpen}
        onClose={() => { setIsFormOpen(false); setEditingTask(null); }}
        onSubmit={handleFormSubmit}
        frequency={defaultFreq}
        editingTask={editingTask}
      />

      {/* ── Execute modal (reused from agendav1) ── */}
      <TaskExecutionModal
        task={executingTask as any} // eslint-disable-line @typescript-eslint/no-explicit-any
        isOpen={isExecuteOpen}
        onClose={() => { setIsExecuteOpen(false); setExecutingTask(null); }}
        onComplete={handleExecutionComplete}
      />
    </>
  );
}
