import { NextRequest, NextResponse } from 'next/server';
import { requirePermission, VENTAS_PERMISSIONS } from '@/lib/ventas/auth';
import { getCostHistory } from '@/lib/services/product-cost';

// GET: Obtener historial de costos de un producto
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { user, error } = await requirePermission(VENTAS_PERMISSIONS.PRODUCTOS_VIEW);
    if (error) return error;

    const { id: productId } = await params;
    const { searchParams } = new URL(request.url);

    const changeSource = searchParams.get('changeSource') || undefined;
    const startDate = searchParams.get('startDate') ? new Date(searchParams.get('startDate')!) : undefined;
    const endDate = searchParams.get('endDate') ? new Date(searchParams.get('endDate')!) : undefined;
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    const { logs, total } = await getCostHistory({
      productId,
      companyId: user!.companyId,
      changeSource,
      startDate,
      endDate,
      limit,
      offset,
    });

    return NextResponse.json({
      logs,
      total,
      hasMore: offset + logs.length < total,
    });
  } catch (error) {
    console.error('Error obteniendo historial de costos:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
