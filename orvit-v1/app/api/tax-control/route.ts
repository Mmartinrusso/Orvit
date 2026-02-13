import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { createAndSendInstantNotification } from '@/lib/instant-notifications';

export const dynamic = 'force-dynamic';


// Función helper para obtener usuario del token
async function getUserFromToken(request: NextRequest) {
  const token = request.headers.get('authorization')?.replace('Bearer ', '');
  if (!token) return null;

  try {
    // Aquí deberías implementar la verificación del token JWT
    // Por ahora simulamos un usuario
    const user = await prisma.user.findFirst({
      where: { isActive: true }
    });
    return user;
  } catch (error) {
    console.error('Error verifying token:', error);
    return null;
  }
}

// GET - Obtener todos los impuestos de la empresa
export async function GET(request: NextRequest) {
  try {
    // Por ahora, obtener el primer usuario activo sin autenticación
    const user = await prisma.user.findFirst({
      where: { isActive: true }
    });
    
    if (!user) {
      return NextResponse.json({ error: 'No se encontró usuario activo' }, { status: 404 });
    }

    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get('companyId');
    const status = searchParams.get('status');
    const month = searchParams.get('month');

    if (!companyId) {
      return NextResponse.json({ error: 'companyId es requerido' }, { status: 400 });
    }

    const where: any = {
      companyId: parseInt(companyId)
    };

    if (status) {
      where.status = status;
    }

    if (month) {
      where.month = month;
    }

    const taxControls = await prisma.taxControl.findMany({
      where,
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
      },
      orderBy: {
        receivedDate: 'desc'
      }
    });

    return NextResponse.json(taxControls);
  } catch (error) {
    console.error('Error fetching tax controls:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}

// POST - Crear nuevo impuesto
export async function POST(request: NextRequest) {
  try {
    // Por ahora, obtener el primer usuario activo sin autenticación
    const user = await prisma.user.findFirst({
      where: { isActive: true }
    });
    
    if (!user) {
      return NextResponse.json({ error: 'No se encontró usuario activo' }, { status: 404 });
    }

    const body = await request.json();
    const { name, description, amount, alertDate, companyId, notes, isRecurring, recurringDay, month } = body;

    if (!name || !amount || !companyId || !month) {
      return NextResponse.json({ 
        error: 'Faltan campos requeridos: name, amount, companyId, month' 
      }, { status: 400 });
    }

    // Para impuestos recurrentes, calcular la fecha de alerta basada en el día del mes
    let finalAlertDate;
    if (isRecurring && recurringDay) {
      const [year, monthNum] = month.split('-');
      finalAlertDate = new Date(parseInt(year), parseInt(monthNum) - 1, recurringDay);
    } else if (alertDate) {
      finalAlertDate = new Date(alertDate);
    } else {
      return NextResponse.json({ 
        error: 'Se requiere alertDate o isRecurring con recurringDay' 
      }, { status: 400 });
    }

    const taxControl = await prisma.taxControl.create({
      data: {
        name,
        description,
        amount: parseFloat(amount),
        alertDate: finalAlertDate,
        companyId: parseInt(companyId),
        receivedBy: user.id,
        notes,
        status: 'RECIBIDO',
        isRecurring: isRecurring || false,
        recurringDay: recurringDay || null,
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

    // Enviar notificación al admin sobre el nuevo impuesto recibido
    try {
      await createAndSendInstantNotification(
        'TAX_CONTROL_RECEIVED',
        user.id,
        parseInt(companyId),
        null,
        null,
        'Nuevo Impuesto Recibido',
        `Se ha registrado un nuevo impuesto: ${name} por $${amount}`,
        'medium',
        {
          taxControlId: taxControl.id,
          taxControlName: name,
          amount: amount
        }
      );
    } catch (notificationError) {
      console.error('Error sending notification:', notificationError);
    }

    return NextResponse.json(taxControl, { status: 201 });
  } catch (error) {
    console.error('Error creating tax control:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
