-- CreateTable
CREATE TABLE IF NOT EXISTS "Control" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "type" VARCHAR(50) NOT NULL,
    "companyId" INTEGER NOT NULL,
    "createdBy" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Control_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Control_companyId_idx" ON "Control"("companyId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Control_type_idx" ON "Control"("type");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Control_isActive_idx" ON "Control"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "Control_companyId_name_type_key" ON "Control"("companyId", "name", "type");

-- AddForeignKey
ALTER TABLE "Control" ADD CONSTRAINT "Control_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Control" ADD CONSTRAINT "Control_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

