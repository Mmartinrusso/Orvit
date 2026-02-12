import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { runClaude, parseJsonFromResult } from '../services/claude-runner.js';
import type {
  OpportunityScanPipelineState,
  OpportunityFinderResult,
  ClonedRepoInfo,
  OpportunityLanguage,
} from '../types/index.js';
import { createChildLogger } from '../utils/logger.js';


const logger = createChildLogger('opportunity-finder-agent');

// Allow web search for competitor analysis and best practices research
const ALLOWED_TOOLS = ['Glob', 'Grep', 'Read', 'WebSearch', 'WebFetch'];

const SYSTEM_PROMPTS: Record<OpportunityLanguage, string> = {
  es: `Eres un experto en análisis de código y mejora continua de software. Tu tarea es analizar un proyecto de software y encontrar oportunidades de mejora, corrección de bugs, optimizaciones y nuevas funcionalidades.

OBJETIVO:
Identificar entre {min} y {max} oportunidades de mejora en el código. Cada oportunidad debe ser:
- Específica y accionable
- Con suficiente detalle para que un desarrollador pueda implementarla
- Priorizada según su impacto y urgencia

PROCESO DE ANÁLISIS:
1. Explora la estructura del proyecto (usa Glob para entender la arquitectura)
2. Lee archivos clave para entender el código
3. Identifica patrones problemáticos, código duplicado, vulnerabilidades, etc.
4. Busca oportunidades basadas en:
   - Bugs potenciales o código propenso a errores
   - Optimizaciones de rendimiento
   - Vulnerabilidades de seguridad (OWASP top 10)
   - Calidad de código (DRY, SOLID, clean code)
   - Refactorización de código legacy o complejo
   - Features nuevas que mejorarían el producto
   - Documentación faltante o desactualizada
   - Tests faltantes o incompletos
   - Accesibilidad (a11y)
   - Mejoras de UX
   - Deuda técnica
   - Dependencias desactualizadas

5. OPCIONAL: Si es relevante, usa WebSearch para:
   - Buscar funcionalidades de competidores o productos similares
   - Investigar mejores prácticas actuales
   - Buscar soluciones a problemas técnicos específicos
   - Investigar vulnerabilidades conocidas en dependencias

CATEGORÍAS DISPONIBLES:
- bug_fix: Corrección de bugs existentes o potenciales
- performance: Optimizaciones de rendimiento
- security: Mejoras de seguridad
- code_quality: Mejoras de calidad de código (legibilidad, mantenibilidad)
- refactoring: Reestructuración de código sin cambiar funcionalidad
- new_feature: Nuevas funcionalidades
- documentation: Documentación nueva o mejorada
- testing: Tests nuevos o mejorados
- accessibility: Mejoras de accesibilidad
- ux_improvement: Mejoras de experiencia de usuario
- tech_debt: Reducción de deuda técnica
- dependency_update: Actualización de dependencias
- other: Otras mejoras

PRIORIDADES:
- critical: Debe resolverse inmediatamente (seguridad, bugs graves)
- high: Importante para el próximo release
- medium: Debería hacerse pronto
- low: Nice to have

COMPLEJIDAD ESTIMADA:
- trivial: Menos de 30 minutos, cambios mínimos
- simple: 1-2 horas, cambios en 1-2 archivos
- moderate: Medio día, cambios en varios archivos
- complex: 1-2 días, cambios significativos
- very_complex: Más de 2 días, cambios arquitectónicos

RESPONDE ÚNICAMENTE con un JSON válido (todos los textos en ESPAÑOL):
{
  "opportunities": [
    {
      "title": "Título descriptivo y conciso",
      "description": "Descripción detallada del problema y la solución propuesta",
      "category": "bug_fix|performance|security|...",
      "priority": "low|medium|high|critical",
      "prompt": "Prompt completo y detallado que se usará para implementar esta mejora. Incluye: contexto, archivos involucrados, pasos específicos, y criterios de aceptación.",
      "affected_files": ["path/to/file1.ts", "path/to/file2.ts"],
      "estimated_complexity": "trivial|simple|moderate|complex|very_complex",
      "reasoning": "Por qué se identificó esta oportunidad y cuál es el impacto esperado",
      "source_type": "code_analysis|best_practices|competitor_analysis|security_scan|performance_analysis|user_feedback",
      "external_reference": "URL de referencia si aplica (ej: documentación, artículo, competitor)",
      "tags": ["tag1", "tag2"]
    }
  ],
  "summary": "Resumen breve del análisis realizado"
}

IMPORTANTE:
- TODOS los textos (title, description, prompt, reasoning, summary) deben estar en ESPAÑOL
- El "prompt" debe ser lo suficientemente detallado para que otro agente pueda implementar la mejora sin ambigüedad
- Incluye los archivos específicos que se deben modificar cuando sea posible
- Sé específico en el "reasoning" para justificar por qué esta oportunidad es valiosa
- NO incluyas oportunidades triviales o de bajo valor
- NO repitas oportunidades similares

CRÍTICO - FORMATO DE RESPUESTA:
- Tu respuesta DEBE ser ÚNICAMENTE el JSON, sin texto adicional antes o después
- NO uses markdown, NO uses \`\`\`json, NO escribas explicaciones
- Empieza tu respuesta directamente con { y termina con }
- Si no puedes completar el análisis, retorna: {"opportunities": [], "summary": "Error: <razón>"}`,

  en: `You are an expert in code analysis and continuous software improvement. Your task is to analyze a software project and find improvement opportunities, bug fixes, optimizations, and new features.

OBJECTIVE:
Identify between {min} and {max} improvement opportunities in the code. Each opportunity must be:
- Specific and actionable
- With enough detail for a developer to implement it
- Prioritized by impact and urgency

ANALYSIS PROCESS:
1. Explore the project structure (use Glob to understand the architecture)
2. Read key files to understand the code
3. Identify problematic patterns, duplicate code, vulnerabilities, etc.
4. Look for opportunities based on:
   - Potential bugs or error-prone code
   - Performance optimizations
   - Security vulnerabilities (OWASP top 10)
   - Code quality (DRY, SOLID, clean code)
   - Legacy or complex code refactoring
   - New features that would improve the product
   - Missing or outdated documentation
   - Missing or incomplete tests
   - Accessibility (a11y)
   - UX improvements
   - Technical debt
   - Outdated dependencies

5. OPTIONAL: If relevant, use WebSearch to:
   - Search for competitor features or similar products
   - Research current best practices
   - Find solutions to specific technical problems
   - Research known vulnerabilities in dependencies

AVAILABLE CATEGORIES:
- bug_fix: Fix existing or potential bugs
- performance: Performance optimizations
- security: Security improvements
- code_quality: Code quality improvements (readability, maintainability)
- refactoring: Code restructuring without changing functionality
- new_feature: New features
- documentation: New or improved documentation
- testing: New or improved tests
- accessibility: Accessibility improvements
- ux_improvement: User experience improvements
- tech_debt: Technical debt reduction
- dependency_update: Dependency updates
- other: Other improvements

PRIORITIES:
- critical: Must be resolved immediately (security, severe bugs)
- high: Important for the next release
- medium: Should be done soon
- low: Nice to have

ESTIMATED COMPLEXITY:
- trivial: Less than 30 minutes, minimal changes
- simple: 1-2 hours, changes in 1-2 files
- moderate: Half a day, changes in several files
- complex: 1-2 days, significant changes
- very_complex: More than 2 days, architectural changes

RESPOND ONLY with valid JSON (all text in ENGLISH):
{
  "opportunities": [
    {
      "title": "Descriptive and concise title",
      "description": "Detailed description of the problem and proposed solution",
      "category": "bug_fix|performance|security|...",
      "priority": "low|medium|high|critical",
      "prompt": "Complete and detailed prompt that will be used to implement this improvement. Include: context, involved files, specific steps, and acceptance criteria.",
      "affected_files": ["path/to/file1.ts", "path/to/file2.ts"],
      "estimated_complexity": "trivial|simple|moderate|complex|very_complex",
      "reasoning": "Why this opportunity was identified and what is the expected impact",
      "source_type": "code_analysis|best_practices|competitor_analysis|security_scan|performance_analysis|user_feedback",
      "external_reference": "Reference URL if applicable (e.g., documentation, article, competitor)",
      "tags": ["tag1", "tag2"]
    }
  ],
  "summary": "Brief summary of the analysis performed"
}

IMPORTANT:
- ALL text (title, description, prompt, reasoning, summary) must be in ENGLISH
- The "prompt" must be detailed enough for another agent to implement the improvement without ambiguity
- Include specific files to be modified when possible
- Be specific in "reasoning" to justify why this opportunity is valuable
- DO NOT include trivial or low-value opportunities
- DO NOT repeat similar opportunities

CRITICAL - RESPONSE FORMAT:
- Your response MUST be ONLY the JSON, without additional text before or after
- DO NOT use markdown, DO NOT use \`\`\`json, DO NOT write explanations
- Start your response directly with { and end with }
- If you cannot complete the analysis, return: {"opportunities": [], "summary": "Error: <reason>"}`
};

