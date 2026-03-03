'use client';

import { MessageSquare, MoreHorizontal, AlertCircle, Check, Pencil, ClipboardList, Copy } from 'lucide-react';
import { format, isPast } from 'date-fns';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import type { AgendaTask, AgendaTaskStatus } from '@/lib/agenda/types';
import { getAssigneeName } from '@/lib/agenda/types';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';


const STATUS_MOVE_LABEL: Record<AgendaTaskStatus, string> = {
  PENDING:    'Por hacer',
  IN_PROGRESS:'En progreso',
  WAITING:    'En revisión',
  COMPLETED:  'Completado',
  CANCELLED:  'Cancelado',
};

// Status dot color for top row
const STATUS_DOT: Record<AgendaTaskStatus, string> = {
  PENDING:    '#9CA3AF',
  IN_PROGRESS:'#7C3AED',
  WAITING:    '#D97706',
  COMPLETED:  '#059669',
  CANCELLED:  '#E5E7EB',
};


interface TaskCardProps {
  task: AgendaTask;
  onClick: (task: AgendaTask) => void;
  onStatusChange?: (task: AgendaTask, status: AgendaTaskStatus) => void;
  onDelete?: (task: AgendaTask) => void;
  onEdit?: (task: AgendaTask) => void;
  onDuplicate?: (task: AgendaTask) => Promise<void>;
  progress?: number;
  isSelectMode?: boolean;
  isSelected?: boolean;
  onSelect?: (id: number) => void;
  animationDelay?: number;
  isNew?: boolean;
}

