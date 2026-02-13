'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
  Edit,
  CheckCircle,
  XCircle,
  Clock,
  ArrowRight,
  TrendingUp,
  Wrench,
  Shield,
  DollarSign,
  Sparkles,
  Send,
} from 'lucide-react';
import { toast } from 'sonner';
import { format, formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';

// Types
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
  topVoted: any[];
  recentIdeas: any[];
}

// Category labels and icons
const CATEGORY_CONFIG: Record<string, { label: string; icon: any; color: string }> = {
  SOLUCION_FALLA: { label: 'Solución a Falla', icon: Wrench, color: 'bg-red-500' },
  MEJORA_PROCESO: { label: 'Mejora de Proceso', icon: TrendingUp, color: 'bg-blue-500' },
  MEJORA_EQUIPO: { label: 'Mejora de Equipo', icon: Sparkles, color: 'bg-purple-500' },
  SEGURIDAD: { label: 'Seguridad', icon: Shield, color: 'bg-orange-500' },
  AHORRO_COSTOS: { label: 'Ahorro de Costos', icon: DollarSign, color: 'bg-green-500' },
  CALIDAD: { label: 'Calidad', icon: CheckCircle, color: 'bg-cyan-500' },
  OTRO: { label: 'Otro', icon: Lightbulb, color: 'bg-gray-500' },
};

// Status labels and colors
const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  NEW: { label: 'Nueva', color: 'bg-blue-500' },
  UNDER_REVIEW: { label: 'En Revisión', color: 'bg-yellow-500' },
  APPROVED: { label: 'Aprobada', color: 'bg-green-500' },
  IN_PROGRESS: { label: 'En Progreso', color: 'bg-purple-500' },
  IMPLEMENTED: { label: 'Implementada', color: 'bg-emerald-600' },
  REJECTED: { label: 'Rechazada', color: 'bg-red-500' },
  ARCHIVED: { label: 'Archivada', color: 'bg-gray-500' },
};

// Priority colors
const PRIORITY_COLORS: Record<string, string> = {
  LOW: 'text-gray-500',
  MEDIUM: 'text-yellow-500',
  HIGH: 'text-orange-500',
  CRITICAL: 'text-red-500',
};

