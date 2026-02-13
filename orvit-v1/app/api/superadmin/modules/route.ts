import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';
import { JWT_SECRET } from '@/lib/auth';

export const dynamic = 'force-dynamic';

const JWT_SECRET_KEY = new TextEncoder().encode(JWT_SECRET);

/**
 * Verifica que el usuario sea SUPERADMIN
 */
async function verifySuperAdmin(): Promise<{ userId: number } | null> {
  const token = cookies().get('token')?.value;

  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, JWT_SECRET_KEY);
    const userId = payload.userId as number;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, role: true }
    });

    if (!user || user.role !== 'SUPERADMIN') return null;

    return { userId };
  } catch {
    return null;
  }
}

/**
 * GET /api/superadmin/modules
 * Obtiene el catálogo completo de módulos (solo SUPERADMIN)
 */
export async function GET(request: NextRequest) {
  const auth = await verifySuperAdmin();
  if (!auth) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }

  try {
    const modules = await prisma.module.findMany({
      orderBy: [
        { category: 'asc' },
        { sortOrder: 'asc' }
      ],
      select: {
        id: true,
        key: true,
        name: true,
        description: true,
        category: true,
        icon: true,
        isActive: true,
        sortOrder: true,
        dependencies: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: {
            companies: {
              where: { isEnabled: true }
            }
          }
        }
      }
    });

    return NextResponse.json({
      modules: modules.map(m => ({
        ...m,
        enabledCompaniesCount: m._count.companies,
        _count: undefined
      }))
    });
  } catch (error) {
    console.error('Error fetching modules:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/superadmin/modules
 * Crea un nuevo módulo (solo SUPERADMIN)
 */
export async function POST(request: NextRequest) {
  const auth = await verifySuperAdmin();
  if (!auth) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { key, name, description, category, icon, dependencies = [] } = body;

    if (!key || !name || !category) {
      return NextResponse.json(
        { error: 'key, name y category son requeridos' },
        { status: 400 }
      );
    }

    // Verificar que no exista un módulo con el mismo key
    const existing = await prisma.module.findUnique({
      where: { key }
    });

    if (existing) {
      return NextResponse.json(
        { error: `Ya existe un módulo con key "${key}"` },
        { status: 400 }
      );
    }

    // Obtener el mayor sortOrder de la categoría
    const maxSortOrder = await prisma.module.aggregate({
      where: { category },
      _max: { sortOrder: true }
    });

    const module = await prisma.module.create({
      data: {
        key,
        name,
        description: description || null,
        category,
        icon: icon || null,
        dependencies,
        sortOrder: (maxSortOrder._max.sortOrder || 0) + 1
      }
    });

    return NextResponse.json({ module }, { status: 201 });
  } catch (error) {
    console.error('Error creating module:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/superadmin/modules
 * Actualiza un módulo existente (solo SUPERADMIN)
 */
export async function PUT(request: NextRequest) {
  const auth = await verifySuperAdmin();
  if (!auth) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { id, name, description, icon, isActive, sortOrder, dependencies } = body;

    if (!id) {
      return NextResponse.json(
        { error: 'id es requerido' },
        { status: 400 }
      );
    }

    const module = await prisma.module.update({
      where: { id },
      data: {
        ...(name && { name }),
        ...(description !== undefined && { description }),
        ...(icon !== undefined && { icon }),
        ...(isActive !== undefined && { isActive }),
        ...(sortOrder !== undefined && { sortOrder }),
        ...(dependencies !== undefined && { dependencies })
      }
    });

    return NextResponse.json({ module });
  } catch (error) {
    console.error('Error updating module:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
