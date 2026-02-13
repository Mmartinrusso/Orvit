import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';
import { prisma } from '@/lib/prisma';
import { JWT_SECRET } from '@/lib/auth';

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

// GET - Obtener solicitud por ID
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

    const solicitud = await prisma.creditNoteRequest.findFirst({
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
          }
        },
        factura: {
          select: {
            id: true,
            numeroSerie: true,
            numeroFactura: true,
            fechaEmision: true,
            total: true,
          }
        },
        goodsReceipt: {
          select: {
            id: true,
            numero: true,
            fechaRecepcion: true,
          }
        },
        createdByUser: { select: { id: true, name: true } },
        items: {
          include: {
            supplierItem: {
              select: {
                id: true,
                nombre: true,
                unidad: true,
                codigoProveedor: true,
              }
            }
          },
          orderBy: { id: 'asc' }
        },
        creditNotes: {
          select: {
            id: true,
            tipo: true,
            numeroSerie: true,
            numero: true,
            fechaEmision: true,
            total: true,
            estado: true,
          }
        },
        purchaseReturns: {
          select: {
            id: true,
            numero: true,
            fechaSolicitud: true,
            estado: true,
          }
        }
      }
    });

    if (!solicitud) {
      return NextResponse.json({ error: 'Solicitud no encontrada' }, { status: 404 });
    }

    return NextResponse.json(solicitud);
  } catch (error) {
    console.error('Error fetching solicitud NCA:', error);
    return NextResponse.json(
      { error: 'Error al obtener la solicitud' },
      { status: 500 }
    );
  }
}

// PUT - Actualizar solicitud (solo en estado NUEVA)
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

    const existente = await prisma.creditNoteRequest.findFirst({
      where: { id, companyId }
    });

    if (!existente) {
      return NextResponse.json({ error: 'Solicitud no encontrada' }, { status: 404 });
    }

    // Solo se puede editar en estado NUEVA
    if (existente.estado !== 'SNCA_NUEVA') {
      return NextResponse.json(
        { error: `No se puede editar una solicitud en estado ${existente.estado}` },
        { status: 400 }
      );
    }

    const body = await request.json();
    const {
      motivo,
      descripcion,
      evidencias,
      items,
    } = body;

    // Recalcular monto si hay items
    let montoSolicitado: number | typeof existente.montoSolicitado = existente.montoSolicitado;
    if (items && Array.isArray(items)) {
      let total = 0;
      for (const item of items) {
        const subtotal = parseFloat(item.cantidadSolicitada) * parseFloat(item.precioUnitario);
        total += subtotal;
      }
      montoSolicitado = total;
    }

    // Actualizar
    await prisma.$transaction(async (tx) => {
      // Actualizar solicitud
      await tx.creditNoteRequest.update({
        where: { id },
        data: {
          ...(motivo !== undefined && { motivo }),
          ...(descripcion !== undefined && { descripcion }),
          ...(evidencias !== undefined && { evidencias }),
          ...(items && { montoSolicitado })
        }
      });

      // Si hay items, recrearlos
      if (items && Array.isArray(items)) {
        await tx.creditNoteRequestItem.deleteMany({
          where: { requestId: id }
        });

        await tx.creditNoteRequestItem.createMany({
          data: items.map((item: any) => {
            const cantidadSolicitada = parseFloat(item.cantidadSolicitada);
            const precioUnitario = parseFloat(item.precioUnitario);

            return {
              requestId: id,
              supplierItemId: item.supplierItemId ? parseInt(item.supplierItemId) : null,
              descripcion: item.descripcion || '',
              cantidadFacturada: parseFloat(item.cantidadFacturada || item.cantidadSolicitada),
              cantidadSolicitada,
              unidad: item.unidad || 'UN',
              precioUnitario,
              subtotal: cantidadSolicitada * precioUnitario,
              motivo: item.motivo || null
            };
          })
        });
      }
    });

    // Obtener solicitud actualizada
    const solicitudActualizada = await prisma.creditNoteRequest.findUnique({
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

    return NextResponse.json(solicitudActualizada);
  } catch (error) {
    console.error('Error updating solicitud NCA:', error);
    return NextResponse.json(
      { error: 'Error al actualizar la solicitud' },
      { status: 500 }
    );
  }
}

// DELETE - Cancelar solicitud (solo en estado NUEVA)
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

    const existente = await prisma.creditNoteRequest.findFirst({
      where: { id, companyId }
    });

    if (!existente) {
      return NextResponse.json({ error: 'Solicitud no encontrada' }, { status: 404 });
    }

    // Solo se puede cancelar en estado NUEVA
    if (existente.estado !== 'SNCA_NUEVA') {
      return NextResponse.json(
        { error: `No se puede cancelar una solicitud en estado ${existente.estado}` },
        { status: 400 }
      );
    }

    // Cancelar (no eliminar, cambiar estado)
    await prisma.creditNoteRequest.update({
      where: { id },
      data: {
        estado: 'SNCA_CANCELADA',
        fechaCierre: new Date()
      }
    });

    // Registrar auditoría
    await prisma.purchaseAuditLog.create({
      data: {
        entidad: 'credit_note_request',
        entidadId: id,
        accion: 'CANCELAR',
        datosAnteriores: { estado: existente.estado },
        datosNuevos: { estado: 'SNCA_CANCELADA' },
        companyId,
        userId: user.id
      }
    });

    return NextResponse.json({ message: 'Solicitud cancelada' });
  } catch (error) {
    console.error('Error canceling solicitud NCA:', error);
    return NextResponse.json(
      { error: 'Error al cancelar la solicitud' },
      { status: 500 }
    );
  }
}
