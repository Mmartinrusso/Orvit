-- CMMS Phase 1.2: PTW/LOTO System (Permit to Work / Lockout-Tagout)
-- This migration adds safety compliance features for industrial maintenance

-- ==========================================
-- ENUMS
-- ==========================================

-- PTW Types: Different types of hazardous work requiring permits
CREATE TYPE "PTWType" AS ENUM (
    'HOT_WORK',           -- Trabajos en caliente (soldadura, corte)
    'CONFINED_SPACE',     -- Espacios confinados
    'HEIGHT_WORK',        -- Trabajo en altura
    'ELECTRICAL',         -- Trabajo eléctrico
    'EXCAVATION',         -- Excavación
    'CHEMICAL',           -- Trabajo con químicos
    'RADIATION',          -- Trabajo con radiación
    'PRESSURE_SYSTEMS',   -- Sistemas presurizados
    'OTHER'               -- Otros trabajos peligrosos
);

-- PTW Status: Lifecycle states of a permit
CREATE TYPE "PTWStatus" AS ENUM (
    'DRAFT',              -- Borrador, siendo completado
    'PENDING_APPROVAL',   -- Esperando aprobación del supervisor
    'APPROVED',           -- Aprobado, listo para usar
    'ACTIVE',             -- En uso activo
    'SUSPENDED',          -- Suspendido temporalmente
    'CLOSED',             -- Cerrado correctamente
    'CANCELLED',          -- Cancelado antes de usar
    'EXPIRED'             -- Expirado (pasó validTo sin cerrar)
);

-- LOTO Status: States of a lockout-tagout execution
CREATE TYPE "LOTOStatus" AS ENUM (
    'LOCKED',             -- Bloqueado activamente
    'UNLOCKED',           -- Desbloqueado
    'PARTIAL'             -- Parcialmente bloqueado (múltiples puntos)
);

-- ==========================================
-- TABLES
-- ==========================================

-- LOTO Procedure: Template for lockout-tagout procedures per machine
CREATE TABLE "LOTOProcedure" (
    "id" SERIAL PRIMARY KEY,
    "machineId" INTEGER NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,

    -- Energy sources to isolate
    "energySources" JSONB NOT NULL DEFAULT '[]',
    -- Format: [{"type": "ELECTRICAL", "location": "Panel A", "method": "Breaker 15", "verification": "Multimeter test"}]

    -- Steps for lockout procedure
    "lockoutSteps" JSONB NOT NULL DEFAULT '[]',
    -- Format: [{"order": 1, "description": "Turn off main breaker", "energySourceId": 1, "photo": "url"}]

    -- Steps for verification (zero energy state)
    "verificationSteps" JSONB NOT NULL DEFAULT '[]',
    -- Format: [{"order": 1, "description": "Try start button", "expectedResult": "No movement"}]

    -- Steps for restoration
    "restorationSteps" JSONB NOT NULL DEFAULT '[]',
    -- Format: [{"order": 1, "description": "Remove all locks", "warning": "Verify area clear"}]

    -- Verification method after lockout
    "verificationMethod" TEXT,

    -- PPE required during LOTO
    "requiredPPE" JSONB DEFAULT '[]',

    -- Estimated time in minutes
    "estimatedMinutes" INTEGER,

    -- Warnings and special considerations
    "warnings" TEXT,
    "specialConsiderations" TEXT,

    -- Status
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isApproved" BOOLEAN NOT NULL DEFAULT false,
    "approvedById" INTEGER,
    "approvedAt" TIMESTAMP(3),

    -- Metadata
    "companyId" INTEGER NOT NULL,
    "createdById" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LOTOProcedure_machineId_fkey" FOREIGN KEY ("machineId") REFERENCES "Machine"("id") ON DELETE CASCADE,
    CONSTRAINT "LOTOProcedure_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE,
    CONSTRAINT "LOTOProcedure_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id"),
    CONSTRAINT "LOTOProcedure_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id")
);

