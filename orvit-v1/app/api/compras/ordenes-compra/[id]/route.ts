import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';
import { prisma } from '@/lib/prisma';
import { JWT_SECRET } from '@/lib/auth';
import { logStatusChange, logCancellation } from '@/lib/compras/audit-helper';

export const dynamic = 'force-dynamic';

const JWT_SECRET_KEY = new TextEncoder().encode(JWT_SECRET);

async function getUserFromToken() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;
    if (!token) return null;

    const { payload } = await jwtVerify(token, JWT_SECRET_KEY);

    const user = await prisma.user.findUnique({
      where: { id: payload.userId as number },
      select: {
        id: true,
        name: true,
        companies: {
          select: { companyId: true },
          take: 1
        }
      }
    });

    return user;
  } catch (error) {
    return null;
  }
}

// GET - Obtener OC por ID
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getUserFromToken();
    if (!user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const companyId = user.companies?.[0]?.companyId;
    if (!companyId) {
      return NextResponse.json({ error: 'Usuario no tiene empresa asignada' }, { status: 400 });
    }

    const { id: idStr } = await params;
    const id = parseInt(idStr);
    if (isNaN(id)) {
      return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
    }

    const orden = await prisma.purchaseOrder.findFirst({
      where: { id, companyId },
      include: {
        proveedor: {
          select: {
            id: true,
            name: true,
            cuit: true,
            razon_social: true,
            email: true,
            phone: true,
            address: true,
            condiciones_pago: true,
          }
        },
        createdByUser: { select: { id: true, name: true } },
        aprobadoByUser: { select: { id: true, name: true } },
        rechazadoByUser: { select: { id: true, name: true } },
        costCenter: { select: { id: true, codigo: true, nombre: true } },
        project: { select: { id: true, codigo: true, nombre: true } },
        items: {
          select: {
            id: true,
            supplierItemId: true,
            codigoPropio: true,
            codigoProveedor: true,
            descripcion: true,
            cantidad: true,
            cantidadRecibida: true,
            cantidadPendiente: true,
            unidad: true,
            precioUnitario: true,
            descuento: true,
            subtotal: true,
            fechaEntregaEsperada: true,
            notas: true,
            supplierItem: {
              select: {
                id: true,
                nombre: true,
                unidad: true,
                codigoProveedor: true,
                precioUnitario: true,
              }
            }
          },
          orderBy: { id: 'asc' }
        },
        goodsReceipts: {
          select: {
            id: true,
            numero: true,
            fechaRecepcion: true,
            estado: true,
          },
          orderBy: { fechaRecepcion: 'desc' }
        },
        matchResults: {
          select: {
            id: true,
            estado: true,
            matchCompleto: true,
            createdAt: true,
          }
        },
        approvals: {
          select: {
            id: true,
            tipo: true,
            estado: true,
            decision: true,
            comentarios: true,
            createdAt: true,
          },
          orderBy: { createdAt: 'desc' }
        }
      }
    });

    if (!orden) {
      return NextResponse.json({ error: 'Orden de compra no encontrada' }, { status: 404 });
    }

    return NextResponse.json(orden);
  } catch (error) {
    console.error('Error fetching orden de compra:', error);
    return NextResponse.json(
      { error: 'Error al obtener la orden de compra' },
      { status: 500 }
    );
  }
}

