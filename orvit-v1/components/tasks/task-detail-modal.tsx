"use client";

import { useState, useEffect, useRef } from "react";
import { useConfirm } from '@/components/ui/confirm-dialog-provider';
import {
  X, Calendar, User, CheckCircle, Clock,
  FileText, Send, MessageCircle,
  Download, MoreHorizontal, Trash2, Copy, PlayCircle,
  Circle, Loader2,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
  DialogBody,
  DialogClose,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useTaskStore, Task } from "@/hooks/use-task-store";
import { useToast } from "@/hooks/use-toast";
import { format, isToday, formatDistanceToNow, isPast } from "date-fns";
import { es } from "date-fns/locale";
import { translateTag, getTagColor } from "@/lib/tag-utils";
import { cn } from "@/lib/utils";
import { DEFAULT_COLORS } from "@/lib/colors";

// ─── Helpers ────────────────────────────────────────────────

const PRIORITY_COLORS: Record<string, string> = {
  urgente: DEFAULT_COLORS.kpiNegative,
  alta:    DEFAULT_COLORS.chart4,
  media:   DEFAULT_COLORS.chart1,
  baja:    DEFAULT_COLORS.kpiNeutral,
  high:    DEFAULT_COLORS.chart4,
  medium:  DEFAULT_COLORS.chart1,
  low:     DEFAULT_COLORS.kpiNeutral,
  urgent:  DEFAULT_COLORS.kpiNegative,
};

const PRIORITY_LABELS: Record<string, string> = {
  urgente: 'Urgente', alta: 'Alta', media: 'Media', baja: 'Baja',
  high: 'Alta', medium: 'Media', low: 'Baja', urgent: 'Urgente',
};

const STATUS_DOT_COLOR: Record<string, string> = {
  // Tareas regulares (español)
  pendiente:   DEFAULT_COLORS.chart4,
  'en-curso':  DEFAULT_COLORS.chart1,
  realizada:   DEFAULT_COLORS.kpiPositive,
  cancelada:   DEFAULT_COLORS.kpiNegative,
  // UnifiedTask (lowercase)
  pending:     DEFAULT_COLORS.chart4,
  in_progress: DEFAULT_COLORS.chart1,
  completed:   DEFAULT_COLORS.kpiPositive,
  cancelled:   DEFAULT_COLORS.kpiNegative,
  waiting:     DEFAULT_COLORS.chart4,
  // AgendaTask (UPPERCASE)
  PENDING:     DEFAULT_COLORS.chart4,
  IN_PROGRESS: DEFAULT_COLORS.chart1,
  COMPLETED:   DEFAULT_COLORS.kpiPositive,
  CANCELLED:   DEFAULT_COLORS.kpiNegative,
  WAITING:     DEFAULT_COLORS.chart4,
};

const STATUS_LABELS: Record<string, string> = {
  pendiente:   'Pendiente',
  'en-curso':  'En curso',
  realizada:   'Realizada',
  cancelada:   'Cancelada',
  pending:     'Pendiente',
  in_progress: 'En progreso',
  completed:   'Completada',
  cancelled:   'Cancelada',
  waiting:     'Esperando',
  PENDING:     'Pendiente',
  IN_PROGRESS: 'En progreso',
  COMPLETED:   'Completada',
  CANCELLED:   'Cancelada',
  WAITING:     'Esperando',
};

const AVATAR_COLORS = [
  '#6366f1','#8b5cf6','#ec4899','#f59e0b','#10b981',
  '#06b6d4','#3b82f6','#ef4444','#84cc16','#f97316',
];

function getAvatarColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function getInitials(name: string): string {
  return name.split(' ').slice(0, 2).map((w) => w[0]).join('').toUpperCase();
}

// ─── Types ──────────────────────────────────────────────────

interface ChatMessage {
  id: string;
  content: string;
  userId: string;
  userName: string;
  userEmail: string;
  createdAt: string;
}

// ─── Component ──────────────────────────────────────────────

