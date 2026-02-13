import { NextRequest, NextResponse } from 'next/server';
import { getToken } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getDefaultUserPreferences } from '@/lib/sidebar/ventas-modules';

export const dynamic = 'force-dynamic';

/**
 * GET - Get user's Ventas sidebar preferences
 */
export async function GET(request: NextRequest) {
  try {
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

    // If user has no preferences yet, return defaults
    const preferences = user.sidebarPreferences as any;
    const ventasPreferences = preferences?.ventas || getDefaultUserPreferences().ventas;

    return NextResponse.json({
      preferences: ventasPreferences,
    });
  } catch (error) {
    console.error('Error fetching sidebar preferences:', error);
    return NextResponse.json(
      { error: 'Error al obtener preferencias' },
      { status: 500 }
    );
  }
}

/**
 * PUT - Update user's Ventas sidebar preferences
 *
 * Body:
 * {
 *   visible: string[],  // Array of module IDs that should be visible
 *   pinned: string[],   // Array of module IDs that should be pinned
 *   order: string[],    // Array of module IDs in custom order
 *   collapsed: string[] // Array of section IDs that should be collapsed
 * }
 */
export async function PUT(request: NextRequest) {
  try {
    const token = await getToken(request);
    if (!token) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const body = await request.json();
    const { visible, pinned, order, collapsed } = body;

    // Validate input
    if (!Array.isArray(visible) || !Array.isArray(pinned) || !Array.isArray(order)) {
      return NextResponse.json(
        { error: 'Formato de preferencias inválido' },
        { status: 400 }
      );
    }

    // Fetch current preferences
    const user = await prisma.user.findUnique({
      where: { id: token.userId },
      select: { sidebarPreferences: true },
    });

    if (!user) {
      return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 });
    }

    const currentPreferences = (user.sidebarPreferences as any) || {};

    // Update only Ventas preferences
    const updatedPreferences = {
      ...currentPreferences,
      ventas: {
        visible,
        pinned,
        order,
        collapsed: collapsed || [],
      },
    };

    // Save to database
    await prisma.user.update({
      where: { id: token.userId },
      data: { sidebarPreferences: updatedPreferences },
    });

    return NextResponse.json({
      success: true,
      preferences: updatedPreferences.ventas,
    });
  } catch (error) {
    console.error('Error updating sidebar preferences:', error);
    return NextResponse.json(
      { error: 'Error al actualizar preferencias' },
      { status: 500 }
    );
  }
}
