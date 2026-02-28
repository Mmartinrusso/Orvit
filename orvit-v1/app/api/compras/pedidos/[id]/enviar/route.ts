import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/lib/compras/auth';

export const dynamic = 'force-dynamic';

// POST - Enviar pedido (BORRADOR -> ENVIADA)
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { user, error } = await requirePermission('compras.pedidos.enviar');
    if (error) return error;

    const companyId = user!.companyId;

    const { id } = await params;
    const pedidoId = parseInt(id);

    const pedido = await prisma.purchaseRequest.findFirst({
      where: { id: pedidoId, companyId },
      include: { items: true }
    });

    if (!pedido) {
      return NextResponse.json({ error: 'Pedido no encontrado' }, { status: 404 });
    }

    if (pedido.estado !== 'BORRADOR') {
      return NextResponse.json(
        { error: 'Solo se pueden enviar pedidos en estado borrador' },
        { status: 400 }
      );
    }

    if (pedido.items.length === 0) {
      return NextResponse.json(
        { error: 'El pedido debe tener al menos un item' },
        { status: 400 }
      );
    }

    // Actualizar estado y crear comentario de sistema
    const [pedidoActualizado] = await prisma.$transaction([
      prisma.purchaseRequest.update({
        where: { id: pedidoId },
        data: { estado: 'ENVIADA' }
      }),
      prisma.purchaseComment.create({
        data: {
          entidad: 'request',
          entidadId: pedidoId,
          tipo: 'SISTEMA',
          contenido: `Pedido enviado para cotización por ${user!.name}`,
          companyId,
          userId: user!.id
        }
      })
    ]);

    return NextResponse.json({
      success: true,
      pedido: pedidoActualizado,
      message: 'Pedido enviado para cotización'
    });
  } catch (error) {
    console.error('Error enviando pedido:', error);
    return NextResponse.json(
      { error: 'Error al enviar el pedido' },
      { status: 500 }
    );
  }
}
