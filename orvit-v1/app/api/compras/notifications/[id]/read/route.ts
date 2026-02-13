import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import { JWT_SECRET } from '@/lib/auth';

export const dynamic = 'force-dynamic';

const JWT_SECRET_KEY = new TextEncoder().encode(JWT_SECRET);

async function getUserFromToken() {
  const token = cookies().get('token')?.value;
  if (!token) throw new Error('No token provided');
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET_KEY);
    return { userId: payload.userId as number, companyId: payload.companyId as number };
  } catch {
    throw new Error('Invalid token');
  }
}

interface Params {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/compras/notifications/[id]/read
 * Marca una notificación como leída
 */
export async function POST(req: NextRequest, { params }: Params) {
  try {
    const { userId, companyId } = await getUserFromToken();
    const { id } = await params;
    const notificationId = parseInt(id, 10);

    // Verificar que la notificación pertenece al usuario
    const notification = await prisma.notificationOutbox.findFirst({
      where: {
        id: notificationId,
        companyId,
        recipientUserId: userId,
      },
    });

    if (!notification) {
      return NextResponse.json({ error: 'Notificación no encontrada' }, { status: 404 });
    }

    // Marcar como leída (SENT)
    await prisma.notificationOutbox.update({
      where: { id: notificationId },
      data: {
        status: 'SENT',
        sentAt: new Date(),
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[NOTIFICATIONS] Error marking as read:', error);
    return NextResponse.json(
      { error: 'Error al marcar notificación' },
      { status: 500 }
    );
  }
}
