-- Script para agregar columnas de Discord de forma segura
-- Solo agrega las columnas si no existen

-- User: discordUserId
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'User' AND column_name = 'discordUserId') THEN
        ALTER TABLE "User" ADD COLUMN "discordUserId" TEXT;
        CREATE UNIQUE INDEX IF NOT EXISTS "User_discordUserId_key" ON "User"("discordUserId");
    END IF;
END $$;

-- Company: Discord Bot fields
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'Company' AND column_name = 'discordBotToken') THEN
        ALTER TABLE "Company" ADD COLUMN "discordBotToken" TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'Company' AND column_name = 'discordGuildId') THEN
        ALTER TABLE "Company" ADD COLUMN "discordGuildId" TEXT;
    END IF;
END $$;

-- Sector: Discord Webhook fields
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'Sector' AND column_name = 'discordFallasWebhook') THEN
        ALTER TABLE "Sector" ADD COLUMN "discordFallasWebhook" TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'Sector' AND column_name = 'discordPreventivosWebhook') THEN
        ALTER TABLE "Sector" ADD COLUMN "discordPreventivosWebhook" TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'Sector' AND column_name = 'discordOrdenesTrabajoWebhook') THEN
        ALTER TABLE "Sector" ADD COLUMN "discordOrdenesTrabajoWebhook" TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'Sector' AND column_name = 'discordResumenDiaWebhook') THEN
        ALTER TABLE "Sector" ADD COLUMN "discordResumenDiaWebhook" TEXT;
    END IF;
END $$;

-- Sector: Discord Channel ID fields
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'Sector' AND column_name = 'discordCategoryId') THEN
        ALTER TABLE "Sector" ADD COLUMN "discordCategoryId" TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'Sector' AND column_name = 'discordFallasChannelId') THEN
        ALTER TABLE "Sector" ADD COLUMN "discordFallasChannelId" TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'Sector' AND column_name = 'discordPreventivosChannelId') THEN
        ALTER TABLE "Sector" ADD COLUMN "discordPreventivosChannelId" TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'Sector' AND column_name = 'discordOTChannelId') THEN
        ALTER TABLE "Sector" ADD COLUMN "discordOTChannelId" TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'Sector' AND column_name = 'discordResumenChannelId') THEN
        ALTER TABLE "Sector" ADD COLUMN "discordResumenChannelId" TEXT;
    END IF;
END $$;

SELECT 'Columnas de Discord agregadas exitosamente' AS resultado;