const FINAL_JSON_INSTRUCTIONS: Record<OpportunityLanguage, string> = {
  es: `

FORMATO DE SALIDA OBLIGATORIO:
- Tu respuesta FINAL debe ser ÚNICAMENTE un JSON válido
- El JSON debe comenzar con { y terminar con }
- NO incluyas texto explicativo antes o después del JSON
- NO uses markdown ni bloques de código (sin \`\`\`json)
- NO escribas comentarios, solo el JSON puro
- TODOS los textos dentro del JSON deben estar en ESPAÑOL

Después de usar las herramientas para analizar el código, tu respuesta final DEBE ser solo el JSON con el formato especificado arriba.`,
  en: `

MANDATORY OUTPUT FORMAT:
- Your FINAL response must be ONLY valid JSON
- The JSON must start with { and end with }
- DO NOT include explanatory text before or after the JSON
- DO NOT use markdown or code blocks (no \`\`\`json)
- DO NOT write comments, only pure JSON
- ALL text inside the JSON must be in ENGLISH

After using the tools to analyze the code, your final response MUST be only the JSON with the format specified above.`
};

function gatherProjectContext(workspacePath: string): string {
  const parts: string[] = [];

  // Read package.json for project info
  const pkgPath = join(workspacePath, 'package.json');
  if (existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
      parts.push(`PROYECTO: ${pkg.name || 'unknown'} v${pkg.version || '?'}`);
      if (pkg.description) parts.push(`Descripción: ${pkg.description}`);

      const deps = Object.keys(pkg.dependencies || {});
      const devDeps = Object.keys(pkg.devDependencies || {});
      if (deps.length > 0) parts.push(`Dependencias principales: ${deps.slice(0, 20).join(', ')}`);
      if (devDeps.length > 0) parts.push(`DevDeps: ${devDeps.slice(0, 15).join(', ')}`);
    } catch { /* ignore */ }
  }

  // Read CLAUDE.md for project-specific instructions
  const claudeMdPath = join(workspacePath, 'CLAUDE.md');
  if (existsSync(claudeMdPath)) {
    try {
      const claudeMd = readFileSync(claudeMdPath, 'utf-8');
      // Truncate to avoid huge context
      const truncated = claudeMd.length > 3000 ? claudeMd.substring(0, 3000) + '\n...[truncado]' : claudeMd;
      parts.push(`\nDOCUMENTACIÓN DEL PROYECTO (CLAUDE.md):\n${truncated}`);
    } catch { /* ignore */ }
  }

  return parts.length > 0 ? parts.join('\n') : '';
}

