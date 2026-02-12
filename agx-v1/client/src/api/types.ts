// API Types - matching backend types from claude_code_dev_api

export type ModelType = 'sonnet' | 'opus' | 'haiku';
export type PipelineMode = 'simple' | 'fast' | 'full' | 'auto';
export type FileAction = 'created' | 'modified' | 'deleted';
export type PipelineStage =
  | 'analyzer'
  | 'locator'
  | 'planner'
  | 'implementer'
  | 'verifier'
  | 'fixer'
  | 'git'
  | 'fast-dev'
  | 'fast-finish'
  | 'simple';

export interface RepoInfo {
  url: string;
  description: string;
  branch?: string;
}

export interface TaskRequest {
  prompt: string;
  model?: ModelType;
  auto_commit?: boolean;
  create_pr?: boolean;
  create_branch?: boolean;
  pipeline_mode?: PipelineMode;
  continue_task_id?: string;  // Task ID to continue from (recommended)
  expert_mode?: ExpertMode;
}

export interface FileChange {
  file: string;
  action: FileAction;
  summary: string;
}

export interface RepoGitResult {
  repo_path: string;
  repo_url?: string;
  branch: string;
  commit_sha: string;
  pr_url?: string;
}

export interface GitResult {
  branch: string;
  commit_sha: string;
  pr_url?: string;
  repos?: RepoGitResult[];
}

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

export interface TaskResponse {
  success: boolean;
  task_id: string;
  stages_completed: string[];
  changes: FileChange[];
  git?: GitResult;
  token_usage: TokenUsage;
  error?: string;
  stage_failed?: string;
  conversation_id?: string;
}

// Response types for GET endpoints
export interface TaskRecord {
  task_id: string;
  input_prompt: string;
  model: string;
  success: boolean;
  error_message?: string | null;
  stage_failed?: string | null;
  summary?: string | null;
  modified_files?: string[] | null;
  git_branch?: string | null;
  git_commit_sha?: string | null;
  git_commit_message?: string | null;
  git_pr_url?: string | null;
  total_input_tokens: number;
  total_output_tokens: number;
  total_tokens: number;
  implementer_session_id?: string | null;
  repo_url?: string | null;
  // Can be array or JSON string from database
  repos_json?: Array<{ url: string; description: string; branch?: string }> | string | null;
  created_at: string;
  completed_at?: string | null;
}

export interface TaskHistoryResponse {
  success: boolean;
  tasks: TaskRecord[];
}

export interface ActiveTask {
  task_id: string;
  prompt: string;
  model: string;
  current_stage: PipelineStage;
  stages_completed: PipelineStage[];
  started_at: string;
  running_time_ms: number;
  workspace: string | null;
  repo_url: string | null;
  log_count: number;
}

export interface ActiveTasksResponse {
  success: boolean;
  count: number;
  max_concurrent: number;
  tasks: ActiveTask[];
}

export type TaskLogType = 'stage_start' | 'stage_end' | 'info' | 'error' | 'output';

export interface TaskLogEntry {
  timestamp: string;
  stage: PipelineStage;
  type: TaskLogType;
  message: string;
  data?: Record<string, unknown>;
}

export interface TaskLogsResponse {
  success: boolean;
  task_id: string;
  is_active: boolean;
  current_stage: PipelineStage | null;
  stages_completed: PipelineStage[];
  started_at: string | null;
  running_time_ms: number | null;
  logs: TaskLogEntry[];
}

export interface QueuedTask {
  task_id: string;
  prompt: string;
  model: string;
  repo_url: string | null;
  branch: string;
  queued_at: string;
  queue_position: number;
  wait_time_ms: number;
}

export interface QueuedTasksResponse {
  success: boolean;
  queue_length: number;
  active_tasks: number;
  max_concurrent: number;
  tasks: QueuedTask[];
}

export interface TaskStatsResponse {
  success: boolean;
  period: {
    start: string;
    end: string;
  };
  total_tasks: number;
  successful_tasks: number;
  failed_tasks: number;
  total_tokens_used: number;
  total_input_tokens: number;
  total_output_tokens: number;
  // Opportunity scan tokens (for combined dashboard view)
  opportunity_scan_tokens?: {
    total_scans: number;
    total_input_tokens: number;
    total_output_tokens: number;
    total_tokens: number;
  };
  // Grand totals (tasks + opportunity scans)
  grand_total_input_tokens?: number;
  grand_total_output_tokens?: number;
  grand_total_tokens?: number;
  tasks: Array<{
    task_id: string;
    input_prompt: string;
    model: string;
    success: boolean;
    git_branch: string | null;
    total_input_tokens: number;
    total_output_tokens: number;
    created_at: string;
    completed_at: string | null;
  }>;
}

export interface StageRecord {
  stage_name: string;
  stage_order: number;
  claude_session_id?: string | null;
  input_tokens: number;
  output_tokens: number;
  success: boolean;
  error_message?: string | null;
  duration_ms?: number | null;
}

export interface ChangeRecord {
  file_path: string;
  action: FileAction;
  summary?: string | null;
}

