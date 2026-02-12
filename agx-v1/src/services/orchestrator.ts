import { v4 as uuidv4 } from 'uuid';
import type {
  TaskRequest,
  TaskResponse,
  PipelineState,
  TokenUsage,
  GitResult,
  PipelineStage,
  PipelineMode,
} from '../types/index.js';
import { runLocatorAgent } from '../agents/locator.agent.js';
import { runPlannerAgent } from '../agents/planner.agent.js';
import { runImplementerAgent } from '../agents/implementer.agent.js';
import { runVerifierAgent } from '../agents/verifier.agent.js';
import { runFixerAgent } from '../agents/fixer.agent.js';
import { runGitAgent } from '../agents/git.agent.js';
import { runAnalyzerAgent } from '../agents/analyzer.agent.js';
import { runFastDevAgent } from '../agents/fast-dev.agent.js';
import { runFastFinishAgent } from '../agents/fast-finish.agent.js';
import { buildPlannerPrompt } from '../agents/prompts.js';
import { getTokenUsageForSessions } from '../utils/token-counter.js';
import { createChildLogger } from '../utils/logger.js';
import { config } from '../config.js';
import { saveTask, saveStage, saveTestResults, getTaskContinuationContext } from '../repositories/task-history.repository.js';
import {
  registerTask,
  unregisterTask,
  updateTaskStage,
  updateTaskWorkspace,
  isTaskCancelled,
  getActiveTaskCount,
  addTaskLog,
  addTaskOutput,
} from './task-tracker.js';
import {
  enqueueTask,
  processNextInQueue,
  processAvailableTasksInQueue,
  initializeQueue,
  getQueueLength,
} from './task-queue.js';
import { matchSkills, buildSkillsContext } from './skills.js';
import {
  persistTaskStart,
  updateTaskStatus,
  persistStageProgress,
  saveCheckpoint,
  getCheckpoints,
} from './task-persistence.js';

const logger = createChildLogger('orchestrator');

function initState(request: TaskRequest, taskId: string): PipelineState {
  return {
    taskId,
    originalPrompt: request.prompt,
    model: request.model || config.defaultModel,
    workspacePath: config.targetProjectPath,
    repoUrl: '',
    repos: [],
    branch: request.branch || 'main',
    targetPaths: [],
    plan: null,
    changes: [],
    tokensUsed: {
      total_input: 0,
      total_output: 0,
      total: 0,
      by_agent: {},
    },
    currentStage: 'locator',
    stagesCompleted: [],
    sessionIds: {},
    pipelineMode: request.pipeline_mode || 'auto',
    expertMode: request.expert_mode,
    // previousTaskContext will be set in executePipeline if continue_task_id is provided
  };
}

function markStageCompleted(state: PipelineState, stage: PipelineStage): void {
  if (!state.stagesCompleted.includes(stage)) {
    state.stagesCompleted.push(stage);
  }
}

function buildSuccessResponse(state: PipelineState, gitResult?: GitResult): TaskResponse {
  // Collect token usage from all sessions
  const tokenUsage = getTokenUsageForSessions(state.sessionIds);

  // Get the implementer session ID for conversation continuation
  const conversationId = state.sessionIds['fast-dev'] || state.sessionIds['implementer'] || undefined;

  return {
    success: true,
    task_id: state.taskId,
    stages_completed: state.stagesCompleted,
    changes: state.changes,
    git: gitResult,
    token_usage: tokenUsage,
    conversation_id: conversationId,
  };
}

function buildErrorResponse(state: PipelineState, error: unknown): TaskResponse {
  const errorMessage = error instanceof Error ? error.message : String(error);
  const tokenUsage = getTokenUsageForSessions(state.sessionIds);

  return {
    success: false,
    task_id: state.taskId,
    stages_completed: state.stagesCompleted,
    changes: state.changes,
    token_usage: tokenUsage,
    error: errorMessage,
    stage_failed: state.currentStage,
  };
}

// Flag to track if queue has been initialized
let queueInitialized = false;

/**
 * Internal function that actually runs the pipeline
 * Can be called directly or from the queue
 */
