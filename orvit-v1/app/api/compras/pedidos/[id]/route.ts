import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/lib/compras/auth';
import { PurchaseRequestStatus, RequestPriority } from '@prisma/client';
import { cache, CacheKeys } from '@/lib/cache';
import { puedeEditarPedido } from '@/lib/compras/pedidos-enforcement';

export const dynamic = 'force-dynamic';

// GET - Obtener detalle de un pedido
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { user, error } = await requirePermission('compras.pedidos.view');
    if (error) return error;

    const companyId = user!.companyId;

    const { id } = await params;
    const pedidoId = parseInt(id);

    // Queries en paralelo para mejor performance
    const [pedido, comentarios] = await Promise.all([
      prisma.purchaseRequest.findFirst({
        where: { id: pedidoId, companyId },
        include: {
          solicitante: {
            select: { id: true, name: true, email: true }
          },
          items: {
            include: {
              supplierItem: {
                select: {
                  id: true,
                  nombre: true,
                  codigoProveedor: true,
                  supplier: { select: { id: true, name: true } }
                }
              }
            }
          },
          quotations: {
            select: {
              id: true,
              numero: true,
              estado: true,
              total: true,
              subtotal: true,
              impuestos: true,
              descuento: true,
              moneda: true,
              supplierId: true,
              createdBy: true,
              seleccionadaPor: true,
              createdAt: true,
              esSeleccionada: true,
              fechaCotizacion: true,
              validezHasta: true,
              plazoEntrega: true,
              fechaEntregaEstimada: true,
              condicionesPago: true,
              formaPago: true,
              garantia: true,
              observaciones: true,
              beneficios: true,
              adjuntos: true,
              supplier: { select: { id: true, name: true, cuit: true } },
              createdByUser: { select: { id: true, name: true } },
              seleccionadaByUser: { select: { id: true, name: true } },
              items: {
                select: {
                  id: true,
                  codigoProveedor: true,
                  descripcion: true,
                  cantidad: true,
                  unidad: true,
                  precioUnitario: true,
                  descuento: true,
                  subtotal: true,
                  notas: true,
                  supplierItemId: true,
                  supplierItem: {
                    select: {
                      id: true,
                      nombre: true,
                      codigoProveedor: true,
                      supply: {
                        select: {
                          code: true
                        }
                      }
                    }
                  }
                }
              }
            },
            orderBy: { createdAt: 'desc' }
          },
          purchaseOrders: {
            select: {
              id: true,
              numero: true,
              estado: true,
              total: true,
              createdAt: true
            }
          },
          company: {
            select: { id: true, name: true }
          }
        }
      }),
      // Comentarios en paralelo
      prisma.purchaseComment.findMany({
        where: {
          entidad: 'request',
          entidadId: pedidoId
        },
        select: {
          id: true,
          tipo: true,
          contenido: true,
          createdAt: true,
          user: { select: { id: true, name: true } }
        },
        orderBy: { createdAt: 'asc' }
      })
    ]);

    if (!pedido) {
      return NextResponse.json({ error: 'Pedido no encontrado' }, { status: 404 });
    }

    return NextResponse.json({
      ...pedido,
      comentarios
    });
  } catch (error: any) {
    console.error('='.repeat(60));
    console.error('[pedidos/[id]] ERROR DETALLADO:');
    console.error('Error:', error);
    console.error('Message:', error?.message);
    console.error('Stack:', error?.stack);
    console.error('Code:', error?.code);
    console.error('='.repeat(60));
    return NextResponse.json(
      { error: error?.message || 'Error al obtener el pedido', details: String(error) },
      { status: 500 }
    );
  }
}

