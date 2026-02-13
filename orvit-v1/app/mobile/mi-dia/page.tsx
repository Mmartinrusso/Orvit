'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import {
  MobileDayTask,
  MobileDaySummary,
  ActiveLOTOBanner,
} from '@/components/mobile';
import {
  RefreshCcw,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Sun,
  Clock,
  AlertTriangle,
  Menu,
  Home,
} from 'lucide-react';
import { format, addDays, subDays, isToday } from 'date-fns';
import { es } from 'date-fns/locale';
import { toast } from 'sonner';
import Link from 'next/link';

interface DayTask {
  id: number;
  type: 'task' | 'fixed_task' | 'work_order' | 'checklist';
  title: string;
  description?: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  status: string;
  scheduledTime?: string;
  dueDate?: string;
  machine?: { id: number; name: string };
  estimatedDuration?: number;
  progress?: number;
  requiresLOTO?: boolean;
  requiresPTW?: boolean;
  skillWarnings?: string[];
}

export default function MiDiaPage() {
  const { user, loading: authLoading } = useAuth();
  const queryClient = useQueryClient();
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [selectedTask, setSelectedTask] = useState<DayTask | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);

  const dateIsToday = isToday(selectedDate);

  // Fetch day data
  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ['mi-dia', format(selectedDate, 'yyyy-MM-dd')],
    queryFn: async () => {
      const res = await fetch(`/api/mobile/mi-dia?date=${format(selectedDate, 'yyyy-MM-dd')}`);
      if (!res.ok) throw new Error('Error fetching day data');
      return res.json();
    },
    enabled: !authLoading && !!user,
    refetchInterval: 60000, // Refresh every minute
  });

  // Start task mutation
  const startTaskMutation = useMutation({
    mutationFn: async (task: DayTask) => {
      const endpoint = task.type === 'work_order'
        ? `/api/work-orders/${task.id}`
        : `/api/tasks/${task.id}`;

      const res = await fetch(endpoint, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'in_progress' }),
      });

      if (!res.ok) throw new Error('Error al iniciar tarea');
      return res.json();
    },
    onSuccess: () => {
      toast.success('Tarea iniciada');
      queryClient.invalidateQueries({ queryKey: ['mi-dia'] });
    },
    onError: () => {
      toast.error('Error al iniciar tarea');
    },
  });

  // Complete task mutation
  const completeTaskMutation = useMutation({
    mutationFn: async (task: DayTask) => {
      const endpoint = task.type === 'work_order'
        ? `/api/work-orders/${task.id}`
        : `/api/tasks/${task.id}`;

      const res = await fetch(endpoint, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'completed' }),
      });

      if (!res.ok) throw new Error('Error al completar tarea');
      return res.json();
    },
    onSuccess: () => {
      toast.success('Tarea completada');
      queryClient.invalidateQueries({ queryKey: ['mi-dia'] });
    },
    onError: () => {
      toast.error('Error al completar tarea');
    },
  });

  const handleStartTask = (task: DayTask) => {
    // Check if LOTO or PTW is required
    if (task.requiresLOTO || task.requiresPTW) {
      toast.warning('Esta tarea requiere permisos de seguridad. Verifica LOTO/PTW antes de iniciar.');
    }
    startTaskMutation.mutate(task);
  };

  const handleCompleteTask = (task: DayTask) => {
    completeTaskMutation.mutate(task);
  };

  const handleViewDetails = (task: DayTask) => {
    setSelectedTask(task);
    setIsDetailsOpen(true);
  };

  const goToNextDay = () => setSelectedDate(addDays(selectedDate, 1));
  const goToPrevDay = () => setSelectedDate(subDays(selectedDate, 1));
  const goToToday = () => setSelectedDate(new Date());

  if (authLoading) {
    return (
      <div className="min-h-screen bg-gray-50 p-4">
        <Skeleton className="h-8 w-48 mb-4" />
        <Skeleton className="h-32 w-full mb-4" />
        <Skeleton className="h-24 w-full mb-2" />
        <Skeleton className="h-24 w-full mb-2" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 p-4 flex items-center justify-center">
        <Alert>
          <AlertDescription>
            Inicia sesión para ver tu día
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Header */}
      <div className="bg-primary text-white p-4 sticky top-0 z-10">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Link href="/">
              <Button variant="ghost" size="icon" className="text-white hover:bg-white/20">
                <Home className="h-5 w-5" />
              </Button>
            </Link>
            <div>
              <h1 className="text-lg font-bold flex items-center gap-2">
                <Sun className="h-5 w-5" />
                Mi Día
              </h1>
              <p className="text-xs text-white/80">
                {user.name}
              </p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="text-white hover:bg-white/20"
            onClick={() => refetch()}
            disabled={isFetching}
          >
            <RefreshCcw className={`h-5 w-5 ${isFetching ? 'animate-spin' : ''}`} />
          </Button>
        </div>

        {/* Date navigation */}
        <div className="flex items-center justify-between bg-white/10 rounded-lg p-2">
          <Button
            variant="ghost"
            size="icon"
            className="text-white hover:bg-white/20"
            onClick={goToPrevDay}
          >
            <ChevronLeft className="h-5 w-5" />
          </Button>

          <div
            className="flex-1 text-center cursor-pointer"
            onClick={goToToday}
          >
            <p className="text-sm font-medium capitalize">
              {dateIsToday
                ? 'Hoy'
                : format(selectedDate, 'EEEE', { locale: es })
              }
            </p>
            <p className="text-xs text-white/80">
              {format(selectedDate, 'd MMMM yyyy', { locale: es })}
            </p>
          </div>

          <Button
            variant="ghost"
            size="icon"
            className="text-white hover:bg-white/20"
            onClick={goToNextDay}
          >
            <ChevronRight className="h-5 w-5" />
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className="p-4 space-y-4">
        {isLoading ? (
          <>
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
          </>
        ) : error ? (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              Error al cargar los datos. Intenta de nuevo.
            </AlertDescription>
          </Alert>
        ) : (
          <>
            {/* Summary */}
            <MobileDaySummary
              summary={data.summary}
              isToday={data.isToday}
            />

            {/* Active LOTO warning */}
            {data.activeLOTOs && data.activeLOTOs.length > 0 && (
              <ActiveLOTOBanner
                lotos={data.activeLOTOs}
                onRelease={(id) => {
                  toast.info('Ve a la OT para liberar el bloqueo LOTO');
                }}
              />
            )}

            {/* Tasks list */}
            <div>
              <h2 className="text-sm font-semibold text-muted-foreground mb-2 flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Tareas del día
              </h2>

              {data.tasks && data.tasks.length > 0 ? (
                <div className="space-y-3">
                  {data.tasks.map((task: DayTask) => (
                    <MobileDayTask
                      key={`${task.type}-${task.id}`}
                      task={task}
                      onStart={handleStartTask}
                      onComplete={handleCompleteTask}
                      onViewDetails={handleViewDetails}
                    />
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <CalendarDays className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>No hay tareas para este día</p>
                </div>
              )}
            </div>

            {/* Upcoming tasks */}
            {data.upcomingTasks && data.upcomingTasks.length > 0 && (
              <div className="mt-6">
                <h2 className="text-sm font-semibold text-muted-foreground mb-2">
                  Próximas tareas
                </h2>
                <div className="space-y-2">
                  {data.upcomingTasks.map((task: { id: number; name: string; dueDate?: string; priority?: string }) => (
                    <div
                      key={task.id}
                      className="flex items-center justify-between p-3 bg-white rounded-lg border"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{task.name}</p>
                        {task.dueDate && (
                          <p className="text-xs text-muted-foreground">
                            {format(new Date(task.dueDate), 'd MMM', { locale: es })}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Task details sheet */}
      <Sheet open={isDetailsOpen} onOpenChange={setIsDetailsOpen}>
        <SheetContent side="bottom" className="h-[80vh]">
          {selectedTask && (
            <>
              <SheetHeader>
                <SheetTitle>{selectedTask.title}</SheetTitle>
              </SheetHeader>
              <div className="mt-4 space-y-4">
                {selectedTask.description && (
                  <p className="text-sm text-muted-foreground">
                    {selectedTask.description}
                  </p>
                )}
                {selectedTask.machine && (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">Máquina</p>
                    <p className="text-sm">{selectedTask.machine.name}</p>
                  </div>
                )}
                {selectedTask.dueDate && (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">Fecha límite</p>
                    <p className="text-sm">
                      {format(new Date(selectedTask.dueDate), 'PPp', { locale: es })}
                    </p>
                  </div>
                )}

                <div className="flex gap-2 pt-4">
                  {selectedTask.status !== 'completed' && selectedTask.status !== 'in_progress' && (
                    <Button
                      className="flex-1"
                      onClick={() => {
                        handleStartTask(selectedTask);
                        setIsDetailsOpen(false);
                      }}
                    >
                      Iniciar Tarea
                    </Button>
                  )}
                  {selectedTask.status === 'in_progress' && (
                    <Button
                      className="flex-1 bg-green-600 hover:bg-green-700"
                      onClick={() => {
                        handleCompleteTask(selectedTask);
                        setIsDetailsOpen(false);
                      }}
                    >
                      Completar Tarea
                    </Button>
                  )}
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
