import { NextRequest, NextResponse } from 'next/server';
import { getToken } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth/shared-helpers';

export const dynamic = 'force-dynamic';

/**
 * GET - Get user's Ventas sidebar collapsed groups
 * Since Paso 7, the company admin controls structure (visible/order/pinned).
 * Only the user's collapsed state is personal.
 */
export async function GET(request: NextRequest) {
  try {
    const { user: authUser, error: authError } = await requireAuth();
    if (authError) return authError;

    const token = await getToken(request);
    if (!token) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: token.userId },
      select: { sidebarPreferences: true },
    });

    if (!user) {
      return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 });
    }

    const preferences = user.sidebarPreferences as any;
    const collapsed: string[] = preferences?.ventas?.collapsed ?? [];

    return NextResponse.json({ collapsed });
  } catch (error) {
    console.error('Error fetching sidebar preferences:', error);
    return NextResponse.json(
      { error: 'Error al obtener preferencias' },
      { status: 500 }
    );
  }
}

/**
 * PUT - Update user's Ventas collapsed groups
 * Body: { collapsed: string[] }
 */
export async function PUT(request: NextRequest) {
  try {
    const { user: authUser, error: authError } = await requireAuth();
    if (authError) return authError;

    const token = await getToken(request);
    if (!token) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const body = await request.json();
    const { collapsed } = body;

    if (!Array.isArray(collapsed)) {
      return NextResponse.json(
        { error: 'collapsed debe ser un array' },
        { status: 400 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { id: token.userId },
      select: { sidebarPreferences: true },
    });

    if (!user) {
      return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 });
    }

    const current = (user.sidebarPreferences as any) || {};
    const updated = {
      ...current,
      ventas: { collapsed },
    };

    await prisma.user.update({
      where: { id: token.userId },
      data: { sidebarPreferences: updated },
    });

    return NextResponse.json({ success: true, collapsed });
  } catch (error) {
    console.error('Error updating sidebar preferences:', error);
    return NextResponse.json(
      { error: 'Error al actualizar preferencias' },
      { status: 500 }
    );
  }
}
