import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

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

// POST - Crear datos de ejemplo para testing
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

    // Datos de ejemplo
    const sampleTaxes = [
      {
        name: 'IIBB',
        description: 'Ingresos Brutos - Impuesto recurrente',
        amount: 15000.00,
        isRecurring: true,
        recurringDay: 5,
        status: 'RECIBIDO' as const,
        notes: 'Impuesto mensual de ingresos brutos'
      },
      {
        name: 'IVA',
        description: 'Impuesto al Valor Agregado',
        amount: 8500.00,
        isRecurring: true,
        recurringDay: 10,
        status: 'PAGADO' as const,
        notes: 'IVA del mes anterior'
      },
      {
        name: 'Ganancias',
        description: 'Impuesto a las Ganancias',
        amount: 22000.00,
        isRecurring: false,
        recurringDay: null,
        status: 'PENDIENTE' as const,
        notes: 'Impuesto trimestral'
      },
      {
        name: 'Monotributo',
        description: 'Monotributo mensual',
        amount: 3500.00,
        isRecurring: true,
        recurringDay: 15,
        status: 'VENCIDO' as const,
        notes: 'Pago mensual de monotributo'
      }
    ];

    const createdTaxes = [];

    for (const taxData of sampleTaxes) {
      // Calcular fecha de alerta
      let alertDate;
      if (taxData.isRecurring && taxData.recurringDay) {
        const [year, monthNum] = month.split('-');
        alertDate = new Date(parseInt(year), parseInt(monthNum) - 1, taxData.recurringDay);
      } else {
        // Para impuestos no recurrentes, usar una fecha específica
        const [year, monthNum] = month.split('-');
        alertDate = new Date(parseInt(year), parseInt(monthNum) - 1, 20);
      }

      const tax = await prisma.taxControl.create({
        data: {
          name: taxData.name,
          description: taxData.description,
          amount: taxData.amount,
          alertDate: alertDate,
          companyId: parseInt(companyId),
          receivedBy: user.id,
          notes: taxData.notes,
          status: taxData.status,
          isRecurring: taxData.isRecurring,
          recurringDay: taxData.recurringDay,
          month: month,
          paymentDate: taxData.status === 'PAGADO' ? new Date() : null,
          paidBy: taxData.status === 'PAGADO' ? user.id : null
        },
        include: {
          receivedByUser: {
            select: {
              id: true,
              name: true,
              email: true
            }
          },
          paidByUser: {
            select: {
              id: true,
              name: true,
              email: true
            }
          }
        }
      });

      createdTaxes.push(tax);
    }

    return NextResponse.json({
      message: `Se crearon ${createdTaxes.length} impuestos de ejemplo para ${month}`,
      createdTaxes,
      totalCreated: createdTaxes.length
    });
  } catch (error) {
    console.error('Error creating sample data:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
