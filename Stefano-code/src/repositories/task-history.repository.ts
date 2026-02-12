import { query, insert, isDatabaseEnabled } from '../services/database.js';
import { createChildLogger } from '../utils/logger.js';
import type {
  PipelineState,
  TaskResponse,
  FileChange,
  TokenUsage,
  VerifierResult,
} from '../types/index.js';

const logger = createChildLogger('task-history-repository');

export interface TaskRecord {
  task_id: string;
  input_prompt: string;
  model: string;
  success: boolean;
  error_message?: string;
  stage_failed?: string;
  summary?: string;
  modified_files?: string[];
  git_branch?: string;
  git_commit_sha?: string;
  git_commit_message?: string;
  git_pr_url?: string;
  total_input_tokens: number;
  total_output_tokens: number;
  total_tokens: number;
  implementer_session_id?: string;  // Session ID for conversation continuation
  repo_url?: string;  // Repository URL for single-repo mode
  repos_json?: Array<{ url: string; description: string; branch?: string }>;  // Multi-repo mode
}

export interface StageRecord {
  task_id: string;
  stage_name: string;
  stage_order: number;
  claude_session_id?: string;
  input_prompt?: string;
  output_result?: string;
  parsed_result?: any;
  input_tokens: number;
  output_tokens: number;
  success: boolean;
  error_message?: string;
  duration_ms?: number;
}

/**
 * Save a task to the database
 */
export async function saveTask(
  state: PipelineState,
  response: TaskResponse
): Promise<void> {
  if (!isDatabaseEnabled()) {
    logger.debug('Database not enabled, skipping task save');
    return;
  }

  try {
    // Insert main task record
    const taskSql = `
      INSERT INTO tasks (
        task_id, input_prompt, model, success, error_message, stage_failed,
        summary, modified_files, git_branch, git_commit_sha, git_commit_message, git_pr_url,
        total_input_tokens, total_output_tokens, total_tokens, implementer_session_id,
        repo_url, repos_json, completed_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
    `;

    const modifiedFiles = response.changes.map(c => c.file);
    const summary = state.plan
      ? `Implementación: ${state.originalPrompt.substring(0, 500)}`
      : state.originalPrompt.substring(0, 500);

    // Get implementer session ID (from fast-dev or implementer agent)
    const implementerSessionId = state.sessionIds['fast-dev'] || state.sessionIds['implementer'] || null;

    // Get repo info
    const repoUrl = state.repoUrl || null;
    const reposJson = state.repos.length > 1 ? JSON.stringify(state.repos.map(r => ({
      url: r.url,
      description: r.description,
      branch: r.branch,
    }))) : null;

    await insert(taskSql, [
      state.taskId,
      state.originalPrompt,
      state.model,
      response.success,
      response.error || null,
      response.stage_failed || null,
      summary,
      JSON.stringify(modifiedFiles),
      response.git?.branch || null,
      response.git?.commit_sha || null,
      null, // git_commit_message - can be updated later via updateTaskGitInfo
      response.git?.pr_url || null,
      response.token_usage.total_input,
      response.token_usage.total_output,
      response.token_usage.total,
      implementerSessionId,
      repoUrl,
      reposJson,
    ]);

    logger.info({ taskId: state.taskId }, 'Task saved to database');

    // Save file changes
    if (response.changes.length > 0) {
      await saveChanges(state.taskId, response.changes);
    }
  } catch (error) {
    logger.error({ error, taskId: state.taskId }, 'Failed to save task to database');
    // Don't throw - we don't want to fail the task if DB save fails
  }
}

/**
 * Save stage execution details
 */
export async function saveStage(
  taskId: string,
  stageName: string,
  stageOrder: number,
  sessionId: string | undefined,
  inputPrompt: string | undefined,
  outputResult: string | undefined,
  parsedResult: any,
  inputTokens: number,
  outputTokens: number,
  success: boolean,
  errorMessage?: string,
  durationMs?: number
): Promise<void> {
  if (!isDatabaseEnabled()) {
    return;
  }

  try {
    const sql = `
      INSERT INTO task_stages (
        task_id, stage_name, stage_order, claude_session_id,
        input_prompt, output_result, parsed_result,
        input_tokens, output_tokens, success, error_message,
        duration_ms, completed_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
    `;

    await insert(sql, [
      taskId,
      stageName,
      stageOrder,
      sessionId || null,
      inputPrompt?.substring(0, 65000) || null, // Truncate to fit TEXT
      outputResult?.substring(0, 16000000) || null, // LONGTEXT limit
      JSON.stringify(parsedResult),
      inputTokens,
      outputTokens,
      success,
      errorMessage || null,
      durationMs || null,
    ]);

    logger.debug({ taskId, stageName }, 'Stage saved to database');
  } catch (error) {
    logger.error({ error, taskId, stageName }, 'Failed to save stage to database');
  }
}

