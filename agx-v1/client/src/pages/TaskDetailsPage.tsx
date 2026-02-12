import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, MessageSquare, Copy, Check, ChevronDown, ChevronRight, RotateCcw } from 'lucide-react';
import { useTaskDetails, useActiveTasks, useRetryTask } from '@/hooks';
import { Card, Button, Badge, Spinner } from '@/components/common';
import {
  TaskStatusBadge,
  TaskStageProgress,
  TaskChangesTable,
  TaskTestsTable,
  TaskTokenUsage,
  TaskGitInfo,
  TaskLiveView,
} from '@/components/tasks';
import { formatDate, cn } from '@/utils';

// Pipeline stage icons and labels
const PIPELINE_STAGES = [
  { key: 'analyzer', label: 'Analisis' },
  { key: 'locator', label: 'Localizacion' },
  { key: 'planner', label: 'Planificacion' },
  { key: 'implementer', label: 'Implementacion' },
  { key: 'verifier', label: 'Verificacion' },
  { key: 'fixer', label: 'Correcciones' },
  { key: 'git', label: 'Git' },
];

const FAST_STAGES = [
  { key: 'analyzer', label: 'Analisis' },
  { key: 'fast-dev', label: 'Desarrollo' },
  { key: 'fast-finish', label: 'Finalizacion' },
];

