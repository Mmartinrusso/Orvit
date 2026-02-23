import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserFromToken } from '@/lib/auth/shared-helpers';

export const dynamic = 'force-dynamic';

/**
 * GET /api/user/font-preferences
 * Returns the user's saved font preferences
 */
export async function GET() {
  try {
    const auth = await getUserFromToken();
    if (!auth) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: auth.id },
      select: { fontPreferences: true },
    });

    return NextResponse.json({ fontPreferences: user?.fontPreferences ?? null });
  } catch (error) {
    console.error('Error fetching font preferences:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}

/**
 * PUT /api/user/font-preferences
 * Save font preferences { fontSize: number, overrides: {...} }
 */
export async function PUT(request: Request) {
  try {
    const auth = await getUserFromToken();
    if (!auth) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const body = await request.json();
    const { fontSize, overrides } = body;

    if (typeof fontSize !== 'number' || fontSize < 14 || fontSize > 22) {
      return NextResponse.json({ error: 'fontSize inválido' }, { status: 400 });
    }

    const fontPreferences = { fontSize, overrides: overrides ?? {} };

    await prisma.user.update({
      where: { id: auth.id },
      data: { fontPreferences },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Error saving font preferences:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
