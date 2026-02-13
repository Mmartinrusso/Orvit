import { prismaUnfiltered } from '@/lib/prisma';
import { deleteS3Files } from '@/lib/s3-utils';
import { loggers } from '@/lib/logger';

// Período de retención en días antes de la purga permanente
const RETENTION_DAYS = 90;

const logger = loggers.database;

/**
 * Purga automática de registros con soft delete.
 *
 * Busca registros con deletedAt > RETENTION_DAYS días,
 * elimina archivos de S3, registros hijos y finalmente los padres.
 *
 * Cada registro se purga dentro de una transacción para evitar
 * datos huérfanos si falla a mitad de proceso.
 *
 * Puede ser invocado desde un cron externo (Vercel Cron, etc.)
 * o manualmente desde /api/admin/soft-delete/purge.
 */
export async function purgeDeletedRecords(): Promise<{
  purged: Record<string, number>;
  errors: string[];
}> {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - RETENTION_DAYS);

  const purged: Record<string, number> = {
    workOrders: 0,
    tasks: 0,
    fixedTasks: 0,
    maintenanceChecklists: 0,
  };
  const errors: string[] = [];

  logger.info({ cutoffDate }, 'Iniciando purga de registros eliminados');

  // 1. Purgar WorkOrders
  try {
    const deletedWorkOrders = await prismaUnfiltered.workOrder.findMany({
      where: { deletedAt: { lt: cutoffDate, not: null } },
      select: {
        id: true,
        attachments: { select: { url: true } },
      },
    });

    for (const wo of deletedWorkOrders) {
      try {
        // Eliminar archivos de S3 fuera de la transacción (idempotente)
        const urls = wo.attachments.map((a) => a.url).filter(Boolean);
        if (urls.length > 0) {
          try {
            await deleteS3Files(urls);
          } catch (s3Error) {
            logger.warn({ err: s3Error, workOrderId: wo.id }, 'Error eliminando archivos S3, continuando con purga de BD');
          }
        }

        // Eliminar registros hijos y padre en una transacción
        await prismaUnfiltered.$transaction(async (tx) => {
          await tx.workOrderAttachment.deleteMany({ where: { workOrderId: wo.id } });
          await tx.workOrderComment.deleteMany({ where: { workOrderId: wo.id } });
          await tx.workOrder.delete({ where: { id: wo.id } });
        });
        purged.workOrders++;
      } catch (err) {
        errors.push(`WorkOrder ${wo.id}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
  } catch (err) {
    errors.push(`WorkOrders query: ${err instanceof Error ? err.message : String(err)}`);
  }

  // 2. Purgar Tasks
  try {
    const deletedTasks = await prismaUnfiltered.task.findMany({
      where: { deletedAt: { lt: cutoffDate, not: null } },
      select: {
        id: true,
        attachments: { select: { url: true } },
      },
    });

    for (const task of deletedTasks) {
      try {
        // Eliminar archivos de S3 fuera de la transacción (idempotente)
        const urls = task.attachments.map((a) => a.url).filter(Boolean);
        if (urls.length > 0) {
          try {
            await deleteS3Files(urls);
          } catch (s3Error) {
            logger.warn({ err: s3Error, taskId: task.id }, 'Error eliminando archivos S3, continuando con purga de BD');
          }
        }

        // Eliminar registros hijos y padre en una transacción
        await prismaUnfiltered.$transaction(async (tx) => {
          await tx.taskComment.deleteMany({ where: { taskId: task.id } });
          await tx.taskAttachment.deleteMany({ where: { taskId: task.id } });
          await tx.subtask.deleteMany({ where: { taskId: task.id } });

          // Eliminar notificaciones relacionadas
          try {
            await tx.$executeRaw`
              DELETE FROM "Notification"
              WHERE "metadata"->>'taskId' = ${task.id.toString()}
            `;
          } catch {
            // Ignorar error de notificaciones (tabla puede no existir)
          }

          await tx.task.delete({ where: { id: task.id } });
        });
        purged.tasks++;
      } catch (err) {
        errors.push(`Task ${task.id}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
  } catch (err) {
    errors.push(`Tasks query: ${err instanceof Error ? err.message : String(err)}`);
  }

  // 3. Purgar FixedTasks
  try {
    const deletedFixedTasks = await prismaUnfiltered.fixedTask.findMany({
      where: { deletedAt: { lt: cutoffDate, not: null } },
      select: { id: true },
    });

    for (const ft of deletedFixedTasks) {
      try {
        await prismaUnfiltered.$transaction(async (tx) => {
          // Eliminar registros hijos
          await tx.fixedTaskExecution.deleteMany({ where: { fixedTaskId: ft.id } });
          await tx.fixedTaskInstructive.deleteMany({ where: { fixedTaskId: ft.id } });

          // Eliminar notificaciones relacionadas
          try {
            await tx.$executeRaw`
              DELETE FROM "Notification"
              WHERE "metadata"->>'taskId' = ${ft.id.toString()}
                OR ("type" = 'TASK_AUTO_RESET' AND "metadata"->>'fixedTaskId' = ${ft.id.toString()})
            `;
          } catch {
            // Ignorar error de notificaciones
          }

          // Eliminar el registro padre
          await tx.fixedTask.delete({ where: { id: ft.id } });
        });
        purged.fixedTasks++;
      } catch (err) {
        errors.push(`FixedTask ${ft.id}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
  } catch (err) {
    errors.push(`FixedTasks query: ${err instanceof Error ? err.message : String(err)}`);
  }

  // 4. Purgar MaintenanceChecklists
  try {
    const deletedChecklists = await prismaUnfiltered.maintenanceChecklist.findMany({
      where: { deletedAt: { lt: cutoffDate, not: null } },
      select: { id: true },
    });

    for (const cl of deletedChecklists) {
      try {
        await prismaUnfiltered.$transaction(async (tx) => {
          // Eliminar ejecuciones del historial
          await tx.checklistExecution.deleteMany({ where: { checklistId: cl.id } });
          // Eliminar el registro padre
          await tx.maintenanceChecklist.delete({ where: { id: cl.id } });
        });
        purged.maintenanceChecklists++;
      } catch (err) {
        errors.push(`MaintenanceChecklist ${cl.id}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
  } catch (err) {
    errors.push(`MaintenanceChecklists query: ${err instanceof Error ? err.message : String(err)}`);
  }

  logger.info({ purged, errorsCount: errors.length }, 'Purga de registros completada');

  return { purged, errors };
}
