import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';


async function getUserFromToken(request: NextRequest) {
  const user = await prisma.user.findFirst({
    where: { isActive: true }
  });
  return user;
}

export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromToken(request);
    if (!user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get('companyId');

    if (!companyId) {
      return NextResponse.json({ error: 'companyId es requerido' }, { status: 400 });
    }

    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // 1. Verificar impuestos que vencen mañana (1 día antes)
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

    // 2. Verificar alertas del día X de cada mes para impuestos recurrentes
    const currentDay = today.getDate();
    const currentMonth = today.getMonth() + 1; // getMonth() retorna 0-11
    const currentYear = today.getFullYear();
    const currentMonthStr = `${currentYear}-${currentMonth.toString().padStart(2, '0')}`;

    // Buscar bases de impuestos que tienen alerta hoy
    const recurringTaxBases = await prisma.taxBase.findMany({
      where: {
        companyId: parseInt(companyId),
        isActive: true,
        isRecurring: true,
        recurringDay: currentDay
      }
    });

    // Verificar si ya existen registros para este mes
    const recurringAlerts = [];
    for (const base of recurringTaxBases) {
      const existingRecord = await prisma.taxRecord.findFirst({
        where: {
          taxBaseId: base.id,
          month: currentMonthStr
        }
      });

      if (!existingRecord) {
        recurringAlerts.push({
          type: 'recurring_alert',
          taxBase: base,
          message: `Recordatorio: El impuesto "${base.name}" debe ser registrado hoy (día ${currentDay} del mes)`
        });
      }
    }

    // 3. Verificar impuestos vencidos (más de 1 día de retraso)
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

    // Formatear alertas
    const alerts = [];

    // Alertas de vencimiento mañana
    taxesDueTomorrow.forEach(tax => {
      alerts.push({
        type: 'due_tomorrow',
        taxRecord: tax,
        message: `⚠️ El impuesto "${tax.taxBase.name}" vence mañana (${formatDateForDisplay(tax.alertDate)})`
      });
    });

    // Alertas recurrentes
    alerts.push(...recurringAlerts);

    // Alertas de vencidos
    overdueTaxes.forEach(tax => {
      const daysOverdue = Math.ceil((today.getTime() - new Date(tax.alertDate).getTime()) / (1000 * 60 * 60 * 24));
      alerts.push({
        type: 'overdue',
        taxRecord: tax,
        message: `🚨 El impuesto "${tax.taxBase.name}" está vencido hace ${daysOverdue} día${daysOverdue !== 1 ? 's' : ''} (vencía el ${formatDateForDisplay(tax.alertDate)})`
      });
    });

    return NextResponse.json({
      success: true,
      alerts,
      summary: {
        dueTomorrow: taxesDueTomorrow.length,
        recurringAlerts: recurringAlerts.length,
        overdue: overdueTaxes.length,
        total: alerts.length
      }
    });

  } catch (error) {
    console.error('Error checking tax alerts:', error);
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
