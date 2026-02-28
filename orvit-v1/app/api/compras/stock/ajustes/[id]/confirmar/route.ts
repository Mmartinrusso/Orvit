import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';
import { prisma } from '@/lib/prisma';
import { JWT_SECRET } from '@/lib/auth';
import { logStateChange } from '@/lib/compras/audit-helper';
import { requirePermission } from '@/lib/auth/shared-helpers';

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

// Obtener docType predominante de un item basado en sus movimientos de entrada
// Si el item entró al stock via una compra T2, hereda T2
// Para ajustes negativos: hereda el docType existente
// Para ajustes positivos: usa T1 por defecto (ajuste manual)
async function getItemDocType(supplierItemId: number, companyId: number): Promise<'T1' | 'T2'> {
  const movimiento = await prisma.stockMovement.findFirst({
    where: {
      supplierItemId,
      companyId,
      tipo: 'ENTRADA_RECEPCION',
    },
    orderBy: { createdAt: 'desc' },
    select: { docType: true }
  });
  return movimiento?.docType === 'T2' ? 'T2' : 'T1';
}

// POST - Confirmar ajuste y aplicar cambios de stock
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Permission check: almacen.adjust
    const { error: permError } = await requirePermission('almacen.adjust');
    if (permError) return permError;

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
        items: {
          include: {
            supplierItem: {
              select: { id: true, nombre: true, unidad: true }
            }
          }
        }
      }
    });

    if (!ajuste) {
      return NextResponse.json({ error: 'Ajuste no encontrado' }, { status: 404 });
    }

    // Solo se puede confirmar desde BORRADOR o después de aprobación
    if (!['BORRADOR', 'PENDIENTE_APROBACION'].includes(ajuste.estado)) {
      return NextResponse.json(
        { error: `No se puede confirmar un ajuste en estado ${ajuste.estado}` },
        { status: 400 }
      );
    }

    // Si requería aprobación y aún está pendiente, no se puede confirmar sin aprobar
    if (ajuste.estado === 'PENDIENTE_APROBACION') {
      return NextResponse.json(
        { error: 'Este ajuste requiere aprobación antes de confirmarse' },
        { status: 400 }
      );
    }

    if (ajuste.items.length === 0) {
      return NextResponse.json({ error: 'El ajuste no tiene items' }, { status: 400 });
    }

    // Ejecutar en transacción
    const resultado = await prisma.$transaction(async (tx) => {
      const movimientosCreados = [];

      for (const item of ajuste.items) {
        // Obtener stock actual
        let stockLocation = await tx.stockLocation.findUnique({
          where: {
            warehouseId_supplierItemId: {
              warehouseId: ajuste.warehouseId,
              supplierItemId: item.supplierItemId
            }
          }
        });

        const cantidadAnterior = Number(stockLocation?.cantidad || 0);
        const cantidadNueva = Number(item.cantidadNueva);
        const diferencia = cantidadNueva - cantidadAnterior;

        // Obtener docType: para ajustes negativos hereda del item, para positivos usa T1
        // Esto es porque un ajuste positivo manual no debería crear stock T2
        const itemDocType = diferencia < 0
          ? await getItemDocType(item.supplierItemId, companyId)
          : 'T1' as const;

        // No permitir stock negativo
        if (cantidadNueva < 0) {
          throw new Error(`Stock negativo no permitido para ${item.supplierItem?.nombre || item.supplierItemId}`);
        }

        // Actualizar o crear stock location
        if (stockLocation) {
          await tx.stockLocation.update({
            where: { id: stockLocation.id },
            data: { cantidad: cantidadNueva }
          });
        } else {
          stockLocation = await tx.stockLocation.create({
            data: {
              warehouseId: ajuste.warehouseId,
              supplierItemId: item.supplierItemId,
              cantidad: cantidadNueva,
              cantidadReservada: 0,
              companyId
            }
          });
        }

        // Crear movimiento de stock (hereda docType según tipo de ajuste)
        const tipoMovimiento = diferencia >= 0 ? 'AJUSTE_POSITIVO' : 'AJUSTE_NEGATIVO';

        const movimiento = await tx.stockMovement.create({
          data: {
            tipo: tipoMovimiento,
            cantidad: Math.abs(diferencia),
            cantidadAnterior,
            cantidadPosterior: cantidadNueva,
            supplierItemId: item.supplierItemId,
            warehouseId: ajuste.warehouseId,
            adjustmentId: ajuste.id,
            sourceNumber: ajuste.numero,
            motivo: ajuste.motivo,
            notas: item.notas,
            docType: itemDocType,
            companyId,
            createdBy: user.id
          }
        });

        movimientosCreados.push(movimiento);
      }

      // Actualizar estado del ajuste
      const ajusteActualizado = await tx.stockAdjustment.update({
        where: { id: ajusteId },
        data: {
          estado: 'CONFIRMADO',
          fechaConfirmacion: new Date()
        }
      });

      return { ajuste: ajusteActualizado, movimientos: movimientosCreados };
    });

    // Registrar auditoría
    await logStateChange({
      entidad: 'stock_adjustment',
      entidadId: ajusteId,
      estadoAnterior: ajuste.estado,
      estadoNuevo: 'CONFIRMADO',
      companyId,
      userId: user.id,
      motivo: 'Confirmación de ajuste de inventario'
    });

    // Obtener ajuste completo para respuesta
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
        },
        stockMovements: {
          select: { id: true, tipo: true, cantidad: true }
        }
      }
    });

    return NextResponse.json({
      ...ajusteCompleto,
      message: 'Ajuste confirmado y stock actualizado correctamente'
    });
  } catch (error: any) {
    console.error('Error confirming ajuste:', error);
    return NextResponse.json(
      { error: error.message || 'Error al confirmar el ajuste' },
      { status: 500 }
    );
  }
}
