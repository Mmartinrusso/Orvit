'use client';

import { MessageSquare } from 'lucide-react';
import { ProgressRing } from './ProgressRing';
import type { AgendaTask } from '@/lib/agenda/types';

interface TaskCardMobileProps {
  task: AgendaTask;
  onTap: (task: AgendaTask) => void;
  onToggleComplete: (taskId: number) => void;
}

export function TaskCardMobile({ task, onTap, onToggleComplete }: TaskCardMobileProps) {
  const subtasks = task.subtasks ?? [];
  const subtaskCount = task._count?.subtasks ?? subtasks.length;
  const completedSubtasks = task._count?.subtasksDone ?? subtasks.filter((s) => s.done).length;
  const progress = subtaskCount > 0 ? Math.round((completedSubtasks / subtaskCount) * 100) : 0;
  const commentCount = task._count?.comments ?? task.comments?.length ?? 0;
  const isDone = task.status === 'COMPLETED';
  const groupName = task.group?.name ?? null;

  return (
    <div
      onClick={() => onTap(task)}
      className="mx-4 mb-2 rounded-2xl active:scale-[0.98] transition-transform cursor-pointer"
      style={{
        backgroundColor: '#FFFFFF',
        boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
        padding: '14px 16px',
      }}
    >
      <div className="flex items-start gap-3">
        {/* Content */}
        <div className="flex-1 min-w-0">
          {groupName && (
            <span
              className="block mb-1"
              style={{ fontSize: '11px', fontWeight: 500, color: '#94a3b8' }}
            >
              {groupName}
            </span>
          )}
          <p
            style={{
              fontSize: '14px',
              fontWeight: 600,
              lineHeight: '1.35',
              color: isDone ? '#94a3b8' : '#0f172a',
              textDecoration: isDone ? 'line-through' : 'none',
            }}
            className="line-clamp-2"
          >
            {task.title}
          </p>

          {/* Footer meta */}
          {(subtaskCount > 0 || commentCount > 0) && (
            <div className="flex items-center gap-3 mt-2">
              {subtaskCount > 0 && (
                <span
                  style={{
                    fontSize: '11px',
                    color: '#94a3b8',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '3px',
                  }}
                >
                  <span style={{ fontSize: '10px' }}>✓</span>
                  {completedSubtasks}/{subtaskCount}
                </span>
              )}
              {commentCount > 0 && (
                <span
                  style={{
                    fontSize: '11px',
                    color: '#94a3b8',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '3px',
                  }}
                >
                  <MessageSquare className="h-3 w-3" />
                  {commentCount}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Right side: ProgressRing + checkbox */}
        <div className="flex items-center gap-2 shrink-0">
          {subtaskCount > 0 && (
            <div onClick={(e) => e.stopPropagation()}>
              <ProgressRing percent={progress} size={34} />
            </div>
          )}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggleComplete(task.id);
            }}
            className="rounded flex items-center justify-center transition-colors active:scale-95"
            style={{
              width: '20px',
              height: '20px',
              border: isDone ? 'none' : '2px solid #d1d5db',
              backgroundColor: isDone ? '#10b981' : 'transparent',
              flexShrink: 0,
            }}
          >
            {isDone && (
              <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                <path
                  d="M1 4l3 3 5-6"
                  stroke="white"
                  strokeWidth="1.75"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
