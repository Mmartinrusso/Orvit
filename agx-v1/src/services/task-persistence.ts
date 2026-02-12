import { query, insert, isDatabaseEnabled } from './database.js';
import { createChildLogger } from '../utils/logger.js';
import type { PipelineState, PipelineStage, TaskRequest } from '../types/index.js';

const logger = createChildLogger('task-persistence');

// Task status values stored in the DB
export type TaskStatus = 'pending' | 'queued' | 'running' | 'completed' | 'failed' | 'interrupted' | 'cancelled';

/**
 * Record for a task that can be recovered
 */
export interface RecoverableTask {
  task_id: string;
  input_prompt: string;
  model: string;
  status: TaskStatus;
  pipeline_mode: string | null;
  expert_mode: string | null;
  last_stage: string | null;
  stages_completed: string[];
  pipeline_state: Record<string, unknown> | null;
  created_at: string;
  started_at: string | null;
}

// ─── Task Status Management ─────────────────────────────────────────

/**
 * Register a task as starting (insert into DB with status='running')
 */
export async function persistTaskStart(
  taskId: string,
  prompt: string,
  model: string,
  pipelineMode?: string,
  expertMode?: string,
): Promise<void> {
  if (!isDatabaseEnabled()) return;

  try {
    // Check if task already exists (retry scenario)
    const existing = await query<any[]>('SELECT task_id FROM tasks WHERE task_id = ?', [taskId]);

    if (existing && existing.length > 0) {
      // Update existing task to running
      await query(
        `UPDATE tasks SET status = 'running', started_at = NOW(), last_stage = 'analyzer',
         stages_completed = '[]'::jsonb WHERE task_id = ?`,
        [taskId]
      );
    } else {
      // Insert new task record with status
      await insert(
        `INSERT INTO tasks (
          task_id, input_prompt, model, status, pipeline_mode, expert_mode,
          last_stage, stages_completed, started_at, success
        ) VALUES (?, ?, ?, 'running', ?, ?, 'analyzer', '[]'::jsonb, NOW(), FALSE)`,
        [taskId, prompt, model, pipelineMode || null, expertMode || null]
      );
    }

    logger.debug({ taskId }, 'Task start persisted');
  } catch (error) {
    logger.error({ error, taskId }, 'Failed to persist task start');
  }
}

/**
 * Update task status in the database
 */
export async function updateTaskStatus(taskId: string, status: TaskStatus): Promise<void> {
  if (!isDatabaseEnabled()) return;

  try {
    const completedAt = (status === 'completed' || status === 'failed' || status === 'cancelled')
      ? ', completed_at = NOW()'
      : '';
    await query(`UPDATE tasks SET status = ?${completedAt} WHERE task_id = ?`, [status, taskId]);
    logger.debug({ taskId, status }, 'Task status updated');
  } catch (error) {
    logger.error({ error, taskId, status }, 'Failed to update task status');
  }
}

/**
 * Update the current stage and completed stages in the DB
 */
export async function persistStageProgress(
  taskId: string,
  currentStage: PipelineStage,
  stagesCompleted: PipelineStage[],
): Promise<void> {
  if (!isDatabaseEnabled()) return;

  try {
    await query(
      `UPDATE tasks SET last_stage = ?, stages_completed = ?::jsonb WHERE task_id = ?`,
      [currentStage, JSON.stringify(stagesCompleted), taskId]
    );
    logger.debug({ taskId, currentStage }, 'Stage progress persisted');
  } catch (error) {
    logger.error({ error, taskId, currentStage }, 'Failed to persist stage progress');
  }
}

// ─── Checkpoint Management ──────────────────────────────────────────

/**
 * Save a checkpoint after a stage completes successfully.
 * Uses UPSERT so re-running a stage overwrites the old checkpoint.
 */
export async function saveCheckpoint(
  taskId: string,
  stageName: string,
  stageOrder: number,
  stageResult: unknown,
  pipelineStateSnapshot: Partial<PipelineState>,
): Promise<void> {
  if (!isDatabaseEnabled()) return;

  try {
    // Prepare a serializable snapshot (strip non-serializable fields)
    const snapshot = {
      targetPaths: pipelineStateSnapshot.targetPaths,
      plan: pipelineStateSnapshot.plan,
      changes: pipelineStateSnapshot.changes,
      branch: pipelineStateSnapshot.branch,
      pipelineMode: pipelineStateSnapshot.pipelineMode,
      complexityAnalysis: pipelineStateSnapshot.complexityAnalysis,
      sessionIds: pipelineStateSnapshot.sessionIds,
      stagesCompleted: pipelineStateSnapshot.stagesCompleted,
      currentStage: pipelineStateSnapshot.currentStage,
      skillsContext: pipelineStateSnapshot.skillsContext,
      matchedSkills: pipelineStateSnapshot.matchedSkills,
    };

    await query(
      `INSERT INTO task_checkpoints (task_id, stage_name, stage_order, stage_result, pipeline_state_snapshot)
       VALUES (?, ?, ?, ?::jsonb, ?::jsonb)
       ON CONFLICT (task_id, stage_name)
       DO UPDATE SET stage_result = EXCLUDED.stage_result,
                     pipeline_state_snapshot = EXCLUDED.pipeline_state_snapshot,
                     created_at = NOW()`,
      [taskId, stageName, stageOrder, JSON.stringify(stageResult || {}), JSON.stringify(snapshot)]
    );

    logger.debug({ taskId, stageName }, 'Checkpoint saved');
  } catch (error) {
    logger.error({ error, taskId, stageName }, 'Failed to save checkpoint');
  }
}

