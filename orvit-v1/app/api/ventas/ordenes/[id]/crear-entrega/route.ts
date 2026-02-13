/**
 * POST /api/ventas/ordenes/[id]/crear-entrega
 *
 * Creates a Delivery (Entrega) and Load Order (Orden de Carga) for a Sale Order.
 * These are created together because they're tightly coupled in the workflow.
 *
 * Request body:
 * - items: Array<{ saleItemId, cantidad, secuencia?, posicion? }>
 * - vehiculo?: string
 * - vehiculoPatente?: string
 * - chofer?: string
 * - choferDNI?: string
 * - observaciones?: string
 * - direccionEntrega?: string
 * - fechaProgramada?: string
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

interface DeliveryItem {
  saleItemId: number;
  cantidad: number;
  secuencia?: number;
  posicion?: string;
}

interface CreateDeliveryRequest {
  items: DeliveryItem[];
  vehiculo?: string;
  vehiculoPatente?: string;
  chofer?: string;
  choferDNI?: string;
  observaciones?: string;
  direccionEntrega?: string;
  fechaProgramada?: string;
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
    const body: CreateDeliveryRequest = await request.json();

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
              address: true,
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

      // Get sequence numbers
      const loadOrderSeq = await getNextNumber(companyId, 'LOADORDER');
      const deliverySeq = await getNextNumber(companyId, 'DELIVERY');

      // Create LoadOrder first
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
          companyId,
          createdBy: user!.id,
        },
      });

      // Create LoadOrder Items
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

      // Create Delivery
      const delivery = await tx.saleDelivery.create({
        data: {
          numero: deliverySeq.formatted,
          saleId: sale.id,
          clientId: sale.clientId,
          estado: 'PENDIENTE',
          direccionEntrega: body.direccionEntrega || sale.client.address,
          fechaProgramada: body.fechaProgramada ? new Date(body.fechaProgramada) : null,
          docType,
          companyId,
          createdBy: user!.id,
        },
      });

      // Create Delivery Items
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

      // Link LoadOrder to Delivery
      await tx.loadOrder.update({
        where: { id: loadOrder.id },
        data: { deliveryId: delivery.id },
      });

      // Update Sale state to EN_PREPARACION if it's CONFIRMADA
      if (sale.estado === 'CONFIRMADA') {
        await tx.sale.update({
          where: { id: sale.id },
          data: { estado: 'EN_PREPARACION' },
        });
      }

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

    console.error('[CREAR-ENTREGA] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error interno' },
      { status: 500 }
    );
  }
}
