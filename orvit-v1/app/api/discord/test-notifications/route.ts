/**
 * API: /api/discord/test-notifications
 *
 * POST - Probar notificaciones de Discord
 *
 * Body:
 * - type: 'all' | 'failure' | 'ot' | 'sla' | 'downtime' | 'recurrence' | 'day-start' | 'summary'
 * - sectorId: número (opcional, si no se pasa usa el primero configurado)
 */

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import {
  isBotReady,
  connectBot,
  notifyNewFailure,
  notifyFailureResolved,
  notifyP1ToSectorTechnicians,
  notifyOTCreated,
  notifyOTAssigned,
  notifyOTCompleted,
  notifySLAAtRisk,
  notifySLABreached,
  notifyUnassignedFailure,
  notifyRecurrence,
  notifyDowntimeStart,
  notifyDowntimeEnd,
  notifyPriorityEscalated,
  notifyDayStart,
  notifySectorDayStart,
  sendDailySummary,
} from '@/lib/discord';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    // 1. Verificar autenticación
    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;

    if (!token) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }

    const payload = await verifyToken(token);
    if (!payload || !payload.companyId) {
      return NextResponse.json({ error: 'Token inválido' }, { status: 401 });
    }

    const companyId = payload.companyId as number;
    const userId = payload.userId as number;
    const body = await request.json().catch(() => ({}));
    const testType = body.type || 'all';

    // 2. Obtener usuario actual
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, discordUserId: true }
    });

    // 3. Obtener un sector con Discord configurado
    let sectorId = body.sectorId;
    let sector;

    if (!sectorId) {
      sector = await prisma.sector.findFirst({
        where: {
          companyId,
          OR: [
            { discordFallasChannelId: { not: null } },
            { discordFallasWebhook: { not: null } }
          ]
        },
        select: { id: true, name: true }
      });
      sectorId = sector?.id;
    } else {
      sector = await prisma.sector.findUnique({
        where: { id: sectorId },
        select: { id: true, name: true }
      });
    }

    if (!sectorId || !sector) {
      return NextResponse.json({
        error: 'No hay sectores con Discord configurado',
        help: 'Configura al menos un webhook o channelId de Discord en un sector'
      }, { status: 400 });
    }

    // 4. Verificar que el bot esté conectado
    if (!isBotReady()) {
      const company = await prisma.company.findUnique({
        where: { id: companyId },
        select: { discordBotToken: true }
      });

      if (company?.discordBotToken) {
        const connectResult = await connectBot(company.discordBotToken);
        if (!connectResult.success) {
          return NextResponse.json({
            error: `Bot no conectado: ${connectResult.error}`,
            help: 'Verifica que el token del bot sea correcto'
          }, { status: 400 });
        }
      }
    }

    const results: Record<string, { success: boolean; error?: string }> = {};

    // 5. Ejecutar pruebas según el tipo
    const now = new Date();

    // ========== FALLAS ==========
    if (testType === 'all' || testType === 'failure') {
      // Nueva falla
      try {
        await notifyNewFailure({
          failureId: 9999,
          title: '[TEST] Falla de prueba',
          machineName: 'Máquina Test #1',
          sectorId,
          category: 'ELECTRICA',
          priority: 'P2',
          reportedBy: user?.name || 'Usuario Test',
          causedDowntime: false,
          description: 'Esta es una falla de prueba para verificar notificaciones'
        });
        results['notifyNewFailure'] = { success: true };
      } catch (e: any) {
        results['notifyNewFailure'] = { success: false, error: e.message };
      }

      // Falla resuelta
      try {
        await notifyFailureResolved({
          failureId: 9999,
          title: '[TEST] Falla resuelta',
          machineName: 'Máquina Test #1',
          sectorId,
          resolvedBy: user?.name || 'Técnico Test',
          resolutionMinutes: 45,
          solution: 'Se reemplazó componente defectuoso'
        });
        results['notifyFailureResolved'] = { success: true };
      } catch (e: any) {
        results['notifyFailureResolved'] = { success: false, error: e.message };
      }

      // P1 a técnicos (solo si el usuario tiene Discord)
      if (user?.discordUserId) {
        try {
          await notifyP1ToSectorTechnicians({
            failureId: 9998,
            title: '[TEST] Falla P1 Crítica',
            machineName: 'Máquina Crítica #1',
            sectorId,
            category: 'MECANICA',
            description: 'Prueba de alerta P1 a técnicos del sector',
            technicianUserIds: [userId]
          });
          results['notifyP1ToSectorTechnicians'] = { success: true };
        } catch (e: any) {
          results['notifyP1ToSectorTechnicians'] = { success: false, error: e.message };
        }
      }
    }

    // ========== ÓRDENES DE TRABAJO ==========
    if (testType === 'all' || testType === 'ot') {
      // OT Creada
      try {
        await notifyOTCreated({
          workOrderId: 9999,
          title: '[TEST] OT de prueba',
          machineName: 'Máquina Test #1',
          sectorId,
          type: 'CORRECTIVE',
          priority: 'P2',
          originFailureId: 9999
        });
        results['notifyOTCreated'] = { success: true };
      } catch (e: any) {
        results['notifyOTCreated'] = { success: false, error: e.message };
      }

      // OT Asignada (DM al usuario si tiene Discord)
      try {
        await notifyOTAssigned({
          workOrderId: 9999,
          title: '[TEST] OT asignada',
          machineName: 'Máquina Test #1',
          sectorId,
          priority: 'P2',
          assignedTo: user?.name || 'Técnico Test',
          assignedToId: userId,
          slaHours: 24,
          description: 'Prueba de asignación de OT'
        });
        results['notifyOTAssigned'] = { success: true };
      } catch (e: any) {
        results['notifyOTAssigned'] = { success: false, error: e.message };
      }

      // OT Completada
      try {
        await notifyOTCompleted({
          workOrderId: 9999,
          title: '[TEST] OT completada',
          machineName: 'Máquina Test #1',
          sectorId,
          completedBy: user?.name || 'Técnico Test',
          durationMinutes: 120,
          diagnosis: 'Rodamiento desgastado',
          solution: 'Reemplazo de rodamiento'
        });
        results['notifyOTCompleted'] = { success: true };
      } catch (e: any) {
        results['notifyOTCompleted'] = { success: false, error: e.message };
      }
    }

    // ========== SLA ==========
    if (testType === 'all' || testType === 'sla') {
      // SLA en riesgo
      try {
        await notifySLAAtRisk({
          workOrderId: 9999,
          title: '[TEST] OT por vencer SLA',
          machineName: 'Máquina Test #1',
          sectorId,
          priority: 'P2',
          assignedTo: user?.name,
          assignedToId: userId,
          hoursRemaining: 2.5,
          slaDueAt: new Date(now.getTime() + 2.5 * 60 * 60 * 1000).toISOString()
        });
        results['notifySLAAtRisk'] = { success: true };
      } catch (e: any) {
        results['notifySLAAtRisk'] = { success: false, error: e.message };
      }

      // SLA Vencido
      try {
        await notifySLABreached({
          workOrderId: 9998,
          title: '[TEST] OT con SLA vencido',
          machineName: 'Máquina Test #2',
          sectorId,
          priority: 'P1',
          assignedTo: user?.name,
          assignedToId: userId,
          hoursOverdue: 3.5,
          slaDueAt: new Date(now.getTime() - 3.5 * 60 * 60 * 1000).toISOString()
        });
        results['notifySLABreached'] = { success: true };
      } catch (e: any) {
        results['notifySLABreached'] = { success: false, error: e.message };
      }

      // Falla sin asignar
      try {
        await notifyUnassignedFailure({
          failureId: 9997,
          title: '[TEST] Falla sin asignar',
          machineName: 'Máquina Test #3',
          sectorId,
          priority: 'P1',
          minutesSinceReport: 20,
          reportedBy: 'Operador Test'
        });
        results['notifyUnassignedFailure'] = { success: true };
      } catch (e: any) {
        results['notifyUnassignedFailure'] = { success: false, error: e.message };
      }
    }

    // ========== DOWNTIME ==========
    if (testType === 'all' || testType === 'downtime') {
      // Downtime inicio
      try {
        await notifyDowntimeStart({
          machineId: 9999,
          machineName: 'Máquina Test #1',
          sectorId,
          failureId: 9999,
          failureTitle: '[TEST] Falla que causó downtime',
          startedAt: now,
          cause: 'Falla eléctrica en motor principal'
        });
        results['notifyDowntimeStart'] = { success: true };
      } catch (e: any) {
        results['notifyDowntimeStart'] = { success: false, error: e.message };
      }

      // Downtime fin
      try {
        await notifyDowntimeEnd({
          machineId: 9999,
          machineName: 'Máquina Test #1',
          sectorId,
          failureId: 9999,
          failureTitle: '[TEST] Falla resuelta',
          startedAt: new Date(now.getTime() - 2 * 60 * 60 * 1000),
          endedAt: now,
          durationMinutes: 120,
          cause: 'Falla eléctrica en motor principal'
        });
        results['notifyDowntimeEnd'] = { success: true };
      } catch (e: any) {
        results['notifyDowntimeEnd'] = { success: false, error: e.message };
      }

      // Escalamiento de prioridad
      try {
        await notifyPriorityEscalated({
          failureId: 9996,
          title: '[TEST] Falla escalada',
          machineName: 'Máquina Test #1',
          sectorId,
          previousPriority: 'P3',
          newPriority: 'P1',
          reason: 'Impacto en producción mayor al esperado',
          assignedTo: user?.name,
          assignedToId: userId
        });
        results['notifyPriorityEscalated'] = { success: true };
      } catch (e: any) {
        results['notifyPriorityEscalated'] = { success: false, error: e.message };
      }
    }

    // ========== REINCIDENCIA ==========
    if (testType === 'all' || testType === 'recurrence') {
      try {
        await notifyRecurrence({
          machineId: 9999,
          machineName: 'Máquina Test #1',
          sectorId,
          category: 'ELECTRICA',
          component: 'Motor Principal',
          occurrenceCount: 4,
          windowDays: 7,
          relatedFailureIds: [9999, 9998, 9997, 9996],
          latestFailureId: 9999,
          latestTitle: '[TEST] Falla recurrente'
        });
        results['notifyRecurrence'] = { success: true };
      } catch (e: any) {
        results['notifyRecurrence'] = { success: false, error: e.message };
      }
    }

    // ========== INICIO DEL DÍA ==========
    if (testType === 'all' || testType === 'day-start') {
      // DM Personal
      if (user?.discordUserId) {
        try {
          const result = await notifyDayStart({
            userId,
            userName: user.name.split(' ')[0],
            assignedOTs: [
              { id: 1042, title: 'Reparar motor', priority: 'P1', machineName: 'Torno CNC #3' },
              { id: 1038, title: 'Cambiar filtro', priority: 'P2', machineName: 'Fresadora #2' }
            ],
            preventives: [
              { id: 210, title: 'Lubricación', machineName: 'Compresor Principal' }
            ],
            overdueOTs: [
              { id: 1035, title: 'Revisar válvula', priority: 'P2', daysOverdue: 2 }
            ],
            sectorP1Count: 1,
            sectorName: sector.name
          });
          results['notifyDayStart'] = result;
        } catch (e: any) {
          results['notifyDayStart'] = { success: false, error: e.message };
        }
      } else {
        results['notifyDayStart'] = { success: false, error: 'Usuario sin Discord vinculado' };
      }

      // Canal de sector
      try {
        const result = await notifySectorDayStart({
          sectorId,
          sectorName: sector.name,
          date: now,
          assignmentsByTech: [
            {
              techName: 'Juan',
              techId: 1,
              ots: [
                { id: 1042, title: 'Reparar motor', priority: 'P1', machineName: 'Torno CNC #3' },
                { id: 1038, title: 'Cambiar filtro', priority: 'P2', machineName: 'Fresadora #2' }
              ],
              preventives: [
                { id: 210, title: 'Lubricación', machineName: 'Compresor Principal' }
              ]
            },
            {
              techName: 'Pedro',
              techId: 2,
              ots: [
                { id: 1045, title: 'Revisar bomba', priority: 'P3', machineName: 'Inyectora #5' }
              ],
              preventives: [
                { id: 215, title: 'Inspección', machineName: 'Bomba Hidráulica' },
                { id: 216, title: 'Calibración', machineName: 'Sensor Presión' }
              ]
            }
          ],
          unassignedOTs: [
            { id: 1050, title: 'Ruido anormal', priority: 'P2', machineName: 'Compresor #2' }
          ],
          overdueOTs: [
            { id: 1035, title: 'Válvula dañada', priority: 'P2', daysOverdue: 2, assignedTo: 'Juan' },
            { id: 1028, title: 'Fuga aceite', priority: 'P3', daysOverdue: 1, assignedTo: 'Pedro' }
          ],
          openP1Count: 1,
          stats: {
            totalOTs: 5,
            totalPreventives: 3,
            totalOverdue: 2
          }
        });
        results['notifySectorDayStart'] = result;
      } catch (e: any) {
        results['notifySectorDayStart'] = { success: false, error: e.message };
      }
    }

    // ========== RESUMEN DIARIO ==========
    if (testType === 'all' || testType === 'summary') {
      try {
        await sendDailySummary({
          sectorId,
          sectorName: sector.name,
          date: now,
          failures: {
            new: 3,
            resolved: 4,
            pending: 2,
            p1Open: 1
          },
          workOrders: {
            completed: 5,
            inProgress: 2,
            waiting: 1,
            created: 3
          },
          preventives: {
            scheduled: 4,
            completed: 3,
            complianceRate: 75
          },
          downtime: {
            totalMinutes: 200,
            incidents: 2,
            topMachine: 'Torno CNC #3'
          },
          pendingTomorrow: {
            failures: 2,
            preventives: 5,
            waitingParts: 1
          }
        });
        results['sendDailySummary'] = { success: true };
      } catch (e: any) {
        results['sendDailySummary'] = { success: false, error: e.message };
      }
    }

    // 6. Calcular estadísticas
    const total = Object.keys(results).length;
    const successful = Object.values(results).filter(r => r.success).length;
    const failed = total - successful;

    return NextResponse.json({
      success: failed === 0,
      summary: {
        total,
        successful,
        failed,
        sector: sector.name
      },
      results
    });

  } catch (error: any) {
    console.error('❌ Error en POST /api/discord/test-notifications:', error);
    return NextResponse.json(
      { error: error.message || 'Error al probar notificaciones' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  return NextResponse.json({
    message: 'Endpoint de prueba de notificaciones Discord',
    usage: {
      method: 'POST',
      body: {
        type: 'all | failure | ot | sla | downtime | recurrence | day-start | summary',
        sectorId: '(opcional) ID del sector a usar'
      }
    },
    examples: [
      { description: 'Probar todas', body: { type: 'all' } },
      { description: 'Solo fallas', body: { type: 'failure' } },
      { description: 'Solo inicio del día', body: { type: 'day-start' } }
    ]
  });
}