async function executePipeline(request: TaskRequest, taskId: string): Promise<TaskResponse> {
  const state = initState(request, taskId);

  // Load context from previous task if continue_task_id is provided
  if (request.continue_task_id) {
    const previousContext = await getTaskContinuationContext(request.continue_task_id);
    if (previousContext) {
      state.previousTaskContext = {
        taskId: previousContext.task_id,
        originalPrompt: previousContext.original_prompt,
        gitBranch: previousContext.git_branch,
        changes: previousContext.changes.map(c => ({
          file: c.file_path,
          action: c.action,
          summary: c.summary,
        })),
        summary: previousContext.summary,
      };

      // If continuing a task, use the same branch (don't create a new one)
      if (previousContext.git_branch && request.create_branch !== true) {
        state.branch = previousContext.git_branch;
        // Disable branch creation since we want to continue on the same branch
        request.create_branch = false;
      }

      logger.info({
        taskId: state.taskId,
        continueFromTask: request.continue_task_id,
        previousBranch: previousContext.git_branch,
        previousChangesCount: previousContext.changes.length,
      }, 'Continuing from previous task context');
    } else {
      logger.warn({
        taskId: state.taskId,
        continueTaskId: request.continue_task_id,
      }, 'Previous task not found, starting fresh');
    }
  }

  // Register task for tracking with full configuration
  registerTask({
    taskId: state.taskId,
    prompt: state.originalPrompt,
    model: state.model,
    pipelineMode: request.pipeline_mode || 'auto',
    repoUrl: request.repo_url,
    repos: request.repos,
    branch: request.branch,
    autoCommit: request.auto_commit,
    createPr: request.create_pr,
    createBranch: request.create_branch,
    continueTaskId: request.continue_task_id,
  });

  logger.info({ taskId: state.taskId, prompt: request.prompt, repoUrl: request.repo_url }, 'Starting pipeline');

  // Persist task start to DB (so it survives crashes)
  await persistTaskStart(
    state.taskId,
    state.originalPrompt,
    state.model,
    request.pipeline_mode,
    request.expert_mode,
  );

  // Helper to check cancellation
  const checkCancellation = () => {
    if (isTaskCancelled(state.taskId)) {
      throw new Error('Task was cancelled by user');
    }
  };

  try {
    // Use target project path (the actual project code, not the monorepo root)
    state.workspacePath = config.targetProjectPath;

    // Detect current git branch
    try {
      const { execSync } = await import('child_process');
      state.branch = execSync('git rev-parse --abbrev-ref HEAD', { cwd: config.projectRoot }).toString().trim();
    } catch {
      state.branch = 'main';
    }

    updateTaskWorkspace(state.taskId, state.workspacePath);

    // ===========================================
    // MATCH SKILLS
    // ===========================================
    try {
      const matched = matchSkills(state.originalPrompt);
      if (matched.length > 0) {
        state.skillsContext = buildSkillsContext(matched);
        state.matchedSkills = matched.map(s => s.id);
        addTaskLog(state.taskId, 'info', `Skills activadas: ${matched.map(s => s.name).join(', ')}`, {
          skills: state.matchedSkills,
        });
        logger.info({ taskId: state.taskId, skills: state.matchedSkills }, 'Skills matched for task');
      }
    } catch (err) {
      logger.warn({ error: err }, 'Failed to match skills, continuing without');
    }

    // ===========================================
    // DETERMINAR MODO DE EJECUCIÓN
    // ===========================================
    let effectiveMode: 'full' | 'fast' = 'full';

    if (state.pipelineMode === 'auto') {
      // Run complexity analyzer to decide mode
      checkCancellation();
      logger.info({ taskId: state.taskId }, 'Stage 0: Complexity Analyzer');
      state.currentStage = 'analyzer';
      updateTaskStage(state.taskId, 'analyzer');

      try {
        const analysis = await runAnalyzerAgent(state);
        state.complexityAnalysis = analysis;
        markStageCompleted(state, 'analyzer');

        effectiveMode = analysis.recommended_mode;

        // Log analysis result
        addTaskLog(state.taskId, 'output', `Analisis completado: complejidad=${analysis.complexity}, modo=${analysis.recommended_mode}`, {
          complexity: analysis.complexity,
          recommendedMode: analysis.recommended_mode,
          needsTests: analysis.needs_tests,
          estimatedFiles: analysis.estimated_files,
          reason: analysis.reason,
        });

        logger.info(
          {
            taskId: state.taskId,
            complexity: analysis.complexity,
            recommendedMode: analysis.recommended_mode,
            needsTests: analysis.needs_tests,
            estimatedFiles: analysis.estimated_files
          },
          'Complexity analysis completed'
        );

        // Checkpoint after analyzer
        await saveCheckpoint(state.taskId, 'analyzer', 0, analysis, state);
        await persistStageProgress(state.taskId, 'analyzer', state.stagesCompleted);
      } catch (analyzerError) {
        // Fallback: if the analyzer fails, use sensible defaults instead of failing the whole pipeline
        const analyzerErrorMessage = analyzerError instanceof Error ? analyzerError.message : String(analyzerError);
        logger.error(
          {
            taskId: state.taskId,
            error: analyzerErrorMessage,
            stack: analyzerError instanceof Error ? analyzerError.stack : undefined,
          },
          'Complexity analyzer failed, using default values (complexity=medium, mode=auto->full)'
        );

        addTaskLog(state.taskId, 'info', `Analyzer fallo: ${analyzerErrorMessage}. Usando valores por defecto: complejidad=medium, modo=full`, {
          error: analyzerErrorMessage,
          fallbackComplexity: 'medium',
          fallbackMode: 'full',
        });

        // Apply sensible defaults
        const defaultAnalysis = {
          complexity: 'medium' as const,
          recommended_mode: 'full' as const,
          needs_tests: true,
          estimated_files: 5,
          is_backend: true,
          reason: 'Analyzer failed - using default medium complexity',
        };

        state.complexityAnalysis = defaultAnalysis;
        effectiveMode = defaultAnalysis.recommended_mode;
        markStageCompleted(state, 'analyzer');
      }
    } else {
      effectiveMode = state.pipelineMode === 'fast' ? 'fast' : 'full';
      logger.info({ taskId: state.taskId, mode: effectiveMode }, 'Using specified pipeline mode');
    }

    let gitResult: GitResult | undefined;

    if (effectiveMode === 'fast') {
      // ===========================================
      // FAST MODE: 2 agentes combinados
      // ===========================================
      logger.info({ taskId: state.taskId }, 'Executing FAST pipeline mode');

      // ETAPA 1: Fast Dev (locate + plan + implement)
      checkCancellation();
      logger.info({ taskId: state.taskId }, 'Stage 1: Fast-Dev (locate+plan+implement)');
      state.currentStage = 'fast-dev';
      updateTaskStage(state.taskId, 'fast-dev');

      const devResult = await runFastDevAgent(state);
      state.targetPaths = devResult.paths || [];
      state.plan = {
        plan: devResult.plan || [],
        files_to_modify: devResult.changes?.map(c => c.file) || [],
        considerations: [],
      };
      state.changes = devResult.changes || [];
      markStageCompleted(state, 'fast-dev');

      // Log fast-dev result
      addTaskLog(state.taskId, 'output', `Fast-Dev completado: ${state.changes.length} archivos modificados`, {
        paths: state.targetPaths,
        changes: state.changes.map(c => ({ file: c.file, action: c.action })),
        planSteps: state.plan.plan.length,
      });

      logger.info(
        {
          taskId: state.taskId,
          paths: state.targetPaths.length,
          changes: state.changes.length
        },
        'Fast-Dev completed'
      );

      // Checkpoint after fast-dev
      await saveCheckpoint(state.taskId, 'fast-dev', 1, { paths: state.targetPaths, changes: state.changes }, state);
      await persistStageProgress(state.taskId, 'fast-dev', state.stagesCompleted);

      // ETAPA 2: Fast Finish (verify + fix + git)
      checkCancellation();
      logger.info({ taskId: state.taskId }, 'Stage 2: Fast-Finish (verify+fix+git)');
      state.currentStage = 'fast-finish';
      updateTaskStage(state.taskId, 'fast-finish');

      const finishResult = await runFastFinishAgent(
        state,
        state.changes,
        request.create_branch ?? true,
        request.create_pr ?? true
      );

      // Add any additional changes from fixes
      if (finishResult.additional_changes && finishResult.additional_changes.length > 0) {
        state.changes = [...state.changes, ...finishResult.additional_changes];
      }
      markStageCompleted(state, 'fast-finish');

      // Extract git result
      if (finishResult.git) {
        gitResult = {
          branch: finishResult.git.branch,
          commit_sha: finishResult.git.commit_sha,
          pr_url: finishResult.git.pr_url,
        };
      }

      // Log fast-finish result with git details
      addTaskLog(state.taskId, 'output', `Fast-Finish completado: verificacion=${finishResult.verification?.passed ? 'OK' : 'con correcciones'}`, {
        verificacion_exitosa: finishResult.verification?.passed,
        problemas_corregidos: finishResult.verification?.issues_fixed || [],
        cambios_adicionales: finishResult.additional_changes?.map(c => c.file) || [],
        git: gitResult ? {
          branch: gitResult.branch,
          commit_sha: gitResult.commit_sha,
          pr_url: gitResult.pr_url,
        } : null,
      });

      logger.info(
        {
          taskId: state.taskId,
          verificationPassed: finishResult.verification?.passed,
          issuesFixed: finishResult.verification?.issues_fixed?.length || 0,
          branch: gitResult?.branch
        },
        'Fast-Finish completed'
      );

      // Checkpoint after fast-finish
      await saveCheckpoint(state.taskId, 'fast-finish', 2, { git: gitResult, verification: finishResult.verification }, state);
      await persistStageProgress(state.taskId, 'fast-finish', state.stagesCompleted);

    } else {
      // ===========================================
      // FULL MODE: Pipeline completo (comportamiento original)
      // ===========================================
      logger.info({ taskId: state.taskId }, 'Executing FULL pipeline mode');

      // ETAPA 1: Localizador
      checkCancellation();
      logger.info({ taskId: state.taskId }, 'Stage 1: Locator');
      state.currentStage = 'locator';
      updateTaskStage(state.taskId, 'locator');

      try {
        const locatorResult = await runLocatorAgent(state);

        // Validate locator result
        if (!locatorResult || !Array.isArray(locatorResult.paths)) {
          logger.error({ locatorResult }, 'Locator returned invalid result');
          throw new Error(`Locator returned invalid result: ${JSON.stringify(locatorResult)}`);
        }

        state.targetPaths = locatorResult.paths;
        markStageCompleted(state, 'locator');

        // Log locator result with detailed paths
        addTaskLog(state.taskId, 'output', `Localizacion completada: ${state.targetPaths.length} archivos relevantes encontrados`, {
          archivos_encontrados: state.targetPaths,
          razon: locatorResult.reason,
        });
      } catch (locatorError) {
        // Fallback: if the locator fails, use empty paths and let the planner figure it out
        const locatorErrorMessage = locatorError instanceof Error ? locatorError.message : String(locatorError);
        logger.error(
          {
            taskId: state.taskId,
            error: locatorErrorMessage,
          },
          'Locator failed, continuing with empty paths (planner will explore)'
        );

        addTaskLog(state.taskId, 'info', `Locator fallo: ${locatorErrorMessage}. Continuando sin paths pre-localizados.`, {
          error: locatorErrorMessage,
        });

        state.targetPaths = [];
        markStageCompleted(state, 'locator');
      }

      logger.info(
        { taskId: state.taskId, paths: state.targetPaths, pathCount: state.targetPaths.length },
        'Locator completed, found paths'
      );

      // Checkpoint after locator
      await saveCheckpoint(state.taskId, 'locator', 1, { paths: state.targetPaths }, state);
      await persistStageProgress(state.taskId, 'locator', state.stagesCompleted);

      // ETAPA 2: Enriquecimiento (código local)
      const enrichedPrompt = buildPlannerPrompt(state.originalPrompt, state.targetPaths);

      // ETAPA 3: Planificador
      checkCancellation();
      logger.info({ taskId: state.taskId }, 'Stage 3: Planner');
      state.currentStage = 'planner';
      updateTaskStage(state.taskId, 'planner');

      try {
        const planResult = await runPlannerAgent(state, enrichedPrompt);
        state.plan = planResult;
        markStageCompleted(state, 'planner');

        addTaskLog(state.taskId, 'output', `Plan creado: ${planResult.plan.length} pasos a ejecutar`, {
          pasos: planResult.plan.map(step => ({
            paso: step.step,
            archivo: step.file,
            accion: step.action,
            descripcion: step.description,
          })),
          archivos_a_modificar: planResult.files_to_modify,
          consideraciones: planResult.considerations,
        });

        logger.info(
          { taskId: state.taskId, steps: planResult.plan.length },
          'Planner completed'
        );

        // Checkpoint after planner
        await saveCheckpoint(state.taskId, 'planner', 2, planResult, state);
        await persistStageProgress(state.taskId, 'planner', state.stagesCompleted);
      } catch (plannerError) {
        const plannerErrorMessage = plannerError instanceof Error ? plannerError.message : String(plannerError);
        logger.error({ taskId: state.taskId, error: plannerErrorMessage }, 'Planner failed, using empty plan (implementer will figure it out)');
        addTaskLog(state.taskId, 'info', `Planner fallo: ${plannerErrorMessage}. Continuando sin plan pre-definido.`);
        state.plan = { plan: [], files_to_modify: state.targetPaths, considerations: [] };
        markStageCompleted(state, 'planner');
      }

      // ETAPA 4: Implementador
      checkCancellation();
      logger.info({ taskId: state.taskId }, 'Stage 4: Implementer');
      state.currentStage = 'implementer';
      updateTaskStage(state.taskId, 'implementer');

      try {
        const implResult = await runImplementerAgent(state);
        state.changes = implResult.changes || [];
        markStageCompleted(state, 'implementer');

        addTaskLog(state.taskId, 'output', `Implementacion completada: ${state.changes.length} archivos modificados`, {
          archivos_modificados: state.changes.map(c => ({
            archivo: c.file,
            accion: c.action,
            resumen: c.summary,
          })),
          resumen: implResult.summary,
        });

        logger.info(
          { taskId: state.taskId, changes: state.changes.length },
          'Implementer completed'
        );

        // Checkpoint after implementer
        await saveCheckpoint(state.taskId, 'implementer', 3, { changes: state.changes }, state);
        await persistStageProgress(state.taskId, 'implementer', state.stagesCompleted);
      } catch (implError) {
        const implErrorMessage = implError instanceof Error ? implError.message : String(implError);
        logger.error({ taskId: state.taskId, error: implErrorMessage }, 'Implementer failed');
        addTaskLog(state.taskId, 'error', `Implementer fallo: ${implErrorMessage}`);
        state.changes = [];
        markStageCompleted(state, 'implementer');
      }

      // Skip verification and git if no changes were made (task already implemented or implementer failed)
      if (state.changes.length === 0) {
        logger.info({ taskId: state.taskId }, 'No changes made - skipping Verifier, Fixer, and Git stages');
        addTaskLog(state.taskId, 'output', 'No se realizaron cambios. Saltando verificación y git.');
        markStageCompleted(state, 'verifier');
      } else {
        // ETAPA 5-6: Verificador + Fixer Loop
        let verified = false;
        let iterations = 0;
        const maxIterations = config.maxFixIterations;

        while (!verified && iterations < maxIterations) {
          checkCancellation();
          logger.info(
            { taskId: state.taskId, iteration: iterations + 1 },
            'Stage 5: Verifier'
          );
          state.currentStage = 'verifier';
          updateTaskStage(state.taskId, 'verifier');

          try {
            const verifyResult = await runVerifierAgent(state);

            if (verifyResult.passed) {
              verified = true;
              markStageCompleted(state, 'verifier');
              addTaskLog(state.taskId, 'output', 'Verificacion exitosa: codigo aprobado', {
                tests_ejecutados: verifyResult.test_results?.length || 0,
                tests_pasaron: verifyResult.tests_passed,
                sugerencias: verifyResult.suggestions,
              });
              logger.info({ taskId: state.taskId }, 'Verification passed');
            } else {
              iterations++;
              addTaskLog(state.taskId, 'info', `Verificacion encontro ${verifyResult.bugs.length} problemas (intento ${iterations}/${maxIterations})`, {
                bugs: verifyResult.bugs.map(b => ({
                  archivo: b.file,
                  linea: b.line,
                  problema: b.issue,
                  severidad: b.severity,
                })),
              });
              logger.warn(
                { taskId: state.taskId, bugs: verifyResult.bugs.length, iteration: iterations },
                'Verification failed, running fixer'
              );

              if (iterations < maxIterations) {
                checkCancellation();
                logger.info({ taskId: state.taskId }, 'Stage 6: Fixer');
                state.currentStage = 'fixer';
                updateTaskStage(state.taskId, 'fixer');

                addTaskLog(state.taskId, 'info', `Corrigiendo ${verifyResult.bugs.length} problemas encontrados...`);

                try {
                  await runFixerAgent(state, verifyResult.bugs);
                  markStageCompleted(state, 'fixer');
                  addTaskLog(state.taskId, 'output', 'Correcciones aplicadas');
                } catch (fixerError) {
                  const fixerErrorMessage = fixerError instanceof Error ? fixerError.message : String(fixerError);
                  logger.error({ taskId: state.taskId, error: fixerErrorMessage }, 'Fixer failed');
                  addTaskLog(state.taskId, 'info', `Fixer fallo: ${fixerErrorMessage}. Continuando...`);
                  markStageCompleted(state, 'fixer');
                }
              }
            }
          } catch (verifierError) {
            // Verifier crashed - skip verification and continue
            const verifierErrorMessage = verifierError instanceof Error ? verifierError.message : String(verifierError);
            logger.error({ taskId: state.taskId, error: verifierErrorMessage }, 'Verifier failed, skipping verification');
            addTaskLog(state.taskId, 'info', `Verificador fallo: ${verifierErrorMessage}. Saltando verificación.`);
            verified = true; // Skip verification loop
            markStageCompleted(state, 'verifier');
          }
        }

        if (!verified) {
          // Don't throw - just log and continue to git
          logger.warn({ taskId: state.taskId }, 'Verification could not pass after max attempts, continuing to git');
          addTaskLog(state.taskId, 'info', `Verificacion no paso despues de ${maxIterations} intentos. Continuando con git.`);
          markStageCompleted(state, 'verifier');
        }

        // ETAPA 7: Git (si auto_commit está habilitado)
        if (request.auto_commit !== false) {
          checkCancellation();
          logger.info({ taskId: state.taskId }, 'Stage 7: Git');
          state.currentStage = 'git';
          updateTaskStage(state.taskId, 'git');

          addTaskLog(state.taskId, 'info', 'Procesando cambios en Git...');

          try {
            gitResult = await runGitAgent(state, request.create_branch ?? true, request.create_pr ?? true);
            markStageCompleted(state, 'git');

            if (gitResult.repos && gitResult.repos.length > 1) {
              addTaskLog(state.taskId, 'output', `Git completado: ${gitResult.repos.length} repositorios actualizados`, {
                repositorios: gitResult.repos.map(r => ({
                  repo: r.repo_path,
                  url: r.repo_url,
                  branch: r.branch,
                  commit: r.commit_sha,
                  pr_url: r.pr_url,
                })),
              });
            } else {
              addTaskLog(state.taskId, 'output', `Git completado: branch=${gitResult.branch}`, {
                branch: gitResult.branch,
                commit_sha: gitResult.commit_sha,
                pr_url: gitResult.pr_url,
              });
            }

            logger.info(
              { taskId: state.taskId, branch: gitResult.branch, pr: gitResult.pr_url },
              'Git completed'
            );

            // Checkpoint after git
            await saveCheckpoint(state.taskId, 'git', 6, gitResult, state);
            await persistStageProgress(state.taskId, 'git', state.stagesCompleted);
          } catch (gitError) {
            const gitErrorMessage = gitError instanceof Error ? gitError.message : String(gitError);
            logger.error({ taskId: state.taskId, error: gitErrorMessage }, 'Git failed');
            addTaskLog(state.taskId, 'info', `Git fallo: ${gitErrorMessage}. Los cambios se realizaron localmente pero no se commitearon.`);
            markStageCompleted(state, 'git');
          }
        }
      } // end of else (changes > 0)
    }

    // ===========================================
    // Respuesta exitosa
    // ===========================================
    const response = buildSuccessResponse(state, gitResult);

    logger.info(
      {
        taskId: state.taskId,
        success: true,
        stages: response.stages_completed,
        totalTokens: response.token_usage.total,
      },
      'Pipeline completed successfully'
    );

    // Update task status to completed in DB
    await updateTaskStatus(state.taskId, 'completed');

    // Save to database (must complete before returning so task_id exists for foreign key references)
    try {
      await saveTask(state, response);
    } catch (err) {
      logger.error({ err, taskId: state.taskId }, 'Failed to save task to database');
    }

    // Unregister task from active tracking (success)
    unregisterTask(state.taskId, true);

    // Process available tasks from queue (don't await, let it run in background)
    processAvailableTasksInQueue().catch(err =>
      logger.error({ err }, 'Failed to process next task from queue')
    );

    return response;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;

    logger.error(
      {
        taskId: state.taskId,
        errorMessage,
        errorStack,
        stage: state.currentStage,
        targetPaths: state.targetPaths,
        hasPlan: !!state.plan,
        workspacePath: state.workspacePath,
      },
      'Pipeline failed'
    );

    // Log error to task tracker
    addTaskLog(state.taskId, 'error', `Error en ${state.currentStage}: ${errorMessage}`);

    const errorResponse = buildErrorResponse(state, error);

    // Determine if this is a cancellation or a real failure
    const isCancellation = errorMessage.includes('cancelled by user');
    await updateTaskStatus(state.taskId, isCancellation ? 'cancelled' : 'failed');

    // Save failed task to database (must complete before returning so task_id exists for foreign key references)
    try {
      await saveTask(state, errorResponse);
    } catch (err) {
      logger.error({ err, taskId: state.taskId }, 'Failed to save failed task to database');
    }

    // Unregister task from active tracking (failure)
    unregisterTask(state.taskId, false);

    // Process available tasks from queue (don't await, let it run in background)
    processAvailableTasksInQueue().catch(err =>
      logger.error({ err }, 'Failed to process next task from queue')
    );

    return errorResponse;
  }
}

