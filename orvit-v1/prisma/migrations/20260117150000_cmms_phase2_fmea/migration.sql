-- CMMS Phase 2: FMEA (Failure Modes and Effects Analysis)
-- ComponentFailureMode table for failure mode analysis

-- Create ComponentFailureMode table
CREATE TABLE "component_failure_modes" (
    "id" SERIAL NOT NULL,
    "componentId" INTEGER NOT NULL,
    "companyId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "description" TEXT,
    "category" TEXT,
    "symptoms" JSONB DEFAULT '[]',
    "causes" JSONB DEFAULT '[]',
    "effects" JSONB DEFAULT '[]',
    "detectability" INTEGER,
    "severity" INTEGER,
    "occurrence" INTEGER,
    "rpn" INTEGER,
    "recommendedActions" JSONB DEFAULT '[]',
    "preventiveMeasures" TEXT,
    "predictiveIndicators" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "component_failure_modes_pkey" PRIMARY KEY ("id")
);

-- Unique constraint for component + name combination
CREATE UNIQUE INDEX "component_failure_modes_componentId_name_key" ON "component_failure_modes"("componentId", "name");

-- Indexes for common queries
CREATE INDEX "component_failure_modes_componentId_idx" ON "component_failure_modes"("componentId");
CREATE INDEX "component_failure_modes_companyId_idx" ON "component_failure_modes"("companyId");
CREATE INDEX "component_failure_modes_category_idx" ON "component_failure_modes"("category");
CREATE INDEX "component_failure_modes_rpn_idx" ON "component_failure_modes"("rpn");

-- Foreign keys
ALTER TABLE "component_failure_modes" ADD CONSTRAINT "component_failure_modes_componentId_fkey" FOREIGN KEY ("componentId") REFERENCES "Component"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "component_failure_modes" ADD CONSTRAINT "component_failure_modes_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
