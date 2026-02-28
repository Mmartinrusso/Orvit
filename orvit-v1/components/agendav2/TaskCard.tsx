'use client';

import { MessageSquare, Link2, MoreHorizontal, AlertCircle, Check, Pencil } from 'lucide-react';
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

// Colored bar-chart SVG per category (matches Synchro screenshot)
function CategoryBarChart({ color }: { color: string }) {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ flexShrink: 0 }}>
      <rect x="1"   y="9"  width="2.2" height="4.5" rx="0.5" fill={color} opacity="0.5" />
      <rect x="4.3" y="6"  width="2.2" height="7.5" rx="0.5" fill={color} opacity="0.75" />
      <rect x="7.6" y="3"  width="2.2" height="10.5" rx="0.5" fill={color} />
      <rect x="10.9" y="6.5" width="2.2" height="7" rx="0.5" fill={color} opacity="0.6" />
    </svg>
  );
}

// Category → chart color (matches Synchro color coding)
const CATEGORY_COLOR: Record<string, string> = {
  'ABC Dashboard':   '#E05A4C',
  'Sinen Dashboard': '#568177',
  'Twinkle Website': '#3070A8',
  'Sosro Mobile App':'#3070A8',
  'Lumino Project':  '#907840',
  'Nila Project':    '#575456',
};

// Mock comment/attachment counts per category (matches screenshot values)
const CATEGORY_COUNTS: Record<string, { comments: number; links: number }> = {
  'ABC Dashboard':   { comments: 3,  links: 2 },
  'Sinen Dashboard': { comments: 14, links: 4 },
  'Twinkle Website': { comments: 7,  links: 1 },
  'Sosro Mobile App':{ comments: 5,  links: 2 },
  'Lumino Project':  { comments: 2,  links: 1 },
  'Nila Project':    { comments: 4,  links: 3 },
};

const STATUS_MOVE_LABEL: Record<AgendaTaskStatus, string> = {
  PENDING:    'Por hacer',
  IN_PROGRESS:'En progreso',
  WAITING:    'En revisión',
  COMPLETED:  'Completado',
  CANCELLED:  'Cancelado',
};

const STATUS_BAR_COLOR: Record<AgendaTaskStatus, string> = {
  PENDING:    '#E4E4E4',
  IN_PROGRESS:'#568177',
  WAITING:    '#568177',
  COMPLETED:  '#568177',
  CANCELLED:  '#E4E4E4',
};

// Exact progress values matching Synchro screenshot
const STATUS_PROGRESS: Record<AgendaTaskStatus, number> = {
  PENDING:    0,
  IN_PROGRESS:25,
  WAITING:    55,
  COMPLETED:  100,
  CANCELLED:  0,
};

// Map demo user names to consistent pravatar.cc photo IDs
const AVATAR_PHOTO: Record<string, string> = {
  'Joe Doe':    'https://i.pravatar.cc/40?img=12',
  'Jhon Els':   'https://i.pravatar.cc/40?img=3',
  'Nando Endae':'https://i.pravatar.cc/40?img=8',
};

function getAvatarUrl(name: string) {
  return AVATAR_PHOTO[name] ?? `https://i.pravatar.cc/40?u=${encodeURIComponent(name)}`;
}

interface TaskCardProps {
  task: AgendaTask;
  onClick: (task: AgendaTask) => void;
  onStatusChange?: (task: AgendaTask, status: AgendaTaskStatus) => void;
  onDelete?: (task: AgendaTask) => void;
  onEdit?: (task: AgendaTask) => void;
  progress?: number;
  isSelectMode?: boolean;
  isSelected?: boolean;
  onSelect?: (id: number) => void;
  animationDelay?: number;
}

