import { runClaude, parseJsonFromResult } from './claude-runner.js';
import { createChildLogger } from '../utils/logger.js';
import { config } from '../config.js';
import type { ExpertMode } from '../types/index.js';
import { getExpertContext } from '../agents/expert-prompts.js';

const logger = createChildLogger('prompt-enhancer');

export interface EnhanceResult {
  enhanced_prompt: string;
  improvements: string[];
  estimated_complexity: 'simple' | 'medium' | 'complex';
}

export async function enhancePrompt(
  prompt: string,
  expertMode?: ExpertMode
): Promise<EnhanceResult> {
  logger.info({ promptLength: prompt.length, expertMode }, 'Enhancing prompt');

  const expertContext = expertMode ? getExpertContext(expertMode) : '';
  const contextNote = expertContext
    ? ` (Modo experto: ${expertMode})`
    : '';

  // Put ALL instructions in the main prompt to avoid Claude ignoring system prompt
  const fullPrompt = `TAREA: Mejora el siguiente prompt de desarrollo y responde UNICAMENTE con JSON valido.

PROMPT ORIGINAL: "${prompt}"${contextNote}

INSTRUCCIONES:
- Mejora el prompt para que sea mas especifico y ejecutable
- Agrega detalles tecnicos relevantes (archivos, patrones, edge cases)
- Manten la intencion original y el idioma
- NO hagas preguntas, NO pidas contexto adicional
- Responde SOLO con el JSON, sin texto adicional

FORMATO DE RESPUESTA (JSON obligatorio):
{"enhanced_prompt": "tu prompt mejorado aqui", "improvements": ["mejora 1", "mejora 2"], "estimated_complexity": "simple"}

Tu respuesta JSON:`;

  const result = await runClaude({
    prompt: fullPrompt,
    cwd: config.targetProjectPath,
    allowedTools: [],  // No tools needed for prompt enhancement
    model: 'haiku',
    maxTurns: 1,  // Single turn, no conversation
  });

  const parsed = parseJsonFromResult<EnhanceResult>(result.result);

  logger.info({
    improvements: parsed.improvements?.length || 0,
    complexity: parsed.estimated_complexity,
  }, 'Prompt enhanced');

  return {
    enhanced_prompt: parsed.enhanced_prompt || prompt,
    improvements: parsed.improvements || [],
    estimated_complexity: parsed.estimated_complexity || 'medium',
  };
}
