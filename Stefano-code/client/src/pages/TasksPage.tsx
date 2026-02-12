import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Clock, Home, Loader2, Search, X, ListChecks, Inbox, CheckCircle2, RotateCcw, ChevronRight, AlertTriangle, Activity, Zap, AlertCircle, XCircle } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import { Button, EmptyState, Spinner } from '@/components/common';
import { useActiveTasks, useTasks, useQueuedTasks, useCancelTask, useRetryTask, useInterruptedTasks, useDismissTask } from '@/hooks/useTasks';
import { TaskLiveView } from '@/components/tasks/TaskLiveView';
import { cn, formatDuration, formatTokens, calculateTokenCost, formatCost } from '@/utils';

type Tab = 'active' | 'queue' | 'pending' | 'history';

function RunningTimer({ initialMs }: { initialMs: number }) {
  const [elapsed, setElapsed] = useState(initialMs);

  useEffect(() => {
    setElapsed(initialMs);
    const interval = setInterval(() => {
      setElapsed(prev => prev + 1000);
    }, 1000);
    return () => clearInterval(interval);
  }, [initialMs]);

  return (
    <span className="flex items-center gap-1 tabular-nums text-[11px] font-medium">
      <Clock className="h-3 w-3" />
      {formatDuration(elapsed)}
    </span>
  );
}

