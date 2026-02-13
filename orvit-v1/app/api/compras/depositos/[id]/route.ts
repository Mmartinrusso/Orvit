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

// GET - Obtener depósito por ID
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

    const deposito = await prisma.warehouse.findFirst({
      where: { id, companyId },
      include: {
        stockLocations: {
          include: {
            supplierItem: {
              select: {
                id: true,
                nombre: true,
                unidad: true,
                supplier: {
                  select: { id: true, name: true }
                }
              }
            }
          }
        },
        _count: {
          select: {
            stockLocations: true,
            goodsReceipts: true,
            stockMovements: true,
          }
        }
      }
    });

    if (!deposito) {
      return NextResponse.json({ error: 'Depósito no encontrado' }, { status: 404 });
    }

    return NextResponse.json(deposito);
  } catch (error) {
    console.error('Error fetching deposito:', error);
    return NextResponse.json(
      { error: 'Error al obtener el depósito' },
      { status: 500 }
    );
  }
}

// PUT - Actualizar depósito
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

    // Verificar que existe y pertenece a la empresa
    const existente = await prisma.warehouse.findFirst({
      where: { id, companyId }
    });

    if (!existente) {
      return NextResponse.json({ error: 'Depósito no encontrado' }, { status: 404 });
    }

    const body = await request.json();
    const { codigo, nombre, descripcion, direccion, isDefault, isActive } = body;

    // Si cambia el código, verificar que no exista otro con ese código
    if (codigo && codigo.trim().toUpperCase() !== existente.codigo) {
      const duplicado = await prisma.warehouse.findUnique({
        where: {
          companyId_codigo: {
            companyId,
            codigo: codigo.trim().toUpperCase()
          }
        }
      });

      if (duplicado) {
        return NextResponse.json(
          { error: 'Ya existe un depósito con ese código' },
          { status: 400 }
        );
      }
    }

    // Si se está marcando como default, quitar default de los demás
    if (isDefault && !existente.isDefault) {
      await prisma.warehouse.updateMany({
        where: { companyId, isDefault: true },
        data: { isDefault: false }
      });
    }

    const depositoActualizado = await prisma.warehouse.update({
      where: { id },
      data: {
        ...(codigo && { codigo: codigo.trim().toUpperCase() }),
        ...(nombre && { nombre: nombre.trim() }),
        ...(descripcion !== undefined && { descripcion: descripcion?.trim() || null }),
        ...(direccion !== undefined && { direccion: direccion?.trim() || null }),
        ...(isDefault !== undefined && { isDefault }),
        ...(isActive !== undefined && { isActive }),
      },
    });

    return NextResponse.json(depositoActualizado);
  } catch (error) {
    console.error('Error updating deposito:', error);
    return NextResponse.json(
      { error: 'Error al actualizar el depósito' },
      { status: 500 }
    );
  }
}

// DELETE - Eliminar depósito (soft delete)
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

    // Verificar que existe y pertenece a la empresa
    const existente = await prisma.warehouse.findFirst({
      where: { id, companyId },
      include: {
        _count: {
          select: {
            stockLocations: true,
            goodsReceipts: true,
          }
        }
      }
    });

    if (!existente) {
      return NextResponse.json({ error: 'Depósito no encontrado' }, { status: 404 });
    }

    // No permitir eliminar si tiene stock o recepciones
    if (existente._count.stockLocations > 0) {
      return NextResponse.json(
        { error: 'No se puede eliminar un depósito con stock. Desactívelo en su lugar.' },
        { status: 400 }
      );
    }

    if (existente._count.goodsReceipts > 0) {
      return NextResponse.json(
        { error: 'No se puede eliminar un depósito con recepciones. Desactívelo en su lugar.' },
        { status: 400 }
      );
    }

    // Soft delete: marcar como inactivo
    await prisma.warehouse.update({
      where: { id },
      data: { isActive: false }
    });

    return NextResponse.json({ message: 'Depósito desactivado correctamente' });
  } catch (error) {
    console.error('Error deleting deposito:', error);
    return NextResponse.json(
      { error: 'Error al eliminar el depósito' },
      { status: 500 }
    );
  }
}
