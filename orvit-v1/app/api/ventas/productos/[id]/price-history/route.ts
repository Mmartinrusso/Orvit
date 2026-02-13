import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePermission, VENTAS_PERMISSIONS } from '@/lib/ventas/auth';

export const dynamic = 'force-dynamic';

// GET /api/ventas/productos/[id]/price-history - Obtener historial de precios de venta
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { user, error } = await requirePermission(VENTAS_PERMISSIONS.PRODUCTOS_VIEW);
    if (error) return error;

    const { id } = params;
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    // Verificar que el producto existe y pertenece a la empresa
    const product = await prisma.product.findFirst({
      where: {
        id,
        companyId: user!.companyId,
      },
      select: {
        id: true,
        name: true,
        salePrice: true,
        saleCurrency: true,
      },
    });

    if (!product) {
      return NextResponse.json(
        { error: 'Producto no encontrado' },
        { status: 404 }
      );
    }

    // Obtener historial de precios
    const priceLogs = await prisma.salesPriceLog.findMany({
      where: {
        productId: id,
        companyId: user!.companyId,
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
      include: {
        salesPriceList: {
          select: { id: true, nombre: true },
        },
      },
    });

    // Contar total
    const total = await prisma.salesPriceLog.count({
      where: {
        productId: id,
        companyId: user!.companyId,
      },
    });

    // Obtener nombres de usuarios
    const userIds = [...new Set(priceLogs.filter(l => l.createdById).map(l => l.createdById!))];
    const users = userIds.length > 0
      ? await prisma.user.findMany({
          where: { id: { in: userIds } },
          select: { id: true, name: true },
        })
      : [];
    const userMap = new Map(users.map(u => [u.id, u.name]));

    // Calcular estadisticas
    const allPrices = priceLogs.map(l => l.newPrice);
    const stats = allPrices.length > 0
      ? {
          minPrice: Math.min(...allPrices),
          maxPrice: Math.max(...allPrices),
          avgPrice: allPrices.reduce((a, b) => a + b, 0) / allPrices.length,
          firstRecord: priceLogs[priceLogs.length - 1]?.createdAt,
          lastRecord: priceLogs[0]?.createdAt,
          totalChanges: total,
        }
      : null;

    // Transformar logs con porcentaje de cambio
    const logsWithDetails = priceLogs.map(log => ({
      ...log,
      changePercentage:
        log.previousPrice && log.previousPrice > 0
          ? ((log.newPrice - log.previousPrice) / log.previousPrice) * 100
          : 0,
      createdBy: log.createdById
        ? { id: log.createdById, name: userMap.get(log.createdById) || 'Usuario desconocido' }
        : null,
    }));

    return NextResponse.json({
      product: {
        id: product.id,
        name: product.name,
        currentPrice: product.salePrice,
        currency: product.saleCurrency,
      },
      logs: logsWithDetails,
      stats,
      total,
      limit,
      offset,
    });
  } catch (error) {
    console.error('Error in GET /api/ventas/productos/[id]/price-history:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