export interface TestRecord {
  test_file: string;
  test_name: string;
  passed: boolean;
  error_message?: string | null;
}

export interface TaskDetailsResponse {
  success: boolean;
  task: TaskRecord & {
    stages: StageRecord[];
    changes: ChangeRecord[];
    tests: TestRecord[];
  };
}

export interface CancelTaskResponse {
  success: boolean;
  message: string;
  task?: {
    task_id: string;
    prompt?: string;
    current_stage?: string;
    status?: string;
  };
  error?: string;
}

export interface HealthResponse {
  status: string;
  timestamp: string;
}

// ===========================================
// Opportunity Types
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

export type OpportunityLanguage = 'es' | 'en';

// Scan Request/Response
export interface OpportunityScanRequest {
  repo_url?: string;
  repos?: RepoInfo[];
  focus_prompt?: string;
  model?: ModelType;
  min_opportunities?: number;
  max_opportunities?: number;
  language?: OpportunityLanguage;
}

export interface OpportunityScanResponse {
  success: boolean;
  scan_id: string;
  status: OpportunityScanStatus;
  error?: string;
}

// Scan Record
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

// Opportunity Record
export interface Opportunity {
  opportunity_id: string;
  scan_id: string | null;
  research_id: string | null;
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

// Response Types
export interface OpportunityScanHistoryResponse {
  success: boolean;
  scans: OpportunityScan[];
}

export interface OpportunityScanDetailsResponse {
  success: boolean;
  scan: OpportunityScan;
  is_active: boolean;
  opportunities: Opportunity[];
}

export interface OpportunitiesResponse {
  success: boolean;
  opportunities: Opportunity[];
}

export interface OpportunityDetailsResponse {
  success: boolean;
  opportunity: Opportunity;
}

export interface OpportunityStatsResponse {
  success: boolean;
  stats: {
    total: number;
    pending: number;
    approved: number;
    rejected: number;
    in_progress: number;
    completed: number;
    failed: number;
    by_category: Record<string, number>;
    by_priority: Record<string, number>;
    scan_tokens: {
      total_scans: number;
      total_input_tokens: number;
      total_output_tokens: number;
      total_tokens: number;
    };
  };
}

export interface ApproveOpportunityRequest {
  branch_name?: string;
  model?: ModelType;
  pipeline_mode?: PipelineMode;
}

export interface ApproveOpportunityResponse {
  success: boolean;
  opportunity_id: string;
  task_id?: string;
  message?: string;
  error?: string;
}

export interface RejectOpportunityRequest {
  reason?: string;
}

export interface ActiveScansResponse {
  success: boolean;
  count: number;
  scans: Array<{
    scan_id: string;
    repo_url?: string;
    repos?: RepoInfo[];
    focus_prompt?: string;
    model: string;
  }>;
}

// ===========================================
// Research Types
// ===========================================

export interface ResearchOpportunityRequest {
  idea: string;
  language?: OpportunityLanguage;
}

export interface ResearchOpportunityResponse {
  success: boolean;
  research_id: string;
  status: string;
  error?: string;
}

export interface ResearchHistoryResponse {
  success: boolean;
  researches: Array<{
    research_id: string;
    idea: string;
    status: string;
    language: string;
    created_at: string;
    completed_at?: string;
    result?: unknown;
  }>;
}

export interface ResearchDetailsResponse {
  success: boolean;
  research: {
    research_id: string;
    idea: string;
    status: string;
    language: string;
    created_at: string;
    completed_at?: string;
    result?: unknown;
  };
}

export interface ResearchOpportunity {
  research_id: string;
  idea: string;
  status: 'pending' | 'in_progress' | 'researching' | 'completed' | 'failed' | 'cancelled';
  language: string;
  progress: number;
  total_tokens: number;
  created_at: string;
  completed_at?: string;
  result_json?: {
    idea_summary?: string;
    [key: string]: unknown;
  };
}

export interface ActiveResearchesResponse {
  success: boolean;
  count: number;
  researches: Array<{
    research_id: string;
    idea: string;
    model: string;
  }>;
}

// ===========================================
// Server-Sent Events (SSE) Types
// ===========================================

export type SSEEventType =
  | 'stage_start'
  | 'stage_end'
  | 'log_entry'
  | 'task_completed'
  | 'task_failed'
  | 'error'
  | 'heartbeat';

export interface SSETaskUpdate {
  type: SSEEventType;
  taskId: string;
  timestamp: string;
  data: {
    stage?: PipelineStage;
    message?: string;
    log?: string;
    error?: string;
  };
}

// ===========================================
// Knowledge Base Types
// ===========================================

export interface KnowledgeBase {
  id: number;
  content: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface KnowledgeBaseResponse {
  success: boolean;
  knowledge_base: KnowledgeBase | null;
}

export interface KnowledgeBaseUpdateRequest {
  content: string;
  is_active?: boolean;
}

export interface KnowledgeBaseUpdateResponse {
  success: boolean;
  knowledge_base: KnowledgeBase;
}

// ===========================================
// Ticket System Types
// ===========================================

export type TicketType = 'fix' | 'feature' | 'refactor' | 'enhancement' | 'docs' | 'test' | 'chore';
export type TicketStatus = 'new' | 'approved' | 'rejected' | 'in_progress' | 'completed' | 'failed';
export type TicketPriority = 'low' | 'medium' | 'high' | 'critical';

export interface TicketTypeInfo {
  name: TicketType;
  display_name: string;
  description: string;
}

export interface CreateTicketRequest {
  title: string;
  requirement: string;
  ticket_type: TicketType;
  priority?: TicketPriority;
  tags?: string[];
}

export interface CreateTicketResponse {
  success: boolean;
  ticket_id: string;
  status: TicketStatus;
  error?: string;
}

export interface ApproveTicketRequest {
  approved_by?: string;
  model?: ModelType;
  pipeline_mode?: PipelineMode;
}

export interface ApproveTicketResponse {
  success: boolean;
  ticket_id: string;
  task_id?: string;
  status: TicketStatus;
  error?: string;
}

export interface RejectTicketRequest {
  rejected_by?: string;
  rejection_reason: string;
}

export interface RejectTicketResponse {
  success: boolean;
  ticket_id: string;
  status: TicketStatus;
  error?: string;
}

export interface Ticket {
  ticket_id: string;
  title: string;
  requirement: string;
  ticket_type: TicketType;
  status: TicketStatus;
  priority: TicketPriority;

