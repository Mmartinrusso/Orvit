"use client";

import { useState, useMemo, useCallback } from "react";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { TasksInboxHeader } from "./TasksInboxHeader";
import { TasksInboxTabs } from "./TasksInboxTabs";
import { TasksQuickFilters } from "./TasksQuickFilters";
import { TasksSearchBar } from "./TasksSearchBar";
import { TasksList } from "./TasksList";
import { TaskDetailPanel } from "./TaskDetailPanel";
import { Task } from "@/hooks/use-task-store";
import { useTaskStore } from "@/hooks/use-task-store";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";
import { DeleteTaskDialog } from "@/components/tasks/delete-task-dialog";
import { SortOption } from "./TasksSortDropdown";
import { TasksBulkActionsBar } from "./TasksBulkActionsBar";

type InboxTab = "recibidas" | "enviadas" | "todas";
type QuickFilter = string;

interface AdvancedFilters {
  statuses: string[];
  priorities: string[];
  tags: string[];
  assignedTo?: string;
  createdBy?: string;
  dueDateFrom?: string;
  dueDateTo?: string;
  hasAttachments: boolean;
  hasSubtasks: boolean;
}

interface TasksInboxProps {
  tasks: Task[];
  onNewTask: () => void;
  onEditTask?: (task: Task) => void;
  canViewAll?: boolean;
  users?: Array<{ id: string; name: string; email: string }>;
  canEdit?: (task: Task) => boolean;
  canDelete?: (task: Task) => boolean;
}

