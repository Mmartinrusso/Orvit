'use client';

import { useState, useMemo, useRef, useEffect } from 'react';
import {
  Search, MoreHorizontal, Paperclip, MessageSquare,
  CalendarDays, AlertCircle,
  CheckCircle2, Clock, Circle, ChevronRight, SlidersHorizontal,
  Send, AtSign, Sparkles, RefreshCw, UserCheck, Flame,
  type LucideIcon, X, ArrowUpDown, Loader2, Check, Pencil, Trash2,
} from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { format, formatDistanceToNow, isToday, isYesterday, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { FileTypeIcon } from '@/components/ui/file-type-icon';
import { SubtaskList, type SubtaskItem } from './SubtaskList';
import type { AgendaTask, Priority, AgendaTaskStatus } from '@/lib/agenda/types';
import { TASK_STATUS_CONFIG, isTaskOverdue } from '@/lib/agenda/types';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCompany } from '@/contexts/CompanyContext';
import { useAuth } from '@/contexts/AuthContext';
import { useUsers } from '@/hooks/use-users';
import { toast } from 'sonner';

// ── Design tokens ─────────────────────────────────────────────────────────────

const PRIORITY_CHIP: Record<Priority, { bg: string; text: string; label: string }> = {
  LOW:    { bg: '#F3F4F6', text: '#6B7280', label: 'Baja' },
  MEDIUM: { bg: '#EFF6FF', text: '#1D4ED8', label: 'Media' },
  HIGH:   { bg: '#FEF3C7', text: '#D97706', label: 'Alta' },
  URGENT: { bg: '#FEE2E2', text: '#DC2626', label: 'Urgente' },
};

const PRIORITY_WEIGHT: Record<Priority, number> = {
  URGENT: 3, HIGH: 2, MEDIUM: 1, LOW: 0,
};

const STATUS_ICON: Record<AgendaTaskStatus, typeof Circle> = {
  PENDING:     Circle,
  IN_PROGRESS: Clock,
  WAITING:     Clock,
  COMPLETED:   CheckCircle2,
  CANCELLED:   CheckCircle2,
};

const STATUS_COLOR: Record<AgendaTaskStatus, string> = {
  PENDING:     '#9CA3AF',
  IN_PROGRESS: '#111827',
  WAITING:     '#D97706',
  COMPLETED:   '#059669',
  CANCELLED:   '#9CA3AF',
};

const STATUS_CHIP: Record<AgendaTaskStatus, { bg: string; text: string; dot: string }> = {
  PENDING:     { bg: '#F3F4F6', text: '#6B7280', dot: '#9CA3AF' },
  IN_PROGRESS: { bg: '#111827', text: '#FFFFFF', dot: '#FFFFFF' },
  WAITING:     { bg: '#FFFBEB', text: '#D97706', dot: '#D97706' },
  COMPLETED:   { bg: '#ECFDF5', text: '#059669', dot: '#059669' },
  CANCELLED:   { bg: '#FEE2E2', text: '#DC2626', dot: '#DC2626' },
};

const AVATAR_COLORS = [
  { bg: '#F3F4F6', fg: '#111827' },
  { bg: '#ECFDF5', fg: '#059669' },
  { bg: '#FFFBEB', fg: '#D97706' },
  { bg: '#EEF2FF', fg: '#6366F1' },
  { bg: '#FFF1F2', fg: '#DC2626' },
];

type ActivityType = 'create' | 'status' | 'assign' | 'comment' | 'priority' | 'attach';

const ACTIVITY_CFG: Record<ActivityType, { Icon: LucideIcon; bg: string; color: string }> = {
  create:   { Icon: Sparkles,      bg: '#F3F4F6', color: '#111827' },
  status:   { Icon: RefreshCw,     bg: '#EEF2FF', color: '#6366F1' },
  assign:   { Icon: UserCheck,     bg: '#ECFDF5', color: '#059669' },
  comment:  { Icon: MessageSquare, bg: '#FFFBEB', color: '#D97706' },
  priority: { Icon: Flame,         bg: '#FFF1F2', color: '#DC2626' },
  attach:   { Icon: Paperclip,     bg: '#F0F9FF', color: '#0EA5E9' },
};

type SortMode = 'created' | 'dueDate' | 'priority';

const SORT_LABELS: Record<SortMode, string> = {
  created:  'Recientes',
  dueDate:  'Vencimiento',
  priority: 'Prioridad',
};

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
  onEdit?: (task: AgendaTask) => void;
}

type FilterTab = 'all' | 'pending' | 'done';

interface CommentItem {
  id: number;
  authorId?: number;
  content: string;
  createdAt: string;
  isEdited?: boolean;
  author?: { name: string; avatar?: string };
  _optimistic?: boolean;
}

interface ActivityEvent {
  id: number | string;
  type: ActivityType;
  date: string;
  user: string;
  text: string;
}

// ── InboxItem ─────────────────────────────────────────────────────────────────