export default function IdeasPage() {
  const queryClient = useQueryClient();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [selectedIdea, setSelectedIdea] = useState<Idea | null>(null);
  const [isDetailDialogOpen, setIsDetailDialogOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');

  // Fetch stats
  const { data: stats } = useQuery<IdeaStats>({
    queryKey: ['ideas-stats'],
    queryFn: async () => {
      const res = await fetch('/api/ideas/stats');
      if (!res.ok) throw new Error('Error al cargar estadísticas');
      return res.json();
    },
  });

  // Fetch ideas
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

  // Vote mutation
  const voteMutation = useMutation({
    mutationFn: async (ideaId: number) => {
      const res = await fetch(`/api/ideas/${ideaId}/vote`, { method: 'POST' });
      if (!res.ok) throw new Error('Error al votar');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ideas'] });
      queryClient.invalidateQueries({ queryKey: ['ideas-stats'] });
    },
    onError: () => {
      toast.error('Error al votar');
    },
  });

  // Delete mutation
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
    onError: () => {
      toast.error('Error al eliminar la idea');
    },
  });

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Lightbulb className="h-8 w-8 text-yellow-500" />
            Libro de Ideas
          </h1>
          <p className="text-muted-foreground mt-1">
            Propuestas de mejoras y soluciones del equipo
          </p>
        </div>
        <Button onClick={() => setIsCreateDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Nueva Idea
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Ideas</CardTitle>
            <Lightbulb className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.summary.total || 0}</div>
            <p className="text-xs text-muted-foreground">
              {stats?.summary.thisMonth || 0} este mes
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pendientes</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {(stats?.summary.new || 0) + (stats?.summary.underReview || 0)}
            </div>
            <p className="text-xs text-muted-foreground">
              {stats?.summary.new || 0} nuevas, {stats?.summary.underReview || 0} en revisión
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Implementadas</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.summary.implemented || 0}</div>
            <p className="text-xs text-muted-foreground">
              {stats?.summary.implementedThisYear || 0} este año
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tasa Implementación</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.summary.implementationRate || 0}%</div>
            <p className="text-xs text-muted-foreground">de ideas revisadas</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex gap-4">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Filtrar por estado" />
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
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Filtrar por categoría" />
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
      </div>

      {/* Ideas List */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {isLoading ? (
          <div className="col-span-full text-center py-8 text-muted-foreground">
            Cargando ideas...
          </div>
        ) : ideasData?.ideas && ideasData.ideas.length > 0 ? (
          ideasData.ideas.map((idea) => (
            <IdeaCard
              key={idea.id}
              idea={idea}
              onVote={() => voteMutation.mutate(idea.id)}
              onView={() => {
                setSelectedIdea(idea);
                setIsDetailDialogOpen(true);
              }}
              onDelete={() => {
                if (confirm('¿Eliminar esta idea?')) {
                  deleteMutation.mutate(idea.id);
                }
              }}
            />
          ))
        ) : (
          <div className="col-span-full text-center py-12">
            <Lightbulb className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium">Sin ideas registradas</h3>
            <p className="text-muted-foreground mb-4">
              Sé el primero en proponer una mejora
            </p>
            <Button onClick={() => setIsCreateDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Nueva Idea
            </Button>
          </div>
        )}
      </div>

      {/* Create Dialog */}
      <CreateIdeaDialog
        open={isCreateDialogOpen}
        onOpenChange={setIsCreateDialogOpen}
        onSuccess={() => {
          setIsCreateDialogOpen(false);
          queryClient.invalidateQueries({ queryKey: ['ideas'] });
          queryClient.invalidateQueries({ queryKey: ['ideas-stats'] });
        }}
      />

      {/* Detail Dialog */}
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

// Idea Card Component
function IdeaCard({
  idea,
  onVote,
  onView,
  onDelete,
}: {
  idea: Idea;
  onVote: () => void;
  onView: () => void;
  onDelete: () => void;
}) {
  const categoryConfig = CATEGORY_CONFIG[idea.category] || CATEGORY_CONFIG.OTRO;
  const statusConfig = STATUS_CONFIG[idea.status] || STATUS_CONFIG.NEW;
  const CategoryIcon = categoryConfig.icon;

  return (
    <Card className="hover:shadow-md transition-shadow cursor-pointer" onClick={onView}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <div className={`p-2 rounded-lg ${categoryConfig.color}`}>
              <CategoryIcon className="h-4 w-4 text-white" />
            </div>
            <Badge className={`${statusConfig.color} text-white`}>
              {statusConfig.label}
            </Badge>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onView(); }}>
                <ArrowRight className="h-4 w-4 mr-2" />
                Ver Detalle
              </DropdownMenuItem>
              <DropdownMenuItem
                className="text-red-600"
                onClick={(e) => { e.stopPropagation(); onDelete(); }}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Eliminar
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <CardTitle className="text-lg mt-2 line-clamp-2">{idea.title}</CardTitle>
        <CardDescription className="line-clamp-2">{idea.description}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Avatar className="h-6 w-6">
              <AvatarImage src={idea.createdBy.avatar || undefined} />
              <AvatarFallback>{idea.createdBy.name[0]}</AvatarFallback>
            </Avatar>
            <span className="text-sm text-muted-foreground">{idea.createdBy.name}</span>
          </div>
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              className={idea.hasVoted ? 'text-blue-500' : ''}
              onClick={(e) => { e.stopPropagation(); onVote(); }}
            >
              <ThumbsUp className={`h-4 w-4 mr-1 ${idea.hasVoted ? 'fill-current' : ''}`} />
              {idea.voteCount}
            </Button>
            <span className="flex items-center text-sm text-muted-foreground">
              <MessageSquare className="h-4 w-4 mr-1" />
              {idea.commentCount}
            </span>
          </div>
        </div>
        {idea.machine && (
          <div className="mt-2 text-xs text-muted-foreground">
            Máquina: {idea.machine.name}
          </div>
        )}
        <div className="mt-2 text-xs text-muted-foreground">
          {formatDistanceToNow(new Date(idea.createdAt), { addSuffix: true, locale: es })}
        </div>
      </CardContent>
    </Card>
  );
}

