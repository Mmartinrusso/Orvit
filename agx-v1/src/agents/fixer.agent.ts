import { runClaudeAndParseJson } from '../services/claude-runner.js';
import { FIXER_SYSTEM_PROMPT, buildFixerPrompt } from './prompts.js';
import type { PipelineState, FixerResult, Bug } from '../types/index.js';
import { createChildLogger } from '../utils/logger.js';

const logger = createChildLogger('fixer-agent');

const ALLOWED_TOOLS = ['Read', 'Edit', 'Write', 'Bash'];

const FIXER_JSON_SCHEMA = `{
  "fixed": [
    { "file": "path/to/file.ts", "bug": "description of bug fixed", "fix": "description of fix applied" }
  ],
  "changes": [
    { "file": "path/to/file.ts", "action": "modified", "summary": "Change description" }
  ]
}`;

export async function runFixerAgent(state: PipelineState, bugs: Bug[]): Promise<FixerResult> {
  logger.info({ taskId: state.taskId, bugsCount: bugs.length, workspacePath: state.workspacePath }, 'Starting fixer agent');

  // Get the list of modified files to scope the fixer
  const modifiedFiles = state.changes.map(c => c.file);

  const prompt = buildFixerPrompt(bugs, modifiedFiles);

  const { parsed, sessionId } = await runClaudeAndParseJson<FixerResult>({
    prompt,
    cwd: state.workspacePath,
    allowedTools: ALLOWED_TOOLS,
    systemPrompt: FIXER_SYSTEM_PROMPT,
    model: state.model,
    maxTurns: 30,
  }, FIXER_JSON_SCHEMA);

  state.sessionIds.fixer = sessionId;

  // Merge the fix changes into the state changes
  for (const change of parsed.changes) {
    const existingIndex = state.changes.findIndex(c => c.file === change.file);
    if (existingIndex >= 0) {
      state.changes[existingIndex] = change;
    } else {
      state.changes.push(change);
    }
  }

  logger.info(
    { taskId: state.taskId, fixed: parsed.fixed.length },
    'Fixer agent completed'
  );

  return parsed;
}
