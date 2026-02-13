"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import {
  LayoutGrid,
  Plus,
  Clock,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  BarChart3,
  TrendingUp,
  TrendingDown,
  Minus,
  Search,
  Trash2
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TasksDashboard } from "@/components/tasks/tasks-dashboard";
import { TaskCard } from "@/components/tasks/task-card";
import { NewTaskModal } from "@/components/tasks/new-task-modal";
import { FixedTasksKanban } from "@/components/tasks/fixed-tasks-kanban";
import { FixedTaskDetailModal } from "@/components/tasks/fixed-task-detail-modal";
import { TaskExecutionModal } from "@/components/tasks/task-execution-modal";
import { CreateFixedTaskModal } from "@/components/tasks/create-fixed-task-modal";
import { useTaskStore } from "@/hooks/use-task-store";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { useFixedTasks } from "@/hooks/use-fixed-tasks";
import { getNextResetInfo } from "@/lib/task-scheduler";
import { usePermissionRobust } from '@/hooks/use-permissions-robust';
import { Badge } from "@/components/ui/badge";
import { TaskHistoryDetailModal } from "@/components/tasks/task-history-detail-modal";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { TasksInbox } from "@/components/tasks/inbox/TasksInbox";
import { EditTaskModal } from "@/components/tasks/edit-task-modal";

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

interface TareasContentProps {
  activeTab: ActiveTab;
}

// ─── Helper Components ─────────────────────────────

function CircularProgress({ percentage, size = 120, strokeWidth = 8, color = "#3b82f6" }: {
  percentage: number; size?: number; strokeWidth?: number; color?: string;
}) {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (percentage / 100) * circumference;
  return (
    <div className="relative">
      <svg width={size} height={size} className="transform -rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} stroke="currentColor" strokeWidth={strokeWidth} fill="none" className="text-gray-200 dark:text-gray-700" />
        <circle cx={size / 2} cy={size / 2} r={radius} stroke={color} strokeWidth={strokeWidth} fill="none" strokeDasharray={circumference} strokeDashoffset={offset} strokeLinecap="round" className="transition-all duration-1000 ease-out" />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-2xl font-bold" style={{ color }}>{percentage}%</span>
      </div>
    </div>
  );
}

function MetricCard({ title, value, trendValue, icon: Icon }: {
  title: string; value: string | number; trend?: 'up' | 'down' | 'stable'; trendValue?: string; icon: any;
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-medium text-muted-foreground">{title}</p>
            <p className="text-2xl font-bold mt-1">{value}</p>
            {trendValue && <p className="text-[10px] text-muted-foreground mt-1">{trendValue}</p>}
          </div>
          <div className="p-2 rounded-lg bg-muted"><Icon className="h-4 w-4 text-muted-foreground" /></div>
        </div>
      </CardContent>
    </Card>
  );
}

