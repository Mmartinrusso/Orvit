import { runClaudeAndParseJson } from '../services/claude-runner.js';
import { IMPLEMENTER_SYSTEM_PROMPT, buildImplementerPrompt } from './prompts.js';
import type { PipelineState, ImplementerResult, PreviousTaskContext } from '../types/index.js';
import { createChildLogger } from '../utils/logger.js';

const logger = createChildLogger('implementer-agent');

const ALLOWED_TOOLS = ['Read', 'Edit', 'Write', 'Bash'];

const IMPLEMENTER_JSON_SCHEMA = `{
  "changes": [
    { "file": "path/to/file.ts", "action": "created|modified|deleted", "summary": "Brief description of change" }
  ],
  "summary": "Overall summary of implementation"
}`;

export async function runImplementerAgent(state: PipelineState): Promise<ImplementerResult> {
  const hasPreviousContext = !!state.previousTaskContext;

  logger.info({
    taskId: state.taskId,
    workspacePath: state.workspacePath,
    continuingFromTask: state.previousTaskContext?.taskId,
  }, hasPreviousContext ? 'Continuing implementer from previous task context' : 'Starting implementer agent');

  if (!state.plan && !hasPreviousContext) {
    throw new Error('No plan available for implementation');
  }

  // If continuing from a previous task, build a context-aware prompt
  const prompt = hasPreviousContext
    ? buildContinuationPrompt(state.originalPrompt, state.previousTaskContext!)
    : buildImplementerPrompt(state.originalPrompt, state.plan!);

  // Append skills context to system prompt if available
  const systemPrompt = state.skillsContext
    ? `${IMPLEMENTER_SYSTEM_PROMPT}\n\n${state.skillsContext}`
    : IMPLEMENTER_SYSTEM_PROMPT;

  const { parsed, sessionId } = await runClaudeAndParseJson<ImplementerResult>({
    prompt,
    cwd: state.workspacePath,
    allowedTools: ALLOWED_TOOLS,
    systemPrompt,
    model: state.model,
    maxTurns: 50,
  }, IMPLEMENTER_JSON_SCHEMA);

  state.sessionIds.implementer = sessionId;

  logger.info(
    { taskId: state.taskId, changes: parsed.changes.length, continuedFromTask: state.previousTaskContext?.taskId },
    'Implementer agent completed'
  );

  return parsed;
}

/**
 * Build prompt for continuing work from a previous task
 */
function buildContinuationPrompt(userPrompt: string, previousContext: PreviousTaskContext): string {
  const changesStr = previousContext.changes.length > 0
    ? previousContext.changes.map(c => `- ${c.file} (${c.action}): ${c.summary || 'sin descripcion'}`).join('\n')
    : 'No hay cambios registrados';

  return `CONTINUACIÓN DE TRABAJO ANTERIOR
================================

CONTEXTO DE LA TASK ANTERIOR (${previousContext.taskId}):
- Prompt original: ${previousContext.originalPrompt}
- Branch: ${previousContext.gitBranch || 'No especificado'}

ARCHIVOS MODIFICADOS ANTERIORMENTE:
${changesStr}

================================

NUEVA INSTRUCCIÓN A IMPLEMENTAR:
${userPrompt}

IMPORTANTE:
- Estás trabajando en la MISMA rama (${previousContext.gitBranch || 'actual'})
- Los archivos listados arriba YA fueron modificados
- Implementa SOLO los cambios de la nueva instrucción

Al finalizar, responde ÚNICAMENTE con un JSON válido:
{
  "changes": [
    { "file": "path/to/file.ts", "action": "modified", "summary": "Resumen del cambio" }
  ],
  "summary": "Resumen general de la implementación"
}

NO incluyas texto adicional, solo el JSON.`;
}
