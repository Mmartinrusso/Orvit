import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';
import { prisma } from '@/lib/prisma';
import { JWT_SECRET } from '@/lib/auth';
import { invalidarCacheStock } from '@/lib/compras/cache';

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
  } catch {
    return null;
  }
}

// GET - Obtener devolución por ID
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

    const devolucion = await prisma.purchaseReturn.findFirst({
      where: { id, companyId },
      include: {
        proveedor: { select: { id: true, name: true, cuit: true, razon_social: true } },
        warehouse: { select: { id: true, codigo: true, nombre: true } },
        // Factura directa (cuando se crea desde cuenta corriente)
        factura: { select: { id: true, numeroSerie: true, numeroFactura: true, total: true } },
        goodsReceipt: {
          select: {
            id: true,
            numero: true,
            fechaRecepcion: true,
            facturaId: true,
            factura: { select: { id: true, numeroSerie: true, numeroFactura: true } },
            items: {
              select: {
                id: true,
                supplierItemId: true,
                descripcion: true,
                cantidadRecibida: true,
                cantidadAceptada: true,
                supplierItem: { select: { id: true, nombre: true, unidad: true } }
              }
            }
          }
        },
        createdByUser: { select: { id: true, name: true } },
        items: {
          include: {
            supplierItem: { select: { id: true, nombre: true, unidad: true, codigoProveedor: true } },
            goodsReceiptItem: {
              select: { id: true, cantidadRecibida: true, cantidadAceptada: true }
            }
          }
        },
        stockMovements: {
          select: {
            id: true,
            tipo: true,
            cantidad: true,
            cantidadAnterior: true,
            cantidadPosterior: true,
            createdAt: true
          }
        },
        creditNotes: {
          select: {
            id: true,
            numero: true,
            total: true,
            estado: true,
            tipoNca: true,
            aplicada: true
          }
        }
      }
    });

    if (!devolucion) {
      return NextResponse.json({ error: 'Devolución no encontrada' }, { status: 404 });
    }

    return NextResponse.json(devolucion);
  } catch (error) {
    console.error('Error fetching devolucion:', error);
    return NextResponse.json(
      { error: 'Error al obtener la devolución' },
      { status: 500 }
    );
  }
}

