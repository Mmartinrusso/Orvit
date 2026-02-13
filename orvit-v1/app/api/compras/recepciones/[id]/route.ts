import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';
import { prisma } from '@/lib/prisma';
import { getT2Client, isT2DatabaseConfigured } from '@/lib/prisma-t2';
import { JWT_SECRET } from '@/lib/auth';
import { reversarGRNIAlVincularFactura, anularGRNIPorRecepcion } from '@/lib/compras/grni-helper';

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

// GET - Obtener recepción por ID
export async function GET(
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

    const recepcion = await prisma.goodsReceipt.findFirst({
      where: { id, companyId },
      include: {
        proveedor: {
          select: {
            id: true,
            name: true,
            cuit: true,
            razon_social: true,
            email: true,
            phone: true,
          }
        },
        purchaseOrder: {
          select: {
            id: true,
            numero: true,
            estado: true,
            fechaEmision: true,
            total: true,
          }
        },
        warehouse: {
          select: { id: true, codigo: true, nombre: true, direccion: true }
        },
        factura: {
          select: { id: true, numeroSerie: true, numeroFactura: true, fechaEmision: true, total: true }
        },
        createdByUser: { select: { id: true, name: true } },
        items: {
          include: {
            supplierItem: {
              select: {
                id: true,
                nombre: true,
                unidad: true,
                codigoProveedor: true,
                supply: { select: { code: true } },
              }
            },
            purchaseOrderItem: {
              select: {
                id: true,
                cantidad: true,
                cantidadRecibida: true,
                cantidadPendiente: true,
                precioUnitario: true,
                codigoPropio: true,
              }
            }
          },
          orderBy: { id: 'asc' }
        },
        stockMovements: {
          select: {
            id: true,
            tipo: true,
            cantidad: true,
            createdAt: true,
          },
          orderBy: { createdAt: 'desc' }
        },
        matchResults: {
          select: {
            id: true,
            estado: true,
            matchCompleto: true,
            createdAt: true,
          }
        }
      }
    });

    if (!recepcion) {
      return NextResponse.json({ error: 'Recepción no encontrada' }, { status: 404 });
    }

    return NextResponse.json(recepcion);
  } catch (error) {
    console.error('Error fetching recepcion:', error);
    return NextResponse.json(
      { error: 'Error al obtener la recepción' },
      { status: 500 }
    );
  }
}

