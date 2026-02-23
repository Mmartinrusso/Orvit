import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function applyIndexes() {
  console.log('🚀 Aplicando índices de performance...\n');

  const indexes = [
    // Component indexes
    { name: 'Component_machineId_idx', sql: `CREATE INDEX IF NOT EXISTS "Component_machineId_idx" ON "Component"("machineId")` },
    { name: 'Component_parentId_idx', sql: `CREATE INDEX IF NOT EXISTS "Component_parentId_idx" ON "Component"("parentId")` },
    { name: 'Component_machineId_parentId_idx', sql: `CREATE INDEX IF NOT EXISTS "Component_machineId_parentId_idx" ON "Component"("machineId", "parentId")` },
    { name: 'Component_createdAt_idx', sql: `CREATE INDEX IF NOT EXISTS "Component_createdAt_idx" ON "Component"("createdAt")` },
    { name: 'Component_system_idx', sql: `CREATE INDEX IF NOT EXISTS "Component_system_idx" ON "Component"("system")` },

    // Machine indexes
    { name: 'Machine_companyId_idx', sql: `CREATE INDEX IF NOT EXISTS "Machine_companyId_idx" ON "Machine"("companyId")` },
    { name: 'Machine_sectorId_idx', sql: `CREATE INDEX IF NOT EXISTS "Machine_sectorId_idx" ON "Machine"("sectorId")` },
    { name: 'Machine_companyId_sectorId_idx', sql: `CREATE INDEX IF NOT EXISTS "Machine_companyId_sectorId_idx" ON "Machine"("companyId", "sectorId")` },
    { name: 'Machine_status_idx', sql: `CREATE INDEX IF NOT EXISTS "Machine_status_idx" ON "Machine"("status")` },
    { name: 'Machine_companyId_status_idx', sql: `CREATE INDEX IF NOT EXISTS "Machine_companyId_status_idx" ON "Machine"("companyId", "status")` },
    { name: 'Machine_areaId_idx', sql: `CREATE INDEX IF NOT EXISTS "Machine_areaId_idx" ON "Machine"("areaId")` },
    { name: 'Machine_plantZoneId_idx', sql: `CREATE INDEX IF NOT EXISTS "Machine_plantZoneId_idx" ON "Machine"("plantZoneId")` },

    // Document indexes
    { name: 'Document_machineId_idx', sql: `CREATE INDEX IF NOT EXISTS "Document_machineId_idx" ON "Document"("machineId")` },
    { name: 'Document_componentId_idx', sql: `CREATE INDEX IF NOT EXISTS "Document_componentId_idx" ON "Document"("componentId")` },
    { name: 'Document_entityType_entityId_idx', sql: `CREATE INDEX IF NOT EXISTS "Document_entityType_entityId_idx" ON "Document"("entityType", "entityId")` },

    // HistoryEvent indexes
    { name: 'HistoryEvent_machineId_idx', sql: `CREATE INDEX IF NOT EXISTS "HistoryEvent_machineId_idx" ON "HistoryEvent"("machineId")` },
    { name: 'HistoryEvent_componentId_idx', sql: `CREATE INDEX IF NOT EXISTS "HistoryEvent_componentId_idx" ON "HistoryEvent"("componentId")` },
    { name: 'HistoryEvent_machineId_createdAt_idx', sql: `CREATE INDEX IF NOT EXISTS "HistoryEvent_machineId_createdAt_idx" ON "HistoryEvent"("machineId", "createdAt")` },

    // DowntimeLog indexes
    { name: 'DowntimeLog_machineId_idx', sql: `CREATE INDEX IF NOT EXISTS "DowntimeLog_machineId_idx" ON "DowntimeLog"("machineId")` },
    { name: 'DowntimeLog_machineId_startTime_idx', sql: `CREATE INDEX IF NOT EXISTS "DowntimeLog_machineId_startTime_idx" ON "DowntimeLog"("machineId", "startTime")` },

    // MaintenanceChecklist indexes
    { name: 'MaintenanceChecklist_machineId_idx', sql: `CREATE INDEX IF NOT EXISTS "MaintenanceChecklist_machineId_idx" ON "MaintenanceChecklist"("machineId")` },
    { name: 'MaintenanceChecklist_componentId_idx', sql: `CREATE INDEX IF NOT EXISTS "MaintenanceChecklist_componentId_idx" ON "MaintenanceChecklist"("componentId")` },
  ];

  let success = 0;
  let failed = 0;

  for (const index of indexes) {
    try {
      await prisma.$executeRawUnsafe(index.sql);
      console.log(`✅ ${index.name}`);
      success++;
    } catch (error: any) {
      console.log(`❌ ${index.name}: ${error.message}`);
      failed++;
    }
  }

  // Analyze tables
  console.log('\n📊 Actualizando estadísticas de tablas...\n');

  const tables = ['Component', 'Machine', 'Document', 'HistoryEvent', 'DowntimeLog', 'MaintenanceChecklist'];

  for (const table of tables) {
    try {
      await prisma.$executeRawUnsafe(`ANALYZE "${table}"`);
      console.log(`✅ ANALYZE ${table}`);
    } catch (error: any) {
      console.log(`⚠️ ANALYZE ${table}: ${error.message}`);
    }
  }

  console.log(`\n🎉 Completado: ${success} índices creados, ${failed} errores`);
}

applyIndexes()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
