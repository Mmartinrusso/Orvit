'use client';

import { useState } from 'react';
import { ArrowLeft, Calendar, Flag } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { TaskCommentThread } from '../TaskCommentThread';
import { MentionInput } from '../MentionInput';
import { toast } from 'sonner';
import type { AgendaTask, AgendaTaskComment, AgendaSubtask } from '@/lib/agenda/types';

interface TaskDetailMobileProps {
  task: AgendaTask;
  members: Array<{ id: number; name: string; avatar?: string | null }>;
  onBack: () => void;
  onRefresh: () => void;
}

const STATUS_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  PENDING: { label: 'Pendiente', color: '#64748b', bg: '#f1f5f9' },
  IN_PROGRESS: { label: 'En progreso', color: '#2563eb', bg: '#eff6ff' },
  COMPLETED: { label: 'Completada', color: '#16a34a', bg: '#f0fdf4' },
  WAITING: { label: 'En espera', color: '#d97706', bg: '#fffbeb' },
  CANCELLED: { label: 'Cancelada', color: '#dc2626', bg: '#fef2f2' },
};

const PRIORITY_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  LOW: { label: 'Baja', color: '#64748b', bg: '#f1f5f9' },
  MEDIUM: { label: 'Media', color: '#2563eb', bg: '#eff6ff' },
  HIGH: { label: 'Alta', color: '#d97706', bg: '#fffbeb' },
  URGENT: { label: 'Urgente', color: '#dc2626', bg: '#fef2f2' },
};

export function TaskDetailMobile({ task, members, onBack, onRefresh }: TaskDetailMobileProps) {
  const [comments, setComments] = useState<AgendaTaskComment[]>(task.comments ?? []);

  const statusInfo = STATUS_LABELS[task.status] ?? STATUS_LABELS.PENDING;
  const priorityInfo = task.priority ? PRIORITY_LABELS[task.priority] : null;
  const subtasks: AgendaSubtask[] = task.subtasks ?? [];

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
    } catch {
      toast.error('Error al enviar comentario');
    }
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
    <div className="flex flex-col min-h-screen" style={{ backgroundColor: '#F5F3EF' }}>
      {/* Header */}
      <div
        className="flex items-center gap-3 px-4 py-3 sticky top-0 z-10"
        style={{
          backgroundColor: '#FFFFFF',
          borderBottom: '1px solid rgba(0,0,0,0.06)',
          paddingTop: 'max(env(safe-area-inset-top), 12px)',
          boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
        }}
      >
        <button
          onClick={onBack}
          className="flex items-center justify-center rounded-full active:scale-90 transition-transform"
          style={{ width: '32px', height: '32px', backgroundColor: '#f1f5f9' }}
        >
          <ArrowLeft className="h-4 w-4" style={{ color: '#64748b' }} />
        </button>
        <h1
          className="flex-1 truncate"
          style={{ fontSize: '15px', fontWeight: 700, color: '#0f172a' }}
        >
          {task.title}
        </h1>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto" style={{ paddingBottom: '120px' }}>
        {/* Status chips */}
        <div className="flex flex-wrap gap-2 px-4 py-4">
          <span
            className="flex items-center gap-1.5 rounded-full px-3 py-1"
            style={{
              backgroundColor: statusInfo.bg,
              color: statusInfo.color,
              fontSize: '12px',
              fontWeight: 600,
            }}
          >
            {statusInfo.label}
          </span>
          {priorityInfo && (
            <span
              className="flex items-center gap-1.5 rounded-full px-3 py-1"
              style={{
                backgroundColor: priorityInfo.bg,
                color: priorityInfo.color,
                fontSize: '12px',
                fontWeight: 600,
              }}
            >
              <Flag className="h-3 w-3" />
              {priorityInfo.label}
            </span>
          )}
          {task.dueDate && (
            <span
              className="flex items-center gap-1.5 rounded-full px-3 py-1"
              style={{
                backgroundColor: '#f1f5f9',
                color: '#64748b',
                fontSize: '12px',
                fontWeight: 500,
              }}
            >
              <Calendar className="h-3 w-3" />
              {format(new Date(task.dueDate), 'd MMM', { locale: es })}
            </span>
          )}
        </div>

        {/* Description */}
        {task.description && (
          <div
            className="mx-4 mb-3 rounded-2xl p-4"
            style={{ backgroundColor: '#FFFFFF', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}
          >
            <p
              style={{
                fontSize: '12px',
                fontWeight: 600,
                color: '#94a3b8',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                marginBottom: '8px',
              }}
            >
              Descripción
            </p>
            <p style={{ fontSize: '14px', color: '#334155', lineHeight: '1.6' }}>
              {task.description}
            </p>
          </div>
        )}

        {/* Subtasks */}
        {subtasks.length > 0 && (
          <div
            className="mx-4 mb-3 rounded-2xl p-4"
            style={{ backgroundColor: '#FFFFFF', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}
          >
            <p
              style={{
                fontSize: '12px',
                fontWeight: 600,
                color: '#94a3b8',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                marginBottom: '10px',
              }}
            >
              Subtareas ({subtasks.filter((s) => s.done).length}/{subtasks.length})
            </p>
            <div className="space-y-3">
              {subtasks.map((sub) => (
                <div key={sub.id} className="flex items-center gap-3">
                  <div
                    className="rounded flex items-center justify-center shrink-0"
                    style={{
                      width: '18px',
                      height: '18px',
                      border: sub.done ? 'none' : '2px solid #d1d5db',
                      backgroundColor: sub.done ? '#10b981' : 'transparent',
                    }}
                  >
                    {sub.done && (
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
                  </div>
                  <span
                    style={{
                      fontSize: '13px',
                      color: sub.done ? '#94a3b8' : '#334155',
                      textDecoration: sub.done ? 'line-through' : 'none',
                    }}
                  >
                    {sub.title}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Comments */}
        <div
          className="mx-4 mb-3 rounded-2xl p-4"
          style={{ backgroundColor: '#FFFFFF', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}
        >
          <p
            style={{
              fontSize: '12px',
              fontWeight: 600,
              color: '#94a3b8',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              marginBottom: '12px',
            }}
          >
            Comentarios
          </p>
          <TaskCommentThread
            comments={comments}
            onEditComment={handleEditComment}
            onDeleteComment={handleDeleteComment}
          />
        </div>
      </div>

      {/* Sticky comment input */}
      <div
        className="fixed bottom-0 left-0 right-0 px-4 pt-3"
        style={{
          backgroundColor: '#FFFFFF',
          borderTop: '1px solid rgba(0,0,0,0.06)',
          paddingBottom: 'max(env(safe-area-inset-bottom), 12px)',
          boxShadow: '0 -2px 8px rgba(0,0,0,0.04)',
        }}
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
