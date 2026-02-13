import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePermission, VENTAS_PERMISSIONS } from '@/lib/ventas/auth';
import { getViewMode, applyViewMode, isExtendedMode, DOC_TYPE } from '@/lib/view-mode';

export const dynamic = 'force-dynamic';

/**
 * POST - Generate remito from delivery
 * Creates a remito document linked to the delivery
 */
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { user, error } = await requirePermission(VENTAS_PERMISSIONS.ENTREGAS_EDIT);
    if (error) return error;

    const id = parseInt(params.id);
    if (isNaN(id)) {
      return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
    }

    const viewMode = getViewMode(request);
    const companyId = user!.companyId;

    // Fetch delivery with items
    const delivery = await prisma.saleDelivery.findFirst({
      where: applyViewMode({ id, companyId }, viewMode),
      include: {
        items: {
          include: {
            product: true,
            saleItem: true,
          },
        },
        sale: {
          include: {
            client: true,
          },
        },
      },
    });

    if (!delivery) {
      return NextResponse.json({ error: 'Entrega no encontrada' }, { status: 404 });
    }

    // Validate delivery state
    if (!['LISTA_PARA_DESPACHO', 'EN_TRANSITO', 'RETIRADA', 'ENTREGADA'].includes(delivery.estado)) {
      return NextResponse.json(
        {
          error: `No se puede generar remito en estado ${delivery.estado}. Debe estar lista, en tránsito o entregada.`,
        },
        { status: 400 }
      );
    }

    // Check if remito already exists for this delivery
    const existingRemito = await prisma.saleRemito.findFirst({
      where: { deliveryId: delivery.id },
    });

    if (existingRemito) {
      return NextResponse.json(
        { error: 'Ya existe un remito para esta entrega', remito: existingRemito },
        { status: 400 }
      );
    }

    // Generate remito number
    const lastRemito = await prisma.saleRemito.findFirst({
      where: { companyId },
      orderBy: { numero: 'desc' },
    });

    const nextNumber = lastRemito
      ? `R-${(parseInt(lastRemito.numero.split('-')[1]) + 1).toString().padStart(8, '0')}`
      : 'R-00000001';

    // Create remito
    const remito = await prisma.$transaction(async (tx) => {
      const newRemito = await tx.saleRemito.create({
        data: {
          numero: nextNumber,
          saleId: delivery.saleId,
          deliveryId: delivery.id,
          clientId: delivery.sale.clientId,
          estado: 'EMITIDO',
          fechaEmision: new Date(),
          direccionEntrega: delivery.direccionEntrega,
          transportista: delivery.transportista,
          conductorNombre: delivery.conductorNombre,
          conductorDNI: delivery.conductorDNI,
          vehiculo: delivery.vehiculo,
          notas: delivery.notas,
          docType: delivery.docType,
          companyId,
          createdBy: user!.id,
          items: {
            create: delivery.items.map((item) => ({
              saleItemId: item.saleItemId,
              productId: item.productId,
              descripcion: item.product?.name || 'Sin descripción',
              cantidad: item.cantidad,
              unidadMedida: item.saleItem?.unidadMedida || 'UN',
            })),
          },
        },
        include: {
          items: true,
        },
      });

      // Update delivery with remito reference
      await tx.saleDelivery.update({
        where: { id: delivery.id },
        data: {
          notas: delivery.notas
            ? `${delivery.notas}\n\n[Remito ${nextNumber} generado]`
            : `[Remito ${nextNumber} generado]`,
        },
      });

      return newRemito;
    });

    return NextResponse.json(remito, { status: 201 });
  } catch (error) {
    console.error('Error generating remito:', error);
    return NextResponse.json({ error: 'Error al generar remito' }, { status: 500 });
  }
}

/**
 * GET - Get remito for delivery (if exists)
 */
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { user, error } = await requirePermission(VENTAS_PERMISSIONS.ENTREGAS_VIEW);
    if (error) return error;

    const id = parseInt(params.id);
    if (isNaN(id)) {
      return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
    }

    const viewMode = getViewMode(request);

    // Verify delivery exists
    const delivery = await prisma.saleDelivery.findFirst({
      where: applyViewMode({ id, companyId: user!.companyId }, viewMode),
    });

    if (!delivery) {
      return NextResponse.json({ error: 'Entrega no encontrada' }, { status: 404 });
    }

    // Find remito
    const remito = await prisma.saleRemito.findFirst({
      where: { deliveryId: id },
      include: {
        items: {
          include: {
            product: true,
          },
        },
        client: true,
      },
    });

    if (!remito) {
      return NextResponse.json({ error: 'No se encontró remito para esta entrega' }, { status: 404 });
    }

    return NextResponse.json(remito);
  } catch (error) {
    console.error('Error fetching remito:', error);
    return NextResponse.json({ error: 'Error al obtener remito' }, { status: 500 });
  }
}
