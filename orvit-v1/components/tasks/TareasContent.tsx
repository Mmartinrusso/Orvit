"use client";

import { useUserColors } from '@/hooks/use-user-colors';
import { AVATAR_COLORS } from '@/lib/colors';
import { useConfirm } from '@/components/ui/confirm-dialog-provider';
import { useCompany } from '@/contexts/CompanyContext';
import { useState, useEffect, useMemo, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { NewTaskModal } from "@/components/tasks/new-task-modal";
import { FixedTaskDetailModal } from "@/components/tasks/fixed-task-detail-modal";
import { TaskExecutionModal } from "@/components/tasks/task-execution-modal";
import { CreateFixedTaskModal } from "@/components/tasks/create-fixed-task-modal";
import { TasksKanbanView } from "@/components/tasks/inbox/TasksKanbanView";
import { TasksList } from "@/components/tasks/inbox/TasksList";
import { TasksUserSidebar } from "@/components/tasks/TasksUserSidebar";
import TaskGroupsSidebar, { type TaskGroup } from "@/components/tasks/TaskGroupsSidebar";
import { TaskDetailModal } from "@/components/tasks/task-detail-modal";
import { useTaskStore } from "@/hooks/use-task-store";
import type { Task } from "@/hooks/use-task-store";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";
import { useFixedTasks } from "@/hooks/use-fixed-tasks";
import { getNextResetInfo } from "@/lib/task-scheduler";
import { usePermissionRobust } from '@/hooks/use-permissions-robust';
import { EditTaskModal } from "@/components/tasks/edit-task-modal";
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
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  Clock,
  Columns3,
  LayoutList,
  Plus,
  RefreshCw,
  Search,
  Send,
  X,
  Zap,
} from "lucide-react";
import { isToday } from "date-fns";
import { cn } from "@/lib/utils";

// Componentes extraídos
import { TareasFijasTab } from "./tareas-fijas-tab";
import { HistorialTab } from "./historial-tab";
import { EstadisticasTab } from "./estadisticas-tab";





function getAvatarColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();
}

// ─── Types ─────────────────────────────────────────
interface FixedTask {
  id: string;
  title: string;
  description: string;
  frequency: 'diaria' | 'semanal' | 'quincenal' | 'mensual' | 'trimestral' | 'semestral' | 'anual';
  assignedTo: { id: string; name: string };
  department: string;
  instructives: { id: string; title: string; content: string; attachments?: string[] }[];
  estimatedTime: number;
  priority: 'baja' | 'media' | 'alta';
  isActive: boolean;
  lastExecuted?: string;
  nextExecution: string;
  createdAt: string;
  completedAt?: string;
  isCompleted?: boolean;
}

type ActiveTab = 'tareas' | 'fijas' | 'dashboard' | 'historial' | 'metricas';
type ViewMode = 'kanban' | 'lista';

interface TareasContentProps {
  activeTab: ActiveTab;
}

// ─── Main TareasContent Component ──────────────────

