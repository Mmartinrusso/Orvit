/**
 * API: /api/cron/waiting-eta-check
 *
 * GET - Verificar ETAs vencidas de órdenes en espera
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

/**
 * GET /api/cron/waiting-eta-check
 * Verifica ETAs vencidas de órdenes en espera
 */
export async function GET(request: NextRequest) {
  try {
    console.log('🕐 Ejecutando waiting ETA check...');

    const now = new Date();

    // 1. Buscar órdenes en espera con ETA vencida
    const overdueOrders = await prisma.workOrder.findMany({
      where: {
        status: 'WAITING',
        waitingETA: { lt: now }
      },
      select: {
        id: true,
        title: true,
        priority: true,
        waitingReason: true,
        waitingDescription: true,
        waitingETA: true,
        waitingSince: true,
        companyId: true,
        assignedToId: true,
        assignedTo: {
          select: { id: true, name: true, email: true }
        },
        company: {
          select: { id: true, name: true }
        }
      }
    });

    // 2. Calcular tiempo vencido
    const results = overdueOrders.map(order => {
      const overdueHours = (now.getTime() - new Date(order.waitingETA!).getTime()) / (1000 * 60 * 60);
      const waitingHours = order.waitingSince
        ? (now.getTime() - new Date(order.waitingSince).getTime()) / (1000 * 60 * 60)
        : 0;

      return {
        workOrderId: order.id,
        title: order.title,
        priority: order.priority,
        waitingReason: order.waitingReason,
        waitingDescription: order.waitingDescription,
        waitingETA: order.waitingETA,
        overdueHours: Math.round(overdueHours * 10) / 10,
        totalWaitingHours: Math.round(waitingHours * 10) / 10,
        company: order.company,
        assignedTo: order.assignedTo
      };
    });

    // 3. Agrupar por empresa
    const byCompany = results.reduce((acc, r) => {
      const key = r.company.id;
      if (!acc[key]) {
        acc[key] = {
          company: r.company,
          orders: []
        };
      }
      acc[key].orders.push(r);
      return acc;
    }, {} as Record<number, { company: any; orders: any[] }>);

    // Crear notificaciones para ETAs vencidas (anti-spam: 1 por OT cada 4 horas)
    for (const result of results) {
      const recentNotif = await prisma.notification.findFirst({
        where: {
          type: 'work_order_due_soon',
          metadata: { string_contains: `"workOrderId":${result.workOrderId}` },
          createdAt: { gte: new Date(now.getTime() - 4 * 60 * 60 * 1000) }
        }
      });
      if (recentNotif) continue;

      const recipients: number[] = [];
      if (result.assignedTo?.id) recipients.push(result.assignedTo.id);

      for (const userId of recipients) {
        await prisma.notification.create({
          data: {
            userId,
            type: 'work_order_due_soon',
            title: `ETA vencida hace ${result.overdueHours}h`,
            message: `OT #${result.workOrderId}: "${result.title}" sigue en espera con ETA vencida`,
            metadata: JSON.stringify({ workOrderId: result.workOrderId, overdueHours: result.overdueHours }),
            isRead: false,
            companyId: result.company.id
          }
        });
      }
    }

    console.log(`✅ Waiting ETA check completado. ${results.length} ETAs vencidas encontradas.`);

    return NextResponse.json({
      success: true,
      timestamp: now.toISOString(),
      totalOverdue: results.length,
      byCompany: Object.values(byCompany),
      details: results
    });

  } catch (error) {
    console.error('❌ Error en waiting ETA check:', error);
    return NextResponse.json(
      { error: 'Error en waiting ETA check' },
      { status: 500 }
    );
  }
}
