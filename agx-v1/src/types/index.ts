// ===========================================
// Task Request/Response Types
// ===========================================

export type ModelType = 'sonnet' | 'opus' | 'haiku';
export type ExpertMode = 'general' | 'frontend' | 'backend' | 'fullstack' | 'testing' | 'devops' | 'security';

/**
 * Representa un repositorio con su descripción para contexto
 */
export interface RepoInfo {
  url: string;           // URL del repositorio git
  description: string;   // Descripción del repo (ej: "backend del proyecto", "frontend React")
  branch?: string;       // Rama específica para este repo (default: main)
}

export interface TaskRequest {
  prompt: string;
  repo_url?: string;      // URL del repositorio git a clonar (legacy, single repo)
  repos?: RepoInfo[];     // Array de repositorios con descripción (multi-repo)
  branch?: string;        // Rama desde la cual trabajar (default: main)
  model?: ModelType;
  auto_commit?: boolean;
  create_pr?: boolean;
  create_branch?: boolean;  // Si debe crear una rama nueva o commitear en la actual (default: true)
  pipeline_mode?: PipelineMode;  // Modo de ejecución: 'full', 'fast', o 'auto' (default)
  conversation_id?: string;  // DEPRECATED: Session ID de Claude (ya no funciona, usar continue_task_id)
  continue_task_id?: string;  // Task ID anterior para continuar trabajo en la misma rama/contexto
  expert_mode?: ExpertMode;
}

export interface TaskResponse {
  success: boolean;
  task_id: string;
  stages_completed: string[];
  changes: FileChange[];
  git?: GitResult;
  token_usage: TokenUsage;
  error?: string;
  stage_failed?: string;
  conversation_id?: string;  // Session ID del agente implementador para continuar en futuras iteraciones
}

// ===========================================
// File Change Types
// ===========================================

export type FileAction = 'created' | 'modified' | 'deleted';

export interface FileChange {
  file: string;
  action: FileAction;
  summary: string;
}

// ===========================================
// Git Types
// ===========================================

/**
 * Resultado de git para un repositorio individual
 */
export interface RepoGitResult {
  repo_path: string;      // Nombre del directorio del repo
  repo_url?: string;      // URL original del repo
  branch: string;
  commit_sha: string;
  pr_url?: string;
}

/**
 * Resultado de git (puede ser single o multi-repo)
 */
export interface GitResult {
  branch: string;         // Branch principal (para compatibilidad)
  commit_sha: string;     // Commit SHA principal (para compatibilidad)
  pr_url?: string;        // PR URL principal (para compatibilidad)
  repos?: RepoGitResult[]; // Resultados por repositorio (multi-repo)
}

// ===========================================
// Token Usage Types
// ===========================================

export interface AgentTokenUsage {
  input: number;
  output: number;
}

export interface TokenUsage {
  total_input: number;
  total_output: number;
  total: number;
  by_agent: Record<string, AgentTokenUsage>;
}

// ===========================================
// Pipeline State
// ===========================================

export type PipelineStage =
  | 'analyzer'          // Complexity analysis (auto mode)
  | 'locator'
  | 'planner'
  | 'implementer'
  | 'verifier'
  | 'fixer'
  | 'git'
  // Fast mode stages
  | 'fast-dev'          // Combined: locate + plan + implement
  | 'fast-finish';      // Combined: verify + fix + git

/**
 * Información de un repositorio clonado en el workspace
 */
export interface ClonedRepoInfo {
  path: string;           // Path relativo dentro del workspace (ej: "backend", "frontend")
  url: string;            // URL original del repo
  description: string;    // Descripción del repo
  branch: string;         // Rama clonada
}

/**
 * Contexto de una task anterior para continuación
 */
export interface PreviousTaskContext {
  taskId: string;
  originalPrompt: string;
  gitBranch: string | null;
  changes: Array<{ file: string; action: string; summary: string | null }>;
  summary: string | null;
}

