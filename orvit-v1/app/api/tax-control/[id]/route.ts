import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { createAndSendInstantNotification } from '@/lib/instant-notifications';

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

// GET - Obtener un impuesto específico
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getUserFromToken(request);
    if (!user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const taxControl = await prisma.taxControl.findUnique({
      where: { id: parseInt(params.id) },
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

    if (!taxControl) {
      return NextResponse.json({ error: 'Impuesto no encontrado' }, { status: 404 });
    }

    return NextResponse.json(taxControl);
  } catch (error) {
    console.error('Error fetching tax control:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}

// PUT - Actualizar impuesto (marcar como pagado, etc.)
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getUserFromToken(request);
    if (!user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const body = await request.json();
    const { status, paymentDate, notes } = body;

    const existingTaxControl = await prisma.taxControl.findUnique({
      where: { id: parseInt(params.id) },
      include: {
        receivedByUser: true
      }
    });

    if (!existingTaxControl) {
      return NextResponse.json({ error: 'Impuesto no encontrado' }, { status: 404 });
    }

    const updateData: any = {};
    
    if (status) {
      updateData.status = status;
    }
    
    if (paymentDate) {
      updateData.paymentDate = new Date(paymentDate);
    }
    
    if (notes !== undefined) {
      updateData.notes = notes;
    }

    // Si se marca como pagado, agregar el usuario que lo pagó
    if (status === 'PAGADO') {
      updateData.paidBy = user.id;
      if (!paymentDate) {
        updateData.paymentDate = new Date();
      }
    }

    const updatedTaxControl = await prisma.taxControl.update({
      where: { id: parseInt(params.id) },
      data: updateData,
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

    // Enviar notificaciones según el cambio de estado
    try {
      if (status === 'PAGADO') {
        // Notificar al empleado que lo recibió que ya fue pagado
        await createAndSendInstantNotification(
          'TAX_CONTROL_PAID',
          existingTaxControl.receivedBy,
          existingTaxControl.companyId,
          null,
          null,
          'Impuesto Pagado',
          `El impuesto "${existingTaxControl.name}" ha sido marcado como pagado`,
          'medium',
          {
            taxControlId: updatedTaxControl.id,
            taxControlName: existingTaxControl.name,
            amount: existingTaxControl.amount
          }
        );
      }
    } catch (notificationError) {
      console.error('Error sending notification:', notificationError);
    }

    return NextResponse.json(updatedTaxControl);
  } catch (error) {
    console.error('Error updating tax control:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}

// DELETE - Eliminar impuesto
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getUserFromToken(request);
    if (!user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const taxControl = await prisma.taxControl.findUnique({
      where: { id: parseInt(params.id) }
    });

    if (!taxControl) {
      return NextResponse.json({ error: 'Impuesto no encontrado' }, { status: 404 });
    }

    await prisma.taxControl.delete({
      where: { id: parseInt(params.id) }
    });

    return NextResponse.json({ message: 'Impuesto eliminado correctamente' });
  } catch (error) {
    console.error('Error deleting tax control:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
