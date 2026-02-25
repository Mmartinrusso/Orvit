import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';
import { prisma } from '@/lib/prisma';
import { JWT_SECRET } from '@/lib/auth';
import { Decimal } from '@prisma/client/runtime/library';
import { invalidarCacheOrdenes, invalidarCacheRecepciones, invalidarCacheStock } from '@/lib/compras/cache';
import { crearGRNIAccruals } from '@/lib/compras/grni-helper';
import { verificarSoDEntreDocumentos } from '@/lib/compras/sod-rules';

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
 * Validar evidencia de recepción
 * REGLA: Para confirmar una recepción se requiere:
 * - Firma del receptor O
 * - Al menos un adjunto (foto del remito o mercadería)
 */
function validarEvidencia(recepcion: any, evidenciaData: any): string[] {
  const errores: string[] = [];

  // Combinar evidencia existente con la nueva
  const tieneAdjuntos = (recepcion.adjuntos?.length > 0) || (evidenciaData.adjuntos?.length > 0);
  const tieneFirma = recepcion.firma || evidenciaData.firma;

  // Obligatorio: firma O adjuntos
  if (!tieneFirma && !tieneAdjuntos) {
    errores.push('Debe adjuntar firma o foto del remito/mercadería para confirmar la recepción');
  }

  return errores;
}

