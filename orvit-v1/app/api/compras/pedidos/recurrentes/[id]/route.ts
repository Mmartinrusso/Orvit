import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';
import { prisma } from '@/lib/prisma';
import { JWT_SECRET } from '@/lib/auth';
import { RecurringFrequency, RequestPriority } from '@prisma/client';

export const dynamic = 'force-dynamic';

const JWT_SECRET_KEY = new TextEncoder().encode(JWT_SECRET);

async function getUserFromToken() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;
    if (!token) return null;

    const { payload } = await jwtVerify(token, JWT_SECRET_KEY);

    const user = await prisma.user.findUnique({
      where: { id: payload.userId as number },
      select: {
        id: true,
        name: true,
        role: true,
        companies: {
          select: { companyId: true },
          take: 1
        }
      }
    });

    return user;
  } catch {
    return null;
  }
}

// GET - Obtener detalle de un pedido recurrente
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getUserFromToken();
    if (!user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const companyId = user.companies?.[0]?.companyId;
    if (!companyId) {
      return NextResponse.json({ error: 'Usuario no tiene empresa asignada' }, { status: 400 });
    }

    const { id } = await params;
    const recurrenteId = parseInt(id);

    const recurrente = await prisma.recurringPurchaseOrder.findFirst({
      where: { id: recurrenteId, companyId },
      include: {
        items: true,
        creador: { select: { id: true, name: true } },
        historial: {
          orderBy: { fechaEjecucion: 'desc' },
          take: 20
        }
      }
    });

    if (!recurrente) {
      return NextResponse.json({ error: 'Pedido recurrente no encontrado' }, { status: 404 });
    }

    return NextResponse.json(recurrente);
  } catch (error: any) {
    console.error('Error fetching recurring order:', error);
    return NextResponse.json(
      { error: error.message || 'Error al obtener pedido recurrente' },
      { status: 500 }
    );
  }
}

// PUT - Actualizar pedido recurrente
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getUserFromToken();
    if (!user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const companyId = user.companies?.[0]?.companyId;
    if (!companyId) {
      return NextResponse.json({ error: 'Usuario no tiene empresa asignada' }, { status: 400 });
    }

    const { id } = await params;
    const recurrenteId = parseInt(id);

    // Verificar que existe
    const existing = await prisma.recurringPurchaseOrder.findFirst({
      where: { id: recurrenteId, companyId }
    });

    if (!existing) {
      return NextResponse.json({ error: 'Pedido recurrente no encontrado' }, { status: 404 });
    }

    const body = await request.json();
    const {
      nombre,
      descripcion,
      frecuencia,
      diaSemana,
      diaMes,
      horaEjecucion,
      tituloPedido,
      prioridad,
      departamento,
      diasParaNecesidad,
      notas,
      isActive,
      items
    } = body;

    // Actualizar en transacción
    const recurrente = await prisma.$transaction(async (tx) => {
      // Actualizar pedido recurrente
      const updated = await tx.recurringPurchaseOrder.update({
        where: { id: recurrenteId },
        data: {
          ...(nombre && { nombre }),
          ...(descripcion !== undefined && { descripcion }),
          ...(frecuencia && { frecuencia: frecuencia as RecurringFrequency }),
          ...(diaSemana !== undefined && { diaSemana }),
          ...(diaMes !== undefined && { diaMes }),
          ...(horaEjecucion !== undefined && { horaEjecucion }),
          ...(tituloPedido && { tituloPedido }),
          ...(prioridad && { prioridad: prioridad as RequestPriority }),
          ...(departamento !== undefined && { departamento }),
          ...(diasParaNecesidad !== undefined && { diasParaNecesidad }),
          ...(notas !== undefined && { notas }),
          ...(isActive !== undefined && { isActive })
        }
      });

      // Si se proporcionan items, reemplazarlos
      if (items && Array.isArray(items)) {
        await tx.recurringPurchaseItem.deleteMany({
          where: { recurringOrderId: recurrenteId }
        });

        await tx.recurringPurchaseItem.createMany({
          data: items.map((item: any) => ({
            recurringOrderId: recurrenteId,
            descripcion: item.descripcion,
            cantidad: parseFloat(item.cantidad) || 1,
            unidad: item.unidad || 'UN',
            especificaciones: item.especificaciones
          }))
        });
      }

      return updated;
    });

    // Obtener el pedido actualizado con relaciones
    const result = await prisma.recurringPurchaseOrder.findUnique({
      where: { id: recurrenteId },
      include: {
        items: true,
        creador: { select: { id: true, name: true } }
      }
    });

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Error updating recurring order:', error);
    return NextResponse.json(
      { error: error.message || 'Error al actualizar pedido recurrente' },
      { status: 500 }
    );
  }
}

// DELETE - Eliminar pedido recurrente
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getUserFromToken();
    if (!user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const companyId = user.companies?.[0]?.companyId;
    if (!companyId) {
      return NextResponse.json({ error: 'Usuario no tiene empresa asignada' }, { status: 400 });
    }

    const { id } = await params;
    const recurrenteId = parseInt(id);

    // Verificar que existe
    const existing = await prisma.recurringPurchaseOrder.findFirst({
      where: { id: recurrenteId, companyId }
    });

    if (!existing) {
      return NextResponse.json({ error: 'Pedido recurrente no encontrado' }, { status: 404 });
    }

    await prisma.recurringPurchaseOrder.delete({
      where: { id: recurrenteId }
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting recurring order:', error);
    return NextResponse.json(
      { error: error.message || 'Error al eliminar pedido recurrente' },
      { status: 500 }
    );
  }
}
