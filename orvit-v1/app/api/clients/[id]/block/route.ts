import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';
import { JWT_SECRET } from '@/lib/auth';

const JWT_SECRET_KEY = new TextEncoder().encode(JWT_SECRET);

async function getUserFromToken() {
  try {
    const token = cookies().get('token')?.value;
    if (!token) return null;
    const { payload } = await jwtVerify(token, JWT_SECRET_KEY);
    const user = await prisma.user.findUnique({
      where: { id: payload.userId as number },
      include: { companies: { select: { companyId: true }, take: 1 } }
    });
    if (!user?.companies?.[0]) return null;
    return { userId: user.id, companyId: user.companies[0].companyId };
  } catch {
    return null;
  }
}

// POST - Bloquear/Desbloquear cliente
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await getUserFromToken();
    if (!auth) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { id } = params;
    const body = await request.json();
    const { block, reason } = body;

    // Verificar que el cliente existe y pertenece a la empresa
    const client = await prisma.client.findFirst({
      where: { id, companyId: auth.companyId },
    });

    if (!client) {
      return NextResponse.json({ error: 'Cliente no encontrado' }, { status: 404 });
    }

    // Actualizar estado de bloqueo
    const updated = await prisma.client.update({
      where: { id },
      data: {
        isBlocked: block,
        blockedReason: block ? (reason || 'Sin motivo especificado') : null,
        blockedAt: block ? new Date() : null,
        blockedByUserId: block ? auth.userId : null,
      },
      include: {
        clientType: true,
        deliveryZone: true,
        seller: { select: { id: true, name: true } },
      },
    });

    return NextResponse.json({
      success: true,
      client: updated,
      message: block ? 'Cliente bloqueado' : 'Cliente desbloqueado',
    });
  } catch (error: any) {
    console.error('Error al cambiar estado de bloqueo:', error);
    return NextResponse.json(
      { error: 'Error al cambiar estado de bloqueo', details: error.message },
      { status: 500 }
    );
  }
}