export default function TareasContent({ activeTab }: TareasContentProps) {
  const userColors = useUserColors();
  const confirm = useConfirm();
  const { currentCompany } = useCompany();

  // ── States para el tab "tareas" (nuevo layout tipo Agenda) ──
  const [viewMode, setViewMode] = useState<ViewMode>('kanban');
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [selectedGroupId, setSelectedGroupId] = useState<number | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [showOnlyOverdue, setShowOnlyOverdue] = useState(false);
  const [showOnlyToday, setShowOnlyToday] = useState(false);
  const [quickTaskInput, setQuickTaskInput] = useState('');
  const [isCreatingQuickTask, setIsCreatingQuickTask] = useState(false);

  // ── States generales ──
  const [isNewTaskModalOpen, setIsNewTaskModalOpen] = useState(false);
  const [editingRegularTask, setEditingRegularTask] = useState<any>(null);
  const [isEditTaskModalOpen, setIsEditTaskModalOpen] = useState(false);

  // Fixed tasks states
  const [selectedFixedTask, setSelectedFixedTask] = useState<FixedTask | null>(null);
  const [isFixedTaskDetailOpen, setIsFixedTaskDetailOpen] = useState(false);
  const [executingTask, setExecutingTask] = useState<FixedTask | null>(null);
  const [isExecutionModalOpen, setIsExecutionModalOpen] = useState(false);
  const [isCreateTaskModalOpen, setIsCreateTaskModalOpen] = useState(false);
  const [preselectedFrequency, setPreselectedFrequency] = useState<string | undefined>(undefined);
  const [editingTask, setEditingTask] = useState<FixedTask | null>(null);
  const [fixedTaskToDelete, setFixedTaskToDelete] = useState<FixedTask | null>(null);
  const [isDeleteFixedTaskDialogOpen, setIsDeleteFixedTaskDialogOpen] = useState(false);
  const [isDeletingFixedTask, setIsDeletingFixedTask] = useState(false);

  const { hasPermission: canViewTasks } = usePermissionRobust('ingresar_tareas');
  const { hasPermission: canCreateFixedTask } = usePermissionRobust('crear_tarea_fija');
  const { hasPermission: canEditFixedTask } = usePermissionRobust('editar_tarea_fija');
  const { hasPermission: canDeleteFixedTask } = usePermissionRobust('eliminar_tarea_fija');

  const { tasks, fetchTasks, createTask, updateTaskAPI, deleteTask, setSelectedTask, selectedTask } = useTaskStore();
  const { user } = useAuth();
  const [isLoadingTasks, setIsLoadingTasks] = useState(false);

  // Usuarios con permiso de tareas — cacheados con TanStack Query
  const { data: allUsers = [] } = useQuery({
    queryKey: ['users-with-roles'],
    queryFn: async () => {
      const response = await fetch('/api/admin/users-with-roles', {
        credentials: 'include',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` },
      });
      if (!response.ok) return [];
      const data = await response.json();
      const arr = Array.isArray(data) ? data : (data?.users || []);
      return arr.filter((u: any) =>
        u.permissions?.some((p: any) => p.name === 'ingresar_tareas') ||
        u.roles?.some((r: any) => r.permissions?.some((p: any) => p.name === 'ingresar_tareas'))
      );
    },
    staleTime: 5 * 60 * 1000, // 5 minutos
  });

  // Grupos de tareas
  const { data: taskGroupsData, refetch: refetchGroups } = useQuery({
    queryKey: ['task-groups', currentCompany?.id],
    queryFn: async () => {
      if (!currentCompany?.id) return [];
      const res = await fetch(`/api/task-groups?companyId=${currentCompany.id}`, {
        credentials: 'include',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` },
      });
      if (!res.ok) return [];
      const data = await res.json();
      return data.data as TaskGroup[];
    },
    enabled: !!currentCompany?.id,
    staleTime: 30 * 1000, // 30 segundos
  });
  const taskGroups = taskGroupsData || [];

  const {
    tasks: fixedTasks,
    loading: fixedTasksLoading,
    createTask: createFixedTask,
    updateTask: updateFixedTask,
    deleteTask: deleteFixedTask,
    refetch: refetchFixedTasks
  } = useFixedTasks();

  useEffect(() => { fetchTasks(); }, [fetchTasks]);

  // ── Stats globales para KPI cards ──
  const taskStats = useMemo(() => {
    const now = new Date();
    return {
      pending: tasks.filter(t => t.status !== 'realizada' && t.status !== 'cancelada').length,
      inProgress: tasks.filter(t => t.status === 'en-curso').length,
      overdue: tasks.filter(t =>
        t.dueDate && new Date(t.dueDate) < now &&
        t.status !== 'realizada' && t.status !== 'cancelada'
      ).length,
      today: tasks.filter(t =>
        t.dueDate && isToday(new Date(t.dueDate))
      ).length,
      urgent: tasks.filter(t =>
        t.priority === 'urgente' && t.status !== 'realizada'
      ).length,
      completedToday: tasks.filter(t =>
        t.status === 'realizada' && t.updatedAt && isToday(new Date(t.updatedAt))
      ).length,
    };
  }, [tasks]);

  // ── Tareas filtradas (para el tab "tareas") ──
  const filteredTasks = useMemo(() => {
    const now = new Date();
    return tasks.filter(task => {
      // Filtro por grupo seleccionado
      if (selectedGroupId !== null && (task as any).groupId !== selectedGroupId) return false;
      // Filtro por usuario seleccionado
      if (selectedUserId && task.assignedTo?.id?.toString() !== selectedUserId) return false;

      // Filtro de solo vencidas
      if (showOnlyOverdue) {
        if (!task.dueDate || new Date(task.dueDate) >= now ||
          task.status === 'realizada' || task.status === 'cancelada') return false;
      }
      // Filtro de solo hoy
      if (showOnlyToday) {
        if (!task.dueDate || !isToday(new Date(task.dueDate))) return false;
      }
      // Filtro por estado
      if (statusFilter !== 'all' && task.status !== statusFilter) return false;
      // Filtro por prioridad
      if (priorityFilter !== 'all' && task.priority !== priorityFilter) return false;
      // Búsqueda por texto
      if (searchTerm) {
        const q = searchTerm.toLowerCase();
        const matchTitle = task.title?.toLowerCase().includes(q);
        const matchDescription = task.description?.toLowerCase().includes(q);
        const matchAssignee = task.assignedTo?.name?.toLowerCase().includes(q);
        if (!matchTitle && !matchDescription && !matchAssignee) return false;
      }
      return true;
    });
  }, [tasks, selectedUserId, selectedGroupId, showOnlyOverdue, showOnlyToday, statusFilter, priorityFilter, searchTerm]);

  // ── User stats ──
  const userStats = useMemo(() => ({
    userTasks: tasks.filter(task =>
      task.assignedTo?.id?.toString() === user?.id ||
      task.createdBy?.id?.toString() === user?.id
    ),
    userFixedTasks: fixedTasks.filter(task =>
      task.assignedTo?.id?.toString() === user?.id
    )
  }), [tasks, fixedTasks, user?.id]);

  // ── Usuario seleccionado (para header) ──
  const selectedUserData = useMemo(() => {
    if (!selectedUserId) return null;
    return allUsers.find(u => u.id?.toString() === selectedUserId) ||
      tasks.find(t => t.assignedTo?.id?.toString() === selectedUserId)?.assignedTo;
  }, [selectedUserId, allUsers, tasks]);

  // ─── Handlers ──────────────────────────────────────

  const handleRefresh = useCallback(async () => {
    setIsLoadingTasks(true);
    try {
      await fetchTasks();
    } finally {
      setIsLoadingTasks(false);
    }
  }, [fetchTasks]);

  const handleQuickTask = async () => {
    if (!quickTaskInput.trim()) return;
    setIsCreatingQuickTask(true);
    try {
      const taskData: any = {
        title: quickTaskInput.trim(),
        priority: 'media',
        status: 'pendiente',
      };
      if (selectedUserId) {
        taskData.assignedToId = parseInt(selectedUserId);
      }
      const created = await createTask(taskData);
      const createdTitle = (created as any)?.title || taskData.title;
      setQuickTaskInput('');
      toast.success(`Tarea creada: ${createdTitle}`);
    } catch (error) {
      toast.error('No se pudo crear la tarea');
    } finally {
      setIsCreatingQuickTask(false);
    }
  };

  const handleDeleteTask = async (task: Task) => {
    const ok = await confirm({
      title: 'Eliminar tarea',
      description: `¿Eliminar "${task.title}"? Esta acción no se puede deshacer.`,
      confirmText: 'Eliminar',
      variant: 'destructive',
    });
    if (!ok) return;
    try {
      await deleteTask(task.id);
      toast.success(`Tarea eliminada: ${task.title}`);
    } catch {
      toast.error('No se pudo eliminar la tarea');
    }
  };

  const handleStatusChange = async (task: Task) => {
    try {
      const newStatus = task.status === 'realizada' ? 'pendiente' : 'realizada';
      await updateTaskAPI(task.id, { status: newStatus });
    } catch (error) {
      toast.error('No se pudo actualizar el estado');
    }
  };

  const handleNewTask = async (taskData: any) => {
    try {
      await createTask(taskData);
      setIsNewTaskModalOpen(false);
    } catch (error) {
      console.error('Error creating task:', error);
    }
  };

  const handleFixedTaskClick = (task: FixedTask) => {
    setSelectedFixedTask(task);
    setIsFixedTaskDetailOpen(true);
  };

  const handleEditFixedTask = (task: FixedTask) => {
    if (!canEditFixedTask) {
      toast.error('No tienes permisos para editar tareas fijas');
      return;
    }
    setEditingTask(task);
    setIsCreateTaskModalOpen(true);
  };

  const handleDeleteFixedTask = (taskId: string) => {
    if (!canDeleteFixedTask) {
      toast.error('No tienes permisos para eliminar tareas fijas');
      return;
    }
    const taskToDelete = fixedTasks.find(task => task.id === taskId);
    if (!taskToDelete) return;
    setFixedTaskToDelete(taskToDelete);
    setIsDeleteFixedTaskDialogOpen(true);
  };

  const confirmDeleteFixedTask = async () => {
    if (!fixedTaskToDelete) return;
    setIsDeletingFixedTask(true);
    try {
      await deleteFixedTask(fixedTaskToDelete.id);
      toast.success(`Tarea "${fixedTaskToDelete.title}" eliminada`);
      setIsDeleteFixedTaskDialogOpen(false);
      setFixedTaskToDelete(null);
    } catch (error: any) {
      toast.error(error instanceof Error && error.message ? error.message : 'No se pudo eliminar la tarea');
    } finally {
      setIsDeletingFixedTask(false);
    }
  };

  const handleCreateFixedTask = (frequency: string) => {
    if (!canCreateFixedTask) {
      toast.error('No tienes permisos para crear tareas fijas');
      return;
    }
    setPreselectedFrequency(frequency);
    setEditingTask(null);
    setIsCreateTaskModalOpen(true);
  };

  const handleCloseCreateModal = () => {
    setIsCreateTaskModalOpen(false);
    setPreselectedFrequency(undefined);
    setEditingTask(null);
  };

  const handleTaskCreated = async (taskData: any) => {
    try {
      if (editingTask) {
        await updateFixedTask(editingTask.id, taskData);
        toast.success(`${taskData.title} ha sido actualizada`);
      } else {
        await createFixedTask(taskData);
        toast.success(`${taskData.title} programada como tarea ${taskData.frequency}`);
      }
      setIsCreateTaskModalOpen(false);
      setPreselectedFrequency(undefined);
      setEditingTask(null);
    } catch (error: any) {
      toast.error(error instanceof Error && error.message ? error.message : 'No se pudo ' + (editingTask ? 'editar' : 'crear') + ' la tarea fija');
    }
  };

  const handleExecuteFixedTask = (task: FixedTask) => {
    setExecutingTask(task);
    setIsExecutionModalOpen(true);
    setIsFixedTaskDetailOpen(false);
  };

  const handleCompleteTask = async (taskId: string, executionData: any) => {
    try {
      const response = await fetch(`/api/fixed-tasks/${taskId}/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          executionData: {
            userId: user?.id,
            duration: executionData.duration || null,
            notes: executionData.notes || '',
            attachments: executionData.attachments || [],
          }
        }),
      });
      if (!response.ok) throw new Error('Error al completar la tarea');
      const result = await response.json();
      const completedTask = fixedTasks.find(task => task.id === taskId);
      if (result.resetResult?.taskReset) {
        toast.success(`${completedTask?.title} completada y reiniciada automáticamente`);
      } else {
        const nextReset = getNextResetInfo(completedTask?.frequency || 'diaria', result.task.nextExecution);
        toast.success(`${completedTask?.title} completada — ${nextReset.text}`);
      }
      refetchFixedTasks();
      setIsExecutionModalOpen(false);
      setExecutingTask(null);
    } catch (error: any) {
      toast.error(error instanceof Error && error.message ? error.message : 'No se pudo completar la tarea');
      throw error;
    }
  };

  // ─── Render por tab ────────────────────────────────

  const renderTareasTab = () => (
    <div className="flex flex-col h-full gap-4 px-6 py-4">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ClipboardList className="h-6 w-6" style={{ color: userColors.chart1 }} />
            Tareas
          </h1>
          <p className="text-sm text-muted-foreground">Gestión de tareas del equipo</p>
        </div>
        <Button onClick={() => setIsNewTaskModalOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Nueva Tarea
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Pendientes</p>
                <p className="text-2xl font-bold">{taskStats.pending}</p>
                {taskStats.urgent > 0 && (
                  <p className="text-xs text-muted-foreground mt-1">
                    <span className="font-medium" style={{ color: userColors.chart4 }}>{taskStats.urgent}</span> urgentes
                  </p>
                )}
              </div>
              <div className="h-10 w-10 rounded-full flex items-center justify-center" style={{ backgroundColor: `${userColors.chart1}15` }}>
                <ClipboardList className="h-5 w-5" style={{ color: userColors.chart1 }} />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card
          className="cursor-pointer hover:shadow-md transition-all"
          style={
            showOnlyOverdue
              ? { borderColor: `${userColors.kpiNegative}50`, backgroundColor: `${userColors.kpiNegative}08` }
              : taskStats.overdue > 0
              ? { borderColor: `${userColors.kpiNegative}30` }
              : {}
          }
          onClick={() => { setShowOnlyOverdue(!showOnlyOverdue); setShowOnlyToday(false); }}
        >
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Vencidas</p>
                <p className="text-2xl font-bold" style={taskStats.overdue > 0 ? { color: userColors.kpiNegative } : {}}>{taskStats.overdue}</p>
                {taskStats.overdue > 0
                  ? <p className="text-xs mt-1" style={{ color: userColors.kpiNegative }}>Requieren atención</p>
                  : <p className="text-xs text-muted-foreground mt-1">Al día</p>
                }
              </div>
              <div className="h-10 w-10 rounded-full flex items-center justify-center" style={{ backgroundColor: `${userColors.kpiNegative}15` }}>
                <AlertTriangle className="h-5 w-5" style={{ color: userColors.kpiNegative }} />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card
          className="cursor-pointer hover:shadow-md transition-all"
          style={showOnlyToday ? { borderColor: `${userColors.chart4}50`, backgroundColor: `${userColors.chart4}08` } : {}}
          onClick={() => { setShowOnlyToday(!showOnlyToday); setShowOnlyOverdue(false); }}
        >
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Para Hoy</p>
                <p className="text-2xl font-bold">{taskStats.today}</p>
                <p className="text-xs text-muted-foreground mt-1">{taskStats.today === 0 ? 'Sin vencimientos' : 'tareas'}</p>
              </div>
              <div className="h-10 w-10 rounded-full flex items-center justify-center" style={{ backgroundColor: `${userColors.chart4}15` }}>
                <CalendarDays className="h-5 w-5" style={{ color: userColors.chart4 }} />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Completadas Hoy</p>
                <p className="text-2xl font-bold" style={{ color: userColors.kpiPositive }}>{taskStats.completedToday}</p>
                <p className="text-xs text-muted-foreground mt-1">Cerradas hoy</p>
              </div>
              <div className="h-10 w-10 rounded-full flex items-center justify-center" style={{ backgroundColor: `${userColors.kpiPositive}15` }}>
                <CheckCircle2 className="h-5 w-5" style={{ color: userColors.kpiPositive }} />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider">En Curso</p>
                <p className="text-2xl font-bold" style={{ color: userColors.chart2 }}>{taskStats.inProgress}</p>
                <p className="text-xs text-muted-foreground mt-1">En progreso</p>
              </div>
              <div className="h-10 w-10 rounded-full flex items-center justify-center" style={{ backgroundColor: `${userColors.chart2}15` }}>
                <RefreshCw className="h-5 w-5" style={{ color: userColors.chart2 }} />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Layout: Sidebars + Content */}
      <div className="flex flex-1 gap-3 min-h-0">
        {/* Sidebar de grupos */}
        {currentCompany?.id && (
          <TaskGroupsSidebar
            groups={taskGroups}
            selectedGroupId={selectedGroupId}
            onGroupSelect={setSelectedGroupId}
            companyId={currentCompany.id}
            onGroupsChange={refetchGroups}
          />
        )}

        {/* Sidebar de usuarios */}
        <TasksUserSidebar
          tasks={tasks}
          users={allUsers}
          selectedUserId={selectedUserId}
          onUserSelect={setSelectedUserId}
        />

        {/* Área de contenido */}
        <div className="flex-1 flex flex-col min-w-0 gap-4">
          {/* Toolbar */}
          <div className="flex items-center gap-3 flex-wrap">
            <div className="relative flex-1 min-w-[200px] max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar tareas..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
              {searchTerm && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0"
                  aria-label="Limpiar búsqueda"
                  onClick={() => setSearchTerm('')}
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>

            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Estado" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="pendiente">Pendientes</SelectItem>
                <SelectItem value="en-curso">En curso</SelectItem>
                <SelectItem value="realizada">Realizadas</SelectItem>
                <SelectItem value="cancelada">Canceladas</SelectItem>
              </SelectContent>
            </Select>

            <Select value={priorityFilter} onValueChange={setPriorityFilter}>
              <SelectTrigger className="w-[130px]">
                <SelectValue placeholder="Prioridad" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                <SelectItem value="urgente">Urgente</SelectItem>
                <SelectItem value="alta">Alta</SelectItem>
                <SelectItem value="media">Media</SelectItem>
                <SelectItem value="baja">Baja</SelectItem>
              </SelectContent>
            </Select>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="icon"
                  aria-label="Actualizar tareas"
                  onClick={handleRefresh}
                  disabled={isLoadingTasks}
                >
                  <RefreshCw className={cn("h-4 w-4", isLoadingTasks && "animate-spin")} />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Actualizar</TooltipContent>
            </Tooltip>

            {/* View Toggle */}
            <div className="flex border rounded-lg p-1 gap-1 ml-auto">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant={viewMode === 'kanban' ? 'secondary' : 'ghost'}
                    size="sm"
                    className="h-8 w-8 p-0"
                    aria-label="Vista Kanban"
                    onClick={() => setViewMode('kanban')}
                  >
                    <Columns3 className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Vista Kanban</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant={viewMode === 'lista' ? 'secondary' : 'ghost'}
                    size="sm"
                    className="h-8 w-8 p-0"
                    aria-label="Vista Lista"
                    onClick={() => setViewMode('lista')}
                  >
                    <LayoutList className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Vista Lista</TooltipContent>
              </Tooltip>
            </div>
          </div>

          {/* Quick Task Input */}
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Plus className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={
                  selectedUserData
                    ? `Agregar tarea rápida para ${selectedUserData.name}...`
                    : "Agregar tarea rápida..."
                }
                value={quickTaskInput}
                onChange={(e) => setQuickTaskInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleQuickTask()}
                className="pl-10"
              />
            </div>
            <Button
              onClick={handleQuickTask}
              disabled={!quickTaskInput.trim() || isCreatingQuickTask}
              variant="secondary"
            >
              {isCreatingQuickTask ? "Creando..." : "Agregar"}
            </Button>
          </div>

          {/* Selected User Header */}
          {selectedUserData && (
            <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
              <Avatar className="h-10 w-10">
                <AvatarFallback
                  style={{ backgroundColor: getAvatarColor(selectedUserData.name || '') }}
                  className="text-white font-medium"
                >
                  {getInitials(selectedUserData.name || '?')}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <h2 className="font-semibold">{selectedUserData.name}</h2>
                <p className="text-sm text-muted-foreground">
                  {filteredTasks.length} tarea{filteredTasks.length !== 1 ? 's' : ''}
                </p>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setSelectedUserId(null)}>
                <X className="h-4 w-4 mr-1" />
                Limpiar
              </Button>
            </div>
          )}

          {/* Vista principal */}
          <div className="flex-1 overflow-hidden">
            {viewMode === 'kanban' && (
              <TasksKanbanView
                tasks={filteredTasks}
                onSelect={(task) => setSelectedTask(task)}
                onStatusChange={handleStatusChange}
                onEdit={(task) => { setEditingRegularTask(task); setIsEditTaskModalOpen(true); }}
                onDelete={handleDeleteTask}
              />
            )}
            {viewMode === 'lista' && (
              <TasksList
                tasks={filteredTasks}
                activeTab="todas"
                quickFilter=""
                includeCompleted={statusFilter === 'all' || statusFilter === 'realizada'}
                currentUserId={user?.id}
                selectedTaskId={selectedTask?.id}
                onTaskSelect={(task) => setSelectedTask(task)}
                onTaskEdit={(task) => { setEditingRegularTask(task); setIsEditTaskModalOpen(true); }}
                canEdit={(task) => task.assignedTo?.id?.toString() === user?.id || canViewTasks}
                canDelete={(task) => task.createdBy?.id?.toString() === user?.id || canViewTasks}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );

  const renderContent = () => {
    switch (activeTab) {
      case 'tareas':
        return renderTareasTab();
      case 'fijas':
        return (
          <TareasFijasTab
            tasks={fixedTasks}
            loading={fixedTasksLoading}
            onTaskClick={handleFixedTaskClick}
            onEditTask={handleEditFixedTask}
            onDeleteTask={handleDeleteFixedTask}
            onCreateTask={handleCreateFixedTask}
            onExecuteTask={handleExecuteFixedTask}
            canCreateFixedTask={canCreateFixedTask}
            onCheckResets={() => {
              toast.success('Sistema reactivo activado — los reinicios son automáticos');
            }}
          />
        );
      case 'dashboard': {
        const now = new Date();
        const myTasks = tasks.filter(t => t.assignedTo?.id?.toString() === user?.id?.toString());
        const myPending = myTasks.filter(t => t.status !== 'realizada' && t.status !== 'cancelada');
        const myOverdue = myPending.filter(t => t.dueDate && new Date(t.dueDate) < now);
        const myCompletedToday = myTasks.filter(t => t.status === 'realizada' && t.updatedAt && isToday(new Date(t.updatedAt)));
        const myUrgent = myPending.filter(t => t.priority === 'urgente' || t.priority === 'alta');
        const mySent = tasks.filter(t => t.createdBy?.id?.toString() === user?.id?.toString() && t.assignedTo?.id?.toString() !== user?.id?.toString());

        // Mis próximas tareas: ordenadas por vencimiento (primero las vencidas, luego por fecha)
        const myUpcoming = [...myPending].sort((a, b) => {
          const aDate = a.dueDate ? new Date(a.dueDate).getTime() : Infinity;
          const bDate = b.dueDate ? new Date(b.dueDate).getTime() : Infinity;
          return aDate - bDate;
        }).slice(0, 5);

        const teamProgress = allUsers.map((u: any) => {
          const uTasks = tasks.filter(t => t.assignedTo?.id?.toString() === u.id?.toString());
          const uCompleted = uTasks.filter(t => t.status === 'realizada').length;
          const uOverdue = uTasks.filter(t =>
            t.status !== 'realizada' && t.status !== 'cancelada' &&
            t.dueDate && new Date(t.dueDate) < now
          ).length;
          return { id: u.id, name: u.name, total: uTasks.length, completed: uCompleted, overdue: uOverdue, rate: uTasks.length > 0 ? Math.round((uCompleted / uTasks.length) * 100) : 0 };
        }).filter((u: any) => u.total > 0).sort((a: any, b: any) => b.total - a.total);

        const getPriorityStyle = (priority: string) => {
          switch (priority) {
            case 'urgente': return { color: userColors.kpiNegative, label: 'Urgente' };
            case 'alta': return { color: userColors.chart4, label: 'Alta' };
            case 'media': return { color: userColors.chart2, label: 'Media' };
            default: return { color: userColors.kpiNeutral, label: 'Baja' };
          }
        };

        return (
          <div className="space-y-6 p-6">
            <div className="flex justify-between items-center">
              <div>
                <h1 className="text-2xl font-bold flex items-center gap-2">
                  <ClipboardList className="h-6 w-6" style={{ color: userColors.chart1 }} />
                  Mi Resumen
                </h1>
                <p className="text-sm text-muted-foreground">Resumen personal y progreso del equipo</p>
              </div>
              <Button onClick={() => setIsNewTaskModalOpen(true)}>
                <Plus className="h-4 w-4 mr-2" /> Nueva Tarea
              </Button>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-muted-foreground uppercase tracking-wider">Mis Pendientes</p>
                      <p className="text-2xl font-bold">{myPending.length}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {myUrgent.length > 0
                          ? <><span className="font-medium" style={{ color: userColors.chart4 }}>{myUrgent.length}</span> urgentes/altas</>
                          : 'Tareas activas'}
                      </p>
                    </div>
                    <div className="h-10 w-10 rounded-full flex items-center justify-center" style={{ backgroundColor: `${userColors.chart1}15` }}>
                      <Clock className="h-5 w-5" style={{ color: userColors.chart1 }} />
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card style={myOverdue.length > 0 ? { borderColor: `${userColors.kpiNegative}50`, backgroundColor: `${userColors.kpiNegative}08` } : {}}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-muted-foreground uppercase tracking-wider">Vencidas</p>
                      <p className="text-2xl font-bold" style={myOverdue.length > 0 ? { color: userColors.kpiNegative } : {}}>{myOverdue.length}</p>
                      {myOverdue.length > 0
                        ? <p className="text-xs mt-1" style={{ color: userColors.kpiNegative }}>Requieren atención</p>
                        : <p className="text-xs text-muted-foreground mt-1">Al día</p>}
                    </div>
                    <div className="h-10 w-10 rounded-full flex items-center justify-center" style={{ backgroundColor: `${userColors.kpiNegative}15` }}>
                      <AlertTriangle className="h-5 w-5" style={{ color: userColors.kpiNegative }} />
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-muted-foreground uppercase tracking-wider">Completadas Hoy</p>
                      <p className="text-2xl font-bold" style={{ color: userColors.kpiPositive }}>{myCompletedToday.length}</p>
                      <p className="text-xs text-muted-foreground mt-1">Cerradas hoy</p>
                    </div>
                    <div className="h-10 w-10 rounded-full flex items-center justify-center" style={{ backgroundColor: `${userColors.kpiPositive}15` }}>
                      <CheckCircle2 className="h-5 w-5" style={{ color: userColors.kpiPositive }} />
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-muted-foreground uppercase tracking-wider">Enviadas por mí</p>
                      <p className="text-2xl font-bold" style={{ color: userColors.chart2 }}>{mySent.length}</p>
                      <p className="text-xs text-muted-foreground mt-1">Creadas y asignadas a otros</p>
                    </div>
                    <div className="h-10 w-10 rounded-full flex items-center justify-center" style={{ backgroundColor: `${userColors.chart2}15` }}>
                      <Send className="h-5 w-5" style={{ color: userColors.chart2 }} />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Mis tareas + Team Progress */}
            <div className="grid gap-4 lg:grid-cols-2">
              {/* Mis próximas tareas */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Clock className="h-4 w-4" style={{ color: userColors.chart1 }} />
                    Mis próximas tareas
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {isLoadingTasks ? (
                    <div className="space-y-3">
                      {[1, 2, 3].map(i => (
                        <div key={i} className="h-12 bg-muted animate-pulse rounded-lg" />
                      ))}
                    </div>
                  ) : myUpcoming.length === 0 ? (
                    <div className="text-center py-8">
                      <CheckCircle2 className="h-8 w-8 mx-auto mb-2" style={{ color: userColors.kpiPositive }} />
                      <p className="text-sm font-medium">Sin tareas pendientes</p>
                      <p className="text-xs text-muted-foreground mt-1">¡Estás al día!</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {myUpcoming.map(task => {
                        const isOverdue = task.dueDate && new Date(task.dueDate) < now;
                        const pStyle = getPriorityStyle(task.priority || 'baja');
                        return (
                          <div
                            key={task.id}
                            className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
                            onClick={() => setSelectedTask(task)}
                          >
                            <div className="w-1.5 h-8 rounded-full flex-shrink-0" style={{ backgroundColor: pStyle.color }} />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">{task.title}</p>
                              <p className="text-xs text-muted-foreground">
                                {task.dueDate
                                  ? <span style={isOverdue ? { color: userColors.kpiNegative } : {}}>
                                      {isOverdue ? '⚠ ' : ''}{new Date(task.dueDate).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })}
                                    </span>
                                  : 'Sin fecha'}
                                {' · '}
                                <span style={{ color: pStyle.color }}>{pStyle.label}</span>
                              </p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Progreso del equipo */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Zap className="h-4 w-4" style={{ color: userColors.chart2 }} />
                    Progreso del equipo
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {teamProgress.length === 0 ? (
                    <div className="text-center py-8">
                      <p className="text-sm text-muted-foreground">No hay tareas asignadas al equipo</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {teamProgress.map((u: any) => (
                        <div key={u.id} className="space-y-1">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <Avatar className="h-7 w-7">
                                <AvatarFallback style={{ backgroundColor: getAvatarColor(u.name || '') }} className="text-white text-xs font-medium">
                                  {getInitials(u.name || '?')}
                                </AvatarFallback>
                              </Avatar>
                              <span className="text-sm font-medium">{u.name}</span>
                              {u.overdue > 0 && (
                                <span className="text-xs px-1.5 py-0.5 rounded-full" style={{ backgroundColor: `${userColors.kpiNegative}15`, color: userColors.kpiNegative }}>
                                  {u.overdue} venc.
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-3">
                              <span className="text-sm text-muted-foreground">{u.completed}/{u.total}</span>
                              <span className="text-sm font-semibold w-10 text-right" style={{ color: u.rate >= 70 ? userColors.kpiPositive : u.rate >= 40 ? userColors.chart4 : userColors.kpiNegative }}>
                                {u.rate}%
                              </span>
                            </div>
                          </div>
                          <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full transition-all duration-500"
                              style={{
                                backgroundColor: u.rate >= 70 ? userColors.kpiPositive : u.rate >= 40 ? userColors.chart4 : userColors.kpiNegative,
                                width: `${u.rate}%`
                              }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        );
      }
      case 'historial':
        return <HistorialTab />;
      case 'metricas':
        return <EstadisticasTab />;
      default:
        return null;
    }
  };

  return (
    <TooltipProvider>
      {renderContent()}

      {/* Task Detail Modal (Zustand selectedTask) */}
      <TaskDetailModal />

      {/* Modals */}
      <NewTaskModal
        isOpen={isNewTaskModalOpen}
        onClose={() => setIsNewTaskModalOpen(false)}
        onTaskCreated={handleNewTask}
        defaultGroupId={selectedGroupId}
      />

      {editingRegularTask && (
        <EditTaskModal
          isOpen={isEditTaskModalOpen}
          onClose={() => { setIsEditTaskModalOpen(false); setEditingRegularTask(null); }}
          task={editingRegularTask}
          onTaskUpdated={() => { fetchTasks(); setIsEditTaskModalOpen(false); setEditingRegularTask(null); }}
        />
      )}

      <CreateFixedTaskModal
        isOpen={isCreateTaskModalOpen}
        onClose={handleCloseCreateModal}
        onCreateTask={handleTaskCreated}
        frequency={preselectedFrequency}
        editingTask={editingTask}
      />

      <FixedTaskDetailModal
        isOpen={isFixedTaskDetailOpen}
        onClose={() => setIsFixedTaskDetailOpen(false)}
        task={selectedFixedTask as any}
        onEdit={handleEditFixedTask as any}
        onExecute={handleExecuteFixedTask as any}
        onTaskUpdated={() => refetchFixedTasks()}
      />

      <TaskExecutionModal
        isOpen={isExecutionModalOpen}
        onClose={() => setIsExecutionModalOpen(false)}
        task={executingTask as any}
        onComplete={handleCompleteTask}
      />

      <AlertDialog open={isDeleteFixedTaskDialogOpen} onOpenChange={setIsDeleteFixedTaskDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar tarea fija?</AlertDialogTitle>
            <AlertDialogDescription>
              Estás a punto de eliminar la tarea <strong>&quot;{fixedTaskToDelete?.title}&quot;</strong>.
              <br /><br />
              Esta acción eliminará permanentemente la tarea y todo su historial de ejecuciones. No se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeletingFixedTask}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeleteFixedTask} disabled={isDeletingFixedTask} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {isDeletingFixedTask ? "Eliminando..." : "Eliminar tarea"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </TooltipProvider>
  );
}