// PUT - Actualizar pedido
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { user, error } = await requirePermission('compras.pedidos.edit');
    if (error) return error;

    const companyId = user!.companyId;

    const { id } = await params;
    const pedidoId = parseInt(id);

    // Verificar que existe y pertenece a la empresa
    const existingPedido = await prisma.purchaseRequest.findFirst({
      where: { id: pedidoId, companyId }
    });

    if (!existingPedido) {
      return NextResponse.json({ error: 'Pedido no encontrado' }, { status: 404 });
    }

    // ENFORCEMENT: Verificar si el pedido puede ser editado
    const verificacion = puedeEditarPedido(existingPedido.estado);
    if (!verificacion.puedeEditar) {
      return NextResponse.json(
        { error: verificacion.mensaje, estado: existingPedido.estado },
        { status: 403 }
      );
    }

    const body = await request.json();
    const {
      titulo,
      descripcion,
      prioridad,
      departamento,
      fechaNecesidad,
      fechaLimite,
      presupuestoEstimado,
      moneda,
      notas,
      items
    } = body;

    const pedido = await prisma.$transaction(async (tx) => {
      // Actualizar pedido
      const updated = await tx.purchaseRequest.update({
        where: { id: pedidoId },
        data: {
          ...(titulo && { titulo }),
          ...(descripcion !== undefined && { descripcion }),
          ...(prioridad && { prioridad: prioridad as RequestPriority }),
          ...(departamento !== undefined && { departamento }),
          ...(fechaNecesidad !== undefined && {
            fechaNecesidad: fechaNecesidad ? new Date(fechaNecesidad) : null
          }),
          ...(fechaLimite !== undefined && {
            fechaLimite: fechaLimite ? new Date(fechaLimite) : null
          }),
          ...(presupuestoEstimado !== undefined && {
            presupuestoEstimado: presupuestoEstimado ? parseFloat(presupuestoEstimado) : null
          }),
          ...(moneda && { moneda }),
          ...(notas !== undefined && { notas })
        }
      });

      // Si se envían items, reemplazar todos
      if (items && Array.isArray(items)) {
        // Eliminar items existentes
        await tx.purchaseRequestItem.deleteMany({
          where: { requestId: pedidoId }
        });

        // Crear nuevos items
        await tx.purchaseRequestItem.createMany({
          data: items.map((item: any) => ({
            requestId: pedidoId,
            descripcion: item.descripcion,
            cantidad: parseFloat(item.cantidad),
            unidad: item.unidad || 'UN',
            supplierItemId: item.supplierItemId ? parseInt(item.supplierItemId) : null,
            especificaciones: item.especificaciones
          }))
        });
      }

      return updated;
    });

    // Obtener pedido actualizado con relaciones
    const pedidoActualizado = await prisma.purchaseRequest.findUnique({
      where: { id: pedidoId },
      include: {
        solicitante: { select: { id: true, name: true } },
        items: true
      }
    });

    // Invalidar cache de KPIs si cambió el estado
    cache.invalidate(CacheKeys.purchaseRequestKPIs(companyId));

    return NextResponse.json(pedidoActualizado);
  } catch (error: any) {
    console.error('Error updating pedido:', error);
    return NextResponse.json(
      { error: error.message || 'Error al actualizar el pedido' },
      { status: 500 }
    );
  }
}

// DELETE - Eliminar pedido (solo en borrador)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { user, error } = await requirePermission('compras.pedidos.delete');
    if (error) return error;

    const companyId = user!.companyId;

    const { id } = await params;
    const pedidoId = parseInt(id);

    const pedido = await prisma.purchaseRequest.findFirst({
      where: { id: pedidoId, companyId }
    });

    if (!pedido) {
      return NextResponse.json({ error: 'Pedido no encontrado' }, { status: 404 });
    }

    // Solo se puede eliminar en estado BORRADOR
    if (pedido.estado !== 'BORRADOR') {
      return NextResponse.json(
        { error: 'Solo se pueden eliminar pedidos en estado borrador' },
        { status: 400 }
      );
    }

    // Eliminar (cascade eliminará items y comentarios)
    await prisma.purchaseRequest.delete({
      where: { id: pedidoId }
    });

    // Invalidar cache de KPIs
    cache.invalidate(CacheKeys.purchaseRequestKPIs(companyId));

    return NextResponse.json({ success: true, message: 'Pedido eliminado' });
  } catch (error) {
    console.error('Error deleting pedido:', error);
    return NextResponse.json(
      { error: 'Error al eliminar el pedido' },
      { status: 500 }
    );
  }
}