function buildOpportunityFinderPrompt(
  state: OpportunityScanPipelineState,
  repos?: ClonedRepoInfo[]
): string {
  const lang = state.language || 'es';

  // Gather real project context from the filesystem
  const projectContext = gatherProjectContext(state.workspacePath);

  let focusContext = '';
  if (state.focusPrompt) {
    const focusHeader = lang === 'es'
      ? 'ENFOQUE ESPECIAL (el usuario quiere que te enfoques en):'
      : 'SPECIAL FOCUS (the user wants you to focus on):';
    focusContext = `
${focusHeader}
${state.focusPrompt}
`;
  }

  if (lang === 'es') {
    return `Analiza este proyecto y encuentra entre ${state.minOpportunities} y ${state.maxOpportunities} oportunidades de mejora.

DIRECTORIO DE TRABAJO: ${state.workspacePath}
${projectContext ? `\n${projectContext}\n` : ''}
${focusContext}
INSTRUCCIONES DE EXPLORACIÓN:
1. PRIMERO usa Glob con patrones como "app/**/*" o "**/*.ts" para entender la estructura del proyecto
2. Lee archivos clave: package.json, configuraciones, rutas principales, modelos de datos
3. Busca los módulos/carpetas relevantes al enfoque del usuario
4. Lee el código de esos módulos en detalle
5. Identifica oportunidades concretas con archivos y líneas específicas

IMPORTANTE:
- Estás dentro del directorio del proyecto. Los archivos están directamente accesibles.
- Debes encontrar AL MENOS ${state.minOpportunities} oportunidades. Si no encuentras bugs, busca mejoras de rendimiento, seguridad, UX, calidad de código, etc.
- Cada oportunidad debe referenciar archivos reales del proyecto.
- Si el usuario pidió analizar un módulo específico, enfócate ahí pero también revisa archivos compartidos (utils, types, API routes).
${FINAL_JSON_INSTRUCTIONS[lang]}`;
  } else {
    return `Analyze this project and find between ${state.minOpportunities} and ${state.maxOpportunities} improvement opportunities.

WORKING DIRECTORY: ${state.workspacePath}
${projectContext ? `\n${projectContext}\n` : ''}
${focusContext}
EXPLORATION INSTRUCTIONS:
1. FIRST use Glob with patterns like "app/**/*" or "**/*.ts" to understand the project structure
2. Read key files: package.json, configurations, main routes, data models
3. Find the modules/folders relevant to the user's focus
4. Read the code of those modules in detail
5. Identify concrete opportunities with specific files and lines

IMPORTANT:
- You are inside the project directory. Files are directly accessible.
- You MUST find AT LEAST ${state.minOpportunities} opportunities. If no bugs found, look for performance, security, UX, code quality improvements, etc.
- Each opportunity must reference real project files.
- If the user asked to analyze a specific module, focus there but also check shared files (utils, types, API routes).
${FINAL_JSON_INSTRUCTIONS[lang]}`;
  }
}

