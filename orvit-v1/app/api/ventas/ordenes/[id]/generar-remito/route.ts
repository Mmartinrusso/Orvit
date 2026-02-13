/**
 * POST /api/ventas/ordenes/[id]/generar-remito
 *
 * Creates a Remito (delivery note) for a Sale Order.
 * Can be called independently or as part of a workflow.
 *
 * Request body:
 * - items: Array<{ saleItemId, cantidad }>
 * - deliveryId?: number (optional - links to existing delivery)
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

interface RemitoItem {
  saleItemId: number;
  cantidad: number;
}

interface GenerateRemitoRequest {
  items: RemitoItem[];
  deliveryId?: number;
  docType?: 'T1' | 'T2';
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    // 1. Authenticate
    const { user, error } = await requirePermission(VENTAS_PERMISSIONS.ORDENES_EDIT);
    if (error) return error;

    const companyId = user!.companyId;
    const saleId = parseInt(params.id);

    if (isNaN(saleId)) {
      return NextResponse.json({ error: 'ID de orden inválido' }, { status: 400 });
    }

    // 2. Parse request
    const body: GenerateRemitoRequest = await request.json();

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
          client: true,
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
      const allowedFromStates = ['CONFIRMADA', 'EN_PREPARACION'];
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

      // Get sequence number
      const remitoSeq = await getNextNumber(companyId, 'REMITO');

      // Create Remito
      const remito = await tx.saleRemito.create({
        data: {
          numero: remitoSeq.formatted,
          saleId: sale.id,
          deliveryId: body.deliveryId || null,
          clientId: sale.clientId,
          estado: 'PREPARADO',
          fechaEmision: new Date(),
          docType,
          companyId,
          createdBy: user!.id,
        },
      });

      // Create Remito Items
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

      return {
        remito: {
          id: remito.id,
          numero: remito.numero,
          estado: remito.estado,
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
          { error: `La orden debe estar CONFIRMADA o EN_PREPARACION. Estado actual: ${state}` },
          { status: 400 }
        );
      }
      if (error.message.startsWith('INVALID_SALE_ITEM:')) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }
    }

    console.error('[GENERAR-REMITO] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error interno' },
      { status: 500 }
    );
  }
}
