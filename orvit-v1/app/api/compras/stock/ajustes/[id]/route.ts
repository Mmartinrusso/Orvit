import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';
import { prisma } from '@/lib/prisma';
import { JWT_SECRET } from '@/lib/auth';

export const dynamic = 'force-dynamic';

const JWT_SECRET_KEY = new TextEncoder().encode(JWT_SECRET);

async function getUserFromToken() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;
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

// GET - Obtener detalle de ajuste
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

    const ajusteId = parseInt(params.id);
    if (isNaN(ajusteId)) {
      return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
    }

    const ajuste = await prisma.stockAdjustment.findFirst({
      where: { id: ajusteId, companyId },
      include: {
        warehouse: {
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
            cantidadAnterior: true,
            cantidadPosterior: true,
            createdAt: true
          }
        }
      }
    });

    if (!ajuste) {
      return NextResponse.json({ error: 'Ajuste no encontrado' }, { status: 404 });
    }

    return NextResponse.json(ajuste);
  } catch (error) {
    console.error('Error fetching ajuste:', error);
    return NextResponse.json(
      { error: 'Error al obtener el ajuste' },
      { status: 500 }
    );
  }
}

// PUT - Actualizar ajuste (solo si está en BORRADOR)
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

    const ajusteId = parseInt(params.id);
    if (isNaN(ajusteId)) {
      return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
    }

    const ajuste = await prisma.stockAdjustment.findFirst({
      where: { id: ajusteId, companyId }
    });

    if (!ajuste) {
      return NextResponse.json({ error: 'Ajuste no encontrado' }, { status: 404 });
    }

    if (ajuste.estado !== 'BORRADOR') {
      return NextResponse.json(
        { error: 'Solo se pueden editar ajustes en estado BORRADOR' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { motivo, motivoDetalle, reasonCode, notas, adjuntos, items } = body;

    // Actualizar en transacción
    const ajusteActualizado = await prisma.$transaction(async (tx) => {
      // Actualizar datos principales
      const updated = await tx.stockAdjustment.update({
        where: { id: ajusteId },
        data: {
          ...(motivo && { motivo }),
          ...(motivoDetalle !== undefined && { motivoDetalle }),
          ...(reasonCode !== undefined && { reasonCode }),
          ...(notas !== undefined && { notas }),
          ...(adjuntos && { adjuntos }),
        }
      });

      // Si vienen items, reemplazar
      if (items && Array.isArray(items)) {
        // Eliminar items existentes
        await tx.stockAdjustmentItem.deleteMany({
          where: { adjustmentId: ajusteId }
        });

        // Obtener stock actual
        const supplierItemIds = items.map((i: any) => parseInt(i.supplierItemId));
        const stockLocations = await tx.stockLocation.findMany({
          where: {
            warehouseId: ajuste.warehouseId,
            supplierItemId: { in: supplierItemIds }
          }
        });

        const stockByItem = new Map<number, number>();
        for (const loc of stockLocations) {
          stockByItem.set(loc.supplierItemId, Number(loc.cantidad || 0));
        }

        // Crear nuevos items
        let cantidadTotalPositiva = 0;
        let cantidadTotalNegativa = 0;

        const itemsData = items.map((item: any) => {
          const cantidadNueva = parseFloat(item.cantidadNueva || '0');
          const stockActual = stockByItem.get(parseInt(item.supplierItemId)) || 0;
          const diferencia = cantidadNueva - stockActual;

          if (diferencia > 0) {
            cantidadTotalPositiva += diferencia;
          } else {
            cantidadTotalNegativa += Math.abs(diferencia);
          }

          return {
            adjustmentId: ajusteId,
            supplierItemId: parseInt(item.supplierItemId),
            cantidadAnterior: stockActual,
            cantidadNueva,
            diferencia,
            notas: item.notas || null
          };
        });

        await tx.stockAdjustmentItem.createMany({ data: itemsData });

        // Actualizar totales
        await tx.stockAdjustment.update({
          where: { id: ajusteId },
          data: {
            cantidadPositiva: cantidadTotalPositiva,
            cantidadNegativa: cantidadTotalNegativa
          }
        });
      }

      return updated;
    });

    // Obtener ajuste completo
    const ajusteCompleto = await prisma.stockAdjustment.findUnique({
      where: { id: ajusteId },
      include: {
        warehouse: { select: { id: true, codigo: true, nombre: true } },
        items: {
          include: {
            supplierItem: {
              select: { id: true, nombre: true, unidad: true }
            }
          }
        }
      }
    });

    return NextResponse.json(ajusteCompleto);
  } catch (error) {
    console.error('Error updating ajuste:', error);
    return NextResponse.json(
      { error: 'Error al actualizar el ajuste' },
      { status: 500 }
    );
  }
}

// DELETE - Eliminar ajuste (solo si está en BORRADOR)
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

    const ajusteId = parseInt(params.id);
    if (isNaN(ajusteId)) {
      return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
    }

    const ajuste = await prisma.stockAdjustment.findFirst({
      where: { id: ajusteId, companyId }
    });

    if (!ajuste) {
      return NextResponse.json({ error: 'Ajuste no encontrado' }, { status: 404 });
    }

    if (ajuste.estado !== 'BORRADOR') {
      return NextResponse.json(
        { error: 'Solo se pueden eliminar ajustes en estado BORRADOR' },
        { status: 400 }
      );
    }

    // Eliminar en transacción
    await prisma.$transaction(async (tx) => {
      // Eliminar items primero
      await tx.stockAdjustmentItem.deleteMany({
        where: { adjustmentId: ajusteId }
      });

      // Eliminar ajuste
      await tx.stockAdjustment.delete({
        where: { id: ajusteId }
      });
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting ajuste:', error);
    return NextResponse.json(
      { error: 'Error al eliminar el ajuste' },
      { status: 500 }
    );
  }
}
