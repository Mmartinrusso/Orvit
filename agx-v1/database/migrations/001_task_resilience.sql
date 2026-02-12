-- Migration: Task Resilience System
-- Adds status tracking, checkpoints, and state persistence to tasks

-- Add new columns to tasks table
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'completed';
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS pipeline_mode VARCHAR(20);
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS expert_mode VARCHAR(20);
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS last_stage VARCHAR(50);
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS stages_completed JSONB DEFAULT '[]';
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS pipeline_state JSONB;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS started_at TIMESTAMP;

-- Set status for existing tasks based on success field
UPDATE tasks SET status = CASE WHEN success = TRUE THEN 'completed' ELSE 'failed' END WHERE status IS NULL OR status = 'completed';

-- Create task_checkpoints table
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

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_task_checkpoints_task_id ON task_checkpoints(task_id);
