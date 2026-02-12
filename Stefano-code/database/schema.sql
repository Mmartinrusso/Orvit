-- AGX Database Schema for PostgreSQL/Neon
-- Run this script to create all required tables

-- Tasks table
CREATE TABLE IF NOT EXISTS tasks (
    task_id VARCHAR(36) PRIMARY KEY,
    input_prompt TEXT NOT NULL,
    model VARCHAR(50) NOT NULL,
    status VARCHAR(20) DEFAULT 'pending',
    success BOOLEAN DEFAULT FALSE,
    error_message TEXT,
    stage_failed VARCHAR(50),
    summary TEXT,
    modified_files JSONB,
    git_branch VARCHAR(255),
    git_commit_sha VARCHAR(40),
    git_commit_message TEXT,
    git_pr_url VARCHAR(500),
    total_input_tokens INTEGER DEFAULT 0,
    total_output_tokens INTEGER DEFAULT 0,
    total_tokens INTEGER DEFAULT 0,
    implementer_session_id VARCHAR(100),
    repo_url VARCHAR(500),
    repos_json JSONB,
    pipeline_mode VARCHAR(20),
    expert_mode VARCHAR(20),
    last_stage VARCHAR(50),
    stages_completed JSONB DEFAULT '[]',
    pipeline_state JSONB,
    created_at TIMESTAMP DEFAULT NOW(),
    started_at TIMESTAMP,
    completed_at TIMESTAMP
);

-- Task checkpoints table (persists intermediate state after each pipeline stage)
CREATE TABLE IF NOT EXISTS task_checkpoints (
    id SERIAL PRIMARY KEY,
    task_id VARCHAR(36) REFERENCES tasks(task_id) ON DELETE CASCADE,
    stage_name VARCHAR(50) NOT NULL,
    stage_order INTEGER NOT NULL,
    stage_result JSONB,
    pipeline_state_snapshot JSONB,
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(task_id, stage_name)
);

-- Task stages table
CREATE TABLE IF NOT EXISTS task_stages (
    id SERIAL PRIMARY KEY,
    task_id VARCHAR(36) REFERENCES tasks(task_id) ON DELETE CASCADE,
    stage_name VARCHAR(50) NOT NULL,
    stage_order INTEGER NOT NULL,
    claude_session_id VARCHAR(100),
    input_prompt TEXT,
    output_result TEXT,
    parsed_result JSONB,
    input_tokens INTEGER DEFAULT 0,
    output_tokens INTEGER DEFAULT 0,
    success BOOLEAN DEFAULT FALSE,
    error_message TEXT,
    duration_ms INTEGER,
    completed_at TIMESTAMP DEFAULT NOW()
);

-- Task changes table
CREATE TABLE IF NOT EXISTS task_changes (
    id SERIAL PRIMARY KEY,
    task_id VARCHAR(36) REFERENCES tasks(task_id) ON DELETE CASCADE,
    file_path VARCHAR(500) NOT NULL,
    action VARCHAR(20) NOT NULL,
    summary TEXT
);

-- Task tests table
CREATE TABLE IF NOT EXISTS task_tests (
    id SERIAL PRIMARY KEY,
    task_id VARCHAR(36) REFERENCES tasks(task_id) ON DELETE CASCADE,
    test_file VARCHAR(500) NOT NULL,
    test_name VARCHAR(255) NOT NULL,
    passed BOOLEAN DEFAULT FALSE,
    error_message TEXT
);

-- Repository history table
CREATE TABLE IF NOT EXISTS repo_history (
    id SERIAL PRIMARY KEY,
    repo_hash VARCHAR(32) UNIQUE NOT NULL,
    repo_url VARCHAR(500),
    repos_json JSONB,
    is_multi_repo BOOLEAN DEFAULT FALSE,
    usage_count INTEGER DEFAULT 1,
    last_used_at TIMESTAMP DEFAULT NOW(),
    created_at TIMESTAMP DEFAULT NOW()
);

-- Opportunity scans table
CREATE TABLE IF NOT EXISTS opportunity_scans (
    scan_id VARCHAR(36) PRIMARY KEY,
    repo_url VARCHAR(500),
    repos_json JSONB,
    focus_prompt TEXT,
    model VARCHAR(50) NOT NULL,
    status VARCHAR(20) DEFAULT 'pending',
    progress INTEGER DEFAULT 0,
    opportunities_found INTEGER DEFAULT 0,
    error_message TEXT,
    total_input_tokens INTEGER DEFAULT 0,
    total_output_tokens INTEGER DEFAULT 0,
    total_tokens INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW(),
    started_at TIMESTAMP,
    completed_at TIMESTAMP
);

