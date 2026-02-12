import { v4 as uuidv4 } from 'uuid';

import { createChildLogger } from '../utils/logger.js';
import { config } from '../config.js';
import type {
  OpportunityScanRequest,
  OpportunityScanResponse,
  OpportunityScanPipelineState,
  OpportunityScan,
  Opportunity,
  ModelType,
  TokenUsage,
  ClonedRepoInfo,
  RepoInfo,
  OpportunityLanguage,
} from '../types/index.js';
import {
  createOpportunityScan,
  updateOpportunityScanStatus,
  updateOpportunityScanError,
  updateOpportunityScanTokens,
  createOpportunity,
  updateOpportunityStatus,
  getOpportunityById,
} from '../repositories/opportunities.repository.js';
import { runOpportunityFinderAgent } from '../agents/opportunity-finder.agent.js';
import { runPipeline } from './orchestrator.js';

const logger = createChildLogger('opportunity-orchestrator');

// In-memory tracking of active scans
const activeScans = new Map<string, OpportunityScanPipelineState>();

/**
 * Get active scans from memory
 */
export function getActiveScans(): OpportunityScanPipelineState[] {
  return Array.from(activeScans.values());
}

/**
 * Get a specific active scan
 */
export function getActiveScan(scanId: string): OpportunityScanPipelineState | undefined {
  return activeScans.get(scanId);
}

/**
 * Start an opportunity scan
 */
