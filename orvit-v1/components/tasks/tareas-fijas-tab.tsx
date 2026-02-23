"use client";

import { cn } from "@/lib/utils";
import { Plus, LayoutGrid, Clock, CheckCircle2, BarChart3, RotateCcw, Repeat } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { FixedTasksKanban } from "@/components/tasks/fixed-tasks-kanban";

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
  executionTime?: string;
  lastExecuted?: string;
  nextExecution: string;
  createdAt: string;
  completedAt?: string;
  isCompleted?: boolean;
}

interface TareasFijasTabProps {
  tasks: FixedTask[];
  onTaskClick: (task: FixedTask) => void;
  onEditTask: (task: FixedTask) => void;
  onDeleteTask: (taskId: string) => void;
  onCreateTask: (frequency: string) => void;
  onExecuteTask: (task: FixedTask) => void;
  onCheckResets?: () => void;
  canCreateFixedTask?: boolean;
  loading?: boolean;
}

export function TareasFijasTab({
  tasks, onTaskClick, onEditTask, onDeleteTask, onCreateTask, onExecuteTask, onCheckResets, canCreateFixedTask = false, loading = false
}: TareasFijasTabProps) {
  const totalTasks = tasks.length;
  const pendingTasks = tasks.filter(t => !t.isCompleted && t.isActive).length;
  const completedTasks = tasks.filter(t => t.isCompleted).length;
  const inactiveTasks = tasks.filter(t => !t.isActive).length;
  const tasksNeedingReset = tasks.filter(t => t.isCompleted && new Date() >= new Date(t.nextExecution)).length;
  const completionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  // Skeleton de carga
  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-4 border-b border-border">
          <div className="space-y-2">
            <Skeleton className="h-6 w-56" />
            <Skeleton className="h-4 w-80" />
          </div>
          <Skeleton className="h-9 w-36" />
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <Card key={i}><CardContent className="p-4"><div className="flex items-start justify-between"><div className="space-y-2"><Skeleton className="h-3 w-20" /><Skeleton className="h-8 w-12" /></div><Skeleton className="h-8 w-8 rounded-lg" /></div></CardContent></Card>
          ))}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i}><CardContent className="p-4 space-y-3"><Skeleton className="h-5 w-32" /><div className="space-y-2">{Array.from({ length: 3 }).map((_, j) => (<Skeleton key={j} className="h-20 w-full rounded-lg" />))}</div></CardContent></Card>
          ))}
        </div>
      </div>
    );
  }

  // Empty state
  if (tasks.length === 0) {
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
        <Card className="flex items-center justify-center py-16">
          <CardContent className="text-center">
            <div className="h-16 w-16 mx-auto mb-4 rounded-full bg-muted flex items-center justify-center">
              <Repeat className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-medium mb-1">No hay tareas fijas</h3>
            <p className="text-muted-foreground text-sm mb-4">
              Las tareas fijas se repiten automáticamente según su frecuencia
            </p>
            {canCreateFixedTask && (
              <Button onClick={() => onCreateTask('')}>
                <Plus className="h-4 w-4 mr-2" />
                Crear primera tarea fija
              </Button>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

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
        <Card><CardContent className="p-4"><div className="flex items-start justify-between"><div><p className="text-xs font-medium text-muted-foreground">{tasksNeedingReset > 0 ? 'Reiniciándose' : 'Inactivas'}</p><p className="text-2xl font-bold mt-1">{tasksNeedingReset > 0 ? tasksNeedingReset : inactiveTasks}</p></div><div className="p-2 rounded-lg bg-muted"><RotateCcw className={cn('h-4 w-4 text-muted-foreground', tasksNeedingReset > 0 && 'animate-spin')} /></div></div>{tasksNeedingReset > 0 && (<p className="text-xs text-muted-foreground mt-2">Reinicio automático activo</p>)}</CardContent></Card>
      </div>
      <FixedTasksKanban tasks={tasks} onTaskClick={onTaskClick} onEditTask={onEditTask} onDeleteTask={onDeleteTask} onCreateTask={onCreateTask} onExecuteTask={onExecuteTask} />
    </div>
  );
}