export function TaskDetailModal() {
  const { selectedTask, setSelectedTask, updateTask, deleteTask } = useTaskStore();
  const { toast } = useToast();
  const confirm = useConfirm();

  const [taskDetails, setTaskDetails] = useState<Task | null>(null);
  const [loading, setLoading] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [sendingMessage, setSendingMessage] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Derive a stable task ID for the dependency array
  const selectedTaskId = selectedTask?.id || (selectedTask as Record<string, unknown>)?.originalId as string | number | undefined;

  // Fetch task details + chat when selectedTask changes
  useEffect(() => {
    if (!selectedTask) {
      setTaskDetails(null);
      setChatMessages([]);
      setNewMessage("");
      return;
    }

    const fetchAll = async () => {
      setLoading(true);
      try {
        const taskId = selectedTask.id || (selectedTask as Record<string, unknown>).originalId;
        const [detailRes, chatRes] = await Promise.all([
          fetch(`/api/tasks/${taskId}`, { credentials: 'include' }),
          fetch(`/api/tasks/${taskId}/comments`, { credentials: 'include' }),
        ]);
        if (detailRes.ok) setTaskDetails(await detailRes.json());
        if (chatRes.ok) setChatMessages(await chatRes.json());
        else setChatMessages([]);
      } catch (err) {
        console.error('Error loading task details', err);
      } finally {
        setLoading(false);
      }
    };

    fetchAll();
  }, [selectedTask, selectedTaskId]);

  // Auto-scroll chat al último mensaje
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  const handleClose = () => {
    setSelectedTask(null);
    setTaskDetails(null);
  };

  const getCurrentUserId = () =>
    typeof window !== 'undefined' ? localStorage.getItem('userId') || '0' : '0';

  const isAssignedUser = () =>
    String(task?.assignedTo?.id) === String(getCurrentUserId());

  const handleToggleSubtask = async (subtaskId: string) => {
    if (!isAssignedUser() || !task) {
      toast({ variant: "destructive", title: "Sin permisos", description: "Solo el asignado puede modificar subtareas." });
      return;
    }
    try {
      const currentCompleted = task.subtasks.find(st => st.id === subtaskId)?.completed;
      const res = await fetch(`/api/tasks/${task.id}/subtasks/${subtaskId}`, {
        method: 'PUT', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ completed: !currentCompleted }),
      });
      if (!res.ok) throw new Error();
      const updated = { ...task, subtasks: task.subtasks.map(st => st.id === subtaskId ? { ...st, completed: !st.completed } : st) };
      setTaskDetails(updated);
      updateTask(task.id, updated);
    } catch {
      toast({ variant: "destructive", title: "Error", description: "No se pudo actualizar la subtarea." });
    }
  };

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !task) return;
    setSendingMessage(true);
    try {
      const res = await fetch(`/api/tasks/${task.id}/comments`, {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: newMessage.trim() }),
      });
      if (res.ok) {
        const newMsg = await res.json();
        setChatMessages(prev => [...prev, newMsg]);
        setNewMessage("");
      } else throw new Error();
    } catch {
      toast({ variant: "destructive", title: "Error", description: "No se pudo enviar el mensaje." });
    } finally {
      setSendingMessage(false);
    }
  };

  const handleStatusChange = async (newStatus: string) => {
    if (!task) return;
    setUpdatingStatus(true);
    try {
      const res = await fetch(`/api/tasks/${task.id}`, {
        method: 'PUT', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        const updated = await res.json();
        setTaskDetails(updated);
        updateTask(task.id, { status: newStatus });
        toast({ title: "Estado actualizado" });
      } else {
        throw new Error();
      }
    } catch {
      toast({ variant: "destructive", title: "Error", description: "No se pudo actualizar el estado." });
    } finally {
      setUpdatingStatus(false);
    }
  };

  const handleCopyLink = () => {
    if (!task) return;
    navigator.clipboard.writeText(window.location.href).then(() => {
      toast({ title: "Enlace copiado" });
    });
  };

  const handleDelete = async () => {
    if (!task) return;
    const ok = await confirm({
      title: 'Eliminar tarea',
      description: '¿Eliminar esta tarea? Esta acción no se puede deshacer.',
      confirmText: 'Eliminar',
      variant: 'destructive',
    });
    if (!ok) return;
    try {
      await deleteTask(task.id);
      handleClose();
      toast({ title: "Tarea eliminada" });
    } catch {
      toast({ variant: "destructive", title: "Error", description: "No se pudo eliminar la tarea." });
    }
  };

  if (!selectedTask) return null;

  const task = taskDetails || selectedTask;

  const priorityKey = task.priority?.toLowerCase();
  const priorityColor = PRIORITY_COLORS[priorityKey] || '#64748b';
  const priorityLabel = PRIORITY_LABELS[priorityKey] || task.priority;

  const statusKey = task.status?.toLowerCase();
  const statusDotColor = STATUS_DOT_COLOR[statusKey] || '#64748b';
  const statusLabel = STATUS_LABELS[statusKey] || task.status;

  const isOverdue =
    task.dueDate &&
    isPast(new Date(task.dueDate)) &&
    task.status !== 'realizada' &&
    task.status !== 'cancelada';

  const subtaskTotal = task.subtasks?.length ?? 0;
  const subtaskDone = task.subtasks?.filter(s => s.completed).length ?? 0;
  const subtaskPct = subtaskTotal > 0 ? Math.round((subtaskDone / subtaskTotal) * 100) : 0;

  const assigneeName = task.assignedTo?.name || 'Sin asignar';
  const creatorName = task.createdBy?.name;
  const showCreator = creatorName && creatorName !== assigneeName;

  const currentUserId = getCurrentUserId();

  const dueDateDisplay = () => {
    if (!task.dueDate) return null;
    const date = new Date(task.dueDate);
    if (isToday(date)) return { label: `Hoy · ${format(date, 'HH:mm')}`, overdue: false };
    if (isOverdue) {
      const ago = formatDistanceToNow(date, { locale: es, addSuffix: false });
      return { label: `Vencida hace ${ago}`, overdue: true };
    }
    return { label: format(date, "d MMM yyyy", { locale: es }), overdue: false };
  };
  const dueDisplay = dueDateDisplay();

  return (
    <Dialog open={!!selectedTask} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent
        size="lg"
        className="p-0 gap-0"
        hideCloseButton
      >
        {/* Accesibilidad */}
        <DialogTitle className="sr-only">{task.title}</DialogTitle>
        <DialogDescription className="sr-only">Detalle de tarea</DialogDescription>

        {/* ── Priority strip ───────────────────────────────── */}
        <div className="h-[3px] w-full flex-shrink-0" style={{ backgroundColor: priorityColor }} />

        {/* ── Header ──────────────────────────────────────── */}
        <div className="px-6 pt-5 pb-4 border-b flex-shrink-0">

          {/* Row 1: status + actions */}
          <div className="flex items-center justify-between gap-3 mb-3">
            {/* Status dot + label — único color en el header */}
            <div className="flex items-center gap-1.5">
              <div
                className="h-2 w-2 rounded-full flex-shrink-0"
                style={{ backgroundColor: statusDotColor }}
              />
              <span className="text-sm font-medium text-muted-foreground">
                {statusLabel}
              </span>
            </div>

            {/* Top-right actions */}
            <div className="flex items-center gap-1">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-muted-foreground hover:text-foreground"
                  >
                    <MoreHorizontal className="h-4 w-4" />
                    <span className="sr-only">Más opciones</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-44">
                  {task.status !== 'en-curso' && task.status !== 'realizada' && task.status !== 'cancelada' && (
                    <DropdownMenuItem onClick={() => handleStatusChange('en-curso')} disabled={updatingStatus}>
                      <PlayCircle className="h-4 w-4 mr-2" />
                      Poner en curso
                    </DropdownMenuItem>
                  )}
                  {task.status !== 'cancelada' && task.status !== 'realizada' && (
                    <DropdownMenuItem onClick={() => handleStatusChange('cancelada')} disabled={updatingStatus}>
                      <Circle className="h-4 w-4 mr-2" />
                      Cancelar tarea
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleCopyLink}>
                    <Copy className="h-4 w-4 mr-2" />
                    Copiar enlace
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className="text-destructive focus:text-destructive"
                    onClick={handleDelete}
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Eliminar tarea
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              {/* X → DialogClose nativo de Radix */}
              <DialogClose asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                  <span className="sr-only">Cerrar</span>
                </Button>
              </DialogClose>
            </div>
          </div>

          {/* Row 2: title */}
          <h2 className="text-xl font-bold leading-tight mb-3 pr-2">{task.title}</h2>

          {/* Row 3: people + created */}
          <div className="flex items-center gap-4 flex-wrap text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <Avatar className="h-5 w-5">
                <AvatarFallback
                  style={{ backgroundColor: getAvatarColor(assigneeName) }}
                  className="text-white text-[9px] font-medium"
                >
                  {getInitials(assigneeName)}
                </AvatarFallback>
              </Avatar>
              <span className="font-medium text-foreground">{assigneeName}</span>
            </div>
            {showCreator && (
              <span className="flex items-center gap-1">
                <User className="h-3.5 w-3.5" />
                por {creatorName}
              </span>
            )}
            <span className="flex items-center gap-1">
              <Calendar className="h-3.5 w-3.5" />
              {format(new Date(task.createdAt), "d MMM yyyy", { locale: es })}
            </span>
          </div>
        </div>

        {/* ── Body ─────────────────────────────────────────── */}
        <DialogBody className="p-0">

          {loading && (
            <div className="flex items-center justify-center h-16">
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
            </div>
          )}

          {/* Properties strip */}
          <div className="border-b divide-y">
            {/* Due date row */}
            <div className="flex items-center px-6 py-3 gap-4">
              <span className="text-xs text-muted-foreground w-28 flex-shrink-0 font-medium">
                Fecha límite
              </span>
              {dueDisplay ? (
                <span className={cn(
                  "text-sm font-medium",
                  dueDisplay.overdue ? "text-destructive" : "text-foreground"
                )}>
                  {dueDisplay.label}
                </span>
              ) : (
                <span className="text-sm text-muted-foreground">Sin fecha</span>
              )}
            </div>

            {/* Priority row */}
            <div className="flex items-center px-6 py-3 gap-4">
              <span className="text-xs text-muted-foreground w-28 flex-shrink-0 font-medium">
                Prioridad
              </span>
              <span
                className="text-sm font-semibold"
                style={{ color: priorityColor }}
              >
                {priorityLabel}
              </span>
            </div>

            {/* Assignee row */}
            <div className="flex items-center px-6 py-3 gap-4">
              <span className="text-xs text-muted-foreground w-28 flex-shrink-0 font-medium">
                Asignado a
              </span>
              <div className="flex items-center gap-2">
                <Avatar className="h-5 w-5">
                  <AvatarFallback
                    style={{ backgroundColor: getAvatarColor(assigneeName) }}
                    className="text-white text-[9px] font-medium"
                  >
                    {getInitials(assigneeName)}
                  </AvatarFallback>
                </Avatar>
                <span className="text-sm font-medium">{assigneeName}</span>
              </div>
            </div>

            {/* Tags row (condicional) */}
            {task.tags && task.tags.length > 0 && (
              <div className="flex items-start px-6 py-3 gap-4">
                <span className="text-xs text-muted-foreground w-28 flex-shrink-0 font-medium pt-0.5">
                  Etiquetas
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {task.tags.map((tag) => (
                    <Badge
                      key={tag}
                      variant="secondary"
                      className={cn("text-[10px] px-1.5 py-0.5", getTagColor(tag))}
                    >
                      #{translateTag(tag)}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Subtask progress row (condicional) */}
            {subtaskTotal > 0 && (
              <div className="flex items-center px-6 py-3 gap-4">
                <span className="text-xs text-muted-foreground w-28 flex-shrink-0 font-medium">
                  Progreso
                </span>
                <div className="flex items-center gap-3 flex-1">
                  <div className="h-1.5 flex-1 max-w-[180px] bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{ backgroundColor: '#10b981', width: `${subtaskPct}%` }}
                    />
                  </div>
                  <span className="text-xs text-muted-foreground tabular-nums">
                    {subtaskDone}/{subtaskTotal} · {subtaskPct}%
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* ── Main content ───────────────────────────────── */}
          <div className="px-6 py-5 space-y-6">

            {/* Description */}
            {task.description && (
              <div>
                <p className="text-xs text-muted-foreground font-medium mb-2 uppercase tracking-wide">
                  Descripción
                </p>
                <p className="text-sm text-foreground/80 bg-muted/40 rounded-lg px-4 py-3 leading-relaxed whitespace-pre-wrap">
                  {task.description}
                </p>
              </div>
            )}

            {/* Subtasks */}
            {subtaskTotal > 0 && (
              <div>
                <p className="text-xs text-muted-foreground font-medium mb-3 uppercase tracking-wide">
                  Subtareas
                </p>
                <div className="space-y-1.5">
                  {task.subtasks.map((st) => (
                    <label
                      key={st.id}
                      className="flex items-center gap-2.5 py-1.5 px-3 rounded-lg hover:bg-muted/40 cursor-pointer transition-colors"
                    >
                      <Checkbox
                        checked={st.completed}
                        onCheckedChange={() => handleToggleSubtask(st.id)}
                        disabled={!isAssignedUser()}
                        className="h-4 w-4"
                      />
                      <span className={cn(
                        "text-sm select-none",
                        st.completed && "line-through text-muted-foreground"
                      )}>
                        {st.title}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {/* Files */}
            {task.files && task.files.length > 0 && (
              <div>
                <p className="text-xs text-muted-foreground font-medium mb-2 uppercase tracking-wide">
                  Archivos ({task.files.length})
                </p>
                <div className="flex flex-wrap gap-2">
                  {task.files.map((file) => (
                    <button
                      key={file.id}
                      onClick={() => window.open(file.url, '_blank')}
                      className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-md bg-muted hover:bg-muted/70 transition-colors border"
                    >
                      <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="max-w-[160px] truncate">{file.name}</span>
                      <Download className="h-3 w-3 text-muted-foreground" />
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Chat */}
            <div>
              <p className="text-xs text-muted-foreground font-medium mb-3 uppercase tracking-wide flex items-center gap-1.5">
                <MessageCircle className="h-3.5 w-3.5" />
                Comentarios {chatMessages.length > 0 && `(${chatMessages.length})`}
              </p>

              {/* Messages */}
              <div className="space-y-3 mb-3 max-h-[220px] overflow-y-auto">
                {chatMessages.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-6">
                    Sin comentarios aún.
                  </p>
                ) : (
                  chatMessages.map((msg) => {
                    const isOwn = msg.userId === currentUserId;
                    return (
                      <div
                        key={msg.id}
                        className={cn("flex gap-2.5", isOwn ? "flex-row-reverse" : "flex-row")}
                      >
                        <Avatar className="h-6 w-6 flex-shrink-0 mt-0.5">
                          <AvatarFallback
                            style={{ backgroundColor: getAvatarColor(msg.userName) }}
                            className="text-white text-[9px] font-medium"
                          >
                            {getInitials(msg.userName)}
                          </AvatarFallback>
                        </Avatar>
                        <div className={cn("max-w-[75%] flex flex-col", isOwn ? "items-end" : "items-start")}>
                          <div className={cn(
                            "rounded-2xl px-3 py-2 text-sm",
                            isOwn
                              ? "bg-primary text-primary-foreground rounded-tr-sm"
                              : "bg-muted rounded-tl-sm"
                          )}>
                            {!isOwn && (
                              <p className="text-[10px] font-semibold mb-0.5 opacity-60">
                                {msg.userName}
                              </p>
                            )}
                            <p className="leading-relaxed">{msg.content}</p>
                          </div>
                          <p className="text-[10px] text-muted-foreground mt-0.5 px-1">
                            {format(new Date(msg.createdAt), 'HH:mm · d MMM', { locale: es })}
                          </p>
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={chatEndRef} />
              </div>

              {/* Input */}
              <div className="flex gap-2 items-center">
                <Input
                  placeholder="Agregar un comentario…"
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSendMessage()}
                  disabled={sendingMessage}
                  className="flex-1 h-8 text-sm"
                />
                <Button
                  size="sm"
                  className="h-8 w-8 p-0 flex-shrink-0"
                  onClick={handleSendMessage}
                  disabled={sendingMessage || !newMessage.trim()}
                  aria-label="Enviar comentario"
                >
                  <Send className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          </div>
        </DialogBody>

        {/* ── Footer ───────────────────────────────────────── */}
        <div className="border-t px-6 py-3 flex items-center gap-2 flex-shrink-0">

          {task.status !== 'realizada' && task.status !== 'cancelada' && (
            <Button
              size="sm"
              onClick={() => handleStatusChange('realizada')}
              disabled={updatingStatus}
              className="gap-1.5"
            >
              <CheckCircle className="h-4 w-4" />
              Marcar realizada
            </Button>
          )}

          {task.status === 'pendiente' && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleStatusChange('en-curso')}
              disabled={updatingStatus}
              className="gap-1.5"
            >
              <PlayCircle className="h-4 w-4" />
              En curso
            </Button>
          )}

          {task.status === 'realizada' && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleStatusChange('pendiente')}
              disabled={updatingStatus}
              className="gap-1.5"
            >
              <Clock className="h-4 w-4" />
              Reabrir
            </Button>
          )}

          {task.status === 'en-curso' && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleStatusChange('pendiente')}
              disabled={updatingStatus}
            >
              Pausar
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
