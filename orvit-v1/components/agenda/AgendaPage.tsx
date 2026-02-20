'use client';

import { useUserColors } from '@/hooks/use-user-colors';
import { AVATAR_COLORS } from '@/lib/colors';
import { useConfirm } from '@/components/ui/confirm-dialog-provider';
import { useState, useMemo, useEffect } from 'react';
import { useUnifiedTasks, type OriginFilter } from '@/hooks/use-unified-tasks';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
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
  DialogBody,
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
  ChevronRight,
  Zap,
  UserPlus,
  Trash2,
  MessageCircle,
  Mic,
  Pencil,
  Check,
  ListTodo,
} from 'lucide-react';
import { toast } from 'sonner';
import { isToday } from 'date-fns';
import { cn } from '@/lib/utils';

import { AgendaCalendarView } from './AgendaCalendarView';
import { AgendaKanbanView } from './AgendaKanbanView';
import { AgendaKPICards } from './AgendaKPICards';
import { AgendaListView } from './AgendaListView';
import { UnifiedTaskDetailPanel } from './UnifiedTaskDetailPanel';
import { TaskDialog } from './TaskDialog';
import TaskGroupsSidebar, { type TaskGroup } from '@/components/tasks/TaskGroupsSidebar';
import { useCompany } from '@/contexts/CompanyContext';
import { useQuery } from '@tanstack/react-query';
import type { AgendaTask, AgendaTaskStatus, AgendaStats } from '@/lib/agenda/types';
import { getAssigneeName, isTaskOverdue } from '@/lib/agenda/types';
import type { UnifiedTask, UnifiedTaskStatus, UnifiedTaskPriority } from '@/types/unified-task';
import {
  UNIFIED_TO_AGENDA_STATUS,
  UNIFIED_TO_REGULAR_STATUS,
  UNIFIED_STATUS_CONFIG,
  isUnifiedTaskOverdue,
} from '@/types/unified-task';





type ViewMode = 'kanban' | 'list' | 'calendar';

interface PersonStats {
  name: string;
  totalTasks: number;
  pendingTasks: number;
  overdueTasks: number;
  completedToday: number;
  inProgressTasks: number;
}

