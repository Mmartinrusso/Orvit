import { useEffect, useState, useRef, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { TaskLogEntry, PipelineStage, SSETaskUpdate } from '@/api';
import { apiClient } from '@/api/client';

export interface TaskStreamState {
  isConnected: boolean;
  currentStage: PipelineStage | null;
  stagesCompleted: PipelineStage[];
  logs: TaskLogEntry[];
  isActive: boolean;
  error: string | null;
}

/**
 * Hook para conectarse al stream SSE de una tarea
 * Recibe actualizaciones en tiempo real del backend
 */
export function useTaskSSE(taskId: string | null, enabled: boolean = true) {
  const [state, setState] = useState<TaskStreamState>({
    isConnected: false,
    currentStage: null,
    stagesCompleted: [],
    logs: [],
    isActive: true,
    error: null,
  });

  const eventSourceRef = useRef<EventSource | null>(null);
  const queryClient = useQueryClient();
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectAttempts = useRef(0);
  const isActiveRef = useRef(true);
  const isMountedRef = useRef(true);
  const MAX_RECONNECT_ATTEMPTS = 5;

  // Guard against setState after unmount
  useEffect(() => {
    isMountedRef.current = true;
    return () => { isMountedRef.current = false; };
  }, []);

  // Reset state when taskId changes
  useEffect(() => {
    setState({
      isConnected: false,
      currentStage: null,
      stagesCompleted: [],
      logs: [],
      isActive: true,
      error: null,
    });
    reconnectAttempts.current = 0;
    isActiveRef.current = true;
  }, [taskId]);

  const cleanup = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!taskId || !enabled) {
      cleanup();
      setState(prev => ({ ...prev, isConnected: false }));
      return;
    }

    const connect = () => {
      // Construir URL del stream (same origin, no auth needed)
      const baseURL = apiClient.defaults.baseURL || '';
      const streamUrl = `${baseURL}/api/tasks/${taskId}/stream`;

      console.log('[SSE] Connecting to:', streamUrl);

      try {
        const eventSource = new EventSource(streamUrl);
        eventSourceRef.current = eventSource;

        eventSource.onopen = () => {
          console.log('[SSE] Connection opened');
          reconnectAttempts.current = 0;
          if (isMountedRef.current) {
            setState(prev => ({ ...prev, isConnected: true, error: null }));
          }
        };

        eventSource.onerror = (error) => {
          console.error('[SSE] Connection error:', error);

          // Check if task is still active before attempting reconnect
          if (!isActiveRef.current) {
            // Task completed, no need to reconnect
            cleanup();
            return;
          }

          if (isMountedRef.current) {
            setState(prev => ({
              ...prev,
              isConnected: false,
            }));
          }

          // Close current connection
          eventSource.close();
          eventSourceRef.current = null;

          // Attempt reconnect with exponential backoff
          if (reconnectAttempts.current < MAX_RECONNECT_ATTEMPTS) {
            reconnectAttempts.current++;
            const delay = Math.min(1000 * Math.pow(2, reconnectAttempts.current), 30000);
            console.log(`[SSE] Reconnecting in ${delay}ms (attempt ${reconnectAttempts.current}/${MAX_RECONNECT_ATTEMPTS})`);

            reconnectTimeoutRef.current = setTimeout(() => {
              connect();
            }, delay);
          } else {
            if (isMountedRef.current) {
              setState(prev => ({
                ...prev,
                error: 'Connection lost. Max reconnection attempts reached.',
              }));
            }
          }
        };

        // Escuchar mensajes del servidor
        eventSource.onmessage = (event) => {
          try {
            // Ignore heartbeat comments (lines starting with :)
            if (event.data.startsWith(':') || !event.data.trim()) {
              return;
            }

            const update: SSETaskUpdate = JSON.parse(event.data);
            console.log('[SSE] Received event:', update.type, update.data);

            if (!isMountedRef.current) return;

            setState(prev => {
              const newState = { ...prev };

              switch (update.type) {
                case 'stage_start':
                  if (update.data.stage) {
                    newState.currentStage = update.data.stage;
                    newState.logs = [
                      ...prev.logs,
                      {
                        timestamp: update.timestamp,
                        stage: update.data.stage,
                        type: 'stage_start',
                        message: update.data.message || `Iniciando etapa: ${update.data.stage}`,
                      },
                    ];
                  }
                  break;

                case 'stage_end':
                  if (update.data.stage) {
                    // Add to completed stages if not already there
                    if (!prev.stagesCompleted.includes(update.data.stage)) {
                      newState.stagesCompleted = [...prev.stagesCompleted, update.data.stage];
                    }
                    newState.logs = [
                      ...prev.logs,
                      {
                        timestamp: update.timestamp,
                        stage: update.data.stage,
                        type: 'stage_end',
                        message: update.data.message || `Etapa ${update.data.stage} completada`,
                      },
                    ];
                  }
                  break;

                case 'log_entry':
                  // Handle log entries - support both 'log' and 'message' fields
                  const logMessage = update.data.log || update.data.message;
                  if (logMessage) {
                    newState.logs = [
                      ...prev.logs,
                      {
                        timestamp: update.timestamp,
                        stage: update.data.stage || prev.currentStage || 'analyzer',
                        type: 'info',
                        message: logMessage,
                      },
                    ];
                  }
                  break;

                case 'task_completed':
                  newState.isActive = false;
                  isActiveRef.current = false;
                  newState.logs = [
                    ...prev.logs,
                    {
                      timestamp: update.timestamp,
                      stage: prev.currentStage || 'git',
                      type: 'info',
                      message: update.data.message || 'Task completada exitosamente',
                    },
                  ];
                  // Invalidar queries relacionadas
                  queryClient.invalidateQueries({ queryKey: ['tasks', 'active'] });
                  queryClient.invalidateQueries({ queryKey: ['tasks', 'history'] });
                  queryClient.invalidateQueries({ queryKey: ['tasks', 'stats'] });
                  queryClient.invalidateQueries({ queryKey: ['tasks', 'queue'] });
                  // Close the connection since task is done
                  cleanup();
                  break;

                case 'task_failed':
                  newState.isActive = false;
                  isActiveRef.current = false;
                  newState.error = update.data.error || update.data.message || 'Task failed';
                  newState.logs = [
                    ...prev.logs,
                    {
                      timestamp: update.timestamp,
                      stage: prev.currentStage || 'analyzer',
                      type: 'error',
                      message: update.data.message || update.data.error || 'Task finalizada con errores',
                    },
                  ];
                  // Invalidar queries relacionadas
                  queryClient.invalidateQueries({ queryKey: ['tasks', 'active'] });
                  queryClient.invalidateQueries({ queryKey: ['tasks', 'history'] });
                  queryClient.invalidateQueries({ queryKey: ['tasks', 'stats'] });
                  queryClient.invalidateQueries({ queryKey: ['tasks', 'queue'] });
                  // Close the connection since task is done
                  cleanup();
                  break;

                case 'error':
                  newState.error = update.data.error || 'Unknown error';
                  newState.logs = [
                    ...prev.logs,
                    {
                      timestamp: update.timestamp,
                      stage: prev.currentStage || 'analyzer',
                      type: 'error',
                      message: update.data.error || 'Error occurred',
                    },
                  ];
                  break;

                case 'heartbeat':
                  // Heartbeat solo para mantener la conexión viva
                  // No update state, just acknowledge
                  console.log('[SSE] Heartbeat received');
                  break;

                default:
                  console.warn('[SSE] Unknown event type:', (update as any).type);
              }

              return newState;
            });
          } catch (error) {
            console.error('[SSE] Error parsing message:', error, 'Raw data:', event.data);
          }
        };
      } catch (error) {
        console.error('[SSE] Error creating EventSource:', error);
        if (isMountedRef.current) {
          setState(prev => ({
            ...prev,
            error: 'Failed to create SSE connection',
            isConnected: false,
          }));
        }
      }
    };

    connect();

    return cleanup;
  }, [taskId, enabled, queryClient, cleanup]);

  return state;
}