/**
 * POST - Confirmar recepción (actualiza stock)
 *
 * IMPORTANTE: Este es el ÚNICO lugar donde se mueve stock para compras.
 * Se requiere evidencia (firma O adjuntos) para confirmar.
 * Una recepción confirmada es INMUTABLE.
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

    // Leer body para evidencia
    let evidenciaData: { adjuntos?: string[]; firma?: string; observacionesRecepcion?: string } = {};
    try {
      const body = await request.json();
      evidenciaData = {
        ...(body.adjuntos !== undefined && { adjuntos: body.adjuntos }),
        ...(body.firma !== undefined && { firma: body.firma }),
        ...(body.observacionesRecepcion !== undefined && { observacionesRecepcion: body.observacionesRecepcion }),
      };
    } catch {
      // Body vacío o inválido, continuar sin evidencia adicional
    }

    // Obtener recepción con items
    const recepcion = await prisma.goodsReceipt.findFirst({
      where: { id, companyId },
      include: {
        items: {
          include: {
            purchaseOrderItem: true,
            supplierItem: {
              select: { id: true, nombre: true, codigoProveedor: true, precioUnitario: true, toolId: true, supply: { select: { code: true } } }
            }
          }
        },
        purchaseOrder: {
          include: {
            items: true
          }
        }
      }
    });

    if (!recepcion) {
      return NextResponse.json({ error: 'Recepción no encontrada' }, { status: 404 });
    }

    if (recepcion.estado !== 'BORRADOR') {
      return NextResponse.json(
        { error: `No se puede confirmar una recepción en estado ${recepcion.estado}` },
        { status: 400 }
      );
    }

    if (recepcion.items.length === 0) {
      return NextResponse.json(
        { error: 'La recepción no tiene items' },
        { status: 400 }
      );
    }

    // ENFORCEMENT: SoD - Verificar que el creador de la OC no sea quien confirma la recepción
    if (recepcion.purchaseOrderId) {
      const sodCheck = await verificarSoDEntreDocumentos(
        user.id,
        'CONFIRMAR_RECEPCION',
        recepcion.purchaseOrderId,
        'OC',
        prisma
      );
      if (!sodCheck.allowed) {
        console.log('[RECEPCIONES CONFIRMAR] ❌ Violación SoD:', sodCheck.message);
        return NextResponse.json(
          { error: sodCheck.message, code: 'SOD_VIOLATION' },
          { status: 403 }
        );
      }
    }

    // ⚠️ VALIDAR EVIDENCIA ANTES DE CONFIRMAR
    const erroresEvidencia = validarEvidencia(recepcion, evidenciaData);
    if (erroresEvidencia.length > 0) {
      return NextResponse.json(
        {
          error: 'Faltan datos de evidencia para confirmar la recepción',
          detalles: erroresEvidencia
        },
        { status: 400 }
      );
    }

    // Ejecutar todo en una transacción
    const resultado = await prisma.$transaction(async (tx) => {
      const stockMovements = [];
      const stockUpdates = [];

      for (const item of recepcion.items) {
        const cantidadAceptada = new Decimal(item.cantidadAceptada);

        if (cantidadAceptada.lte(0)) continue;

        // Obtener stock actual en el depósito
        let stockLocation = await tx.stockLocation.findUnique({
          where: {
            warehouseId_supplierItemId: {
              warehouseId: recepcion.warehouseId,
              supplierItemId: item.supplierItemId
            }
          }
        });

        const cantidadAnterior = stockLocation?.cantidad || new Decimal(0);
        const cantidadPosterior = new Decimal(cantidadAnterior).add(cantidadAceptada);

        // Calcular costo unitario (del item de proveedor o de la OC)
        let costoUnitario = item.supplierItem?.precioUnitario || null;
        if (item.purchaseOrderItem?.precioUnitario) {
          costoUnitario = item.purchaseOrderItem.precioUnitario;
        }

        // Crear o actualizar stock location (incluir códigos del item para trazabilidad)
        // Usar datos del supplierItem y supply.code como fallback
        const codigoPropioFinal = item.codigoPropio || item.supplierItem?.supply?.code || null;
        const codigoProvFinal = item.codigoProveedor || item.supplierItem?.codigoProveedor || null;
        const descripcionFinal = item.descripcion || item.supplierItem?.nombre || null;

        if (stockLocation) {
          await tx.stockLocation.update({
            where: { id: stockLocation.id },
            data: {
              cantidad: cantidadPosterior,
              // Actualizar códigos con los de la última entrada (con fallback a supplierItem/supply)
              codigoPropio: codigoPropioFinal || stockLocation.codigoPropio,
              codigoProveedor: codigoProvFinal || stockLocation.codigoProveedor,
              descripcionItem: descripcionFinal || stockLocation.descripcionItem,
            }
          });
        } else {
          stockLocation = await tx.stockLocation.create({
            data: {
              warehouseId: recepcion.warehouseId,
              supplierItemId: item.supplierItemId,
              cantidad: cantidadAceptada,
              cantidadReservada: 0,
              // Guardar códigos de esta entrada (con fallback a supplierItem/supply)
              codigoPropio: codigoPropioFinal,
              codigoProveedor: codigoProvFinal,
              descripcionItem: descripcionFinal,
              companyId
            }
          });
        }

        stockUpdates.push({
          supplierItemId: item.supplierItemId,
          descripcion: descripcionFinal,
          cantidadAnterior: cantidadAnterior.toNumber(),
          cantidadPosterior: cantidadPosterior.toNumber(),
          cantidadIngresada: cantidadAceptada.toNumber()
        });

        // Crear movimiento de stock (hereda docType de la recepción)
        // Guardar códigos del item para trazabilidad en el kardex
        const movimiento = await tx.stockMovement.create({
          data: {
            tipo: 'ENTRADA_RECEPCION',
            cantidad: cantidadAceptada,
            cantidadAnterior,
            cantidadPosterior,
            costoUnitario: costoUnitario || undefined,
            costoTotal: costoUnitario ? new Decimal(costoUnitario).mul(cantidadAceptada) : undefined,
            supplierItemId: item.supplierItemId,
            warehouseId: recepcion.warehouseId,
            goodsReceiptId: recepcion.id,
            // Códigos del item al momento del movimiento (para trazabilidad)
            // Usar datos del supplierItem/supply como fallback si el item de recepcion no los tiene
            codigoPropio: codigoPropioFinal,
            codigoProveedor: codigoProvFinal,
            descripcionItem: descripcionFinal,
            motivo: `Recepción ${recepcion.numero}`,
            notas: `Confirmado por ${user.name}`,
            docType: recepcion.docType, // Heredar docType del documento padre
            companyId,
            createdBy: user.id
          }
        });

        stockMovements.push(movimiento);

        // ═══ BRIDGE COMPRAS → PAÑOL ═══
        // Si el SupplierItem está vinculado a un Tool del pañol, sincronizar stock
        if (item.supplierItem?.toolId) {
          const toolId = item.supplierItem.toolId;
          const cantidadEntera = Math.round(cantidadAceptada.toNumber());

          if (cantidadEntera > 0) {
            // 1. Actualizar stock del Tool
            await tx.tool.update({
              where: { id: toolId },
              data: { stockQuantity: { increment: cantidadEntera } }
            });

            // 2. Crear InventoryLot para trazabilidad
            const lotNumber = item.lote || `REC-${recepcion.numero}-${item.id}`;
            await tx.inventoryLot.create({
              data: {
                toolId,
                lotNumber,
                serialNumber: null,
                quantity: cantidadEntera,
                remainingQty: cantidadEntera,
                supplierId: recepcion.proveedorId,
                purchaseOrderId: recepcion.purchaseOrderId,
                receivedAt: new Date(),
                expiresAt: item.fechaVencimiento,
                status: 'AVAILABLE',
                unitCost: costoUnitario ? parseFloat(costoUnitario.toString()) : null,
                notes: `Auto-creado desde recepción ${recepcion.numero}`,
                companyId,
              }
            });

            // 3. Crear ToolMovement para kardex del pañol
            await tx.toolMovement.create({
              data: {
                type: 'IN',
                quantity: cantidadEntera,
                reason: `Recepción de compra ${recepcion.numero}`,
                description: `Lote: ${lotNumber}. Proveedor: ${descripcionFinal || 'N/A'}. Costo: ${costoUnitario || 'N/A'}`,
                toolId,
                userId: user.id,
              }
            });
          }
        }

        // Si viene de una OC, actualizar cantidades en el item de la OC
        if (item.purchaseOrderItemId && item.purchaseOrderItem) {
          const nuevaCantidadRecibida = new Decimal(item.purchaseOrderItem.cantidadRecibida || 0)
            .add(cantidadAceptada);
          const nuevaCantidadPendiente = new Decimal(item.purchaseOrderItem.cantidad)
            .sub(nuevaCantidadRecibida);

          await tx.purchaseOrderItem.update({
            where: { id: item.purchaseOrderItemId },
            data: {
              cantidadRecibida: nuevaCantidadRecibida,
              cantidadPendiente: nuevaCantidadPendiente.lt(0) ? 0 : nuevaCantidadPendiente
            }
          });
        }
      }

      // Actualizar estado de la recepción + evidencia si se proporcionó
      const recepcionActualizada = await tx.goodsReceipt.update({
        where: { id },
        data: {
          estado: 'CONFIRMADA',
          fechaRecepcion: recepcion.fechaRecepcion || new Date(),
          ...evidenciaData, // adjuntos, firma, observacionesRecepcion
        }
      });

      // Si viene de una OC, verificar si está completamente recibida
      if (recepcion.purchaseOrderId && recepcion.purchaseOrder) {
        // Recalcular estados de items de la OC
        const itemsOC = await tx.purchaseOrderItem.findMany({
          where: { purchaseOrderId: recepcion.purchaseOrderId }
        });

        let todosRecibidos = true;
        let algunoRecibido = false;

        for (const itemOC of itemsOC) {
          const cantidadRecibida = new Decimal(itemOC.cantidadRecibida || 0);
          const cantidad = new Decimal(itemOC.cantidad);

          if (cantidadRecibida.lt(cantidad)) {
            todosRecibidos = false;
          }
          if (cantidadRecibida.gt(0)) {
            algunoRecibido = true;
          }
        }

        // Actualizar estado de la OC
        let nuevoEstadoOC: string | null = null;
        if (todosRecibidos) {
          nuevoEstadoOC = 'COMPLETADA';
        } else if (algunoRecibido) {
          nuevoEstadoOC = 'PARCIALMENTE_RECIBIDA';
        }

        if (nuevoEstadoOC) {
          await tx.purchaseOrder.update({
            where: { id: recepcion.purchaseOrderId },
            data: {
              estado: nuevoEstadoOC as any,
              ...(nuevoEstadoOC === 'COMPLETADA' && { fechaEntregaReal: new Date() })
            }
          });
        }
      }

      // Registrar en auditoría
      await tx.purchaseAuditLog.create({
        data: {
          entidad: 'goods_receipt',
          entidadId: id,
          accion: 'CONFIRMAR',
          datosAnteriores: { estado: 'BORRADOR' },
          datosNuevos: {
            estado: 'CONFIRMADA',
            movimientosCreados: stockMovements.length,
            stockUpdates,
            evidencia: {
              tieneFirma: !!evidenciaData.firma || !!recepcion.firma,
              tieneAdjuntos: (recepcion.adjuntos?.length || 0) + (evidenciaData.adjuntos?.length || 0)
            }
          },
          companyId,
          userId: user.id,
        }
      });

      return {
        recepcionId: id,
        movimientosCreados: stockMovements.length,
        stockActualizado: stockUpdates
      };
    });

    // GRNI: Crear accruals para esta recepción (si no tiene factura)
    let grniResult = { created: 0, montoTotal: 0 };
    if (!recepcion.facturaId && !recepcion.tieneFactura) {
      try {
        // Preparar items con precios para el accrual
        const itemsConPrecio = recepcion.items.map((item) => ({
          id: item.id,
          descripcion: item.descripcion || item.supplierItem?.nombre || '',
          cantidadAceptada: item.cantidadAceptada,
          precioUnitario: item.purchaseOrderItem?.precioUnitario || item.supplierItem?.precioUnitario || 0,
          supplierItemId: item.supplierItemId,
        }));

        grniResult = await crearGRNIAccruals(
          {
            id: recepcion.id,
            companyId,
            proveedorId: recepcion.proveedorId,
            moneda: 'ARS', // TODO: obtener de la OC
            docType: recepcion.docType || 'T1',
            items: itemsConPrecio,
          },
          user.id,
          prisma
        );
      } catch (grniError) {
        // No fallar la confirmación por error de GRNI, solo loguear
        console.error('[GRNI] Error creando accruals:', grniError);
      }
    }

    // Invalidar cachés porque el estado de la OC puede haber cambiado y el stock se actualizó
    invalidarCacheRecepciones(companyId);
    invalidarCacheOrdenes(companyId);
    invalidarCacheStock(companyId);

    // Obtener recepción actualizada
    const recepcionConfirmada = await prisma.goodsReceipt.findUnique({
      where: { id },
      include: {
        proveedor: { select: { id: true, name: true } },
        warehouse: { select: { id: true, codigo: true, nombre: true } },
        purchaseOrder: { select: { id: true, numero: true, estado: true } },
        items: {
          include: {
            supplierItem: { select: { id: true, nombre: true, unidad: true } }
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

    return NextResponse.json({
      success: true,
      message: `Recepción confirmada. ${resultado.movimientosCreados} movimiento(s) de stock creado(s).${grniResult.created > 0 ? ` GRNI: ${grniResult.created} accrual(s) por $${grniResult.montoTotal.toFixed(2)}.` : ''}`,
      recepcion: recepcionConfirmada,
      resumen: {
        ...resultado,
        grni: grniResult,
        nota: 'Stock actualizado correctamente. Esta recepción ya no puede ser editada.'
      }
    });
  } catch (error: any) {
    console.error('Error confirmando recepcion:', error);
    return NextResponse.json(
      { error: error.message || 'Error al confirmar la recepción' },
      { status: 500 }
    );
  }
}
