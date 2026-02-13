import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthFromRequest } from '@/lib/auth';

export const dynamic = 'force-dynamic';

// GET /api/reportes/auditoria/price-changes - Reporte de auditoría de cambios de precios
export async function GET(request: NextRequest) {
  try {
    const auth = await getAuthFromRequest(request);
    if (!auth) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get('limit') || '100'), 500);
    const offset = parseInt(searchParams.get('offset') || '0');
    const productId = searchParams.get('productId');
    const userId = searchParams.get('userId');
    const priceListId = searchParams.get('priceListId');
    const dateFrom = searchParams.get('dateFrom');
    const dateTo = searchParams.get('dateTo');
    const changeSource = searchParams.get('changeSource');
    const minChangePercent = searchParams.get('minChangePercent');
    const format = searchParams.get('format'); // 'csv' for export

    // Build filter conditions
    const where: any = {
      companyId: auth.companyId,
    };

    if (productId) where.productId = productId;
    if (userId) where.createdById = parseInt(userId);
    if (priceListId) where.salesPriceListId = parseInt(priceListId);
    if (changeSource) where.changeSource = changeSource;
    if (dateFrom || dateTo) {
      where.createdAt = {};
      if (dateFrom) where.createdAt.gte = new Date(dateFrom);
      if (dateTo) where.createdAt.lte = new Date(dateTo + 'T23:59:59.999Z');
    }

    // Get logs
    const priceLogs = await prisma.salesPriceLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
      include: {
        product: {
          select: { id: true, name: true, code: true },
        },
        salesPriceList: {
          select: { id: true, nombre: true },
        },
      },
    });

    const total = await prisma.salesPriceLog.count({ where });

    // Get user names
    const userIds = [...new Set(priceLogs.filter(l => l.createdById).map(l => l.createdById!))];
    const users = userIds.length > 0
      ? await prisma.user.findMany({
          where: { id: { in: userIds } },
          select: { id: true, name: true },
        })
      : [];
    const userMap = new Map(users.map(u => [u.id, u.name]));

    // Transform with percentage
    let logsWithDetails = priceLogs.map(log => {
      const changePercentage =
        log.previousPrice && log.previousPrice > 0
          ? ((log.newPrice - log.previousPrice) / log.previousPrice) * 100
          : 0;

      return {
        id: log.id,
        productId: log.productId,
        productName: log.product?.name || '',
        productCode: log.product?.code || '',
        previousPrice: log.previousPrice,
        newPrice: log.newPrice,
        changePercentage,
        changeSource: log.changeSource,
        reason: log.reason,
        notes: log.notes,
        salesPriceListId: log.salesPriceListId,
        salesPriceListName: log.salesPriceList?.nombre || null,
        createdById: log.createdById,
        createdByName: log.createdById ? userMap.get(log.createdById) || 'Desconocido' : null,
        createdAt: log.createdAt,
      };
    });

    // Filter by minimum change percentage (post-query filter)
    if (minChangePercent) {
      const minPct = parseFloat(minChangePercent);
      logsWithDetails = logsWithDetails.filter(l => Math.abs(l.changePercentage) >= minPct);
    }

    // CSV export
    if (format === 'csv') {
      const headers = [
        'Fecha',
        'Producto',
        'Codigo',
        'Precio Anterior',
        'Precio Nuevo',
        'Cambio %',
        'Origen',
        'Lista de Precios',
        'Usuario',
        'Motivo',
      ];
      const rows = logsWithDetails.map(log => [
        new Date(log.createdAt).toLocaleString('es-AR'),
        log.productName,
        log.productCode,
        log.previousPrice?.toFixed(2) || '-',
        log.newPrice.toFixed(2),
        log.changePercentage.toFixed(1) + '%',
        getSourceLabel(log.changeSource),
        log.salesPriceListName || '-',
        log.createdByName || '-',
        log.reason || '-',
      ]);

      const csvContent = [
        headers.join(','),
        ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')),
      ].join('\n');

      return new NextResponse(csvContent, {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="cambios-precios_${new Date().toISOString().split('T')[0]}.csv"`,
        },
      });
    }

    // Summary stats
    const summary = {
      totalChanges: total,
      averageChangePercent:
        logsWithDetails.length > 0
          ? logsWithDetails.reduce((a, l) => a + l.changePercentage, 0) / logsWithDetails.length
          : 0,
      increases: logsWithDetails.filter(l => l.changePercentage > 0).length,
      decreases: logsWithDetails.filter(l => l.changePercentage < 0).length,
      significantChanges: logsWithDetails.filter(l => Math.abs(l.changePercentage) >= 20).length,
    };

    return NextResponse.json({
      logs: logsWithDetails,
      total,
      summary,
      limit,
      offset,
    });
  } catch (error) {
    console.error('Error in GET /api/reportes/auditoria/price-changes:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

function getSourceLabel(source: string): string {
  switch (source) {
    case 'PRICE_LIST': return 'Lista de Precios';
    case 'PRODUCT_DIRECT': return 'Producto Directo';
    case 'BULK_UPDATE': return 'Actualización Masiva';
    case 'IMPORT': return 'Importación';
    default: return source;
  }
}