// PATCH - Actualizar parcialmente una recepcion (vinculaciones, etc)
export async function PATCH(
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

    // Verificar que existe y pertenece a la empresa
    const recepcion = await prisma.goodsReceipt.findFirst({
      where: { id, companyId }
    });

    if (!recepcion) {
      return NextResponse.json({ error: 'Recepción no encontrada' }, { status: 404 });
    }

    const body = await request.json();
    const {
      facturaId,
      tieneFactura,
      numeroRemito,
      observacionesRecepcion,
      adjuntos,
      firma,
    } = body;

    // REGLA: Una recepcion CONFIRMADA es INMUTABLE (excepto vinculaciones)
    if (recepcion.estado === 'CONFIRMADA') {
      // Solo campos permitidos en estado confirmado
      const allowedFields = ['facturaId', 'tieneFactura', 'numeroRemito'];
      const requestedFields = Object.keys(body);
      const disallowedFields = requestedFields.filter(f => !allowedFields.includes(f));

      if (disallowedFields.length > 0) {
        return NextResponse.json(
          {
            error: 'No se puede editar una recepción confirmada',
            detalles: `Campos no permitidos: ${disallowedFields.join(', ')}. Solo se pueden actualizar: ${allowedFields.join(', ')}`
          },
          { status: 400 }
        );
      }
    }

    // Construir data para actualizar
    const updateData: any = {};

    if (facturaId !== undefined) {
      updateData.facturaId = facturaId ? parseInt(facturaId) : null;
      updateData.tieneFactura = !!facturaId;
    }
    if (tieneFactura !== undefined) {
      updateData.tieneFactura = tieneFactura;
    }
    if (numeroRemito !== undefined) {
      updateData.numeroRemito = numeroRemito;
    }

    // Estos solo en estado BORRADOR
    if (recepcion.estado === 'BORRADOR') {
      if (observacionesRecepcion !== undefined) {
        updateData.observacionesRecepcion = observacionesRecepcion;
      }
      if (adjuntos !== undefined) {
        updateData.adjuntos = adjuntos;
      }
      if (firma !== undefined) {
        updateData.firma = firma;
      }
    }

    const updated = await prisma.goodsReceipt.update({
      where: { id },
      data: updateData,
      include: {
        proveedor: { select: { id: true, name: true } },
        factura: { select: { id: true, numeroSerie: true, numeroFactura: true } }
      }
    });

    // Registrar en auditoria
    await prisma.purchaseAuditLog.create({
      data: {
        entidad: 'goods_receipt',
        entidadId: id,
        accion: 'ACTUALIZAR',
        datosAnteriores: {
          facturaId: recepcion.facturaId,
          tieneFactura: recepcion.tieneFactura,
          numeroRemito: recepcion.numeroRemito,
        },
        datosNuevos: updateData,
        companyId,
        userId: user.id,
      }
    });

    // GRNI: Si se vinculó una factura nueva, reversar los accruals
    let grniResult = { reversed: 0, varianzaTotal: 0 };
    if (facturaId && facturaId !== recepcion.facturaId && recepcion.estado === 'CONFIRMADA') {
      try {
        grniResult = await reversarGRNIAlVincularFactura(
          id,
          parseInt(facturaId),
          user.id,
          prisma
        );
      } catch (grniError) {
        console.error('[GRNI] Error reversando accruals:', grniError);
      }
    }

    return NextResponse.json({
      message: `Recepción actualizada${grniResult.reversed > 0 ? `. GRNI: ${grniResult.reversed} accrual(s) reversado(s)` : ''}`,
      recepcion: updated,
      grni: grniResult
    });
  } catch (error: any) {
    console.error('Error updating recepcion (PATCH):', error);
    return NextResponse.json(
      { error: error.message || 'Error al actualizar la recepción' },
      { status: 500 }
    );
  }
}

