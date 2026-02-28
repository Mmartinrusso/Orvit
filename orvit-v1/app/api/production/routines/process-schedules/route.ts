import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { sendNotificationViaBotService } from '@/lib/discord/bot-service-client';

export const dynamic = 'force-dynamic';

/**
 * POST /api/production/routines/process-schedules
 * Closes all DRAFT routines that match their template's scheduleConfig.
 * Called by a cron job (or manually via admin trigger).
 * Accepts an optional `secret` header for security.
 */
export async function POST(request: Request) {
  try {
    // Basic cron auth: check for secret header
    const cronSecret = request.headers.get('x-cron-secret');
    if (process.env.CRON_SECRET && cronSecret !== process.env.CRON_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const now = new Date();
    const currentDay = now.getDay(); // 0=Sun, 1=Mon, ..., 6=Sat
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();
    const currentTimeStr = `${String(currentHour).padStart(2, '0')}:${String(currentMinute).padStart(2, '0')}`;

    // Get all active templates with scheduleConfig
    const allTemplates = await prisma.productionRoutineTemplate.findMany({
      where: { isActive: true },
      select: { id: true, name: true, items: true, sectorId: true, companyId: true },
    });

    // Filter to templates with a valid scheduleConfig and matching schedule
    const templatesWithSchedule = allTemplates.filter((t) => {
      const itemsData = t.items as any;
      const sc = itemsData?.scheduleConfig;
      if (!sc?.enabled || !sc?.resetTime) return false;

      // Check time matches (within a 5-minute window)
      const [schedHour, schedMin] = sc.resetTime.split(':').map(Number);
      const schedTotalMin = schedHour * 60 + schedMin;
      const currentTotalMin = currentHour * 60 + currentMinute;
      if (Math.abs(currentTotalMin - schedTotalMin) > 5) return false;

      // Check day matches
      if (sc.resetType === 'WEEKLY') {
        const allowedDays: number[] = sc.daysOfWeek || [];
        if (!allowedDays.includes(currentDay)) return false;
      }
      // DAILY: always matches if time matches

      return true;
    });

    if (templatesWithSchedule.length === 0) {
      return NextResponse.json({ success: true, closed: 0, message: 'No schedules triggered' });
    }

    let closedCount = 0;
    const results: { templateId: number; templateName: string; closed: number }[] = [];

    for (const template of templatesWithSchedule) {
      const itemsData = template.items as any;
      const sc = itemsData?.scheduleConfig;
      const allItems: any[] = itemsData?.items || [];

      // Find all DRAFT executions for this template
      const openDrafts = await prisma.productionRoutine.findMany({
        where: {
          templateId: template.id,
          status: 'DRAFT',
          companyId: template.companyId,
        },
        include: {
          executedBy: { select: { id: true, name: true } },
        },
      });

      if (openDrafts.length === 0) {
        results.push({ templateId: template.id, templateName: template.name, closed: 0 });
        continue;
      }

      // Close each draft as INCOMPLETE
      for (const draft of openDrafts) {
        const responses: any[] = (draft.responses as any) || [];
        const answeredIds = new Set(responses.filter((r) => r.value !== undefined && r.value !== null && r.value !== '').map((r) => r.itemId));
        const requiredItems = allItems.filter((item: any) => item.required);
        const missingItems = requiredItems.filter((item: any) => !answeredIds.has(item.id));

        // Mark as INCOMPLETE
        await prisma.productionRoutine.update({
          where: { id: draft.id },
          data: {
            status: 'INCOMPLETE',
            executedAt: now,
            issueDescription: missingItems.length > 0
              ? `Cierre automático. Ítems sin completar: ${missingItems.map((i: any) => i.question || i.id).join(', ')}`
              : 'Cierre automático por horario de reseteo.',
          },
        });

        closedCount++;

        // Send Discord notification if configured
        if (sc?.notifyIncomplete && template.sectorId && missingItems.length > 0) {
          const fields = missingItems.slice(0, 10).map((item: any, idx: number) => ({
            name: `${idx + 1}. ${item.question || 'Sin nombre'}`,
            value: item.required ? '🔴 Obligatorio' : '⚪ Opcional',
            inline: true,
          }));

          await sendNotificationViaBotService(
            template.sectorId,
            'ROUTINE_INCOMPLETE',
            {
              title: `⚠️ Rutina cerrada incompleta: ${template.name}`,
              description: `La rutina fue cerrada automáticamente a las ${currentTimeStr}.\n**Operario:** ${draft.executedBy?.name || 'Desconocido'}\n**Ítems sin completar:** ${missingItems.length}`,
              color: 0xf59e0b,
              fields,
            }
          ).catch(() => { /* Ignore Discord errors */ });
        }
      }

      results.push({ templateId: template.id, templateName: template.name, closed: openDrafts.length });
    }

    return NextResponse.json({
      success: true,
      closed: closedCount,
      templates: results,
      timestamp: now.toISOString(),
    });
  } catch (error) {
    console.error('Error processing routine schedules:', error);
    return NextResponse.json(
      { success: false, error: 'Error al procesar horarios de rutinas' },
      { status: 500 }
    );
  }
}
