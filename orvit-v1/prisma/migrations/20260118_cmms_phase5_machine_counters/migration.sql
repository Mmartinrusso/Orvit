-- CMMS Phase 5: Machine Counters (Usage-Based Maintenance)
-- Este script crea las tablas para contadores de máquinas y mantenimiento basado en uso

-- Tabla de Contadores de Máquina
CREATE TABLE IF NOT EXISTS "MachineCounter" (
    "id" SERIAL PRIMARY KEY,
    "machineId" INTEGER NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "unit" VARCHAR(50) NOT NULL,
    "currentValue" DECIMAL DEFAULT 0,
    "lastReadingAt" TIMESTAMP(3),
    "lastReadingBy" INTEGER,
    "source" VARCHAR(50) DEFAULT 'MANUAL',
    "companyId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MachineCounter_machineId_fkey" FOREIGN KEY ("machineId") REFERENCES "Machine"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "MachineCounter_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "MachineCounter_lastReadingBy_fkey" FOREIGN KEY ("lastReadingBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- Tabla de Lecturas de Contador
CREATE TABLE IF NOT EXISTS "MachineCounterReading" (
    "id" SERIAL PRIMARY KEY,
    "counterId" INTEGER NOT NULL,
    "value" DECIMAL NOT NULL,
    "previousValue" DECIMAL,
    "delta" DECIMAL,
    "recordedAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "recordedById" INTEGER NOT NULL,
    "source" VARCHAR(50) DEFAULT 'MANUAL',
    "notes" TEXT,
    CONSTRAINT "MachineCounterReading_counterId_fkey" FOREIGN KEY ("counterId") REFERENCES "MachineCounter"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "MachineCounterReading_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- Tabla de Triggers de Mantenimiento por Contador
CREATE TABLE IF NOT EXISTS "CounterMaintenanceTrigger" (
    "id" SERIAL PRIMARY KEY,
    "counterId" INTEGER NOT NULL,
    "checklistId" INTEGER NOT NULL,
    "triggerEvery" DECIMAL NOT NULL,
    "lastTriggeredValue" DECIMAL DEFAULT 0,
    "nextTriggerValue" DECIMAL,
    "isActive" BOOLEAN DEFAULT true,
    "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CounterMaintenanceTrigger_counterId_fkey" FOREIGN KEY ("counterId") REFERENCES "MachineCounter"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CounterMaintenanceTrigger_checklistId_fkey" FOREIGN KEY ("checklistId") REFERENCES "maintenance_checklists"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- Índices
CREATE INDEX IF NOT EXISTS "MachineCounter_machineId_idx" ON "MachineCounter"("machineId");
CREATE INDEX IF NOT EXISTS "MachineCounter_companyId_idx" ON "MachineCounter"("companyId");
CREATE INDEX IF NOT EXISTS "MachineCounterReading_counterId_idx" ON "MachineCounterReading"("counterId");
CREATE INDEX IF NOT EXISTS "MachineCounterReading_recordedAt_idx" ON "MachineCounterReading"("recordedAt");
CREATE INDEX IF NOT EXISTS "CounterMaintenanceTrigger_counterId_idx" ON "CounterMaintenanceTrigger"("counterId");
CREATE INDEX IF NOT EXISTS "CounterMaintenanceTrigger_checklistId_idx" ON "CounterMaintenanceTrigger"("checklistId");
