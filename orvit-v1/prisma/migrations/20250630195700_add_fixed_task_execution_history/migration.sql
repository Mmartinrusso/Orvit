-- CreateTable
CREATE TABLE "FixedTaskExecution" (
    "id" SERIAL NOT NULL,
    "fixedTaskId" INTEGER NOT NULL,
    "executedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "executedById" INTEGER,
    "executedByWorkerId" INTEGER,
    "duration" INTEGER,
    "notes" TEXT,
    "attachments" JSONB,
    "status" TEXT NOT NULL DEFAULT 'completed',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FixedTaskExecution_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "FixedTaskExecution" ADD CONSTRAINT "FixedTaskExecution_fixedTaskId_fkey" FOREIGN KEY ("fixedTaskId") REFERENCES "FixedTask"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FixedTaskExecution" ADD CONSTRAINT "FixedTaskExecution_executedById_fkey" FOREIGN KEY ("executedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FixedTaskExecution" ADD CONSTRAINT "FixedTaskExecution_executedByWorkerId_fkey" FOREIGN KEY ("executedByWorkerId") REFERENCES "Worker"("id") ON DELETE SET NULL ON UPDATE CASCADE;
