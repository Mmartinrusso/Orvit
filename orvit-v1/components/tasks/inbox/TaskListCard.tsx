"use client";

import { useState, useEffect } from "react";
import { toZonedTime } from "date-fns-tz";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { MoreHorizontal } from "lucide-react";

const ARG_TIMEZONE = "America/Argentina/Buenos_Aires";

type Person = {
  id: string | number;
  name: string;
  avatarUrl?: string | null;
};

type Subtask = {
  id: string | number;
  completed?: boolean;
  done?: boolean; // Alias para compatibilidad
};

export type TaskListCardProps = {
  task: {
    id: string | number;
    title: string;
    description?: string | null;
    dueDate?: string | null;
    assignee?: Person | null;
    requester?: Person | null;
    tags?: string[];
    subtasks?: Subtask[];
  };
  isSelected?: boolean;
  onOpen: (taskId: TaskListCardProps["task"]["id"]) => void;
  onDoubleClick?: (taskId: TaskListCardProps["task"]["id"]) => void;
  onEdit?: () => void;
  onDelete?: () => void;
  onComplete?: () => void;
  canEdit?: boolean;
  canDelete?: boolean;
  showActions?: boolean;
  // Selection mode props
  selectionMode?: boolean;
  isChecked?: boolean;
  onCheckChange?: (taskId: TaskListCardProps["task"]["id"], checked: boolean) => void;
};

function initials(name?: string): string {
  if (!name) return "—";
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase()).join("") || "—";
}