export interface PipelineState {
  taskId: string;
  originalPrompt: string;
  model: ModelType;
  workspacePath: string;    // Path to the isolated workspace
  repoUrl?: string;         // Original repo URL (if cloned) - legacy single repo
  repos: ClonedRepoInfo[];  // Info de todos los repos clonados (multi-repo)
  branch: string;           // Branch being worked on (default)
  targetPaths: string[];
  plan: PlanResult | null;
  changes: FileChange[];
  tokensUsed: TokenUsage;
  currentStage: PipelineStage;
  stagesCompleted: PipelineStage[];
  sessionIds: Record<string, string>;
  // Adaptive pipeline fields
  pipelineMode: PipelineMode;
  complexityAnalysis?: ComplexityAnalysis;
  // Task continuation (context-based, not session-based)
  previousTaskContext?: PreviousTaskContext;  // Context from previous task for continuation
  resumeSessionId?: string;  // DEPRECATED: Session ID (sessions expire)
  expertMode?: ExpertMode;
  skillsContext?: string;    // Additional context from matched skills
  matchedSkills?: string[];  // IDs of matched skills for logging
}

// ===========================================
// Agent Result Types
// ===========================================

export interface LocatorResult {
  paths: string[];
  reason: string;
}

export interface PlanStep {
  step: number;
  file: string;
  action: 'modify' | 'create' | 'delete';
  description: string;
}

export interface PlanResult {
  plan: PlanStep[];
  files_to_modify: string[];
  considerations: string[];
}

export interface ImplementerResult {
  changes: FileChange[];
  summary: string;
}

export interface Bug {
  file: string;
  line?: number;
  issue: string;
  severity: 'high' | 'medium' | 'low';
}

export interface TestResult {
  file: string;
  name: string;
  passed: boolean;
  error?: string;
}

export interface VerifierResult {
  passed: boolean;
  bugs: Bug[];
  suggestions: string[];
  tests_written?: string[];  // List of test files written
  tests_passed?: boolean;    // Whether all tests passed
  test_results?: TestResult[];  // Individual test results
}

export interface FixerResult {
  fixed: string[];
  changes: FileChange[];
}

export interface GitAgentResult {
  branch: string;
  commit_sha: string;
  pr_url?: string;
}

// ===========================================
// Claude Runner Types
// ===========================================

export interface ClaudeRunOptions {
  prompt: string;
  cwd: string;
  allowedTools: string[];
  systemPrompt?: string;
  model?: ModelType;
  maxTurns?: number;
  sessionId?: string;
}

export interface ClaudeRunResult {
  success: boolean;
  result: string;
  sessionId: string;
  error?: string;
}

// ===========================================
// Pipeline Mode Types (Adaptive Execution)
// ===========================================

/**
 * Modo de ejecución del pipeline
 * - 'full': Pipeline completo (locator -> planner -> implementer -> verifier -> fixer -> git)
 * - 'fast': Pipeline optimizado (analyzer -> locator+planner -> implementer+git)
 * - 'auto': El analizador decide basado en complejidad
 */
export type PipelineMode = 'full' | 'fast' | 'auto';

/**
 * Resultado del análisis de complejidad
 */
export interface ComplexityAnalysis {
  complexity: 'simple' | 'medium' | 'complex';
  recommended_mode: 'full' | 'fast';
  needs_tests: boolean;
  reason: string;
  estimated_files: number;
  is_backend: boolean;
}

/**
 * Resultado del agente combinado locator+planner
 */
export interface LocatorPlannerResult {
  paths: string[];
  plan: PlanStep[];
  files_to_modify: string[];
  considerations: string[];
}

/**
 * Resultado del agente combinado implementer+verifier+fixer+git
 */
export interface FastImplementerResult {
  changes: FileChange[];
  summary: string;
  verification: {
    passed: boolean;
    issues_fixed?: string[];
  };
  git?: {
    branch: string;
    commit_sha: string;
    pr_url?: string;
  };
}

// ===========================================
// Configuration Types
// ===========================================

export interface DatabaseConfig {
  enabled: boolean;
  host: string;
  port: number;
  user: string;
  password: string;
  name: string;
  ssl: boolean;
}

export interface AppConfig {
  port: number;
  projectRoot: string;
  targetProjectPath: string; // The actual project code directory (may differ from projectRoot in monorepos)
  defaultModel: ModelType;
  maxFixIterations: number;
  logLevel: string;
  maxConcurrentTasks: number;
  database: DatabaseConfig;
}


