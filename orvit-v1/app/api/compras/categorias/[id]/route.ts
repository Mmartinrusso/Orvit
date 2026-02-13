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

// GET - Obtener una categoría por ID
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getUserFromToken();
    if (!user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const companyId = user.companies?.[0]?.companyId;
    if (!companyId) {
      return NextResponse.json({ error: 'Usuario no tiene empresa asignada' }, { status: 400 });
    }

    const id = parseInt(params.id);
    if (isNaN(id)) {
      return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
    }

    const category = await prisma.supplyCategory.findFirst({
      where: { id, companyId },
      include: {
        parent: { select: { id: true, name: true } },
        children: {
          orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
          include: {
            _count: { select: { supplies: true } }
          }
        },
        supplies: {
          take: 10,
          orderBy: { name: 'asc' },
          select: {
            id: true,
            name: true,
            code: true
          }
        },
        _count: { select: { supplies: true, children: true } }
      }
    });

    if (!category) {
      return NextResponse.json({ error: 'Categoría no encontrada' }, { status: 404 });
    }

    return NextResponse.json({ category });
  } catch (error) {
    console.error('Error fetching category:', error);
    return NextResponse.json(
      { error: 'Error al obtener categoría' },
      { status: 500 }
    );
  }
}

// PATCH - Actualizar categoría
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getUserFromToken();
    if (!user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const companyId = user.companies?.[0]?.companyId;
    if (!companyId) {
      return NextResponse.json({ error: 'Usuario no tiene empresa asignada' }, { status: 400 });
    }

    const id = parseInt(params.id);
    if (isNaN(id)) {
      return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
    }

    // Verificar que la categoría existe y pertenece a la empresa
    const existing = await prisma.supplyCategory.findFirst({
      where: { id, companyId }
    });

    if (!existing) {
      return NextResponse.json({ error: 'Categoría no encontrada' }, { status: 404 });
    }

    const body = await request.json();
    const { name, description, code, color, icon, parentId, sortOrder, isActive } = body;

    // Si cambia el nombre, verificar que no exista
    if (name?.trim() && name.trim() !== existing.name) {
      const duplicateName = await prisma.supplyCategory.findFirst({
        where: {
          companyId,
          name: name.trim(),
          id: { not: id }
        }
      });

      if (duplicateName) {
        return NextResponse.json({ error: 'Ya existe una categoría con ese nombre' }, { status: 400 });
      }
    }

    // Si cambia el código, verificar que no exista
    if (code !== undefined && code?.trim() && code.trim() !== existing.code) {
      const duplicateCode = await prisma.supplyCategory.findFirst({
        where: {
          companyId,
          code: code.trim(),
          id: { not: id }
        }
      });

      if (duplicateCode) {
        return NextResponse.json({ error: 'Ya existe una categoría con ese código' }, { status: 400 });
      }
    }

    // Verificar que el parent existe y evitar ciclos
    if (parentId !== undefined && parentId !== null) {
      if (parentId === id) {
        return NextResponse.json({ error: 'Una categoría no puede ser su propio padre' }, { status: 400 });
      }

      const parent = await prisma.supplyCategory.findFirst({
        where: { id: parentId, companyId }
      });

      if (!parent) {
        return NextResponse.json({ error: 'Categoría padre no encontrada' }, { status: 400 });
      }

      // Verificar que no se cree un ciclo (el nuevo padre no puede ser hijo de esta categoría)
      const isDescendant = await checkIsDescendant(parentId, id, companyId);
      if (isDescendant) {
        return NextResponse.json({ error: 'No se puede establecer un hijo como padre (ciclo detectado)' }, { status: 400 });
      }
    }

    const updateData: any = {};
    if (name !== undefined) updateData.name = name.trim();
    if (description !== undefined) updateData.description = description?.trim() || null;
    if (code !== undefined) updateData.code = code?.trim() || null;
    if (color !== undefined) updateData.color = color || null;
    if (icon !== undefined) updateData.icon = icon || null;
    if (parentId !== undefined) updateData.parentId = parentId;
    if (sortOrder !== undefined) updateData.sortOrder = sortOrder;
    if (isActive !== undefined) updateData.isActive = isActive;

    const category = await prisma.supplyCategory.update({
      where: { id },
      data: updateData,
      include: {
        parent: { select: { id: true, name: true } },
        _count: { select: { supplies: true, children: true } }
      }
    });

    return NextResponse.json({ category });
  } catch (error) {
    console.error('Error updating category:', error);
    return NextResponse.json(
      { error: 'Error al actualizar categoría' },
      { status: 500 }
    );
  }
}

// DELETE - Eliminar categoría
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getUserFromToken();
    if (!user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const companyId = user.companies?.[0]?.companyId;
    if (!companyId) {
      return NextResponse.json({ error: 'Usuario no tiene empresa asignada' }, { status: 400 });
    }

    const id = parseInt(params.id);
    if (isNaN(id)) {
      return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
    }

    // Verificar que la categoría existe y pertenece a la empresa
    const existing = await prisma.supplyCategory.findFirst({
      where: { id, companyId },
      include: {
        _count: { select: { supplies: true, children: true } }
      }
    });

    if (!existing) {
      return NextResponse.json({ error: 'Categoría no encontrada' }, { status: 404 });
    }

    // Verificar si tiene supplies o subcategorías
    if (existing._count.supplies > 0) {
      return NextResponse.json(
        { error: `No se puede eliminar: tiene ${existing._count.supplies} insumos asignados. Mueve los insumos a otra categoría primero.` },
        { status: 400 }
      );
    }

    if (existing._count.children > 0) {
      return NextResponse.json(
        { error: `No se puede eliminar: tiene ${existing._count.children} subcategorías. Elimina o mueve las subcategorías primero.` },
        { status: 400 }
      );
    }

    await prisma.supplyCategory.delete({
      where: { id }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting category:', error);
    return NextResponse.json(
      { error: 'Error al eliminar categoría' },
      { status: 500 }
    );
  }
}

// Helper para verificar si categoryA es descendiente de categoryB
async function checkIsDescendant(categoryA: number, categoryB: number, companyId: number): Promise<boolean> {
  const children = await prisma.supplyCategory.findMany({
    where: { parentId: categoryB, companyId },
    select: { id: true }
  });

  for (const child of children) {
    if (child.id === categoryA) return true;
    const isDesc = await checkIsDescendant(categoryA, child.id, companyId);
    if (isDesc) return true;
  }

  return false;
}