function InboxItem({
  task,
  index,
  isSelected,
  isRead,
  isCompleting,
  onClick,
  onQuickComplete,
}: {
  task: AgendaTask;
  index: number;
  isSelected: boolean;
  isRead: boolean;
  isCompleting: boolean;
  onClick: () => void;
  onQuickComplete: (e: React.MouseEvent) => void;
}) {
  const [hovered, setHovered] = useState(false);
  const overdue     = isTaskOverdue(task);
  const creatorName = task.createdBy?.name || 'Alguien';
  const avatarColor = AVATAR_COLORS[index % AVATAR_COLORS.length];
  const StatusIcon  = STATUS_ICON[task.status];
  const statusColor = STATUS_COLOR[task.status];
  const showUnread  = !isRead && task.status === 'PENDING';
  const pChip       = PRIORITY_CHIP[task.priority];
  const isCompleted = task.status === 'COMPLETED';

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        width: '100%',
        textAlign: 'left',
        padding: '14px 16px',
        borderBottom: '1px solid #F5F5F5',
        borderLeft: isSelected ? '2.5px solid #111827' : '2.5px solid transparent',
        background: isSelected ? '#F8F8F8' : hovered ? '#FAFAFA' : 'transparent',
        cursor: 'pointer',
        transition: 'background 120ms ease, border-color 120ms ease',
        display: 'block',
      }}
    >
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
          {showUnread && (
            <span
              style={{
                position: 'absolute', top: '-2px', right: '-2px',
                height: '9px', width: '9px', borderRadius: '50%',
                background: '#7C3AED', border: '2px solid #FFFFFF',
              }}
            />
          )}
        </div>

        {/* Content */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '3px' }}>
            <span style={{ fontSize: '12px', fontWeight: 700, color: '#111827' }}>
              {creatorName}
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              {overdue && <AlertCircle className="h-3 w-3" style={{ color: '#DC2626' }} />}
              <span style={{ fontSize: '10px', color: '#ADADAD' }}>{timeAgo(task.createdAt)}</span>
              {/* Quick complete — visible on hover */}
              {!isCompleted && (
                <div
                  role="button"
                  tabIndex={0}
                  onClick={onQuickComplete}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onQuickComplete(e as any); } }}
                  title="Completar tarea"
                  style={{
                    height: '20px', width: '20px', borderRadius: '50%',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: 'transparent',
                    border: `1.5px solid ${hovered ? '#059669' : '#D8D8DE'}`,
                    cursor: 'pointer', padding: 0,
                    transition: 'all 150ms ease',
                    opacity: hovered ? 1 : 0,
                    flexShrink: 0,
                  }}
                >
                  {isCompleting
                    ? <Loader2 className="h-2.5 w-2.5 animate-spin" style={{ color: '#059669' }} />
                    : <Check className="h-2.5 w-2.5" style={{ color: '#059669' }} />
                  }
                </div>
              )}
            </div>
          </div>

          <p style={{ fontSize: '12px', color: '#6B7280', lineHeight: 1.4, marginBottom: '6px' }}>
            te asignó{' '}
            <span style={{ fontWeight: 600, color: '#111827' }}>{task.title}</span>
          </p>

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
                <CalendarDays className="h-2.5 w-2.5" style={{ color: overdue ? '#DC2626' : '#ADADAD' }} />
                <span style={{ fontSize: '10px', color: overdue ? '#DC2626' : '#ADADAD' }}>
                  {format(parseISO(task.dueDate), 'dd MMM', { locale: es })}
                </span>
              </div>
            )}
          </div>

          {task.group && (
            <div style={{ marginTop: '5px', display: 'flex', alignItems: 'center', gap: '3px' }}>
              <span style={{ fontSize: '9px', color: '#C0C0C8' }}>en</span>
              <span style={{ fontSize: '10px', fontWeight: 600, color: '#7C3AED', background: '#F3F0FF', padding: '1px 6px', borderRadius: '999px' }}>
                {task.group.name}
              </span>
            </div>
          )}
        </div>
      </div>
    </button>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export function InboxView({ tasks, onTaskClick, onEdit }: InboxViewProps) {
  const queryClient        = useQueryClient();
  const { currentCompany } = useCompany();
  const { user: currentUser } = useAuth();
  const { users: companyUsers } = useUsers();
  const MENTION_PEOPLE = useMemo(
    () => companyUsers.length > 0 ? companyUsers.map(u => u.name) : [],
    [companyUsers]
  );

  const [search,            setSearch]            = useState('');
  const [filter,            setFilter]            = useState<FilterTab>('all');
  const [sortMode,          setSortMode]          = useState<SortMode>('created');
  const [showFilters,       setShowFilters]       = useState(false);
  const [filterPriority,    setFilterPriority]    = useState<Priority[]>([]);
  const [selectedTask,      setSelectedTask]      = useState<AgendaTask | null>(tasks[0] || null);
  const [subtasks,          setSubtasks]          = useState<SubtaskItem[]>([]);
  const [comments,          setComments]          = useState<CommentItem[]>([]);
  const [activeTab,         setActiveTab]         = useState<'subtasks'|'comments'|'activities'>('subtasks');
  const [activityEvents,    setActivityEvents]    = useState<ActivityEvent[]>([]);
  const [loadingActivity,   setLoadingActivity]   = useState(false);
  const [commentInput,      setCommentInput]      = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);
  const [editingCommentId,  setEditingCommentId]  = useState<number | null>(null);
  const [editingContent,    setEditingContent]    = useState('');
  const [hoveredCommentId,  setHoveredCommentId]  = useState<number | null>(null);
  const [showMentionDrop,   setShowMentionDrop]   = useState(false);
  const [localAttachments,  setLocalAttachments]  = useState<{ name: string; size: string; type: string }[]>([]);
  const [readIds,           setReadIds]           = useState<Set<number>>(new Set());
  const [completingIds,     setCompletingIds]     = useState<Set<number>>(new Set());
  const commentRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Derived counts — single pass over tasks array
  const { pendingCount, completedCount, unreadCount } = useMemo(() => {
    let pending = 0, completed = 0, unread = 0;
    for (const t of tasks) {
      if (t.status === 'COMPLETED') completed++;
      else if (t.status !== 'CANCELLED') pending++;
      if (t.status === 'PENDING' && !readIds.has(t.id)) unread++;
    }
    return { pendingCount: pending, completedCount: completed, unreadCount: unread };
  }, [tasks, readIds]);

  // Filter + sort tasks
  const filteredTasks = useMemo(() => {
    let list = [...tasks];

    if (filter === 'pending') list = list.filter(t => t.status !== 'COMPLETED' && t.status !== 'CANCELLED');
    if (filter === 'done')    list = list.filter(t => t.status === 'COMPLETED');
    if (filterPriority.length > 0) list = list.filter(t => filterPriority.includes(t.priority));

    if (search.trim()) {
      const lower = search.toLowerCase();
      list = list.filter(t =>
        t.title.toLowerCase().includes(lower) ||
        (t.description || '').toLowerCase().includes(lower) ||
        (t.createdBy?.name || '').toLowerCase().includes(lower)
      );
    }

    if (sortMode === 'dueDate') {
      list.sort((a, b) => {
        if (!a.dueDate && !b.dueDate) return 0;
        if (!a.dueDate) return 1;
        if (!b.dueDate) return -1;
        return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
      });
    } else if (sortMode === 'priority') {
      list.sort((a, b) => PRIORITY_WEIGHT[b.priority] - PRIORITY_WEIGHT[a.priority]);
    } else {
      list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }

    return list;
  }, [tasks, filter, filterPriority, search, sortMode]);

  // Group by date (only when sorting by created)
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

  // Fetch subtasks & comments via React Query (cached, deduped, auto-cancelled)
  const selectedTaskId = selectedTask?.id;

  const { data: subtasksData, isLoading: loadingSubtasks } = useQuery({
    queryKey: ['agenda-subtasks', selectedTaskId],
    queryFn: async () => {
      const r = await fetch(`/api/agenda/tasks/${selectedTaskId}/subtasks`);
      if (!r.ok) return [];
      const subs: any[] = await r.json();
      return subs.map((s: any) => ({
        id: String(s.id),
        title: s.title,
        completed: s.done,
        note: s.note ?? undefined,
      }));
    },
    enabled: !!selectedTaskId,
    staleTime: 2 * 60 * 1000,
  });

  const { data: commentsData, isLoading: loadingComments } = useQuery({
    queryKey: ['agenda-comments', selectedTaskId],
    queryFn: async () => {
      const r = await fetch(`/api/agenda/tasks/${selectedTaskId}/comments`);
      if (!r.ok) return [];
      const cmts: any[] = await r.json();
      return cmts.map((c: any) => ({
        id: c.id,
        authorId: c.authorId,
        content: c.content,
        createdAt: c.createdAt,
        isEdited: c.updatedAt && c.createdAt && new Date(c.updatedAt).getTime() - new Date(c.createdAt).getTime() > 1000,
        author: c.author,
      }));
    },
    enabled: !!selectedTaskId,
    staleTime: 60 * 1000,
  });

  // Sync query data to local state (keeps optimistic updates working)
  useEffect(() => { if (subtasksData) setSubtasks(subtasksData); }, [subtasksData]);
  useEffect(() => { if (commentsData) setComments(commentsData); }, [commentsData]);
  useEffect(() => { setSubtasks([]); setComments([]); }, [selectedTaskId]);

  // Keyboard navigation (↑↓ arrows)
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'TEXTAREA' || tag === 'INPUT') return;
      if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
      e.preventDefault();
      const idx = filteredTasks.findIndex(t => t.id === selectedTask?.id);
      if (idx === -1) {
        if (filteredTasks.length > 0) handleSelectTask(filteredTasks[0]);
        return;
      }
      const next = e.key === 'ArrowDown'
        ? Math.min(idx + 1, filteredTasks.length - 1)
        : Math.max(idx - 1, 0);
      if (next !== idx) handleSelectTask(filteredTasks[next]);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTask, filteredTasks]);

  function handleSelectTask(task: AgendaTask) {
    const isSameTask = selectedTask?.id === task.id;
    setSelectedTask(task);
    if (!isSameTask) setActiveTab('subtasks');
    setReadIds(prev => new Set([...prev, task.id]));
    onTaskClick?.(task);
  }

  async function handleCompleteTask(task: AgendaTask) {
    if (completingIds.has(task.id)) return;
    setCompletingIds(prev => new Set([...prev, task.id]));
    try {
      const r = await fetch(`/api/agenda/tasks/${task.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'COMPLETED' }),
      });
      if (!r.ok) throw new Error();
      toast.success('Tarea completada');
      queryClient.invalidateQueries({ queryKey: ['agendav2-tasks', currentCompany?.id] });
    } catch {
      toast.error('Error al completar la tarea');
    } finally {
      setCompletingIds(prev => { const s = new Set(prev); s.delete(task.id); return s; });
    }
  }

  function handleQuickComplete(e: React.MouseEvent, task: AgendaTask) {
    e.stopPropagation();
    handleCompleteTask(task);
  }

  async function submitComment() {
    if (!selectedTask || !commentInput.trim() || submittingComment) return;
    const content = commentInput.trim();
    const tempId = Date.now() * -1;
    const tempComment: CommentItem = {
      id: tempId,
      authorId: currentUser?.id,
      content,
      createdAt: new Date().toISOString(),
      author: { name: currentUser?.name || 'Tú' },
      _optimistic: true,
    };
    setComments(prev => [...prev, tempComment]);
    setCommentInput('');
    setShowMentionDrop(false);
    setSubmittingComment(true);
    try {
      const r = await fetch(`/api/agenda/tasks/${selectedTask.id}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content }),
      });
      if (!r.ok) throw new Error();
      const saved = await r.json();
      setComments(prev => prev.map(c => c.id === tempId ? { ...saved, _optimistic: false } : c));
    } catch {
      setComments(prev => prev.filter(c => c.id !== tempId));
      setCommentInput(content);
      toast.error('Error al enviar el comentario');
    } finally {
      setSubmittingComment(false);
    }
  }

  function deleteComment(commentId: number) {
    if (!selectedTask) return;
    setComments(prev => prev.filter(c => c.id !== commentId));
    fetch(`/api/agenda/tasks/${selectedTask.id}/comments/${commentId}`, { method: 'DELETE' })
      .then(r => { if (!r.ok) throw new Error(`${r.status}`); })
      .catch(() => {
        // Re-fetch on error to restore
        fetch(`/api/agenda/tasks/${selectedTask.id}/comments`)
          .then(r => r.ok ? r.json() : [])
          .then(data => setComments(data || []))
          .catch(() => {});
      });
  }

  function startEditComment(comment: CommentItem) {
    setEditingCommentId(comment.id);
    setEditingContent(comment.content);
  }

  function cancelEditComment() {
    setEditingCommentId(null);
    setEditingContent('');
  }

  function saveEditComment(commentId: number) {
    if (!editingContent.trim() || !selectedTask) return;
    const prevContent = comments.find(c => c.id === commentId)?.content;
    setComments(prev => prev.map(c => c.id === commentId ? { ...c, content: editingContent.trim(), isEdited: true } : c));
    setEditingCommentId(null);
    setEditingContent('');
    fetch(`/api/agenda/tasks/${selectedTask.id}/comments/${commentId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: editingContent.trim() }),
    })
      .then(r => { if (!r.ok) return Promise.reject(r.status); })
      .catch(() => {
        setComments(prev => prev.map(c => c.id === commentId ? { ...c, content: prevContent ?? c.content, isEdited: false } : c));
      });
  }

  // Fetch real activity events from API when activity tab is selected
  useEffect(() => {
    if (activeTab !== 'activities' || !selectedTask) {
      return;
    }
    let cancelled = false;
    setLoadingActivity(true);
    fetch(`/api/agenda/tasks/${selectedTask.id}/activity`)
      .then(r => r.ok ? r.json() : [])
      .then((events: any[]) => {
        if (cancelled) return;
        const EVENT_TYPE_MAP: Record<string, ActivityType> = {
          CREATED: 'create', STATUS_CHANGED: 'status', COMPLETED: 'status', REOPENED: 'status',
          ASSIGNED: 'assign', COMMENTED: 'comment', PRIORITY_CHANGED: 'priority',
          DUE_DATE_CHANGED: 'status', TITLE_CHANGED: 'status',
          SUBTASK_ADDED: 'create', SUBTASK_COMPLETED: 'status', DELETED: 'status', DUPLICATED: 'create',
        };
        setActivityEvents((events || []).map((e: any) => ({
          id: e.id,
          type: EVENT_TYPE_MAP[e.eventType] || 'status',
          date: e.occurredAt,
          user: e.performedBy?.name || 'Sistema',
          text: e.description || e.eventType,
        })));
        setLoadingActivity(false);
      })
      .catch(() => { if (!cancelled) { setActivityEvents([]); setLoadingActivity(false); } });
    return () => { cancelled = true; };
  }, [activeTab, selectedTask?.id]);

  function togglePriorityFilter(p: Priority) {
    setFilterPriority(prev => prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p]);
  }

  const hasActiveFilters  = filterPriority.length > 0;
  const selected          = selectedTask;
  const selectedOverdue   = selected ? isTaskOverdue(selected) : false;
  const pChip             = selected ? PRIORITY_CHIP[selected.priority] : null;
  const completedSubCount = subtasks.filter(s => s.completed).length;
  const subtaskProgress   = subtasks.length > 0 ? Math.round((completedSubCount / subtasks.length) * 100) : 0;

  return (
    <div
      style={{
        display: 'flex',
        height: 'calc(100vh - 10rem)',
        overflow: 'hidden',
        borderRadius: '8px',
        border: '1.5px solid #D8D8DE',
        background: '#FFFFFF',
        boxShadow: '0 1px 3px rgba(0,0,0,.06), 0 4px 16px rgba(0,0,0,.07)',
      }}
    >
      <style>{`
        @keyframes inbox-panel-in {
          from { opacity: 0; transform: translateX(12px); }
          to   { opacity: 1; transform: translateX(0); }
        }
      `}</style>

      {/* ── Left panel ──────────────────────────────────────────────── */}
      <div
        style={{
          width: '320px',
          flexShrink: 0,
          borderRight: '1px solid #E4E4E8',
          display: 'flex',
          flexDirection: 'column',
          background: '#FAFAFA',
        }}
      >
        {/* Header */}
        <div style={{ padding: '16px 16px 0' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <h2 style={{ fontSize: '14px', fontWeight: 700, color: '#111827', lineHeight: 1 }}>
                  Inbox
                </h2>
                {unreadCount > 0 && (
                  <span
                    style={{
                      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                      minWidth: '18px', height: '16px', padding: '0 5px',
                      borderRadius: '999px', fontSize: '10px', fontWeight: 700,
                      background: '#7C3AED', color: '#FFFFFF',
                    }}
                  >
                    {unreadCount}
                  </span>
                )}
              </div>
              <p style={{ fontSize: '11px', color: '#9CA3AF', marginTop: '2px' }}>
                Tareas asignadas a vos
              </p>
            </div>
            <div style={{ display: 'flex', gap: '2px' }}>
              {/* Sort toggle */}
              <button
                onClick={() => {
                  const modes: SortMode[] = ['created', 'dueDate', 'priority'];
                  setSortMode(prev => modes[(modes.indexOf(prev) + 1) % modes.length]);
                }}
                title={`Ordenar por: ${SORT_LABELS[sortMode]}`}
                style={{
                  height: '28px', minWidth: '28px',
                  paddingInline: sortMode !== 'created' ? '8px' : '0',
                  borderRadius: '8px',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px',
                  color: sortMode !== 'created' ? '#7C3AED' : '#9CA3AF',
                  background: sortMode !== 'created' ? '#F3F0FF' : 'transparent',
                  border: 'none', cursor: 'pointer',
                  transition: 'all 150ms',
                }}
              >
                <ArrowUpDown className="h-3.5 w-3.5" />
                {sortMode !== 'created' && (
                  <span style={{ fontSize: '10px', fontWeight: 600 }}>{SORT_LABELS[sortMode]}</span>
                )}
              </button>
              {/* Filter toggle */}
              <button
                onClick={() => setShowFilters(f => !f)}
                title="Filtrar por prioridad"
                style={{
                  height: '28px', width: '28px', borderRadius: '8px',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: showFilters || hasActiveFilters ? '#7C3AED' : '#9CA3AF',
                  background: showFilters || hasActiveFilters ? '#F3F0FF' : 'transparent',
                  border: 'none', cursor: 'pointer',
                  transition: 'all 150ms',
                }}
              >
                <SlidersHorizontal className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          {/* Search */}
          <div style={{ position: 'relative', marginBottom: '12px' }}>
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5" style={{ color: '#C0C0C8' }} />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar en inbox..."
              className="w-full outline-none"
              style={{
                paddingLeft: '30px', paddingRight: search ? '30px' : '10px',
                height: '34px', fontSize: '12px',
                background: '#EFEFEF', border: '1px solid transparent',
                borderRadius: '10px', color: '#111827',
                transition: 'border-color 150ms ease',
              }}
              onFocus={e => { e.currentTarget.style.borderColor = '#D0D0D8'; e.currentTarget.style.background = '#FFFFFF'; }}
              onBlur={e  => { e.currentTarget.style.borderColor = 'transparent'; e.currentTarget.style.background = '#EFEFEF'; }}
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                style={{
                  position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)',
                  background: 'transparent', border: 'none', cursor: 'pointer', padding: '2px',
                  display: 'flex', alignItems: 'center', color: '#9CA3AF', borderRadius: '4px',
                }}
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>

          {/* Priority filter pills */}
          {showFilters && (
            <div style={{ marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '4px', flexWrap: 'wrap' }}>
              {(['LOW', 'MEDIUM', 'HIGH', 'URGENT'] as Priority[]).map(p => {
                const chip   = PRIORITY_CHIP[p];
                const active = filterPriority.includes(p);
                return (
                  <button
                    key={p}
                    onClick={() => togglePriorityFilter(p)}
                    style={{
                      fontSize: '10px', fontWeight: 600, padding: '3px 9px',
                      borderRadius: '999px',
                      background: active ? chip.bg : '#F3F4F6',
                      color: active ? chip.text : '#9CA3AF',
                      border: `1px solid ${active ? chip.text + '40' : 'transparent'}`,
                      cursor: 'pointer', transition: 'all 120ms',
                    }}
                  >
                    {chip.label}
                  </button>
                );
              })}
              {hasActiveFilters && (
                <button
                  onClick={() => setFilterPriority([])}
                  style={{
                    fontSize: '10px', color: '#9CA3AF', background: 'transparent',
                    border: 'none', cursor: 'pointer', padding: '2px 4px',
                    display: 'flex', alignItems: 'center', gap: '2px',
                  }}
                >
                  <X className="h-2.5 w-2.5" /> Limpiar
                </button>
              )}
            </div>
          )}

          {/* Filter tabs */}
          <div style={{ display: 'flex', gap: '2px', padding: '3px', background: '#EFEFEF', borderRadius: '10px', marginBottom: '4px' }}>
            {([
              { key: 'all',     label: 'Todas',       count: tasks.length },
              { key: 'pending', label: 'Pendientes',   count: pendingCount },
              { key: 'done',    label: 'Completadas',  count: completedCount },
            ] as { key: FilterTab; label: string; count: number }[]).map(tab => (
              <button
                key={tab.key}
                onClick={() => setFilter(tab.key)}
                style={{
                  flex: 1, padding: '5px 4px', borderRadius: '8px',
                  fontSize: '11px', fontWeight: filter === tab.key ? 700 : 500,
                  color: filter === tab.key ? '#111827' : '#9CA3AF',
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
                      background: filter === tab.key ? '#111827' : '#E0E0E8',
                      color: filter === tab.key ? '#FFFFFF' : '#9CA3AF',
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
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '48px 24px', textAlign: 'center' }}>
              <div style={{ width: '48px', height: '48px', borderRadius: '14px', background: '#F0F0F0', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '12px' }}>
                <CheckCircle2 className="h-5 w-5" style={{ color: '#C8C8D0' }} />
              </div>
              <p style={{ fontSize: '13px', fontWeight: 600, color: '#6B7280' }}>Todo al día</p>
              <p style={{ fontSize: '11px', color: '#ADADAD', marginTop: '4px' }}>No hay tareas asignadas</p>
            </div>
          ) : sortMode === 'created' ? (
            grouped.map(([label, groupTasks]) => (
              <div key={label}>
                <div style={{ padding: '8px 16px 4px', display: 'flex', alignItems: 'center', gap: '8px' }}>
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
                    isRead={readIds.has(task.id)}
                    isCompleting={completingIds.has(task.id)}
                    onClick={() => handleSelectTask(task)}
                    onQuickComplete={e => handleQuickComplete(e, task)}
                  />
                ))}
              </div>
            ))
          ) : (
            filteredTasks.map((task, i) => (
              <InboxItem
                key={task.id}
                task={task}
                index={i}
                isSelected={selected?.id === task.id}
                isRead={readIds.has(task.id)}
                isCompleting={completingIds.has(task.id)}
                onClick={() => handleSelectTask(task)}
                onQuickComplete={e => handleQuickComplete(e, task)}
              />
            ))
          )}
        </ScrollArea>
      </div>

      {/* ── Right panel (detail) ─────────────────────────────────────── */}
      {selected ? (
        <div
          key={selected.id}
          style={{
            flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0,
            background: '#FFFFFF', overflow: 'hidden',
            animation: 'inbox-panel-in 220ms cubic-bezier(0.22,1,0.36,1) both',
          }}
        >
          {/* ── Header ──────────────────────────────────────────────────── */}
          <div style={{ padding: '16px 20px', borderBottom: '1px solid #E4E4E8', flexShrink: 0 }}>

            {/* Top row: status + group + actions */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '10px' }}>
              {(() => {
                const sChip = STATUS_CHIP[selected.status];
                return (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '11px', fontWeight: 600, padding: '2px 8px', borderRadius: '6px', background: sChip.bg, color: sChip.text }}>
                    <span style={{ height: '5px', width: '5px', borderRadius: '50%', background: sChip.dot }} />
                    {TASK_STATUS_CONFIG[selected.status].label}
                  </span>
                );
              })()}
              {selected.group && (
                <span style={{ fontSize: '11px', fontWeight: 500, padding: '2px 8px', borderRadius: '6px', background: '#F3F0FF', color: '#7C3AED' }}>
                  {selected.group.name}
                </span>
              )}
              <div style={{ flex: 1 }} />
              {/* Completar button */}
              {selected.status !== 'COMPLETED' && selected.status !== 'CANCELLED' && (
                <button
                  onClick={() => handleCompleteTask(selected)}
                  disabled={completingIds.has(selected.id)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '5px',
                    height: '28px', padding: '0 12px', borderRadius: '6px',
                    background: completingIds.has(selected.id) ? '#E4E4E8' : '#111827',
                    color: completingIds.has(selected.id) ? '#9CA3AF' : '#FFFFFF',
                    border: 'none',
                    cursor: completingIds.has(selected.id) ? 'default' : 'pointer',
                    fontSize: '11px', fontWeight: 600, transition: 'all 150ms', flexShrink: 0,
                  }}
                >
                  {completingIds.has(selected.id)
                    ? <Loader2 className="h-3 w-3 animate-spin" />
                    : <Check className="h-3 w-3" />
                  }
                  Completar
                </button>
              )}
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
                  <DropdownMenuItem className="text-xs gap-2" onClick={() => selected && onEdit?.(selected)}>
                    <Pencil className="h-3 w-3" /> Editar tarea
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {/* Title */}
            <h2 style={{ fontSize: '18px', fontWeight: 600, color: '#111827', lineHeight: 1.3, letterSpacing: '-0.02em', marginBottom: '14px' }}>
              {selected.title}
            </h2>

            {/* Meta row */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
              {selected.createdBy && (
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  <div style={{ width: '26px', height: '26px', borderRadius: '50%', background: '#F0F0F0', border: '2px solid #FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <span style={{ fontSize: '8px', fontWeight: 700, color: '#374151' }}>{getInitials(selected.createdBy.name)}</span>
                  </div>
                  <span style={{ fontSize: '12px', fontWeight: 500, color: '#6B7280', marginLeft: '8px' }}>{selected.createdBy.name}</span>
                </div>
              )}
              <div style={{ width: '1px', height: '18px', background: '#E4E4E8' }} />
              {pChip && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ fontSize: '12px', fontWeight: 500, color: '#9CA3AF' }}>Prioridad</span>
                  <span style={{ fontSize: '11px', fontWeight: 600, padding: '2px 8px', borderRadius: '6px', background: pChip.bg, color: pChip.text }}>{pChip.label}</span>
                </div>
              )}
              {selected.dueDate && <div style={{ width: '1px', height: '18px', background: '#E4E4E8' }} />}
              {selected.dueDate && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <CalendarDays className="h-3.5 w-3.5" style={{ color: selectedOverdue ? '#DC2626' : '#9CA3AF' }} />
                  <span style={{ fontSize: '12px', fontWeight: 500, color: '#9CA3AF' }}>Vencimiento</span>
                  <span style={{ fontSize: '12px', fontWeight: 600, color: selectedOverdue ? '#DC2626' : '#111827' }}>
                    {format(parseISO(selected.dueDate), "d 'de' MMMM", { locale: es })}
                  </span>
                </div>
              )}
            </div>

            {/* Participants row */}
            {(() => {
              const participants: { name: string; role: string; colorIdx: number }[] = [];
              if (selected.createdBy) participants.push({ name: selected.createdBy.name, role: 'Creador', colorIdx: 0 });
              const assigneeName =
                selected.assignedToUser?.name ||
                (selected as any).assignedToContact?.name ||
                (selected as any).assignedToName;
              if (assigneeName && assigneeName !== selected.createdBy?.name)
                participants.push({ name: assigneeName, role: 'Asignado', colorIdx: 1 });
              if (participants.length === 0) return null;
              return (
                <div style={{ marginTop: '12px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ fontSize: '11px', fontWeight: 500, color: '#9CA3AF', flexShrink: 0 }}>Participantes</span>
                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                    {participants.map((p, i) => {
                      const c = AVATAR_COLORS[p.colorIdx % AVATAR_COLORS.length];
                      return (
                        <div key={i} title={p.role} style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '3px 8px 3px 4px', borderRadius: '999px', background: c.bg, border: `1px solid ${c.bg}` }}>
                          <div style={{ width: '18px', height: '18px', borderRadius: '50%', background: c.fg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            <span style={{ fontSize: '7px', fontWeight: 700, color: '#FFFFFF' }}>{getInitials(p.name)}</span>
                          </div>
                          <span style={{ fontSize: '11px', fontWeight: 600, color: c.fg }}>{p.name}</span>
                          <span style={{ fontSize: '9px', color: c.fg, opacity: 0.6 }}>· {p.role}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })()}
          </div>

          {/* ── Body ────────────────────────────────────────────────────── */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

            {/* Description */}
            {/* Description + Attachments */}
            <div style={{ padding: '14px 20px', display: 'flex', flexDirection: 'column', gap: '12px', flexShrink: 0, borderBottom: '1px solid #F0F0F4' }}>
              {selected.description && (
                <p style={{ fontSize: '15px', color: '#374151', lineHeight: 1.7, margin: 0, letterSpacing: '-0.01em' }}>
                  {selected.description}
                </p>
              )}
              {/* Attachments */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '5px', color: '#9CA3AF' }}>
                    <Paperclip className="h-3 w-3" />
                    <span style={{ fontSize: '12px', fontWeight: 500, color: '#111827' }}>Adjuntos ({localAttachments.length})</span>
                  </div>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  {localAttachments.map(att => (
                    <div
                      key={att.name}
                      style={{
                        display: 'flex', alignItems: 'center', gap: '8px',
                        padding: '5px 10px 5px 6px', background: '#FFFFFF',
                        border: '1px solid #E8E8EC', borderRadius: '8px',
                        cursor: 'pointer', transition: 'box-shadow 150ms ease, border-color 150ms ease',
                      }}
                      onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.boxShadow = '0 2px 8px rgba(0,0,0,.07)'; (e.currentTarget as HTMLDivElement).style.borderColor = '#D0D0D8'; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.boxShadow = 'none'; (e.currentTarget as HTMLDivElement).style.borderColor = '#E8E8EC'; }}
                    >
                      <FileTypeIcon name={att.type} />
                      <div style={{ minWidth: 0 }}>
                        <p style={{ fontSize: '12px', fontWeight: 600, color: '#111827', lineHeight: 1.2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '100px' }}>{att.name}</p>
                        <p style={{ fontSize: '10px', color: '#9CA3AF', marginTop: '1px' }}>{att.size}</p>
                      </div>
                    </div>
                  ))}
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    style={{ display: 'none' }}
                    onChange={e => {
                      const files = Array.from(e.target.files ?? []);
                      if (!files.length) return;
                      const newItems = files.map(f => {
                        const kb = f.size / 1024;
                        const size = kb < 1024 ? `${Math.round(kb)} KB` : `${(kb / 1024).toFixed(1)} MB`;
                        const ext = f.name.split('.').pop()?.toLowerCase() ?? '';
                        const type = ['jpg','jpeg','png','gif','webp'].includes(ext) ? 'image'
                          : ['pdf'].includes(ext) ? 'pdf'
                          : ['doc','docx'].includes(ext) ? 'doc'
                          : ['xls','xlsx'].includes(ext) ? 'xls'
                          : 'file';
                        return { name: f.name, size, type };
                      });
                      setLocalAttachments(prev => [...prev, ...newItems]);
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
                    onMouseLeave={e => { e.currentTarget.style.borderColor = '#E4E4E8'; e.currentTarget.style.background = '#F4F4F6'; e.currentTarget.style.color = '#9CA3AF'; }}
                  >
                    +
                  </button>
                </div>
              </div>
            </div>

            {/* Tabs */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', padding: '14px 20px 0' }}>

              {/* Pill tab bar */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '14px', background: '#F4F4F6', borderRadius: '8px', padding: '3px', flexShrink: 0 }}>
                {([
                  { key: 'subtasks',   label: 'Subtareas' },
                  { key: 'comments',   label: `Comentarios${comments.length > 0 ? ` (${comments.length})` : ''}` },
                  { key: 'activities', label: 'Actividades' },
                ] as { key: 'subtasks'|'comments'|'activities'; label: string }[]).map(tab => (
                  <button
                    key={tab.key}
                    onClick={() => setActiveTab(tab.key)}
                    style={{
                      flex: 1, border: 'none', cursor: 'pointer',
                      padding: '6px 12px', borderRadius: '6px',
                      fontSize: '12px', fontWeight: 600, letterSpacing: '-0.01em',
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

              {/* Tab content */}
              <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>

                {/* Subtasks tab */}
                {activeTab === 'subtasks' && (
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                    {loadingSubtasks ? (
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '30px' }}>
                        <Loader2 className="h-5 w-5 animate-spin" style={{ color: '#9CA3AF' }} />
                      </div>
                    ) : (
                      <ScrollArea className="flex-1">
                        <div style={{ paddingBottom: '8px' }}>
                          {subtasks.length > 0 ? (
                            <>
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
                                noAssign
                                onToggle={(id, completed) => {
                                  setSubtasks(prev => prev.map(s => s.id === id ? { ...s, completed } : s));
                                  if (selectedTask) {
                                    fetch(`/api/agenda/tasks/${selectedTask.id}/subtasks/${id}`, {
                                      method: 'PUT',
                                      headers: { 'Content-Type': 'application/json' },
                                      body: JSON.stringify({ done: completed }),
                                    }).then(r => { if (!r.ok) throw new Error(`${r.status}`); })
                                      .catch(() => {
                                        setSubtasks(prev => prev.map(s => s.id === id ? { ...s, completed: !completed } : s));
                                      });
                                  }
                                }}
                                onAdd={title => {
                                  if (!selectedTask) return;
                                  fetch(`/api/agenda/tasks/${selectedTask.id}/subtasks`, {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({ title }),
                                  }).then(r => r.ok ? r.json() : Promise.reject(r.status))
                                    .then(s => setSubtasks(prev => [...prev, { id: s.id.toString(), title: s.title, completed: s.done, note: s.note ?? undefined }]))
                                    .catch(err => console.error('[Subtask] create failed:', err));
                                }}
                                onUpdate={(id, updates) => {
                                  setSubtasks(prev => prev.map(s => s.id === id ? { ...s, ...updates } : s));
                                  if (selectedTask) {
                                    fetch(`/api/agenda/tasks/${selectedTask.id}/subtasks/${id}`, {
                                      method: 'PUT',
                                      headers: { 'Content-Type': 'application/json' },
                                      body: JSON.stringify({
                                        ...(updates.title !== undefined && { title: updates.title }),
                                        ...(updates.note !== undefined && { note: updates.note }),
                                      }),
                                    }).then(r => { if (!r.ok) throw new Error(`${r.status}`); })
                                      .catch(err => console.error('[Subtask] update failed:', err));
                                  }
                                }}
                                onDelete={id => {
                                  setSubtasks(prev => prev.filter(s => s.id !== id));
                                  if (selectedTask) {
                                    fetch(`/api/agenda/tasks/${selectedTask.id}/subtasks/${parseInt(id)}`, { method: 'DELETE' })
                                      .then(r => { if (!r.ok) throw new Error(`${r.status}`); })
                                      .catch(err => console.error('[Subtask] delete failed:', err));
                                  }
                                }}
                                onReorder={items => {
                                  setSubtasks(items);
                                  if (selectedTask) {
                                    fetch(`/api/agenda/tasks/${selectedTask.id}/subtasks/reorder`, {
                                      method: 'PATCH',
                                      headers: { 'Content-Type': 'application/json' },
                                      body: JSON.stringify({ order: items.map(s => parseInt(s.id)) }),
                                    }).then(r => { if (!r.ok) throw new Error(`${r.status}`); })
                                      .catch(err => console.error('[Subtask] reorder failed:', err));
                                  }
                                }}
                              />
                            </>
                          ) : (
                            <div style={{ textAlign: 'center', padding: '30px 20px', color: '#9CA3AF', fontSize: '12px' }}>
                              Sin subtareas
                            </div>
                          )}
                        </div>
                      </ScrollArea>
                    )}
                  </div>
                )}

                {/* Comments tab */}
                {activeTab === 'comments' && (
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                    <ScrollArea className="flex-1">
                      <div style={{ display: 'flex', flexDirection: 'column', paddingBottom: '8px' }}>
                        {loadingComments ? (
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '30px' }}>
                            <Loader2 className="h-5 w-5 animate-spin" style={{ color: '#9CA3AF' }} />
                          </div>
                        ) : comments.length > 0 ? (
                          comments.map(c => {
                            const isMe = currentUser?.id != null && c.authorId != null
                              ? String(c.authorId) === String(currentUser.id)
                              : c.author?.name === (currentUser?.name ?? '');
                            const showActions = hoveredCommentId === c.id && !c._optimistic;
                            return (
                            <div
                              key={c.id}
                              onMouseEnter={() => setHoveredCommentId(c.id)}
                              onMouseLeave={() => setHoveredCommentId(null)}
                              style={{
                                display: 'flex', gap: '10px', padding: '10px 0',
                                opacity: c._optimistic ? 0.6 : 1,
                                transition: 'opacity 200ms',
                              }}
                            >
                              <Avatar className="h-7 w-7 shrink-0">
                                <AvatarImage src={c.author?.avatar} />
                                <AvatarFallback style={{ fontSize: '9px', fontWeight: 700, background: '#F3F4F6', color: '#111827' }}>
                                  {(c.author?.name || 'U').split(' ').map((p: string) => p[0]).join('').toUpperCase().slice(0, 2)}
                                </AvatarFallback>
                              </Avatar>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px', marginBottom: '3px' }}>
                                  <span style={{ fontSize: '12px', fontWeight: 600, color: '#111827' }}>{c.author?.name || 'Usuario'}</span>
                                  <span style={{ fontSize: '10px', color: '#9CA3AF' }}>
                                    {c.createdAt ? formatDistanceToNow(parseISO(c.createdAt), { addSuffix: true, locale: es }) : ''}
                                    {c.isEdited && ' (editado)'}
                                    {c._optimistic && ' · enviando...'}
                                  </span>
                                  {/* Edit/Delete actions */}
                                  {showActions && isMe && c.id > 0 && (
                                    <div style={{ display: 'flex', gap: '4px', marginLeft: 'auto' }}>
                                      <button
                                        onClick={() => startEditComment(c)}
                                        style={{ display: 'flex', alignItems: 'center', padding: '2px', background: 'none', border: 'none', cursor: 'pointer', color: '#9CA3AF', transition: 'color 150ms' }}
                                        onMouseEnter={e => (e.currentTarget.style.color = '#111827')}
                                        onMouseLeave={e => (e.currentTarget.style.color = '#9CA3AF')}
                                        title="Editar"
                                      >
                                        <Pencil style={{ width: '12px', height: '12px' }} />
                                      </button>
                                      <button
                                        onClick={() => deleteComment(c.id)}
                                        style={{ display: 'flex', alignItems: 'center', padding: '2px', background: 'none', border: 'none', cursor: 'pointer', color: '#9CA3AF', transition: 'color 150ms' }}
                                        onMouseEnter={e => (e.currentTarget.style.color = '#DC2626')}
                                        onMouseLeave={e => (e.currentTarget.style.color = '#9CA3AF')}
                                        title="Eliminar"
                                      >
                                        <Trash2 style={{ width: '12px', height: '12px' }} />
                                      </button>
                                    </div>
                                  )}
                                </div>
                                {editingCommentId === c.id ? (
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                    <textarea
                                      value={editingContent}
                                      onChange={e => setEditingContent(e.target.value)}
                                      onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); saveEditComment(c.id); } if (e.key === 'Escape') cancelEditComment(); }}
                                      style={{ fontSize: '12px', color: '#374151', lineHeight: 1.55, background: '#FFFFFF', border: '1px solid #E4E4E8', borderRadius: '6px', padding: '6px 8px', resize: 'none', minHeight: '36px', outline: 'none', fontFamily: 'inherit' }}
                                      autoFocus
                                    />
                                    <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                                      <button onClick={cancelEditComment} style={{ fontSize: '11px', fontWeight: 600, color: '#9CA3AF', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 6px' }}>Cancelar</button>
                                      <button onClick={() => saveEditComment(c.id)} style={{ fontSize: '11px', fontWeight: 600, color: '#FFFFFF', background: '#111827', border: 'none', borderRadius: '4px', cursor: 'pointer', padding: '2px 8px' }}>Guardar</button>
                                    </div>
                                  </div>
                                ) : (
                                  <p style={{ fontSize: '12px', color: '#374151', lineHeight: 1.55 }}>{c.content}</p>
                                )}
                              </div>
                            </div>
                            );
                          })
                        ) : (
                          <div style={{ textAlign: 'center', padding: '30px 20px', color: '#9CA3AF', fontSize: '12px' }}>
                            Sin comentarios
                          </div>
                        )}
                      </div>
                    </ScrollArea>

                    {/* Comment input */}
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
                        <div
                          style={{ flex: 1, border: '1.5px solid #E4E4E8', borderRadius: '8px', overflow: 'hidden', background: '#FAFAFA', transition: 'border-color 150ms' }}
                          onFocusCapture={e => { (e.currentTarget as HTMLElement).style.borderColor = '#111827'; }}
                          onBlurCapture={e  => { (e.currentTarget as HTMLElement).style.borderColor = '#E4E4E8'; }}
                        >
                          {/* Mention dropdown */}
                          {showMentionDrop && MENTION_PEOPLE.length > 0 && (
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
                            onKeyDown={e => {
                              if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault();
                                submitComment();
                              }
                            }}
                            placeholder="Escribe un comentario... Usa @ para mencionar"
                            className="w-full outline-none resize-none bg-transparent"
                            style={{ fontSize: '13px', color: '#111827', padding: '10px 12px', display: 'block' }}
                          />
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 10px', borderTop: '1px solid #E4E4E8', background: '#F4F4F6' }}>
                            <div style={{ display: 'flex', gap: '4px' }}>
                              <button
                                onClick={() => { setCommentInput(p => p + '@'); setShowMentionDrop(true); commentRef.current?.focus(); }}
                                style={{ height: '26px', width: '26px', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'transparent', border: 'none', cursor: 'pointer', color: '#9CA3AF' }}
                                onMouseEnter={e => { e.currentTarget.style.background = '#E4E4E8'; e.currentTarget.style.color = '#6B7280'; }}
                                onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#9CA3AF'; }}
                                title="Mencionar alguien"
                              >
                                <AtSign style={{ width: '14px', height: '14px' }} />
                              </button>
                              <button
                                style={{ height: '26px', width: '26px', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'transparent', border: 'none', cursor: 'pointer', color: '#9CA3AF' }}
                                onMouseEnter={e => { e.currentTarget.style.background = '#E4E4E8'; e.currentTarget.style.color = '#6B7280'; }}
                                onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#9CA3AF'; }}
                                title="Adjuntar archivo"
                              >
                                <Paperclip style={{ width: '14px', height: '14px' }} />
                              </button>
                            </div>
                            <button
                              onClick={submitComment}
                              disabled={!commentInput.trim() || submittingComment}
                              style={{
                                display: 'flex', alignItems: 'center', gap: '5px',
                                height: '26px', padding: '0 10px', borderRadius: '6px', border: 'none',
                                background: commentInput.trim() && !submittingComment ? '#111827' : '#E4E4E8',
                                color: commentInput.trim() && !submittingComment ? '#FFFFFF' : '#9CA3AF',
                                fontSize: '12px', fontWeight: 600,
                                cursor: commentInput.trim() && !submittingComment ? 'pointer' : 'default',
                                transition: 'all 150ms',
                              }}
                            >
                              {submittingComment
                                ? <Loader2 style={{ width: '12px', height: '12px' }} className="animate-spin" />
                                : <Send style={{ width: '12px', height: '12px' }} />
                              }
                              Enviar
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Activities tab */}
                {activeTab === 'activities' && (
                  <ScrollArea className="flex-1">
                    {loadingActivity ? (
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '30px' }}>
                        <Loader2 className="h-5 w-5 animate-spin" style={{ color: '#9CA3AF' }} />
                      </div>
                    ) : activityEvents.length === 0 ? (
                      <div style={{ textAlign: 'center', padding: '30px 20px', color: '#9CA3AF', fontSize: '12px' }}>
                        Sin actividad registrada
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        {activityEvents.map((item, ai) => {
                          const cfg        = ACTIVITY_CFG[item.type];
                          const { Icon }   = cfg;
                          const dateLabel  = groupLabel(item.date);
                          const showLabel  = ai === 0 || groupLabel(activityEvents[ai - 1].date) !== dateLabel;
                          return (
                            <div key={item.id}>
                              {showLabel && (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 0 4px' }}>
                                  <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#111827', border: '2px solid #FFFFFF', boxShadow: '0 0 0 1.5px #D8D8DE', flexShrink: 0 }} />
                                  <span style={{ fontSize: '12px', fontWeight: 600, color: '#111827', letterSpacing: '-0.01em' }}>
                                    {dateLabel}
                                  </span>
                                </div>
                              )}
                              <div
                                style={{
                                  display: 'flex', alignItems: 'center', gap: '10px',
                                  padding: '7px 10px', borderRadius: '8px',
                                  border: '1px solid transparent', marginBottom: '2px',
                                  marginLeft: '18px', transition: 'all 120ms', cursor: 'default',
                                }}
                                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#F8F8FA'; (e.currentTarget as HTMLElement).style.borderColor = '#E4E4E8'; }}
                                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.borderColor = 'transparent'; }}
                              >
                                <div style={{ width: '26px', height: '26px', borderRadius: '8px', background: cfg.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                  <Icon style={{ width: '12px', height: '12px', color: cfg.color }} />
                                </div>
                                <p style={{ fontSize: '13px', color: '#6B7280', lineHeight: 1.4, margin: 0, flex: 1, minWidth: 0, letterSpacing: '-0.01em' }}>
                                  <span style={{ fontWeight: 600, color: '#111827' }}>{item.user}</span>{' '}{item.text}
                                </p>
                                <span style={{ fontSize: '12px', color: '#9CA3AF', fontWeight: 500, whiteSpace: 'nowrap', flexShrink: 0 }}>
                                  {timeAgo(item.date)}
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </ScrollArea>
                )}

              </div>
            </div>
          </div>
        </div>
      ) : (
        /* Empty right panel */
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#FAFAFA' }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ height: '64px', width: '64px', borderRadius: '16px', background: '#F0F0F0', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
              <ChevronRight className="h-7 w-7" style={{ color: '#C8C8D0' }} />
            </div>
            <p style={{ fontSize: '13px', fontWeight: 600, color: '#9CA3AF' }}>Seleccioná una tarea</p>
            <p style={{ fontSize: '11px', color: '#C0C0C8', marginTop: '4px' }}>para ver el detalle completo</p>
          </div>
        </div>
      )}
    </div>
  );
}
