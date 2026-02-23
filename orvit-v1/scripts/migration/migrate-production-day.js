const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  console.log('=== Migración: Producción del Día ===\n');

  const statements = [
    // 1. Agregar productionSectorId a Product
    `ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "productionSectorId" INTEGER REFERENCES "Sector"(id)`,
    `CREATE INDEX IF NOT EXISTS idx_product_production_sector ON "Product"("productionSectorId")`,

    // 2. Agregar campos faltantes a production_routine_templates
    `ALTER TABLE "production_routine_templates" ADD COLUMN IF NOT EXISTS "maxCompletionTimeMinutes" INTEGER`,
    `ALTER TABLE "production_routine_templates" ADD COLUMN IF NOT EXISTS "enableCompletionReminders" BOOLEAN DEFAULT false`,

    // 3. Agregar campos faltantes a production_routines
    `ALTER TABLE "production_routines" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP`,
    `ALTER TABLE "production_routines" ADD COLUMN IF NOT EXISTS "lastReminderAt" TIMESTAMP(3)`,
    `ALTER TABLE "production_routines" ADD COLUMN IF NOT EXISTS "reminderCount" INTEGER DEFAULT 0`,

    // 4. Crear tabla daily_production_sessions
    `CREATE TABLE IF NOT EXISTS "daily_production_sessions" (
      id SERIAL PRIMARY KEY,
      "productionDate" DATE NOT NULL,
      "sectorId" INTEGER NOT NULL REFERENCES "Sector"(id),
      "shiftId" INTEGER REFERENCES "work_shifts"(id),
      status VARCHAR(20) DEFAULT 'DRAFT',
      "submittedAt" TIMESTAMP(3),
      "submittedById" INTEGER REFERENCES "User"(id),
      "approvedAt" TIMESTAMP(3),
      "approvedById" INTEGER REFERENCES "User"(id),
      "lockedAt" TIMESTAMP(3),
      notes TEXT,
      "companyId" INTEGER NOT NULL REFERENCES "Company"(id) ON DELETE CASCADE,
      "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
      UNIQUE("companyId", "sectorId", "productionDate", "shiftId")
    )`,
    `CREATE INDEX IF NOT EXISTS idx_daily_sessions_company_sector_date ON "daily_production_sessions"("companyId", "sectorId", "productionDate")`,

    // 5. Crear tabla daily_production_entries
    `CREATE TABLE IF NOT EXISTS "daily_production_entries" (
      id SERIAL PRIMARY KEY,
      "sessionId" INTEGER NOT NULL REFERENCES "daily_production_sessions"(id) ON DELETE CASCADE,
      "productId" VARCHAR(30) NOT NULL REFERENCES "Product"(id),
      "sectorId" INTEGER NOT NULL REFERENCES "Sector"(id),
      quantity DECIMAL(12,2) NOT NULL,
      "scrapQuantity" DECIMAL(12,2) DEFAULT 0,
      uom VARCHAR(50) DEFAULT 'unidad',
      "workCenterId" INTEGER REFERENCES "work_centers"(id),
      "batchNumber" VARCHAR(100),
      notes TEXT,
      "registeredById" INTEGER NOT NULL REFERENCES "User"(id),
      "recordedAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
      "companyId" INTEGER NOT NULL REFERENCES "Company"(id) ON DELETE CASCADE,
      "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE INDEX IF NOT EXISTS idx_daily_entries_session ON "daily_production_entries"("sessionId")`,
    `CREATE INDEX IF NOT EXISTS idx_daily_entries_company_sector ON "daily_production_entries"("companyId", "sectorId", "recordedAt")`,
    `CREATE INDEX IF NOT EXISTS idx_daily_entries_product ON "daily_production_entries"("productId")`,
  ];

  let success = 0;
  let skipped = 0;
  let errors = 0;

  for (const sql of statements) {
    const label = sql.trim().substring(0, 80).replace(/\s+/g, ' ');
    try {
      await prisma.$executeRawUnsafe(sql);
      console.log(`  ✓ ${label}...`);
      success++;
    } catch (err) {
      if (err.message?.includes('already exists') || err.message?.includes('duplicate')) {
        console.log(`  - ${label}... (ya existe, skip)`);
        skipped++;
      } else {
        console.error(`  ✗ ${label}...`);
        console.error(`    Error: ${err.message}`);
        errors++;
      }
    }
  }

  console.log(`\n=== Resultado: ${success} ejecutados, ${skipped} omitidos, ${errors} errores ===`);

  if (errors > 0) {
    process.exit(1);
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
