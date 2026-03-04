'use client';

import { useState, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Clock,
  AlertTriangle,
  FileText,
  ExternalLink,
  Send,
  Loader2,
  CheckCircle2,
  ImageIcon,
  Bell,
  BellOff,
  RotateCcw,
  MessageSquare,
  Info,
  RefreshCw,
  Users,
  MoreVertical,
  Pencil,
  Trash2,
  Wrench,
  Package,
  Star,
  Paperclip,
  ClipboardCheck,
  X,
  Activity,
  Eye,
  ChevronRight,
  Cpu,
  Hash,
  User,
  Calendar,
  Timer,
  Link2,
  Shield,
} from 'lucide-react';
import { formatDistanceToNow, format, differenceInMinutes } from 'date-fns';
import { es } from 'date-fns/locale';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { useCompany } from '@/contexts/CompanyContext';
import dynamic from 'next/dynamic';

const ReturnToProductionDialog = dynamic(() => import('./ReturnToProductionDialog').then(m => ({ default: m.ReturnToProductionDialog })), { ssr: false });
const ImmediateCloseDialog = dynamic(() => import('./ImmediateCloseDialog').then(m => ({ default: m.ImmediateCloseDialog })), { ssr: false });
const RecurrencePanel = dynamic(() => import('./RecurrencePanel'), { ssr: false });
const ReopenFailureDialog = dynamic(() => import('./ReopenFailureDialog').then(m => ({ default: m.ReopenFailureDialog })), { ssr: false });

// ─── Interfaces ───

interface Comment {
  id: number;
  content: string;
  type?: string;
  createdAt: string;
  updatedAt?: string;
  author?: { id: number; name: string; email?: string };
}

interface TimelineEvent {
  id: string;
  type: string;
  occurredAt: string;
  title: string;
  description?: string;
  performedBy?: { id: number; name: string };
  metadata?: Record<string, any>;
}

interface FailureDetailSheetProps {
  failureId: number | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialTab?: string;
  onSelectFailure?: (id: number) => void;
}

interface FailureDetail {
  id: number;
  companyId?: number;
  title: string;
  description?: string;
  priority: string;
  status: string;
  causedDowntime: boolean;
  isIntermittent: boolean;
  isObservation: boolean;
  isSafetyRelated?: boolean;
  reportedAt: string;
  resolvedAt?: string;
  resolvedImmediately?: boolean;
  notes?: string;
  failureCategory?: string;
  incidentType?: string;
  // Reopen
  reopenedFrom?: number;
  reopenReason?: string;
  reopenedAt?: string;
  reopenedById?: number;
  // Duplicate link
  isLinkedDuplicate?: boolean;
  linkedToOccurrenceId?: number;
  linkedReason?: string;
  linkedAt?: string;
  // Correction
  correctedAt?: string;
  originalReport?: {
    title?: string;
    description?: string;
    machineId?: number;
    subcomponentId?: number;
    failureCategory?: string;
    incidentType?: string;
  } | null;
  // Symptoms
  symptomsList?: Array<{ id: number; label: string }>;
  // Photos
  photos?: Array<{ url: string; fileName?: string; originalName?: string; uploadedAt?: string }>;
  // Machine (expanded)
  machine?: {
    id: number;
    name: string;
    nickname?: string;
    serialNumber?: string;
    type?: string;
    brand?: string;
    model?: string;
    status?: string;
  };
  component?: { id: number; name: string };
  subcomponent?: { id: number; name: string };
  components?: Array<{ id: number; name: string }>;
  subcomponents?: Array<{ id: number; name: string }>;
  reportedBy?: { id: number; name: string };
  // Failure type catalog
  failureType?: { id: number; title: string; failure_type?: string; priority?: string };
  // Work Orders (expanded)
  workOrders?: Array<{
    id: number;
    status: string;
    title: string;
    priority?: string;
    type?: string;
    assignedToId?: number;
    scheduledDate?: string;
    completedDate?: string;
    assignedTo?: { id: number; name: string; email?: string };
  }>;
  downtimeLogs?: Array<{
    id: number;
    startedAt: string;
    endedAt?: string | null;
    totalMinutes?: number;
    workOrderId?: number | null;
    machine?: { id: number; name: string };
  }>;
  linkedDuplicates?: Array<{
    id: number;
    title?: string;
    reportedAt: string;
    linkedReason?: string;
    reportedBy?: { id?: number; name: string };
  }>;
  solutionsApplied?: Array<{
    id: number;
    diagnosis: string;
    solution: string;
    outcome?: string;
    performedAt: string;
    actualMinutes?: number;
    fixType?: string;
    effectiveness?: number;
    confirmedCause?: string;
    repairAction?: string;
    toolsUsed?: any;
    sparePartsUsed?: any;
    attachments?: any;
    notes?: string;
    finalComponentId?: number;
    finalSubcomponentId?: number;
    finalComponent?: { id: number; name: string } | null;
    finalSubcomponent?: { id: number; name: string } | null;
    closingMode?: string;
    performedBy?: { id?: number; name: string };
    workOrderId?: number;
    controlInstances?: Array<{
      id: number;
      order: number;
      description: string;
      scheduledAt?: string | null;
      completedAt?: string | null;
      status: string;
      delayMinutes: number;
    }>;
  }>;
  computed?: {
    minutesSinceReport: number;
    hoursSinceReport: number;
    hasActiveDowntime: boolean;
    totalDowntimeMinutes: number;
  };
}

// ─── Constants ───

function parseJsonArr<T>(field: T[] | string | null | undefined): T[] {
  if (!field) return [];
  if (Array.isArray(field)) return field;
  if (typeof field === 'string') {
    try { const parsed = JSON.parse(field); return Array.isArray(parsed) ? parsed : []; } catch { return []; }
  }
  return [];
}

const STATUS_CHIP: Record<string, { bg: string; text: string; dot: string; label: string }> = {
  REPORTED: { bg: '#F3F4F6', text: '#6B7280', dot: '#9CA3AF', label: 'Reportada' },
  OPEN: { bg: '#EFF6FF', text: '#1D4ED8', dot: '#3B82F6', label: 'Abierta' },
  IN_PROGRESS: { bg: '#111827', text: '#FFFFFF', dot: '#FFFFFF', label: 'En Progreso' },
  RESOLVED: { bg: '#ECFDF5', text: '#059669', dot: '#059669', label: 'Solucionada' },
  RESOLVED_IMMEDIATE: { bg: '#ECFDF5', text: '#059669', dot: '#059669', label: 'Solucionada' },
  CANCELLED: { bg: '#FEE2E2', text: '#DC2626', dot: '#DC2626', label: 'Cancelada' },
  CLOSED: { bg: '#F3F4F6', text: '#6B7280', dot: '#6B7280', label: 'Cerrada' },
};

const PRIORITY_CHIP: Record<string, { bg: string; text: string }> = {
  P1: { bg: '#FEE2E2', text: '#DC2626' },
  P2: { bg: '#FEF3C7', text: '#D97706' },
  P3: { bg: '#EFF6FF', text: '#1D4ED8' },
  P4: { bg: '#F3F4F6', text: '#6B7280' },
  URGENT: { bg: '#FEE2E2', text: '#DC2626' },
  HIGH: { bg: '#FEF3C7', text: '#D97706' },
  MEDIUM: { bg: '#EFF6FF', text: '#1D4ED8' },
  LOW: { bg: '#F3F4F6', text: '#6B7280' },
};

const CATEGORY_LABELS: Record<string, string> = {
  MECANICA: 'Mecánica',
  ELECTRICA: 'Eléctrica',
  HIDRAULICA: 'Hidráulica',
  NEUMATICA: 'Neumática',
  OTRA: 'Otra',
};

const MACHINE_STATUS_LABELS: Record<string, { label: string; bg: string; text: string }> = {
  ACTIVE: { label: 'Activa', bg: '#ECFDF5', text: '#059669' },
  INACTIVE: { label: 'Inactiva', bg: '#F3F4F6', text: '#6B7280' },
  MAINTENANCE: { label: 'En Mantenimiento', bg: '#FEF3C7', text: '#D97706' },
  DECOMMISSIONED: { label: 'Fuera de servicio', bg: '#FEE2E2', text: '#DC2626' },
};

const WO_STATUS_LABELS: Record<string, string> = {
  PENDING: 'Pendiente',
  IN_PROGRESS: 'En Progreso',
  COMPLETED: 'Completada',
  CANCELLED: 'Cancelada',
  ON_HOLD: 'En Espera',
};

const OUTCOME_STYLE: Record<string, { bg: string; text: string; label: string }> = {
  'FUNCIONÓ': { bg: '#ECFDF5', text: '#059669', label: 'Funcionó' },
  'PARCIAL': { bg: '#FEF3C7', text: '#D97706', label: 'Parcial' },
  'NO_FUNCIONÓ': { bg: '#FEE2E2', text: '#DC2626', label: 'No Funcionó' },
};

const TIMELINE_ICONS: Record<string, { color: string; bg: string }> = {
  REPORTED: { color: '#3B82F6', bg: '#EFF6FF' },
  OCCURRENCE: { color: '#F59E0B', bg: '#FEF3C7' },
  STATUS_CHANGE: { color: '#6B7280', bg: '#F3F4F6' },
  PRIORITY_CHANGE: { color: '#DC2626', bg: '#FEE2E2' },
  ASSIGNED: { color: '#7C3AED', bg: '#F5F3FF' },
  WORK_ORDER_CREATED: { color: '#2563EB', bg: '#EFF6FF' },
  WORK_ORDER_STARTED: { color: '#D97706', bg: '#FEF3C7' },
  WORK_ORDER_CLOSED: { color: '#059669', bg: '#ECFDF5' },
  SOLUTION_APPLIED: { color: '#059669', bg: '#ECFDF5' },
  COMMENT_ADDED: { color: '#6B7280', bg: '#F3F4F6' },
  DOWNTIME_STARTED: { color: '#DC2626', bg: '#FEE2E2' },
  DOWNTIME_ENDED: { color: '#059669', bg: '#ECFDF5' },
  LINKED_DUPLICATE: { color: '#7C3AED', bg: '#F5F3FF' },
  RCA_CREATED: { color: '#0891B2', bg: '#ECFEFF' },
  CHECKLIST_COMPLETED: { color: '#059669', bg: '#ECFDF5' },
};

