'use client';

import { useState } from 'react';
import { format, isPast, isToday } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  CircleDot, Loader2, Asterisk, ClipboardCheck, Circle,
  ChevronDown, Plus, Calendar, AlertCircle,
} from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import type { AgendaTask, AgendaTaskStatus, Priority } from '@/lib/agenda/types';
import { getAssigneeName } from '@/lib/agenda/types';

// ── Design tokens ──────────────────────────────────────────────────────────────

const PRIORITY_CONFIG: Record<Priority, { label: string; bg: string; text: string }> = {
  LOW:    { label: 'Baja',    bg: '#F0F0F0', text: '#575456' },
  MEDIUM: { label: 'Media',   bg: '#D0E0F0', text: '#3070A8' },
  HIGH:   { label: 'Alta',    bg: '#F9F0DB', text: '#907840' },
  URGENT: { label: 'Urgente', bg: '#F9E4E2', text: '#C05060' },
};

const STATUS_SECTIONS: {
  status: AgendaTaskStatus;
  label: string;
  icon: typeof Circle;
  iconColor: string;
  sectionBg: string;
}[] = [
  { status: 'PENDING',     label: 'Por hacer',   icon: CircleDot,      iconColor: '#8A8A98', sectionBg: '#F4F4F6' },
  { status: 'IN_PROGRESS', label: 'En progreso', icon: Loader2,        iconColor: '#5880A8', sectionBg: '#EEF3F8' },
  { status: 'WAITING',     label: 'En revisión', icon: Asterisk,       iconColor: '#8A7840', sectionBg: '#F5F2EA' },
  { status: 'COMPLETED',   label: 'Completado',  icon: ClipboardCheck, iconColor: '#508070', sectionBg: '#EDF4F0' },
];

// ── TaskRow ────────────────────────────────────────────────────────────────────

function TaskRow({
  task,
  onClick,
  index,
}: {
  task: AgendaTask;
  onClick: (t: AgendaTask) => void;
  index: number;
}) {
  const [hovered, setHovered] = useState(false);

  const assigneeName = getAssigneeName(task);
  const hasAssignee  = assigneeName !== 'Sin asignar';
  const priorityConf = PRIORITY_CONFIG[task.priority];
  const isOverdue    = task.dueDate && !['COMPLETED', 'CANCELLED'].includes(task.status) && isPast(new Date(task.dueDate));
  const isDueToday   = task.dueDate && isToday(new Date(task.dueDate));
  const initials     = hasAssignee
    ? assigneeName.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase()
    : null;

  return (
    <div
      onClick={() => onClick(task)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        padding: '10px 14px',
        borderRadius: '12px',
        cursor: 'pointer',
        background: hovered ? '#F5F5F5' : 'transparent',
        borderBottom: '1px solid #F0F0F0',
        transition: 'background 100ms ease',
        animationName: 'row-slide-in',
        animationDuration: '280ms',
        animationTimingFunction: 'cubic-bezier(0.22,1,0.36,1)',
        animationFillMode: 'both',
        animationDelay: `${index * 35}ms`,
      }}
    >
      {/* Title — flex-1, truncate */}
      <span
        style={{
          flex: 1,
          fontSize: '13px',
          fontWeight: 500,
          color: task.status === 'COMPLETED' ? '#9C9CAA' : '#050505',
          textDecoration: task.status === 'COMPLETED' ? 'line-through' : 'none',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {task.title}
      </span>

      {/* Category pill */}
      {task.category && (
        <span
          style={{
            fontSize: '11px',
            color: '#9C9CAA',
            background: '#F0F0F0',
            padding: '2px 8px',
            borderRadius: '20px',
            whiteSpace: 'nowrap',
            flexShrink: 0,
          }}
        >
          {task.category}
        </span>
      )}

      {/* Priority chip */}
      <span
        style={{
          fontSize: '11px',
          fontWeight: 600,
          padding: '2px 8px',
          borderRadius: '999px',
          background: priorityConf.bg,
          color: priorityConf.text,
          flexShrink: 0,
          whiteSpace: 'nowrap',
        }}
      >
        {priorityConf.label}
      </span>

      {/* Due date */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
          flexShrink: 0,
          minWidth: '56px',
        }}
      >
        {task.dueDate ? (
          <>
            {isOverdue
              ? <AlertCircle className="h-3 w-3" style={{ color: '#ED8A94' }} />
              : <Calendar className="h-3 w-3" style={{ color: isDueToday ? '#907840' : '#9C9CAA' }} />
            }
            <span
              style={{
                fontSize: '11px',
                fontWeight: 500,
                color: isOverdue ? '#ED8A94' : isDueToday ? '#907840' : '#9C9CAA',
                whiteSpace: 'nowrap',
              }}
            >
              {format(new Date(task.dueDate), 'd MMM', { locale: es })}
            </span>
          </>
        ) : null}
      </div>

      {/* Assignee avatar */}
      <div style={{ width: '26px', height: '26px', flexShrink: 0 }}>
        {hasAssignee && (
          <Avatar style={{ height: '26px', width: '26px' }}>
            <AvatarFallback
              style={{ background: '#D0E0F0', color: '#3070A8', fontSize: '8px', fontWeight: 700 }}
            >
              {initials}
            </AvatarFallback>
          </Avatar>
        )}
      </div>
    </div>
  );
}

// ── FixedTasksView ────────────────────────────────────────────────────────────

