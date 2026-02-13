import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';
import { prisma } from '@/lib/prisma';
import { getT2Client, isT2DatabaseConfigured } from '@/lib/prisma-t2';
import * as cache from '@/app/api/compras/comprobantes/cache';
import { JWT_SECRET } from '@/lib/auth';
import { logStatusChange, logDeletion } from '@/lib/compras/audit-helper';

export const dynamic = 'force-dynamic';

const JWT_SECRET_KEY = new TextEncoder().encode(JWT_SECRET);

async function getUserFromToken() {
  try {
    const token = cookies().get('token')?.value;
    if (!token) return null;

    const { payload } = await jwtVerify(token, JWT_SECRET_KEY);

    // Optimización: Solo obtener companyId sin incluir toda la relación
    const user = await prisma.user.findUnique({
      where: { id: payload.userId as number },
      select: {
        id: true,
        companies: {
          select: {
            companyId: true
          },
          take: 1
        }
      }
    });

    return user;
  } catch (error) {
    console.error('[COMPROBANTES ID] Error obteniendo usuario desde JWT:', error);
    return null;
  }
}

// GET /api/compras/comprobantes/[id] - Obtener un comprobante con detalles
export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await getUserFromToken();
    if (!user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const companyId = user.companies?.[0]?.companyId;
    if (!companyId) {
      return NextResponse.json({ error: 'Usuario no tiene empresa asignada' }, { status: 400 });
    }

    const id = Number(params.id);
    if (!id || Number.isNaN(id)) {
      return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
    }

    // Verificar si se solicita docType T2 via query param
    const url = new URL(_request.url);
    const requestedDocType = url.searchParams.get('docType');

    // Si se pide T2, buscar primero en BD T2
    if (requestedDocType === 'T2' && isT2DatabaseConfigured()) {
      try {
        const prismaT2 = getT2Client();
        const t2Receipt = await prismaT2.t2PurchaseReceipt.findFirst({
          where: { id, companyId },
          include: {
            items: true,
          },
        });

        if (t2Receipt) {
          // Obtener proveedor y supplierItems de BD principal
          const supplierItemIds = (t2Receipt.items || [])
            .map((i: any) => i.supplierItemId)
            .filter((id: number) => id > 0);

          const [proveedor, supplierItems, t2MatchResults, priceHistoryRecords] = await Promise.all([
            prisma.suppliers.findUnique({
              where: { id: t2Receipt.supplierId },
              select: { id: true, name: true, cuit: true, razon_social: true },
            }),
            supplierItemIds.length > 0
              ? prisma.supplierItem.findMany({
                  where: { id: { in: supplierItemIds } },
                  select: { id: true, nombre: true, codigoProveedor: true, precioUnitario: true },
                })
              : Promise.resolve([]),
            prisma.matchResult.findMany({
              where: { facturaId: id, companyId },
              select: { purchaseOrderId: true },
              take: 1,
            }),
            // Buscar historial de precios para esta factura (puede existir si hubo pago)
            prisma.priceHistory.findMany({
              where: { comprobanteId: id, companyId },
              select: { supplierItemId: true, precioUnitario: true },
            }),
          ]);

          const siMap = new Map(supplierItems.map(si => [si.id, si]));
          const priceHistoryMap = new Map(priceHistoryRecords.map(ph => [ph.supplierItemId, Number(ph.precioUnitario)]));

          return NextResponse.json({
            id: t2Receipt.id,
            numeroSerie: t2Receipt.numeroSerie,
            numeroFactura: t2Receipt.numeroFactura,
            tipo: t2Receipt.tipo,
            fechaEmision: t2Receipt.fechaEmision,
            fechaVencimiento: t2Receipt.fechaVencimiento,
            fechaImputacion: t2Receipt.fechaImputacion,
            estado: t2Receipt.estado,
            total: t2Receipt.total,
            proveedorId: t2Receipt.supplierId,
            docType: 'T2',
            proveedor,
            matchResults: t2MatchResults,
            items: (t2Receipt.items || []).map((i: any) => {
              const si = siMap.get(i.supplierItemId);
              // Obtener precio: prioridad item > priceHistory > supplierItem
              let precioUnitario = Number(i.precioUnitario) || 0;
              if (precioUnitario === 0 && i.supplierItemId) {
                // Fallback 1: historial de precios de esta factura
                const precioHistorico = priceHistoryMap.get(i.supplierItemId);
                if (precioHistorico && precioHistorico > 0) {
                  precioUnitario = precioHistorico;
                } else if (si?.precioUnitario) {
                  // Fallback 2: precio del supplierItem
                  precioUnitario = Number(si.precioUnitario);
                }
              }
              return {
                id: i.id,
                itemId: i.supplierItemId,
                descripcion: i.descripcion || si?.nombre || '',
                cantidad: Number(i.cantidad),
                unidad: 'UN',
                precioUnitario,
                subtotal: precioUnitario > 0 ? precioUnitario * Number(i.cantidad) : Number(i.subtotal),
                supplierItem: si || null,
              };
            }),
          });
        }
      } catch (t2Error) {
        console.error('[COMPROBANTES ID] Error buscando en T2:', t2Error);
      }
    }

    // Buscar en BD principal (T1)
    const comprobante = await prisma.purchaseReceipt.findFirst({
      where: { id, companyId },
      select: {
        id: true,
        numeroSerie: true,
        numeroFactura: true,
        tipo: true,
        fechaEmision: true,
        fechaVencimiento: true,
        fechaImputacion: true,
        estado: true,
        total: true,
        proveedorId: true,
        docType: true,
        proveedor: {
          select: {
            id: true,
            name: true,
            cuit: true,
            razon_social: true,
          },
        },
        tipoCuenta: {
          select: {
            id: true,
            nombre: true,
          },
        },
        items: {
          select: {
            id: true,
            itemId: true,
            descripcion: true,
            cantidad: true,
            unidad: true,
            precioUnitario: true,
            subtotal: true,
            supplierItem: {
              select: {
                id: true,
                nombre: true,
                codigoProveedor: true,
              },
            },
          },
          take: 200 // Limitar items
        },
        matchResults: {
          select: {
            purchaseOrderId: true,
          },
          take: 1,
        },
      },
    });

    if (!comprobante) {
      // Fallback: si no se encontró en T1, intentar en T2 automáticamente
      if (isT2DatabaseConfigured()) {
        try {
          const prismaT2 = getT2Client();
          const t2Receipt = await prismaT2.t2PurchaseReceipt.findFirst({
            where: { id, companyId },
            include: { items: true },
          });

          if (t2Receipt) {
            // Obtener proveedor y supplierItems de BD principal
            const fallbackSupplierItemIds = (t2Receipt.items || [])
              .map((i: any) => i.supplierItemId)
              .filter((sid: number) => sid > 0);

            const [proveedor, fallbackSupplierItems, fallbackMatchResults, fallbackPriceHistory] = await Promise.all([
              prisma.suppliers.findUnique({
                where: { id: t2Receipt.supplierId },
                select: { id: true, name: true, cuit: true, razon_social: true },
              }),
              fallbackSupplierItemIds.length > 0
                ? prisma.supplierItem.findMany({
                    where: { id: { in: fallbackSupplierItemIds } },
                    select: { id: true, nombre: true, codigoProveedor: true, precioUnitario: true },
                  })
                : Promise.resolve([]),
              prisma.matchResult.findMany({
                where: { facturaId: id, companyId },
                select: { purchaseOrderId: true },
                take: 1,
              }),
              prisma.priceHistory.findMany({
                where: { comprobanteId: id, companyId },
                select: { supplierItemId: true, precioUnitario: true },
              }),
            ]);

            const fallbackSiMap = new Map(fallbackSupplierItems.map(si => [si.id, si]));
            const fallbackPriceHistoryMap = new Map(fallbackPriceHistory.map(ph => [ph.supplierItemId, Number(ph.precioUnitario)]));

            return NextResponse.json({
              id: t2Receipt.id,
              numeroSerie: t2Receipt.numeroSerie,
              numeroFactura: t2Receipt.numeroFactura,
              tipo: t2Receipt.tipo,
              fechaEmision: t2Receipt.fechaEmision,
              fechaVencimiento: t2Receipt.fechaVencimiento,
              fechaImputacion: t2Receipt.fechaImputacion,
              estado: t2Receipt.estado,
              total: t2Receipt.total,
              proveedorId: t2Receipt.supplierId,
              docType: 'T2',
              proveedor,
              matchResults: fallbackMatchResults,
              items: (t2Receipt.items || []).map((i: any) => {
                const si = fallbackSiMap.get(i.supplierItemId);
                // Obtener precio: prioridad item > priceHistory > supplierItem
                let precioUnitario = Number(i.precioUnitario) || 0;
                if (precioUnitario === 0 && i.supplierItemId) {
                  const precioHistorico = fallbackPriceHistoryMap.get(i.supplierItemId);
                  if (precioHistorico && precioHistorico > 0) {
                    precioUnitario = precioHistorico;
                  } else if (si?.precioUnitario) {
                    precioUnitario = Number(si.precioUnitario);
                  }
                }
                return {
                  id: i.id,
                  itemId: i.supplierItemId,
                  descripcion: i.descripcion || si?.nombre || '',
                  cantidad: Number(i.cantidad),
                  unidad: 'UN',
                  precioUnitario,
                  subtotal: precioUnitario > 0 ? precioUnitario * Number(i.cantidad) : Number(i.subtotal),
                  supplierItem: si || null,
                };
              }),
            });
          }
        } catch (t2Error) {
          console.error('[COMPROBANTES ID] Error en fallback T2:', t2Error);
        }
      }

      return NextResponse.json(
        { error: 'Comprobante no encontrado para esta empresa' },
        { status: 404 },
      );
    }

    return NextResponse.json(comprobante);
  } catch (error) {
    console.error('[COMPROBANTES ID] Error en GET:', error);
    return NextResponse.json({ error: 'Error al obtener el comprobante' }, { status: 500 });
  }
}