const COMMENT_TYPES: Record<string, { label: string; color: string; bg: string }> = {
  comment: { label: 'Comentario', color: '#6B7280', bg: '#F3F4F6' },
  update: { label: 'Actualización', color: '#059669', bg: '#ECFDF5' },
  issue: { label: 'Problema', color: '#DC2626', bg: '#FEE2E2' },
  system: { label: 'Sistema', color: '#2563EB', bg: '#EFF6FF' },
};

// ─── Helpers ───

const getInitials = (name: string) =>
  name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

const formatDuration = (minutes: number) => {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h}h ${m}m` : `${m} min`;
};

// Chip component
const Chip = ({ bg, text, dot, label, style }: { bg: string; text: string; dot?: string; label: string; style?: React.CSSProperties }) => (
  <span style={{
    display: 'inline-flex', alignItems: 'center', gap: '4px',
    fontSize: '11px', fontWeight: 600,
    padding: '2px 10px', borderRadius: '6px',
    background: bg, color: text,
    ...style,
  }}>
    {dot && <span style={{ height: '5px', width: '5px', borderRadius: '50%', background: dot }} />}
    {label}
  </span>
);

// Section label
const SectionLabel = ({ children }: { children: React.ReactNode }) => (
  <p style={{ fontSize: '11px', fontWeight: 600, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '4px' }}>
    {children}
  </p>
);

// Info row
const InfoCard = ({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) => (
  <div style={{ border: '1px solid #E4E4E8', borderRadius: '8px', padding: '12px', ...style }}>
    {children}
  </div>
);

// ─── Main Component ───

export function FailureDetailSheet({
  failureId,
  open,
  onOpenChange,
  initialTab,
  onSelectFailure,
}: FailureDetailSheetProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user: currentUser } = useAuth();
  const { currentCompany } = useCompany();
  const chatScrollRef = useRef<HTMLDivElement>(null);

  // State
  const [activeTab, setActiveTab] = useState(initialTab || 'info');
  const [openAnim, setOpenAnim] = useState(false);
  const prevOpenRef = useRef(false);
  const [chatMessage, setChatMessage] = useState('');
  const [commentType, setCommentType] = useState<'comment' | 'update' | 'issue'>('comment');
  const [returnDialogOpen, setReturnDialogOpen] = useState(false);
  const [immediateCloseOpen, setImmediateCloseOpen] = useState(false);
  const [reopenDialogOpen, setReopenDialogOpen] = useState(false);
  const [lightboxPhoto, setLightboxPhoto] = useState<string | null>(null);
  const [editingCommentId, setEditingCommentId] = useState<number | null>(null);
  const [editingContent, setEditingContent] = useState('');
  const [deletingCommentId, setDeletingCommentId] = useState<number | null>(null);
  const [hoveredCommentId, setHoveredCommentId] = useState<number | null>(null);
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [mentionStart, setMentionStart] = useState<number | null>(null);
  const mentionedUserIds = useRef<Set<number>>(new Set());
  const chatTextareaRef = useRef<HTMLTextAreaElement>(null);
  const [selectedDowntimeLog, setSelectedDowntimeLog] = useState<{
    id: number; startedAt: string; endedAt?: string | null; workOrderId?: number | null; machine?: { id: number; name: string };
  } | null>(null);

  // Tab sync
  useEffect(() => { if (initialTab) setActiveTab(initialTab); }, [initialTab]);

  // Open animation
  useEffect(() => {
    if (open && !prevOpenRef.current) {
      setOpenAnim(true);
      const t = setTimeout(() => setOpenAnim(false), 1100);
      prevOpenRef.current = true;
      return () => clearTimeout(t);
    }
    if (!open) prevOpenRef.current = false;
  }, [open]);

  // ESC close
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onOpenChange(false); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, onOpenChange]);

  // ─── Queries ───

  const { data: failure, isLoading } = useQuery<FailureDetail>({
    queryKey: ['failure-detail', failureId],
    queryFn: async () => {
      if (!failureId) throw new Error('No failure ID');
      const res = await fetch(`/api/failure-occurrences/${failureId}`);
      if (!res.ok) throw new Error('Error al cargar falla');
      const json = await res.json();
      return json.data || json;
    },
    enabled: !!failureId && open,
  });

  const { data: commentsData, isLoading: isLoadingComments } = useQuery<{ data: Comment[]; count: number }>({
    queryKey: ['failure-comments', failureId],
    queryFn: async () => {
      if (!failureId) throw new Error('No failure ID');
      const res = await fetch(`/api/failure-occurrences/${failureId}/comments`);
      if (!res.ok) throw new Error('Error al cargar comentarios');
      return res.json();
    },
    enabled: !!failureId && open,
    refetchInterval: 30000,
  });
  const comments = commentsData?.data || [];

  const { data: watchersData } = useQuery<{ isWatching: boolean; count: number; watchers: Array<{ id: number; user: { id: number; name: string } }> }>({
    queryKey: ['failure-watchers', failureId],
    queryFn: async () => {
      if (!failureId) throw new Error('No failure ID');
      const res = await fetch(`/api/failure-occurrences/${failureId}/watchers`);
      if (!res.ok) throw new Error('Error al cargar watchers');
      return res.json();
    },
    enabled: !!failureId && open,
  });
  const isWatching = watchersData?.isWatching ?? false;
  const watchersList = watchersData?.watchers ?? [];

  // Timeline query
  const { data: timelineData, isLoading: isLoadingTimeline } = useQuery<{ timeline: TimelineEvent[]; totalEvents: number }>({
    queryKey: ['failure-timeline', failureId],
    queryFn: async () => {
      if (!failureId) throw new Error('No failure ID');
      const res = await fetch(`/api/failure-occurrences/${failureId}/timeline`);
      if (!res.ok) throw new Error('Error al cargar timeline');
      return res.json();
    },
    enabled: !!failureId && open && activeTab === 'timeline',
  });
  const timeline = timelineData?.timeline || [];

  // Users for @mentions — derive companyId from failure data (already loaded)
  const companyId = failure?.companyId || currentCompany?.id;
  const { data: mentionUsersData } = useQuery<{ id: number; name: string }[]>({
    queryKey: ['company-users-mentions', companyId],
    queryFn: async () => {
      const res = await fetch(`/api/companies/${companyId}/users`);
      if (!res.ok) return [];
      const json = await res.json();
      const users = json.users || json.data || json;
      return Array.isArray(users) ? users.map((u: any) => ({ id: u.id, name: u.name })) : [];
    },
    enabled: !!companyId,
    staleTime: 5 * 60 * 1000,
  });
  const mentionMembers = mentionUsersData || [];
  const filteredMentions = mentionQuery !== null
    ? mentionMembers.filter(m => m.name.toLowerCase().includes(mentionQuery.toLowerCase())).slice(0, 5)
    : [];

  // ─── Mutations ───

  const watchMutation = useMutation({
    mutationFn: async (action: 'watch' | 'unwatch') => {
      const res = await fetch(`/api/failure-occurrences/${failureId}/watchers`, {
        method: action === 'watch' ? 'POST' : 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      if (!res.ok) { const error = await res.json(); throw new Error(error.error || 'Error'); }
      return res.json();
    },
    onSuccess: (_, action) => {
      toast.success(action === 'watch' ? 'Siguiendo falla' : 'Dejaste de seguir');
      queryClient.invalidateQueries({ queryKey: ['failure-watchers', failureId] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const sendCommentMutation = useMutation({
    mutationFn: async ({ content, type }: { content: string; type: string }) => {
      const res = await fetch(`/api/failure-occurrences/${failureId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content, type }),
      });
      if (!res.ok) { const error = await res.json(); throw new Error(error.error || 'Error al enviar comentario'); }
      return res.json();
    },
    onSuccess: () => {
      setChatMessage('');
      setCommentType('comment');
      queryClient.invalidateQueries({ queryKey: ['failure-comments', failureId] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const editCommentMutation = useMutation({
    mutationFn: async ({ commentId, content }: { commentId: number; content: string }) => {
      const res = await fetch(`/api/failure-occurrences/${failureId}/comments`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ commentId, content }),
      });
      if (!res.ok) { const error = await res.json(); throw new Error(error.error || 'Error al editar'); }
      return res.json();
    },
    onSuccess: () => {
      setEditingCommentId(null);
      setEditingContent('');
      queryClient.invalidateQueries({ queryKey: ['failure-comments', failureId] });
      toast.success('Comentario editado');
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const deleteCommentMutation = useMutation({
    mutationFn: async (commentId: number) => {
      const res = await fetch(`/api/failure-occurrences/${failureId}/comments`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ commentId }),
      });
      if (!res.ok) { const error = await res.json(); throw new Error(error.error || 'Error al eliminar'); }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['failure-comments', failureId] });
      toast.success('Comentario eliminado');
    },
    onError: (error: Error) => toast.error(error.message),
  });

  // Scroll on new comments
  useEffect(() => {
    if (chatScrollRef.current && comments.length > 0) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [comments.length]);

  // ─── Handlers ───

  const handleSendComment = () => {
    if (!chatMessage.trim()) return;
    sendCommentMutation.mutate({ content: chatMessage.trim(), type: commentType });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); handleSendComment(); }
    if (e.key === 'Escape') setMentionQuery(null);
  };

  const handleChatInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const text = e.target.value;
    setChatMessage(text);
    const cursor = e.target.selectionStart ?? text.length;
    const textUpToCursor = text.slice(0, cursor);
    const atMatch = textUpToCursor.match(/@(\w*)$/);
    if (atMatch) {
      setMentionQuery(atMatch[1]);
      setMentionStart(cursor - atMatch[0].length);
    } else {
      setMentionQuery(null);
      setMentionStart(null);
    }
  };

  const handleSelectMention = (user: { id: number; name: string }) => {
    if (mentionStart === null) return;
    const cursorPos = chatTextareaRef.current?.selectionStart ?? chatMessage.length;
    const before = chatMessage.slice(0, mentionStart);
    const after = chatMessage.slice(cursorPos);
    setChatMessage(`${before}@${user.name} ${after}`);
    mentionedUserIds.current.add(user.id);
    setMentionQuery(null);
    setMentionStart(null);
    setTimeout(() => chatTextareaRef.current?.focus(), 0);
  };

  const handleGoToWorkOrder = (woId: number) => { onOpenChange(false); router.push(`/mantenimiento/ordenes?workOrderId=${woId}`); };
  const handleGoToMaintenance = (woId: number) => { onOpenChange(false); router.push(`/mantenimiento/mantenimientos?correctiveId=${woId}`); };
  const handleCreateWorkOrder = () => { onOpenChange(false); router.push(`/mantenimiento/ordenes?newFromFailure=${failureId}`); };

  const hasWorkOrder = (failure?.workOrders?.length ?? 0) > 0;
  const sChip = STATUS_CHIP[failure?.status || ''] || STATUS_CHIP.REPORTED;
  const pChip = PRIORITY_CHIP[failure?.priority || ''] || PRIORITY_CHIP.P3;

  // Priority accent for modal top border
  const priorityAccent = (() => {
    const p = failure?.priority || '';
    if (p === 'URGENT' || p === 'P1') return '#DC2626';
    if (p === 'HIGH' || p === 'P2') return '#D97706';
    if (p === 'MEDIUM' || p === 'P3') return '#2563EB';
    return '#9CA3AF';
  })();

  // Tab definitions
  const tabs = [
    { value: 'info', label: 'Info' },
    { value: 'timeline', label: 'Actividad' },
    { value: 'recurrence', label: 'Reincidencia' },
    { value: 'duplicates', label: 'Duplicados', count: failure?.linkedDuplicates?.length },
    { value: 'downtime', label: 'Paradas', hasActive: failure?.downtimeLogs?.some(d => !d.endedAt) },
    { value: 'solutions', label: 'Soluciones', count: failure?.solutionsApplied?.length },
    { value: 'comments', label: 'Chat', count: comments.length || undefined },
  ];

  return (
    <>
    <style>{`
      @keyframes failure-modal-unfold {
        0%   { transform: scaleY(0);     opacity: 0; filter: blur(6px); }
        10%  { transform: scaleY(0.006); opacity: 1; filter: blur(4px); }
        100% { transform: scaleY(1);     opacity: 1; filter: blur(0px); }
      }
      @keyframes failure-content-reveal {
        0%   { opacity: 0; transform: translateX(-18px); filter: blur(8px); }
        100% { opacity: 1; transform: translateX(0);     filter: blur(0); }
      }
      @keyframes failure-backdrop-in {
        from { opacity: 0; backdrop-filter: blur(0px); }
        to   { opacity: 1; backdrop-filter: blur(6px); }
      }
      .fd-scroll { scrollbar-width: none; -ms-overflow-style: none; overflow-y: auto; height: 100%; flex: 1; min-height: 0; }
      .fd-scroll::-webkit-scrollbar { display: none; }
    `}</style>

    {/* Backdrop */}
    {open && (
      <div
        onClick={() => onOpenChange(false)}
        style={{
          position: 'fixed', inset: 0, zIndex: 50,
          background: 'rgba(0,0,0,0.40)',
          backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)',
          animation: 'failure-backdrop-in 300ms ease both',
        }}
      />
    )}

    {/* Modal overlay */}
    <div
      onClick={() => onOpenChange(false)}
      style={{
        position: 'fixed', inset: 0, zIndex: 51,
        display: open ? 'flex' : 'none',
        alignItems: 'center', justifyContent: 'center', padding: '16px',
      }}
    >
      {/* Modal box */}
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: '1020px', maxWidth: '95vw', height: '920px', maxHeight: '96vh',
          background: '#FFFFFF',
          border: '1.5px solid #D8D8DE', borderRadius: '10px',
          borderTop: `3px solid ${priorityAccent}`,
          boxShadow: '0 4px 32px rgba(0,0,0,.12), 0 1px 4px rgba(0,0,0,.06)',
          display: 'flex', flexDirection: 'column', overflow: 'hidden',
          transformOrigin: 'center center',
          animation: openAnim ? 'failure-modal-unfold 950ms cubic-bezier(.22,1,.36,1) both' : undefined,
        }}
      >
        {isLoading ? (
          <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {[120, 200, 80, 300, 160].map((w, i) => (
              <div key={i} style={{ height: i === 3 ? '48px' : '20px', width: `${w}px`, maxWidth: '100%', background: '#F3F4F6', borderRadius: '6px', animation: 'pulse 2s infinite' }} />
            ))}
          </div>
        ) : failure ? (
          <>
            {/* ── HEADER ── */}
            <div style={{
              padding: '18px 24px',
              borderBottom: '1px solid #E4E4E8',
              flexShrink: 0,
              animation: openAnim ? 'failure-content-reveal 420ms cubic-bezier(.22,1,.36,1) 320ms both' : undefined,
            }}>
              {/* Top row: chips + actions */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '10px', flexWrap: 'wrap' }}>
                <Chip bg={sChip.bg} text={sChip.text} dot={sChip.dot} label={sChip.label} />
                <Chip
                  bg={pChip.bg} text={pChip.text}
                  label={failure.priority === 'URGENT' ? 'Urgente' : failure.priority === 'HIGH' ? 'Alta' : failure.priority === 'MEDIUM' ? 'Media' : failure.priority === 'LOW' ? 'Baja' : failure.priority}
                  style={(failure.priority === 'URGENT' || failure.priority === 'P1') ? { border: `1.5px solid ${pChip.text}`, fontWeight: 700 } : undefined}
                />
                <Chip
                  bg={failure.incidentType === 'ROTURA' ? '#FEE2E2' : '#F4F4F6'}
                  text={failure.incidentType === 'ROTURA' ? '#DC2626' : '#6B7280'}
                  label={`${failure.incidentType === 'ROTURA' ? 'Rotura' : 'Falla'} #${failure.id}`}
                />
                {/* NEW: failureCategory */}
                {failure.failureCategory && (
                  <Chip bg="#F0F9FF" text="#0369A1" label={CATEGORY_LABELS[failure.failureCategory] || failure.failureCategory} />
                )}
                {/* NEW: isObservation */}
                {failure.isObservation && (
                  <Chip bg="#F5F3FF" text="#7C3AED" label="Observación" style={{ gap: '3px' }} />
                )}
                {/* NEW: resolvedImmediately */}
                {failure.resolvedImmediately && (
                  <Chip bg="#ECFDF5" text="#059669" label="Cierre rápido" />
                )}
                {failure.causedDowntime && (
                  <span style={{
                    display: 'inline-flex', alignItems: 'center', gap: '3px',
                    fontSize: '11px', fontWeight: 600, padding: '2px 8px', borderRadius: '6px',
                    background: '#FEE2E2', color: '#DC2626',
                  }}>
                    <Clock className="h-3 w-3" /> Parada
                  </span>
                )}
                {failure.isIntermittent && (
                  <Chip bg="#FEF3C7" text="#D97706" label="Intermitente" />
                )}
                {failure.isSafetyRelated && (
                  <span style={{
                    display: 'inline-flex', alignItems: 'center', gap: '3px',
                    fontSize: '11px', fontWeight: 600, padding: '2px 8px', borderRadius: '6px',
                    background: '#FEE2E2', color: '#DC2626',
                  }}>
                    <Shield className="h-3 w-3" /> Seguridad
                  </span>
                )}

                <div style={{ flex: 1 }} />

                {/* Watch button */}
                <button
                  onClick={() => watchMutation.mutate(isWatching ? 'unwatch' : 'watch')}
                  disabled={watchMutation.isPending}
                  style={{
                    height: '28px', padding: '0 10px', borderRadius: '6px', border: '1px solid #E4E4E8',
                    background: isWatching ? '#F5F3FF' : '#FFFFFF', color: isWatching ? '#7C3AED' : '#6B7280',
                    cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px',
                    fontSize: '12px', fontWeight: 500, transition: 'all 120ms ease',
                  }}
                >
                  {watchMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> :
                    isWatching ? <><BellOff className="h-3 w-3" /> Siguiendo</> : <><Bell className="h-3 w-3" /> Seguir</>}
                </button>

                {/* Menu */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button style={{
                      height: '28px', width: '28px', borderRadius: '6px',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      background: 'transparent', border: 'none', color: '#9CA3AF', cursor: 'pointer',
                    }}
                      onMouseEnter={e => { e.currentTarget.style.background = '#F4F4F6'; e.currentTarget.style.color = '#6B7280'; }}
                      onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#9CA3AF'; }}
                    >
                      <MoreVertical className="h-3.5 w-3.5" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem className="text-xs gap-2" onClick={() => router.push(`/mantenimiento/incidentes/${failure.id}/editar`)}>
                      <Pencil className="h-3 w-3" /> Editar
                    </DropdownMenuItem>
                    {(failure.status === 'RESOLVED' || failure.status === 'RESOLVED_IMMEDIATE') && (
                      <DropdownMenuItem className="text-xs gap-2" onClick={() => setReopenDialogOpen(true)}>
                        <RotateCcw className="h-3 w-3" /> Reabrir
                      </DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>

                {/* Close */}
                <button
                  onClick={() => onOpenChange(false)}
                  style={{
                    height: '28px', width: '28px', borderRadius: '6px',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: 'transparent', border: 'none', color: '#9CA3AF', cursor: 'pointer',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = '#FEE2E2'; e.currentTarget.style.color = '#DC2626'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#9CA3AF'; }}
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>

              {/* Title */}
              <h2 style={{ fontSize: '22px', fontWeight: 700, color: '#111827', letterSpacing: '-0.02em', lineHeight: 1.3, margin: 0 }}>
                {failure.title || 'Sin título'}
              </h2>

              {/* Meta row */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '10px', flexWrap: 'wrap' }}>
                {failure.machine?.name && (
                  <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', color: '#6B7280' }}>
                    <span style={{ height: '20px', width: '20px', borderRadius: '6px', background: '#F3F4F6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Cpu className="h-3 w-3" style={{ color: '#9CA3AF' }} />
                    </span>
                    {failure.machine.nickname || failure.machine.name}
                  </span>
                )}
                {failure.reportedBy?.name && (
                  <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', color: '#6B7280' }}>
                    <span style={{
                      height: '20px', width: '20px', borderRadius: '50%',
                      background: '#EDE9FE', color: '#7C3AED',
                      fontSize: '8px', fontWeight: 700,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      {getInitials(failure.reportedBy.name)}
                    </span>
                    {failure.reportedBy.name}
                  </span>
                )}
                {(watchersData?.count ?? 0) > 0 && (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', color: '#9CA3AF', cursor: 'help' }}>
                          <Users className="h-3 w-3" />
                          {watchersData?.count} {watchersData?.count === 1 ? 'seguidor' : 'seguidores'}
                        </span>
                      </TooltipTrigger>
                      <TooltipContent side="bottom">
                        <div style={{ fontSize: '12px' }}>
                          <p style={{ fontWeight: 600, marginBottom: '4px' }}>Seguidores:</p>
                          {watchersList.map(w => <p key={w.id}>{w.user.name}</p>)}
                        </div>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}
                {/* NEW: Time since report */}
                {failure.computed && (
                  <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', color: '#9CA3AF' }}>
                    <Timer className="h-3 w-3" />
                    {failure.computed.hoursSinceReport > 24
                      ? `${Math.floor(failure.computed.hoursSinceReport / 24)}d`
                      : failure.computed.hoursSinceReport > 0
                        ? `${failure.computed.hoursSinceReport}h`
                        : `${failure.computed.minutesSinceReport}m`}
                  </span>
                )}
                <span style={{ fontSize: '12px', color: '#D1D5DB' }}>
                  {format(new Date(failure.reportedAt), "d MMM yyyy · HH:mm", { locale: es })}
                </span>
              </div>
            </div>

            {/* ── BANNERS ── */}
            <div style={{ flexShrink: 0 }}>
              {/* Reopen banner */}
              {failure.reopenReason && (
                <div style={{
                  padding: '10px 24px', background: '#FEF3C7', borderBottom: '1px solid #FDE68A',
                  display: 'flex', alignItems: 'center', gap: '8px',
                }}>
                  <RotateCcw className="h-3.5 w-3.5" style={{ color: '#D97706', flexShrink: 0 }} />
                  <span style={{ fontSize: '12px', color: '#92400E', fontWeight: 500 }}>
                    Reabierta{failure.reopenedAt ? ` el ${format(new Date(failure.reopenedAt), "d MMM HH:mm", { locale: es })}` : ''}
                    {' — '}{failure.reopenReason}
                  </span>
                </div>
              )}
              {/* Duplicate banner */}
              {failure.isLinkedDuplicate && (
                <div style={{
                  padding: '10px 24px', background: '#F5F3FF', borderBottom: '1px solid #E9D5FF',
                  display: 'flex', alignItems: 'center', gap: '8px',
                }}>
                  <Link2 className="h-3.5 w-3.5" style={{ color: '#7C3AED', flexShrink: 0 }} />
                  <span style={{ fontSize: '12px', color: '#6D28D9', fontWeight: 500 }}>
                    Duplicado de #{failure.linkedToOccurrenceId}
                    {failure.linkedReason && ` — ${failure.linkedReason}`}
                  </span>
                  {failure.linkedToOccurrenceId && onSelectFailure && (
                    <button
                      onClick={() => onSelectFailure(failure.linkedToOccurrenceId!)}
                      style={{ fontSize: '12px', color: '#7C3AED', fontWeight: 600, background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}
                    >
                      Ver original
                    </button>
                  )}
                </div>
              )}
              {/* Original report correction */}
              {failure.originalReport && (
                <div style={{
                  padding: '10px 24px', background: '#FFF7ED', borderBottom: '1px solid #FED7AA',
                  display: 'flex', alignItems: 'flex-start', gap: '8px',
                }}>
                  <AlertTriangle className="h-3.5 w-3.5" style={{ color: '#EA580C', flexShrink: 0, marginTop: '1px' }} />
                  <div style={{ fontSize: '12px', color: '#9A3412' }}>
                    <span style={{ fontWeight: 600 }}>Corregida al cierre</span>
                    {failure.originalReport.title && (
                      <span style={{ textDecoration: 'line-through', marginLeft: '8px', opacity: 0.7 }}>
                        {failure.originalReport.title}
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* ── TABS BAR ── */}
            <div style={{ padding: '0 24px', borderBottom: '1px solid #E4E4E8', flexShrink: 0, overflowX: 'auto' }}>
              <div style={{ display: 'flex', gap: '0' }}>
                {tabs.map(tab => (
                  <button
                    key={tab.value}
                    onClick={() => setActiveTab(tab.value)}
                    style={{
                      padding: '10px 16px', fontSize: '12px', fontWeight: 500,
                      color: activeTab === tab.value ? '#111827' : '#9CA3AF',
                      background: 'none', border: 'none', borderBottom: `2px solid ${activeTab === tab.value ? '#111827' : 'transparent'}`,
                      cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px',
                      transition: 'all 150ms', whiteSpace: 'nowrap',
                    }}
                  >
                    {tab.label}
                    {tab.count != null && tab.count > 0 && (
                      <span style={{
                        fontSize: '10px', fontWeight: 600, padding: '1px 5px', borderRadius: '8px',
                        background: '#F3F4F6', color: '#6B7280',
                      }}>
                        {tab.count}
                      </span>
                    )}
                    {tab.hasActive && (
                      <span style={{
                        height: '6px', width: '6px', borderRadius: '50%', background: '#DC2626',
                        display: 'inline-block', animation: 'pulse 2s infinite',
                      }} />
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* ── TAB CONTENT ── */}
            <div className="fd-scroll" style={{ padding: '16px 24px' }}>

              {/* ═══ INFO TAB ═══ */}
              {activeTab === 'info' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {/* Description + Notes */}
                  <InfoCard>
                    <SectionLabel>Descripción</SectionLabel>
                    <p style={{ fontSize: '14px', color: '#111827', margin: 0, lineHeight: 1.5 }}>
                      {failure.description || 'Sin descripción'}
                    </p>
                    {failure.notes && (
                      <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid #F3F4F6' }}>
                        <SectionLabel>Notas</SectionLabel>
                        <p style={{ fontSize: '13px', color: '#6B7280', margin: 0, lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
                          {failure.notes}
                        </p>
                      </div>
                    )}
                  </InfoCard>

                  {/* Symptoms */}
                  {failure.symptomsList && failure.symptomsList.length > 0 && (
                    <InfoCard>
                      <SectionLabel>Síntomas</SectionLabel>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                        {failure.symptomsList.map(s => (
                          <span key={s.id} style={{
                            fontSize: '12px', fontWeight: 500, padding: '3px 10px', borderRadius: '6px',
                            background: '#EFF6FF', color: '#1D4ED8',
                          }}>
                            {s.label}
                          </span>
                        ))}
                      </div>
                    </InfoCard>
                  )}

                  {/* Photos */}
                  <InfoCard>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                      <SectionLabel>Fotos {failure.photos?.length ? `(${failure.photos.length})` : ''}</SectionLabel>
                      <label style={{ cursor: 'pointer' }}>
                        <input
                          type="file"
                          accept="image/*"
                          style={{ display: 'none' }}
                          onChange={async (e) => {
                            const file = e.target.files?.[0];
                            if (!file) return;
                            toast.loading('Subiendo foto...', { id: 'photo-upload' });
                            try {
                              const formData = new FormData();
                              formData.append('file', file);
                              formData.append('entityType', 'failure-occurrence');
                              formData.append('entityId', failureId?.toString() || '');
                              formData.append('fileType', 'image');
                              const uploadRes = await fetch('/api/upload', { method: 'POST', body: formData });
                              if (!uploadRes.ok) throw new Error('Error al subir');
                              const uploadData = await uploadRes.json();
                              const newPhoto = { url: uploadData.url, fileName: uploadData.fileName, originalName: file.name };
                              const currentPhotos = failure.photos || [];
                              await fetch(`/api/failure-occurrences/${failureId}`, {
                                method: 'PATCH',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ photos: [...currentPhotos, newPhoto] }),
                              });
                              queryClient.invalidateQueries({ queryKey: ['failure-detail', failureId] });
                              toast.success('Foto subida', { id: 'photo-upload' });
                            } catch {
                              toast.error('Error al subir foto', { id: 'photo-upload' });
                            }
                            e.target.value = '';
                          }}
                        />
                        <span style={{ fontSize: '12px', color: '#2563EB', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 500 }}>
                          <ImageIcon className="h-3 w-3" /> Agregar
                        </span>
                      </label>
                    </div>
                    {failure.photos && failure.photos.length > 0 ? (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                        {failure.photos.map((photo, idx) => (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => setLightboxPhoto(photo.url)}
                            style={{
                              display: 'block', borderRadius: '8px', border: '1px solid #E4E4E8',
                              overflow: 'hidden', cursor: 'zoom-in', padding: 0, background: 'none',
                              transition: 'all 150ms',
                            }}
                          >
                            <img src={photo.url} alt={`Foto ${idx + 1}`} style={{ height: '80px', width: '80px', objectFit: 'cover' }} />
                          </button>
                        ))}
                      </div>
                    ) : (
                      <p style={{ fontSize: '12px', color: '#9CA3AF', fontStyle: 'italic', margin: 0 }}>Sin fotos</p>
                    )}
                  </InfoCard>

                  {/* Machine details (EXPANDED) */}
                  <InfoCard>
                    <SectionLabel>Equipo</SectionLabel>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                      <div>
                        <p style={{ fontSize: '11px', color: '#9CA3AF', marginBottom: '2px' }}>Máquina</p>
                        <p style={{ fontSize: '14px', fontWeight: 600, color: '#111827', margin: 0 }}>{failure.machine?.name || '-'}</p>
                        {failure.machine?.nickname && failure.machine.nickname !== failure.machine.name && (
                          <p style={{ fontSize: '12px', color: '#6B7280', margin: 0 }}>({failure.machine.nickname})</p>
                        )}
                      </div>
                      {failure.machine?.serialNumber && (
                        <div>
                          <p style={{ fontSize: '11px', color: '#9CA3AF', marginBottom: '2px' }}>Nro. Serie</p>
                          <p style={{ fontSize: '13px', color: '#111827', margin: 0, fontFamily: 'monospace' }}>{failure.machine.serialNumber}</p>
                        </div>
                      )}
                      {(failure.machine?.brand || failure.machine?.model) && (
                        <div>
                          <p style={{ fontSize: '11px', color: '#9CA3AF', marginBottom: '2px' }}>Marca / Modelo</p>
                          <p style={{ fontSize: '13px', color: '#111827', margin: 0 }}>
                            {[failure.machine.brand, failure.machine.model].filter(Boolean).join(' ')}
                          </p>
                        </div>
                      )}
                      {failure.machine?.status && (
                        <div>
                          <p style={{ fontSize: '11px', color: '#9CA3AF', marginBottom: '2px' }}>Estado máquina</p>
                          {(() => {
                            const ms = MACHINE_STATUS_LABELS[failure.machine!.status!] || { label: failure.machine!.status!, bg: '#F3F4F6', text: '#6B7280' };
                            return (
                              <span style={{
                                display: 'inline-flex', alignItems: 'center', gap: '4px',
                                fontSize: '12px', fontWeight: 500, padding: '2px 8px', borderRadius: '5px',
                                background: ms.bg, color: ms.text,
                              }}>
                                <span style={{ height: '5px', width: '5px', borderRadius: '50%', background: ms.text }} />
                                {ms.label}
                              </span>
                            );
                          })()}
                        </div>
                      )}
                    </div>
                    {/* Components */}
                    {(failure.components?.length || failure.component) && (
                      <div style={{ marginTop: '10px', paddingTop: '10px', borderTop: '1px solid #F3F4F6' }}>
                        <p style={{ fontSize: '11px', color: '#9CA3AF', marginBottom: '2px' }}>Componentes</p>
                        <p style={{ fontSize: '13px', color: '#111827', margin: 0 }}>
                          {failure.components?.length ? failure.components.map(c => c.name).join(', ') : failure.component?.name}
                        </p>
                      </div>
                    )}
                    {(failure.subcomponents?.length || failure.subcomponent) && (
                      <div style={{ marginTop: '6px' }}>
                        <p style={{ fontSize: '11px', color: '#9CA3AF', marginBottom: '2px' }}>Subcomponentes</p>
                        <p style={{ fontSize: '13px', color: '#6B7280', margin: 0 }}>
                          {failure.subcomponents?.length ? failure.subcomponents.map(s => s.name).join(', ') : failure.subcomponent?.name}
                        </p>
                      </div>
                    )}
                    {/* Failure type catalog */}
                    {failure.failureType?.title && (
                      <div style={{ marginTop: '10px', paddingTop: '10px', borderTop: '1px solid #F3F4F6' }}>
                        <p style={{ fontSize: '11px', color: '#9CA3AF', marginBottom: '2px' }}>Tipo de falla (catálogo)</p>
                        <p style={{ fontSize: '13px', color: '#111827', margin: 0 }}>{failure.failureType.title}</p>
                      </div>
                    )}
                  </InfoCard>

                  {/* Reporter + Date + Computed metrics */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                    <InfoCard>
                      <p style={{ fontSize: '11px', color: '#9CA3AF', marginBottom: '2px' }}>Reportada por</p>
                      <p style={{ fontSize: '14px', fontWeight: 500, color: '#111827', margin: 0 }}>{failure.reportedBy?.name || '-'}</p>
                      <p style={{ fontSize: '12px', color: '#9CA3AF', margin: 0 }}>
                        {format(new Date(failure.reportedAt), "d MMM yyyy, HH:mm", { locale: es })}
                      </p>
                    </InfoCard>
                    <InfoCard>
                      <p style={{ fontSize: '11px', color: '#9CA3AF', marginBottom: '2px' }}>Métricas</p>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        {failure.computed && (
                          <>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                              <span style={{ color: '#6B7280' }}>Tiempo abierta</span>
                              <span style={{ fontWeight: 600, color: '#111827' }}>
                                {formatDuration(failure.computed.minutesSinceReport)}
                              </span>
                            </div>
                            {failure.computed.totalDowntimeMinutes > 0 && (
                              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                                <span style={{ color: '#DC2626' }}>Downtime total</span>
                                <span style={{ fontWeight: 600, color: '#DC2626' }}>
                                  {formatDuration(failure.computed.totalDowntimeMinutes)}
                                </span>
                              </div>
                            )}
                          </>
                        )}
                        {failure.resolvedAt && (
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                            <span style={{ color: '#6B7280' }}>Resuelta</span>
                            <span style={{ fontWeight: 500, color: '#059669' }}>
                              {format(new Date(failure.resolvedAt), "d MMM, HH:mm", { locale: es })}
                            </span>
                          </div>
                        )}
                      </div>
                    </InfoCard>
                  </div>

                  {/* Work Orders (EXPANDED) */}
                  {hasWorkOrder && (
                    <div>
                      <SectionLabel>Órdenes de Trabajo ({failure.workOrders?.length})</SectionLabel>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {failure.workOrders?.map(wo => {
                          const woChip = STATUS_CHIP[wo.status] || { bg: '#F3F4F6', text: '#6B7280', dot: '#9CA3AF', label: wo.status };
                          return (
                            <div
                              key={wo.id}
                              onClick={() => handleGoToWorkOrder(wo.id)}
                              style={{
                                border: '1px solid #E4E4E8', borderRadius: '8px', padding: '12px',
                                cursor: 'pointer', transition: 'all 150ms',
                                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                              }}
                              onMouseEnter={e => { e.currentTarget.style.background = '#FAFAFA'; e.currentTarget.style.borderColor = '#D8D8DE'; }}
                              onMouseLeave={e => { e.currentTarget.style.background = '#FFFFFF'; e.currentTarget.style.borderColor = '#E4E4E8'; }}
                            >
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <p style={{ fontSize: '14px', fontWeight: 500, color: '#111827', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                  {wo.title}
                                </p>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px', flexWrap: 'wrap' }}>
                                  <span style={{ fontSize: '12px', color: '#9CA3AF' }}>OT #{wo.id}</span>
                                  {wo.assignedTo?.name && (
                                    <span style={{ fontSize: '12px', color: '#6B7280', display: 'flex', alignItems: 'center', gap: '3px' }}>
                                      <User className="h-3 w-3" /> {wo.assignedTo.name}
                                    </span>
                                  )}
                                  {wo.scheduledDate && (
                                    <span style={{ fontSize: '12px', color: '#6B7280', display: 'flex', alignItems: 'center', gap: '3px' }}>
                                      <Calendar className="h-3 w-3" /> {format(new Date(wo.scheduledDate), "d MMM", { locale: es })}
                                    </span>
                                  )}
                                  {wo.completedDate && (
                                    <span style={{ fontSize: '12px', color: '#059669', display: 'flex', alignItems: 'center', gap: '3px' }}>
                                      <CheckCircle2 className="h-3 w-3" /> {format(new Date(wo.completedDate), "d MMM", { locale: es })}
                                    </span>
                                  )}
                                </div>
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                                <Chip bg={woChip.bg} text={woChip.text} label={WO_STATUS_LABELS[wo.status] || wo.status} />
                                <ExternalLink className="h-4 w-4" style={{ color: '#9CA3AF' }} />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* ═══ TIMELINE TAB ═══ */}
              {activeTab === 'timeline' && (
                <div>
                  {isLoadingTimeline ? (
                    <div style={{ display: 'flex', justifyContent: 'center', padding: '40px 0' }}>
                      <Loader2 className="h-6 w-6 animate-spin" style={{ color: '#9CA3AF' }} />
                    </div>
                  ) : timeline.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '40px 0' }}>
                      <Activity className="h-8 w-8" style={{ color: '#D1D5DB', margin: '0 auto 8px' }} />
                      <p style={{ fontSize: '14px', color: '#9CA3AF' }}>Sin actividad registrada</p>
                    </div>
                  ) : (
                    <div style={{ position: 'relative', paddingLeft: '28px' }}>
                      {/* Vertical line */}
                      <div style={{ position: 'absolute', left: '9px', top: '4px', bottom: '4px', width: '2px', background: '#E4E4E8', borderRadius: '1px' }} />
                      {timeline.map((event, idx) => {
                        const tStyle = TIMELINE_ICONS[event.type] || { color: '#6B7280', bg: '#F3F4F6' };
                        return (
                          <div key={event.id} style={{ position: 'relative', paddingBottom: idx < timeline.length - 1 ? '16px' : '0' }}>
                            {/* Dot */}
                            <div style={{
                              position: 'absolute', left: '-28px', top: '2px',
                              height: '20px', width: '20px', borderRadius: '50%',
                              background: tStyle.bg, border: `2px solid ${tStyle.color}`,
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                            }}>
                              <div style={{ height: '6px', width: '6px', borderRadius: '50%', background: tStyle.color }} />
                            </div>
                            {/* Content */}
                            <div>
                              <p style={{ fontSize: '13px', fontWeight: 500, color: '#111827', margin: 0 }}>{event.title}</p>
                              {event.description && (
                                <p style={{ fontSize: '12px', color: '#6B7280', margin: '2px 0 0', lineHeight: 1.4 }}>{event.description}</p>
                              )}
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
                                {event.performedBy?.name && (
                                  <span style={{ fontSize: '11px', color: '#9CA3AF' }}>{event.performedBy.name}</span>
                                )}
                                <span style={{ fontSize: '11px', color: '#D1D5DB' }}>
                                  {format(new Date(event.occurredAt), "d MMM yyyy, HH:mm", { locale: es })}
                                </span>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* ═══ RECURRENCE TAB ═══ */}
              {activeTab === 'recurrence' && (
                <div>
                  {failureId && <RecurrencePanel failureId={failureId} onSelectFailure={onSelectFailure} />}
                </div>
              )}

              {/* ═══ DUPLICATES TAB ═══ */}
              {activeTab === 'duplicates' && (
                <div>
                  {(failure.linkedDuplicates?.length ?? 0) === 0 ? (
                    <div style={{ textAlign: 'center', padding: '40px 0' }}>
                      <FileText className="h-8 w-8" style={{ color: '#D1D5DB', margin: '0 auto 8px' }} />
                      <p style={{ fontSize: '14px', color: '#9CA3AF' }}>No hay reportes duplicados vinculados</p>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {failure.linkedDuplicates?.map((dup, idx) => (
                        <div key={dup.id} style={{
                          border: '1px solid #E4E4E8', borderRadius: '8px', padding: '12px',
                          borderLeft: '3px solid #7C3AED',
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <div>
                              <p style={{ fontSize: '14px', fontWeight: 500, color: '#111827', margin: 0 }}>
                                {dup.title || `Reporte #${idx + 1}`}
                              </p>
                              <p style={{ fontSize: '12px', color: '#6B7280', margin: '2px 0 0' }}>
                                Por {dup.reportedBy?.name || 'Usuario'} · {format(new Date(dup.reportedAt), "d 'de' MMMM, HH:mm", { locale: es })}
                              </p>
                              {dup.linkedReason && (
                                <p style={{ fontSize: '12px', color: '#9CA3AF', margin: '4px 0 0', fontStyle: 'italic' }}>{dup.linkedReason}</p>
                              )}
                            </div>
                            <Chip bg="#F5F3FF" text="#7C3AED" label="Duplicado" />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* ═══ DOWNTIME TAB ═══ */}
              {activeTab === 'downtime' && (
                <div>
                  {/* Total downtime metric */}
                  {failure.computed && failure.computed.totalDowntimeMinutes > 0 && (
                    <div style={{
                      background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '8px',
                      padding: '12px', marginBottom: '12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    }}>
                      <span style={{ fontSize: '13px', fontWeight: 500, color: '#991B1B' }}>Downtime total acumulado</span>
                      <span style={{ fontSize: '16px', fontWeight: 700, color: '#DC2626' }}>
                        {formatDuration(failure.computed.totalDowntimeMinutes)}
                      </span>
                    </div>
                  )}
                  {(failure.downtimeLogs?.length ?? 0) === 0 ? (
                    <div style={{ textAlign: 'center', padding: '40px 0' }}>
                      <Clock className="h-8 w-8" style={{ color: '#D1D5DB', margin: '0 auto 8px' }} />
                      <p style={{ fontSize: '14px', color: '#9CA3AF' }}>Esta falla no causó paradas de producción</p>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {failure.downtimeLogs?.map(log => {
                        const isActive = !log.endedAt;
                        const activeMinutes = isActive
                          ? differenceInMinutes(new Date(), new Date(log.startedAt))
                          : log.totalMinutes || 0;
                        return (
                          <div key={log.id} style={{
                            border: `1.5px solid ${isActive ? '#FECACA' : '#E4E4E8'}`,
                            borderRadius: '8px', padding: '14px',
                            background: isActive ? '#FEF2F2' : '#FFFFFF',
                          }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                              {isActive ? (
                                <span style={{
                                  display: 'inline-flex', alignItems: 'center', gap: '4px',
                                  fontSize: '12px', fontWeight: 600, padding: '3px 10px', borderRadius: '6px',
                                  background: '#DC2626', color: '#FFFFFF', animation: 'pulse 2s infinite',
                                }}>
                                  <Clock className="h-3 w-3" /> Planta Parada
                                </span>
                              ) : (
                                <Chip bg="#ECFDF5" text="#059669" label="Finalizada" />
                              )}
                              <span style={{ fontSize: '18px', fontWeight: 700, color: isActive ? '#DC2626' : '#6B7280' }}>
                                {formatDuration(activeMinutes)}
                              </span>
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontSize: '13px' }}>
                              <div>
                                <p style={{ fontSize: '11px', color: '#9CA3AF', marginBottom: '2px' }}>Inicio</p>
                                <p style={{ fontWeight: 500, color: '#111827', margin: 0 }}>
                                  {format(new Date(log.startedAt), 'Pp', { locale: es })}
                                </p>
                              </div>
                              {log.endedAt && (
                                <div>
                                  <p style={{ fontSize: '11px', color: '#9CA3AF', marginBottom: '2px' }}>Fin</p>
                                  <p style={{ fontWeight: 500, color: '#111827', margin: 0 }}>
                                    {format(new Date(log.endedAt), 'Pp', { locale: es })}
                                  </p>
                                </div>
                              )}
                            </div>
                            {isActive && (
                              <button
                                onClick={() => {
                                  setSelectedDowntimeLog({
                                    id: log.id, startedAt: log.startedAt, endedAt: log.endedAt,
                                    workOrderId: log.workOrderId, machine: log.machine || failure.machine,
                                  });
                                  setReturnDialogOpen(true);
                                }}
                                style={{
                                  width: '100%', marginTop: '12px', height: '38px', borderRadius: '8px',
                                  border: 'none', background: '#059669', color: '#FFFFFF',
                                  fontSize: '13px', fontWeight: 600, cursor: 'pointer',
                                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                                  transition: 'all 120ms',
                                }}
                                onMouseEnter={e => { e.currentTarget.style.background = '#047857'; }}
                                onMouseLeave={e => { e.currentTarget.style.background = '#059669'; }}
                              >
                                <CheckCircle2 className="h-4 w-4" /> Confirmar Retorno a Producción
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* ═══ SOLUTIONS TAB ═══ */}
              {activeTab === 'solutions' && (
                <div>
                  {(failure.solutionsApplied?.length ?? 0) === 0 ? (
                    <div style={{ textAlign: 'center', padding: '40px 0' }}>
                      <CheckCircle2 className="h-8 w-8" style={{ color: '#D1D5DB', margin: '0 auto 8px' }} />
                      <p style={{ fontSize: '14px', color: '#9CA3AF' }}>Aún no se han aplicado soluciones</p>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      {failure.solutionsApplied?.map((sol, idx) => {
                        const toolsArr = parseJsonArr(sol.toolsUsed);
                        const partsArr = parseJsonArr(sol.sparePartsUsed);
                        const attachArr = parseJsonArr(sol.attachments);
                        const controlsArr = sol.controlInstances || [];
                        const outcomeStyle = OUTCOME_STYLE[sol.outcome || ''] || { bg: '#F3F4F6', text: '#6B7280', label: sol.outcome || '-' };

                        return (
                          <div key={sol.id} style={{
                            border: '1px solid #E4E4E8', borderRadius: '8px', padding: '16px',
                            borderLeft: '3px solid #059669',
                          }}>
                            {/* Header */}
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px', flexWrap: 'wrap', gap: '6px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                                <Chip bg="#ECFDF5" text="#059669" label={`Solución #${idx + 1}`} />
                                {sol.outcome && <Chip bg={outcomeStyle.bg} text={outcomeStyle.text} label={outcomeStyle.label} />}
                                {sol.fixType && <Chip bg="#F3F4F6" text="#6B7280" label={sol.fixType === 'DEFINITIVA' ? 'Definitiva' : 'Parche'} />}
                                {sol.repairAction && <Chip bg="#F3F4F6" text="#6B7280" label={sol.repairAction === 'CAMBIO' ? 'Cambio' : 'Reparación'} />}
                                {sol.closingMode === 'PROFESSIONAL' && <Chip bg="#F3F4F6" text="#6B7280" label="Profesional" />}
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                {sol.effectiveness && (
                                  <span style={{ display: 'flex', alignItems: 'center', gap: '2px', fontSize: '12px', color: '#6B7280' }}>
                                    <Star className="h-3 w-3" style={{ color: '#F59E0B', fill: '#F59E0B' }} /> {sol.effectiveness}/5
                                  </span>
                                )}
                                {sol.actualMinutes && (
                                  <span style={{ display: 'flex', alignItems: 'center', gap: '3px', fontSize: '12px', color: '#6B7280' }}>
                                    <Clock className="h-3 w-3" /> {formatDuration(sol.actualMinutes)}
                                  </span>
                                )}
                                <span style={{ fontSize: '12px', color: '#9CA3AF' }}>
                                  {format(new Date(sol.performedAt), "d MMM, HH:mm", { locale: es })}
                                </span>
                                {sol.workOrderId && (
                                  <button onClick={() => sol.workOrderId && handleGoToMaintenance(sol.workOrderId)}
                                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9CA3AF', padding: 0 }}>
                                    <ExternalLink className="h-3 w-3" />
                                  </button>
                                )}
                              </div>
                            </div>

                            {/* Content grid */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                              <div>
                                <p style={{ fontSize: '11px', color: '#9CA3AF', marginBottom: '2px' }}>Diagnóstico</p>
                                <p style={{ fontSize: '13px', color: '#111827', margin: 0 }}>{sol.diagnosis}</p>
                              </div>
                              <div>
                                <p style={{ fontSize: '11px', color: '#9CA3AF', marginBottom: '2px' }}>Solución aplicada</p>
                                <p style={{ fontSize: '13px', color: '#111827', margin: 0 }}>{sol.solution}</p>
                              </div>
                              {sol.confirmedCause && (
                                <div>
                                  <p style={{ fontSize: '11px', color: '#9CA3AF', marginBottom: '2px' }}>Causa confirmada</p>
                                  <p style={{ fontSize: '13px', color: '#111827', margin: 0 }}>{sol.confirmedCause}</p>
                                </div>
                              )}
                              {sol.notes && (
                                <div>
                                  <p style={{ fontSize: '11px', color: '#9CA3AF', marginBottom: '2px' }}>Notas</p>
                                  <p style={{ fontSize: '13px', color: '#6B7280', margin: 0 }}>{sol.notes}</p>
                                </div>
                              )}
                              {toolsArr.length > 0 && (
                                <div>
                                  <p style={{ fontSize: '11px', color: '#9CA3AF', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                    <Wrench className="h-3 w-3" /> Herramientas
                                  </p>
                                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                                    {toolsArr.map((t: any, i: number) => (
                                      <span key={i} style={{ fontSize: '12px', background: '#F3F4F6', borderRadius: '4px', padding: '2px 8px', color: '#374151' }}>
                                        {t.name}{t.quantity > 1 ? ` ×${t.quantity}` : ''}
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              )}
                              {partsArr.length > 0 && (
                                <div>
                                  <p style={{ fontSize: '11px', color: '#9CA3AF', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                    <Package className="h-3 w-3" /> Repuestos
                                  </p>
                                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                                    {partsArr.map((p: any, i: number) => (
                                      <span key={i} style={{ fontSize: '12px', background: '#F3F4F6', borderRadius: '4px', padding: '2px 8px', color: '#374151' }}>
                                        {p.name} ×{p.quantity}
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              )}
                              {(sol.finalComponent || sol.finalSubcomponent) && (
                                <div style={{ display: 'flex', gap: '16px' }}>
                                  {sol.finalComponent && (
                                    <div>
                                      <p style={{ fontSize: '11px', color: '#9CA3AF', marginBottom: '2px' }}>Componente</p>
                                      <p style={{ fontSize: '13px', color: '#111827', margin: 0 }}>{sol.finalComponent.name}</p>
                                    </div>
                                  )}
                                  {sol.finalSubcomponent && (
                                    <div>
                                      <p style={{ fontSize: '11px', color: '#9CA3AF', marginBottom: '2px' }}>Subcomponente</p>
                                      <p style={{ fontSize: '13px', color: '#111827', margin: 0 }}>{sol.finalSubcomponent.name}</p>
                                    </div>
                                  )}
                                </div>
                              )}
                              {attachArr.length > 0 && (
                                <div>
                                  <p style={{ fontSize: '11px', color: '#9CA3AF', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                    <Paperclip className="h-3 w-3" /> Adjuntos
                                  </p>
                                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                                    {attachArr.map((att: any, i: number) => (
                                      att.type === 'IMAGE' ? (
                                        <a key={i} href={att.url} target="_blank" rel="noopener noreferrer">
                                          <img src={att.url} alt={att.filename} style={{
                                            height: '64px', width: '64px', objectFit: 'cover', borderRadius: '6px',
                                            border: '1px solid #E4E4E8', transition: 'opacity 150ms',
                                          }} />
                                        </a>
                                      ) : (
                                        <a key={i} href={att.url} target="_blank" rel="noopener noreferrer"
                                          style={{ fontSize: '12px', color: '#2563EB', display: 'flex', alignItems: 'center', gap: '4px', background: '#F3F4F6', borderRadius: '4px', padding: '4px 8px', textDecoration: 'none' }}>
                                          <FileText className="h-3 w-3" /> {att.filename}
                                        </a>
                                      )
                                    ))}
                                  </div>
                                </div>
                              )}
                              {controlsArr.length > 0 && (
                                <div>
                                  <p style={{ fontSize: '11px', color: '#9CA3AF', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                    <ClipboardCheck className="h-3 w-3" /> Controles de seguimiento
                                  </p>
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                    {controlsArr.map(ctrl => {
                                      const ctrlColor = ctrl.status === 'COMPLETED' ? '#059669' : ctrl.status === 'PENDING' ? '#D97706' : '#9CA3AF';
                                      return (
                                        <div key={ctrl.id} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px' }}>
                                          <span style={{ color: '#9CA3AF', width: '16px', textAlign: 'right', flexShrink: 0 }}>{ctrl.order}.</span>
                                          <span style={{ flex: 1, color: ctrl.status === 'SKIPPED' ? '#9CA3AF' : '#374151', textDecoration: ctrl.status === 'SKIPPED' ? 'line-through' : 'none' }}>
                                            {ctrl.description}
                                          </span>
                                          {ctrl.scheduledAt && (
                                            <span style={{ color: '#9CA3AF', flexShrink: 0 }}>
                                              {format(new Date(ctrl.scheduledAt), "d MMM HH:mm", { locale: es })}
                                            </span>
                                          )}
                                          <span style={{
                                            fontSize: '10px', fontWeight: 600, padding: '1px 6px', borderRadius: '4px',
                                            border: `1px solid ${ctrlColor}30`, color: ctrlColor,
                                          }}>
                                            {ctrl.status === 'PENDING' ? 'Pendiente' : ctrl.status === 'WAITING' ? 'Esperando' : ctrl.status === 'COMPLETED' ? 'Completado' : ctrl.status}
                                          </span>
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>
                              )}
                              {/* Footer */}
                              <p style={{ fontSize: '12px', color: '#9CA3AF', paddingTop: '8px', borderTop: '1px solid #F3F4F6', margin: 0 }}>
                                Por {sol.performedBy?.name || 'Técnico'}
                              </p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* ═══ CHAT TAB ═══ */}
              {activeTab === 'comments' && (
                <div style={{ display: 'flex', flexDirection: 'column', height: '400px' }}>
                  {/* Messages */}
                  <div ref={chatScrollRef} style={{
                    flex: 1, minHeight: 0, overflowY: 'auto', padding: '16px 0',
                  }}>
                    {isLoadingComments ? (
                      <div style={{ display: 'flex', justifyContent: 'center', padding: '32px 0' }}>
                        <Loader2 className="h-6 w-6 animate-spin" style={{ color: '#9CA3AF' }} />
                      </div>
                    ) : comments.length === 0 ? (
                      <div style={{ textAlign: 'center', padding: '48px 0' }}>
                        <MessageSquare className="h-10 w-10" style={{ color: '#D1D5DB', margin: '0 auto 12px' }} />
                        <p style={{ fontSize: '14px', color: '#9CA3AF', margin: 0 }}>No hay comentarios aún</p>
                        <p style={{ fontSize: '12px', color: '#D1D5DB', margin: '4px 0 0' }}>Sé el primero en agregar un comentario</p>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        {comments.map(comment => {
                          const typeKey = comment.type || 'comment';
                          const cfg = COMMENT_TYPES[typeKey] || COMMENT_TYPES.comment;
                          const isOwn = currentUser?.id === comment.author?.id;
                          const isEditing = editingCommentId === comment.id;
                          const isDeleting = deletingCommentId === comment.id;
                          const isHovered = hoveredCommentId === comment.id;
                          const wasEdited = comment.updatedAt && new Date(comment.updatedAt).getTime() - new Date(comment.createdAt).getTime() > 1000;

                          return (
                            <div
                              key={comment.id}
                              style={{
                                display: 'flex', gap: '10px', padding: '8px 4px', borderRadius: '6px',
                                transition: 'background 120ms',
                                background: isHovered ? '#F9FAFB' : 'transparent',
                              }}
                              onMouseEnter={() => setHoveredCommentId(comment.id)}
                              onMouseLeave={() => setHoveredCommentId(null)}
                            >
                              {/* Avatar */}
                              <div style={{
                                height: '28px', width: '28px', borderRadius: '50%', background: '#F3F4F6',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontSize: '10px', fontWeight: 700, color: '#6B7280', flexShrink: 0, marginTop: '2px',
                              }}>
                                {comment.author?.name ? getInitials(comment.author.name) : '??'}
                              </div>
                              {/* Content */}
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2px' }}>
                                  <span style={{ fontSize: '12px', fontWeight: 600, color: '#111827' }}>
                                    {comment.author?.name || 'Usuario'}
                                  </span>
                                  <span style={{
                                    fontSize: '10px', fontWeight: 500, padding: '1px 6px', borderRadius: '4px',
                                    background: cfg.bg, color: cfg.color,
                                  }}>
                                    {cfg.label}
                                  </span>
                                  <span style={{ fontSize: '11px', color: '#D1D5DB' }}>
                                    {formatDistanceToNow(new Date(comment.createdAt), { addSuffix: true, locale: es })}
                                  </span>
                                  {wasEdited && (
                                    <span style={{ fontSize: '10px', color: '#D1D5DB', fontStyle: 'italic' }}>(editado)</span>
                                  )}
                                </div>

                                {isEditing ? (
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '4px' }}>
                                    <textarea
                                      value={editingContent}
                                      onChange={e => setEditingContent(e.target.value)}
                                      onKeyDown={e => {
                                        if (e.key === 'Enter' && !e.shiftKey) {
                                          e.preventDefault();
                                          if (editingContent.trim()) editCommentMutation.mutate({ commentId: comment.id, content: editingContent.trim() });
                                        }
                                        if (e.key === 'Escape') setEditingCommentId(null);
                                      }}
                                      rows={2}
                                      autoFocus
                                      style={{
                                        fontSize: '13px', padding: '8px', borderRadius: '6px',
                                        border: '1px solid #E4E4E8', outline: 'none', fontFamily: 'inherit',
                                        resize: 'vertical', color: '#111827',
                                      }}
                                    />
                                    <div style={{ display: 'flex', gap: '6px' }}>
                                      <button
                                        disabled={editCommentMutation.isPending || !editingContent.trim()}
                                        onClick={() => editCommentMutation.mutate({ commentId: comment.id, content: editingContent.trim() })}
                                        style={{
                                          height: '26px', padding: '0 10px', borderRadius: '5px', fontSize: '11px', fontWeight: 600,
                                          border: 'none', background: '#111827', color: '#FFFFFF', cursor: 'pointer',
                                          display: 'flex', alignItems: 'center', gap: '4px',
                                        }}
                                      >
                                        {editCommentMutation.isPending && <Loader2 className="h-3 w-3 animate-spin" />}
                                        Guardar
                                      </button>
                                      <button
                                        onClick={() => setEditingCommentId(null)}
                                        style={{
                                          height: '26px', padding: '0 10px', borderRadius: '5px', fontSize: '11px', fontWeight: 500,
                                          border: '1px solid #E4E4E8', background: '#FFFFFF', color: '#6B7280', cursor: 'pointer',
                                        }}
                                      >
                                        Cancelar
                                      </button>
                                    </div>
                                  </div>
                                ) : isDeleting ? (
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
                                    <span style={{ fontSize: '12px', color: '#6B7280' }}>¿Eliminar este comentario?</span>
                                    <button
                                      onClick={() => { deleteCommentMutation.mutate(comment.id); setDeletingCommentId(null); }}
                                      style={{
                                        height: '24px', padding: '0 8px', borderRadius: '5px', fontSize: '11px', fontWeight: 600,
                                        border: 'none', background: '#FEE2E2', color: '#DC2626', cursor: 'pointer',
                                      }}
                                    >
                                      Sí
                                    </button>
                                    <button
                                      onClick={() => setDeletingCommentId(null)}
                                      style={{
                                        height: '24px', padding: '0 8px', borderRadius: '5px', fontSize: '11px', fontWeight: 500,
                                        border: '1px solid #E4E4E8', background: '#FFFFFF', color: '#6B7280', cursor: 'pointer',
                                      }}
                                    >
                                      No
                                    </button>
                                  </div>
                                ) : (
                                  <p style={{ fontSize: '13px', color: '#374151', margin: 0, whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>
                                    {comment.content}
                                  </p>
                                )}
                              </div>

                              {/* Hover actions */}
                              {isOwn && !isEditing && !isDeleting && (
                                <div style={{
                                  display: 'flex', gap: '2px', opacity: isHovered ? 1 : 0,
                                  transition: 'opacity 120ms', flexShrink: 0,
                                }}>
                                  <button
                                    onClick={() => { setEditingCommentId(comment.id); setEditingContent(comment.content); }}
                                    title="Editar"
                                    style={{
                                      height: '24px', width: '24px', borderRadius: '4px', border: 'none',
                                      background: 'transparent', color: '#9CA3AF', cursor: 'pointer',
                                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    }}
                                    onMouseEnter={e => { e.currentTarget.style.background = '#F3F4F6'; e.currentTarget.style.color = '#6B7280'; }}
                                    onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#9CA3AF'; }}
                                  >
                                    <Pencil className="h-3 w-3" />
                                  </button>
                                  <button
                                    onClick={() => setDeletingCommentId(comment.id)}
                                    title="Eliminar"
                                    style={{
                                      height: '24px', width: '24px', borderRadius: '4px', border: 'none',
                                      background: 'transparent', color: '#9CA3AF', cursor: 'pointer',
                                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    }}
                                    onMouseEnter={e => { e.currentTarget.style.background = '#FEE2E2'; e.currentTarget.style.color = '#DC2626'; }}
                                    onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#9CA3AF'; }}
                                  >
                                    <Trash2 className="h-3 w-3" />
                                  </button>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Composer */}
                  <div style={{ flexShrink: 0, borderTop: '1px solid #E4E4E8', paddingTop: '12px', position: 'relative' }}>
                    {/* @Mention dropdown */}
                    {mentionQuery !== null && filteredMentions.length > 0 && (
                      <div style={{
                        position: 'absolute', bottom: '100%', left: 0, marginBottom: '4px', zIndex: 50,
                        background: '#FFFFFF', border: '1px solid #E4E4E8', borderRadius: '8px',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.08)', minWidth: '200px', overflow: 'hidden',
                      }}>
                        {filteredMentions.map(user => (
                          <button
                            key={user.id}
                            onMouseDown={e => { e.preventDefault(); handleSelectMention(user); }}
                            style={{
                              display: 'flex', alignItems: 'center', gap: '8px', width: '100%',
                              padding: '6px 12px', border: 'none', background: 'transparent',
                              cursor: 'pointer', fontSize: '13px', color: '#111827', textAlign: 'left',
                            }}
                            onMouseEnter={e => { e.currentTarget.style.background = '#F3F4F6'; }}
                            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                          >
                            <div style={{
                              height: '24px', width: '24px', borderRadius: '50%', background: '#F3F4F6',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              fontSize: '9px', fontWeight: 700, color: '#6B7280', flexShrink: 0,
                            }}>
                              {getInitials(user.name)}
                            </div>
                            {user.name}
                          </button>
                        ))}
                      </div>
                    )}

                    {/* Type chips */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
                      <div style={{ display: 'flex', gap: '2px', border: '1px solid #E4E4E8', borderRadius: '6px', overflow: 'hidden' }}>
                        {(['comment', 'update', 'issue'] as const).map(type => {
                          const cfg = COMMENT_TYPES[type];
                          const isActive = commentType === type;
                          return (
                            <button
                              key={type}
                              onClick={() => setCommentType(type)}
                              style={{
                                padding: '3px 8px', fontSize: '11px', fontWeight: 500,
                                background: isActive ? cfg.bg : '#FFFFFF', color: isActive ? cfg.color : '#9CA3AF',
                                border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '3px',
                                transition: 'all 120ms',
                              }}
                            >
                              {type === 'comment' && <MessageSquare className="h-3 w-3" />}
                              {type === 'update' && <Info className="h-3 w-3" />}
                              {type === 'issue' && <AlertTriangle className="h-3 w-3" />}
                              {cfg.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Input area */}
                    <div style={{
                      display: 'flex', gap: '8px', alignItems: 'flex-end',
                      border: '1px solid #E4E4E8', borderRadius: '8px', padding: '8px',
                      transition: 'box-shadow 120ms',
                    }}>
                      <textarea
                        ref={chatTextareaRef}
                        placeholder="Escribe un comentario... @ para mencionar"
                        value={chatMessage}
                        onChange={handleChatInputChange}
                        onKeyDown={handleKeyDown}
                        disabled={sendCommentMutation.isPending}
                        rows={1}
                        style={{
                          flex: 1, minHeight: '36px', maxHeight: '120px', resize: 'none',
                          fontSize: '13px', padding: '4px 0', border: 'none', outline: 'none',
                          fontFamily: 'inherit', color: '#111827', background: 'transparent',
                        }}
                      />
                      <button
                        onClick={handleSendComment}
                        disabled={!chatMessage.trim() || sendCommentMutation.isPending}
                        style={{
                          height: '28px', width: '28px', borderRadius: '6px', flexShrink: 0,
                          border: 'none', background: '#111827', color: '#FFFFFF',
                          cursor: chatMessage.trim() ? 'pointer' : 'not-allowed',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          opacity: chatMessage.trim() ? 1 : 0.4, transition: 'all 120ms',
                        }}
                      >
                        {sendCommentMutation.isPending ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                      </button>
                    </div>
                    <p style={{ fontSize: '11px', color: '#D1D5DB', margin: '4px 0 0 4px' }}>
                      Cmd+Enter para enviar
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* ── ACTION BAR ── */}
            {failure.status !== 'RESOLVED' && failure.status !== 'RESOLVED_IMMEDIATE' && (
              <div style={{
                borderTop: '1px solid #E4E4E8', padding: '16px 24px', flexShrink: 0,
                display: 'flex', gap: '8px',
              }}>
                <button
                  onClick={() => setImmediateCloseOpen(true)}
                  style={{
                    flex: 1, height: '38px', borderRadius: '8px',
                    border: '1.5px solid #059669', background: '#ECFDF5', color: '#059669',
                    fontSize: '13px', fontWeight: 600, cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                    transition: 'all 120ms ease',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = '#D1FAE5'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = '#ECFDF5'; }}
                >
                  <CheckCircle2 className="h-4 w-4" /> Resolver Ahora
                </button>
                {hasWorkOrder ? (
                  <button
                    onClick={() => handleGoToWorkOrder(failure.workOrders![0].id)}
                    style={{
                      flex: 1, height: '38px', borderRadius: '8px',
                      border: 'none', background: '#111827', color: '#FFFFFF',
                      fontSize: '13px', fontWeight: 600, cursor: 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                      transition: 'all 120ms ease',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.background = '#1F2937'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = '#111827'; }}
                  >
                    <ExternalLink className="h-4 w-4" /> Ver OT
                  </button>
                ) : (
                  <button
                    onClick={handleCreateWorkOrder}
                    style={{
                      flex: 1, height: '38px', borderRadius: '8px',
                      border: 'none', background: '#111827', color: '#FFFFFF',
                      fontSize: '13px', fontWeight: 600, cursor: 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                      transition: 'all 120ms ease',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.background = '#1F2937'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = '#111827'; }}
                  >
                    <FileText className="h-4 w-4" /> Crear OT
                  </button>
                )}
              </div>
            )}
          </>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '200px' }}>
            <p style={{ fontSize: '14px', color: '#9CA3AF' }}>Falla no encontrada</p>
          </div>
        )}
      </div>
    </div>

    {/* Dialogs */}
    {selectedDowntimeLog && failureId && (
      <ReturnToProductionDialog
        open={returnDialogOpen}
        onOpenChange={open => { setReturnDialogOpen(open); if (!open) setSelectedDowntimeLog(null); }}
        downtimeLog={selectedDowntimeLog}
        failureId={failureId}
      />
    )}
    {failureId && failure && (
      <ImmediateCloseDialog
        open={immediateCloseOpen}
        onOpenChange={setImmediateCloseOpen}
        failureId={failureId}
        failureTitle={failure.title}
        hasActiveDowntime={failure.downtimeLogs?.some(d => !d.endedAt) || false}
        onSuccess={() => onOpenChange(false)}
      />
    )}
    {failureId && failure && (
      <ReopenFailureDialog
        open={reopenDialogOpen}
        onOpenChange={setReopenDialogOpen}
        failureId={failureId}
        failureTitle={failure.title}
        onSuccess={() => onOpenChange(false)}
      />
    )}

    {/* Lightbox */}
    {lightboxPhoto && (
      <div
        onClick={() => setLightboxPhoto(null)}
        style={{
          position: 'fixed', inset: 0, zIndex: 100,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'rgba(0,0,0,0.80)', cursor: 'zoom-out',
        }}
      >
        <button
          onClick={() => setLightboxPhoto(null)}
          style={{
            position: 'absolute', top: '16px', right: '16px',
            background: 'none', border: 'none', color: 'rgba(255,255,255,0.8)',
            cursor: 'pointer', padding: '4px',
          }}
        >
          <X className="h-6 w-6" />
        </button>
        <img
          src={lightboxPhoto}
          alt="Foto ampliada"
          onClick={e => e.stopPropagation()}
          style={{ maxHeight: '90vh', maxWidth: '90vw', objectFit: 'contain', borderRadius: '8px' }}
        />
      </div>
    )}
    </>
  );
}
