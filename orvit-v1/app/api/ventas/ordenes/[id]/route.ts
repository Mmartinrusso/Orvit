import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  logSalesUpdate,
  logSalesDeletion,
  logSalesCancellation,
} from '@/lib/ventas/audit-helper';
import { getViewMode, applyViewMode } from '@/lib/view-mode';
import { requirePermission, checkPermission, VENTAS_PERMISSIONS } from '@/lib/ventas/auth';

export const dynamic = 'force-dynamic';

// GET - Obtener orden de venta por ID
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { user, error } = await requirePermission(VENTAS_PERMISSIONS.ORDENES_VIEW);
    if (error) return error;

    // ViewMode - filtrar según modo activo
    const viewMode = getViewMode(request);

    const id = parseInt(params.id);
    if (isNaN(id)) {
      return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
    }

    const { searchParams } = new URL(request.url);
    const full = searchParams.get('full') === 'true';

    // Buscar CON filtro de ViewMode
    const orden = await prisma.sale.findFirst({
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
        items: {
          select: {
            id: true,
            productId: true,
            descripcion: true,
            cantidad: true,
            cantidadEntregada: true,
            cantidadPendiente: true,
            unidad: true,
            precioUnitario: true,
            descuento: true,
            subtotal: true,
            notas: true,
            product: {
              select: { id: true, name: true, sku: true, unit: true }
            }
          }
        },
        quote: {
          select: { id: true, numero: true, titulo: true }
        },
        ...(full && {
          deliveries: {
            include: {
              items: true,
              remito: {
                select: { id: true, numero: true }
              }
            },
            orderBy: { createdAt: 'desc' as const }
          },
          invoices: {
            include: {
              items: true,
              paymentAllocations: {
                select: {
                  id: true,
                  montoAplicado: true,
                  payment: {
                    select: { id: true, numero: true, fechaPago: true }
                  }
                }
              }
            },
            orderBy: { createdAt: 'desc' as const }
          },
        })
      }
    });

    if (!orden) {
      return NextResponse.json({ error: 'Orden de venta no encontrada' }, { status: 404 });
    }

    // Verificar permisos granulares de costos y márgenes
    const [canViewCosts, canViewMargins] = await Promise.all([
      checkPermission(user!.id, user!.companyId, VENTAS_PERMISSIONS.COSTS_VIEW),
      checkPermission(user!.id, user!.companyId, VENTAS_PERMISSIONS.MARGINS_VIEW),
    ]);

    // Filtrar campos sensibles según permisos
    const response: any = { ...orden };
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
    console.error('Error fetching orden de venta:', error);
    return NextResponse.json(
      { error: 'Error al obtener la orden de venta' },
      { status: 500 }
    );
  }
}

