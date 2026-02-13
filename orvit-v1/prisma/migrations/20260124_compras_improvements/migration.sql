-- Compras Notifications
CREATE TABLE IF NOT EXISTS "ComprasNotification" (
    "id" SERIAL NOT NULL,
    "type" TEXT NOT NULL,
    "companyId" INTEGER NOT NULL,
    "userId" INTEGER,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "priority" TEXT NOT NULL DEFAULT 'normal',
    "data" JSONB DEFAULT '{}',
    "read" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),

    CONSTRAINT "ComprasNotification_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ComprasNotification_companyId_userId_idx" ON "ComprasNotification"("companyId", "userId");
CREATE INDEX "ComprasNotification_companyId_read_idx" ON "ComprasNotification"("companyId", "read");
CREATE INDEX "ComprasNotification_createdAt_idx" ON "ComprasNotification"("createdAt" DESC);

-- Approval Workflows
CREATE TABLE IF NOT EXISTS "ApprovalWorkflow" (
    "id" SERIAL NOT NULL,
    "companyId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isEnabled" BOOLEAN NOT NULL DEFAULT false,
    "triggerType" TEXT NOT NULL,
    "conditions" JSONB NOT NULL DEFAULT '[]',
    "priority" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ApprovalWorkflow_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ApprovalWorkflow_companyId_isActive_idx" ON "ApprovalWorkflow"("companyId", "isActive");

-- Approval Workflow Levels
CREATE TABLE IF NOT EXISTS "ApprovalWorkflowLevel" (
    "id" SERIAL NOT NULL,
    "workflowId" INTEGER NOT NULL,
    "level" INTEGER NOT NULL,
    "approverType" TEXT NOT NULL,
    "approverIds" INTEGER[] NOT NULL,
    "escalationHours" INTEGER,
    "requireAll" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "ApprovalWorkflowLevel_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "ApprovalWorkflowLevel" ADD CONSTRAINT "ApprovalWorkflowLevel_workflowId_fkey"
FOREIGN KEY ("workflowId") REFERENCES "ApprovalWorkflow"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "ApprovalWorkflowLevel_workflowId_idx" ON "ApprovalWorkflowLevel"("workflowId");

-- Approval Instances
CREATE TABLE IF NOT EXISTS "ApprovalInstance" (
    "id" SERIAL NOT NULL,
    "companyId" INTEGER NOT NULL,
    "workflowId" INTEGER NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" INTEGER NOT NULL,
    "requesterId" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "currentLevel" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "ApprovalInstance_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "ApprovalInstance" ADD CONSTRAINT "ApprovalInstance_workflowId_fkey"
FOREIGN KEY ("workflowId") REFERENCES "ApprovalWorkflow"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "ApprovalInstance_companyId_status_idx" ON "ApprovalInstance"("companyId", "status");
CREATE INDEX "ApprovalInstance_entityType_entityId_idx" ON "ApprovalInstance"("entityType", "entityId");

-- Approval Actions
CREATE TABLE IF NOT EXISTS "ApprovalAction" (
    "id" SERIAL NOT NULL,
    "instanceId" INTEGER NOT NULL,
    "level" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "action" TEXT NOT NULL,
    "comments" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ApprovalAction_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "ApprovalAction" ADD CONSTRAINT "ApprovalAction_instanceId_fkey"
FOREIGN KEY ("instanceId") REFERENCES "ApprovalInstance"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "ApprovalAction_instanceId_idx" ON "ApprovalAction"("instanceId");

-- Approval Delegations
CREATE TABLE IF NOT EXISTS "ApprovalDelegation" (
    "id" SERIAL NOT NULL,
    "companyId" INTEGER NOT NULL,
    "delegatorId" INTEGER NOT NULL,
    "delegateeId" INTEGER NOT NULL,
    "validFrom" TIMESTAMP(3) NOT NULL,
    "validUntil" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ApprovalDelegation_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ApprovalDelegation_companyId_delegateeId_idx" ON "ApprovalDelegation"("companyId", "delegateeId");
CREATE INDEX "ApprovalDelegation_validFrom_validUntil_idx" ON "ApprovalDelegation"("validFrom", "validUntil");

-- Update permission names (T2 Indetectable)
UPDATE "RolePermission" SET permission = 'pref.l2' WHERE permission = 'view.extended';
UPDATE "RolePermission" SET permission = 'pref.adv' WHERE permission = 'view.create_t2';
UPDATE "RolePermission" SET permission = 'pref.cfg' WHERE permission = 'view.config';
UPDATE "RolePermission" SET permission = 'pref.aud' WHERE permission = 'view.logs';
