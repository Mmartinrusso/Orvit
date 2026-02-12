import { runClaudeAndParseJson } from '../services/claude-runner.js';
import type { PipelineState, ComplexityAnalysis, ClonedRepoInfo } from '../types/index.js';
import { createChildLogger } from '../utils/logger.js';

const logger = createChildLogger('analyzer-agent');

const ALLOWED_TOOLS = ['Glob', 'Grep', 'Read'];

const ANALYZER_SYSTEM_PROMPT = `Eres un experto en análisis de proyectos de software. Tu tarea es analizar RÁPIDAMENTE la complejidad de una tarea solicitada para decidir cómo ejecutarla de la manera más eficiente.

REGLAS:
1. Analiza el prompt del usuario y el proyecto de forma RÁPIDA (usa pocas herramientas)
2. Determina la complejidad basándote en:
   - Número estimado de archivos a modificar
   - Si involucra backend (APIs, bases de datos, lógica de servidor) -> necesita tests
   - Si es solo frontend/UI/styling -> no necesita tests
   - Si es una tarea simple (1-3 archivos, cambios menores) -> modo fast
   - Si es compleja (4+ archivos, lógica nueva, integraciones) -> modo full

3. NO explores todo el proyecto, solo haz una evaluación rápida

RESPONDE ÚNICAMENTE con un JSON válido:
{
  "complexity": "simple" | "medium" | "complex",
  "recommended_mode": "fast" | "full",
  "needs_tests": true | false,
  "reason": "Explicación breve (1-2 oraciones)",
  "estimated_files": número,
  "is_backend": true | false
}

CRITERIOS:
- simple + no backend -> fast (2 agentes)
- simple + backend -> full con tests
- medium/complex -> full
- Solo cambios de UI/estilos/textos -> fast sin tests
- Nuevas funcionalidades con lógica -> full con tests

NO incluyas texto adicional, solo el JSON.`;

const ANALYZER_JSON_SCHEMA = `{
  "complexity": "simple|medium|complex",
  "recommended_mode": "fast|full",
  "needs_tests": true,
  "reason": "Brief explanation",
  "estimated_files": 5,
  "is_backend": true
}`;

function buildAnalyzerPrompt(userPrompt: string, repos?: ClonedRepoInfo[]): string {
  let repoContext = '';

  if (repos && repos.length > 0) {
    repoContext = `
REPOSITORIOS:
${repos.map(r => `- ${r.path}/: ${r.description}`).join('\n')}
`;
  }

  return `TAREA DEL USUARIO:
${userPrompt}
${repoContext}
Analiza RÁPIDAMENTE la complejidad de esta tarea. Usa máximo 2-3 herramientas para entender el proyecto.`;
}

export async function runAnalyzerAgent(state: PipelineState): Promise<ComplexityAnalysis> {
  logger.info({
    taskId: state.taskId,
    workspacePath: state.workspacePath
  }, 'Starting complexity analyzer');

  const prompt = buildAnalyzerPrompt(state.originalPrompt, state.repos);

  const { parsed } = await runClaudeAndParseJson<ComplexityAnalysis>({
    prompt,
    cwd: state.workspacePath,
    allowedTools: ALLOWED_TOOLS,
    systemPrompt: ANALYZER_SYSTEM_PROMPT,
    model: 'haiku',  // Use haiku for fast analysis - cheaper and faster
    maxTurns: 15,
  }, ANALYZER_JSON_SCHEMA);

  logger.info({
    taskId: state.taskId,
    complexity: parsed.complexity,
    recommendedMode: parsed.recommended_mode,
    needsTests: parsed.needs_tests,
    estimatedFiles: parsed.estimated_files
  }, 'Complexity analysis completed');

  return parsed;
}
