/**
 * POST /api/ventas/ordenes/[id]/duplicar
 *
 * Duplicates an existing Sale Order.
 * Creates a copy in BORRADOR state with updated dates.
 *
 * Use case: Customer repeats monthly/periodic orders
 *
 * Request body (optional):
 * - fechaEmision?: string (defaults to today)
 * - fechaEntregaDeseada?: string (defaults to original + offset)
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePermission, VENTAS_PERMISSIONS } from '@/lib/ventas/auth';
import { Prisma } from '@prisma/client';
import { getNextNumber } from '@/lib/ventas/sequence-generator';

export const dynamic = 'force-dynamic';

interface RouteParams {
  params: { id: string };
}

interface DuplicateSaleRequest {
  fechaEmision?: string;
  fechaEntregaDeseada?: string;
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    // 1. Authenticate
    const { user, error } = await requirePermission(VENTAS_PERMISSIONS.ORDENES_CREATE);
    if (error) return error;

    const companyId = user!.companyId;
    const originalSaleId = parseInt(params.id);

    if (isNaN(originalSaleId)) {
      return NextResponse.json({ error: 'ID de orden inválido' }, { status: 400 });
    }

    // 2. Parse request
    const body: DuplicateSaleRequest = await request.json().catch(() => ({}));

    // 3. Duplicate in transaction
    const result = await prisma.$transaction(async (tx) => {
      // Get original sale
      const originalSale = await tx.sale.findFirst({
        where: { id: originalSaleId, companyId },
        include: {
          items: {
            include: {
              product: {
                select: { id: true, name: true, code: true },
              },
            },
          },
        },
      });

      if (!originalSale) {
        throw new Error('SALE_NOT_FOUND');
      }

      // Get next sale number
      const saleSeq = await getNextNumber(companyId, 'SALE');

      // Set new dates
      const now = new Date();
      const fechaEmision = body.fechaEmision ? new Date(body.fechaEmision) : now;

      let fechaEntregaDeseada: Date | null = null;
      if (body.fechaEntregaDeseada) {
        fechaEntregaDeseada = new Date(body.fechaEntregaDeseada);
      } else if (originalSale.fechaEntregaDeseada) {
        // Keep same offset from emission date
        const originalOffset =
          new Date(originalSale.fechaEntregaDeseada).getTime() -
          new Date(originalSale.fechaEmision).getTime();
        fechaEntregaDeseada = new Date(fechaEmision.getTime() + originalOffset);
      }

      // Create new sale
      const newSale = await tx.sale.create({
        data: {
          numero: saleSeq.formatted,
          version: 1,
          estado: 'BORRADOR',
          clientId: originalSale.clientId,
          sellerId: originalSale.sellerId,
          fechaEmision,
          fechaEntregaDeseada,
          condicionesPago: originalSale.condicionesPago,
          diasPlazo: originalSale.diasPlazo,
          subtotal: originalSale.subtotal,
          descuentoGlobal: originalSale.descuentoGlobal,
          descuentoMonto: originalSale.descuentoMonto,
          tasaIva: originalSale.tasaIva,
          impuestos: originalSale.impuestos,
          total: originalSale.total,
          moneda: originalSale.moneda,
          direccionEntrega: originalSale.direccionEntrega,
          notas: `Duplicado de ${originalSale.numero}\n${originalSale.notas || ''}`.trim(),
          notasInternas: originalSale.notasInternas,
          docType: originalSale.docType,
          companyId,
          createdBy: user!.id,
        },
      });

      // Copy items
      for (const item of originalSale.items) {
        await tx.saleItem.create({
          data: {
            saleId: newSale.id,
            productId: item.productId,
            codigo: item.codigo,
            descripcion: item.descripcion,
            cantidad: item.cantidad,
            unidad: item.unidad,
            precioUnitario: item.precioUnitario,
            descuento: item.descuento,
            subtotal: item.subtotal,
            notas: item.notas,
          },
        });
      }

      return {
        newSale: {
          id: newSale.id,
          numero: newSale.numero,
          estado: newSale.estado,
        },
        originalSale: {
          id: originalSale.id,
          numero: originalSale.numero,
        },
        message: `Orden ${originalSale.numero} duplicada como ${newSale.numero}`,
      };
    });

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'SALE_NOT_FOUND') {
        return NextResponse.json({ error: 'Orden de venta no encontrada' }, { status: 404 });
      }
    }

    console.error('[DUPLICAR-ORDEN] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error interno' },
      { status: 500 }
    );
  }
}
