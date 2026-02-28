'use client';

import { useState, useMemo } from 'react';
import {
  Search, MoreHorizontal, Paperclip, MessageSquare,
  Activity, Bookmark, CalendarDays, AlertCircle,
  CheckCircle2, Clock, Circle, ChevronRight, SlidersHorizontal,
} from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { format, formatDistanceToNow, isToday, isYesterday, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { SubtaskList, type SubtaskItem } from './SubtaskList';
import type { AgendaTask, Priority, AgendaTaskStatus } from '@/lib/agenda/types';
import {
  TASK_STATUS_CONFIG,
  isTaskOverdue,
} from '@/lib/agenda/types';

// ── Design tokens ─────────────────────────────────────────────────────────────

const PRIORITY_CHIP: Record<Priority, { bg: string; text: string; label: string }> = {
  LOW:    { bg: '#F0F0F0',   text: '#575456', label: 'Baja' },
  MEDIUM: { bg: '#D0E0F0',   text: '#3070A8', label: 'Media' },
  HIGH:   { bg: '#F9F0DB',   text: '#907840', label: 'Alta' },
  URGENT: { bg: '#F9E4E2',   text: '#C05060', label: 'Urgente' },
};

const STATUS_ICON: Record<AgendaTaskStatus, typeof Circle> = {
  PENDING:     Circle,
  IN_PROGRESS: Clock,
  WAITING:     Clock,
  COMPLETED:   CheckCircle2,
  CANCELLED:   CheckCircle2,
};

const STATUS_COLOR: Record<AgendaTaskStatus, string> = {
  PENDING:     '#9C9CAA',
  IN_PROGRESS: '#3070A8',
  WAITING:     '#907840',
  COMPLETED:   '#568177',
  CANCELLED:   '#ED8A94',
};

const AVATAR_COLORS = [
  { bg: '#D0E0F0', fg: '#3070A8' },
  { bg: '#D0EFE0', fg: '#568177' },
  { bg: '#F9F0DB', fg: '#907840' },
  { bg: '#F9E4E2', fg: '#C05060' },
  { bg: '#EDE0F5', fg: '#7040A8' },
];

const MOCK_SUBTASKS: SubtaskItem[] = [
  { id: '1', title: 'Reunión inicial y definición de scope',  completed: true },
  { id: '2', title: 'Recopilar referencias de diseño',        completed: false },
  { id: '3', title: 'Revisar brief y alinearse con el equipo', completed: false },
  { id: '4', title: 'Preparar entregables finales',           completed: false },
];

const MOCK_COMMENTS = [
  { id: 1, author: 'Juan P.',   content: 'Revisé el documento, falta la sección de costos.',  time: 'Hace 2h',  bg: '#D0E0F0', fg: '#3070A8' },
  { id: 2, author: 'María G.',  content: 'Actualizado, pueden revisar ahora.',                time: 'Hace 45m', bg: '#D0EFE0', fg: '#568177' },
  { id: 3, author: 'Carlos R.', content: 'Perfecto, aprobado para producción.',               time: 'Hace 20m', bg: '#F9F0DB', fg: '#907840' },
];

const MOCK_ACTIVITY = [
  { id: 1, text: 'creó esta tarea',                 user: 'Juan P.',   time: 'Hace 3 días' },
  { id: 2, text: 'cambió el estado a En progreso',  user: 'María G.',  time: 'Hace 2 días' },
  { id: 3, text: 'te asignó la tarea',              user: 'Juan P.',   time: 'Hace 1 día'  },
  { id: 4, text: 'agregó un comentario',             user: 'Carlos R.', time: 'Hace 20m'    },
];

const MOCK_ATTACHMENTS = [
  { name: 'Brief diseño.pdf', size: '1.5 MB', type: 'pdf' },
  { name: 'Dashboard.fig',   size: '2.5 MB', type: 'fig' },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function getInitials(name: string) {
  return name.split(' ').slice(0, 2).map(p => p[0]).join('').toUpperCase();
}

function groupLabel(dateStr: string): string {
  try {
    const d = parseISO(dateStr);
    if (isToday(d))     return 'Hoy';
    if (isYesterday(d)) return 'Ayer';
    return format(d, 'dd MMM yyyy', { locale: es });
  } catch {
    return 'Antes';
  }
}

function timeAgo(dateStr: string): string {
  try {
    return formatDistanceToNow(parseISO(dateStr), { addSuffix: true, locale: es });
  } catch {
    return '';
  }
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface InboxViewProps {
  tasks: AgendaTask[];
  onTaskClick?: (task: AgendaTask) => void;
}

type FilterTab = 'all' | 'pending' | 'done';

// ── InboxItem ─────────────────────────────────────────────────────────────────

function InboxItem({
  task,
  index,
  isSelected,
  onClick,
}: {
  task: AgendaTask;
  index: number;
  isSelected: boolean;
  onClick: () => void;
}) {
  const overdue      = isTaskOverdue(task);
  const creatorName  = task.createdBy?.name || 'Alguien';
  const avatarColor  = AVATAR_COLORS[index % AVATAR_COLORS.length];
  const StatusIcon   = STATUS_ICON[task.status];
  const statusColor  = STATUS_COLOR[task.status];
  const isNew        = task.status === 'PENDING';
  const pChip        = PRIORITY_CHIP[task.priority];

  return (
    <button
      onClick={onClick}
      style={{
        width: '100%',
        textAlign: 'left',
        padding: '14px 16px',
        borderBottom: '1px solid #F5F5F5',
        borderLeft: isSelected ? '2.5px solid #050505' : '2.5px solid transparent',
        background: isSelected ? '#F8F8F8' : 'transparent',
        cursor: 'pointer',
        transition: 'background 120ms ease, border-color 120ms ease',
        display: 'block',
      }}
      onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = '#FAFAFA'; }}
      onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = 'transparent'; }}
    >
      {/* Row 1: avatar + sender + time */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>

        {/* Avatar with optional unread dot */}
        <div style={{ position: 'relative', flexShrink: 0 }}>
          <div
            style={{
              width: '34px', height: '34px', borderRadius: '50%',
              background: avatarColor.bg, color: avatarColor.fg,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '11px', fontWeight: 700,
            }}
          >
            {getInitials(creatorName)}
          </div>
          {isNew && (
            <span
              style={{
                position: 'absolute', top: '-2px', right: '-2px',
                height: '9px', width: '9px', borderRadius: '50%',
                background: '#3070A8', border: '2px solid #FFFFFF',
              }}
            />
          )}
        </div>

        {/* Content */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Header row */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '3px' }}>
            <span style={{ fontSize: '12px', fontWeight: 700, color: '#050505' }}>
              {creatorName}
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              {overdue && <AlertCircle className="h-3 w-3" style={{ color: '#C05060' }} />}
              <span style={{ fontSize: '10px', color: '#ADADAD' }}>{timeAgo(task.createdAt)}</span>
              <Bookmark className="h-3 w-3" style={{ color: isSelected ? '#050505' : '#D8D8D8' }} />
            </div>
          </div>

          {/* Message line */}
          <p style={{ fontSize: '12px', color: '#575456', lineHeight: 1.4, marginBottom: '6px' }}>
            te asignó{' '}
            <span style={{ fontWeight: 600, color: '#050505' }}>{task.title}</span>
          </p>

          {/* Meta row: priority + status */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span
              style={{
                fontSize: '10px', fontWeight: 600, padding: '2px 7px',
                borderRadius: '999px', background: pChip.bg, color: pChip.text,
              }}
            >
              {pChip.label}
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
              <StatusIcon className="h-2.5 w-2.5" style={{ color: statusColor }} />
              <span style={{ fontSize: '10px', color: statusColor, fontWeight: 500 }}>
                {TASK_STATUS_CONFIG[task.status].label}
              </span>
            </div>
            {task.dueDate && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '3px', marginLeft: 'auto' }}>
                <CalendarDays className="h-2.5 w-2.5" style={{ color: overdue ? '#C05060' : '#ADADAD' }} />
                <span style={{ fontSize: '10px', color: overdue ? '#C05060' : '#ADADAD' }}>
                  {format(parseISO(task.dueDate), 'dd MMM', { locale: es })}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    </button>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export function InboxView({ tasks, onTaskClick }: InboxViewProps) {
  const [search,       setSearch]       = useState('');
  const [filter,       setFilter]       = useState<FilterTab>('all');
  const [selectedTask, setSelectedTask] = useState<AgendaTask | null>(tasks[0] || null);
  const [subtasks,     setSubtasks]     = useState<SubtaskItem[]>(MOCK_SUBTASKS);

  // Filter tasks
  const filteredTasks = useMemo(() => {
    let list = tasks;

    if (filter === 'pending') list = list.filter(t => t.status !== 'COMPLETED' && t.status !== 'CANCELLED');
    if (filter === 'done')    list = list.filter(t => t.status === 'COMPLETED');

    if (search.trim()) {
      const lower = search.toLowerCase();
      list = list.filter(t =>
        t.title.toLowerCase().includes(lower) ||
        (t.description || '').toLowerCase().includes(lower) ||
        (t.createdBy?.name || '').toLowerCase().includes(lower)
      );
    }
    return list;
  }, [tasks, filter, search]);

  // Group by date label
  const grouped = useMemo(() => {
    const map = new Map<string, AgendaTask[]>();
    filteredTasks.forEach(t => {
      const label = groupLabel(t.createdAt);
      const arr = map.get(label) ?? [];
      arr.push(t);
      map.set(label, arr);
    });
    return Array.from(map.entries());
  }, [filteredTasks]);

  function handleSelectTask(task: AgendaTask) {
    setSelectedTask(task);
    setSubtasks(MOCK_SUBTASKS);
    onTaskClick?.(task);
  }

  const selected         = selectedTask;
  const selectedOverdue  = selected ? isTaskOverdue(selected) : false;
  const pChip            = selected ? PRIORITY_CHIP[selected.priority] : null;
  const completedCount   = subtasks.filter(s => s.completed).length;
  const subtaskProgress  = subtasks.length > 0 ? Math.round((completedCount / subtasks.length) * 100) : 0;

  const pendingCount   = tasks.filter(t => t.status !== 'COMPLETED' && t.status !== 'CANCELLED').length;
  const completedCount2 = tasks.filter(t => t.status === 'COMPLETED').length;

  return (
    <div
      style={{
        display: 'flex',
        height: 'calc(100vh - 10rem)',
        overflow: 'hidden',
        borderRadius: '16px',
        border: '1px solid #E8E8E8',
        background: '#FFFFFF',
        boxShadow: '0 1px 4px rgba(0,0,0,.04)',
      }}
    >
      {/* ── Left panel ──────────────────────────────────────────────── */}
      <div
        style={{
          width: '320px',
          flexShrink: 0,
          borderRight: '1px solid #EFEFEF',
          display: 'flex',
          flexDirection: 'column',
          background: '#FAFAFA',
        }}
      >
        {/* Header */}
        <div style={{ padding: '16px 16px 0' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
            <div>
              <h2 style={{ fontSize: '14px', fontWeight: 700, color: '#050505', lineHeight: 1 }}>
                Inbox
              </h2>
              <p style={{ fontSize: '11px', color: '#9C9CAA', marginTop: '2px' }}>
                Tareas asignadas a vos
              </p>
            </div>
            <div style={{ display: 'flex', gap: '2px' }}>
              <button
                style={{
                  height: '28px', width: '28px', borderRadius: '8px',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: '#9C9CAA', background: 'transparent', border: 'none', cursor: 'pointer',
                }}
                onMouseEnter={e => { e.currentTarget.style.background = '#EEEEEE'; e.currentTarget.style.color = '#575456'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#9C9CAA'; }}
              >
                <SlidersHorizontal className="h-3.5 w-3.5" />
              </button>
              <button
                style={{
                  height: '28px', width: '28px', borderRadius: '8px',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: '#9C9CAA', background: 'transparent', border: 'none', cursor: 'pointer',
                }}
                onMouseEnter={e => { e.currentTarget.style.background = '#EEEEEE'; e.currentTarget.style.color = '#575456'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#9C9CAA'; }}
              >
                <MoreHorizontal className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          {/* Search */}
          <div style={{ position: 'relative', marginBottom: '12px' }}>
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5"
              style={{ color: '#C0C0C8' }}
            />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar en inbox..."
              className="w-full outline-none"
              style={{
                paddingLeft: '30px', paddingRight: '10px',
                height: '34px', fontSize: '12px',
                background: '#EFEFEF', border: '1px solid transparent',
                borderRadius: '10px', color: '#050505',
                transition: 'border-color 150ms ease',
              }}
              onFocus={e => { e.currentTarget.style.borderColor = '#D0D0D8'; e.currentTarget.style.background = '#FFFFFF'; }}
              onBlur={e =>  { e.currentTarget.style.borderColor = 'transparent'; e.currentTarget.style.background = '#EFEFEF'; }}
            />
          </div>

          {/* Filter tabs */}
          <div
            style={{
              display: 'flex', gap: '2px', padding: '3px',
              background: '#EFEFEF', borderRadius: '10px', marginBottom: '4px',
            }}
          >
            {([
              { key: 'all',     label: 'Todas',      count: tasks.length },
              { key: 'pending', label: 'Pendientes',  count: pendingCount },
              { key: 'done',    label: 'Completadas', count: completedCount2 },
            ] as { key: FilterTab; label: string; count: number }[]).map(tab => (
              <button
                key={tab.key}
                onClick={() => setFilter(tab.key)}
                style={{
                  flex: 1, padding: '5px 4px', borderRadius: '8px',
                  fontSize: '11px', fontWeight: filter === tab.key ? 700 : 500,
                  color: filter === tab.key ? '#050505' : '#9C9CAA',
                  background: filter === tab.key ? '#FFFFFF' : 'transparent',
                  border: 'none', cursor: 'pointer',
                  boxShadow: filter === tab.key ? '0 1px 3px rgba(0,0,0,.07)' : 'none',
                  transition: 'all 150ms ease',
                }}
              >
                {tab.label}
                {tab.count > 0 && (
                  <span
                    style={{
                      marginLeft: '4px',
                      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                      minWidth: '16px', height: '14px', padding: '0 4px',
                      borderRadius: '999px', fontSize: '9px', fontWeight: 700,
                      background: filter === tab.key ? '#050505' : '#E0E0E8',
                      color: filter === tab.key ? '#FFFFFF' : '#9C9CAA',
                    }}
                  >
                    {tab.count}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Task list */}
        <ScrollArea className="flex-1 mt-2">
          {filteredTasks.length === 0 ? (
            <div
              style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center',
                justifyContent: 'center', padding: '48px 24px', textAlign: 'center',
              }}
            >
              <div
                style={{
                  width: '48px', height: '48px', borderRadius: '14px',
                  background: '#F0F0F0', display: 'flex', alignItems: 'center',
                  justifyContent: 'center', marginBottom: '12px',
                }}
              >
                <CheckCircle2 className="h-5 w-5" style={{ color: '#C8C8D0' }} />
              </div>
              <p style={{ fontSize: '13px', fontWeight: 600, color: '#575456' }}>Todo al día</p>
              <p style={{ fontSize: '11px', color: '#ADADAD', marginTop: '4px' }}>No hay tareas asignadas</p>
            </div>
          ) : (
            grouped.map(([label, groupTasks]) => (
              <div key={label}>
                {/* Group date separator */}
                <div
                  style={{
                    padding: '8px 16px 4px',
                    display: 'flex', alignItems: 'center', gap: '8px',
                  }}
                >
                  <span style={{ fontSize: '10px', fontWeight: 700, color: '#ADADAD', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                    {label}
                  </span>
                  <div style={{ flex: 1, height: '1px', background: '#EFEFEF' }} />
                </div>
                {groupTasks.map((task, i) => (
                  <InboxItem
                    key={task.id}
                    task={task}
                    index={i}
                    isSelected={selected?.id === task.id}
                    onClick={() => handleSelectTask(task)}
                  />
                ))}
              </div>
            ))
          )}
        </ScrollArea>
      </div>

      {/* ── Right panel (detail) ─────────────────────────────────────── */}
      {selected ? (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, background: '#FFFFFF' }}>
          {/* Detail header */}
          <div
            style={{
              padding: '20px 24px 16px',
              borderBottom: '1px solid #F0F0F0',
              display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px',
            }}
          >
            <div style={{ flex: 1, minWidth: 0 }}>
              {/* Assignor */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                <div
                  style={{
                    width: '22px', height: '22px', borderRadius: '50%',
                    background: '#D0E0F0', color: '#3070A8',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '8px', fontWeight: 700, flexShrink: 0,
                  }}
                >
                  {getInitials(selected.createdBy?.name || 'A')}
                </div>
                <span style={{ fontSize: '11px', color: '#9C9CAA' }}>
                  <span style={{ color: '#575456', fontWeight: 600 }}>{selected.createdBy?.name}</span>
                  {' '}te asignó esta tarea
                </span>
                <span style={{ fontSize: '10px', color: '#C0C0C8', marginLeft: 'auto' }}>
                  {timeAgo(selected.createdAt)}
                </span>
              </div>

              <h2 style={{ fontSize: '16px', fontWeight: 700, color: '#050505', lineHeight: 1.3 }}>
                {selected.title}
              </h2>
            </div>

            <button
              style={{
                height: '28px', width: '28px', borderRadius: '8px', flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: '#9C9CAA', background: 'transparent', border: 'none', cursor: 'pointer',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = '#F0F0F0'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
            >
              <MoreHorizontal className="h-4 w-4" />
            </button>
          </div>

          <ScrollArea className="flex-1">
            <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>

              {/* Meta row */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {/* Priority */}
                {pChip && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 14px', borderRadius: '999px', background: pChip.bg }}>
                    <span style={{ fontSize: '11px', color: '#9C9CAA', fontWeight: 500 }}>Prioridad</span>
                    <span style={{ fontSize: '12px', fontWeight: 700, color: pChip.text }}>{pChip.label}</span>
                  </div>
                )}
                {/* Status */}
                <div
                  style={{
                    display: 'flex', alignItems: 'center', gap: '5px',
                    padding: '6px 14px', borderRadius: '999px', background: '#F6F6F6',
                  }}
                >
                  <span
                    style={{
                      width: '7px', height: '7px', borderRadius: '50%',
                      background: STATUS_COLOR[selected.status], flexShrink: 0,
                    }}
                  />
                  <span style={{ fontSize: '12px', fontWeight: 600, color: STATUS_COLOR[selected.status] }}>
                    {TASK_STATUS_CONFIG[selected.status].label}
                  </span>
                </div>
                {/* Due date */}
                {selected.dueDate && (
                  <div
                    style={{
                      display: 'flex', alignItems: 'center', gap: '5px',
                      padding: '6px 14px', borderRadius: '999px',
                      background: selectedOverdue ? '#F9E4E2' : '#F6F6F6',
                    }}
                  >
                    <CalendarDays className="h-3 w-3" style={{ color: selectedOverdue ? '#C05060' : '#9C9CAA' }} />
                    <span style={{ fontSize: '12px', fontWeight: 600, color: selectedOverdue ? '#C05060' : '#575456' }}>
                      {format(parseISO(selected.dueDate), 'dd MMM yyyy', { locale: es })}
                    </span>
                  </div>
                )}
              </div>

              {/* Description */}
              {selected.description && (
                <div style={{ padding: '14px 16px', background: '#FAFAFA', borderRadius: '12px', border: '1px solid #F0F0F0' }}>
                  <p style={{ fontSize: '11px', fontWeight: 600, color: '#9C9CAA', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    Descripción
                  </p>
                  <p style={{ fontSize: '13px', color: '#575456', lineHeight: 1.65 }}>
                    {selected.description}
                  </p>
                </div>
              )}

              {/* Attachments */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Paperclip className="h-3.5 w-3.5" style={{ color: '#9C9CAA' }} />
                    <span style={{ fontSize: '12px', fontWeight: 600, color: '#575456' }}>
                      Adjuntos <span style={{ color: '#9C9CAA', fontWeight: 400 }}>({MOCK_ATTACHMENTS.length})</span>
                    </span>
                  </div>
                  <button
                    style={{ fontSize: '11px', color: '#3070A8', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}
                    onMouseEnter={e => { e.currentTarget.style.textDecoration = 'underline'; }}
                    onMouseLeave={e => { e.currentTarget.style.textDecoration = 'none'; }}
                  >
                    Descargar todo
                  </button>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  {MOCK_ATTACHMENTS.map(att => (
                    <div
                      key={att.name}
                      style={{
                        display: 'flex', alignItems: 'center', gap: '10px',
                        padding: '10px 14px', background: '#FAFAFA',
                        border: '1px solid #EEEEEE', borderRadius: '12px',
                        cursor: 'pointer', transition: 'all 150ms ease',
                        minWidth: '160px',
                      }}
                      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = '#D8D8D8'; (e.currentTarget as HTMLElement).style.background = '#F3F3F3'; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = '#EEEEEE'; (e.currentTarget as HTMLElement).style.background = '#FAFAFA'; }}
                    >
                      <div
                        style={{
                          height: '28px', width: '28px', borderRadius: '8px', flexShrink: 0,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: '9px', fontWeight: 800, letterSpacing: '0.02em',
                          background: att.type === 'pdf' ? '#FEE8E8' : '#EDE0FF',
                          color: att.type === 'pdf' ? '#C05060' : '#7040A8',
                        }}
                      >
                        {att.type.toUpperCase()}
                      </div>
                      <div>
                        <p style={{ fontSize: '12px', fontWeight: 600, color: '#050505' }}>{att.name}</p>
                        <p style={{ fontSize: '10px', color: '#9C9CAA', marginTop: '1px' }}>{att.size}</p>
                      </div>
                    </div>
                  ))}
                  <button
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      height: '48px', width: '48px', borderRadius: '12px',
                      border: '1.5px dashed #D8D8D8', background: 'transparent',
                      cursor: 'pointer', color: '#C0C0C8', fontSize: '18px',
                      transition: 'all 150ms ease',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = '#B0B0B8'; e.currentTarget.style.color = '#9C9CAA'; }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = '#D8D8D8'; e.currentTarget.style.color = '#C0C0C8'; }}
                  >
                    +
                  </button>
                </div>
              </div>

              {/* Tabs */}
              <Tabs defaultValue="subtasks" className="w-full">
                <TabsList
                  className="w-full justify-start rounded-none h-auto p-0 gap-0"
                  style={{ background: 'transparent', borderBottom: '1px solid #EFEFEF' }}
                >
                  {[
                    { value: 'subtasks',   label: 'Subtareas' },
                    { value: 'comments',   label: `Comentarios ${MOCK_COMMENTS.length}` },
                    { value: 'activities', label: 'Actividades' },
                  ].map(tab => (
                    <TabsTrigger
                      key={tab.value}
                      value={tab.value}
                      className="rounded-none border-b-2 border-transparent data-[state=active]:border-[#050505] data-[state=active]:bg-transparent data-[state=active]:shadow-none pb-2.5 pt-0 transition-all duration-150"
                      style={{ fontSize: '12px', fontWeight: 600, padding: '0 16px 10px', color: '#9C9CAA' }}
                    >
                      {tab.label}
                    </TabsTrigger>
                  ))}
                </TabsList>

                {/* Subtasks */}
                <TabsContent value="subtasks" className="mt-4">
                  {/* Progress */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px', padding: '12px 14px', background: '#FAFAFA', borderRadius: '12px' }}>
                    <span style={{ fontSize: '12px', color: '#575456', fontWeight: 500, flex: 1 }}>Progreso del proceso</span>
                    <div style={{ width: '100px', height: '5px', background: '#EFEFEF', borderRadius: '999px', overflow: 'hidden' }}>
                      <div
                        style={{
                          height: '100%', borderRadius: '999px',
                          background: subtaskProgress === 100 ? '#568177' : '#3070A8',
                          width: `${subtaskProgress}%`,
                          transition: 'width 500ms ease',
                        }}
                      />
                    </div>
                    <span style={{ fontSize: '11px', color: '#9C9CAA', fontWeight: 600, minWidth: '28px', textAlign: 'right' }}>{subtaskProgress}%</span>
                  </div>
                  <SubtaskList
                    groupTitle="Proceso de trabajo"
                    subtasks={subtasks}
                    onToggle={(id, completed) =>
                      setSubtasks(prev => prev.map(s => s.id === id ? { ...s, completed } : s))
                    }
                    onAdd={(title) =>
                      setSubtasks(prev => [...prev, { id: Date.now().toString(), title, completed: false }])
                    }
                  />
                </TabsContent>

                {/* Comments */}
                <TabsContent value="comments" className="mt-4">
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    {MOCK_COMMENTS.map(comment => (
                      <div key={comment.id} style={{ display: 'flex', gap: '10px' }}>
                        <div
                          style={{
                            width: '28px', height: '28px', borderRadius: '50%', flexShrink: 0,
                            background: comment.bg, color: comment.fg,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: '9px', fontWeight: 700,
                          }}
                        >
                          {comment.author.split(' ').map(w => w[0]).join('')}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginBottom: '5px' }}>
                            <span style={{ fontSize: '12px', fontWeight: 700, color: '#050505' }}>{comment.author}</span>
                            <span style={{ fontSize: '10px', color: '#ADADAD' }}>{comment.time}</span>
                          </div>
                          <div style={{ background: '#F6F6F6', borderRadius: '12px', borderTopLeftRadius: '3px', padding: '9px 12px' }}>
                            <p style={{ fontSize: '12px', color: '#575456', lineHeight: 1.55 }}>{comment.content}</p>
                          </div>
                        </div>
                      </div>
                    ))}

                    {/* New comment input */}
                    <div style={{ display: 'flex', gap: '10px', paddingTop: '6px', borderTop: '1px solid #F0F0F0' }}>
                      <div
                        style={{
                          width: '28px', height: '28px', borderRadius: '50%', flexShrink: 0,
                          background: '#D0E0F0', color: '#3070A8',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}
                      >
                        <MessageSquare className="h-3.5 w-3.5" />
                      </div>
                      <input
                        placeholder="Escribe un comentario..."
                        className="flex-1 outline-none"
                        style={{
                          fontSize: '12px', background: 'transparent',
                          color: '#050505', borderBottom: '1px solid #E4E4E4',
                          paddingBottom: '6px',
                        }}
                        onFocus={e => { e.currentTarget.style.borderBottomColor = '#3070A8'; }}
                        onBlur={e =>  { e.currentTarget.style.borderBottomColor = '#E4E4E4'; }}
                      />
                    </div>
                  </div>
                </TabsContent>

                {/* Activity */}
                <TabsContent value="activities" className="mt-4">
                  <div style={{ position: 'relative', paddingLeft: '2px' }}>
                    <div style={{ position: 'absolute', left: '11px', top: '12px', bottom: '12px', width: '1px', background: '#EFEFEF' }} />
                    {MOCK_ACTIVITY.map(item => (
                      <div key={item.id} style={{ display: 'flex', gap: '12px', paddingBottom: '18px' }}>
                        <div
                          style={{
                            position: 'relative', zIndex: 1,
                            height: '24px', width: '24px', borderRadius: '50%',
                            background: '#FFFFFF', border: '2px solid #EFEFEF',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                          }}
                        >
                          <Activity className="h-2.5 w-2.5" style={{ color: '#C0C0C8' }} />
                        </div>
                        <div style={{ flex: 1, paddingTop: '3px' }}>
                          <p style={{ fontSize: '12px', color: '#575456', lineHeight: 1.5 }}>
                            <span style={{ fontWeight: 700, color: '#050505' }}>{item.user}</span>
                            {' '}{item.text}
                          </p>
                          <p style={{ fontSize: '10px', color: '#ADADAD', marginTop: '2px' }}>{item.time}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </TabsContent>
              </Tabs>

              {/* Footer actions */}
              <div
                style={{
                  display: 'flex', gap: '8px', paddingTop: '8px',
                  borderTop: '1px solid #F0F0F0', flexWrap: 'wrap',
                }}
              >
                {[
                  { label: '+ Nueva subtarea' },
                  { label: '= Descripción' },
                  { label: '📎 Adjuntar' },
                  { label: '+ Asignar' },
                ].map(action => (
                  <button
                    key={action.label}
                    style={{
                      padding: '6px 12px', borderRadius: '8px', fontSize: '11px', fontWeight: 500,
                      color: '#9C9CAA', background: '#F6F6F6', border: '1px solid #EEEEEE',
                      cursor: 'pointer', transition: 'all 150ms ease',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.background = '#EFEFEF'; e.currentTarget.style.color = '#575456'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = '#F6F6F6'; e.currentTarget.style.color = '#9C9CAA'; }}
                  >
                    {action.label}
                  </button>
                ))}
              </div>
            </div>
          </ScrollArea>
        </div>
      ) : (
        /* Empty right panel */
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#FAFAFA' }}>
          <div style={{ textAlign: 'center' }}>
            <div
              style={{
                height: '64px', width: '64px', borderRadius: '18px',
                background: '#F0F0F0', display: 'flex', alignItems: 'center',
                justifyContent: 'center', margin: '0 auto 16px',
              }}
            >
              <ChevronRight className="h-7 w-7" style={{ color: '#C8C8D0' }} />
            </div>
            <p style={{ fontSize: '13px', fontWeight: 600, color: '#9C9CAA' }}>Seleccioná una tarea</p>
            <p style={{ fontSize: '11px', color: '#C0C0C8', marginTop: '4px' }}>para ver el detalle completo</p>
          </div>
        </div>
      )}
    </div>
  );
}
