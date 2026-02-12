import { runClaudeAndParseJson } from '../services/claude-runner.js';
import type { PipelineState, FileChange } from '../types/index.js';
import { createChildLogger } from '../utils/logger.js';

const logger = createChildLogger('fast-finish-agent');

const ALLOWED_TOOLS = ['Glob', 'Grep', 'Read', 'Edit', 'Write', 'Bash'];

function buildFastFinishSystemPrompt(needsTests: boolean, createBranch: boolean, createPr: boolean): string {
  const testInstructions = needsTests
    ? `
2. TESTS (si es necesario):
   - Escribe tests básicos para la funcionalidad implementada
   - Ejecuta los tests
   - Si fallan, corrige el código (no los tests)`
    : `
2. VERIFICACIÓN RÁPIDA:
   - Verifica que el código compile/ejecute sin errores
   - Si hay errores obvios, corrígelos`;

  let gitInstructions: string;
  if (createBranch) {
    gitInstructions = createPr
      ? `
3. GIT:
   - Crea branch: feature/{descripcion-corta}-{random-4-chars}
   - IMPORTANTE: Usa "git add -A" para agregar TODOS los archivos (modificados Y nuevos, incluyendo tests creados)
   - Commit con mensaje Conventional Commits (feat:, fix:, etc.)
   - Push la branch
   - Crea PR con gh cli`
      : `
3. GIT:
   - Crea branch: feature/{descripcion-corta}-{random-4-chars}
   - IMPORTANTE: Usa "git add -A" para agregar TODOS los archivos (modificados Y nuevos, incluyendo tests creados)
   - Commit con mensaje Conventional Commits
   - Push la branch`;
  } else {
    // No crear rama, commitear directo en la rama actual
    gitInstructions = `
3. GIT (commit directo en rama actual):
   - NO crees una rama nueva, trabaja en la rama actual
   - IMPORTANTE: Usa "git add -A" para agregar TODOS los archivos (modificados Y nuevos, incluyendo tests creados)
   - Commit con mensaje Conventional Commits (feat:, fix:, etc.)
   - Push a la rama actual`;
  }

  return `Eres un QA engineer y DevOps experto. Tu tarea es verificar la implementación, corregir bugs si los hay, y crear el commit/PR.

PROCESO:
1. REVISIÓN:
   - Lee los archivos modificados
   - Verifica que los cambios cumplan el objetivo
   - Identifica bugs o errores
${testInstructions}
${gitInstructions}

REGLAS:
- Si encuentras bugs, corrígelos ANTES de hacer commit
- Máximo 2 intentos de corrección, luego continúa con el commit
- El commit debe incluir TODOS los archivos: modificados, creados (nuevos), tests, tipos, etc.
- SIEMPRE usa "git add -A" o "git add ." para capturar archivos nuevos (untracked)

RESPONDE ÚNICAMENTE con un JSON válido:
{
  "verification": {
    "passed": true,
    "issues_found": ["issue 1", "issue 2"],
    "issues_fixed": ["fix 1", "fix 2"]
  },
  "tests": {
    "written": ["path/to/test.ts"],
    "passed": true
  },
  "git": {
    "branch": "feature/descripcion-abc1",
    "commit_sha": "abc123...",
    "pr_url": "https://github.com/..."
  },
  "additional_changes": [
    { "file": "path/to/file.ts", "action": "modified", "summary": "Bug fix" }
  ]
}

Si no se escriben tests, omite el campo "tests".
Si no se crea PR, omite pr_url.
NO incluyas texto adicional, solo el JSON.`;
}

export interface FastFinishResult {
  verification: {
    passed: boolean;
    issues_found?: string[];
    issues_fixed?: string[];
  };
  tests?: {
    written: string[];
    passed: boolean;
  };
  git: {
    branch: string;
    commit_sha: string;
    pr_url?: string;
  };
  additional_changes?: FileChange[];
}

function buildFastFinishPrompt(
  userPrompt: string,
  changes: FileChange[]
): string {
  return `OBJETIVO ORIGINAL:
${userPrompt}

ARCHIVOS MODIFICADOS EN LA IMPLEMENTACIÓN:
${changes.map(c => `- ${c.file} (${c.action}): ${c.summary}`).join('\n')}

Verifica la implementación, corrige bugs si los hay, y crea el commit/PR.`;
}

export async function runFastFinishAgent(
  state: PipelineState,
  changes: FileChange[],
  createBranch: boolean,
  createPr: boolean
): Promise<FastFinishResult> {
  const needsTests = state.complexityAnalysis?.needs_tests ?? false;

  logger.info({
    taskId: state.taskId,
    workspacePath: state.workspacePath,
    changesCount: changes.length,
    needsTests,
    createBranch,
    createPr
  }, 'Starting fast-finish agent (verify+fix+git)');

  const systemPrompt = buildFastFinishSystemPrompt(needsTests, createBranch, createPr);
  const prompt = buildFastFinishPrompt(state.originalPrompt, changes);

  const FAST_FINISH_JSON_SCHEMA = `{
  "verification": { "passed": true, "issues_found": [], "issues_fixed": [] },
  "tests": { "written": ["path/to/test.ts"], "passed": true },
  "git": { "branch": "feature/name", "commit_sha": "abc123", "pr_url": "https://..." },
  "additional_changes": [{ "file": "path/to/file.ts", "action": "modified", "summary": "Fix" }]
}`;

  const { parsed, sessionId } = await runClaudeAndParseJson<FastFinishResult>({
    prompt,
    cwd: state.workspacePath,
    allowedTools: ALLOWED_TOOLS,
    systemPrompt,
    model: state.model,
    maxTurns: 40,
  }, FAST_FINISH_JSON_SCHEMA);

  state.sessionIds['fast-finish'] = sessionId;

  logger.info({
    taskId: state.taskId,
    verificationPassed: parsed.verification?.passed,
    issuesFixed: parsed.verification?.issues_fixed?.length || 0,
    branch: parsed.git?.branch,
    prUrl: parsed.git?.pr_url
  }, 'Fast-finish agent completed');

  return parsed;
}
