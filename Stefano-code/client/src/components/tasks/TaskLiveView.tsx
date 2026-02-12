import React, { useEffect, useRef } from 'react';
import { X, Clock, GitBranch, Loader2, CheckCircle, XCircle, Info, Terminal, Copy, Check } from 'lucide-react';
import type { TaskLogEntry, PipelineStage } from '@/api';
import { useTaskSSE } from '@/hooks/useTaskSSE';
import { Badge, Button, Spinner } from '@/components/common';
import { formatDuration } from '@/utils';
import { cn } from '@/utils';

interface TaskLiveViewProps {
  taskId: string;
  prompt: string;
  model: string;
  onClose: () => void;
}

const STAGE_LABELS: Record<PipelineStage, string> = {
  analyzer: 'Analizador',
  locator: 'Localizador',
  planner: 'Planificador',
  implementer: 'Implementador',
  verifier: 'Verificador',
  fixer: 'Corrector',
  git: 'Git',
  'fast-dev': 'Fast Dev',
  'fast-finish': 'Fast Finish',
  simple: 'Simple',
};

function getLogIcon(type: TaskLogEntry['type']) {
  switch (type) {
    case 'stage_start':
      return <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />;
    case 'stage_end':
      return <CheckCircle className="h-4 w-4 text-green-500" />;
    case 'error':
      return <XCircle className="h-4 w-4 text-red-500" />;
    case 'output':
      return <Terminal className="h-4 w-4 text-purple-500" />;
    default:
      return <Info className="h-4 w-4 text-gray-400" />;
  }
}

function getLogTypeColor(type: TaskLogEntry['type']) {
  switch (type) {
    case 'stage_start':
      return 'bg-blue-950/50 border-blue-800/40';
    case 'stage_end':
      return 'bg-green-950/50 border-green-800/40';
    case 'error':
      return 'bg-red-950/50 border-red-800/40';
    case 'output':
      return 'bg-purple-950/50 border-purple-800/40';
    default:
      return 'bg-gray-800/50 border-gray-700/40';
  }
}

// Format data key for display (snake_case to readable)
function formatDataKey(key: string): string {
  return key
    .replace(/_/g, ' ')
    .replace(/\b\w/g, char => char.toUpperCase());
}

// Render data value based on type
function renderDataValue(value: unknown): React.ReactNode {
  if (value === null || value === undefined) {
    return <span className="text-gray-500">-</span>;
  }

  if (typeof value === 'boolean') {
    return <span className={value ? 'text-green-400' : 'text-red-400'}>{value ? 'Si' : 'No'}</span>;
  }

  if (typeof value === 'number') {
    return <span className="text-blue-400">{value}</span>;
  }

  if (typeof value === 'string') {
    // Truncate long strings
    if (value.length > 100) {
      return (
        <details className="inline">
          <summary className="cursor-pointer text-gray-400 hover:text-gray-200">
            {value.substring(0, 100)}...
          </summary>
          <pre className="mt-1 p-2 bg-gray-800 rounded text-gray-300 whitespace-pre-wrap">
            {value}
          </pre>
        </details>
      );
    }
    return <span className="text-gray-300">{value}</span>;
  }

  if (Array.isArray(value)) {
    if (value.length === 0) {
      return <span className="text-gray-500">(vacio)</span>;
    }
    // Check if it's an array of simple items or objects
    if (typeof value[0] === 'object') {
      return (
        <details className="mt-1">
          <summary className="cursor-pointer text-gray-400 hover:text-gray-200">
            {value.length} items
          </summary>
          <div className="mt-1 space-y-1 pl-2 border-l-2 border-gray-700">
            {value.map((item, idx) => (
              <div key={idx} className="text-xs text-gray-400">
                {typeof item === 'object' ? (
                  <div className="bg-gray-800/50 rounded p-1">
                    {Object.entries(item as Record<string, unknown>).map(([k, v]) => (
                      <div key={k}>
                        <span className="font-medium">{formatDataKey(k)}:</span> {String(v)}
                      </div>
                    ))}
                  </div>
                ) : (
                  String(item)
                )}
              </div>
            ))}
          </div>
        </details>
      );
    }
    // Simple array
    return (
      <span className="text-gray-300">
        {value.length <= 3 ? value.join(', ') : `${value.slice(0, 3).join(', ')} (+${value.length - 3} mas)`}
      </span>
    );
  }

  if (typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>);
    if (entries.length === 0) {
      return <span className="text-gray-500">(vacio)</span>;
    }
    return (
      <details className="mt-1">
        <summary className="cursor-pointer text-gray-400 hover:text-gray-200">
          Ver objeto
        </summary>
        <div className="mt-1 pl-2 border-l-2 border-gray-700">
          {entries.map(([k, v]) => (
            <div key={k} className="text-xs">
              <span className="font-medium text-gray-400">{formatDataKey(k)}:</span> {renderDataValue(v)}
            </div>
          ))}
        </div>
      </details>
    );
  }

  return <span className="text-gray-300">{String(value)}</span>;
}

