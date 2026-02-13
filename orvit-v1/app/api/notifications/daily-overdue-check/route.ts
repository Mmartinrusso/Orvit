import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

// POST /api/notifications/daily-overdue-check
export async function POST(request: NextRequest) {
  try {
    console.log('🔔 Iniciando verificación diaria de órdenes vencidas...');

    // Obtener todas las órdenes vencidas que no estén completadas o canceladas
    const now = new Date();
    const overdueOrders = await prisma.workOrder.findMany({
      where: {
        scheduledDate: {
          lt: now
        },
        status: {
          in: ['PENDING', 'IN_PROGRESS', 'ON_HOLD']
        },
        // Solo órdenes que tengan asignado alguien
        OR: [
          { assignedToId: { not: null } },
          { assignedWorkerId: { not: null } }
        ]
      },
      include: {
        assignedTo: {
          select: {
            id: true,
            name: true,
            email: true
          }
        },
        assignedWorker: {
          select: {
            id: true,
            name: true,
            phone: true
          }
        },
        createdBy: {
          select: {
            id: true,
            name: true,
            email: true
          }
        },
        machine: {
          select: {
            id: true,
            name: true
          }
        },
        sector: {
          select: {
            id: true,
            name: true,
            area: {
              select: {
                name: true
              }
            }
          }
        },
        company: {
          select: {
            id: true,
            name: true
          }
        }
      }
    });

    // console.log(`📋 Encontradas ${overdueOrders.length} órdenes vencidas`) // Log reducido;

    const notificationsSent = [];

    for (const order of overdueOrders) {
      if (!order.scheduledDate) continue; // Skip orders without scheduled date
      
      const daysOverdue = Math.ceil((now.getTime() - new Date(order.scheduledDate).getTime()) / (1000 * 60 * 60 * 24));
      
      // Determinar quién es el asignado
      let assignedUser = null;
      let assignedType = '';

      if (order.assignedToId && order.assignedTo) {
        assignedUser = order.assignedTo;
        assignedType = 'Usuario';
      } else if (order.assignedWorkerId && order.assignedWorker) {
        // Para operarios, crear un objeto similar al usuario
        assignedUser = {
          id: order.assignedWorker.id,
          name: order.assignedWorker.name,
          email: null // Los operarios no tienen email en el sistema
        };
        assignedType = 'Operario';
      }

      if (!assignedUser) {
        console.log(`⚠️ Orden ${order.id} vencida pero sin asignado específico`);
        continue;
      }

      // Información del solicitante
      const requesterInfo = order.createdBy 
        ? `${order.createdBy.name} (${order.createdBy.email})`
        : 'Usuario no disponible';

      // Información de ubicación
      const locationInfo = order.sector 
        ? `${order.sector.area.name} - ${order.sector.name}`
        : 'Ubicación no especificada';

      const machineInfo = order.machine 
        ? order.machine.name 
        : 'Sin máquina asignada';

      try {
        // Solo enviar notificación a usuarios del sistema (no a operarios por email)
        if (order.assignedToId && order.assignedTo) {
          await fetch(`${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/notifications`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              type: 'work_order_overdue',
              title: `⏰ Orden Vencida - Día ${daysOverdue}`,
              message: `La orden "${order.title}" está vencida ${daysOverdue} día${daysOverdue > 1 ? 's' : ''}. Consulta con el solicitante: ${requesterInfo} sobre el estado de esta tarea.`,
              userId: order.assignedToId,
              workOrderId: order.id,
              priority: 'high',
              metadata: {
                workOrderTitle: order.title,
                daysOverdue: daysOverdue,
                scheduledDate: order.scheduledDate,
                requesterName: order.createdBy?.name || 'Usuario no disponible',
                requesterEmail: order.createdBy?.email || 'Email no disponible',
                machineInfo: machineInfo,
                locationInfo: locationInfo,
                lastNotificationDate: new Date().toISOString(),
                companyId: order.companyId
              }
            })
          });

          notificationsSent.push({
            orderId: order.id,
            orderTitle: order.title,
            assignedToId: order.assignedToId,
            assignedToName: order.assignedTo.name,
            assignedToEmail: order.assignedTo.email,
            daysOverdue: daysOverdue,
            type: 'user_notification'
          });
        }

        // Para operarios, crear un registro especial (opcional: implementar sistema de notificaciones para operarios)
        if (order.assignedWorkerId && order.assignedWorker) {
          console.log(`👷 Operario ${order.assignedWorker.name} tiene orden vencida: "${order.title}" (${daysOverdue} días)`);
          
          notificationsSent.push({
            orderId: order.id,
            orderTitle: order.title,
            assignedWorkerId: order.assignedWorkerId,
            assignedWorkerName: order.assignedWorker.name,
            assignedWorkerPhone: order.assignedWorker.phone,
            daysOverdue: daysOverdue,
            type: 'worker_alert'
          });

          // TODO: Implementar notificación por Telegram para operarios
          // Por ahora solo lo registramos en el log
        }

      } catch (notificationError) {
        console.error(`Error enviando notificación para orden ${order.id}:`, notificationError);
      }
    }

    // console.log(`✅ Verificación diaria completada. ${notificationsSent.length} notificaciones procesadas.`) // Log reducido;

    return NextResponse.json({
      success: true,
      message: `Verificación diaria completada. ${notificationsSent.length} notificaciones enviadas.`,
      overdueOrdersFound: overdueOrders.length,
      notificationsSent: notificationsSent.length,
      notifications: notificationsSent,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error en verificación diaria de órdenes vencidas:', error);
    return NextResponse.json(
      { error: 'Error en verificación diaria', details: error },
      { status: 500 }
    );
  }
}

// GET para pruebas manuales
export async function GET(request: NextRequest) {
  return POST(request);
} 