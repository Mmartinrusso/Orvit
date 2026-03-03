-- Add isArchived field to agenda_tasks
ALTER TABLE "agenda_tasks" ADD COLUMN IF NOT EXISTS "isArchived" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "agenda_tasks" ADD COLUMN IF NOT EXISTS "archivedAt" TIMESTAMP(3);
CREATE INDEX IF NOT EXISTS "agenda_tasks_companyId_isArchived_idx" ON "agenda_tasks"("companyId", "isArchived");
