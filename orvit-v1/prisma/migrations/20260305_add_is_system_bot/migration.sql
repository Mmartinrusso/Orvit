-- Add isSystemBot flag to conversations for the ORVIT AI bot chat
ALTER TABLE "conversations" ADD COLUMN "is_system_bot" BOOLEAN NOT NULL DEFAULT false;
