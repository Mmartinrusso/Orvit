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

// POST - Enviar pedido (BORRADOR -> ENVIADA)
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
          contenido: `Pedido enviado para cotización por ${user.name}`,
          companyId,
          userId: user.id
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