/**
 * Save file changes
 */
async function saveChanges(taskId: string, changes: FileChange[]): Promise<void> {
  if (!isDatabaseEnabled()) {
    return;
  }

  try {
    const sql = `
      INSERT INTO task_changes (task_id, file_path, action, summary)
      VALUES (?, ?, ?, ?)
    `;

    for (const change of changes) {
      await insert(sql, [
        taskId,
        change.file,
        change.action,
        change.summary || null,
      ]);
    }

    logger.debug({ taskId, changesCount: changes.length }, 'Changes saved to database');
  } catch (error) {
    logger.error({ error, taskId }, 'Failed to save changes to database');
  }
}

/**
 * Save test results from verifier
 */
export async function saveTestResults(
  taskId: string,
  verifierResult: VerifierResult
): Promise<void> {
  if (!isDatabaseEnabled() || !verifierResult.test_results) {
    return;
  }

  try {
    const sql = `
      INSERT INTO task_tests (task_id, test_file, test_name, passed, error_message)
      VALUES (?, ?, ?, ?, ?)
    `;

    for (const test of verifierResult.test_results) {
      await insert(sql, [
        taskId,
        test.file,
        test.name,
        test.passed,
        test.error || null,
      ]);
    }

    logger.debug({ taskId, testsCount: verifierResult.test_results.length }, 'Test results saved to database');
  } catch (error) {
    logger.error({ error, taskId }, 'Failed to save test results to database');
  }
}

/**
 * Update task with git commit message
 */
export async function updateTaskGitInfo(
  taskId: string,
  commitMessage: string
): Promise<void> {
  if (!isDatabaseEnabled()) {
    return;
  }

  try {
    const sql = `
      UPDATE tasks SET git_commit_message = ? WHERE task_id = ?
    `;
    await query(sql, [commitMessage, taskId]);
  } catch (error) {
    logger.error({ error, taskId }, 'Failed to update git info in database');
  }
}

/**
 * Get task history with git branch info
 */
export async function getTaskHistory(limit: number = 50): Promise<TaskRecord[] | null> {
  if (!isDatabaseEnabled()) {
    return null;
  }

  const sql = `
    SELECT
      task_id,
      input_prompt,
      model,
      success,
      error_message,
      stage_failed,
      summary,
      modified_files,
      git_branch,
      git_commit_sha,
      git_commit_message,
      git_pr_url,
      total_input_tokens,
      total_output_tokens,
      total_tokens,
      implementer_session_id,
      repo_url,
      repos_json,
      created_at,
      completed_at
    FROM tasks
    ORDER BY created_at DESC
    LIMIT ?
  `;

  const results = await query<any[]>(sql, [limit]);

  if (!results) {
    return null;
  }

  // Parse repos_json for each record
  return results.map(r => ({
    ...r,
    repos_json: r.repos_json ? (typeof r.repos_json === 'string' ? JSON.parse(r.repos_json) : r.repos_json) : null,
  }));
}

export interface TaskStats {
  total_tasks: number;
  successful_tasks: number;
  failed_tasks: number;
  total_tokens_used: number;
  total_input_tokens: number;
  total_output_tokens: number;
  tasks: Array<{
    task_id: string;
    input_prompt: string;
    model: string;
    success: boolean;
    git_branch: string | null;
    total_input_tokens: number;
    total_output_tokens: number;
    created_at: Date;
    completed_at: Date | null;
  }>;
}

/**
 * Get task statistics for a time period
 */