export function TaskDetailsPage() {
  const { taskId } = useParams<{ taskId: string }>();
  const navigate = useNavigate();
  const { data, isLoading, error, refetch } = useTaskDetails(taskId!);
  const { data: activeTasksData } = useActiveTasks(true);
  const isTaskActive = activeTasksData?.tasks?.some(t => t.task_id === taskId) ?? false;
  const retryTask = useRetryTask();
  const [liveViewDismissed, setLiveViewDismissed] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isRetrying, setIsRetrying] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    pipeline: true,
    changes: true,
    tests: true,
    git: true,
    tokens: false,
  });

  useEffect(() => { setLiveViewDismissed(false); }, [taskId]);

  const handleLiveViewClose = () => {
    setLiveViewDismissed(true);
    refetch();
  };

  const handleCopyPrompt = async () => {
    if (!data?.task) return;
    await navigator.clipboard.writeText(data.task.input_prompt);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const toggleSection = (key: string) => {
    setExpandedSections(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const handleRetry = async () => {
    if (isRetrying || !taskId) return;
    setIsRetrying(true);
    try {
      const result = await retryTask.mutateAsync(taskId);
      if (result.task_id) {
        navigate(`/tasks/${result.task_id}`);
      }
    } catch (error) {
      console.error('Error retrying task:', error);
    } finally {
      setIsRetrying(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Spinner size="lg" />
      </div>
    );
  }

  if (error || !data?.task) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500 dark:text-dark-text-secondary">No se encontro la task</p>
        <Button variant="secondary" className="mt-4" onClick={() => navigate('/tasks')}>
          Volver al historial
        </Button>
      </div>
    );
  }

  const task = data.task;
  const isFastMode = task.stages?.some(s => s.stage_name === 'fast-dev');
  const pipelineStages = isFastMode ? FAST_STAGES : PIPELINE_STAGES;
  const completedStages = new Set(task.stages?.map(s => s.stage_name) || []);

  return (
    <div className="space-y-6 page-transition">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => navigate('/tasks')}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Volver
        </Button>
      </div>

      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-dark-text mb-2">Detalle de Task</h1>
          <div className="flex items-center gap-3">
            <TaskStatusBadge success={task.success} stageFailed={task.stage_failed} />
            <Badge variant="neutral">{task.model}</Badge>
            <span className="text-sm text-gray-500 dark:text-dark-text-secondary">{formatDate(task.created_at)}</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {!task.success && (
            <Button variant="primary" onClick={handleRetry} disabled={isRetrying} loading={isRetrying}>
              <RotateCcw className="h-4 w-4 mr-2" />
              {isRetrying ? 'Reintentando...' : 'Reintentar'}
            </Button>
          )}
          <Button variant={task.success ? 'primary' : 'secondary'} onClick={() => navigate('/', { state: { continueTaskId: task.task_id } })}>
            <MessageSquare className="h-4 w-4 mr-2" />
            Continuar
          </Button>
        </div>
      </div>

      {/* Visual Pipeline Stepper */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-4 bg-white dark:bg-dark-surface">
        <div className="flex items-center justify-between">
          {pipelineStages.map((stage, i) => {
            const isCompleted = completedStages.has(stage.key);
            const isFailed = task.stage_failed === stage.key;
            return (
              <div key={stage.key} className="flex items-center flex-1">
                <div className="flex flex-col items-center">
                  <div className={cn(
                    'w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-all',
                    isFailed
                      ? 'border-red-500 bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-400'
                      : isCompleted
                        ? 'border-green-500 bg-green-50 text-green-600 dark:bg-green-500/10 dark:text-green-400'
                        : 'border-slate-200 bg-slate-50 text-slate-400 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-500'
                  )}>
                    {isFailed ? '!' : isCompleted ? '\u2713' : i + 1}
                  </div>
                  <span className={cn(
                    'text-[10px] mt-1 font-medium',
                    isCompleted ? 'text-green-600 dark:text-green-400' : isFailed ? 'text-red-600 dark:text-red-400' : 'text-slate-400 dark:text-slate-500'
                  )}>
                    {stage.label}
                  </span>
                </div>
                {i < pipelineStages.length - 1 && (
                  <div className={cn(
                    'flex-1 h-0.5 mx-2 mt-[-12px]',
                    isCompleted ? 'bg-green-300 dark:bg-green-700' : 'bg-slate-200 dark:bg-slate-700'
                  )} />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Prompt with copy button */}
      <Card title="Prompt" actions={
        <button onClick={handleCopyPrompt} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors">
          {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
        </button>
      }>
        <p className="text-gray-700 dark:text-dark-text-secondary whitespace-pre-wrap">{task.input_prompt}</p>
      </Card>

      {task.summary && (
        <Card title="Resumen">
          <p className="text-gray-700 dark:text-dark-text-secondary whitespace-pre-wrap">{task.summary}</p>
        </Card>
      )}

      {task.error_message && (
        <Card title="Error">
          <p className="text-red-600 dark:text-red-400 whitespace-pre-wrap">{task.error_message}</p>
        </Card>
      )}

      {/* Collapsible Pipeline Details */}
      {task.stages && task.stages.length > 0 && (
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-dark-surface overflow-hidden">
          <button
            onClick={() => toggleSection('pipeline')}
            className="w-full flex items-center justify-between p-4 hover:bg-slate-50 dark:hover:bg-dark-hover transition-colors"
          >
            <h3 className="font-semibold text-gray-900 dark:text-dark-text">Pipeline Detallado</h3>
            {expandedSections.pipeline ? <ChevronDown className="h-4 w-4 text-slate-400" /> : <ChevronRight className="h-4 w-4 text-slate-400" />}
          </button>
          {expandedSections.pipeline && (
            <div className="px-4 pb-4">
              <TaskStageProgress stages={task.stages} />
              <div className="mt-4 overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-dark-border">
                  <thead className="bg-gray-50 dark:bg-dark-hover">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-dark-text-secondary uppercase">Etapa</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-dark-text-secondary uppercase">Estado</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-dark-text-secondary uppercase">Duracion</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-dark-text-secondary uppercase">Tokens</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white dark:bg-dark-surface divide-y divide-gray-200 dark:divide-dark-border">
                    {task.stages.map((stage) => (
                      <tr key={stage.stage_name} className="stagger-item">
                        <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-dark-text capitalize">{stage.stage_name}</td>
                        <td className="px-4 py-3">
                          <Badge variant={stage.success ? 'success' : 'error'}>{stage.success ? 'OK' : 'Error'}</Badge>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-500 dark:text-dark-text-secondary">
                          {stage.duration_ms ? `${(stage.duration_ms / 1000).toFixed(1)}s` : '-'}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <span className="text-sm text-gray-500 dark:text-dark-text-secondary">
                              {(stage.input_tokens + stage.output_tokens).toLocaleString()}
                            </span>
                            <div className="w-20 h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-blue-500 rounded-full"
                                style={{ width: `${Math.min(100, ((stage.input_tokens + stage.output_tokens) / Math.max(1, task.total_tokens)) * 100)}%` }}
                              />
                            </div>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {task.changes && task.changes.length > 0 && (
        <Card title="Cambios">
          <TaskChangesTable changes={task.changes} />
        </Card>
      )}

      {task.tests && task.tests.length > 0 && (
        <Card title="Tests">
          <TaskTestsTable tests={task.tests} />
        </Card>
      )}

      <Card title="Git">
        <TaskGitInfo
          branch={task.git_branch}
          commitSha={task.git_commit_sha}
          commitMessage={task.git_commit_message}
          prUrl={task.git_pr_url}
          repoUrl={task.repo_url}
          reposJson={task.repos_json}
        />
      </Card>

      {/* Collapsible Tokens */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-dark-surface overflow-hidden">
        <button
          onClick={() => toggleSection('tokens')}
          className="w-full flex items-center justify-between p-4 hover:bg-slate-50 dark:hover:bg-dark-hover transition-colors"
        >
          <h3 className="font-semibold text-gray-900 dark:text-dark-text">
            Tokens y Costo
            <span className="ml-2 text-sm font-normal text-slate-400">{task.total_tokens?.toLocaleString()} total</span>
          </h3>
          {expandedSections.tokens ? <ChevronDown className="h-4 w-4 text-slate-400" /> : <ChevronRight className="h-4 w-4 text-slate-400" />}
        </button>
        {expandedSections.tokens && (
          <div className="px-4 pb-4">
            <TaskTokenUsage
              totalTokens={task.total_tokens}
              inputTokens={task.total_input_tokens}
              outputTokens={task.total_output_tokens}
              model={task.model}
            />
          </div>
        )}
      </div>

      {/* Live view */}
      {isTaskActive && !liveViewDismissed && (
        <TaskLiveView
          taskId={taskId!}
          prompt={task.input_prompt}
          model={task.model}
          onClose={handleLiveViewClose}
        />
      )}
    </div>
  );
}
