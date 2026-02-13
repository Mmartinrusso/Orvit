import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  logSalesUpdate,
  logSalesDeletion,
  logSalesStatusChange,
  logQuoteSent,
  logQuoteAccepted,
  logQuoteConverted,
} from '@/lib/ventas/audit-helper';
import { getViewMode, applyViewMode } from '@/lib/view-mode';
import { requirePermission, checkPermission, VENTAS_PERMISSIONS } from '@/lib/ventas/auth';

export const dynamic = 'force-dynamic';

// GET - Obtener cotización por ID
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { user, error } = await requirePermission(VENTAS_PERMISSIONS.COTIZACIONES_VIEW);
    if (error) return error;

    // ViewMode - filtrar según modo activo
    const viewMode = getViewMode(request);

    const { id: idParam } = await params;
    const id = parseInt(idParam);
    if (isNaN(id)) {
      return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
    }

    const { searchParams } = new URL(request.url);
    const includeVersions = searchParams.get('includeVersions') === 'true';
    const includeAcceptance = searchParams.get('includeAcceptance') === 'true';

    // Buscar CON filtro de ViewMode (Standard: T1+null, Extended: todo)
    const cotizacion = await prisma.quote.findFirst({
      where: applyViewMode({
        id,
        companyId: user!.companyId,
      }, viewMode),
      include: {
        client: {
          select: {
            id: true,
            legalName: true,
            name: true,
            cuit: true,
            email: true,
            phone: true,
            address: true,
          }
        },
        seller: {
          select: { id: true, name: true, email: true }
        },
        createdByUser: {
          select: { id: true, name: true }
        },
        aprobadoByUser: {
          select: { id: true, name: true }
        },
        items: {
          select: {
            id: true,
            productId: true,
            descripcion: true,
            cantidad: true,
            unidad: true,
            precioUnitario: true,
            descuento: true,
            subtotal: true,
            notas: true,
            // NO incluir costo ni margen por seguridad
            product: {
              select: { id: true, name: true, sku: true, unit: true }
            }
          }
        },
        attachments: true,
        ...(includeVersions && {
          versions: {
            orderBy: { version: 'desc' as const },
            include: {
              createdByUser: {
                select: { id: true, name: true }
              }
            }
          }
        }),
        ...(includeAcceptance && {
          acceptance: true
        }),
        sale: {
          select: {
            id: true,
            numero: true,
            estado: true
          }
        }
      }
    });

    if (!cotizacion) {
      return NextResponse.json({ error: 'Cotización no encontrada' }, { status: 404 });
    }

    // Verificar permisos granulares de costos y márgenes
    const [canViewCosts, canViewMargins] = await Promise.all([
      checkPermission(user!.id, user!.companyId, VENTAS_PERMISSIONS.COSTS_VIEW),
      checkPermission(user!.id, user!.companyId, VENTAS_PERMISSIONS.MARGINS_VIEW),
    ]);

    // Filtrar campos sensibles según permisos
    const response: any = { ...cotizacion };
    if (!canViewCosts) {
      response.costoTotal = undefined;
      response.items = response.items?.map((item: any) => ({
        ...item,
        costoUnitario: undefined,
      }));
    }
    if (!canViewMargins) {
      response.margenBruto = undefined;
      response.margenPorcentaje = undefined;
      response.items = response.items?.map((item: any) => ({
        ...item,
        margenItem: undefined,
      }));
    }

    return NextResponse.json(response);
  } catch (error) {
    console.error('Error fetching cotización:', error);
    return NextResponse.json(
      { error: 'Error al obtener la cotización' },
      { status: 500 }
    );
  }
}

