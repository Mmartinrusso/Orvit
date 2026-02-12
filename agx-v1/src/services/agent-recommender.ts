import { createChildLogger } from '../utils/logger.js';
import type { ModelType, PipelineMode } from '../types/index.js';

const logger = createChildLogger('agent-recommender');

export interface PipelineRecommendation {
  recommended_mode: PipelineMode;
  recommended_model: ModelType;
  reason: string;
  confidence: number;
}

// Keyword patterns for classification
const BUG_FIX_KEYWORDS = [
  'fix', 'bug', 'error', 'broken', 'crash', 'issue', 'wrong', 'incorrect',
  'arreglar', 'corregir', 'error', 'falla', 'roto', 'problema',
];

const SIMPLE_KEYWORDS = [
  'rename', 'refactor', 'move', 'update', 'upgrade', 'change name',
  'add comment', 'remove comment', 'update readme', 'typo', 'style',
  'renombrar', 'mover', 'actualizar', 'cambiar nombre', 'estilo', 'comentario',
];

const COMPLEX_KEYWORDS = [
  'implement', 'create', 'build', 'add feature', 'new feature', 'integrate',
  'authentication', 'database', 'api', 'endpoint', 'migration', 'architecture',
  'implementar', 'crear', 'construir', 'nueva funcionalidad', 'integrar',
  'autenticación', 'base de datos', 'migración', 'arquitectura',
];

const TEST_KEYWORDS = [
  'test', 'testing', 'write tests', 'add tests', 'coverage',
  'tests', 'pruebas', 'escribir tests', 'agregar tests', 'cobertura',
];

const FRONTEND_KEYWORDS = [
  'ui', 'css', 'style', 'component', 'page', 'layout', 'dark mode',
  'responsive', 'frontend', 'react', 'tailwind', 'button', 'form',
  'estilo', 'componente', 'página', 'diseño',
];

function countMatches(prompt: string, keywords: string[]): number {
  const lowerPrompt = prompt.toLowerCase();
  return keywords.filter(kw => lowerPrompt.includes(kw)).length;
}

export function recommendPipeline(prompt: string): PipelineRecommendation {
  const bugFixScore = countMatches(prompt, BUG_FIX_KEYWORDS);
  const simpleScore = countMatches(prompt, SIMPLE_KEYWORDS);
  const complexScore = countMatches(prompt, COMPLEX_KEYWORDS);
  const testScore = countMatches(prompt, TEST_KEYWORDS);
  const frontendScore = countMatches(prompt, FRONTEND_KEYWORDS);

  const totalScore = bugFixScore + simpleScore + complexScore + testScore + frontendScore;

  let recommended_mode: PipelineMode = 'auto';
  let recommended_model: ModelType = 'sonnet';
  let reason: string;
  let confidence: number;

  // Determine pipeline mode
  if (simpleScore > 0 && complexScore === 0 && bugFixScore === 0) {
    // Simple task - fast pipeline
    recommended_mode = 'fast';
    reason = 'Tarea simple detectada (renombrar/refactorizar/actualizar). Pipeline rápido recomendado.';
    confidence = 0.7 + (simpleScore * 0.05);
  } else if (frontendScore > 0 && complexScore === 0 && bugFixScore === 0 && testScore === 0) {
    // Frontend-only - fast pipeline, no tests needed
    recommended_mode = 'fast';
    reason = 'Cambio de frontend/UI detectado. Pipeline rápido sin tests recomendado.';
    confidence = 0.65 + (frontendScore * 0.05);
  } else if (bugFixScore > 0 || testScore > 0) {
    // Bug fix or test-related - full pipeline needed for verification
    recommended_mode = 'full';
    reason = 'Fix de bug o tests detectados. Pipeline completo con verificación recomendado.';
    confidence = 0.75 + (bugFixScore * 0.05);
  } else if (complexScore > 0) {
    // Complex task - full pipeline
    recommended_mode = 'full';
    reason = 'Tarea compleja detectada (nueva funcionalidad/integración). Pipeline completo recomendado.';
    confidence = 0.7 + (complexScore * 0.05);
  } else {
    // Unknown - let auto mode decide
    recommended_mode = 'auto';
    reason = 'No se detectó un patrón claro. Modo auto recomendado para análisis de complejidad.';
    confidence = 0.5;
  }

  // Determine model
  if (complexScore >= 3 || prompt.length > 500) {
    recommended_model = 'opus';
    reason += ' Modelo Opus sugerido por alta complejidad.';
  } else if (simpleScore > 0 && complexScore === 0) {
    recommended_model = 'sonnet';
    reason += ' Modelo Sonnet es suficiente para esta tarea.';
  } else {
    recommended_model = 'sonnet';
  }

  // Cap confidence at 0.95
  confidence = Math.min(confidence, 0.95);

  logger.debug({
    scores: { bugFix: bugFixScore, simple: simpleScore, complex: complexScore, test: testScore, frontend: frontendScore },
    recommendation: { mode: recommended_mode, model: recommended_model, confidence },
  }, 'Pipeline recommendation generated');

  return { recommended_mode, recommended_model, reason, confidence };
}
