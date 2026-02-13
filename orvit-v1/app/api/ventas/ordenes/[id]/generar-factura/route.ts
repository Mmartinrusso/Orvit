/**
 * POST /api/ventas/ordenes/[id]/generar-factura
 *
 * Creates an Invoice (Factura) for a Sale Order.
 * Can be called independently or as part of a workflow.
 *
 * Request body:
 * - items: Array<{ saleItemId, cantidad }>
 * - tipoFactura?: 'A' | 'B' | 'C' (auto-detected from client if not provided)
 * - puntoVenta?: string (from config if not provided)
 * - fechaVencimiento?: string (calculated from diasPlazo if not provided)
 * - docType?: 'T1' | 'T2'
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePermission, VENTAS_PERMISSIONS } from '@/lib/ventas/auth';
import { Prisma, DocType } from '@prisma/client';
import { getNextNumber } from '@/lib/ventas/sequence-generator';

export const dynamic = 'force-dynamic';

interface RouteParams {
  params: { id: string };
}

interface InvoiceItem {
  saleItemId: number;
  cantidad: number;
}

interface GenerateInvoiceRequest {
  items: InvoiceItem[];
  tipoFactura?: 'A' | 'B' | 'C' | 'E' | 'M';
  puntoVenta?: string;
  fechaVencimiento?: string;
  docType?: 'T1' | 'T2';
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    // 1. Authenticate
    const { user, error } = await requirePermission(VENTAS_PERMISSIONS.FACTURAS_CREATE);
    if (error) return error;

    const companyId = user!.companyId;
    const saleId = parseInt(params.id);

    if (isNaN(saleId)) {
      return NextResponse.json({ error: 'ID de orden inválido' }, { status: 400 });
    }

    // 2. Parse request
    const body: GenerateInvoiceRequest = await request.json();

    if (!body.items || !Array.isArray(body.items) || body.items.length === 0) {
      return NextResponse.json(
        { error: 'items es requerido y debe contener al menos un elemento' },
        { status: 400 }
      );
    }

    const docType: DocType = body.docType === 'T2' ? 'T2' : 'T1';

    // 3. Create in transaction
    const result = await prisma.$transaction(async (tx) => {
      // Get sale
      const sale = await tx.sale.findFirst({
        where: { id: saleId, companyId },
        include: {
          client: {
            select: {
              id: true,
              legalName: true,
              name: true,
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

      // Validate state
      const allowedFromStates = ['CONFIRMADA', 'EN_PREPARACION', 'ENTREGADA'];
      if (!allowedFromStates.includes(sale.estado)) {
        throw new Error(`INVALID_STATE:${sale.estado}`);
      }

      // Validate items
      const saleItemIds = sale.items.map((i) => i.id);
      for (const item of body.items) {
        if (!saleItemIds.includes(item.saleItemId)) {
          throw new Error(`INVALID_SALE_ITEM:${item.saleItemId}`);
        }
        if (item.cantidad <= 0) {
          throw new Error(`INVALID_QUANTITY:${item.saleItemId}`);
        }
      }

      // Get sales config
      const salesConfig = await tx.salesConfig.findUnique({
        where: { companyId },
      });

      const puntoVenta = body.puntoVenta || salesConfig?.puntoVenta || '0001';
      const invoiceTipo = body.tipoFactura || getInvoiceType(sale.client.fiscalCategory);

      // Calculate invoice totals
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
        const subtotal = saleItem.precioUnitario
          .mul(cantidad)
          .mul(new Prisma.Decimal(1).minus(saleItem.descuento.div(100)));
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

      // Get invoice sequence
      const invoiceSeqDocType = `INVOICE_${invoiceTipo}`;
      const invoiceSeq = await getNextNumber(companyId, invoiceSeqDocType as any, puntoVenta);

      const numeroCompleto = `${puntoVenta}-${invoiceSeq.formatted.split('-').pop()}`;

      // Calculate due date
      const fechaVencimiento = body.fechaVencimiento
        ? new Date(body.fechaVencimiento)
        : new Date(Date.now() + (sale.diasPlazo || 30) * 24 * 60 * 60 * 1000);

      // Create Invoice
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
          companyId,
          createdBy: user!.id,
        },
      });

      // Create Invoice Items
      for (const item of invoiceItems) {
        await tx.salesInvoiceItem.create({
          data: {
            invoiceId: invoice.id,
            ...item,
          },
        });
      }

      return {
        invoice: {
          id: invoice.id,
          numeroCompleto: invoice.numeroCompleto,
          estado: invoice.estado,
          total: invoice.total.toString(),
        },
        sale: {
          id: sale.id,
          numero: sale.numero,
        },
      };
    });

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'SALE_NOT_FOUND') {
        return NextResponse.json({ error: 'Orden de venta no encontrada' }, { status: 404 });
      }
      if (error.message.startsWith('INVALID_STATE:')) {
        const state = error.message.split(':')[1];
        return NextResponse.json(
          { error: `La orden debe estar CONFIRMADA, EN_PREPARACION o ENTREGADA. Estado actual: ${state}` },
          { status: 400 }
        );
      }
      if (error.message.startsWith('INVALID_SALE_ITEM:')) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }
    }

    console.error('[GENERAR-FACTURA] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error interno' },
      { status: 500 }
    );
  }
}

// Helper function
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
