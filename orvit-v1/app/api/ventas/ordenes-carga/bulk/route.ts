import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePermission, VENTAS_PERMISSIONS } from '@/lib/ventas/auth';
import { validateTransition, LoadOrderStatus } from '@/lib/ventas/state-machine';
import { logSalesStatusChange } from '@/lib/ventas/audit-helper';
import { getViewMode, applyViewMode } from '@/lib/view-mode';

export const dynamic = 'force-dynamic';

/**
 * POST - Bulk operations on load orders
 * Supported actions:
 * - bulk_start_loading: Multiple PENDIENTE → CARGANDO
 * - bulk_cancel: Cancel multiple load orders
 * - bulk_export: Export load orders to CSV
 */
export async function POST(request: NextRequest) {
  try {
    const { user, error } = await requirePermission(VENTAS_PERMISSIONS.ORDENES_EDIT);
    if (error) return error;

    const body = await request.json();
    const { accion, loadOrderIds, motivo } = body;

    if (!accion) {
      return NextResponse.json({ error: 'Acción no especificada' }, { status: 400 });
    }

    if (!loadOrderIds || !Array.isArray(loadOrderIds) || loadOrderIds.length === 0) {
      return NextResponse.json(
        { error: 'Debe seleccionar al menos una orden de carga' },
        { status: 400 }
      );
    }

    const viewMode = getViewMode(request);

    switch (accion) {
      case 'bulk_start_loading': {
        return await handleBulkStartLoading(loadOrderIds, user!, viewMode);
      }

      case 'bulk_cancel': {
        if (!motivo) {
          return NextResponse.json(
            { error: 'Debe especificar un motivo de cancelación' },
            { status: 400 }
          );
        }
        return await handleBulkCancel(loadOrderIds, user!, viewMode, motivo);
      }

      case 'bulk_export': {
        return await handleBulkExport(loadOrderIds, user!, viewMode);
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
 * Bulk start loading: PENDIENTE → CARGANDO
 */
async function handleBulkStartLoading(
  loadOrderIds: number[],
  user: any,
  viewMode: any
): Promise<NextResponse> {
  const results = {
    success: 0,
    failed: 0,
    errors: [] as string[],
  };

  for (const id of loadOrderIds) {
    try {
      // Fetch load order
      const loadOrder = await prisma.loadOrder.findFirst({
        where: applyViewMode({ id, companyId: user.companyId }, viewMode),
      });

      if (!loadOrder) {
        results.failed++;
        results.errors.push(`Orden ${id} no encontrada`);
        continue;
      }

      // Validate transition
      const validation = validateTransition({
        documentType: 'loadOrder',
        documentId: id,
        fromState: loadOrder.estado,
        toState: LoadOrderStatus.CARGANDO,
        userId: user.id,
      });

      if (!validation.valid) {
        results.failed++;
        results.errors.push(`Orden ${loadOrder.numero}: ${validation.error}`);
        continue;
      }

      // Update state
      await prisma.loadOrder.update({
        where: { id },
        data: { estado: LoadOrderStatus.CARGANDO },
      });

      // Audit log
      await logSalesStatusChange({
        entidad: 'loadOrder',
        entidadId: id,
        estadoAnterior: loadOrder.estado,
        estadoNuevo: LoadOrderStatus.CARGANDO,
        companyId: user.companyId,
        userId: user.id,
        notas: 'Carga iniciada por operación masiva',
      });

      results.success++;
    } catch (error) {
      results.failed++;
      results.errors.push(`Error en orden ${id}: ${error}`);
    }
  }

  return NextResponse.json({
    message: `Operación completada: ${results.success} exitosas, ${results.failed} fallidas`,
    results,
  });
}

/**
 * Bulk cancel load orders
 */
async function handleBulkCancel(
  loadOrderIds: number[],
  user: any,
  viewMode: any,
  motivo: string
): Promise<NextResponse> {
  const results = {
    success: 0,
    failed: 0,
    errors: [] as string[],
  };

  for (const id of loadOrderIds) {
    try {
      // Fetch load order
      const loadOrder = await prisma.loadOrder.findFirst({
        where: applyViewMode({ id, companyId: user.companyId }, viewMode),
      });

      if (!loadOrder) {
        results.failed++;
        results.errors.push(`Orden ${id} no encontrada`);
        continue;
      }

      // Check if can be cancelled
      if (['CARGADA', 'DESPACHADA'].includes(loadOrder.estado)) {
        results.failed++;
        results.errors.push(
          `Orden ${loadOrder.numero} no puede cancelarse (estado: ${loadOrder.estado})`
        );
        continue;
      }

      if (loadOrder.confirmadoAt) {
        results.failed++;
        results.errors.push(
          `Orden ${loadOrder.numero} ya está confirmada (stock decrementado)`
        );
        continue;
      }

      // Validate transition
      const validation = validateTransition({
        documentType: 'loadOrder',
        documentId: id,
        fromState: loadOrder.estado,
        toState: LoadOrderStatus.CANCELADA,
        userId: user.id,
      });

      if (!validation.valid) {
        results.failed++;
        results.errors.push(`Orden ${loadOrder.numero}: ${validation.error}`);
        continue;
      }

      // Update state with notes
      const timestamp = new Date().toLocaleString('es-AR');
      const observacionesActuales = loadOrder.observaciones || '';
      const nuevasObservaciones = `[${timestamp}] CANCELADA - Motivo: ${motivo}\n\n${observacionesActuales}`.trim();

      await prisma.loadOrder.update({
        where: { id },
        data: {
          estado: LoadOrderStatus.CANCELADA,
          observaciones: nuevasObservaciones,
        },
      });

      // Audit log
      await logSalesStatusChange({
        entidad: 'loadOrder',
        entidadId: id,
        estadoAnterior: loadOrder.estado,
        estadoNuevo: LoadOrderStatus.CANCELADA,
        companyId: user.companyId,
        userId: user.id,
        notas: `Cancelación masiva - Motivo: ${motivo}`,
      });

      results.success++;
    } catch (error) {
      results.failed++;
      results.errors.push(`Error en orden ${id}: ${error}`);
    }
  }

  return NextResponse.json({
    message: `Cancelación completada: ${results.success} exitosas, ${results.failed} fallidas`,
    results,
  });
}

/**
 * Bulk export load orders to CSV
 */
async function handleBulkExport(
  loadOrderIds: number[],
  user: any,
  viewMode: any
): Promise<NextResponse> {
  try {
    // Fetch load orders
    const loadOrders = await prisma.loadOrder.findMany({
      where: applyViewMode(
        {
          id: { in: loadOrderIds },
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
        items: true,
      },
      orderBy: { numero: 'desc' },
    });

    if (loadOrders.length === 0) {
      return NextResponse.json({ error: 'No se encontraron órdenes de carga' }, { status: 404 });
    }

    // Generate CSV
    const headers = [
      'Número',
      'Fecha',
      'Estado',
      'N° OV',
      'Cliente',
      'Vehículo',
      'Patente',
      'Chofer',
      'Items',
      'Peso Total',
      'Volumen Total',
      'Confirmada',
    ];

    const rows = loadOrders.map((loadOrder) => {
      return [
        loadOrder.numero,
        loadOrder.fecha ? new Date(loadOrder.fecha).toLocaleDateString('es-AR') : '',
        loadOrder.estado,
        loadOrder.sale?.numero || '',
        loadOrder.sale?.client?.legalName || loadOrder.sale?.client?.name || '',
        loadOrder.vehiculo || '',
        loadOrder.vehiculoPatente || '',
        loadOrder.chofer || '',
        loadOrder.items.length,
        loadOrder.pesoTotal || '',
        loadOrder.volumenTotal || '',
        loadOrder.confirmadoAt
          ? new Date(loadOrder.confirmadoAt).toLocaleDateString('es-AR')
          : 'No',
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
        'Content-Disposition': `attachment; filename="ordenes-carga-${Date.now()}.csv"`,
        'Content-Length': buffer.length.toString(),
      },
    });
  } catch (error) {
    console.error('Error exporting load orders:', error);
    return NextResponse.json({ error: 'Error al exportar órdenes de carga' }, { status: 500 });
  }
}
