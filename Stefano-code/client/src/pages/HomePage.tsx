import { useNavigate } from 'react-router-dom';
import { GitBranch, Bug, TestTube, RefreshCw, Eye, FileText, Gauge, Activity, CheckCircle2, XCircle, Clock, Coins, TrendingUp, Zap, ArrowRight, Sparkles } from 'lucide-react';
import { TaskCreator } from '@/components/tasks/TaskCreator';
import { useProject } from '@/hooks/useProject';
import { useActiveTasks } from '@/hooks/useTasks';
import { useQuickAction } from '@/hooks/useQuickAction';
import { useTasks } from '@/hooks/useTasks';
import { cn, formatTokens } from '@/utils';
import { useMemo } from 'react';

export function HomePage() {
  const navigate = useNavigate();
  const { data: projectData } = useProject();
  const { data: activeTasksData } = useActiveTasks();
  const { data: taskHistory } = useTasks(20);
  const quickAction = useQuickAction();

  const project = projectData?.project;
  const activeTasks = activeTasksData?.tasks || [];
  const allTasks = taskHistory?.tasks || [];
  const recentTasks = allTasks.slice(0, 12);

  const stats = useMemo(() => {
    const total = allTasks.length;
    const succeeded = allTasks.filter(t => t.success).length;
    const rate = total > 0 ? Math.round((succeeded / total) * 100) : 0;
    const totalTokens = allTasks.reduce((sum, t) => sum + (t.total_tokens || 0), 0);
    return { total, succeeded, rate, totalTokens };
  }, [allTasks]);

  const handleQuickAction = (action: string) => {
    quickAction.mutate({ action: action as any });
  };

  const quickActions = [
    { action: 'fix', icon: Bug, label: 'Fix Bug', bg: 'bg-red-500' },
    { action: 'test', icon: TestTube, label: 'Tests', bg: 'bg-green-500' },
    { action: 'refactor', icon: RefreshCw, label: 'Refactor', bg: 'bg-blue-500' },
    { action: 'review', icon: Eye, label: 'Review', bg: 'bg-gray-600' },
    { action: 'docs', icon: FileText, label: 'Docs', bg: 'bg-yellow-500' },
    { action: 'optimize', icon: Gauge, label: 'Optimize', bg: 'bg-blue-600' },
  ];

  return (
    <div className="space-y-6 page-transition">
      {/* Project Header */}
      {project && (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-blue-600 flex items-center justify-center shadow-md shadow-blue-500/15">
              <span className="text-white font-bold text-sm">{project.name?.charAt(0)?.toUpperCase() || 'P'}</span>
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">{project.name}</h1>
              <div className="flex items-center gap-2 mt-0.5">
                {project.gitBranch && (
                  <span className="inline-flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
                    <GitBranch className="h-3 w-3" />
                    {project.gitBranch}
                  </span>
                )}
                {project.gitStatus.modified > 0 && (
                  <span className="text-xs text-yellow-600 dark:text-yellow-400">{project.gitStatus.modified} modified</span>
                )}
                {project.gitStatus.untracked > 0 && (
                  <span className="text-xs text-slate-400">{project.gitStatus.untracked} untracked</span>
                )}
              </div>
            </div>
          </div>
          {project.techStack.length > 0 && (
            <div className="flex gap-1.5">
              {project.techStack.slice(0, 5).map(tech => (
                <span key={tech} className="px-2.5 py-1 bg-white dark:bg-dark-surface rounded-lg text-xs font-medium text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
                  {tech}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Task Creator */}
      <TaskCreator />

      {/* Quick Actions Row */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        <span className="text-[11px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider mr-1 flex-shrink-0">Rapido</span>
        {quickActions.map(({ action, icon: Icon, label, bg }) => (
          <button
            key={action}
            onClick={() => handleQuickAction(action)}
            disabled={quickAction.isPending}
            className="group flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white dark:bg-dark-surface border border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 hover:shadow-sm transition-all duration-150 text-xs font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 flex-shrink-0"
          >
            <div className={cn('w-4 h-4 rounded flex items-center justify-center', bg)}>
              <Icon className="h-2.5 w-2.5 text-white" strokeWidth={2} />
            </div>
            {label}
          </button>
        ))}
      </div>

      {/* Stats + Activity Grid */}
      <div className="grid grid-cols-1 xl:grid-cols-4 gap-5">
        {/* Stats Column */}
        <div className="xl:col-span-1 grid grid-cols-2 xl:grid-cols-1 gap-3">
          {[
            { label: 'Total', value: stats.total, icon: Activity, color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-500/10' },
            { label: 'Exitosas', value: stats.succeeded, icon: CheckCircle2, color: 'text-green-600 dark:text-green-400', bg: 'bg-green-500/10' },
            { label: 'Tasa Exito', value: `${stats.rate}%`, icon: TrendingUp, color: 'text-gray-600 dark:text-gray-400', bg: 'bg-gray-500/10' },
            { label: 'Tokens', value: formatTokens(stats.totalTokens), icon: Coins, color: 'text-yellow-600 dark:text-yellow-400', bg: 'bg-yellow-500/10' },
          ].map((stat) => (
            <div key={stat.label} className="rounded-xl bg-white dark:bg-dark-surface border border-slate-200/80 dark:border-slate-700/50 p-3.5 hover:shadow-sm transition-shadow">
              <div className="flex items-center gap-3">
                <div className={cn('p-1.5 rounded-lg', stat.bg)}>
                  <stat.icon className={cn('h-4 w-4', stat.color)} strokeWidth={1.5} />
                </div>
                <div>
                  <p className={cn('text-lg font-bold tabular-nums leading-none', stat.color)}>{stat.value}</p>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1 uppercase tracking-wider">{stat.label}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Activity Timeline */}
        <div className="xl:col-span-3 rounded-xl bg-white dark:bg-dark-surface border border-slate-200/80 dark:border-slate-700/50 overflow-hidden flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-2.5">
              <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-200">Actividad Reciente</h2>
              {activeTasks.length > 0 && (
                <span className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-blue-500/10 text-blue-600 dark:text-blue-400 text-[11px] font-semibold">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
                  {activeTasks.length} activa{activeTasks.length > 1 ? 's' : ''}
                </span>
              )}
            </div>
            <button onClick={() => navigate('/tasks')} className="flex items-center gap-1 text-xs text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors font-medium">
              Ver todo
              <ArrowRight className="h-3 w-3" />
            </button>
          </div>

          {/* Task List */}
          <div className="flex-1 overflow-y-auto">
            {recentTasks.length === 0 && !activeTasks.length && (
              <div className="py-12 text-center">
                <Sparkles className="h-8 w-8 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
                <p className="text-sm text-slate-400 dark:text-slate-500">No hay actividad reciente</p>
                <p className="text-xs text-slate-400 dark:text-slate-600 mt-1">Crea una tarea para comenzar</p>
              </div>
            )}

            {/* Active tasks */}
            {activeTasks.map((task, i) => (
              <button
                key={task.task_id}
                onClick={() => navigate(`/tasks/${task.task_id}`)}
                className={cn(
                  'w-full flex items-center gap-3 py-3 px-5 hover:bg-blue-50/50 dark:hover:bg-blue-500/5 transition-colors text-left',
                  i > 0 && 'border-t border-slate-50 dark:border-slate-800/50'
                )}
              >
                <div className="relative flex-shrink-0">
                  <div className="w-8 h-8 rounded-lg bg-blue-500/10 dark:bg-blue-500/15 flex items-center justify-center">
                    <Zap className="h-4 w-4 text-blue-500" />
                  </div>
                  <div className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-blue-500 border-2 border-white dark:border-dark-surface animate-pulse" />
                </div>
                <div className="flex-1 min-w-0">
                  <span className="text-sm text-slate-900 dark:text-slate-200 truncate block font-medium">{task.prompt}</span>
                  <span className="text-[11px] text-blue-500 dark:text-blue-400 font-medium">
                    {new Date(task.started_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-blue-500/10 text-blue-600 dark:text-blue-400 text-[11px] font-semibold flex-shrink-0">
                  <Clock className="h-3 w-3 animate-pulse" />
                  ejecutando
                </span>
              </button>
            ))}

            {/* Recent completed tasks */}
            {recentTasks.map((task, i) => (
              <button
                key={task.task_id}
                onClick={() => navigate(`/tasks/${task.task_id}`)}
                className={cn(
                  'w-full flex items-center gap-3 py-2.5 px-5 hover:bg-slate-50 dark:hover:bg-dark-hover transition-colors text-left group',
                  (i > 0 || activeTasks.length > 0) && 'border-t border-slate-50 dark:border-slate-800/50'
                )}
              >
                <div className="flex-shrink-0">
                  {task.success ? (
                    <div className="w-7 h-7 rounded-lg bg-green-500/10 flex items-center justify-center">
                      <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                    </div>
                  ) : (
                    <div className="w-7 h-7 rounded-lg bg-red-500/10 flex items-center justify-center">
                      <XCircle className="h-3.5 w-3.5 text-red-500" />
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <span className="text-[13px] text-slate-600 dark:text-slate-300 truncate block group-hover:text-slate-900 dark:group-hover:text-slate-100 transition-colors">{task.input_prompt}</span>
                </div>
                <span className="text-[11px] text-slate-400 dark:text-slate-500 tabular-nums flex-shrink-0">
                  {new Date(task.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
                {task.total_tokens > 0 && (
                  <span className="text-[10px] text-slate-400 dark:text-slate-500 flex-shrink-0">{formatTokens(task.total_tokens)}</span>
                )}
                <div className={cn(
                  'w-1.5 h-1.5 rounded-full flex-shrink-0',
                  task.success ? 'bg-green-400' : 'bg-red-400'
                )} />
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
