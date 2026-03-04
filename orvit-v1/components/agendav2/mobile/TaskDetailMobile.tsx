'use client';

import { useState } from 'react';
import {
  ArrowLeft,
  Calendar,
  Check,
  Flag,
  MoreVertical,
  Pencil,
  Copy,
  Trash2,
  User,
  FolderDot,
  ListChecks,
  MessageCircle,
} from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { TaskCommentThread } from '../TaskCommentThread';
import { MentionInput } from '../MentionInput';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { isTaskOverdue } from '@/lib/agenda/types';
import type {
  AgendaTask,
  AgendaTaskComment,
  AgendaTaskStatus,
  AgendaSubtask,
} from '@/lib/agenda/types';

interface TaskDetailMobileProps {
  task: AgendaTask;
  members: Array<{ id: number; name: string; avatar?: string | null }>;
  onBack: () => void;
  onRefresh: () => void;
  onStatusChange?: (taskId: number, status: AgendaTaskStatus) => void;
  onEdit?: (task: AgendaTask) => void;
  onDuplicate?: (task: AgendaTask) => void;
  onDelete?: (task: AgendaTask) => void;
}

/* ── Status chip config (same hex as desktop TaskDetailPanel) ── */
const STATUS_CHIP: Record<AgendaTaskStatus, { bg: string; text: string; dot: string; label: string }> = {
  PENDING:     { bg: '#F3F4F6', text: '#6B7280', dot: '#9CA3AF', label: 'Pendiente' },
  IN_PROGRESS: { bg: '#111827', text: '#FFFFFF', dot: '#FFFFFF', label: 'En progreso' },
  WAITING:     { bg: '#FFFBEB', text: '#D97706', dot: '#D97706', label: 'Esperando' },
  COMPLETED:   { bg: '#ECFDF5', text: '#059669', dot: '#059669', label: 'Completada' },
  CANCELLED:   { bg: '#FEE2E2', text: '#DC2626', dot: '#DC2626', label: 'Cancelada' },
};

const PRIORITY_CHIP: Record<string, { bg: string; text: string; label: string }> = {
  LOW:    { bg: '#F3F4F6', text: '#6B7280', label: 'Baja' },
  MEDIUM: { bg: '#EFF6FF', text: '#1D4ED8', label: 'Media' },
  HIGH:   { bg: '#FEF3C7', text: '#D97706', label: 'Alta' },
  URGENT: { bg: '#FEE2E2', text: '#DC2626', label: 'Urgente' },
};

const ALL_STATUSES: AgendaTaskStatus[] = ['PENDING', 'IN_PROGRESS', 'WAITING', 'COMPLETED'];