export function AgendaPage() {
  const userColors = useUserColors();
  const confirm = useConfirm();
  const { currentCompany } = useCompany();

  // Vista y filtros
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    if (typeof window !== 'undefined') {
      return (localStorage.getItem('agenda_view_mode') as ViewMode) || 'kanban';
    }
    return 'kanban';
  });
  const [originFilter, setOriginFilter] = useState<OriginFilter>(() => {
    if (typeof window !== 'undefined') {
      return (localStorage.getItem('agenda_origin_filter') as OriginFilter) || 'all';
    }
    return 'all';
  });
  const [selectedPerson, setSelectedPerson] = useState<string | null>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('agenda_selected_person') || null;
    }
    return null;
  });
  const [showTaskDialog, setShowTaskDialog] = useState(false);
  const [editingTask, setEditingTask] = useState<AgendaTask | null>(null);
  const [detailTask, setDetailTask] = useState<UnifiedTask | null>(null);
  const [quickTaskInput, setQuickTaskInput] = useState('');

  // Filtros
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<UnifiedTaskStatus | 'all'>('all');
  const [priorityFilter, setPriorityFilter] = useState<UnifiedTaskPriority | 'all'>('all');
  const [showOnlyOverdue, setShowOnlyOverdue] = useState(false);
  const [showOnlyToday, setShowOnlyToday] = useState(false);

  // Personas fijas
  const [showPersonDialog, setShowPersonDialog] = useState(false);
  const [fixedPeople, setFixedPeople] = useState<string[]>(() => {
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

  // Stats de agenda (KPI cards)
  const [agendaStats, setAgendaStats] = useState<AgendaStats | null>(null);

  // Grupos de agenda
  const [selectedGroupId, setSelectedGroupId] = useState<number | null>(null);
  const { data: agendaGroupsData, refetch: refetchAgendaGroups } = useQuery({
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
    staleTime: 30 * 1000,
  });
  const agendaGroups = agendaGroupsData || [];

  // Persistir viewMode, originFilter y selectedPerson
  useEffect(() => {
    localStorage.setItem('agenda_view_mode', viewMode);
  }, [viewMode]);
  useEffect(() => {
    localStorage.setItem('agenda_origin_filter', originFilter);
  }, [originFilter]);
  useEffect(() => {
    if (selectedPerson) {
      localStorage.setItem('agenda_selected_person', selectedPerson);
    } else {
      localStorage.removeItem('agenda_selected_person');
    }
  }, [selectedPerson]);

  // Fetch stats de agenda para KPI cards
  useEffect(() => {
    if (!currentCompany?.id) return;
    fetch(`/api/agenda/stats?companyId=${currentCompany.id}`, {
      credentials: 'include',
      headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` },
    })
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data) setAgendaStats(data); })
      .catch(() => {});
  }, [currentCompany?.id]);

  // Hook unificado
  const {
    tasks,
    isLoading,
    stats,
    refetch,
    agenda,
    taskStore,
  } = useUnifiedTasks({
    originFilter,
    statusFilter,
    priorityFilter,
    searchTerm,
    showOnlyOverdue,
    showOnlyToday,
    selectedPerson,
  });

  // Filtrar tareas por grupo seleccionado
  const groupFilteredTasks = useMemo(() => {
    if (selectedGroupId === null) return tasks;
    return tasks.filter(task => {
      const agendaGroupId = (task.originalAgendaTask as any)?.groupId;
      const regularGroupId = (task.originalRegularTask as any)?.groupId;
      return agendaGroupId === selectedGroupId || regularGroupId === selectedGroupId;
    });
  }, [tasks, selectedGroupId]);

  // Agrupar por persona para sidebar
  const personStats = useMemo(() => {
    const grouped = new Map<string, PersonStats>();

    fixedPeople.forEach(person => {
      grouped.set(person, {
        name: person,
        totalTasks: 0,
        pendingTasks: 0,
        overdueTasks: 0,
        completedToday: 0,
        inProgressTasks: 0,
      });
    });

    grouped.set('Sin asignar', {
      name: 'Sin asignar',
      totalTasks: 0,
      pendingTasks: 0,
      overdueTasks: 0,
      completedToday: 0,
      inProgressTasks: 0,
    });

    groupFilteredTasks.forEach((task) => {
      const assignee = task.assigneeName;

      if (!grouped.has(assignee)) {
        grouped.set(assignee, {
          name: assignee,
          totalTasks: 0,
          pendingTasks: 0,
          overdueTasks: 0,
          completedToday: 0,
          inProgressTasks: 0,
        });
      }

      const personData = grouped.get(assignee)!;
      personData.totalTasks++;

      if (task.status === 'pending') personData.pendingTasks++;
      if (task.status === 'in_progress') personData.inProgressTasks++;
      if (isUnifiedTaskOverdue(task)) personData.overdueTasks++;
    });

    return Array.from(grouped.values())
      .filter(p => p.totalTasks > 0 || p.name === 'Sin asignar' || fixedPeople.includes(p.name))
      .sort((a, b) => {
        if (a.name === 'Sin asignar') return 1;
        if (b.name === 'Sin asignar') return -1;
        const aFixed = fixedPeople.includes(a.name);
        const bFixed = fixedPeople.includes(b.name);
        if (aFixed && !bFixed) return -1;
        if (!aFixed && bFixed) return 1;
        if (a.overdueTasks !== b.overdueTasks) return b.overdueTasks - a.overdueTasks;
        return b.pendingTasks - a.pendingTasks;
      });
  }, [groupFilteredTasks, fixedPeople]);

  // Optimistic updates: map de taskId → status provisional
  const [optimisticStatuses, setOptimisticStatuses] = useState<Map<string, UnifiedTaskStatus>>(new Map());

  // Tasks con statuses optimistas aplicados
  const displayTasks = useMemo(() => {
    if (optimisticStatuses.size === 0) return groupFilteredTasks;
    return groupFilteredTasks.map(task => {
      const optimistic = optimisticStatuses.get(String(task.id));
      return optimistic ? { ...task, status: optimistic } : task;
    });
  }, [groupFilteredTasks, optimisticStatuses]);

  // Handlers
  const handleUnifiedStatusChange = async (task: UnifiedTask, newStatus: string) => {
    // Normalizar status
    const NORMALIZE_STATUS: Record<string, UnifiedTaskStatus> = {
      'COMPLETED': 'completed', 'PENDING': 'pending', 'IN_PROGRESS': 'in_progress',
      'CANCELLED': 'cancelled', 'WAITING': 'waiting',
    };
    const normalizedStatus = (NORMALIZE_STATUS[newStatus] || newStatus) as UnifiedTaskStatus;
    const taskKey = String(task.id);

    // Aplicar optimistic update inmediatamente
    setOptimisticStatuses(prev => new Map(prev).set(taskKey, normalizedStatus));

    try {
      if (task.origin === 'agenda' && task.originalAgendaTask) {
        const agendaStatus = UNIFIED_TO_AGENDA_STATUS[normalizedStatus];
        await agenda.updateTask(task.originalAgendaTask.id, { status: agendaStatus });
      } else if (task.origin === 'regular' && task.originalRegularTask) {
        const regularStatus = UNIFIED_TO_REGULAR_STATUS[normalizedStatus];
        await taskStore.updateTaskAPI(task.originalRegularTask.id, { status: regularStatus });
      }
      toast.success('Estado actualizado');
    } catch {
      // Revertir si falla
      setOptimisticStatuses(prev => { const m = new Map(prev); m.delete(taskKey); return m; });
      toast.error('Error al actualizar estado');
    } finally {
      // Limpiar después de que el hook se re-sincronice
      setTimeout(() => {
        setOptimisticStatuses(prev => { const m = new Map(prev); m.delete(taskKey); return m; });
      }, 2000);
    }
  };

  const handleUnifiedEdit = (task: UnifiedTask) => {
    if (task.origin === 'agenda' && task.originalAgendaTask) {
      setEditingTask(task.originalAgendaTask);
      setShowTaskDialog(true);
    } else if (task.origin === 'regular' && task.originalRegularTask) {
      // Para tareas regulares, por ahora abrir como agenda task (campo limitado)
      toast.info('Editar tareas regulares próximamente disponible desde aquí');
    }
  };

  const handleUnifiedDelete = async (task: UnifiedTask) => {
    const ok = await confirm({
      title: 'Eliminar tarea',
      description: '¿Eliminar esta tarea? Esta acción no se puede deshacer.',
      confirmText: 'Eliminar',
      variant: 'destructive',
    });
    if (!ok) return;
    try {
      if (task.origin === 'agenda' && task.originalAgendaTask) {
        await agenda.deleteTask(task.originalAgendaTask.id);
      } else if (task.origin === 'regular' && task.originalRegularTask) {
        await taskStore.deleteTask(task.originalRegularTask.id);
      }
      toast.success('Tarea eliminada');
    } catch {
      toast.error('Error al eliminar');
    }
  };

  const handleCreateTask = () => {
    setEditingTask(null);
    setShowTaskDialog(true);
  };

  const handleTaskSave = async (data: any) => {
    try {
      if (editingTask) {
        await agenda.updateTask(editingTask.id, data);
        toast.success('Tarea actualizada');
      } else {
        await agenda.createTask(data);
        toast.success('Tarea creada');
      }
      setShowTaskDialog(false);
      setEditingTask(null);
    } catch {
      toast.error(editingTask ? 'Error al actualizar' : 'Error al crear');
    }
  };

  const handleSaveRegular = async (data: { title: string; description?: string; priority?: string; dueDate?: string; assignedToId?: string | number }) => {
    try {
      await taskStore.createTask(data);
      toast.success('Tarea regular creada');
      setShowTaskDialog(false);
    } catch {
      toast.error('Error al crear tarea regular');
    }
  };

  const handleQuickTask = async () => {
    if (!quickTaskInput.trim()) return;
    try {
      await agenda.createTask({
        title: quickTaskInput.trim(),
        priority: 'MEDIUM',
        assignedToName: selectedPerson && selectedPerson !== 'Sin asignar' ? selectedPerson : undefined,
      });
      toast.success('Tarea creada');
      setQuickTaskInput('');
    } catch {
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
    return name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2);
  };

  // Handlers para personas fijas
  const handleAddPerson = () => {
    if (!newPersonName.trim()) return;
    const name = newPersonName.trim();
    if (fixedPeople.includes(name)) { toast.error('Esta persona ya existe'); return; }
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
    if (newName === editingPerson) { handleCancelEditPerson(); return; }
    if (fixedPeople.includes(newName)) { toast.error('Ya existe una persona con ese nombre'); return; }
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
          <p className="text-sm text-muted-foreground">Cargando agenda...</p>
        </div>
      </div>
    );
  }

  const peopleCount = personStats.filter(p => p.name !== 'Sin asignar').length;

  return (
    <TooltipProvider>
      <div className="flex flex-col h-[calc(100vh-120px)] gap-4 px-6 py-4">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Calendar className="h-6 w-6" style={{ color: userColors.chart1 }} />
              Agenda
            </h1>
            <p className="text-sm text-muted-foreground">
              Todas tus tareas en un solo lugar
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="outline" size="sm" onClick={() => setShowDiscordHelp(true)}>
                  <MessageCircle className="h-4 w-4 mr-2" />
                  Discord
                </Button>
              </TooltipTrigger>
              <TooltipContent>¿Cómo usar desde Discord?</TooltipContent>
            </Tooltip>
            <Button onClick={handleCreateTask}>
              <Plus className="h-4 w-4 mr-2" />
              Nueva Tarea
            </Button>
          </div>
        </div>

        {/* KPI Cards */}
        <AgendaKPICards
          stats={agendaStats ?? undefined}
          onKpiClick={(filter) => {
            if (filter === 'overdue') { setShowOnlyOverdue(true); setShowOnlyToday(false); }
            else if (filter === 'today') { setShowOnlyToday(true); setShowOnlyOverdue(false); }
            else if (filter === 'pending') { setStatusFilter('pendiente'); setShowOnlyOverdue(false); setShowOnlyToday(false); }
          }}
        />

        {/* Main Layout: Sidebars + Content */}
        <div className="flex flex-1 gap-3 min-h-0">
          {/* Sidebar de Grupos */}
          {currentCompany?.id && (
            <TaskGroupsSidebar
              groups={agendaGroups}
              selectedGroupId={selectedGroupId}
              onGroupSelect={setSelectedGroupId}
              companyId={currentCompany.id}
              onGroupsChange={refetchAgendaGroups}
            />
          )}

          {/* Sidebar de Personas */}
          <Card className="w-72 flex-shrink-0 flex flex-col">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <Users className="h-4 w-4" style={{ color: userColors.chart1 }} />
                  Personas ({peopleCount})
                </span>
                <div className="flex items-center gap-1">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0"
                        aria-label="Gestionar personas"
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
                      role="button"
                      tabIndex={0}
                      aria-label={`Filtrar por ${person.name}: ${person.pendingTasks} pendientes${person.overdueTasks > 0 ? `, ${person.overdueTasks} vencidas` : ''}`}
                      aria-pressed={isSelected}
                      className={cn(
                        "p-3 rounded-lg cursor-pointer transition-all border",
                        isSelected
                          ? "bg-primary/10 border-primary/50"
                          : "hover:bg-muted/50 border-transparent",
                        hasOverdue && !isSelected && "border-l-2 border-l-red-500",
                        isFixed && !isSelected && !hasOverdue && "border-l-2 border-l-indigo-500"
                      )}
                      onClick={() => setSelectedPerson(isSelected ? null : person.name)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          setSelectedPerson(isSelected ? null : person.name);
                        }
                      }}
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
                              <span className="text-destructive font-medium">
                                • {person.overdueTasks} vencida{person.overdueTasks !== 1 ? 's' : ''}
                              </span>
                            )}
                          </div>
                        </div>
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
                  <div role="status" className="text-center py-8 text-muted-foreground text-sm">
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
                    aria-label="Limpiar búsqueda"
                    onClick={() => setSearchTerm('')}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>

              {/* Origin Filter */}
              <Select
                value={originFilter}
                onValueChange={(v) => setOriginFilter(v as OriginFilter)}
              >
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="Origen" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">
                    Todas ({stats.total})
                  </SelectItem>
                  <SelectItem value="agenda">
                    Agenda ({stats.agendaCount})
                  </SelectItem>
                  <SelectItem value="regular">
                    Tareas ({stats.regularCount})
                  </SelectItem>
                </SelectContent>
              </Select>

              {/* Status Filter */}
              <Select
                value={statusFilter}
                onValueChange={(v) => setStatusFilter(v as UnifiedTaskStatus | 'all')}
              >
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="Estado" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="pending">Pendientes</SelectItem>
                  <SelectItem value="in_progress">En progreso</SelectItem>
                  <SelectItem value="waiting">Esperando</SelectItem>
                  <SelectItem value="completed">Completadas</SelectItem>
                </SelectContent>
              </Select>

              {/* Priority Filter */}
              <Select
                value={priorityFilter}
                onValueChange={(v) => setPriorityFilter(v as UnifiedTaskPriority | 'all')}
              >
                <SelectTrigger className="w-[120px]">
                  <SelectValue placeholder="Prioridad" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  <SelectItem value="urgent">Urgente</SelectItem>
                  <SelectItem value="high">Alta</SelectItem>
                  <SelectItem value="medium">Media</SelectItem>
                  <SelectItem value="low">Baja</SelectItem>
                </SelectContent>
              </Select>

              {/* Refresh */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="outline" size="icon" aria-label="Actualizar tareas" onClick={refetch} disabled={isLoading}>
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
                      variant={viewMode === 'kanban' ? 'secondary' : 'ghost'}
                      size="sm"
                      className="h-8 w-8 p-0"
                      aria-label="Vista Kanban"
                      aria-pressed={viewMode === 'kanban'}
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
                      variant={viewMode === 'list' ? 'secondary' : 'ghost'}
                      size="sm"
                      className="h-8 w-8 p-0"
                      aria-label="Vista Lista"
                      aria-pressed={viewMode === 'list'}
                      onClick={() => setViewMode('list')}
                    >
                      <LayoutList className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Vista Lista</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant={viewMode === 'calendar' ? 'secondary' : 'ghost'}
                      size="sm"
                      className="h-8 w-8 p-0"
                      aria-label="Calendario"
                      aria-pressed={viewMode === 'calendar'}
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
                disabled={!quickTaskInput.trim() || agenda.isCreating}
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
                    {displayTasks.length} tarea{displayTasks.length !== 1 ? 's' : ''}
                  </p>
                </div>
                <Button variant="ghost" size="sm" onClick={() => setSelectedPerson(null)}>
                  <X className="h-4 w-4 mr-1" />
                  Limpiar
                </Button>
              </div>
            )}

            {/* Main Content */}
            <div className="flex-1 overflow-hidden">
              {viewMode === 'kanban' && (
                <AgendaKanbanView
                  tasks={displayTasks}
                  onSelect={(task) => {
                    setDetailTask(task);
                  }}
                  onStatusChange={(task, status) => handleUnifiedStatusChange(task as any, status)}
                  onEdit={(task) => handleUnifiedEdit(task as any)}
                  onDelete={(task) => handleUnifiedDelete(task as any)}
                />
              )}

              {viewMode === 'list' && (
                <AgendaListView
                  tasks={displayTasks}
                  onStatusChange={(task, status) => handleUnifiedStatusChange(task as any, status)}
                  onEdit={(task) => handleUnifiedEdit(task as any)}
                  onDelete={(task) => handleUnifiedDelete(task as any)}
                />
              )}

              {viewMode === 'calendar' && (
                <AgendaCalendarView
                  tasks={displayTasks}
                  onSelect={(task) => {
                    // Abrir panel de detalle sin cambiar de vista
                    setDetailTask(task);
                  }}
                />
              )}
            </div>
          </div>
        </div>

        {/* Detail Panel — se abre al hacer click en kanban */}
        {detailTask && (
          <UnifiedTaskDetailPanel
            task={detailTask}
            onClose={() => setDetailTask(null)}
            onEdit={() => { handleUnifiedEdit(detailTask); setDetailTask(null); }}
            onDelete={() => { handleUnifiedDelete(detailTask); setDetailTask(null); }}
            onStatusChange={(status) => handleUnifiedStatusChange(detailTask as any, status)}
          />
        )}

        {/* Task Dialog */}
        <TaskDialog
          open={showTaskDialog}
          onOpenChange={setShowTaskDialog}
          task={editingTask}
          onSave={handleTaskSave}
          onSaveRegular={handleSaveRegular}
          isSaving={agenda.isCreating || agenda.isUpdating}
          defaultGroupId={selectedGroupId}
        />

        {/* Dialog para gestionar personas fijas */}
        <Dialog open={showPersonDialog} onOpenChange={setShowPersonDialog}>
          <DialogContent size="sm">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" style={{ color: userColors.chart1 }} />
                Gestionar Personas
              </DialogTitle>
              <DialogDescription>
                Agrega personas fijas que siempre aparecerán en tu lista, incluso sin tareas asignadas.
              </DialogDescription>
            </DialogHeader>

            <DialogBody className="space-y-4">
              <div className="flex gap-2">
                <Input
                  placeholder="Nombre de la persona..."
                  value={newPersonName}
                  onChange={(e) => setNewPersonName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddPerson()}
                />
                <Button onClick={handleAddPerson} disabled={!newPersonName.trim()} aria-label="Agregar persona">
                  <Plus className="h-4 w-4" />
                </Button>
              </div>

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
                              className="h-8 w-8 p-0 text-success hover:text-success hover:bg-success-muted"
                              aria-label="Guardar nombre editado"
                              onClick={handleSaveEditPerson}
                            >
                              <Check className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
                              aria-label="Cancelar edición"
                              onClick={handleCancelEditPerson}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        </>
                      ) : (
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
                              aria-label={`Editar nombre de ${person}`}
                              onClick={() => handleStartEditPerson(person)}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                              aria-label={`Eliminar a ${person}`}
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
            </DialogBody>

            <DialogFooter>
              <Button variant="outline" onClick={() => setShowPersonDialog(false)}>
                Cerrar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Dialog de ayuda de Discord */}
        <Dialog open={showDiscordHelp} onOpenChange={setShowDiscordHelp}>
          <DialogContent size="default">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <MessageCircle className="h-5 w-5" style={{ color: userColors.chart2 }} />
                Crear Tareas desde Discord
              </DialogTitle>
              <DialogDescription>
                Puedes crear tareas directamente desde Discord enviando un mensaje privado al bot.
              </DialogDescription>
            </DialogHeader>

            <DialogBody className="space-y-6">
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
            </DialogBody>

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