-- Permit to Work: Safety permit for hazardous work
CREATE TABLE "PermitToWork" (
    "id" SERIAL PRIMARY KEY,
    "number" VARCHAR(50) NOT NULL,
    "type" "PTWType" NOT NULL,
    "status" "PTWStatus" NOT NULL DEFAULT 'DRAFT',

    -- Linked entities
    "workOrderId" INTEGER,
    "machineId" INTEGER,
    "sectorId" INTEGER,

    -- Description of work
    "title" VARCHAR(255) NOT NULL,
    "description" TEXT NOT NULL,
    "workLocation" VARCHAR(255),

    -- Hazards and controls
    "hazardsIdentified" JSONB NOT NULL DEFAULT '[]',
    -- Format: [{"hazard": "Fire", "severity": "HIGH", "controls": ["Fire extinguisher nearby"]}]

    "controlMeasures" JSONB NOT NULL DEFAULT '[]',
    -- Format: [{"measure": "Fire watch", "responsible": "John Doe", "verified": true}]

    "requiredPPE" JSONB NOT NULL DEFAULT '[]',
    -- Format: [{"type": "HELMET", "mandatory": true, "specification": "Heat resistant"}]

    -- Emergency procedures
    "emergencyProcedures" TEXT,
    "emergencyContacts" JSONB DEFAULT '[]',

    -- Validity period
    "validFrom" TIMESTAMP(3) NOT NULL,
    "validTo" TIMESTAMP(3) NOT NULL,

    -- Request flow
    "requestedById" INTEGER NOT NULL,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    -- Approval flow (segregation of duties: requestedBy != approvedBy)
    "approvedById" INTEGER,
    "approvedAt" TIMESTAMP(3),
    "approvalNotes" TEXT,

    -- Rejection (if rejected)
    "rejectedById" INTEGER,
    "rejectedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,

    -- Activation (when work starts)
    "activatedById" INTEGER,
    "activatedAt" TIMESTAMP(3),

    -- Suspension (if temporarily stopped)
    "suspendedById" INTEGER,
    "suspendedAt" TIMESTAMP(3),
    "suspensionReason" TEXT,
    "resumedById" INTEGER,
    "resumedAt" TIMESTAMP(3),

    -- Closure
    "closedById" INTEGER,
    "closedAt" TIMESTAMP(3),
    "closeNotes" TEXT,
    "workCompletedSuccessfully" BOOLEAN,

    -- Final verification checklist
    "finalVerificationChecklist" JSONB DEFAULT '[]',
    -- Format: [{"item": "All workers evacuated", "verified": true, "verifiedById": 1}]
    "finalVerifiedById" INTEGER,
    "finalVerifiedAt" TIMESTAMP(3),

    -- PPE verification
    "ppeVerifiedById" INTEGER,
    "ppeVerifiedAt" TIMESTAMP(3),

    -- Signatures (digital)
    "signatures" JSONB DEFAULT '[]',
    -- Format: [{"userId": 1, "role": "REQUESTER", "signedAt": "2024-01-01T00:00:00Z", "ipAddress": "..."}]

    -- Attachments
    "attachments" JSONB DEFAULT '[]',
    -- Format: [{"name": "JSA Form", "url": "...", "type": "PDF"}]

    -- Metadata
    "companyId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PermitToWork_workOrderId_fkey" FOREIGN KEY ("workOrderId") REFERENCES "work_orders"("id"),
    CONSTRAINT "PermitToWork_machineId_fkey" FOREIGN KEY ("machineId") REFERENCES "Machine"("id"),
    CONSTRAINT "PermitToWork_sectorId_fkey" FOREIGN KEY ("sectorId") REFERENCES "Sector"("id"),
    CONSTRAINT "PermitToWork_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User"("id"),
    CONSTRAINT "PermitToWork_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id"),
    CONSTRAINT "PermitToWork_rejectedById_fkey" FOREIGN KEY ("rejectedById") REFERENCES "User"("id"),
    CONSTRAINT "PermitToWork_activatedById_fkey" FOREIGN KEY ("activatedById") REFERENCES "User"("id"),
    CONSTRAINT "PermitToWork_suspendedById_fkey" FOREIGN KEY ("suspendedById") REFERENCES "User"("id"),
    CONSTRAINT "PermitToWork_resumedById_fkey" FOREIGN KEY ("resumedById") REFERENCES "User"("id"),
    CONSTRAINT "PermitToWork_closedById_fkey" FOREIGN KEY ("closedById") REFERENCES "User"("id"),
    CONSTRAINT "PermitToWork_finalVerifiedById_fkey" FOREIGN KEY ("finalVerifiedById") REFERENCES "User"("id"),
    CONSTRAINT "PermitToWork_ppeVerifiedById_fkey" FOREIGN KEY ("ppeVerifiedById") REFERENCES "User"("id"),
    CONSTRAINT "PermitToWork_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE
);