// Create Idea Dialog
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

  const handleSubmit = async () => {
    if (!title || !description || !category) {
      toast.error('Complete todos los campos requeridos');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch('/api/ideas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, description, category, priority }),
      });

      if (!res.ok) throw new Error('Error al crear');

      toast.success('Idea creada exitosamente');
      setTitle('');
      setDescription('');
      setCategory('');
      setPriority('MEDIUM');
      onSuccess();
    } catch (error) {
      toast.error('Error al crear la idea');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Lightbulb className="h-5 w-5 text-yellow-500" />
            Nueva Idea
          </DialogTitle>
          <DialogDescription>
            Propone una mejora o solución para el equipo
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="title">Título *</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Resumen de la idea"
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="description">Descripción *</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe la idea en detalle..."
              rows={4}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label>Categoría *</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(CATEGORY_CONFIG).map(([value, config]) => (
                    <SelectItem key={value} value={value}>
                      {config.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label>Prioridad</Label>
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

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting ? 'Creando...' : 'Crear Idea'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Idea Detail Dialog
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
    onError: () => {
      toast.error('Error al agregar comentario');
    },
  });

  if (isLoading || !idea) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent>
          <div className="text-center py-8">Cargando...</div>
        </DialogContent>
      </Dialog>
    );
  }

  const categoryConfig = CATEGORY_CONFIG[idea.category] || CATEGORY_CONFIG.OTRO;
  const statusConfig = STATUS_CONFIG[idea.status] || STATUS_CONFIG.NEW;
  const CategoryIcon = categoryConfig.icon;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2 mb-2">
            <div className={`p-2 rounded-lg ${categoryConfig.color}`}>
              <CategoryIcon className="h-4 w-4 text-white" />
            </div>
            <Badge className={`${statusConfig.color} text-white`}>
              {statusConfig.label}
            </Badge>
            <Badge variant="outline">{categoryConfig.label}</Badge>
          </div>
          <DialogTitle className="text-xl">{idea.title}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Description */}
          <div>
            <h4 className="font-medium mb-2">Descripción</h4>
            <p className="text-muted-foreground whitespace-pre-wrap">{idea.description}</p>
          </div>

          {/* Meta info */}
          <div className="flex flex-wrap gap-4 text-sm">
            <div className="flex items-center gap-2">
              <Avatar className="h-6 w-6">
                <AvatarFallback>{idea.createdBy.name[0]}</AvatarFallback>
              </Avatar>
              <span>{idea.createdBy.name}</span>
            </div>
            <span className="text-muted-foreground">
              {format(new Date(idea.createdAt), 'dd/MM/yyyy HH:mm', { locale: es })}
            </span>
            {idea.machine && (
              <span className="text-muted-foreground">
                Máquina: {idea.machine.name}
              </span>
            )}
          </div>

          {/* Vote button */}
          <div className="flex items-center gap-4">
            <Button
              variant={idea.hasVoted ? 'default' : 'outline'}
              onClick={onVote}
            >
              <ThumbsUp className={`h-4 w-4 mr-2 ${idea.hasVoted ? 'fill-current' : ''}`} />
              {idea.voteCount} votos
            </Button>
          </div>

          {/* Review/Implementation notes */}
          {idea.reviewNotes && (
            <div className="p-3 bg-muted rounded-lg">
              <h4 className="font-medium mb-1">Notas de Revisión</h4>
              <p className="text-sm text-muted-foreground">{idea.reviewNotes}</p>
              {idea.reviewedBy && (
                <p className="text-xs text-muted-foreground mt-1">
                  Por: {idea.reviewedBy.name}
                </p>
              )}
            </div>
          )}

          {idea.implementationNotes && (
            <div className="p-3 bg-green-50 dark:bg-green-950 rounded-lg">
              <h4 className="font-medium mb-1">Notas de Implementación</h4>
              <p className="text-sm text-muted-foreground">{idea.implementationNotes}</p>
              {idea.implementedBy && (
                <p className="text-xs text-muted-foreground mt-1">
                  Por: {idea.implementedBy.name}
                </p>
              )}
            </div>
          )}

          {/* Comments */}
          <div>
            <h4 className="font-medium mb-3">Comentarios ({idea.comments?.length || 0})</h4>

            {/* New comment input */}
            <div className="flex gap-2 mb-4">
              <Input
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder="Escribe un comentario..."
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && newComment.trim()) {
                    commentMutation.mutate(newComment);
                  }
                }}
              />
              <Button
                size="icon"
                onClick={() => newComment.trim() && commentMutation.mutate(newComment)}
                disabled={!newComment.trim() || commentMutation.isPending}
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>

            {/* Comments list */}
            <div className="space-y-3">
              {idea.comments?.map((comment: any) => (
                <div key={comment.id} className="flex gap-3">
                  <Avatar className="h-8 w-8">
                    <AvatarFallback>{comment.user.name[0]}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm">{comment.user.name}</span>
                      <span className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(comment.createdAt), {
                          addSuffix: true,
                          locale: es,
                        })}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground">{comment.content}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
