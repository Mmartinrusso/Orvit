import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

async function getUserFromToken(request: NextRequest) {
  const user = await prisma.user.findFirst({
    where: { isActive: true }
  });
  return user;
}

// PATCH - Actualizar un registro de impuesto
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getUserFromToken(request);
    if (!user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { id } = params;
    const body = await request.json();
    const { status, paymentDate, receivedDate, amount, notes } = body;

    if (!id) {
      return NextResponse.json({ error: 'ID de registro es requerido' }, { status: 400 });
    }

    // Verificar que el registro existe
    const existingRecord = await prisma.taxRecord.findUnique({
      where: { id: parseInt(id) },
      include: {
        taxBase: {
          include: {
            company: true
          }
        }
      }
    });

    if (!existingRecord) {
      return NextResponse.json({ error: 'Registro no encontrado' }, { status: 404 });
    }

    // Por ahora, permitir actualización si el usuario está activo
    // TODO: Implementar verificación de permisos por empresa cuando esté disponible

    // Preparar datos de actualización
    const updateData: any = {};
    
    if (status) {
      updateData.status = status;
      
      // Si se marca como recibido, establecer fecha de recepción
      if (status === 'RECIBIDO' && !existingRecord.receivedDate) {
        updateData.receivedDate = new Date();
        updateData.receivedBy = user.id;
      }
      
      // Si se marca como pagado, establecer fecha de pago
      if (status === 'PAGADO' && !existingRecord.paymentDate) {
        updateData.paymentDate = paymentDate ? new Date(paymentDate) : new Date();
        updateData.paidBy = user.id;
      }
    }
    
    if (amount !== undefined) {
      updateData.amount = parseFloat(amount);
    }
    
    if (notes !== undefined) {
      updateData.notes = notes;
    }

    // Actualizar el registro
    const updatedRecord = await prisma.taxRecord.update({
      where: { id: parseInt(id) },
      data: updateData,
      include: {
        taxBase: {
          select: { id: true, name: true, description: true, recurringDay: true, isRecurring: true }
        },
        receivedByUser: {
          select: { id: true, name: true, email: true }
        },
        paidByUser: {
          select: { id: true, name: true, email: true }
        }
      }
    });

    return NextResponse.json(updatedRecord);

  } catch (error) {
    console.error('Error updating tax record:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}

// DELETE - Eliminar un registro de impuesto
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getUserFromToken(request);
    if (!user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { id } = params;

    if (!id) {
      return NextResponse.json({ error: 'ID de registro es requerido' }, { status: 400 });
    }

    // Verificar que el registro existe
    const existingRecord = await prisma.taxRecord.findUnique({
      where: { id: parseInt(id) },
      include: {
        taxBase: {
          include: {
            company: true
          }
        }
      }
    });

    if (!existingRecord) {
      return NextResponse.json({ error: 'Registro no encontrado' }, { status: 404 });
    }

    // Por ahora, permitir eliminación si el usuario está activo
    // TODO: Implementar verificación de permisos por empresa cuando esté disponible

    // Eliminar el registro
    await prisma.taxRecord.delete({
      where: { id: parseInt(id) }
    });

    return NextResponse.json({ 
      success: true, 
      message: 'Registro eliminado exitosamente' 
    });

  } catch (error) {
    console.error('Error deleting tax record:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
