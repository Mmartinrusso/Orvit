import type { FastifyInstance } from 'fastify';
import { execSync } from 'child_process';
import { readdir, stat, readFile } from 'fs/promises';
import { join, relative } from 'path';
import { existsSync } from 'fs';
import { config } from '../config.js';
import { createChildLogger } from '../utils/logger.js';

const logger = createChildLogger('project-routes');

interface FileEntry {
  name: string;
  type: 'file' | 'directory';
  size: number;
  modified: string;
}

interface GitCommit {
  hash: string;
  message: string;
  author: string;
  date: string;
}

// Directories to skip when listing files
const SKIP_DIRS = new Set([
  'node_modules', '.git', 'dist', 'build', '.next', '.nuxt',
  '.cache', 'coverage', '.turbo', '.output', '__pycache__',
]);

export async function projectRoutes(fastify: FastifyInstance): Promise<void> {
  /**
   * GET /api/project/info
   * Project overview: name, tech stack, git status
   */
  fastify.get('/api/project/info', async (_request, reply) => {
    const root = config.targetProjectPath;

    try {
      let name = '';
      let version = '';
      let description = '';
      const techStack: string[] = [];
      let packageManager = 'unknown';

      // Read package.json if it exists
      const pkgPath = join(root, 'package.json');
      if (existsSync(pkgPath)) {
        try {
          const pkg = JSON.parse(await readFile(pkgPath, 'utf-8'));
          name = pkg.name || '';
          version = pkg.version || '';
          description = pkg.description || '';

          // Detect tech stack from dependencies
          const allDeps = { ...pkg.dependencies, ...pkg.devDependencies };
          const stackMap: Record<string, string> = {
            react: 'React', vue: 'Vue', angular: 'Angular', svelte: 'Svelte',
            next: 'Next.js', nuxt: 'Nuxt', express: 'Express', fastify: 'Fastify',
            nestjs: 'NestJS', typescript: 'TypeScript', tailwindcss: 'Tailwind CSS',
            prisma: 'Prisma', sequelize: 'Sequelize', mongoose: 'Mongoose',
            'react-router-dom': 'React Router', '@tanstack/react-query': 'React Query',
            vite: 'Vite', webpack: 'Webpack', esbuild: 'esbuild',
          };

          for (const [dep, label] of Object.entries(stackMap)) {
            if (allDeps[dep]) techStack.push(label);
          }
        } catch { /* ignore parse errors */ }
      }

      if (!name) {
        name = root.split(/[\\/]/).pop() || 'project';
      }

      // Detect package manager
      if (existsSync(join(root, 'pnpm-lock.yaml'))) packageManager = 'pnpm';
      else if (existsSync(join(root, 'yarn.lock'))) packageManager = 'yarn';
      else if (existsSync(join(root, 'bun.lockb'))) packageManager = 'bun';
      else if (existsSync(join(root, 'package-lock.json'))) packageManager = 'npm';

      // Git info
      let gitBranch = '';
      const gitStatus = { modified: 0, untracked: 0, staged: 0, ahead: 0, behind: 0 };

      try {
        gitBranch = execSync('git rev-parse --abbrev-ref HEAD', { cwd: root }).toString().trim();

        const statusOutput = execSync('git status --porcelain', { cwd: root }).toString();
        for (const line of statusOutput.split('\n').filter(Boolean)) {
          const code = line.substring(0, 2);
          if (code.includes('?')) gitStatus.untracked++;
          else if (code[0] !== ' ' && code[0] !== '?') gitStatus.staged++;
          if (code[1] !== ' ' && code[1] !== '?') gitStatus.modified++;
        }

        try {
          const aheadBehind = execSync('git rev-list --left-right --count HEAD...@{u}', { cwd: root }).toString().trim();
          const [ahead, behind] = aheadBehind.split('\t').map(Number);
          gitStatus.ahead = ahead || 0;
          gitStatus.behind = behind || 0;
        } catch { /* no upstream */ }
      } catch { /* not a git repo */ }

      reply.send({
        success: true,
        project: {
          name,
          version,
          description,
          path: root,
          techStack,
          packageManager,
          gitBranch,
          gitStatus,
        },
      });
    } catch (error) {
      logger.error({ error }, 'Failed to get project info');
      reply.code(500).send({ success: false, error: 'Failed to get project info' });
    }
  });

  /**
   * GET /api/project/files?path=src/
   * List files in a directory
   */
  fastify.get<{ Querystring: { path?: string } }>(
    '/api/project/files',
    async (request, reply) => {
      const subPath = request.query.path || '';
      const fullPath = join(config.targetProjectPath, subPath);

      // Security: prevent path traversal
      const resolved = join(config.targetProjectPath, subPath);
      if (!resolved.startsWith(config.targetProjectPath)) {
        return reply.code(400).send({ success: false, error: 'Invalid path' });
      }

      try {
        const entries = await readdir(fullPath);
        const files: FileEntry[] = [];

        for (const entry of entries) {
          if (SKIP_DIRS.has(entry)) continue;
          if (entry.startsWith('.')) continue;

          try {
            const entryPath = join(fullPath, entry);
            const stats = await stat(entryPath);
            files.push({
              name: entry,
              type: stats.isDirectory() ? 'directory' : 'file',
              size: stats.size,
              modified: stats.mtime.toISOString(),
            });
          } catch { /* skip inaccessible files */ }
        }

        // Sort: directories first, then alphabetically
        files.sort((a, b) => {
          if (a.type !== b.type) return a.type === 'directory' ? -1 : 1;
          return a.name.localeCompare(b.name);
        });

        reply.send({ success: true, path: subPath, files });
      } catch (error) {
        reply.code(404).send({ success: false, error: 'Directory not found' });
      }
    }
  );

  /**
   * GET /api/project/git/log?limit=10
   * Recent git commits
   */
  fastify.get<{ Querystring: { limit?: string } }>(
    '/api/project/git/log',
    async (request, reply) => {
      const limit = Math.min(parseInt(request.query.limit || '10', 10), 50);

      try {
        const logOutput = execSync(
          `git log --format="%H|||%s|||%an|||%ai" -${limit}`,
          { cwd: config.projectRoot }
        ).toString().trim();

        const commits: GitCommit[] = logOutput
          .split('\n')
          .filter(Boolean)
          .map(line => {
            const [hash, message, author, date] = line.split('|||');
            return { hash: hash.substring(0, 8), message, author, date };
          });

        reply.send({ success: true, commits });
      } catch {
        reply.send({ success: true, commits: [] });
      }
    }
  );

  /**
   * GET /api/project/git/diff
   * Current git diff (unstaged + staged changes)
   */
  fastify.get('/api/project/git/diff', async (_request, reply) => {
    try {
      const diffOutput = execSync('git diff --stat', { cwd: config.projectRoot }).toString().trim();
      const stagedOutput = execSync('git diff --cached --stat', { cwd: config.projectRoot }).toString().trim();

      reply.send({
        success: true,
        unstaged: diffOutput || 'No unstaged changes',
        staged: stagedOutput || 'No staged changes',
      });
    } catch {
      reply.send({ success: true, unstaged: '', staged: '' });
    }
  });
}
