import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePermission, VENTAS_PERMISSIONS } from '@/lib/ventas/auth';
import { getViewMode, applyViewMode } from '@/lib/view-mode';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

export const dynamic = 'force-dynamic';

/**
 * GET - Export all load orders matching filters to CSV
 */
export async function GET(request: NextRequest) {
  try {
    const { user, error } = await requirePermission(VENTAS_PERMISSIONS.ORDENES_VIEW);
    if (error) return error;

    const { searchParams } = new URL(request.url);
    const viewMode = getViewMode(request);
    const estado = searchParams.get('estado');
    const fechaDesde = searchParams.get('fechaDesde');
    const fechaHasta = searchParams.get('fechaHasta');
    const search = searchParams.get('search');
    const clienteId = searchParams.get('clienteId');
    const transportista = searchParams.get('transportista');
    const chofer = searchParams.get('chofer');

    // Build where clause
    const where = applyViewMode(
      {
        companyId: user!.companyId,
        ...(estado && { estado: estado as any }),
        ...(fechaDesde &&
          fechaHasta && {
            fecha: {
              gte: new Date(fechaDesde),
              lte: new Date(fechaHasta),
            },
          }),
        ...(search && {
          OR: [
            { numero: { contains: search, mode: 'insensitive' as const } },
            { sale: { numero: { contains: search, mode: 'insensitive' as const } } },
            { chofer: { contains: search, mode: 'insensitive' as const } },
          ],
        }),
        ...(clienteId && {
          sale: {
            clientId: parseInt(clienteId),
          },
        }),
        ...(transportista && {
          transportista: { contains: transportista, mode: 'insensitive' as const },
        }),
        ...(chofer && {
          chofer: { contains: chofer, mode: 'insensitive' as const },
        }),
      },
      viewMode
    );

    // Fetch all matching orders (no limit)
    const loadOrders = await prisma.loadOrder.findMany({
      where,
      include: {
        sale: {
          select: {
            numero: true,
            client: {
              select: {
                legalName: true,
                name: true,
              },
            },
          },
        },
        _count: { select: { items: true } },
      },
      orderBy: { numero: 'desc' },
    });

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
      'DNI Chofer',
      'Transportista',
      'Items',
      'Peso Total (kg)',
      'Volumen Total (m³)',
      'Confirmada',
      'Observaciones',
    ];

    const rows = loadOrders.map((order) => [
      order.numero,
      order.fecha ? format(new Date(order.fecha), 'dd/MM/yyyy', { locale: es }) : '',
      order.estado,
      order.sale.numero,
      order.sale.client.legalName || order.sale.client.name || '',
      order.vehiculo || '',
      order.vehiculoPatente || '',
      order.chofer || '',
      order.choferDNI || '',
      order.transportista || '',
      order._count.items.toString(),
      order.pesoTotal ? order.pesoTotal.toFixed(2) : '',
      order.volumenTotal ? order.volumenTotal.toFixed(2) : '',
      order.confirmadoAt
        ? format(new Date(order.confirmadoAt), 'dd/MM/yyyy HH:mm', { locale: es })
        : 'No',
      (order.observaciones || '').replace(/\n/g, ' ').substring(0, 100),
    ]);

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