export function TasksPage() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<Tab>('active');
  const [liveViewTask, setLiveViewTask] = useState<{ id: string; prompt: string; model: string } | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const { data: activeData, isLoading: activeLoading } = useActiveTasks();
  const { data: historyData, isLoading: historyLoading } = useTasks(50);
  const { data: queueData } = useQueuedTasks();
  const cancelTask = useCancelTask();
  const retryTask = useRetryTask();
  const { data: interruptedData } = useInterruptedTasks();
  const dismissTask = useDismissTask();
  const [retryingId, setRetryingId] = useState<string | null>(null);
  const interruptedTasks = interruptedData?.tasks || [];

  const activeTasks = activeData?.tasks || [];
  const queuedTasks = queueData?.tasks || [];
  const historyTasks = historyData?.tasks || [];
  const failedCount = historyTasks.filter(t => !t.success).length;

  const filteredHistory = useMemo(() => {
    if (!searchQuery.trim()) return historyTasks;
    const q = searchQuery.toLowerCase();
    return historyTasks.filter(task => task.input_prompt?.toLowerCase().includes(q));
  }, [historyTasks, searchQuery]);

  const tabs: { key: Tab; label: string; count?: number; icon: React.ComponentType<{ className?: string }> }[] = [
    { key: 'active', label: 'Activas', count: activeTasks.length, icon: Zap },
    { key: 'queue', label: 'Cola', count: queuedTasks.length, icon: Inbox },
    { key: 'pending', label: 'Pendientes', count: interruptedTasks.length > 0 ? interruptedTasks.length : undefined, icon: AlertCircle },
    { key: 'history', label: 'Historial', count: failedCount > 0 ? failedCount : undefined, icon: Clock },
  ];

  const successCount = historyTasks.filter(t => t.success).length;
  const successRate = historyTasks.length > 0 ? Math.round((successCount / historyTasks.length) * 100) : 0;
  const totalCost = historyTasks.reduce((sum, t) => sum + calculateTokenCost(t.total_input_tokens, t.total_output_tokens, t.model), 0);

  const handleCancelTask = (e: React.MouseEvent, taskId: string) => {
    e.stopPropagation();
    cancelTask.mutate(taskId);
  };

  const handleRetryTask = async (e: React.MouseEvent, taskId: string) => {
    e.stopPropagation();
    setRetryingId(taskId);
    try {
      const result = await retryTask.mutateAsync(taskId);
      if (result.task_id) navigate(`/tasks/${result.task_id}`);
    } catch (error) {
      console.error('Error retrying task:', error);
    } finally {
      setRetryingId(null);
    }
  };

  return (
    <div className="space-y-6 page-transition">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-blue-600 flex items-center justify-center shadow-md shadow-blue-500/15">
            <Activity className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">Tasks</h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">Gestiona tus tareas de desarrollo</p>
          </div>
        </div>
        {/* Inline stats */}
        <div className="flex items-center gap-5">
          {[
            { label: 'Total', value: historyTasks.length, color: 'text-slate-900 dark:text-slate-100' },
            { label: 'Exito', value: `${successRate}%`, color: 'text-green-600 dark:text-green-400' },
            { label: 'Costo', value: formatCost(totalCost), color: 'text-blue-600 dark:text-blue-400' },
          ].map(s => (
            <div key={s.label} className="text-right">
              <p className={cn('text-lg font-bold tabular-nums leading-none', s.color)}>{s.value}</p>
              <p className="text-[10px] text-slate-400 dark:text-slate-500 uppercase tracking-wider mt-1">{s.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Interrupted Tasks Notification (only show when NOT on pending tab) */}
      {interruptedTasks.length > 0 && activeTab !== 'pending' && (
        <button
          onClick={() => setActiveTab('pending')}
          className="w-full flex items-center gap-2.5 px-4 py-2.5 rounded-xl bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 hover:bg-yellow-100 dark:hover:bg-yellow-900/30 transition-colors text-left"
        >
          <AlertCircle className="h-4 w-4 text-yellow-600 dark:text-yellow-400 flex-shrink-0" />
          <span className="text-sm font-medium text-yellow-800 dark:text-yellow-300">
            {interruptedTasks.length} tarea{interruptedTasks.length !== 1 ? 's' : ''} pendiente{interruptedTasks.length !== 1 ? 's' : ''} de finalizar
          </span>
          <ChevronRight className="h-4 w-4 text-yellow-500 ml-auto flex-shrink-0" />
        </button>
      )}

      {/* Tabs */}
      <div className="flex items-center gap-1 bg-white dark:bg-dark-surface rounded-xl border border-slate-200/80 dark:border-slate-700/50 p-1">
        {tabs.map(tab => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={cn(
                'flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-lg transition-all flex-1 justify-center',
                activeTab === tab.key
                  ? 'bg-slate-900 dark:bg-white/10 text-white dark:text-white shadow-sm'
                  : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/5'
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {tab.label}
              {tab.count !== undefined && tab.count > 0 && (
                <span className={cn(
                  'text-[10px] px-1.5 py-0.5 rounded-full font-semibold',
                  activeTab === tab.key
                    ? 'bg-white/20 text-white'
                    : tab.key === 'pending'
                      ? 'bg-yellow-500/10 text-yellow-600'
                      : tab.key === 'history'
                        ? 'bg-red-500/10 text-red-500'
                        : 'bg-blue-500/10 text-blue-500'
                )}>
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Active Tab */}
      {activeTab === 'active' && (
        <div className="space-y-3">
          {activeLoading && <Spinner />}
          {activeTasks.length === 0 && !activeLoading && (
            <EmptyState
              icon={<ListChecks className="h-10 w-10" />}
              title="No hay tareas activas"
              description="Cuando inicies una tarea, aparecera aqui en tiempo real."
              action={
                <Button variant="primary" size="sm" onClick={() => navigate('/')}>
                  <Home className="h-4 w-4 mr-2" />
                  Crear tarea
                </Button>
              }
            />
          )}
          {activeTasks.map(task => {
            const stagesCount = task.stages_completed?.length || 0;
            return (
              <div
                key={task.task_id}
                className="rounded-xl bg-white dark:bg-dark-surface border border-slate-200/80 dark:border-slate-700/50 overflow-hidden cursor-pointer hover:shadow-md transition-all group"
                onClick={() => setLiveViewTask({ id: task.task_id, prompt: task.prompt, model: task.model })}
              >
                {/* Gradient top bar */}
                <div className="h-1 bg-blue-500" />
                <div className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      <div className="relative flex-shrink-0 mt-0.5">
                        <div className="w-9 h-9 rounded-lg bg-blue-500/10 flex items-center justify-center">
                          <Zap className="h-4.5 w-4.5 text-blue-500" />
                        </div>
                        <div className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-blue-500 border-2 border-white dark:border-dark-surface animate-pulse" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">{task.prompt}</p>
                        <div className="flex items-center gap-3 mt-1.5 text-slate-500 dark:text-slate-400">
                          <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-[11px] font-medium">{task.model}</span>
                          <span className="flex items-center gap-1 text-blue-600 dark:text-blue-400 text-[11px] font-medium">
                            <Loader2 className="h-3 w-3 animate-spin" />
                            {task.current_stage}
                          </span>
                          <RunningTimer initialMs={task.running_time_ms} />
                          {stagesCount > 0 && (
                            <span className="text-[11px]">{stagesCount} etapa{stagesCount !== 1 ? 's' : ''}</span>
                          )}
                        </div>
                        {/* Progress bar */}
                        <div className="mt-3 h-1.5 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-blue-500 rounded-full transition-all duration-700"
                            style={{ width: `${Math.max(8, (stagesCount / 7) * 100)}%` }}
                          />
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={(e) => handleCancelTask(e, task.task_id)}
                      disabled={cancelTask.isPending}
                      className="flex-shrink-0 p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:text-red-400 dark:hover:bg-red-500/10 transition-colors disabled:opacity-50"
                      title="Cancelar tarea"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Queue Tab */}
      {activeTab === 'queue' && (
        <div className="space-y-2">
          {queuedTasks.length === 0 && (
            <EmptyState
              icon={<Inbox className="h-10 w-10" />}
              title="No hay tareas en cola"
              description="Las tareas pendientes de ejecucion apareceran aqui."
            />
          )}
          {queuedTasks.map((task, i) => (
            <div key={task.task_id} className="rounded-xl bg-white dark:bg-dark-surface border border-slate-200/80 dark:border-slate-700/50 p-4 flex items-center gap-4">
              <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center flex-shrink-0">
                <span className="text-sm font-bold text-slate-400 dark:text-slate-500 tabular-nums">{i + 1}</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">{task.prompt}</p>
                <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-[11px] font-medium text-slate-500 mt-1 inline-block">{task.model}</span>
              </div>
              <span className="text-[11px] text-slate-400 dark:text-slate-500 flex-shrink-0">esperando...</span>
            </div>
          ))}
        </div>
      )}

      {/* Pending Tab (Interrupted tasks) */}
      {activeTab === 'pending' && (
        <div className="space-y-3">
          {interruptedTasks.length === 0 && (
            <EmptyState
              icon={<CheckCircle2 className="h-10 w-10" />}
              title="No hay tareas pendientes"
              description="Todas las tareas se completaron correctamente. No hay nada que reanudar."
            />
          )}
          {interruptedTasks.length > 0 && (
            <>
              <div className="flex items-center gap-2 px-1">
                <AlertCircle className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  Estas tareas se interrumpieron (servidor reiniciado o rate limit). Podes <strong>reanudar</strong> desde donde quedaron o <strong>descartar</strong>.
                </p>
              </div>
              <div className="rounded-xl bg-white dark:bg-dark-surface border border-slate-200/80 dark:border-slate-700/50 overflow-hidden divide-y divide-slate-100 dark:divide-slate-800">
                {interruptedTasks.map(task => {
                  const stagesCount = task.stages_completed?.length || 0;
                  const totalStages = 7; // max pipeline stages
                  const progress = Math.max(5, (stagesCount / totalStages) * 100);
                  const isRetrying = retryingId === task.task_id;

                  return (
                    <div key={task.task_id} className="p-4">
                      <div className="flex items-start gap-3">
                        {/* Status icon */}
                        <div className="w-9 h-9 rounded-lg bg-yellow-500/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                          <AlertCircle className="h-4 w-4 text-yellow-500" />
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <p className="text-[13px] font-semibold text-slate-900 dark:text-slate-100 truncate">
                            {task.input_prompt}
                          </p>
                          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                            <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-[11px] font-medium text-slate-500">{task.model}</span>
                            {task.last_stage && (
                              <span className="px-2 py-0.5 rounded-md bg-yellow-100 dark:bg-yellow-900/30 text-[11px] font-medium text-yellow-700 dark:text-yellow-400">
                                detenida en: {task.last_stage}
                              </span>
                            )}
                            {stagesCount > 0 && (
                              <span className="text-[11px] text-slate-400">
                                {stagesCount} de ~{totalStages} etapas completadas
                              </span>
                            )}
                            {task.created_at && (
                              <span className="text-[11px] text-slate-400">
                                {formatDistanceToNow(new Date(task.created_at), { addSuffix: true, locale: es })}
                              </span>
                            )}
                          </div>

                          {/* Progress bar */}
                          <div className="mt-2.5 h-1.5 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-yellow-500 rounded-full transition-all"
                              style={{ width: `${progress}%` }}
                            />
                          </div>

                          {/* Stages completed chips */}
                          {task.stages_completed?.length > 0 && (
                            <div className="flex items-center gap-1 mt-2 flex-wrap">
                              {task.stages_completed.map((stage: string) => (
                                <span key={stage} className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400">
                                  {stage}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <button
                            onClick={(e) => handleRetryTask(e, task.task_id)}
                            disabled={isRetrying}
                            className="flex items-center gap-1.5 px-3 py-2 text-[12px] font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors disabled:opacity-50 shadow-sm"
                          >
                            <RotateCcw className={cn('h-3.5 w-3.5', isRetrying && 'animate-spin')} />
                            {isRetrying ? 'Reanudando...' : 'Reanudar'}
                          </button>
                          <button
                            onClick={() => dismissTask.mutate(task.task_id)}
                            className="p-2 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:text-red-400 dark:hover:bg-red-500/10 transition-colors"
                            title="Descartar tarea"
                          >
                            <XCircle className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      )}

      {/* History Tab */}
      {activeTab === 'history' && (
        <div className="space-y-3">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar tareas..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-9 py-2.5 text-sm rounded-xl border border-slate-200 bg-white text-slate-900 placeholder-slate-400 dark:border-slate-700 dark:bg-dark-surface dark:text-slate-100 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition-all"
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          {historyLoading && <Spinner />}
          {filteredHistory.length === 0 && !historyLoading && (
            <EmptyState
              icon={<CheckCircle2 className="h-10 w-10" />}
              title="No hay tareas"
              description={searchQuery ? 'Sin resultados para tu busqueda.' : 'Las tareas finalizadas apareceran aqui.'}
            />
          )}

          {/* Task cards */}
          <div className="rounded-xl bg-white dark:bg-dark-surface border border-slate-200/80 dark:border-slate-700/50 overflow-hidden divide-y divide-slate-100 dark:divide-slate-800">
            {filteredHistory.map(task => {
              const cost = calculateTokenCost(task.total_input_tokens, task.total_output_tokens, task.model);
              const isFailed = !task.success;
              const isRetrying = retryingId === task.task_id;

              return (
                <div
                  key={task.task_id}
                  onClick={() => navigate(`/tasks/${task.task_id}`)}
                  className="flex items-center gap-3 p-3.5 cursor-pointer hover:bg-slate-50 dark:hover:bg-dark-hover transition-colors group"
                >
                  {/* Status icon */}
                  <div className={cn(
                    'w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0',
                    isFailed ? 'bg-red-500/10' : 'bg-green-500/10'
                  )}>
                    {isFailed
                      ? <AlertTriangle className="h-3.5 w-3.5 text-red-500" />
                      : <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                    }
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-medium text-slate-900 dark:text-slate-100 truncate group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                      {task.input_prompt}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[10px] text-slate-400 dark:text-slate-500">
                        {formatDistanceToNow(new Date(task.created_at), { addSuffix: true, locale: es })}
                      </span>
                      <span className="text-[10px] text-slate-300 dark:text-slate-600">·</span>
                      <span className="text-[10px] text-slate-400">{task.model}</span>
                      {task.total_tokens > 0 && (
                        <>
                          <span className="text-[10px] text-slate-300 dark:text-slate-600">·</span>
                          <span className="text-[10px] text-slate-400">{formatTokens(task.total_tokens)}</span>
                        </>
                      )}
                      {cost > 0 && (
                        <>
                          <span className="text-[10px] text-slate-300 dark:text-slate-600">·</span>
                          <span className="text-[10px] text-green-500">{formatCost(cost)}</span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {isFailed && (
                      <button
                        onClick={(e) => handleRetryTask(e, task.task_id)}
                        disabled={isRetrying}
                        className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium rounded-lg bg-blue-500/10 text-blue-600 hover:bg-blue-500/20 dark:text-blue-400 transition-colors disabled:opacity-50"
                      >
                        <RotateCcw className={cn('h-3 w-3', isRetrying && 'animate-spin')} />
                        {isRetrying ? '...' : 'Retry'}
                      </button>
                    )}
                    {isFailed && task.stage_failed && (
                      <span className="text-[10px] text-red-400">{task.stage_failed}</span>
                    )}
                    <div className={cn(
                      'w-1.5 h-1.5 rounded-full flex-shrink-0',
                      isFailed ? 'bg-red-400' : 'bg-green-400'
                    )} />
                    <ChevronRight className="h-3.5 w-3.5 text-slate-300 dark:text-slate-600 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Live View Modal */}
      {liveViewTask && (
        <TaskLiveView
          taskId={liveViewTask.id}
          prompt={liveViewTask.prompt}
          model={liveViewTask.model}
          onClose={() => setLiveViewTask(null)}
        />
      )}
    </div>
  );
}
