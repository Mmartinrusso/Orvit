import { runClaudeAndParseJson } from '../services/claude-runner.js';
import { PLANNER_SYSTEM_PROMPT, buildPlannerPrompt } from './prompts.js';
import type { PipelineState, PlanResult } from '../types/index.js';
import { createChildLogger } from '../utils/logger.js';

const logger = createChildLogger('planner-agent');

const ALLOWED_TOOLS = ['Read', 'Glob', 'Grep'];

const PLANNER_JSON_SCHEMA = `{
  "plan": [
    { "step": 1, "file": "path/to/file.ts", "action": "create|modify|delete", "description": "What to do" }
  ],
  "files_to_modify": ["path/to/file1.ts", "path/to/file2.ts"],
  "considerations": ["Important note 1", "Important note 2"]
}`;

export async function runPlannerAgent(
  state: PipelineState,
  enrichedPrompt?: string
): Promise<PlanResult> {
  logger.info({ taskId: state.taskId, workspacePath: state.workspacePath }, 'Starting planner agent');

  const prompt = enrichedPrompt || buildPlannerPrompt(state.originalPrompt, state.targetPaths);

  const { parsed, sessionId } = await runClaudeAndParseJson<PlanResult>({
    prompt,
    cwd: state.workspacePath,
    allowedTools: ALLOWED_TOOLS,
    systemPrompt: PLANNER_SYSTEM_PROMPT,
    model: state.model,
    maxTurns: 50,
  }, PLANNER_JSON_SCHEMA);

  state.sessionIds.planner = sessionId;

  // Validate the parsed result has required fields
  if (!parsed || !Array.isArray(parsed.plan)) {
    logger.error({ parsed }, 'Planner returned invalid result structure');
    throw new Error(`Planner returned invalid result: missing 'plan' array. Got: ${JSON.stringify(parsed).substring(0, 200)}`);
  }

  logger.info(
    { taskId: state.taskId, steps: parsed.plan.length, files: parsed.files_to_modify },
    'Planner agent completed'
  );

  return parsed;
}
