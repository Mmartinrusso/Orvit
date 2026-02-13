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

/**
 * POST /api/compras/notifications/mark-all-read
 * Marca todas las notificaciones del usuario como leídas
 */
export async function POST(req: NextRequest) {
  try {
    const { userId, companyId } = await getUserFromToken();

    // Marcar todas como leídas
    const result = await prisma.notificationOutbox.updateMany({
      where: {
        companyId,
        recipientUserId: userId,
        status: { in: ['PENDING', 'PROCESSING'] },
      },
      data: {
        status: 'SENT',
        sentAt: new Date(),
      },
    });

    return NextResponse.json({
      success: true,
      count: result.count,
    });
  } catch (error) {
    console.error('[NOTIFICATIONS] Error marking all as read:', error);
    return NextResponse.json(
      { error: 'Error al marcar notificaciones' },
      { status: 500 }
    );
  }
}
