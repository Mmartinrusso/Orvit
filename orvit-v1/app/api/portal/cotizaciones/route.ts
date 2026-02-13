import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentPortalSession } from '@/lib/portal/auth';

export const dynamic = 'force-dynamic';

/**
 * GET /api/portal/cotizaciones
 * Obtener cotizaciones del cliente
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getCurrentPortalSession();

    if (!session) {
      return NextResponse.json(
        { error: 'No autorizado' },
        { status: 401 }
      );
    }

    // Verificar permiso
    if (!session.permissions.canViewQuotes) {
      return NextResponse.json(
        { error: 'No tiene permisos para ver cotizaciones' },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const estado = searchParams.get('estado');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const skip = (page - 1) * limit;

    // Construir filtro
    const where: any = {
      companyId: session.companyId,
      clientId: session.clientId,
      // Solo cotizaciones enviadas o posteriores (no borradores)
      estado: {
        in: ['ENVIADA', 'EN_NEGOCIACION', 'ACEPTADA', 'CONVERTIDA', 'PERDIDA', 'VENCIDA'],
      },
    };

    if (estado) {
      where.estado = estado;
    }

    // Obtener cotizaciones
    const [cotizaciones, total] = await Promise.all([
      prisma.quote.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          numero: true,
          fechaEmision: true,
          fechaValidez: true,
          estado: true,
          subtotal: true,
          descuentoMonto: true,
          impuestos: true,
          total: true,
          moneda: true,
          notas: true,
          seller: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          _count: {
            select: { items: true },
          },
        },
      }),
      prisma.quote.count({ where }),
    ]);

    // Transformar datos
    const formattedCotizaciones = cotizaciones.map((c) => ({
      id: c.id,
      numero: c.numero,
      fechaEmision: c.fechaEmision,
      fechaValidez: c.fechaValidez,
      estado: c.estado,
      subtotal: Number(c.subtotal),
      descuentoMonto: Number(c.descuentoMonto),
      impuestos: Number(c.impuestos),
      total: Number(c.total),
      moneda: c.moneda,
      notas: c.notas,
      vendedor: c.seller,
      cantidadItems: c._count.items,
      vencida: c.fechaValidez < new Date() && !['ACEPTADA', 'CONVERTIDA', 'PERDIDA'].includes(c.estado),
    }));

    // Estadísticas rápidas
    const stats = await prisma.quote.groupBy({
      by: ['estado'],
      where: {
        companyId: session.companyId,
        clientId: session.clientId,
        estado: {
          in: ['ENVIADA', 'EN_NEGOCIACION', 'ACEPTADA', 'CONVERTIDA', 'PERDIDA', 'VENCIDA'],
        },
      },
      _count: true,
    });

    const estadisticas = {
      pendientes: stats.filter(s => ['ENVIADA', 'EN_NEGOCIACION'].includes(s.estado)).reduce((acc, s) => acc + s._count, 0),
      aceptadas: stats.find(s => s.estado === 'ACEPTADA')?._count || 0,
      convertidas: stats.find(s => s.estado === 'CONVERTIDA')?._count || 0,
      total: stats.reduce((acc, s) => acc + s._count, 0),
    };

    return NextResponse.json({
      cotizaciones: formattedCotizaciones,
      estadisticas,
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Error obteniendo cotizaciones del portal:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
