import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/lib/compras/auth';

export const dynamic = 'force-dynamic';

// GET - Obtener detalle de una cotizacion
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { user, error } = await requirePermission('compras.cotizaciones.view');
    if (error) return error;

    const companyId = user!.companyId;

    const { id } = await params;
    const cotizacionId = parseInt(id);

    // Usar select para evitar columnas que no existen en la BD
    const cotizacion = await prisma.purchaseQuotation.findFirst({
      where: { id: cotizacionId, companyId },
      select: {
        id: true,
        numero: true,
        requestId: true,
        supplierId: true,
        estado: true,
        fechaCotizacion: true,
        validezHasta: true,
        plazoEntrega: true,
        fechaEntregaEstimada: true,
        condicionesPago: true,
        formaPago: true,
        garantia: true,
        subtotal: true,
        descuento: true,
        impuestos: true,
        total: true,
        moneda: true,
        beneficios: true,
        observaciones: true,
        adjuntos: true,
        esSeleccionada: true,
        seleccionadaPor: true,
        createdBy: true,
        createdAt: true,
        updatedAt: true,
        request: {
          select: {
            id: true,
            numero: true,
            titulo: true,
            estado: true,
            descripcion: true,
            prioridad: true,
            solicitante: {
              select: { id: true, name: true }
            }
          }
        },
        supplier: {
          select: { id: true, name: true, cuit: true, email: true, phone: true }
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
            requestItemId: true,
            supplierItemId: true,
            codigoProveedor: true,
            descripcion: true,
            cantidad: true,
            unidad: true,
            precioUnitario: true,
            descuento: true,
            subtotal: true,
            notas: true,
            supplierItem: {
              select: {
                id: true,
                nombre: true,
                codigoProveedor: true
              }
            }
          }
        }
      }
    });

    if (!cotizacion) {
      return NextResponse.json({ error: 'Cotizacion no encontrada' }, { status: 404 });
    }

    // Obtener comentarios
    const comentarios = await prisma.purchaseComment.findMany({
      where: {
        entidad: 'quotation',
        entidadId: cotizacionId
      },
      include: {
        user: { select: { id: true, name: true } }
      },
      orderBy: { createdAt: 'asc' }
    });

    return NextResponse.json({
      ...cotizacion,
      comentarios
    });
  } catch (error: any) {
    console.error('[cotizaciones/[id]] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Error al obtener la cotizacion' },
      { status: 500 }
    );
  }
}

