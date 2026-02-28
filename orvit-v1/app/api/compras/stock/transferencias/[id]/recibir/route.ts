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

// POST - Recibir transferencia (mover stock de IN_TRANSIT a destino)
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

    const body = await request.json();
    const { items: itemsRecibidos } = body; // [{ itemId, cantidadRecibida, notas }]

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

    if (transferencia.estado !== 'EN_TRANSITO') {
      return NextResponse.json(
        { error: `Solo se pueden recibir transferencias en estado EN_TRANSITO. Estado actual: ${transferencia.estado}` },
        { status: 400 }
      );
    }

    // Obtener warehouse de tránsito
    const transitWarehouse = await prisma.warehouse.findFirst({
      where: { companyId, isTransit: true }
    });

    if (!transitWarehouse) {
      return NextResponse.json({ error: 'Warehouse de tránsito no encontrado' }, { status: 500 });
    }

    // Mapear cantidades recibidas
    const recibidoByItem = new Map<number, { cantidad: number; notas?: string }>();
    if (itemsRecibidos && Array.isArray(itemsRecibidos)) {
      for (const item of itemsRecibidos) {
        recibidoByItem.set(item.itemId, {
          cantidad: parseFloat(item.cantidadRecibida || '0'),
          notas: item.notas
        });
      }
    }

    // Obtener stock en tránsito
    const stockTransit = await prisma.stockLocation.findMany({
      where: {
        warehouseId: transitWarehouse.id,
        supplierItemId: { in: transferencia.items.map(i => i.supplierItemId) }
      }
    });

    const stockTransitByItem = new Map<number, { id: number; cantidad: number; costo: number }>();
    for (const loc of stockTransit) {
      stockTransitByItem.set(loc.supplierItemId, {
        id: loc.id,
        cantidad: Number(loc.cantidad || 0),
        costo: Number(loc.costoUnitario || 0)
      });
    }

    // Ejecutar en transacción
    const resultado = await prisma.$transaction(async (tx) => {
      const movimientosCreados = [];
      let todoRecibido = true;
      let algunoRecibido = false;

      for (const item of transferencia.items) {
        // Determinar cantidad a recibir
        let cantidadRecibir: number;
        if (recibidoByItem.has(item.id)) {
          cantidadRecibir = recibidoByItem.get(item.id)!.cantidad;
        } else {
          // Si no se especifica, recibir todo lo enviado
          cantidadRecibir = Number(item.cantidadEnviada);
        }

        if (cantidadRecibir <= 0) {
          todoRecibido = false;
          continue;
        }

        algunoRecibido = true;

        if (cantidadRecibir < Number(item.cantidadEnviada)) {
          todoRecibido = false;
        }

        const stockT = stockTransitByItem.get(item.supplierItemId);
        const costo = stockT?.costo || 0;

        // Obtener docType del item (hereda de cómo entró al stock)
        const itemDocType = await getItemDocType(item.supplierItemId, companyId);

        // 1. Reducir stock en IN_TRANSIT
        const stockTransitAnterior = stockT?.cantidad || 0;
        const stockTransitNuevo = stockTransitAnterior - cantidadRecibir;

        if (stockT) {
          await tx.stockLocation.update({
            where: { id: stockT.id },
            data: { cantidad: Math.max(0, stockTransitNuevo) }
          });
        }

        // Movimiento de SALIDA en IN_TRANSIT (hereda docType del item)
        const movSalida = await tx.stockMovement.create({
          data: {
            tipo: 'TRANSFERENCIA_SALIDA',
            cantidad: cantidadRecibir,
            cantidadAnterior: stockTransitAnterior,
            cantidadPosterior: Math.max(0, stockTransitNuevo),
            costoUnitario: costo,
            supplierItemId: item.supplierItemId,
            warehouseId: transitWarehouse.id,
            transferId: transferencia.id,
            sourceNumber: transferencia.numero,
            motivo: `Recepción en destino`,
            docType: itemDocType,
            companyId,
            createdBy: user.id
          }
        });
        movimientosCreados.push(movSalida);

        // 2. Agregar stock en destino
        let stockDestino = await tx.stockLocation.findUnique({
          where: {
            warehouseId_supplierItemId: {
              warehouseId: transferencia.warehouseDestinoId,
              supplierItemId: item.supplierItemId
            }
          }
        });

        const stockDestinoAnterior = Number(stockDestino?.cantidad || 0);
        const stockDestinoNuevo = stockDestinoAnterior + cantidadRecibir;

        if (stockDestino) {
          await tx.stockLocation.update({
            where: { id: stockDestino.id },
            data: { cantidad: stockDestinoNuevo, costoUnitario: costo }
          });
        } else {
          await tx.stockLocation.create({
            data: {
              warehouseId: transferencia.warehouseDestinoId,
              supplierItemId: item.supplierItemId,
              cantidad: stockDestinoNuevo,
              cantidadReservada: 0,
              costoUnitario: costo,
              companyId
            }
          });
        }

        // Movimiento de ENTRADA en destino (hereda docType del item)
        const movEntrada = await tx.stockMovement.create({
          data: {
            tipo: 'TRANSFERENCIA_ENTRADA',
            cantidad: cantidadRecibir,
            cantidadAnterior: stockDestinoAnterior,
            cantidadPosterior: stockDestinoNuevo,
            costoUnitario: costo,
            supplierItemId: item.supplierItemId,
            warehouseId: transferencia.warehouseDestinoId,
            transferId: transferencia.id,
            sourceNumber: transferencia.numero,
            motivo: `Recepción de transferencia`,
            docType: itemDocType,
            companyId,
            createdBy: user.id
          }
        });
        movimientosCreados.push(movEntrada);

        // 3. Actualizar item de transferencia
        await tx.stockTransferItem.update({
          where: { id: item.id },
          data: {
            cantidadRecibida: cantidadRecibir,
            notas: recibidoByItem.get(item.id)?.notas || item.notas
          }
        });
      }

      // 4. Determinar nuevo estado
      let nuevoEstado: string;
      if (!algunoRecibido) {
        nuevoEstado = 'EN_TRANSITO'; // No cambió nada
      } else if (todoRecibido) {
        nuevoEstado = 'COMPLETADO';
      } else {
        nuevoEstado = 'RECIBIDO_PARCIAL';
      }

      // 5. Actualizar estado de transferencia
      const transferenciaActualizada = await tx.stockTransfer.update({
        where: { id: transferId },
        data: {
          estado: nuevoEstado as any,
          fechaRecepcion: algunoRecibido ? new Date() : undefined
        }
      });

      return { transferencia: transferenciaActualizada, movimientos: movimientosCreados, nuevoEstado };
    });

    // Registrar auditoría
    await logStateChange({
      entidad: 'stock_transfer',
      entidadId: transferId,
      estadoAnterior: 'EN_TRANSITO',
      estadoNuevo: resultado.nuevoEstado,
      companyId,
      userId: user.id,
      motivo: 'Recepción de transferencia'
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

    const mensaje = resultado.nuevoEstado === 'COMPLETADO'
      ? 'Transferencia completada exitosamente'
      : resultado.nuevoEstado === 'RECIBIDO_PARCIAL'
        ? 'Recepción parcial registrada. Items pendientes permanecen en tránsito.'
        : 'Sin cambios';

    return NextResponse.json({
      ...transferenciaCompleta,
      message: mensaje
    });
  } catch (error: any) {
    console.error('Error receiving transferencia:', error);
    return NextResponse.json(
      { error: error.message || 'Error al recibir la transferencia' },
      { status: 500 }
    );
  }
}