/**
 * Get checkpoints for a task (ordered by stage)
 */
export async function getCheckpoints(taskId: string): Promise<Array<{
  stage_name: string;
  stage_order: number;
  stage_result: unknown;
  pipeline_state_snapshot: unknown;
}>> {
  if (!isDatabaseEnabled()) return [];

  try {
    const results = await query<any[]>(
      'SELECT stage_name, stage_order, stage_result, pipeline_state_snapshot FROM task_checkpoints WHERE task_id = ? ORDER BY stage_order',
      [taskId]
    );
    return results || [];
  } catch (error) {
    logger.error({ error, taskId }, 'Failed to get checkpoints');
    return [];
  }
}

// ─── Recovery ───────────────────────────────────────────────────────

/**
 * Mark all running/queued tasks as interrupted.
 * Called on server startup to clean up tasks from a previous crash.
 */
export async function markInterruptedTasks(): Promise<number> {
  if (!isDatabaseEnabled()) return 0;

  try {
    const result = await query<any[]>(
      `UPDATE tasks SET status = 'interrupted', completed_at = NOW()
       WHERE status IN ('running', 'queued')
       RETURNING task_id, input_prompt, last_stage`,
      []
    );

    const count = result?.length || 0;
    if (count > 0) {
      logger.info({ count, tasks: result?.map(t => ({ id: t.task_id, stage: t.last_stage })) },
        'Marked interrupted tasks from previous session');
    }
    return count;
  } catch (error) {
    logger.error({ error }, 'Failed to mark interrupted tasks');
    return 0;
  }
}

/**
 * Get all tasks that were interrupted (for showing in UI / retrying)
 */
export async function getInterruptedTasks(): Promise<RecoverableTask[]> {
  if (!isDatabaseEnabled()) return [];

  try {
    const results = await query<any[]>(
      `SELECT task_id, input_prompt, model, status, pipeline_mode, expert_mode,
              last_stage, stages_completed, pipeline_state, created_at, started_at
       FROM tasks
       WHERE status = 'interrupted'
       ORDER BY created_at DESC
       LIMIT 50`,
      []
    );

    return (results || []).map(r => ({
      ...r,
      stages_completed: r.stages_completed || [],
    }));
  } catch (error) {
    logger.error({ error }, 'Failed to get interrupted tasks');
    return [];
  }
}

/**
 * Get tasks by status (for dashboard/UI)
 */
export async function getTasksByStatus(status: TaskStatus): Promise<RecoverableTask[]> {
  if (!isDatabaseEnabled()) return [];

  try {
    const results = await query<any[]>(
      `SELECT task_id, input_prompt, model, status, pipeline_mode, expert_mode,
              last_stage, stages_completed, pipeline_state, created_at, started_at
       FROM tasks
       WHERE status = ?
       ORDER BY created_at DESC
       LIMIT 50`,
      [status]
    );
    return (results || []).map(r => ({
      ...r,
      stages_completed: r.stages_completed || [],
    }));
  } catch (error) {
    logger.error({ error }, 'Failed to get tasks by status');
    return [];
  }
}

// ─── Graceful Shutdown ──────────────────────────────────────────────

/**
 * Save state of all currently running tasks as interrupted.
 * Called during graceful shutdown.
 */
export async function persistShutdownState(
  activeTasks: Array<{ taskId: string; currentStage: PipelineStage; stagesCompleted: PipelineStage[] }>
): Promise<void> {
  if (!isDatabaseEnabled()) return;

  try {
    for (const task of activeTasks) {
      await query(
        `UPDATE tasks SET status = 'interrupted', last_stage = ?, stages_completed = ?::jsonb, completed_at = NOW()
         WHERE task_id = ? AND status = 'running'`,
        [task.currentStage, JSON.stringify(task.stagesCompleted), task.taskId]
      );
    }

    logger.info({ count: activeTasks.length }, 'Shutdown state persisted for active tasks');
  } catch (error) {
    logger.error({ error }, 'Failed to persist shutdown state');
  }
}