function SimpleLineChart({ data, title, color = "#3b82f6" }: { data: any[]; title: string; color?: string }) {
  const validData = data.filter(d => typeof d.value === 'number' && !isNaN(d.value));
  const maxValue = validData.length > 0 ? Math.max(...validData.map(d => d.value)) : 1;
  if (validData.length === 0) {
    return (
      <div className="space-y-4">
        <h4 className="text-lg font-semibold">{title}</h4>
        <div className="relative">
          <svg width="300" height="100" className="w-full h-24">
            <text x="150" y="50" textAnchor="middle" className="text-sm fill-muted-foreground">Sin datos disponibles</text>
          </svg>
        </div>
      </div>
    );
  }
  const points = validData.map((item, index) => {
    const x = validData.length > 1 ? (index / (validData.length - 1)) * 300 : 150;
    const y = maxValue > 0 ? 100 - (item.value / maxValue) * 80 : 50;
    return `${Math.max(0, Math.min(300, isNaN(x) ? 150 : x))},${Math.max(0, Math.min(100, isNaN(y) ? 50 : y))}`;
  }).join(' ');
  return (
    <div className="space-y-4">
      <h4 className="text-lg font-semibold">{title}</h4>
      <div className="relative">
        <svg width="300" height="100" className="w-full h-24">
          <defs>
            <linearGradient id={`gradient-${title}`} x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor={color} stopOpacity="0.3" />
              <stop offset="100%" stopColor={color} stopOpacity="0.1" />
            </linearGradient>
          </defs>
          <polyline points={points} fill="none" stroke={color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="animate-pulse" />
          <polygon points={`0,100 ${points} 300,100`} fill={`url(#gradient-${title})`} />
        </svg>
        <div className="flex justify-between mt-2 text-xs text-muted-foreground">
          {validData.map((item, index) => (<span key={index}>{item.label}</span>))}
        </div>
      </div>
    </div>
  );
}

function HeatmapCalendar({ tasks }: { tasks: any[] }) {
  const days = ['D', 'L', 'M', 'X', 'J', 'V', 'S'];
  const weeks = 13;
  const heatmapData = useMemo(() => {
    const data: { date: Date; count: number }[] = [];
    const today = new Date();
    for (let w = weeks - 1; w >= 0; w--) {
      for (let d = 0; d < 7; d++) {
        const date = new Date(today);
        date.setDate(today.getDate() - (w * 7 + (today.getDay() - d)));
        const dateStr = date.toDateString();
        const tasksArray = Array.isArray(tasks) ? tasks : [];
        const count = tasksArray.filter(t => {
          const taskDate = new Date(t.createdAt);
          return taskDate.toDateString() === dateStr;
        }).length;
        data.push({ date, count });
      }
    }
    return data;
  }, [tasks]);
  const maxCount = Math.max(...heatmapData.map(d => d.count), 1);
  const getColor = (count: number) => {
    if (count === 0) return 'bg-muted';
    const intensity = Math.ceil((count / maxCount) * 4);
    const colors = ['bg-primary/20', 'bg-primary/40', 'bg-primary/60', 'bg-primary/80'];
    return colors[Math.min(intensity - 1, 3)];
  };
  return (
    <div className="space-y-2">
      <div className="flex gap-1">
        <div className="w-4" />
        {days.map(day => (<div key={day} className="w-3 text-[10px] text-muted-foreground text-center">{day}</div>))}
      </div>
      <div className="flex gap-1">
        {Array.from({ length: weeks }, (_, weekIndex) => (
          <div key={weekIndex} className="flex flex-col gap-1">
            {Array.from({ length: 7 }, (_, dayIndex) => {
              const dataIndex = weekIndex * 7 + dayIndex;
              const item = heatmapData[dataIndex];
              if (!item) return <div key={dayIndex} className="w-3 h-3" />;
              return (
                <div
                  key={dayIndex}
                  className={cn("w-3 h-3 rounded-[2px] transition-colors", getColor(item.count))}
                  title={`${item.date.toLocaleDateString('es-ES')}: ${item.count} tareas`}
                />
              );
            })}
          </div>
        ))}
      </div>
      <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
        <span>Menos</span>
        <div className="w-3 h-3 rounded-[2px] bg-muted" />
        <div className="w-3 h-3 rounded-[2px] bg-primary/20" />
        <div className="w-3 h-3 rounded-[2px] bg-primary/40" />
        <div className="w-3 h-3 rounded-[2px] bg-primary/60" />
        <div className="w-3 h-3 rounded-[2px] bg-primary/80" />
        <span>Más</span>
      </div>
    </div>
  );
}

function UserRanking({ users }: { users: any[] }) {
  if (!users || users.length === 0) {
    return <div className="text-center py-4 text-sm text-muted-foreground">Sin datos de usuarios</div>;
  }
  return (
    <div className="space-y-3">
      {users.slice(0, 5).map((user, index) => (
        <div key={index} className="flex items-center gap-3">
          <span className="text-xs font-bold text-muted-foreground w-5">{index + 1}</span>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{user.name}</p>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span>{user.value} creadas</span>
              <span>•</span>
              <span>{user.completed} completadas</span>
            </div>
          </div>
          <Badge variant="secondary" className="text-xs">{user.percentage}%</Badge>
        </div>
      ))}
    </div>
  );
}

// ─── Tareas Fijas Tab ──────────────────────────────

function TareasFijasTab({
  tasks, onTaskClick, onEditTask, onDeleteTask, onCreateTask, onExecuteTask, onCheckResets, canCreateFixedTask = false
}: {
  tasks: FixedTask[];
  onTaskClick: (task: FixedTask) => void;
  onEditTask: (task: FixedTask) => void;
  onDeleteTask: (taskId: string) => void;
  onCreateTask: (frequency: string) => void;
  onExecuteTask: (task: FixedTask) => void;
  onCheckResets?: () => void;
  canCreateFixedTask?: boolean;
}) {
  const totalTasks = tasks.length;
  const pendingTasks = tasks.filter(t => !t.isCompleted && t.isActive).length;
  const completedTasks = tasks.filter(t => t.isCompleted).length;
  const inactiveTasks = tasks.filter(t => !t.isActive).length;
  const tasksNeedingReset = tasks.filter(t => t.isCompleted && new Date() >= new Date(t.nextExecution)).length;
  const completionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-4 border-b border-border">
        <div>
          <h2 className="text-xl font-semibold text-foreground">Tareas Fijas y Recurrentes</h2>
          <p className="text-sm text-muted-foreground mt-1">Gestiona tareas programadas por frecuencia temporal</p>
        </div>
        {canCreateFixedTask && (
          <Button onClick={() => onCreateTask('')} size="sm">
            <Plus className="h-4 w-4 mr-2" />
            Nueva Tarea Fija
          </Button>
        )}
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <Card><CardContent className="p-4"><div className="flex items-start justify-between"><div><p className="text-xs font-medium text-muted-foreground">Total Tareas</p><p className="text-2xl font-bold mt-1">{totalTasks}</p></div><div className="p-2 rounded-lg bg-muted"><LayoutGrid className="h-4 w-4 text-muted-foreground" /></div></div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="flex items-start justify-between"><div><p className="text-xs font-medium text-muted-foreground">Pendientes</p><p className="text-2xl font-bold mt-1">{pendingTasks}</p></div><div className="p-2 rounded-lg bg-muted"><Clock className="h-4 w-4 text-muted-foreground" /></div></div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="flex items-start justify-between"><div><p className="text-xs font-medium text-muted-foreground">Completadas</p><p className="text-2xl font-bold mt-1">{completedTasks}</p></div><div className="p-2 rounded-lg bg-muted"><CheckCircle2 className="h-4 w-4 text-muted-foreground" /></div></div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="flex items-start justify-between mb-2"><div><p className="text-xs font-medium text-muted-foreground">Progreso</p><p className="text-2xl font-bold mt-1">{completionRate}%</p></div><div className="p-2 rounded-lg bg-muted"><BarChart3 className="h-4 w-4 text-muted-foreground" /></div></div><div className="w-full bg-muted rounded-full h-1.5"><div className="bg-primary h-1.5 rounded-full transition-all duration-500" style={{ width: `${completionRate}%` }} /></div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="flex items-start justify-between"><div><p className="text-xs font-medium text-muted-foreground">{tasksNeedingReset > 0 ? 'Reiniciándose' : 'Inactivas'}</p><p className="text-2xl font-bold mt-1">{tasksNeedingReset > 0 ? tasksNeedingReset : inactiveTasks}</p></div><div className="p-2 rounded-lg bg-muted"><RotateCcw className={`h-4 w-4 text-muted-foreground ${tasksNeedingReset > 0 ? 'animate-spin' : ''}`} /></div></div>{tasksNeedingReset > 0 && (<p className="text-[10px] text-muted-foreground mt-2">Reinicio automático activo</p>)}</CardContent></Card>
      </div>
      <FixedTasksKanban tasks={tasks} onTaskClick={onTaskClick} onEditTask={onEditTask} onDeleteTask={onDeleteTask} onCreateTask={onCreateTask} onExecuteTask={onExecuteTask} />
    </div>
  );
}