interface FixedTasksViewProps {
  tasks: AgendaTask[];
  onTaskClick: (task: AgendaTask) => void;
  onCreateTask: (status: AgendaTaskStatus) => void;
  isLoading?: boolean;
}

export function FixedTasksView({ tasks, onTaskClick, onCreateTask, isLoading }: FixedTasksViewProps) {
  const [collapsed, setCollapsed] = useState<Partial<Record<AgendaTaskStatus, boolean>>>({});

  const sections = STATUS_SECTIONS.map(s => ({
    ...s,
    tasks: tasks.filter(t => t.status === s.status),
  }));

  if (isLoading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {[1, 2, 3, 4, 5, 6].map(i => (
          <div
            key={i}
            className="animate-pulse"
            style={{ height: '40px', borderRadius: '12px', background: '#E8E8E8' }}
          />
        ))}
      </div>
    );
  }

  return (
    <>
      <style>{`
        @keyframes row-slide-in {
          from { opacity: 0; transform: translateY(-5px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {sections.map(section => {
          const Icon = section.icon;
          const isCollapsed = !!collapsed[section.status];

          return (
            <div
              key={section.status}
              style={{
                background: '#FFFFFF',
                border: '1px solid #EEEEEE',
                borderRadius: '16px',
                overflow: 'hidden',
              }}
            >
              {/* Section header */}
              <button
                onClick={() => setCollapsed(prev => ({ ...prev, [section.status]: !prev[section.status] }))}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '10px 14px',
                  background: section.sectionBg,
                  border: 'none',
                  cursor: 'pointer',
                  borderBottom: isCollapsed ? 'none' : '1px solid #E8E8E8',
                  transition: 'background 120ms ease',
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = section.sectionBg; }}
              >
                <ChevronDown
                  className="h-3.5 w-3.5 shrink-0"
                  style={{
                    color: '#9C9CAA',
                    transform: isCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)',
                    transition: 'transform 200ms ease',
                  }}
                />
                <Icon
                  className="h-3.5 w-3.5 shrink-0"
                  style={{ color: section.iconColor }}
                />
                <span style={{ fontSize: '13px', fontWeight: 600, color: section.iconColor }}>
                  {section.label}
                </span>
                <span
                  style={{
                    fontSize: '11px',
                    fontWeight: 700,
                    color: '#FFFFFF',
                    background: section.iconColor,
                    padding: '1px 7px',
                    borderRadius: '999px',
                    marginLeft: '2px',
                  }}
                >
                  {section.tasks.length}
                </span>
              </button>

              {/* Collapsible content */}
              <div
                style={{
                  overflow: 'hidden',
                  maxHeight: isCollapsed ? '0' : '9999px',
                  opacity: isCollapsed ? 0 : 1,
                  transition: 'max-height 220ms ease, opacity 150ms ease',
                }}
              >
                {/* Column headers */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    padding: '6px 14px',
                    borderBottom: '1px solid #F4F4F4',
                  }}
                >
                  <span style={{ flex: 1, fontSize: '10px', fontWeight: 600, color: '#C0C0C8', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    Tarea
                  </span>
                  <span style={{ fontSize: '10px', fontWeight: 600, color: '#C0C0C8', textTransform: 'uppercase', letterSpacing: '0.06em', minWidth: '80px' }}>
                    Categoría
                  </span>
                  <span style={{ fontSize: '10px', fontWeight: 600, color: '#C0C0C8', textTransform: 'uppercase', letterSpacing: '0.06em', minWidth: '60px' }}>
                    Prioridad
                  </span>
                  <span style={{ fontSize: '10px', fontWeight: 600, color: '#C0C0C8', textTransform: 'uppercase', letterSpacing: '0.06em', minWidth: '56px' }}>
                    Fecha
                  </span>
                  <span style={{ fontSize: '10px', fontWeight: 600, color: '#C0C0C8', textTransform: 'uppercase', letterSpacing: '0.06em', width: '26px' }}>
                    Asig.
                  </span>
                </div>

                {/* Rows */}
                {section.tasks.length === 0 ? (
                  <div style={{ padding: '14px', textAlign: 'center' }}>
                    <p style={{ fontSize: '12px', color: '#C4C4C4' }}>
                      Sin tareas en esta sección
                    </p>
                  </div>
                ) : (
                  section.tasks.map((task, idx) => (
                    <TaskRow
                      key={task.id}
                      task={task}
                      onClick={onTaskClick}
                      index={idx}
                    />
                  ))
                )}

                {/* Add task footer */}
                <button
                  onClick={() => onCreateTask(section.status)}
                  style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '10px 14px',
                    background: 'none',
                    border: 'none',
                    borderTop: '1px dashed #E8E8E8',
                    cursor: 'pointer',
                    fontSize: '12px',
                    color: '#B0B0BC',
                    transition: 'color 120ms ease, background 120ms ease',
                  }}
                  onMouseEnter={e => {
                    (e.currentTarget as HTMLButtonElement).style.color = '#575456';
                    (e.currentTarget as HTMLButtonElement).style.background = '#FAFAFA';
                  }}
                  onMouseLeave={e => {
                    (e.currentTarget as HTMLButtonElement).style.color = '#B0B0BC';
                    (e.currentTarget as HTMLButtonElement).style.background = 'none';
                  }}
                >
                  <Plus className="h-3 w-3" />
                  Agregar tarea
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
