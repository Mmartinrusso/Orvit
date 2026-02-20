"use client";

import { useState } from "react";
import {
  CheckCircle2,
  Eye,
  MoreHorizontal,
  Paperclip,
  Clock,
  AlertTriangle,
  User,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Task } from "@/hooks/use-task-store";
import { StatusBadge } from "@/components/ui/status-badge";
import { toZonedTime } from "date-fns-tz";
import { cn } from "@/lib/utils";

const ARG_TIMEZONE = "America/Argentina/Buenos_Aires";

function PriorityBadge({ priority }: { priority: string }) {
  const getColor = (priority: string) => {
    switch (priority.toLowerCase()) {
      case "alta":
      case "urgente":
        return "text-destructive";
      case "media":
        return "text-warning-muted-foreground";
      case "baja":
        return "text-success";
      default:
        return "text-muted-foreground";
    }
  };

  const getPriorityText = (priority: string) => {
    switch (priority.toLowerCase()) {
      case "alta":
        return "Alta";
      case "urgente":
        return "Urgente";
      case "media":
        return "Media";
      case "baja":
        return "Baja";
      default:
        return priority;
    }
  };

  return (
    <span className={cn("text-xs font-medium", getColor(priority))}>
      {getPriorityText(priority)}
    </span>
  );
}

function ProgressBar({ value }: { value: number }) {
  return (
    <div className="w-full bg-muted rounded-full h-1.5">
      <div
        className="bg-primary h-1.5 rounded-full transition-all duration-300"
        style={{ width: `${value}%` }}
      />
    </div>
  );
}

function formatDueDate(dueDate?: string, status?: string) {
  if (!dueDate) return null;
  if (status === "realizada" || status === "cancelada") return null;

  const now = new Date();
  const due = toZonedTime(new Date(dueDate), ARG_TIMEZONE);
  const today = toZonedTime(now, ARG_TIMEZONE);
  due.setHours(0, 0, 0, 0);
  today.setHours(0, 0, 0, 0);

  const diffDays = Math.round(
    (due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
  );
  
  if (diffDays < 0) return { label: "Atrasada", variant: "destructive" as const };
  if (diffDays === 0) return { label: "Vence hoy", variant: "destructive" as const };
  if (diffDays <= 7) return { label: `En ${diffDays}d`, variant: "default" as const };
  
  // Si es más de 7 días, mostrar la fecha completa
  return {
    label: due.toLocaleDateString("es-AR", {
      day: "numeric",
      month: "short",
    }),
    variant: "secondary" as const,
  };
}

function initials(name?: string) {
  if (!name) return "—";
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase()).join("") || "—";
}

interface TaskRowCardProps {
  task: Task;
  type: "recibida" | "enviada";
  isSelected?: boolean;
  onSelect: () => void;
  onComplete?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  canEdit?: boolean;
  canDelete?: boolean;
}

