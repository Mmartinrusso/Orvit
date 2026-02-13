ALTER TABLE "CompanySettings" ADD COLUMN IF NOT EXISTS "requireDespachoSignature" BOOLEAN NOT NULL DEFAULT false;