// DELETE /api/compras/comprobantes/[id] - Eliminar un comprobante y sus items
export async function DELETE(_request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await getUserFromToken();
    if (!user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const companyId = user.companies?.[0]?.companyId;
    if (!companyId) {
      return NextResponse.json({ error: 'Usuario no tiene empresa asignada' }, { status: 400 });
    }

    const id = Number(params.id);
    if (!id || Number.isNaN(id)) {
      return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
    }

    // Verificar si se solicita docType T2 via query param
    const url = new URL(_request.url);
    const requestedDocType = url.searchParams.get('docType');

    // Si se pide T2 explícitamente, ir directo a T2 (evita colisión de IDs)
    if (requestedDocType === 'T2' && isT2DatabaseConfigured()) {
      try {
        const prismaT2 = getT2Client();
        const comprobanteT2 = await prismaT2.t2PurchaseReceipt.findFirst({
          where: { id, companyId },
          select: { id: true, estado: true },
        });

        if (comprobanteT2) {
          // Limpiar entidades relacionadas en BD principal que podrían referenciar este T2 ID
          // Nota: se usa una transacción en BD principal para las operaciones T1
          await prisma.$transaction(async (tx) => {
            // Movimientos de cuenta corriente
            await tx.supplierAccountMovement.deleteMany({
              where: { facturaId: id, docType: 'T2' },
            });

            // Desvincular NCAs
            await tx.creditDebitNote.updateMany({
              where: { facturaId: id, docType: 'T2' },
              data: { facturaId: null },
            });

            // Desvincular solicitudes de NCA
            await tx.creditNoteRequest.updateMany({
              where: { facturaId: id },
              data: { facturaId: null },
            });

            // Desvincular recepciones (goodsReceipts)
            await tx.goodsReceipt.updateMany({
              where: { facturaId: id, docType: 'T2' },
              data: { facturaId: null, tieneFactura: false },
            });

            // Desvincular devoluciones
            await tx.purchaseReturn.updateMany({
              where: { facturaId: id, docType: 'T2' },
              data: { facturaId: null },
            });

            // Revertir OCs vinculadas via MatchResult
            const matchResults = await tx.matchResult.findMany({
              where: { facturaId: id },
              select: { purchaseOrderId: true },
            });

            for (const match of matchResults) {
              if (match.purchaseOrderId) {
                const oc = await tx.purchaseOrder.findUnique({
                  where: { id: match.purchaseOrderId },
                  select: { estado: true },
                });

                if (oc?.estado === 'COMPLETADA') {
                  await tx.purchaseOrder.update({
                    where: { id: match.purchaseOrderId },
                    data: {
                      estado: 'APROBADA',
                      fechaEntregaReal: null,
                    },
                  });

                  await tx.purchaseComment.create({
                    data: {
                      entidad: 'order',
                      entidadId: match.purchaseOrderId,
                      tipo: 'SISTEMA',
                      contenido: `Factura T2 eliminada. OC revertida a estado APROBADA.`,
                      companyId,
                      userId: user.id,
                    },
                  });
                }
              }
            }

            // Eliminar MatchResults vinculados
            await tx.matchResult.deleteMany({
              where: { facturaId: id },
            });
          });

          // Eliminar comprobante T2 y sus items en BD T2
          await prismaT2.t2PurchaseReceiptItem.deleteMany({
            where: { receiptId: id },
          });

          await prismaT2.t2PaymentOrderReceipt.deleteMany({
            where: { receiptId: id },
          });

          await prismaT2.t2PurchaseReceipt.delete({
            where: { id },
          });

          // Invalidar caché
          cache.invalidateCache(companyId);

          console.log('[COMPROBANTES ID] DELETE - Comprobante T2 eliminado:', id);

          return NextResponse.json({ success: true, deletedFromT2: true });
        }
      } catch (t2Error: any) {
        console.error('[COMPROBANTES ID] DELETE - Error buscando/eliminando en T2:', t2Error?.message);
        return NextResponse.json(
          { error: 'Error al eliminar comprobante T2' },
          { status: 500 },
        );
      }

      // Si requestedDocType es T2 pero no se encontró, error
      return NextResponse.json(
        { error: 'Comprobante T2 no encontrado' },
        { status: 404 },
      );
    }

    // Buscar en BD principal (T1)
    const comprobanteT1 = await prisma.purchaseReceipt.findFirst({
      where: { id, companyId },
      select: { id: true, estado: true },
    });

    // Si no está en T1, intentar fallback a T2 (para compatibilidad con llamadas sin docType)
    if (!comprobanteT1 && isT2DatabaseConfigured()) {
      try {
        const prismaT2 = getT2Client();
        const comprobanteT2 = await prismaT2.t2PurchaseReceipt.findFirst({
          where: { id, companyId },
          select: { id: true },
        });

        if (comprobanteT2) {
          // Redirigir internamente: llamar DELETE con docType=T2
          const redirectUrl = new URL(_request.url);
          redirectUrl.searchParams.set('docType', 'T2');
          const redirectRequest = new NextRequest(redirectUrl, { method: 'DELETE' });
          return DELETE(redirectRequest, { params });
        }
      } catch {
        // Ignorar errores de T2 fallback
      }
    }

    if (!comprobanteT1) {
      return NextResponse.json(
        { error: 'Comprobante no encontrado para esta empresa' },
        { status: 404 },
      );
    }

    const estadoAnterior = comprobanteT1.estado;

    await prisma.$transaction(async (tx) => {
      // 1) Obtener items para revertir stock
      const items = await tx.purchaseReceiptItem.findMany({
        where: { comprobanteId: id },
      });

      // 2) Revertir stock por cada item
      for (const item of items) {
        if (item.itemId && item.cantidad) {
          const supplierItemId = item.itemId;
          const cantidad = Number(item.cantidad);

          try {
            const stockExistente = await tx.stock.findUnique({
              where: { supplierItemId },
            });

            if (stockExistente) {
              const nuevaCantidad =
                Number(stockExistente.cantidad) - cantidad;

              if (nuevaCantidad > 0) {
                await tx.stock.update({
                  where: { supplierItemId },
                  data: {
                    cantidad: nuevaCantidad,
                    ultimaActualizacion: new Date(),
                  },
                });
              } else {
                // Si con esta factura se quedaba en 0 o menos, eliminamos el registro de stock
                await tx.stock.delete({
                  where: { supplierItemId },
                });
              }
            }
          } catch (e) {
            console.warn(
              '[COMPROBANTES ID] DELETE - No se pudo revertir stock para supplierItemId',
              supplierItemId,
            );
          }
        }
      }

      // 3) Eliminar historial de precios asociado a este comprobante (opcional pero prolijo)
      await tx.priceHistory.deleteMany({
        where: { comprobanteId: id },
      });

      // 4) Eliminar relaciones de órdenes de pago y solicitudes de pago (si las hubiera)
      await tx.paymentOrderReceipt.deleteMany({
        where: { receiptId: id },
      });

      await tx.paymentRequestReceipt.deleteMany({
        where: { receiptId: id },
      });

      // 4b) Eliminar movimientos de cuenta corriente vinculados
      await tx.supplierAccountMovement.deleteMany({
        where: { facturaId: id },
      });

      // 4c) Desvincular NCAs (creditDebitNotes) que referencien esta factura
      await tx.creditDebitNote.updateMany({
        where: { facturaId: id },
        data: { facturaId: null },
      });

      // 4d) Desvincular solicitudes de NCA
      await tx.creditNoteRequest.updateMany({
        where: { facturaId: id },
        data: { facturaId: null },
      });

      // 4e) Desvincular imputaciones de crédito
      await tx.supplierCreditAllocation.deleteMany({
        where: { receiptId: id },
      });

      // 4f) Desvincular recepciones (goodsReceipts) vinculadas a esta factura
      await tx.goodsReceipt.updateMany({
        where: { facturaId: id },
        data: { facturaId: null, tieneFactura: false },
      });

      // 4g) Desvincular devoluciones vinculadas a esta factura
      await tx.purchaseReturn.updateMany({
        where: { facturaId: id },
        data: { facturaId: null },
      });

      // 5) Buscar OCs vinculadas y revertir su estado si estaban COMPLETADA
      const matchResults = await tx.matchResult.findMany({
        where: { facturaId: id },
        select: { purchaseOrderId: true },
      });

      for (const match of matchResults) {
        if (match.purchaseOrderId) {
          // Verificar si la OC está COMPLETADA y revertirla
          const oc = await tx.purchaseOrder.findUnique({
            where: { id: match.purchaseOrderId },
            select: { estado: true },
          });

          if (oc?.estado === 'COMPLETADA') {
            // Revertir a APROBADA (pendiente de cargar nueva factura)
            await tx.purchaseOrder.update({
              where: { id: match.purchaseOrderId },
              data: {
                estado: 'APROBADA',
                fechaEntregaReal: null, // Limpiar fecha de entrega
              },
            });

            // Agregar comentario de trazabilidad
            await tx.purchaseComment.create({
              data: {
                entidad: 'order',
                entidadId: match.purchaseOrderId,
                tipo: 'SISTEMA',
                contenido: `Factura eliminada. OC revertida a estado APROBADA - pendiente de cargar nueva factura.`,
                companyId,
                userId: user.id,
              },
            });
          }
        }
      }

      // 6) Eliminar MatchResult que vincula este comprobante con OCs
      await tx.matchResult.deleteMany({
        where: { facturaId: id },
      });

      // 7) Eliminar items del comprobante
      await tx.purchaseReceiptItem.deleteMany({
        where: { comprobanteId: id },
      });

      // 8) Finalmente, eliminar el comprobante
      await tx.purchaseReceipt.delete({
        where: { id },
      });
    });

    // Invalidar caché después de eliminar
    cache.invalidateCache(companyId);

    // Registrar auditoría
    await logDeletion({
      entidad: 'purchase_receipt',
      entidadId: id,
      companyId,
      userId: user.id,
      estadoAnterior,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[COMPROBANTES ID] Error en DELETE:', error);
    return NextResponse.json({ error: 'Error al eliminar el comprobante' }, { status: 500 });
  }
}

// PUT /api/compras/comprobantes/[id] - Actualizar datos de un comprobante (cabecera)
export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await getUserFromToken();
    if (!user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const companyId = user.companies?.[0]?.companyId;
    if (!companyId) {
      return NextResponse.json({ error: 'Usuario no tiene empresa asignada' }, { status: 400 });
    }

    const id = Number(params.id);
    if (!id || Number.isNaN(id)) {
      return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
    }

    // Verificar si se solicita docType T2 via query param
    const putUrl = new URL(request.url);
    const putRequestedDocType = putUrl.searchParams.get('docType');

    const body = await request.json();

    // Si es T2, actualizar en BD T2
    if (putRequestedDocType === 'T2' && isT2DatabaseConfigured()) {
      try {
        const prismaT2 = getT2Client();
        const comprobanteT2 = await prismaT2.t2PurchaseReceipt.findFirst({
          where: { id, companyId },
        });

        if (!comprobanteT2) {
          return NextResponse.json({ error: 'Comprobante T2 no encontrado' }, { status: 404 });
        }

        const t2Data: any = {};
        if (body.numeroSerie) t2Data.numeroSerie = body.numeroSerie;
        if (body.numeroFactura) t2Data.numeroFactura = body.numeroFactura;
        if (body.fechaEmision) t2Data.fechaEmision = new Date(body.fechaEmision);
        if (body.fechaVencimiento !== undefined) {
          t2Data.fechaVencimiento = body.fechaVencimiento ? new Date(body.fechaVencimiento) : null;
        }
        if (body.fechaImputacion) t2Data.fechaImputacion = new Date(body.fechaImputacion);
        if (body.tipoPago) t2Data.tipoPago = body.tipoPago;
        if (typeof body.estado === 'string') t2Data.estado = body.estado;
        if (typeof body.observaciones === 'string' || body.observaciones === null) t2Data.observaciones = body.observaciones;
        if (body.neto !== undefined && body.neto !== null && body.neto !== '') t2Data.neto = parseFloat(body.neto);
        if (body.total !== undefined && body.total !== null && body.total !== '') t2Data.total = parseFloat(body.total);
        if (body.tipoCuentaId) t2Data.tipoCuentaId = Number(body.tipoCuentaId);
        if (body.proveedorId) t2Data.supplierId = Number(body.proveedorId);

        await prismaT2.t2PurchaseReceipt.update({
          where: { id },
          data: t2Data,
        });

        // Si hay items, actualizarlos
        if (body.items && Array.isArray(body.items)) {
          await prismaT2.t2PurchaseReceiptItem.deleteMany({
            where: { receiptId: id },
          });

          for (const item of body.items) {
            await prismaT2.t2PurchaseReceiptItem.create({
              data: {
                receiptId: id,
                supplierItemId: item.itemId ? Number(item.itemId) : 0,
                cantidad: parseFloat(item.cantidad) || 0,
                precioUnitario: parseFloat(item.precioUnitario) || 0,
                subtotal: parseFloat(item.subtotal) || 0,
                descripcion: item.descripcion || null,
              },
            });
          }
        }

        cache.invalidateCache(companyId);

        // Obtener comprobante actualizado
        const updatedT2 = await prismaT2.t2PurchaseReceipt.findUnique({
          where: { id },
          include: { items: true },
        });

        return NextResponse.json({
          ...updatedT2,
          docType: 'T2',
        });
      } catch (t2Error: any) {
        console.error('[COMPROBANTES ID] PUT - Error actualizando T2:', t2Error?.message);
        return NextResponse.json(
          { error: t2Error?.message || 'Error al actualizar comprobante T2' },
          { status: 500 },
        );
      }
    }

    // T1 flow
    // Obtener estado actual antes de actualizar
    const currentComprobante = await prisma.purchaseReceipt.findFirst({
      where: { id, companyId },
      select: { estado: true },
    });
    const estadoAnterior = currentComprobante?.estado;
    console.log('[COMPROBANTES ID] PUT - Body recibido:', body);
    
    const {
      numeroSerie,
      numeroFactura,
      tipo,
      proveedorId,
      fechaEmision,
      fechaVencimiento,
      fechaImputacion,
      tipoPago,
      metodoPago,
      estado,
      observaciones,
      neto,
      iva21,
      noGravado,
      impInter,
      percepcionIVA,
      percepcionIIBB,
      otrosConceptos,
      iva105,
      iva27,
      exento,
      iibb,
      total,
      tipoCuentaId,
      items,
    } = body;

    // Actualizar el comprobante principal
    const data: any = {};
    if (numeroSerie) data.numeroSerie = numeroSerie;
    if (numeroFactura) data.numeroFactura = numeroFactura;
    if (tipo) data.tipo = tipo;
    if (proveedorId) data.proveedorId = Number(proveedorId);
    if (fechaEmision) data.fechaEmision = new Date(fechaEmision);
    if (fechaVencimiento !== undefined) {
      data.fechaVencimiento = fechaVencimiento ? new Date(fechaVencimiento) : null;
    }
    if (fechaImputacion) data.fechaImputacion = new Date(fechaImputacion);
    if (typeof tipoPago === 'string') data.tipoPago = tipoPago;
    if (typeof metodoPago === 'string' || metodoPago === null) data.metodoPago = metodoPago;
    if (typeof estado === 'string') data.estado = estado;
    if (typeof observaciones === 'string' || observaciones === null) {
      data.observaciones = observaciones;
    }
    if (neto !== undefined && neto !== null && neto !== '') data.neto = parseFloat(neto);
    if (iva21 !== undefined && iva21 !== null && iva21 !== '') data.iva21 = parseFloat(iva21);
    if (noGravado !== undefined && noGravado !== null && noGravado !== '') data.noGravado = parseFloat(noGravado);
    if (impInter !== undefined && impInter !== null && impInter !== '') data.impInter = parseFloat(impInter);
    if (percepcionIVA !== undefined && percepcionIVA !== null && percepcionIVA !== '') data.percepcionIVA = parseFloat(percepcionIVA);
    if (percepcionIIBB !== undefined && percepcionIIBB !== null && percepcionIIBB !== '') data.percepcionIIBB = parseFloat(percepcionIIBB);
    if (otrosConceptos !== undefined && otrosConceptos !== null && otrosConceptos !== '') data.otrosConceptos = parseFloat(otrosConceptos);
    if (iva105 !== undefined && iva105 !== null && iva105 !== '') data.iva105 = parseFloat(iva105);
    if (iva27 !== undefined && iva27 !== null && iva27 !== '') data.iva27 = parseFloat(iva27);
    if (exento !== undefined && exento !== null && exento !== '') data.exento = parseFloat(exento);
    if (iibb !== undefined && iibb !== null && iibb !== '') data.iibb = parseFloat(iibb);
    if (total !== undefined && total !== null && total !== '') data.total = parseFloat(total);
    if (tipoCuentaId) data.tipoCuentaId = Number(tipoCuentaId);

    console.log('[COMPROBANTES ID] PUT - Data a actualizar:', data);

    // Actualizar el comprobante, items y stock en una transacción
    const updated = await prisma.$transaction(async (tx) => {
      // Actualizar el comprobante principal
      const updatedReceipt = await tx.purchaseReceipt.updateMany({
        where: { id, companyId },
        data,
      });

      if (updatedReceipt.count === 0) {
        throw new Error('Comprobante no encontrado para esta empresa');
      }

      // Si hay items, actualizarlos y ajustar stock
      if (items && Array.isArray(items)) {
        // 1) Revertir el impacto de los items anteriores en el stock
        const existingItems = await tx.purchaseReceiptItem.findMany({
          where: { comprobanteId: id },
        });

        for (const oldItem of existingItems) {
          if (oldItem.itemId && oldItem.cantidad) {
            const supplierItemId = oldItem.itemId;
            const cantidad = Number(oldItem.cantidad);

            try {
              const stockExistente = await tx.stock.findUnique({
                where: { supplierItemId },
              });

              if (stockExistente) {
                const nuevaCantidad =
                  Number(stockExistente.cantidad) - cantidad;

                if (nuevaCantidad > 0) {
                  await tx.stock.update({
                    where: { supplierItemId },
                    data: {
                      cantidad: nuevaCantidad,
                      ultimaActualizacion: new Date(),
                    },
                  });
                } else {
                  await tx.stock.delete({
                    where: { supplierItemId },
                  });
                }
              }
            } catch (e) {
              // Si no existe stock para ese item, lo ignoramos
              console.warn(
                '[COMPROBANTES ID] PUT - No se pudo revertir stock para supplierItemId',
                supplierItemId,
              );
            }
          }
        }

        // 2) Eliminar items existentes
        await tx.purchaseReceiptItem.deleteMany({
          where: { comprobanteId: id },
        });

        // 3) Crear nuevos items y aplicar su impacto al stock + historial de precios
        for (const item of items) {
          const createdItem = await tx.purchaseReceiptItem.create({
            data: {
              comprobanteId: id,
              companyId: companyId,
              itemId: item.itemId ? Number(item.itemId) : null,
              descripcion: item.descripcion || '',
              cantidad: parseFloat(item.cantidad) || 0,
              unidad: item.unidad || '',
              precioUnitario: parseFloat(item.precioUnitario) || 0,
              subtotal: parseFloat(item.subtotal) || 0,
              proveedorId: item.proveedorId ? Number(item.proveedorId) : Number(proveedorId),
            },
          });

          // Solo actualizamos stock si el item está vinculado a un SupplierItem
          if (item.itemId && item.cantidad && item.precioUnitario) {
            const supplierItemId = Number(item.itemId);
            const cantidad = parseFloat(item.cantidad);
            const precioUnitario = parseFloat(item.precioUnitario);

            // Actualizar o crear stock
            const stockExistente = await tx.stock.findUnique({
              where: { supplierItemId },
            });

            if (stockExistente) {
              await tx.stock.update({
                where: { supplierItemId },
                data: {
                  cantidad: {
                    increment: cantidad,
                  },
                  precioUnitario,
                  ultimaActualizacion: new Date(),
                },
              });
            } else {
              await tx.stock.create({
                data: {
                  supplierItemId,
                  cantidad,
                  unidad: item.unidad || '',
                  precioUnitario,
                  companyId,
                },
              });
            }

            // Crear registro en historial de precios
            await tx.priceHistory.create({
              data: {
                supplierItemId,
                precioUnitario,
                comprobanteId: id,
                fecha: fechaEmision ? new Date(fechaEmision) : new Date(),
                companyId,
              },
            });
          }
        }
      }

      return updatedReceipt;
    });

    // Obtener el comprobante actualizado con todas sus relaciones - Optimizado
    const comprobante = await prisma.purchaseReceipt.findUnique({
      where: { id },
      select: {
        id: true,
        numeroSerie: true,
        numeroFactura: true,
        tipo: true,
        fechaEmision: true,
        fechaVencimiento: true,
        fechaImputacion: true,
        estado: true,
        total: true,
        proveedorId: true,
        proveedor: {
          select: {
            id: true,
            name: true,
            cuit: true,
            razon_social: true,
          },
        },
        tipoCuenta: {
          select: {
            id: true,
            nombre: true,
          },
        },
        items: {
          select: {
            id: true,
            descripcion: true,
            cantidad: true,
            unidad: true,
            precioUnitario: true,
            subtotal: true,
            supplierItem: {
              select: {
                id: true,
                nombre: true,
                codigoProveedor: true,
              },
            },
          },
          take: 200 // Limitar items
        },
      },
    });

    if (!comprobante) {
      return NextResponse.json(
        { error: 'Comprobante no encontrado' },
        { status: 404 },
      );
    }

    // Invalidar caché después de actualizar
    cache.invalidateCache(companyId);

    // Registrar auditoría si el estado cambió
    if (comprobante && estadoAnterior && comprobante.estado !== estadoAnterior) {
      await logStatusChange({
        entidad: 'purchase_receipt',
        entidadId: id,
        estadoAnterior,
        estadoNuevo: comprobante.estado,
        companyId,
        userId: user.id,
      });
    }

    console.log('[COMPROBANTES ID] PUT - Comprobante actualizado:', comprobante);
    return NextResponse.json(comprobante);
  } catch (error: any) {
    console.error('[COMPROBANTES ID] Error en PUT:', error);
    if (error.message === 'Comprobante no encontrado para esta empresa') {
      return NextResponse.json(
        { error: 'Comprobante no encontrado para esta empresa' },
        { status: 404 },
      );
    }
    return NextResponse.json(
      { error: error.message || 'Error al actualizar el comprobante' },
      { status: 500 },
    );
  }
}