export function TaskCard({ task, onClick, onStatusChange, onDelete, onEdit, onDuplicate, isSelectMode, isSelected, onSelect, animationDelay = 0, isNew = false }: TaskCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging: isSortableDragging,
  } = useSortable({ id: task.id.toString() });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isSortableDragging ? 0.4 : 1,
  };

  const isOverdue = task.dueDate &&
    !['COMPLETED', 'CANCELLED'].includes(task.status) &&
    isPast(new Date(task.dueDate));

  const assigneeName = getAssigneeName(task);
  const hasAssignee = assigneeName !== 'Sin asignar';

  const commentCount = task._count?.comments ?? 0;
  const subtasks = { total: task._count?.subtasks ?? 0, done: task._count?.subtasksDone ?? 0 };

  const availableStatuses: AgendaTaskStatus[] = ['PENDING', 'IN_PROGRESS', 'WAITING', 'COMPLETED', 'CANCELLED'];

  return (
    <div ref={setNodeRef} style={style}>
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

      <div
        style={{
          position: 'relative',
          background: isSelected ? '#F5F3FF' : '#FFFFFF',
          border: `1.5px solid ${isSelected ? '#7C3AED' : '#D8D8DE'}`,
          borderRadius: '8px',
          padding: '16px 18px',
          cursor: 'pointer',
          userSelect: 'none',
          boxShadow: '0 1px 3px rgba(0,0,0,.06), 0 4px 16px rgba(0,0,0,.07)',
          animationName: isNew ? 'card-new-in' : 'card-cascade-in',
          animationDuration: isNew ? '420ms' : '1300ms',
          animationTimingFunction: 'cubic-bezier(0.22,1,0.36,1)',
          animationFillMode: 'both',
          animationDelay: isNew ? '0ms' : `${animationDelay}ms`,
          transition: 'background 120ms ease, border-color 120ms ease, box-shadow 150ms ease',
        }}
        {...(isSelectMode ? {} : { ...attributes, ...listeners })}
        onClick={() => {
          if (isSelectMode) { onSelect?.(task.id); }
          else { onClick(task); }
        }}
        onMouseEnter={e => {
          e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,.08), 0 8px 28px rgba(0,0,0,.10)';
          e.currentTarget.style.borderColor = isSelected ? '#7C3AED' : '#D8D8E0';
        }}
        onMouseLeave={e => {
          e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,.06), 0 4px 16px rgba(0,0,0,.07)';
          e.currentTarget.style.borderColor = isSelected ? '#7C3AED' : '#E8E8EC';
        }}
      >

        {/* Select checkbox */}
        {isSelectMode && (
          <div
            style={{ position: 'absolute', top: '12px', left: '12px', zIndex: 10 }}
            onClick={e => { e.stopPropagation(); onSelect?.(task.id); }}
          >
            <div style={{
              width: '18px', height: '18px', borderRadius: '5px',
              border: `2px solid ${isSelected ? '#7C3AED' : '#D1D5DB'}`,
              background: isSelected ? '#7C3AED' : '#FFFFFF',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'all 120ms ease',
            }}>
              {isSelected && <Check className="h-2.5 w-2.5" style={{ color: '#FFFFFF' }} />}
            </div>
          </div>
        )}

        {/* ── Row 1: status dot + date + menu ── */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          marginBottom: '10px',
          paddingLeft: isSelectMode ? '24px' : '0',
          transition: 'padding 150ms ease',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '7px', minWidth: 0 }}>
            {/* Status dot */}
            <span style={{
              width: '7px', height: '7px', borderRadius: '50%', flexShrink: 0,
              background: STATUS_DOT[task.status],
            }} />
            {/* Date */}
            {task.dueDate ? (
              <span style={{
                fontSize: '13px', fontWeight: 400,
                color: isOverdue ? '#DC2626' : '#6B7280',
                whiteSpace: 'nowrap',
              }}>
                {isOverdue && <AlertCircle className="h-3 w-3 inline mr-1 mb-0.5" style={{ color: '#DC2626' }} />}
                {format(new Date(task.dueDate), 'dd MMM, yyyy')}
              </span>
            ) : (
              <span style={{ fontSize: '13px', color: '#D1D5DB' }}>Sin fecha</span>
            )}
          </div>

          {/* Menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
              <button
                style={{ height: '22px', width: '22px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '6px', border: 'none', background: 'transparent', color: '#9CA3AF', cursor: 'pointer', flexShrink: 0, transition: 'all 120ms ease' }}
                onMouseEnter={e => { e.currentTarget.style.background = '#F3F4F6'; e.currentTarget.style.color = '#111827'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#9CA3AF'; }}
              >
                <MoreHorizontal className="h-3.5 w-3.5" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              <DropdownMenuItem className="text-xs" onClick={(e) => { e.stopPropagation(); onEdit?.(task); }}>
                <Pencil className="h-3 w-3 mr-2" /> Editar tarea
              </DropdownMenuItem>
              {onDuplicate && (
                <DropdownMenuItem className="text-xs" onClick={(e) => { e.stopPropagation(); onDuplicate(task); }}>
                  <Copy className="h-3 w-3 mr-2" /> Duplicar tarea
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              {availableStatuses.filter(s => s !== task.status).map(s => (
                <DropdownMenuItem key={s} onClick={(e) => { e.stopPropagation(); onStatusChange?.(task, s); }} className="text-xs">
                  Mover a {STATUS_MOVE_LABEL[s]}
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuItem className="text-xs text-destructive focus:text-destructive" onClick={(e) => { e.stopPropagation(); onDelete?.(task); }}>
                Eliminar
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* ── Divider ── */}
        <div style={{ borderTop: '1px solid #E4E4E8', marginBottom: '12px' }} />

        {/* ── Row 2: Title ── */}
        <p className="line-clamp-2" style={{
          fontSize: '18px', fontWeight: 600, color: '#111827',
          lineHeight: 1.3, letterSpacing: '-0.02em',
          marginBottom: task.description ? '6px' : '14px',
        }}>
          {task.title}
        </p>

        {/* ── Row 3: Description ── */}
        {task.description && (
          <p className="line-clamp-2" style={{
            fontSize: '13px', color: '#6B7280',
            lineHeight: 1.55, marginBottom: '14px',
          }}>
            {task.description}
          </p>
        )}

        {/* ── Row 4: Subtask progress — caja con borde (solo si hay subtareas) ── */}
        {subtasks.total > 0 && (
          <div style={{
            background: 'transparent', borderRadius: '8px',
            border: '1px solid #D8D8DE',
            padding: '10px 12px', marginBottom: '14px',
          }}>
            {/* Label row */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                <ClipboardList className="h-3.5 w-3.5" style={{ color: '#9CA3AF', flexShrink: 0 }} />
                <span style={{ fontSize: '12px', fontWeight: 400, color: '#6B7280' }}>Subtareas</span>
              </div>
              <span style={{ fontSize: '12px', fontWeight: 400, color: '#6B7280' }}>
                {subtasks.done}/{subtasks.total}
              </span>
            </div>
            {/* Segmented bar */}
            <div style={{ display: 'flex', gap: '3px' }}>
              {Array.from({ length: subtasks.total }).map((_, i) => (
                <div
                  key={i}
                  style={{
                    flex: 1, height: '5px', borderRadius: '999px',
                    background: i < subtasks.done ? '#111827' : '#E4E4E8',
                    transition: 'background 300ms ease',
                  }}
                />
              ))}
            </div>
          </div>
        )}

        {/* ── Row 5: counts LEFT + avatars RIGHT ── */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          paddingTop: '12px', borderTop: '1px solid #E4E4E8',
        }}>

          {/* Counts — left */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '13px', color: '#6B7280' }}>
              <MessageSquare className="h-4 w-4" />
              {commentCount}
            </span>
          </div>

          {/* Avatars — right */}
          <div style={{ display: 'flex', alignItems: 'center' }}>
            {hasAssignee && (
              <Avatar style={{ height: '26px', width: '26px', border: '2px solid #FFFFFF', boxShadow: '0 1px 3px rgba(0,0,0,.10)' }}>
                <AvatarImage src={task.assignedToUser?.avatar || task.assignedToContact?.avatar || undefined} />
                <AvatarFallback style={{ background: '#EDE9FE', color: '#7C3AED', fontSize: '8px', fontWeight: 700 }}>
                  {assigneeName.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
            )}
            <Avatar style={{ height: '26px', width: '26px', border: '2px solid #FFFFFF', marginLeft: hasAssignee ? '-7px' : '0', boxShadow: '0 1px 3px rgba(0,0,0,.10)' }}>
              <AvatarImage src={task.createdBy.avatar || undefined} />
              <AvatarFallback style={{ background: '#EDE9FE', color: '#7C3AED', fontSize: '8px', fontWeight: 700 }}>
                {task.createdBy.name.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
          </div>
        </div>

      </div>
    </div>
  );
}
