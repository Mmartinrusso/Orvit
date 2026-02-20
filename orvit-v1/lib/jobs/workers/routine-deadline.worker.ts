/**
 * Routine Deadline Worker
 * Verifica si un ítem de rutina fue respondido antes del deadline
 * y envía notificaciones si no fue respondido a tiempo.
 */

import { Job } from 'bullmq';
import { createWorker, QUEUE_NAMES } from '../queue-manager';
import { prisma } from '@/lib/prisma';
import { createAndSendInstantNotification } from '@/lib/instant-notifications';
import { sendNotificationToSector } from '@/lib/discord/notifications';

interface RoutineDeadlineJobData {
  draftId: number;
  itemId: string;
  itemDescription: string;
  operatorUserId: number;
  companyId: number;
  sectorId: number | null;
}

async function processRoutineDeadline(job: Job<RoutineDeadlineJobData>) {
  const { draftId, itemId, itemDescription, operatorUserId, companyId, sectorId } = job.data;

  // Verificar si el draft sigue activo
  const draft = await prisma.productionRoutine.findUnique({
    where: { id: draftId },
    select: { status: true, responses: true },
  });

  // Si el draft fue completado o eliminado, no notificar
  if (!draft || draft.status !== 'DRAFT') return;

  // Verificar si el ítem fue respondido
  const responses = (draft.responses as any[]) || [];
  const itemResponse = responses.find((r: any) => r.itemId === itemId);
  const isAnswered = itemResponse?.inputs?.some(
    (inp: any) => inp.value !== null && inp.value !== undefined && inp.value !== ''
  );

  // Si ya fue respondido, no notificar
  if (isAnswered) return;

  const title = '⏰ Recordatorio de rutina';
  const message = `No completaste "${itemDescription}" antes del tiempo límite`;

  // Notificación in-app + Discord DM al operario
  await createAndSendInstantNotification(
    'RUTINA_RECORDATORIO',
    operatorUserId,
    companyId,
    null,
    null,
    title,
    message,
    'high',
    { draftId, itemId }
  );

  // Notificación al canal del sector (si tiene sector configurado)
  if (sectorId) {
    try {
      await sendNotificationToSector(sectorId, {
        title: '⏰ Ítem de rutina sin responder',
        description: `El ítem **"${itemDescription}"** no fue completado a tiempo en la rutina (borrador #${draftId})`,
        color: 0xf59e0b,
      });
    } catch (sectorErr) {
      console.warn('[RoutineDeadline] Error enviando notificación al sector:', sectorErr);
    }
  }
}

export function startRoutineDeadlineWorker() {
  return createWorker<RoutineDeadlineJobData>(
    QUEUE_NAMES.ROUTINE_DEADLINES,
    processRoutineDeadline,
    { concurrency: 10 }
  );
}
