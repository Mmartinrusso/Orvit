import { config as dotenvConfig } from 'dotenv';
import { z } from 'zod';
import { existsSync } from 'fs';
import { join, dirname, isAbsolute, resolve } from 'path';
import type { AppConfig, ModelType } from './types/index.js';

// Load .env file
dotenvConfig();

const configSchema = z.object({
  PORT: z.string().optional().default('4200'),
  DEFAULT_MODEL: z.enum(['sonnet', 'opus', 'haiku']).optional().default('sonnet'),
  MAX_FIX_ITERATIONS: z.string().optional().default('3'),
  LOG_LEVEL: z.string().optional().default('info'),
  MAX_CONCURRENT_TASKS: z.string().optional().default('15'),
  TARGET_PROJECT: z.string().optional().default(''),

  // Database configuration (optional)
  DB_ENABLED: z.string().optional().default('false'),
  DB_HOST: z.string().optional().default('localhost'),
  DB_PORT: z.string().optional().default('5432'),
  DB_USER: z.string().optional().default('postgres'),
  DB_PASSWORD: z.string().optional().default(''),
  DB_NAME: z.string().optional().default('agx'),
  DB_SSL: z.string().optional().default('false'),
});

function detectProjectRoot(): string {
  let dir = process.cwd();
  while (dir !== dirname(dir)) {
    if (existsSync(join(dir, '.git'))) return dir;
    dir = dirname(dir);
  }
  return process.cwd();
}

function resolveTargetProject(projectRoot: string, targetProject: string): string {
  if (!targetProject) return projectRoot;
  const resolved = isAbsolute(targetProject) ? targetProject : resolve(projectRoot, targetProject);
  if (existsSync(resolved)) return resolved;
  console.warn(`TARGET_PROJECT path does not exist: ${resolved}, falling back to projectRoot`);
  return projectRoot;
}

function loadConfig(): AppConfig {
  const parsed = configSchema.safeParse(process.env);

  if (!parsed.success) {
    console.error('Configuration error:');
    for (const issue of parsed.error.issues) {
      console.error(`  - ${issue.path.join('.')}: ${issue.message}`);
    }
    process.exit(1);
  }

  const env = parsed.data;
  const projectRoot = detectProjectRoot();
  const targetProjectPath = resolveTargetProject(projectRoot, env.TARGET_PROJECT);

  return {
    port: parseInt(env.PORT, 10),
    projectRoot,
    targetProjectPath,
    defaultModel: env.DEFAULT_MODEL as ModelType,
    maxFixIterations: parseInt(env.MAX_FIX_ITERATIONS, 10),
    logLevel: env.LOG_LEVEL,
    maxConcurrentTasks: parseInt(env.MAX_CONCURRENT_TASKS, 10),
    database: {
      enabled: env.DB_ENABLED === 'true',
      host: env.DB_HOST,
      port: parseInt(env.DB_PORT, 10),
      user: env.DB_USER,
      password: env.DB_PASSWORD,
      name: env.DB_NAME,
      ssl: env.DB_SSL === 'true',
    },
  };
}

export const config = loadConfig();
