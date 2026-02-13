-- CreateEnum para ventanas de ejecución
CREATE TYPE "ExecutionWindow" AS ENUM ('BEFORE_START', 'MID_SHIFT', 'END_SHIFT', 'ANY_TIME', 'SCHEDULED');

-- CreateEnum para unidades de tiempo
CREATE TYPE "TimeUnit" AS ENUM ('HOURS', 'DAYS', 'CYCLES', 'KILOMETERS', 'SHIFTS', 'UNITS_PRODUCED');

-- CreateEnum para frecuencia de checklist
CREATE TYPE "ChecklistFrequency" AS ENUM ('DAILY', 'WEEKLY', 'BIWEEKLY', 'MONTHLY', 'QUARTERLY', 'SEMIANNUAL', 'ANNUAL');

-- Agregar nuevos campos a WorkOrder
ALTER TABLE "work_orders" ADD COLUMN "rootCause" TEXT;
ALTER TABLE "work_orders" ADD COLUMN "correctiveActions" TEXT;
ALTER TABLE "work_orders" ADD COLUMN "preventiveActions" TEXT;
ALTER TABLE "work_orders" ADD COLUMN "spareParts" JSONB;
ALTER TABLE "work_orders" ADD COLUMN "failureDescription" TEXT;
ALTER TABLE "work_orders" ADD COLUMN "solution" TEXT;
ALTER TABLE "work_orders" ADD COLUMN "executionWindow" "ExecutionWindow" DEFAULT 'ANY_TIME';
ALTER TABLE "work_orders" ADD COLUMN "timeUnit" "TimeUnit" DEFAULT 'HOURS';
ALTER TABLE "work_orders" ADD COLUMN "timeValue" DOUBLE PRECISION;
ALTER TABLE "work_orders" ADD COLUMN "tags" TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "work_orders" ADD COLUMN "isCompleted" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "work_orders" ADD COLUMN "completionRate" DOUBLE PRECISION;

-- CreateTable para historial de mantenimiento
CREATE TABLE "maintenance_history" (
    "id" SERIAL NOT NULL,
    "workOrderId" INTEGER NOT NULL,
    "machineId" INTEGER,
    "componentId" INTEGER,
    "executedAt" TIMESTAMP(3) NOT NULL,
    "executedById" INTEGER,
    "duration" DOUBLE PRECISION,
    "cost" DOUBLE PRECISION,
    "notes" TEXT,
    "rootCause" TEXT,
    "correctiveActions" TEXT,
    "preventiveActions" TEXT,
    "spareParts" JSONB,
    "nextMaintenanceDate" TIMESTAMP(3),
    "mttr" DOUBLE PRECISION,
    "mtbf" DOUBLE PRECISION,
    "completionRate" DOUBLE PRECISION,
    "qualityScore" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "maintenance_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable para checklists de mantenimiento
CREATE TABLE "maintenance_checklists" (
    "id" SERIAL NOT NULL,
    "workOrderId" INTEGER,
    "machineId" INTEGER,
    "componentId" INTEGER,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "frequency" "ChecklistFrequency" NOT NULL,
    "isTemplate" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "companyId" INTEGER NOT NULL,
    "sectorId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "maintenance_checklists_pkey" PRIMARY KEY ("id")
);

-- CreateTable para items de checklist
CREATE TABLE "checklist_items" (
    "id" SERIAL NOT NULL,
    "checklistId" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "isRequired" BOOLEAN NOT NULL DEFAULT true,
    "expectedValue" TEXT,
    "unit" TEXT,
    "minValue" DOUBLE PRECISION,
    "maxValue" DOUBLE PRECISION,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "checklist_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable para ejecuciones de checklist
CREATE TABLE "checklist_executions" (
    "id" SERIAL NOT NULL,
    "checklistItemId" INTEGER NOT NULL,
    "workOrderId" INTEGER,
    "executedById" INTEGER,
    "isCompleted" BOOLEAN NOT NULL DEFAULT false,
    "actualValue" TEXT,
    "notes" TEXT,
    "hasIssue" BOOLEAN NOT NULL DEFAULT false,
    "issueDescription" TEXT,
    "executedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "checklist_executions_pkey" PRIMARY KEY ("id")
);

-- CreateTable para configuración de mantenimiento
CREATE TABLE "maintenance_configs" (
    "id" SERIAL NOT NULL,
    "companyId" INTEGER NOT NULL,
    "sectorId" INTEGER,
    "defaultTimeUnit" "TimeUnit" NOT NULL DEFAULT 'HOURS',
    "defaultExecutionWindow" "ExecutionWindow" NOT NULL DEFAULT 'ANY_TIME',
    "autoScheduling" BOOLEAN NOT NULL DEFAULT true,
    "reminderDays" INTEGER NOT NULL DEFAULT 3,
    "allowOverdue" BOOLEAN NOT NULL DEFAULT true,
    "requirePhotos" BOOLEAN NOT NULL DEFAULT false,
    "requireSignoff" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "maintenance_configs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "maintenance_configs_companyId_sectorId_key" ON "maintenance_configs"("companyId", "sectorId");

-- AddForeignKey
ALTER TABLE "maintenance_history" ADD CONSTRAINT "maintenance_history_workOrderId_fkey" FOREIGN KEY ("workOrderId") REFERENCES "work_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "maintenance_history" ADD CONSTRAINT "maintenance_history_machineId_fkey" FOREIGN KEY ("machineId") REFERENCES "Machine"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "maintenance_history" ADD CONSTRAINT "maintenance_history_componentId_fkey" FOREIGN KEY ("componentId") REFERENCES "Component"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "maintenance_history" ADD CONSTRAINT "maintenance_history_executedById_fkey" FOREIGN KEY ("executedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "maintenance_checklists" ADD CONSTRAINT "maintenance_checklists_workOrderId_fkey" FOREIGN KEY ("workOrderId") REFERENCES "work_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "maintenance_checklists" ADD CONSTRAINT "maintenance_checklists_machineId_fkey" FOREIGN KEY ("machineId") REFERENCES "Machine"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "maintenance_checklists" ADD CONSTRAINT "maintenance_checklists_componentId_fkey" FOREIGN KEY ("componentId") REFERENCES "Component"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "maintenance_checklists" ADD CONSTRAINT "maintenance_checklists_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "maintenance_checklists" ADD CONSTRAINT "maintenance_checklists_sectorId_fkey" FOREIGN KEY ("sectorId") REFERENCES "Sector"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "checklist_items" ADD CONSTRAINT "checklist_items_checklistId_fkey" FOREIGN KEY ("checklistId") REFERENCES "maintenance_checklists"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "checklist_executions" ADD CONSTRAINT "checklist_executions_checklistItemId_fkey" FOREIGN KEY ("checklistItemId") REFERENCES "checklist_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "checklist_executions" ADD CONSTRAINT "checklist_executions_executedById_fkey" FOREIGN KEY ("executedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "maintenance_configs" ADD CONSTRAINT "maintenance_configs_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "maintenance_configs" ADD CONSTRAINT "maintenance_configs_sectorId_fkey" FOREIGN KEY ("sectorId") REFERENCES "Sector"("id") ON DELETE SET NULL ON UPDATE CASCADE;