// PUT - Actualizar OC
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getUserFromToken();
    if (!user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const companyId = user.companies?.[0]?.companyId;
    if (!companyId) {
      return NextResponse.json({ error: 'Usuario no tiene empresa asignada' }, { status: 400 });
    }

    const { id: idStr } = await params;
    const id = parseInt(idStr);
    if (isNaN(id)) {
      return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
    }

    const existente = await prisma.purchaseOrder.findFirst({
      where: { id, companyId }
    });

    if (!existente) {
      return NextResponse.json({ error: 'Orden de compra no encontrada' }, { status: 404 });
    }

    // Solo se puede editar en estado BORRADOR o PENDIENTE_APROBACION
    if (!['BORRADOR', 'PENDIENTE_APROBACION', 'RECHAZADA'].includes(existente.estado)) {
      return NextResponse.json(
        { error: `No se puede editar una orden en estado ${existente.estado}` },
        { status: 400 }
      );
    }

    const body = await request.json();
    const {
      proveedorId,
      fechaEntregaEsperada,
      condicionesPago,
      moneda,
      notas,
      notasInternas,
      costCenterId,
      projectId,
      esEmergencia,
      motivoEmergencia,
      items,
    } = body;

    // Si hay items, recalcular totales
    let updateData: any = {
      ...(proveedorId && { proveedorId: parseInt(proveedorId) }),
      ...(fechaEntregaEsperada !== undefined && {
        fechaEntregaEsperada: fechaEntregaEsperada ? new Date(fechaEntregaEsperada) : null
      }),
      ...(condicionesPago !== undefined && { condicionesPago }),
      ...(moneda && { moneda }),
      ...(notas !== undefined && { notas }),
      ...(notasInternas !== undefined && { notasInternas }),
      ...(costCenterId !== undefined && {
        costCenterId: costCenterId ? parseInt(costCenterId) : null
      }),
      ...(projectId !== undefined && {
        projectId: projectId ? parseInt(projectId) : null
      }),
      ...(esEmergencia !== undefined && { esEmergencia }),
      ...(esEmergencia && motivoEmergencia && { motivoEmergencia }),
    };

    // Si se rechazó y se está editando, volver a borrador
    if (existente.estado === 'RECHAZADA') {
      updateData.estado = 'BORRADOR';
      updateData.rechazadoPor = null;
      updateData.rechazadoAt = null;
      updateData.motivoRechazo = null;
    }

    if (items && Array.isArray(items)) {
      // Recalcular totales
      let subtotal = 0;
      const itemsConSubtotal = items.map((item: any) => {
        const cantidad = parseFloat(item.cantidad);
        const precio = parseFloat(item.precioUnitario);
        const descuento = parseFloat(item.descuento || '0');
        const itemSubtotal = cantidad * precio * (1 - descuento / 100);
        subtotal += itemSubtotal;

        return {
          ...item,
          cantidad,
          precioUnitario: precio,
          descuento,
          subtotal: itemSubtotal,
          cantidadPendiente: cantidad - (parseFloat(item.cantidadRecibida) || 0),
        };
      });

      const impuestos = subtotal * 0.21;
      const total = subtotal + impuestos;

      updateData.subtotal = subtotal;
      updateData.impuestos = impuestos;
      updateData.total = total;

      // Actualizar con items en transacción
      await prisma.$transaction(async (tx) => {
        // Eliminar items existentes
        await tx.purchaseOrderItem.deleteMany({
          where: { purchaseOrderId: id }
        });

        // Crear nuevos items (incluir códigos para trazabilidad)
        await tx.purchaseOrderItem.createMany({
          data: itemsConSubtotal.map((item: any) => ({
            purchaseOrderId: id,
            supplierItemId: parseInt(item.supplierItemId),
            // Códigos del item para trazabilidad
            codigoPropio: item.codigoPropio || null,
            codigoProveedor: item.codigoProveedor || null,
            descripcion: item.descripcion || '',
            cantidad: item.cantidad,
            cantidadRecibida: item.cantidadRecibida || 0,
            cantidadPendiente: item.cantidadPendiente,
            unidad: item.unidad || 'UN',
            precioUnitario: item.precioUnitario,
            descuento: item.descuento,
            subtotal: item.subtotal,
            fechaEntregaEsperada: item.fechaEntregaEsperada ? new Date(item.fechaEntregaEsperada) : null,
            notas: item.notas || null,
          }))
        });

        // Actualizar orden
        await tx.purchaseOrder.update({
          where: { id },
          data: updateData
        });
      });
    } else {
      await prisma.purchaseOrder.update({
        where: { id },
        data: updateData
      });
    }

    // Obtener orden actualizada
    const ordenActualizada = await prisma.purchaseOrder.findUnique({
      where: { id },
      include: {
        proveedor: { select: { id: true, name: true } },
        items: {
          include: {
            supplierItem: { select: { id: true, nombre: true, unidad: true } }
          }
        }
      }
    });

    // Registrar auditoría si el estado cambió
    if (ordenActualizada && ordenActualizada.estado !== existente.estado) {
      await logStatusChange({
        entidad: 'purchase_order',
        entidadId: id,
        estadoAnterior: existente.estado,
        estadoNuevo: ordenActualizada.estado,
        companyId,
        userId: user.id,
      });
    }

    return NextResponse.json(ordenActualizada);
  } catch (error) {
    console.error('Error updating orden de compra:', error);
    return NextResponse.json(
      { error: 'Error al actualizar la orden de compra' },
      { status: 500 }
    );
  }
}

// DELETE - Cancelar OC
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getUserFromToken();
    if (!user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const companyId = user.companies?.[0]?.companyId;
    if (!companyId) {
      return NextResponse.json({ error: 'Usuario no tiene empresa asignada' }, { status: 400 });
    }

    const { id: idStr } = await params;
    const id = parseInt(idStr);
    if (isNaN(id)) {
      return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
    }

    const existente = await prisma.purchaseOrder.findFirst({
      where: { id, companyId },
      include: {
        _count: {
          select: { goodsReceipts: true }
        }
      }
    });

    if (!existente) {
      return NextResponse.json({ error: 'Orden de compra no encontrada' }, { status: 404 });
    }

    // No se puede cancelar si tiene recepciones
    if (existente._count.goodsReceipts > 0) {
      return NextResponse.json(
        { error: 'No se puede cancelar una orden con recepciones asociadas' },
        { status: 400 }
      );
    }

    // Solo cancelar, no eliminar
    await prisma.purchaseOrder.update({
      where: { id },
      data: { estado: 'CANCELADA' }
    });

    // Registrar auditoría
    await logCancellation({
      entidad: 'purchase_order',
      entidadId: id,
      estadoAnterior: existente.estado,
      reason: 'Cancelada por usuario',
      companyId,
      userId: user.id,
    });

    return NextResponse.json({ message: 'Orden de compra cancelada' });
  } catch (error) {
    console.error('Error deleting orden de compra:', error);
    return NextResponse.json(
      { error: 'Error al cancelar la orden de compra' },
      { status: 500 }
    );
  }
}
