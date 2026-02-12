import { query, insert, isDatabaseEnabled } from '../services/database.js';
import { createChildLogger } from '../utils/logger.js';
import type {
  OpportunityScan,
  OpportunityScanStatus,
  Opportunity,
  OpportunityStatus,
  OpportunityCategory,
  OpportunityPriority,
  OpportunityComplexity,
  OpportunitySourceType,
  RepoInfo,
} from '../types/index.js';

const logger = createChildLogger('opportunities-repository');

// ===========================================
// Opportunity Scans
// ===========================================

/**
 * Create a new opportunity scan
 */
export async function createOpportunityScan(
  scanId: string,
  repoUrl: string | null,
  reposJson: RepoInfo[] | null,
  focusPrompt: string | null,
  model: string
): Promise<void> {
  if (!isDatabaseEnabled()) {
    return;
  }

  try {
    await insert(
      `INSERT INTO opportunity_scans
        (scan_id, repo_url, repos_json, focus_prompt, model)
       VALUES (?, ?, ?, ?, ?)`,
      [scanId, repoUrl, reposJson ? JSON.stringify(reposJson) : null, focusPrompt, model]
    );

    logger.info({ scanId }, 'Opportunity scan created');
  } catch (error) {
    logger.error({ error, scanId }, 'Failed to create opportunity scan');
    throw error;
  }
}

/**
 * Update opportunity scan status
 */
export async function updateOpportunityScanStatus(
  scanId: string,
  status: OpportunityScanStatus,
  progress?: number,
  opportunitiesFound?: number
): Promise<void> {
  if (!isDatabaseEnabled()) {
    return;
  }

  try {
    const updates: string[] = ['status = ?'];
    const params: (string | number | null)[] = [status];

    if (progress !== undefined) {
      updates.push('progress = ?');
      params.push(progress);
    }

    if (opportunitiesFound !== undefined) {
      updates.push('opportunities_found = ?');
      params.push(opportunitiesFound);
    }

    if (status === 'in_progress') {
      updates.push('started_at = CURRENT_TIMESTAMP');
    }

    if (status === 'completed' || status === 'failed' || status === 'cancelled') {
      updates.push('completed_at = CURRENT_TIMESTAMP');
    }

    params.push(scanId);

    await query(
      `UPDATE opportunity_scans SET ${updates.join(', ')} WHERE scan_id = ?`,
      params
    );
  } catch (error) {
    logger.error({ error, scanId }, 'Failed to update opportunity scan status');
    throw error;
  }
}

/**
 * Update opportunity scan error
 */
export async function updateOpportunityScanError(
  scanId: string,
  errorMessage: string
): Promise<void> {
  if (!isDatabaseEnabled()) {
    return;
  }

  try {
    await query(
      `UPDATE opportunity_scans SET
        status = 'failed',
        error_message = ?,
        completed_at = CURRENT_TIMESTAMP
       WHERE scan_id = ?`,
      [errorMessage, scanId]
    );
  } catch (error) {
    logger.error({ error, scanId }, 'Failed to update opportunity scan error');
    throw error;
  }
}

/**
 * Update opportunity scan tokens
 */
export async function updateOpportunityScanTokens(
  scanId: string,
  inputTokens: number,
  outputTokens: number
): Promise<void> {
  if (!isDatabaseEnabled()) {
    return;
  }

  try {
    await query(
      `UPDATE opportunity_scans SET
        total_input_tokens = total_input_tokens + ?,
        total_output_tokens = total_output_tokens + ?,
        total_tokens = total_tokens + ?
       WHERE scan_id = ?`,
      [inputTokens, outputTokens, inputTokens + outputTokens, scanId]
    );
  } catch (error) {
    logger.error({ error, scanId }, 'Failed to update opportunity scan tokens');
    throw error;
  }
}

/**
 * Get opportunity scan by ID
 */
export async function getOpportunityScanById(scanId: string): Promise<OpportunityScan | null> {
  if (!isDatabaseEnabled()) {
    return null;
  }

  try {
    const rows = await query<any[]>(
      `SELECT * FROM opportunity_scans WHERE scan_id = ?`,
      [scanId]
    );

    if (!rows || rows.length === 0) {
      return null;
    }

    return mapOpportunityScan(rows[0]);
  } catch (error) {
    logger.error({ error, scanId }, 'Failed to get opportunity scan by ID');
    throw error;
  }
}

