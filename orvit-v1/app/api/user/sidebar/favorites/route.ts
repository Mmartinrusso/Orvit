import { NextRequest, NextResponse } from 'next/server';
import { getToken } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

/**
 * GET - Obtener los favoritos del sidebar del usuario
 * Returns: { favorites: string[] }  — array de moduleIds
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

    const preferences = user.sidebarPreferences as any;
    const favorites: string[] = preferences?.favorites ?? [];

    return NextResponse.json({ favorites });
  } catch (error) {
    console.error('Error fetching sidebar favorites:', error);
    return NextResponse.json(
      { error: 'Error al obtener favoritos' },
      { status: 500 }
    );
  }
}

/**
 * PUT - Actualizar favoritos del sidebar del usuario
 * Body: { favorites: string[] }
 */
export async function PUT(request: NextRequest) {
  try {
    const token = await getToken(request);
    if (!token) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const body = await request.json();
    const { favorites } = body;

    if (!Array.isArray(favorites)) {
      return NextResponse.json(
        { error: 'favorites debe ser un array' },
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
      favorites,
    };

    await prisma.user.update({
      where: { id: token.userId },
      data: { sidebarPreferences: updated },
    });

    return NextResponse.json({ success: true, favorites });
  } catch (error) {
    console.error('Error updating sidebar favorites:', error);
    return NextResponse.json(
      { error: 'Error al actualizar favoritos' },
      { status: 500 }
    );
  }
}
