-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "NotificationType" ADD VALUE 'task_updated';
ALTER TYPE "NotificationType" ADD VALUE 'task_deleted';
ALTER TYPE "NotificationType" ADD VALUE 'task_completed';
ALTER TYPE "NotificationType" ADD VALUE 'task_due_soon';
ALTER TYPE "NotificationType" ADD VALUE 'task_auto_reset';
ALTER TYPE "NotificationType" ADD VALUE 'task_commented';
ALTER TYPE "NotificationType" ADD VALUE 'reminder_overdue';
ALTER TYPE "NotificationType" ADD VALUE 'reminder_due_today';
ALTER TYPE "NotificationType" ADD VALUE 'reminder_due_soon';
ALTER TYPE "NotificationType" ADD VALUE 'tool_request_new';
ALTER TYPE "NotificationType" ADD VALUE 'tool_request_approved';
ALTER TYPE "NotificationType" ADD VALUE 'tool_request_rejected';
