'use client';

import { useState, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
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
} from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { formatDistanceToNow, format, differenceInMinutes } from 'date-fns';
import { es } from 'date-fns/locale';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { Input } from '@/components/ui/input';
import dynamic from 'next/dynamic';

const ReturnToProductionDialog = dynamic(() => import('./ReturnToProductionDialog').then(m => ({ default: m.ReturnToProductionDialog })), { ssr: false });
const ImmediateCloseDialog = dynamic(() => import('./ImmediateCloseDialog').then(m => ({ default: m.ImmediateCloseDialog })), { ssr: false });
const RecurrencePanel = dynamic(() => import('./RecurrencePanel').then(m => ({ default: m.RecurrencePanel })), { ssr: false });
const ReopenFailureDialog = dynamic(() => import('./ReopenFailureDialog').then(m => ({ default: m.ReopenFailureDialog })), { ssr: false });

interface Comment {
  id: number;
  content: string;
  type?: string;
  createdAt: string;
  author?: {
    id: number;
    name: string;
    email?: string;
  };
}

interface FailureDetailSheetProps {
  failureId: number | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Tab to open by default (info, recurrence, duplicates, downtime, solutions, comments) */
  initialTab?: string;
  /** Navigate to another failure (e.g. from recurrence panel) */
  onSelectFailure?: (id: number) => void;
}

