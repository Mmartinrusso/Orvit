'use client';

import { useState, useEffect, useRef } from 'react';
import { FileTypeIcon } from '@/components/ui/file-type-icon';
import {
  X,
  Plus,
  Check,
  Calendar,
  User,
  Paperclip,
  MessageSquare,
  Activity,
  AlertCircle,
  FileText,
  Tag,
  MoreHorizontal,
  UserPlus,
  Pencil,
  Star,
  Send,
  AtSign,
  Sparkles,
  RefreshCw,
  UserCheck,
  Flame,
  Copy,
  type LucideIcon,
} from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { TaskCommentThread } from './TaskCommentThread';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { format, isToday } from 'date-fns';
import { es } from 'date-fns/locale';
import { SubtaskList, type SubtaskItem, type AssigneeOption } from './SubtaskList';
import type { AgendaTask, AgendaTaskStatus, Priority } from '@/lib/agenda/types';
import {
  TASK_STATUS_CONFIG,
  getAssigneeName,
  isTaskOverdue,
} from '@/lib/agenda/types';
import { useAuth } from '@/contexts/AuthContext';
import { useUsers } from '@/hooks/use-users';

// Exact spec hex colors
const PRIORITY_CHIP: Record<Priority, { bg: string; text: string; label: string }> = {
  LOW:    { bg: '#F3F4F6', text: '#6B7280', label: 'Baja' },
  MEDIUM: { bg: '#EFF6FF', text: '#1D4ED8', label: 'Media' },
  HIGH:   { bg: '#FEF3C7', text: '#D97706', label: 'Alta' },
  URGENT: { bg: '#FEE2E2', text: '#DC2626', label: 'Urgente' },
};

const STATUS_CHIP: Record<AgendaTaskStatus, { bg: string; text: string; dot: string }> = {
  PENDING:     { bg: '#F3F4F6', text: '#6B7280', dot: '#9CA3AF' },
  IN_PROGRESS: { bg: '#111827', text: '#FFFFFF', dot: '#FFFFFF' },
  WAITING:     { bg: '#FFFBEB', text: '#D97706', dot: '#D97706' },
  COMPLETED:   { bg: '#ECFDF5', text: '#059669', dot: '#059669' },
  CANCELLED:   { bg: '#FEE2E2', text: '#DC2626', dot: '#DC2626' },
};


interface CommentReply {
  id: number;
  author: string;
  content: string;
  time: string;
  bg: string;
  color: string;
  likes: number;
  likedByMe: boolean;
}
interface CommentItem {
  id: number;
  authorId?: number;
  author: string;
  authorAvatar?: string | null;
  content: string;
  time: string;
  createdAt?: Date;
  updatedAt?: Date;
  isEdited?: boolean;
  bg: string;
  color: string;
  likes: number;
  likedByMe: boolean;
  mentions: string[];
  replies: CommentReply[];
  attachment?: { name: string; size: string; type: string };
}


const ACTIVITY_CFG: Record<string, { Icon: LucideIcon; bg: string; color: string; label: string }> = {
  create:   { Icon: Sparkles,   bg: '#F3F4F6', color: '#111827', label: 'Tarea creada'      },
  status:   { Icon: RefreshCw,  bg: '#EEF2FF', color: '#6366F1', label: 'Estado'             },
  assign:   { Icon: UserCheck,  bg: '#ECFDF5', color: '#059669', label: 'Asignación'         },
  comment:  { Icon: MessageSquare, bg: '#FFFBEB', color: '#D97706', label: 'Comentario'      },
  priority: { Icon: Flame,      bg: '#FFF1F2', color: '#DC2626', label: 'Prioridad'          },
  attach:   { Icon: Paperclip,  bg: '#F0F9FF', color: '#0EA5E9', label: 'Adjunto'            },
};


const PANEL_WIDTH_NORMAL = 750;

interface TaskDetailPanelProps {
  task: AgendaTask | null;
  open: boolean;
  onClose: () => void;
  onStatusChange?: (task: AgendaTask, status: AgendaTaskStatus) => Promise<void>;
  onEdit?: (task: AgendaTask) => void;
  onDuplicate?: (task: AgendaTask) => Promise<void>;
  expanded?: boolean;
  onExpandedChange?: (v: boolean) => void;
}

