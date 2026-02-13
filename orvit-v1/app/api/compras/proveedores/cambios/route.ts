/**
 * API para gestionar solicitudes de cambio de proveedor
 * (Especialmente cambios bancarios que requieren doble aprobación)
 */

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

/**
 * GET - Listar solicitudes de cambio pendientes
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromToken();
    if (!user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const companyId = user.companies?.[0]?.companyId;
    if (!companyId) {
      return NextResponse.json({ error: 'Usuario no tiene empresa asignada' }, { status: 400 });
    }

    const { searchParams } = new URL(request.url);
    const estado = searchParams.get('estado') || 'PENDIENTE_APROBACION';
    const tipo = searchParams.get('tipo') || undefined;

    const cambios = await prisma.supplierChangeRequest.findMany({
      where: {
        companyId,
        ...(estado !== 'all' && { estado }),
        ...(tipo && { tipo }),
      },
      include: {
        supplier: {
          select: { id: true, name: true, cuit: true }
        },
        solicitante: {
          select: { id: true, name: true }
        },
        aprobador: {
          select: { id: true, name: true }
        },
        rechazador: {
          select: { id: true, name: true }
        },
      },
      orderBy: { solicitadoAt: 'desc' },
    });

    return NextResponse.json(cambios);
  } catch (error) {
    console.error('Error fetching supplier change requests:', error);
    return NextResponse.json(
      { error: 'Error al obtener solicitudes de cambio' },
      { status: 500 }
    );
  }
}