-- LOTO Execution: Actual lockout-tagout event linked to work
CREATE TABLE "LOTOExecution" (
    "id" SERIAL PRIMARY KEY,
    "procedureId" INTEGER NOT NULL,
    "workOrderId" INTEGER NOT NULL,
    "ptwId" INTEGER,  -- Optional link to Permit to Work

    -- Status
    "status" "LOTOStatus" NOT NULL DEFAULT 'LOCKED',

    -- Lock application
    "lockedById" INTEGER NOT NULL,
    "lockedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    -- Lock details
    "lockDetails" JSONB NOT NULL DEFAULT '[]',
    -- Format: [{"lockNumber": "L-001", "location": "Panel A", "energySource": "Electrical", "lockedById": 1, "lockedAt": "..."}]

    -- Zero energy verification
    "zeroEnergyVerified" BOOLEAN NOT NULL DEFAULT false,
    "zeroEnergyVerifiedById" INTEGER,
    "zeroEnergyVerifiedAt" TIMESTAMP(3),
    "zeroEnergyVerificationPhoto" VARCHAR(500),  -- URL to photo proof
    "zeroEnergyChecklist" JSONB DEFAULT '[]',
    -- Format: [{"step": "Try start button", "result": "OK", "verifiedById": 1, "verifiedAt": "..."}]

    -- Unlock (when work complete)
    "unlockedById" INTEGER,
    "unlockedAt" TIMESTAMP(3),
    "unlockVerificationPhoto" VARCHAR(500),

    -- All workers accounted for before unlock
    "workersAccountedFor" JSONB DEFAULT '[]',
    -- Format: [{"userId": 1, "name": "John Doe", "confirmedAt": "..."}]

    -- Notes
    "notes" TEXT,
    "incidentsReported" TEXT,

    -- Metadata
    "companyId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LOTOExecution_procedureId_fkey" FOREIGN KEY ("procedureId") REFERENCES "LOTOProcedure"("id"),
    CONSTRAINT "LOTOExecution_workOrderId_fkey" FOREIGN KEY ("workOrderId") REFERENCES "work_orders"("id"),
    CONSTRAINT "LOTOExecution_ptwId_fkey" FOREIGN KEY ("ptwId") REFERENCES "PermitToWork"("id"),
    CONSTRAINT "LOTOExecution_lockedById_fkey" FOREIGN KEY ("lockedById") REFERENCES "User"("id"),
    CONSTRAINT "LOTOExecution_zeroEnergyVerifiedById_fkey" FOREIGN KEY ("zeroEnergyVerifiedById") REFERENCES "User"("id"),
    CONSTRAINT "LOTOExecution_unlockedById_fkey" FOREIGN KEY ("unlockedById") REFERENCES "User"("id"),
    CONSTRAINT "LOTOExecution_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE
);

-- ==========================================
-- WORK ORDER ENHANCEMENTS
-- ==========================================

-- Add PTW/LOTO requirements to work orders
ALTER TABLE "work_orders" ADD COLUMN IF NOT EXISTS "requiresPTW" BOOLEAN DEFAULT false;
ALTER TABLE "work_orders" ADD COLUMN IF NOT EXISTS "ptwTypes" JSONB DEFAULT '[]';
-- Format: ["HOT_WORK", "CONFINED_SPACE"]

ALTER TABLE "work_orders" ADD COLUMN IF NOT EXISTS "requiresLOTO" BOOLEAN DEFAULT false;

-- Block closure flags
ALTER TABLE "work_orders" ADD COLUMN IF NOT EXISTS "ptwBlocked" BOOLEAN DEFAULT false;
-- True if work can't close without PTW being CLOSED
ALTER TABLE "work_orders" ADD COLUMN IF NOT EXISTS "lotoBlocked" BOOLEAN DEFAULT false;
-- True if work can't close without LOTO being UNLOCKED

-- ==========================================
-- INDEXES
-- ==========================================

