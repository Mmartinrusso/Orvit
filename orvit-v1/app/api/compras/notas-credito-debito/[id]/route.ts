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

// GET - Obtener nota por ID
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

    const nota = await prisma.creditDebitNote.findFirst({
      where: { id, companyId },
      include: {
        proveedor: {
          select: { id: true, name: true, cuit: true, razon_social: true }
        },
        factura: {
          select: {
            id: true,
            numeroSerie: true,
            numeroFactura: true,
            total: true,
            fechaEmision: true
          }
        },
        purchaseReturn: {
          select: { id: true, numero: true, estado: true }
        },
        createdByUser: { select: { id: true, name: true } },
        items: {
          include: {
            supplierItem: { select: { id: true, nombre: true, unidad: true } }
          }
        }
      }
    });

    if (!nota) {
      return NextResponse.json({ error: 'Nota no encontrada' }, { status: 404 });
    }

    return NextResponse.json(nota);
  } catch (error) {
    console.error('Error fetching nota:', error);
    return NextResponse.json(
      { error: 'Error al obtener la nota' },
      { status: 500 }
    );
  }
}

// PUT - Actualizar nota o cambiar estado
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

    const nota = await prisma.creditDebitNote.findFirst({
      where: { id, companyId }
    });

    if (!nota) {
      return NextResponse.json({ error: 'Nota no encontrada' }, { status: 404 });
    }

    const body = await request.json();
    const { accion, motivo, notas, facturaId, items } = body;

    // Acciones de workflow
    if (accion) {
      let updateData: any = {};

      switch (accion) {
        case 'aprobar':
          if (nota.estado !== 'PENDIENTE') {
            return NextResponse.json(
              { error: 'Solo se pueden aprobar notas pendientes' },
              { status: 400 }
            );
          }
          updateData.estado = 'APROBADA';
          break;

        case 'rechazar':
          if (nota.estado !== 'PENDIENTE') {
            return NextResponse.json(
              { error: 'Solo se pueden rechazar notas pendientes' },
              { status: 400 }
            );
          }
          updateData.estado = 'RECHAZADA';
          updateData.notas = `${nota.notas || ''}\n[RECHAZADO] ${motivo || 'Sin motivo'}`.trim();
          break;

        case 'aplicar':
          if (nota.estado !== 'APROBADA') {
            return NextResponse.json(
              { error: 'Solo se pueden aplicar notas aprobadas' },
              { status: 400 }
            );
          }

          // Si es nota de crédito, afecta la cuenta corriente del proveedor
          // Si es nota de débito, también
          // Aquí se podría integrar con el sistema contable

          updateData.estado = 'APLICADA';
          updateData.aplicada = true;
          updateData.aplicadaAt = new Date();
          break;

        case 'anular':
          if (['ANULADA', 'APLICADA'].includes(nota.estado)) {
            return NextResponse.json(
              { error: 'No se puede anular una nota ya anulada o aplicada' },
              { status: 400 }
            );
          }
          updateData.estado = 'ANULADA';
          updateData.notas = `${nota.notas || ''}\n[ANULADO] ${motivo || 'Sin motivo'}`.trim();
          break;

        default:
          return NextResponse.json({ error: 'Acción no válida' }, { status: 400 });
      }

      const notaActualizada = await prisma.creditDebitNote.update({
        where: { id },
        data: updateData,
        include: {
          proveedor: { select: { id: true, name: true } },
          factura: { select: { id: true, numero_factura: true } }
        }
      });

      // Registrar en auditoría
      await prisma.purchaseAuditLog.create({
        data: {
          entidad: 'credit_debit_note',
          entidadId: id,
          accion: accion.toUpperCase(),
          datosAnteriores: { estado: nota.estado },
          datosNuevos: { estado: notaActualizada.estado },
          companyId,
          userId: user.id
        }
      });

      return NextResponse.json({
        message: `Nota ${accion} correctamente`,
        nota: notaActualizada
      });
    }

    // Actualización normal (solo si está pendiente)
    if (nota.estado !== 'PENDIENTE') {
      return NextResponse.json(
        { error: `No se puede editar una nota en estado ${nota.estado}` },
        { status: 400 }
      );
    }

    let updateData: any = {
      ...(motivo && { motivo }),
      ...(notas !== undefined && { notas }),
      ...(facturaId !== undefined && { facturaId: facturaId ? parseInt(facturaId) : null }),
    };

    // Si hay items, recalcular
    if (items && Array.isArray(items)) {
      const { neto, iva21, iva105, iva27 } = body;
      const netoDecimal = parseFloat(neto || nota.neto.toString());
      const iva21Decimal = parseFloat(iva21 || nota.iva21.toString());
      const iva105Decimal = parseFloat(iva105 || nota.iva105.toString());
      const iva27Decimal = parseFloat(iva27 || nota.iva27.toString());
      const total = netoDecimal + iva21Decimal + iva105Decimal + iva27Decimal;

      updateData = {
        ...updateData,
        neto: netoDecimal,
        iva21: iva21Decimal,
        iva105: iva105Decimal,
        iva27: iva27Decimal,
        total
      };

      await prisma.$transaction(async (tx) => {
        await tx.creditDebitNoteItem.deleteMany({
          where: { noteId: id }
        });

        await tx.creditDebitNoteItem.createMany({
          data: items.map((item: any) => ({
            noteId: id,
            supplierItemId: item.supplierItemId ? parseInt(item.supplierItemId) : null,
            descripcion: item.descripcion || '',
            cantidad: parseFloat(item.cantidad || '1'),
            unidad: item.unidad || 'UN',
            precioUnitario: parseFloat(item.precioUnitario || '0'),
            subtotal: parseFloat(item.subtotal || '0')
          }))
        });

        await tx.creditDebitNote.update({
          where: { id },
          data: updateData
        });
      });
    } else {
      await prisma.creditDebitNote.update({
        where: { id },
        data: updateData
      });
    }

    const notaActualizada = await prisma.creditDebitNote.findUnique({
      where: { id },
      include: {
        proveedor: { select: { id: true, name: true } },
        factura: { select: { id: true, numero_factura: true } },
        items: true
      }
    });

    return NextResponse.json(notaActualizada);
  } catch (error) {
    console.error('Error updating nota:', error);
    return NextResponse.json(
      { error: 'Error al actualizar la nota' },
      { status: 500 }
    );
  }
}

