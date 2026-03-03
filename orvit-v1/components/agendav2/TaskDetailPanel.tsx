'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { FileTypeIcon } from '@/components/ui/file-type-icon';
import {
  X,
  Plus,
  Check,
  Calendar as CalendarIcon,
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
  Sparkles,
  RefreshCw,
  UserCheck,
  Flame,
  Copy,
  Trash2,
  Eye,
  EyeOff,
  FolderOpen,
  Bell,
  Clock,
  Archive,
  ArchiveRestore,
  type LucideIcon,
} from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { TaskCommentThread } from './TaskCommentThread';
import { MentionInput } from './MentionInput';
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
import type { TaskGroupItem } from './AgendaV2Sidebar';
import { useAuth } from '@/contexts/AuthContext';
import { useUsers } from '@/hooks/use-users';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as CalendarUI } from '@/components/ui/calendar';

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

const FALLBACK_MENTION_PEOPLE = ['Juan P.', 'María G.', 'Carlos R.', 'Ana L.', 'Pedro M.'];

const COMMENT_COLORS = [
  { bg: '#F3F4F6', color: '#111827' },
  { bg: '#ECFDF5', color: '#059669' },
  { bg: '#FFFBEB', color: '#D97706' },
  { bg: '#EEF2FF', color: '#6366F1' },
  { bg: '#FFF1F2', color: '#DC2626' },
];

const AVATAR_COLORS = [
  { bg: '#F3F4F6', color: '#111827' },
  { bg: '#ECFDF5', color: '#059669' },
  { bg: '#FFFBEB', color: '#D97706' },
  { bg: '#EEF2FF', color: '#6366F1' },
  { bg: '#FFF1F2', color: '#DC2626' },
];


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

const PANEL_STYLES = `
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
    `;

interface TaskDetailPanelProps {
  task: AgendaTask | null;
  open: boolean;
  onClose: () => void;
  onStatusChange?: (task: AgendaTask, status: AgendaTaskStatus) => Promise<void>;
  onTaskUpdate?: (task: AgendaTask, data: Record<string, unknown>) => Promise<void>;
  onEdit?: (task: AgendaTask) => void;
  onDuplicate?: (task: AgendaTask) => Promise<void>;
  onDelete?: (task: AgendaTask) => Promise<void>;
  groups?: TaskGroupItem[];
  expanded?: boolean;
  onExpandedChange?: (v: boolean) => void;
}

