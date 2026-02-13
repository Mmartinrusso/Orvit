/**
 * API: /api/cron/discord-day-start
 *
 * POST/GET - Enviar resumen de inicio del día
 * Programar para ejecutar a las 06:00 ART (09:00 UTC) de lunes a viernes
 *
 * Envía:
 * 1. DM personal a cada técnico con su agenda
 * 2. Mensaje al canal de cada sector con resumen completo
 *
 * Contenido:
 * - OTs asignadas para hoy
 * - Preventivos programados
 * - OTs vencidas
 * - P1 abiertas
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { notifyDayStart, notifySectorDayStart, isBotReady, connectBot } from '@/lib/discord';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    // Verificar token de cron (opcional)
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      if (process.env.NODE_ENV === 'production') {
        return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
      }
    }

    // Auto-conectar el bot si no está listo
    if (!isBotReady()) {
      // Buscar una empresa con token de bot configurado
      const companyWithBot = await prisma.company.findFirst({
        where: { discordBotToken: { not: null } },
        select: { discordBotToken: true }
      });

      if (companyWithBot?.discordBotToken) {
        console.log('🔄 Auto-conectando bot de Discord...');
        const connectResult = await connectBot(companyWithBot.discordBotToken);
        if (!connectResult.success) {
          return NextResponse.json({
            success: false,
            message: `Bot no pudo conectarse: ${connectResult.error}`,
            sent: 0
          });
        }
        console.log('✅ Bot conectado automáticamente');
      } else {
        return NextResponse.json({
          success: false,
          message: 'No hay token de bot configurado',
          sent: 0
        });
      }
    }

    const now = new Date();
    const today = new Date(now);
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Obtener todos los usuarios con Discord vinculado que tienen rol de técnico
    const technicians = await prisma.user.findMany({
      where: {
        discordUserId: { not: null },
        isActive: true,
        companies: {
          some: {
            role: {
              OR: [
                { name: { contains: 'Técnico', mode: 'insensitive' } },
                { name: { contains: 'Tecnico', mode: 'insensitive' } },
                { name: { contains: 'Mantenimiento', mode: 'insensitive' } },
                { name: { contains: 'Operador', mode: 'insensitive' } }
              ]
            }
          }
        }
      },
      select: {
        id: true,
        name: true,
        discordUserId: true,
        companies: {
          select: {
            companyId: true,
            company: { select: { name: true } }
          }
        },
        // Máquinas donde es técnico referente (para saber sus sectores)
        machinesTechnical: {
          select: {
            sectorId: true,
            sector: { select: { id: true, name: true } }
          },
          where: { sectorId: { not: null } }
        }
      }
    });

    if (technicians.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No hay técnicos con Discord vinculado',
        sent: 0
      });
    }

    const results: Array<{
      userId: number;
      userName: string;
      success: boolean;
      error?: string;
      itemCount?: number;
    }> = [];

    for (const tech of technicians) {
      try {
        // Obtener companyId del técnico (usar el primero si tiene varios)
        const companyId = tech.companies[0]?.companyId;
        if (!companyId) continue;

        // Obtener sectores donde es técnico referente (de sus máquinas asignadas)
        const uniqueSectors = new Map<number, { id: number; name: string }>();
        for (const m of tech.machinesTechnical) {
          if (m.sector && !uniqueSectors.has(m.sector.id)) {
            uniqueSectors.set(m.sector.id, m.sector);
          }
        }
        const techSectors = Array.from(uniqueSectors.values());
        const sectorIds = techSectors.map(s => s.id);

        // 1. OTs asignadas al técnico (para hoy o pendientes)
        const assignedOTs = await prisma.workOrder.findMany({
          where: {
            assignedToId: tech.id,
            status: { in: ['PENDING', 'SCHEDULED', 'IN_PROGRESS', 'WAITING'] },
            OR: [
              { scheduledDate: { gte: today, lt: tomorrow } }, // Programadas hoy
              { scheduledDate: null }, // Sin fecha (pendientes)
              { scheduledDate: { lt: today } } // Atrasadas
            ]
          },
          select: {
            id: true,
            title: true,
            priority: true,
            scheduledDate: true,
            machine: { select: { name: true } }
          },
          orderBy: [
            { priority: 'asc' }, // P1 primero
            { scheduledDate: 'asc' }
          ],
          take: 10
        });

        // Separar vencidas de las del día
        const overdueOTs = assignedOTs
          .filter(ot => ot.scheduledDate && ot.scheduledDate < today)
          .map(ot => ({
            id: ot.id,
            title: ot.title,
            priority: ot.priority,
            daysOverdue: Math.ceil((today.getTime() - new Date(ot.scheduledDate!).getTime()) / (1000 * 60 * 60 * 24))
          }));

        const todayOTs = assignedOTs
          .filter(ot => !ot.scheduledDate || ot.scheduledDate >= today)
          .map(ot => ({
            id: ot.id,
            title: ot.title,
            priority: ot.priority,
            machineName: ot.machine?.name,
            scheduledDate: ot.scheduledDate || undefined
          }));

        // 2. Preventivos programados para hoy
        let preventives: Array<{ id: number; title: string; machineName: string; scheduledDate?: Date }> = [];
        try {
          const schedules = await prisma.preventiveSchedule.findMany({
            where: {
              companyId,
              scheduledDate: { gte: today, lt: tomorrow },
              status: { in: ['PENDING', 'SCHEDULED'] },
              template: {
                assignedToId: tech.id
              }
            },
            select: {
              id: true,
              scheduledDate: true,
              template: {
                select: {
                  title: true,
                  machine: { select: { name: true } }
                }
              }
            },
            take: 10
          });

          preventives = schedules.map(s => ({
            id: s.id,
            title: s.template.title,
            machineName: s.template.machine?.name || 'Sin máquina',
            scheduledDate: s.scheduledDate
          }));
        } catch {
          // Si falla (tabla no existe), ignorar
        }

        // 3. Contar P1 abiertas en los sectores del técnico
        let sectorP1Count = 0;
        const sectorName = techSectors[0]?.name;

        if (sectorIds.length > 0) {
          sectorP1Count = await prisma.failureOccurrence.count({
            where: {
              companyId,
              priority: 'P1',
              status: { in: ['OPEN', 'REPORTED', 'IN_PROGRESS'] },
              machine: { sectorId: { in: sectorIds } }
            }
          });
        } else {
          // Sin sectores asignados, contar todas las P1 de la empresa
          sectorP1Count = await prisma.failureOccurrence.count({
            where: {
              companyId,
              priority: 'P1',
              status: { in: ['OPEN', 'REPORTED', 'IN_PROGRESS'] }
            }
          });
        }

        // 4. Enviar DM
        const result = await notifyDayStart({
          userId: tech.id,
          userName: tech.name.split(' ')[0], // Solo primer nombre
          assignedOTs: todayOTs,
          preventives,
          overdueOTs,
          sectorP1Count,
          sectorName
        });

        const itemCount = todayOTs.length + preventives.length + overdueOTs.length;

        results.push({
          userId: tech.id,
          userName: tech.name,
          success: result.success,
          error: result.error,
          itemCount
        });

      } catch (techError: any) {
        results.push({
          userId: tech.id,
          userName: tech.name,
          success: false,
          error: techError?.message || 'Error desconocido'
        });
      }
    }

    const sentCount = results.filter(r => r.success && (r.itemCount || 0) > 0).length;
    const skippedCount = results.filter(r => r.success && (r.itemCount || 0) === 0).length;
    const failedCount = results.filter(r => !r.success).length;

    console.log(`📌 Day Start DMs: ${sentCount} enviados, ${skippedCount} sin contenido, ${failedCount} errores`);

    // =========================================================================
    // PARTE 2: Enviar resumen al canal de cada sector
    // =========================================================================

    const sectorResults: Array<{
      sectorId: number;
      sectorName: string;
      success: boolean;
      error?: string;
    }> = [];

    // Obtener todos los sectores con canal de Discord configurado
    const sectors = await prisma.sector.findMany({
      where: {
        OR: [
          { discordResumenChannelId: { not: null } },
          { discordResumenDiaWebhook: { not: null } }
        ]
      },
      select: {
        id: true,
        name: true,
        companyId: true
      }
    });

    for (const sector of sectors) {
      try {
        // 1. OTs del sector agrupadas por técnico asignado
        const sectorOTs = await prisma.workOrder.findMany({
          where: {
            sectorId: sector.id,
            status: { in: ['PENDING', 'SCHEDULED', 'IN_PROGRESS', 'WAITING'] },
            OR: [
              { scheduledDate: { gte: today, lt: tomorrow } },
              { scheduledDate: null },
              { scheduledDate: { lt: today } }
            ]
          },
          select: {
            id: true,
            title: true,
            priority: true,
            scheduledDate: true,
            assignedToId: true,
            assignedTo: { select: { id: true, name: true } },
            machine: { select: { name: true } }
          },
          orderBy: [{ priority: 'asc' }, { scheduledDate: 'asc' }]
        });

        // Separar vencidas
        const overdueOTs = sectorOTs
          .filter(ot => ot.scheduledDate && ot.scheduledDate < today)
          .map(ot => ({
            id: ot.id,
            title: ot.title,
            priority: ot.priority || 'P3',
            daysOverdue: Math.ceil((today.getTime() - new Date(ot.scheduledDate!).getTime()) / (1000 * 60 * 60 * 24)),
            assignedTo: ot.assignedTo?.name
          }));

        // OTs sin asignar
        const unassignedOTs = sectorOTs
          .filter(ot => !ot.assignedToId && (!ot.scheduledDate || ot.scheduledDate >= today))
          .map(ot => ({
            id: ot.id,
            title: ot.title,
            priority: ot.priority || 'P3',
            machineName: ot.machine?.name
          }));

        // Agrupar por técnico
        const byTech = new Map<number, {
          techName: string;
          techId: number;
          ots: Array<{ id: number; title: string; priority: string; machineName?: string }>;
          preventives: Array<{ id: number; title: string; machineName: string }>;
        }>();

        for (const ot of sectorOTs) {
          if (!ot.assignedToId || !ot.assignedTo) continue;
          if (ot.scheduledDate && ot.scheduledDate < today) continue; // Excluir vencidas

          if (!byTech.has(ot.assignedToId)) {
            byTech.set(ot.assignedToId, {
              techName: ot.assignedTo.name.split(' ')[0],
              techId: ot.assignedToId,
              ots: [],
              preventives: []
            });
          }

          byTech.get(ot.assignedToId)!.ots.push({
            id: ot.id,
            title: ot.title,
            priority: ot.priority || 'P3',
            machineName: ot.machine?.name
          });
        }

        // 2. Preventivos del sector para hoy
        let sectorPreventives: Array<{ id: number; title: string; machineName: string; assignedToId?: number }> = [];
        try {
          const prevSchedules = await prisma.preventiveSchedule.findMany({
            where: {
              companyId: sector.companyId,
              scheduledDate: { gte: today, lt: tomorrow },
              status: { in: ['PENDING', 'SCHEDULED'] },
              template: {
                machine: { sectorId: sector.id }
              }
            },
            select: {
              id: true,
              template: {
                select: {
                  title: true,
                  assignedToId: true,
                  machine: { select: { name: true } }
                }
              }
            }
          });

          sectorPreventives = prevSchedules.map(s => ({
            id: s.id,
            title: s.template.title,
            machineName: s.template.machine?.name || 'Sin máquina',
            assignedToId: s.template.assignedToId || undefined
          }));

          // Agregar preventivos a cada técnico
          for (const prev of sectorPreventives) {
            if (prev.assignedToId && byTech.has(prev.assignedToId)) {
              byTech.get(prev.assignedToId)!.preventives.push({
                id: prev.id,
                title: prev.title,
                machineName: prev.machineName
              });
            }
          }
        } catch {
          // Ignorar si no existe tabla
        }

        // 3. P1 abiertas en el sector
        const openP1Count = await prisma.failureOccurrence.count({
          where: {
            companyId: sector.companyId,
            priority: 'P1',
            status: { in: ['OPEN', 'REPORTED', 'IN_PROGRESS'] },
            machine: { sectorId: sector.id }
          }
        });

        // 4. Enviar al canal del sector
        const sectorResult = await notifySectorDayStart({
          sectorId: sector.id,
          sectorName: sector.name,
          date: today,
          assignmentsByTech: Array.from(byTech.values()),
          unassignedOTs,
          overdueOTs,
          openP1Count,
          stats: {
            totalOTs: sectorOTs.filter(ot => !ot.scheduledDate || ot.scheduledDate >= today).length,
            totalPreventives: sectorPreventives.length,
            totalOverdue: overdueOTs.length
          }
        });

        sectorResults.push({
          sectorId: sector.id,
          sectorName: sector.name,
          success: sectorResult.success,
          error: sectorResult.error
        });

      } catch (sectorError: any) {
        sectorResults.push({
          sectorId: sector.id,
          sectorName: sector.name,
          success: false,
          error: sectorError?.message || 'Error desconocido'
        });
      }
    }

    const sectorsSent = sectorResults.filter(r => r.success).length;
    const sectorsFailed = sectorResults.filter(r => !r.success).length;

    console.log(`📌 Day Start Canales: ${sectorsSent} sectores enviados, ${sectorsFailed} errores`);

    return NextResponse.json({
      success: true,
      timestamp: now.toISOString(),
      // DMs a técnicos
      technicians: {
        total: technicians.length,
        sent: sentCount,
        skipped: skippedCount,
        failed: failedCount,
        details: results
      },
      // Canales de sectores
      sectors: {
        total: sectors.length,
        sent: sectorsSent,
        failed: sectorsFailed,
        details: sectorResults
      }
    });

  } catch (error: any) {
    console.error('❌ Error en cron discord-day-start:', error);
    return NextResponse.json(
      { error: 'Error al enviar DMs de inicio del día', detail: error?.message },
      { status: 500 }
    );
  }
}

// GET para pruebas manuales
export async function GET(request: NextRequest) {
  return POST(request);
}