-- PTW indexes
CREATE INDEX "PermitToWork_number_idx" ON "PermitToWork"("number");
CREATE INDEX "PermitToWork_status_idx" ON "PermitToWork"("status");
CREATE INDEX "PermitToWork_type_idx" ON "PermitToWork"("type");
CREATE INDEX "PermitToWork_companyId_status_idx" ON "PermitToWork"("companyId", "status");
CREATE INDEX "PermitToWork_workOrderId_idx" ON "PermitToWork"("workOrderId");
CREATE INDEX "PermitToWork_machineId_idx" ON "PermitToWork"("machineId");
CREATE INDEX "PermitToWork_validTo_idx" ON "PermitToWork"("validTo");

-- LOTO Procedure indexes
CREATE INDEX "LOTOProcedure_machineId_idx" ON "LOTOProcedure"("machineId");
CREATE INDEX "LOTOProcedure_companyId_idx" ON "LOTOProcedure"("companyId");
CREATE INDEX "LOTOProcedure_isActive_idx" ON "LOTOProcedure"("isActive");

-- LOTO Execution indexes
CREATE INDEX "LOTOExecution_procedureId_idx" ON "LOTOExecution"("procedureId");
CREATE INDEX "LOTOExecution_workOrderId_idx" ON "LOTOExecution"("workOrderId");
CREATE INDEX "LOTOExecution_ptwId_idx" ON "LOTOExecution"("ptwId");
CREATE INDEX "LOTOExecution_status_idx" ON "LOTOExecution"("status");
CREATE INDEX "LOTOExecution_companyId_status_idx" ON "LOTOExecution"("companyId", "status");

-- Work order indexes for PTW/LOTO
CREATE INDEX "work_orders_requiresPTW_idx" ON "work_orders"("requiresPTW") WHERE "requiresPTW" = true;
CREATE INDEX "work_orders_requiresLOTO_idx" ON "work_orders"("requiresLOTO") WHERE "requiresLOTO" = true;

-- ==========================================
-- UNIQUE CONSTRAINTS
-- ==========================================

-- PTW number must be unique per company
CREATE UNIQUE INDEX "PermitToWork_number_companyId_key" ON "PermitToWork"("number", "companyId");

-- ==========================================
-- COMMENTS
-- ==========================================

COMMENT ON TABLE "PermitToWork" IS 'Permits to Work (PTW) for hazardous operations requiring safety authorization';
COMMENT ON TABLE "LOTOProcedure" IS 'Lockout-Tagout procedures defining how to safely isolate energy sources for a machine';
COMMENT ON TABLE "LOTOExecution" IS 'Actual LOTO events - tracking when a machine is locked/unlocked during maintenance';

COMMENT ON COLUMN "PermitToWork"."type" IS 'Type of hazardous work: HOT_WORK, CONFINED_SPACE, HEIGHT_WORK, ELECTRICAL, etc.';
COMMENT ON COLUMN "PermitToWork"."validFrom" IS 'Start of permit validity period';
COMMENT ON COLUMN "PermitToWork"."validTo" IS 'End of permit validity period - work must be completed and PTW closed by this time';

COMMENT ON COLUMN "LOTOProcedure"."energySources" IS 'JSON array of energy sources to isolate: electrical, hydraulic, pneumatic, etc.';
COMMENT ON COLUMN "LOTOProcedure"."verificationMethod" IS 'How to verify zero energy state (e.g., try start, voltmeter test)';

COMMENT ON COLUMN "LOTOExecution"."zeroEnergyVerified" IS 'Confirmation that all energy sources have been verified as isolated';
COMMENT ON COLUMN "LOTOExecution"."zeroEnergyVerificationPhoto" IS 'Photo evidence of zero energy verification (e.g., voltmeter reading)';

COMMENT ON COLUMN "work_orders"."requiresPTW" IS 'Whether this work order requires a Permit to Work before starting';
COMMENT ON COLUMN "work_orders"."requiresLOTO" IS 'Whether this work order requires Lockout-Tagout before starting';
COMMENT ON COLUMN "work_orders"."ptwBlocked" IS 'If true, work order cannot be closed until all associated PTWs are CLOSED';
COMMENT ON COLUMN "work_orders"."lotoBlocked" IS 'If true, work order cannot be closed until all associated LOTOs are UNLOCKED';
