-- Índices para Task
CREATE INDEX IF NOT EXISTS "Task_companyId_status_idx" ON "Task" ("companyId", "status");
CREATE INDEX IF NOT EXISTS "Task_assignedToId_idx" ON "Task" ("assignedToId");
CREATE INDEX IF NOT EXISTS "Task_dueDate_idx" ON "Task" ("dueDate");

-- Índices para FixedTask
CREATE INDEX IF NOT EXISTS "FixedTask_companyId_isActive_idx" ON "FixedTask" ("companyId", "isActive");
CREATE INDEX IF NOT EXISTS "FixedTask_nextExecution_idx" ON "FixedTask" ("nextExecution");

-- Índices para FixedTaskExecution
CREATE INDEX IF NOT EXISTS "FixedTaskExecution_fixedTaskId_executedAt_idx" ON "FixedTaskExecution" ("fixedTaskId", "executedAt");
CREATE INDEX IF NOT EXISTS "FixedTaskExecution_status_idx" ON "FixedTaskExecution" ("status");