export function TaskLiveView({ taskId, prompt, model, onClose }: TaskLiveViewProps) {
  const sseState = useTaskSSE(taskId, true);
  const logsEndRef = useRef<HTMLDivElement>(null);
  const startTimeRef = useRef<number>(Date.now());
  const [copied, setCopied] = React.useState(false);

  // Escape key to close + body scroll lock
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleEscape);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'unset';
    };
  }, [onClose]);

  // Auto-scroll to bottom when new logs arrive
  useEffect(() => {
    if (logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [sseState.logs]);

  const isActive = sseState.isActive;
  const currentStage = sseState.currentStage;
  const stagesCompleted = sseState.stagesCompleted;
  const runningTime = Date.now() - startTimeRef.current;
  const logs = sseState.logs;
  const isConnected = sseState.isConnected;
  const connectionError = sseState.error;

  // Determine which stages to show based on pipeline mode
  const isFastMode = stagesCompleted.includes('fast-dev') || currentStage === 'fast-dev' || currentStage === 'fast-finish';
  const pipelineStages: PipelineStage[] = isFastMode
    ? ['analyzer', 'fast-dev', 'fast-finish']
    : ['analyzer', 'locator', 'planner', 'implementer', 'verifier', 'fixer', 'git'];

  const completedCount = pipelineStages.filter(s => stagesCompleted.includes(s)).length;
  const progressPercent = pipelineStages.length > 0 ? Math.round((completedCount / pipelineStages.length) * 100) : 0;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white dark:bg-dark-surface rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 dark:border-dark-border flex items-start justify-between">
          <div className="flex-1 min-w-0 mr-4">
            <div className="flex items-center gap-3 mb-2">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-dark-text">Task en Progreso</h2>
              {isActive ? (
                <Badge variant="warning" className="animate-pulse">En ejecucion</Badge>
              ) : (
                <Badge variant="success">Completada</Badge>
              )}
            </div>
            <p className="text-sm text-gray-600 dark:text-dark-text-secondary truncate">{prompt}</p>
            <div className="flex items-center gap-4 mt-2 text-xs text-gray-500 dark:text-dark-text-secondary">
              <span className="flex items-center gap-1">
                <Badge variant="neutral">{model}</Badge>
              </span>
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {formatDuration(runningTime)}
              </span>
              {currentStage && (
                <span className="flex items-center gap-1">
                  <GitBranch className="h-3 w-3" />
                  {STAGE_LABELS[currentStage] || currentStage}
                </span>
              )}
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="h-5 w-5" />
          </Button>
        </div>

        {/* Progress bar */}
        <div className="px-6 py-3 bg-gray-50 dark:bg-dark-hover border-b border-gray-200 dark:border-dark-border space-y-2">
          {/* Percentage bar */}
          <div className="flex items-center gap-3">
            <div className="flex-1 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-emerald-500 to-cyan-500 rounded-full transition-all duration-500"
                style={{ width: `${isActive ? Math.max(progressPercent, 5) : 100}%` }}
              />
            </div>
            <span className="text-xs font-medium text-gray-500 dark:text-dark-text-secondary w-8 text-right">
              {isActive ? `${progressPercent}%` : '100%'}
            </span>
          </div>
          {/* Stage pills - show ALL stages */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            {pipelineStages.map((stage) => {
              const isCompleted = stagesCompleted.includes(stage);
              const isCurrent = stage === currentStage;
              const isUpcoming = !isCompleted && !isCurrent;

              return (
                <div
                  key={stage}
                  className={cn(
                    'flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-all duration-300',
                    isCompleted && 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400',
                    isCurrent && !isCompleted && 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400',
                    isUpcoming && 'bg-gray-100 text-gray-400 dark:bg-gray-800/50 dark:text-gray-600'
                  )}
                >
                  {isCompleted && <CheckCircle className="h-3 w-3" />}
                  {isCurrent && !isCompleted && <Loader2 className="h-3 w-3 animate-spin" />}
                  {STAGE_LABELS[stage] || stage}
                </div>
              );
            })}
          </div>
        </div>

        {/* Logs */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2 bg-gray-900">
          {!isConnected && logs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8">
              <Spinner size="lg" />
              <p className="text-gray-400 mt-2">Conectando al stream...</p>
            </div>
          ) : connectionError ? (
            <div className="text-red-400 text-center py-8">
              Error de conexión: {connectionError}
            </div>
          ) : logs.length === 0 ? (
            <div className="text-gray-400 text-center py-8">
              Esperando logs...
            </div>
          ) : (
            logs.map((log, index) => (
              <div
                key={index}
                className={cn(
                  'rounded-lg border p-3',
                  getLogTypeColor(log.type)
                )}
              >
                <div className="flex items-start gap-3">
                  <div className="mt-0.5">
                    {getLogIcon(log.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-mono text-gray-500">
                        {new Date(log.timestamp).toLocaleTimeString()}
                      </span>
                      <Badge variant="neutral" className="text-xs">
                        {STAGE_LABELS[log.stage] || log.stage}
                      </Badge>
                    </div>
                    <p className={cn(
                      'text-sm',
                      log.type === 'error' ? 'text-red-300' :
                      log.type === 'stage_start' ? 'text-green-300' :
                      log.type === 'output' ? 'text-cyan-300' :
                      log.type === 'stage_end' ? 'text-green-400' :
                      'text-gray-200'
                    )}>{log.message}</p>
                    {log.data && Object.keys(log.data).length > 0 && (
                      <div className="mt-2 space-y-1">
                        {Object.entries(log.data).map(([key, value]) => (
                          <div key={key} className="text-xs">
                            <span className="font-medium text-gray-400">{formatDataKey(key)}:</span>{' '}
                            {renderDataValue(value)}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
          <div ref={logsEndRef} />
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-gray-200 dark:border-dark-border flex items-center justify-between bg-gray-50 dark:bg-dark-hover">
          <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-dark-text-secondary">
            <span>{logs.length} logs</span>
            <span className="flex items-center gap-1.5">
              <div className={cn(
                "w-2 h-2 rounded-full",
                isConnected ? "bg-green-500 animate-pulse" : "bg-red-500"
              )} />
              {isConnected ? 'Conectado (SSE)' : 'Desconectado'}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                const logText = logs.map(l =>
                  `[${new Date(l.timestamp).toLocaleTimeString()}] [${l.stage}] ${l.message}`
                ).join('\n');
                navigator.clipboard.writeText(logText);
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
              }}
            >
              {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
              <span className="ml-1">{copied ? 'Copiado' : 'Copiar'}</span>
            </Button>
            <Button variant="secondary" size="sm" onClick={onClose}>
              Cerrar
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
