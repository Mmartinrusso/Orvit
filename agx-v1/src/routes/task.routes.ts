import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { runPipeline, resumePipeline } from '../services/orchestrator.js';

import { createChildLogger } from '../utils/logger.js';
import { isDatabaseEnabled } from '../services/database.js';
import { getTaskHistory, getTaskById, getTaskStats } from '../repositories/task-history.repository.js';
import { getInterruptedTasks, getCheckpoints, updateTaskStatus } from '../services/task-persistence.js';
import { getActiveTasks, cancelTask, getActiveTask, getActiveTaskCount, getTaskLogs, taskEvents } from '../services/task-tracker.js';
import { getQueuedTasks, removeFromQueue, isTaskQueued, getQueueLength } from '../services/task-queue.js';
import type { TaskRequest, TaskResponse, ModelType } from '../types/index.js';
import { config } from '../config.js';
import { recommendPipeline } from '../services/agent-recommender.js';
import { enhancePrompt } from '../services/prompt-enhancer.js';
import type { ExpertMode } from '../types/index.js';

const logger = createChildLogger('task-routes');

const taskRequestSchema = z.object({
  prompt: z.string().min(1, 'Prompt is required').max(10000, 'Prompt is too long (max 10000 chars)'),
  model: z.enum(['sonnet', 'opus', 'haiku']).optional(),
  auto_commit: z.boolean().optional().default(true),
  create_pr: z.boolean().optional().default(false),
  create_branch: z.boolean().optional().default(true),
  pipeline_mode: z.enum(['full', 'fast', 'auto']).optional().default('auto'),
  continue_task_id: z.string().optional(),
  expert_mode: z.enum(['general', 'frontend', 'backend', 'fullstack', 'testing', 'devops', 'security']).optional().default('general'),
});

type TaskRequestBody = z.infer<typeof taskRequestSchema>;

