/*
  Warnings:

  - You are about to drop the column `attachments` on the `FixedTaskExecution` table. All the data in the column will be lost.
  - You are about to drop the column `duration` on the `FixedTaskExecution` table. All the data in the column will be lost.
  - You are about to drop the column `executedById` on the `FixedTaskExecution` table. All the data in the column will be lost.
  - You are about to drop the column `executedByWorkerId` on the `FixedTaskExecution` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "FixedTaskExecution" DROP CONSTRAINT "FixedTaskExecution_executedById_fkey";

-- DropForeignKey
ALTER TABLE "FixedTaskExecution" DROP CONSTRAINT "FixedTaskExecution_executedByWorkerId_fkey";

-- AlterTable
ALTER TABLE "FixedTaskExecution" DROP COLUMN "attachments",
DROP COLUMN "duration",
DROP COLUMN "executedById",
DROP COLUMN "executedByWorkerId",
ADD COLUMN     "actualDuration" INTEGER,
ADD COLUMN     "completedAt" TIMESTAMP(3),
ADD COLUMN     "nextScheduled" TIMESTAMP(3),
ADD COLUMN     "userId" INTEGER,
ADD COLUMN     "workerId" INTEGER,
ALTER COLUMN "status" SET DEFAULT 'PENDING';

-- CreateTable
CREATE TABLE "Category" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "companyId" INTEGER NOT NULL,
    "createdById" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Category_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Product" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "categoryId" INTEGER NOT NULL,
    "unit" TEXT NOT NULL,
    "costPrice" DOUBLE PRECISION NOT NULL,
    "minStock" INTEGER NOT NULL,
    "currentStock" INTEGER NOT NULL,
    "volume" DOUBLE PRECISION NOT NULL,
    "weight" DOUBLE PRECISION NOT NULL,
    "location" TEXT NOT NULL,
    "blocksPerM2" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "images" JSONB,
    "files" JSONB,
    "companyId" INTEGER NOT NULL,
    "createdById" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Category_companyId_name_key" ON "Category"("companyId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "Product_companyId_code_key" ON "Product"("companyId", "code");

-- AddForeignKey
ALTER TABLE "FixedTaskExecution" ADD CONSTRAINT "FixedTaskExecution_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FixedTaskExecution" ADD CONSTRAINT "FixedTaskExecution_workerId_fkey" FOREIGN KEY ("workerId") REFERENCES "Worker"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Category" ADD CONSTRAINT "Category_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Category" ADD CONSTRAINT "Category_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
