'use client';

import { useState, useMemo } from 'react';
import { useAgenda } from '@/hooks/use-agenda-tasks';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Calendar,
  LayoutList,
  Columns3,
  Plus,
  Search,
  X,
  Clock,
  AlertTriangle,
  CheckCircle2,
  CalendarDays,
  Users,
  RefreshCw,
  User,
  ChevronRight,
  Target,
  TrendingUp,
  Zap,
  MoreHorizontal,
  PlayCircle,
  XCircle,
  Filter,
  ArrowUpDown,
  UserPlus,
  Trash2,
  MessageCircle,
  Mic,
  Pencil,
  Check,
} from 'lucide-react';
import { toast } from 'sonner';
import { format, isToday, isPast, formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '@/lib/utils';

import { AgendaCalendarView } from './AgendaCalendarView';
import { AgendaDetailPanel } from './AgendaDetailPanel';
import { TaskDialog } from './TaskDialog';
import type {
  AgendaTask,
  AgendaTaskStatus,
  Priority,
  AgendaTaskFilters,
} from '@/lib/agenda/types';
import { TASK_STATUS_CONFIG, PRIORITY_CONFIG, isTaskOverdue, getAssigneeName } from '@/lib/agenda/types';

const DEFAULT_COLORS = {
  chart1: '#6366f1',
  chart2: '#8b5cf6',
  chart3: '#ec4899',
  chart4: '#f59e0b',
  chart5: '#10b981',
  chart6: '#06b6d4',
  kpiPositive: '#10b981',
  kpiNegative: '#ef4444',
  kpiNeutral: '#64748b',
};

// Colores para avatares de personas
const AVATAR_COLORS = [
  '#6366f1', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981',
  '#06b6d4', '#3b82f6', '#ef4444', '#84cc16', '#f97316'
];

type ViewMode = 'tasks' | 'calendar';

interface PersonStats {
  name: string;
  totalTasks: number;
  pendingTasks: number;
  overdueTasks: number;
  completedToday: number;
  inProgressTasks: number;
  tasks: AgendaTask[];
}

export function AgendaPage() {
  const userColors = DEFAULT_COLORS;

  // Estado de vista
  const [viewMode, setViewMode] = useState<ViewMode>('tasks');
  const [selectedPerson, setSelectedPerson] = useState<string | null>(null);
  const [selectedTask, setSelectedTask] = useState<AgendaTask | null>(null);
  const [showDetailPanel, setShowDetailPanel] = useState(false);
  const [showTaskDialog, setShowTaskDialog] = useState(false);
  const [editingTask, setEditingTask] = useState<AgendaTask | null>(null);
  const [quickTaskInput, setQuickTaskInput] = useState('');

  // Filtros
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<AgendaTaskStatus | 'all'>('all');
  const [priorityFilter, setPriorityFilter] = useState<Priority | 'all'>('all');
  const [showOnlyOverdue, setShowOnlyOverdue] = useState(false);
  const [showOnlyToday, setShowOnlyToday] = useState(false);

  // Personas fijas
  const [showPersonDialog, setShowPersonDialog] = useState(false);
  const [fixedPeople, setFixedPeople] = useState<string[]>(() => {
    // Cargar personas fijas del localStorage
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('agenda_fixed_people');
      return saved ? JSON.parse(saved) : [];
    }
    return [];
  });
  const [newPersonName, setNewPersonName] = useState('');
  const [editingPerson, setEditingPerson] = useState<string | null>(null);
  const [editingPersonName, setEditingPersonName] = useState('');
  const [showDiscordHelp, setShowDiscordHelp] = useState(false);

  // Construir filtros para la API
  const apiFilters: AgendaTaskFilters = useMemo(
    () => ({
      status: statusFilter === 'all' ? undefined : statusFilter,
      priority: priorityFilter === 'all' ? undefined : priorityFilter,
      search: searchTerm || undefined,
    }),
    [statusFilter, priorityFilter, searchTerm]
  );

  // Hook de agenda
  const {
    tasks,
    stats,
    isLoading,
    refetch,
    createTask,
    updateTask,
    deleteTask,
    isCreating,
    isUpdating,
  } = useAgenda(apiFilters);

  // Agrupar tareas por persona
  const personStats = useMemo(() => {
    const grouped = new Map<string, PersonStats>();

    // Agregar personas fijas primero (siempre aparecen)
    fixedPeople.forEach(person => {
      grouped.set(person, {
        name: person,
        totalTasks: 0,
        pendingTasks: 0,
        overdueTasks: 0,
        completedToday: 0,
        inProgressTasks: 0,
        tasks: [],
      });
    });

    // Agregar "Sin asignar"
    grouped.set('Sin asignar', {
      name: 'Sin asignar',
      totalTasks: 0,
      pendingTasks: 0,
      overdueTasks: 0,
      completedToday: 0,
      inProgressTasks: 0,
      tasks: [],
    });

    tasks.forEach((task) => {
      const assignee = getAssigneeName(task);

      if (!grouped.has(assignee)) {
        grouped.set(assignee, {
          name: assignee,
          totalTasks: 0,
          pendingTasks: 0,
          overdueTasks: 0,
          completedToday: 0,
          inProgressTasks: 0,
          tasks: [],
        });
      }

      const personData = grouped.get(assignee)!;
      personData.totalTasks++;
      personData.tasks.push(task);

      if (task.status === 'PENDING') personData.pendingTasks++;
      if (task.status === 'IN_PROGRESS') personData.inProgressTasks++;
      if (isTaskOverdue(task) && task.status !== 'COMPLETED' && task.status !== 'CANCELLED') {
        personData.overdueTasks++;
      }
      if (task.status === 'COMPLETED' && task.completedAt && isToday(new Date(task.completedAt))) {
        personData.completedToday++;
      }
    });

    // Ordenar: personas fijas primero, luego por vencidas y pendientes
    return Array.from(grouped.values())
      .filter(p => p.totalTasks > 0 || p.name === 'Sin asignar' || fixedPeople.includes(p.name))
      .sort((a, b) => {
        if (a.name === 'Sin asignar') return 1;
        if (b.name === 'Sin asignar') return -1;
        // Personas fijas primero
        const aFixed = fixedPeople.includes(a.name);
        const bFixed = fixedPeople.includes(b.name);
        if (aFixed && !bFixed) return -1;
        if (!aFixed && bFixed) return 1;
        if (a.overdueTasks !== b.overdueTasks) return b.overdueTasks - a.overdueTasks;
        return b.pendingTasks - a.pendingTasks;
      });
  }, [tasks, fixedPeople]);

  // Filtrar tareas según selección
  const filteredTasks = useMemo(() => {
    let result = tasks;

    // Filtrar por persona
    if (selectedPerson) {
      result = result.filter((t) => getAssigneeName(t) === selectedPerson);
    }

    // Filtrar solo vencidas
    if (showOnlyOverdue) {
      result = result.filter((t) => isTaskOverdue(t) && t.status !== 'COMPLETED' && t.status !== 'CANCELLED');
    }

    // Filtrar solo hoy
    if (showOnlyToday) {
      result = result.filter((t) => t.dueDate && isToday(new Date(t.dueDate)));
    }

    // Búsqueda local
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter(
        (t) =>
          t.title.toLowerCase().includes(term) ||
          t.description?.toLowerCase().includes(term) ||
          t.assignedToName?.toLowerCase().includes(term)
      );
    }

    return result;
  }, [tasks, selectedPerson, searchTerm, showOnlyOverdue, showOnlyToday]);

  // Tareas agrupadas por estado para vista de tablero
  const tasksByStatus = useMemo(() => {
    const pending = filteredTasks.filter(t => t.status === 'PENDING');
    const inProgress = filteredTasks.filter(t => t.status === 'IN_PROGRESS');
    const waiting = filteredTasks.filter(t => t.status === 'WAITING');
    const completed = filteredTasks.filter(t => t.status === 'COMPLETED');

    return { pending, inProgress, waiting, completed };
  }, [filteredTasks]);

  // Stats globales
  const globalStats = useMemo(() => {
    const today = new Date();
    const activeStatuses: AgendaTaskStatus[] = ['PENDING', 'IN_PROGRESS', 'WAITING'];

    const activeTasks = tasks.filter(t => activeStatuses.includes(t.status));
    const overdueTasks = activeTasks.filter(t => isTaskOverdue(t));
    const todayTasks = tasks.filter(t => t.dueDate && isToday(new Date(t.dueDate)));
    const urgentTasks = activeTasks.filter(t => t.priority === 'URGENT' || t.priority === 'HIGH');
    const completedToday = tasks.filter(t =>
      t.status === 'COMPLETED' && t.completedAt && isToday(new Date(t.completedAt))
    );

    return {
      total: tasks.length,
      active: activeTasks.length,
      overdue: overdueTasks.length,
      today: todayTasks.length,
      urgent: urgentTasks.length,
      completedToday: completedToday.length,
      people: personStats.filter(p => p.name !== 'Sin asignar').length,
    };
  }, [tasks, personStats]);

  // Handlers
  const handleTaskSelect = (task: AgendaTask) => {
    setSelectedTask(task);
    setShowDetailPanel(true);
  };

  const handleCreateTask = (assignee?: string) => {
    setEditingTask(null);
    setShowTaskDialog(true);
  };

  const handleEditTask = (task: AgendaTask) => {
    setEditingTask(task);
    setShowTaskDialog(true);
  };

  const handleTaskSave = async (data: any) => {
    try {
      if (editingTask) {
        await updateTask(editingTask.id, data);
        toast.success('Tarea actualizada');
      } else {
        await createTask(data);
        toast.success('Tarea creada');
      }
      setShowTaskDialog(false);
      setEditingTask(null);
    } catch (error) {
      toast.error(editingTask ? 'Error al actualizar' : 'Error al crear');
    }
  };

  const handleDeleteTask = async (taskId: number) => {
    if (!confirm('¿Eliminar esta tarea? Esta acción no se puede deshacer.')) return;
    try {
      await deleteTask(taskId);
      toast.success('Tarea eliminada');
      setShowDetailPanel(false);
      setSelectedTask(null);
    } catch (error) {
      toast.error('Error al eliminar');
    }
  };

  const handleStatusChange = async (taskId: number, status: AgendaTaskStatus) => {
    try {
      await updateTask(taskId, { status });
      toast.success('Estado actualizado');
      if (selectedTask?.id === taskId) {
        setSelectedTask({ ...selectedTask, status });
      }
    } catch (error) {
      toast.error('Error al actualizar estado');
    }
  };

  const handleQuickTask = async () => {
    if (!quickTaskInput.trim()) return;

    try {
      await createTask({
        title: quickTaskInput.trim(),
        priority: 'MEDIUM',
        assignedToName: selectedPerson && selectedPerson !== 'Sin asignar' ? selectedPerson : undefined,
      });
      toast.success('Tarea creada');
      setQuickTaskInput('');
    } catch (error) {
      toast.error('Error al crear tarea');
    }
  };

  const getAvatarColor = (name: string) => {
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  // Handlers para personas fijas
  const handleAddPerson = () => {
    if (!newPersonName.trim()) return;
    const name = newPersonName.trim();
    if (fixedPeople.includes(name)) {
      toast.error('Esta persona ya existe');
      return;
    }
    const updated = [...fixedPeople, name];
    setFixedPeople(updated);
    localStorage.setItem('agenda_fixed_people', JSON.stringify(updated));
    setNewPersonName('');
    toast.success(`${name} agregado a personas fijas`);
  };

  const handleRemovePerson = (name: string) => {
    const updated = fixedPeople.filter(p => p !== name);
    setFixedPeople(updated);
    localStorage.setItem('agenda_fixed_people', JSON.stringify(updated));
    toast.success(`${name} removido de personas fijas`);
  };

  const handleStartEditPerson = (name: string) => {
    setEditingPerson(name);
    setEditingPersonName(name);
  };

  const handleCancelEditPerson = () => {
    setEditingPerson(null);
    setEditingPersonName('');
  };

  const handleSaveEditPerson = () => {
    if (!editingPerson || !editingPersonName.trim()) return;

    const newName = editingPersonName.trim();

    // Si el nombre no cambió, solo cancelar
    if (newName === editingPerson) {
      handleCancelEditPerson();
      return;
    }

    // Verificar que no exista ya
    if (fixedPeople.includes(newName)) {
      toast.error('Ya existe una persona con ese nombre');
      return;
    }

    // Actualizar el nombre
    const updated = fixedPeople.map(p => p === editingPerson ? newName : p);
    setFixedPeople(updated);
    localStorage.setItem('agenda_fixed_people', JSON.stringify(updated));
    toast.success(`Nombre actualizado a "${newName}"`);
    handleCancelEditPerson();
  };

  // Loading state
  if (isLoading && tasks.length === 0) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-200px)] px-6 py-4">
        <div className="flex flex-col items-center gap-3">
          <div className="relative">
            <div className="h-16 w-16 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
            <Calendar className="h-6 w-6 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-primary" />
          </div>
          <p className="text-sm text-muted-foreground">Cargando tu agenda...</p>
        </div>
      </div>
    );
  }

  return (
    <TooltipProvider>
      <div className="flex flex-col h-[calc(100vh-120px)] gap-4 px-6 py-4">
        {/* Header con Stats Rápidos */}
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Calendar className="h-6 w-6" style={{ color: userColors.chart1 }} />
              Mi Agenda
            </h1>
            <p className="text-sm text-muted-foreground">
              Seguimiento de pedidos y tareas asignadas
            </p>
          </div>

          {/* Quick Stats Pills */}
          <div className="flex items-center gap-2 flex-wrap">
            <Badge
              variant="outline"
              className="cursor-pointer hover:bg-muted transition-colors px-3 py-1"
              style={showOnlyOverdue ? { backgroundColor: `${userColors.kpiNegative}15`, borderColor: userColors.kpiNegative } : {}}
              onClick={() => { setShowOnlyOverdue(!showOnlyOverdue); setShowOnlyToday(false); }}
            >
              <AlertTriangle className="h-3 w-3 mr-1" style={{ color: userColors.kpiNegative }} />
              <span className="font-semibold" style={{ color: userColors.kpiNegative }}>{globalStats.overdue}</span>
              <span className="ml-1 text-muted-foreground">vencidas</span>
            </Badge>

            <Badge
              variant="outline"
              className="cursor-pointer hover:bg-muted transition-colors px-3 py-1"
              style={showOnlyToday ? { backgroundColor: `${userColors.chart4}15`, borderColor: userColors.chart4 } : {}}
              onClick={() => { setShowOnlyToday(!showOnlyToday); setShowOnlyOverdue(false); }}
            >
              <CalendarDays className="h-3 w-3 mr-1" style={{ color: userColors.chart4 }} />
              <span className="font-semibold" style={{ color: userColors.chart4 }}>{globalStats.today}</span>
              <span className="ml-1 text-muted-foreground">para hoy</span>
            </Badge>

            <Badge variant="outline" className="px-3 py-1">
              <Zap className="h-3 w-3 mr-1" style={{ color: userColors.chart3 }} />
              <span className="font-semibold" style={{ color: userColors.chart3 }}>{globalStats.urgent}</span>
              <span className="ml-1 text-muted-foreground">urgentes</span>
            </Badge>

            <Badge variant="outline" className="px-3 py-1">
              <CheckCircle2 className="h-3 w-3 mr-1" style={{ color: userColors.kpiPositive }} />
              <span className="font-semibold" style={{ color: userColors.kpiPositive }}>{globalStats.completedToday}</span>
              <span className="ml-1 text-muted-foreground">completadas hoy</span>
            </Badge>

            <Separator orientation="vertical" className="h-6" />

            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="outline" size="sm" onClick={() => setShowDiscordHelp(true)}>
                  <MessageCircle className="h-4 w-4 mr-2" />
                  Discord
                </Button>
              </TooltipTrigger>
              <TooltipContent>¿Cómo usar desde Discord?</TooltipContent>
            </Tooltip>

            <Button onClick={() => handleCreateTask()}>
              <Plus className="h-4 w-4 mr-2" />
              Nueva Tarea
            </Button>
          </div>
        </div>

        {/* Main Layout: Sidebar de Personas + Content */}
        <div className="flex flex-1 gap-4 min-h-0">
          {/* Sidebar de Personas */}
          <Card className="w-72 flex-shrink-0 flex flex-col">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <Users className="h-4 w-4" style={{ color: userColors.chart1 }} />
                  Personas ({globalStats.people})
                </span>
                <div className="flex items-center gap-1">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0"
                        onClick={() => setShowPersonDialog(true)}
                      >
                        <UserPlus className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Gestionar personas</TooltipContent>
                  </Tooltip>
                  <Button
                    variant="ghost"
                    size="sm"
                    className={cn("h-7 px-2", !selectedPerson && "bg-muted")}
                    onClick={() => setSelectedPerson(null)}
                  >
                    Todas
                  </Button>
                </div>
              </CardTitle>
            </CardHeader>
            <ScrollArea className="flex-1 px-4 pb-4">
              <div className="space-y-2">
                {personStats.map((person) => {
                  const isSelected = selectedPerson === person.name;
                  const hasOverdue = person.overdueTasks > 0;
                  const isFixed = fixedPeople.includes(person.name);

                  return (
                    <div
                      key={person.name}
                      className={cn(
                        "p-3 rounded-lg cursor-pointer transition-all border",
                        isSelected
                          ? "bg-primary/10 border-primary/50"
                          : "hover:bg-muted/50 border-transparent",
                        hasOverdue && !isSelected && "border-l-2 border-l-red-500",
                        isFixed && !isSelected && "border-l-2 border-l-indigo-500"
                      )}
                      onClick={() => setSelectedPerson(isSelected ? null : person.name)}
                    >
                      <div className="flex items-center gap-3">
                        <Avatar className="h-9 w-9">
                          <AvatarFallback
                            style={{
                              backgroundColor: person.name === 'Sin asignar'
                                ? userColors.kpiNeutral
                                : getAvatarColor(person.name)
                            }}
                            className="text-white text-xs font-medium"
                          >
                            {person.name === 'Sin asignar' ? '?' : getInitials(person.name)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{person.name}</p>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <span>{person.pendingTasks} pendiente{person.pendingTasks !== 1 ? 's' : ''}</span>
                            {person.overdueTasks > 0 && (
                              <span className="text-red-500 font-medium">
                                • {person.overdueTasks} vencida{person.overdueTasks !== 1 ? 's' : ''}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-1">
                          <Badge
                            variant="secondary"
                            className="text-xs h-5"
                            style={person.inProgressTasks > 0 ? {
                              backgroundColor: `${userColors.chart1}15`,
                              color: userColors.chart1
                            } : {}}
                          >
                            {person.totalTasks}
                          </Badge>
                        </div>
                      </div>

                      {/* Mini progress bar de completadas */}
                      {person.totalTasks > 0 && (
                        <div className="mt-2">
                          <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full transition-all"
                              style={{
                                backgroundColor: userColors.kpiPositive,
                                width: `${((person.totalTasks - person.pendingTasks - person.inProgressTasks) / person.totalTasks) * 100}%`
                              }}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}

                {personStats.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground text-sm">
                    No hay personas con tareas
                  </div>
                )}
              </div>
            </ScrollArea>
          </Card>

          {/* Content Area */}
          <div className="flex-1 flex flex-col min-w-0 gap-4">
            {/* Toolbar */}
            <div className="flex items-center gap-3 flex-wrap">
              {/* Search */}
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
                    onClick={() => setSearchTerm('')}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>

              {/* Status Filter */}
              <Select
                value={statusFilter}
                onValueChange={(v) => setStatusFilter(v as AgendaTaskStatus | 'all')}
              >
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="Estado" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="PENDING">Pendientes</SelectItem>
                  <SelectItem value="IN_PROGRESS">En progreso</SelectItem>
                  <SelectItem value="WAITING">Esperando</SelectItem>
                  <SelectItem value="COMPLETED">Completadas</SelectItem>
                </SelectContent>
              </Select>

              {/* Priority Filter */}
              <Select
                value={priorityFilter}
                onValueChange={(v) => setPriorityFilter(v as Priority | 'all')}
              >
                <SelectTrigger className="w-[120px]">
                  <SelectValue placeholder="Prioridad" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  <SelectItem value="URGENT">Urgente</SelectItem>
                  <SelectItem value="HIGH">Alta</SelectItem>
                  <SelectItem value="MEDIUM">Media</SelectItem>
                  <SelectItem value="LOW">Baja</SelectItem>
                </SelectContent>
              </Select>

              {/* Refresh */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="outline" size="icon" onClick={() => refetch()} disabled={isLoading}>
                    <RefreshCw className={cn("h-4 w-4", isLoading && "animate-spin")} />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Actualizar</TooltipContent>
              </Tooltip>

              {/* View Toggle */}
              <div className="flex border rounded-lg p-1 gap-1 ml-auto">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant={viewMode === 'tasks' ? 'secondary' : 'ghost'}
                      size="sm"
                      className="h-8 w-8 p-0"
                      onClick={() => setViewMode('tasks')}
                    >
                      <LayoutList className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Vista tareas</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant={viewMode === 'calendar' ? 'secondary' : 'ghost'}
                      size="sm"
                      className="h-8 w-8 p-0"
                      onClick={() => setViewMode('calendar')}
                    >
                      <Calendar className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Calendario</TooltipContent>
                </Tooltip>
              </div>
            </div>

            {/* Quick Task Input */}
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Plus className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder={selectedPerson ? `Agregar tarea rápida para ${selectedPerson}...` : "Agregar tarea rápida..."}
                  value={quickTaskInput}
                  onChange={(e) => setQuickTaskInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleQuickTask()}
                  className="pl-10"
                />
              </div>
              <Button
                onClick={handleQuickTask}
                disabled={!quickTaskInput.trim() || isCreating}
                variant="secondary"
              >
                Agregar
              </Button>
            </div>

            {/* Selected Person Header */}
            {selectedPerson && (
              <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                <Avatar className="h-10 w-10">
                  <AvatarFallback
                    style={{
                      backgroundColor: selectedPerson === 'Sin asignar'
                        ? userColors.kpiNeutral
                        : getAvatarColor(selectedPerson)
                    }}
                    className="text-white font-medium"
                  >
                    {selectedPerson === 'Sin asignar' ? '?' : getInitials(selectedPerson)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <h2 className="font-semibold">{selectedPerson}</h2>
                  <p className="text-sm text-muted-foreground">
                    {filteredTasks.length} tarea{filteredTasks.length !== 1 ? 's' : ''}
                  </p>
                </div>
                <Button variant="ghost" size="sm" onClick={() => setSelectedPerson(null)}>
                  <X className="h-4 w-4 mr-1" />
                  Limpiar
                </Button>
              </div>
            )}

            {/* Main Content */}
            <div className="flex flex-1 gap-4 min-h-0">
              <div className="flex-1 overflow-hidden">
                {viewMode === 'tasks' ? (
                  <ScrollArea className="h-full pr-4">
                    {/* Tablero por Estados */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                      {/* Pendientes */}
                      <div className="space-y-3">
                        <div className="flex items-center justify-between sticky top-0 bg-background py-2">
                          <h3 className="font-medium text-sm flex items-center gap-2">
                            <div className="h-2 w-2 rounded-full bg-amber-500" />
                            Pendientes ({tasksByStatus.pending.length})
                          </h3>
                        </div>
                        <div className="space-y-2">
                          {tasksByStatus.pending.map((task) => (
                            <TaskCard
                              key={task.id}
                              task={task}
                              userColors={userColors}
                              onSelect={handleTaskSelect}
                              onStatusChange={handleStatusChange}
                              getAvatarColor={getAvatarColor}
                              getInitials={getInitials}
                            />
                          ))}
                          {tasksByStatus.pending.length === 0 && (
                            <div className="text-center py-8 text-muted-foreground text-sm border-2 border-dashed rounded-lg">
                              Sin tareas pendientes
                            </div>
                          )}
                        </div>
                      </div>

                      {/* En Progreso */}
                      <div className="space-y-3">
                        <div className="flex items-center justify-between sticky top-0 bg-background py-2">
                          <h3 className="font-medium text-sm flex items-center gap-2">
                            <div className="h-2 w-2 rounded-full bg-blue-500" />
                            En Progreso ({tasksByStatus.inProgress.length})
                          </h3>
                        </div>
                        <div className="space-y-2">
                          {tasksByStatus.inProgress.map((task) => (
                            <TaskCard
                              key={task.id}
                              task={task}
                              userColors={userColors}
                              onSelect={handleTaskSelect}
                              onStatusChange={handleStatusChange}
                              getAvatarColor={getAvatarColor}
                              getInitials={getInitials}
                            />
                          ))}
                          {tasksByStatus.inProgress.length === 0 && (
                            <div className="text-center py-8 text-muted-foreground text-sm border-2 border-dashed rounded-lg">
                              Sin tareas en progreso
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Completadas */}
                      <div className="space-y-3">
                        <div className="flex items-center justify-between sticky top-0 bg-background py-2">
                          <h3 className="font-medium text-sm flex items-center gap-2">
                            <div className="h-2 w-2 rounded-full bg-green-500" />
                            Completadas ({tasksByStatus.completed.length})
                          </h3>
                        </div>
                        <div className="space-y-2">
                          {tasksByStatus.completed.slice(0, 10).map((task) => (
                            <TaskCard
                              key={task.id}
                              task={task}
                              userColors={userColors}
                              onSelect={handleTaskSelect}
                              onStatusChange={handleStatusChange}
                              getAvatarColor={getAvatarColor}
                              getInitials={getInitials}
                              compact
                            />
                          ))}
                          {tasksByStatus.completed.length > 10 && (
                            <Button variant="ghost" size="sm" className="w-full">
                              Ver {tasksByStatus.completed.length - 10} más
                            </Button>
                          )}
                          {tasksByStatus.completed.length === 0 && (
                            <div className="text-center py-8 text-muted-foreground text-sm border-2 border-dashed rounded-lg">
                              Sin completadas
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </ScrollArea>
                ) : (
                  <AgendaCalendarView tasks={filteredTasks} onSelect={handleTaskSelect} />
                )}
              </div>

              {/* Detail Panel */}
              {showDetailPanel && selectedTask && (
                <AgendaDetailPanel
                  task={selectedTask}
                  onClose={() => {
                    setShowDetailPanel(false);
                    setSelectedTask(null);
                  }}
                  onEdit={() => handleEditTask(selectedTask)}
                  onDelete={() => handleDeleteTask(selectedTask.id)}
                  onStatusChange={(status) => handleStatusChange(selectedTask.id, status)}
                />
              )}
            </div>
          </div>
        </div>

        {/* Task Dialog */}
        <TaskDialog
          open={showTaskDialog}
          onOpenChange={setShowTaskDialog}
          task={editingTask}
          onSave={handleTaskSave}
          isSaving={isCreating || isUpdating}
        />

        {/* Dialog para gestionar personas fijas */}
        <Dialog open={showPersonDialog} onOpenChange={setShowPersonDialog}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" style={{ color: userColors.chart1 }} />
                Gestionar Personas
              </DialogTitle>
              <DialogDescription>
                Agrega personas fijas que siempre aparecerán en tu lista, incluso sin tareas asignadas.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              {/* Agregar nueva persona */}
              <div className="flex gap-2">
                <Input
                  placeholder="Nombre de la persona..."
                  value={newPersonName}
                  onChange={(e) => setNewPersonName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddPerson()}
                />
                <Button onClick={handleAddPerson} disabled={!newPersonName.trim()}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>

              {/* Lista de personas fijas */}
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {fixedPeople.length === 0 ? (
                  <div className="text-center py-6 text-muted-foreground text-sm">
                    No hay personas fijas todavía.
                    <br />
                    Agrega personas para que siempre aparezcan en tu lista.
                  </div>
                ) : (
                  fixedPeople.map((person) => (
                    <div
                      key={person}
                      className="flex items-center justify-between p-3 rounded-lg bg-muted/50 border"
                    >
                      {editingPerson === person ? (
                        // Modo edición
                        <>
                          <div className="flex items-center gap-3 flex-1">
                            <Avatar className="h-8 w-8">
                              <AvatarFallback
                                style={{ backgroundColor: getAvatarColor(editingPersonName || person) }}
                                className="text-white text-xs"
                              >
                                {getInitials(editingPersonName || person)}
                              </AvatarFallback>
                            </Avatar>
                            <Input
                              value={editingPersonName}
                              onChange={(e) => setEditingPersonName(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') handleSaveEditPerson();
                                if (e.key === 'Escape') handleCancelEditPerson();
                              }}
                              className="h-8 flex-1"
                              autoFocus
                            />
                          </div>
                          <div className="flex gap-1 ml-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0 text-green-600 hover:text-green-700 hover:bg-green-50"
                              onClick={handleSaveEditPerson}
                            >
                              <Check className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
                              onClick={handleCancelEditPerson}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        </>
                      ) : (
                        // Modo normal
                        <>
                          <div className="flex items-center gap-3">
                            <Avatar className="h-8 w-8">
                              <AvatarFallback
                                style={{ backgroundColor: getAvatarColor(person) }}
                                className="text-white text-xs"
                              >
                                {getInitials(person)}
                              </AvatarFallback>
                            </Avatar>
                            <span className="font-medium">{person}</span>
                          </div>
                          <div className="flex gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
                              onClick={() => handleStartEditPerson(person)}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0 text-red-500 hover:text-red-600 hover:bg-red-50"
                              onClick={() => handleRemovePerson(person)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setShowPersonDialog(false)}>
                Cerrar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Dialog de ayuda de Discord */}
        <Dialog open={showDiscordHelp} onOpenChange={setShowDiscordHelp}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <MessageCircle className="h-5 w-5" style={{ color: userColors.chart2 }} />
                Crear Tareas desde Discord
              </DialogTitle>
              <DialogDescription>
                Puedes crear tareas directamente desde Discord enviando un mensaje privado al bot.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-6">
              {/* Por Texto */}
              <div className="space-y-2">
                <h4 className="font-semibold flex items-center gap-2">
                  <MessageCircle className="h-4 w-4" style={{ color: userColors.chart1 }} />
                  Crear por Texto
                </h4>
                <div className="bg-muted/50 rounded-lg p-4 space-y-2 text-sm">
                  <p className="text-muted-foreground">Envía un DM al bot con:</p>
                  <code className="block bg-background px-3 py-2 rounded border font-mono">
                    Tarea: Revisar presupuesto para Juan antes del viernes
                  </code>
                  <p className="text-muted-foreground">
                    El bot detectará automáticamente la descripción, fecha límite, y persona asignada.
                  </p>
                </div>
              </div>

              {/* Por Audio */}
              <div className="space-y-2">
                <h4 className="font-semibold flex items-center gap-2">
                  <Mic className="h-4 w-4" style={{ color: userColors.chart3 }} />
                  Crear por Audio
                </h4>
                <div className="bg-muted/50 rounded-lg p-4 space-y-2 text-sm">
                  <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
                    <li>Envía un DM con solo la palabra <code className="bg-background px-1.5 py-0.5 rounded">Tarea</code></li>
                    <li>El bot te pedirá que envíes un audio</li>
                    <li>Graba un mensaje de voz describiendo la tarea</li>
                    <li>El bot transcribe y crea la tarea automáticamente</li>
                  </ol>
                </div>
              </div>

              {/* Recordatorios */}
              <div className="space-y-2">
                <h4 className="font-semibold flex items-center gap-2">
                  <Clock className="h-4 w-4" style={{ color: userColors.chart4 }} />
                  Recordatorios
                </h4>
                <div className="bg-muted/50 rounded-lg p-4 text-sm text-muted-foreground">
                  <p>
                    Los recordatorios configurados en las tareas te llegarán automáticamente por DM de Discord a la hora programada.
                  </p>
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button onClick={() => setShowDiscordHelp(false)}>
                Entendido
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </TooltipProvider>
  );
}

// Task Card Component
interface TaskCardProps {
  task: AgendaTask;
  userColors: typeof DEFAULT_COLORS;
  onSelect: (task: AgendaTask) => void;
  onStatusChange: (taskId: number, status: AgendaTaskStatus) => void;
  getAvatarColor: (name: string) => string;
  getInitials: (name: string) => string;
  compact?: boolean;
}

function TaskCard({ task, userColors, onSelect, onStatusChange, getAvatarColor, getInitials, compact }: TaskCardProps) {
  const overdue = isTaskOverdue(task);
  const priorityConfig = PRIORITY_CONFIG[task.priority];
  const assignee = getAssigneeName(task);
  const isCompleted = task.status === 'COMPLETED';

  return (
    <Card
      className={cn(
        "cursor-pointer transition-all hover:shadow-md group",
        overdue && !isCompleted && "border-l-2 border-l-red-500",
        isCompleted && "opacity-60"
      )}
      onClick={() => onSelect(task)}
    >
      <CardContent className={cn("p-3", compact && "p-2")}>
        <div className="flex items-start gap-3">
          {/* Avatar pequeño */}
          <Avatar className="h-7 w-7 flex-shrink-0">
            <AvatarFallback
              style={{ backgroundColor: getAvatarColor(assignee) }}
              className="text-white text-xs"
            >
              {getInitials(assignee)}
            </AvatarFallback>
          </Avatar>

          <div className="flex-1 min-w-0">
            {/* Title */}
            <p className={cn(
              "font-medium text-sm truncate",
              isCompleted && "line-through"
            )}>
              {task.title}
            </p>

            {/* Meta info */}
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              {/* Priority */}
              <Badge
                variant="outline"
                className="text-xs h-5 px-1.5"
                style={{
                  color: priorityConfig.color.replace('text-', ''),
                  borderColor: priorityConfig.borderColor?.replace('border-', '')
                }}
              >
                {priorityConfig.label}
              </Badge>

              {/* Due date */}
              {task.dueDate && (
                <span className={cn(
                  "text-xs flex items-center gap-1",
                  overdue && !isCompleted ? "text-red-500 font-medium" : "text-muted-foreground"
                )}>
                  <Clock className="h-3 w-3" />
                  {isToday(new Date(task.dueDate))
                    ? `Hoy, ${format(new Date(task.dueDate), 'HH:mm')}`
                    : format(new Date(task.dueDate), "d MMM, HH:mm", { locale: es })}
                </span>
              )}

              {/* Overdue indicator */}
              {overdue && !isCompleted && (
                <AlertTriangle className="h-3 w-3 text-red-500" />
              )}
            </div>
          </div>

          {/* Quick Actions */}
          {!compact && !isCompleted && (
            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0"
                    onClick={(e) => {
                      e.stopPropagation();
                      onStatusChange(task.id, 'IN_PROGRESS');
                    }}
                  >
                    <PlayCircle className="h-4 w-4 text-blue-500" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>En progreso</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0"
                    onClick={(e) => {
                      e.stopPropagation();
                      onStatusChange(task.id, 'COMPLETED');
                    }}
                  >
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Completar</TooltipContent>
              </Tooltip>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