// ─── Historial Tab ─────────────────────────────────

function HistorialTab() {
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedTask, setSelectedTask] = useState<any>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [priorityFilter, setPriorityFilter] = useState<string>("all");
  const [dateFilter, setDateFilter] = useState<string>("all");
  const [selectedTasks, setSelectedTasks] = useState<Set<number>>(new Set());
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [taskToDelete, setTaskToDelete] = useState<any>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isBulkDeleteDialogOpen, setIsBulkDeleteDialogOpen] = useState(false);
  const [isAutoDeleteDialogOpen, setIsAutoDeleteDialogOpen] = useState(false);
  const [isClearAllDialogOpen, setIsClearAllDialogOpen] = useState(false);
  const [autoDeleteDays, setAutoDeleteDays] = useState("30");
  const [isSettingAutoDelete, setIsSettingAutoDelete] = useState(false);

  const { toast } = useToast();
  const { user } = useAuth();

  const fetchHistory = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch('/api/tasks/history', {
        credentials: 'include',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      if (!response.ok) throw new Error('Error al cargar el historial');
      const data = await response.json();
      if (data.success && Array.isArray(data.history)) {
        const userHistory = data.history.filter((item: any) =>
          item.task.assignedTo?.id?.toString() === user?.id ||
          item.task.createdBy?.id?.toString() === user?.id
        );
        setHistory(userHistory);
      } else {
        setHistory([]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
      setHistory([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchHistory(); }, [user?.id]);

  const formatDate = (dateString: string | Date) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' });
  };

  const getPriorityText = (priority: string) => {
    switch (priority.toLowerCase()) {
      case 'high': case 'alta': return 'Alta';
      case 'medium': case 'media': return 'Media';
      case 'low': case 'baja': return 'Baja';
      default: return priority;
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority.toLowerCase()) {
      case 'high': case 'alta': return 'text-red-500';
      case 'medium': case 'media': return 'text-yellow-500';
      case 'low': case 'baja': return 'text-green-500';
      default: return 'text-gray-500';
    }
  };

  const handleTaskClick = (task: any) => {
    if (isSelectionMode) {
      handleTaskSelection(task.id);
    } else {
      setSelectedTask(task);
      setIsModalOpen(true);
    }
  };

  const handleTaskSelection = (taskId: number) => {
    const newSelected = new Set(selectedTasks);
    if (newSelected.has(taskId)) newSelected.delete(taskId);
    else newSelected.add(taskId);
    setSelectedTasks(newSelected);
  };

  const handleSelectAll = () => {
    if (selectedTasks.size === history.length) setSelectedTasks(new Set());
    else setSelectedTasks(new Set(history.map(task => task.id)));
  };

  const toggleSelectionMode = () => {
    setIsSelectionMode(!isSelectionMode);
    setSelectedTasks(new Set());
  };

  const handleDeletePermanently = async () => {
    if (!taskToDelete) return;
    try {
      const response = await fetch(`/api/tasks/history`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('token')}` },
        body: JSON.stringify({ historyId: taskToDelete.id })
      });
      if (!response.ok) { const errorData = await response.json(); throw new Error(errorData.error || 'Error al eliminar del historial'); }
      fetchHistory();
      toast({ title: "Eliminación permanente", description: "La tarea ha sido eliminada permanentemente del historial." });
      setIsDeleteDialogOpen(false);
      setTaskToDelete(null);
    } catch (error) {
      toast({ variant: "destructive", title: "Error", description: error instanceof Error ? error.message : "No se pudo eliminar la tarea del historial." });
    }
  };

  const handleBulkDelete = async () => {
    if (selectedTasks.size === 0) return;
    try {
      const deletePromises = Array.from(selectedTasks).map(taskId =>
        fetch(`/api/tasks/history`, {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('token')}` },
          body: JSON.stringify({ historyId: taskId })
        })
      );
      const results = await Promise.allSettled(deletePromises);
      const failed = results.filter(result => result.status === 'rejected').length;
      if (failed > 0) {
        toast({ variant: "destructive", title: "Eliminación parcial", description: `Se eliminaron ${selectedTasks.size - failed} tareas. ${failed} fallaron.` });
      } else {
        toast({ title: "Eliminación masiva completada", description: `Se eliminaron ${selectedTasks.size} tareas del historial.` });
      }
      fetchHistory();
      setSelectedTasks(new Set());
      setIsBulkDeleteDialogOpen(false);
      setIsSelectionMode(false);
    } catch (error) {
      toast({ variant: "destructive", title: "Error", description: "Error al eliminar las tareas seleccionadas." });
    }
  };

  const handleSetAutoDelete = async () => {
    setIsSettingAutoDelete(true);
    try {
      const response = await fetch('/api/tasks/history/auto-delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('token')}` },
        body: JSON.stringify({ days: parseInt(autoDeleteDays) })
      });
      if (!response.ok) throw new Error('Error al configurar auto-eliminación');
      toast({ title: "Auto-eliminación configurada", description: `Las tareas del historial se eliminarán automáticamente después de ${autoDeleteDays} días.` });
      setIsAutoDeleteDialogOpen(false);
    } catch (error) {
      toast({ variant: "destructive", title: "Error", description: "No se pudo configurar la auto-eliminación." });
    } finally {
      setIsSettingAutoDelete(false);
    }
  };

  const handleClearAll = async () => {
    try {
      const response = await fetch('/api/tasks/history/clear-all', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      if (!response.ok) throw new Error('Error al limpiar historial');
      toast({ title: "Historial limpiado", description: "Se ha eliminado todo el historial de tareas." });
      fetchHistory();
      setIsClearAllDialogOpen(false);
    } catch (error) {
      toast({ variant: "destructive", title: "Error", description: "No se pudo limpiar el historial." });
    }
  };

  const filteredHistory = useMemo(() => {
    return history.filter(item => {
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        if (!item.task.title?.toLowerCase().includes(term) && !item.task.description?.toLowerCase().includes(term)) return false;
      }
      if (priorityFilter !== "all" && item.task.priority?.toLowerCase() !== priorityFilter.toLowerCase()) return false;
      return true;
    });
  }, [history, searchTerm, priorityFilter]);

  const groupTasksByDate = (tasks: any[]) => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today); yesterday.setDate(yesterday.getDate() - 1);
    const thisWeek = new Date(today); thisWeek.setDate(thisWeek.getDate() - 7);
    const thisMonth = new Date(today); thisMonth.setMonth(thisMonth.getMonth() - 1);
    const groups: { [key: string]: any[] } = { 'Hoy': [], 'Ayer': [], 'Esta semana': [], 'Este mes': [], 'Más antiguas': [] };
    tasks.forEach(task => {
      const taskDate = new Date(task.deletedAt);
      const taskDateOnly = new Date(taskDate.getFullYear(), taskDate.getMonth(), taskDate.getDate());
      if (taskDateOnly.getTime() === today.getTime()) groups['Hoy'].push(task);
      else if (taskDateOnly.getTime() === yesterday.getTime()) groups['Ayer'].push(task);
      else if (taskDate >= thisWeek) groups['Esta semana'].push(task);
      else if (taskDate >= thisMonth) groups['Este mes'].push(task);
      else groups['Más antiguas'].push(task);
    });
    return Object.entries(groups).filter(([_, tasks]) => tasks.length > 0);
  };

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full mx-auto mb-4" />
        <p className="text-muted-foreground">Cargando historial...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <AlertTriangle className="h-8 w-8 text-destructive mx-auto mb-4" />
        <p className="text-destructive">{error}</p>
        <Button variant="outline" onClick={fetchHistory} className="mt-4">Reintentar</Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-4 border-b border-border">
        <div>
          <h2 className="text-xl font-semibold">Historial de Tareas</h2>
          <p className="text-sm text-muted-foreground mt-1">{history.length} tarea{history.length !== 1 ? 's' : ''} en el historial</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={toggleSelectionMode}>
            {isSelectionMode ? 'Cancelar' : 'Seleccionar'}
          </Button>
          <Button variant="outline" size="sm" onClick={() => setIsAutoDeleteDialogOpen(true)}>Auto-eliminar</Button>
          <Button variant="destructive" size="sm" onClick={() => setIsClearAllDialogOpen(true)}>Limpiar todo</Button>
        </div>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar en historial..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-10" />
        </div>
        <Select value={priorityFilter} onValueChange={setPriorityFilter}>
          <SelectTrigger className="w-[130px]"><SelectValue placeholder="Prioridad" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas</SelectItem>
            <SelectItem value="high">Alta</SelectItem>
            <SelectItem value="medium">Media</SelectItem>
            <SelectItem value="low">Baja</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isSelectionMode && selectedTasks.size > 0 && (
        <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg border">
          <Checkbox checked={selectedTasks.size === history.length && history.length > 0} onCheckedChange={handleSelectAll} />
          <span className="text-sm text-muted-foreground">{selectedTasks.size} seleccionada{selectedTasks.size !== 1 ? 's' : ''}</span>
          <Button variant="destructive" size="sm" className="ml-auto gap-1" onClick={() => setIsBulkDeleteDialogOpen(true)}>
            <Trash2 className="h-4 w-4" /> Eliminar seleccionadas
          </Button>
        </div>
      )}

      {filteredHistory.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground">No hay tareas en el historial</p>
        </div>
      ) : (
        <div className="space-y-6">
          {groupTasksByDate(filteredHistory).map(([groupName, tasks]) => (
            <div key={groupName} className="space-y-2">
              <h3 className="text-sm font-medium text-muted-foreground">{groupName}</h3>
              <div className="space-y-2">
                {tasks.map((item: any) => (
                  <Card key={item.id} className={cn("cursor-pointer hover:shadow-md transition-all", isSelectionMode && selectedTasks.has(item.id) && "ring-2 ring-primary")} onClick={() => handleTaskClick(item)}>
                    <CardContent className="p-4 flex items-center gap-4">
                      {isSelectionMode && (
                        <div onClick={(e) => e.stopPropagation()}>
                          <Checkbox checked={selectedTasks.has(item.id)} onCheckedChange={() => handleTaskSelection(item.id)} />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{item.task.title}</p>
                        <p className="text-xs text-muted-foreground">{formatDate(item.deletedAt)} • <span className={getPriorityColor(item.task.priority || 'medium')}>{getPriorityText(item.task.priority || 'medium')}</span></p>
                      </div>
                      <Button variant="ghost" size="sm" className="text-destructive" onClick={(e) => { e.stopPropagation(); setTaskToDelete(item); setIsDeleteDialogOpen(true); }}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <TaskHistoryDetailModal isOpen={isModalOpen} onClose={() => { setIsModalOpen(false); setSelectedTask(null); }} task={selectedTask} />

      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar permanentemente?</AlertDialogTitle>
            <AlertDialogDescription>Esta acción no se puede deshacer.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeletePermanently} className="bg-destructive text-destructive-foreground">Eliminar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={isBulkDeleteDialogOpen} onOpenChange={setIsBulkDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar {selectedTasks.size} tareas?</AlertDialogTitle>
            <AlertDialogDescription>Esta acción eliminará permanentemente las tareas seleccionadas del historial.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleBulkDelete} className="bg-destructive text-destructive-foreground">Eliminar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={isAutoDeleteDialogOpen} onOpenChange={setIsAutoDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Configurar Auto-eliminación</DialogTitle>
            <DialogDescription>Las tareas del historial se eliminarán automáticamente después del período seleccionado.</DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Label>Eliminar después de</Label>
            <Select value={autoDeleteDays} onValueChange={setAutoDeleteDays}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="7">7 días</SelectItem>
                <SelectItem value="14">14 días</SelectItem>
                <SelectItem value="30">30 días</SelectItem>
                <SelectItem value="60">60 días</SelectItem>
                <SelectItem value="90">90 días</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAutoDeleteDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSetAutoDelete} disabled={isSettingAutoDelete}>{isSettingAutoDelete ? 'Configurando...' : 'Guardar'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={isClearAllDialogOpen} onOpenChange={setIsClearAllDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Limpiar todo el historial?</AlertDialogTitle>
            <AlertDialogDescription>Esta acción eliminará permanentemente todo el historial de tareas. No se puede deshacer.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleClearAll} className="bg-destructive text-destructive-foreground">Limpiar todo</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ─── Estadísticas Tab ──────────────────────────────

function EstadisticasTab() {
  const [allTasks, setAllTasks] = useState<any[]>([]);
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState('30');
  const [selectedUserId, setSelectedUserId] = useState<string>('all');
  const { toast } = useToast();

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        const [tasksRes, usersRes] = await Promise.all([
          fetch('/api/tasks', { credentials: 'include', headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` } }),
          fetch('/api/admin/users-with-roles', { credentials: 'include', headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` } })
        ]);
        if (tasksRes.ok) {
          const tasksData = await tasksRes.json();
          setAllTasks(Array.isArray(tasksData) ? tasksData : (tasksData?.tasks || []));
        }
        if (usersRes.ok) {
          const usersData = await usersRes.json();
          const usersArray = Array.isArray(usersData) ? usersData : (usersData?.users || []);
          setAllUsers(usersArray.filter((user: any) =>
            user.permissions?.some((perm: any) => perm.name === 'ingresar_tareas') ||
            user.roles?.some((role: any) => role.permissions?.some((perm: any) => perm.name === 'ingresar_tareas'))
          ));
        }
      } catch (error) {
        toast({ variant: "destructive", title: "Error", description: "No se pudieron cargar los datos." });
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [toast]);

  const usersWithTasks = useMemo(() => {
    const userIds = new Set<string>();
    const tasksArray = Array.isArray(allTasks) ? allTasks : [];
    tasksArray.forEach(task => {
      if (task.assignedTo?.id) userIds.add(task.assignedTo.id);
      if (task.createdBy?.id) userIds.add(task.createdBy.id);
    });
    return allUsers.filter(user => userIds.has(user.id));
  }, [allTasks, allUsers]);

  const analytics = useMemo(() => {
    const tasksArray = Array.isArray(allTasks) ? allTasks : [];
    const usersArray = Array.isArray(allUsers) ? allUsers : [];
    const now = new Date();
    const daysAgo = new Date(now.getTime() - parseInt(timeRange) * 24 * 60 * 60 * 1000);
    let recentTasks = tasksArray.filter(task => new Date(task.createdAt) >= daysAgo);
    if (selectedUserId !== 'all') {
      recentTasks = recentTasks.filter(task => task.assignedTo?.id === selectedUserId || task.createdBy?.id === selectedUserId);
    }
    const total = recentTasks.length;
    const completed = recentTasks.filter(t => t.status === 'DONE').length;
    const inProgress = recentTasks.filter(t => t.status === 'IN_PROGRESS').length;
    const pending = recentTasks.filter(t => t.status === 'TODO').length;
    const overdue = recentTasks.filter(t => { if (!t.dueDate || t.status === 'DONE') return false; return new Date(t.dueDate) < now; }).length;
    const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;
    const productivity = Math.round(completed / (parseInt(timeRange) / 7));
    const completedWithDates = recentTasks.filter(t => t.status === 'DONE' && t.createdAt && t.updatedAt);
    const avgResolutionTime = completedWithDates.length > 0 ?
      Math.round(completedWithDates.reduce((acc, task) => {
        const created = new Date(task.createdAt);
        const completedDate = new Date(task.updatedAt);
        return acc + (completedDate.getTime() - created.getTime()) / (1000 * 60 * 60 * 24);
      }, 0) / completedWithDates.length) : 0;
    const trendData = Array.from({ length: 7 }, (_, i) => {
      const date = new Date(); date.setDate(date.getDate() - (6 - i));
      const dayTasks = recentTasks.filter(t => new Date(t.createdAt).toDateString() === date.toDateString());
      return { label: date.toLocaleDateString('es-ES', { weekday: 'short' }), value: dayTasks.length, completed: dayTasks.filter(t => t.status === 'DONE').length };
    });
    const userStats = usersArray.map(user => {
      const userTasks = tasksArray.filter(t => t.createdBy?.id === user.id);
      const userCompleted = userTasks.filter(t => t.status === 'DONE').length;
      const userAssigned = tasksArray.filter(t => t.assignedTo?.id === user.id);
      return { name: user.name, value: userTasks.length, completed: userCompleted, assigned: userAssigned.length, percentage: userTasks.length > 0 ? Math.round((userCompleted / userTasks.length) * 100) : 0 };
    }).filter(u => u.value > 0 || u.assigned > 0).sort((a, b) => b.value - a.value);
    const priorityStats = {
      high: recentTasks.filter(t => t.priority === 'HIGH').length,
      medium: recentTasks.filter(t => t.priority === 'MEDIUM').length,
      low: recentTasks.filter(t => t.priority === 'LOW').length,
      highCompleted: recentTasks.filter(t => t.priority === 'HIGH' && t.status === 'DONE').length,
      mediumCompleted: recentTasks.filter(t => t.priority === 'MEDIUM' && t.status === 'DONE').length,
      lowCompleted: recentTasks.filter(t => t.priority === 'LOW' && t.status === 'DONE').length,
    };
    const prevPeriodStart = new Date(daysAgo.getTime() - parseInt(timeRange) * 24 * 60 * 60 * 1000);
    let prevPeriodTasks = tasksArray.filter(task => { const d = new Date(task.createdAt); return d >= prevPeriodStart && d < daysAgo; });
    if (selectedUserId !== 'all') prevPeriodTasks = prevPeriodTasks.filter(task => task.assignedTo?.id === selectedUserId || task.createdBy?.id === selectedUserId);
    const prevTotal = prevPeriodTasks.length;
    const prevCompleted = prevPeriodTasks.filter(t => t.status === 'DONE').length;
    const prevCompletionRate = prevTotal > 0 ? Math.round((prevCompleted / prevTotal) * 100) : 0;
    const comparison = {
      totalDiff: total - prevTotal,
      totalPercent: prevTotal > 0 ? Math.round(((total - prevTotal) / prevTotal) * 100) : (total > 0 ? 100 : 0),
      completedDiff: completed - prevCompleted,
      completedPercent: prevCompleted > 0 ? Math.round(((completed - prevCompleted) / prevCompleted) * 100) : (completed > 0 ? 100 : 0),
      rateDiff: completionRate - prevCompletionRate
    };
    return { total, completed, inProgress, pending, overdue, completionRate, productivity, avgResolutionTime, trendData, userStats, priorityStats, comparison };
  }, [allTasks, allUsers, timeRange, selectedUserId]);

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full mx-auto mb-4" />
        <p className="text-muted-foreground">Cargando métricas...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-4 border-b border-border">
        <div>
          <h2 className="text-xl font-semibold text-foreground">Métricas y Reportes</h2>
          <p className="text-sm text-muted-foreground mt-1">Análisis de rendimiento y métricas de productividad</p>
        </div>
        <div className="flex items-center gap-3">
          <Select value={timeRange} onValueChange={setTimeRange}>
            <SelectTrigger className="w-32 h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="7">7 días</SelectItem>
              <SelectItem value="30">30 días</SelectItem>
              <SelectItem value="90">90 días</SelectItem>
            </SelectContent>
          </Select>
          <Select value={selectedUserId} onValueChange={setSelectedUserId}>
            <SelectTrigger className="w-44 h-9"><SelectValue placeholder="Usuario" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los usuarios</SelectItem>
              {usersWithTasks.map(user => (<SelectItem key={user.id} value={user.id}>{user.name}</SelectItem>))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid gap-4 grid-cols-2 lg:grid-cols-5">
        <MetricCard title="Total Tareas" value={analytics.total} trendValue={`Período: ${timeRange} días`} icon={LayoutGrid} />
        <MetricCard title="Completadas" value={analytics.completed} trendValue={`${analytics.completionRate}% del total`} icon={CheckCircle2} />
        <MetricCard title="En Progreso" value={analytics.inProgress} icon={Clock} />
        <MetricCard title="Pendientes" value={analytics.pending} trendValue={analytics.overdue > 0 ? `${analytics.overdue} vencidas` : undefined} icon={AlertTriangle} />
        <MetricCard title="Tiempo Promedio" value={`${analytics.avgResolutionTime}d`} trendValue="Para completar" icon={BarChart3} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Progreso General</CardTitle></CardHeader>
          <CardContent className="flex items-center justify-center pb-6"><CircularProgress percentage={analytics.completionRate} size={120} strokeWidth={8} color="hsl(var(--primary))" /></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Tendencia Semanal</CardTitle></CardHeader>
          <CardContent><SimpleLineChart data={analytics.trendData} title="" color="hsl(var(--primary))" /></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Estados Actuales</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between p-2 bg-muted/30 rounded-md"><div className="flex items-center gap-2"><div className="w-2 h-2 bg-primary rounded-full" /><span className="text-sm">Completadas</span></div><span className="font-semibold">{analytics.completed}</span></div>
            <div className="flex items-center justify-between p-2 bg-muted/30 rounded-md"><div className="flex items-center gap-2"><div className="w-2 h-2 bg-primary/60 rounded-full" /><span className="text-sm">En Progreso</span></div><span className="font-semibold">{analytics.inProgress}</span></div>
            <div className="flex items-center justify-between p-2 bg-muted/30 rounded-md"><div className="flex items-center gap-2"><div className="w-2 h-2 bg-muted-foreground rounded-full" /><span className="text-sm">Pendientes</span></div><span className="font-semibold">{analytics.pending}</span></div>
            {analytics.overdue > 0 && (<div className="flex items-center justify-between p-2 bg-destructive/10 rounded-md"><div className="flex items-center gap-2"><div className="w-2 h-2 bg-destructive rounded-full" /><span className="text-sm">Vencidas</span></div><span className="font-semibold text-destructive">{analytics.overdue}</span></div>)}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Distribución por Prioridad</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            {[
              { label: 'Alta', color: 'bg-destructive', stats: analytics.priorityStats.high, completed: analytics.priorityStats.highCompleted },
              { label: 'Media', color: 'bg-amber-500', stats: analytics.priorityStats.medium, completed: analytics.priorityStats.mediumCompleted },
              { label: 'Baja', color: 'bg-muted-foreground', stats: analytics.priorityStats.low, completed: analytics.priorityStats.lowCompleted },
            ].map(({ label, color, stats, completed: completedCount }) => (
              <div key={label} className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2"><div className={`w-2 h-2 ${color} rounded-full`} /><span className="text-sm font-medium">{label}</span></div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">{completedCount}/{stats}</span>
                    <span className="text-xs text-muted-foreground">({stats > 0 ? Math.round((completedCount / stats) * 100) : 0}%)</span>
                  </div>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div className={`h-full ${color} transition-all duration-500`} style={{ width: `${stats > 0 ? (completedCount / stats) * 100 : 0}%` }} />
                </div>
              </div>
            ))}
            <div className="pt-3 border-t border-border">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium">Total</span>
                <span className="text-muted-foreground">{analytics.priorityStats.high + analytics.priorityStats.medium + analytics.priorityStats.low} tareas</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">vs Período Anterior ({timeRange} días)</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            {[
              { label: 'Total Tareas', value: analytics.total, diff: analytics.comparison.totalDiff, percent: analytics.comparison.totalPercent, suffix: '%' },
              { label: 'Completadas', value: analytics.completed, diff: analytics.comparison.completedDiff, percent: analytics.comparison.completedPercent, suffix: '%' },
              { label: 'Tasa de Completitud', value: `${analytics.completionRate}%`, diff: analytics.comparison.rateDiff, percent: analytics.comparison.rateDiff, suffix: 'pp' },
            ].map(({ label, value, diff, percent, suffix }) => (
              <div key={label} className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                <div><p className="text-sm text-muted-foreground">{label}</p><p className="text-xl font-bold">{value}</p></div>
                <div className={cn("flex items-center gap-1 px-2 py-1 rounded-md text-sm font-medium", diff > 0 ? "bg-primary/10 text-primary" : diff < 0 ? "bg-destructive/10 text-destructive" : "bg-muted text-muted-foreground")}>
                  {diff > 0 ? <TrendingUp className="h-3 w-3" /> : diff < 0 ? <TrendingDown className="h-3 w-3" /> : <Minus className="h-3 w-3" />}
                  <span>{diff > 0 ? '+' : ''}{percent}{suffix}</span>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Actividad (últimos 3 meses)</CardTitle></CardHeader>
          <CardContent><HeatmapCalendar tasks={allTasks} /></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Usuarios Más Activos</CardTitle></CardHeader>
          <CardContent><UserRanking users={analytics.userStats} /></CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Resumen</CardTitle></CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="text-center p-4 bg-muted/30 rounded-lg">
              <div className="text-2xl font-bold">{analytics.completionRate}%</div>
              <div className="text-sm font-medium mt-1">Tasa de Éxito</div>
              <div className="text-xs text-muted-foreground mt-1">{analytics.completionRate > 70 ? "Excelente rendimiento" : "Margen de mejora"}</div>
            </div>
            <div className="text-center p-4 bg-muted/30 rounded-lg">
              <div className="text-2xl font-bold">{analytics.productivity}</div>
              <div className="text-sm font-medium mt-1">Tareas/Semana</div>
              <div className="text-xs text-muted-foreground mt-1">Productividad promedio</div>
            </div>
            <div className="text-center p-4 bg-muted/30 rounded-lg">
              <div className="text-2xl font-bold">{analytics.userStats.length}</div>
              <div className="text-sm font-medium mt-1">Usuarios Activos</div>
              <div className="text-xs text-muted-foreground mt-1">Con tareas asignadas</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Main TareasContent Component ──────────────────

export default function TareasContent({ activeTab }: TareasContentProps) {
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

  const { tasks, fetchTasks, createTask, setSelectedTask } = useTaskStore();
  const { user } = useAuth();
  const { toast } = useToast();
  const [allUsers, setAllUsers] = useState<any[]>([]);

  const {
    tasks: fixedTasks,
    loading: fixedTasksLoading,
    createTask: createFixedTask,
    updateTask: updateFixedTask,
    deleteTask: deleteFixedTask,
    refetch: refetchFixedTasks
  } = useFixedTasks();

  useEffect(() => { fetchTasks(); }, [fetchTasks]);

  useEffect(() => {
    const loadUsers = async () => {
      try {
        const response = await fetch('/api/admin/users-with-roles', {
          credentials: 'include',
          headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });
        if (response.ok) {
          const usersData = await response.json();
          const usersArray = Array.isArray(usersData) ? usersData : (usersData?.users || []);
          setAllUsers(usersArray.filter((u: any) =>
            u.permissions?.some((perm: any) => perm.name === 'ingresar_tareas') ||
            u.roles?.some((role: any) => role.permissions?.some((perm: any) => perm.name === 'ingresar_tareas'))
          ));
        }
      } catch (error) {
        console.error('Error loading users:', error);
      }
    };
    loadUsers();
  }, []);

  // User-specific stats
  const userStats = useMemo(() => ({
    userTasks: tasks.filter(task =>
      task.assignedTo?.id?.toString() === user?.id ||
      task.createdBy?.id?.toString() === user?.id
    ),
    userFixedTasks: fixedTasks.filter(task =>
      task.assignedTo?.id?.toString() === user?.id
    )
  }), [tasks, fixedTasks, user?.id]);

  // Handlers
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
      toast({ title: "Sin permisos", description: "No tienes permisos para editar tareas fijas", variant: "destructive" });
      return;
    }
    setEditingTask(task);
    setIsCreateTaskModalOpen(true);
  };

  const handleDeleteFixedTask = (taskId: string) => {
    if (!canDeleteFixedTask) {
      toast({ title: "Sin permisos", description: "No tienes permisos para eliminar tareas fijas", variant: "destructive" });
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
      toast({ title: "Tarea eliminada", description: `La tarea "${fixedTaskToDelete.title}" ha sido eliminada exitosamente` });
      setIsDeleteFixedTaskDialogOpen(false);
      setFixedTaskToDelete(null);
    } catch (error: any) {
      toast({ title: 'Error', description: error instanceof Error && error.message ? error.message : 'No se pudo eliminar la tarea', variant: 'destructive' });
    } finally {
      setIsDeletingFixedTask(false);
    }
  };

  const handleCreateFixedTask = (frequency: string) => {
    if (!canCreateFixedTask) {
      toast({ title: "Sin permisos", description: "No tienes permisos para crear tareas fijas", variant: "destructive" });
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
        toast({ title: "Tarea editada", description: `${taskData.title} ha sido actualizada` });
      } else {
        await createFixedTask(taskData);
        toast({ title: "Tarea fija creada", description: `${taskData.title} se ha programado como tarea ${taskData.frequency}` });
      }
      setIsCreateTaskModalOpen(false);
      setPreselectedFrequency(undefined);
      setEditingTask(null);
    } catch (error: any) {
      toast({ title: 'Error', description: error instanceof Error && error.message ? error.message : 'No se pudo ' + (editingTask ? 'editar' : 'crear') + ' la tarea fija', variant: 'destructive' });
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
        toast({ title: "Tarea completada y reiniciada", description: `${completedTask?.title} se reinició automáticamente` });
      } else {
        const nextReset = getNextResetInfo(completedTask?.frequency || 'diaria', result.task.nextExecution);
        toast({ title: "Tarea completada", description: `${completedTask?.title} - ${nextReset.text}` });
      }
      refetchFixedTasks();
      setIsExecutionModalOpen(false);
      setExecutingTask(null);
    } catch (error: any) {
      toast({ title: 'Error', description: error instanceof Error && error.message ? error.message : 'No se pudo completar la tarea', variant: 'destructive' });
      throw error;
    }
  };

  // Render content based on active tab
  const renderContent = () => {
    switch (activeTab) {
      case 'tareas':
        return (
          <TasksInbox
            tasks={tasks}
            onNewTask={() => setIsNewTaskModalOpen(true)}
            onEditTask={(task) => { setEditingRegularTask(task); setIsEditTaskModalOpen(true); }}
            canViewAll={canViewTasks}
            users={allUsers}
            canEdit={(task) => task.assignedTo?.id?.toString() === user?.id || canViewTasks}
            canDelete={(task) => task.createdBy?.id?.toString() === user?.id || canViewTasks}
          />
        );
      case 'fijas':
        return (
          <TareasFijasTab
            tasks={fixedTasks}
            onTaskClick={handleFixedTaskClick}
            onEditTask={handleEditFixedTask}
            onDeleteTask={handleDeleteFixedTask}
            onCreateTask={handleCreateFixedTask}
            onExecuteTask={handleExecuteFixedTask}
            canCreateFixedTask={canCreateFixedTask}
            onCheckResets={() => {
              toast({ title: "Sistema Reactivo Activado", description: "Los reinicios ahora son automáticos" });
            }}
          />
        );
      case 'dashboard':
        return (
          <>
            <TasksDashboard onNewTask={() => setIsNewTaskModalOpen(true)} />
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">
                  Mis pendientes <span className="text-muted-foreground font-normal">({userStats.userTasks.filter(t => t.assignedTo?.id?.toString() === user?.id && (t.status === "pendiente" || t.status === "en-curso")).length})</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {userStats.userTasks.filter(t => t.assignedTo?.id?.toString() === user?.id && (t.status === "pendiente" || t.status === "en-curso")).length === 0 ? (
                  <div className="py-10 text-center">
                    <p className="text-sm font-medium">No tenés tareas pendientes</p>
                    <p className="text-sm text-muted-foreground mt-1">Cuando tengas tareas asignadas, van a aparecer acá.</p>
                  </div>
                ) : (
                  <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
                    {userStats.userTasks.filter(t => t.assignedTo?.id?.toString() === user?.id && (t.status === "pendiente" || t.status === "en-curso")).map(task => (
                      <TaskCard key={task.id} task={task} />
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">
                  Mis Enviadas <span className="text-muted-foreground font-normal">({userStats.userTasks.filter(t => t.createdBy?.id?.toString() === user?.id).length})</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {userStats.userTasks.filter(t => t.createdBy?.id?.toString() === user?.id).length === 0 ? (
                  <div className="py-10 text-center">
                    <p className="text-sm font-medium">No tenés tareas enviadas</p>
                    <p className="text-sm text-muted-foreground mt-1">Cuando crees tareas, van a aparecer acá.</p>
                  </div>
                ) : (
                  <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
                    {userStats.userTasks.filter(t => t.createdBy?.id?.toString() === user?.id).map(task => (
                      <TaskCard key={task.id} task={task} />
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        );
      case 'historial':
        return <HistorialTab />;
      case 'metricas':
        return <EstadisticasTab />;
      default:
        return null;
    }
  };

  return (
    <>
      {renderContent()}

      {/* Modals */}
      <NewTaskModal
        isOpen={isNewTaskModalOpen}
        onClose={() => setIsNewTaskModalOpen(false)}
        onTaskCreated={handleNewTask}
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
    </>
  );
}
