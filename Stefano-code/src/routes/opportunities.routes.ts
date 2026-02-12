import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { createChildLogger } from '../utils/logger.js';
import { isDatabaseEnabled } from '../services/database.js';
import {
  getOpportunityScanById,
  getOpportunityScanHistory,
  getActiveOpportunityScans,
  getOpportunityById,
  getOpportunitiesByScanId,
  getPendingOpportunities,
  getOpportunitiesByStatus,
  getOpportunityStats,
  updateOpportunityStatus,
} from '../repositories/opportunities.repository.js';
import {
  startOpportunityScan,
  getActiveScans,
  getActiveScan,
  cancelScan,
  approveOpportunity,
  rejectOpportunity,
} from '../services/opportunity-orchestrator.js';

const logger = createChildLogger('opportunities-routes');

// Validation schema for repo info
const repoInfoSchema = z.object({
  url: z.string().url('Invalid repository URL'),
  description: z.string().min(1, 'Description is required'),
  branch: z.string().optional(),
});

// Validation schema for scan request
const scanRequestSchema = z.object({
  repo_url: z.string().url('Invalid repository URL').optional(),
  repos: z.array(repoInfoSchema).optional(),
  focus_prompt: z.string().max(10000, 'Focus prompt is too long (max 10000 chars)').optional(),
  model: z.enum(['sonnet', 'opus', 'haiku']).optional(),
  min_opportunities: z.number().int().min(1).max(20).optional(),
  max_opportunities: z.number().int().min(1).max(50).optional(),
  language: z.enum(['es', 'en']).optional(),
});

// Validation schema for approve request
const approveRequestSchema = z.object({
  branch_name: z.string().optional(),
  model: z.enum(['sonnet', 'opus', 'haiku']).optional(),
});

// Validation schema for reject request
const rejectRequestSchema = z.object({
  reason: z.string().optional(),
});

type ScanRequestBody = z.infer<typeof scanRequestSchema>;
type ApproveRequestBody = z.infer<typeof approveRequestSchema>;
type RejectRequestBody = z.infer<typeof rejectRequestSchema>;

