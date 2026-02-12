import { runClaudeAndParseJson } from '../services/claude-runner.js';
import { LOCATOR_SYSTEM_PROMPT, buildLocatorPrompt } from './prompts.js';
import type { PipelineState, LocatorResult } from '../types/index.js';
import { createChildLogger } from '../utils/logger.js';

const logger = createChildLogger('locator-agent');

const ALLOWED_TOOLS = ['Glob', 'Grep', 'Read'];

const LOCATOR_JSON_SCHEMA = `{
  "paths": ["path/to/file1.ts", "path/to/file2.ts"],
  "reason": "Brief explanation of why these files are relevant"
}`;

export async function runLocatorAgent(state: PipelineState): Promise<LocatorResult> {
  logger.info({ taskId: state.taskId, workspacePath: state.workspacePath, repoCount: state.repos.length }, 'Starting locator agent');

  const prompt = buildLocatorPrompt(state.originalPrompt, state.repos);

  const { parsed, sessionId } = await runClaudeAndParseJson<LocatorResult>({
    prompt,
    cwd: state.workspacePath,
    allowedTools: ALLOWED_TOOLS,
    systemPrompt: LOCATOR_SYSTEM_PROMPT,
    model: state.model,
    maxTurns: 30,
  }, LOCATOR_JSON_SCHEMA);

  state.sessionIds.locator = sessionId;

  logger.info({ taskId: state.taskId, paths: parsed.paths }, 'Locator agent completed');

  return parsed;
}
