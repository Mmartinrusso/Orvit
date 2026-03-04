-- AlterTable: Add hierarchy fields to conversations
ALTER TABLE "conversations" ADD COLUMN "parent_id" TEXT;
ALTER TABLE "conversations" ADD COLUMN "depth" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "conversations" ADD COLUMN "icon_name" VARCHAR(50);
ALTER TABLE "conversations" ADD COLUMN "only_admins_post" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "conversations_parent_id_idx" ON "conversations"("parent_id");

-- AddForeignKey
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "conversations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