// ===========================================
// Opportunity Discovery Types
// ===========================================

export type OpportunityScanStatus = 'pending' | 'in_progress' | 'completed' | 'failed' | 'cancelled';
export type OpportunityStatus = 'pending' | 'approved' | 'rejected' | 'in_progress' | 'completed' | 'failed';
export type OpportunityCategory =
  | 'bug_fix'
  | 'performance'
  | 'security'
  | 'code_quality'
  | 'refactoring'
  | 'new_feature'
  | 'documentation'
  | 'testing'
  | 'accessibility'
  | 'ux_improvement'
  | 'tech_debt'
  | 'dependency_update'
  | 'other';
export type OpportunityPriority = 'low' | 'medium' | 'high' | 'critical';
export type OpportunityComplexity = 'trivial' | 'simple' | 'moderate' | 'complex' | 'very_complex';
export type OpportunitySourceType =
  | 'code_analysis'
  | 'best_practices'
  | 'competitor_analysis'
  | 'security_scan'
  | 'performance_analysis'
  | 'user_feedback';

/**
 * Request to start an opportunity scan
 */
export type OpportunityLanguage = 'es' | 'en';

export interface OpportunityScanRequest {
  repo_url?: string;           // Single repo URL (legacy)
  repos?: RepoInfo[];          // Multi-repo support
  focus_prompt?: string;       // Optional: focus search on specific areas
  model?: ModelType;
  min_opportunities?: number;  // Minimum opportunities to find (default: 5)
  max_opportunities?: number;  // Maximum opportunities to find (default: 10)
  language?: OpportunityLanguage;  // Language for opportunity descriptions (default: 'es')
}

/**
 * Response from starting an opportunity scan
 */
export interface OpportunityScanResponse {
  success: boolean;
  scan_id: string;
  status: OpportunityScanStatus;
  error?: string;
}

/**
 * Opportunity scan record
 */
export interface OpportunityScan {
  scan_id: string;
  repo_url: string | null;
  repos_json: RepoInfo[] | null;
  focus_prompt: string | null;
  model: string;
  status: OpportunityScanStatus;
  progress: number;
  opportunities_found: number;
  error_message: string | null;
  total_input_tokens: number;
  total_output_tokens: number;
  total_tokens: number;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
}

/**
 * Individual opportunity record
 */
export interface Opportunity {
  opportunity_id: string;
  scan_id: string;
  title: string;
  description: string;
  category: OpportunityCategory;
  priority: OpportunityPriority;
  prompt: string;
  affected_files: string[] | null;
  estimated_complexity: OpportunityComplexity;
  reasoning: string | null;
  source_type: OpportunitySourceType;
  external_reference: string | null;
  repo_url: string | null;
  repos_json: RepoInfo[] | null;
  status: OpportunityStatus;
  approved_at: string | null;
  rejected_at: string | null;
  rejection_reason: string | null;
  task_id: string | null;
  tags: string[];
  created_at: string;
  updated_at: string;
}

/**
 * Request to approve an opportunity
 */
export interface ApproveOpportunityRequest {
  opportunity_id: string;
  branch_name?: string;  // Optional custom branch name
  model?: ModelType;     // Optional model override
}

/**
 * Response from approving an opportunity
 */
export interface ApproveOpportunityResponse {
  success: boolean;
  opportunity_id: string;
  task_id?: string;
  error?: string;
}

/**
 * Result from the opportunity finder agent
 */
export interface OpportunityFinderResult {
  opportunities: Array<{
    title: string;
    description: string;
    category: OpportunityCategory;
    priority: OpportunityPriority;
    prompt: string;
    affected_files?: string[];
    estimated_complexity: OpportunityComplexity;
    reasoning: string;
    source_type: OpportunitySourceType;
    external_reference?: string;
    tags?: string[];
  }>;
  summary: string;
}

/**
 * State for the opportunity scan pipeline
 */
export interface OpportunityScanPipelineState {
  scanId: string;
  model: ModelType;
  workspacePath: string;
  repoUrl?: string;
  repos: ClonedRepoInfo[];
  focusPrompt?: string;
  minOpportunities: number;
  maxOpportunities: number;
  tokensUsed: TokenUsage;
  language: OpportunityLanguage;
}
