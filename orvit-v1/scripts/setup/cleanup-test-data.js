/**
 * Script para limpiar datos de prueba creados durante testing
 * Ejecutar con: node scripts/cleanup-test-data.js
 */

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  console.log('🧹 Limpiando datos de prueba...\n');

  try {
    // Buscar fallas de prueba
    const fallas = await prisma.failureOccurrence.findMany({
      where: {
        title: { contains: 'PRUEBA' }
      },
      select: { id: true, title: true }
    });

    console.log(`📍 Encontradas ${fallas.length} fallas de prueba:`);
    fallas.forEach(f => console.log(`   - #${f.id}: ${f.title}`));

    // Buscar OTs de prueba
    const ots = await prisma.workOrder.findMany({
      where: {
        title: { contains: 'PRUEBA' }
      },
      select: { id: true, title: true }
    });

    console.log(`\n📍 Encontradas ${ots.length} OTs de prueba:`);
    ots.forEach(o => console.log(`   - #${o.id}: ${o.title}`));

    // Buscar downtimes asociados a fallas de prueba
    const fallaIds = fallas.map(f => f.id);
    const downtimes = await prisma.downtimeLog.findMany({
      where: {
        failureOccurrenceId: { in: fallaIds }
      },
      select: { id: true, failureOccurrenceId: true }
    });

    console.log(`\n📍 Encontrados ${downtimes.length} downtimes de prueba:`);
    downtimes.forEach(d => console.log(`   - #${d.id} (falla #${d.failureOccurrenceId})`));

    if (fallas.length === 0 && ots.length === 0) {
      console.log('\n✅ No hay datos de prueba para limpiar.');
      return;
    }

    console.log('\n⚠️ ¿Eliminar estos datos? Ejecuta con --confirm para confirmar');
    console.log('   node scripts/cleanup-test-data.js --confirm');

    if (process.argv.includes('--confirm')) {
      console.log('\n🗑️ Eliminando datos...');

      // Eliminar downtimes primero (por FK)
      if (downtimes.length > 0) {
        const deletedDowntimes = await prisma.downtimeLog.deleteMany({
          where: { id: { in: downtimes.map(d => d.id) } }
        });
        console.log(`   ✅ Eliminados ${deletedDowntimes.count} downtimes`);
      }

      // Desvincular fallas de OTs antes de eliminar
      if (fallas.length > 0) {
        await prisma.failureOccurrence.updateMany({
          where: { id: { in: fallaIds } },
          data: { failureId: null }
        });
      }

      // Eliminar OTs
      if (ots.length > 0) {
        const deletedOTs = await prisma.workOrder.deleteMany({
          where: { id: { in: ots.map(o => o.id) } }
        });
        console.log(`   ✅ Eliminadas ${deletedOTs.count} OTs`);
      }

      // Eliminar fallas
      if (fallas.length > 0) {
        const deletedFallas = await prisma.failureOccurrence.deleteMany({
          where: { id: { in: fallaIds } }
        });
        console.log(`   ✅ Eliminadas ${deletedFallas.count} fallas`);
      }

      console.log('\n🎉 Limpieza completada');
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

main();