// PUT - Actualizar cotizacion
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { user, error } = await requirePermission('compras.cotizaciones.edit');
    if (error) return error;

    const companyId = user!.companyId;

    const { id } = await params;
    const cotizacionId = parseInt(id);

    // Verificar que existe
    const existing = await prisma.purchaseQuotation.findFirst({
      where: { id: cotizacionId, companyId },
      select: { id: true, estado: true }
    });

    if (!existing) {
      return NextResponse.json({ error: 'Cotizacion no encontrada' }, { status: 404 });
    }

    // No se pueden editar cotizaciones en estados finales
    if (['CONVERTIDA_OC', 'RECHAZADA', 'VENCIDA'].includes(existing.estado)) {
      return NextResponse.json(
        { error: 'No se pueden editar cotizaciones en este estado' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const {
      validezHasta,
      plazoEntrega,
      fechaEntregaEstimada,
      condicionesPago,
      formaPago,
      garantia,
      observaciones,
      beneficios,
      adjuntos,
      items
    } = body;

    const cotizacion = await prisma.$transaction(async (tx) => {
      // Actualizar cotizacion usando SQL directo para evitar columnas que no existen en BD
      await tx.$executeRawUnsafe(`
        UPDATE purchase_quotations SET
          "validezHasta" = COALESCE($1, "validezHasta"),
          "plazoEntrega" = COALESCE($2, "plazoEntrega"),
          "fechaEntregaEstimada" = COALESCE($3, "fechaEntregaEstimada"),
          "condicionesPago" = COALESCE($4, "condicionesPago"),
          "formaPago" = COALESCE($5, "formaPago"),
          "garantia" = COALESCE($6, "garantia"),
          "observaciones" = COALESCE($7, "observaciones"),
          "beneficios" = COALESCE($8, "beneficios"),
          "adjuntos" = COALESCE($9, "adjuntos"),
          "updatedAt" = NOW()
        WHERE id = $10
      `,
        validezHasta ? new Date(validezHasta) : null,
        plazoEntrega ? parseInt(plazoEntrega) : null,
        fechaEntregaEstimada ? new Date(fechaEntregaEstimada) : null,
        condicionesPago || null,
        formaPago || null,
        garantia || null,
        observaciones || null,
        beneficios || null,
        adjuntos && Array.isArray(adjuntos) ? adjuntos : null,
        cotizacionId
      );

      // Si se envian items, recalcular totales
      if (items && Array.isArray(items)) {
        // Eliminar items existentes
        await tx.$executeRawUnsafe(
          `DELETE FROM purchase_quotation_items WHERE "quotationId" = $1`,
          cotizacionId
        );

        // Calcular nuevos totales
        let subtotal = 0;
        const itemsConSubtotal = items.map((item: any) => {
          const cantidad = parseFloat(item.cantidad) || 0;
          const precio = parseFloat(item.precioUnitario) || 0;
          const descuento = parseFloat(item.descuento || '0');
          const itemSubtotal = cantidad * precio * (1 - descuento / 100);
          subtotal += itemSubtotal;

          return {
            ...item,
            cantidad,
            precioUnitario: precio,
            descuento,
            subtotal: itemSubtotal
          };
        });

        const impuestos = subtotal * 0.21;
        const total = subtotal + impuestos;

        // Crear nuevos items usando SQL directo
        for (const item of itemsConSubtotal) {
          await tx.$executeRawUnsafe(`
            INSERT INTO purchase_quotation_items (
              "quotationId", "requestItemId", "supplierItemId",
              "codigoProveedor", descripcion, cantidad, unidad, "precioUnitario", descuento, subtotal, notas
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
          `,
            cotizacionId,
            item.requestItemId ? parseInt(item.requestItemId) : null,
            item.supplierItemId ? parseInt(item.supplierItemId) : null,
            item.codigoProveedor || null,
            item.descripcion,
            item.cantidad,
            item.unidad || 'UN',
            item.precioUnitario,
            item.descuento,
            item.subtotal,
            item.notas || null
          );
        }

        // Actualizar totales
        await tx.$executeRawUnsafe(`
          UPDATE purchase_quotations SET
            subtotal = $1,
            impuestos = $2,
            total = $3,
            "updatedAt" = NOW()
          WHERE id = $4
        `,
          subtotal,
          impuestos,
          total,
          cotizacionId
        );
      }

      return { id: cotizacionId };
    });

    // Obtener cotizacion actualizada
    const cotizacionActualizada = await prisma.purchaseQuotation.findUnique({
      where: { id: cotizacionId },
      select: {
        id: true,
        numero: true,
        estado: true,
        total: true,
        supplier: { select: { id: true, name: true } },
        items: {
          select: {
            id: true,
            descripcion: true,
            cantidad: true,
            precioUnitario: true,
            subtotal: true
          }
        }
      }
    });

    return NextResponse.json(cotizacionActualizada);
  } catch (error: any) {
    console.error('[cotizaciones/[id]] Error updating:', error);
    return NextResponse.json(
      { error: error.message || 'Error al actualizar la cotizacion' },
      { status: 500 }
    );
  }
}

// DELETE - Eliminar cotizacion
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { user, error } = await requirePermission('compras.cotizaciones.delete');
    if (error) return error;

    const companyId = user!.companyId;

    const { id } = await params;
    const cotizacionId = parseInt(id);

    const cotizacion = await prisma.purchaseQuotation.findFirst({
      where: { id: cotizacionId, companyId },
      select: { id: true, estado: true }
    });

    if (!cotizacion) {
      return NextResponse.json({ error: 'Cotizacion no encontrada' }, { status: 404 });
    }

    // Solo se pueden eliminar cotizaciones en ciertos estados
    if (['SELECCIONADA', 'CONVERTIDA_OC'].includes(cotizacion.estado)) {
      return NextResponse.json(
        { error: 'No se pueden eliminar cotizaciones seleccionadas o convertidas' },
        { status: 400 }
      );
    }

    // Eliminar (cascade eliminara items)
    await prisma.purchaseQuotation.delete({
      where: { id: cotizacionId }
    });

    return NextResponse.json({ success: true, message: 'Cotizacion eliminada' });
  } catch (error: any) {
    console.error('[cotizaciones/[id]] Error deleting:', error);
    return NextResponse.json(
      { error: error.message || 'Error al eliminar la cotizacion' },
      { status: 500 }
    );
  }
}
