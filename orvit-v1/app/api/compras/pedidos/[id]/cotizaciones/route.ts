import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/lib/compras/auth';

export const dynamic = 'force-dynamic';

/**
 * GET - Obtener cotizaciones de un pedido (lazy loading)
 * Endpoint separado para cargar cotizaciones solo cuando se necesitan
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { user, error } = await requirePermission('compras.cotizaciones.view');
    if (error) return error;

    const companyId = user!.companyId;

    const { id } = await params;
    const pedidoId = parseInt(id);

    // Verificar que el pedido existe y pertenece a la empresa
    const pedido = await prisma.purchaseRequest.findFirst({
      where: { id: pedidoId, companyId },
      select: { id: true }
    });

    if (!pedido) {
      return NextResponse.json({ error: 'Pedido no encontrado' }, { status: 404 });
    }

    // Obtener cotizaciones con todos los detalles
    const quotations = await prisma.purchaseQuotation.findMany({
      where: { requestId: pedidoId },
      select: {
        id: true,
        numero: true,
        estado: true,
        total: true,
        subtotal: true,
        impuestos: true,
        descuento: true,
        moneda: true,
        esSeleccionada: true,
        fechaCotizacion: true,
        validezHasta: true,
        plazoEntrega: true,
        fechaEntregaEstimada: true,
        condicionesPago: true,
        formaPago: true,
        garantia: true,
        observaciones: true,
        adjuntos: true,
        createdAt: true,
        supplier: {
          select: { id: true, name: true, email: true, phone: true }
        },
        createdByUser: {
          select: { id: true, name: true }
        },
        seleccionadaByUser: {
          select: { id: true, name: true }
        },
        items: {
          select: {
            id: true,
            descripcion: true,
            cantidad: true,
            unidad: true,
            precioUnitario: true,
            descuento: true,
            subtotal: true,
            supplierItemId: true,
            supplierItem: {
              select: {
                id: true,
                nombre: true,
                codigoProveedor: true
              }
            }
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    return NextResponse.json({
      data: quotations,
      count: quotations.length
    });
  } catch (error: any) {
    console.error('Error fetching quotations:', error);
    return NextResponse.json(
      { error: error.message || 'Error al obtener cotizaciones' },
      { status: 500 }
    );
  }
}
