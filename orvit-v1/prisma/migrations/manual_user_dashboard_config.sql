-- Migración manual para crear la tabla user_dashboard_configs
-- Ejecutar este SQL si la migración automática no funciona

-- CreateTable
CREATE TABLE IF NOT EXISTS "user_dashboard_configs" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "companyId" INTEGER NOT NULL,
    "name" TEXT NOT NULL DEFAULT 'Mi Dashboard',
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "layout" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_dashboard_configs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "user_dashboard_configs_userId_companyId_name_key" ON "user_dashboard_configs"("userId", "companyId", "name");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "user_dashboard_configs_userId_idx" ON "user_dashboard_configs"("userId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "user_dashboard_configs_companyId_idx" ON "user_dashboard_configs"("companyId");

-- AddForeignKey (si no existen)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'user_dashboard_configs_userId_fkey'
    ) THEN
        ALTER TABLE "user_dashboard_configs" ADD CONSTRAINT "user_dashboard_configs_userId_fkey" 
        FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'user_dashboard_configs_companyId_fkey'
    ) THEN
        ALTER TABLE "user_dashboard_configs" ADD CONSTRAINT "user_dashboard_configs_companyId_fkey" 
        FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END
$$;

