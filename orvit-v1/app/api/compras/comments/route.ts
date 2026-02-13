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

// POST - Crear comentario (genérico para cualquier entidad)
export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromToken();
    if (!user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const companyId = user.companies?.[0]?.companyId;
    if (!companyId) {
      return NextResponse.json({ error: 'Usuario no tiene empresa asignada' }, { status: 400 });
    }

    const body = await request.json();
    const {
      entidad,    // 'request', 'quotation', 'order'
      entidadId,
      contenido,
      tipo = 'COMENTARIO',
      mencionados = [],
      adjuntos = []
    } = body;

    // Validaciones
    if (!entidad || !['request', 'quotation', 'order'].includes(entidad)) {
      return NextResponse.json({ error: 'Entidad no válida' }, { status: 400 });
    }

    if (!entidadId) {
      return NextResponse.json({ error: 'ID de entidad requerido' }, { status: 400 });
    }

    if (!contenido || contenido.trim() === '') {
      return NextResponse.json({ error: 'El contenido es requerido' }, { status: 400 });
    }

    // Verificar que la entidad existe y pertenece a la empresa
    let entityExists = false;

    if (entidad === 'request') {
      const request = await prisma.purchaseRequest.findFirst({
        where: { id: parseInt(entidadId), companyId }
      });
      entityExists = !!request;
    } else if (entidad === 'quotation') {
      const quotation = await prisma.purchaseQuotation.findFirst({
        where: { id: parseInt(entidadId), companyId }
      });
      entityExists = !!quotation;
    } else if (entidad === 'order') {
      const order = await prisma.purchaseOrder.findFirst({
        where: { id: parseInt(entidadId), companyId }
      });
      entityExists = !!order;
    }

    if (!entityExists) {
      return NextResponse.json({ error: 'Entidad no encontrada' }, { status: 404 });
    }

    const comentario = await prisma.purchaseComment.create({
      data: {
        entidad,
        entidadId: parseInt(entidadId),
        tipo: tipo as PurchaseCommentType,
        contenido: contenido.trim(),
        mencionados: mencionados.map((id: string | number) => parseInt(String(id))),
        adjuntos,
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
