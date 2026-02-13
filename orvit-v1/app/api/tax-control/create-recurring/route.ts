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

// POST - Crear impuestos recurrentes para un mes específico
export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromToken(request);
    if (!user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const body = await request.json();
    const { companyId, month } = body;

    if (!companyId || !month) {
      return NextResponse.json({ 
        error: 'Faltan campos requeridos: companyId, month' 
      }, { status: 400 });
    }

    // Buscar impuestos recurrentes que no existen para este mes
    const recurringTaxes = await prisma.taxControl.findMany({
      where: {
        companyId: parseInt(companyId),
        isRecurring: true,
        month: {
          not: month // Excluir el mes actual
        }
      },
      select: {
        name: true,
        description: true,
        recurringDay: true,
        receivedBy: true,
        notes: true
      },
      distinct: ['name', 'recurringDay'] // Solo una instancia por nombre y día
    });

    const createdTaxes = [];

    for (const recurringTax of recurringTaxes) {
      // Verificar si ya existe para este mes
      const existingTax = await prisma.taxControl.findFirst({
        where: {
          companyId: parseInt(companyId),
          name: recurringTax.name,
          month: month,
          isRecurring: true
        }
      });

      if (!existingTax && recurringTax.recurringDay) {
        // Calcular la fecha de alerta para el mes actual
        const [year, monthNum] = month.split('-');
        const alertDate = new Date(parseInt(year), parseInt(monthNum) - 1, recurringTax.recurringDay);

        const newTax = await prisma.taxControl.create({
          data: {
            name: recurringTax.name,
            description: recurringTax.description,
            amount: 0, // Monto inicial en 0, se debe actualizar manualmente
            alertDate: alertDate,
            companyId: parseInt(companyId),
            receivedBy: recurringTax.receivedBy,
            notes: recurringTax.notes,
            status: 'PENDIENTE', // Estado inicial como pendiente hasta que se ingrese el monto
            isRecurring: true,
            recurringDay: recurringTax.recurringDay,
            month: month
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

        createdTaxes.push(newTax);

        // Enviar notificación sobre el nuevo impuesto recurrente
        try {
          await createAndSendInstantNotification(
            'TAX_CONTROL_RECEIVED',
            recurringTax.receivedBy,
            parseInt(companyId),
            null,
            null,
            'Nuevo Impuesto Recurrente',
            `Se ha creado automáticamente el impuesto recurrente: ${recurringTax.name} para ${month}. Recuerda ingresar el monto.`,
            'medium',
            {
              taxControlId: newTax.id,
              taxControlName: recurringTax.name,
              month: month,
              isRecurring: true
            }
          );
        } catch (notificationError) {
          console.error('Error sending notification:', notificationError);
        }
      }
    }

    return NextResponse.json({
      message: `Se crearon ${createdTaxes.length} impuestos recurrentes para ${month}`,
      createdTaxes,
      totalCreated: createdTaxes.length
    });
  } catch (error) {
    console.error('Error creating recurring taxes:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
