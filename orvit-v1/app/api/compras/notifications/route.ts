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
 * GET /api/compras/notifications
 * Obtiene las notificaciones del usuario actual
 *
 * Query params:
 * - limit: number (default 50)
 * - unreadOnly: boolean (default false)
 * - types: string[] (comma separated)
 */
export async function GET(req: NextRequest) {
  try {
    const { userId, companyId } = await getUserFromToken();
    const { searchParams } = new URL(req.url);

    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const unreadOnly = searchParams.get('unreadOnly') === 'true';
    const types = searchParams.get('types')?.split(',').filter(Boolean);

    // Build where clause
    const where: any = {
      companyId,
      recipientUserId: userId,
    };

    if (unreadOnly) {
      where.status = { in: ['PENDING', 'PROCESSING'] };
    }

    if (types && types.length > 0) {
      where.type = { in: types };
    }

    // Get notifications
    const notifications = await prisma.notificationOutbox.findMany({
      where,
      orderBy: [
        { priority: 'asc' }, // URGENTE first
        { createdAt: 'desc' },
      ],
      take: limit,
    });

    // Count unread
    const unreadCount = await prisma.notificationOutbox.count({
      where: {
        companyId,
        recipientUserId: userId,
        status: { in: ['PENDING', 'PROCESSING'] },
      },
    });

    return NextResponse.json({
      notifications,
      unreadCount,
      total: notifications.length,
    });
  } catch (error) {
    console.error('[NOTIFICATIONS] Error:', error);
    return NextResponse.json(
      { error: 'Error al obtener notificaciones' },
      { status: 500 }
    );
  }
}