// PUT - Actualizar orden de venta
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { user, error } = await requirePermission(VENTAS_PERMISSIONS.ORDENES_EDIT);
    if (error) return error;

    // ViewMode - filtrar según modo activo
    const viewMode = getViewMode(request);

    const id = parseInt(params.id);
    if (isNaN(id)) {
      return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
    }

    // Verificar que existe y es accesible en el ViewMode actual
    const ordenExistente = await prisma.sale.findFirst({
      where: applyViewMode({ id, companyId: user!.companyId }, viewMode),
      include: { items: true }
    });

    if (!ordenExistente) {
      return NextResponse.json({ error: 'Orden de venta no encontrada' }, { status: 404 });
    }

    // Solo se pueden editar órdenes en BORRADOR
    if (ordenExistente.estado !== 'BORRADOR') {
      return NextResponse.json(
        { error: `No se puede editar una orden en estado ${ordenExistente.estado}` },
        { status: 400 }
      );
    }

    const body = await request.json();
    const {
      clientId,
      sellerId,
      fechaEntrega,
      condicionesPago,
      condicionesEntrega,
      tiempoEntrega,
      notas,
      notasInternas,
      items,
    } = body;

    // Calcular nuevos totales si hay items
    let subtotal = ordenExistente.subtotal ? Number(ordenExistente.subtotal) : 0;
    let itemsConCalculos: any[] = [];

    if (items && Array.isArray(items) && items.length > 0) {
      subtotal = 0;
      itemsConCalculos = await Promise.all(items.map(async (item: any) => {
        const cantidad = parseFloat(item.cantidad);
        const precio = parseFloat(item.precioUnitario);
        const descuento = parseFloat(item.descuento || '0');
        const itemSubtotal = cantidad * precio * (1 - descuento / 100);
        subtotal += itemSubtotal;

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

    const tasaIva = ordenExistente.tasaIva ? Number(ordenExistente.tasaIva) : 21;
    const impuestos = subtotal * (tasaIva / 100);
    const total = subtotal + impuestos;

    // Actualizar orden en transacción
    const ordenActualizada = await prisma.$transaction(async (tx) => {
      const orden = await tx.sale.update({
        where: { id },
        data: {
          ...(clientId && { clientId }),  // clientId es string (cuid)
          ...(sellerId && { sellerId: parseInt(sellerId) }),
          ...(fechaEntrega !== undefined && { fechaEntrega: fechaEntrega ? new Date(fechaEntrega) : null }),
          ...(condicionesPago !== undefined && { condicionesPago }),
          ...(condicionesEntrega !== undefined && { condicionesEntrega }),
          ...(tiempoEntrega !== undefined && { tiempoEntrega }),
          ...(notas !== undefined && { notas }),
          ...(notasInternas !== undefined && { notasInternas }),
          subtotal,
          impuestos,
          total,
        }
      });

      if (itemsConCalculos.length > 0) {
        await tx.saleItem.deleteMany({
          where: { saleId: id }
        });

        await tx.saleItem.createMany({
          data: itemsConCalculos.map((item) => ({
            saleId: id,
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
      }

      return orden;
    });

    // Registrar auditoría
    await logSalesUpdate({
      entidad: 'sale',
      entidadId: id,
      companyId: user!.companyId,
      userId: user!.id,
      changes: { total },
    });

    // Obtener orden completa
    const ordenCompleta = await prisma.sale.findUnique({
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
            cantidadPendiente: true,
            unidad: true,
            precioUnitario: true,
            descuento: true,
            subtotal: true,
            product: {
              select: { id: true, name: true, sku: true }
            }
          }
        }
      }
    });

    return NextResponse.json(ordenCompleta);
  } catch (error) {
    console.error('Error updating orden de venta:', error);
    return NextResponse.json(
      { error: 'Error al actualizar la orden de venta' },
      { status: 500 }
    );
  }
}

// DELETE - Eliminar orden de venta
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { user, error } = await requirePermission(VENTAS_PERMISSIONS.ORDENES_EDIT);
    if (error) return error;

    // ViewMode - filtrar según modo activo
    const viewMode = getViewMode(request);

    const id = parseInt(params.id);
    if (isNaN(id)) {
      return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
    }

    // Verificar que existe y es accesible en el ViewMode actual
    const orden = await prisma.sale.findFirst({
      where: applyViewMode({ id, companyId: user!.companyId }, viewMode),
      include: {
        _count: {
          select: { deliveries: true, invoices: true }
        }
      }
    });

    if (!orden) {
      return NextResponse.json({ error: 'Orden de venta no encontrada' }, { status: 404 });
    }

    // Solo se pueden eliminar órdenes en BORRADOR sin entregas ni facturas
    if (orden.estado !== 'BORRADOR') {
      return NextResponse.json(
        { error: 'Solo se pueden eliminar órdenes en estado BORRADOR' },
        { status: 400 }
      );
    }

    if (orden._count.deliveries > 0 || orden._count.invoices > 0) {
      return NextResponse.json(
        { error: 'No se puede eliminar una orden con entregas o facturas asociadas' },
        { status: 400 }
      );
    }

    // Eliminar en transacción
    await prisma.$transaction(async (tx) => {
      await tx.saleItem.deleteMany({ where: { saleId: id } });
      await tx.sale.delete({ where: { id } });
    });

    // Registrar auditoría
    await logSalesDeletion({
      entidad: 'sale',
      entidadId: id,
      companyId: user!.companyId,
      userId: user!.id,
      estadoAnterior: orden.estado,
      documentNumber: orden.numero,
    });

    return NextResponse.json({ message: 'Orden de venta eliminada correctamente' });
  } catch (error) {
    console.error('Error deleting orden de venta:', error);
    return NextResponse.json(
      { error: 'Error al eliminar la orden de venta' },
      { status: 500 }
    );
  }
}