// PUT - Actualizar recepción completa (solo en estado BORRADOR)
export async function PUT(
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

    const existente = await prisma.goodsReceipt.findFirst({
      where: { id, companyId }
    });

    if (!existente) {
      return NextResponse.json({ error: 'Recepción no encontrada' }, { status: 404 });
    }

    // Solo se puede editar en estado BORRADOR
    if (existente.estado !== 'BORRADOR') {
      return NextResponse.json(
        { error: `No se puede editar una recepción en estado ${existente.estado}` },
        { status: 400 }
      );
    }

    const body = await request.json();
    const {
      warehouseId,
      fechaRecepcion,
      numeroRemito,
      notas,
      estadoCalidad,
      notasCalidad,
      items,
      // Campos de evidencia
      adjuntos,
      firma,
      observacionesRecepcion,
    } = body;

    let updateData: any = {
      ...(warehouseId && { warehouseId: parseInt(warehouseId) }),
      ...(fechaRecepcion !== undefined && {
        fechaRecepcion: fechaRecepcion ? new Date(fechaRecepcion) : new Date()
      }),
      ...(numeroRemito !== undefined && { numeroRemito }),
      ...(notas !== undefined && { notas }),
      ...(estadoCalidad && { estadoCalidad: estadoCalidad as any }),
      ...(notasCalidad !== undefined && { notasCalidad }),
      // Evidencia de recepción
      ...(adjuntos !== undefined && { adjuntos }),
      ...(firma !== undefined && { firma }),
      ...(observacionesRecepcion !== undefined && { observacionesRecepcion }),
    };

    if (items && Array.isArray(items)) {
      // Actualizar con items en transacción
      await prisma.$transaction(async (tx) => {
        // Eliminar items existentes
        await tx.goodsReceiptItem.deleteMany({
          where: { goodsReceiptId: id }
        });

        // Crear nuevos items
        await tx.goodsReceiptItem.createMany({
          data: items.map((item: any) => {
            const cantidadRecibida = parseFloat(item.cantidadRecibida);
            const cantidadAceptada = parseFloat(item.cantidadAceptada || item.cantidadRecibida);
            const cantidadRechazada = parseFloat(item.cantidadRechazada || '0');

            return {
              goodsReceiptId: id,
              purchaseOrderItemId: item.purchaseOrderItemId ? parseInt(item.purchaseOrderItemId) : null,
              supplierItemId: parseInt(item.supplierItemId),
              descripcion: item.descripcion || '',
              cantidadEsperada: item.cantidadEsperada ? parseFloat(item.cantidadEsperada) : null,
              cantidadRecibida,
              cantidadAceptada,
              cantidadRechazada,
              unidad: item.unidad || 'UN',
              motivoRechazo: item.motivoRechazo || null,
              lote: item.lote || null,
              fechaVencimiento: item.fechaVencimiento ? new Date(item.fechaVencimiento) : null,
              notas: item.notas || null,
            };
          })
        });

        // Actualizar recepción
        await tx.goodsReceipt.update({
          where: { id },
          data: updateData
        });
      });
    } else {
      await prisma.goodsReceipt.update({
        where: { id },
        data: updateData
      });
    }

    // Obtener recepción actualizada
    const recepcionActualizada = await prisma.goodsReceipt.findUnique({
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

    return NextResponse.json(recepcionActualizada);
  } catch (error) {
    console.error('Error updating recepcion:', error);
    return NextResponse.json(
      { error: 'Error al actualizar la recepción' },
      { status: 500 }
    );
  }
}

// DELETE - Eliminar/Anular recepción (revierte stock, resetea factura y OC)
export async function DELETE(
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

    const existente = await prisma.goodsReceipt.findFirst({
      where: { id, companyId },
      include: {
        items: {
          include: {
            supplierItem: { select: { id: true, nombre: true } },
            purchaseOrderItem: { select: { id: true, purchaseOrderId: true } },
          }
        },
        stockMovements: true,
        matchResults: { select: { id: true } },
      }
    });

    if (!existente) {
      return NextResponse.json({ error: 'Recepción no encontrada' }, { status: 404 });
    }

    // GRNI: Anular accruals pendientes de esta recepción
    let grniAnulados = 0;
    if (existente.estado === 'CONFIRMADA') {
      try {
        const grniResult = await anularGRNIPorRecepcion(
          id,
          user.id,
          'Recepción eliminada/anulada',
          prisma
        );
        grniAnulados = grniResult.anulados;
      } catch (grniError) {
        console.error('[GRNI] Error anulando accruals:', grniError);
      }
    }

    await prisma.$transaction(async (tx) => {
      // 1) Revertir movimientos de stock si los hay
      if (existente.stockMovements.length > 0) {
        for (const movement of existente.stockMovements) {
          const supplierItemId = movement.supplierItemId;
          const cantidadARevertir = Number(movement.cantidad);

          // Revertir StockLocation
          if (movement.stockLocationId) {
            const stockLoc = await tx.stockLocation.findUnique({
              where: { id: movement.stockLocationId },
            });
            if (stockLoc) {
              const nuevaCantidad = Number(stockLoc.cantidad) - cantidadARevertir;
              if (nuevaCantidad > 0) {
                await tx.stockLocation.update({
                  where: { id: movement.stockLocationId },
                  data: { cantidad: nuevaCantidad, ultimaActualizacion: new Date() },
                });
              } else {
                await tx.stockLocation.delete({ where: { id: movement.stockLocationId } });
              }
            }
          }

          // Revertir Stock global
          try {
            const stockGlobal = await tx.stock.findUnique({ where: { supplierItemId } });
            if (stockGlobal) {
              const nuevaCantidad = Number(stockGlobal.cantidad) - cantidadARevertir;
              if (nuevaCantidad > 0) {
                await tx.stock.update({
                  where: { supplierItemId },
                  data: { cantidad: nuevaCantidad, ultimaActualizacion: new Date() },
                });
              } else {
                await tx.stock.delete({ where: { supplierItemId } });
              }
            }
          } catch (e) {
            console.warn(`[Recepciones DELETE] No se pudo revertir stock para supplierItemId ${supplierItemId}`);
          }
        }

        // Eliminar los movimientos de stock
        await tx.stockMovement.deleteMany({ where: { goodsReceiptId: id } });
      }

      // 2) Revertir cantidades recibidas en items de la OC
      if (existente.purchaseOrderId) {
        for (const item of existente.items) {
          if (item.purchaseOrderItemId) {
            const poItem = await tx.purchaseOrderItem.findUnique({
              where: { id: item.purchaseOrderItemId },
            });
            if (poItem) {
              const nuevaCantRecibida = Math.max(0, Number(poItem.cantidadRecibida) - Number(item.cantidadAceptada));
              const nuevaCantPendiente = Number(poItem.cantidad) - nuevaCantRecibida;
              await tx.purchaseOrderItem.update({
                where: { id: item.purchaseOrderItemId },
                data: {
                  cantidadRecibida: nuevaCantRecibida,
                  cantidadPendiente: Math.max(0, nuevaCantPendiente),
                },
              });
            }
          }
        }

        // Recalcular estado de la OC
        const itemsOC = await tx.purchaseOrderItem.findMany({
          where: { purchaseOrderId: existente.purchaseOrderId },
        });
        const todosRecibidos = itemsOC.every(i => Number(i.cantidadRecibida) >= Number(i.cantidad));
        const algunoRecibido = itemsOC.some(i => Number(i.cantidadRecibida) > 0);

        let nuevoEstadoOC: string;
        if (todosRecibidos) {
          nuevoEstadoOC = 'COMPLETADA';
        } else if (algunoRecibido) {
          nuevoEstadoOC = 'PARCIALMENTE_RECIBIDA';
        } else {
          nuevoEstadoOC = 'APROBADA';
        }

        await tx.purchaseOrder.update({
          where: { id: existente.purchaseOrderId },
          data: {
            estado: nuevoEstadoOC as any,
            ...(nuevoEstadoOC === 'APROBADA' ? { fechaEntregaReal: null } : {}),
          },
        });
      }

      // 3) Eliminar matchResults vinculados
      if (existente.matchResults.length > 0) {
        await tx.matchResult.deleteMany({ where: { goodsReceiptId: id } });
      }

      // 4) Eliminar solicitudes de NCA vinculadas al remito
      await tx.creditNoteRequest.updateMany({
        where: { goodsReceiptId: id },
        data: { goodsReceiptId: null },
      });

      // 5) Eliminar devoluciones vinculadas
      await tx.purchaseReturn.updateMany({
        where: { goodsReceiptId: id },
        data: { goodsReceiptId: null },
      });

      // 6) Resetear factura vinculada a "sin ingreso"
      if (existente.facturaId) {
        await tx.purchaseReceipt.update({
          where: { id: existente.facturaId },
          data: {
            ingresoConfirmado: false,
            ingresoConfirmadoPor: null,
            ingresoConfirmadoAt: null,
          },
        });
      }

      // 7) Eliminar items y la recepción
      await tx.goodsReceiptItem.deleteMany({ where: { goodsReceiptId: id } });
      await tx.goodsReceipt.delete({ where: { id } });
    });

    // Si era T2 y tenía facturaId en notas, resetear ingresoConfirmado en T2
    if (existente.docType === 'T2' && isT2DatabaseConfigured()) {
      // Extraer facturaId T2 desde notas (formato: [T2-Factura:123])
      const t2FacturaMatch = existente.notas?.match(/\[T2-Factura:(\d+)\]/);
      const t2FacturaId = t2FacturaMatch ? parseInt(t2FacturaMatch[1]) : null;
      if (t2FacturaId) {
        try {
          const prismaT2 = getT2Client();
          await prismaT2.t2PurchaseReceipt.update({
            where: { id: t2FacturaId },
            data: {
              ingresoConfirmado: false,
              ingresoConfirmadoPor: null,
              ingresoConfirmadoAt: null,
            },
          });
        } catch (t2Error: any) {
          console.error('[Recepciones DELETE] Error resetting T2 factura:', t2Error?.message);
        }
      }
    }

    return NextResponse.json({ message: 'Recepción eliminada correctamente' });
  } catch (error) {
    console.error('Error deleting recepcion:', error);
    return NextResponse.json(
      { error: 'Error al eliminar la recepción' },
      { status: 500 }
    );
  }
}