/**
 * Main entry point for running a task pipeline
 * Handles queueing when max concurrent tasks is reached
 */
export async function runPipeline(request: TaskRequest): Promise<TaskResponse> {
  // Initialize queue on first call
  if (!queueInitialized) {
    initializeQueue(executePipeline);
    queueInitialized = true;
  }

  // Check concurrent task limit
  const currentCount = getActiveTaskCount();
  const queueLen = getQueueLength();

  if (currentCount >= config.maxConcurrentTasks) {
    // Add to queue instead of rejecting
    logger.info(
      { currentCount, max: config.maxConcurrentTasks, queueLength: queueLen },
      'Max concurrent tasks reached, adding to queue'
    );

    const { taskId, promise } = await enqueueTask(request);

    // Return immediately with queued status
    // The caller can choose to await the promise for the actual result
    // or handle the task_id for tracking
    logger.info({ taskId, queuePosition: queueLen + 1 }, 'Task queued');

    // For synchronous API response, we wait for the queued task to complete
    return promise;
  }

  // Execute immediately
  const taskId = uuidv4();
  return executePipeline(request, taskId);
}

/**
 * Resume an interrupted task from its last checkpoint.
 * Reconstructs PipelineState from the checkpoint snapshot and skips completed stages.
 */
export async function resumePipeline(
  originalTaskId: string,
  originalPrompt: string,
  model: string,
  pipelineMode?: string,
  expertMode?: string,
): Promise<TaskResponse> {
  // Initialize queue on first call
  if (!queueInitialized) {
    initializeQueue(executePipeline);
    queueInitialized = true;
  }

  const newTaskId = uuidv4();

  // Load checkpoints from the original task
  const checkpoints = await getCheckpoints(originalTaskId);

  if (!checkpoints || checkpoints.length === 0) {
    // No checkpoints - fall back to fresh execution
    logger.info({ originalTaskId, newTaskId }, 'No checkpoints found, starting fresh');
    const request: TaskRequest = {
      prompt: originalPrompt,
      model: model as any,
      pipeline_mode: (pipelineMode as PipelineMode) || 'auto',
      expert_mode: (expertMode as any) || undefined,
    };
    return executePipeline(request, newTaskId);
  }

  // Get the last checkpoint to reconstruct state
  const lastCheckpoint = checkpoints[checkpoints.length - 1];
  const snapshot = lastCheckpoint.pipeline_state_snapshot as Record<string, any> || {};
  const completedStages: PipelineStage[] = (snapshot.stagesCompleted || []) as PipelineStage[];

  logger.info({
    originalTaskId,
    newTaskId,
    completedStages,
    lastStage: lastCheckpoint.stage_name,
    checkpointCount: checkpoints.length,
  }, 'Resuming pipeline from checkpoint');

  // Determine the effective mode from checkpoints
  const effectiveMode: 'full' | 'fast' = completedStages.includes('fast-dev') || completedStages.includes('fast-finish')
    ? 'fast'
    : completedStages.includes('locator') || completedStages.includes('planner') || completedStages.includes('implementer')
      ? 'full'
      : (snapshot.pipelineMode === 'fast' ? 'fast' : 'full');

  // Reconstruct state from snapshot
  const state: PipelineState = {
    taskId: newTaskId,
    originalPrompt,
    model: (model as any) || config.defaultModel,
    workspacePath: config.targetProjectPath,
    repoUrl: '',
    repos: [],
    branch: snapshot.branch || 'main',
    targetPaths: snapshot.targetPaths || [],
    plan: snapshot.plan || null,
    changes: snapshot.changes || [],
    tokensUsed: { total_input: 0, total_output: 0, total: 0, by_agent: {} },
    currentStage: lastCheckpoint.stage_name as PipelineStage,
    stagesCompleted: [...completedStages],
    sessionIds: snapshot.sessionIds || {},
    pipelineMode: (pipelineMode as PipelineMode) || snapshot.pipelineMode || 'auto',
    complexityAnalysis: snapshot.complexityAnalysis,
    expertMode: (expertMode as any) || undefined,
    skillsContext: snapshot.skillsContext,
    matchedSkills: snapshot.matchedSkills,
  };

  // Register task for tracking
  registerTask({
    taskId: newTaskId,
    prompt: originalPrompt,
    model: state.model,
    pipelineMode: state.pipelineMode,
  });

  // Persist task start
  await persistTaskStart(newTaskId, originalPrompt, state.model, state.pipelineMode, expertMode);

  const checkCancellation = () => {
    if (isTaskCancelled(state.taskId)) {
      throw new Error('Task was cancelled by user');
    }
  };

  try {
    // Detect current git branch
    try {
      const { execSync } = await import('child_process');
      state.branch = execSync('git rev-parse --abbrev-ref HEAD', { cwd: config.projectRoot }).toString().trim();
    } catch {
      // keep branch from snapshot
    }

    updateTaskWorkspace(state.taskId, state.workspacePath);

    // Re-match skills
    try {
      const matched = matchSkills(state.originalPrompt);
      if (matched.length > 0) {
        state.skillsContext = buildSkillsContext(matched);
        state.matchedSkills = matched.map(s => s.id);
      }
    } catch { /* ignore */ }

    addTaskLog(state.taskId, 'info', `Reanudando tarea desde checkpoint: ${completedStages.join(' → ')} completadas`, {
      originalTaskId,
      completedStages,
      resumeFrom: lastCheckpoint.stage_name,
      mode: effectiveMode,
    });

    let gitResult: GitResult | undefined;

    if (effectiveMode === 'fast') {
      // ===========================================
      // FAST MODE RESUME
      // ===========================================
      logger.info({ taskId: state.taskId }, 'Resuming FAST pipeline');

      // ETAPA 1: Fast Dev
      if (!completedStages.includes('fast-dev')) {
        checkCancellation();
        logger.info({ taskId: state.taskId }, 'Resume Stage 1: Fast-Dev');
        state.currentStage = 'fast-dev';
        updateTaskStage(state.taskId, 'fast-dev');

        const devResult = await runFastDevAgent(state);
        state.targetPaths = devResult.paths || [];
        state.plan = {
          plan: devResult.plan || [],
          files_to_modify: devResult.changes?.map(c => c.file) || [],
          considerations: [],
        };
        state.changes = devResult.changes || [];
        markStageCompleted(state, 'fast-dev');

        addTaskLog(state.taskId, 'output', `Fast-Dev completado: ${state.changes.length} archivos modificados`);
        await saveCheckpoint(state.taskId, 'fast-dev', 1, { paths: state.targetPaths, changes: state.changes }, state);
        await persistStageProgress(state.taskId, 'fast-dev', state.stagesCompleted);
      } else {
        addTaskLog(state.taskId, 'info', 'Saltando fast-dev (ya completado en intento anterior)');
      }

      // ETAPA 2: Fast Finish
      if (!completedStages.includes('fast-finish')) {
        checkCancellation();
        logger.info({ taskId: state.taskId }, 'Resume Stage 2: Fast-Finish');
        state.currentStage = 'fast-finish';
        updateTaskStage(state.taskId, 'fast-finish');

        const finishResult = await runFastFinishAgent(state, state.changes, true, true);

        if (finishResult.additional_changes && finishResult.additional_changes.length > 0) {
          state.changes = [...state.changes, ...finishResult.additional_changes];
        }
        markStageCompleted(state, 'fast-finish');

        if (finishResult.git) {
          gitResult = {
            branch: finishResult.git.branch,
            commit_sha: finishResult.git.commit_sha,
            pr_url: finishResult.git.pr_url,
          };
        }

        addTaskLog(state.taskId, 'output', `Fast-Finish completado: verificacion=${finishResult.verification?.passed ? 'OK' : 'con correcciones'}`);
        await saveCheckpoint(state.taskId, 'fast-finish', 2, { git: gitResult, verification: finishResult.verification }, state);
        await persistStageProgress(state.taskId, 'fast-finish', state.stagesCompleted);
      } else {
        addTaskLog(state.taskId, 'info', 'Saltando fast-finish (ya completado en intento anterior)');
      }

    } else {
      // ===========================================
      // FULL MODE RESUME
      // ===========================================
      logger.info({ taskId: state.taskId }, 'Resuming FULL pipeline');

      // ETAPA 1: Locator
      if (!completedStages.includes('locator')) {
        checkCancellation();
        logger.info({ taskId: state.taskId }, 'Resume Stage 1: Locator');
        state.currentStage = 'locator';
        updateTaskStage(state.taskId, 'locator');

        try {
          const locatorResult = await runLocatorAgent(state);
          if (locatorResult && Array.isArray(locatorResult.paths)) {
            state.targetPaths = locatorResult.paths;
          }
        } catch (err) {
          logger.warn({ error: err }, 'Locator failed during resume, continuing with empty paths');
          state.targetPaths = [];
        }
        markStageCompleted(state, 'locator');

        await saveCheckpoint(state.taskId, 'locator', 1, { paths: state.targetPaths }, state);
        await persistStageProgress(state.taskId, 'locator', state.stagesCompleted);
      } else {
        addTaskLog(state.taskId, 'info', `Saltando locator (ya completado, ${state.targetPaths.length} paths recuperados)`);
      }

      // ETAPA 2: Planner
      if (!completedStages.includes('planner')) {
        checkCancellation();
        logger.info({ taskId: state.taskId }, 'Resume Stage 3: Planner');
        state.currentStage = 'planner';
        updateTaskStage(state.taskId, 'planner');

        const enrichedPrompt = buildPlannerPrompt(state.originalPrompt, state.targetPaths);

        try {
          const planResult = await runPlannerAgent(state, enrichedPrompt);
          state.plan = planResult;
        } catch (err) {
          logger.warn({ error: err }, 'Planner failed during resume');
          state.plan = { plan: [], files_to_modify: state.targetPaths, considerations: [] };
        }
        markStageCompleted(state, 'planner');

        await saveCheckpoint(state.taskId, 'planner', 2, state.plan, state);
        await persistStageProgress(state.taskId, 'planner', state.stagesCompleted);
      } else {
        addTaskLog(state.taskId, 'info', `Saltando planner (ya completado, ${state.plan?.plan.length || 0} pasos recuperados)`);
      }

      // ETAPA 3: Implementer
      if (!completedStages.includes('implementer')) {
        checkCancellation();
        logger.info({ taskId: state.taskId }, 'Resume Stage 4: Implementer');
        state.currentStage = 'implementer';
        updateTaskStage(state.taskId, 'implementer');

        try {
          const implResult = await runImplementerAgent(state);
          state.changes = implResult.changes || [];
        } catch (err) {
          logger.error({ error: err }, 'Implementer failed during resume');
          state.changes = [];
        }
        markStageCompleted(state, 'implementer');

        await saveCheckpoint(state.taskId, 'implementer', 3, { changes: state.changes }, state);
        await persistStageProgress(state.taskId, 'implementer', state.stagesCompleted);
      } else {
        addTaskLog(state.taskId, 'info', `Saltando implementer (ya completado, ${state.changes.length} cambios recuperados)`);
      }

      // ETAPA 4-5: Verifier + Fixer (only if there are changes)
      if (state.changes.length > 0 && !completedStages.includes('verifier')) {
        let verified = false;
        let iterations = 0;
        const maxIterations = config.maxFixIterations;

        while (!verified && iterations < maxIterations) {
          checkCancellation();
          state.currentStage = 'verifier';
          updateTaskStage(state.taskId, 'verifier');

          try {
            const verifyResult = await runVerifierAgent(state);
            if (verifyResult.passed) {
              verified = true;
              markStageCompleted(state, 'verifier');
            } else {
              iterations++;
              if (iterations < maxIterations) {
                state.currentStage = 'fixer';
                updateTaskStage(state.taskId, 'fixer');
                try {
                  await runFixerAgent(state, verifyResult.bugs);
                  markStageCompleted(state, 'fixer');
                } catch { markStageCompleted(state, 'fixer'); }
              }
            }
          } catch {
            verified = true;
            markStageCompleted(state, 'verifier');
          }
        }

        if (!verified) {
          markStageCompleted(state, 'verifier');
        }
      } else if (state.changes.length === 0) {
        markStageCompleted(state, 'verifier');
      }

      // ETAPA 6: Git
      if (state.changes.length > 0 && !completedStages.includes('git')) {
        checkCancellation();
        logger.info({ taskId: state.taskId }, 'Resume Stage 7: Git');
        state.currentStage = 'git';
        updateTaskStage(state.taskId, 'git');

        try {
          gitResult = await runGitAgent(state, true, true);
          markStageCompleted(state, 'git');

          addTaskLog(state.taskId, 'output', `Git completado: branch=${gitResult.branch}`);
          await saveCheckpoint(state.taskId, 'git', 6, gitResult, state);
          await persistStageProgress(state.taskId, 'git', state.stagesCompleted);
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          logger.error({ error: msg }, 'Git failed during resume');
          addTaskLog(state.taskId, 'info', `Git fallo: ${msg}`);
          markStageCompleted(state, 'git');
        }
      }
    }

    // ===========================================
    // Respuesta exitosa
    // ===========================================
    const response = buildSuccessResponse(state, gitResult);

    logger.info({
      taskId: state.taskId,
      originalTaskId,
      success: true,
      stages: response.stages_completed,
    }, 'Resumed pipeline completed successfully');

    await updateTaskStatus(state.taskId, 'completed');
    // Mark original task as completed too (it was interrupted, now successfully resumed)
    await updateTaskStatus(originalTaskId, 'completed');

    try {
      await saveTask(state, response);
    } catch (err) {
      logger.error({ err, taskId: state.taskId }, 'Failed to save resumed task');
    }

    unregisterTask(state.taskId, true);
    processAvailableTasksInQueue().catch(() => {});

    return response;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error({ taskId: state.taskId, originalTaskId, error: errorMessage }, 'Resumed pipeline failed');

    addTaskLog(state.taskId, 'error', `Error en ${state.currentStage}: ${errorMessage}`);
    const errorResponse = buildErrorResponse(state, error);

    const isCancellation = errorMessage.includes('cancelled by user');
    await updateTaskStatus(state.taskId, isCancellation ? 'cancelled' : 'failed');

    try {
      await saveTask(state, errorResponse);
    } catch (err) {
      logger.error({ err, taskId: state.taskId }, 'Failed to save failed resumed task');
    }

    unregisterTask(state.taskId, false);
    processAvailableTasksInQueue().catch(() => {});

    return errorResponse;
  }
}
