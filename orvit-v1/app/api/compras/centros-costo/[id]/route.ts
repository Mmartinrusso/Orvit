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

// GET - Obtener centro de costo por ID
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

    const centroCosto = await prisma.costCenter.findFirst({
      where: { id, companyId },
      include: {
        parent: { select: { id: true, codigo: true, nombre: true } },
        children: { select: { id: true, codigo: true, nombre: true, isActive: true } },
        _count: {
          select: { purchaseOrders: true, receipts: true }
        }
      }
    });

    if (!centroCosto) {
      return NextResponse.json({ error: 'Centro de costo no encontrado' }, { status: 404 });
    }

    return NextResponse.json(centroCosto);
  } catch (error) {
    console.error('Error fetching centro de costo:', error);
    return NextResponse.json(
      { error: 'Error al obtener el centro de costo' },
      { status: 500 }
    );
  }
}

// PUT - Actualizar centro de costo
export async function PUT(
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

    const existente = await prisma.costCenter.findFirst({
      where: { id, companyId }
    });

    if (!existente) {
      return NextResponse.json({ error: 'Centro de costo no encontrado' }, { status: 404 });
    }

    const body = await request.json();
    const { codigo, nombre, descripcion, parentId, isActive } = body;

    // Si cambia el código, verificar que no exista otro
    if (codigo && codigo.trim().toUpperCase() !== existente.codigo) {
      const duplicado = await prisma.costCenter.findUnique({
        where: {
          companyId_codigo: {
            companyId,
            codigo: codigo.trim().toUpperCase()
          }
        }
      });

      if (duplicado) {
        return NextResponse.json(
          { error: 'Ya existe un centro de costo con ese código' },
          { status: 400 }
        );
      }
    }

    // Evitar ciclos en la jerarquía
    if (parentId && parseInt(parentId) === id) {
      return NextResponse.json(
        { error: 'Un centro de costo no puede ser su propio padre' },
        { status: 400 }
      );
    }

    const centroActualizado = await prisma.costCenter.update({
      where: { id },
      data: {
        ...(codigo && { codigo: codigo.trim().toUpperCase() }),
        ...(nombre && { nombre: nombre.trim() }),
        ...(descripcion !== undefined && { descripcion: descripcion?.trim() || null }),
        ...(parentId !== undefined && { parentId: parentId ? parseInt(parentId) : null }),
        ...(isActive !== undefined && { isActive }),
      },
      include: {
        parent: { select: { id: true, codigo: true, nombre: true } }
      }
    });

    return NextResponse.json(centroActualizado);
  } catch (error) {
    console.error('Error updating centro de costo:', error);
    return NextResponse.json(
      { error: 'Error al actualizar el centro de costo' },
      { status: 500 }
    );
  }
}

// DELETE - Desactivar centro de costo
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

    const existente = await prisma.costCenter.findFirst({
      where: { id, companyId },
      include: {
        _count: {
          select: { purchaseOrders: true, receipts: true, children: true }
        }
      }
    });

    if (!existente) {
      return NextResponse.json({ error: 'Centro de costo no encontrado' }, { status: 404 });
    }

    // No eliminar si tiene hijos
    if (existente._count.children > 0) {
      return NextResponse.json(
        { error: 'No se puede eliminar un centro de costo con sub-centros. Elimine los hijos primero.' },
        { status: 400 }
      );
    }

    // Soft delete
    await prisma.costCenter.update({
      where: { id },
      data: { isActive: false }
    });

    return NextResponse.json({ message: 'Centro de costo desactivado' });
  } catch (error) {
    console.error('Error deleting centro de costo:', error);
    return NextResponse.json(
      { error: 'Error al eliminar el centro de costo' },
      { status: 500 }
    );
  }
}
