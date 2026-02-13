import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePermission, VENTAS_PERMISSIONS } from '@/lib/ventas/auth';
import { exportOrdenesToExcel, exportOrdenesCSV } from '@/lib/ventas/export-service';

export const dynamic = 'force-dynamic';

/**
 * POST - Export órdenes a Excel o CSV
 */
export async function POST(request: NextRequest) {
  try {
    const { user, error } = await requirePermission(VENTAS_PERMISSIONS.ORDENES_VIEW);
    if (error) return error;

    const { ids, format, options } = await request.json();

    // Obtener órdenes
    const ordenes = await prisma.sale.findMany({
      where: {
        id: { in: ids },
        companyId: user!.companyId,
      },
      include: {
        client: true,
        seller: true,
        items: options?.includeItems ? true : false,
      },
      orderBy: { fechaEmision: 'desc' },
    });

    if (format === 'excel') {
      const buffer = await exportOrdenesToExcel(ordenes, options);

      return new NextResponse(buffer, {
        headers: {
          'Content-Type':
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition': `attachment; filename="ordenes_${new Date().toISOString().split('T')[0]}.xlsx"`,
        },
      });
    } else if (format === 'csv') {
      const csv = await exportOrdenesCSV(ordenes);

      return new NextResponse(csv, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="ordenes_${new Date().toISOString().split('T')[0]}.csv"`,
        },
      });
    } else {
      // JSON
      return NextResponse.json(ordenes);
    }
  } catch (error) {
    console.error('Error exporting orders:', error);
    return NextResponse.json({ error: 'Error al exportar órdenes' }, { status: 500 });
  }
}