export async function startOpportunityScan(
  request: OpportunityScanRequest
): Promise<OpportunityScanResponse> {
  const scanId = uuidv4();
  const model: ModelType = request.model || config.defaultModel;
  const minOpportunities = request.min_opportunities || 5;
  const maxOpportunities = request.max_opportunities || 10;
  const language: OpportunityLanguage = request.language || 'es';

  logger.info({
    scanId,
    repoUrl: request.repo_url,
    repos: request.repos?.length,
    focusPrompt: request.focus_prompt?.substring(0, 100),
    model,
    language,
  }, 'Starting opportunity scan');

  // Use target project path (the actual project code, not the monorepo root)
  const workspacePath = config.targetProjectPath;

  // Initialize state
  const state: OpportunityScanPipelineState = {
    scanId,
    model,
    workspacePath,
    repoUrl: request.repo_url,
    repos: [],
    focusPrompt: request.focus_prompt,
    minOpportunities,
    maxOpportunities,
    tokensUsed: {
      total_input: 0,
      total_output: 0,
      total: 0,
      by_agent: {},
    },
    language,
  };

  activeScans.set(scanId, state);

  try {
    // Save to database
    await createOpportunityScan(
      scanId,
      request.repo_url || null,
      request.repos || null,
      request.focus_prompt || null,
      model
    );

    // Start scan asynchronously
    runScanAsync(state, request).catch((error) => {
      logger.error({ error, scanId }, 'Opportunity scan failed');
    });

    return {
      success: true,
      scan_id: scanId,
      status: 'pending',
    };
  } catch (error) {
    logger.error({ error, scanId }, 'Failed to start opportunity scan');
    activeScans.delete(scanId);

    return {
      success: false,
      scan_id: scanId,
      status: 'failed',
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Run the scan process asynchronously
 */
async function runScanAsync(
  state: OpportunityScanPipelineState,
  request: OpportunityScanRequest
): Promise<void> {
  const { scanId, workspacePath, model } = state;

  try {
    // Update status to in_progress
    await updateOpportunityScanStatus(scanId, 'in_progress', 10);

    // Use target project path (the actual project code, not the monorepo root)
    state.workspacePath = config.targetProjectPath;
    state.repos = [{
      path: '.',
      url: `local:${config.targetProjectPath}`,
      description: 'Target project',
      branch: 'main',
    }];

    await updateOpportunityScanStatus(scanId, 'in_progress', 30);

    // Run the opportunity finder agent
    logger.info({ scanId }, 'Running opportunity finder agent');
    const result = await runOpportunityFinderAgent(state);

    await updateOpportunityScanStatus(scanId, 'in_progress', 80);

    // Save opportunities to database
    for (const opp of result.opportunities) {
      const opportunityId = uuidv4();
      await createOpportunity(opportunityId, scanId, {
        title: opp.title,
        description: opp.description,
        category: opp.category,
        priority: opp.priority,
        prompt: opp.prompt,
        affected_files: opp.affected_files,
        estimated_complexity: opp.estimated_complexity,
        reasoning: opp.reasoning,
        source_type: opp.source_type,
        external_reference: opp.external_reference,
        repo_url: request.repo_url,
        repos_json: request.repos,
        tags: opp.tags,
      });
    }

    // Update final status
    await updateOpportunityScanStatus(
      scanId,
      'completed',
      100,
      result.opportunities.length
    );

    logger.info({
      scanId,
      opportunitiesFound: result.opportunities.length,
      summary: result.summary,
    }, 'Opportunity scan completed');

  } catch (error) {
    logger.error({ error, scanId }, 'Opportunity scan error');

    await updateOpportunityScanError(
      scanId,
      error instanceof Error ? error.message : 'Unknown error'
    );
  } finally {
    // Remove from active scans
    activeScans.delete(scanId);
  }
}

/**
 * Cancel an active scan
 */
export async function cancelScan(scanId: string): Promise<boolean> {
  const scan = activeScans.get(scanId);
  if (!scan) {
    return false;
  }

  // Update status to cancelled
  await updateOpportunityScanStatus(scanId, 'cancelled');

  activeScans.delete(scanId);

  logger.info({ scanId }, 'Opportunity scan cancelled');
  return true;
}

/**
 * Approve an opportunity and create a task to implement it
 */
export async function approveOpportunity(
  opportunityId: string,
  branchName?: string,
  model?: ModelType
): Promise<{ success: boolean; task_id?: string; error?: string }> {
  logger.info({ opportunityId, branchName, model }, 'Approving opportunity');

  // Get the opportunity
  const opportunity = await getOpportunityById(opportunityId);
  if (!opportunity) {
    return { success: false, error: 'Opportunity not found' };
  }

  if (opportunity.status !== 'pending') {
    return { success: false, error: `Opportunity is already ${opportunity.status}` };
  }

  try {
    // Update status to approved
    await updateOpportunityStatus(opportunityId, 'approved');

    // Prepare the task request
    const taskRequest = {
      prompt: opportunity.prompt,
      repo_url: opportunity.repo_url || undefined,
      repos: opportunity.repos_json || undefined,
      model: model || (opportunity.scan_id ? undefined : 'sonnet'),
      create_branch: true,
      auto_commit: true,
      create_pr: false,
      pipeline_mode: 'auto' as const,
    };

    // Update status to in_progress
    await updateOpportunityStatus(opportunityId, 'in_progress');

    // Run the task
    const taskResult = await runPipeline(taskRequest);

    if (taskResult.success) {
      // Update opportunity with task ID and mark as completed
      await updateOpportunityStatus(opportunityId, 'completed', taskResult.task_id);

      logger.info({
        opportunityId,
        taskId: taskResult.task_id,
      }, 'Opportunity implemented successfully');

      return { success: true, task_id: taskResult.task_id };
    } else {
      // Mark as failed
      await updateOpportunityStatus(opportunityId, 'failed', taskResult.task_id);

      return {
        success: false,
        task_id: taskResult.task_id,
        error: taskResult.error || 'Task failed',
      };
    }
  } catch (error) {
    logger.error({ error, opportunityId }, 'Failed to approve opportunity');

    // Update status back to pending on error
    await updateOpportunityStatus(opportunityId, 'pending');

    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Reject an opportunity
 */
export async function rejectOpportunity(
  opportunityId: string,
  reason?: string
): Promise<boolean> {
  logger.info({ opportunityId, reason }, 'Rejecting opportunity');

  const opportunity = await getOpportunityById(opportunityId);
  if (!opportunity) {
    return false;
  }

  if (opportunity.status !== 'pending') {
    return false;
  }

  await updateOpportunityStatus(opportunityId, 'rejected', undefined, reason);

  return true;
}
