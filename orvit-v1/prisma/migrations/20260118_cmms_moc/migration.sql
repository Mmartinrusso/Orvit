-- CMMS: Management of Change (MOC) Module
-- Sistema para gestionar cambios en equipos, procesos y procedimientos

-- Estados del MOC
-- DRAFT -> PENDING_REVIEW -> UNDER_REVIEW -> APPROVED/REJECTED -> IMPLEMENTING -> COMPLETED/CANCELLED

-- Tabla principal de MOC
CREATE TABLE IF NOT EXISTS "management_of_change" (
    "id" SERIAL PRIMARY KEY,
    "mocNumber" VARCHAR(50) UNIQUE NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "description" TEXT NOT NULL,
    "changeType" VARCHAR(50) NOT NULL, -- EQUIPMENT, PROCESS, PROCEDURE, MATERIAL, PERSONNEL
    "priority" VARCHAR(20) DEFAULT 'MEDIUM', -- LOW, MEDIUM, HIGH, CRITICAL
    "status" VARCHAR(30) DEFAULT 'DRAFT',

    -- Justificación y alcance
    "justification" TEXT, -- Por qué es necesario el cambio
    "scope" TEXT, -- Alcance del cambio
    "impactAssessment" TEXT, -- Evaluación de impacto
    "riskAssessment" TEXT, -- Evaluación de riesgos

    -- Fechas
    "requestedDate" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "plannedStartDate" TIMESTAMP(3),
    "plannedEndDate" TIMESTAMP(3),
    "actualStartDate" TIMESTAMP(3),
    "actualEndDate" TIMESTAMP(3),

    -- Entidades afectadas
    "machineId" INTEGER,
    "componentId" INTEGER,
    "areaId" INTEGER,
    "sectorId" INTEGER,

    -- Usuarios
    "requestedById" INTEGER NOT NULL,
    "reviewedById" INTEGER,
    "approvedById" INTEGER,
    "implementedById" INTEGER,

    -- Aprobación
    "approvalDate" TIMESTAMP(3),
    "approvalNotes" TEXT,
    "rejectionReason" TEXT,

    -- Metadatos
    "isTemporary" BOOLEAN DEFAULT false, -- Cambio temporal vs permanente
    "temporaryUntil" TIMESTAMP(3), -- Si es temporal, hasta cuándo
    "requiresTraining" BOOLEAN DEFAULT false,
    "trainingCompleted" BOOLEAN DEFAULT false,

    "companyId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MOC_machineId_fkey" FOREIGN KEY ("machineId") REFERENCES "Machine"("id") ON DELETE SET NULL,
    CONSTRAINT "MOC_componentId_fkey" FOREIGN KEY ("componentId") REFERENCES "Component"("id") ON DELETE SET NULL,
    CONSTRAINT "MOC_areaId_fkey" FOREIGN KEY ("areaId") REFERENCES "Area"("id") ON DELETE SET NULL,
    CONSTRAINT "MOC_sectorId_fkey" FOREIGN KEY ("sectorId") REFERENCES "Sector"("id") ON DELETE SET NULL,
    CONSTRAINT "MOC_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User"("id"),
    CONSTRAINT "MOC_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id"),
    CONSTRAINT "MOC_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id"),
    CONSTRAINT "MOC_implementedById_fkey" FOREIGN KEY ("implementedById") REFERENCES "User"("id"),
    CONSTRAINT "MOC_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE
);

-- Documentos adjuntos al MOC
CREATE TABLE IF NOT EXISTS "MOCDocument" (
    "id" SERIAL PRIMARY KEY,
    "mocId" INTEGER NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "fileType" VARCHAR(50),
    "documentType" VARCHAR(50), -- BEFORE_PHOTO, AFTER_PHOTO, PROCEDURE, DRAWING, OTHER
    "uploadedById" INTEGER NOT NULL,
    "uploadedAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MOCDocument_mocId_fkey" FOREIGN KEY ("mocId") REFERENCES "management_of_change"("id") ON DELETE CASCADE,
    CONSTRAINT "MOCDocument_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id")
);

-- Historial de cambios de estado del MOC
CREATE TABLE IF NOT EXISTS "MOCHistory" (
    "id" SERIAL PRIMARY KEY,
    "mocId" INTEGER NOT NULL,
    "fromStatus" VARCHAR(30),
    "toStatus" VARCHAR(30) NOT NULL,
    "changedById" INTEGER NOT NULL,
    "changedAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,

    CONSTRAINT "MOCHistory_mocId_fkey" FOREIGN KEY ("mocId") REFERENCES "management_of_change"("id") ON DELETE CASCADE,
    CONSTRAINT "MOCHistory_changedById_fkey" FOREIGN KEY ("changedById") REFERENCES "User"("id")
);

-- Tareas asociadas al MOC (checklist de implementación)
CREATE TABLE IF NOT EXISTS "MOCTask" (
    "id" SERIAL PRIMARY KEY,
    "mocId" INTEGER NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "sequence" INTEGER DEFAULT 0,
    "status" VARCHAR(20) DEFAULT 'PENDING', -- PENDING, IN_PROGRESS, COMPLETED, SKIPPED
    "assignedToId" INTEGER,
    "dueDate" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "completedById" INTEGER,
    "notes" TEXT,

    CONSTRAINT "MOCTask_mocId_fkey" FOREIGN KEY ("mocId") REFERENCES "management_of_change"("id") ON DELETE CASCADE,
    CONSTRAINT "MOCTask_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "User"("id"),
    CONSTRAINT "MOCTask_completedById_fkey" FOREIGN KEY ("completedById") REFERENCES "User"("id")
);

-- Índices
CREATE INDEX IF NOT EXISTS "MOC_companyId_status_idx" ON "management_of_change"("companyId", "status");
CREATE INDEX IF NOT EXISTS "MOC_machineId_idx" ON "management_of_change"("machineId");
CREATE INDEX IF NOT EXISTS "MOC_requestedById_idx" ON "management_of_change"("requestedById");
CREATE INDEX IF NOT EXISTS "MOCDocument_mocId_idx" ON "MOCDocument"("mocId");
CREATE INDEX IF NOT EXISTS "MOCHistory_mocId_idx" ON "MOCHistory"("mocId");
CREATE INDEX IF NOT EXISTS "MOCTask_mocId_idx" ON "MOCTask"("mocId");