function getDueLabel(
  dueDate?: string | null
): { label: string; tone: "default" | "warning" | "danger" } {
  if (!dueDate) {
    return { label: "Sin fecha", tone: "default" };
  }

  const now = new Date();
  const due = toZonedTime(new Date(dueDate), ARG_TIMEZONE);
  const today = toZonedTime(now, ARG_TIMEZONE);
  
  // Normalizar a medianoche para comparar solo fechas
  due.setHours(0, 0, 0, 0);
  today.setHours(0, 0, 0, 0);

  const diffDays = Math.round((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays < 0) {
    // Vencida
    const days = Math.abs(diffDays);
    const dayText = days === 1 ? "día" : "días";
    return { label: `Atrasada ${days} ${dayText}`, tone: "danger" };
  }

  if (diffDays === 0) {
    return { label: "Hoy", tone: "warning" };
  }

  if (diffDays <= 7) {
    const dayText = diffDays === 1 ? "día" : "días";
    return { label: `En ${diffDays} ${dayText}`, tone: "warning" };
  }

  // Más de 7 días: mostrar fecha completa dd/MM/yyyy
  const day = String(due.getDate()).padStart(2, "0");
  const month = String(due.getMonth() + 1).padStart(2, "0");
  const year = due.getFullYear();
  return { label: `${day}/${month}/${year}`, tone: "default" };
}

function formatDueDate(dueDate?: string | null): string {
  if (!dueDate) return "";
  
  const due = toZonedTime(new Date(dueDate), ARG_TIMEZONE);
  const day = String(due.getDate()).padStart(2, "0");
  const month = String(due.getMonth() + 1).padStart(2, "0");
  const year = due.getFullYear();
  return `${day}/${month}/${year}`;
}

export function TaskListCard({
  task,
  isSelected = false,
  onOpen,
  onDoubleClick,
  onEdit,
  onDelete,
  onComplete,
  canEdit = false,
  canDelete = false,
  showActions = true,
  selectionMode = false,
  isChecked = false,
  onCheckChange,
}: TaskListCardProps) {
  const [clickTimeout, setClickTimeout] = useState<NodeJS.Timeout | null>(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  useEffect(() => {
    return () => {
      if (clickTimeout) {
        clearTimeout(clickTimeout);
      }
    };
  }, [clickTimeout]);

  // Cancelar el timeout si el menú se abre
  useEffect(() => {
    if (isMenuOpen && clickTimeout) {
      clearTimeout(clickTimeout);
      setClickTimeout(null);
    }
  }, [isMenuOpen, clickTimeout]);

  const handleClick = (e: React.MouseEvent) => {
    // Si el menú está abierto, no hacer nada
    if (isMenuOpen) {
      return;
    }

    // Si el click viene del botón del menú, ignorar
    const target = e.target as HTMLElement;
    if (target.closest('button') || target.closest('[role="menu"]')) {
      return;
    }
    
    if (clickTimeout) {
      clearTimeout(clickTimeout);
      setClickTimeout(null);
      // Doble click
      if (onDoubleClick) {
        onDoubleClick(task.id);
      }
    } else {
      // Click simple - esperar un poco para ver si hay doble click
      const timeout = setTimeout(() => {
        if (!isMenuOpen) {
          onOpen(task.id);
        }
        setClickTimeout(null);
      }, 250);
      setClickTimeout(timeout);
    }
  };

  const dueInfo = getDueLabel(task.dueDate);
  const hasSubtasks = task.subtasks && task.subtasks.length > 0;
  const completedSubtasks = task.subtasks?.filter((s) => s.completed || s.done).length || 0;
  const totalSubtasks = task.subtasks?.length || 0;
  const hasTags = task.tags && task.tags.length > 0;
  const firstTag = task.tags?.[0];
  const remainingTags = task.tags && task.tags.length > 1 ? task.tags.length - 1 : 0;

  return (
    <div
      className={cn(
        "group border rounded-md p-2.5 cursor-pointer transition-all bg-card relative overflow-hidden",
        isSelected
          ? "border-primary bg-primary/5 shadow-sm"
          : "border-border hover:border-border/80 hover:bg-muted/40",
        isChecked && "border-primary/50 bg-primary/5"
      )}
      onClick={handleClick}
    >
      {/* Fila 1: Checkbox (si selection mode) + Título + Vencimiento */}
      <div className="flex items-start justify-between gap-2 mb-1">
        <div className="flex items-start gap-2 flex-1 min-w-0">
          {selectionMode && (
            <div
              className="pt-0.5"
              onClick={(e) => e.stopPropagation()}
            >
              <Checkbox
                checked={isChecked}
                onCheckedChange={(checked) => {
                  onCheckChange?.(task.id, checked === true);
                }}
                className="h-4 w-4"
              />
            </div>
          )}
          <h4 className="font-medium text-[15px] leading-snug flex-1 min-w-0 truncate break-all">
            {task.title}
          </h4>
        </div>
        <div className="flex items-center gap-2 shrink-0 relative">
          {/* Vencimiento arriba a la derecha */}
          <Badge
            variant={dueInfo.tone === "danger" ? "destructive" : "secondary"}
            className={cn(
              "text-xs h-5 px-2 font-normal shrink-0",
              dueInfo.tone === "warning" && "bg-warning-muted text-warning-muted-foreground"
            )}
          >
            {dueInfo.label}
          </Badge>
          {showActions && (
            <DropdownMenu 
              open={isMenuOpen} 
              onOpenChange={(open) => {
                setIsMenuOpen(open);
                if (open && clickTimeout) {
                  clearTimeout(clickTimeout);
                  setClickTimeout(null);
                }
              }}
            >
              <DropdownMenuTrigger asChild>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={(e) => e.stopPropagation()}
                >
                  <MoreHorizontal className="h-3.5 w-3.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent 
                align="end"
                onClick={(e) => e.stopPropagation()}
              >
                <DropdownMenuItem 
                  onClick={(e) => {
                    e.stopPropagation();

                    setIsMenuOpen(false);
                    onOpen(task.id);
                  }}
                >
                  Ver detalles
                </DropdownMenuItem>
                {onComplete && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem 
                      onClick={(e) => {
                        e.stopPropagation();

                        setIsMenuOpen(false);
                        onComplete();
                      }}
                    >
                      Completar
                    </DropdownMenuItem>
                  </>
                )}
                {canEdit && onEdit && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={(e) => {
                        e.stopPropagation();

                        setIsMenuOpen(false);
                        onEdit();
                      }}
                    >
                      Editar
                    </DropdownMenuItem>
                  </>
                )}
                {canDelete && onDelete && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={(e) => {
                        e.stopPropagation();

                        setIsMenuOpen(false);
                        onDelete();
                      }}
                      className="text-destructive"
                    >
                      Eliminar
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>

      {/* Fila 2: Descripción */}
      {task.description && (
        <p className="text-[13px] text-muted-foreground mb-1.5 line-clamp-2 break-all overflow-hidden">
          {task.description}
        </p>
      )}

      {/* Fila 2.5: Fecha límite */}
      {task.dueDate && (
        <div className="mb-1.5">
          <span className="text-[12px] text-muted-foreground/70">Fecha límite: </span>
          <span className="text-[12px] font-medium text-muted-foreground">
            {formatDueDate(task.dueDate)}
          </span>
        </div>
      )}

      {/* Fila 3: Chips (Subtareas + Etiquetas) */}
      <div className="flex items-center gap-2 mb-2 flex-wrap">
        {/* Subtareas */}
        {hasSubtasks && (
          <Badge variant="outline" className="text-xs h-5 px-2 font-normal">
            Subtareas: {completedSubtasks}/{totalSubtasks}
          </Badge>
        )}

        {/* Etiquetas */}
        {hasTags && firstTag && (
          <>
            <Badge variant="secondary" className="text-xs h-5 px-2 font-normal">
              {firstTag}
            </Badge>
            {remainingTags > 0 && (
              <Badge variant="outline" className="text-xs h-5 px-2 font-normal">
                +{remainingTags}
              </Badge>
            )}
          </>
        )}
      </div>

      {/* Fila 4: Supervisor + Responsable (uno debajo del otro) */}
      <div className="flex flex-col gap-1.5 text-[13px] text-muted-foreground">
        {/* Supervisor (primero) */}
        {task.requester && (
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-muted-foreground/70 shrink-0">Supervisor:</span>
            <Avatar className="h-[18px] w-[18px] shrink-0">
              <AvatarImage src={task.requester.avatarUrl || undefined} alt={task.requester.name} />
              <AvatarFallback className="text-xs bg-muted">
                {initials(task.requester.name)}
              </AvatarFallback>
            </Avatar>
            <span className="truncate flex-1 min-w-0">
              {task.requester.name}
            </span>
          </div>
        )}

        {/* Responsable (segundo) */}
        {task.assignee && (
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-muted-foreground/70 shrink-0">Responsable:</span>
            <Avatar className="h-[18px] w-[18px] shrink-0">
              <AvatarImage src={task.assignee.avatarUrl || undefined} alt={task.assignee.name} />
              <AvatarFallback className="text-xs bg-primary/10">
                {initials(task.assignee.name)}
              </AvatarFallback>
            </Avatar>
            <span className="truncate flex-1 min-w-0">
              {task.assignee.name}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

