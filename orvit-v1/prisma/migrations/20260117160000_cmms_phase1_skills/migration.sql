-- CMMS Phase 1.3: Skills & Certifications System
-- Skills, UserSkill, UserCertification, TaskSkillRequirement tables

-- Create CertificationStatus enum
CREATE TYPE "CertificationStatus" AS ENUM ('ACTIVE', 'EXPIRED', 'PENDING_RENEWAL', 'REVOKED');

-- Create Skill table
CREATE TABLE "skills" (
    "id" SERIAL NOT NULL,
    "companyId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "category" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "skills_pkey" PRIMARY KEY ("id")
);

-- Create UserSkill table
CREATE TABLE "user_skills" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "skillId" INTEGER NOT NULL,
    "level" INTEGER NOT NULL DEFAULT 1,
    "certifiedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "certificationDoc" TEXT,
    "verifiedById" INTEGER,
    "verifiedAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_skills_pkey" PRIMARY KEY ("id")
);

-- Create UserCertification table
CREATE TABLE "user_certifications" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "companyId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "issuedBy" TEXT NOT NULL,
    "issuedAt" TIMESTAMP(3) NOT NULL,
    "expiresAt" TIMESTAMP(3),
    "documentUrl" TEXT,
    "status" "CertificationStatus" NOT NULL DEFAULT 'ACTIVE',
    "category" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_certifications_pkey" PRIMARY KEY ("id")
);

-- Create TaskSkillRequirement table
CREATE TABLE "task_skill_requirements" (
    "id" SERIAL NOT NULL,
    "skillId" INTEGER NOT NULL,
    "minLevel" INTEGER NOT NULL DEFAULT 1,
    "companyId" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "checklistId" INTEGER,
    "machineId" INTEGER,
    "maintenanceType" TEXT,
    "ptwType" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "task_skill_requirements_pkey" PRIMARY KEY ("id")
);

-- Unique constraints
CREATE UNIQUE INDEX "skills_companyId_name_key" ON "skills"("companyId", "name");
CREATE UNIQUE INDEX "user_skills_userId_skillId_key" ON "user_skills"("userId", "skillId");

-- Indexes for skills
CREATE INDEX "skills_companyId_idx" ON "skills"("companyId");
CREATE INDEX "skills_category_idx" ON "skills"("category");

-- Indexes for user_skills
CREATE INDEX "user_skills_userId_idx" ON "user_skills"("userId");
CREATE INDEX "user_skills_skillId_idx" ON "user_skills"("skillId");
CREATE INDEX "user_skills_expiresAt_idx" ON "user_skills"("expiresAt");

-- Indexes for user_certifications
CREATE INDEX "user_certifications_userId_idx" ON "user_certifications"("userId");
CREATE INDEX "user_certifications_companyId_idx" ON "user_certifications"("companyId");
CREATE INDEX "user_certifications_status_idx" ON "user_certifications"("status");
CREATE INDEX "user_certifications_expiresAt_idx" ON "user_certifications"("expiresAt");

-- Indexes for task_skill_requirements
CREATE INDEX "task_skill_requirements_skillId_idx" ON "task_skill_requirements"("skillId");
CREATE INDEX "task_skill_requirements_companyId_idx" ON "task_skill_requirements"("companyId");
CREATE INDEX "task_skill_requirements_checklistId_idx" ON "task_skill_requirements"("checklistId");
CREATE INDEX "task_skill_requirements_machineId_idx" ON "task_skill_requirements"("machineId");
CREATE INDEX "task_skill_requirements_maintenanceType_idx" ON "task_skill_requirements"("maintenanceType");

-- Foreign keys for skills
ALTER TABLE "skills" ADD CONSTRAINT "skills_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Foreign keys for user_skills
ALTER TABLE "user_skills" ADD CONSTRAINT "user_skills_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "user_skills" ADD CONSTRAINT "user_skills_skillId_fkey" FOREIGN KEY ("skillId") REFERENCES "skills"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "user_skills" ADD CONSTRAINT "user_skills_verifiedById_fkey" FOREIGN KEY ("verifiedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Foreign keys for user_certifications
ALTER TABLE "user_certifications" ADD CONSTRAINT "user_certifications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "user_certifications" ADD CONSTRAINT "user_certifications_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Foreign keys for task_skill_requirements
ALTER TABLE "task_skill_requirements" ADD CONSTRAINT "task_skill_requirements_skillId_fkey" FOREIGN KEY ("skillId") REFERENCES "skills"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "task_skill_requirements" ADD CONSTRAINT "task_skill_requirements_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "task_skill_requirements" ADD CONSTRAINT "task_skill_requirements_checklistId_fkey" FOREIGN KEY ("checklistId") REFERENCES "maintenance_checklists"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "task_skill_requirements" ADD CONSTRAINT "task_skill_requirements_machineId_fkey" FOREIGN KEY ("machineId") REFERENCES "Machine"("id") ON DELETE CASCADE ON UPDATE CASCADE;
