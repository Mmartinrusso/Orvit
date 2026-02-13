"use client";

import { useState } from "react";
import { CheckCircle, Eye, MoreHorizontal, PencilLine, Trash2 } from "lucide-react";
import { StatusBadge } from "@/components/ui/status-badge";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useTaskStore, Task } from "@/hooks/use-task-store";
import { EditTaskModal } from "./edit-task-modal";
import { toZonedTime } from 'date-fns-tz';
import { translateTag, getTagColor } from "@/lib/tag-utils";

const ARG_TIMEZONE = 'America/Argentina/Buenos_Aires';

function formatDateArg(dateStr: string | undefined) {
  if (!dateStr) return "-";
  const zoned = toZonedTime(new Date(dateStr), ARG_TIMEZONE);
  zoned.setHours(0, 0, 0, 0);
  return zoned.toLocaleDateString('es-AR');
}

// Componente PriorityBadge simple
function PriorityBadge({ priority, className }: { priority: string; className?: string }) {
  const getColor = (priority: string) => {
    switch (priority.toLowerCase()) {
      case 'alta':
      case 'high': 
        return 'text-red-500';
      case 'media':
      case 'medium': 
        return 'text-yellow-500';
      case 'baja':
      case 'low': 
        return 'text-green-500';
      default: 
        return 'text-gray-500';
    }
  };

  const getPriorityText = (priority: string) => {
    switch (priority.toLowerCase()) {
      case 'alta':
      case 'high':
        return 'Alta';
      case 'media':
      case 'medium':
        return 'Media';
      case 'baja':
      case 'low':
        return 'Baja';
      default:
        return priority;
    }
  };

  return (
    <span className={`text-xs font-medium ${getColor(priority)} ${className}`}>
      {getPriorityText(priority)}
    </span>
  );
}

// Componente ProgressBar simple
function ProgressBar({ value }: { value: number }) {
  return (
    <div className="w-full bg-muted rounded-full h-2">
      <div 
        className="bg-primary h-2 rounded-full transition-all duration-300" 
        style={{ width: `${value}%` }}
      />
    </div>
  );
}

function initials(name?: string) {
  if (!name) return "—";
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase()).join("") || "—";
}

