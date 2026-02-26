'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Lightbulb,
  Plus,
  MoreVertical,
  ThumbsUp,
  MessageSquare,
  Trash2,
  ArrowRight,
  CheckCircle,
  TrendingUp,
  Wrench,
  Shield,
  DollarSign,
  Sparkles,
  Send,
  X,
  Loader2,
  Clock,
} from 'lucide-react';
import { toast } from 'sonner';
import { format, formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { useConfirm } from '@/components/ui/confirm-dialog-provider';
import { useAuth } from '@/contexts/AuthContext';

// ─── Types ───────────────────────────────────────────────────────────────────

interface Idea {
  id: number;
  title: string;
  description: string;
  category: string;
  priority: string;
  status: string;
  machineId: number | null;
  machine: { id: number; name: string } | null;
  createdById: number;
  createdBy: { id: number; name: string; email: string; avatar: string | null };
  reviewedBy: { id: number; name: string } | null;
  implementedBy: { id: number; name: string } | null;
  reviewNotes: string | null;
  implementationNotes: string | null;
  voteCount: number;
  commentCount: number;
  hasVoted: boolean;
  createdAt: string;
  reviewedAt: string | null;
  implementedAt: string | null;
}

interface IdeaStats {
  summary: {
    total: number;
    new: number;
    underReview: number;
    approved: number;
    inProgress: number;
    implemented: number;
    rejected: number;
    thisMonth: number;
    implementedThisYear: number;
    implementationRate: number;
  };
  byCategory: Record<string, number>;
}

// ─── Config ───────────────────────────────────────────────────────────────────

const CATEGORY_CONFIG: Record<string, {
  label: string;
  icon: any;
  iconBg: string;
  iconText: string;
  accent: string;
}> = {
  SOLUCION_FALLA: {
    label: 'Solución a Falla',
    icon: Wrench,
    iconBg: 'bg-red-100 dark:bg-red-950/60',
    iconText: 'text-red-600 dark:text-red-400',
    accent: 'bg-red-500',
  },
  MEJORA_PROCESO: {
    label: 'Mejora de Proceso',
    icon: TrendingUp,
    iconBg: 'bg-blue-100 dark:bg-blue-950/60',
    iconText: 'text-blue-600 dark:text-blue-400',
    accent: 'bg-blue-500',
  },
  MEJORA_EQUIPO: {
    label: 'Mejora de Equipo',
    icon: Sparkles,
    iconBg: 'bg-purple-100 dark:bg-purple-950/60',
    iconText: 'text-purple-600 dark:text-purple-400',
    accent: 'bg-purple-500',
  },
  SEGURIDAD: {
    label: 'Seguridad',
    icon: Shield,
    iconBg: 'bg-amber-100 dark:bg-amber-950/60',
    iconText: 'text-amber-600 dark:text-amber-400',
    accent: 'bg-amber-500',
  },
  AHORRO_COSTOS: {
    label: 'Ahorro de Costos',
    icon: DollarSign,
    iconBg: 'bg-green-100 dark:bg-green-950/60',
    iconText: 'text-green-600 dark:text-green-400',
    accent: 'bg-green-500',
  },
  CALIDAD: {
    label: 'Calidad',
    icon: CheckCircle,
    iconBg: 'bg-cyan-100 dark:bg-cyan-950/60',
    iconText: 'text-cyan-600 dark:text-cyan-400',
    accent: 'bg-cyan-500',
  },
  OTRO: {
    label: 'Otro',
    icon: Lightbulb,
    iconBg: 'bg-muted',
    iconText: 'text-muted-foreground',
    accent: 'bg-muted-foreground/60',
  },
};

const STATUS_CONFIG: Record<string, {
  label: string;
  dot: string;
  pill: string;
}> = {
  NEW: {
    label: 'Nueva',
    dot: 'bg-blue-500',
    pill: 'bg-blue-50 border-blue-200 text-blue-700 dark:bg-blue-950/50 dark:border-blue-800/50 dark:text-blue-300',
  },
  UNDER_REVIEW: {
    label: 'En Revisión',
    dot: 'bg-amber-500',
    pill: 'bg-amber-50 border-amber-200 text-amber-700 dark:bg-amber-950/50 dark:border-amber-800/50 dark:text-amber-300',
  },
  APPROVED: {
    label: 'Aprobada',
    dot: 'bg-green-500',
    pill: 'bg-green-50 border-green-200 text-green-700 dark:bg-green-950/50 dark:border-green-800/50 dark:text-green-300',
  },
  IN_PROGRESS: {
    label: 'En Progreso',
    dot: 'bg-purple-500',
    pill: 'bg-purple-50 border-purple-200 text-purple-700 dark:bg-purple-950/50 dark:border-purple-800/50 dark:text-purple-300',
  },
  IMPLEMENTED: {
    label: 'Implementada',
    dot: 'bg-emerald-500',
    pill: 'bg-emerald-50 border-emerald-200 text-emerald-700 dark:bg-emerald-950/50 dark:border-emerald-800/50 dark:text-emerald-300',
  },
  REJECTED: {
    label: 'Rechazada',
    dot: 'bg-red-500',
    pill: 'bg-red-50 border-red-200 text-red-700 dark:bg-red-950/50 dark:border-red-800/50 dark:text-red-300',
  },
  ARCHIVED: {
    label: 'Archivada',
    dot: 'bg-gray-400',
    pill: 'bg-gray-50 border-gray-200 text-gray-600 dark:bg-gray-900/50 dark:border-gray-700/50 dark:text-gray-400',
  },
};

const PRIORITY_LABELS: Record<string, string> = {
  LOW: 'Baja',
  MEDIUM: 'Media',
  HIGH: 'Alta',
  CRITICAL: 'Crítica',
};

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function IdeasPage() {
  const confirm = useConfirm();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const currentUserId = user?.id;
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [selectedIdea, setSelectedIdea] = useState<Idea | null>(null);
  const [isDetailDialogOpen, setIsDetailDialogOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');

  const { data: stats } = useQuery<IdeaStats>({
    queryKey: ['ideas-stats'],
    queryFn: async () => {
      const res = await fetch('/api/ideas/stats');
      if (!res.ok) throw new Error('Error al cargar estadísticas');
      return res.json();
    },
  });

  const { data: ideasData, isLoading } = useQuery<{ ideas: Idea[]; pagination: any }>({
    queryKey: ['ideas', statusFilter, categoryFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (statusFilter !== 'all') params.append('status', statusFilter);
      if (categoryFilter !== 'all') params.append('category', categoryFilter);
      const res = await fetch(`/api/ideas?${params}`);
      if (!res.ok) throw new Error('Error al cargar ideas');
      return res.json();
    },
  });

  const voteMutation = useMutation({
    mutationFn: async (ideaId: number) => {
      const res = await fetch(`/api/ideas/${ideaId}/vote`, { method: 'POST' });
      if (!res.ok) throw new Error('Error al votar');
      return res.json();
    },
    onSuccess: (_data, ideaId) => {
      queryClient.invalidateQueries({ queryKey: ['ideas'] });
      queryClient.invalidateQueries({ queryKey: ['ideas-stats'] });
      queryClient.invalidateQueries({ queryKey: ['idea', ideaId] });
    },
    onError: () => toast.error('Error al votar'),
  });

  const deleteMutation = useMutation({
    mutationFn: async (ideaId: number) => {
      const res = await fetch(`/api/ideas/${ideaId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Error al eliminar');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ideas'] });
      queryClient.invalidateQueries({ queryKey: ['ideas-stats'] });
      toast.success('Idea eliminada');
    },
    onError: () => toast.error('Error al eliminar la idea'),
  });

  const hasFilters = statusFilter !== 'all' || categoryFilter !== 'all';

  return (
    <div className="flex flex-col min-h-full">

      {/* ── Header ── */}
      <div className="px-4 md:px-6 pt-4 pb-4 border-b border-border flex-shrink-0">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <Lightbulb className="h-5 w-5 text-primary" />
            </div>
            <div className="min-w-0">
              <h1 className="text-base font-semibold leading-none">Libro de Ideas</h1>
              <p className="text-xs text-muted-foreground mt-1">
                Propuestas del equipo
              </p>
            </div>
          </div>
          <Button
            onClick={() => setIsCreateDialogOpen(true)}
            size="sm"
            className="shrink-0 gap-1.5"
          >
            <Plus className="h-4 w-4" />
            <span className="hidden xs:inline">Nueva Idea</span>
            <span className="xs:hidden">Nueva</span>
          </Button>
        </div>
      </div>

      <div className="px-4 md:px-6 py-5 space-y-5 flex-1">

        {/* ── KPI Grid ── */}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <KpiCard
            label="Total Ideas"
            value={stats?.summary.total ?? 0}
            sub={`${stats?.summary.thisMonth ?? 0} este mes`}
            icon={Lightbulb}
            iconBg="bg-primary/10"
            iconColor="text-primary"
          />
          <KpiCard
            label="Pendientes"
            value={(stats?.summary.new ?? 0) + (stats?.summary.underReview ?? 0)}
            sub={`${stats?.summary.new ?? 0} nuevas · ${stats?.summary.underReview ?? 0} en revisión`}
            icon={Clock}
            iconBg="bg-amber-500/10"
            iconColor="text-amber-600 dark:text-amber-400"
          />
          <KpiCard
            label="Implementadas"
            value={stats?.summary.implemented ?? 0}
            sub={`${stats?.summary.implementedThisYear ?? 0} este año`}
            icon={CheckCircle}
            iconBg="bg-green-500/10"
            iconColor="text-green-600 dark:text-green-400"
          />
          <KpiCard
            label="Tasa"
            value={`${stats?.summary.implementationRate ?? 0}%`}
            sub="de ideas revisadas"
            icon={TrendingUp}
            iconBg="bg-purple-500/10"
            iconColor="text-purple-600 dark:text-purple-400"
          />
        </div>

        {/* ── Filters ── */}
        <div className="flex items-center gap-2 flex-wrap">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="h-8 text-xs flex-1 min-w-[130px] sm:w-[160px] sm:flex-none">
              <SelectValue placeholder="Estado" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los estados</SelectItem>
              {Object.entries(STATUS_CONFIG).map(([value, config]) => (
                <SelectItem key={value} value={value}>
                  {config.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="h-8 text-xs flex-1 min-w-[130px] sm:w-[160px] sm:flex-none">
              <SelectValue placeholder="Categoría" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas las categorías</SelectItem>
              {Object.entries(CATEGORY_CONFIG).map(([value, config]) => (
                <SelectItem key={value} value={value}>
                  {config.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {hasFilters && (
            <Button
              variant="ghost"
              size="sm"
              className="h-8 text-xs gap-1 px-2 text-muted-foreground shrink-0"
              onClick={() => { setStatusFilter('all'); setCategoryFilter('all'); }}
            >
              <X className="h-3 w-3" />
              Limpiar
            </Button>
          )}
        </div>

        {/* ── Ideas List ── */}
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <div className="flex flex-col items-center gap-3">
              <div className="h-10 w-10 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
              <p className="text-sm text-muted-foreground">Cargando ideas...</p>
            </div>
          </div>
        ) : ideasData?.ideas && ideasData.ideas.length > 0 ? (
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {ideasData.ideas.map((idea) => (
              <IdeaCard
                key={idea.id}
                idea={idea}
                currentUserId={currentUserId}
                onVote={() => voteMutation.mutate(idea.id)}
                onView={() => {
                  setSelectedIdea(idea);
                  setIsDetailDialogOpen(true);
                }}
                onDelete={async () => {
                  const ok = await confirm({
                    title: 'Eliminar idea',
                    description: '¿Eliminar esta idea? Esta acción no se puede deshacer.',
                    confirmText: 'Eliminar',
                    variant: 'destructive',
                  });
                  if (ok) deleteMutation.mutate(idea.id);
                }}
              />
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mb-4">
              <Lightbulb className="h-7 w-7 text-muted-foreground/50" />
            </div>
            <h3 className="font-semibold mb-1">Sin ideas registradas</h3>
            <p className="text-sm text-muted-foreground mb-4">
              {hasFilters ? 'No hay ideas con esos filtros.' : 'Sé el primero en proponer una mejora.'}
            </p>
            {!hasFilters && (
              <Button size="sm" onClick={() => setIsCreateDialogOpen(true)} className="gap-1.5">
                <Plus className="h-4 w-4" />
                Nueva Idea
              </Button>
            )}
          </div>
        )}
      </div>

      {/* ── Dialogs ── */}
      <CreateIdeaDialog
        open={isCreateDialogOpen}
        onOpenChange={setIsCreateDialogOpen}
        onSuccess={() => {
          setIsCreateDialogOpen(false);
          queryClient.invalidateQueries({ queryKey: ['ideas'] });
          queryClient.invalidateQueries({ queryKey: ['ideas-stats'] });
        }}
      />

      {selectedIdea && (
        <IdeaDetailDialog
          open={isDetailDialogOpen}
          onOpenChange={setIsDetailDialogOpen}
          ideaId={selectedIdea.id}
          onVote={() => voteMutation.mutate(selectedIdea.id)}
        />
      )}
    </div>
  );
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────

function KpiCard({
  label,
  value,
  sub,
  icon: Icon,
  iconBg,
  iconColor,
}: {
  label: string;
  value: string | number;
  sub: string;
  icon: any;
  iconBg: string;
  iconColor: string;
}) {
  return (
    <Card className="border-border/60">
      <CardContent className="p-3 sm:p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground font-medium leading-none mb-1.5">{label}</p>
            <p className="text-xl sm:text-2xl font-bold leading-none">{value}</p>
            <p className="text-[10px] sm:text-xs text-muted-foreground mt-1.5 leading-snug line-clamp-2">{sub}</p>
          </div>
          <div className={cn('h-8 w-8 sm:h-9 sm:w-9 rounded-lg flex items-center justify-center shrink-0', iconBg)}>
            <Icon className={cn('h-4 w-4', iconColor)} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Idea Card ────────────────────────────────────────────────────────────────

function IdeaCard({
  idea,
  currentUserId,
  onVote,
  onView,
  onDelete,
}: {
  idea: Idea;
  currentUserId: number | undefined;
  onVote: () => void;
  onView: () => void;
  onDelete: () => void;
}) {
  const isOwner = currentUserId !== undefined && idea.createdById === currentUserId;
  const cat = CATEGORY_CONFIG[idea.category] || CATEGORY_CONFIG.OTRO;
  const status = STATUS_CONFIG[idea.status] || STATUS_CONFIG.NEW;
  const CategoryIcon = cat.icon;

  return (
    <Card
      className="group relative overflow-hidden cursor-pointer transition-all duration-200 hover:shadow-md hover:border-primary/20 border-border/70"
      onClick={onView}
    >
      {/* Left accent */}
      <div className={cn('absolute left-0 inset-y-0 w-[3px]', cat.accent)} />

      <CardContent className="p-3.5 pl-5">
        {/* Top row */}
        <div className="flex items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-1.5 min-w-0">
            <div className={cn('h-6 w-6 rounded-md flex items-center justify-center shrink-0', cat.iconBg)}>
              <CategoryIcon className={cn('h-3.5 w-3.5', cat.iconText)} />
            </div>
            <span className="text-xs text-muted-foreground truncate">{cat.label}</span>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <span className={cn(
              'inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full border leading-none',
              status.pill
            )}>
              <span className={cn('h-1.5 w-1.5 rounded-full shrink-0', status.dot)} />
              {status.label}
            </span>
            <DropdownMenu>
              <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                  aria-label="Más opciones"
                >
                  <MoreVertical className="h-3.5 w-3.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onView(); }}>
                  <ArrowRight className="h-4 w-4 mr-2" />
                  Ver detalle
                </DropdownMenuItem>
                {isOwner && (
                  <DropdownMenuItem
                    className="text-destructive focus:text-destructive"
                    onClick={(e) => { e.stopPropagation(); onDelete(); }}
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Eliminar
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Title */}
        <h3 className="font-semibold text-sm leading-snug line-clamp-2 mb-1.5">
          {idea.title}
        </h3>

        {/* Description */}
        <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed mb-3">
          {idea.description}
        </p>

        {/* Footer */}
        <div className="flex items-center justify-between pt-2.5 border-t border-border/50">
          <div className="flex items-center gap-1.5 min-w-0">
            <Avatar className="h-5 w-5 shrink-0">
              <AvatarImage src={idea.createdBy.avatar || undefined} />
              <AvatarFallback className="text-[9px] font-bold">
                {idea.createdBy.name[0]}
              </AvatarFallback>
            </Avatar>
            <span className="text-[11px] text-muted-foreground truncate max-w-[70px] sm:max-w-[110px]">
              {idea.createdBy.name}
            </span>
            <span className="text-[11px] text-muted-foreground/50 shrink-0">·</span>
            <span className="text-[11px] text-muted-foreground/70 shrink-0 hidden xs:inline">
              {formatDistanceToNow(new Date(idea.createdAt), { addSuffix: true, locale: es })}
            </span>
          </div>
          <div className="flex items-center gap-2.5 shrink-0">
            <button
              onClick={(e) => { e.stopPropagation(); onVote(); }}
              className={cn(
                'flex items-center gap-1 text-[11px] transition-colors duration-150',
                idea.hasVoted
                  ? 'text-primary font-medium'
                  : 'text-muted-foreground hover:text-foreground'
              )}
              aria-label={idea.hasVoted ? 'Quitar voto' : 'Votar'}
            >
              <ThumbsUp className={cn('h-3.5 w-3.5', idea.hasVoted && 'fill-current')} />
              {idea.voteCount}
            </button>
            <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
              <MessageSquare className="h-3.5 w-3.5" />
              {idea.commentCount}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Create Dialog ────────────────────────────────────────────────────────────

function CreateIdeaDialog({
  open,
  onOpenChange,
  onSuccess,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [priority, setPriority] = useState('MEDIUM');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const reset = () => {
    setTitle('');
    setDescription('');
    setCategory('');
    setPriority('MEDIUM');
  };

  const handleSubmit = async () => {
    if (!title.trim() || !description.trim() || !category) {
      toast.error('Completá todos los campos requeridos');
      return;
    }
    setIsSubmitting(true);
    try {
      const res = await fetch('/api/ideas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: title.trim(), description: description.trim(), category, priority }),
      });
      if (!res.ok) throw new Error();
      toast.success('Idea creada exitosamente');
      reset();
      onSuccess();
    } catch {
      toast.error('Error al crear la idea');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) reset(); onOpenChange(v); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <Lightbulb className="h-4 w-4 text-primary" />
            </div>
            Nueva Idea
          </DialogTitle>
          <DialogDescription>
            Proponé una mejora o solución para el equipo
          </DialogDescription>
        </DialogHeader>

        <DialogBody>
          <div className="space-y-5">
            {/* Título */}
            <div className="space-y-1.5">
              <Label htmlFor="idea-title" className="text-xs uppercase tracking-wider text-muted-foreground font-medium">
                Título <span className="text-destructive">*</span>
              </Label>
              <Input
                id="idea-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Resumí la idea en una línea"
                maxLength={120}
              />
            </div>

            {/* Descripción */}
            <div className="space-y-1.5">
              <Label htmlFor="idea-desc" className="text-xs uppercase tracking-wider text-muted-foreground font-medium">
                Descripción <span className="text-destructive">*</span>
              </Label>
              <Textarea
                id="idea-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describí el problema que resuelve, cómo se implementaría, beneficios esperados..."
                rows={4}
                className="resize-none"
              />
            </div>

            {/* Categoría + Prioridad */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs uppercase tracking-wider text-muted-foreground font-medium">
                  Categoría <span className="text-destructive">*</span>
                </Label>
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar" />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(CATEGORY_CONFIG).map(([value, config]) => {
                      const Icon = config.icon;
                      return (
                        <SelectItem key={value} value={value}>
                          <span className="flex items-center gap-2">
                            <Icon className={cn('h-3.5 w-3.5', config.iconText)} />
                            {config.label}
                          </span>
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs uppercase tracking-wider text-muted-foreground font-medium">
                  Prioridad
                </Label>
                <Select value={priority} onValueChange={setPriority}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="LOW">Baja</SelectItem>
                    <SelectItem value="MEDIUM">Media</SelectItem>
                    <SelectItem value="HIGH">Alta</SelectItem>
                    <SelectItem value="CRITICAL">Crítica</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        </DialogBody>

        <DialogFooter>
          <Button variant="outline" onClick={() => { reset(); onOpenChange(false); }} disabled={isSubmitting}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting || !title.trim() || !description.trim() || !category}>
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Creando...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4 mr-2" />
                Crear Idea
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Detail Dialog ────────────────────────────────────────────────────────────

function IdeaDetailDialog({
  open,
  onOpenChange,
  ideaId,
  onVote,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ideaId: number;
  onVote: () => void;
}) {
  const queryClient = useQueryClient();
  const [newComment, setNewComment] = useState('');

  const { data: idea, isLoading } = useQuery({
    queryKey: ['idea', ideaId],
    queryFn: async () => {
      const res = await fetch(`/api/ideas/${ideaId}`);
      if (!res.ok) throw new Error('Error');
      return res.json();
    },
    enabled: open,
  });

  const commentMutation = useMutation({
    mutationFn: async (content: string) => {
      const res = await fetch(`/api/ideas/${ideaId}/comment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content }),
      });
      if (!res.ok) throw new Error('Error');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['idea', ideaId] });
      setNewComment('');
      toast.success('Comentario agregado');
    },
    onError: () => toast.error('Error al agregar comentario'),
  });

  const cat = idea ? (CATEGORY_CONFIG[idea.category] || CATEGORY_CONFIG.OTRO) : null;
  const status = idea ? (STATUS_CONFIG[idea.status] || STATUS_CONFIG.NEW) : null;

  if (isLoading || !idea || !cat || !status) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent>
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  const CategoryIcon = cat.icon;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="md">
        <DialogHeader>
          {/* Category + status row */}
          <div className="flex items-center gap-2 mb-2">
            <div className={cn('h-7 w-7 rounded-md flex items-center justify-center', cat.iconBg)}>
              <CategoryIcon className={cn('h-4 w-4', cat.iconText)} />
            </div>
            <span className="text-xs text-muted-foreground">{cat.label}</span>
            <span className="text-xs text-muted-foreground/40">·</span>
            <span className={cn(
              'inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full border leading-none',
              status.pill
            )}>
              <span className={cn('h-1.5 w-1.5 rounded-full', status.dot)} />
              {status.label}
            </span>
          </div>
          <DialogTitle className="text-base leading-snug">{idea.title}</DialogTitle>
        </DialogHeader>

        <DialogBody>
          <div className="space-y-5">
            {/* Author + meta */}
            <div className="flex items-center gap-2 flex-wrap">
              <Avatar className="h-6 w-6">
                <AvatarImage src={idea.createdBy.avatar || undefined} />
                <AvatarFallback className="text-[10px] font-bold">{idea.createdBy.name[0]}</AvatarFallback>
              </Avatar>
              <span className="text-sm font-medium">{idea.createdBy.name}</span>
              <span className="text-xs text-muted-foreground">
                {format(new Date(idea.createdAt), "d 'de' MMM, HH:mm", { locale: es })}
              </span>
              {idea.machine && (
                <>
                  <span className="text-xs text-muted-foreground/40">·</span>
                  <span className="text-xs text-muted-foreground">📍 {idea.machine.name}</span>
                </>
              )}
              <span className="text-xs text-muted-foreground/40">·</span>
              <span className="text-xs text-muted-foreground">
                Prioridad {PRIORITY_LABELS[idea.priority] || idea.priority}
              </span>
            </div>

            {/* Description */}
            <div className="rounded-lg bg-muted/40 border border-border/50 p-3.5">
              <p className="text-sm whitespace-pre-wrap leading-relaxed">{idea.description}</p>
            </div>

            {/* Vote */}
            <div className="flex items-center gap-3">
              <Button
                variant={idea.hasVoted ? 'default' : 'outline'}
                size="sm"
                onClick={onVote}
                className="gap-2"
              >
                <ThumbsUp className={cn('h-4 w-4', idea.hasVoted && 'fill-current')} />
                {idea.voteCount} {idea.voteCount === 1 ? 'voto' : 'votos'}
              </Button>
              <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <MessageSquare className="h-4 w-4" />
                {idea.commentCount} {idea.commentCount === 1 ? 'comentario' : 'comentarios'}
              </span>
            </div>

            {/* Review notes */}
            {idea.reviewNotes && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-800/50 p-3.5">
                <p className="text-xs font-medium text-amber-700 dark:text-amber-400 mb-1">Notas de revisión</p>
                <p className="text-sm text-amber-900 dark:text-amber-200">{idea.reviewNotes}</p>
                {idea.reviewedBy && (
                  <p className="text-xs text-amber-600 dark:text-amber-500 mt-1.5">— {idea.reviewedBy.name}</p>
                )}
              </div>
            )}

            {/* Implementation notes */}
            {idea.implementationNotes && (
              <div className="rounded-lg border border-green-200 bg-green-50 dark:bg-green-950/30 dark:border-green-800/50 p-3.5">
                <p className="text-xs font-medium text-green-700 dark:text-green-400 mb-1">Notas de implementación</p>
                <p className="text-sm text-green-900 dark:text-green-200">{idea.implementationNotes}</p>
                {idea.implementedBy && (
                  <p className="text-xs text-green-600 dark:text-green-500 mt-1.5">— {idea.implementedBy.name}</p>
                )}
              </div>
            )}

            {/* Comments */}
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-3">
                Comentarios
                {idea.comments?.length > 0 && (
                  <span className="ml-1.5 normal-case font-normal">({idea.comments.length})</span>
                )}
              </p>

              {/* New comment */}
              <div className="flex gap-2 mb-4">
                <Input
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  placeholder="Escribí un comentario..."
                  className="flex-1 text-sm"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey && newComment.trim()) {
                      e.preventDefault();
                      commentMutation.mutate(newComment.trim());
                    }
                  }}
                />
                <Button
                  size="icon"
                  onClick={() => newComment.trim() && commentMutation.mutate(newComment.trim())}
                  disabled={!newComment.trim() || commentMutation.isPending}
                  aria-label="Enviar comentario"
                >
                  {commentMutation.isPending
                    ? <Loader2 className="h-4 w-4 animate-spin" />
                    : <Send className="h-4 w-4" />
                  }
                </Button>
              </div>

              {/* Comments list */}
              {idea.comments?.length === 0 ? (
                <p className="text-xs text-center text-muted-foreground py-4">
                  Sin comentarios aún. Sé el primero.
                </p>
              ) : (
                <div className="space-y-3">
                  {idea.comments?.map((comment: any) => (
                    <div key={comment.id} className="flex gap-2.5">
                      <Avatar className="h-7 w-7 shrink-0">
                        <AvatarFallback className="text-[10px] font-bold">
                          {comment.user.name[0]}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="text-xs font-medium">{comment.user.name}</span>
                          <span className="text-[10px] text-muted-foreground">
                            {formatDistanceToNow(new Date(comment.createdAt), {
                              addSuffix: true,
                              locale: es,
                            })}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground leading-relaxed">
                          {comment.content}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}
