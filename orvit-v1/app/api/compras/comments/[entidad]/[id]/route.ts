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

// GET - Listar comentarios de una entidad
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ entidad: string; id: string }> }
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

    const { entidad, id } = await params;
    const entidadId = parseInt(id);

    // Validar entidad
    if (!['request', 'quotation', 'order'].includes(entidad)) {
      return NextResponse.json({ error: 'Entidad no válida' }, { status: 400 });
    }

    // Verificar que la entidad existe y pertenece a la empresa
    let entityExists = false;

    if (entidad === 'request') {
      const request = await prisma.purchaseRequest.findFirst({
        where: { id: entidadId, companyId }
      });
      entityExists = !!request;
    } else if (entidad === 'quotation') {
      const quotation = await prisma.purchaseQuotation.findFirst({
        where: { id: entidadId, companyId }
      });
      entityExists = !!quotation;
    } else if (entidad === 'order') {
      const order = await prisma.purchaseOrder.findFirst({
        where: { id: entidadId, companyId }
      });
      entityExists = !!order;
    }

    if (!entityExists) {
      return NextResponse.json({ error: 'Entidad no encontrada' }, { status: 404 });
    }

    const comentarios = await prisma.purchaseComment.findMany({
      where: {
        entidad,
        entidadId,
        companyId
      },
      include: {
        user: {
          select: { id: true, name: true, avatar: true }
        }
      },
      orderBy: { createdAt: 'asc' }
    });

    return NextResponse.json({ data: comentarios });
  } catch (error: any) {
    console.error('Error fetching comments:', error);
    return NextResponse.json(
      { error: error?.message || 'Error al obtener los comentarios', details: String(error) },
      { status: 500 }
    );
  }
}