function dueChip(dueDate?: string, status?: string) {
  if (!dueDate) return null;
  if (status === "realizada" || status === "cancelada") return null;

  const now = new Date();
  const due = toZonedTime(new Date(dueDate), ARG_TIMEZONE);
  const today = toZonedTime(now, ARG_TIMEZONE);
  due.setHours(0, 0, 0, 0);
  today.setHours(0, 0, 0, 0);

  const diffDays = Math.round((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays < 0) return { label: "Atrasada", tone: "destructive" as const };
  if (diffDays === 0) return { label: "Vence hoy", tone: "warning" as const };
  if (diffDays <= 3) return { label: `Vence en ${diffDays}d`, tone: "neutral" as const };
  return { label: `Vence en ${diffDays}d`, tone: "muted" as const };
}

interface TaskCardProps {
  task: Task;
  onDelete?: () => void;
}

export function TaskCard({ task }: TaskCardProps) {
  const { setSelectedTask, deleteTask, updateTask } = useTaskStore();
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const { toast } = useToast();
  
  // Calcular progreso real de subtareas
  const getSubtasksProgress = () => {
    if (!task || !Array.isArray(task.subtasks) || task.subtasks.length === 0) return 0;
    const completed = task.subtasks.filter((s) => s.completed).length;
    return Math.round((completed / task.subtasks.length) * 100);
  };
  
  const handleMarkAsRealizada = async () => {
    if (!task.assignedTo?.id) {
      toast({
        variant: "destructive",
        title: "No se puede completar",
        description: "La tarea debe tener un usuario asignado.",
      });
      return;
    }
    const nueva = task.status === 'realizada' ? 'en-curso' : 'realizada';
    try {
      const response = await fetch(`/api/tasks/${task.id}`, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...task,
          status: nueva,
          progress: nueva === 'realizada' ? 100 : task.progress,
          assignedToId: Number(task.assignedTo.id),
        }),
      });

      if (!response.ok) throw new Error('Error al actualizar la tarea');
      
      const updatedTask = await response.json();
      updateTask(task.id, {
        ...task,
        ...updatedTask,
        status: nueva,
        progress: nueva === 'realizada' ? 100 : task.progress
      });
      
      toast({
        title: "Tarea actualizada",
        description: `La tarea ha sido marcada como ${nueva === 'realizada' ? 'realizada' : 'en curso'}.`,
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "No se pudo actualizar la tarea. Por favor, intenta nuevamente.",
      });
    }
  };

  const handleDelete = async () => {
    try {
      const response = await fetch(`/api/tasks/${task.id}`, {
        method: 'DELETE',
        credentials: "include",
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Error al eliminar la tarea');
      }

      const result = await response.json();
      deleteTask(task.id);
      
      toast({
        title: "✅ Tarea eliminada",
        description: result.message || "La tarea ha sido eliminada y guardada en el historial.",
      });
    } catch (error) {
      console.error('Error al eliminar tarea:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: error instanceof Error ? error.message : "No se pudo eliminar la tarea. Por favor, intenta nuevamente.",
      });
    }
  };

  // Obtener el usuario actual y normalizar a número
  const currentUserId = typeof window !== 'undefined' ? Number(localStorage.getItem('userId') || '0') : 0;
  const isSolicitante = currentUserId > 0 && Number(task.createdBy?.id) === currentUserId;
  const isAsignado = currentUserId > 0 && Number(task.assignedTo?.id) === currentUserId;

  return (
    <>
      <div className="bg-card border border-border rounded-lg overflow-hidden flex flex-col">
        <div className="p-4 flex-1 space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h3 className="text-base font-semibold leading-snug line-clamp-1">{task.title}</h3>
              <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                <div className="flex items-center gap-1.5 min-w-0">
                  <Avatar className="h-6 w-6">
                    <AvatarFallback className="text-[11px]">{initials(task.assignedTo?.name)}</AvatarFallback>
                  </Avatar>
                  <span className="truncate">Asignado: {task.assignedTo?.name || "—"}</span>
                </div>
                <span className="text-muted-foreground/60">•</span>
                <div className="flex items-center gap-1.5 min-w-0">
                  <Avatar className="h-6 w-6">
                    <AvatarFallback className="text-[11px]">{initials(task.createdBy?.name)}</AvatarFallback>
                  </Avatar>
                  <span className="truncate">Solicitante: {task.createdBy?.name || "—"}</span>
                </div>
              </div>
            </div>
            <div className="shrink-0">
              <StatusBadge status={task.status} className="shrink-0" />
            </div>
          </div>

          {task.description ? (
            <p className="text-sm text-muted-foreground line-clamp-2">{task.description}</p>
          ) : null}

          <div className="flex items-center justify-between gap-3">
            <div className="flex flex-wrap gap-1 min-w-0">
              {(task.tags ?? []).slice(0, 3).map((tag) => (
                <span key={tag} className={`px-2 py-0.5 text-xs rounded-md font-medium ${getTagColor(tag)}`}>
                  {translateTag(tag)}
                </span>
              ))}
              {(task.tags ?? []).length > 3 ? (
                <Badge variant="secondary" className="text-xs">
                  +{(task.tags ?? []).length - 3}
                </Badge>
              ) : null}
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {dueChip(task.dueDate, task.status) ? (
                <Badge
                  variant={dueChip(task.dueDate, task.status)!.tone === "destructive" ? "destructive" : "secondary"}
                  className={
                    dueChip(task.dueDate, task.status)!.tone === "warning"
                      ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-200"
                      : ""
                  }
                >
                  {dueChip(task.dueDate, task.status)!.label}
                </Badge>
              ) : (
                <span className="text-xs text-muted-foreground">Vence: {formatDateArg(task.dueDate)}</span>
              )}
              <PriorityBadge priority={task.priority} />
            </div>
          </div>

          {task.subtasks && task.subtasks.length > 0 ? (
            <div className="pt-1">
              <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                <span>
                  Subtareas{" "}
                  <span className="tabular-nums">
                    {task.subtasks.filter((s) => s.completed).length}/{task.subtasks.length}
                  </span>
                </span>
                <span className="tabular-nums">{getSubtasksProgress()}%</span>
              </div>
              <ProgressBar value={getSubtasksProgress()} />
            </div>
          ) : null}
        </div>

        <div className="flex items-center justify-between px-3 py-2 border-t border-border bg-muted/30">
          <div className="flex items-center gap-2">
            <Button variant="default" size="default" onClick={() => setSelectedTask(task)}>
              <Eye className="h-4 w-4 mr-2" />
              Abrir
            </Button>
            {isAsignado && task.status !== "realizada" && task.status !== "cancelada" ? (
              <Button variant="outline" size="default" onClick={handleMarkAsRealizada}>
                <CheckCircle className="h-4 w-4 mr-2" />
                Completar
              </Button>
            ) : null}
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Más acciones">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setSelectedTask(task)}>
                <Eye className="h-4 w-4 mr-2" />
                Abrir
              </DropdownMenuItem>
              {isSolicitante ? (
                <>
                  <DropdownMenuItem onClick={() => setIsEditModalOpen(true)}>
                    <PencilLine className="h-4 w-4 mr-2" />
                    Editar
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className="text-destructive focus:text-destructive"
                    onClick={() => setIsDeleteDialogOpen(true)}
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Eliminar…
                  </DropdownMenuItem>
                </>
              ) : null}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <EditTaskModal
        task={task}
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        onTaskUpdated={(updatedTask) => {
          updateTask(task.id, updatedTask);
          setIsEditModalOpen(false);
        }}
      />

      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Estás seguro?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. Se eliminará permanentemente la tarea
              &quot;{task.title}&quot; y todos sus datos asociados.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
} 