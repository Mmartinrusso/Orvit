import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';
import { prisma } from '@/lib/prisma';
import { JWT_SECRET } from '@/lib/auth';
import { Decimal } from '@prisma/client/runtime/library';

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

/**
 * POST - Anular Nota de Crédito/Débito
 *
 * COMPORTAMIENTO:
 * - Si estado = PENDIENTE o APROBADA (no aplicada):
 *   - Solo cambia estado a ANULADA
 *   - No afecta cuenta corriente
 *
 * - Si estado = APLICADA (ya afectó cuenta corriente):
 *   - Crea SupplierAccountMovement inverso
 *   - NCA anulada → movimiento DEBE (aumenta deuda)
 *   - NDA anulada → movimiento HABER (reduce deuda)
 *   - Cambia estado a ANULADA
 *
 * - Si es NCA_DEVOLUCION con PurchaseReturn vinculado:
 *   - El PurchaseReturn queda sin NCA (puede asignarse otra)
 *   - El stock NO se revierte (ya salió físicamente)
 */
export async function POST(
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

    // Leer body con motivo de anulación
    let anulacionData: {
      motivo?: string;
    } = {};

    try {
      const body = await request.json();
      anulacionData = {
        ...(body.motivo && { motivo: body.motivo }),
      };
    } catch {
      // Body vacío, continuar sin motivo
    }

    if (!anulacionData.motivo) {
      return NextResponse.json(
        { error: 'Debe proporcionar un motivo para la anulación' },
        { status: 400 }
      );
    }

    // Ejecutar todo en una transacción
    const resultado = await prisma.$transaction(async (tx) => {
      // 1. Obtener nota con relaciones
      const nota = await tx.creditDebitNote.findFirst({
        where: { id, companyId },
        include: {
          proveedor: { select: { id: true, name: true } },
          accountMovements: true, // Movimientos de Cta Cte generados
          purchaseReturn: {
            select: { id: true, numero: true, estado: true }
          },
          creditAllocations: true // Imputaciones realizadas
        }
      });

      if (!nota) {
        throw new Error('Nota no encontrada');
      }

      // 2. Validar estado - no se puede anular una ya anulada
      if (nota.estado === 'ANULADA') {
        throw new Error('La nota ya está anulada');
      }

      // 3. Verificar si hay imputaciones (SupplierCreditAllocation)
      if (nota.creditAllocations && nota.creditAllocations.length > 0) {
        // Por ahora, no permitir anular si tiene imputaciones
        // En V2 se podría revertir las imputaciones también
        throw new Error(
          'No se puede anular una nota con imputaciones activas. ' +
          `Tiene ${nota.creditAllocations.length} imputación(es) a facturas/NDAs.`
        );
      }

      const yaAfectoCtaCte = nota.aplicada &&
        nota.accountMovements && nota.accountMovements.length > 0;

      let movimientoReversa = null;

      // 4. Si ya afectó cuenta corriente, crear movimiento inverso
      if (yaAfectoCtaCte) {
        // Movimiento inverso (AJUSTE para anulación)
        // NCA anulada → DEBE (aumenta deuda)
        // NDA anulada → HABER (reduce deuda)
        const montoTotal = new Decimal(nota.total.toString());

        movimientoReversa = await tx.supplierAccountMovement.create({
          data: {
            supplierId: nota.proveedorId,
            tipo: 'AJUSTE',
            notaCreditoDebitoId: nota.id,
            debe: nota.tipo === 'NOTA_CREDITO' ? montoTotal : new Decimal(0),
            haber: nota.tipo === 'NOTA_DEBITO' ? montoTotal : new Decimal(0),
            saldoMovimiento: new Decimal(0), // Se actualizará al recalcular saldo
            fecha: new Date(),
            descripcion: `ANULACIÓN: ${nota.tipo === 'NOTA_CREDITO' ? 'NC' : 'ND'} ${nota.numero} - ${anulacionData.motivo}`,
            comprobante: `ANUL-${nota.numero}`,
            docType: nota.docType,
            companyId,
          }
        });
      }

      // 5. Actualizar estado de la nota
      const notaAnulada = await tx.creditDebitNote.update({
        where: { id },
        data: {
          estado: 'ANULADA',
          notas: nota.notas
            ? `${nota.notas}\n[${new Date().toISOString()}] ANULADA: ${anulacionData.motivo}`
            : `[${new Date().toISOString()}] ANULADA: ${anulacionData.motivo}`,
        }
      });

      // 6. Registrar en auditoría
      await tx.purchaseAuditLog.create({
        data: {
          entidad: 'credit_debit_note',
          entidadId: id,
          accion: 'ANULAR',
          datosAnteriores: {
            estado: nota.estado,
            aplicada: nota.aplicada,
            total: nota.total.toString()
          },
          datosNuevos: {
            estado: 'ANULADA',
            motivoAnulacion: anulacionData.motivo,
            ctaCteRevertida: yaAfectoCtaCte,
            movimientoReversaId: movimientoReversa?.id,
            purchaseReturnId: nota.purchaseReturnId
          },
          companyId,
          userId: user.id,
          docType: nota.docType
        }
      });

      return {
        notaId: id,
        numero: nota.numero,
        tipo: nota.tipo,
        estadoAnterior: nota.estado,
        ctaCteRevertida: yaAfectoCtaCte,
        movimientoReversaCreado: !!movimientoReversa,
        purchaseReturn: nota.purchaseReturn
          ? {
              id: nota.purchaseReturn.id,
              numero: nota.purchaseReturn.numero,
              nota: 'La devolución queda sin NCA asociada. Puede vincular otra NCA.'
            }
          : null
      };
    });

    // Obtener nota actualizada para respuesta
    const notaAnulada = await prisma.creditDebitNote.findUnique({
      where: { id },
      include: {
        proveedor: { select: { id: true, name: true } },
        factura: { select: { id: true, numeroSerie: true, numeroFactura: true } },
        purchaseReturn: {
          select: { id: true, numero: true, estado: true }
        },
        items: true
      }
    });

    const mensajeCtaCte = resultado.ctaCteRevertida
      ? ' Se creó movimiento inverso en cuenta corriente.'
      : '';

    const mensajePR = resultado.purchaseReturn
      ? ` La devolución ${resultado.purchaseReturn.numero} queda sin NCA asociada.`
      : '';

    return NextResponse.json({
      success: true,
      message: `Nota ${resultado.tipo === 'NOTA_CREDITO' ? 'de crédito' : 'de débito'} anulada.${mensajeCtaCte}${mensajePR}`,
      nota: notaAnulada,
      resumen: resultado
    });
  } catch (error: any) {
    console.error('Error anulando nota:', error);
    return NextResponse.json(
      { error: error.message || 'Error al anular la nota' },
      { status: error.message?.includes('no encontrada') ? 404 : 400 }
    );
  }
}
