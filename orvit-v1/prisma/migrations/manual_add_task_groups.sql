-- Migración: Agregar tabla TaskGroup y columnas groupId en Task y AgendaTask
-- Ejecutar manualmente contra la base de datos de producción

-- 1. Crear tabla task_groups
CREATE TABLE IF NOT EXISTS "task_groups" (
  "id"          SERIAL PRIMARY KEY,
  "name"        VARCHAR(100) NOT NULL,
  "color"       VARCHAR(7) NOT NULL DEFAULT '#6366f1',
  "icon"        VARCHAR(50),
  "description" TEXT,
  "isArchived"  BOOLEAN NOT NULL DEFAULT false,
  "companyId"   INTEGER NOT NULL,
  "createdById" INTEGER NOT NULL,
  "createdAt"   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt"   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "task_groups_companyId_fkey"
    FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE,
  CONSTRAINT "task_groups_createdById_fkey"
    FOREIGN KEY ("createdById") REFERENCES "User"("id")
);

CREATE INDEX IF NOT EXISTS "task_groups_companyId_idx" ON "task_groups"("companyId");

-- 2. Agregar columna groupId en Task (ON DELETE SET NULL → tareas quedan sin grupo si se elimina el grupo)
ALTER TABLE "Task"
  ADD COLUMN IF NOT EXISTS "groupId" INTEGER,
  ADD CONSTRAINT "Task_groupId_fkey"
    FOREIGN KEY ("groupId") REFERENCES "task_groups"("id") ON DELETE SET NULL;

-- 3. Agregar columna groupId en agenda_tasks
ALTER TABLE "agenda_tasks"
  ADD COLUMN IF NOT EXISTS "groupId" INTEGER,
  ADD CONSTRAINT "agenda_tasks_groupId_fkey"
    FOREIGN KEY ("groupId") REFERENCES "task_groups"("id") ON DELETE SET NULL;
