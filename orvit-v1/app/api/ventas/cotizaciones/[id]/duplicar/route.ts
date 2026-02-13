import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { generateQuoteNumber } from '@/lib/ventas/document-number';
import { requirePermission, VENTAS_PERMISSIONS } from '@/lib/ventas/auth';
import { quoteDuplicateSchema } from '@/lib/ventas/validation-schemas';

export const dynamic = 'force-dynamic';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// POST - Duplicar cotización
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { user, error } = await requirePermission(VENTAS_PERMISSIONS.COTIZACIONES_CREATE);
    if (error) return error;

    const companyId = user!.companyId;
    const { id } = await params;
    const quoteId = parseInt(id);
    if (isNaN(quoteId)) {
      return NextResponse.json({ error: 'ID de cotización inválido' }, { status: 400 });
    }

    // Obtener cotización original con filtro de companyId
    const cotizacionOriginal = await prisma.quote.findFirst({
      where: { id: quoteId, companyId },
      include: {
        items: {
          orderBy: { orden: 'asc' }
        }
      }
    });

    if (!cotizacionOriginal) {
      return NextResponse.json({ error: 'Cotización no encontrada' }, { status: 404 });
    }

    // Parsear y validar body opcional (para cambiar cliente)
    let nuevoClienteId = cotizacionOriginal.clientId;
    try {
      const rawBody = await request.json();
      const validationResult = quoteDuplicateSchema.safeParse(rawBody);
      if (validationResult.success && validationResult.data.clientId) {
        nuevoClienteId = validationResult.data.clientId;
      }
    } catch {
      // Sin body, usar mismo cliente
    }

    // Obtener configuración para días de validez
    const salesConfig = await prisma.salesConfig.findUnique({
      where: { companyId },
      select: { diasVencimientoDefault: true }
    });
    const diasValidez = salesConfig?.diasVencimientoDefault || 30;

    // Generar nuevo número
    const nuevoNumero = await generateQuoteNumber(companyId);

    // Crear nueva cotización en transacción
    const nuevaCotizacion = await prisma.$transaction(async (tx) => {
      // Crear cotización
      const cotizacion = await tx.quote.create({
        data: {
          numero: nuevoNumero,
          clientId: nuevoClienteId,
          sellerId: user!.id,
          estado: 'BORRADOR',
          fechaEmision: new Date(),
          fechaValidez: new Date(Date.now() + diasValidez * 24 * 60 * 60 * 1000),
          titulo: cotizacionOriginal.titulo ? `${cotizacionOriginal.titulo} (Copia)` : `Copia de ${cotizacionOriginal.numero}`,
          descripcion: cotizacionOriginal.descripcion,
          subtotal: cotizacionOriginal.subtotal,
          descuentoGlobal: cotizacionOriginal.descuentoGlobal,
          descuentoMonto: cotizacionOriginal.descuentoMonto,
          tasaIva: cotizacionOriginal.tasaIva,
          impuestos: cotizacionOriginal.impuestos,
          total: cotizacionOriginal.total,
          moneda: cotizacionOriginal.moneda,
          tipoCambio: cotizacionOriginal.tipoCambio,
          condicionesPago: cotizacionOriginal.condicionesPago,
          diasPlazo: cotizacionOriginal.diasPlazo,
          condicionesEntrega: cotizacionOriginal.condicionesEntrega,
          tiempoEntrega: cotizacionOriginal.tiempoEntrega,
          lugarEntrega: cotizacionOriginal.lugarEntrega,
          notas: cotizacionOriginal.notas,
          notasInternas: cotizacionOriginal.notasInternas,
          costoTotal: cotizacionOriginal.costoTotal,
          margenBruto: cotizacionOriginal.margenBruto,
          margenPorcentaje: cotizacionOriginal.margenPorcentaje,
          comisionPorcentaje: cotizacionOriginal.comisionPorcentaje,
          comisionMonto: cotizacionOriginal.comisionMonto,
          companyId,
          createdBy: user!.id,
        }
      });

      // Duplicar items
      if (cotizacionOriginal.items.length > 0) {
        await tx.quoteItem.createMany({
          data: cotizacionOriginal.items.map((item, index) => ({
            quoteId: cotizacion.id,
            productId: item.productId,
            codigo: item.codigo,
            descripcion: item.descripcion,
            cantidad: item.cantidad,
            unidad: item.unidad,
            precioUnitario: item.precioUnitario,
            descuento: item.descuento,
            subtotal: item.subtotal,
            costoUnitario: item.costoUnitario,
            margenItem: item.margenItem,
            notas: item.notas,
            orden: index,
          }))
        });
      }

      // Crear versión inicial
      await tx.quoteVersion.create({
        data: {
          quoteId: cotizacion.id,
          version: 1,
          datos: {
            numero: cotizacion.numero,
            titulo: cotizacion.titulo,
            subtotal: Number(cotizacion.subtotal),
            impuestos: Number(cotizacion.impuestos),
            total: Number(cotizacion.total),
            itemsCount: cotizacionOriginal.items.length,
            duplicadoDe: cotizacionOriginal.numero,
          },
          motivo: `Duplicada de ${cotizacionOriginal.numero}`,
          createdBy: user!.id,
        }
      });

      return cotizacion;
    });

    // Obtener cotización completa para retornar
    const cotizacionCompleta = await prisma.quote.findUnique({
      where: { id: nuevaCotizacion.id },
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
            codigo: true,
            descripcion: true,
            cantidad: true,
            unidad: true,
            precioUnitario: true,
            descuento: true,
            subtotal: true,
            notas: true,
            orden: true
          },
          orderBy: { orden: 'asc' }
        }
      }
    });

    return NextResponse.json({
      message: 'Cotización duplicada exitosamente',
      cotizacion: cotizacionCompleta,
      originalId: cotizacionOriginal.id,
      originalNumero: cotizacionOriginal.numero
    }, { status: 201 });
  } catch (error) {
    console.error('Error duplicating cotización:', error);
    return NextResponse.json(
      { error: 'Error al duplicar la cotización', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
