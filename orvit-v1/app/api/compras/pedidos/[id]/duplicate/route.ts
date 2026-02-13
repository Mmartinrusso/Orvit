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

// Genera número de pedido: REQ-2026-00001
async function generateRequestNumber(companyId: number): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `REQ-${year}-`;

  const lastRequest = await prisma.purchaseRequest.findFirst({
    where: {
      companyId,
      numero: { startsWith: prefix },
    },
    orderBy: { numero: 'desc' },
    select: { numero: true },
  });

  let nextNumber = 1;
  if (lastRequest?.numero) {
    const parts = lastRequest.numero.split('-');
    const lastNum = parseInt(parts[2] || '0', 10);
    nextNumber = lastNum + 1;
  }

  return `${prefix}${String(nextNumber).padStart(5, '0')}`;
}

// POST - Duplicar un pedido
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

    // Obtener el pedido original con items
    const originalPedido = await prisma.purchaseRequest.findFirst({
      where: { id: pedidoId, companyId },
      include: {
        items: true
      }
    });

    if (!originalPedido) {
      return NextResponse.json({ error: 'Pedido no encontrado' }, { status: 404 });
    }

    // Generar nuevo número
    const nuevoNumero = await generateRequestNumber(companyId);

    // Crear el nuevo pedido como copia
    const nuevoPedido = await prisma.purchaseRequest.create({
      data: {
        numero: nuevoNumero,
        titulo: `${originalPedido.titulo} (copia)`,
        descripcion: originalPedido.descripcion,
        estado: 'BORRADOR', // Siempre en borrador
        prioridad: originalPedido.prioridad,
        departamento: originalPedido.departamento,
        moneda: originalPedido.moneda,
        presupuestoEstimado: originalPedido.presupuestoEstimado,
        notas: originalPedido.notas,
        solicitanteId: user.id, // El usuario actual es el solicitante
        companyId,
        // Duplicar items
        items: {
          create: originalPedido.items.map(item => ({
            descripcion: item.descripcion,
            cantidad: item.cantidad,
            unidad: item.unidad,
            especificaciones: item.especificaciones,
          }))
        }
      },
      include: {
        items: true,
        solicitante: {
          select: { id: true, name: true }
        }
      }
    });

    // Crear comentario de sistema
    await prisma.purchaseComment.create({
      data: {
        entidad: 'request',
        entidadId: nuevoPedido.id,
        tipo: 'SISTEMA',
        contenido: `Pedido duplicado desde ${originalPedido.numero}`,
        companyId,
        userId: user.id,
      }
    });

    return NextResponse.json(nuevoPedido);
  } catch (error: any) {
    console.error('Error duplicating pedido:', error);
    return NextResponse.json(
      { error: error.message || 'Error al duplicar el pedido' },
      { status: 500 }
    );
  }
}
