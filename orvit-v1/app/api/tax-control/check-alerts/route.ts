import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { createAndSendInstantNotification } from '@/lib/instant-notifications';

export const dynamic = 'force-dynamic';


// Función helper para obtener usuario del token
async function getUserFromToken(request: NextRequest) {
  const token = request.headers.get('authorization')?.replace('Bearer ', '');
  if (!token) return null;

  try {
    const user = await prisma.user.findFirst({
      where: { isActive: true }
    });
    return user;
  } catch (error) {
    console.error('Error verifying token:', error);
    return null;
  }
}

// POST - Verificar impuestos que necesitan alertas
export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromToken(request);
    if (!user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const body = await request.json();
    const { companyId } = body;

    if (!companyId) {
      return NextResponse.json({ error: 'companyId es requerido' }, { status: 400 });
    }

    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Buscar impuestos que vencen hoy o mañana y no están pagados
    const dueTaxControls = await prisma.taxControl.findMany({
      where: {
        companyId: parseInt(companyId),
        status: {
          in: ['RECIBIDO', 'PENDIENTE']
        },
        alertDate: {
          lte: tomorrow
        }
      },
      include: {
        receivedByUser: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      }
    });

    const notifications = [];

    for (const taxControl of dueTaxControls) {
      const isOverdue = taxControl.alertDate < today;
      const isDueToday = taxControl.alertDate.toDateString() === today.toDateString();
      
      let notificationType = '';
      let title = '';
      let message = '';
      let priority: 'low' | 'medium' | 'high' | 'urgent' = 'medium';

      if (isOverdue) {
        notificationType = 'TAX_CONTROL_PAYMENT_OVERDUE';
        title = 'Impuesto Vencido';
        message = `El impuesto "${taxControl.name}" está vencido desde ${taxControl.alertDate.toLocaleDateString()}`;
        priority = 'urgent';
        
        // Actualizar estado a VENCIDO si no está ya
        if (taxControl.status !== 'VENCIDO') {
          await prisma.taxControl.update({
            where: { id: taxControl.id },
            data: { status: 'VENCIDO' }
          });
        }
      } else if (isDueToday) {
        notificationType = 'TAX_CONTROL_PAYMENT_DUE';
        title = 'Impuesto Vence Hoy';
        message = `El impuesto "${taxControl.name}" vence hoy`;
        priority = 'high';
      }

      if (notificationType) {
        try {
          // Notificar al admin
          await createAndSendInstantNotification(
            notificationType,
            user.id,
            parseInt(companyId),
            null,
            null,
            title,
            message,
            priority,
            {
              taxControlId: taxControl.id,
              taxControlName: taxControl.name,
              amount: taxControl.amount,
              alertDate: taxControl.alertDate
            }
          );

          // Notificar al empleado que lo recibió
          await createAndSendInstantNotification(
            notificationType,
            taxControl.receivedBy,
            parseInt(companyId),
            null,
            null,
            title,
            message,
            priority,
            {
              taxControlId: taxControl.id,
              taxControlName: taxControl.name,
              amount: taxControl.amount,
              alertDate: taxControl.alertDate
            }
          );

          notifications.push({
            taxControlId: taxControl.id,
            type: notificationType,
            sent: true
          });
        } catch (notificationError) {
          console.error('Error sending notification for tax control:', taxControl.id, notificationError);
          notifications.push({
            taxControlId: taxControl.id,
            type: notificationType,
            sent: false,
            error: notificationError
          });
        }
      }
    }

    return NextResponse.json({
      message: `Verificación completada. ${notifications.length} notificaciones procesadas.`,
      notifications,
      totalChecked: dueTaxControls.length
    });
  } catch (error) {
    console.error('Error checking tax control alerts:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
