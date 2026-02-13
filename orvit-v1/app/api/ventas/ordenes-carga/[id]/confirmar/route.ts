/**
 * POST /api/ventas/ordenes-carga/[id]/confirmar
 *
 * O2C Phase 2 - Confirm load order and emit documents.
 * This is the "closing" step that:
 * 1. Updates LoadOrder to CARGADA
 * 2. Updates cantidadCargada in items (may differ from original)
 * 3. Updates Delivery with actual quantities
 * 4. Emits Remito (PREPARADO → EMITIDO)
 * 5. Decrements stock (ProductStockMovement)
 * 6. If enableInvoiceByDelivery:
 *    - Updates Invoice items with actual quantities
 *    - Emits Invoice (BORRADOR → EMITIDA)
 *    - Creates ClientLedgerEntry
 *    - Updates currentDebt
 * 7. Updates Sale state
 *
 * Headers:
 * - Idempotency-Key: required
 *
 * Request body:
 * - items: Array<{ loadOrderItemId, cantidadCargada, motivoDiferencia? }>
 * - firmaOperario?: string (base64)
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requirePermission, VENTAS_PERMISSIONS } from '@/lib/ventas/auth';
import { Prisma } from '@prisma/client';
import { confirmLoadOrderSchema } from '@/lib/ventas/validation-schemas';

export const dynamic = 'force-dynamic';

const IDEMPOTENCY_TTL_HOURS = 24;

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

interface RouteParams {
  params: { id: string };
}

interface ConfirmLoadItem {
  loadOrderItemId: number;
  cantidadCargada: number;
  motivoDiferencia?: string;
}

interface ConfirmLoadRequest {
  items: ConfirmLoadItem[];
  firmaOperario?: string;
}

interface ConfirmLoadResult {
  loadOrder: {
    id: number;
    numero: string;
    estado: string;
  };
  remito: {
    id: number;
    numero: string;
    estado: string;
  };
  invoice?: {
    id: number;
    numeroCompleto: string;
    estado: string;
    total: string;
  };
  stockMovements: number;
  ledgerEntryCreated: boolean;
  clientBalanceUpdated: boolean;
  differences: Array<{
    itemId: number;
    original: number;
    loaded: number;
    motivo?: string;
  }>;
}

// ═══════════════════════════════════════════════════════════════════════════════
// IDEMPOTENCY
// ═══════════════════════════════════════════════════════════════════════════════

async function checkIdempotency(
  idempotencyKey: string,
  companyId: number
): Promise<ConfirmLoadResult | null> {
  const existing = await prisma.idempotencyKey.findUnique({
    where: {
      companyId_key: { companyId, key: idempotencyKey },
    },
  });

  if (existing && existing.status === 'COMPLETED' && existing.response) {
    return existing.response as unknown as ConfirmLoadResult;
  }

  if (existing && existing.status === 'PROCESSING') {
    throw new Error('CONCURRENT_OPERATION');
  }

  return null;
}

async function markIdempotencyProcessing(
  idempotencyKey: string,
  companyId: number,
  loadOrderId: number
): Promise<void> {
  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + IDEMPOTENCY_TTL_HOURS);

  await prisma.idempotencyKey.upsert({
    where: {
      companyId_key: { companyId, key: idempotencyKey },
    },
    create: {
      key: idempotencyKey,
      companyId,
      operation: 'CONFIRM_LOAD',
      entityType: 'LOAD_ORDER',
      entityId: loadOrderId,
      status: 'PROCESSING',
      expiresAt,
    },
    update: {
      status: 'PROCESSING',
      expiresAt,
    },
  });
}

async function markIdempotencyCompleted(
  idempotencyKey: string,
  companyId: number,
  result: ConfirmLoadResult
): Promise<void> {
  await prisma.idempotencyKey.update({
    where: {
      companyId_key: { companyId, key: idempotencyKey },
    },
    data: {
      status: 'COMPLETED',
      response: result as unknown as Prisma.JsonObject,
    },
  });
}

async function markIdempotencyFailed(
  idempotencyKey: string,
  companyId: number
): Promise<void> {
  await prisma.idempotencyKey.update({
    where: {
      companyId_key: { companyId, key: idempotencyKey },
    },
    data: {
      status: 'FAILED',
    },
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN ENDPOINT
// ═══════════════════════════════════════════════════════════════════════════════

export async function POST(request: NextRequest, { params }: RouteParams) {
  let idempotencyKey: string | null = null;
  let companyId: number | null = null;

  try {
    // 1. Authenticate and check permission
    const { user, error } = await requirePermission(VENTAS_PERMISSIONS.ORDENES_CONFIRM);
    if (error) return error;

    companyId = user!.companyId;

    // 2. Validate Idempotency-Key
    idempotencyKey = request.headers.get('Idempotency-Key');
    if (!idempotencyKey) {
      return NextResponse.json(
        { error: 'Idempotency-Key header es requerido' },
        { status: 400 }
      );
    }

    // 3. Check for replay
    const existingResult = await checkIdempotency(idempotencyKey, companyId);
    if (existingResult) {
      return NextResponse.json(existingResult, {
        headers: {
          'Idempotency-Replayed': 'true',
          'Idempotency-Key': idempotencyKey,
        },
      });
    }

    // 4. Parse and validate request
    const loadOrderId = parseInt(params.id);
    if (isNaN(loadOrderId)) {
      return NextResponse.json({ error: 'ID de orden de carga inválido' }, { status: 400 });
    }

    const body = await request.json();

    // Validate with Zod schema
    const validation = confirmLoadOrderSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Datos de entrada inválidos', details: validation.error.errors },
        { status: 400 }
      );
    }

    const data = validation.data;

    // 5. Mark as processing
    await markIdempotencyProcessing(idempotencyKey, companyId, loadOrderId);

    // 6. Execute in transaction
    const result = await prisma.$transaction(
      async (tx) => {
        // 6.1 Get LoadOrder with all related data
        const loadOrder = await tx.loadOrder.findFirst({
          where: { id: loadOrderId, companyId },
          include: {
            items: {
              include: {
                saleItem: {
                  include: {
                    product: true,
                  },
                },
              },
            },
            sale: {
              include: {
                client: true,
                items: true,
              },
            },
            delivery: {
              include: {
                items: true,
                remitos: {
                  include: {
                    items: true,
                  },
                },
              },
            },
          },
        });

        if (!loadOrder) {
          throw new Error('LOAD_ORDER_NOT_FOUND');
        }

        // 6.2 Validate state
        if (loadOrder.estado !== 'PENDIENTE' && loadOrder.estado !== 'CARGANDO') {
          throw new Error(`INVALID_STATE:${loadOrder.estado}`);
        }

        // 6.3 Get related invoice
        const invoice = await tx.salesInvoice.findFirst({
          where: {
            saleId: loadOrder.saleId,
            estado: 'BORRADOR',
          },
          include: {
            items: true,
          },
        });

        // 6.4 Get sales config
        const salesConfig = await tx.salesConfig.findUnique({
          where: { companyId: companyId! },
        });

        const enableInvoiceByDelivery = salesConfig?.enableInvoiceByDelivery ?? true;

        // 6.5 Validate and process items
        const differences: ConfirmLoadResult['differences'] = [];
        const loadOrderItemIds = loadOrder.items.map((i) => i.id);

        for (const item of data.items) {
          if (!loadOrderItemIds.includes(item.loadOrderItemId)) {
            throw new Error(`INVALID_LOAD_ORDER_ITEM:${item.loadOrderItemId}`);
          }
          if (item.cantidadCargada < 0) {
            throw new Error(`INVALID_QUANTITY:${item.loadOrderItemId}`);
          }
        }

        // 6.6 Update LoadOrderItems and track differences
        let stockMovementsCreated = 0;

        for (const item of data.items) {
          const loadOrderItem = loadOrder.items.find((i) => i.id === item.loadOrderItemId);
          if (!loadOrderItem) continue;

          const originalQty = Number(loadOrderItem.cantidad);
          const loadedQty = item.cantidadCargada;

          // Update LoadOrderItem
          await tx.loadOrderItem.update({
            where: { id: item.loadOrderItemId },
            data: {
              cantidadCargada: new Prisma.Decimal(loadedQty),
            },
          });

          // Track differences
          if (originalQty !== loadedQty) {
            differences.push({
              itemId: item.loadOrderItemId,
              original: originalQty,
              loaded: loadedQty,
              motivo: item.motivoDiferencia,
            });
          }

          // Decrement stock if product exists
          if (loadOrderItem.productId && loadedQty > 0) {
            // Get current stock
            const product = await tx.product.findUnique({
              where: { id: loadOrderItem.productId },
              select: { stockQuantity: true },
            });

            const stockAnterior = product?.stockQuantity ? Number(product.stockQuantity) : 0;
            const stockPosterior = stockAnterior - loadedQty;

            // Create stock movement
            await tx.productStockMovement.create({
              data: {
                productId: loadOrderItem.productId,
                tipo: 'VENTA',
                cantidad: -loadedQty, // Negative for outgoing
                stockAnterior,
                stockPosterior,
                sourceType: 'SALE',
                sourceId: loadOrder.id.toString(),
                sourceNumber: loadOrder.numero,
                notas: `Carga confirmada - OC ${loadOrder.numero}`,
                companyId: companyId!,
                createdBy: user!.id,
              },
            });

            // Update product stock
            await tx.product.update({
              where: { id: loadOrderItem.productId },
              data: {
                stockQuantity: stockPosterior,
              },
            });

            stockMovementsCreated++;
          }
        }

        // 6.7 Update LoadOrder state
        await tx.loadOrder.update({
          where: { id: loadOrderId },
          data: {
            estado: 'CARGADA',
          },
        });

        // 6.8 Update Delivery
        if (loadOrder.delivery) {
          await tx.saleDelivery.update({
            where: { id: loadOrder.delivery.id },
            data: {
              estado: 'LISTA_PARA_DESPACHO',
            },
          });
        }

        // 6.9 Emit Remito (PREPARADO → EMITIDO)
        let remitoResult = null;
        if (loadOrder.delivery?.remitos && loadOrder.delivery.remitos.length > 0) {
          const remito = loadOrder.delivery.remitos[0]; // Get first remito
          await tx.saleRemito.update({
            where: { id: remito.id },
            data: {
              estado: 'EMITIDO',
            },
          });
          remitoResult = {
            id: remito.id,
            numero: remito.numero,
            estado: 'EMITIDO',
          };
        }

        // 6.10 Emit Invoice if enabled
        let invoiceResult = null;
        let ledgerEntryCreated = false;
        let clientBalanceUpdated = false;

        if (invoice && enableInvoiceByDelivery) {
          // Recalculate invoice totals based on actual quantities loaded
          let netoGravado = new Prisma.Decimal(0);
          let iva21 = new Prisma.Decimal(0);

          for (const item of data.items) {
            const loadOrderItem = loadOrder.items.find((i) => i.id === item.loadOrderItemId);
            if (!loadOrderItem?.saleItem) continue;

            const saleItem = loadOrderItem.saleItem;
            const cantidad = new Prisma.Decimal(item.cantidadCargada);
            const subtotal = saleItem.precioUnitario.mul(cantidad).mul(
              new Prisma.Decimal(1).minus(saleItem.descuento.div(100))
            );
            const tasaIva = loadOrder.sale.tasaIva || new Prisma.Decimal(21);
            const ivaAmount = subtotal.mul(tasaIva.div(100));

            netoGravado = netoGravado.plus(subtotal);
            iva21 = iva21.plus(ivaAmount);

            // Update invoice item quantity
            const invoiceItem = invoice.items.find((ii) => ii.saleItemId === saleItem.id);
            if (invoiceItem) {
              await tx.salesInvoiceItem.update({
                where: { id: invoiceItem.id },
                data: {
                  cantidad,
                  subtotal,
                },
              });
            }
          }

          const total = netoGravado.plus(iva21);

          // Update and emit invoice
          const updatedInvoice = await tx.salesInvoice.update({
            where: { id: invoice.id },
            data: {
              estado: 'EMITIDA',
              netoGravado,
              iva21,
              total,
              saldoPendiente: total,
            },
          });

          invoiceResult = {
            id: updatedInvoice.id,
            numeroCompleto: updatedInvoice.numeroCompleto,
            estado: 'EMITIDA',
            total: total.toString(),
          };

          // Create ClientLedgerEntry
          await tx.clientLedgerEntry.create({
            data: {
              clientId: loadOrder.sale.clientId,
              tipo: 'FACTURA',
              debe: total, // Invoices go to debit (increase debt)
              haber: new Prisma.Decimal(0),
              saldo: new Prisma.Decimal(0), // Will be calculated by balance rebuilder
              comprobante: updatedInvoice.numeroCompleto,
              descripcion: `Factura ${updatedInvoice.numeroCompleto}`,
              referenceType: 'INVOICE',
              referenceId: updatedInvoice.id,
              invoiceId: updatedInvoice.id,
              docType: loadOrder.docType,
              companyId: companyId!,
            },
          });

          ledgerEntryCreated = true;

          // Update client currentBalance (cache)
          await tx.client.update({
            where: { id: loadOrder.sale.clientId },
            data: {
              currentBalance: {
                increment: total,
              },
            },
          });

          clientBalanceUpdated = true;
        }

        // 6.11 Update Sale state
        const allItemsDelivered = loadOrder.sale.items.every((saleItem) => {
          const loadOrderItem = loadOrder.items.find((loi) => loi.saleItemId === saleItem.id);
          const bodyItem = data.items.find((bi) => bi.loadOrderItemId === loadOrderItem?.id);
          return bodyItem && bodyItem.cantidadCargada >= Number(saleItem.cantidad);
        });

        const hasPartialDelivery = data.items.some((bi) => {
          const loadOrderItem = loadOrder.items.find((loi) => loi.id === bi.loadOrderItemId);
          const saleItem = loadOrder.sale.items.find((si) => si.id === loadOrderItem?.saleItemId);
          return saleItem && bi.cantidadCargada < Number(saleItem.cantidad);
        });

        let newSaleState: string;
        if (hasPartialDelivery) {
          newSaleState = 'PARCIALMENTE_ENTREGADA';
        } else if (allItemsDelivered) {
          newSaleState = invoiceResult ? 'FACTURADA' : 'ENTREGADA';
        } else {
          newSaleState = 'EN_PREPARACION';
        }

        await tx.sale.update({
          where: { id: loadOrder.saleId },
          data: {
            estado: newSaleState as any,
          },
        });

        // Update SaleItem quantities
        for (const item of data.items) {
          const loadOrderItem = loadOrder.items.find((i) => i.id === item.loadOrderItemId);
          if (loadOrderItem) {
            await tx.saleItem.update({
              where: { id: loadOrderItem.saleItemId },
              data: {
                cantidadEntregada: {
                  increment: item.cantidadCargada,
                },
                cantidadPendiente: {
                  decrement: item.cantidadCargada,
                },
              },
            });
          }
        }

        return {
          loadOrder: {
            id: loadOrder.id,
            numero: loadOrder.numero,
            estado: 'CARGADA',
          },
          remito: remitoResult || {
            id: 0,
            numero: '',
            estado: 'NO_REMITO',
          },
          invoice: invoiceResult || undefined,
          stockMovements: stockMovementsCreated,
          ledgerEntryCreated,
          clientBalanceUpdated,
          differences,
        };
      },
      {
        timeout: 60000, // 60 seconds for this complex operation
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      }
    );

    // 7. Mark idempotency as completed
    await markIdempotencyCompleted(idempotencyKey, companyId, result);

    return NextResponse.json(result, {
      status: 200,
      headers: {
        'Idempotency-Key': idempotencyKey,
      },
    });
  } catch (error) {
    // Mark idempotency as failed if we started processing
    if (idempotencyKey && companyId) {
      try {
        await markIdempotencyFailed(idempotencyKey, companyId);
      } catch {
        // Ignore cleanup errors
      }
    }

    // Handle specific errors
    if (error instanceof Error) {
      if (error.message === 'CONCURRENT_OPERATION') {
        return NextResponse.json(
          { error: 'Operación en proceso. Por favor espere antes de reintentar.' },
          { status: 409 }
        );
      }
      if (error.message === 'LOAD_ORDER_NOT_FOUND') {
        return NextResponse.json(
          { error: 'Orden de carga no encontrada' },
          { status: 404 }
        );
      }
      if (error.message.startsWith('INVALID_STATE:')) {
        const state = error.message.split(':')[1];
        return NextResponse.json(
          { error: `La orden de carga debe estar en estado PENDIENTE o CARGANDO. Estado actual: ${state}` },
          { status: 400 }
        );
      }
      if (error.message.startsWith('INVALID_LOAD_ORDER_ITEM:')) {
        const itemId = error.message.split(':')[1];
        return NextResponse.json(
          { error: `Item de orden de carga inválido: ${itemId}` },
          { status: 400 }
        );
      }
      if (error.message.startsWith('INVALID_QUANTITY:')) {
        const itemId = error.message.split(':')[1];
        return NextResponse.json(
          { error: `Cantidad inválida para item: ${itemId}` },
          { status: 400 }
        );
      }
    }

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Datos de entrada inválidos', details: error.errors },
        { status: 400 }
      );
    }

    console.error('[CONFIRMAR-CARGA] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error interno' },
      { status: 500 }
    );
  }
}
