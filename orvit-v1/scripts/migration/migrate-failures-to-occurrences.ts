/**
 * Script de migración de fallas existentes al nuevo sistema de múltiples soluciones
 *
 * Este script:
 * 1. Busca todos los WorkOrder de tipo CORRECTIVE que no tienen FailureOccurrence
 * 2. Crea FailureOccurrence para cada uno
 * 3. Si el WorkOrder está COMPLETED y tiene solución en notes, crea FailureSolution
 *
 * Uso:
 *   npx ts-node scripts/migrate-failures-to-occurrences.ts
 *   npx ts-node scripts/migrate-failures-to-occurrences.ts --dry-run
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const DRY_RUN = process.argv.includes('--dry-run');

async function migrateFailures() {
  console.log('🚀 Iniciando migración de fallas...');
  console.log(`📋 Modo: ${DRY_RUN ? 'DRY RUN (sin cambios)' : 'EJECUCIÓN REAL'}\n`);

  try {
    // 1. Obtener todos los WorkOrder de tipo CORRECTIVE que no tienen occurrence
    const correctiveWorkOrders = await prisma.workOrder.findMany({
      where: {
        type: 'CORRECTIVE',
        occurrences: {
          none: {}
        }
      },
      include: {
        machine: true,
        createdBy: true,
        assignedTo: true,
      },
      orderBy: {
        createdAt: 'asc'
      }
    });

    console.log(`📊 Encontradas ${correctiveWorkOrders.length} fallas sin FailureOccurrence\n`);

    let occurrencesCreated = 0;
    let solutionsCreated = 0;
    let errors = 0;

    for (const workOrder of correctiveWorkOrders) {
      try {
        console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
        console.log(`📝 Procesando WorkOrder #${workOrder.id}: "${workOrder.title}"`);
        console.log(`   Máquina: ${workOrder.machine?.name || 'N/A'}`);
        console.log(`   Estado: ${workOrder.status}`);

        // Parsear notes para obtener datos adicionales
        let parsedNotes: any = {};
        try {
          if (workOrder.notes) {
            parsedNotes = JSON.parse(workOrder.notes);
          }
        } catch (e) {
          console.log(`   ⚠️ No se pudieron parsear las notes`);
        }

        // Determinar el reportador
        const reportedBy = parsedNotes.reportedById || workOrder.createdById;

        if (!reportedBy) {
          console.log(`   ⚠️ Sin reportador válido, saltando...`);
          errors++;
          continue;
        }

        if (!workOrder.machineId) {
          console.log(`   ⚠️ Sin máquina asociada, saltando...`);
          errors++;
          continue;
        }

        // Determinar el estado de la occurrence
        let occurrenceStatus = 'OPEN';
        if (workOrder.status === 'COMPLETED') {
          occurrenceStatus = 'RESOLVED';
        } else if (workOrder.status === 'IN_PROGRESS') {
          occurrenceStatus = 'IN_PROGRESS';
        }

        if (DRY_RUN) {
          console.log(`   ✅ [DRY RUN] Se crearía FailureOccurrence con status: ${occurrenceStatus}`);
          occurrencesCreated++;

          // Verificar si tiene solución
          if (workOrder.status === 'COMPLETED' && parsedNotes.solution) {
            console.log(`   ✅ [DRY RUN] Se crearía FailureSolution`);
            solutionsCreated++;
          }
        } else {
          // Crear FailureOccurrence
          const occurrence = await prisma.failureOccurrence.create({
            data: {
              failureId: workOrder.id,
              machineId: workOrder.machineId,
              reportedBy: reportedBy,
              reportedAt: workOrder.createdAt,
              resolvedAt: workOrder.status === 'COMPLETED' ? workOrder.completedDate : null,
              title: parsedNotes.failureTitle || workOrder.title,
              description: parsedNotes.failureDescription || workOrder.description,
              failureCategory: parsedNotes.failureType || 'MECANICA',
              priority: workOrder.priority || 'MEDIUM',
              affectedComponents: parsedNotes.affectedComponents || null,
              status: occurrenceStatus,
              notes: null,
            }
          });

          console.log(`   ✅ FailureOccurrence creada: #${occurrence.id}`);
          occurrencesCreated++;

          // Si el WorkOrder está completado y tiene solución, crear FailureSolution
          if (workOrder.status === 'COMPLETED' && parsedNotes.solution) {
            // Buscar el appliedById
            let appliedById = parsedNotes.appliedById;
            if (!appliedById && parsedNotes.appliedBy) {
              // Intentar buscar usuario por nombre
              const user = await prisma.user.findFirst({
                where: { name: parsedNotes.appliedBy }
              });
              appliedById = user?.id || reportedBy;
            }
            if (!appliedById) {
              appliedById = workOrder.assignedToId || reportedBy;
            }

            const solution = await prisma.failureSolution.create({
              data: {
                occurrenceId: occurrence.id,
                title: parsedNotes.solutionTitle || `Solución para: ${workOrder.title}`,
                description: parsedNotes.solution,
                appliedById: appliedById,
                appliedAt: parsedNotes.appliedDate
                  ? new Date(parsedNotes.appliedDate)
                  : workOrder.completedDate || new Date(),
                actualHours: parsedNotes.actualHours || workOrder.actualHours || null,
                timeUnit: parsedNotes.solutionTimeUnit || 'hours',
                toolsUsed: parsedNotes.toolsUsed || null,
                sparePartsUsed: parsedNotes.sparePartsUsed || null,
                rootCause: parsedNotes.rootCause || null,
                preventiveActions: parsedNotes.preventiveActions || null,
                effectiveness: parsedNotes.effectiveness || null,
                isPreferred: true, // Primera solución siempre preferida
              }
            });

            console.log(`   ✅ FailureSolution creada: #${solution.id}`);
            solutionsCreated++;
          }
        }
      } catch (error) {
        console.error(`   ❌ Error procesando WorkOrder #${workOrder.id}:`, error);
        errors++;
      }
    }

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📊 RESUMEN DE MIGRACIÓN:');
    console.log(`   Total procesados: ${correctiveWorkOrders.length}`);
    console.log(`   FailureOccurrences ${DRY_RUN ? 'a crear' : 'creados'}: ${occurrencesCreated}`);
    console.log(`   FailureSolutions ${DRY_RUN ? 'a crear' : 'creadas'}: ${solutionsCreated}`);
    console.log(`   Errores: ${errors}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    if (DRY_RUN) {
      console.log('ℹ️  Este fue un DRY RUN. Para ejecutar la migración real, ejecuta sin --dry-run');
    }

  } catch (error) {
    console.error('❌ Error durante la migración:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Ejecutar
migrateFailures()
  .then(() => {
    console.log('✅ Migración completada');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Migración fallida:', error);
    process.exit(1);
  });
