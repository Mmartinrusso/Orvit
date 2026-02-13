import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';
import { prisma } from '@/lib/prisma';
import { JWT_SECRET } from '@/lib/auth';

export const dynamic = 'force-dynamic';

const JWT_SECRET_KEY = new TextEncoder().encode(JWT_SECRET);

async function getUserFromToken() {
  try {
    const token = cookies().get('token')?.value;
    if (!token) return null;

    const { payload } = await jwtVerify(token, JWT_SECRET_KEY);

    const user = await prisma.user.findUnique({
      where: { id: payload.userId as number },
      select: {
        id: true,
        companies: {
          select: { companyId: true },
          take: 1
        }
      }
    });

    return user;
  } catch (error) {
    return null;
  }
}

// GET - Obtener todas las categorías
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
    const includeInactive = searchParams.get('includeInactive') === 'true';
    const flat = searchParams.get('flat') === 'true';

    const where: any = { companyId };
    if (!includeInactive) {
      where.isActive = true;
    }

    if (flat) {
      // Retorna lista plana con todas las categorías
      const categories = await prisma.supplyCategory.findMany({
        where,
        orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
        include: {
          parent: { select: { id: true, name: true } },
          _count: { select: { supplies: true, children: true } }
        }
      });

      return NextResponse.json({ categories });
    }

    // Retorna árbol jerárquico (solo categorías raíz, con children)
    const rootCategories = await prisma.supplyCategory.findMany({
      where: { ...where, parentId: null },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      include: {
        _count: { select: { supplies: true } },
        children: {
          where: includeInactive ? {} : { isActive: true },
          orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
          include: {
            _count: { select: { supplies: true } },
            children: {
              where: includeInactive ? {} : { isActive: true },
              orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
              include: {
                _count: { select: { supplies: true } }
              }
            }
          }
        }
      }
    });

    return NextResponse.json({ categories: rootCategories });
  } catch (error) {
    console.error('Error fetching categories:', error);
    return NextResponse.json(
      { error: 'Error al obtener categorías' },
      { status: 500 }
    );
  }
}

// POST - Crear nueva categoría
export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromToken();
    if (!user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const companyId = user.companies?.[0]?.companyId;
    if (!companyId) {
      return NextResponse.json({ error: 'Usuario no tiene empresa asignada' }, { status: 400 });
    }

    const body = await request.json();
    const { name, description, code, color, icon, parentId, sortOrder } = body;

    if (!name?.trim()) {
      return NextResponse.json({ error: 'El nombre es requerido' }, { status: 400 });
    }

    // Verificar nombre único en la empresa
    const existing = await prisma.supplyCategory.findFirst({
      where: {
        companyId,
        name: name.trim()
      }
    });

    if (existing) {
      return NextResponse.json({ error: 'Ya existe una categoría con ese nombre' }, { status: 400 });
    }

    // Si tiene código, verificar que sea único
    if (code?.trim()) {
      const existingCode = await prisma.supplyCategory.findFirst({
        where: {
          companyId,
          code: code.trim()
        }
      });

      if (existingCode) {
        return NextResponse.json({ error: 'Ya existe una categoría con ese código' }, { status: 400 });
      }
    }

    // Verificar que el parent existe
    if (parentId) {
      const parent = await prisma.supplyCategory.findFirst({
        where: { id: parentId, companyId }
      });
      if (!parent) {
        return NextResponse.json({ error: 'Categoría padre no encontrada' }, { status: 400 });
      }
    }

    const category = await prisma.supplyCategory.create({
      data: {
        name: name.trim(),
        description: description?.trim() || null,
        code: code?.trim() || null,
        color: color || null,
        icon: icon || null,
        parentId: parentId || null,
        sortOrder: sortOrder ?? 0,
        companyId
      },
      include: {
        parent: { select: { id: true, name: true } },
        _count: { select: { supplies: true, children: true } }
      }
    });

    return NextResponse.json({ category }, { status: 201 });
  } catch (error) {
    console.error('Error creating category:', error);
    return NextResponse.json(
      { error: 'Error al crear categoría' },
      { status: 500 }
    );
  }
}