// PUT - Actualizar devolución o cambiar estado
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

    const devolucion = await prisma.purchaseReturn.findFirst({
      where: { id, companyId }
    });

    if (!devolucion) {
      return NextResponse.json({ error: 'Devolución no encontrada' }, { status: 404 });
    }

    const body = await request.json();
    const { accion, motivo, notas, warehouseId } = body;

    // Acciones de workflow
    if (accion) {
      let updateData: any = {};

      switch (accion) {
        case 'solicitar':
          if (devolucion.estado !== 'BORRADOR') {
            return NextResponse.json(
              { error: 'Solo se pueden solicitar devoluciones en borrador' },
              { status: 400 }
            );
          }
          updateData.estado = 'SOLICITADA';
          break;

        case 'aprobar_proveedor':
          if (devolucion.estado !== 'SOLICITADA') {
            return NextResponse.json(
              { error: 'Solo se pueden aprobar devoluciones solicitadas' },
              { status: 400 }
            );
          }
          updateData.estado = 'APROBADA_PROVEEDOR';
          break;

        case 'rechazar':
          if (!['SOLICITADA', 'BORRADOR'].includes(devolucion.estado)) {
            return NextResponse.json(
              { error: 'No se puede rechazar en este estado' },
              { status: 400 }
            );
          }
          updateData.estado = 'RECHAZADA';
          updateData.resolucion = motivo || 'Rechazada por el proveedor';
          updateData.fechaResolucion = new Date();
          break;

        default:
          return NextResponse.json({ error: 'Acción no válida' }, { status: 400 });
      }

      const devolucionActualizada = await prisma.purchaseReturn.update({
        where: { id },
        data: {
          ...updateData,
          ...(notas && { notas: devolucion.notas ? `${devolucion.notas}\n${notas}` : notas }),
        },
        include: {
          proveedor: { select: { id: true, name: true } },
          warehouse: { select: { id: true, codigo: true, nombre: true } }
        }
      });

      // Registrar en auditoría
      await prisma.purchaseAuditLog.create({
        data: {
          entidad: 'purchase_return',
          entidadId: id,
          accion: accion.toUpperCase(),
          datosAnteriores: { estado: devolucion.estado },
          datosNuevos: { estado: devolucionActualizada.estado },
          companyId,
          userId: user.id
        }
      });

      return NextResponse.json({
        message: `Devolución ${accion} correctamente`,
        devolucion: devolucionActualizada
      });
    }

    // Actualización normal (solo si está en borrador)
    if (devolucion.estado !== 'BORRADOR') {
      return NextResponse.json(
        { error: `No se puede editar una devolución en estado ${devolucion.estado}` },
        { status: 400 }
      );
    }

    const updateData: any = {
      ...(body.motivo && { motivo: body.motivo }),
      ...(body.descripcion !== undefined && { descripcion: body.descripcion }),
      ...(body.tipo && { tipo: body.tipo }),
      ...(warehouseId !== undefined && { warehouseId: warehouseId ? parseInt(warehouseId) : null }),
      ...(body.evidenciaProblema && { evidenciaProblema: body.evidenciaProblema }),
    };

    await prisma.purchaseReturn.update({
      where: { id },
      data: updateData
    });

    const devolucionActualizada = await prisma.purchaseReturn.findUnique({
      where: { id },
      include: {
        proveedor: { select: { id: true, name: true } },
        warehouse: { select: { id: true, codigo: true, nombre: true } },
        items: {
          include: {
            supplierItem: { select: { id: true, nombre: true, unidad: true } }
          }
        }
      }
    });

    return NextResponse.json(devolucionActualizada);
  } catch (error) {
    console.error('Error updating devolucion:', error);
    return NextResponse.json(
      { error: 'Error al actualizar la devolución' },
      { status: 500 }
    );
  }
}

