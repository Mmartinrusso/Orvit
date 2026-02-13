import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';
import { prisma } from '@/lib/prisma';
import { JWT_SECRET } from '@/lib/auth';

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

// POST - Cancelar OC
export async function POST(
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
    const ordenId = parseInt(id);

    const body = await request.json();
    const { motivo } = body;

    if (!motivo || !motivo.trim()) {
      return NextResponse.json({ error: 'Debe ingresar un motivo de cancelación' }, { status: 400 });
    }

    // Buscar la OC
    const orden = await prisma.purchaseOrder.findFirst({
      where: { id: ordenId, companyId },
    });

    if (!orden) {
      return NextResponse.json({ error: 'Orden de compra no encontrada' }, { status: 404 });
    }

    // Validar que la OC no está ya completada o cancelada
    if (['COMPLETADA', 'CANCELADA'].includes(orden.estado)) {
      return NextResponse.json(
        { error: `No se puede cancelar una OC en estado ${orden.estado}` },
        { status: 400 }
      );
    }

    // Transacción: actualizar OC y crear comentario de sistema
    const result = await prisma.$transaction(async (tx) => {
      // Actualizar OC a CANCELADA
      const ordenActualizada = await tx.purchaseOrder.update({
        where: { id: ordenId },
        data: {
          estado: 'CANCELADA',
          notasInternas: orden.notasInternas
            ? `${orden.notasInternas}\n\n[CANCELADA ${new Date().toLocaleDateString('es-AR')}]\nMotivo: ${motivo}\nCancelada por: ${user.name}`
            : `[CANCELADA ${new Date().toLocaleDateString('es-AR')}]\nMotivo: ${motivo}\nCancelada por: ${user.name}`,
        }
      });

      // Crear comentario de sistema
      await tx.purchaseComment.create({
        data: {
          entidad: 'order',
          entidadId: ordenId,
          tipo: 'SISTEMA',
          contenido: `Orden cancelada por ${user.name}.\nMotivo: ${motivo}`,
          companyId,
          userId: user.id
        }
      });

      // Si tiene pedido de compra asociado, agregar comentario
      if (orden.purchaseRequestId) {
        await tx.purchaseComment.create({
          data: {
            entidad: 'request',
            entidadId: orden.purchaseRequestId,
            tipo: 'SISTEMA',
            contenido: `La Orden de Compra ${orden.numero} fue cancelada.\nMotivo: ${motivo}`,
            companyId,
            userId: user.id
          }
        });

        // Revertir estado del pedido si es necesario
        const pedido = await tx.purchaseRequest.findUnique({
          where: { id: orden.purchaseRequestId }
        });

        if (pedido && pedido.estado === 'EN_PROCESO') {
          await tx.purchaseRequest.update({
            where: { id: orden.purchaseRequestId },
            data: { estado: 'APROBADA' } // Volver a aprobada para que se pueda crear otra OC
          });
        }
      }

      return ordenActualizada;
    });

    return NextResponse.json({
      success: true,
      message: 'Orden de compra cancelada exitosamente',
      orden: result
    });
  } catch (error: any) {
    console.error('Error cancelando OC:', error);
    return NextResponse.json(
      { error: error.message || 'Error al cancelar la orden de compra' },
      { status: 500 }
    );
  }
}
