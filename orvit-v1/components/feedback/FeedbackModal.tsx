'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Bug, Lightbulb, Sparkles, Info, ArrowUp, Minus, ArrowDown,
  Plus, Clock, CheckCircle2, XCircle, Loader2, ChevronLeft,
  MessageSquare, Trash2, Send, Inbox, RotateCw,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogBody,
  DialogFooter,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { useConfirm } from '@/components/ui/confirm-dialog-provider';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';

// Types
type FeedbackType = 'problema' | 'mejora' | 'nueva-idea';
type FeedbackPriority = 'baja' | 'media' | 'alta';
type FeedbackStatus = 'pendiente' | 'en-progreso' | 'completado' | 'rechazado';
type View = 'list' | 'new-type' | 'new-form' | 'detail';

interface FeedbackItem {
  id: number;
  type: FeedbackType;
  priority: FeedbackPriority;
  status: FeedbackStatus;
  title: string;
  description: string;
  adminResponse: string | null;
  read: boolean;
  createdAt: string;
  resolvedAt: string | null;
  user: { id: number; name: string; email: string; avatar: string | null };
}

interface FeedbackModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// Config
const typeConfig: Record<FeedbackType, { label: string; icon: typeof Bug; color: string; bgColor: string; borderColor: string }> = {
  'problema':   { label: 'Problema',   icon: Bug,       color: 'text-destructive',   bgColor: 'bg-destructive/10',   borderColor: 'border-destructive/30'  },
  'mejora':     { label: 'Mejora',     icon: Lightbulb, color: 'text-warning', bgColor: 'bg-warning/10', borderColor: 'border-warning/30' },
  'nueva-idea': { label: 'Nueva idea', icon: Sparkles,  color: 'text-info',  bgColor: 'bg-info/10',  borderColor: 'border-info/30' },
};

const typeDescriptions: Record<FeedbackType, string> = {
  'problema': 'Algo no funciona bien o encontré un error',
  'mejora': 'Algo existente podría funcionar mejor',
  'nueva-idea': 'Tengo una idea para algo nuevo',
};

const statusConfig: Record<FeedbackStatus, { label: string; icon: typeof Clock; color: string; badgeVariant: 'pending' | 'in_progress' | 'completed' | 'cancelled' }> = {
  'pendiente':   { label: 'Pendiente',   icon: Clock,        color: 'text-warning-muted-foreground', badgeVariant: 'pending'     },
  'en-progreso': { label: 'En progreso', icon: Loader2,      color: 'text-info-muted-foreground',     badgeVariant: 'in_progress' },
  'completado':  { label: 'Completado',  icon: CheckCircle2, color: 'text-success',   badgeVariant: 'completed'   },
  'rechazado':   { label: 'Rechazado',   icon: XCircle,      color: 'text-destructive',       badgeVariant: 'cancelled'   },
};

const priorityConfig: Record<FeedbackPriority, { label: string; icon: typeof ArrowUp; color: string }> = {
  'baja':  { label: 'Baja',  icon: ArrowDown, color: 'text-muted-foreground' },
  'media': { label: 'Media', icon: Minus,     color: 'text-warning'       },
  'alta':  { label: 'Alta',  icon: ArrowUp,   color: 'text-destructive'         },
};

// Helpers
const safeType = (t: string): FeedbackType =>
  t in typeConfig ? t as FeedbackType : 'mejora';
const safeStatus = (s: string): FeedbackStatus =>
  s in statusConfig ? s as FeedbackStatus : 'pendiente';
const safePriority = (p: string): FeedbackPriority =>
  p in priorityConfig ? p as FeedbackPriority : 'media';

