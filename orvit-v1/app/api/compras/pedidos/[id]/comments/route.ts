import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';
import { prisma } from '@/lib/prisma';
import { JWT_SECRET } from '@/lib/auth';
import { PurchaseCommentType } from '@prisma/client';

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

// GET - Obtener comentarios del pedido
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
    const pedidoId = parseInt(id);

    // Verificar que el pedido existe y pertenece a la empresa
    const pedido = await prisma.purchaseRequest.findFirst({
      where: { id: pedidoId, companyId }
    });

    if (!pedido) {
      return NextResponse.json({ error: 'Pedido no encontrado' }, { status: 404 });
    }

    const comentarios = await prisma.purchaseComment.findMany({
      where: {
        entidad: 'request',
        entidadId: pedidoId
      },
      include: {
        user: {
          select: { id: true, name: true, avatar: true }
        }
      },
      orderBy: { createdAt: 'asc' }
    });

    return NextResponse.json({ data: comentarios });
  } catch (error) {
    console.error('Error fetching comments:', error);
    return NextResponse.json(
      { error: 'Error al obtener los comentarios' },
      { status: 500 }
    );
  }
}

// POST - Crear comentario
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

    // Verificar que el pedido existe
    const pedido = await prisma.purchaseRequest.findFirst({
      where: { id: pedidoId, companyId }
    });

    if (!pedido) {
      return NextResponse.json({ error: 'Pedido no encontrado' }, { status: 404 });
    }

    const body = await request.json();
    const { contenido, tipo = 'COMENTARIO', mencionados = [] } = body;

    if (!contenido || contenido.trim() === '') {
      return NextResponse.json({ error: 'El contenido es requerido' }, { status: 400 });
    }

    const comentario = await prisma.purchaseComment.create({
      data: {
        entidad: 'request',
        entidadId: pedidoId,
        tipo: tipo as PurchaseCommentType,
        contenido: contenido.trim(),
        mencionados,
        companyId,
        userId: user.id
      },
      include: {
        user: {
          select: { id: true, name: true, avatar: true }
        }
      }
    });

    // TODO: Enviar notificaciones a los mencionados

    return NextResponse.json(comentario, { status: 201 });
  } catch (error) {
    console.error('Error creating comment:', error);
    return NextResponse.json(
      { error: 'Error al crear el comentario' },
      { status: 500 }
    );
  }
}