export async function opportunitiesRoutes(fastify: FastifyInstance): Promise<void> {
  // ===========================================
  // Scan Endpoints
  // ===========================================

  /**
   * POST /api/opportunities/scan
   * Start a new opportunity scan
   */
  fastify.post<{ Body: ScanRequestBody }>(
    '/api/opportunities/scan',
    async (request: FastifyRequest<{ Body: ScanRequestBody }>, reply: FastifyReply) => {
      if (!isDatabaseEnabled()) {
        reply.code(503).send({
          success: false,
          error: 'Database not enabled. Set DB_ENABLED=true in .env to use this endpoint.',
        });
        return;
      }

      // Validate request body
      const parseResult = scanRequestSchema.safeParse(request.body);

      if (!parseResult.success) {
        logger.warn({ errors: parseResult.error.issues }, 'Invalid scan request body');
        reply.code(400).send({
          success: false,
          error: 'Invalid request body',
          details: parseResult.error.issues,
        });
        return;
      }

      logger.info({
        repoUrl: parseResult.data.repo_url,
        repos: parseResult.data.repos?.length,
        focusPrompt: parseResult.data.focus_prompt?.substring(0, 100),
      }, 'Received opportunity scan request');

      try {
        const response = await startOpportunityScan(parseResult.data);

        if (response.success) {
          reply.code(202).send(response); // 202 Accepted - scan started
        } else {
          reply.code(500).send(response);
        }
      } catch (error) {
        logger.error({ error }, 'Unexpected error in scan endpoint');
        reply.code(500).send({
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }
  );

  /**
   * GET /api/opportunities/scans
   * Get scan history
   */
  fastify.get<{ Querystring: { limit?: string } }>(
    '/api/opportunities/scans',
    async (request, reply) => {
      if (!isDatabaseEnabled()) {
        reply.code(503).send({
          success: false,
          error: 'Database not enabled.',
        });
        return;
      }

      const limit = request.query.limit ? parseInt(request.query.limit, 10) : 50;

      try {
        const scans = await getOpportunityScanHistory(limit);
        reply.send({
          success: true,
          scans,
        });
      } catch (error) {
        logger.error({ error }, 'Failed to get scan history');
        reply.code(500).send({
          success: false,
          error: 'Failed to retrieve scan history',
        });
      }
    }
  );

  /**
   * GET /api/opportunities/scans/active
   * Get active/in-progress scans
   */
  fastify.get(
    '/api/opportunities/scans/active',
    async (_request, reply) => {
      try {
        const activeScans = getActiveScans();

        reply.send({
          success: true,
          count: activeScans.length,
          scans: activeScans.map((scan) => ({
            scan_id: scan.scanId,
            repo_url: scan.repoUrl,
            repos: scan.repos,
            focus_prompt: scan.focusPrompt,
            model: scan.model,
          })),
        });
      } catch (error) {
        logger.error({ error }, 'Failed to get active scans');
        reply.code(500).send({
          success: false,
          error: 'Failed to retrieve active scans',
        });
      }
    }
  );

  /**
   * GET /api/opportunities/scans/:scanId
   * Get details of a specific scan
   */
  fastify.get<{ Params: { scanId: string } }>(
    '/api/opportunities/scans/:scanId',
    async (request, reply) => {
      if (!isDatabaseEnabled()) {
        reply.code(503).send({
          success: false,
          error: 'Database not enabled.',
        });
        return;
      }

      const { scanId } = request.params;

      try {
        // Check if active first
        const activeScan = getActiveScan(scanId);
        if (activeScan) {
          reply.send({
            success: true,
            scan: {
              scan_id: activeScan.scanId,
              repo_url: activeScan.repoUrl,
              repos: activeScan.repos,
              focus_prompt: activeScan.focusPrompt,
              model: activeScan.model,
              status: 'in_progress',
            },
            is_active: true,
            opportunities: [],
          });
          return;
        }

        // Get from database
        const scan = await getOpportunityScanById(scanId);

        if (!scan) {
          reply.code(404).send({
            success: false,
            error: 'Scan not found',
          });
          return;
        }

        // Get opportunities for this scan
        const opportunities = await getOpportunitiesByScanId(scanId);

        reply.send({
          success: true,
          scan,
          is_active: false,
          opportunities,
        });
      } catch (error) {
        logger.error({ error, scanId }, 'Failed to get scan details');
        reply.code(500).send({
          success: false,
          error: 'Failed to retrieve scan details',
        });
      }
    }
  );

  /**
   * DELETE /api/opportunities/scans/:scanId
   * Cancel an active scan
   */
  fastify.delete<{ Params: { scanId: string } }>(
    '/api/opportunities/scans/:scanId',
    async (request, reply) => {
      const { scanId } = request.params;

      const cancelled = await cancelScan(scanId);

      if (cancelled) {
        reply.send({
          success: true,
          message: 'Scan cancelled',
        });
      } else {
        reply.code(404).send({
          success: false,
          error: 'Scan not found or already completed',
        });
      }
    }
  );

  // ===========================================
  // Opportunity Endpoints
  // ===========================================

  /**
   * GET /api/opportunities
   * Get opportunities with optional status filter
   */
  fastify.get<{ Querystring: { status?: string; limit?: string } }>(
    '/api/opportunities',
    async (request, reply) => {
      if (!isDatabaseEnabled()) {
        reply.code(503).send({
          success: false,
          error: 'Database not enabled.',
        });
        return;
      }

      const { status, limit: limitStr } = request.query;
      const limit = limitStr ? parseInt(limitStr, 10) : 100;

      try {
        let opportunities;
        if (status) {
          opportunities = await getOpportunitiesByStatus(
            status as 'pending' | 'approved' | 'rejected' | 'in_progress' | 'completed' | 'failed',
            limit
          );
        } else {
          opportunities = await getPendingOpportunities(limit);
        }

        reply.send({
          success: true,
          opportunities,
        });
      } catch (error) {
        logger.error({ error }, 'Failed to get opportunities');
        reply.code(500).send({
          success: false,
          error: 'Failed to retrieve opportunities',
        });
      }
    }
  );

  /**
   * GET /api/opportunities/stats
   * Get opportunity statistics
   */
  fastify.get(
    '/api/opportunities/stats',
    async (_request, reply) => {
      if (!isDatabaseEnabled()) {
        reply.code(503).send({
          success: false,
          error: 'Database not enabled.',
        });
        return;
      }

      try {
        const stats = await getOpportunityStats();
        reply.send({
          success: true,
          stats,
        });
      } catch (error) {
        logger.error({ error }, 'Failed to get opportunity stats');
        reply.code(500).send({
          success: false,
          error: 'Failed to retrieve statistics',
        });
      }
    }
  );

  /**
   * GET /api/opportunities/:opportunityId
   * Get details of a specific opportunity
   */
  fastify.get<{ Params: { opportunityId: string } }>(
    '/api/opportunities/:opportunityId',
    async (request, reply) => {
      if (!isDatabaseEnabled()) {
        reply.code(503).send({
          success: false,
          error: 'Database not enabled.',
        });
        return;
      }

      const { opportunityId } = request.params;

      try {
        const opportunity = await getOpportunityById(opportunityId);

        if (!opportunity) {
          reply.code(404).send({
            success: false,
            error: 'Opportunity not found',
          });
          return;
        }

        reply.send({
          success: true,
          opportunity,
        });
      } catch (error) {
        logger.error({ error, opportunityId }, 'Failed to get opportunity');
        reply.code(500).send({
          success: false,
          error: 'Failed to retrieve opportunity',
        });
      }
    }
  );

  /**
   * POST /api/opportunities/:opportunityId/approve
   * Approve an opportunity and create a task to implement it
   */
  fastify.post<{ Params: { opportunityId: string }; Body: ApproveRequestBody }>(
    '/api/opportunities/:opportunityId/approve',
    async (request, reply) => {
      if (!isDatabaseEnabled()) {
        reply.code(503).send({
          success: false,
          error: 'Database not enabled.',
        });
        return;
      }

      const { opportunityId } = request.params;

      // Validate body if present
      let branchName: string | undefined;
      let model: 'sonnet' | 'opus' | 'haiku' | undefined;

      if (request.body) {
        const parseResult = approveRequestSchema.safeParse(request.body);
        if (!parseResult.success) {
          reply.code(400).send({
            success: false,
            error: 'Invalid request body',
            details: parseResult.error.issues,
          });
          return;
        }
        branchName = parseResult.data.branch_name;
        model = parseResult.data.model;
      }

      try {
        const result = await approveOpportunity(opportunityId, branchName, model);

        if (result.success) {
          reply.code(202).send({
            success: true,
            opportunity_id: opportunityId,
            task_id: result.task_id,
            message: 'Opportunity approved and task started',
          });
        } else {
          reply.code(400).send({
            success: false,
            error: result.error,
          });
        }
      } catch (error) {
        logger.error({ error, opportunityId }, 'Failed to approve opportunity');
        reply.code(500).send({
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }
  );

  /**
   * POST /api/opportunities/:opportunityId/reject
   * Reject an opportunity
   */
  fastify.post<{ Params: { opportunityId: string }; Body: RejectRequestBody }>(
    '/api/opportunities/:opportunityId/reject',
    async (request, reply) => {
      if (!isDatabaseEnabled()) {
        reply.code(503).send({
          success: false,
          error: 'Database not enabled.',
        });
        return;
      }

      const { opportunityId } = request.params;

      let reason: string | undefined;
      if (request.body) {
        const parseResult = rejectRequestSchema.safeParse(request.body);
        if (parseResult.success) {
          reason = parseResult.data.reason;
        }
      }

      try {
        const rejected = await rejectOpportunity(opportunityId, reason);

        if (rejected) {
          reply.send({
            success: true,
            message: 'Opportunity rejected',
          });
        } else {
          reply.code(400).send({
            success: false,
            error: 'Could not reject opportunity. It may not exist or is not in pending status.',
          });
        }
      } catch (error) {
        logger.error({ error, opportunityId }, 'Failed to reject opportunity');
        reply.code(500).send({
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }
  );

  // ===========================================
  // Alias Routes for Frontend Compatibility
  // ===========================================

  /**
   * GET /api/opportunities/research (alias for /api/opportunities/scans)
   */
  fastify.get<{ Querystring: { limit?: string } }>(
    '/api/opportunities/research',
    async (request, reply) => {
      if (!isDatabaseEnabled()) {
        reply.code(503).send({
          success: false,
          error: 'Database not enabled.',
        });
        return;
      }

      const limit = request.query.limit ? parseInt(request.query.limit, 10) : 50;

      try {
        const scans = await getOpportunityScanHistory(limit);
        reply.send({
          success: true,
          scans,
        });
      } catch (error) {
        logger.error({ error }, 'Failed to get scan history');
        reply.code(500).send({
          success: false,
          error: 'Failed to retrieve scan history',
        });
      }
    }
  );

  /**
   * GET /api/opportunities/research/active (alias for /api/opportunities/scans/active)
   */
  fastify.get(
    '/api/opportunities/research/active',
    async (_request, reply) => {
      try {
        const activeScans = getActiveScans();

        reply.send({
          success: true,
          count: activeScans.length,
          scans: activeScans.map((scan) => ({
            scan_id: scan.scanId,
            repo_url: scan.repoUrl,
            repos: scan.repos,
            focus_prompt: scan.focusPrompt,
            model: scan.model,
          })),
        });
      } catch (error) {
        logger.error({ error }, 'Failed to get active scans');
        reply.code(500).send({
          success: false,
          error: 'Failed to retrieve active scans',
        });
      }
    }
  );

  // ===========================================
  // Reset opportunity status (for stuck opportunities)
  // ===========================================
  fastify.post<{ Params: { opportunityId: string } }>(
    '/api/opportunities/:opportunityId/reset',
    async (request, reply) => {
      try {
        const { opportunityId } = request.params;

        const opportunity = await getOpportunityById(opportunityId);
        if (!opportunity) {
          return reply.code(404).send({ success: false, error: 'Opportunity not found' });
        }

        await updateOpportunityStatus(opportunityId, 'pending');

        reply.send({
          success: true,
          message: `Opportunity ${opportunityId} reset to pending`,
        });
      } catch (error) {
        logger.error({ error }, 'Failed to reset opportunity');
        reply.code(500).send({
          success: false,
          error: 'Failed to reset opportunity',
        });
      }
    }
  );
}