// Sub-components
function FeedbackCard({ fb, onClick }: { fb: FeedbackItem; onClick: () => void }) {
  const type = typeConfig[safeType(fb.type)];
  const status = statusConfig[safeStatus(fb.status)];
  const priority = priorityConfig[safePriority(fb.priority)];
  const TypeIcon = type.icon;
  const StatusIcon = status.icon;
  const PriorityIcon = priority.icon;

  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full flex items-start gap-3 p-3 rounded-lg border text-left transition-all hover:bg-accent/50 group',
        !fb.read ? 'border-primary/30 bg-primary/[0.03]' : 'border-border'
      )}
    >
      <div className={cn('mt-0.5 p-1.5 rounded-lg border shrink-0', type.bgColor, type.borderColor)}>
        <TypeIcon className={cn('h-4 w-4', type.color)} />
      </div>
      <div className="flex-1 min-w-0 space-y-1">
        <div className="flex items-center gap-2">
          <p className={cn('text-sm truncate', !fb.read ? 'font-semibold' : 'font-medium')}>
            {fb.title}
          </p>
          {!fb.read && <span className="h-2 w-2 rounded-full bg-primary shrink-0" />}
        </div>
        <p className="text-xs text-muted-foreground line-clamp-1">{fb.description}</p>
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant={status.badgeVariant} size="sm" className="gap-1">
            <StatusIcon className={cn('h-3 w-3', safeStatus(fb.status) === 'en-progreso' && 'animate-spin')} />
            {status.label}
          </Badge>
          <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
            <PriorityIcon className={cn('h-3 w-3', priority.color)} />
            {priority.label}
          </div>
          <span className="text-[10px] text-muted-foreground">
            {fb.user.name} · {formatDistanceToNow(new Date(fb.createdAt), { addSuffix: true, locale: es })}
          </span>
          {fb.adminResponse && (
            <Badge variant="outline" size="sm" className="gap-1 text-[10px]">
              <MessageSquare className="h-2.5 w-2.5" />
              Respondido
            </Badge>
          )}
        </div>
      </div>
    </button>
  );
}

function EmptyState({ message, onAction }: { message: string; onAction?: () => void }) {
  return (
    <div className="text-center py-10">
      <div className="h-12 w-12 mx-auto mb-3 rounded-full bg-muted flex items-center justify-center">
        <Inbox className="h-6 w-6 text-muted-foreground/50" />
      </div>
      <p className="text-sm text-muted-foreground mb-3">{message}</p>
      {onAction && (
        <Button variant="outline" size="sm" onClick={onAction} className="gap-1.5">
          <Plus className="h-3.5 w-3.5" />
          Nuevo feedback
        </Button>
      )}
    </div>
  );
}