// DELETE - Eliminar nota (con cascade a devolución si tiene vinculada)
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

    const nota = await prisma.creditDebitNote.findFirst({
      where: { id, companyId },
      include: {
        purchaseReturn: {
          select: { id: true, numero: true, estado: true }
        },
        creditAllocations: {
          select: { id: true, amount: true, receiptId: true, debitNoteId: true }
        }
      }
    });

    if (!nota) {
      return NextResponse.json({ error: 'Nota no encontrada' }, { status: 404 });
    }

    // Verificar si tiene imputaciones activas (vinculada a OP)
    if (nota.creditAllocations && nota.creditAllocations.length > 0) {
      return NextResponse.json(
        { error: 'No se puede eliminar: esta NC tiene imputaciones activas (está vinculada a una OP). Primero debe desimputarla.' },
        { status: 400 }
      );
    }

    // Determinar si hay devolución vinculada que también se eliminará
    const linkedReturn = nota.purchaseReturnId ? nota.purchaseReturn : null;
    const hasLinkedReturn = !!linkedReturn;
    const wasAplicada = nota.aplicada || nota.estado === 'APLICADA';

    await prisma.$transaction(async (tx) => {
      // Si hay devolución vinculada, eliminarla también (cascade)
      if (hasLinkedReturn && linkedReturn) {
        // Eliminar items de la devolución
        await tx.purchaseReturnItem.deleteMany({ where: { returnId: linkedReturn.id } });
        // Eliminar movimientos de stock si existen
        await tx.stockMovement.deleteMany({ where: { purchaseReturnId: linkedReturn.id } });
        // Eliminar la devolución
        await tx.purchaseReturn.delete({ where: { id: linkedReturn.id } });
      }

      // Eliminar movimientos de cuenta corriente vinculados a esta NC
      await tx.supplierAccountMovement.deleteMany({ where: { notaCreditoDebitoId: id } });

      // Eliminar imputaciones si existen
      await tx.supplierCreditAllocation.deleteMany({ where: { creditNoteId: id } });
      // También eliminar imputaciones donde esta NC recibió créditos (si es NDA)
      await tx.supplierCreditAllocation.deleteMany({ where: { debitNoteId: id } });

      // Eliminar items de la nota
      await tx.creditDebitNoteItem.deleteMany({ where: { noteId: id } });

      // Eliminar nota
      await tx.creditDebitNote.delete({ where: { id } });
    });

    // Registrar en auditoría
    await prisma.purchaseAuditLog.create({
      data: {
        entidad: 'credit_debit_note',
        entidadId: id,
        accion: 'ELIMINAR',
        datosAnteriores: {
          numero: nota.numero,
          numeroSerie: nota.numeroSerie,
          tipo: nota.tipo,
          total: nota.total.toString(),
          estado: nota.estado,
          aplicada: nota.aplicada,
          ...(hasLinkedReturn && linkedReturn && {
            devolucionVinculada: {
              id: linkedReturn.id,
              numero: linkedReturn.numero,
              estado: linkedReturn.estado
            }
          })
        },
        datosNuevos: {
          eliminado: true,
          movimientosCtaCteRevertidos: wasAplicada,
          ...(hasLinkedReturn && { devolucionEliminada: true })
        },
        companyId,
        userId: user.id
      }
    });

    let message = 'Nota eliminada correctamente';
    if (hasLinkedReturn && wasAplicada) {
      message = `Nota, devolución ${linkedReturn?.numero} y movimientos de cuenta corriente eliminados`;
    } else if (hasLinkedReturn) {
      message = `Nota y devolución ${linkedReturn?.numero} eliminadas correctamente`;
    } else if (wasAplicada) {
      message = 'Nota y movimientos de cuenta corriente eliminados';
    }

    return NextResponse.json({
      message,
      devolucionEliminada: hasLinkedReturn ? linkedReturn : null,
      movimientosRevertidos: wasAplicada
    });
  } catch (error) {
    console.error('Error deleting nota:', error);
    return NextResponse.json(
      { error: 'Error al eliminar la nota' },
      { status: 500 }
    );
  }
}
