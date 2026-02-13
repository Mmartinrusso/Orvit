import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';


async function getUserFromToken(request: NextRequest) {
  const user = await prisma.user.findFirst({
    where: { isActive: true }
  });
  return user;
}

export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromToken(request);
    if (!user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const body = await request.json();
    const { companyId, alertType = 'all' } = body;

    if (!companyId) {
      return NextResponse.json({ error: 'companyId es requerido' }, { status: 400 });
    }

    // Obtener usuarios de la empresa para enviar notificaciones
    const companyUsers = await prisma.user.findMany({
      where: {
        companyId: parseInt(companyId),
        isActive: true
      },
      select: {
        id: true,
        name: true,
        email: true
      }
    });

    if (companyUsers.length === 0) {
      return NextResponse.json({ error: 'No se encontraron usuarios en la empresa' }, { status: 404 });
    }

    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    let notificationsSent = 0;
    const notifications = [];

    // 1. Alertas de impuestos que vencen mañana
    if (alertType === 'all' || alertType === 'due_tomorrow') {
      const taxesDueTomorrow = await prisma.taxRecord.findMany({
        where: {
          taxBase: {
            companyId: parseInt(companyId)
          },
          status: {
            in: ['PENDIENTE', 'RECIBIDO']
          },
          alertDate: {
            gte: new Date(tomorrow.getFullYear(), tomorrow.getMonth(), tomorrow.getDate()),
            lt: new Date(tomorrow.getFullYear(), tomorrow.getMonth(), tomorrow.getDate() + 1)
          }
        },
        include: {
          taxBase: {
            select: { id: true, name: true, description: true }
          }
        }
      });

      for (const tax of taxesDueTomorrow) {
        for (const companyUser of companyUsers) {
          const notification = await prisma.notification.create({
            data: {
              userId: companyUser.id,
              type: 'tax_control_payment_due',
              title: 'Impuesto vence mañana',
              message: `⚠️ El impuesto "${tax.taxBase.name}" vence mañana (${formatDateForDisplay(tax.alertDate)}). Monto: $${tax.amount}`,
              isRead: false,
              metadata: {
                taxRecordId: tax.id,
                taxBaseId: tax.taxBase.id,
                alertType: 'due_tomorrow',
                dueDate: tax.alertDate
              }
            }
          });
          notifications.push(notification);
          notificationsSent++;
        }
      }
    }

    // 2. Alertas del día X de cada mes para impuestos recurrentes
    if (alertType === 'all' || alertType === 'recurring') {
      const currentDay = today.getDate();
      const currentMonth = today.getMonth() + 1;
      const currentYear = today.getFullYear();
      const currentMonthStr = `${currentYear}-${currentMonth.toString().padStart(2, '0')}`;

      const recurringTaxBases = await prisma.taxBase.findMany({
        where: {
          companyId: parseInt(companyId),
          isActive: true,
          isRecurring: true,
          recurringDay: currentDay
        }
      });

      for (const base of recurringTaxBases) {
        const existingRecord = await prisma.taxRecord.findFirst({
          where: {
            taxBaseId: base.id,
            month: currentMonthStr
          }
        });

        if (!existingRecord) {
          for (const companyUser of companyUsers) {
            const notification = await prisma.notification.create({
              data: {
                userId: companyUser.id,
                type: 'tax_control_received',
                title: 'Recordatorio de impuesto recurrente',
                message: `📅 Recordatorio: El impuesto "${base.name}" debe ser registrado hoy (día ${currentDay} del mes)`,
                isRead: false,
                metadata: {
                  taxBaseId: base.id,
                  alertType: 'recurring',
                  recurringDay: base.recurringDay,
                  month: currentMonthStr
                }
              }
            });
            notifications.push(notification);
            notificationsSent++;
          }
        }
      }
    }

    // 3. Alertas de impuestos vencidos
    if (alertType === 'all' || alertType === 'overdue') {
      const overdueTaxes = await prisma.taxRecord.findMany({
        where: {
          taxBase: {
            companyId: parseInt(companyId)
          },
          status: {
            in: ['PENDIENTE', 'RECIBIDO']
          },
          alertDate: {
            lt: today
          }
        },
        include: {
          taxBase: {
            select: { id: true, name: true, description: true }
          }
        }
      });

      for (const tax of overdueTaxes) {
        const daysOverdue = Math.ceil((today.getTime() - new Date(tax.alertDate).getTime()) / (1000 * 60 * 60 * 24));
        
        for (const companyUser of companyUsers) {
          const notification = await prisma.notification.create({
            data: {
              userId: companyUser.id,
              type: 'tax_control_payment_overdue',
              title: 'Impuesto vencido',
              message: `🚨 El impuesto "${tax.taxBase.name}" está vencido hace ${daysOverdue} día${daysOverdue !== 1 ? 's' : ''} (vencía el ${formatDateForDisplay(tax.alertDate)}). Monto: $${tax.amount}`,
              isRead: false,
              metadata: {
                taxRecordId: tax.id,
                taxBaseId: tax.taxBase.id,
                alertType: 'overdue',
                dueDate: tax.alertDate,
                daysOverdue: daysOverdue
              }
            }
          });
          notifications.push(notification);
          notificationsSent++;
        }
      }
    }

    return NextResponse.json({
      success: true,
      notificationsSent,
      notifications,
      message: `Se enviaron ${notificationsSent} notificaciones de alertas de impuestos`
    });

  } catch (error) {
    console.error('Error sending tax alerts:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}

// Función auxiliar para formatear fechas
function formatDateForDisplay(dateString: string): string {
  const date = new Date(dateString);
  const day = date.getDate().toString().padStart(2, '0');
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
}
