import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';


export async function POST(request: NextRequest) {
  try {
    // Verificar que la request viene de un cron job o tiene autorización
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET || 'default-secret';
    
    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    console.log('🔔 Iniciando verificación diaria de alertas de impuestos...');

    // Obtener todas las empresas activas
    const companies = await prisma.company.findMany({
      where: { isActive: true },
      select: { id: true, name: true }
    });

    let totalNotificationsSent = 0;
    const results = [];

    for (const company of companies) {
      console.log(`📊 Verificando alertas para empresa: ${company.name} (ID: ${company.id})`);

      // Obtener usuarios de la empresa
      const companyUsers = await prisma.user.findMany({
        where: {
          companyId: company.id,
          isActive: true
        },
        select: {
          id: true,
          name: true,
          email: true
        }
      });

      if (companyUsers.length === 0) {
        console.log(`⚠️ No se encontraron usuarios activos para la empresa ${company.name}`);
        continue;
      }

      const today = new Date();
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      let companyNotificationsSent = 0;

      // 1. Alertas de impuestos que vencen mañana
      const taxesDueTomorrow = await prisma.taxRecord.findMany({
        where: {
          taxBase: {
            companyId: company.id
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
          await prisma.notification.create({
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
          companyNotificationsSent++;
        }
      }

      // 2. Alertas del día X de cada mes para impuestos recurrentes
      const currentDay = today.getDate();
      const currentMonth = today.getMonth() + 1;
      const currentYear = today.getFullYear();
      const currentMonthStr = `${currentYear}-${currentMonth.toString().padStart(2, '0')}`;

      const recurringTaxBases = await prisma.taxBase.findMany({
        where: {
          companyId: company.id,
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
            await prisma.notification.create({
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
            companyNotificationsSent++;
          }
        }
      }

      // 3. Alertas de impuestos vencidos (solo una vez por día)
      const overdueTaxes = await prisma.taxRecord.findMany({
        where: {
          taxBase: {
            companyId: company.id
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
        
        // Solo enviar alerta si no se envió hoy
        const todayStr = today.toISOString().split('T')[0];
        const existingNotification = await prisma.notification.findFirst({
          where: {
            userId: { in: companyUsers.map(u => u.id) },
            type: 'tax_control_payment_overdue',
            metadata: {
              path: ['taxRecordId'],
              equals: tax.id
            },
            createdAt: {
              gte: new Date(todayStr + 'T00:00:00.000Z'),
              lt: new Date(todayStr + 'T23:59:59.999Z')
            }
          }
        });

        if (!existingNotification) {
          for (const companyUser of companyUsers) {
            await prisma.notification.create({
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
            companyNotificationsSent++;
          }
        }
      }

      totalNotificationsSent += companyNotificationsSent;
      results.push({
        companyId: company.id,
        companyName: company.name,
        notificationsSent: companyNotificationsSent,
        taxesDueTomorrow: taxesDueTomorrow.length,
        recurringAlerts: recurringTaxBases.length,
        overdueTaxes: overdueTaxes.length
      });

      console.log(`✅ Empresa ${company.name}: ${companyNotificationsSent} notificaciones enviadas`);
    }

    console.log(`🎉 Verificación completada. Total: ${totalNotificationsSent} notificaciones enviadas`);

    return NextResponse.json({
      success: true,
      totalNotificationsSent,
      companiesProcessed: companies.length,
      results,
      message: `Se procesaron ${companies.length} empresas y se enviaron ${totalNotificationsSent} notificaciones`
    });

  } catch (error) {
    console.error('Error en verificación diaria de alertas:', error);
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
