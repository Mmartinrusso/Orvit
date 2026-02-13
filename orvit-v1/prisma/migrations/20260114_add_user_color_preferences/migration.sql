-- CreateTable
CREATE TABLE IF NOT EXISTS "user_color_preferences" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "companyId" INTEGER NOT NULL,
    "themeName" TEXT NOT NULL DEFAULT 'Personalizado',
    "chart1" TEXT NOT NULL DEFAULT '#3b82f6',
    "chart2" TEXT NOT NULL DEFAULT '#10b981',
    "chart3" TEXT NOT NULL DEFAULT '#f59e0b',
    "chart4" TEXT NOT NULL DEFAULT '#8b5cf6',
    "chart5" TEXT NOT NULL DEFAULT '#06b6d4',
    "chart6" TEXT NOT NULL DEFAULT '#ef4444',
    "progressPrimary" TEXT NOT NULL DEFAULT '#3b82f6',
    "progressSecondary" TEXT NOT NULL DEFAULT '#10b981',
    "progressWarning" TEXT NOT NULL DEFAULT '#f59e0b',
    "progressDanger" TEXT NOT NULL DEFAULT '#ef4444',
    "kpiPositive" TEXT NOT NULL DEFAULT '#10b981',
    "kpiNegative" TEXT NOT NULL DEFAULT '#ef4444',
    "kpiNeutral" TEXT NOT NULL DEFAULT '#64748b',
    "cardHighlight" TEXT NOT NULL DEFAULT '#ede9fe',
    "cardMuted" TEXT NOT NULL DEFAULT '#f1f5f9',
    "donut1" TEXT NOT NULL DEFAULT '#3b82f6',
    "donut2" TEXT NOT NULL DEFAULT '#10b981',
    "donut3" TEXT NOT NULL DEFAULT '#f59e0b',
    "donut4" TEXT NOT NULL DEFAULT '#8b5cf6',
    "donut5" TEXT NOT NULL DEFAULT '#94a3b8',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_color_preferences_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "user_color_preferences_userId_idx" ON "user_color_preferences"("userId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "user_color_preferences_companyId_idx" ON "user_color_preferences"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "user_color_preferences_userId_companyId_key" ON "user_color_preferences"("userId", "companyId");

-- AddForeignKey (if not exists)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'user_color_preferences_userId_fkey'
    ) THEN
        ALTER TABLE "user_color_preferences" ADD CONSTRAINT "user_color_preferences_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'user_color_preferences_companyId_fkey'
    ) THEN
        ALTER TABLE "user_color_preferences" ADD CONSTRAINT "user_color_preferences_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;
