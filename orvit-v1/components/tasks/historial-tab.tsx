"use client";

import { useState, useMemo, useEffect } from "react";
import { formatDate } from "@/lib/date-utils";
import { Search, Trash2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
  DialogBody,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { TaskHistoryDetailModal } from "@/components/tasks/task-history-detail-modal";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useQuery, useQueryClient } from "@tanstack/react-query";

export function HistorialTab() {
  const [selectedTask, setSelectedTask] = useState<any>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [priorityFilter, setPriorityFilter] = useState<string>("all");
  const [selectedTasks, setSelectedTasks] = useState<Set<number>>(new Set());
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [taskToDelete, setTaskToDelete] = useState<any>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isBulkDeleteDialogOpen, setIsBulkDeleteDialogOpen] = useState(false);
  const [isAutoDeleteDialogOpen, setIsAutoDeleteDialogOpen] = useState(false);
  const [isClearAllDialogOpen, setIsClearAllDialogOpen] = useState(false);
  const [autoDeleteDays, setAutoDeleteDays] = useState("30");
  const [isSettingAutoDelete, setIsSettingAutoDelete] = useState(false);
  const [visibleCount, setVisibleCount] = useState(20);

  const { user } = useAuth();
  const queryClient = useQueryClient();

  const HISTORY_KEY = ['tasks-history', user?.id];

  const { data: history = [], isLoading: loading, isError, refetch } = useQuery({
    queryKey: HISTORY_KEY,
    queryFn: async () => {
      const response = await fetch('/api/tasks/history', {
        credentials: 'include',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` },
      });
      if (!response.ok) throw new Error('Error al cargar el historial');
      const data = await response.json();
      if (data.success && Array.isArray(data.history)) {
        return data.history.filter((item: any) =>
          item.task.assignedTo?.id?.toString() === user?.id ||
          item.task.createdBy?.id?.toString() === user?.id
        );
      }
      return [];
    },
    enabled: !!user?.id,
    staleTime: 60 * 1000,
  });

  const refreshHistory = () => queryClient.invalidateQueries({ queryKey: HISTORY_KEY });

  // ─── Derivados filtrados ──────────────────────────────────────────────────────

  const filteredHistory = useMemo(() => {
    return history.filter((item: any) => {
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        if (!item.task.title?.toLowerCase().includes(term) && !item.task.description?.toLowerCase().includes(term)) return false;
      }
      if (priorityFilter !== "all" && item.task.priority?.toLowerCase() !== priorityFilter.toLowerCase()) return false;
      return true;
    });
  }, [history, searchTerm, priorityFilter]);

  // Resetear paginación cuando cambian los filtros
  useEffect(() => {
    setVisibleCount(20);
  }, [searchTerm, priorityFilter]);

  const visibleHistory = filteredHistory.slice(0, visibleCount);
  const hasMore = filteredHistory.length > visibleCount;

  // ─── Helpers de formato ───────────────────────────────────────────────────────

  // formatDate is now imported from @/lib/date-utils

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
      case 'high': case 'alta': return 'text-destructive';
      case 'medium': case 'media': return 'text-amber-600 dark:text-amber-400';
      case 'low': case 'baja': return 'text-success';
      default: return 'text-muted-foreground';
    }
  };

  // ─── Handlers ─────────────────────────────────────────────────────────────────

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

  // Selecciona/deselecciona solo los ítems actualmente filtrados
  const handleSelectAll = () => {
    if (selectedTasks.size === filteredHistory.length && filteredHistory.length > 0) {
      setSelectedTasks(new Set());
    } else {
      setSelectedTasks(new Set(filteredHistory.map((task: any) => task.id)));
    }
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
      refreshHistory();
      toast.success('Tarea eliminada permanentemente del historial');
      setIsDeleteDialogOpen(false);
      setTaskToDelete(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo eliminar la tarea del historial');
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
        toast.error(`Se eliminaron ${selectedTasks.size - failed} tareas. ${failed} fallaron.`);
      } else {
        toast.success(`Se eliminaron ${selectedTasks.size} tareas del historial`);
      }
      refreshHistory();
      setSelectedTasks(new Set());
      setIsBulkDeleteDialogOpen(false);
      setIsSelectionMode(false);
    } catch {
      toast.error('Error al eliminar las tareas seleccionadas');
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
      toast.success(`Auto-eliminación configurada: ${autoDeleteDays} días`);
      setIsAutoDeleteDialogOpen(false);
    } catch {
      toast.error('No se pudo configurar la auto-eliminación');
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
      toast.success('Todo el historial ha sido eliminado');
      refreshHistory();
      setIsClearAllDialogOpen(false);
    } catch {
      toast.error('No se pudo limpiar el historial');
    }
  };

  // ─── Agrupación por fecha ─────────────────────────────────────────────────────

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
    return Object.entries(groups).filter(([, tasks]) => tasks.length > 0);
  };

  // ─── Estados de carga / error ─────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full mx-auto mb-4" />
        <p className="text-muted-foreground">Cargando historial...</p>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="text-center py-12">
        <AlertTriangle className="h-8 w-8 text-destructive mx-auto mb-4" />
        <p className="text-destructive">Error al cargar el historial</p>
        <Button variant="outline" onClick={() => refetch()} className="mt-4">Reintentar</Button>
      </div>
    );
  }

  // ─── Render ───────────────────────────────────────────────────────────────────

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

      {isSelectionMode && (
        <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg border">
          <Checkbox
            checked={selectedTasks.size === filteredHistory.length && filteredHistory.length > 0}
            onCheckedChange={handleSelectAll}
          />
          <span className="text-sm text-muted-foreground">
            {selectedTasks.size === 0 ? 'Seleccionar todas' : `${selectedTasks.size} seleccionada${selectedTasks.size !== 1 ? 's' : ''}`}
          </span>
          {selectedTasks.size > 0 && (
            <Button variant="destructive" size="sm" className="ml-auto gap-1" onClick={() => setIsBulkDeleteDialogOpen(true)}>
              <Trash2 className="h-4 w-4" /> Eliminar seleccionadas
            </Button>
          )}
        </div>
      )}

      {filteredHistory.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground">
            {history.length === 0 ? 'No hay tareas en el historial' : 'Sin resultados para los filtros aplicados'}
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {groupTasksByDate(visibleHistory).map(([groupName, tasks]) => (
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

          <div className="flex items-center justify-between pt-2 text-sm text-muted-foreground">
            <span>Mostrando {Math.min(visibleCount, filteredHistory.length)} de {filteredHistory.length} tareas</span>
            {hasMore && (
              <Button variant="outline" size="sm" onClick={() => setVisibleCount(v => v + 20)}>
                Cargar más ({filteredHistory.length - visibleCount} restantes)
              </Button>
            )}
          </div>
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
        <DialogContent size="default">
          <DialogHeader>
            <DialogTitle>Configurar Auto-eliminación</DialogTitle>
            <DialogDescription>Las tareas del historial se eliminarán automáticamente después del período seleccionado.</DialogDescription>
          </DialogHeader>
          <DialogBody>
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
          </DialogBody>
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
