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
        name: true,
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

// GET - Obtener detalle de transferencia
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

    const transferId = parseInt(params.id);
    if (isNaN(transferId)) {
      return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
    }

    const transferencia = await prisma.stockTransfer.findFirst({
      where: { id: transferId, companyId },
      include: {
        warehouseOrigen: {
          select: { id: true, codigo: true, nombre: true }
        },
        warehouseDestino: {
          select: { id: true, codigo: true, nombre: true }
        },
        createdByUser: {
          select: { id: true, name: true }
        },
        items: {
          include: {
            supplierItem: {
              select: {
                id: true,
                nombre: true,
                unidad: true,
                codigoProveedor: true,
                supplier: {
                  select: { id: true, name: true }
                }
              }
            }
          }
        },
        stockMovements: {
          select: {
            id: true,
            tipo: true,
            cantidad: true,
            warehouseId: true,
            createdAt: true
          }
        }
      }
    });

    if (!transferencia) {
      return NextResponse.json({ error: 'Transferencia no encontrada' }, { status: 404 });
    }

    return NextResponse.json(transferencia);
  } catch (error) {
    console.error('Error fetching transferencia:', error);
    return NextResponse.json(
      { error: 'Error al obtener la transferencia' },
      { status: 500 }
    );
  }
}

// PUT - Actualizar transferencia (solo si está en BORRADOR)
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

    const transferId = parseInt(params.id);
    if (isNaN(transferId)) {
      return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
    }

    const transferencia = await prisma.stockTransfer.findFirst({
      where: { id: transferId, companyId }
    });

    if (!transferencia) {
      return NextResponse.json({ error: 'Transferencia no encontrada' }, { status: 404 });
    }

    if (transferencia.estado !== 'BORRADOR') {
      return NextResponse.json(
        { error: 'Solo se pueden editar transferencias en estado BORRADOR' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { motivo, notas, items } = body;

    // Actualizar en transacción
    await prisma.$transaction(async (tx) => {
      // Actualizar datos principales
      await tx.stockTransfer.update({
        where: { id: transferId },
        data: {
          ...(motivo !== undefined && { motivo }),
          ...(notas !== undefined && { notas }),
        }
      });

      // Si vienen items, reemplazar
      if (items && Array.isArray(items)) {
        // Eliminar items existentes
        await tx.stockTransferItem.deleteMany({
          where: { transferId }
        });

        // Crear nuevos items
        await tx.stockTransferItem.createMany({
          data: items.map((item: any) => ({
            transferId,
            supplierItemId: parseInt(item.supplierItemId),
            cantidadSolicitada: parseFloat(item.cantidad || item.cantidadSolicitada),
            cantidadEnviada: 0,
            cantidadRecibida: 0,
            notas: item.notas || null
          }))
        });
      }
    });

    // Obtener transferencia completa
    const transferenciaActualizada = await prisma.stockTransfer.findUnique({
      where: { id: transferId },
      include: {
        warehouseOrigen: { select: { id: true, codigo: true, nombre: true } },
        warehouseDestino: { select: { id: true, codigo: true, nombre: true } },
        items: {
          include: {
            supplierItem: {
              select: { id: true, nombre: true, unidad: true }
            }
          }
        }
      }
    });

    return NextResponse.json(transferenciaActualizada);
  } catch (error) {
    console.error('Error updating transferencia:', error);
    return NextResponse.json(
      { error: 'Error al actualizar la transferencia' },
      { status: 500 }
    );
  }
}

// DELETE - Eliminar/Cancelar transferencia (solo si está en BORRADOR)
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

    const transferId = parseInt(params.id);
    if (isNaN(transferId)) {
      return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
    }

    const transferencia = await prisma.stockTransfer.findFirst({
      where: { id: transferId, companyId }
    });

    if (!transferencia) {
      return NextResponse.json({ error: 'Transferencia no encontrada' }, { status: 404 });
    }

    if (transferencia.estado !== 'BORRADOR') {
      return NextResponse.json(
        { error: 'Solo se pueden eliminar transferencias en estado BORRADOR' },
        { status: 400 }
      );
    }

    // Eliminar en transacción
    await prisma.$transaction(async (tx) => {
      await tx.stockTransferItem.deleteMany({
        where: { transferId }
      });

      await tx.stockTransfer.delete({
        where: { id: transferId }
      });
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting transferencia:', error);
    return NextResponse.json(
      { error: 'Error al eliminar la transferencia' },
      { status: 500 }
    );
  }
}
