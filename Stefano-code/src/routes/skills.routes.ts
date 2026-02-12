import type { FastifyInstance } from 'fastify';
import { loadAllSkills, getSkillById, saveSkill, deleteSkill, matchSkills } from '../services/skills.js';
import { createChildLogger } from '../utils/logger.js';

const logger = createChildLogger('skills-routes');

export async function skillsRoutes(fastify: FastifyInstance): Promise<void> {
  /**
   * GET /api/skills
   * List all skills
   */
  fastify.get('/api/skills', async (_request, reply) => {
    try {
      const skills = loadAllSkills();
      reply.send({
        success: true,
        skills: skills.map(s => ({
          id: s.id,
          name: s.name,
          description: s.description,
          triggers: s.triggers,
          category: s.category,
          autoActivate: s.autoActivate,
        })),
        total: skills.length,
      });
    } catch (error) {
      logger.error({ error }, 'Failed to list skills');
      reply.code(500).send({ success: false, error: 'Failed to list skills' });
    }
  });

  /**
   * GET /api/skills/:skillId
   * Get a specific skill with full content
   */
  fastify.get<{ Params: { skillId: string } }>('/api/skills/:skillId', async (request, reply) => {
    const { skillId } = request.params;

    try {
      const skill = getSkillById(skillId);
      if (!skill) {
        return reply.code(404).send({ success: false, error: 'Skill not found' });
      }

      reply.send({
        success: true,
        skill: {
          id: skill.id,
          name: skill.name,
          description: skill.description,
          triggers: skill.triggers,
          category: skill.category,
          autoActivate: skill.autoActivate,
          content: skill.content,
        },
      });
    } catch (error) {
      logger.error({ error, skillId }, 'Failed to get skill');
      reply.code(500).send({ success: false, error: 'Failed to get skill' });
    }
  });

  /**
   * POST /api/skills
   * Create a new skill
   */
  fastify.post<{
    Body: {
      id: string;
      name: string;
      description: string;
      triggers: string[];
      category: string;
      autoActivate?: boolean;
      content: string;
    };
  }>('/api/skills', async (request, reply) => {
    const { id, name, description, triggers, category, autoActivate, content } = request.body;

    if (!id || !name || !content) {
      return reply.code(400).send({
        success: false,
        error: 'id, name, and content are required',
      });
    }

    // Validate id format (alphanumeric + hyphens)
    if (!/^[a-z0-9-]+$/.test(id)) {
      return reply.code(400).send({
        success: false,
        error: 'ID must be lowercase alphanumeric with hyphens only',
      });
    }

    try {
      const skill = saveSkill(id, {
        name,
        description: description || '',
        triggers: triggers || [],
        category: category || 'general',
        autoActivate: autoActivate !== false,
        content,
      });

      reply.code(201).send({
        success: true,
        skill: {
          id: skill.id,
          name: skill.name,
          description: skill.description,
          triggers: skill.triggers,
          category: skill.category,
          autoActivate: skill.autoActivate,
        },
      });
    } catch (error) {
      logger.error({ error, id }, 'Failed to create skill');
      reply.code(500).send({ success: false, error: 'Failed to create skill' });
    }
  });

  /**
   * PUT /api/skills/:skillId
   * Update an existing skill
   */
  fastify.put<{
    Params: { skillId: string };
    Body: {
      name: string;
      description: string;
      triggers: string[];
      category: string;
      autoActivate?: boolean;
      content: string;
    };
  }>('/api/skills/:skillId', async (request, reply) => {
    const { skillId } = request.params;
    const { name, description, triggers, category, autoActivate, content } = request.body;

    try {
      const skill = saveSkill(skillId, {
        name,
        description: description || '',
        triggers: triggers || [],
        category: category || 'general',
        autoActivate: autoActivate !== false,
        content,
      });

      reply.send({
        success: true,
        skill: {
          id: skill.id,
          name: skill.name,
          description: skill.description,
          triggers: skill.triggers,
          category: skill.category,
          autoActivate: skill.autoActivate,
        },
      });
    } catch (error) {
      logger.error({ error, skillId }, 'Failed to update skill');
      reply.code(500).send({ success: false, error: 'Failed to update skill' });
    }
  });

  /**
   * DELETE /api/skills/:skillId
   * Delete a skill
   */
  fastify.delete<{ Params: { skillId: string } }>('/api/skills/:skillId', async (request, reply) => {
    const { skillId } = request.params;

    try {
      const deleted = deleteSkill(skillId);
      if (!deleted) {
        return reply.code(404).send({ success: false, error: 'Skill not found' });
      }

      reply.send({ success: true, message: 'Skill deleted' });
    } catch (error) {
      logger.error({ error, skillId }, 'Failed to delete skill');
      reply.code(500).send({ success: false, error: 'Failed to delete skill' });
    }
  });

  /**
   * POST /api/skills/match
   * Test which skills would be matched for a given prompt
   */
  fastify.post<{ Body: { prompt: string } }>('/api/skills/match', async (request, reply) => {
    const { prompt } = request.body;

    if (!prompt) {
      return reply.code(400).send({ success: false, error: 'prompt is required' });
    }

    try {
      const matched = matchSkills(prompt);
      reply.send({
        success: true,
        matched: matched.map(s => ({
          id: s.id,
          name: s.name,
          description: s.description,
          category: s.category,
        })),
      });
    } catch (error) {
      logger.error({ error }, 'Failed to match skills');
      reply.code(500).send({ success: false, error: 'Failed to match skills' });
    }
  });
}
