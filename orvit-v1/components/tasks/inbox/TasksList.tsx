"use client";

import { useMemo } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { TaskListCard } from "./TaskListCard";
import { TasksSortDropdown, SortOption, SortField } from "./TasksSortDropdown";
import { Task } from "@/hooks/use-task-store";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { CheckSquare, Square } from "lucide-react";

type InboxTab = "recibidas" | "enviadas" | "todas";
type QuickFilter = string;

interface TasksListProps {
  tasks: Task[];
  activeTab: InboxTab;
  quickFilter: QuickFilter;
  includeCompleted: boolean;
  currentUserId?: string;
  selectedTaskId?: string;
  onTaskSelect: (task: Task) => void;
  onTaskDoubleClick?: (task: Task) => void;
  onTaskComplete?: (task: Task) => void;
  onTaskEdit?: (task: Task) => void;
  onTaskDelete?: (task: Task) => void;
  canEdit?: (task: Task) => boolean;
  canDelete?: (task: Task) => boolean;
  searchQuery?: string;
  advancedFilters?: {
    statuses: string[];
    priorities: string[];
    tags: string[];
    assignedTo?: string;
    createdBy?: string;
    dueDateFrom?: string;
    dueDateTo?: string;
    hasAttachments: boolean;
    hasSubtasks: boolean;
  };
  sortOption?: SortOption;
  onSortChange?: (sort: SortOption) => void;
  // Selection mode props
  selectionMode?: boolean;
  selectedTaskIds?: Set<string>;
  onSelectionChange?: (taskId: string, checked: boolean) => void;
  onToggleSelectionMode?: () => void;
}

