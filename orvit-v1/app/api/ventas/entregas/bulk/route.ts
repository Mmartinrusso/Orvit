import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePermission, VENTAS_PERMISSIONS } from '@/lib/ventas/auth';
import { validateTransition, DeliveryStatus } from '@/lib/ventas/state-machine';
import { logSalesStatusChange } from '@/lib/ventas/audit-helper';
import { getViewMode, applyViewMode } from '@/lib/view-mode';

export const dynamic = 'force-dynamic';

/**
 * POST - Bulk operations on deliveries
 * Supported actions:
 * - bulk_prepare: Multiple PENDIENTE → EN_PREPARACION
 * - bulk_cancel: Cancel multiple deliveries
 * - bulk_export: Export deliveries to CSV
 */
export async function POST(request: NextRequest) {
  try {
    const { user, error } = await requirePermission(VENTAS_PERMISSIONS.ENTREGAS_EDIT);
    if (error) return error;

    const body = await request.json();
    const { accion, deliveryIds, motivo } = body;

    if (!accion) {
      return NextResponse.json({ error: 'Acción no especificada' }, { status: 400 });
    }

    if (!deliveryIds || !Array.isArray(deliveryIds) || deliveryIds.length === 0) {
      return NextResponse.json(
        { error: 'Debe seleccionar al menos una entrega' },
        { status: 400 }
      );
    }

    const viewMode = getViewMode(request);

    switch (accion) {
      case 'bulk_prepare': {
        return await handleBulkPrepare(deliveryIds, user!, viewMode);
      }

      case 'bulk_cancel': {
        if (!motivo) {
          return NextResponse.json(
            { error: 'Debe especificar un motivo de cancelación' },
            { status: 400 }
          );
        }
        return await handleBulkCancel(deliveryIds, user!, viewMode, motivo);
      }

      case 'bulk_export': {
        return await handleBulkExport(deliveryIds, user!, viewMode);
      }

      default:
        return NextResponse.json({ error: 'Acción no soportada' }, { status: 400 });
    }
  } catch (error) {
    console.error('Error in bulk operation:', error);
    return NextResponse.json(
      { error: 'Error al procesar operación masiva' },
      { status: 500 }
    );
  }
}

/**
 * Bulk prepare deliveries: PENDIENTE → EN_PREPARACION
 */
async function handleBulkPrepare(
  deliveryIds: number[],
  user: any,
  viewMode: any
): Promise<NextResponse> {
  const results = {
    success: 0,
    failed: 0,
    errors: [] as string[],
  };

  for (const id of deliveryIds) {
    try {
      // Fetch delivery
      const delivery = await prisma.saleDelivery.findFirst({
        where: applyViewMode({ id, companyId: user.companyId }, viewMode),
      });

      if (!delivery) {
        results.failed++;
        results.errors.push(`Entrega ${id} no encontrada`);
        continue;
      }

      // Validate transition
      const validation = validateTransition({
        documentType: 'delivery',
        documentId: id,
        fromState: delivery.estado,
        toState: DeliveryStatus.EN_PREPARACION,
        userId: user.id,
      });

      if (!validation.valid) {
        results.failed++;
        results.errors.push(`Entrega ${delivery.numero}: ${validation.error}`);
        continue;
      }

      // Update state
      await prisma.saleDelivery.update({
        where: { id },
        data: { estado: DeliveryStatus.EN_PREPARACION },
      });

      // Audit log
      await logSalesStatusChange({
        entidad: 'delivery',
        entidadId: id,
        estadoAnterior: delivery.estado,
        estadoNuevo: DeliveryStatus.EN_PREPARACION,
        companyId: user.companyId,
        userId: user.id,
        notas: 'Preparación iniciada por operación masiva',
      });

      results.success++;
    } catch (error) {
      results.failed++;
      results.errors.push(`Error en entrega ${id}: ${error}`);
    }
  }

  return NextResponse.json({
    message: `Operación completada: ${results.success} exitosas, ${results.failed} fallidas`,
    results,
  });
}

/**
 * Bulk cancel deliveries
 */
