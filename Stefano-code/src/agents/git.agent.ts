import { runClaudeAndParseJson } from '../services/claude-runner.js';
import { buildGitSystemPrompt, buildGitPrompt, buildMultiRepoGitPrompt } from './prompts.js';
import type { PipelineState, GitAgentResult, GitResult, RepoGitResult } from '../types/index.js';
import { createChildLogger } from '../utils/logger.js';
import { findGitRoot } from '../utils/git-finder.js';

const logger = createChildLogger('git-agent');

const ALLOWED_TOOLS = ['Bash'];

const GIT_JSON_SCHEMA = `{
  "branch": "branch-name",
  "commit_sha": "abc123",
  "pr_url": "https://github.com/..."
}`;

const MULTI_REPO_GIT_JSON_SCHEMA = `{
  "repos": [
    { "path": "repo-path", "branch": "branch-name", "commit_sha": "abc123", "pr_url": "https://..." }
  ],
  "summary": "Summary of git operations"
}`;

/**
 * Finds all unique git repositories that have modified files
 */
async function findModifiedRepos(
  workspacePath: string,
  changes: { file: string }[]
): Promise<Map<string, string[]>> {
  const repoFiles = new Map<string, string[]>();

  for (const change of changes) {
    const gitRoot = await findGitRoot(workspacePath, [change.file]);
    if (gitRoot) {
      const existing = repoFiles.get(gitRoot) || [];
      existing.push(change.file);
      repoFiles.set(gitRoot, existing);
    }
  }

  return repoFiles;
}

export async function runGitAgent(
  state: PipelineState,
  createBranch: boolean,
  createPr: boolean
): Promise<GitResult> {
  const isMultiRepo = state.repos.length > 1;

  logger.info({
    taskId: state.taskId,
    createBranch,
    createPr,
    workspacePath: state.workspacePath,
    isMultiRepo,
    repoCount: state.repos.length
  }, 'Starting git agent');

  // Find all git roots with modified files
  const repoFilesMap = await findModifiedRepos(state.workspacePath, state.changes);

  if (repoFilesMap.size === 0) {
    logger.warn({ taskId: state.taskId }, 'No git repositories found for modified files');
    return {
      branch: '',
      commit_sha: '',
    };
  }

  const summary = state.plan
    ? `Implementación de: ${state.originalPrompt}`
    : state.originalPrompt;

  // For multi-repo, we need to handle each repo
  if (isMultiRepo && repoFilesMap.size > 1) {
    logger.info({ taskId: state.taskId, repoCount: repoFilesMap.size }, 'Processing multiple repositories');

    // Build list of repos with their changes
    const reposWithChanges = Array.from(repoFilesMap.entries()).map(([gitRoot, files]) => {
      const repoInfo = state.repos.find(r => gitRoot.includes(r.path));
      return {
        path: gitRoot,
        name: repoInfo?.path || gitRoot.split('/').pop() || 'repo',
        description: repoInfo?.description || '',
        url: repoInfo?.url || '',
        files: files,
        changes: state.changes.filter(c => files.includes(c.file)),
      };
    });

    const prompt = buildMultiRepoGitPrompt(summary, reposWithChanges, createBranch, createPr);

    const { parsed, sessionId } = await runClaudeAndParseJson<{
      repos: RepoGitResult[];
      summary: string;
    }>({
      prompt,
      cwd: state.workspacePath,
      allowedTools: ALLOWED_TOOLS,
      systemPrompt: buildGitSystemPrompt(createBranch),
      model: state.model,
      maxTurns: 30,
    }, MULTI_REPO_GIT_JSON_SCHEMA);

    state.sessionIds.git = sessionId;

    logger.info(
      { taskId: state.taskId, reposProcessed: parsed.repos?.length },
      'Multi-repo git agent completed'
    );

    // Return combined result
    const firstRepo = parsed.repos?.[0];
    return {
      branch: firstRepo?.branch || '',
      commit_sha: firstRepo?.commit_sha || '',
      pr_url: firstRepo?.pr_url,
      repos: parsed.repos,
    };
  }

  // Single repo path (original behavior)
  const [gitRoot] = repoFilesMap.keys();

  logger.info({ taskId: state.taskId, gitRoot }, 'Processing single repository');

  const prompt = buildGitPrompt(summary, state.changes, createBranch, createPr);

  const { parsed, sessionId } = await runClaudeAndParseJson<GitAgentResult>({
    prompt,
    cwd: gitRoot,
    allowedTools: ALLOWED_TOOLS,
    systemPrompt: buildGitSystemPrompt(createBranch),
    model: state.model,
    maxTurns: 15,
  }, GIT_JSON_SCHEMA);

  state.sessionIds.git = sessionId;

  logger.info(
    { taskId: state.taskId, branch: parsed.branch, prUrl: parsed.pr_url },
    'Git agent completed'
  );

  return parsed;
}
