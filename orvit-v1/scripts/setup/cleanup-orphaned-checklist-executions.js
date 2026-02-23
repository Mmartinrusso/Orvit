const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function cleanupOrphanedChecklistExecutions() {
  try {
    console.log('🧹 Iniciando limpieza de ejecuciones de checklists huérfanas...');

    // 1. Obtener todas las ejecuciones
    const allExecutions = await prisma.checklistExecution.findMany({
      select: {
        id: true,
        checklistId: true,
        executedAt: true,
        executedBy: true
      }
    });

    console.log(`📊 Total de ejecuciones encontradas: ${allExecutions.length}`);

    // 2. Verificar cuáles tienen checklist válido
    const orphanedExecutions = [];
    const validExecutions = [];

    for (const execution of allExecutions) {
      const document = await prisma.document.findUnique({
        where: { id: execution.checklistId },
        select: { id: true, entityType: true, originalName: true }
      });

      if (!document) {
        orphanedExecutions.push(execution);
        console.log(`❌ Ejecución huérfana encontrada: ID ${execution.id}, checklistId: ${execution.checklistId}`);
      } else {
        validExecutions.push(execution);
        console.log(`✅ Ejecución válida: ID ${execution.id}, checklistId: ${execution.checklistId} -> ${document.originalName}`);
      }
    }

    console.log(`\n📊 Resumen:`);
    console.log(`✅ Ejecuciones válidas: ${validExecutions.length}`);
    console.log(`❌ Ejecuciones huérfanas: ${orphanedExecutions.length}`);

    if (orphanedExecutions.length === 0) {
      console.log('🎉 No hay ejecuciones huérfanas para limpiar');
      return;
    }

    // 3. Eliminar ejecuciones huérfanas
    console.log('\n🗑️ Eliminando ejecuciones huérfanas...');
    
    const deleteResult = await prisma.checklistExecution.deleteMany({
      where: {
        id: {
          in: orphanedExecutions.map(e => e.id)
        }
      }
    });

    console.log(`✅ Eliminadas ${deleteResult.count} ejecuciones huérfanas`);

    // 4. Verificar resultado final
    const remainingExecutions = await prisma.checklistExecution.count();
    console.log(`📊 Ejecuciones restantes en la base de datos: ${remainingExecutions}`);

    console.log('\n🎉 Limpieza completada exitosamente');

  } catch (error) {
    console.error('❌ Error durante la limpieza:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Ejecutar la limpieza
cleanupOrphanedChecklistExecutions()
  .then(() => {
    console.log('✅ Script de limpieza completado');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Error en el script:', error);
    process.exit(1);
  });