async function handleBulkCancel(
  deliveryIds: number[],
  user: any,
  viewMode: any,
  motivo: string
): Promise<NextResponse> {
  const results = {
    success: 0,
    failed: 0,
    errors: [] as string[],
  };

  for (const id of deliveryIds) {
    try {
      // Fetch delivery
      const delivery = await prisma.saleDelivery.findFirst({
        where: applyViewMode({ id, companyId: user.companyId }, viewMode),
      });

      if (!delivery) {
        results.failed++;
        results.errors.push(`Entrega ${id} no encontrada`);
        continue;
      }

      // Check if can be cancelled
      if (['ENTREGADA', 'CANCELADA'].includes(delivery.estado)) {
        results.failed++;
        results.errors.push(
          `Entrega ${delivery.numero} no puede cancelarse (estado: ${delivery.estado})`
        );
        continue;
      }

      // Validate transition
      const validation = validateTransition({
        documentType: 'delivery',
        documentId: id,
        fromState: delivery.estado,
        toState: DeliveryStatus.CANCELADA,
        userId: user.id,
      });

      if (!validation.valid) {
        results.failed++;
        results.errors.push(`Entrega ${delivery.numero}: ${validation.error}`);
        continue;
      }

      // Update state with notes
      const timestamp = new Date().toLocaleString('es-AR');
      const notasActuales = delivery.notas || '';
      const nuevasNotas = `[${timestamp}] CANCELADA - Motivo: ${motivo}\n\n${notasActuales}`.trim();

      await prisma.saleDelivery.update({
        where: { id },
        data: {
          estado: DeliveryStatus.CANCELADA,
          notas: nuevasNotas,
        },
      });

      // Audit log
      await logSalesStatusChange({
        entidad: 'delivery',
        entidadId: id,
        estadoAnterior: delivery.estado,
        estadoNuevo: DeliveryStatus.CANCELADA,
        companyId: user.companyId,
        userId: user.id,
        notas: `Cancelación masiva - Motivo: ${motivo}`,
      });

      results.success++;
    } catch (error) {
      results.failed++;
      results.errors.push(`Error en entrega ${id}: ${error}`);
    }
  }

  return NextResponse.json({
    message: `Cancelación completada: ${results.success} exitosas, ${results.failed} fallidas`,
    results,
  });
}

/**
 * Bulk export deliveries to CSV
 */
async function handleBulkExport(
  deliveryIds: number[],
  user: any,
  viewMode: any
): Promise<NextResponse> {
  try {
    // Fetch deliveries
    const deliveries = await prisma.saleDelivery.findMany({
      where: applyViewMode(
        {
          id: { in: deliveryIds },
          companyId: user.companyId,
        },
        viewMode
      ),
      include: {
        sale: {
          include: {
            client: true,
          },
        },
        items: {
          include: {
            product: true,
          },
        },
      },
      orderBy: { numero: 'desc' },
    });

    if (deliveries.length === 0) {
      return NextResponse.json({ error: 'No se encontraron entregas' }, { status: 404 });
    }

    // Generate CSV
    const headers = [
      'Número',
      'Fecha',
      'Fecha Programada',
      'Fecha Entrega',
      'Estado',
      'Tipo',
      'N° OV',
      'Cliente',
      'Dirección',
      'Conductor',
      'Vehículo',
      'Transportista',
      'Items',
      'Cantidad Total',
    ];

    const rows = deliveries.map((delivery) => {
      const totalItems = delivery.items.reduce((sum, item) => sum + item.cantidad, 0);

      return [
        delivery.numero,
        delivery.fecha ? new Date(delivery.fecha).toLocaleDateString('es-AR') : '',
        delivery.fechaProgramada
          ? new Date(delivery.fechaProgramada).toLocaleDateString('es-AR')
          : '',
        delivery.fechaEntrega
          ? new Date(delivery.fechaEntrega).toLocaleDateString('es-AR')
          : '',
        delivery.estado,
        delivery.tipo,
        delivery.sale?.numero || '',
        delivery.sale?.client?.legalName || delivery.sale?.client?.name || '',
        delivery.direccionEntrega || '',
        delivery.conductorNombre || '',
        delivery.vehiculo || '',
        delivery.transportista || '',
        delivery.items.length,
        totalItems,
      ];
    });

    // Build CSV content
    const csvContent = [
      headers.join(','),
      ...rows.map((row) =>
        row.map((cell) => (cell ? `"${String(cell).replace(/"/g, '""')}"` : '')).join(',')
      ),
    ].join('\n');

    // Add BOM for Excel UTF-8 support
    const bom = '\uFEFF';
    const buffer = Buffer.from(bom + csvContent, 'utf-8');

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="entregas-${Date.now()}.csv"`,
        'Content-Length': buffer.length.toString(),
      },
    });
  } catch (error) {
    console.error('Error exporting deliveries:', error);
    return NextResponse.json({ error: 'Error al exportar entregas' }, { status: 500 });
  }
}