// Build a formatting prompt to convert analysis to JSON
function buildFormattingPrompt(
  analysisResult: string,
  lang: OpportunityLanguage,
  minOpportunities: number,
  maxOpportunities: number
): string {
  const jsonFormat = `{
  "opportunities": [
    {
      "title": "string",
      "description": "string",
      "category": "bug_fix|performance|security|code_quality|refactoring|new_feature|documentation|testing|accessibility|ux_improvement|tech_debt|dependency_update|other",
      "priority": "low|medium|high|critical",
      "prompt": "string - detailed implementation prompt",
      "affected_files": ["path/to/file.ts"],
      "estimated_complexity": "trivial|simple|moderate|complex|very_complex",
      "reasoning": "string",
      "source_type": "code_analysis|best_practices|competitor_analysis|security_scan|performance_analysis|user_feedback",
      "external_reference": "string or null",
      "tags": ["tag1", "tag2"]
    }
  ],
  "summary": "string"
}`;

  if (lang === 'es') {
    return `Basándote en el siguiente análisis de código, extrae entre ${minOpportunities} y ${maxOpportunities} oportunidades de mejora y formatea la respuesta como JSON.

ANÁLISIS PREVIO:
${analysisResult}

FORMATO REQUERIDO (responde SOLO con este JSON, sin texto adicional):
${jsonFormat}

REGLAS:
- Responde ÚNICAMENTE con el JSON, sin texto antes o después
- NO uses markdown ni bloques de código
- Todos los textos deben estar en ESPAÑOL
- Si el análisis no contiene oportunidades claras, genera al menos una basada en mejores prácticas generales
- El campo "prompt" debe ser lo suficientemente detallado para implementar la mejora

Tu respuesta JSON:`;
  } else {
    return `Based on the following code analysis, extract between ${minOpportunities} and ${maxOpportunities} improvement opportunities and format the response as JSON.

PREVIOUS ANALYSIS:
${analysisResult}

REQUIRED FORMAT (respond ONLY with this JSON, no additional text):
${jsonFormat}

RULES:
- Respond ONLY with the JSON, no text before or after
- DO NOT use markdown or code blocks
- All text must be in ENGLISH
- If the analysis doesn't contain clear opportunities, generate at least one based on general best practices
- The "prompt" field must be detailed enough to implement the improvement

Your JSON response:`;
  }
}

