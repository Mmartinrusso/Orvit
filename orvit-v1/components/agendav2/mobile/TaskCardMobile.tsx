'use client';

import { memo } from 'react';
import { ListChecks, MessageSquare } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import type { AgendaTask } from '@/lib/agenda/types';
import { isTaskOverdue, getAssigneeName } from '@/lib/agenda/types';

interface TaskCardMobileProps {
  task: AgendaTask;
  onTap: (task: AgendaTask) => void;
  onToggleComplete: (taskId: number) => void;
}

/* ── Tiny progress ring (SVG) ──────────────────────────────── */
function MiniProgressRing({ pct, size = 28 }: { pct: number; size?: number }) {
  const stroke = 2.5;
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (pct / 100) * circ;
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke}
          className="stroke-muted" />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke}
          strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
          className={pct >= 100 ? 'stroke-emerald-500' : 'stroke-primary'}
          style={{ transition: 'stroke-dashoffset 400ms ease' }} />
      </svg>
      <span className={cn(
        'absolute inset-0 flex items-center justify-center text-[8px] font-bold tabular-nums',
        pct >= 100 ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground',
      )}>
        {pct}%
      </span>
    </div>
  );
}

export const TaskCardMobile = memo(function TaskCardMobile({
  task,
  onTap,
  onToggleComplete,
}: TaskCardMobileProps) {
  const subtaskCount = task._count?.subtasks ?? task.subtasks?.length ?? 0;
  const subtasksDone = task._count?.subtasksDone ?? task.subtasks?.filter((s) => s.done).length ?? 0;
  const progress = subtaskCount > 0 ? Math.round((subtasksDone / subtaskCount) * 100) : task.status === 'COMPLETED' ? 100 : 0;
  const commentCount = task._count?.comments ?? task.comments?.length ?? 0;
  const isDone = task.status === 'COMPLETED';
  const overdue = isTaskOverdue(task);

  const groupLabel = task.group?.name ?? task.category ?? null;
  const descPreview = task.description
    ? task.description.replace(/\n/g, ' ').slice(0, 90) + (task.description.length > 90 ? '…' : '')
    : null;

  const hasFooter = subtaskCount > 0 || commentCount > 0;

  return (
    <div
      onClick={() => onTap(task)}
      className={cn(
        'mx-4 rounded-xl bg-card border border-border',
        'active:scale-[0.98] transition-all duration-150 cursor-pointer',
        'shadow-[0_2px_8px_rgba(0,0,0,0.06)]',
        overdue && 'border-red-200 dark:border-red-900/60',
        isDone && 'opacity-50',
      )}
    >
      <div className="py-3.5 px-4">
        {/* Top section: content left + checkbox right */}
        <div className="flex gap-3">
          {/* Left content */}
          <div className="flex-1 min-w-0">
            {/* Group / Category label */}
            {groupLabel && (
              <p className="text-[11px] text-muted-foreground mb-1 truncate">
                {groupLabel}
              </p>
            )}

            {/* Title */}
            <p className={cn(
              'text-[14px] font-bold leading-[1.35] line-clamp-2',
              isDone ? 'line-through text-muted-foreground' : 'text-foreground',
            )}>
              {task.title}
            </p>

            {/* Description */}
            {descPreview && !isDone && (
              <p className="text-[12px] text-muted-foreground/60 leading-relaxed line-clamp-2 mt-0.5">
                {descPreview}
              </p>
            )}
          </div>

          {/* Checkbox */}
          <button
            onClick={(e) => { e.stopPropagation(); onToggleComplete(task.id); }}
            className={cn(
              'shrink-0 mt-1 w-[22px] h-[22px] rounded-md border-[1.5px] transition-all duration-200',
              'flex items-center justify-center',
              isDone
                ? 'bg-foreground border-foreground'
                : 'border-gray-300 dark:border-gray-600 hover:border-foreground/40',
            )}
          >
            {isDone && (
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <path d="M2.5 6L5 8.5L9.5 3.5" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                  className="stroke-background" />
              </svg>
            )}
          </button>
        </div>

        {/* Footer: subtasks + comments + progress ring */}
        {hasFooter && (
          <div className="flex items-center justify-between mt-3 pt-2.5 border-t border-border/30">
            {/* Left: metadata */}
            <div className="flex items-center gap-3">
              {subtaskCount > 0 && (
                <span className="text-[11px] text-muted-foreground flex items-center gap-1.5">
                  <ListChecks className="h-3 w-3" />
                  <span>
                    <span className="font-semibold text-foreground/70">{subtasksDone}/{subtaskCount}</span>
                    {' '}completadas
                  </span>
                </span>
              )}

              {commentCount > 0 && (
                <span className="text-[11px] text-muted-foreground flex items-center gap-1.5">
                  <MessageSquare className="h-3 w-3" />
                  <span>{commentCount}</span>
                </span>
              )}

              {!subtaskCount && task.dueDate && (
                <span className={cn(
                  'text-[11px] flex items-center gap-1',
                  overdue ? 'text-red-500 font-semibold' : 'text-muted-foreground',
                )}>
                  {format(new Date(task.dueDate), 'd MMM', { locale: es })}
                </span>
              )}
            </div>

            {/* Right: progress ring */}
            {subtaskCount > 0 && (
              <MiniProgressRing pct={progress} />
            )}
          </div>
        )}

        {/* Date line for cards without subtasks/comments */}
        {!hasFooter && task.dueDate && (
          <p className={cn(
            'text-[11px] mt-2',
            overdue ? 'text-red-500 font-semibold' : 'text-muted-foreground',
          )}>
            {format(new Date(task.dueDate), 'd MMM yyyy', { locale: es })}
          </p>
        )}
      </div>
    </div>
  );
});
