import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { createAndSendInstantNotification } from '@/lib/instant-notifications';

export const dynamic = 'force-dynamic';


// Endpoint para verificación diaria automática de impuestos
// Este endpoint puede ser llamado por un cron job o scheduler externo
export async function POST(request: NextRequest) {
  try {
    console.log('🔍 Iniciando verificación diaria de impuestos...');

    // Obtener todas las empresas activas
    const companies = await prisma.company.findMany({
      where: {
        // Aquí podrías agregar filtros adicionales si es necesario
      },
      select: {
        id: true,
        name: true
      }
    });

    const results = [];

    for (const company of companies) {
      console.log(`📊 Verificando impuestos para empresa: ${company.name} (ID: ${company.id})`);

      const today = new Date();
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      const currentMonth = today.toISOString().slice(0, 7); // YYYY-MM

      // Buscar impuestos que vencen hoy o mañana y no están pagados
      const dueTaxControls = await prisma.taxControl.findMany({
        where: {
          companyId: company.id,
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

      console.log(`📋 Encontrados ${dueTaxControls.length} impuestos que requieren atención`);

      // Crear impuestos recurrentes para el mes actual si no existen
      const recurringTaxes = await prisma.taxControl.findMany({
        where: {
          companyId: company.id,
          isRecurring: true,
          month: {
            not: currentMonth
          }
        },
        select: {
          name: true,
          description: true,
          recurringDay: true,
          receivedBy: true,
          notes: true
        },
        distinct: ['name', 'recurringDay']
      });

      let createdRecurring = 0;
      for (const recurringTax of recurringTaxes) {
        if (recurringTax.recurringDay && today.getDate() >= recurringTax.recurringDay) {
          // Verificar si ya existe para este mes
          const existingTax = await prisma.taxControl.findFirst({
            where: {
              companyId: company.id,
              name: recurringTax.name,
              month: currentMonth,
              isRecurring: true
            }
          });

          if (!existingTax) {
            // Crear el impuesto recurrente para este mes
            const [year, monthNum] = currentMonth.split('-');
            const alertDate = new Date(parseInt(year), parseInt(monthNum) - 1, recurringTax.recurringDay);

            await prisma.taxControl.create({
              data: {
                name: recurringTax.name,
                description: recurringTax.description,
                amount: 0, // Monto inicial en 0
                alertDate: alertDate,
                companyId: company.id,
                receivedBy: recurringTax.receivedBy,
                notes: recurringTax.notes,
                status: 'PENDIENTE',
                isRecurring: true,
                recurringDay: recurringTax.recurringDay,
                month: currentMonth
              }
            });

            createdRecurring++;
            console.log(`✅ Creado impuesto recurrente: ${recurringTax.name} para ${currentMonth}`);
          }
        }
      }

      let notificationsSent = 0;
      let errors = 0;

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
            console.log(`⚠️ Impuesto ${taxControl.name} marcado como VENCIDO`);
          }
        } else if (isDueToday) {
          notificationType = 'TAX_CONTROL_PAYMENT_DUE';
          title = 'Impuesto Vence Hoy';
          message = `El impuesto "${taxControl.name}" vence hoy`;
          priority = 'high';
        }

        if (notificationType) {
          try {
            // Buscar usuarios admin de la empresa para notificar
            const adminUsers = await prisma.userOnCompany.findMany({
              where: {
                companyId: company.id,
                isActive: true,
                user: {
                  role: {
                    in: ['ADMIN', 'ADMIN_ENTERPRISE', 'SUPERADMIN']
                  }
                }
              },
              include: {
                user: true
              }
            });

            // Notificar a todos los admins
            for (const adminUser of adminUsers) {
              await createAndSendInstantNotification(
                notificationType,
                adminUser.user.id,
                company.id,
                null,
                null,
                title,
                message,
                priority,
                {
                  taxControlId: taxControl.id,
                  taxControlName: taxControl.name,
                  amount: taxControl.amount,
                  alertDate: taxControl.alertDate,
                  companyName: company.name
                }
              );
            }

            // Notificar al empleado que lo recibió
            await createAndSendInstantNotification(
              notificationType,
              taxControl.receivedBy,
              company.id,
              null,
              null,
              title,
              message,
              priority,
              {
                taxControlId: taxControl.id,
                taxControlName: taxControl.name,
                amount: taxControl.amount,
                alertDate: taxControl.alertDate,
                companyName: company.name
              }
            );

            notificationsSent++;
            console.log(`✅ Notificación enviada para impuesto: ${taxControl.name}`);
          } catch (notificationError) {
            errors++;
            console.error(`❌ Error enviando notificación para impuesto ${taxControl.id}:`, notificationError);
          }
        }
      }

      results.push({
        companyId: company.id,
        companyName: company.name,
        taxControlsChecked: dueTaxControls.length,
        notificationsSent,
        errors,
        recurringTaxesCreated: createdRecurring
      });
    }

    const totalChecked = results.reduce((sum, r) => sum + r.taxControlsChecked, 0);
    const totalNotifications = results.reduce((sum, r) => sum + r.notificationsSent, 0);
    const totalErrors = results.reduce((sum, r) => sum + r.errors, 0);
    const totalRecurringCreated = results.reduce((sum, r) => sum + r.recurringTaxesCreated, 0);

    console.log(`✅ Verificación diaria completada:`);
    console.log(`   - Empresas verificadas: ${companies.length}`);
    console.log(`   - Impuestos verificados: ${totalChecked}`);
    console.log(`   - Notificaciones enviadas: ${totalNotifications}`);
    console.log(`   - Impuestos recurrentes creados: ${totalRecurringCreated}`);
    console.log(`   - Errores: ${totalErrors}`);

    return NextResponse.json({
      success: true,
      message: 'Verificación diaria completada',
      summary: {
        companiesChecked: companies.length,
        totalTaxControlsChecked: totalChecked,
        totalNotificationsSent: totalNotifications,
        totalRecurringTaxesCreated: totalRecurringCreated,
        totalErrors
      },
      details: results
    });
  } catch (error) {
    console.error('❌ Error en verificación diaria de impuestos:', error);
    return NextResponse.json({ 
      success: false,
      error: 'Error interno del servidor',
      details: error instanceof Error ? error.message : 'Error desconocido'
    }, { status: 500 });
  }
}

// GET - Para verificar el estado del endpoint
export async function GET() {
  return NextResponse.json({
    message: 'Tax Control Daily Check endpoint is active',
    timestamp: new Date().toISOString(),
    description: 'Este endpoint verifica diariamente los impuestos vencidos y envía notificaciones automáticas'
  });
}