/**
 * Get opportunity scan history
 */
export async function getOpportunityScanHistory(limit: number = 50): Promise<OpportunityScan[]> {
  if (!isDatabaseEnabled()) {
    return [];
  }

  try {
    const rows = await query<any[]>(
      `SELECT * FROM opportunity_scans ORDER BY created_at DESC LIMIT ?`,
      [limit]
    );

    if (!rows) return [];
    return rows.map(mapOpportunityScan);
  } catch (error) {
    logger.error({ error }, 'Failed to get opportunity scan history');
    throw error;
  }
}

/**
 * Get active opportunity scans
 */
export async function getActiveOpportunityScans(): Promise<OpportunityScan[]> {
  if (!isDatabaseEnabled()) {
    return [];
  }

  try {
    const rows = await query<any[]>(
      `SELECT * FROM opportunity_scans WHERE status IN ('pending', 'in_progress') ORDER BY created_at`
    );

    if (!rows) return [];
    return rows.map(mapOpportunityScan);
  } catch (error) {
    logger.error({ error }, 'Failed to get active opportunity scans');
    throw error;
  }
}

// ===========================================
// Opportunities
// ===========================================

/**
 * Create a new opportunity
 */
export async function createOpportunity(
  opportunityId: string,
  scanId: string,
  data: {
    title: string;
    description: string;
    category: OpportunityCategory;
    priority: OpportunityPriority;
    prompt: string;
    affected_files?: string[];
    estimated_complexity: OpportunityComplexity;
    reasoning?: string;
    source_type: OpportunitySourceType;
    external_reference?: string;
    repo_url?: string;
    repos_json?: RepoInfo[];
    tags?: string[];
  }
): Promise<void> {
  if (!isDatabaseEnabled()) {
    return;
  }

  try {
    await insert(
      `INSERT INTO opportunities
        (opportunity_id, scan_id, title, description, category, priority, prompt,
         affected_files, estimated_complexity, reasoning, source_type, external_reference,
         repo_url, repos_json, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        opportunityId,
        scanId,
        data.title,
        data.description,
        data.category || 'general',
        data.priority || 'medium',
        data.prompt || '',
        data.affected_files ? JSON.stringify(data.affected_files) : null,
        data.estimated_complexity || 'moderate',
        data.reasoning || null,
        data.source_type || 'code_analysis',
        data.external_reference || null,
        data.repo_url || null,
        data.repos_json ? JSON.stringify(data.repos_json) : null,
        'pending', // Explicitly set status to 'pending'
      ]
    );

    // Insert tags if provided
    if (data.tags && data.tags.length > 0) {
      for (const tag of data.tags) {
        await insert(
          `INSERT INTO opportunity_tags (opportunity_id, tag) VALUES (?, ?)`,
          [opportunityId, tag]
        );
      }
    }

    logger.info({ opportunityId, scanId, title: data.title }, 'Opportunity created');
  } catch (error) {
    logger.error({ error, opportunityId, scanId }, 'Failed to create opportunity');
    throw error;
  }
}

/**
 * Update opportunity status
 */
export async function updateOpportunityStatus(
  opportunityId: string,
  status: OpportunityStatus,
  taskId?: string,
  rejectionReason?: string
): Promise<void> {
  if (!isDatabaseEnabled()) {
    return;
  }

  try {
    const updates: string[] = ['status = ?', 'updated_at = CURRENT_TIMESTAMP'];
    const params: (string | null)[] = [status];

    if (status === 'approved') {
      updates.push('approved_at = CURRENT_TIMESTAMP');
    }

    if (status === 'rejected') {
      updates.push('rejected_at = CURRENT_TIMESTAMP');
      updates.push('rejection_reason = ?');
      params.push(rejectionReason || null);
    }

    if (taskId) {
      updates.push('task_id = ?');
      params.push(taskId);
    }

    params.push(opportunityId);

    await query(
      `UPDATE opportunities SET ${updates.join(', ')} WHERE opportunity_id = ?`,
      params
    );

    logger.info({ opportunityId, status, taskId }, 'Opportunity status updated');
  } catch (error) {
    logger.error({ error, opportunityId }, 'Failed to update opportunity status');
    throw error;
  }
}

/**
 * Get opportunity by ID
 */
export async function getOpportunityById(opportunityId: string): Promise<Opportunity | null> {
  if (!isDatabaseEnabled()) {
    return null;
  }

  try {
    const rows = await query<any[]>(
      `SELECT * FROM opportunities WHERE opportunity_id = ?`,
      [opportunityId]
    );

    if (!rows || rows.length === 0) {
      return null;
    }

    // Get tags
    const tagRows = await query<any[]>(
      `SELECT tag FROM opportunity_tags WHERE opportunity_id = ?`,
      [opportunityId]
    );
    const tags = tagRows ? tagRows.map((r: any) => r.tag as string) : [];

    return mapOpportunity(rows[0], tags);
  } catch (error) {
    logger.error({ error, opportunityId }, 'Failed to get opportunity by ID');
    throw error;
  }
}

/**
 * Get opportunities by scan ID
 */
export async function getOpportunitiesByScanId(scanId: string): Promise<Opportunity[]> {
  if (!isDatabaseEnabled()) {
    return [];
  }

  try {
    const rows = await query<any[]>(
      `SELECT o.* FROM opportunities o WHERE o.scan_id = ? ORDER BY o.created_at`,
      [scanId]
    );

    if (!rows) return [];

    // Get tags for all opportunities
    const opportunities: Opportunity[] = [];
    for (const row of rows) {
      const tagRows = await query<any[]>(
        `SELECT tag FROM opportunity_tags WHERE opportunity_id = ?`,
        [row.opportunity_id]
      );
      const tags = tagRows ? tagRows.map((r: any) => r.tag as string) : [];
      opportunities.push(mapOpportunity(row, tags));
    }

    return opportunities;
  } catch (error) {
    logger.error({ error, scanId }, 'Failed to get opportunities by scan ID');
    throw error;
  }
}

/**
 * Get all pending opportunities
 */
export async function getPendingOpportunities(limit: number = 100): Promise<Opportunity[]> {
  if (!isDatabaseEnabled()) {
    return [];
  }

  try {
    const rows = await query<any[]>(
      `SELECT o.* FROM opportunities o WHERE o.status = 'pending' ORDER BY o.created_at LIMIT ?`,
      [limit]
    );

    if (!rows) return [];

    // Get tags for all opportunities
    const opportunities: Opportunity[] = [];
    for (const row of rows) {
      const tagRows = await query<any[]>(
        `SELECT tag FROM opportunity_tags WHERE opportunity_id = ?`,
        [row.opportunity_id]
      );
      const tags = tagRows ? tagRows.map((r: any) => r.tag as string) : [];
      opportunities.push(mapOpportunity(row, tags));
    }

    return opportunities;
  } catch (error) {
    logger.error({ error }, 'Failed to get pending opportunities');
    throw error;
  }
}

/**
 * Get opportunities by status
 */
export async function getOpportunitiesByStatus(
  status: OpportunityStatus,
  limit: number = 100
): Promise<Opportunity[]> {
  if (!isDatabaseEnabled()) {
    return [];
  }

  try {
    const rows = await query<any[]>(
      `SELECT o.* FROM opportunities o WHERE o.status = ? ORDER BY o.updated_at DESC LIMIT ?`,
      [status, limit]
    );

    if (!rows) return [];

    // Get tags for all opportunities
    const opportunities: Opportunity[] = [];
    for (const row of rows) {
      const tagRows = await query<any[]>(
        `SELECT tag FROM opportunity_tags WHERE opportunity_id = ?`,
        [row.opportunity_id]
      );
      const tags = tagRows ? tagRows.map((r: any) => r.tag as string) : [];
      opportunities.push(mapOpportunity(row, tags));
    }

    return opportunities;
  } catch (error) {
    logger.error({ error, status }, 'Failed to get opportunities by status');
    throw error;
  }
}

/**
 * Get opportunity statistics
 */
export async function getOpportunityStats(): Promise<{
  total: number;
  pending: number;
  approved: number;
  rejected: number;
  in_progress: number;
  completed: number;
  failed: number;
  by_category: Record<string, number>;
  by_priority: Record<string, number>;
}> {
  if (!isDatabaseEnabled()) {
    return {
      total: 0,
      pending: 0,
      approved: 0,
      rejected: 0,
      in_progress: 0,
      completed: 0,
      failed: 0,
      by_category: {},
      by_priority: {},
    };
  }

  try {
    // Get status counts
    const statusRows = await query<any[]>(
      `SELECT status, COUNT(*) as count FROM opportunities GROUP BY status`
    );

    const statusCounts: Record<string, number> = {};
    if (statusRows) {
      statusRows.forEach((row: any) => {
        statusCounts[row.status as string] = Number(row.count);
      });
    }

    // Get category counts
    const categoryRows = await query<any[]>(
      `SELECT category, COUNT(*) as count FROM opportunities GROUP BY category`
    );

    const categoryCounts: Record<string, number> = {};
    if (categoryRows) {
      categoryRows.forEach((row: any) => {
        categoryCounts[row.category as string] = Number(row.count);
      });
    }

    // Get priority counts
    const priorityRows = await query<any[]>(
      `SELECT priority, COUNT(*) as count FROM opportunities GROUP BY priority`
    );

    const priorityCounts: Record<string, number> = {};
    if (priorityRows) {
      priorityRows.forEach((row: any) => {
        priorityCounts[row.priority as string] = Number(row.count);
      });
    }

    const total = Object.values(statusCounts).reduce((a, b) => a + b, 0);

    return {
      total,
      pending: statusCounts['pending'] || 0,
      approved: statusCounts['approved'] || 0,
      rejected: statusCounts['rejected'] || 0,
      in_progress: statusCounts['in_progress'] || 0,
      completed: statusCounts['completed'] || 0,
      failed: statusCounts['failed'] || 0,
      by_category: categoryCounts,
      by_priority: priorityCounts,
    };
  } catch (error) {
    logger.error({ error }, 'Failed to get opportunity stats');
    throw error;
  }
}

// ===========================================
// Helper Functions
// ===========================================

function mapOpportunityScan(row: any): OpportunityScan {
  return {
    scan_id: row.scan_id,
    repo_url: row.repo_url,
    repos_json: row.repos_json ? (typeof row.repos_json === 'string' ? JSON.parse(row.repos_json) : row.repos_json) : null,
    focus_prompt: row.focus_prompt,
    model: row.model,
    status: row.status,
    progress: row.progress,
    opportunities_found: row.opportunities_found,
    error_message: row.error_message,
    total_input_tokens: row.total_input_tokens,
    total_output_tokens: row.total_output_tokens,
    total_tokens: row.total_tokens,
    created_at: row.created_at?.toISOString?.() || row.created_at,
    started_at: row.started_at?.toISOString?.() || row.started_at || null,
    completed_at: row.completed_at?.toISOString?.() || row.completed_at || null,
  };
}

function mapOpportunity(row: any, tags: string[]): Opportunity {
  return {
    opportunity_id: row.opportunity_id,
    scan_id: row.scan_id,
    title: row.title,
    description: row.description,
    category: row.category,
    priority: row.priority,
    prompt: row.prompt,
    affected_files: row.affected_files ? (typeof row.affected_files === 'string' ? JSON.parse(row.affected_files) : row.affected_files) : null,
    estimated_complexity: row.estimated_complexity,
    reasoning: row.reasoning,
    source_type: row.source_type,
    external_reference: row.external_reference,
    repo_url: row.repo_url,
    repos_json: row.repos_json ? (typeof row.repos_json === 'string' ? JSON.parse(row.repos_json) : row.repos_json) : null,
    status: row.status,
    approved_at: row.approved_at?.toISOString?.() || row.approved_at || null,
    rejected_at: row.rejected_at?.toISOString?.() || row.rejected_at || null,
    rejection_reason: row.rejection_reason,
    task_id: row.task_id,
    tags,
    created_at: row.created_at?.toISOString?.() || row.created_at,
    updated_at: row.updated_at?.toISOString?.() || row.updated_at,
  };
}