// PUT - Actualizar cotización
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { user, error } = await requirePermission(VENTAS_PERMISSIONS.COTIZACIONES_EDIT);
    if (error) return error;

    // ViewMode - filtrar según modo activo
    const viewMode = getViewMode(request);

    const { id: idParam } = await params;
    const id = parseInt(idParam);
    if (isNaN(id)) {
      return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
    }

    // Verificar que existe y es accesible en el ViewMode actual
    const cotizacionExistente = await prisma.quote.findFirst({
      where: applyViewMode({ id, companyId: user!.companyId }, viewMode),
      include: { items: true }
    });

    if (!cotizacionExistente) {
      return NextResponse.json({ error: 'Cotización no encontrada' }, { status: 404 });
    }

    // Solo se pueden editar cotizaciones en BORRADOR o EN_NEGOCIACION
    if (!['BORRADOR', 'EN_NEGOCIACION'].includes(cotizacionExistente.estado)) {
      return NextResponse.json(
        { error: `No se puede editar una cotización en estado ${cotizacionExistente.estado}` },
        { status: 400 }
      );
    }

    const body = await request.json();
    const {
      clientId,
      sellerId,
      titulo,
      fechaValidez,
      condicionesPago,
      condicionesEntrega,
      tiempoEntrega,
      notas,
      notasInternas,
      items,
    } = body;

    // Calcular nuevos totales si hay items
    let subtotal = cotizacionExistente.subtotal ? Number(cotizacionExistente.subtotal) : 0;
    let itemsConCalculos: any[] = [];

    if (items && Array.isArray(items) && items.length > 0) {
      subtotal = 0;
      itemsConCalculos = await Promise.all(items.map(async (item: any) => {
        const cantidad = parseFloat(item.cantidad);
        const precio = parseFloat(item.precioUnitario);
        const descuento = parseFloat(item.descuento || '0');
        const itemSubtotal = cantidad * precio * (1 - descuento / 100);
        subtotal += itemSubtotal;

        // Obtener costo del producto
        let costo = 0;
        let margen = 0;
        if (item.productId) {
          const product = await prisma.product.findUnique({
            where: { id: item.productId },  // productId es string (cuid)
            select: { cost: true }
          });
          if (product?.cost) {
            costo = Number(product.cost);
            margen = precio > 0 ? ((precio - costo) / precio) * 100 : 0;
          }
        }

        return {
          productId: item.productId,  // productId es string (cuid)
          descripcion: item.descripcion || '',
          cantidad,
          unidad: item.unidad || 'UN',
          precioUnitario: precio,
          descuento,
          subtotal: itemSubtotal,
          costo,
          margen,
          notas: item.notas || null,
        };
      }));
    }

    const tasaIva = cotizacionExistente.tasaIva ? Number(cotizacionExistente.tasaIva) : 21;
    const impuestos = subtotal * (tasaIva / 100);
    const total = subtotal + impuestos;

    // Incrementar versión
    const nuevaVersion = (cotizacionExistente.version || 1) + 1;

    // Actualizar cotización en transacción
    const cotizacionActualizada = await prisma.$transaction(async (tx) => {
      // Actualizar cotización
      const cotizacion = await tx.quote.update({
        where: { id },
        data: {
          ...(clientId && { clientId }),  // clientId es string (cuid)
          ...(sellerId && { sellerId: parseInt(sellerId) }),
          ...(titulo && { titulo }),
          ...(fechaValidez && { fechaValidez: new Date(fechaValidez) }),
          ...(condicionesPago !== undefined && { condicionesPago }),
          ...(condicionesEntrega !== undefined && { condicionesEntrega }),
          ...(tiempoEntrega !== undefined && { tiempoEntrega }),
          ...(notas !== undefined && { notas }),
          ...(notasInternas !== undefined && { notasInternas }),
          subtotal,
          impuestos,
          total,
          version: nuevaVersion,
        }
      });

      // Si hay items nuevos, reemplazar los existentes
      if (itemsConCalculos.length > 0) {
        await tx.quoteItem.deleteMany({
          where: { quoteId: id }
        });

        await tx.quoteItem.createMany({
          data: itemsConCalculos.map((item) => ({
            quoteId: id,
            productId: item.productId,
            descripcion: item.descripcion,
            cantidad: item.cantidad,
            unidad: item.unidad,
            precioUnitario: item.precioUnitario,
            descuento: item.descuento,
            subtotal: item.subtotal,
            costo: item.costo,
            margen: item.margen,
            notas: item.notas,
          }))
        });
      }

      // Crear nueva versión
      await tx.quoteVersion.create({
        data: {
          quoteId: id,
          version: nuevaVersion,
          datos: {
            numero: cotizacion.numero,
            titulo: cotizacion.titulo,
            subtotal,
            impuestos,
            total,
            itemsCount: itemsConCalculos.length || cotizacionExistente.items.length,
            cambios: body.descripcionCambios || 'Actualización de cotización',
          },
          motivo: body.descripcionCambios || 'Actualización de cotización',
          createdBy: user!.id,
        }
      });

      return cotizacion;
    });

    // Registrar auditoría
    await logSalesUpdate({
      entidad: 'quote',
      entidadId: id,
      companyId: user!.companyId,
      userId: user!.id,
      changes: {
        version: nuevaVersion,
        total,
      },
    });

    // Obtener cotización completa actualizada
    const cotizacionCompleta = await prisma.quote.findUnique({
      where: { id },
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
            unidad: true,
            precioUnitario: true,
            descuento: true,
            subtotal: true,
            notas: true,
            product: {
              select: { id: true, name: true, sku: true }
            }
          }
        }
      }
    });

    return NextResponse.json(cotizacionCompleta);
  } catch (error) {
    console.error('Error updating cotización:', error);
    return NextResponse.json(
      { error: 'Error al actualizar la cotización' },
      { status: 500 }
    );
  }
}

// DELETE - Eliminar cotización
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { user, error } = await requirePermission(VENTAS_PERMISSIONS.COTIZACIONES_DELETE);
    if (error) return error;

    // ViewMode - filtrar según modo activo
    const viewMode = getViewMode(request);

    const { id: idParam } = await params;
    const id = parseInt(idParam);
    if (isNaN(id)) {
      return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
    }

    // Verificar que existe y es accesible en el ViewMode actual
    const cotizacion = await prisma.quote.findFirst({
      where: applyViewMode({ id, companyId: user!.companyId }, viewMode)
    });

    if (!cotizacion) {
      return NextResponse.json({ error: 'Cotización no encontrada' }, { status: 404 });
    }

    // Solo se pueden eliminar cotizaciones en BORRADOR
    if (cotizacion.estado !== 'BORRADOR') {
      return NextResponse.json(
        { error: 'Solo se pueden eliminar cotizaciones en estado BORRADOR' },
        { status: 400 }
      );
    }

    // Eliminar en transacción
    await prisma.$transaction(async (tx) => {
      await tx.quoteItem.deleteMany({ where: { quoteId: id } });
      await tx.quoteVersion.deleteMany({ where: { quoteId: id } });
      await tx.quoteAttachment.deleteMany({ where: { quoteId: id } });
      await tx.quote.delete({ where: { id } });
    });

    // Registrar auditoría
    await logSalesDeletion({
      entidad: 'quote',
      entidadId: id,
      companyId: user!.companyId,
      userId: user!.id,
      estadoAnterior: cotizacion.estado,
      documentNumber: cotizacion.numero,
    });

    return NextResponse.json({ message: 'Cotización eliminada correctamente' });
  } catch (error) {
    console.error('Error deleting cotización:', error);
    return NextResponse.json(
      { error: 'Error al eliminar la cotización' },
      { status: 500 }
    );
  }
}