export async function getTaskStats(
  startDate: Date,
  endDate: Date
): Promise<TaskStats | null> {
  if (!isDatabaseEnabled()) {
    return null;
  }

  // PostgreSQL uses BOOLEAN type, MySQL uses TINYINT
  const statsSql = `
    SELECT
      COUNT(*) as total_tasks,
      SUM(CASE WHEN success = TRUE THEN 1 ELSE 0 END) as successful_tasks,
      SUM(CASE WHEN success = FALSE THEN 1 ELSE 0 END) as failed_tasks,
      SUM(total_tokens) as total_tokens_used,
      SUM(total_input_tokens) as total_input_tokens,
      SUM(total_output_tokens) as total_output_tokens
    FROM tasks
    WHERE created_at BETWEEN ? AND ?
  `;

  const tasksSql = `
    SELECT
      task_id,
      input_prompt,
      model,
      success,
      git_branch,
      total_input_tokens,
      total_output_tokens,
      created_at,
      completed_at
    FROM tasks
    WHERE created_at BETWEEN ? AND ?
    ORDER BY created_at DESC
  `;

  const [statsResult, tasksResult] = await Promise.all([
    query<any[]>(statsSql, [startDate, endDate]),
    query<any[]>(tasksSql, [startDate, endDate]),
  ]);

  if (!statsResult || statsResult.length === 0) {
    return null;
  }

  const stats = statsResult[0];
  return {
    total_tasks: stats.total_tasks || 0,
    successful_tasks: stats.successful_tasks || 0,
    failed_tasks: stats.failed_tasks || 0,
    total_tokens_used: stats.total_tokens_used || 0,
    total_input_tokens: stats.total_input_tokens || 0,
    total_output_tokens: stats.total_output_tokens || 0,
    tasks: tasksResult || [],
  };
}

/**
 * Get task details by ID
 */
export async function getTaskById(taskId: string): Promise<any | null> {
  if (!isDatabaseEnabled()) {
    return null;
  }

  const taskSql = `SELECT * FROM tasks WHERE task_id = ?`;
  const stagesSql = `SELECT * FROM task_stages WHERE task_id = ? ORDER BY stage_order`;
  const changesSql = `SELECT * FROM task_changes WHERE task_id = ?`;
  const testsSql = `SELECT * FROM task_tests WHERE task_id = ?`;

  const [tasks] = await Promise.all([
    query<any[]>(taskSql, [taskId]),
  ]);

  if (!tasks || tasks.length === 0) {
    return null;
  }

  const [stages, changes, tests] = await Promise.all([
    query<any[]>(stagesSql, [taskId]),
    query<any[]>(changesSql, [taskId]),
    query<any[]>(testsSql, [taskId]),
  ]);

  return {
    ...tasks[0],
    stages,
    changes,
    tests,
  };
}

/**
 * Get implementer session ID for a task
 * Useful for continuing conversations
 */
export async function getTaskSessionId(taskId: string): Promise<string | null> {
  if (!isDatabaseEnabled()) {
    return null;
  }

  const sql = `SELECT implementer_session_id FROM tasks WHERE task_id = ?`;
  const result = await query<{ implementer_session_id: string | null }[]>(sql, [taskId]);

  if (!result || result.length === 0) {
    return null;
  }

  return result[0].implementer_session_id || null;
}

// ============================================
// Repository History Functions
// ============================================

export interface RepoHistoryRecord {
  id: number;
  repo_hash: string;
  repo_url: string | null;
  repos_json: Array<{ url: string; description: string; branch?: string }> | null;
  is_multi_repo: boolean;
  usage_count: number;
  last_used_at: string;
  created_at: string;
}

/**
 * Generate a hash for repo configuration to check uniqueness
 */