export function TasksInbox({
  tasks,
  onNewTask,
  onEditTask,
  canViewAll = false,
  users = [],
  canEdit = () => false,
  canDelete = () => false,
}: TasksInboxProps) {
  const { user } = useAuth();
  const { selectedTask: storeSelectedTask, setSelectedTask, updateTask, deleteTask } = useTaskStore();
  const { toast } = useToast();

  const [activeTab, setActiveTab] = useState<InboxTab>("recibidas");
  const [quickFilter, setQuickFilter] = useState<QuickFilter>("");
  const [includeCompleted, setIncludeCompleted] = useState(false);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [advancedFilters, setAdvancedFilters] = useState<AdvancedFilters>({
    statuses: [],
    priorities: [],
    tags: [],
    hasAttachments: false,
    hasSubtasks: false,
  });
  const [isMobileDetailOpen, setIsMobileDetailOpen] = useState(false);
  const [sortOption, setSortOption] = useState<SortOption>({
    field: "dueDate",
    direction: "asc",
  });
  const [deleteDialogState, setDeleteDialogState] = useState<{
    isOpen: boolean;
    task: Task | null;
  }>({ isOpen: false, task: null });

  // Estado para selección masiva
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedTaskIds, setSelectedTaskIds] = useState<Set<string>>(new Set());
  const [isBulkProcessing, setIsBulkProcessing] = useState(false);

  // Usar la tarea del store si está disponible y coincide con selectedTaskId, sino calcular desde props
  const selectedTask = useMemo(() => {
    if (storeSelectedTask && String(storeSelectedTask.id) === String(selectedTaskId)) {
      return storeSelectedTask;
    }
    return tasks.find((t) => String(t.id) === String(selectedTaskId)) || null;
  }, [storeSelectedTask, tasks, selectedTaskId]);

  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (advancedFilters.statuses.length > 0) count++;
    if (advancedFilters.priorities.length > 0) count++;
    if (advancedFilters.tags.length > 0) count++;
    if (advancedFilters.assignedTo) count++;
    if (advancedFilters.createdBy) count++;
    if (advancedFilters.dueDateFrom || advancedFilters.dueDateTo) count++;
    if (advancedFilters.hasAttachments) count++;
    if (advancedFilters.hasSubtasks) count++;
    return count;
  }, [advancedFilters]);

  const handleTaskSelect = useCallback(
    (task: Task) => {
      setSelectedTaskId(task.id);
      setSelectedTask(task);
      // Solo abrir el modal en mobile, en desktop solo seleccionar
      if (typeof window !== 'undefined' && window.innerWidth < 1024) {
        setIsMobileDetailOpen(true);
      }
    },
    [setSelectedTask]
  );

  const handleTaskDoubleClick = useCallback(
    (task: Task) => {
      setSelectedTaskId(task.id);
      setSelectedTask(task);
      // Abrir el modal/sheet en ambos casos (desktop y mobile)
      setIsMobileDetailOpen(true);
    },
    [setSelectedTask]
  );

  const handleTaskComplete = useCallback(
    async (task: Task) => {
      try {
        const newStatus = task.status === "realizada" ? "en-curso" : "realizada";
        const response = await fetch(`/api/tasks/${task.id}`, {
          method: "PUT",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...task,
            status: newStatus,
            progress: newStatus === "realizada" ? 100 : task.progress,
            assignedToId: Number(task.assignedTo?.id),
          }),
        });

        if (!response.ok) throw new Error("Error al actualizar la tarea");

        const updatedTask = await response.json();
        updateTask(task.id, {
          ...task,
          ...updatedTask,
          status: newStatus,
          progress: newStatus === "realizada" ? 100 : task.progress,
        });

        toast({
          title: "Tarea actualizada",
          description: `La tarea ha sido marcada como ${
            newStatus === "realizada" ? "realizada" : "en curso"
          }.`,
        });
      } catch (error) {
        toast({
          variant: "destructive",
          title: "Error",
          description: "No se pudo actualizar la tarea. Por favor, intenta nuevamente.",
        });
      }
    },
    [updateTask, toast]
  );

  // Abre el dialogo de confirmacion antes de eliminar
  const handleTaskDelete = useCallback(
    (task: Task) => {
      setDeleteDialogState({ isOpen: true, task });
    },
    []
  );

  // Ejecuta la eliminacion real despues de la confirmacion
  const confirmDeleteTask = useCallback(
    async () => {
      const task = deleteDialogState.task;
      if (!task) return;

      try {
        const response = await fetch(`/api/tasks/${task.id}`, {
          method: "DELETE",
          credentials: "include",
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || "Error al eliminar la tarea");
        }

        deleteTask(task.id);
        setSelectedTaskId(null);
        setSelectedTask(null);
        setIsMobileDetailOpen(false);

        toast({
          title: "Tarea eliminada",
          description: "La tarea ha sido eliminada exitosamente.",
        });
      } catch (error) {
        toast({
          variant: "destructive",
          title: "Error",
          description:
            error instanceof Error
              ? error.message
              : "No se pudo eliminar la tarea.",
        });
        throw error;
      }
    },
    [deleteDialogState.task, deleteTask, setSelectedTask, toast]
  );

  const closeDeleteDialog = useCallback(() => {
    setDeleteDialogState({ isOpen: false, task: null });
  }, []);

  const handleUpdateSubtask = useCallback(
    async (taskId: string, subtaskId: string, completed: boolean) => {
      const task = tasks.find((t) => t.id === taskId);
      if (!task || !task.subtasks) return;

      const updatedSubtasks = task.subtasks.map((s) =>
        s.id === subtaskId ? { ...s, completed } : s
      );

      try {
        const response = await fetch(`/api/tasks/${taskId}`, {
          method: "PUT",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...task,
            subtasks: updatedSubtasks,
            assignedToId: Number(task.assignedTo?.id),
          }),
        });

        if (!response.ok) throw new Error("Error al actualizar subtarea");

        const updatedTask = await response.json();
        updateTask(taskId, updatedTask);
        
        // Actualizar también la tarea seleccionada si es la misma
        if (selectedTaskId === taskId) {
          setSelectedTask(updatedTask);
        }
      } catch (error) {
        toast({
          variant: "destructive",
          title: "Error",
          description: "No se pudo actualizar la subtarea.",
        });
      }
    },
    [tasks, updateTask, selectedTaskId, setSelectedTask, toast]
  );

  const handleClearFilters = useCallback(() => {
    setQuickFilter("");
    setSearchQuery("");
    setAdvancedFilters({
      statuses: [],
      priorities: [],
      tags: [],
      hasAttachments: false,
      hasSubtasks: false,
    });
  }, []);

  // Funciones de selección masiva
  const handleToggleSelectionMode = useCallback(() => {
    setSelectionMode((prev) => {
      if (prev) {
        setSelectedTaskIds(new Set());
      }
      return !prev;
    });
  }, []);

  const handleSelectionChange = useCallback((taskId: string, checked: boolean) => {
    setSelectedTaskIds((prev) => {
      const next = new Set(prev);
      if (checked) {
        next.add(taskId);
      } else {
        next.delete(taskId);
      }
      return next;
    });
  }, []);

  const handleClearSelection = useCallback(() => {
    setSelectedTaskIds(new Set());
    setSelectionMode(false);
  }, []);

  const handleBulkComplete = useCallback(async () => {
    if (selectedTaskIds.size === 0) return;

    setIsBulkProcessing(true);
    let successCount = 0;
    let failCount = 0;

    for (const taskId of selectedTaskIds) {
      const task = tasks.find((t) => t.id === taskId);
      if (!task || task.status === "realizada") continue;

      try {
        const response = await fetch(`/api/tasks/${taskId}`, {
          method: "PUT",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...task,
            status: "realizada",
            progress: 100,
            assignedToId: Number(task.assignedTo?.id),
          }),
        });

        if (response.ok) {
          const updatedTask = await response.json();
          updateTask(taskId, { ...task, ...updatedTask, status: "realizada", progress: 100 });
          successCount++;
        } else {
          failCount++;
        }
      } catch {
        failCount++;
      }
    }

    setIsBulkProcessing(false);
    setSelectedTaskIds(new Set());
    setSelectionMode(false);

    if (successCount > 0) {
      toast({
        title: "Tareas completadas",
        description: `Se completaron ${successCount} tareas${failCount > 0 ? ` (${failCount} fallaron)` : ""}.`,
      });
    } else if (failCount > 0) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "No se pudieron completar las tareas seleccionadas.",
      });
    }
  }, [selectedTaskIds, tasks, updateTask, toast]);

  const handleBulkDelete = useCallback(async () => {
    if (selectedTaskIds.size === 0) return;

    setIsBulkProcessing(true);
    let successCount = 0;
    let failCount = 0;

    for (const taskId of selectedTaskIds) {
      try {
        const response = await fetch(`/api/tasks/${taskId}`, {
          method: "DELETE",
          credentials: "include",
        });

        if (response.ok) {
          deleteTask(taskId);
          successCount++;
        } else {
          failCount++;
        }
      } catch {
        failCount++;
      }
    }

    setIsBulkProcessing(false);
    setSelectedTaskIds(new Set());
    setSelectionMode(false);
    setSelectedTaskId(null);
    setSelectedTask(null);

    if (successCount > 0) {
      toast({
        title: "Tareas eliminadas",
        description: `Se eliminaron ${successCount} tareas${failCount > 0 ? ` (${failCount} fallaron)` : ""}.`,
      });
    } else if (failCount > 0) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "No se pudieron eliminar las tareas seleccionadas.",
      });
    }
  }, [selectedTaskIds, deleteTask, setSelectedTask, toast]);

  // Verificar si se pueden eliminar todas las tareas seleccionadas
  const canDeleteSelected = useMemo(() => {
    if (selectedTaskIds.size === 0) return false;
    for (const taskId of selectedTaskIds) {
      const task = tasks.find((t) => t.id === taskId);
      if (task && !canDelete(task)) return false;
    }
    return true;
  }, [selectedTaskIds, tasks, canDelete]);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="shrink-0 px-4 md:px-6 pb-2 pt-0">
        <TasksInboxHeader onNewTask={onNewTask} />
      </div>

      {/* Tabs */}
      <div className="shrink-0 px-4 md:px-6 pb-2">
        <TasksInboxTabs
          activeTab={activeTab}
          onTabChange={setActiveTab}
          tasks={tasks}
          currentUserId={user?.id}
          canViewAll={canViewAll}
        />
      </div>

      {/* Quick Filters */}
      <div className="shrink-0 px-4 md:px-6 pb-2">
        <TasksQuickFilters
          activeTab={activeTab}
          tasks={tasks}
          currentUserId={user?.id}
          quickFilter={quickFilter}
          onQuickFilterChange={setQuickFilter}
          includeCompleted={includeCompleted}
          onIncludeCompletedChange={setIncludeCompleted}
        />
      </div>

      {/* Search Bar */}
      <div className="shrink-0 px-4 md:px-6 py-2">
        <TasksSearchBar
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          activeFiltersCount={activeFiltersCount}
          onClearFilters={handleClearFilters}
          advancedFilters={advancedFilters}
          onAdvancedFiltersChange={setAdvancedFilters}
          users={users}
          canViewAll={canViewAll}
        />
      </div>

      {/* Master-Detail Layout */}
      <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(500px,600px)] gap-4 px-4 sm:px-6 pb-2">
        {/* List (Master) */}
        <div className="min-h-0 hidden lg:block">
          <TasksList
            tasks={tasks}
            activeTab={activeTab}
            quickFilter={quickFilter}
            includeCompleted={includeCompleted}
            currentUserId={user?.id}
            selectedTaskId={selectedTaskId || undefined}
            onTaskSelect={handleTaskSelect}
            onTaskDoubleClick={handleTaskDoubleClick}
            onTaskComplete={handleTaskComplete}
            onTaskEdit={onEditTask}
            onTaskDelete={handleTaskDelete}
            canEdit={canEdit}
            canDelete={canDelete}
            searchQuery={searchQuery}
            advancedFilters={advancedFilters}
            sortOption={sortOption}
            onSortChange={setSortOption}
            selectionMode={selectionMode}
            selectedTaskIds={selectedTaskIds}
            onSelectionChange={handleSelectionChange}
            onToggleSelectionMode={handleToggleSelectionMode}
          />
        </div>

        {/* Detail Panel (Desktop) */}
        <div className="min-h-0 flex-1 hidden lg:block">
          <TaskDetailPanel
            task={selectedTask}
            onComplete={() => selectedTask && handleTaskComplete(selectedTask)}
            onReopen={() => selectedTask && handleTaskComplete(selectedTask)}
            onEdit={() => selectedTask && onEditTask?.(selectedTask)}
            onDelete={() => selectedTask && handleTaskDelete(selectedTask)}
            canEdit={selectedTask ? canEdit(selectedTask) : false}
            canDelete={selectedTask ? canDelete(selectedTask) : false}
            onUpdateSubtask={handleUpdateSubtask}
          />
        </div>

        {/* Mobile: List only */}
        <div className="min-h-0 lg:hidden">
          <TasksList
            tasks={tasks}
            activeTab={activeTab}
            quickFilter={quickFilter}
            includeCompleted={includeCompleted}
            currentUserId={user?.id}
            selectedTaskId={selectedTaskId || undefined}
            onTaskSelect={handleTaskSelect}
            onTaskDoubleClick={handleTaskDoubleClick}
            onTaskComplete={handleTaskComplete}
            onTaskEdit={onEditTask}
            onTaskDelete={handleTaskDelete}
            canEdit={canEdit}
            canDelete={canDelete}
            searchQuery={searchQuery}
            advancedFilters={advancedFilters}
            sortOption={sortOption}
            onSortChange={setSortOption}
            selectionMode={selectionMode}
            selectedTaskIds={selectedTaskIds}
            onSelectionChange={handleSelectionChange}
            onToggleSelectionMode={handleToggleSelectionMode}
          />
        </div>
      </div>

      {/* Mobile: Detail Sheet */}
      <Sheet open={isMobileDetailOpen} onOpenChange={setIsMobileDetailOpen}>
        <SheetContent side="right" size="lg" className="p-0">
          {selectedTask && (
            <TaskDetailPanel
              task={selectedTask}
              onComplete={() => {
                handleTaskComplete(selectedTask);
                setIsMobileDetailOpen(false);
              }}
              onReopen={() => {
                handleTaskComplete(selectedTask);
                setIsMobileDetailOpen(false);
              }}
              onEdit={() => {
                onEditTask?.(selectedTask);
                setIsMobileDetailOpen(false);
              }}
              onDelete={() => {
                handleTaskDelete(selectedTask);
              }}
              canEdit={canEdit(selectedTask)}
              canDelete={canDelete(selectedTask)}
              onUpdateSubtask={handleUpdateSubtask}
            />
          )}
        </SheetContent>
      </Sheet>

      {/* Dialogo de confirmacion de eliminacion */}
      <DeleteTaskDialog
        isOpen={deleteDialogState.isOpen}
        onClose={closeDeleteDialog}
        onConfirm={confirmDeleteTask}
        taskTitle={deleteDialogState.task?.title || ""}
      />

      {/* Barra de acciones masivas */}
      <TasksBulkActionsBar
        selectedCount={selectedTaskIds.size}
        onClearSelection={handleClearSelection}
        onBulkComplete={handleBulkComplete}
        onBulkDelete={handleBulkDelete}
        canDelete={canDeleteSelected}
        isProcessing={isBulkProcessing}
      />
    </div>
  );
}

