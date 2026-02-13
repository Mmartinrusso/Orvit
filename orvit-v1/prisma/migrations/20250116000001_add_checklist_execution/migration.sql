-- CreateTable
CREATE TABLE "ChecklistExecution" (
    "id" SERIAL NOT NULL,
    "checklistId" INTEGER NOT NULL,
    "executedBy" TEXT NOT NULL,
    "executionTime" INTEGER NOT NULL,
    "completedItemsCount" INTEGER NOT NULL,
    "totalItemsCount" INTEGER NOT NULL,
    "companyId" INTEGER NOT NULL,
    "sectorId" INTEGER,
    "executionDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT NOT NULL DEFAULT 'COMPLETED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChecklistExecution_pkey" PRIMARY KEY ("id")
);
