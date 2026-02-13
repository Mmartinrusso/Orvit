/**
 * POST /api/ventas/ordenes/[id]/paquete-documentos
 *
 * O2C Phase 2 - Create document package for a sale.
 * Creates: LoadOrder + Delivery + Remito (PREPARADO) + Invoice (BORRADOR)
 *
 * This endpoint is SAFE: it creates documents in intermediate states.
 * The "Confirm Load" step is what actually:
 * - Decrements stock
 * - Emits remito
 * - Emits invoice
 * - Creates ledger entry
 *
 * Headers:
 * - Idempotency-Key: required (prevents duplicate packages)
 *
 * Request body:
 * - items: Array<{ saleItemId, cantidad, secuencia?, posicion? }>
 * - vehiculo?: string
 * - vehiculoPatente?: string
 * - chofer?: string
 * - choferDNI?: string
 * - observaciones?: string
 * - docType: 'T1' | 'T2'
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePermission, VENTAS_PERMISSIONS } from '@/lib/ventas/auth';
import { Prisma, DocType } from '@prisma/client';
import { getNextNumber } from '@/lib/ventas/sequence-generator';
import { isValidTransition } from '@/lib/ventas/state-machine';

export const dynamic = 'force-dynamic';

const IDEMPOTENCY_TTL_HOURS = 24;

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

interface RouteParams {
  params: { id: string };
}

interface PackageItem {
  saleItemId: number;
  cantidad: number;
  secuencia?: number;
  posicion?: string;
}

interface PackageDocumentsRequest {
  items: PackageItem[];
  vehiculo?: string;
  vehiculoPatente?: string;
  chofer?: string;
  choferDNI?: string;
  observaciones?: string;
  docType?: 'T1' | 'T2';
}

interface PackageDocumentsResult {
  loadOrder: {
    id: number;
    numero: string;
    estado: string;
  };
  delivery: {
    id: number;
    numero: string;
    estado: string;
  };
  remito: {
    id: number;
    numero: string;
    estado: string;
  };
  invoice: {
    id: number;
    numeroCompleto: string;
    estado: string;
  };
  sale: {
    id: number;
    numero: string;
    estado: string;
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// IDEMPOTENCY
// ═══════════════════════════════════════════════════════════════════════════════

async function checkIdempotency(
  idempotencyKey: string,
  companyId: number
): Promise<PackageDocumentsResult | null> {
  const existing = await prisma.idempotencyKey.findUnique({
    where: {
      companyId_key: { companyId, key: idempotencyKey },
    },
  });

  if (existing && existing.status === 'COMPLETED' && existing.response) {
    return existing.response as unknown as PackageDocumentsResult;
  }

  if (existing && existing.status === 'PROCESSING') {
    throw new Error('CONCURRENT_OPERATION');
  }

  return null;
}

async function markIdempotencyProcessing(
  idempotencyKey: string,
  companyId: number,
  saleId: number
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
      operation: 'PACKAGE_DOCUMENTS',
      entityType: 'SALE',
      entityId: saleId,
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
  result: PackageDocumentsResult
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
    const { user, error } = await requirePermission(VENTAS_PERMISSIONS.ORDENES_EDIT);
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
    const saleId = parseInt(params.id);
    if (isNaN(saleId)) {
      return NextResponse.json({ error: 'ID de orden inválido' }, { status: 400 });
    }

    const body: PackageDocumentsRequest = await request.json();

    if (!body.items || !Array.isArray(body.items) || body.items.length === 0) {
      return NextResponse.json({ error: 'items es requerido y debe contener al menos un elemento' }, { status: 400 });
    }

    const docType: DocType = body.docType === 'T2' ? 'T2' : 'T1';

    // 5. Mark as processing
    await markIdempotencyProcessing(idempotencyKey, companyId, saleId);

    // 6. Execute in transaction
    const result = await prisma.$transaction(
      async (tx) => {
        // 6.1 Get sale with items
        const sale = await tx.sale.findFirst({
          where: { id: saleId, companyId },
          include: {
            client: {
              select: {
                id: true,
                legalName: true,
                name: true,
                address: true,
                fiscalCategory: true,
              },
            },
            items: {
              include: {
                product: {
                  select: { id: true, name: true, code: true },
                },
              },
            },
          },
        });

        if (!sale) {
          throw new Error('SALE_NOT_FOUND');
        }

        // 6.2 Validate state transition
        const allowedFromStates = ['CONFIRMADA'];
        if (!allowedFromStates.includes(sale.estado)) {
          throw new Error(`INVALID_STATE:${sale.estado}`);
        }

        // 6.3 Validate items
        const saleItemIds = sale.items.map((i) => i.id);
        for (const item of body.items) {
          if (!saleItemIds.includes(item.saleItemId)) {
            throw new Error(`INVALID_SALE_ITEM:${item.saleItemId}`);
          }
          if (item.cantidad <= 0) {
            throw new Error(`INVALID_QUANTITY:${item.saleItemId}`);
          }
        }

        // 6.4 Get sequence numbers
        const loadOrderSeq = await getNextNumber(companyId!, 'LOADORDER');
        const deliverySeq = await getNextNumber(companyId!, 'DELIVERY');
        const remitoSeq = await getNextNumber(companyId!, 'REMITO');

        // Get sales config for invoice settings
        const salesConfig = await tx.salesConfig.findUnique({
          where: { companyId: companyId! },
        });

        const puntoVenta = salesConfig?.puntoVenta || '0001';
        const invoiceTipo = getInvoiceType(sale.client.fiscalCategory);

        // 6.5 Create LoadOrder
        const loadOrder = await tx.loadOrder.create({
          data: {
            numero: loadOrderSeq.formatted,
            fecha: new Date(),
            estado: 'PENDIENTE',
            saleId: sale.id,
            vehiculo: body.vehiculo,
            vehiculoPatente: body.vehiculoPatente,
            chofer: body.chofer,
            choferDNI: body.choferDNI,
            observaciones: body.observaciones,
            docType,
            companyId: companyId!,
            createdBy: user!.id,
          },
        });

        // 6.6 Create LoadOrderItems
        for (const item of body.items) {
          const saleItem = sale.items.find((si) => si.id === item.saleItemId);
          await tx.loadOrderItem.create({
            data: {
              loadOrderId: loadOrder.id,
              saleItemId: item.saleItemId,
              productId: saleItem?.productId,
              cantidad: new Prisma.Decimal(item.cantidad),
              secuencia: item.secuencia || 0,
              posicion: item.posicion,
            },
          });
        }

        // 6.7 Create SaleDelivery
        const delivery = await tx.saleDelivery.create({
          data: {
            numero: deliverySeq.formatted,
            saleId: sale.id,
            clientId: sale.clientId,
            estado: 'PENDIENTE',
            direccionEntrega: sale.client.address,
            docType,
            companyId: companyId!,
            createdBy: user!.id,
          },
        });

        // 6.8 Create SaleDeliveryItems
        for (const item of body.items) {
          const saleItem = sale.items.find((si) => si.id === item.saleItemId);
          await tx.saleDeliveryItem.create({
            data: {
              deliveryId: delivery.id,
              saleItemId: item.saleItemId,
              productId: saleItem?.productId,
              cantidad: new Prisma.Decimal(item.cantidad),
            },
          });
        }

        // 6.9 Update LoadOrder with deliveryId
        await tx.loadOrder.update({
          where: { id: loadOrder.id },
          data: { deliveryId: delivery.id },
        });

        // 6.10 Create SaleRemito (PREPARADO - not emitted yet)
        const remito = await tx.saleRemito.create({
          data: {
            numero: remitoSeq.formatted,
            saleId: sale.id,
            deliveryId: delivery.id,
            clientId: sale.clientId,
            estado: 'PREPARADO',
            fechaEmision: new Date(),
            docType,
            companyId: companyId!,
            createdBy: user!.id,
          },
        });

        // 6.11 Create SaleRemitoItems
        for (const item of body.items) {
          const saleItem = sale.items.find((si) => si.id === item.saleItemId);
          await tx.saleRemitoItem.create({
            data: {
              remitoId: remito.id,
              saleItemId: item.saleItemId,
              productId: saleItem?.productId,
              cantidad: new Prisma.Decimal(item.cantidad),
            },
          });
        }

        // 6.12 Calculate invoice totals
        let netoGravado = new Prisma.Decimal(0);
        let iva21 = new Prisma.Decimal(0);

        const invoiceItems: Array<{
          saleItemId: number;
          productId: string | null;
          codigo: string | null;
          descripcion: string;
          cantidad: Prisma.Decimal;
          unidad: string;
          precioUnitario: Prisma.Decimal;
          descuento: Prisma.Decimal;
          alicuotaIVA: Prisma.Decimal;
          subtotal: Prisma.Decimal;
        }> = [];

        for (const item of body.items) {
          const saleItem = sale.items.find((si) => si.id === item.saleItemId);
          if (!saleItem) continue;

          const cantidad = new Prisma.Decimal(item.cantidad);
          const subtotal = saleItem.precioUnitario.mul(cantidad).mul(
            new Prisma.Decimal(1).minus(saleItem.descuento.div(100))
          );
          const ivaAmount = subtotal.mul(sale.tasaIva.div(100));

          netoGravado = netoGravado.plus(subtotal);
          iva21 = iva21.plus(ivaAmount);

          invoiceItems.push({
            saleItemId: saleItem.id,
            productId: saleItem.productId,
            codigo: saleItem.codigo,
            descripcion: saleItem.descripcion,
            cantidad,
            unidad: saleItem.unidad,
            precioUnitario: saleItem.precioUnitario,
            descuento: saleItem.descuento,
            alicuotaIVA: sale.tasaIva,
            subtotal,
          });
        }

        const total = netoGravado.plus(iva21);

        // 6.13 Get invoice sequence
        const invoiceSeqDocType = `INVOICE_${invoiceTipo}`;
        const invoiceSeq = await getNextNumber(companyId!, invoiceSeqDocType as any, puntoVenta);

        const numeroCompleto = `${puntoVenta}-${invoiceSeq.formatted.split('-').pop()}`;

        // 6.14 Calculate due date
        const fechaVencimiento = new Date();
        fechaVencimiento.setDate(fechaVencimiento.getDate() + (sale.diasPlazo || 30));

        // 6.15 Create SalesInvoice (BORRADOR - not emitted yet)
        const invoice = await tx.salesInvoice.create({
          data: {
            tipo: invoiceTipo as any,
            letra: invoiceTipo,
            puntoVenta,
            numero: invoiceSeq.number.toString().padStart(8, '0'),
            numeroCompleto,
            clientId: sale.clientId,
            saleId: sale.id,
            estado: 'BORRADOR',
            fechaEmision: new Date(),
            fechaVencimiento,
            netoGravado,
            iva21,
            total,
            saldoPendiente: total,
            condicionesPago: sale.condicionesPago,
            docType,
            companyId: companyId!,
            createdBy: user!.id,
          },
        });

        // 6.16 Create SalesInvoiceItems
        for (const item of invoiceItems) {
          await tx.salesInvoiceItem.create({
            data: {
              invoiceId: invoice.id,
              ...item,
            },
          });
        }

        // 6.17 Update Sale state
        const updatedSale = await tx.sale.update({
          where: { id: sale.id },
          data: { estado: 'EN_PREPARACION' },
        });

        return {
          loadOrder: {
            id: loadOrder.id,
            numero: loadOrder.numero,
            estado: loadOrder.estado,
          },
          delivery: {
            id: delivery.id,
            numero: delivery.numero,
            estado: delivery.estado,
          },
          remito: {
            id: remito.id,
            numero: remito.numero,
            estado: remito.estado,
          },
          invoice: {
            id: invoice.id,
            numeroCompleto: invoice.numeroCompleto,
            estado: invoice.estado,
          },
          sale: {
            id: updatedSale.id,
            numero: updatedSale.numero,
            estado: updatedSale.estado,
          },
        };
      },
      {
        timeout: 30000,
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      }
    );

    // 7. Mark idempotency as completed
    await markIdempotencyCompleted(idempotencyKey, companyId, result);

    return NextResponse.json(result, {
      status: 201,
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
      if (error.message === 'SALE_NOT_FOUND') {
        return NextResponse.json(
          { error: 'Orden de venta no encontrada' },
          { status: 404 }
        );
      }
      if (error.message.startsWith('INVALID_STATE:')) {
        const state = error.message.split(':')[1];
        return NextResponse.json(
          { error: `La orden debe estar en estado CONFIRMADA. Estado actual: ${state}` },
          { status: 400 }
        );
      }
      if (error.message.startsWith('INVALID_SALE_ITEM:')) {
        const itemId = error.message.split(':')[1];
        return NextResponse.json(
          { error: `Item de venta inválido: ${itemId}` },
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

    console.error('[PAQUETE-DOCUMENTOS] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error interno' },
      { status: 500 }
    );
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

function getInvoiceType(fiscalCategory: string | null): string {
  switch (fiscalCategory) {
    case 'RESPONSABLE_INSCRIPTO':
      return 'A';
    case 'MONOTRIBUTO':
    case 'EXENTO':
      return 'B';
    case 'CONSUMIDOR_FINAL':
    default:
      return 'B';
  }
}