export function TasksList({
  tasks,
  activeTab,
  quickFilter,
  includeCompleted,
  currentUserId,
  selectedTaskId,
  onTaskSelect,
  onTaskDoubleClick,
  onTaskComplete,
  onTaskEdit,
  onTaskDelete,
  canEdit = () => false,
  canDelete = () => false,
  searchQuery = "",
  advancedFilters,
  sortOption,
  onSortChange,
  selectionMode = false,
  selectedTaskIds = new Set(),
  onSelectionChange,
  onToggleSelectionMode,
}: TasksListProps) {
  const defaultSort: SortOption = sortOption || { field: "dueDate", direction: "asc" };

  const priorityOrder: Record<string, number> = {
    urgente: 0,
    alta: 1,
    media: 2,
    baja: 3,
  };
  const filteredAndSortedTasks = useMemo(() => {
    let filtered = tasks;

    // Filtrar por tab
    if (activeTab === "recibidas") {
      filtered = filtered.filter(
        (t) => t.assignedTo?.id?.toString() === currentUserId
      );
    } else if (activeTab === "enviadas") {
      filtered = filtered.filter(
        (t) => t.createdBy?.id?.toString() === currentUserId
      );
    }

    // Filtrar completadas
    if (!includeCompleted) {
      filtered = filtered.filter((t) => t.status !== "realizada");
    }

    // Quick filters
    if (quickFilter) {
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const weekFromNow = new Date(today);
      weekFromNow.setDate(today.getDate() + 7);

      if (activeTab === "recibidas") {
        if (quickFilter === "atrasadas") {
          filtered = filtered.filter((t) => {
            if (!t.dueDate || t.status === "realizada") return false;
            const due = new Date(t.dueDate);
            return due < today;
          });
        } else if (quickFilter === "vencen-hoy") {
          filtered = filtered.filter((t) => {
            if (!t.dueDate || t.status === "realizada") return false;
            const due = new Date(t.dueDate);
            due.setHours(0, 0, 0, 0);
            return due.getTime() === today.getTime();
          });
        } else if (quickFilter === "prox-7d") {
          filtered = filtered.filter((t) => {
            if (!t.dueDate || t.status === "realizada") return false;
            const due = new Date(t.dueDate);
            return due >= today && due <= weekFromNow;
          });
        } else if (quickFilter === "sin-fecha") {
          filtered = filtered.filter((t) => !t.dueDate);
        }
      } else if (activeTab === "enviadas") {
        if (quickFilter === "pendientes") {
          filtered = filtered.filter((t) => t.status === "pendiente");
        } else if (quickFilter === "en-curso") {
          filtered = filtered.filter((t) => t.status === "en-curso");
        } else if (quickFilter === "sin-asignar") {
          filtered = filtered.filter((t) => !t.assignedTo?.id);
        }
      } else if (activeTab === "todas") {
        if (quickFilter === "pendiente") {
          filtered = filtered.filter((t) => t.status === "pendiente");
        } else if (quickFilter === "en-curso") {
          filtered = filtered.filter((t) => t.status === "en-curso");
        } else if (quickFilter === "alta") {
          filtered = filtered.filter((t) => t.priority === "alta");
        } else if (quickFilter === "media") {
          filtered = filtered.filter((t) => t.priority === "media");
        } else if (quickFilter === "baja") {
          filtered = filtered.filter((t) => t.priority === "baja");
        }
      }
    }

    // Advanced filters
    if (advancedFilters) {
      if (advancedFilters.statuses.length > 0) {
        filtered = filtered.filter((t) =>
          advancedFilters.statuses.includes(t.status)
        );
      }
      if (advancedFilters.priorities.length > 0) {
        filtered = filtered.filter((t) =>
          advancedFilters.priorities.includes(t.priority)
        );
      }
      if (advancedFilters.tags.length > 0) {
        filtered = filtered.filter((t) =>
          advancedFilters.tags.some((tag) => t.tags?.includes(tag))
        );
      }
      if (advancedFilters.assignedTo) {
        filtered = filtered.filter(
          (t) => t.assignedTo?.id?.toString() === advancedFilters.assignedTo
        );
      }
      if (advancedFilters.createdBy) {
        filtered = filtered.filter(
          (t) => t.createdBy?.id?.toString() === advancedFilters.createdBy
        );
      }
      if (advancedFilters.dueDateFrom) {
        const from = new Date(advancedFilters.dueDateFrom);
        filtered = filtered.filter((t) => {
          if (!t.dueDate) return false;
          return new Date(t.dueDate) >= from;
        });
      }
      if (advancedFilters.dueDateTo) {
        const to = new Date(advancedFilters.dueDateTo);
        to.setHours(23, 59, 59, 999);
        filtered = filtered.filter((t) => {
          if (!t.dueDate) return false;
          return new Date(t.dueDate) <= to;
        });
      }
      if (advancedFilters.hasAttachments) {
        filtered = filtered.filter(
          (t) => t.files && t.files.length > 0
        );
      }
      if (advancedFilters.hasSubtasks) {
        filtered = filtered.filter(
          (t) => t.subtasks && t.subtasks.length > 0
        );
      }
    }

    // Search
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (t) =>
          t.title.toLowerCase().includes(query) ||
          t.description?.toLowerCase().includes(query) ||
          t.tags?.some((tag) => tag.toLowerCase().includes(query))
      );
    }

    // Sort usando sortOption si está disponible
    const sortField = defaultSort.field;
    const sortDir = defaultSort.direction === "asc" ? 1 : -1;

    filtered.sort((a, b) => {
      let comparison = 0;

      switch (sortField) {
        case "dueDate":
          if (!a.dueDate && !b.dueDate) comparison = 0;
          else if (!a.dueDate) comparison = 1;
          else if (!b.dueDate) comparison = -1;
          else comparison = new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
          break;

        case "createdAt":
          comparison = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
          break;

        case "updatedAt":
          comparison = new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime();
          break;

        case "priority":
          const priorityA = priorityOrder[a.priority?.toLowerCase()] ?? 99;
          const priorityB = priorityOrder[b.priority?.toLowerCase()] ?? 99;
          comparison = priorityA - priorityB;
          break;

        case "title":
          comparison = (a.title || "").localeCompare(b.title || "", "es");
          break;

        case "assignee":
          const nameA = a.assignedTo?.name || "";
          const nameB = b.assignedTo?.name || "";
          comparison = nameA.localeCompare(nameB, "es");
          break;

        default:
          comparison = 0;
      }

      return comparison * sortDir;
    });

    return filtered;
  }, [
    tasks,
    activeTab,
    quickFilter,
    includeCompleted,
    currentUserId,
    searchQuery,
    advancedFilters,
    defaultSort,
    priorityOrder,
  ]);

  const emptyStateMessage = useMemo(() => {
    if (searchQuery.trim()) {
      return {
        title: "Sin resultados",
        description: `No se encontraron tareas con "${searchQuery}"`,
        suggestion: "Intenta con otros términos de búsqueda",
      };
    }
    if (activeTab === "recibidas") {
      return {
        title: "¡Bandeja vacía!",
        description: "No tienes tareas asignadas pendientes",
        suggestion: "Las tareas que te asignen aparecerán aquí",
      };
    }
    if (activeTab === "enviadas") {
      return {
        title: "Sin tareas enviadas",
        description: "No has creado ninguna tarea aún",
        suggestion: "Crea una nueva tarea para empezar",
      };
    }
    return {
      title: "Sin tareas",
      description: "No hay tareas que coincidan con los filtros",
      suggestion: "Prueba ajustando los filtros o crea una nueva tarea",
    };
  }, [searchQuery, activeTab]);

  if (filteredAndSortedTasks.length === 0) {
    return (
      <div className="h-full flex flex-col">
        {/* Header con ordenamiento aunque esté vacío */}
        {onSortChange && (
          <div className="flex items-center justify-between p-2 border-b border-border/50">
            <span className="text-xs text-muted-foreground">0 tareas</span>
            <TasksSortDropdown currentSort={defaultSort} onSortChange={onSortChange} />
          </div>
        )}
        <div className="flex-1 flex items-center justify-center p-8 text-center">
          <div className="max-w-[240px]">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-muted/50 flex items-center justify-center">
              <svg
                className="w-8 h-8 text-muted-foreground/50"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
                />
              </svg>
            </div>
            <h3 className="text-sm font-medium text-foreground mb-1">
              {emptyStateMessage.title}
            </h3>
            <p className="text-xs text-muted-foreground mb-2">
              {emptyStateMessage.description}
            </p>
            <p className="text-xs text-muted-foreground/70">
              {emptyStateMessage.suggestion}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header con contador, selección y ordenamiento */}
      {onSortChange && (
        <div className="flex items-center justify-between p-2 border-b border-border/50">
          <div className="flex items-center gap-2">
            {onToggleSelectionMode && (
              <Button
                variant="ghost"
                size="sm"
                className={cn(
                  "h-7 w-7 p-0",
                  selectionMode && "bg-primary/10 text-primary"
                )}
                onClick={onToggleSelectionMode}
                title={selectionMode ? "Salir de selección" : "Seleccionar tareas"}
              >
                {selectionMode ? (
                  <CheckSquare className="h-4 w-4" />
                ) : (
                  <Square className="h-4 w-4" />
                )}
              </Button>
            )}
            <span className="text-xs text-muted-foreground">
              {selectionMode && selectedTaskIds.size > 0
                ? `${selectedTaskIds.size} de ${filteredAndSortedTasks.length} seleccionadas`
                : `${filteredAndSortedTasks.length} ${filteredAndSortedTasks.length === 1 ? "tarea" : "tareas"}`
              }
            </span>
          </div>
          <TasksSortDropdown currentSort={defaultSort} onSortChange={onSortChange} />
        </div>
      )}
      <ScrollArea className="flex-1">
        <div className="space-y-2 p-2">
        {filteredAndSortedTasks.map((task) => (
          <TaskListCard
            key={task.id}
            task={{
              id: task.id,
              title: task.title,
              description: task.description || null,
              dueDate: task.dueDate || null,
              assignee: task.assignedTo
                ? {
                    id: task.assignedTo.id,
                    name: task.assignedTo.name,
                    avatarUrl: null,
                  }
                : null,
              requester: task.createdBy
                ? {
                    id: task.createdBy.id,
                    name: task.createdBy.name,
                    avatarUrl: null,
                  }
                : null,
              tags: task.tags || [],
              subtasks: task.subtasks?.map((st) => ({
                id: st.id,
                completed: st.completed,
              })) || [],
            }}
            isSelected={selectedTaskId === task.id}
            onOpen={() => onTaskSelect(task)}
            onDoubleClick={onTaskDoubleClick ? () => onTaskDoubleClick(task) : undefined}
            onComplete={
              onTaskComplete && task.status !== "realizada"
                ? () => onTaskComplete(task)
                : undefined
            }
            onEdit={onTaskEdit ? () => onTaskEdit(task) : undefined}
            onDelete={onTaskDelete ? () => onTaskDelete(task) : undefined}
            canEdit={canEdit(task)}
            canDelete={canDelete(task)}
            selectionMode={selectionMode}
            isChecked={selectedTaskIds.has(task.id)}
            onCheckChange={(taskId, checked) => onSelectionChange?.(String(taskId), checked)}
          />
        ))}
        </div>
      </ScrollArea>
    </div>
  );
}