export function TaskDetailPanel({ task, open, onClose, onEdit, onDuplicate, expanded = false, onExpandedChange }: TaskDetailPanelProps) {
  const { user: currentUser } = useAuth();
  const { users: companyUsers } = useUsers();
  const [subtasks, setSubtasks]     = useState<SubtaskItem[]>([]);
  const [activeTab, setActiveTab]   = useState<'subtasks' | 'comments' | 'activities'>('subtasks');
  const [tabAnimKey, setTabAnimKey] = useState(0);
  const [tabDir, setTabDir]         = useState<'left' | 'right'>('right');
  const [newCommentId, setNewCommentId] = useState<number | null>(null);
  const [attachAnim, setAttachAnim]     = useState<string | null>(null);
  const [subtaskAddingNew, setSubtaskAddingNew] = useState(false);
  const [subtaskNewTitle, setSubtaskNewTitle]   = useState('');
  const [localAttachments, setLocalAttachments] = useState<{ name: string; size: string; type: string; isNew?: boolean }[]>([]);
  const [newAttachNames, setNewAttachNames]     = useState<Set<string>>(new Set());
  const fileInputRef = useRef<HTMLInputElement>(null);
  const commentFileInputRef = useRef<HTMLInputElement>(null);
  const [commentAttachment, setCommentAttachment] = useState<{ name: string; size: string; type: string } | null>(null);
  const [openAnim,   setOpenAnim]   = useState(false);
  const [expandAnim, setExpandAnim] = useState<'expand' | 'contract' | null>(null);
  const [isFavorite, setIsFavorite]       = useState(false);
  const [showAssigneePop, setShowAssigneePop] = useState(false);
  const [showAssigneeHover, setShowAssigneeHover] = useState(false);
  const [assigneeSearch, setAssigneeSearch] = useState('');
  const [localAssigneeNames, setLocalAssigneeNames] = useState<string[] | null>(null);
  const assigneePopRef = useRef<HTMLDivElement>(null);
  const [comments, setComments]     = useState<CommentItem[]>([]);
  const [commentInput, setCommentInput] = useState('');
  const [showMentionDrop, setShowMentionDrop] = useState(false);
  const commentRef = useRef<HTMLTextAreaElement>(null);
  const prevOpenRef     = useRef(false);
  const prevExpandedRef = useRef(expanded);

  const MENTION_PEOPLE = companyUsers.length > 0
    ? companyUsers.map(u => u.name)
    : ['Juan P.', 'María G.', 'Carlos R.', 'Ana L.', 'Pedro M.'];

  function submitComment() {
    if ((!commentInput.trim() && !commentAttachment) || !task?.id) return;
    const content = commentInput.trim() || (commentAttachment ? commentAttachment.name : '');
    const attach = commentAttachment;
    // Optimistic — temp id uses negative timestamp
    const tempId = -Date.now();
    setNewCommentId(tempId);
    setTimeout(() => setNewCommentId(null), 600);
    const tempComment: CommentItem = {
      id: tempId,
      authorId: currentUser?.id ? Number(currentUser.id) : undefined,
      authorAvatar: currentUser?.avatar ?? null,
      author: currentUser?.name ?? 'Tú',
      content,
      time: 'Ahora',
      createdAt: new Date(),
      updatedAt: new Date(),
      bg: '#F3F4F6', color: '#111827',
      likes: 0, likedByMe: false,
      mentions: [], replies: [],
      ...(attach ? { attachment: attach } : {}),
    };
    setComments(prev => [...prev, tempComment]);
    setCommentInput('');
    setCommentAttachment(null);
    setShowMentionDrop(false);
    fetch(`/api/agenda/tasks/${task.id}/comments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content }),
    })
      .then(r => r.ok ? r.json() : Promise.reject(r.status))
      .then((saved: any) => {
        // Replace temp with real comment from server
        setComments(prev => prev.map(c => c.id === tempId ? {
          ...c,
          id: saved.id,
          authorId: saved.authorId,
          authorAvatar: saved.author?.avatar ?? null,
          createdAt: new Date(saved.createdAt),
          updatedAt: new Date(saved.updatedAt),
        } : c));
      })
      .catch(() => {
        // Rollback optimistic on error
        setComments(prev => prev.filter(c => c.id !== tempId));
      });
  }

  async function handleEditComment(commentId: number, newContent: string): Promise<void> {
    if (!task?.id) return;
    const prevContent = comments.find(c => c.id === commentId)?.content;
    // Optimistic update
    setComments(prev => prev.map(c =>
      c.id === commentId ? { ...c, content: newContent, isEdited: true, updatedAt: new Date() } : c
    ));
    const res = await fetch(`/api/agenda/tasks/${task.id}/comments/${commentId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: newContent }),
    });
    if (!res.ok) {
      // Rollback
      setComments(prev => prev.map(c =>
        c.id === commentId ? { ...c, content: prevContent ?? c.content, isEdited: false } : c
      ));
      throw new Error(`${res.status}`);
    }
  }

  async function handleDeleteComment(commentId: number): Promise<void> {
    if (!task?.id) return;
    // Optimistic remove
    const backup = comments.find(c => c.id === commentId);
    setComments(prev => prev.filter(c => c.id !== commentId));
    const res = await fetch(`/api/agenda/tasks/${task.id}/comments/${commentId}`, { method: 'DELETE' });
    if (!res.ok) {
      // Rollback on error
      if (backup) {
        setComments(prev => {
          const existing = prev.find(c => c.id === commentId);
          if (existing) return prev;
          return [...prev, backup].sort((a, b) => {
            const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
            const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
            return aTime - bTime;
          });
        });
      }
      throw new Error(`${res.status}`);
    }
  }

  // Fetch subtasks + comments from API whenever task changes
  useEffect(() => {
    setComments([]);
    if (!task?.id) { setSubtasks([]); return; }
    // Subtasks
    fetch(`/api/agenda/tasks/${task.id}/subtasks`)
      .then(r => r.ok ? r.json() : [])
      .then((data: any[]) => {
        setSubtasks(data.map(s => ({ id: s.id.toString(), title: s.title, completed: s.done, note: s.note ?? undefined })));
      })
      .catch(() => setSubtasks([]));
    // Comments
    fetch(`/api/agenda/tasks/${task.id}/comments`)
      .then(r => r.ok ? r.json() : [])
      .then((data: any[]) => {
        const COMMENT_COLORS = [
          { bg: '#F3F4F6', color: '#111827' },
          { bg: '#ECFDF5', color: '#059669' },
          { bg: '#FFFBEB', color: '#D97706' },
          { bg: '#EEF2FF', color: '#6366F1' },
          { bg: '#FFF1F2', color: '#DC2626' },
        ];
        setComments(data.map((c, i) => ({
          id: c.id,
          authorId: c.authorId,
          authorAvatar: c.author?.avatar ?? null,
          author: c.author?.name ?? 'Usuario',
          content: c.content,
          createdAt: new Date(c.createdAt),
          updatedAt: new Date(c.updatedAt),
          isEdited: c.updatedAt && c.createdAt && new Date(c.updatedAt).getTime() - new Date(c.createdAt).getTime() > 1000,
          time: format(new Date(c.createdAt), 'HH:mm'),
          bg: COMMENT_COLORS[i % COMMENT_COLORS.length].bg,
          color: COMMENT_COLORS[i % COMMENT_COLORS.length].color,
          likes: 0,
          likedByMe: false,
          mentions: [],
          replies: [],
        })));
      })
      .catch(() => setComments([]));
  }, [task?.id]);

  // Trigger slide-in animation when panel opens
  useEffect(() => {
    if (open && !prevOpenRef.current) {
      setOpenAnim(true);
      const t = setTimeout(() => setOpenAnim(false), 1100);
      prevOpenRef.current = true;
      return () => clearTimeout(t);
    }
    if (!open) prevOpenRef.current = false;
  }, [open]);

  // Trigger zoom animation when panel expands / contracts
  useEffect(() => {
    if (expanded !== prevExpandedRef.current) {
      setExpandAnim(expanded ? 'expand' : 'contract');
      const t = setTimeout(() => setExpandAnim(null), 700);
      prevExpandedRef.current = expanded;
      return () => clearTimeout(t);
    }
  }, [expanded]);

  // Close on ESC
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, onClose]);

  // Close assignee pop on outside click
  useEffect(() => {
    if (!showAssigneePop) return;
    function handler(e: MouseEvent) {
      if (assigneePopRef.current && !assigneePopRef.current.contains(e.target as Node)) {
        setShowAssigneePop(false);
        setAssigneeSearch('');
      }
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showAssigneePop]);

  const panelWidth = expanded ? undefined : `${PANEL_WIDTH_NORMAL}px`;

  // Build assignee list from task participants
  const AVATAR_COLORS = [
    { bg: '#F3F4F6', color: '#111827' },
    { bg: '#ECFDF5', color: '#059669' },
    { bg: '#FFFBEB', color: '#D97706' },
    { bg: '#EEF2FF', color: '#6366F1' },
    { bg: '#FFF1F2', color: '#DC2626' },
  ];
  const taskAssigneesArr: AssigneeOption[] = (() => {
    // Prefer real company users (have IDs for assignment)
    if (companyUsers.length > 0) {
      return companyUsers.map((u, i) => ({
        id: u.id,
        name: u.name,
        initials: u.name.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase(),
        ...AVATAR_COLORS[i % AVATAR_COLORS.length],
      }));
    }
    // Fallback: task participants (no IDs available)
    if (localAssigneeNames !== null) {
      return localAssigneeNames.map((name, i) => ({
        name,
        initials: name.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase(),
        ...AVATAR_COLORS[i % AVATAR_COLORS.length],
      }));
    }
    const people: { id?: number; name: string }[] = [];
    if (task?.createdBy) people.push({ id: task.createdBy.id, name: task.createdBy.name });
    const assignId = task?.assignedToUserId ?? undefined;
    const assignName = task ? getAssigneeName(task) : '';
    if (assignName && assignName !== 'Sin asignar' && !people.find(p => p.name === assignName))
      people.push({ id: assignId, name: assignName });
    return people.map((p, i) => ({
      id: p.id,
      name: p.name,
      initials: p.name.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase(),
      ...AVATAR_COLORS[i % AVATAR_COLORS.length],
    }));
  })();

  const statusConfig  = task ? TASK_STATUS_CONFIG[task.status] : null;
  const statusChip    = task ? STATUS_CHIP[task.status]    : null;
  const priorityChip  = task ? PRIORITY_CHIP[task.priority] : null;
  const isOverdue     = task ? isTaskOverdue(task)          : false;
  const assigneeName  = task ? getAssigneeName(task)        : '';
  const assigneeInitials = assigneeName && assigneeName !== 'Sin asignar'
    ? assigneeName.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase()
    : null;

  const completedCount  = subtasks.filter(s => s.completed).length;
  const subtaskProgress = subtasks.length > 0 ? Math.round((completedCount / subtasks.length) * 100) : 0;

  return (
    <>
    <style>{`
      /* ── Modal open — shared unfold animation ── */
      @keyframes modal-unfold {
        0%   { transform: scaleY(0);     opacity: 0; filter: blur(6px); }
        10%  { transform: scaleY(0.006); opacity: 1; filter: blur(4px); }
        100% { transform: scaleY(1);     opacity: 1; filter: blur(0px); }
      }
      @keyframes modal-content-reveal {
        0%   { opacity: 0; transform: translateX(-18px); filter: blur(8px); }
        100% { opacity: 1; transform: translateX(0);     filter: blur(0); }
      }
      @keyframes backdrop-in {
        from { opacity: 0; backdrop-filter: blur(0px); }
        to   { opacity: 1; backdrop-filter: blur(6px); }
      }

      /* ── Per-tab unique entrances ── */
      @keyframes tab-subtasks {
        from { opacity: 0; transform: translateY(-10px) scale(0.99); }
        to   { opacity: 1; transform: translateY(0)    scale(1); }
      }
      @keyframes tab-comments {
        from { opacity: 0; transform: translateY(14px); }
        to   { opacity: 1; transform: translateY(0); }
      }
      @keyframes tab-activities {
        from { opacity: 0; transform: translateX(18px); filter: blur(3px); }
        to   { opacity: 1; transform: translateX(0);    filter: blur(0); }
      }

      /* ── Item stagger inside tabs ── */
      @keyframes item-stagger {
        from { opacity: 0; transform: translateY(8px); }
        to   { opacity: 1; transform: translateY(0); }
      }
      @keyframes activity-stagger {
        from { opacity: 0; transform: translateX(12px); filter: blur(2px); }
        to   { opacity: 1; transform: translateX(0);    filter: blur(0); }
      }

      /* ── Micro interactions ── */
      @keyframes comment-in {
        from { opacity: 0; transform: translateY(10px) scale(0.98); }
        to   { opacity: 1; transform: translateY(0)    scale(1); }
      }
      @keyframes like-bounce {
        0%   { transform: scale(1); }
        35%  { transform: scale(1.55); }
        60%  { transform: scale(0.85); }
        100% { transform: scale(1); }
      }
      @keyframes attachment-press {
        0%   { transform: scale(1); }
        40%  { transform: scale(0.93); }
        100% { transform: scale(1); }
      }
      @keyframes file-in {
        0%   { opacity: 0; transform: scale(0.82) translateY(6px); }
        60%  { opacity: 1; transform: scale(1.04) translateY(-1px); }
        100% { opacity: 1; transform: scale(1) translateY(0); }
      }
      /* Attachment delete badge — visible on chip hover */
      .agenda-attach-chip:hover .agenda-attach-del { opacity: 1 !important; }
      /* Hide scrollbar */
      [data-radix-scroll-area-scrollbar] { display: none !important; }
      .agenda-scroll { scrollbar-width: none; -ms-overflow-style: none; overflow-y: auto; height: 100%; flex: 1; min-height: 0; }
      .agenda-scroll::-webkit-scrollbar { display: none; }
    `}</style>
    {/* Backdrop — with blur like createTaskModal */}
    {open && (
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, zIndex: 50,
          background: 'rgba(0,0,0,0.40)',
          backdropFilter: 'blur(6px)',
          WebkitBackdropFilter: 'blur(6px)',
          animation: 'backdrop-in 300ms ease both',
        }}
      />
    )}
    {/* Modal overlay — click outside to close */}
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 51,
        display: open ? 'flex' : 'none',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
      }}
    >
      {/* Modal box — stop propagation so inner clicks don't close */}
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: '1020px',
          maxWidth: '95vw',
          height: '950px',
          maxHeight: '98vh',
          background: '#FFFFFF',
          border: '1.5px solid #D8D8DE',
          borderRadius: '8px',
          boxShadow: '0 4px 32px rgba(0,0,0,.12), 0 1px 4px rgba(0,0,0,.06)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          transformOrigin: 'center center',
          animation: openAnim ? 'modal-unfold 950ms cubic-bezier(.22,1,.36,1) both' : undefined,
        }}
      >
      {/* Inner content */}
      <div
        style={{
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
          overflow: 'hidden',
        }}
      >
        {task && statusConfig && statusChip && priorityChip ? (
          <>
            {/* Header */}
            <div style={{ padding: '16px 20px', borderBottom: '1px solid #E4E4E8', flexShrink: 0, animation: openAnim ? 'modal-content-reveal 420ms cubic-bezier(.22,1,.36,1) 320ms both' : undefined }}>

              {/* Top row: status + category + actions */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '10px' }}>
                {/* Status chip */}
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '11px', fontWeight: 600, padding: '2px 8px', borderRadius: '6px', background: statusChip.bg, color: statusChip.text }}>
                  <span style={{ height: '5px', width: '5px', borderRadius: '50%', background: statusChip.dot }} />
                  {statusConfig.label}
                </span>
                {/* Category chip */}
                {task.category && (
                  <span style={{ fontSize: '11px', fontWeight: 600, padding: '2px 8px', borderRadius: '6px', background: '#F4F4F6', color: '#6B7280' }}>
                    {task.category}
                  </span>
                )}
                {isOverdue && (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '11px', fontWeight: 600, padding: '2px 8px', borderRadius: '6px', background: '#FEE2E2', color: '#DC2626' }}>
                    <AlertCircle className="h-3 w-3" /> Vencida
                  </span>
                )}

                <div style={{ flex: 1 }} />

                {/* Action buttons */}
                <button
                  onClick={() => setIsFavorite(p => !p)}
                  style={{ height: '28px', width: '28px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'transparent', border: 'none', cursor: 'pointer', transition: 'background 150ms' }}
                  onMouseEnter={e => (e.currentTarget.style.background = '#FEF3C7')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                >
                  <Star className="h-3.5 w-3.5" style={{ color: isFavorite ? '#D97706' : '#9CA3AF', fill: isFavorite ? '#D97706' : 'none', transition: 'all 200ms' }} />
                </button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      style={{ height: '28px', width: '28px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'transparent', border: 'none', color: '#9CA3AF', cursor: 'pointer', transition: 'all 150ms' }}
                      onMouseEnter={e => { e.currentTarget.style.background = '#F4F4F6'; e.currentTarget.style.color = '#6B7280'; }}
                      onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#9CA3AF'; }}
                    >
                      <MoreHorizontal className="h-3.5 w-3.5" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem className="text-xs gap-2" onClick={() => task && onEdit?.(task)}>
                      <Pencil className="h-3 w-3" /> Editar tarea
                    </DropdownMenuItem>
                    {onDuplicate && (
                      <DropdownMenuItem className="text-xs gap-2" onClick={() => task && onDuplicate(task)}>
                        <Copy className="h-3 w-3" /> Duplicar tarea
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuItem className="text-xs gap-2" onClick={() => setShowAssigneePop(true)}>
                      <UserPlus className="h-3 w-3" /> Agregar personas
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
                <button
                  onClick={onClose}
                  style={{ height: '28px', width: '28px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9CA3AF', background: 'transparent', border: 'none', cursor: 'pointer', transition: 'all 150ms' }}
                  onMouseEnter={e => { e.currentTarget.style.background = '#F4F4F6'; e.currentTarget.style.color = '#6B7280'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#9CA3AF'; }}
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>

              {/* Title */}
              <h2 style={{ fontSize: '18px', fontWeight: 600, color: '#111827', lineHeight: 1.3, letterSpacing: '-0.02em', marginBottom: '14px' }}>
                {task.title}
              </h2>

              {/* Bottom row: assignees + priority + due date */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>

                {/* Stacked avatars with tooltip */}
                <div style={{ position: 'relative' }} ref={assigneePopRef}>
                  <div
                    style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}
                    onClick={() => { setShowAssigneePop(p => !p); setShowAssigneeHover(false); }}
                    onMouseEnter={() => setShowAssigneeHover(true)}
                    onMouseLeave={() => setShowAssigneeHover(false)}
                  >
                    {taskAssigneesArr.slice(0, 3).map((person, pi) => (
                      <div
                        key={person.name}
                        style={{ width: '26px', height: '26px', borderRadius: '50%', background: person.bg, border: '2px solid #FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', marginLeft: pi > 0 ? '-8px' : '0', zIndex: 3 - pi, position: 'relative' }}
                      >
                        <span style={{ fontSize: '8px', fontWeight: 700, color: person.color }}>{person.initials}</span>
                      </div>
                    ))}
                    {taskAssigneesArr.length > 3 && (
                      <div style={{ width: '26px', height: '26px', borderRadius: '50%', background: '#F4F4F6', border: '2px solid #FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', marginLeft: '-8px', position: 'relative', zIndex: 0 }}>
                        <span style={{ fontSize: '8px', fontWeight: 700, color: '#6B7280' }}>+{taskAssigneesArr.length - 3}</span>
                      </div>
                    )}
                    {taskAssigneesArr.length === 0 && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '5px', color: '#9CA3AF' }}>
                        <UserPlus className="h-3.5 w-3.5" />
                        <span style={{ fontSize: '12px', fontWeight: 500 }}>Sin asignar</span>
                      </div>
                    )}
                    {taskAssigneesArr.length > 0 && (
                      <span style={{ fontSize: '12px', fontWeight: 500, color: '#6B7280', marginLeft: '8px' }}>
                        {taskAssigneesArr.length === 1 ? taskAssigneesArr[0].name : `${taskAssigneesArr[0].name} y ${taskAssigneesArr.length - 1} más`}
                      </span>
                    )}
                  </div>

                  {/* Hover tooltip with all names */}
                  {/* Hover tooltip — just shows current assignees, no add button */}
                  {showAssigneeHover && !showAssigneePop && taskAssigneesArr.length > 0 && (
                    <div style={{ position: 'absolute', top: '34px', left: 0, zIndex: 60, background: '#FFFFFF', border: '1.5px solid #D8D8DE', borderRadius: '8px', boxShadow: '0 4px 16px rgba(0,0,0,.10)', padding: '8px', minWidth: '160px', pointerEvents: 'none' }}>
                      {taskAssigneesArr.map(person => (
                        <div key={person.name} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '4px 6px' }}>
                          <div style={{ width: '22px', height: '22px', borderRadius: '50%', background: person.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            <span style={{ fontSize: '8px', fontWeight: 700, color: person.color }}>{person.initials}</span>
                          </div>
                          <span style={{ fontSize: '12px', color: '#374151', fontWeight: 500, fontFamily: 'inherit' }}>{person.name}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Assignee selector popover — unified checkmark list */}
                  {showAssigneePop && (
                    <div ref={assigneePopRef} style={{ position: 'absolute', top: '34px', left: 0, zIndex: 61, background: '#FFFFFF', border: '1.5px solid #D8D8DE', borderRadius: '10px', boxShadow: '0 8px 24px rgba(0,0,0,.12)', padding: '8px', minWidth: '224px', maxHeight: '280px', overflow: 'hidden', display: 'flex', flexDirection: 'column', fontFamily: 'inherit' }}>
                      {/* Search input */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#F4F4F6', borderRadius: '7px', padding: '5px 8px', marginBottom: '6px', flexShrink: 0 }}>
                        <User className="h-3 w-3" style={{ color: '#9CA3AF', flexShrink: 0 }} />
                        <input
                          autoFocus
                          value={assigneeSearch}
                          onChange={e => setAssigneeSearch(e.target.value)}
                          placeholder="Buscar persona..."
                          style={{ flex: 1, border: 'none', background: 'transparent', outline: 'none', fontSize: '12px', color: '#111827', fontFamily: 'inherit' }}
                        />
                        {assigneeSearch && (
                          <button onClick={() => setAssigneeSearch('')} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', color: '#9CA3AF' }}>
                            <X className="h-3 w-3" />
                          </button>
                        )}
                      </div>

                      {/* Unified list — all people, checkmark indicates selected */}
                      <div style={{ overflowY: 'auto', flex: 1 }}>
                        {(() => {
                          const filtered = MENTION_PEOPLE.filter(
                            name => !assigneeSearch || name.toLowerCase().includes(assigneeSearch.toLowerCase())
                          );
                          if (filtered.length === 0) return (
                            <p style={{ fontSize: '12px', color: '#9CA3AF', padding: '8px', textAlign: 'center', fontFamily: 'inherit' }}>Sin resultados</p>
                          );
                          return filtered.map((name, i) => {
                            const isSelected = taskAssigneesArr.some(a => a.name === name);
                            const col = AVATAR_COLORS[i % AVATAR_COLORS.length];
                            return (
                              <button
                                key={name}
                                onClick={() => {
                                  const current = localAssigneeNames ?? taskAssigneesArr.map(a => a.name);
                                  setLocalAssigneeNames(
                                    isSelected ? current.filter(n => n !== name) : [...current, name]
                                  );
                                }}
                                style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 6px', borderRadius: '7px', border: 'none', background: isSelected ? '#F0FDF4' : 'transparent', cursor: 'pointer', width: '100%', textAlign: 'left', transition: 'background 120ms', fontFamily: 'inherit', marginBottom: '1px' }}
                                onMouseEnter={e => (e.currentTarget.style.background = isSelected ? '#E6FAF0' : '#F4F4F6')}
                                onMouseLeave={e => (e.currentTarget.style.background = isSelected ? '#F0FDF4' : 'transparent')}
                              >
                                <div style={{ width: '24px', height: '24px', borderRadius: '50%', background: col.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                  <span style={{ fontSize: '8px', fontWeight: 700, color: col.color }}>{name.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase()}</span>
                                </div>
                                <span style={{ fontSize: '12px', fontWeight: isSelected ? 600 : 500, color: isSelected ? '#111827' : '#374151', flex: 1, fontFamily: 'inherit' }}>{name}</span>
                                {/* Checkmark box */}
                                <div style={{ width: '16px', height: '16px', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, background: isSelected ? '#059669' : 'transparent', border: isSelected ? 'none' : '1.5px solid #D8D8DE', transition: 'all 150ms' }}>
                                  {isSelected && <Check className="h-2.5 w-2.5" style={{ color: '#FFFFFF' }} />}
                                </div>
                              </button>
                            );
                          });
                        })()}
                      </div>
                    </div>
                  )}
                </div>

                {/* Divider */}
                <div style={{ width: '1px', height: '18px', background: '#E4E4E8' }} />

                {/* Priority */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ fontSize: '12px', fontWeight: 500, color: '#6B7280' }}>Prioridad</span>
                  <span style={{ fontSize: '12px', fontWeight: 600, padding: '2px 8px', borderRadius: '6px', background: priorityChip.bg, color: priorityChip.text }}>
                    {priorityChip.label}
                  </span>
                </div>

                {/* Divider */}
                <div style={{ width: '1px', height: '18px', background: '#E4E4E8' }} />

                {/* Due date */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Calendar className="h-3.5 w-3.5" style={{ color: '#9CA3AF' }} />
                  <span style={{ fontSize: '12px', fontWeight: 500, color: '#6B7280' }}>Vencimiento</span>
                  {task.dueDate ? (
                    <span style={{ fontSize: '12px', fontWeight: 600, color: isOverdue ? '#DC2626' : isToday(new Date(task.dueDate)) ? '#D97706' : '#111827' }}>
                      {format(new Date(task.dueDate), "d 'de' MMMM", { locale: es })}
                    </span>
                  ) : (
                    <span style={{ fontSize: '12px', color: '#9CA3AF' }}>Sin fecha</span>
                  )}
                </div>
              </div>

            </div>

            {/* Body — fixed layout: desc+attachments shrink, tabs flex-1 */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', animation: openAnim ? 'modal-content-reveal 420ms cubic-bezier(.22,1,.36,1) 380ms both' : undefined }}>

              {/* Description + Attachments — fixed top section */}
              <div style={{ padding: '14px 20px', display: 'flex', flexDirection: 'column', gap: '12px', flexShrink: 0, borderBottom: '1px solid #F0F0F4' }}>

                {/* Descripción */}
                {task.description && (
                  <p style={{ fontSize: '15px', color: '#374151', lineHeight: 1.7, margin: 0, letterSpacing: '-0.01em' }}>
                    {task.description}
                  </p>
                )}

                {/* Attachments */}
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '5px', color: '#9CA3AF' }}>
                      <Paperclip className="h-3 w-3" />
                      <span style={{ fontSize: '12px', fontWeight: 500, color: '#111827' }}>Adjuntos ({localAttachments.length})</span>
                    </div>
                    {localAttachments.length > 0 && (
                      <button
                        style={{ fontSize: '10px', color: '#111827', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600, textDecoration: 'underline', textUnderlineOffset: '2px' }}
                        onMouseEnter={e => (e.currentTarget.style.opacity = '0.6')}
                        onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
                      >
                        Descargar todo
                      </button>
                    )}
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                    {localAttachments.map(att => (
                      <div
                        key={att.name}
                        className="agenda-attach-chip"
                        onClick={() => { setAttachAnim(att.name); setTimeout(() => setAttachAnim(null), 300); }}
                        style={{
                          position: 'relative',
                          display: 'flex', alignItems: 'center', gap: '8px',
                          padding: '5px 10px 5px 6px',
                          background: '#FFFFFF',
                          border: '1px solid #E8E8EC', borderRadius: '8px',
                          cursor: 'pointer',
                          transition: 'box-shadow 150ms ease, border-color 150ms ease',
                          animation: newAttachNames.has(att.name)
                            ? 'file-in 380ms cubic-bezier(0.22,1,0.36,1) both'
                            : attachAnim === att.name ? 'attachment-press 250ms cubic-bezier(0.22,1,0.36,1) both' : undefined,
                        }}
                        onMouseEnter={e => {
                          (e.currentTarget as HTMLDivElement).style.boxShadow = '0 2px 8px rgba(0,0,0,.07)';
                          (e.currentTarget as HTMLDivElement).style.borderColor = '#D0D0D8';
                        }}
                        onMouseLeave={e => {
                          (e.currentTarget as HTMLDivElement).style.boxShadow = 'none';
                          (e.currentTarget as HTMLDivElement).style.borderColor = '#E8E8EC';
                        }}
                      >
                        <FileTypeIcon name={att.type} />
                        <div style={{ minWidth: 0 }}>
                          <p style={{ fontSize: '12px', fontWeight: 600, color: '#111827', lineHeight: 1.2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '100px' }}>{att.name}</p>
                          <p style={{ fontSize: '10px', color: '#9CA3AF', marginTop: '1px' }}>{att.size}</p>
                        </div>
                        {/* Delete button — CSS hover via .agenda-attach-chip:hover .agenda-attach-del */}
                        <button
                          className="agenda-attach-del"
                          onClick={e => { e.stopPropagation(); setLocalAttachments(prev => prev.filter(a => a.name !== att.name)); }}
                          style={{ position: 'absolute', top: '-6px', right: '-6px', width: '16px', height: '16px', borderRadius: '50%', background: '#EF4444', border: '1.5px solid #FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', opacity: 0, transition: 'opacity 150ms ease' }}
                        >
                          <X style={{ width: '8px', height: '8px', color: '#FFFFFF', strokeWidth: 3 }} />
                        </button>
                      </div>
                    ))}
                    {/* Hidden file input */}
                    <input
                      ref={fileInputRef}
                      type="file"
                      multiple
                      style={{ display: 'none' }}
                      onChange={e => {
                        const files = Array.from(e.target.files ?? []);
                        if (!files.length) return;
                        const newNames = new Set<string>();
                        const newItems = files.map(f => {
                          const kb = f.size / 1024;
                          const size = kb < 1024 ? `${Math.round(kb)} KB` : `${(kb / 1024).toFixed(1)} MB`;
                          const ext = f.name.split('.').pop()?.toLowerCase() ?? '';
                          const type = ['jpg','jpeg','png','gif','webp'].includes(ext) ? 'image'
                            : ['pdf'].includes(ext) ? 'pdf'
                            : ['doc','docx'].includes(ext) ? 'doc'
                            : ['xls','xlsx'].includes(ext) ? 'xls'
                            : 'file';
                          newNames.add(f.name);
                          return { name: f.name, size, type };
                        });
                        setLocalAttachments(prev => [...prev, ...newItems]);
                        setNewAttachNames(newNames);
                        setTimeout(() => setNewAttachNames(new Set()), 600);
                        e.target.value = '';
                      }}
                    />
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      style={{
                        height: '38px', width: '32px', display: 'flex', alignItems: 'center',
                        justifyContent: 'center', background: '#F4F4F6',
                        border: '1.5px dashed #E4E4E8', borderRadius: '10px',
                        cursor: 'pointer', color: '#9CA3AF', fontSize: '16px',
                        transition: 'all 150ms ease',
                      }}
                      onMouseEnter={e => { e.currentTarget.style.borderColor = '#111827'; e.currentTarget.style.background = '#F3F4F6'; e.currentTarget.style.color = '#111827'; }}
                      onMouseLeave={e => { e.currentTarget.style.borderColor = '#E5E7EB'; e.currentTarget.style.background = '#F9FAFB'; e.currentTarget.style.color = '#9CA3AF'; }}
                    >
                      +
                    </button>
                  </div>
                </div>
              </div>

              {/* Tabs section — fills remaining height */}
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', padding: '14px 20px 0' }}>
                  {/* Tab bar — pill style */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '14px', background: '#F4F4F6', borderRadius: '8px', padding: '3px', flexShrink: 0 }}>
                    {([
                      { key: 'subtasks',   label: 'Subtareas',    idx: 0 },
                      { key: 'comments',   label: `Comentarios (${comments.length})`, idx: 1 },
                      { key: 'activities', label: 'Actividades',  idx: 2 },
                    ] as const).map(tab => (
                      <button
                        key={tab.key}
                        onClick={() => {
                          const ORDER = { subtasks: 0, comments: 1, activities: 2 };
                          setTabDir(tab.idx > ORDER[activeTab] ? 'right' : 'left');
                          setActiveTab(tab.key);
                          setTabAnimKey(k => k + 1);
                        }}
                        style={{
                          flex: 1,
                          border: 'none',
                          cursor: 'pointer',
                          padding: '6px 12px',
                          borderRadius: '6px',
                          fontSize: '12px',
                          fontWeight: 600,
                          letterSpacing: '-0.01em',
                          background: activeTab === tab.key ? '#FFFFFF' : 'transparent',
                          color: activeTab === tab.key ? '#111827' : '#9CA3AF',
                          boxShadow: activeTab === tab.key ? '0 1px 3px rgba(0,0,0,.08)' : 'none',
                          transition: 'all 150ms ease',
                        }}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>

                  {/* Tab content — unique entrance per tab */}
                  <div key={tabAnimKey} style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', animation: `${activeTab === 'subtasks' ? 'tab-subtasks' : activeTab === 'comments' ? 'tab-comments' : 'tab-activities'} 220ms cubic-bezier(.22,1,.36,1) both` }}>

                  {/* Subtareas */}
                  {activeTab === 'subtasks' && (
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                      <div className="agenda-scroll">
                        <div style={{ paddingBottom: '8px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                            <div style={{ flex: 1, height: '6px', background: '#E4E4E8', borderRadius: '999px', overflow: 'hidden' }}>
                              <div style={{ height: '100%', borderRadius: '999px', background: '#059669', width: `${subtaskProgress}%`, transition: 'width 500ms ease' }} />
                            </div>
                            <span style={{ fontSize: '11px', color: '#9CA3AF', fontWeight: 500, flexShrink: 0 }}>{subtaskProgress}%</span>
                          </div>
                          <SubtaskList
                            groupTitle="Proceso de trabajo"
                            subtasks={subtasks}
                            hideFooter
                            onToggle={(id, completed) => {
                              setSubtasks(prev => prev.map(s => s.id === id ? { ...s, completed } : s));
                              fetch(`/api/agenda/tasks/${task!.id}/subtasks/${parseInt(id)}`, {
                                method: 'PUT',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ done: completed }),
                              }).then(r => { if (!r.ok) throw new Error(`${r.status}`); })
                                .catch(() => {
                                  setSubtasks(prev => prev.map(s => s.id === id ? { ...s, completed: !completed } : s));
                                });
                            }}
                            onAdd={(title) => {
                              fetch(`/api/agenda/tasks/${task!.id}/subtasks`, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ title }),
                              }).then(r => r.ok ? r.json() : Promise.reject(r.status))
                                .then(s => setSubtasks(prev => [...prev, { id: s.id.toString(), title: s.title, completed: s.done, note: s.note ?? undefined }]))
                                .catch(err => console.error('[Subtask] create failed:', err));
                            }}
                            onUpdate={(id, updates) => {
                              setSubtasks(prev => prev.map(s => s.id === id ? { ...s, ...updates } : s));
                              fetch(`/api/agenda/tasks/${task!.id}/subtasks/${parseInt(id)}`, {
                                method: 'PUT',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                  ...(updates.title !== undefined && { title: updates.title }),
                                  ...(updates.note !== undefined && { note: updates.note }),
                                  ...(updates.assigneeId !== undefined && { assigneeId: updates.assigneeId }),
                                }),
                              }).then(r => { if (!r.ok) throw new Error(`${r.status}`); })
                                .catch(err => console.error('[Subtask] update failed:', err));
                            }}
                            onDelete={(id) => {
                              setSubtasks(prev => prev.filter(s => s.id !== id));
                              fetch(`/api/agenda/tasks/${task!.id}/subtasks/${parseInt(id)}`, { method: 'DELETE' })
                                .then(r => { if (!r.ok) throw new Error(`${r.status}`); })
                                .catch(err => console.error('[Subtask] delete failed:', err));
                            }}
                            onReorder={(items) => {
                              setSubtasks(items);
                              fetch(`/api/agenda/tasks/${task!.id}/subtasks/reorder`, {
                                method: 'PATCH',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ order: items.map(s => parseInt(s.id)) }),
                              }).then(r => { if (!r.ok) throw new Error(`${r.status}`); })
                                .catch(err => console.error('[Subtask] reorder failed:', err));
                            }}
                            taskAssignees={taskAssigneesArr}
                          />
                        </div>
                      </div>
                      {/* Fixed footer */}
                      <div style={{ flexShrink: 0, borderTop: '1px dashed #E4E4E8', padding: '8px 0 4px' }}>
                        {subtaskAddingNew ? (
                          <div style={{ border: '1px dashed #059669', borderRadius: '8px', padding: '7px 12px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <div style={{ width: '16px', height: '16px', border: '1.5px solid #E4E4E8', borderRadius: '4px', flexShrink: 0 }} />
                            <input
                              autoFocus
                              value={subtaskNewTitle}
                              onChange={e => setSubtaskNewTitle(e.target.value)}
                              onKeyDown={e => {
                                if (e.key === 'Enter') {
                                  const title = subtaskNewTitle.trim();
                                  setSubtaskNewTitle(''); setSubtaskAddingNew(false);
                                  if (title) {
                                    fetch(`/api/agenda/tasks/${task!.id}/subtasks`, {
                                      method: 'POST',
                                      headers: { 'Content-Type': 'application/json' },
                                      body: JSON.stringify({ title }),
                                    }).then(r => r.ok ? r.json() : Promise.reject(r.status))
                                      .then(s => setSubtasks(prev => [...prev, { id: s.id.toString(), title: s.title, completed: s.done, note: s.note ?? undefined }]))
                                      .catch(err => console.error('[Subtask] footer create failed:', err));
                                  }
                                }
                                if (e.key === 'Escape') { setSubtaskAddingNew(false); setSubtaskNewTitle(''); }
                              }}
                              onBlur={() => {
                                const title = subtaskNewTitle.trim();
                                setSubtaskNewTitle(''); setSubtaskAddingNew(false);
                                if (title) {
                                  fetch(`/api/agenda/tasks/${task!.id}/subtasks`, {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({ title }),
                                  }).then(r => r.ok ? r.json() : Promise.reject(r.status))
                                    .then(s => setSubtasks(prev => [...prev, { id: s.id.toString(), title: s.title, completed: s.done, note: s.note ?? undefined }]))
                                    .catch(err => console.error('[Subtask] blur create failed:', err));
                                }
                              }}
                              placeholder="Nombre de la subtarea..."
                              className="flex-1 outline-none bg-transparent"
                              style={{ fontSize: '13px', color: '#111827' }}
                            />
                          </div>
                        ) : (
                          <button
                            onClick={() => setSubtaskAddingNew(true)}
                            style={{ fontSize: '12px', color: '#9CA3AF', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                            onMouseEnter={e => (e.currentTarget.style.color = '#6B7280')}
                            onMouseLeave={e => (e.currentTarget.style.color = '#9CA3AF')}
                          >
                            <Plus className="h-3 w-3" /> Nueva subtarea
                          </button>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Comentarios */}
                  {activeTab === 'comments' && (
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                    <div className="agenda-scroll" style={{ padding: '4px 0' }}>
                      <TaskCommentThread
                        comments={comments.filter(c => c.id > 0).map(c => ({
                          id: c.id,
                          content: c.content,
                          createdAt: c.createdAt ?? new Date(),
                          updatedAt: c.updatedAt,
                          authorId: c.authorId ?? 0,
                          author: c.authorId != null ? {
                            id: c.authorId,
                            name: c.author,
                            avatar: c.authorAvatar,
                          } : null,
                        }))}
                        onEditComment={handleEditComment}
                        onDeleteComment={handleDeleteComment}
                      />
                      {/* Optimistic pending comment (temp id < 0) */}
                      {comments.filter(c => c.id < 0).map(c => (
                        <div key={c.id} className="flex gap-3 opacity-60 mt-4 px-1">
                          <Avatar className="h-7 w-7 shrink-0 mt-0.5">
                            {c.authorAvatar && <AvatarImage src={c.authorAvatar} />}
                            <AvatarFallback className="text-[10px] font-bold">
                              {c.author.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-xs font-semibold">{c.author}</span>
                              <span className="text-xs text-muted-foreground">Enviando...</span>
                            </div>
                            <p className="text-sm text-foreground whitespace-pre-wrap break-words">{c.content}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                    {/* New comment input — fixed at bottom */}
                    <div style={{ flexShrink: 0, borderTop: '1px solid #E4E4E8', paddingTop: '12px', paddingBottom: '14px' }}>
                        <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                          {currentUser?.avatar
                            ? <img src={currentUser.avatar} alt="" style={{ width: 32, height: 32, borderRadius: '50%', flexShrink: 0, marginTop: 2, objectFit: 'cover' }} />
                            : <Avatar className="h-8 w-8 shrink-0" style={{ marginTop: '2px' }}>
                                <AvatarFallback className="text-[9px] font-bold" style={{ background: '#F3F4F6', color: '#111827' }}>
                                  {currentUser?.name ? currentUser.name.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase() : 'Tú'}
                                </AvatarFallback>
                              </Avatar>
                          }
                          <div style={{ flex: 1, border: '1.5px solid #E4E4E8', borderRadius: '8px', overflow: 'hidden', background: '#FAFAFA', transition: 'border-color 150ms' }}
                            onFocusCapture={e => (e.currentTarget.style.borderColor = '#111827')}
                            onBlurCapture={e => (e.currentTarget.style.borderColor = '#E4E4E8')}
                          >
                            {/* Mention dropdown */}
                            {showMentionDrop && (
                              <div style={{ padding: '8px', borderBottom: '1px solid #E4E4E8', display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                                {MENTION_PEOPLE.map(person => (
                                  <button
                                    key={person}
                                    onClick={() => { setCommentInput(p => p.slice(0, p.lastIndexOf('@')) + `@${person} `); setShowMentionDrop(false); commentRef.current?.focus(); }}
                                    style={{ fontSize: '11px', fontWeight: 600, padding: '2px 8px', borderRadius: '4px', background: '#F3F4F6', color: '#111827', border: 'none', cursor: 'pointer' }}
                                  >
                                    @{person}
                                  </button>
                                ))}
                              </div>
                            )}
                            <textarea
                              ref={commentRef}
                              rows={2}
                              value={commentInput}
                              onChange={e => {
                                setCommentInput(e.target.value);
                                const lastAt = e.target.value.lastIndexOf('@');
                                setShowMentionDrop(lastAt >= 0 && e.target.value.slice(lastAt + 1).indexOf(' ') === -1);
                              }}
                              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submitComment(); } }}
                              placeholder="Escribe un comentario... Usa @ para mencionar"
                              className="w-full outline-none resize-none bg-transparent"
                              style={{ fontSize: '13px', color: '#111827', padding: '10px 12px', display: 'block' }}
                            />
                            {/* Attachment preview chip */}
                            {commentAttachment && (
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '4px 10px', borderTop: '1px solid #E4E4E8', background: '#F9F9FB' }}>
                                <FileTypeIcon type={commentAttachment.type} />
                                <span style={{ fontSize: '11px', fontWeight: 600, color: '#374151', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{commentAttachment.name}</span>
                                <span style={{ fontSize: '10px', color: '#9CA3AF', flexShrink: 0 }}>{commentAttachment.size}</span>
                                <button onClick={() => setCommentAttachment(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9CA3AF', display: 'flex', padding: 0, flexShrink: 0 }}>
                                  <X className="h-3 w-3" />
                                </button>
                              </div>
                            )}
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 10px', borderTop: '1px solid #E4E4E8', background: '#F4F4F6' }}>
                              <div style={{ display: 'flex', gap: '4px' }}>
                                <button
                                  onClick={() => { setCommentInput(p => p + '@'); setShowMentionDrop(true); commentRef.current?.focus(); }}
                                  style={{ height: '26px', width: '26px', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'transparent', border: 'none', cursor: 'pointer', color: '#9CA3AF' }}
                                  onMouseEnter={e => { e.currentTarget.style.background = '#E4E4E8'; e.currentTarget.style.color = '#6B7280'; }}
                                  onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#9CA3AF'; }}
                                  title="Mencionar alguien"
                                >
                                  <AtSign className="h-3.5 w-3.5" />
                                </button>
                                <button
                                  onClick={() => commentFileInputRef.current?.click()}
                                  style={{ height: '26px', width: '26px', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: commentAttachment ? '#F3F4F6' : 'transparent', border: 'none', cursor: 'pointer', color: commentAttachment ? '#111827' : '#9CA3AF' }}
                                  onMouseEnter={e => { if (!commentAttachment) { e.currentTarget.style.background = '#E4E4E8'; e.currentTarget.style.color = '#6B7280'; } }}
                                  onMouseLeave={e => { if (!commentAttachment) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#9CA3AF'; } }}
                                  title="Adjuntar archivo"
                                >
                                  <Paperclip className="h-3.5 w-3.5" />
                                </button>
                                <input
                                  ref={commentFileInputRef}
                                  type="file"
                                  style={{ display: 'none' }}
                                  onChange={e => {
                                    const file = e.target.files?.[0];
                                    if (!file) return;
                                    const sizeKB = file.size / 1024;
                                    const sizeStr = sizeKB > 1024 ? `${(sizeKB / 1024).toFixed(1)} MB` : `${Math.round(sizeKB)} KB`;
                                    const ext = file.name.split('.').pop()?.toLowerCase() ?? 'file';
                                    setCommentAttachment({ name: file.name, size: sizeStr, type: ext });
                                    e.target.value = '';
                                  }}
                                />
                              </div>
                              <button
                                onClick={submitComment}
                                disabled={!commentInput.trim() && !commentAttachment}
                                style={{ display: 'flex', alignItems: 'center', gap: '5px', height: '26px', padding: '0 10px', borderRadius: '6px', border: 'none', background: (commentInput.trim() || commentAttachment) ? '#111827' : '#E4E4E8', color: (commentInput.trim() || commentAttachment) ? '#FFFFFF' : '#9CA3AF', fontSize: '12px', fontWeight: 600, cursor: (commentInput.trim() || commentAttachment) ? 'pointer' : 'default', transition: 'all 150ms' }}
                              >
                                <Send className="h-3 w-3" /> Enviar
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Actividades */}
                  {activeTab === 'activities' && (
                    <div className="agenda-scroll">
                    {(() => {
                    type ActivityItem = { id: number; type: string; user: string; userBg: string; userColor: string; text: string; value: string | null; time: string; date: string };
                    const activityList: ActivityItem[] = [];
                    const grouped: { date: string; items: ActivityItem[] }[] = [];
                    activityList.forEach(a => {
                      const last = grouped[grouped.length - 1];
                      if (last && last.date === a.date) last.items.push(a);
                      else grouped.push({ date: a.date, items: [a] });
                    });
                    let globalActivityIdx = 0;
                    if (grouped.length === 0) return (
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '48px 0', color: '#9CA3AF', gap: '8px' }}>
                        <Activity style={{ width: '28px', height: '28px', opacity: 0.3 }} />
                        <p style={{ fontSize: '12px', fontWeight: 500, margin: 0 }}>Sin actividad registrada</p>
                      </div>
                    );
                    return (
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        {grouped.map((group, gi) => (
                          <div key={group.date} style={{ display: 'flex', gap: '0', marginBottom: gi < grouped.length - 1 ? '4px' : '0' }}>
                            {/* Left timeline column */}
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '32px', flexShrink: 0 }}>
                              {/* Date dot */}
                              <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#111827', border: '2px solid #FFFFFF', boxShadow: '0 0 0 1.5px #D8D8DE', flexShrink: 0, marginTop: '3px' }} />
                              {/* Vertical line */}
                              <div style={{ width: '1.5px', flex: 1, background: '#E4E4E8', marginTop: '4px' }} />
                            </div>

                            {/* Right content */}
                            <div style={{ flex: 1, minWidth: 0, paddingBottom: '8px' }}>
                              {/* Date label */}
                              <span style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#111827', letterSpacing: '-0.01em', marginBottom: '6px', paddingTop: '1px' }}>{group.date}</span>

                              {/* Activity rows */}
                              {group.items.map((activity, ai) => {
                                const cfg = ACTIVITY_CFG[activity.type] ?? ACTIVITY_CFG.comment;
                                const isLast = ai === group.items.length - 1;
                                const rowIdx = globalActivityIdx++;
                                return (
                                  <div key={activity.id} style={{ display: 'flex', alignItems: 'center', gap: '0', marginBottom: isLast ? '0' : '2px', animation: `activity-stagger 220ms cubic-bezier(.22,1,.36,1) ${rowIdx * 45}ms both` }}>
                                    {/* Item connector */}
                                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '0', position: 'relative', marginLeft: '-32px', paddingLeft: '32px' }} />

                                    {/* Row */}
                                    <div
                                      style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '10px', padding: '7px 10px', borderRadius: '8px', border: '1px solid transparent', transition: 'all 120ms', cursor: 'default' }}
                                      onMouseEnter={e => { e.currentTarget.style.background = '#F8F8FA'; e.currentTarget.style.borderColor = '#E4E4E8'; }}
                                      onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = 'transparent'; }}
                                    >
                                      {/* Icon */}
                                      <div style={{ width: '26px', height: '26px', borderRadius: '8px', background: cfg.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                        <cfg.Icon style={{ width: '12px', height: '12px', color: cfg.color }} />
                                      </div>

                                      {/* Text */}
                                      <p style={{ fontSize: '13px', color: '#6B7280', lineHeight: 1.4, margin: 0, flex: 1, minWidth: 0, letterSpacing: '-0.01em' }}>
                                        <span style={{ fontWeight: 600, color: '#111827' }}>{activity.user}</span>{' '}
                                        {activity.text}
                                        {activity.value && (
                                          <span style={{ display: 'inline-block', marginLeft: '5px', fontSize: '11px', fontWeight: 600, padding: '1px 7px', borderRadius: '4px', background: cfg.bg, color: cfg.color }}>
                                            {activity.value}
                                          </span>
                                        )}
                                      </p>

                                      {/* Time */}
                                      <span style={{ fontSize: '12px', color: '#9CA3AF', fontWeight: 500, whiteSpace: 'nowrap', flexShrink: 0, fontVariantNumeric: 'tabular-nums' }}>{activity.time}</span>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        ))}
                      </div>
                    );
                    })()}
                    </div>
                  )}

                  </div>{/* end tab-fade-in wrapper */}
                </div>{/* end tabs section */}
              </div>{/* end body */}

          </>
        ) : null}
      </div>
      </div>
    </div>
    </>
  );
}