  repo_url?: string;
  repos_json?: RepoInfo[];

  model?: ModelType;
  pipeline_mode?: PipelineMode;

  task_id?: string;

  approved_at?: string;
  approved_by?: string;
  rejected_at?: string;
  rejected_by?: string;
  rejection_reason?: string;

  created_at: string;
  updated_at: string;
  started_at?: string;
  completed_at?: string;

  created_by?: string;
  tags?: string[];
  metadata?: Record<string, any>;
}

export interface TicketComment {
  id: number;
  ticket_id: string;
  comment_type: 'comment' | 'status_change' | 'system';
  content: string;
  created_by?: string;
  created_at: string;
  metadata?: Record<string, any>;
}

export interface ListTicketsRequest {
  status?: TicketStatus | TicketStatus[];
  ticket_type?: TicketType | TicketType[];
  priority?: TicketPriority | TicketPriority[];
  repo_url?: string;
  created_by?: string;
  from_date?: string;
  to_date?: string;
  tags?: string[];
  limit?: number;
  offset?: number;
}

export interface ListTicketsResponse {
  success: boolean;
  tickets: Ticket[];
  total: number;
  limit: number;
  offset: number;
}

export interface GetTicketDetailsResponse {
  success: boolean;
  ticket: Ticket;
  comments: TicketComment[];
  task?: TaskRecord;
}

// ===========================================
// Project Types
// ===========================================

export interface ProjectInfo {
  name: string;
  version: string;
  description: string;
  path: string;
  techStack: string[];
  packageManager: string;
  gitBranch: string;
  gitStatus: {
    modified: number;
    untracked: number;
    staged: number;
    ahead: number;
    behind: number;
  };
}

export interface ProjectInfoResponse {
  success: boolean;
  project: ProjectInfo;
}

export interface FileEntry {
  name: string;
  type: 'file' | 'directory';
  size: number;
  modified: string;
}

export interface ProjectFilesResponse {
  success: boolean;
  path: string;
  files: FileEntry[];
}

export interface GitCommit {
  hash: string;
  message: string;
  author: string;
  date: string;
}

export interface GitLogResponse {
  success: boolean;
  commits: GitCommit[];
}

export interface GitDiffResponse {
  success: boolean;
  unstaged: string;
  staged: string;
}

// Quick Action types
export type QuickActionType = 'fix' | 'test' | 'refactor' | 'review' | 'docs' | 'optimize';

export interface QuickActionRequest {
  action: QuickActionType;
  target?: string;
  context?: string;
  model?: ModelType;
}

// ===========================================
// Expert Mode Types
// ===========================================

export type ExpertMode = 'general' | 'frontend' | 'backend' | 'fullstack' | 'testing' | 'devops' | 'security';

// ===========================================
// Prompt Enhancement Types
// ===========================================

export interface EnhancePromptRequest {
  prompt: string;
  expert_mode?: ExpertMode;
}

export interface EnhancePromptResponse {
  success: boolean;
  enhanced_prompt: string;
  improvements: string[];
  estimated_complexity: 'simple' | 'medium' | 'complex';
  error?: string;
}

// ===========================================
// Skills Types
// ===========================================

export interface Skill {
  id: string;
  name: string;
  description: string;
  triggers: string[];
  category: string;
  autoActivate: boolean;
  content?: string; // Only included when fetching single skill
}

export interface SkillsListResponse {
  success: boolean;
  skills: Skill[];
  total: number;
}

export interface SkillDetailResponse {
  success: boolean;
  skill: Skill;
}

export interface SkillSaveRequest {
  id: string;
  name: string;
  description: string;
  triggers: string[];
  category: string;
  autoActivate: boolean;
  content: string;
}

export interface SkillMatchResponse {
  success: boolean;
  matched: Array<{ id: string; name: string; description: string; category: string }>;
}