export function FeedbackModal({ open, onOpenChange }: FeedbackModalProps) {
  const confirm = useConfirm();
  // State
  const [view, setView] = useState<View>('list');
  const [feedbacks, setFeedbacks] = useState<FeedbackItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedFeedback, setSelectedFeedback] = useState<FeedbackItem | null>(null);
  const [activeTab, setActiveTab] = useState('pendientes');

  // Form state
  const [selectedType, setSelectedType] = useState<FeedbackType | null>(null);
  const [priority, setPriority] = useState<FeedbackPriority>('media');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Admin response state
  const [adminResponse, setAdminResponse] = useState('');
  const [updatingStatus, setUpdatingStatus] = useState(false);

  // Fetch feedbacks
  const fetchFeedbacks = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/feedback');
      if (!res.ok) throw new Error();
      const data = await res.json();
      setFeedbacks(data.feedbacks || []);
    } catch {
      toast.error('Error al cargar feedbacks');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) {
      fetchFeedbacks();
      setView('list');
    }
  }, [open, fetchFeedbacks]);

  // Computed
  const counts = useMemo(() => {
    const all = feedbacks.map(fb => ({ ...fb, status: safeStatus(fb.status) }));
    return {
      pendientes: all.filter(f => f.status === 'pendiente').length,
      enProgreso: all.filter(f => f.status === 'en-progreso').length,
      resueltos: all.filter(f => f.status === 'completado' || f.status === 'rechazado').length,
      todos: all.length,
    };
  }, [feedbacks]);

  const filteredByTab = useMemo(() => {
    const all = feedbacks.map(fb => ({
      ...fb,
      type: safeType(fb.type),
      status: safeStatus(fb.status),
      priority: safePriority(fb.priority),
    }));
    switch (activeTab) {
      case 'pendientes': return all.filter(f => f.status === 'pendiente');
      case 'en-progreso': return all.filter(f => f.status === 'en-progreso');
      case 'resueltos': return all.filter(f => f.status === 'completado' || f.status === 'rechazado');
      default: return all;
    }
  }, [feedbacks, activeTab]);

  // Handlers
  const resetForm = () => {
    setSelectedType(null);
    setPriority('media');
    setTitle('');
    setDescription('');
    setSubmitting(false);
  };

  const handleClose = () => {
    setView('list');
    resetForm();
    setSelectedFeedback(null);
    setAdminResponse('');
    onOpenChange(false);
  };

  const handleSubmit = async () => {
    if (!selectedType || !title.trim() || !description.trim()) {
      toast.warning('Completá todos los campos');
      return;
    }
    setSubmitting(true);
    toast.loading('Enviando feedback...', { id: 'feedback-submit' });
    try {
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: selectedType, priority, title: title.trim(), description: description.trim() }),
      });
      if (!res.ok) throw new Error();
      toast.success('¡Feedback enviado!', { id: 'feedback-submit' });
      resetForm();
      setView('list');
      setActiveTab('pendientes');
      fetchFeedbacks();
    } catch {
      toast.error('Error al enviar feedback', { id: 'feedback-submit' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateStatus = async (id: number, status: FeedbackStatus) => {
    setUpdatingStatus(true);
    try {
      const res = await fetch(`/api/feedback/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, read: true }),
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setSelectedFeedback(data.feedback);
      setFeedbacks(prev => prev.map(f => f.id === id ? data.feedback : f));
      toast.success(`Marcado como "${statusConfig[status].label}"`);
    } catch {
      toast.error('Error al actualizar');
    } finally {
      setUpdatingStatus(false);
    }
  };

  const handleSendResponse = async () => {
    if (!selectedFeedback || !adminResponse.trim()) return;
    setUpdatingStatus(true);
    try {
      const res = await fetch(`/api/feedback/${selectedFeedback.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adminResponse: adminResponse.trim(), read: true }),
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setSelectedFeedback(data.feedback);
      setFeedbacks(prev => prev.map(f => f.id === selectedFeedback.id ? data.feedback : f));
      setAdminResponse('');
      toast.success('Respuesta enviada');
    } catch {
      toast.error('Error al enviar respuesta');
    } finally {
      setUpdatingStatus(false);
    }
  };

  const handleDelete = async (id: number) => {
    const ok = await confirm({
      title: 'Eliminar feedback',
      description: '¿Eliminar este feedback? Esta acción no se puede deshacer.',
      confirmText: 'Eliminar',
      variant: 'destructive',
    });
    if (!ok) return;
    try {
      const res = await fetch(`/api/feedback/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error();
      setFeedbacks(prev => prev.filter(f => f.id !== id));
      if (selectedFeedback?.id === id) {
        setSelectedFeedback(null);
        setView('list');
      }
      toast.success('Feedback eliminado');
    } catch {
      toast.error('Error al eliminar');
    }
  };

  const openDetail = (fb: FeedbackItem) => {
    const normalized = { ...fb, type: safeType(fb.type), status: safeStatus(fb.status), priority: safePriority(fb.priority) };
    setSelectedFeedback(normalized);
    setAdminResponse(normalized.adminResponse || '');
    setView('detail');
    if (!fb.read) {
      fetch(`/api/feedback/${fb.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ read: true }),
      }).then(() => {
        setFeedbacks(prev => prev.map(f => f.id === fb.id ? { ...f, read: true } : f));
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) handleClose(); else onOpenChange(o); }}>
      <DialogContent size="lg">

        {/* ===================== LIST VIEW ===================== */}
        {view === 'list' && (
          <>
            <DialogHeader>
              <div className="flex items-center justify-between">
                <div>
                  <DialogTitle className="flex items-center gap-2">
                    <MessageSquare className="h-5 w-5" />
                    Feedback
                    {counts.pendientes > 0 && (
                      <Badge variant="pending" size="sm">{counts.pendientes} nuevo{counts.pendientes !== 1 ? 's' : ''}</Badge>
                    )}
                  </DialogTitle>
                  <DialogDescription>
                    Sugerencias, problemas e ideas de los usuarios
                  </DialogDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="sm" onClick={fetchFeedbacks} disabled={loading} className="h-8 w-8 p-0">
                    <RotateCw className={cn('h-4 w-4', loading && 'animate-spin')} />
                  </Button>
                  <Button size="sm" onClick={() => setView('new-type')} className="gap-1.5">
                    <Plus className="h-4 w-4" />
                    Nuevo
                  </Button>
                </div>
              </div>
            </DialogHeader>

            <DialogBody>
              <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList className="w-full">
                  <TabsTrigger value="pendientes" className="flex-1 gap-1.5">
                    <Clock className="h-3.5 w-3.5" />
                    Pendientes
                    {counts.pendientes > 0 && (
                      <span className="ml-0.5 text-[10px] bg-warning text-warning-foreground px-1.5 py-0.5 rounded-full font-semibold leading-none">{counts.pendientes}</span>
                    )}
                  </TabsTrigger>
                  <TabsTrigger value="en-progreso" className="flex-1 gap-1.5">
                    <Loader2 className="h-3.5 w-3.5" />
                    En progreso
                    {counts.enProgreso > 0 && (
                      <span className="ml-0.5 text-[10px] bg-info text-info-foreground px-1.5 py-0.5 rounded-full font-semibold leading-none">{counts.enProgreso}</span>
                    )}
                  </TabsTrigger>
                  <TabsTrigger value="resueltos" className="flex-1 gap-1.5">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Resueltos
                    {counts.resueltos > 0 && (
                      <span className="ml-0.5 text-[10px] bg-emerald-500 text-white px-1.5 py-0.5 rounded-full font-semibold leading-none">{counts.resueltos}</span>
                    )}
                  </TabsTrigger>
                  <TabsTrigger value="todos" className="flex-1 gap-1.5">
                    Todos
                    <span className="ml-0.5 text-[10px] bg-zinc-500 text-white px-1.5 py-0.5 rounded-full font-semibold leading-none">{counts.todos}</span>
                  </TabsTrigger>
                </TabsList>

                {loading ? (
                  <div className="flex items-center justify-center py-12">
                    <div className="flex flex-col items-center gap-2">
                      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                      <p className="text-xs text-muted-foreground">Cargando...</p>
                    </div>
                  </div>
                ) : (
                  <>
                    <TabsContent value="pendientes">
                      {filteredByTab.length === 0
                        ? <EmptyState message="No hay feedbacks pendientes" onAction={() => setView('new-type')} />
                        : <div className="space-y-2">{filteredByTab.map(fb => <FeedbackCard key={fb.id} fb={fb} onClick={() => openDetail(fb)} />)}</div>
                      }
                    </TabsContent>
                    <TabsContent value="en-progreso">
                      {filteredByTab.length === 0
                        ? <EmptyState message="No hay feedbacks en progreso" />
                        : <div className="space-y-2">{filteredByTab.map(fb => <FeedbackCard key={fb.id} fb={fb} onClick={() => openDetail(fb)} />)}</div>
                      }
                    </TabsContent>
                    <TabsContent value="resueltos">
                      {filteredByTab.length === 0
                        ? <EmptyState message="No hay feedbacks resueltos aún" />
                        : <div className="space-y-2">{filteredByTab.map(fb => <FeedbackCard key={fb.id} fb={fb} onClick={() => openDetail(fb)} />)}</div>
                      }
                    </TabsContent>
                    <TabsContent value="todos">
                      {filteredByTab.length === 0
                        ? <EmptyState message="No hay feedbacks todavía" onAction={() => setView('new-type')} />
                        : <div className="space-y-2">{filteredByTab.map(fb => <FeedbackCard key={fb.id} fb={fb} onClick={() => openDetail(fb)} />)}</div>
                      }
                    </TabsContent>
                  </>
                )}
              </Tabs>
            </DialogBody>
          </>
        )}

        {/* ===================== NEW - TYPE ===================== */}
        {view === 'new-type' && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <button type="button" onClick={() => setView('list')} className="hover:bg-accent rounded-md p-1 -ml-1 transition-colors">
                  <ChevronLeft className="h-4 w-4" />
                </button>
                Nuevo Feedback
              </DialogTitle>
              <DialogDescription>¿Qué tipo de feedback querés enviar?</DialogDescription>
            </DialogHeader>
            <DialogBody>
              <div className="space-y-2">
                {(Object.entries(typeConfig) as [FeedbackType, typeof typeConfig[FeedbackType]][]).map(([value, cfg]) => {
                  const Icon = cfg.icon;
                  return (
                    <button
                      key={value}
                      onClick={() => { setSelectedType(value); setView('new-form'); }}
                      className={cn(
                        'w-full flex items-center gap-4 p-4 rounded-lg border transition-all duration-150 hover:shadow-sm',
                        cfg.bgColor, cfg.borderColor, 'hover:brightness-95'
                      )}
                    >
                      <div className={cn('h-10 w-10 rounded-lg flex items-center justify-center shrink-0', cfg.bgColor)}>
                        <Icon className={cn('h-5 w-5', cfg.color)} />
                      </div>
                      <div className="text-left">
                        <p className="font-medium text-foreground">{cfg.label}</p>
                        <p className="text-sm text-muted-foreground">{typeDescriptions[value]}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </DialogBody>
          </>
        )}

        {/* ===================== NEW - FORM ===================== */}
        {view === 'new-form' && selectedType && (() => {
          const t = typeConfig[selectedType];
          const TypeIcon = t.icon;
          return (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <button type="button" onClick={() => setView('new-type')} className="hover:bg-accent rounded-md p-1 -ml-1 transition-colors">
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  Nuevo Feedback
                </DialogTitle>
                <DialogDescription>Completá los detalles</DialogDescription>
              </DialogHeader>
              <DialogBody>
                <div className="space-y-4">
                  {/* Tipo seleccionado */}
                  <div className={cn('flex items-center gap-2 px-3 py-2 rounded-lg border', t.bgColor, t.borderColor)}>
                    <TypeIcon className={cn('h-4 w-4', t.color)} />
                    <span className="text-sm font-medium">{t.label}</span>
                    <button type="button" onClick={() => setView('new-type')} className="ml-auto text-xs text-muted-foreground hover:text-foreground transition-colors">
                      Cambiar
                    </button>
                  </div>

                  {/* Prioridad */}
                  <div>
                    <Label className="mb-2 block text-xs uppercase tracking-wider text-muted-foreground">Prioridad</Label>
                    <div className="flex gap-1.5">
                      {(Object.entries(priorityConfig) as [FeedbackPriority, typeof priorityConfig[FeedbackPriority]][]).map(([value, cfg]) => {
                        const Icon = cfg.icon;
                        return (
                          <button
                            key={value}
                            type="button"
                            onClick={() => setPriority(value)}
                            className={cn(
                              'flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm border transition-all flex-1 justify-center',
                              priority === value
                                ? 'bg-accent border-border font-medium shadow-sm'
                                : 'border-transparent hover:bg-accent/50'
                            )}
                          >
                            <Icon className={cn('h-3.5 w-3.5', cfg.color)} />
                            {cfg.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <Separator />

                  <div>
                    <Label htmlFor="fb-title" className="mb-1.5 block">Título</Label>
                    <Input id="fb-title" placeholder="Resumen breve del feedback" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={150} />
                  </div>

                  <div>
                    <Label htmlFor="fb-desc" className="mb-1.5 block">Descripción</Label>
                    <Textarea id="fb-desc" placeholder="Contanos con detalle qué encontraste, qué mejorarías o qué idea tenés..." value={description} onChange={(e) => setDescription(e.target.value)} rows={4} />
                  </div>

                  <div className="flex items-start gap-2 p-3 rounded-lg bg-info/10 border border-info/20 text-sm">
                    <Info className="h-4 w-4 text-info mt-0.5 shrink-0" />
                    <p className="text-info-muted-foreground">Tu feedback será revisado por el equipo de desarrollo.</p>
                  </div>
                </div>
              </DialogBody>
              <DialogFooter>
                <Button variant="outline" onClick={() => { resetForm(); setView('list'); }}>Cancelar</Button>
                <Button onClick={handleSubmit} disabled={submitting || !title.trim() || !description.trim()} className="gap-1.5">
                  {submitting ? <><Loader2 className="h-4 w-4 animate-spin" /> Enviando...</> : <><Send className="h-4 w-4" /> Enviar feedback</>}
                </Button>
              </DialogFooter>
            </>
          );
        })()}

        {/* ===================== DETAIL VIEW ===================== */}
        {view === 'detail' && selectedFeedback && (() => {
          const t = typeConfig[safeType(selectedFeedback.type)];
          const p = priorityConfig[safePriority(selectedFeedback.priority)];
          const s = statusConfig[safeStatus(selectedFeedback.status)];
          const TypeIcon = t.icon;
          const PriorityIcon = p.icon;

          return (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <button type="button" onClick={() => { setSelectedFeedback(null); setView('list'); }} className="hover:bg-accent rounded-md p-1 -ml-1 transition-colors">
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  Detalle
                  <div className="flex-1" />
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive hover:text-destructive hover:bg-destructive/10 h-8 w-8 p-0"
                    onClick={() => handleDelete(selectedFeedback.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </DialogTitle>
              </DialogHeader>
              <DialogBody>
                <div className="space-y-4">
                  {/* Info del feedback */}
                  <div className="space-y-3">
                    <div className="flex items-start gap-3">
                      <div className={cn('p-2 rounded-lg border shrink-0', t.bgColor, t.borderColor)}>
                        <TypeIcon className={cn('h-5 w-5', t.color)} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-base leading-tight">{selectedFeedback.title}</h3>
                        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                          <Badge variant={s.badgeVariant} size="sm" className="gap-1">
                            {s.label}
                          </Badge>
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <PriorityIcon className={cn('h-3 w-3', p.color)} />
                            Prioridad {p.label}
                          </div>
                          <span className="text-xs text-muted-foreground">
                            · {selectedFeedback.user.name} · {formatDistanceToNow(new Date(selectedFeedback.createdAt), { addSuffix: true, locale: es })}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="rounded-lg bg-muted/50 p-3">
                      <p className="text-sm whitespace-pre-wrap leading-relaxed">{selectedFeedback.description}</p>
                    </div>
                  </div>

                  <Separator />

                  {/* Cambiar estado */}
                  <div className="space-y-2">
                    <Label className="text-xs uppercase tracking-wider text-muted-foreground">Cambiar estado</Label>
                    <div className="grid grid-cols-4 gap-1.5">
                      {(Object.entries(statusConfig) as [FeedbackStatus, typeof statusConfig[FeedbackStatus]][]).map(([value, cfg]) => {
                        const Icon = cfg.icon;
                        const isActive = safeStatus(selectedFeedback.status) === value;
                        return (
                          <Button
                            key={value}
                            variant={isActive ? 'default' : 'outline'}
                            size="sm"
                            className={cn('gap-1.5 text-xs', !isActive && 'hover:bg-accent')}
                            disabled={updatingStatus}
                            onClick={() => handleUpdateStatus(selectedFeedback.id, value)}
                          >
                            <Icon className={cn(
                              'h-3.5 w-3.5',
                              isActive ? '' : cfg.color,
                              value === 'en-progreso' && isActive && 'animate-spin',
                            )} />
                            {cfg.label}
                          </Button>
                        );
                      })}
                    </div>
                    {selectedFeedback.resolvedAt && (
                      <p className="text-[11px] text-muted-foreground">
                        Resuelto {formatDistanceToNow(new Date(selectedFeedback.resolvedAt), { addSuffix: true, locale: es })}
                      </p>
                    )}
                  </div>

                  <Separator />

                  {/* Respuesta admin */}
                  <div className="space-y-2">
                    <Label className="text-xs uppercase tracking-wider text-muted-foreground">Tu respuesta</Label>

                    {selectedFeedback.adminResponse && (
                      <div className="p-3 rounded-lg border bg-primary/5 border-primary/20 text-sm whitespace-pre-wrap leading-relaxed">
                        {selectedFeedback.adminResponse}
                      </div>
                    )}

                    <div className="flex gap-2">
                      <Textarea
                        placeholder={selectedFeedback.adminResponse ? 'Actualizar respuesta...' : 'Escribí una respuesta al usuario...'}
                        value={adminResponse}
                        onChange={(e) => setAdminResponse(e.target.value)}
                        rows={2}
                        className="flex-1"
                      />
                      <Button
                        size="sm"
                        className="self-end gap-1.5 shrink-0"
                        disabled={!adminResponse.trim() || updatingStatus}
                        onClick={handleSendResponse}
                      >
                        <Send className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </div>
              </DialogBody>
            </>
          );
        })()}

      </DialogContent>
    </Dialog>
  );
}