function generateRepoHash(repoUrl?: string, repos?: Array<{ url: string; description: string }>): string {
  let data: string;
  if (repos && repos.length > 0) {
    // Sort by URL to ensure consistent hash regardless of order
    const sortedUrls = repos.map(r => r.url.toLowerCase().trim()).sort().join('|');
    data = `multi:${sortedUrls}`;
  } else if (repoUrl) {
    data = `single:${repoUrl.toLowerCase().trim()}`;
  } else {
    data = 'empty';
  }

  // Simple hash function
  let hash = 0;
  for (let i = 0; i < data.length; i++) {
    const char = data.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(16).padStart(16, '0');
}

/**
 * Save or update a repository configuration
 */
export async function saveRepoUsage(
  repoUrl?: string,
  repos?: Array<{ url: string; description: string; branch?: string }>
): Promise<void> {
  if (!isDatabaseEnabled()) {
    return;
  }

  const isMultiRepo = !!(repos && repos.length > 0);
  const repoHash = generateRepoHash(repoUrl, repos);

  try {
    // Check if exists
    const checkSql = `SELECT id FROM repo_history WHERE repo_hash = ?`;
    const existing = await query<any[]>(checkSql, [repoHash]);

    if (existing && existing.length > 0) {
      // Update existing record
      const updateSql = `
        UPDATE repo_history
        SET usage_count = usage_count + 1, last_used_at = NOW()
        WHERE repo_hash = ?
      `;
      await query(updateSql, [repoHash]);
    } else {
      // Insert new record
      const insertSql = `
        INSERT INTO repo_history (repo_hash, repo_url, repos_json, is_multi_repo, usage_count)
        VALUES (?, ?, ?, ?, 1)
      `;
      await insert(insertSql, [
        repoHash,
        isMultiRepo ? null : repoUrl,
        isMultiRepo ? JSON.stringify(repos) : null,
        isMultiRepo,
      ]);
    }

    logger.debug({ repoHash, isMultiRepo }, 'Repo usage saved');
  } catch (error) {
    logger.error({ error }, 'Failed to save repo usage');
  }
}

/**
 * Get repository history ordered by last used
 */
export async function getRepoHistory(limit: number = 20): Promise<RepoHistoryRecord[] | null> {
  if (!isDatabaseEnabled()) {
    return null;
  }

  const sql = `
    SELECT
      id, repo_hash, repo_url, repos_json, is_multi_repo,
      usage_count, last_used_at, created_at
    FROM repo_history
    ORDER BY last_used_at DESC
    LIMIT ?
  `;

  const results = await query<any[]>(sql, [limit]);

  if (!results) {
    return null;
  }

  // Parse repos_json for each record
  return results.map(r => ({
    ...r,
    repos_json: r.repos_json ? (typeof r.repos_json === 'string' ? JSON.parse(r.repos_json) : r.repos_json) : null,
  }));
}

// ============================================
// Conversation History Functions
// ============================================

export interface ConversationHistoryRecord {
  task_id: string;
  implementer_session_id: string;
  input_prompt: string;
  model: string;
  success: boolean;
  created_at: string;
  git_branch?: string | null;
}

/**
 * Get conversations that can be continued (tasks with session IDs)
 */
export async function getConversationHistory(limit: number = 20): Promise<ConversationHistoryRecord[] | null> {
  if (!isDatabaseEnabled()) {
    return null;
  }

  const sql = `
    SELECT
      task_id,
      implementer_session_id,
      input_prompt,
      model,
      success,
      created_at,
      git_branch
    FROM tasks
    WHERE implementer_session_id IS NOT NULL
    ORDER BY created_at DESC
    LIMIT ?
  `;

  return query<ConversationHistoryRecord[]>(sql, [limit]);
}

// ============================================
// Task Continuation Context
// ============================================

export interface TaskContinuationContext {
  task_id: string;
  original_prompt: string;
  model: string;
  git_branch: string | null;
  repo_url: string | null;
  repos_json: Array<{ url: string; description: string; branch?: string }> | null;
  changes: Array<{ file_path: string; action: string; summary: string | null }>;
  summary: string | null;
}

/**
 * Get context from a previous task for continuation
 * This provides all the info needed to continue working on the same branch/feature
 */
export async function getTaskContinuationContext(taskId: string): Promise<TaskContinuationContext | null> {
  if (!isDatabaseEnabled()) {
    return null;
  }

  const taskSql = `
    SELECT
      task_id,
      input_prompt,
      model,
      git_branch,
      repo_url,
      repos_json,
      summary
    FROM tasks
    WHERE task_id = ?
  `;

  const changesSql = `
    SELECT file_path, action, summary
    FROM task_changes
    WHERE task_id = ?
  `;

  const [tasks, changes] = await Promise.all([
    query<any[]>(taskSql, [taskId]),
    query<any[]>(changesSql, [taskId]),
  ]);

  if (!tasks || tasks.length === 0) {
    return null;
  }

  const task = tasks[0];

  return {
    task_id: task.task_id,
    original_prompt: task.input_prompt,
    model: task.model,
    git_branch: task.git_branch,
    repo_url: task.repo_url,
    repos_json: task.repos_json ? (typeof task.repos_json === 'string' ? JSON.parse(task.repos_json) : task.repos_json) : null,
    changes: changes || [],
    summary: task.summary,
  };
}
