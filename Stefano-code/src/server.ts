import Fastify from 'fastify';
import fastifyStatic from '@fastify/static';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { taskRoutes } from './routes/task.routes.js';
import { opportunitiesRoutes } from './routes/opportunities.routes.js';
import { projectRoutes } from './routes/project.routes.js';
import { skillsRoutes } from './routes/skills.routes.js';
import { config } from './config.js';
import { logger } from './utils/logger.js';
import { initDatabase, closeDatabase, isDatabaseEnabled } from './services/database.js';
import { validateClaudeCLI } from './services/claude-runner.js';
import { markInterruptedTasks, persistShutdownState } from './services/task-persistence.js';
import { getActiveTasks } from './services/task-tracker.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

export async function buildServer() {
  const fastify = Fastify({
    logger: false,
  });

  // Serve built frontend (static files)
  try {
    await fastify.register(fastifyStatic, {
      root: join(__dirname, '../client/dist'),
      prefix: '/',
      wildcard: true,
      decorateReply: true,
    });
  } catch {
    logger.warn('Frontend build not found. Run "npm run build:client" to serve the dashboard.');
  }

  // Request logging
  fastify.addHook('onRequest', async (request) => {
    if (!request.url.startsWith('/assets/')) {
      logger.debug(
        { method: request.method, url: request.url },
        'Incoming request'
      );
    }
  });

  // Error handler
  fastify.setErrorHandler((error: Error, request, reply) => {
    logger.error(
      { error, method: request.method, url: request.url },
      'Request error'
    );

    reply.code(500).send({
      success: false,
      error: error.message || 'Internal server error',
    });
  });

  // Register API routes
  await fastify.register(taskRoutes);
  await fastify.register(opportunitiesRoutes);
  await fastify.register(projectRoutes);
  await fastify.register(skillsRoutes);

  // SPA fallback - serve index.html for non-API routes
  fastify.setNotFoundHandler((request, reply) => {
    if (!request.url.startsWith('/api/')) {
      return reply.sendFile('index.html');
    }
    reply.code(404).send({ success: false, error: 'Not found' });
  });

  return fastify;
}

export async function startServer() {
  const server = await buildServer();

  try {
    // Validate Claude CLI is available
    const cliAvailable = await validateClaudeCLI();
    if (!cliAvailable) {
      logger.warn('Claude CLI not found - task execution will fail. Install with: npm install -g @anthropic-ai/claude-code');
    }

    // Initialize database if enabled
    if (config.database.enabled) {
      await initDatabase();
      logger.info({ database: config.database.name }, 'Database connection initialized');

      // Mark any tasks from a previous crash as interrupted
      const interruptedCount = await markInterruptedTasks();
      if (interruptedCount > 0) {
        logger.info({ count: interruptedCount }, 'Recovered interrupted tasks from previous session');
      }
    }

    await server.listen({ port: config.port, host: '0.0.0.0' });

    const dbStatus = config.database.enabled
      ? `${config.database.host}:${config.database.port}/${config.database.name}`
      : 'disabled';

    console.log(`
╔══════════════════════════════════════════════════════════════╗
║                 AGX — AI Development Tool                     ║
╠══════════════════════════════════════════════════════════════╣
║  Dashboard:    http://localhost:${config.port.toString().padEnd(32)}║
║  Git Root:     ${config.projectRoot.substring(0, 42).padEnd(43)}║
║  Project:      ${config.targetProjectPath.substring(0, 42).padEnd(43)}║
║  Model:        ${config.defaultModel.padEnd(42)}║
║  Database:     ${dbStatus.substring(0, 43).padEnd(43)}║
╚══════════════════════════════════════════════════════════════╝
`);

    // Graceful shutdown
    let isShuttingDown = false;
    const shutdown = async () => {
      if (isShuttingDown) return; // Prevent double shutdown
      isShuttingDown = true;

      logger.info('Shutting down...');

      // Persist state of running tasks before closing
      if (isDatabaseEnabled()) {
        const active = getActiveTasks();
        if (active.length > 0) {
          logger.info({ count: active.length }, 'Saving state of active tasks before shutdown...');
          await persistShutdownState(
            active.map(t => ({
              taskId: t.taskId,
              currentStage: t.currentStage,
              stagesCompleted: t.stagesCompleted,
            }))
          );
        }
      }

      await server.close();
      if (isDatabaseEnabled()) {
        await closeDatabase();
      }
      process.exit(0);
    };

    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);

    return server;
  } catch (error) {
    logger.fatal({ error }, 'Failed to start server');
    process.exit(1);
  }
}