export function TaskRowCard({
  task,
  type,
  isSelected = false,
  onSelect,
  onComplete,
  onEdit,
  onDelete,
  canEdit = false,
  canDelete = false,
}: TaskRowCardProps) {
  const dueInfo = formatDueDate(task.dueDate, task.status);
  const hasSubtasks = task.subtasks && task.subtasks.length > 0;
  const hasTags = task.tags && task.tags.length > 0;

  if (type === "recibida") {
    return (
      <TooltipProvider>
        <div
          className={cn(
            "group border rounded-md p-2.5 cursor-pointer transition-all bg-card",
            isSelected
              ? "border-primary bg-primary/5 shadow-sm"
              : "border-border hover:border-border/80 hover:bg-muted/30"
          )}
          onClick={onSelect}
        >
          {/* Fila 1: Título */}
          <div className="flex items-center justify-between gap-2 mb-1.5">
            <h4 className="font-medium text-sm leading-snug flex-1 min-w-0 truncate">
              {task.title}
            </h4>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={(e) => e.stopPropagation()}
                  className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <MoreHorizontal className="h-3.5 w-3.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={onSelect}>Ver detalles</DropdownMenuItem>
                {task.status !== "realizada" && onComplete && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={(e) => {
                      e.stopPropagation();
                      onComplete();
                    }}>
                      Completar
                    </DropdownMenuItem>
                  </>
                )}
                {canEdit && onEdit && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={onEdit}>Editar</DropdownMenuItem>
                  </>
                )}
                {canDelete && onDelete && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={onDelete} className="text-destructive">
                      Eliminar
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Fila 2: Fecha + Subtareas + Etiqueta */}
          <div className="flex items-center gap-1.5 mb-1.5 flex-wrap text-xs text-muted-foreground">
            {dueInfo && (
              <span className={cn(
                "font-normal",
                dueInfo.variant === "destructive" ? "text-destructive" : ""
              )}>
                {dueInfo.label}
              </span>
            )}
            {hasSubtasks && (
              <span className="font-normal">
                {task.subtasks.filter((s) => s.completed).length}/{task.subtasks.length}
              </span>
            )}
            {hasTags && (
              <span className="font-normal">
                {task.tags.length}
              </span>
            )}
          </div>

          {/* Fila 3: Solicitante + Responsable */}
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            {task.createdBy && (
              <span className="truncate max-w-[120px]">
                {task.createdBy.name}
              </span>
            )}
            {task.assignedTo && (
              <div className="flex items-center gap-1.5">
                <Avatar className="h-4 w-4">
                  <AvatarFallback className="text-[9px] bg-primary/10">
                    {initials(task.assignedTo.name)}
                  </AvatarFallback>
                </Avatar>
                <span className="truncate max-w-[120px]">
                  {task.assignedTo.name}
                </span>
              </div>
            )}
          </div>
        </div>
      </TooltipProvider>
    );
  } else {
    // Enviada
    return (
      <TooltipProvider>
        <div
          className={cn(
            "group border rounded-md p-2.5 cursor-pointer transition-all bg-card",
            isSelected
              ? "border-primary bg-primary/5 shadow-sm"
              : "border-border hover:border-border/80 hover:bg-muted/30"
          )}
          onClick={onSelect}
        >
          {/* Fila 1: Título + Estado + Prioridad + Acciones */}
          <div className="flex items-center justify-between gap-2 mb-1.5">
            <h4 className="font-medium text-sm leading-snug flex-1 min-w-0 truncate">
              {task.title}
            </h4>
            <div className="flex items-center gap-1.5 shrink-0">
              <StatusBadge status={task.status} />
              <PriorityBadge priority={task.priority} />
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={(e) => e.stopPropagation()}
                    className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <MoreHorizontal className="h-3.5 w-3.5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={onSelect}>Ver detalles</DropdownMenuItem>
                  {canEdit && onEdit && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={onEdit}>Editar</DropdownMenuItem>
                    </>
                  )}
                  {canDelete && onDelete && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={onDelete} className="text-destructive">
                        Eliminar
                      </DropdownMenuItem>
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          {/* Fila 2: Chips compactos */}
          <div className="flex items-center gap-1.5 mb-1.5 flex-wrap">
            {dueInfo && (
              <Badge variant={dueInfo.variant} className="text-[10px] h-4 px-1.5 font-normal">
                {dueInfo.label}
              </Badge>
            )}
            {task.tags && task.tags.length > 0 && (
              <Badge variant="secondary" className="text-[10px] h-4 px-1.5 font-normal">
                {task.tags.length}
              </Badge>
            )}
            {hasSubtasks && (
              <span className="text-[10px] text-muted-foreground font-normal">
                {task.subtasks.filter((s) => s.completed).length}/{task.subtasks.length}
              </span>
            )}
            {task.updatedAt && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    <span>
                      {new Date(task.updatedAt).toLocaleDateString("es-AR", {
                        day: "numeric",
                        month: "short",
                      })}
                    </span>
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  <p>
                    Actualizada:{" "}
                    {new Date(task.updatedAt).toLocaleString("es-AR")}
                  </p>
                </TooltipContent>
              </Tooltip>
            )}
          </div>

          {/* Fila 3: Avatar + Nombre asignado */}
          {task.assignedTo && (
            <div className="flex items-center gap-1.5">
              <Avatar className="h-5 w-5">
                <AvatarFallback className="text-[10px] bg-primary/10">
                  {initials(task.assignedTo.name)}
                </AvatarFallback>
              </Avatar>
              <span className="text-xs text-muted-foreground truncate flex-1 min-w-0">
                {task.assignedTo.name}
              </span>
            </div>
          )}
        </div>
      </TooltipProvider>
    );
  }
}

