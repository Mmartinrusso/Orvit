import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { logQuoteConverted } from '@/lib/ventas/audit-helper';
import { isExtendedMode, DOC_TYPE } from '@/lib/view-mode';
import { generateSaleNumber } from '@/lib/ventas/document-number';
import { requirePermission, VENTAS_PERMISSIONS } from '@/lib/ventas/auth';
import { quoteConvertSchema } from '@/lib/ventas/validation-schemas';

export const dynamic = 'force-dynamic';

// POST - Convertir cotización a orden de venta
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { user, error } = await requirePermission(VENTAS_PERMISSIONS.COTIZACIONES_CONVERT);
    if (error) return error;

    const companyId = user!.companyId;
    const id = parseInt(params.id);
    if (isNaN(id)) {
      return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
    }

    // Verificar que existe y pertenece a la empresa
    const cotizacion = await prisma.quote.findFirst({
      where: { id, companyId },
      include: {
        client: {
          select: {
            id: true,
            legalName: true,
          }
        },
        items: true,
      }
    });

    if (!cotizacion) {
      return NextResponse.json({ error: 'Cotización no encontrada' }, { status: 404 });
    }

    // Validar request body
    const body = await request.json();
    const validation = quoteConvertSchema.safeParse(body);
    if (!validation.success) {
      const errors = validation.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ');
      return NextResponse.json(
        { error: 'Datos inválidos', details: errors },
        { status: 400 }
      );
    }

    const { forzarConversion, docType: requestedDocType } = validation.data;

    if (cotizacion.estado !== 'ACEPTADA') {
      if (cotizacion.estado === 'ENVIADA' && forzarConversion) {
        // Permitir conversión forzada desde ENVIADA (para casos donde cliente acepta por otro medio)
      } else {
        return NextResponse.json(
          { error: `Solo se pueden convertir cotizaciones ACEPTADAS. Estado actual: ${cotizacion.estado}` },
          { status: 400 }
        );
      }
    }

    // Determinar docType para la orden de venta
    // T2 solo permitido si está en Extended ViewMode (Juego de tecla activado)
    let docType = DOC_TYPE.T1; // Default: T1 (formal/facturado)

    if (requestedDocType === DOC_TYPE.T2) {
      // Solo permitir T2 si el usuario está en Extended ViewMode
      if (!isExtendedMode(request)) {
        return NextResponse.json(
          { error: 'No tiene permisos para crear documentos de tipo T2' },
          { status: 403 }
        );
      }
      docType = DOC_TYPE.T2;
    }

    // Verificar que no tenga ya una orden de venta
    if (cotizacion.saleId) {
      return NextResponse.json(
        { error: 'Esta cotización ya fue convertida a orden de venta' },
        { status: 400 }
      );
    }

    // Generar número de orden
    const numeroOrden = await generateSaleNumber(companyId);

    // Crear orden de venta en transacción
    const ordenVenta = await prisma.$transaction(async (tx) => {
      // Crear orden de venta
      const orden = await tx.sale.create({
        data: {
          numero: numeroOrden,
          quoteId: id,
          clientId: cotizacion.clientId,
          sellerId: cotizacion.sellerId,
          estado: 'BORRADOR',
          fecha: new Date(),
          moneda: cotizacion.moneda,
          subtotal: cotizacion.subtotal,
          tasaIva: cotizacion.tasaIva,
          impuestos: cotizacion.impuestos,
          descuentoTotal: cotizacion.descuentoTotal,
          total: cotizacion.total,
          condicionesPago: cotizacion.condicionesPago,
          condicionesEntrega: cotizacion.condicionesEntrega,
          tiempoEntrega: cotizacion.tiempoEntrega,
          notas: cotizacion.notas,
          notasInternas: cotizacion.notasInternas,
          docType, // T1 o T2 según selección del usuario (T2 solo si Extended ViewMode)
          companyId,
          createdBy: user!.id,
        }
      });

      // Crear items de la orden
      await tx.saleItem.createMany({
        data: cotizacion.items.map((item) => ({
          saleId: orden.id,
          productId: item.productId,
          descripcion: item.descripcion,
          cantidad: item.cantidad,
          cantidadEntregada: 0,
          cantidadPendiente: item.cantidad,
          unidad: item.unidad,
          precioUnitario: item.precioUnitario,
          descuento: item.descuento,
          subtotal: item.subtotal,
          costo: item.costo,
          margen: item.margen,
          notas: item.notas,
        }))
      });

      // Actualizar cotización con referencia a la orden
      await tx.quote.update({
        where: { id },
        data: {
          estado: 'CONVERTIDA',
          saleId: orden.id,
          fechaConversion: new Date(),
        }
      });

      return orden;
    });

    // Registrar auditoría
    await logQuoteConverted({
      quoteId: id,
      saleId: ordenVenta.id,
      quoteNumber: cotizacion.numero,
      saleNumber: numeroOrden,
      companyId,
      userId: user!.id,
    });

    // Obtener orden completa para retornar
    const ordenCompleta = await prisma.sale.findUnique({
      where: { id: ordenVenta.id },
      include: {
        client: {
          select: {
            id: true,
            legalName: true,
            name: true,
            email: true
          }
        },
        seller: {
          select: { id: true, name: true }
        },
        items: {
          select: {
            id: true,
            productId: true,
            descripcion: true,
            cantidad: true,
            cantidadPendiente: true,
            unidad: true,
            precioUnitario: true,
            descuento: true,
            subtotal: true,
            product: {
              select: { id: true, name: true, sku: true }
            }
          }
        },
        quote: {
          select: { id: true, numero: true }
        }
      }
    });

    return NextResponse.json({
      message: 'Cotización convertida a orden de venta correctamente',
      ordenVenta: ordenCompleta
    }, { status: 201 });
  } catch (error) {
    console.error('Error convirtiendo cotización:', error);
    return NextResponse.json(
      { error: 'Error al convertir la cotización' },
      { status: 500 }
    );
  }
}