export function TaskDetailMobile({
  task,
  members,
  onBack,
  onRefresh,
  onStatusChange,
  onEdit,
  onDuplicate,
  onDelete,
}: TaskDetailMobileProps) {
  const [comments, setComments] = useState<AgendaTaskComment[]>(task.comments ?? []);
  const [currentStatus, setCurrentStatus] = useState<AgendaTaskStatus>(task.status);
  const [menuOpen, setMenuOpen] = useState(false);
  const [statusOpen, setStatusOpen] = useState(false);

  const subtasks: AgendaSubtask[] = task.subtasks ?? [];
  const completedSubtaskCount = subtasks.filter((s) => s.done).length;
  const subtaskProgress = subtasks.length > 0 ? (completedSubtaskCount / subtasks.length) * 100 : 0;

  const overdue = isTaskOverdue(task);
  const isDone = currentStatus === 'COMPLETED';
  const assignee = task.assignedToUser ?? task.assignedToContact ?? null;
  const assigneeName = task.assignedToName ?? assignee?.name ?? null;
  const groupName = task.group?.name ?? null;
  const priorityInfo = task.priority ? PRIORITY_CHIP[task.priority] : null;
  const statusInfo = STATUS_CHIP[currentStatus] ?? STATUS_CHIP.PENDING;

  const handleStatusChange = async (status: AgendaTaskStatus) => {
    const previous = currentStatus;
    setCurrentStatus(status);
    setStatusOpen(false);
    if (onStatusChange) {
      try { await onStatusChange(task.id, status); }
      catch { setCurrentStatus(previous); toast.error('Error al cambiar estado'); }
    }
  };

  const handleToggleComplete = () => {
    handleStatusChange(isDone ? 'PENDING' : 'COMPLETED');
  };

  const handleAddComment = async (content: string, mentionedUserIds: number[]) => {
    try {
      const res = await fetch(`/api/agenda/tasks/${task.id}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content, mentionedUserIds }),
      });
      if (!res.ok) throw new Error();
      const newComment: AgendaTaskComment = await res.json();
      setComments((prev) => [...prev, newComment]);
    } catch { toast.error('Error al enviar comentario'); }
  };

  const handleEditComment = async (commentId: number, content: string) => {
    const res = await fetch(`/api/agenda/tasks/${task.id}/comments/${commentId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content }),
    });
    if (!res.ok) throw new Error();
    const updated: AgendaTaskComment = await res.json();
    setComments((prev) => prev.map((c) => (c.id === commentId ? updated : c)));
  };

  const handleDeleteComment = async (commentId: number) => {
    const res = await fetch(`/api/agenda/tasks/${task.id}/comments/${commentId}`, {
      method: 'DELETE',
    });
    if (!res.ok) throw new Error();
    setComments((prev) => prev.filter((c) => c.id !== commentId));
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background">
      {/* ── Header ── */}
      <div
        className="shrink-0 flex items-center gap-3 px-4 py-2 border-b border-border"
        style={{ paddingTop: 'max(env(safe-area-inset-top), 10px)' }}
      >
        <button
          onClick={onBack}
          className="shrink-0 flex items-center justify-center w-8 h-8 rounded-full bg-muted active:scale-90 transition-transform"
        >
          <ArrowLeft className="h-4 w-4 text-foreground" />
        </button>

        <span className="flex-1 text-sm font-medium text-foreground truncate">
          {task.title}
        </span>

        {/* Complete toggle */}
        <button
          onClick={handleToggleComplete}
          className={cn(
            'shrink-0 flex items-center justify-center w-8 h-8 rounded-full active:scale-90 transition-all',
            isDone
              ? 'bg-emerald-500 text-white'
              : 'bg-muted text-muted-foreground hover:text-foreground',
          )}
        >
          <Check className="h-4 w-4" />
        </button>

        {/* 3-dot menu */}
        <div className="relative shrink-0">
          <button
            onClick={() => setMenuOpen((v) => !v)}
            className="flex items-center justify-center w-8 h-8 rounded-full bg-muted active:scale-90 transition-transform"
          >
            <MoreVertical className="h-4 w-4 text-foreground" />
          </button>
          {menuOpen && (
            <>
              <div className="fixed inset-0 z-30" onClick={() => setMenuOpen(false)} />
              <div className="absolute right-0 top-10 z-40 w-44 rounded-xl border border-border bg-popover shadow-lg py-1">
                {onEdit && (
                  <button onClick={() => { setMenuOpen(false); onEdit(task); }} className="flex w-full items-center gap-3 px-3 py-2 text-sm hover:bg-accent transition-colors">
                    <Pencil className="h-3.5 w-3.5 text-muted-foreground" /> Editar
                  </button>
                )}
                {onDuplicate && (
                  <button onClick={() => { setMenuOpen(false); onDuplicate(task); }} className="flex w-full items-center gap-3 px-3 py-2 text-sm hover:bg-accent transition-colors">
                    <Copy className="h-3.5 w-3.5 text-muted-foreground" /> Duplicar
                  </button>
                )}
                {onDelete && (
                  <>
                    <div className="my-1 mx-2 border-t border-border" />
                    <button onClick={() => { setMenuOpen(false); onDelete(task); }} className="flex w-full items-center gap-3 px-3 py-2 text-sm text-destructive hover:bg-destructive/10 transition-colors">
                      <Trash2 className="h-3.5 w-3.5" /> Eliminar
                    </button>
                  </>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── Scrollable content ── */}
      <div className="flex-1 overflow-y-auto pb-[90px]">
        <div className="px-5 pt-3">

          {/* ── Title (full, wraps) ── */}
          <h1 className={cn(
            'text-[16px] font-semibold leading-snug mb-2',
            isDone ? 'text-muted-foreground line-through' : 'text-foreground',
          )}>
            {task.title}
          </h1>

          {/* ── Compact meta: chips row (status + priority + date) ── */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
            {/* Status — tappable */}
            <div className="relative shrink-0">
              <button
                onClick={() => setStatusOpen((v) => !v)}
                className="inline-flex items-center gap-1.5 rounded-md px-2 py-[3px] text-[11px] font-semibold whitespace-nowrap active:scale-95 transition-all"
                style={{ backgroundColor: statusInfo.bg, color: statusInfo.text }}
              >
                <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: statusInfo.dot }} />
                {statusInfo.label}
              </button>
              {statusOpen && (
                <>
                  <div className="fixed inset-0 z-20" onClick={() => setStatusOpen(false)} />
                  <div className="absolute left-0 top-full mt-1 z-30 bg-popover border border-border rounded-xl shadow-lg py-1 min-w-[130px]">
                    {ALL_STATUSES.map((s) => {
                      const info = STATUS_CHIP[s];
                      return (
                        <button
                          key={s}
                          onClick={() => handleStatusChange(s)}
                          className={cn(
                            'flex w-full items-center gap-2 px-3 py-1.5 text-xs font-medium hover:bg-accent transition-colors',
                            currentStatus === s && 'bg-accent',
                          )}
                        >
                          <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: info.dot }} />
                          {info.label}
                        </button>
                      );
                    })}
                  </div>
                </>
              )}
            </div>

            {priorityInfo && (
              <span
                className="shrink-0 inline-flex items-center gap-1 rounded-md px-2 py-[3px] text-[11px] font-medium whitespace-nowrap"
                style={{ backgroundColor: priorityInfo.bg, color: priorityInfo.text }}
              >
                <Flag className="h-2.5 w-2.5" />
                {priorityInfo.label}
              </span>
            )}

            {task.dueDate && (
              <span className={cn(
                'shrink-0 inline-flex items-center gap-1 rounded-md px-2 py-[3px] text-[11px] font-medium whitespace-nowrap',
                overdue ? 'bg-red-50 dark:bg-red-950/30 text-red-500' : 'bg-muted text-muted-foreground',
              )}>
                <Calendar className="h-2.5 w-2.5" />
                {format(new Date(task.dueDate), 'd MMM', { locale: es })}
              </span>
            )}

            {groupName && (
              <span className="shrink-0 inline-flex items-center gap-1 rounded-md px-2 py-[3px] text-[11px] font-medium whitespace-nowrap bg-muted text-muted-foreground">
                <FolderDot className="h-2.5 w-2.5" />
                {groupName}
              </span>
            )}

            {assigneeName && (
              <span className="shrink-0 inline-flex items-center gap-1 rounded-md px-2 py-[3px] text-[11px] font-medium whitespace-nowrap bg-muted text-muted-foreground">
                {assignee?.avatar ? (
                  <img src={assignee.avatar} alt={assigneeName} className="h-3.5 w-3.5 rounded-full object-cover" />
                ) : (
                  <User className="h-2.5 w-2.5" />
                )}
                {assigneeName}
              </span>
            )}
          </div>

          {/* ── Description (compact) ── */}
          {task.description && (
            <p className="text-[13px] text-muted-foreground leading-snug mt-3 border-t border-border/30 pt-3 whitespace-pre-wrap">
              {task.description}
            </p>
          )}

          {/* ── Subtasks (compact) ── */}
          {subtasks.length > 0 && (
            <div className="mt-3 border-t border-border/30 pt-3">
              <div className="flex items-center gap-2 mb-1.5">
                <ListChecks className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-[12px] font-medium text-muted-foreground">
                  Subtareas
                </span>
                <span className="text-[11px] text-muted-foreground/60">
                  {completedSubtaskCount}/{subtasks.length}
                </span>
                {/* Inline mini progress */}
                <div className="flex-1 h-[3px] bg-muted rounded-full overflow-hidden ml-1">
                  <div
                    className="h-full bg-primary rounded-full transition-all duration-300"
                    style={{ width: `${subtaskProgress}%` }}
                  />
                </div>
              </div>

              <div>
                {subtasks.map((sub) => (
                  <div key={sub.id} className="flex items-center gap-2 py-[5px]">
                    <div className={cn(
                      'flex items-center justify-center shrink-0 w-[15px] h-[15px] rounded border-[1.5px] transition-colors',
                      sub.done ? 'bg-primary border-primary' : 'border-gray-300 dark:border-gray-600',
                    )}>
                      {sub.done && <Check className="h-2.5 w-2.5 text-primary-foreground" />}
                    </div>
                    <span className={cn(
                      'text-[13px] leading-tight',
                      sub.done ? 'text-muted-foreground line-through' : 'text-foreground',
                    )}>
                      {sub.title}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Comments (compact header) ── */}
          <div className="mt-3 border-t border-border/30 pt-3">
            <div className="flex items-center gap-2 mb-2">
              <MessageCircle className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-[12px] font-medium text-muted-foreground">
                Comentarios
              </span>
              {comments.length > 0 && (
                <span className="text-[11px] text-muted-foreground/60">{comments.length}</span>
              )}
            </div>
            <TaskCommentThread
              comments={comments}
              onEditComment={handleEditComment}
              onDeleteComment={handleDeleteComment}
            />
          </div>
        </div>
      </div>

      {/* ── Sticky comment input ── */}
      <div
        className="shrink-0 px-4 pt-2 bg-background border-t border-border"
        style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 8px)' }}
      >
        <MentionInput
          onSubmit={handleAddComment}
          members={members}
          placeholder="Comentar..."
        />
      </div>
    </div>
  );
}
