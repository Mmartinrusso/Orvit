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

// Obtener docType predominante de un item basado en sus movimientos de entrada
// Si el item entró al stock via una compra T2, hereda T2
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

// Obtener o crear warehouse de tránsito
async function getOrCreateTransitWarehouse(companyId: number) {
  let transitWarehouse = await prisma.warehouse.findFirst({
    where: { companyId, isTransit: true }
  });

  if (!transitWarehouse) {
    transitWarehouse = await prisma.warehouse.create({
      data: {
        codigo: 'IN_TRANSIT',
        nombre: 'En Tránsito',
        isTransit: true,
        isActive: true,
        companyId
      }
    });
  }

  return transitWarehouse;
}

// POST - Enviar transferencia (mover stock de origen a IN_TRANSIT)
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Permission check: almacen.transfer
    const { error: permError } = await requirePermission('almacen.transfer');
    if (permError) return permError;

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
        items: {
          include: {
            supplierItem: {
              select: { id: true, nombre: true, unidad: true }
            }
          }
        }
      }
    });

    if (!transferencia) {
      return NextResponse.json({ error: 'Transferencia no encontrada' }, { status: 404 });
    }

    if (transferencia.estado !== 'BORRADOR' && transferencia.estado !== 'SOLICITADO') {
      return NextResponse.json(
        { error: `No se puede enviar una transferencia en estado ${transferencia.estado}` },
        { status: 400 }
      );
    }

    if (transferencia.items.length === 0) {
      return NextResponse.json({ error: 'La transferencia no tiene items' }, { status: 400 });
    }

    // Obtener warehouse de tránsito
    const transitWarehouse = await getOrCreateTransitWarehouse(companyId);

    // Verificar stock disponible en origen
    const stockOrigen = await prisma.stockLocation.findMany({
      where: {
        warehouseId: transferencia.warehouseOrigenId,
        supplierItemId: { in: transferencia.items.map(i => i.supplierItemId) }
      }
    });

    const stockByItem = new Map<number, { id: number; cantidad: number; reservado: number; costo: number }>();
    for (const loc of stockOrigen) {
      stockByItem.set(loc.supplierItemId, {
        id: loc.id,
        cantidad: Number(loc.cantidad || 0),
        reservado: Number(loc.cantidadReservada || 0),
        costo: Number(loc.costoUnitario || 0)
      });
    }

    // Validar disponibilidad
    for (const item of transferencia.items) {
      const stock = stockByItem.get(item.supplierItemId);
      const disponible = (stock?.cantidad || 0) - (stock?.reservado || 0);
      const cantidadEnviar = Number(item.cantidadSolicitada);

      if (cantidadEnviar > disponible) {
        return NextResponse.json({
          error: `Stock insuficiente para ${item.supplierItem?.nombre}. Disponible: ${disponible}, Solicitado: ${cantidadEnviar}`
        }, { status: 400 });
      }
    }

    // Ejecutar en transacción
    const resultado = await prisma.$transaction(async (tx) => {
      const movimientosCreados = [];

      for (const item of transferencia.items) {
        const stock = stockByItem.get(item.supplierItemId);
        const cantidadEnviar = Number(item.cantidadSolicitada);
        const costo = stock?.costo || 0;

        // Obtener docType del item (hereda de cómo entró al stock)
        const itemDocType = await getItemDocType(item.supplierItemId, companyId);

        // 1. Reducir stock en origen
        const stockOrigenActual = stock?.cantidad || 0;
        const stockOrigenNuevo = stockOrigenActual - cantidadEnviar;

        await tx.stockLocation.update({
          where: { id: stock!.id },
          data: { cantidad: stockOrigenNuevo }
        });

        // Movimiento de SALIDA en origen (hereda docType del item)
        const movSalida = await tx.stockMovement.create({
          data: {
            tipo: 'TRANSFERENCIA_SALIDA',
            cantidad: cantidadEnviar,
            cantidadAnterior: stockOrigenActual,
            cantidadPosterior: stockOrigenNuevo,
            costoUnitario: costo,
            supplierItemId: item.supplierItemId,
            warehouseId: transferencia.warehouseOrigenId,
            transferId: transferencia.id,
            sourceNumber: transferencia.numero,
            motivo: `Transferencia a ${transferencia.warehouseDestinoId}`,
            docType: itemDocType,
            companyId,
            createdBy: user.id
          }
        });
        movimientosCreados.push(movSalida);

        // 2. Agregar stock en IN_TRANSIT
        let stockTransit = await tx.stockLocation.findUnique({
          where: {
            warehouseId_supplierItemId: {
              warehouseId: transitWarehouse.id,
              supplierItemId: item.supplierItemId
            }
          }
        });

        const stockTransitAnterior = Number(stockTransit?.cantidad || 0);
        const stockTransitNuevo = stockTransitAnterior + cantidadEnviar;

        if (stockTransit) {
          await tx.stockLocation.update({
            where: { id: stockTransit.id },
            data: { cantidad: stockTransitNuevo, costoUnitario: costo }
          });
        } else {
          await tx.stockLocation.create({
            data: {
              warehouseId: transitWarehouse.id,
              supplierItemId: item.supplierItemId,
              cantidad: stockTransitNuevo,
              cantidadReservada: 0,
              costoUnitario: costo,
              companyId
            }
          });
        }

        // Movimiento de ENTRADA en IN_TRANSIT (hereda docType del item)
        const movEntrada = await tx.stockMovement.create({
          data: {
            tipo: 'TRANSFERENCIA_ENTRADA',
            cantidad: cantidadEnviar,
            cantidadAnterior: stockTransitAnterior,
            cantidadPosterior: stockTransitNuevo,
            costoUnitario: costo,
            supplierItemId: item.supplierItemId,
            warehouseId: transitWarehouse.id,
            transferId: transferencia.id,
            sourceNumber: transferencia.numero,
            motivo: `En tránsito desde ${transferencia.warehouseOrigenId}`,
            docType: itemDocType,
            companyId,
            createdBy: user.id
          }
        });
        movimientosCreados.push(movEntrada);

        // 3. Actualizar item de transferencia
        await tx.stockTransferItem.update({
          where: { id: item.id },
          data: { cantidadEnviada: cantidadEnviar }
        });
      }

      // 4. Actualizar estado de transferencia
      const transferenciaActualizada = await tx.stockTransfer.update({
        where: { id: transferId },
        data: {
          estado: 'EN_TRANSITO',
          fechaEnvio: new Date()
        }
      });

      return { transferencia: transferenciaActualizada, movimientos: movimientosCreados };
    });

    // Registrar auditoría
    await logStateChange({
      entidad: 'stock_transfer',
      entidadId: transferId,
      estadoAnterior: transferencia.estado,
      estadoNuevo: 'EN_TRANSITO',
      companyId,
      userId: user.id,
      motivo: 'Envío de transferencia'
    });

    // Obtener transferencia completa para respuesta
    const transferenciaCompleta = await prisma.stockTransfer.findUnique({
      where: { id: transferId },
      include: {
        warehouseOrigen: { select: { id: true, codigo: true, nombre: true } },
        warehouseDestino: { select: { id: true, codigo: true, nombre: true } },
        items: {
          include: {
            supplierItem: { select: { id: true, nombre: true, unidad: true } }
          }
        }
      }
    });

    return NextResponse.json({
      ...transferenciaCompleta,
      message: 'Transferencia enviada. Stock en tránsito.'
    });
  } catch (error: any) {
    console.error('Error sending transferencia:', error);
    return NextResponse.json(
      { error: error.message || 'Error al enviar la transferencia' },
      { status: 500 }
    );
  }
}
