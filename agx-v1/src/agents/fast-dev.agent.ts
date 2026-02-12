import { runClaudeAndParseJson } from '../services/claude-runner.js';
import type { PipelineState, FileChange, PlanStep, ClonedRepoInfo } from '../types/index.js';
import { createChildLogger } from '../utils/logger.js';

const logger = createChildLogger('fast-dev-agent');

const ALLOWED_TOOLS = ['Glob', 'Grep', 'Read', 'Edit', 'Write', 'Bash'];

const FAST_DEV_SYSTEM_PROMPT = `Eres un desarrollador senior full-stack. Tu tarea es analizar el proyecto, planificar e implementar los cambios solicitados EN UN SOLO PROCESO EFICIENTE.

PROCESO:
1. ANÁLISIS RÁPIDO:
   - Usa Glob/Grep para encontrar archivos relevantes
   - Lee solo los archivos necesarios para entender el contexto
   - NO explores todo el proyecto, sé eficiente

2. PLANIFICACIÓN MENTAL:
   - Identifica qué archivos modificar
   - Determina el orden de los cambios

3. IMPLEMENTACIÓN:
   - Modifica/crea los archivos necesarios
   - Usa las mejores prácticas
   - Sigue las convenciones del código existente
   - NO agregues features no solicitadas

REGLAS:
- Sé EFICIENTE: no explores de más
- Implementa SOLO lo solicitado
- Si encuentras un error mientras implementas, corrígelo inmediatamente
- NO escribas tests (eso se hace en otra etapa)

RESPONDE ÚNICAMENTE con un JSON válido al finalizar:
{
  "paths": ["path/to/relevant/files"],
  "plan": [
    { "step": 1, "file": "path/to/file.ts", "action": "modify", "description": "Qué se cambió" }
  ],
  "changes": [
    { "file": "path/to/file.ts", "action": "modified", "summary": "Resumen del cambio" }
  ],
  "summary": "Resumen general de la implementación"
}

NO incluyas texto adicional, solo el JSON.`;

export interface FastDevResult {
  paths: string[];
  plan: PlanStep[];
  changes: FileChange[];
  summary: string;
}

function buildFastDevPrompt(userPrompt: string, repos?: ClonedRepoInfo[]): string {
  let repoContext = '';

  if (repos && repos.length > 0) {
    repoContext = `
REPOSITORIOS DISPONIBLES:
${repos.map(r => `- ${r.path}/: ${r.description} (branch: ${r.branch})`).join('\n')}

NOTA: Cada repositorio está en su propia carpeta.
`;
  }

  return `TAREA A IMPLEMENTAR:
${userPrompt}
${repoContext}
Analiza el proyecto, planifica e implementa los cambios necesarios.`;
}

export async function runFastDevAgent(state: PipelineState): Promise<FastDevResult> {
  const hasPreviousContext = !!state.previousTaskContext;

  logger.info({
    taskId: state.taskId,
    workspacePath: state.workspacePath,
    repoCount: state.repos.length,
    continuingFromTask: state.previousTaskContext?.taskId,
  }, hasPreviousContext ? 'Continuing from previous task context' : 'Starting fast-dev agent (locate+plan+implement)');

  // If continuing from a previous task, build a context-aware prompt
  const prompt = hasPreviousContext
    ? buildContinuationPrompt(state.originalPrompt, state.previousTaskContext!)
    : buildFastDevPrompt(state.originalPrompt, state.repos);

  const FAST_DEV_JSON_SCHEMA = `{
  "paths": ["path/to/relevant/files"],
  "plan": [
    { "step": 1, "file": "path/to/file.ts", "action": "modify", "description": "Qué se cambió" }
  ],
  "changes": [
    { "file": "path/to/file.ts", "action": "modified", "summary": "Resumen del cambio" }
  ],
  "summary": "Resumen general"
}`;

  // Append skills context to system prompt if available
  const systemPrompt = state.skillsContext
    ? `${FAST_DEV_SYSTEM_PROMPT}\n\n${state.skillsContext}`
    : FAST_DEV_SYSTEM_PROMPT;

  const { parsed, sessionId } = await runClaudeAndParseJson<FastDevResult>({
    prompt,
    cwd: state.workspacePath,
    allowedTools: ALLOWED_TOOLS,
    systemPrompt,
    model: state.model,
    maxTurns: 50,
  }, FAST_DEV_JSON_SCHEMA);

  state.sessionIds['fast-dev'] = sessionId;

  logger.info({
    taskId: state.taskId,
    paths: parsed.paths?.length || 0,
    planSteps: parsed.plan?.length || 0,
    changes: parsed.changes?.length || 0,
    continuedFromTask: state.previousTaskContext?.taskId,
  }, 'Fast-dev agent completed');

  return parsed;
}

/**
 * Build prompt for continuing work from a previous task
 * This provides full context instead of relying on session memory
 */
function buildContinuationPrompt(
  userPrompt: string,
  previousContext: { taskId: string; originalPrompt: string; gitBranch: string | null; changes: Array<{ file: string; action: string; summary: string | null }>; summary: string | null }
): string {
  const changesStr = previousContext.changes.length > 0
    ? previousContext.changes.map(c => `- ${c.file} (${c.action}): ${c.summary || 'sin descripcion'}`).join('\n')
    : 'No hay cambios registrados';

  return `CONTINUACIÓN DE TRABAJO ANTERIOR
================================

CONTEXTO DE LA TASK ANTERIOR (${previousContext.taskId}):
- Prompt original: ${previousContext.originalPrompt}
- Branch: ${previousContext.gitBranch || 'No especificado'}
- Resumen: ${previousContext.summary || 'No disponible'}

ARCHIVOS MODIFICADOS ANTERIORMENTE:
${changesStr}

================================

NUEVA INSTRUCCIÓN A IMPLEMENTAR:
${userPrompt}

IMPORTANTE:
- Estás trabajando en la MISMA rama (${previousContext.gitBranch || 'actual'})
- Los archivos listados arriba YA fueron modificados en la task anterior
- Revisa esos archivos si es necesario entender el contexto
- Implementa SOLO los cambios de la nueva instrucción

Al finalizar, responde ÚNICAMENTE con un JSON válido:
{
  "paths": ["path/to/relevant/files"],
  "plan": [
    { "step": 1, "file": "path/to/file.ts", "action": "modify", "description": "Qué se cambió" }
  ],
  "changes": [
    { "file": "path/to/file.ts", "action": "modified", "summary": "Resumen del cambio" }
  ],
  "summary": "Resumen general de la implementación"
}

NO incluyas texto adicional, solo el JSON.`;
}
