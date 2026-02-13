import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentPortalSession } from '@/lib/portal/auth';

export const dynamic = 'force-dynamic';

/**
 * GET /api/portal/cotizaciones/[id]
 * Obtener detalle de una cotizacion
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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

    const quoteId = parseInt(params.id);
    if (isNaN(quoteId)) {
      return NextResponse.json(
        { error: 'ID de cotizacion invalido' },
        { status: 400 }
      );
    }

    // Obtener cotizacion con items
    const cotizacion = await prisma.quote.findFirst({
      where: {
        id: quoteId,
        companyId: session.companyId,
        clientId: session.clientId,
        // Solo cotizaciones enviadas o posteriores (no borradores)
        estado: {
          in: ['ENVIADA', 'EN_NEGOCIACION', 'ACEPTADA', 'CONVERTIDA', 'PERDIDA', 'VENCIDA'],
        },
      },
      include: {
        seller: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        items: {
          orderBy: { orden: 'asc' },
          include: {
            product: {
              select: {
                id: true,
                code: true,
                name: true,
                unit: true,
              },
            },
          },
        },
      },
    });

    if (!cotizacion) {
      return NextResponse.json(
        { error: 'Cotizacion no encontrada' },
        { status: 404 }
      );
    }

    // Formatear respuesta
    const formattedCotizacion = {
      id: cotizacion.id,
      numero: cotizacion.numero,
      titulo: cotizacion.titulo,
      descripcion: cotizacion.descripcion,
      fechaEmision: cotizacion.fechaEmision,
      fechaValidez: cotizacion.fechaValidez,
      fechaEnvio: cotizacion.fechaEnvio,
      estado: cotizacion.estado,
      subtotal: Number(cotizacion.subtotal),
      descuentoGlobal: cotizacion.descuentoGlobal,
      descuentoMonto: Number(cotizacion.descuentoMonto),
      tasaIva: cotizacion.tasaIva,
      impuestos: Number(cotizacion.impuestos),
      total: Number(cotizacion.total),
      moneda: cotizacion.moneda,
      condicionesPago: cotizacion.condicionesPago,
      diasPlazo: cotizacion.diasPlazo,
      condicionesEntrega: cotizacion.condicionesEntrega,
      tiempoEntrega: cotizacion.tiempoEntrega,
      notas: cotizacion.notas,
      vendedor: cotizacion.seller,
      vencida: cotizacion.fechaValidez < new Date() && !['ACEPTADA', 'CONVERTIDA', 'PERDIDA'].includes(cotizacion.estado),
      items: cotizacion.items.map((item) => ({
        id: item.id,
        codigo: item.codigo,
        descripcion: item.descripcion,
        cantidad: Number(item.cantidad),
        unidad: item.unidad,
        precioUnitario: Number(item.precioUnitario),
        descuento: Number(item.descuento),
        subtotal: Number(item.subtotal),
        notas: item.notas,
        product: item.product,
      })),
    };

    return NextResponse.json(formattedCotizacion);
  } catch (error) {
    console.error('Error obteniendo cotizacion del portal:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
