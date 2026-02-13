import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePermission, VENTAS_PERMISSIONS } from '@/lib/ventas/auth';

export const dynamic = 'force-dynamic';

/**
 * GET - Validar prerequisitos para confirmar orden
 * Retorna alertas de stock y crédito
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { user, error } = await requirePermission(VENTAS_PERMISSIONS.ORDENES_VIEW);
    if (error) return error;

    const { id: idParam } = await params;
    const ordenId = parseInt(idParam);

    // Obtener orden con items y cliente
    const orden = await prisma.sale.findFirst({
      where: { id: ordenId, companyId: user!.companyId },
      include: {
        items: { include: { product: true } },
        client: true,
      },
    });

    if (!orden) {
      return NextResponse.json({ error: 'Orden no encontrada' }, { status: 404 });
    }

    const stockAlerts: any[] = [];
    let hasStockIssues = false;

    // Verificar stock para cada item
    for (const item of orden.items) {
      if (!item.product) continue;

      const stockActual = Number(item.product.currentStock || 0);
      const cantidadPedida = Number(item.cantidad);

      if (stockActual < cantidadPedida) {
        hasStockIssues = true;
        stockAlerts.push({
          productId: item.productId,
          codigo: item.codigo,
          descripcion: item.descripcion,
          cantidadPedida,
          stockActual,
          faltante: cantidadPedida - stockActual,
        });
      }
    }

    // Verificar límite de crédito
    let creditAlert = null;
    let hasCreditIssue = false;

    if (orden.client.creditLimit && Number(orden.client.creditLimit) > 0) {
      const limiteCredito = Number(orden.client.creditLimit);
      const deudaActual = Number(orden.client.currentBalance || 0);
      const montoOrden = Number(orden.total);
      const totalProyectado = deudaActual + montoOrden;

      if (totalProyectado > limiteCredito) {
        hasCreditIssue = true;
        creditAlert = {
          limiteCredito,
          deudaActual,
          montoOrden,
          totalProyectado,
          excedente: totalProyectado - limiteCredito,
        };
      }
    }

    return NextResponse.json({
      stockAlerts,
      creditAlert,
      hasStockIssues,
      hasCreditIssue,
    });
  } catch (error) {
    console.error('Error validating order:', error);
    return NextResponse.json({ error: 'Error al validar orden' }, { status: 500 });
  }
}