export async function taskRoutes(fastify: FastifyInstance): Promise<void> {
  // Health check endpoint (no auth required)
  fastify.get('/health', async (_request, reply) => {
    reply.send({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // Pipeline recommendation endpoint
  fastify.post<{ Body: { prompt: string; repo_url?: string } }>(
    '/api/task/recommend',
    async (request, reply) => {
      const { prompt } = request.body;
      if (!prompt || typeof prompt !== 'string') {
        return reply.code(400).send({ success: false, error: 'prompt is required' });
      }
      const recommendation = recommendPipeline(prompt);
      return reply.send({ success: true, ...recommendation });
    }
  );

  // Enhance prompt endpoint
  fastify.post<{ Body: { prompt: string; expert_mode?: ExpertMode } }>(
    '/api/task/enhance-prompt',
    async (request, reply) => {
      const { prompt, expert_mode } = request.body;
      if (!prompt || typeof prompt !== 'string') {
        return reply.code(400).send({ success: false, error: 'prompt is required' });
      }
      try {
        const result = await enhancePrompt(prompt, expert_mode);
        return reply.send({ success: true, ...result });
      } catch (error) {
        // Graceful fallback - return original prompt if enhancement fails
        logger.warn({ error }, 'Failed to enhance prompt, returning original');
        return reply.send({
          success: true,
          enhanced_prompt: prompt,
          improvements: [],
          estimated_complexity: 'medium',
          fallback: true,  // Indicate this is the original prompt
        });
      }
    }
  );

  // Main task endpoint
  fastify.post<{ Body: TaskRequestBody }>(
    '/api/task',
    async (request: FastifyRequest<{ Body: TaskRequestBody }>, reply: FastifyReply) => {
      // Validate request body
      const parseResult = taskRequestSchema.safeParse(request.body);

      if (!parseResult.success) {
        logger.warn({ errors: parseResult.error.issues }, 'Invalid request body');
        reply.code(400).send({
          success: false,
          error: 'Invalid request body',
          details: parseResult.error.issues,
        });
        return;
      }

      const taskRequest: TaskRequest = parseResult.data;

      logger.info(
        { prompt: taskRequest.prompt.substring(0, 100) },
        'Received task request'
      );

      try {
        const response: TaskResponse = await runPipeline(taskRequest);

        if (response.success) {
          reply.code(200).send(response);
        } else {
          reply.code(500).send(response);
        }
      } catch (error) {
        logger.error({ error }, 'Unexpected error in task endpoint');

        reply.code(500).send({
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }
  );

  // Get task history (requires database)
  fastify.get<{ Querystring: { limit?: string } }>(
    '/api/tasks',
    async (request, reply) => {
      if (!isDatabaseEnabled()) {
        reply.code(503).send({
          success: false,
          error: 'Database not enabled. Set DB_ENABLED=true in .env to use this endpoint.',
        });
        return;
      }

      const limit = request.query.limit ? parseInt(request.query.limit, 10) : 50;

      try {
        const tasks = await getTaskHistory(limit);
        reply.send({
          success: true,
          tasks,
        });
      } catch (error) {
        logger.error({ error }, 'Failed to get task history');
        reply.code(500).send({
          success: false,
          error: 'Failed to retrieve task history',
        });
      }
    }
  );

  // Get active/in-progress tasks (in-memory, no database required)
  // NOTE: Must be registered BEFORE /api/tasks/:taskId to avoid route conflict
  fastify.get(
    '/api/tasks/active',
    async (_request, reply) => {
      const activeTasks = getActiveTasks();

      reply.send({
        success: true,
        count: activeTasks.length,
        max_concurrent: config.maxConcurrentTasks,
        tasks: activeTasks.map(task => ({
          task_id: task.taskId,
          prompt: task.prompt,
          model: task.model,
          current_stage: task.currentStage,
          stages_completed: task.stagesCompleted,
          started_at: task.startedAt.toISOString(),
          running_time_ms: Date.now() - task.startedAt.getTime(),
          workspace: task.workspacePath || null,
          repo_url: task.repoUrl || null,
          log_count: task.logs.length,
        })),
      });
    }
  );

  // Get live logs for an active task
  // NOTE: Must be registered BEFORE /api/tasks/:taskId to avoid route conflict
  fastify.get<{ Params: { taskId: string }; Querystring: { since?: string } }>(
    '/api/tasks/active/:taskId/logs',
    async (request, reply) => {
      const { taskId } = request.params;
      const since = request.query.since ? new Date(request.query.since) : null;

      const logs = getTaskLogs(taskId);

      if (!logs) {
        reply.code(404).send({
          success: false,
          error: 'Task not found or logs expired',
        });
        return;
      }

      // Filter logs by timestamp if 'since' is provided
      const filteredLogs = since
        ? logs.filter(log => log.timestamp > since)
        : logs;

      // Get current task info if still active
      const activeTask = getActiveTask(taskId);

      reply.send({
        success: true,
        task_id: taskId,
        is_active: !!activeTask,
        current_stage: activeTask?.currentStage || null,
        stages_completed: activeTask?.stagesCompleted || [],
        started_at: activeTask?.startedAt?.toISOString() || null,
        running_time_ms: activeTask ? Date.now() - activeTask.startedAt.getTime() : null,
        logs: filteredLogs.map(log => ({
          timestamp: log.timestamp.toISOString(),
          stage: log.stage,
          type: log.type,
          message: log.message,
          data: log.data,
        })),
      });
    }
  );

  // Get queued tasks (waiting to be executed)
  // NOTE: Must be registered BEFORE /api/tasks/:taskId to avoid route conflict
  fastify.get(
    '/api/tasks/queue',
    async (_request, reply) => {
      const queuedTasks = getQueuedTasks();
      const activeCount = getActiveTaskCount();

      reply.send({
        success: true,
        queue_length: queuedTasks.length,
        active_tasks: activeCount,
        max_concurrent: config.maxConcurrentTasks,
        tasks: queuedTasks.map(task => ({
          task_id: task.taskId,
          prompt: task.prompt,
          model: task.model || config.defaultModel,
          repo_url: task.repoUrl || null,
          branch: task.branch || 'main',
          queued_at: task.queuedAt.toISOString(),
          queue_position: task.queuePosition,
          wait_time_ms: task.waitTimeMs,
        })),
      });
    }
  );

  // Get task statistics for a time period (requires database)
  // NOTE: Must be registered BEFORE /api/tasks/:taskId to avoid route conflict
  fastify.get<{ Querystring: { start_date?: string; end_date?: string } }>(
    '/api/tasks/stats',
    async (request, reply) => {
      if (!isDatabaseEnabled()) {
        reply.code(503).send({
          success: false,
          error: 'Database not enabled. Set DB_ENABLED=true in .env to use this endpoint.',
        });
        return;
      }

      // Default to last 24 hours if no dates provided
      const endDate = request.query.end_date
        ? new Date(request.query.end_date)
        : new Date();
      const startDate = request.query.start_date
        ? new Date(request.query.start_date)
        : new Date(endDate.getTime() - 24 * 60 * 60 * 1000);

      // Validate dates
      if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
        reply.code(400).send({
          success: false,
          error: 'Invalid date format. Use ISO 8601 format (e.g., 2024-01-15T00:00:00Z)',
        });
        return;
      }

      try {
        const stats = await getTaskStats(startDate, endDate);
        reply.send({
          success: true,
          period: {
            start: startDate.toISOString(),
            end: endDate.toISOString(),
          },
          ...stats,
        });
      } catch (error) {
        logger.error({ error }, 'Failed to get task stats');
        reply.code(500).send({
          success: false,
          error: 'Failed to retrieve task statistics',
        });
      }
    }
  );

  // Get interrupted/recoverable tasks
  // NOTE: Must be registered BEFORE /api/tasks/:taskId to avoid route conflict
  fastify.get(
    '/api/tasks/interrupted',
    async (_request, reply) => {
      if (!isDatabaseEnabled()) {
        reply.code(503).send({
          success: false,
          error: 'Database not enabled.',
        });
        return;
      }

      try {
        const tasks = await getInterruptedTasks();
        reply.send({
          success: true,
          count: tasks.length,
          tasks,
        });
      } catch (error) {
        logger.error({ error }, 'Failed to get interrupted tasks');
        reply.code(500).send({
          success: false,
          error: 'Failed to retrieve interrupted tasks',
        });
      }
    }
  );

  // Get checkpoints for a task
  // NOTE: Must be registered BEFORE /api/tasks/:taskId to avoid route conflict
  fastify.get<{ Params: { taskId: string } }>(
    '/api/tasks/:taskId/checkpoints',
    async (request, reply) => {
      if (!isDatabaseEnabled()) {
        reply.code(503).send({ success: false, error: 'Database not enabled.' });
        return;
      }

      try {
        const checkpoints = await getCheckpoints(request.params.taskId);
        reply.send({ success: true, checkpoints });
      } catch (error) {
        logger.error({ error }, 'Failed to get checkpoints');
        reply.code(500).send({ success: false, error: 'Failed to retrieve checkpoints' });
      }
    }
  );

  // Dismiss an interrupted task (mark as failed so it doesn't show anymore)
  fastify.post<{ Params: { taskId: string } }>(
    '/api/tasks/:taskId/dismiss',
    async (request, reply) => {
      if (!isDatabaseEnabled()) {
        reply.code(503).send({ success: false, error: 'Database not enabled.' });
        return;
      }

      try {
        await updateTaskStatus(request.params.taskId, 'failed');
        reply.send({ success: true, message: 'Task dismissed' });
      } catch (error) {
        logger.error({ error }, 'Failed to dismiss task');
        reply.code(500).send({ success: false, error: 'Failed to dismiss task' });
      }
    }
  );

  // Get task details by ID (requires database)
  // NOTE: Must be registered AFTER /api/tasks/active and /api/tasks/stats
  fastify.get<{ Params: { taskId: string } }>(
    '/api/tasks/:taskId',
    async (request, reply) => {
      if (!isDatabaseEnabled()) {
        reply.code(503).send({
          success: false,
          error: 'Database not enabled. Set DB_ENABLED=true in .env to use this endpoint.',
        });
        return;
      }

      try {
        const task = await getTaskById(request.params.taskId);

        if (!task) {
          reply.code(404).send({
            success: false,
            error: 'Task not found',
          });
          return;
        }

        reply.send({
          success: true,
          task,
        });
      } catch (error) {
        logger.error({ error, taskId: request.params.taskId }, 'Failed to get task details');
        reply.code(500).send({
          success: false,
          error: 'Failed to retrieve task details',
        });
      }
    }
  );

  // Cancel an active or queued task
  fastify.delete<{ Params: { taskId: string } }>(
    '/api/tasks/:taskId',
    async (request, reply) => {
      const { taskId } = request.params;

      // First, check if task is in queue
      if (isTaskQueued(taskId)) {
        const removed = removeFromQueue(taskId);

        if (removed) {
          logger.info({ taskId }, 'Task removed from queue');
          reply.send({
            success: true,
            message: 'Task was removed from the queue before execution started.',
            task: {
              task_id: taskId,
              status: 'removed_from_queue',
            },
          });
          return;
        }
      }

      // Check if task is active
      const activeTask = getActiveTask(taskId);

      if (!activeTask) {
        reply.code(404).send({
          success: false,
          error: 'Task not found or already completed. Only active or queued tasks can be cancelled.',
        });
        return;
      }

      // Cancel the active task
      const cancelled = cancelTask(taskId);

      if (cancelled) {
        logger.info({ taskId }, 'Task cancellation requested');
        reply.send({
          success: true,
          message: 'Task cancellation requested. The task will be stopped at the next checkpoint.',
          task: {
            task_id: activeTask.taskId,
            prompt: activeTask.prompt,
            current_stage: activeTask.currentStage,
          },
        });
      } else {
        reply.code(500).send({
          success: false,
          error: 'Failed to cancel task',
        });
      }
    }
  );

  // Retry a failed/interrupted task (resumes from checkpoint if available)
  fastify.post<{ Params: { taskId: string }; Querystring: { fresh?: string } }>(
    '/api/tasks/:taskId/retry',
    async (request, reply) => {
      if (!isDatabaseEnabled()) {
        reply.code(503).send({
          success: false,
          error: 'Database not enabled. Set DB_ENABLED=true in .env to use this endpoint.',
        });
        return;
      }

      const { taskId } = request.params;
      const forceFresh = request.query.fresh === 'true';

      try {
        // Get the original task
        const originalTask = await getTaskById(taskId);

        if (!originalTask) {
          reply.code(404).send({
            success: false,
            error: 'Task not found',
          });
          return;
        }

        // Check if task has checkpoints and can be resumed
        const checkpoints = await getCheckpoints(taskId);
        const canResume = !forceFresh && checkpoints.length > 0;

        if (canResume) {
          // Resume from checkpoint
          logger.info({
            originalTaskId: taskId,
            checkpointCount: checkpoints.length,
            lastStage: checkpoints[checkpoints.length - 1].stage_name,
          }, 'Resuming task from checkpoint');

          const response: TaskResponse = await resumePipeline(
            taskId,
            originalTask.input_prompt,
            originalTask.model,
            (originalTask as any).pipeline_mode,
            (originalTask as any).expert_mode,
          );

          reply.send({
            ...response,
            newTaskId: response.task_id,
            resumed_from: taskId,
            checkpoints_used: checkpoints.length,
            message: `Task resumed from checkpoint (${checkpoints[checkpoints.length - 1].stage_name})`,
          });
        } else {
          // Fresh retry (no checkpoints or forced fresh)
          const taskRequest: TaskRequest = {
            prompt: originalTask.input_prompt,
            repo_url: originalTask.repo_url || undefined,
            repos: originalTask.repos_json ? JSON.parse(JSON.stringify(originalTask.repos_json)) : undefined,
            model: (originalTask.model as ModelType) || undefined,
          };

          logger.info({ originalTaskId: taskId, fresh: true }, 'Retrying task from scratch');

          const response: TaskResponse = await runPipeline(taskRequest);

          reply.send({
            ...response,
            newTaskId: response.task_id,
            message: 'Task retry initiated (from scratch)',
          });
        }
      } catch (error) {
        logger.error({ error, taskId }, 'Failed to retry task');
        reply.code(500).send({
          success: false,
          error: 'Failed to retry task',
        });
      }
    }
  );

  // ===========================================
  // Task Streaming Endpoint (SSE)
  // ===========================================

  /**
   * GET /api/tasks/:taskId/stream
   * Server-Sent Events endpoint for real-time task updates
   */
  fastify.get<{ Params: { taskId: string } }>(
    '/api/tasks/:taskId/stream',
    async (request, reply) => {
      const { taskId } = request.params;

      // Set SSE headers
      reply.raw.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
      });

      // Send initial connection event
      reply.raw.write(`data: ${JSON.stringify({ type: 'connected', taskId })}\n\n`);

      let connectionClosed = false;

      // Helper to safely write SSE data
      const writeSSE = (data: object): boolean => {
        if (connectionClosed) return false;
        try {
          reply.raw.write(`data: ${JSON.stringify(data)}\n\n`);
          return true;
        } catch {
          return false;
        }
      };

      // Helper to close SSE connection and clean up
      const closeConnection = () => {
        if (connectionClosed) return;
        connectionClosed = true;
        clearInterval(interval);
        taskEvents.removeListener('task-update', onTaskUpdate);
        try { reply.raw.end(); } catch { /* already closed */ }
      };

      // Listen for real-time push events from task-tracker EventEmitter
      const onTaskUpdate = (event: { taskId: string; type: string; data: Record<string, unknown> }) => {
        if (event.taskId !== taskId) return;

        if (event.type === 'completed') {
          // Task finished - send final update then close
          writeSSE({
            type: 'completed',
            taskId,
            data: event.data,
          });
          // Give the client a moment to receive, then close
          setTimeout(() => closeConnection(), 500);
        } else {
          // Send real-time update (stage-change, log, output)
          writeSSE({
            type: 'update',
            eventType: event.type,
            taskId,
            data: event.data,
          });
        }
      };

      taskEvents.on('task-update', onTaskUpdate);

      // Polling fallback every 10 seconds for full state sync
      const interval = setInterval(async () => {
        if (connectionClosed) return;

        try {
          // Check if task is active
          const activeTask = getActiveTask(taskId);

          if (activeTask) {
            // Send task status update (full state sync)
            writeSSE({
              type: 'update',
              task: {
                taskId: activeTask.taskId,
                prompt: activeTask.prompt,
                currentStage: activeTask.currentStage,
                status: 'in_progress',
                startedAt: activeTask.startedAt.toISOString(),
                runningTime: Date.now() - activeTask.startedAt.getTime(),
              }
            });
          } else {
            // Task completed or doesn't exist
            // Try to get from database
            if (isDatabaseEnabled()) {
              const completedTask = await getTaskById(taskId);
              if (completedTask) {
                writeSSE({
                  type: 'completed',
                  task: completedTask
                });
              } else {
                writeSSE({
                  type: 'not_found',
                  message: 'Task not found'
                });
              }
            }

            // Close connection after sending final status
            closeConnection();
          }
        } catch (error) {
          logger.error({ error, taskId }, 'Error in SSE stream');
          closeConnection();
        }
      }, 10000);

      // Clean up on client disconnect
      request.raw.on('close', () => {
        closeConnection();
        logger.debug({ taskId }, 'SSE client disconnected');
      });
    }
  );

  // Quick action endpoint
  fastify.post<{ Body: { action: string; target?: string; context?: string; model?: ModelType } }>(
    '/api/task/quick',
    async (request, reply) => {
      const { action, target, context, model } = request.body;

      if (!action || typeof action !== 'string') {
        return reply.code(400).send({ success: false, error: 'action is required' });
      }

      const prompts: Record<string, string> = {
        fix: `Analiza y corrige los bugs en ${target || 'el proyecto'}. ${context || ''}`,
        test: `Escribe tests unitarios completos para ${target || 'el proyecto'}. Usa el framework de testing existente. ${context || ''}`,
        refactor: `Refactoriza ${target || 'el codigo'} mejorando legibilidad, performance y mantenibilidad. ${context || ''}`,
        review: `Haz code review detallado de ${target || 'los cambios recientes'}. Reporta bugs, mejoras de seguridad, performance. ${context || ''}`,
        docs: `Agrega documentacion clara a ${target || 'el proyecto'}. JSDoc, README, comments donde sea necesario. ${context || ''}`,
        optimize: `Optimiza performance de ${target || 'el proyecto'}. Identifica bottlenecks y aplica mejoras. ${context || ''}`,
      };

      const prompt = prompts[action];
      if (!prompt) {
        return reply.code(400).send({ success: false, error: `Invalid action: ${action}. Valid: ${Object.keys(prompts).join(', ')}` });
      }

      try {
        const response = await runPipeline({ prompt: prompt.trim(), model, pipeline_mode: 'fast' });
        reply.send(response);
      } catch (error) {
        reply.code(500).send({
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }
  );
}
