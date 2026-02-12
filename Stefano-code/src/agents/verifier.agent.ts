import { runClaudeAndParseJson } from '../services/claude-runner.js';
import { VERIFIER_SYSTEM_PROMPT, buildVerifierPrompt } from './prompts.js';
import type { PipelineState, VerifierResult } from '../types/index.js';
import { createChildLogger } from '../utils/logger.js';
import { findGitRoot } from '../utils/git-finder.js';

const logger = createChildLogger('verifier-agent');

// Added Write and Edit for creating tests
const ALLOWED_TOOLS = ['Read', 'Bash', 'Grep', 'Glob', 'Write', 'Edit'];

const VERIFIER_JSON_SCHEMA = `{
  "passed": true,
  "bugs": [
    { "file": "path/to/file.ts", "line": 10, "description": "Bug description", "severity": "low|medium|high|critical" }
  ],
  "test_results": [
    { "name": "test name", "passed": true, "output": "test output" }
  ],
  "tests_written": ["path/to/test1.ts"],
  "tests_passed": true
}`;

export async function runVerifierAgent(state: PipelineState): Promise<VerifierResult> {
  logger.info({ taskId: state.taskId, workspacePath: state.workspacePath }, 'Starting verifier agent');

  // Find git root to determine where to put tests
  const modifiedFiles = state.changes.map(c => c.file);
  const gitRoot = await findGitRoot(state.workspacePath, modifiedFiles);

  const testsDir = gitRoot ? `${gitRoot}/tests` : `${state.workspacePath}/tests`;

  logger.info({ taskId: state.taskId, testsDir, gitRoot }, 'Tests directory determined');

  const prompt = buildVerifierPrompt(state.originalPrompt, state.changes, testsDir);

  const { parsed, sessionId } = await runClaudeAndParseJson<VerifierResult>({
    prompt,
    cwd: state.workspacePath,
    allowedTools: ALLOWED_TOOLS,
    systemPrompt: VERIFIER_SYSTEM_PROMPT,
    model: state.model,
    maxTurns: 50,
  }, VERIFIER_JSON_SCHEMA);

  state.sessionIds.verifier = sessionId;

  logger.info(
    {
      taskId: state.taskId,
      passed: parsed.passed,
      bugsCount: parsed.bugs.length,
      testsWritten: parsed.tests_written?.length ?? 0,
      testsPassed: parsed.tests_passed,
    },
    'Verifier agent completed'
  );

  return parsed;
}