export async function runOpportunityFinderAgent(
  state: OpportunityScanPipelineState
): Promise<OpportunityFinderResult> {
  const lang = state.language || 'es';

  logger.info({
    scanId: state.scanId,
    workspacePath: state.workspacePath,
    focusPrompt: state.focusPrompt,
    minOpportunities: state.minOpportunities,
    maxOpportunities: state.maxOpportunities,
    language: lang,
  }, 'Starting opportunity finder agent');

  const prompt = buildOpportunityFinderPrompt(state, state.repos);

  // Replace placeholders in system prompt
  const systemPrompt = SYSTEM_PROMPTS[lang]
    .replace('{min}', state.minOpportunities.toString())
    .replace('{max}', state.maxOpportunities.toString());

  // ============================================
  // PHASE 1: Exploration with tools
  // ============================================
  let explorationResult;
  try {
    logger.info({ scanId: state.scanId }, 'Phase 1: Starting code exploration with tools');

    explorationResult = await runClaude({
      prompt,
      cwd: state.workspacePath,
      allowedTools: ALLOWED_TOOLS,
      systemPrompt,
      model: state.model,
      maxTurns: 60, // Allow many turns for thorough exploration
    });
  } catch (claudeError) {
    const errorMsg = claudeError instanceof Error ? claudeError.message : 'Unknown Claude error';
    logger.error({
      scanId: state.scanId,
      error: errorMsg,
    }, 'Claude CLI failed during exploration phase');

    return {
      opportunities: [],
      summary: lang === 'es'
        ? `Error en Claude CLI (fase exploración): ${errorMsg}. El escaneo no pudo completarse.`
        : `Claude CLI error (exploration phase): ${errorMsg}. Scan could not be completed.`,
    };
  }

  // Try to parse JSON from exploration result first
  let parsed: OpportunityFinderResult = { opportunities: [], summary: '' };
  let needsPhase2 = false;

  try {
    parsed = parseJsonFromResult<OpportunityFinderResult>(explorationResult.result);

    // Check if result has enough opportunities - if not, force phase 2
    const oppCount = parsed.opportunities?.length || 0;
    if (oppCount < state.minOpportunities) {
      logger.warn({
        scanId: state.scanId,
        found: oppCount,
        required: state.minOpportunities,
      }, 'Phase 1 returned valid JSON but insufficient opportunities, forcing phase 2');
      needsPhase2 = true;
    } else {
      logger.info({ scanId: state.scanId, found: oppCount }, 'Phase 1 returned valid JSON with sufficient opportunities');
    }
  } catch (parseError) {
    needsPhase2 = true;
  }

  if (needsPhase2) {
    // Check if Phase 1 returned valid JSON but empty results (Claude didn't explore)
    // vs Phase 1 returned text analysis that needs formatting
    const phase1WasJson = !!(parsed! && Array.isArray(parsed!.opportunities));
    const phase1ResultText = explorationResult.result;

    if (phase1WasJson && (parsed!.opportunities?.length || 0) < state.minOpportunities) {
      // ============================================
      // PHASE 1b: Re-explore with stronger prompt
      // ============================================
      logger.info({
        scanId: state.scanId,
        previousCount: parsed!.opportunities?.length || 0,
      }, 'Phase 1b: Re-running exploration with stronger prompt (previous attempt returned insufficient results)');

      const retryPrompt = lang === 'es'
        ? `Tu análisis anterior del proyecto devolvió ${parsed!.opportunities?.length || 0} oportunidades, pero necesito AL MENOS ${state.minOpportunities}.

DIRECTORIO DE TRABAJO: ${state.workspacePath}

${state.focusPrompt ? `ENFOQUE: ${state.focusPrompt}\n` : ''}
DEBES hacer lo siguiente:
1. Usa Glob para explorar la estructura: "app/**/*.ts", "components/**/*.tsx", "hooks/**/*.ts", "lib/**/*.ts"
2. Lee al menos 10 archivos diferentes del proyecto
3. Busca problemas REALES: bugs potenciales, código sin validación, queries sin optimizar, componentes sin manejo de errores, etc.
4. Cada oportunidad debe referenciar archivos y líneas REALES que hayas leído

ES OBLIGATORIO encontrar al menos ${state.minOpportunities} oportunidades. NO puedes devolver un array vacío.
Si no encuentras bugs, busca: rendimiento, seguridad, UX, testing, código duplicado, deuda técnica, etc.

${FINAL_JSON_INSTRUCTIONS[lang]}`
        : `Your previous analysis returned ${parsed!.opportunities?.length || 0} opportunities, but I need AT LEAST ${state.minOpportunities}.

WORKING DIRECTORY: ${state.workspacePath}

${state.focusPrompt ? `FOCUS: ${state.focusPrompt}\n` : ''}
You MUST do the following:
1. Use Glob to explore the structure: "app/**/*.ts", "components/**/*.tsx", "hooks/**/*.ts", "lib/**/*.ts"
2. Read at least 10 different project files
3. Look for REAL issues: potential bugs, unvalidated code, unoptimized queries, components without error handling, etc.
4. Each opportunity must reference REAL files and lines you've read

It is MANDATORY to find at least ${state.minOpportunities} opportunities. You CANNOT return an empty array.
If no bugs found, look for: performance, security, UX, testing, duplicate code, tech debt, etc.

${FINAL_JSON_INSTRUCTIONS[lang]}`;

      try {
        const retryResult = await runClaude({
          prompt: retryPrompt,
          cwd: state.workspacePath,
          allowedTools: ALLOWED_TOOLS,
          systemPrompt: SYSTEM_PROMPTS[lang]
            .replace('{min}', state.minOpportunities.toString())
            .replace('{max}', state.maxOpportunities.toString()),
          model: state.model,
          maxTurns: 60,
        });

        try {
          parsed = parseJsonFromResult<OpportunityFinderResult>(retryResult.result);
          logger.info({ scanId: state.scanId, found: parsed.opportunities?.length || 0 }, 'Phase 1b returned valid JSON');
        } catch {
          // Phase 1b returned text - format it in Phase 2
          const maxLen = 12000;
          const truncated = retryResult.result.length > maxLen
            ? retryResult.result.substring(0, maxLen) + '\n\n[... truncado ...]'
            : retryResult.result;

          const fmtPrompt = buildFormattingPrompt(truncated, lang, state.minOpportunities, state.maxOpportunities);
          const fmtResult = await runClaude({
            prompt: fmtPrompt,
            cwd: state.workspacePath,
            allowedTools: [],
            model: 'sonnet',
            maxTurns: 1,
          });

          try {
            parsed = parseJsonFromResult<OpportunityFinderResult>(fmtResult.result);
            logger.info({ scanId: state.scanId }, 'Phase 1b + formatting successful');
          } catch {
            parsed = {
              opportunities: [],
              summary: lang === 'es'
                ? `Análisis completado pero no se pudo formatear. Resumen: ${retryResult.result.substring(0, 500)}...`
                : `Analysis completed but could not be formatted. Summary: ${retryResult.result.substring(0, 500)}...`,
            };
          }
        }
      } catch (retryError) {
        const errorMsg = retryError instanceof Error ? retryError.message : 'Unknown error';
        logger.error({ scanId: state.scanId, error: errorMsg }, 'Phase 1b exploration failed');
        // Keep the original parsed result (might have some opportunities)
      }
    } else {
      // ============================================
      // PHASE 2: Format text analysis as JSON (no tools)
      // ============================================
      const maxAnalysisLength = 12000;
      const truncatedAnalysis = phase1ResultText.length > maxAnalysisLength
        ? phase1ResultText.substring(0, maxAnalysisLength) + '\n\n[... análisis truncado por longitud ...]'
        : phase1ResultText;

      logger.info({
        scanId: state.scanId,
        originalLength: phase1ResultText.length,
        truncatedLength: truncatedAnalysis.length,
        resultPreview: truncatedAnalysis.substring(0, 200),
      }, 'Phase 2: Formatting text analysis as JSON');

      const formattingPrompt = buildFormattingPrompt(
        truncatedAnalysis,
        lang,
        state.minOpportunities,
        state.maxOpportunities
      );

      try {
        const formattingResult = await runClaude({
          prompt: formattingPrompt,
          cwd: state.workspacePath,
          allowedTools: [],
          model: 'sonnet',
          maxTurns: 1,
        });

        try {
          parsed = parseJsonFromResult<OpportunityFinderResult>(formattingResult.result);
          logger.info({ scanId: state.scanId }, 'Phase 2 formatting successful');
        } catch (formatParseError) {
          logger.error({
            scanId: state.scanId,
            error: formatParseError,
            resultPreview: formattingResult.result.substring(0, 500),
          }, 'Phase 2 formatting failed to produce valid JSON');

          parsed = {
            opportunities: [],
            summary: lang === 'es'
              ? `Análisis completado pero no se pudo formatear como JSON. Resumen: ${phase1ResultText.substring(0, 500)}...`
              : `Analysis completed but could not be formatted as JSON. Summary: ${phase1ResultText.substring(0, 500)}...`,
          };
        }
      } catch (formattingError) {
        const errorMsg = formattingError instanceof Error ? formattingError.message : 'Unknown error';
        logger.error({
          scanId: state.scanId,
          error: errorMsg,
        }, 'Phase 2 formatting call failed');

        parsed = {
          opportunities: [],
          summary: lang === 'es'
            ? `Error en fase de formateo: ${errorMsg}. Análisis parcial: ${phase1ResultText.substring(0, 300)}...`
            : `Formatting phase error: ${errorMsg}. Partial analysis: ${phase1ResultText.substring(0, 300)}...`,
        };
      }
    }
  }

  // Validate the parsed result has the expected structure
  if (!parsed.opportunities) {
    parsed.opportunities = [];
  }
  if (!parsed.summary) {
    parsed.summary = lang === 'es' ? 'Análisis completado' : 'Analysis completed';
  }

  logger.info({
    scanId: state.scanId,
    opportunitiesFound: parsed.opportunities.length,
    summary: parsed.summary,
  }, 'Opportunity finder completed');

  return parsed;
}
