import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';
import { prisma } from '@/lib/prisma';
import { JWT_SECRET } from '@/lib/auth';
import { Decimal } from '@prisma/client/runtime/library';

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
  } catch {
    return null;
  }
}

/**
 * POST - Cancelar devolución
 *
 * COMPORTAMIENTO:
 * - Si estado < ENVIADA (BORRADOR, SOLICITADA, APROBADA_PROVEEDOR):
 *   - Solo cambia estado a CANCELADA
 *   - No mueve stock
 *
 * - Si estado = ENVIADA o posterior:
 *   - Crea movimiento inverso de stock (AJUSTE_POSITIVO con motivo cancelación)
 *   - Devuelve el stock al depósito
 *   - Cambia estado a CANCELADA
 *   - Si tiene NCA vinculada NO anulada, devuelve error (primero anular la NCA)
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
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

    const { id: idStr } = await params;
    const id = parseInt(idStr);
    if (isNaN(id)) {
      return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
    }

    // Leer body con motivo de cancelación
    let cancelacionData: {
      motivo?: string;
    } = {};

    try {
      const body = await request.json();
      cancelacionData = {
        ...(body.motivo && { motivo: body.motivo }),
      };
    } catch {
      // Body vacío, continuar sin motivo
    }

    if (!cancelacionData.motivo) {
      return NextResponse.json(
        { error: 'Debe proporcionar un motivo para la cancelación' },
        { status: 400 }
      );
    }

    // Ejecutar todo en una transacción
    const resultado = await prisma.$transaction(async (tx) => {
      // 1. Obtener devolución con items y relaciones
      const devolucion = await tx.purchaseReturn.findFirst({
        where: { id, companyId },
        include: {
          items: {
            include: {
              supplierItem: { select: { id: true, nombre: true, unidad: true } }
            }
          },
          stockMovements: {
            where: { tipo: 'SALIDA_DEVOLUCION' }
          },
          creditNotes: {
            where: { estado: { not: 'ANULADA' } },
            select: { id: true, numero: true, estado: true }
          },
          goodsReceipt: {
            select: { docType: true }
          }
        }
      });

      if (!devolucion) {
        throw new Error('Devolución no encontrada');
      }

      // 2. Validar estado - no se puede cancelar una ya cancelada o resuelta
      if (devolucion.estado === 'CANCELADA') {
        throw new Error('La devolución ya está cancelada');
      }

      if (devolucion.estado === 'RESUELTA') {
        throw new Error('No se puede cancelar una devolución resuelta');
      }

      // 3. Si tiene NCA vinculada NO anulada, no permitir cancelación
      if (devolucion.creditNotes && devolucion.creditNotes.length > 0) {
        const ncasActivas = devolucion.creditNotes
          .map(nc => `${nc.numero} (${nc.estado})`)
          .join(', ');
        throw new Error(
          `No se puede cancelar la devolución porque tiene NCAs vinculadas: ${ncasActivas}. ` +
          `Primero anule las NCAs asociadas.`
        );
      }

      const estadosConStock = ['ENVIADA', 'RECIBIDA_PROVEEDOR', 'EN_EVALUACION'];
      const requiereReversaStock = estadosConStock.includes(devolucion.estado) &&
                                   devolucion.stockMovementCreated;

      const stockReversals = [];
      const stockUpdates = [];

      // 4. Si ya se movió stock, crear movimientos inversos
      if (requiereReversaStock && devolucion.warehouseId) {
        const docType = devolucion.goodsReceipt?.docType || 'T1';

        for (const item of devolucion.items) {
          const cantidad = new Decimal(item.cantidad);

          // Obtener stock actual
          const stockLocation = await tx.stockLocation.findUnique({
            where: {
              warehouseId_supplierItemId: {
                warehouseId: devolucion.warehouseId,
                supplierItemId: item.supplierItemId
              }
            }
          });

          const cantidadAnterior = stockLocation?.cantidad || new Decimal(0);
          const cantidadPosterior = new Decimal(cantidadAnterior).add(cantidad);

          // Crear movimiento de entrada (reversa)
          const movimientoReversa = await tx.stockMovement.create({
            data: {
              tipo: 'AJUSTE_POSITIVO',
              cantidad,
              cantidadAnterior,
              cantidadPosterior,
              supplierItemId: item.supplierItemId,
              warehouseId: devolucion.warehouseId,
              motivo: `Cancelación devolución ${devolucion.numero}: ${cancelacionData.motivo}`,
              sourceNumber: devolucion.numero,
              notas: `Reversa por cancelación. Usuario: ${user.name}`,
              docType: docType as any,
              companyId,
              createdBy: user.id
            }
          });

          stockReversals.push(movimientoReversa);

          // Actualizar o crear StockLocation
          if (stockLocation) {
            await tx.stockLocation.update({
              where: { id: stockLocation.id },
              data: { cantidad: cantidadPosterior }
            });
          } else {
            await tx.stockLocation.create({
              data: {
                warehouseId: devolucion.warehouseId,
                supplierItemId: item.supplierItemId,
                cantidad,
                cantidadReservada: 0,
                companyId
              }
            });
          }

          stockUpdates.push({
            supplierItemId: item.supplierItemId,
            descripcion: item.descripcion || item.supplierItem?.nombre,
            cantidadAnterior: cantidadAnterior.toNumber(),
            cantidadPosterior: cantidadPosterior.toNumber(),
            cantidadReingresada: cantidad.toNumber()
          });
        }
      }

      // 5. Actualizar estado de la devolución
      const devolucionCancelada = await tx.purchaseReturn.update({
        where: { id },
        data: {
          estado: 'CANCELADA',
          resolucion: `CANCELADA: ${cancelacionData.motivo}`,
          fechaResolucion: new Date(),
          notas: devolucion.notas
            ? `${devolucion.notas}\n[${new Date().toISOString()}] Cancelada: ${cancelacionData.motivo}`
            : `[${new Date().toISOString()}] Cancelada: ${cancelacionData.motivo}`,
        }
      });

      // 6. Registrar en auditoría
      await tx.purchaseAuditLog.create({
        data: {
          entidad: 'purchase_return',
          entidadId: id,
          accion: 'CANCELAR',
          datosAnteriores: {
            estado: devolucion.estado,
            stockMovementCreated: devolucion.stockMovementCreated
          },
          datosNuevos: {
            estado: 'CANCELADA',
            motivoCancelacion: cancelacionData.motivo,
            stockRevertido: requiereReversaStock,
            movimientosReversaCreados: stockReversals.length,
            stockUpdates
          },
          companyId,
          userId: user.id,
          docType: (devolucion.goodsReceipt?.docType || 'T1') as any
        }
      });

      return {
        devolucionId: id,
        numero: devolucion.numero,
        estadoAnterior: devolucion.estado,
        stockRevertido: requiereReversaStock,
        movimientosReversaCreados: stockReversals.length,
        stockActualizado: stockUpdates
      };
    });

    // Obtener devolución actualizada para respuesta
    const devolucionCancelada = await prisma.purchaseReturn.findUnique({
      where: { id },
      include: {
        proveedor: { select: { id: true, name: true } },
        warehouse: { select: { id: true, codigo: true, nombre: true } },
        items: {
          include: {
            supplierItem: { select: { id: true, nombre: true, unidad: true } }
          }
        }
      }
    });

    const mensajeStock = resultado.stockRevertido
      ? ` Stock reingresado al depósito (${resultado.movimientosReversaCreados} movimientos).`
      : '';

    return NextResponse.json({
      success: true,
      message: `Devolución cancelada.${mensajeStock}`,
      devolucion: devolucionCancelada,
      resumen: resultado
    });
  } catch (error: any) {
    console.error('Error cancelando devolucion:', error);
    return NextResponse.json(
      { error: error.message || 'Error al cancelar la devolución' },
      { status: error.message?.includes('no encontrada') ? 404 : 400 }
    );
  }
}