interface FailureDetail {
  id: number;
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
  // Síntomas expandidos
  symptomsList?: Array<{ id: number; label: string }>;
  // Fotos adjuntas
  photos?: Array<{ url: string; uploadedAt?: string }>;
  machine?: {
    id: number;
    name: string;
  };
  component?: {
    id: number;
    name: string;
  };
  subcomponent?: {
    id: number;
    name: string;
  };
  // Múltiples componentes/subcomponentes
  components?: Array<{ id: number; name: string }>;
  subcomponents?: Array<{ id: number; name: string }>;
  reportedBy?: {
    id: number;
    name: string;
  };
  workOrders?: Array<{
    id: number;
    status: string;
    title: string;
  }>;
  downtimeLogs?: Array<{
    id: number;
    startedAt: string;
    endedAt?: string | null;
    totalMinutes?: number;
    workOrderId?: number | null;
    machine?: {
      id: number;
      name: string;
    };
  }>;
  linkedDuplicates?: Array<{
    id: number;
    reportedAt: string;
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
    toolsUsed?: Array<{ id: number; name: string; quantity?: number }> | null;
    sparePartsUsed?: Array<{ id: number; name: string; quantity: number }> | null;
    attachments?: Array<{ url: string; type: string; filename: string }> | null;
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
  incidentType?: string;
  failureCategory?: string;
  correctedAt?: string;
  originalReport?: {
    title?: string;
    description?: string;
    machineId?: number;
    subcomponentId?: number;
    failureCategory?: string;
    incidentType?: string;
  } | null;
}

/** Safely parse a JSON field that may come back as string or already-parsed object/array */
function parseJsonArr<T>(field: T[] | string | null | undefined): T[] {
  if (!field) return [];
  if (Array.isArray(field)) return field;
  if (typeof field === 'string') {
    try { const parsed = JSON.parse(field); return Array.isArray(parsed) ? parsed : []; } catch { return []; }
  }
  return [];
}

const priorityColors: Record<string, string> = {
  P1: 'bg-destructive',
  P2: 'bg-warning',
  P3: 'bg-blue-500',
  P4: 'bg-info',
  URGENT: 'bg-destructive',
  HIGH: 'bg-warning',
  MEDIUM: 'bg-blue-500',
  LOW: 'bg-info',
};

const statusLabels: Record<string, string> = {
  REPORTED: 'Reportada',
  IN_PROGRESS: 'En Progreso',
  RESOLVED: 'Solucionada',
  RESOLVED_IMMEDIATE: 'Solucionada',
  CLOSED: 'Cerrada',
};

const statusColors: Record<string, string> = {
  REPORTED: 'bg-warning-muted text-warning-muted-foreground',
  IN_PROGRESS: 'bg-info-muted text-info-muted-foreground',
  RESOLVED: 'bg-success-muted text-success',
  RESOLVED_IMMEDIATE: 'bg-success-muted text-success',
  CLOSED: 'bg-muted text-foreground',
};

const commentTypeConfig: Record<string, { label: string; icon: typeof MessageSquare; badgeClass: string }> = {
  comment: {
    label: 'Comentario',
    icon: MessageSquare,
    badgeClass: 'bg-muted text-muted-foreground border-border',
  },
  update: {
    label: 'Actualización',
    icon: Info,
    badgeClass: 'bg-success-muted text-success border-success-muted',
  },
  issue: {
    label: 'Problema',
    icon: AlertTriangle,
    badgeClass: 'bg-destructive/10 text-destructive border-destructive/20',
  },
  system: {
    label: 'Sistema',
    icon: Info,
    badgeClass: 'bg-info-muted text-info-muted-foreground border-info-muted',
  },
};

const STATUS_CHIP_COLORS: Record<string, { bg: string; text: string; dot: string }> = {
  REPORTED: { bg: '#F3F4F6', text: '#6B7280', dot: '#9CA3AF' },
  OPEN: { bg: '#EFF6FF', text: '#1D4ED8', dot: '#3B82F6' },
  IN_PROGRESS: { bg: '#111827', text: '#FFFFFF', dot: '#FFFFFF' },
  RESOLVED: { bg: '#ECFDF5', text: '#059669', dot: '#059669' },
  RESOLVED_IMMEDIATE: { bg: '#ECFDF5', text: '#059669', dot: '#059669' },
  CANCELLED: { bg: '#FEE2E2', text: '#DC2626', dot: '#DC2626' },
  CLOSED: { bg: '#F3F4F6', text: '#6B7280', dot: '#6B7280' },
};

const PRIORITY_CHIP_COLORS: Record<string, { bg: string; text: string }> = {
  P1: { bg: '#FEE2E2', text: '#DC2626' },
  P2: { bg: '#FEF3C7', text: '#D97706' },
  P3: { bg: '#EFF6FF', text: '#1D4ED8' },
  P4: { bg: '#F3F4F6', text: '#6B7280' },
  URGENT: { bg: '#FEE2E2', text: '#DC2626' },
  HIGH: { bg: '#FEF3C7', text: '#D97706' },
  MEDIUM: { bg: '#EFF6FF', text: '#1D4ED8' },
  LOW: { bg: '#F3F4F6', text: '#6B7280' },
};

/**
 * Sheet de detalle de falla con tabs
 */
export function FailureDetailSheet({
  failureId,
  open,
  onOpenChange,
  initialTab,
  onSelectFailure,
}: FailureDetailSheetProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [chatMessage, setChatMessage] = useState('');
  const [commentType, setCommentType] = useState<'comment' | 'update' | 'issue'>('comment');
  const chatScrollRef = useRef<HTMLDivElement>(null);
  const [returnDialogOpen, setReturnDialogOpen] = useState(false);
  const [immediateCloseOpen, setImmediateCloseOpen] = useState(false);
  const [reopenDialogOpen, setReopenDialogOpen] = useState(false);
  const [activeTab, setActiveTab] = useState(initialTab || 'info');
  const [openAnim, setOpenAnim] = useState(false);
  const prevOpenRef = useRef(false);

  // Update active tab when initialTab changes (e.g., from URL)
  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab]);

  // Trigger unfold animation when panel opens
  useEffect(() => {
    if (open && !prevOpenRef.current) {
      setOpenAnim(true);
      const t = setTimeout(() => setOpenAnim(false), 1100);
      prevOpenRef.current = true;
      return () => clearTimeout(t);
    }
    if (!open) prevOpenRef.current = false;
  }, [open]);

  // Close on ESC
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onOpenChange(false); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, onOpenChange]);

  const [lightboxPhoto, setLightboxPhoto] = useState<string | null>(null);

  const [selectedDowntimeLog, setSelectedDowntimeLog] = useState<{
    id: number;
    startedAt: string;
    endedAt?: string | null;
    workOrderId?: number | null;
    machine?: { id: number; name: string };
  } | null>(null);

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

  // Query para comentarios
  const { data: commentsData, isLoading: isLoadingComments } = useQuery<{
    data: Comment[];
    count: number;
  }>({
    queryKey: ['failure-comments', failureId],
    queryFn: async () => {
      if (!failureId) throw new Error('No failure ID');
      const res = await fetch(`/api/failure-occurrences/${failureId}/comments`);
      if (!res.ok) throw new Error('Error al cargar comentarios');
      return res.json();
    },
    enabled: !!failureId && open,
    refetchInterval: 30000, // Refrescar cada 30 segundos
  });

  const comments = commentsData?.data || [];

  // Query para watchers
  const { data: watchersData } = useQuery<{
    isWatching: boolean;
    count: number;
    watchers: Array<{ id: number; user: { id: number; name: string } }>;
  }>({
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

  // Mutation para watch/unwatch
  const watchMutation = useMutation({
    mutationFn: async (action: 'watch' | 'unwatch') => {
      const res = await fetch(`/api/failure-occurrences/${failureId}/watchers`, {
        method: action === 'watch' ? 'POST' : 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Error');
      }
      return res.json();
    },
    onSuccess: (_, action) => {
      toast.success(action === 'watch' ? 'Siguiendo falla' : 'Dejaste de seguir');
      queryClient.invalidateQueries({ queryKey: ['failure-watchers', failureId] });
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  // Mutation para enviar comentario
  const sendCommentMutation = useMutation({
    mutationFn: async ({ content, type }: { content: string; type: 'comment' | 'update' | 'issue' }) => {
      const res = await fetch(`/api/failure-occurrences/${failureId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content, type }),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Error al enviar comentario');
      }
      return res.json();
    },
    onSuccess: () => {
      setChatMessage('');
      setCommentType('comment');
      queryClient.invalidateQueries({ queryKey: ['failure-comments', failureId] });
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  // Edit/delete comment state
  const [editingCommentId, setEditingCommentId] = useState<number | null>(null);
  const [editingContent, setEditingContent] = useState('');
  const { user: currentUser } = useAuth();

  // Mutation para editar comentario
  const editCommentMutation = useMutation({
    mutationFn: async ({ commentId, content }: { commentId: number; content: string }) => {
      const res = await fetch(`/api/failure-occurrences/${failureId}/comments`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ commentId, content }),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Error al editar');
      }
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

  // Mutation para eliminar comentario
  const deleteCommentMutation = useMutation({
    mutationFn: async (commentId: number) => {
      const res = await fetch(`/api/failure-occurrences/${failureId}/comments`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ commentId }),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Error al eliminar');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['failure-comments', failureId] });
      toast.success('Comentario eliminado');
    },
    onError: (error: Error) => toast.error(error.message),
  });

  // Scroll al fondo cuando hay nuevos comentarios
  useEffect(() => {
    if (chatScrollRef.current && comments.length > 0) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [comments.length]);

  const handleSendComment = () => {
    if (!chatMessage.trim()) return;
    sendCommentMutation.mutate({ content: chatMessage.trim(), type: commentType });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendComment();
    }
  };

  // Obtener iniciales del nombre
  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  // Navegar a la orden de trabajo existente
  const handleGoToWorkOrder = (woId: number) => {
    onOpenChange(false);
    router.push(`/mantenimiento/ordenes?workOrderId=${woId}`);
  };

  // Navegar al mantenimiento correctivo (para soluciones)
  const handleGoToMaintenance = (woId: number) => {
    onOpenChange(false);
    router.push(`/mantenimiento/mantenimientos?correctiveId=${woId}`);
  };

  // Navegar a crear nueva OT (si no existe)
  const handleCreateWorkOrder = () => {
    onOpenChange(false);
    router.push(`/mantenimiento/ordenes?newFromFailure=${failureId}`);
  };

  const hasWorkOrder = (failure?.workOrders?.length ?? 0) > 0;

  const sChip = STATUS_CHIP_COLORS[failure?.status || ''] || STATUS_CHIP_COLORS.REPORTED;
  const pChip = PRIORITY_CHIP_COLORS[failure?.priority || ''] || PRIORITY_CHIP_COLORS.P3;

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
      .failure-detail-scroll { scrollbar-width: none; -ms-overflow-style: none; overflow-y: auto; height: 100%; flex: 1; min-height: 0; }
      .failure-detail-scroll::-webkit-scrollbar { display: none; }
    `}</style>

    {/* Backdrop */}
    {open && (
      <div
        onClick={() => onOpenChange(false)}
        style={{
          position: 'fixed', inset: 0, zIndex: 50,
          background: 'rgba(0,0,0,0.40)',
          backdropFilter: 'blur(6px)',
          WebkitBackdropFilter: 'blur(6px)',
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
        alignItems: 'center', justifyContent: 'center',
        padding: '16px',
      }}
    >
      {/* Modal box */}
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: '1020px',
          maxWidth: '95vw',
          height: '920px',
          maxHeight: '96vh',
          background: '#FFFFFF',
          border: '1.5px solid #D8D8DE',
          borderRadius: '10px',
          boxShadow: '0 4px 32px rgba(0,0,0,.12), 0 1px 4px rgba(0,0,0,.06)',
          display: 'flex', flexDirection: 'column',
          overflow: 'hidden',
          transformOrigin: 'center center',
          animation: openAnim ? 'failure-modal-unfold 950ms cubic-bezier(.22,1,.36,1) both' : undefined,
        }}
      >
        {isLoading ? (
            <div style={{ padding: '24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                <Skeleton className="h-6 w-20 rounded-md" />
                <Skeleton className="h-6 w-16 rounded-md" />
              </div>
              <Skeleton className="h-7 w-3/4 rounded-md mb-3" />
              <div style={{ display: 'flex', gap: '8px', marginBottom: '24px' }}>
                <Skeleton className="h-5 w-24 rounded" />
                <Skeleton className="h-5 w-20 rounded" />
                <Skeleton className="h-5 w-16 rounded" />
              </div>
              <Skeleton className="h-10 w-full rounded-lg mb-4" />
              <Skeleton className="h-48 w-full rounded-lg mb-3" />
              <Skeleton className="h-32 w-full rounded-lg" />
            </div>
          ) : failure ? (
            <>
              {/* ── Header ── */}
              <div style={{
                padding: '18px 24px',
                borderBottom: '1px solid #E4E4E8',
                flexShrink: 0,
                animation: openAnim ? 'failure-content-reveal 420ms cubic-bezier(.22,1,.36,1) 320ms both' : undefined,
              }}>
                {/* Top row: status chip + badges + actions */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '12px' }}>
                  {/* Status chip */}
                  <span style={{
                    display: 'inline-flex', alignItems: 'center', gap: '4px',
                    fontSize: '11px', fontWeight: 600,
                    padding: '2px 10px', borderRadius: '6px',
                    background: sChip.bg, color: sChip.text,
                  }}>
                    <span style={{ height: '5px', width: '5px', borderRadius: '50%', background: sChip.dot }} />
                    {statusLabels[failure.status] || failure.status}
                  </span>
                  {/* Priority chip */}
                  <span style={{
                    fontSize: '11px', fontWeight: 600,
                    padding: '2px 10px', borderRadius: '6px',
                    background: pChip.bg, color: pChip.text,
                  }}>
                    {failure.priority}
                  </span>
                  {/* Type badge */}
                  <span style={{
                    fontSize: '11px', fontWeight: 600,
                    padding: '2px 10px', borderRadius: '6px',
                    background: failure.incidentType === 'ROTURA' ? '#FEE2E2' : '#F4F4F6',
                    color: failure.incidentType === 'ROTURA' ? '#DC2626' : '#6B7280',
                  }}>
                    {failure.incidentType === 'ROTURA' ? 'Rotura' : 'Falla'} #{failure.id}
                  </span>
                  {failure.causedDowntime && (
                    <span style={{
                      display: 'inline-flex', alignItems: 'center', gap: '3px',
                      fontSize: '11px', fontWeight: 600,
                      padding: '2px 8px', borderRadius: '6px',
                      background: '#FEE2E2', color: '#DC2626',
                    }}>
                      <Clock className="h-3 w-3" /> Parada
                    </span>
                  )}
                  {failure.isIntermittent && (
                    <span style={{
                      fontSize: '11px', fontWeight: 600,
                      padding: '2px 8px', borderRadius: '6px',
                      background: '#FEF3C7', color: '#D97706',
                    }}>
                      Intermitente
                    </span>
                  )}
                  {failure.isSafetyRelated && (
                    <span style={{
                      display: 'inline-flex', alignItems: 'center', gap: '3px',
                      fontSize: '11px', fontWeight: 600,
                      padding: '2px 8px', borderRadius: '6px',
                      background: '#FEE2E2', color: '#DC2626',
                    }}>
                      <AlertTriangle className="h-3 w-3" /> Seguridad
                    </span>
                  )}

                  <div style={{ flex: 1 }} />

                  {/* Watch button */}
                  <button
                    onClick={() => watchMutation.mutate(isWatching ? 'unwatch' : 'watch')}
                    disabled={watchMutation.isPending}
                    style={{
                      height: '28px', padding: '0 10px',
                      borderRadius: '6px', border: '1px solid #E4E4E8',
                      background: isWatching ? '#F5F3FF' : '#FFFFFF',
                      color: isWatching ? '#7C3AED' : '#6B7280',
                      cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px',
                      fontSize: '12px', fontWeight: 500,
                      transition: 'all 120ms ease',
                    }}
                  >
                    {watchMutation.isPending ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : isWatching ? (
                      <><BellOff className="h-3 w-3" /> Siguiendo</>
                    ) : (
                      <><Bell className="h-3 w-3" /> Seguir</>
                    )}
                  </button>

                  {/* Menu */}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button style={{
                        height: '28px', width: '28px', borderRadius: '6px',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        background: 'transparent', border: 'none', color: '#9CA3AF', cursor: 'pointer',
                        transition: 'all 150ms',
                      }}
                        onMouseEnter={e => { e.currentTarget.style.background = '#F4F4F6'; e.currentTarget.style.color = '#6B7280'; }}
                        onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#9CA3AF'; }}
                      >
                        <MoreVertical className="h-3.5 w-3.5" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem className="text-xs gap-2" onClick={() => router.push(`/mantenimiento/incidentes/${failure.id}/editar`)}>
                        <Pencil className="h-3 w-3" /> Editar Falla
                      </DropdownMenuItem>
                      {(failure.status === 'RESOLVED' || failure.status === 'RESOLVED_IMMEDIATE') && (
                        <DropdownMenuItem className="text-xs gap-2" onClick={() => setReopenDialogOpen(true)}>
                          <RotateCcw className="h-3 w-3" /> Reabrir Falla
                        </DropdownMenuItem>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>

                  {/* Close button */}
                  <button
                    onClick={() => onOpenChange(false)}
                    style={{
                      height: '28px', width: '28px', borderRadius: '6px',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      background: 'transparent', border: 'none', color: '#9CA3AF', cursor: 'pointer',
                      transition: 'all 150ms',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.background = '#FEE2E2'; e.currentTarget.style.color = '#DC2626'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#9CA3AF'; }}
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>

                {/* Title */}
                <h2 style={{
                  fontSize: '22px', fontWeight: 700, color: '#111827',
                  letterSpacing: '-0.02em', lineHeight: 1.3,
                  marginBottom: '8px', margin: 0,
                }}>
                  {failure.title || 'Sin título'}
                </h2>

                {/* Meta row: machine + reporter + watchers + dates */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '10px', flexWrap: 'wrap' }}>
                  {failure.machine?.name && (
                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', color: '#6B7280' }}>
                      <span style={{ height: '20px', width: '20px', borderRadius: '6px', background: '#F3F4F6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <FileText className="h-3 w-3" style={{ color: '#9CA3AF' }} />
                      </span>
                      {failure.machine.name}
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
                          <div className="text-xs">
                            <p className="font-medium mb-1">Seguidores:</p>
                            {watchersList.map((w) => (
                              <p key={w.id}>{w.user.name}</p>
                            ))}
                          </div>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  )}
                  <span style={{ fontSize: '12px', color: '#D1D5DB' }}>
                    {format(new Date(failure.reportedAt), "d MMM yyyy · HH:mm", { locale: es })}
                  </span>
                </div>
              </div>

              {/* ── Tabs ── */}
              <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-col flex-1 min-h-0">
                <div style={{ padding: '0 24px', borderBottom: '1px solid #E4E4E8', flexShrink: 0 }}>
                  <TabsList className="w-full justify-start overflow-x-auto h-10 bg-transparent border-none p-0 gap-0">
                    {[
                      { value: 'info', label: 'Info' },
                      { value: 'recurrence', label: 'Reincidencia' },
                      { value: 'duplicates', label: 'Duplicados', count: failure.linkedDuplicates?.length },
                      { value: 'downtime', label: 'Paradas', hasActive: failure.downtimeLogs?.some(d => !d.endedAt) },
                      { value: 'solutions', label: 'Soluciones' },
                      { value: 'comments', label: 'Chat' },
                    ].map(tab => (
                      <TabsTrigger
                        key={tab.value}
                        value={tab.value}
                        className="relative px-4 py-2 text-xs font-medium data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:text-foreground rounded-none border-b-2 border-transparent data-[state=active]:border-[#111827]"
                      >
                        {tab.label}
                        {tab.count != null && tab.count > 0 && (
                          <span style={{
                            marginLeft: '4px', fontSize: '10px', fontWeight: 600,
                            padding: '1px 5px', borderRadius: '8px',
                            background: '#F3F4F6', color: '#6B7280',
                          }}>
                            {tab.count}
                          </span>
                        )}
                        {tab.hasActive && (
                          <span style={{
                            marginLeft: '4px', height: '6px', width: '6px',
                            borderRadius: '50%', background: '#DC2626',
                            display: 'inline-block',
                            animation: 'pulse 2s infinite',
                          }} />
                        )}
                      </TabsTrigger>
                    ))}
                  </TabsList>
                </div>

                <div className="failure-detail-scroll" style={{ padding: '0 24px' }}>
                {/* Tab: Información */}
                <TabsContent value="info" className="space-y-3 mt-4">
                  {/* Corrección: mostrar reporte original si fue corregido */}
                  {failure.originalReport && (
                    <div className="rounded-lg border border-orange-200 dark:border-orange-800 bg-orange-50 dark:bg-orange-950/40 p-3 space-y-2">
                      <div className="flex items-center gap-1.5">
                        <AlertTriangle className="h-3.5 w-3.5 text-orange-600 dark:text-orange-400 shrink-0" />
                        <p className="text-xs font-semibold text-orange-700 dark:text-orange-400">
                          Falla corregida al cierre
                        </p>
                      </div>
                      <p className="text-[10px] text-orange-600 dark:text-orange-500">
                        Lo que se pensaba inicialmente:
                      </p>
                      {failure.originalReport.title && (
                        <p className="text-xs font-medium text-orange-800 dark:text-orange-300 line-through decoration-orange-400">
                          {failure.originalReport.title}
                        </p>
                      )}
                      {failure.originalReport.description && (
                        <p className="text-xs text-orange-700 dark:text-orange-400 line-clamp-2">
                          {failure.originalReport.description}
                        </p>
                      )}
                      <div className="flex flex-wrap gap-2">
                        {failure.originalReport.incidentType && (
                          <span className="text-[10px] bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-400 rounded px-1.5 py-0.5">
                            {failure.originalReport.incidentType === 'ROTURA' ? 'Rotura' : 'Falla'}
                          </span>
                        )}
                        {failure.originalReport.failureCategory && (
                          <span className="text-[10px] bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-400 rounded px-1.5 py-0.5">
                            {failure.originalReport.failureCategory}
                          </span>
                        )}
                      </div>
                    </div>
                  )}

                  <div className="rounded-lg border p-4 space-y-3">
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Descripción</p>
                      <p className="text-sm">{failure.description || 'Sin descripción'}</p>
                    </div>

                    {/* Síntomas */}
                    {failure.symptomsList && failure.symptomsList.length > 0 && (
                      <div>
                        <p className="text-xs text-muted-foreground mb-2">Síntomas</p>
                        <div className="flex flex-wrap gap-1.5">
                          {failure.symptomsList.map((symptom) => (
                            <Badge
                              key={symptom.id}
                              variant="secondary"
                              className="bg-info-muted text-info-muted-foreground hover:bg-info-muted"
                            >
                              {symptom.label}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Fotos adjuntas + Upload */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-xs text-muted-foreground">
                          Fotos {failure.photos?.length ? `(${failure.photos.length})` : ''}
                        </p>
                        <label className="cursor-pointer">
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
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
                          <span className="text-xs text-primary hover:underline flex items-center gap-1">
                            <ImageIcon className="h-3 w-3" />
                            Agregar foto
                          </span>
                        </label>
                      </div>
                      {failure.photos && failure.photos.length > 0 ? (
                        <div className="flex flex-wrap gap-2">
                          {failure.photos.map((photo, idx) => (
                            <button
                              key={idx}
                              type="button"
                              onClick={() => setLightboxPhoto(photo.url)}
                              className="block rounded-lg border overflow-hidden hover:ring-2 hover:ring-primary transition-all cursor-zoom-in"
                            >
                              <img
                                src={photo.url}
                                alt={`Foto ${idx + 1}`}
                                className="h-20 w-20 object-cover"
                              />
                            </button>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-muted-foreground italic">Sin fotos</p>
                      )}
                    </div>
                  </div>

                  {/* Ubicación del equipo */}
                  <div className="rounded-lg border p-3 space-y-2">
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Máquina</p>
                      <p className="text-sm font-medium">{failure.machine?.name || '-'}</p>
                    </div>
                    {/* Componentes */}
                    {(failure.components?.length || failure.component) && (
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Componentes</p>
                        <p className="text-sm">
                          {failure.components?.length
                            ? failure.components.map(c => c.name).join(', ')
                            : failure.component?.name}
                        </p>
                      </div>
                    )}
                    {/* Subcomponentes */}
                    {(failure.subcomponents?.length || failure.subcomponent) && (
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Subcomponentes</p>
                        <p className="text-sm text-muted-foreground">
                          {failure.subcomponents?.length
                            ? failure.subcomponents.map(s => s.name).join(', ')
                            : failure.subcomponent?.name}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Info adicional */}
                  <div className="grid grid-cols-2 gap-2">
                    <div className="rounded-lg border p-3">
                      <p className="text-xs text-muted-foreground mb-1">Reportada por</p>
                      <p className="text-sm font-medium">{failure.reportedBy?.name || '-'}</p>
                    </div>
                    <div className="rounded-lg border p-3">
                      <p className="text-xs text-muted-foreground mb-1">Fecha</p>
                      <p className="text-sm font-medium">
                        {format(new Date(failure.reportedAt), "d MMM yyyy, HH:mm", { locale: es })}
                      </p>
                    </div>
                  </div>

                  {/* Work Orders asociadas */}
                  {hasWorkOrder && (
                    <div>
                      <p className="text-xs text-muted-foreground mb-2">
                        Órdenes de Trabajo ({failure.workOrders?.length})
                      </p>
                      <div className="space-y-2">
                        {failure.workOrders?.map((wo) => {
                          const statusLabels: Record<string, string> = {
                            PENDING: 'Pendiente',
                            IN_PROGRESS: 'En Progreso',
                            COMPLETED: 'Completada',
                            CANCELLED: 'Cancelada',
                            ON_HOLD: 'En Espera',
                          };
                          const statusLabel = statusLabels[wo.status] || wo.status;

                          return (
                            <div
                              key={wo.id}
                              className="rounded-lg border p-3 flex items-center justify-between hover:bg-accent/50 cursor-pointer transition-colors"
                              onClick={() => handleGoToWorkOrder(wo.id)}
                            >
                              <div>
                                <p className="text-sm font-medium">{wo.title}</p>
                                <p className="text-xs text-muted-foreground">OT #{wo.id}</p>
                              </div>
                              <div className="flex items-center gap-2">
                                <Badge variant={wo.status === 'COMPLETED' ? 'default' : 'secondary'}>
                                  {statusLabel}
                                </Badge>
                                <ExternalLink className="h-4 w-4 text-muted-foreground" />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </TabsContent>

                {/* Tab: Reincidencia */}
                <TabsContent value="recurrence" className="mt-4">
                  {failureId && <RecurrencePanel failureId={failureId} onSelectFailure={onSelectFailure} />}
                </TabsContent>

                {/* Tab: Duplicados */}
                <TabsContent value="duplicates" className="space-y-3 mt-4">
                  {(failure.linkedDuplicates?.length ?? 0) === 0 ? (
                    <div className="text-center py-8 bg-muted/20 rounded-lg border border-dashed">
                      <FileText className="mx-auto h-8 w-8 text-muted-foreground/50 mb-2" />
                      <p className="text-sm text-muted-foreground">
                        No hay reportes duplicados vinculados
                      </p>
                    </div>
                  ) : (
                    failure.linkedDuplicates?.map((dup, idx) => (
                      <div key={dup.id} className="rounded-lg border bg-muted/20 p-4">
                        <div className="flex items-center justify-between">
                          <div className="space-y-1">
                            <p className="text-sm font-medium">
                              Reporte #{idx + 1}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              Por {dup.reportedBy?.name || 'Usuario'} •{' '}
                              {format(
                                new Date(dup.reportedAt),
                                "d 'de' MMMM, HH:mm",
                                { locale: es }
                              )}
                            </p>
                          </div>
                          <Badge variant="outline">Duplicado</Badge>
                        </div>
                      </div>
                    ))
                  )}
                </TabsContent>

                {/* Tab: Paradas */}
                <TabsContent value="downtime" className="space-y-3 mt-4">
                  {(failure.downtimeLogs?.length ?? 0) === 0 ? (
                    <div className="text-center py-8 bg-muted/20 rounded-lg border border-dashed">
                      <Clock className="mx-auto h-8 w-8 text-muted-foreground/50 mb-2" />
                      <p className="text-sm text-muted-foreground">
                        Esta falla no causó paradas de producción
                      </p>
                    </div>
                  ) : (
                    failure.downtimeLogs?.map((log) => {
                      const isActive = !log.endedAt;
                      const activeMinutes = isActive
                        ? differenceInMinutes(new Date(), new Date(log.startedAt))
                        : log.totalMinutes || 0;
                      const hours = Math.floor(activeMinutes / 60);
                      const mins = activeMinutes % 60;
                      const timeDisplay = hours > 0 ? `${hours}h ${mins}m` : `${mins} min`;

                      return (
                        <div
                          key={log.id}
                          className={cn('rounded-lg border p-4', isActive ? 'border-destructive/50 bg-destructive/5' : 'bg-muted/20')}
                        >
                          <div className="flex items-center justify-between mb-3">
                            <Badge
                              variant={isActive ? 'destructive' : 'secondary'}
                              className={isActive ? 'animate-pulse' : ''}
                            >
                              {isActive ? (
                                <>
                                  <Clock className="mr-1 h-3 w-3" />
                                  Planta Parada
                                </>
                              ) : (
                                'Finalizada'
                              )}
                            </Badge>
                            <span className={cn('text-lg font-bold', isActive ? 'text-destructive' : 'text-muted-foreground')}>
                              {timeDisplay}
                            </span>
                          </div>
                          <div className="grid grid-cols-2 gap-3 text-sm">
                            <div>
                              <p className="text-xs text-muted-foreground">Inicio</p>
                              <p className="font-medium">
                                {format(new Date(log.startedAt), 'Pp', { locale: es })}
                              </p>
                            </div>
                            {log.endedAt && (
                              <div>
                                <p className="text-xs text-muted-foreground">Fin</p>
                                <p className="font-medium">
                                  {format(new Date(log.endedAt), 'Pp', { locale: es })}
                                </p>
                              </div>
                            )}
                          </div>

                          {/* Botón Retorno a Producción si está activo */}
                          {isActive && (
                            <Button
                              className="w-full mt-4 bg-success hover:bg-success/90"
                              onClick={() => {
                                setSelectedDowntimeLog({
                                  id: log.id,
                                  startedAt: log.startedAt,
                                  endedAt: log.endedAt,
                                  workOrderId: log.workOrderId,
                                  machine: log.machine || failure.machine,
                                });
                                setReturnDialogOpen(true);
                              }}
                            >
                              <CheckCircle2 className="mr-2 h-4 w-4" />
                              Confirmar Retorno a Producción
                            </Button>
                          )}
                        </div>
                      );
                    })
                  )}
                </TabsContent>

                {/* Tab: Soluciones */}
                <TabsContent value="solutions" className="space-y-3 mt-4">
                  {(failure.solutionsApplied?.length ?? 0) === 0 ? (
                    <div className="text-center py-8 bg-muted/20 rounded-lg border border-dashed">
                      <CheckCircle2 className="mx-auto h-8 w-8 text-muted-foreground/50 mb-2" />
                      <p className="text-sm text-muted-foreground">
                        Aún no se han aplicado soluciones
                      </p>
                    </div>
                  ) : (
                    failure.solutionsApplied?.map((solution, idx) => {
                      const outcomeColors: Record<string, string> = {
                        'FUNCIONÓ': 'bg-success text-white',
                        'PARCIAL': 'bg-warning text-white',
                        'NO_FUNCIONÓ': 'bg-destructive text-white',
                      };
                      const outcomeLabels: Record<string, string> = {
                        'FUNCIONÓ': 'Funcionó',
                        'PARCIAL': 'Parcial',
                        'NO_FUNCIONÓ': 'No Funcionó',
                      };
                      const toolsArr = parseJsonArr(solution.toolsUsed);
                      const partsArr = parseJsonArr(solution.sparePartsUsed);
                      const attachArr = parseJsonArr(solution.attachments);
                      const controlsArr = solution.controlInstances || [];

                      return (
                        <div key={solution.id} className="rounded-lg border bg-card p-4 space-y-3">
                          {/* Header */}
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2 flex-wrap">
                              <Badge className="bg-success">Solución #{idx + 1}</Badge>
                              {solution.outcome && (
                                <Badge className={cn('text-xs', outcomeColors[solution.outcome] || 'bg-muted')}>
                                  {outcomeLabels[solution.outcome] || solution.outcome}
                                </Badge>
                              )}
                              {solution.fixType && (
                                <Badge variant="outline" className="text-xs">
                                  {solution.fixType === 'DEFINITIVA' ? 'Definitiva' : 'Parche'}
                                </Badge>
                              )}
                              {solution.repairAction && (
                                <Badge variant="outline" className="text-xs">
                                  {solution.repairAction === 'CAMBIO' ? 'Cambio' : 'Reparación'}
                                </Badge>
                              )}
                              {solution.closingMode === 'PROFESSIONAL' && (
                                <Badge variant="outline" className="text-xs text-muted-foreground">Profesional</Badge>
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              {solution.effectiveness && (
                                <span className="flex items-center gap-0.5 text-xs text-muted-foreground">
                                  <Star className="h-3 w-3 fill-warning text-warning" />
                                  {solution.effectiveness}/5
                                </span>
                              )}
                              {solution.actualMinutes && (
                                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                                  <Clock className="h-3 w-3" />
                                  {solution.actualMinutes >= 60
                                    ? `${Math.floor(solution.actualMinutes / 60)}h ${solution.actualMinutes % 60}m`
                                    : `${solution.actualMinutes}min`}
                                </span>
                              )}
                              <span className="text-xs text-muted-foreground">
                                {format(new Date(solution.performedAt), "d 'de' MMM, HH:mm", { locale: es })}
                              </span>
                              {solution.workOrderId && (
                                <button
                                  onClick={() => solution.workOrderId && handleGoToMaintenance(solution.workOrderId)}
                                  className="text-muted-foreground hover:text-foreground"
                                >
                                  <ExternalLink className="h-3 w-3" />
                                </button>
                              )}
                            </div>
                          </div>

                          {/* Diagnóstico */}
                          <div>
                            <p className="text-xs text-muted-foreground mb-1">Diagnóstico</p>
                            <p className="text-sm">{solution.diagnosis}</p>
                          </div>

                          {/* Solución */}
                          <div>
                            <p className="text-xs text-muted-foreground mb-1">Solución aplicada</p>
                            <p className="text-sm">{solution.solution}</p>
                          </div>

                          {/* Causa confirmada */}
                          {solution.confirmedCause && (
                            <div>
                              <p className="text-xs text-muted-foreground mb-1">Causa confirmada</p>
                              <p className="text-sm">{solution.confirmedCause}</p>
                            </div>
                          )}

                          {/* Notas */}
                          {solution.notes && (
                            <div>
                              <p className="text-xs text-muted-foreground mb-1">Notas adicionales</p>
                              <p className="text-sm text-muted-foreground">{solution.notes}</p>
                            </div>
                          )}

                          {/* Herramientas */}
                          {toolsArr.length > 0 && (
                            <div>
                              <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                                <Wrench className="h-3 w-3" /> Herramientas usadas
                              </p>
                              <div className="flex flex-wrap gap-1">
                                {toolsArr.map((t, i) => (
                                  <span key={i} className="text-xs bg-muted rounded px-2 py-0.5">
                                    {t.name}{t.quantity && t.quantity > 1 ? ` ×${t.quantity}` : ''}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Repuestos */}
                          {partsArr.length > 0 && (
                            <div>
                              <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                                <Package className="h-3 w-3" /> Repuestos usados
                              </p>
                              <div className="flex flex-wrap gap-1">
                                {partsArr.map((p, i) => (
                                  <span key={i} className="text-xs bg-muted rounded px-2 py-0.5">
                                    {p.name} ×{p.quantity}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Componente / Subcomponente */}
                          {(solution.finalComponent || solution.finalSubcomponent) && (
                            <div className="flex flex-wrap gap-4">
                              {solution.finalComponent && (
                                <div>
                                  <p className="text-xs text-muted-foreground mb-1">Componente</p>
                                  <p className="text-sm">{solution.finalComponent.name}</p>
                                </div>
                              )}
                              {solution.finalSubcomponent && (
                                <div>
                                  <p className="text-xs text-muted-foreground mb-1">Subcomponente</p>
                                  <p className="text-sm">{solution.finalSubcomponent.name}</p>
                                </div>
                              )}
                            </div>
                          )}

                          {/* Archivos adjuntos */}
                          {attachArr.length > 0 && (
                            <div>
                              <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                                <Paperclip className="h-3 w-3" /> Archivos adjuntos
                              </p>
                              <div className="flex flex-wrap gap-2">
                                {attachArr.map((att, i) => (
                                  att.type === 'IMAGE' ? (
                                    <a key={i} href={att.url} target="_blank" rel="noopener noreferrer">
                                      <img
                                        src={att.url}
                                        alt={att.filename}
                                        className="h-16 w-16 object-cover rounded-md border hover:opacity-80 transition-opacity"
                                      />
                                    </a>
                                  ) : (
                                    <a
                                      key={i}
                                      href={att.url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="flex items-center gap-1 text-xs text-primary hover:underline bg-muted rounded px-2 py-1"
                                    >
                                      <FileText className="h-3 w-3" />
                                      {att.filename}
                                    </a>
                                  )
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Plan de controles */}
                          {controlsArr.length > 0 && (
                            <div>
                              <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                                <ClipboardCheck className="h-3 w-3" /> Controles de seguimiento
                              </p>
                              <div className="space-y-1">
                                {controlsArr.map((ctrl) => {
                                  const statusColors: Record<string, string> = {
                                    PENDING: 'text-warning',
                                    WAITING: 'text-muted-foreground',
                                    COMPLETED: 'text-success',
                                    SKIPPED: 'text-muted-foreground line-through',
                                  };
                                  return (
                                    <div key={ctrl.id} className="flex items-center gap-2 text-xs">
                                      <span className="text-muted-foreground w-4 text-right shrink-0">{ctrl.order}.</span>
                                      <span className={cn('flex-1', statusColors[ctrl.status] || '')}>
                                        {ctrl.description}
                                      </span>
                                      {ctrl.scheduledAt && (
                                        <span className="text-muted-foreground shrink-0">
                                          {format(new Date(ctrl.scheduledAt), "d MMM HH:mm", { locale: es })}
                                        </span>
                                      )}
                                      <Badge
                                        variant="outline"
                                        className={cn('text-[10px] px-1 py-0 h-4', statusColors[ctrl.status] || '')}
                                      >
                                        {ctrl.status === 'PENDING' ? 'Pendiente' : ctrl.status === 'WAITING' ? 'Esperando' : ctrl.status === 'COMPLETED' ? 'Completado' : ctrl.status}
                                      </Badge>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}

                          {/* Footer: técnico */}
                          <p className="text-xs text-muted-foreground pt-2 border-t">
                            Por {solution.performedBy?.name || 'Técnico'}
                          </p>
                        </div>
                      );
                    })
                  )}
                </TabsContent>

                {/* Tab: Chat/Comentarios */}
                <TabsContent value="comments" className="mt-4">
                  <div className="flex flex-col h-[400px]">
                    {/* Composer sticky */}
                    <div className="flex-shrink-0 border rounded-t-lg bg-card p-3 space-y-3">
                      <div className="flex items-center gap-2">
                        <Avatar className="h-8 w-8">
                          <AvatarFallback className="text-xs">U</AvatarFallback>
                        </Avatar>
                        <div className="flex-1">
                          <ToggleGroup
                            type="single"
                            value={commentType}
                            onValueChange={(value) => value && setCommentType(value as typeof commentType)}
                            className="border border-border rounded-md"
                          >
                            <ToggleGroupItem value="comment" aria-label="Comentario" className="h-8 px-3 text-xs">
                              <MessageSquare className="h-3 w-3 mr-1.5" />
                              Comentario
                            </ToggleGroupItem>
                            <ToggleGroupItem value="update" aria-label="Actualización" className="h-8 px-3 text-xs">
                              <Info className="h-3 w-3 mr-1.5" />
                              Actualización
                            </ToggleGroupItem>
                            <ToggleGroupItem value="issue" aria-label="Problema" className="h-8 px-3 text-xs">
                              <AlertTriangle className="h-3 w-3 mr-1.5" />
                              Problema
                            </ToggleGroupItem>
                          </ToggleGroup>
                        </div>
                      </div>

                      <div className="flex gap-2 items-end">
                        <Textarea
                          placeholder="Escribe un mensaje... (Enter para enviar)"
                          value={chatMessage}
                          onChange={(e) => setChatMessage(e.target.value)}
                          onKeyDown={handleKeyDown}
                          className="min-h-[40px] max-h-[120px] resize-none text-sm"
                          disabled={sendCommentMutation.isPending}
                          rows={1}
                        />
                        <Button
                          onClick={handleSendComment}
                          disabled={!chatMessage.trim() || sendCommentMutation.isPending}
                          size="icon"
                          className="h-10 w-10 shrink-0"
                        >
                          {sendCommentMutation.isPending ? (
                            <RefreshCw className="h-4 w-4 animate-spin" />
                          ) : (
                            <Send className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                    </div>

                    <Separator className="flex-shrink-0" />

                    {/* Timeline */}
                    <div className="flex-1 min-h-0 overflow-y-auto border border-t-0 rounded-b-lg" ref={chatScrollRef}>
                      <div className="p-3">
                        {isLoadingComments ? (
                          <div className="flex items-center justify-center py-8">
                            <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
                          </div>
                        ) : comments.length === 0 ? (
                          <div className="flex flex-col items-center justify-center py-12 text-center">
                            <MessageSquare className="h-10 w-10 text-muted-foreground mb-3" />
                            <p className="text-sm text-muted-foreground">No hay comentarios aún</p>
                            <p className="text-xs text-muted-foreground mt-1">
                              Sé el primero en agregar un comentario
                            </p>
                          </div>
                        ) : (
                          <div className="space-y-4">
                            {comments.map((comment) => {
                              const typeKey = comment.type || 'comment';
                              const config = commentTypeConfig[typeKey] || commentTypeConfig.comment;
                              const Icon = config.icon;

                              const isOwnComment = currentUser?.id === comment.author?.id;
                              const isEditing = editingCommentId === comment.id;

                              return (
                                <div key={comment.id} className="flex gap-3 group">
                                  <Avatar className="h-8 w-8 flex-shrink-0">
                                    <AvatarFallback className="text-xs">
                                      {comment.author?.name ? getInitials(comment.author.name) : '??'}
                                    </AvatarFallback>
                                  </Avatar>

                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-1">
                                      <span className="text-sm font-medium text-foreground">
                                        {comment.author?.name || 'Usuario'}
                                      </span>
                                      <Badge variant="outline" className={cn('text-xs border', config.badgeClass)}>
                                        <Icon className="h-3 w-3 mr-1" />
                                        {config.label}
                                      </Badge>
                                      <span className="text-xs text-muted-foreground ml-auto">
                                        {formatDistanceToNow(new Date(comment.createdAt), { addSuffix: true, locale: es })}
                                      </span>
                                      {isOwnComment && !isEditing && (
                                        <DropdownMenu>
                                          <DropdownMenuTrigger asChild>
                                            <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity">
                                              <MoreVertical className="h-3 w-3" />
                                            </Button>
                                          </DropdownMenuTrigger>
                                          <DropdownMenuContent align="end">
                                            <DropdownMenuItem onClick={() => { setEditingCommentId(comment.id); setEditingContent(comment.content); }}>
                                              <Pencil className="h-3.5 w-3.5 mr-2" />
                                              Editar
                                            </DropdownMenuItem>
                                            <DropdownMenuItem
                                              className="text-destructive focus:text-destructive"
                                              onClick={() => { if (confirm('¿Eliminar este comentario?')) deleteCommentMutation.mutate(comment.id); }}
                                            >
                                              <Trash2 className="h-3.5 w-3.5 mr-2" />
                                              Eliminar
                                            </DropdownMenuItem>
                                          </DropdownMenuContent>
                                        </DropdownMenu>
                                      )}
                                    </div>

                                    {isEditing ? (
                                      <div className="space-y-2">
                                        <Textarea
                                          value={editingContent}
                                          onChange={(e) => setEditingContent(e.target.value)}
                                          rows={2}
                                          className="text-sm"
                                        />
                                        <div className="flex gap-2">
                                          <Button
                                            size="sm"
                                            className="h-7 text-xs"
                                            disabled={editCommentMutation.isPending || !editingContent.trim()}
                                            onClick={() => editCommentMutation.mutate({ commentId: comment.id, content: editingContent.trim() })}
                                          >
                                            {editCommentMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}
                                            Guardar
                                          </Button>
                                          <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setEditingCommentId(null)}>
                                            Cancelar
                                          </Button>
                                        </div>
                                      </div>
                                    ) : (
                                      <p className="text-sm text-foreground whitespace-pre-wrap">
                                        {comment.content}
                                      </p>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </TabsContent>
                </div>
              </Tabs>

              {/* Actions - Solo mostrar para fallas abiertas */}
              {failure.status !== 'RESOLVED' && failure.status !== 'RESOLVED_IMMEDIATE' && (
                <div style={{
                  borderTop: '1px solid #E4E4E8',
                  padding: '16px 24px',
                  flexShrink: 0,
                  display: 'flex', gap: '8px',
                }}>
                  <button
                    onClick={() => setImmediateCloseOpen(true)}
                    style={{
                      flex: 1, height: '38px', borderRadius: '8px',
                      border: '1.5px solid #059669',
                      background: '#ECFDF5', color: '#059669',
                      fontSize: '13px', fontWeight: 600,
                      cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                      transition: 'all 120ms ease',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.background = '#D1FAE5'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = '#ECFDF5'; }}
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    Resolver Ahora
                  </button>

                  {hasWorkOrder ? (
                    <button
                      onClick={() => handleGoToWorkOrder(failure.workOrders![0].id)}
                      style={{
                        flex: 1, height: '38px', borderRadius: '8px',
                        border: 'none',
                        background: '#111827', color: '#FFFFFF',
                        fontSize: '13px', fontWeight: 600,
                        cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                        transition: 'all 120ms ease',
                      }}
                      onMouseEnter={e => { e.currentTarget.style.background = '#1F2937'; }}
                      onMouseLeave={e => { e.currentTarget.style.background = '#111827'; }}
                    >
                      <ExternalLink className="h-4 w-4" />
                      Ver OT
                    </button>
                  ) : (
                    <button
                      onClick={handleCreateWorkOrder}
                      style={{
                        flex: 1, height: '38px', borderRadius: '8px',
                        border: 'none',
                        background: '#111827', color: '#FFFFFF',
                        fontSize: '13px', fontWeight: 600,
                        cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                        transition: 'all 120ms ease',
                      }}
                      onMouseEnter={e => { e.currentTarget.style.background = '#1F2937'; }}
                      onMouseLeave={e => { e.currentTarget.style.background = '#111827'; }}
                    >
                      <FileText className="h-4 w-4" />
                      Crear OT
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

    {/* Dialog de Retorno a Producción */}
    {selectedDowntimeLog && failureId && (
      <ReturnToProductionDialog
        open={returnDialogOpen}
        onOpenChange={(open) => {
          setReturnDialogOpen(open);
          if (!open) setSelectedDowntimeLog(null);
        }}
        downtimeLog={selectedDowntimeLog}
        failureId={failureId}
      />
    )}

    {/* Dialog de Cierre Inmediato */}
    {failureId && failure && (
      <ImmediateCloseDialog
        open={immediateCloseOpen}
        onOpenChange={setImmediateCloseOpen}
        failureId={failureId}
        failureTitle={failure.title}
        hasActiveDowntime={failure.downtimeLogs?.some((d) => !d.endedAt) || false}
        onSuccess={() => onOpenChange(false)}
      />
    )}

    {/* Dialog de Reabrir Falla */}
    {failureId && failure && (
      <ReopenFailureDialog
        open={reopenDialogOpen}
        onOpenChange={setReopenDialogOpen}
        failureId={failureId}
        failureTitle={failure.title}
        onSuccess={() => onOpenChange(false)}
      />
    )}

    {/* Lightbox de fotos */}
    {lightboxPhoto && (
      <div
        className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 cursor-zoom-out"
        onClick={() => setLightboxPhoto(null)}
      >
        <button
          className="absolute top-4 right-4 text-white/80 hover:text-white"
          onClick={() => setLightboxPhoto(null)}
        >
          <X className="h-6 w-6" />
        </button>
        <img
          src={lightboxPhoto}
          alt="Foto ampliada"
          className="max-h-[90vh] max-w-[90vw] object-contain rounded-lg"
          onClick={(e) => e.stopPropagation()}
        />
      </div>
    )}
  </>
  );
}
