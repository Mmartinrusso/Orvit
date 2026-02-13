/**
 * Credit/Debit Notes API - O2C Phase 5
 *
 * Handles NC (Nota de Crédito) and ND (Nota de Débito) operations.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requirePermission, VENTAS_PERMISSIONS } from '@/lib/ventas/auth';
import { getNextNumber } from '@/lib/ventas/sequence-generator';
import { applyViewMode, ViewMode } from '@/lib/view-mode';
import { Prisma } from '@prisma/client';
import { createCreditDebitNoteSchema } from '@/lib/ventas/validation-schemas';

export const dynamic = 'force-dynamic';

// ═══════════════════════════════════════════════════════════════════════════════
// GET - List credit/debit notes
// ═══════════════════════════════════════════════════════════════════════════════

export async function GET(req: NextRequest) {
  try {
    const { user, error } = await requirePermission(VENTAS_PERMISSIONS.NOTAS_VIEW);
    if (error) return error;

    const companyId = user!.companyId;
    const { searchParams } = new URL(req.url);
    const tipo = searchParams.get('tipo'); // NOTA_CREDITO, NOTA_DEBITO
    const clientId = searchParams.get('clientId');
    const invoiceId = searchParams.get('invoiceId');
    const fiscalStatus = searchParams.get('fiscalStatus');
    const fechaDesde = searchParams.get('fechaDesde');
    const fechaHasta = searchParams.get('fechaHasta');
    const viewMode = (searchParams.get('viewMode') || 'S') as ViewMode;
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    const where = applyViewMode(
      {
        companyId,
        ...(tipo && { tipo: tipo as any }),
        ...(clientId && { clientId }),
        ...(invoiceId && { invoiceId: parseInt(invoiceId) }),
        ...(fiscalStatus && { fiscalStatus: fiscalStatus as any }),
        ...(fechaDesde &&
          fechaHasta && {
            fecha: {
              gte: new Date(fechaDesde),
              lte: new Date(fechaHasta),
            },
          }),
      },
      viewMode
    );

    const [notes, total] = await Promise.all([
      prisma.salesCreditDebitNote.findMany({
        where,
        include: {
          client: { select: { id: true, name: true, cuit: true } },
          invoice: { select: { id: true, numero: true } },
          _count: { select: { items: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      prisma.salesCreditDebitNote.count({ where }),
    ]);

    return NextResponse.json({
      data: notes,
      pagination: { total, limit, offset },
    });
  } catch (error) {
    console.error('Error fetching notes:', error);
    return NextResponse.json(
      { error: 'Error al obtener notas' },
      { status: 500 }
    );
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// POST - Create credit/debit note
// ═══════════════════════════════════════════════════════════════════════════════

// Extended schema with puntoVenta for this endpoint
const createNoteSchema = createCreditDebitNoteSchema.extend({
  puntoVenta: z.coerce.number().int().positive().optional().default(1),
});

export async function POST(req: NextRequest) {
  try {
    const { user, error } = await requirePermission(VENTAS_PERMISSIONS.NOTAS_CREATE);
    if (error) return error;

    // Check idempotency key
    const idempotencyKey = req.headers.get('Idempotency-Key');
    if (idempotencyKey) {
      const existing = await prisma.idempotencyKey.findUnique({
        where: { key: idempotencyKey },
      });
      if (existing && existing.status === 'COMPLETED') {
        return NextResponse.json(
          { ...JSON.parse(existing.response as string), wasReplay: true },
          { status: 200 }
        );
      }
    }

    const companyId = user!.companyId;
    const body = await req.json();

    // Validate with Zod schema
    const validation = createNoteSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Datos de entrada inválidos', details: validation.error.errors },
        { status: 400 }
      );
    }

    const data = validation.data;

    // Calculate totals
    let netoGravado = new Prisma.Decimal(0);
    let iva21 = new Prisma.Decimal(0);
    let iva105 = new Prisma.Decimal(0);
    let iva27 = new Prisma.Decimal(0);
    let exento = new Prisma.Decimal(0);
    let noGravado = new Prisma.Decimal(0);

    for (const item of data.items) {
      const subtotal = new Prisma.Decimal(item.cantidad).mul(
        new Prisma.Decimal(item.precioUnitario)
      );

      if (item.alicuotaIva === 21) {
        netoGravado = netoGravado.add(subtotal);
        iva21 = iva21.add(subtotal.mul(new Prisma.Decimal('0.21')));
      } else if (item.alicuotaIva === 10.5) {
        netoGravado = netoGravado.add(subtotal);
        iva105 = iva105.add(subtotal.mul(new Prisma.Decimal('0.105')));
      } else if (item.alicuotaIva === 27) {
        netoGravado = netoGravado.add(subtotal);
        iva27 = iva27.add(subtotal.mul(new Prisma.Decimal('0.27')));
      } else if (item.alicuotaIva === 0) {
        exento = exento.add(subtotal);
      } else {
        noGravado = noGravado.add(subtotal);
      }
    }

    const total = netoGravado.add(iva21).add(iva105).add(iva27).add(exento).add(noGravado);

    // Get tipo comprobante AFIP
    const tipoComprobante = getTipoComprobante(data.tipo);

    // Create note in transaction
    const note = await prisma.$transaction(
      async (tx) => {
        // Get next number
        const sequence = await getNextNumber(
          companyId,
          data.tipo === 'NOTA_CREDITO' ? 'CREDITNOTE' : 'DEBITNOTE',
          String(data.puntoVenta).padStart(4, '0')
        );

        // Create note
        const newNote = await tx.salesCreditDebitNote.create({
          data: {
            numero: sequence.formatted,
            tipo: data.tipo,
            motivo: data.motivo as any,
            invoiceId: data.invoiceId ?? null,
            returnRequestId: data.returnRequestId ?? null,
            deliveryId: data.deliveryId ?? null,
            clientId: data.clientId,
            fecha: data.fecha ? new Date(data.fecha) : new Date(),
            descripcion: data.descripcion || null,
            netoGravado,
            iva21,
            iva105,
            iva27,
            exento,
            noGravado,
            total,
            afectaStock: data.afectaStock,
            fiscalStatus: 'DRAFT',
            puntoVenta: data.puntoVenta,
            tipoComprobante,
            docType: data.docType,
            companyId,
            createdBy: user!.id,
          },
        });

        // Create items
        await tx.salesCreditDebitNoteItem.createMany({
          data: data.items.map((item) => ({
            noteId: newNote.id,
            productId: item.productId || null,
            invoiceItemId: item.invoiceItemId ?? null,
            codigo: item.codigo || null,
            descripcion: item.descripcion,
            cantidad: item.cantidad,
            unidad: item.unidad,
            precioUnitario: item.precioUnitario,
            alicuotaIva: item.alicuotaIva,
            subtotal: new Prisma.Decimal(item.cantidad).mul(
              new Prisma.Decimal(item.precioUnitario)
            ),
          })),
        });

        // Create stock movements if afectaStock
        if (data.afectaStock && data.tipo === 'NOTA_CREDITO') {
          for (const item of data.items) {
            if (item.productId) {
              // Get current stock
              const product = await tx.product.findUnique({
                where: { id: item.productId },
                select: { currentStock: true },
              });

              if (product) {
                const stockAnterior = product.currentStock;
                const stockPosterior = stockAnterior.add(
                  new Prisma.Decimal(item.cantidad)
                );

                // Create stock movement
                await tx.productStockMovement.create({
                  data: {
                    productId: item.productId,
                    tipo: 'AJUSTE',
                    cantidad: item.cantidad,
                    stockAnterior,
                    stockPosterior,
                    motivo: `NC ${newNote.numero} - Devolución`,
                    sourceType: 'CREDIT_NOTE',
                    sourceId: newNote.id,
                    sourceNumber: newNote.numero,
                    companyId,
                    createdBy: user!.id,
                  },
                });

                // Update product stock
                await tx.product.update({
                  where: { id: item.productId },
                  data: { currentStock: stockPosterior },
                });
              }
            }
          }
        }

        return newNote;
      },
      { timeout: 15000 }
    );

    // Save idempotency key
    if (idempotencyKey) {
      await prisma.idempotencyKey.upsert({
        where: { key: idempotencyKey },
        create: {
          key: idempotencyKey,
          response: JSON.stringify({ id: note.id, numero: note.numero }),
          status: 'COMPLETED',
          companyId,
          operation: 'CREATE_CREDIT_NOTE',
          entityType: 'SalesCreditDebitNote',
          entityId: note.id,
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        },
        update: {
          response: JSON.stringify({ id: note.id, numero: note.numero }),
          status: 'COMPLETED',
          entityId: note.id,
        },
      });
    }

    return NextResponse.json(
      {
        id: note.id,
        numero: note.numero,
        tipo: note.tipo,
        total: note.total,
        message: `${note.tipo === 'NOTA_CREDITO' ? 'Nota de crédito' : 'Nota de débito'} creada`,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error creating note:', error);
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Datos de entrada inválidos', details: error.errors },
        { status: 400 }
      );
    }
    const message =
      error instanceof Error ? error.message : 'Error al crear nota';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// Helper function to get AFIP tipo comprobante
function getTipoComprobante(tipo: 'NOTA_CREDITO' | 'NOTA_DEBITO'): number {
  // Default to NCA/NDA (most common)
  // TODO: Get client's tax condition to determine correct type
  return tipo === 'NOTA_CREDITO' ? 3 : 2; // 3=NCA, 2=NDA
}
