import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';
import { prisma } from '@/lib/prisma';
import { JWT_SECRET } from '@/lib/auth'; // ✅ Importar el mismo secret

const JWT_SECRET_KEY = new TextEncoder().encode(JWT_SECRET);

async function getUserFromToken() {
  try {
    const token = cookies().get('token')?.value;
    if (!token) return null;

    const { payload } = await jwtVerify(token, JWT_SECRET_KEY);

    const user = await prisma.user.findUnique({
      where: { id: payload.userId as number },
      include: {
        companies: {
          include: {
            company: true,
          },
        },
      },
    });

    return user;
  } catch (error) {
    console.error('Error obteniendo usuario desde JWT:', error);
    return null;
  }
}

// PUT /api/compras/proveedores/[id]/items/[itemId] - Actualizar un item de proveedor
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string; itemId: string } },
) {
  try {
    const user = await getUserFromToken();
    if (!user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const companyId = user.companies?.[0]?.companyId;
    if (!companyId) {
      return NextResponse.json(
        { error: 'Usuario no tiene empresa asignada' },
        { status: 400 },
      );
    }

    const proveedorId = parseInt(params.id);
    const itemId = parseInt(params.itemId);

    if (!proveedorId || Number.isNaN(proveedorId) || !itemId || Number.isNaN(itemId)) {
      return NextResponse.json({ error: 'IDs inválidos' }, { status: 400 });
    }

    const body = await request.json();
    const { nombre, descripcion, unidad, precioUnitario, codigoProveedor, toolId } = body as {
      nombre?: string;
      descripcion?: string;
      unidad?: string;
      precioUnitario?: string;
      codigoProveedor?: string;
      toolId?: number | null;
    };

    if (!nombre || !unidad) {
      return NextResponse.json(
        { error: 'Nombre y unidad son obligatorios' },
        { status: 400 },
      );
    }

    const updated = await prisma.supplierItem.updateMany({
      where: {
        id: itemId,
        supplierId: proveedorId,
        companyId,
      },
      data: {
        nombre: nombre.trim(),
        descripcion: descripcion?.trim() || null,
        codigoProveedor: codigoProveedor?.trim() || null,
        unidad: unidad,
        precioUnitario:
          precioUnitario && precioUnitario !== ''
            ? parseFloat(precioUnitario)
            : null,
        ...(toolId !== undefined && { toolId: toolId ? parseInt(String(toolId)) : null }),
      },
    });

    if (updated.count === 0) {
      return NextResponse.json(
        { error: 'Item no encontrado para este proveedor' },
        { status: 404 },
      );
    }

    const item = await prisma.supplierItem.findUnique({
      where: { id: itemId },
      include: {
        supply: {
          select: {
            id: true,
            name: true,
            unit_measure: true,
          },
        },
        tool: {
          select: {
            id: true,
            name: true,
            code: true,
            itemType: true,
          },
        },
      },
    });

    if (!item) {
      return NextResponse.json(
        { error: 'Item actualizado pero no se pudo recuperar' },
        { status: 500 },
      );
    }

    return NextResponse.json(item);
  } catch (error) {
    console.error('Error actualizando supplier item:', error);
    return NextResponse.json(
      { error: 'Error al actualizar el item' },
      { status: 500 },
    );
  }
}