export function TaskCard({ task, onClick, onStatusChange, onDelete, onEdit, progress, isSelectMode, isSelected, onSelect, animationDelay = 0 }: TaskCardProps) {
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

  const groupLabel   = task.category || 'General';
  const chartColor   = CATEGORY_COLOR[groupLabel] ?? '#9C9CAA';
  const mockCounts   = CATEGORY_COUNTS[groupLabel] ?? { comments: 1, links: 1 };
  const displayProgress = progress !== undefined ? progress : STATUS_PROGRESS[task.status];
  const barFill      = STATUS_BAR_COLOR[task.status];

  const availableStatuses: AgendaTaskStatus[] = ['PENDING', 'IN_PROGRESS', 'WAITING', 'COMPLETED', 'CANCELLED'];

  return (
    /* Outer: DnD positioning only */
    <div ref={setNodeRef} style={style}>
      <style>{`
        @keyframes card-cascade-in {
          from { transform: translate(-10px, -10px); opacity: 0; }
          to   { transform: translate(0, 0);          opacity: 1; }
        }
      `}</style>
      {/* Inner: visual card + diagonal cascade animation on mount */}
      <div
        style={{
          position: 'relative',
          background: isSelected ? '#EBF2FB' : '#FFFFFF',
          border: `1px solid ${isSelected ? '#3070A8' : '#E8E8E8'}`,
          borderRadius: '16px',
          padding: '16px',
          cursor: 'pointer',
          userSelect: 'none',
          boxShadow: '0 1px 4px rgba(0,0,0,.05)',
          animationName: 'card-cascade-in',
          animationDuration: '1300ms',
          animationTimingFunction: 'cubic-bezier(0.22,1,0.36,1)',
          animationFillMode: 'both',
          animationDelay: `${animationDelay}ms`,
          transition: 'background 120ms ease, border-color 120ms ease, box-shadow 150ms ease',
        }}
        {...(isSelectMode ? {} : { ...attributes, ...listeners })}
        onClick={() => {
          if (isSelectMode) {
            onSelect?.(task.id);
          } else {
            onClick(task);
          }
        }}
        onMouseEnter={e => {
          e.currentTarget.style.boxShadow = '0 4px 14px rgba(0,0,0,.09)';
          e.currentTarget.style.borderColor = '#D8D8D8';
        }}
        onMouseLeave={e => {
          e.currentTarget.style.boxShadow = '0 1px 4px rgba(0,0,0,.05)';
          e.currentTarget.style.borderColor = '#E8E8E8';
        }}
      >
      {/* Select mode checkbox overlay */}
      {isSelectMode && (
        <div
          style={{ position: 'absolute', top: '10px', left: '10px', zIndex: 10 }}
          onClick={e => { e.stopPropagation(); onSelect?.(task.id); }}
        >
          <div style={{
            width: '18px', height: '18px', borderRadius: '5px',
            border: `2px solid ${isSelected ? '#3070A8' : '#CCCCCC'}`,
            background: isSelected ? '#3070A8' : '#FFFFFF',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'all 120ms ease',
          }}>
            {isSelected && <Check className="h-2.5 w-2.5" style={{ color: '#FFFFFF' }} />}
          </div>
        </div>
      )}

      {/* Row 1: project/category name + menu */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px', marginBottom: '10px', paddingLeft: isSelectMode ? '22px' : '0', transition: 'padding 150ms ease' }}>
        <span style={{ fontSize: '14px', fontWeight: 700, color: '#050505', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
          {groupLabel}
        </span>
        <DropdownMenu>
          <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
            <button
              style={{ height: '20px', width: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '6px', border: 'none', background: 'transparent', color: '#9C9CAA', cursor: 'pointer', flexShrink: 0 }}
              onMouseEnter={e => { e.currentTarget.style.background = '#F6F6F6'; e.currentTarget.style.color = '#575456'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#9C9CAA'; }}
            >
              <MoreHorizontal className="h-3.5 w-3.5" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44">
            <DropdownMenuItem className="text-xs" onClick={(e) => { e.stopPropagation(); onEdit?.(task); }}>
              <Pencil className="h-3 w-3 mr-2" /> Editar tarea
            </DropdownMenuItem>
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

      {/* Row 2: colored chart icon + date pill */}
      {task.dueDate && (
        <div style={{ marginBottom: '12px' }}>
          <div
            style={{
              display: 'inline-flex', alignItems: 'center', gap: '6px',
              padding: '4px 10px',
              border: '1px solid #E8E8E8',
              borderRadius: '999px',
              background: isOverdue ? '#FAF7F7' : '#FFFFFF',
            }}
          >
            {isOverdue
              ? <AlertCircle className="h-3 w-3" style={{ color: '#B09098', flexShrink: 0 }} />
              : <CategoryBarChart color={chartColor} />
            }
            <span style={{ fontSize: '11px', fontWeight: 500, color: isOverdue ? '#A08088' : '#9C9CAA', whiteSpace: 'nowrap' }}>
              {format(new Date(task.dueDate), 'MMM dd, yyyy')}
            </span>
          </div>
        </div>
      )}

      {/* Divider */}
      <div style={{ borderTop: '1px solid #F0F0F0', marginBottom: '12px' }} />

      {/* Row 3: task title */}
      <p className="line-clamp-2" style={{ fontSize: '13px', fontWeight: 700, color: '#1A1A1A', lineHeight: 1.4, marginBottom: '14px' }}>
        {task.title}
      </p>

      {/* Row 4: progress bar */}
      <div style={{ marginBottom: '12px' }}>
        <div style={{ width: '100%', height: '5px', borderRadius: '999px', background: '#EBEBEB', overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${displayProgress}%`, borderRadius: '999px', background: barFill, transition: 'width 500ms ease' }} />
        </div>
        <p style={{ fontSize: '11px', color: '#9C9CAA', marginTop: '5px' }}>
          <span style={{ fontWeight: 700, color: '#6B6B78' }}>Progreso</span> : {displayProgress}%
        </p>
      </div>

      {/* Row 5: avatars + comment/link counts */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        {/* Avatar group */}
        <div style={{ display: 'flex', alignItems: 'center' }}>
          {hasAssignee && (
            <Avatar style={{ height: '28px', width: '28px', border: '2px solid #FFFFFF', boxShadow: '0 1px 3px rgba(0,0,0,.12)' }}>
              <AvatarImage src={getAvatarUrl(assigneeName)} />
              <AvatarFallback style={{ background: '#D0E0F0', color: '#3070A8', fontSize: '9px', fontWeight: 700 }}>
                {assigneeName.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
          )}
          <Avatar style={{ height: '28px', width: '28px', border: '2px solid #FFFFFF', marginLeft: hasAssignee ? '-8px' : '0', boxShadow: '0 1px 3px rgba(0,0,0,.12)' }}>
            <AvatarImage src={getAvatarUrl(task.createdBy.name)} />
            <AvatarFallback style={{ background: '#D0EFE0', color: '#568177', fontSize: '9px', fontWeight: 700 }}>
              {task.createdBy.name.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
        </div>

        {/* Counts */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', color: '#050505' }}>
            <MessageSquare className="h-[13px] w-[13px]" />
            {mockCounts.comments}
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', color: '#050505' }}>
            <Link2 className="h-[13px] w-[13px]" />
            {mockCounts.links}
          </span>
        </div>
      </div>
      </div>
    </div>
  );
}