// DELETE - Eliminar devolución (con cascade a NC vinculada)
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

    const devolucion = await prisma.purchaseReturn.findFirst({
      where: { id, companyId },
      include: {
        creditNotes: {
          select: {
            id: true,
            numero: true,
            numeroSerie: true,
            estado: true,
            aplicada: true,
            total: true,
            creditAllocations: {
              select: { id: true }
            }
          }
        }
      }
    });

    if (!devolucion) {
      return NextResponse.json({ error: 'Devolución no encontrada' }, { status: 404 });
    }

    // Verificar si alguna NC tiene imputaciones activas (vinculada a OP)
    const ncsConImputaciones = devolucion.creditNotes.filter(
      nc => nc.creditAllocations && nc.creditAllocations.length > 0
    );
    if (ncsConImputaciones.length > 0) {
      const numerosNCs = ncsConImputaciones.map(nc => nc.numero).join(', ');
      return NextResponse.json(
        { error: `No se puede eliminar: las siguientes NC tienen imputaciones activas (vinculadas a OP): ${numerosNCs}. Primero debe desimputarlas.` },
        { status: 400 }
      );
    }

    // Todas las NCs vinculadas se eliminarán
    const ncsToDelete = devolucion.creditNotes;
    const appliedNCs = ncsToDelete.filter(nc => nc.aplicada || nc.estado === 'APLICADA');

    // Obtener movimientos de stock para revertir
    const stockMovements = await prisma.stockMovement.findMany({
      where: { purchaseReturnId: id },
      select: {
        id: true,
        tipo: true,
        cantidad: true,
        supplierItemId: true,
        warehouseId: true
      }
    });

    let stockRevertido = false;

    await prisma.$transaction(async (tx) => {
      // Eliminar todas las NCs vinculadas y sus dependencias
      for (const nc of ncsToDelete) {
        // Eliminar movimientos de cuenta corriente vinculados a esta NC
        await tx.supplierAccountMovement.deleteMany({ where: { notaCreditoDebitoId: nc.id } });
        // Eliminar imputaciones de la NC
        await tx.supplierCreditAllocation.deleteMany({ where: { creditNoteId: nc.id } });
        await tx.supplierCreditAllocation.deleteMany({ where: { debitNoteId: nc.id } });
        // Eliminar items de la NC
        await tx.creditDebitNoteItem.deleteMany({ where: { noteId: nc.id } });
        // Eliminar la NC
        await tx.creditDebitNote.delete({ where: { id: nc.id } });
      }

      // REVERTIR STOCK: devolver las cantidades al StockLocation
      for (const mov of stockMovements) {
        if (mov.tipo === 'SALIDA_DEVOLUCION' && mov.warehouseId && mov.supplierItemId) {
          // Sumar de vuelta la cantidad al stock
          await tx.stockLocation.updateMany({
            where: {
              warehouseId: mov.warehouseId,
              supplierItemId: mov.supplierItemId
            },
            data: {
              cantidad: {
                increment: mov.cantidad
              }
            }
          });
          stockRevertido = true;
        }
      }

      // Eliminar movimientos de stock de la devolución
      await tx.stockMovement.deleteMany({ where: { purchaseReturnId: id } });
      // Eliminar items de la devolución
      await tx.purchaseReturnItem.deleteMany({ where: { returnId: id } });
      // Eliminar la devolución
      await tx.purchaseReturn.delete({ where: { id } });
    });

    // Invalidar caché de stock si se revirtió
    if (stockRevertido) {
      invalidarCacheStock(companyId);
    }

    // Registrar en auditoría
    await prisma.purchaseAuditLog.create({
      data: {
        entidad: 'purchase_return',
        entidadId: id,
        accion: 'ELIMINAR',
        datosAnteriores: {
          numero: devolucion.numero,
          estado: devolucion.estado,
          motivo: devolucion.motivo,
          ...(ncsToDelete.length > 0 && {
            ncsVinculadas: ncsToDelete.map(nc => ({
              id: nc.id,
              numero: nc.numero,
              total: nc.total.toString(),
              aplicada: nc.aplicada
            }))
          }),
          ...(stockMovements.length > 0 && {
            stockMovements: stockMovements.map(m => ({
              tipo: m.tipo,
              cantidad: m.cantidad.toString(),
              supplierItemId: m.supplierItemId,
              warehouseId: m.warehouseId
            }))
          })
        },
        datosNuevos: {
          eliminado: true,
          ...(ncsToDelete.length > 0 && { ncsEliminadas: ncsToDelete.length }),
          ...(appliedNCs.length > 0 && { ncsAplicadasRevertidas: appliedNCs.length }),
          ...(stockRevertido && { stockRevertido: true, movimientosRevertidos: stockMovements.length })
        },
        companyId,
        userId: user.id
      }
    });

    let message = 'Devolución eliminada correctamente';
    if (stockRevertido && ncsToDelete.length > 0) {
      message = `Devolución eliminada, stock revertido y ${ncsToDelete.length} NC eliminada(s)`;
    } else if (stockRevertido) {
      message = 'Devolución eliminada y stock revertido correctamente';
    } else if (ncsToDelete.length > 0 && appliedNCs.length > 0) {
      message = `Devolución, ${ncsToDelete.length} NC y movimientos de cuenta corriente eliminados`;
    } else if (ncsToDelete.length > 0) {
      message = `Devolución y ${ncsToDelete.length} NC vinculada(s) eliminadas correctamente`;
    }

    return NextResponse.json({
      message,
      ncsEliminadas: ncsToDelete.length > 0 ? ncsToDelete : null,
      movimientosCtaCteRevertidos: appliedNCs.length > 0,
      stockRevertido,
      movimientosStockRevertidos: stockRevertido ? stockMovements.length : 0
    });
  } catch (error) {
    console.error('Error deleting devolucion:', error);
    return NextResponse.json(
      { error: 'Error al eliminar la devolución' },
      { status: 500 }
    );
  }
}