-- Opportunities table
CREATE TABLE IF NOT EXISTS opportunities (
    opportunity_id VARCHAR(36) PRIMARY KEY,
    scan_id VARCHAR(36) REFERENCES opportunity_scans(scan_id) ON DELETE SET NULL,
    research_id VARCHAR(36),
    title VARCHAR(500) NOT NULL,
    description TEXT NOT NULL,
    category VARCHAR(50) NOT NULL,
    priority VARCHAR(20) DEFAULT 'medium',
    prompt TEXT NOT NULL,
    affected_files JSONB,
    estimated_complexity VARCHAR(20) DEFAULT 'moderate',
    reasoning TEXT,
    source_type VARCHAR(50) DEFAULT 'code_analysis',
    external_reference VARCHAR(500),
    repo_url VARCHAR(500),
    repos_json JSONB,
    status VARCHAR(20) DEFAULT 'pending',
    approved_at TIMESTAMP,
    rejected_at TIMESTAMP,
    rejection_reason TEXT,
    task_id VARCHAR(36) REFERENCES tasks(task_id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Opportunity tags table
CREATE TABLE IF NOT EXISTS opportunity_tags (
    id SERIAL PRIMARY KEY,
    opportunity_id VARCHAR(36) REFERENCES opportunities(opportunity_id) ON DELETE CASCADE,
    tag VARCHAR(100) NOT NULL
);

-- Research table (for idea research)
CREATE TABLE IF NOT EXISTS researches (
    research_id VARCHAR(36) PRIMARY KEY,
    idea TEXT NOT NULL,
    status VARCHAR(20) DEFAULT 'pending',
    language VARCHAR(10) DEFAULT 'es',
    progress INTEGER DEFAULT 0,
    total_input_tokens INTEGER DEFAULT 0,
    total_output_tokens INTEGER DEFAULT 0,
    total_tokens INTEGER DEFAULT 0,
    result_json JSONB,
    error_message TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    started_at TIMESTAMP,
    completed_at TIMESTAMP
);

-- Tickets table
CREATE TABLE IF NOT EXISTS tickets (
    ticket_id VARCHAR(36) PRIMARY KEY,
    title VARCHAR(500) NOT NULL,
    requirement TEXT NOT NULL,
    ticket_type VARCHAR(50) NOT NULL,
    status VARCHAR(20) DEFAULT 'new',
    priority VARCHAR(20) DEFAULT 'medium',
    repo_url VARCHAR(500),
    repos_json JSONB,
    model VARCHAR(50),
    pipeline_mode VARCHAR(20),
    task_id VARCHAR(36) REFERENCES tasks(task_id) ON DELETE SET NULL,
    approved_at TIMESTAMP,
    approved_by VARCHAR(255),
    rejected_at TIMESTAMP,
    rejected_by VARCHAR(255),
    rejection_reason TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    created_by VARCHAR(255),
    tags JSONB,
    metadata JSONB
);

-- Ticket comments table
CREATE TABLE IF NOT EXISTS ticket_comments (
    id SERIAL PRIMARY KEY,
    ticket_id VARCHAR(36) REFERENCES tickets(ticket_id) ON DELETE CASCADE,
    comment_type VARCHAR(20) DEFAULT 'comment',
    content TEXT NOT NULL,
    created_by VARCHAR(255),
    created_at TIMESTAMP DEFAULT NOW(),
    metadata JSONB
);

-- Knowledge base table
CREATE TABLE IF NOT EXISTS knowledge_base (
    id SERIAL PRIMARY KEY,
    content TEXT NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_tasks_created_at ON tasks(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tasks_success ON tasks(success);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_task_checkpoints_task_id ON task_checkpoints(task_id);
CREATE INDEX IF NOT EXISTS idx_task_stages_task_id ON task_stages(task_id);
CREATE INDEX IF NOT EXISTS idx_task_changes_task_id ON task_changes(task_id);
CREATE INDEX IF NOT EXISTS idx_task_tests_task_id ON task_tests(task_id);
CREATE INDEX IF NOT EXISTS idx_opportunities_scan_id ON opportunities(scan_id);
CREATE INDEX IF NOT EXISTS idx_opportunities_status ON opportunities(status);
CREATE INDEX IF NOT EXISTS idx_opportunity_tags_opportunity_id ON opportunity_tags(opportunity_id);
CREATE INDEX IF NOT EXISTS idx_tickets_status ON tickets(status);
CREATE INDEX IF NOT EXISTS idx_ticket_comments_ticket_id ON ticket_comments(ticket_id);