export function TaskDetailPanel({ task, open, onClose, onEdit, onDuplicate, onDelete, onTaskUpdate, groups, expanded = false, onExpandedChange }: TaskDetailPanelProps) {
  const { user: currentUser } = useAuth();
  const { users: companyUsers } = useUsers();
  const queryClient = useQueryClient();
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
  const [openAnim,   setOpenAnim]   = useState(false);
  const [expandAnim, setExpandAnim] = useState<'expand' | 'contract' | null>(null);
  const [isFavorite, setIsFavorite]       = useState(false);
  const [showAssigneePop, setShowAssigneePop] = useState(false);
  const [showAssigneeHover, setShowAssigneeHover] = useState(false);
  const [assigneeSearch, setAssigneeSearch] = useState('');
  const [localAssigneeNames, setLocalAssigneeNames] = useState<string[] | null>(null);
  const assigneePopRef = useRef<HTMLDivElement>(null);

  // Inline editing states
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [showPriorityPop, setShowPriorityPop] = useState(false);
  const [showDatePop, setShowDatePop] = useState(false);
  const [isEditingDesc, setIsEditingDesc] = useState(false);
  const [editDesc, setEditDesc] = useState('');
  const [showGroupPop, setShowGroupPop] = useState(false);
  const [showReminderForm, setShowReminderForm] = useState(false);
  const [reminderDate, setReminderDate] = useState('');
  const [reminderTime, setReminderTime] = useState('');
  const [comments, setComments]     = useState<CommentItem[]>([]);
  const prevOpenRef     = useRef(false);
  const prevExpandedRef = useRef(expanded);

  const MENTION_PEOPLE = useMemo(
    () => companyUsers.length > 0 ? companyUsers.map(u => u.name) : FALLBACK_MENTION_PEOPLE,
    [companyUsers]
  );

  // Members list for MentionInput — uses real user IDs and names
  const mentionMembers = useMemo(
    () => companyUsers.map(u => ({ id: u.id, name: u.name, avatar: undefined })),
    [companyUsers]
  );

  // ── Inline edit handlers ──────────────────────────────────────────────────
  async function handleInlineUpdate(data: Record<string, unknown>) {
    if (!task || !onTaskUpdate) return;
    await onTaskUpdate(task, data);
  }

  async function handleTitleSave() {
    const trimmed = editTitle.trim();
    if (!trimmed || trimmed === task?.title) {
      setIsEditingTitle(false);
      return;
    }
    await handleInlineUpdate({ title: trimmed });
    setIsEditingTitle(false);
  }

  async function handlePriorityChange(priority: Priority) {
    setShowPriorityPop(false);
    await handleInlineUpdate({ priority });
  }

  async function handleDateChange(date: Date | undefined) {
    setShowDatePop(false);
    await handleInlineUpdate({ dueDate: date ? date.toISOString() : null });
  }

  async function handleAssigneeToggle(userId: number, userName: string) {
    if (!task) return;
    const isCurrentAssignee = task.assignedToUserId === userId;
    await handleInlineUpdate({
      assignedToUserId: isCurrentAssignee ? null : userId,
      assignedToName: isCurrentAssignee ? null : userName,
    });
  }

  async function handleDeleteTask() {
    if (!task || !onDelete) return;
    if (!confirm('¿Eliminar esta tarea? Esta acción no se puede deshacer.')) return;
    await onDelete(task);
  }

  async function handleDescSave() {
    const trimmed = editDesc.trim();
    // Allow saving empty to clear description
    if (trimmed === (task?.description ?? '')) {
      setIsEditingDesc(false);
      return;
    }
    await handleInlineUpdate({ description: trimmed || null });
    setIsEditingDesc(false);
  }

  async function handleGroupChange(groupId: number | null) {
    setShowGroupPop(false);
    await handleInlineUpdate({ groupId });
  }

  async function handleVisibilityToggle() {
    if (!task) return;
    await handleInlineUpdate({ isCompanyVisible: !task.isCompanyVisible });
  }

  async function handleArchiveToggle() {
    if (!task) return;
    await handleInlineUpdate({ isArchived: !task.isArchived });
    if (!task.isArchived) onClose();
  }

  async function handleAddReminder() {
    if (!task || !reminderDate || !reminderTime) return;
    const remindAt = new Date(`${reminderDate}T${reminderTime}:00`).toISOString();
    try {
      const res = await fetch('/api/agenda/reminders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: `Recordatorio: ${task.title}`,
          remindAt,
          taskId: task.id,
          companyId: task.companyId,
        }),
      });
      if (!res.ok) throw new Error();
      queryClient.invalidateQueries({ queryKey: ['agendav2-tasks'] });
      setShowReminderForm(false);
      setReminderDate('');
      setReminderTime('');
    } catch {
      // silently fail — toast handled by caller if needed
    }
  }

  async function handleDeleteReminder(reminderId: number) {
    try {
      await fetch(`/api/agenda/reminders?id=${reminderId}`, { method: 'DELETE' });
      queryClient.invalidateQueries({ queryKey: ['agendav2-tasks'] });
    } catch {
      // silently fail
    }
  }

  async function submitComment(content: string, mentionedUserIds?: number[]): Promise<void> {
    if (!content.trim() || !task?.id) return;
    // Optimistic — temp id uses negative timestamp
    const tempId = -Date.now();
    setNewCommentId(tempId);
    setTimeout(() => setNewCommentId(null), 600);
    const tempComment: CommentItem = {
      id: tempId,
      authorId: currentUser?.id ? Number(currentUser.id) : undefined,
      authorAvatar: currentUser?.avatar ?? null,
      author: currentUser?.name ?? 'Tú',
      content: content.trim(),
      time: 'Ahora',
      createdAt: new Date(),
      updatedAt: new Date(),
      bg: '#F3F4F6', color: '#111827',
      likes: 0, likedByMe: false,
      mentions: [], replies: [],
    };
    setComments(prev => [...prev, tempComment]);
    return fetch(`/api/agenda/tasks/${task.id}/comments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: content.trim(), mentionedUserIds: mentionedUserIds ?? [] }),
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
        queryClient.invalidateQueries({ queryKey: ['agenda-comments', task.id] });
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

  // ── Fetch subtasks via React Query (cached across re-opens) ──
  const taskId = task?.id;
  const { data: subtasksData } = useQuery({
    queryKey: ['agenda-subtasks', taskId],
    queryFn: async () => {
      const r = await fetch(`/api/agenda/tasks/${taskId}/subtasks`);
      if (!r.ok) return [];
      const data: any[] = await r.json();
      return data.map(s => ({ id: s.id.toString(), title: s.title, completed: s.done, note: s.note ?? undefined }));
    },
    enabled: !!taskId && open,
    staleTime: 2 * 60 * 1000, // 2 min cache
  });
  useEffect(() => { if (subtasksData) setSubtasks(subtasksData); }, [subtasksData]);
  useEffect(() => { setSubtasks([]); setComments([]); }, [taskId]);

  // ── Fetch comments via React Query (cached across re-opens) ──
  const { data: commentsData } = useQuery({
    queryKey: ['agenda-comments', taskId],
    queryFn: async () => {
      const r = await fetch(`/api/agenda/tasks/${taskId}/comments`);
      if (!r.ok) return [];
      const data: any[] = await r.json();
      return data.map((c, i) => ({
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
      }));
    },
    enabled: !!taskId && open,
    staleTime: 60 * 1000, // 1 min cache
  });
  useEffect(() => { if (commentsData) setComments(commentsData); }, [commentsData]);

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
  const taskAssigneesArr: AssigneeOption[] = useMemo(() => {
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
  }, [companyUsers, localAssigneeNames, task]);

  // Actual assigned person(s) for avatar display (not all company users)
  const displayAssignees: AssigneeOption[] = useMemo(() => {
    if (!task) return [];
    const people: AssigneeOption[] = [];
    if (task.assignedToUser) {
      const idx = companyUsers.findIndex(u => u.id === task.assignedToUser?.id);
      const col = AVATAR_COLORS[(idx >= 0 ? idx : 0) % AVATAR_COLORS.length];
      people.push({
        id: task.assignedToUser.id,
        name: task.assignedToUser.name,
        initials: task.assignedToUser.name.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase(),
        ...col,
      });
    } else if (task.assignedToName && task.assignedToName !== 'Sin asignar') {
      people.push({
        name: task.assignedToName,
        initials: task.assignedToName.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase(),
        ...AVATAR_COLORS[0],
      });
    }
    return people;
  }, [task, companyUsers]);

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
    <style>{PANEL_STYLES}</style>
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
                    <DropdownMenuItem className="text-xs gap-2" onClick={handleArchiveToggle}>
                      {task?.isArchived
                        ? <><ArchiveRestore className="h-3 w-3" /> Desarchivar tarea</>
                        : <><Archive className="h-3 w-3" /> Archivar tarea</>
                      }
                    </DropdownMenuItem>
                    {onDelete && (
                      <>
                        <div style={{ height: '1px', background: '#E4E4E8', margin: '4px 0' }} />
                        <DropdownMenuItem className="text-xs gap-2 text-red-600 focus:text-red-600" onClick={handleDeleteTask}>
                          <Trash2 className="h-3 w-3" /> Eliminar tarea
                        </DropdownMenuItem>
                      </>
                    )}
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

              {/* Title — click to edit */}
              {isEditingTitle ? (
                <input
                  autoFocus
                  value={editTitle}
                  onChange={e => setEditTitle(e.target.value)}
                  onBlur={handleTitleSave}
                  onKeyDown={e => {
                    if (e.key === 'Enter') handleTitleSave();
                    if (e.key === 'Escape') setIsEditingTitle(false);
                  }}
                  style={{ fontSize: '18px', fontWeight: 600, color: '#111827', lineHeight: 1.3, letterSpacing: '-0.02em', marginBottom: '14px', width: '100%', border: '1.5px solid #6366F1', borderRadius: '6px', padding: '2px 6px', outline: 'none', background: '#FAFAFE', fontFamily: 'inherit' }}
                />
              ) : (
                <h2
                  onClick={() => { if (onTaskUpdate) { setEditTitle(task.title); setIsEditingTitle(true); } }}
                  style={{ fontSize: '18px', fontWeight: 600, color: '#111827', lineHeight: 1.3, letterSpacing: '-0.02em', marginBottom: '14px', cursor: onTaskUpdate ? 'text' : 'default', borderRadius: '6px', padding: '2px 6px', margin: '0 -6px 14px', transition: 'background 150ms' }}
                  onMouseEnter={e => { if (onTaskUpdate) e.currentTarget.style.background = '#F4F4F6'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                >
                  {task.title}
                </h2>
              )}

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
                    {displayAssignees.slice(0, 3).map((person, pi) => (
                      <div
                        key={person.name}
                        style={{ width: '26px', height: '26px', borderRadius: '50%', background: person.bg, border: '2px solid #FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', marginLeft: pi > 0 ? '-8px' : '0', zIndex: 3 - pi, position: 'relative' }}
                      >
                        <span style={{ fontSize: '8px', fontWeight: 700, color: person.color }}>{person.initials}</span>
                      </div>
                    ))}
                    {displayAssignees.length === 0 && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '5px', color: '#9CA3AF' }}>
                        <UserPlus className="h-3.5 w-3.5" />
                        <span style={{ fontSize: '12px', fontWeight: 500 }}>Sin asignar</span>
                      </div>
                    )}
                    {displayAssignees.length > 0 && (
                      <span style={{ fontSize: '12px', fontWeight: 500, color: '#6B7280', marginLeft: '8px' }}>
                        {displayAssignees[0].name}
                      </span>
                    )}
                  </div>

                  {/* Hover tooltip with all names */}
                  {/* Hover tooltip — just shows current assignees, no add button */}
                  {showAssigneeHover && !showAssigneePop && displayAssignees.length > 0 && (
                    <div style={{ position: 'absolute', top: '34px', left: 0, zIndex: 60, background: '#FFFFFF', border: '1.5px solid #D8D8DE', borderRadius: '8px', boxShadow: '0 4px 16px rgba(0,0,0,.10)', padding: '8px', minWidth: '160px', pointerEvents: 'none' }}>
                      {displayAssignees.map(person => (
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

                      {/* Unified list — company users with assign/unassign */}
                      <div style={{ overflowY: 'auto', flex: 1 }}>
                        {(() => {
                          const filtered = companyUsers.filter(
                            u => !assigneeSearch || u.name.toLowerCase().includes(assigneeSearch.toLowerCase())
                          );
                          if (filtered.length === 0) return (
                            <p style={{ fontSize: '12px', color: '#9CA3AF', padding: '8px', textAlign: 'center', fontFamily: 'inherit' }}>Sin resultados</p>
                          );
                          return filtered.map((u, i) => {
                            const isSelected = task?.assignedToUserId === u.id;
                            const col = AVATAR_COLORS[i % AVATAR_COLORS.length];
                            return (
                              <button
                                key={u.id}
                                onClick={() => {
                                  handleAssigneeToggle(u.id, u.name);
                                  setShowAssigneePop(false);
                                }}
                                style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 6px', borderRadius: '7px', border: 'none', background: isSelected ? '#F0FDF4' : 'transparent', cursor: 'pointer', width: '100%', textAlign: 'left', transition: 'background 120ms', fontFamily: 'inherit', marginBottom: '1px' }}
                                onMouseEnter={e => (e.currentTarget.style.background = isSelected ? '#E6FAF0' : '#F4F4F6')}
                                onMouseLeave={e => (e.currentTarget.style.background = isSelected ? '#F0FDF4' : 'transparent')}
                              >
                                <div style={{ width: '24px', height: '24px', borderRadius: '50%', background: col.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                  <span style={{ fontSize: '8px', fontWeight: 700, color: col.color }}>{u.name.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase()}</span>
                                </div>
                                <span style={{ fontSize: '12px', fontWeight: isSelected ? 600 : 500, color: isSelected ? '#111827' : '#374151', flex: 1, fontFamily: 'inherit' }}>{u.name}</span>
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

                {/* Priority — click to change */}
                <Popover open={showPriorityPop} onOpenChange={setShowPriorityPop}>
                  <PopoverTrigger asChild>
                    <div
                      style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: onTaskUpdate ? 'pointer' : 'default', borderRadius: '6px', padding: '2px 4px', margin: '0 -4px', transition: 'background 150ms' }}
                      onMouseEnter={e => { if (onTaskUpdate) e.currentTarget.style.background = '#F4F4F6'; }}
                      onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                    >
                      <span style={{ fontSize: '12px', fontWeight: 500, color: '#6B7280' }}>Prioridad</span>
                      <span style={{ fontSize: '12px', fontWeight: 600, padding: '2px 8px', borderRadius: '6px', background: priorityChip.bg, color: priorityChip.text }}>
                        {priorityChip.label}
                      </span>
                    </div>
                  </PopoverTrigger>
                  {onTaskUpdate && (
                    <PopoverContent align="start" className="w-[140px] p-1">
                      {(Object.entries(PRIORITY_CHIP) as [Priority, { bg: string; text: string; label: string }][]).map(([key, chip]) => (
                        <button
                          key={key}
                          onClick={() => handlePriorityChange(key)}
                          style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%', padding: '6px 8px', borderRadius: '6px', border: 'none', background: task.priority === key ? '#F4F4F6' : 'transparent', cursor: 'pointer', transition: 'background 120ms', fontFamily: 'inherit' }}
                          onMouseEnter={e => (e.currentTarget.style.background = '#F4F4F6')}
                          onMouseLeave={e => (e.currentTarget.style.background = task.priority === key ? '#F4F4F6' : 'transparent')}
                        >
                          <span style={{ fontSize: '12px', fontWeight: 600, padding: '2px 8px', borderRadius: '6px', background: chip.bg, color: chip.text }}>{chip.label}</span>
                          {task.priority === key && <Check className="h-3 w-3" style={{ color: '#059669' }} />}
                        </button>
                      ))}
                    </PopoverContent>
                  )}
                </Popover>

                {/* Divider */}
                <div style={{ width: '1px', height: '18px', background: '#E4E4E8' }} />

                {/* Due date — click to change */}
                <Popover open={showDatePop} onOpenChange={setShowDatePop}>
                  <PopoverTrigger asChild>
                    <div
                      style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: onTaskUpdate ? 'pointer' : 'default', borderRadius: '6px', padding: '2px 4px', margin: '0 -4px', transition: 'background 150ms' }}
                      onMouseEnter={e => { if (onTaskUpdate) e.currentTarget.style.background = '#F4F4F6'; }}
                      onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                    >
                      <CalendarIcon className="h-3.5 w-3.5" style={{ color: '#9CA3AF' }} />
                      <span style={{ fontSize: '12px', fontWeight: 500, color: '#6B7280' }}>Vencimiento</span>
                      {task.dueDate ? (
                        <span style={{ fontSize: '12px', fontWeight: 600, color: isOverdue ? '#DC2626' : isToday(new Date(task.dueDate)) ? '#D97706' : '#111827' }}>
                          {format(new Date(task.dueDate), "d 'de' MMMM", { locale: es })}
                        </span>
                      ) : (
                        <span style={{ fontSize: '12px', color: '#9CA3AF' }}>Sin fecha</span>
                      )}
                    </div>
                  </PopoverTrigger>
                  {onTaskUpdate && (
                    <PopoverContent align="start" className="w-auto p-0">
                      <CalendarUI
                        mode="single"
                        selected={task.dueDate ? new Date(task.dueDate) : undefined}
                        onSelect={handleDateChange}
                        locale={es}
                      />
                      {task.dueDate && (
                        <div style={{ borderTop: '1px solid #E4E4E8', padding: '6px 8px' }}>
                          <button
                            onClick={() => handleDateChange(undefined)}
                            style={{ fontSize: '12px', color: '#DC2626', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 500, fontFamily: 'inherit', padding: '4px 8px', borderRadius: '6px', width: '100%', textAlign: 'center', transition: 'background 120ms' }}
                            onMouseEnter={e => (e.currentTarget.style.background = '#FEE2E2')}
                            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                          >
                            Quitar fecha
                          </button>
                        </div>
                      )}
                    </PopoverContent>
                  )}
                </Popover>

                {/* Group selector — click to change */}
                {groups && groups.length > 0 && (
                  <>
                    <div style={{ width: '1px', height: '18px', background: '#E4E4E8' }} />
                    <Popover open={showGroupPop} onOpenChange={setShowGroupPop}>
                      <PopoverTrigger asChild>
                        <div
                          style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: onTaskUpdate ? 'pointer' : 'default', borderRadius: '6px', padding: '2px 4px', margin: '0 -4px', transition: 'background 150ms' }}
                          onMouseEnter={e => { if (onTaskUpdate) e.currentTarget.style.background = '#F4F4F6'; }}
                          onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                        >
                          <FolderOpen className="h-3.5 w-3.5" style={{ color: '#9CA3AF' }} />
                          {task.group ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                              <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: task.group.color, flexShrink: 0 }} />
                              <span style={{ fontSize: '12px', fontWeight: 600, color: '#111827' }}>{task.group.name}</span>
                            </div>
                          ) : (
                            <span style={{ fontSize: '12px', color: '#9CA3AF' }}>Sin grupo</span>
                          )}
                        </div>
                      </PopoverTrigger>
                      {onTaskUpdate && (
                        <PopoverContent align="start" className="w-[200px] p-1">
                          <button
                            onClick={() => handleGroupChange(null)}
                            style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%', padding: '6px 8px', borderRadius: '6px', border: 'none', background: !task.groupId ? '#F4F4F6' : 'transparent', cursor: 'pointer', transition: 'background 120ms', fontFamily: 'inherit' }}
                            onMouseEnter={e => (e.currentTarget.style.background = '#F4F4F6')}
                            onMouseLeave={e => (e.currentTarget.style.background = !task.groupId ? '#F4F4F6' : 'transparent')}
                          >
                            <span style={{ fontSize: '12px', color: '#9CA3AF' }}>Sin grupo</span>
                            {!task.groupId && <Check className="h-3 w-3 ml-auto" style={{ color: '#059669' }} />}
                          </button>
                          <div style={{ height: '1px', background: '#E4E4E8', margin: '4px 0' }} />
                          {groups.map(g => (
                            <button
                              key={g.id}
                              onClick={() => handleGroupChange(g.id)}
                              style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%', padding: '6px 8px', borderRadius: '6px', border: 'none', background: task.groupId === g.id ? '#F4F4F6' : 'transparent', cursor: 'pointer', transition: 'background 120ms', fontFamily: 'inherit' }}
                              onMouseEnter={e => (e.currentTarget.style.background = '#F4F4F6')}
                              onMouseLeave={e => (e.currentTarget.style.background = task.groupId === g.id ? '#F4F4F6' : 'transparent')}
                            >
                              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: g.color, flexShrink: 0 }} />
                              <span style={{ fontSize: '12px', fontWeight: task.groupId === g.id ? 600 : 500, color: '#374151', flex: 1, textAlign: 'left' }}>{g.name}</span>
                              {task.groupId === g.id && <Check className="h-3 w-3" style={{ color: '#059669' }} />}
                            </button>
                          ))}
                        </PopoverContent>
                      )}
                    </Popover>
                  </>
                )}

                {/* Visibility toggle */}
                {onTaskUpdate && (
                  <>
                    <div style={{ width: '1px', height: '18px', background: '#E4E4E8' }} />
                    <button
                      onClick={handleVisibilityToggle}
                      style={{ display: 'flex', alignItems: 'center', gap: '5px', borderRadius: '6px', padding: '2px 6px', margin: '0 -4px', transition: 'background 150ms', border: 'none', background: 'transparent', cursor: 'pointer', fontFamily: 'inherit' }}
                      onMouseEnter={e => (e.currentTarget.style.background = '#F4F4F6')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                      title={task.isCompanyVisible ? 'Visible para toda la empresa' : 'Solo visible para asignados'}
                    >
                      {task.isCompanyVisible ? (
                        <Eye className="h-3.5 w-3.5" style={{ color: '#059669' }} />
                      ) : (
                        <EyeOff className="h-3.5 w-3.5" style={{ color: '#9CA3AF' }} />
                      )}
                      <span style={{ fontSize: '11px', fontWeight: 500, color: task.isCompanyVisible ? '#059669' : '#9CA3AF' }}>
                        {task.isCompanyVisible ? 'Empresa' : 'Privada'}
                      </span>
                    </button>
                  </>
                )}
              </div>

            </div>

            {/* Body — fixed layout: desc+attachments shrink, tabs flex-1 */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', animation: openAnim ? 'modal-content-reveal 420ms cubic-bezier(.22,1,.36,1) 380ms both' : undefined }}>

              {/* Description + Attachments — fixed top section */}
              <div style={{ padding: '14px 20px', display: 'flex', flexDirection: 'column', gap: '12px', flexShrink: 0, borderBottom: '1px solid #F0F0F4' }}>

                {/* Descripción — click to edit */}
                {isEditingDesc ? (
                  <textarea
                    autoFocus
                    value={editDesc}
                    onChange={e => setEditDesc(e.target.value)}
                    onBlur={handleDescSave}
                    onKeyDown={e => {
                      if (e.key === 'Escape') setIsEditingDesc(false);
                    }}
                    rows={3}
                    placeholder="Escribe una descripción..."
                    style={{ fontSize: '14px', color: '#374151', lineHeight: 1.7, margin: 0, letterSpacing: '-0.01em', width: '100%', border: '1.5px solid #6366F1', borderRadius: '6px', padding: '6px 8px', outline: 'none', background: '#FAFAFE', fontFamily: 'inherit', resize: 'vertical', minHeight: '60px' }}
                  />
                ) : (
                  <div
                    onClick={() => { if (onTaskUpdate) { setEditDesc(task.description ?? ''); setIsEditingDesc(true); } }}
                    style={{ cursor: onTaskUpdate ? 'text' : 'default', borderRadius: '6px', padding: '4px 6px', margin: '0 -6px', transition: 'background 150ms', minHeight: '24px' }}
                    onMouseEnter={e => { if (onTaskUpdate) e.currentTarget.style.background = '#F4F4F6'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                  >
                    {task.description ? (
                      <p style={{ fontSize: '14px', color: '#374151', lineHeight: 1.7, margin: 0, letterSpacing: '-0.01em' }}>
                        {task.description}
                      </p>
                    ) : onTaskUpdate ? (
                      <p style={{ fontSize: '13px', color: '#9CA3AF', margin: 0, fontStyle: 'italic' }}>
                        Agregar descripción...
                      </p>
                    ) : null}
                  </div>
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

                {/* Reminders */}
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '5px', color: '#9CA3AF' }}>
                      <Bell className="h-3 w-3" />
                      <span style={{ fontSize: '12px', fontWeight: 500, color: '#111827' }}>
                        Recordatorios ({task?.reminders?.length ?? 0})
                      </span>
                    </div>
                    {onTaskUpdate && (
                      <button
                        onClick={() => setShowReminderForm(!showReminderForm)}
                        style={{ fontSize: '11px', color: '#6366F1', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}
                      >
                        {showReminderForm ? 'Cancelar' : '+ Agregar'}
                      </button>
                    )}
                  </div>
                  {showReminderForm && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
                      <input
                        type="date"
                        value={reminderDate}
                        onChange={e => setReminderDate(e.target.value)}
                        style={{ flex: 1, fontSize: '12px', padding: '5px 8px', borderRadius: '6px', border: '1px solid #E4E4E8', outline: 'none' }}
                      />
                      <input
                        type="time"
                        value={reminderTime}
                        onChange={e => setReminderTime(e.target.value)}
                        style={{ width: '90px', fontSize: '12px', padding: '5px 8px', borderRadius: '6px', border: '1px solid #E4E4E8', outline: 'none' }}
                      />
                      <button
                        onClick={handleAddReminder}
                        disabled={!reminderDate || !reminderTime}
                        style={{
                          fontSize: '11px', fontWeight: 600, color: '#FFFFFF',
                          background: reminderDate && reminderTime ? '#6366F1' : '#D1D5DB',
                          border: 'none', borderRadius: '6px', padding: '5px 10px', cursor: reminderDate && reminderTime ? 'pointer' : 'default',
                        }}
                      >
                        Crear
                      </button>
                    </div>
                  )}
                  {(task?.reminders ?? []).length > 0 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      {task!.reminders!.map(r => (
                        <div
                          key={r.id}
                          style={{
                            display: 'flex', alignItems: 'center', gap: '8px',
                            padding: '5px 8px', borderRadius: '6px',
                            background: r.isSent ? '#F3F4F6' : '#EEF2FF',
                            border: `1px solid ${r.isSent ? '#E5E7EB' : '#C7D2FE'}`,
                          }}
                        >
                          <Clock className="h-3 w-3" style={{ color: r.isSent ? '#9CA3AF' : '#6366F1', flexShrink: 0 }} />
                          <span style={{ flex: 1, fontSize: '12px', color: r.isSent ? '#9CA3AF' : '#111827', textDecoration: r.isSent ? 'line-through' : 'none' }}>
                            {format(new Date(r.remindAt), "dd MMM yyyy 'a las' HH:mm", { locale: es })}
                          </span>
                          {!r.isSent && onTaskUpdate && (
                            <button
                              onClick={() => handleDeleteReminder(r.id)}
                              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px', color: '#9CA3AF' }}
                            >
                              <X className="h-3 w-3" />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
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
                                .then(s => {
                                  setSubtasks(prev => [...prev, { id: s.id.toString(), title: s.title, completed: s.done, note: s.note ?? undefined }]);
                                  queryClient.invalidateQueries({ queryKey: ['agenda-subtasks', task!.id] });
                                })
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
                    {/* New comment input — MentionInput with @mention support */}
                    <div style={{ flexShrink: 0, borderTop: '1px solid #E4E4E8', paddingTop: '12px', paddingBottom: '14px' }}>
                      <MentionInput
                        onSubmit={submitComment}
                        placeholder="Escribe un comentario... Usa @ para mencionar"
                        members={mentionMembers}
                      />
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
