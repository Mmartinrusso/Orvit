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
 * POST - Aplicar Nota de Crédito/Débito
 *
 * COMPORTAMIENTO:
 * - Valida que el estado permite aplicación (EMITIDA o APROBADA)
 * - Crea SupplierAccountMovement en la cuenta corriente del proveedor
 *   - NCA → HABER (reduce deuda)
 *   - NDA → DEBE (aumenta deuda)
 * - Opcionalmente acepta allocations para imputar a facturas/NDAs específicas
 * - Marca la nota como aplicada = true
 *
 * Body esperado:
 * {
 *   allocations?: [
 *     { receiptId?: number, debitNoteId?: number, amount: number }
 *   ]
 * }
 *
 * Si no se envían allocations, la nota queda como saldo a favor/en contra sin imputar.
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

    // Leer body con imputaciones opcionales
    interface AllocationInput {
      receiptId?: number;
      debitNoteId?: number;
      amount: number;
      currency?: string;
      fxRate?: number;
    }

    let aplicacionData: {
      allocations?: AllocationInput[];
      notas?: string;
    } = {};

    try {
      const body = await request.json();
      aplicacionData = {
        ...(body.allocations && { allocations: body.allocations }),
        ...(body.notas && { notas: body.notas }),
      };
    } catch {
      // Body vacío, aplicar sin imputaciones
    }

    // Ejecutar todo en una transacción
    const resultado = await prisma.$transaction(async (tx) => {
      // 1. Obtener nota
      const nota = await tx.creditDebitNote.findFirst({
        where: { id, companyId },
        include: {
          proveedor: { select: { id: true, name: true } },
          creditAllocations: true // Imputaciones existentes
        }
      });

      if (!nota) {
        throw new Error('Nota no encontrada');
      }

      // 2. Validar estado
      const estadosPermitidos = ['EMITIDA', 'APROBADA', 'PENDIENTE'];
      if (!estadosPermitidos.includes(nota.estado)) {
        throw new Error(
          `No se puede aplicar una nota en estado ${nota.estado}. ` +
          `Estados permitidos: ${estadosPermitidos.join(', ')}`
        );
      }

      if (nota.aplicada) {
        throw new Error('Esta nota ya fue aplicada anteriormente');
      }

      // 3. Validar allocations si se proporcionaron
      const allocationRecords: any[] = [];
      let totalImputado = new Decimal(0);

      if (aplicacionData.allocations && aplicacionData.allocations.length > 0) {
        // Solo NCAs pueden tener imputaciones (aplicar crédito a facturas/NDAs)
        if (nota.tipo !== 'NOTA_CREDITO') {
          throw new Error(
            'Solo las notas de crédito pueden imputarse a facturas o notas de débito. ' +
            'Las notas de débito se aplican directamente a la cuenta corriente.'
          );
        }

        for (const alloc of aplicacionData.allocations) {
          if (!alloc.amount || alloc.amount <= 0) {
            throw new Error('Cada imputación debe tener un monto positivo');
          }

          if (!alloc.receiptId && !alloc.debitNoteId) {
            throw new Error(
              'Cada imputación debe especificar receiptId (factura) o debitNoteId (nota de débito)'
            );
          }

          if (alloc.receiptId && alloc.debitNoteId) {
            throw new Error(
              'Cada imputación debe ser a UNA factura O a UNA nota de débito, no ambas'
            );
          }

          // Validar que el documento destino existe y es del mismo proveedor
          if (alloc.receiptId) {
            const factura = await tx.purchaseReceipt.findFirst({
              where: {
                id: alloc.receiptId,
                companyId,
                proveedorId: nota.proveedorId
              },
              select: { id: true, numeroSerie: true, numeroFactura: true, total: true }
            });

            if (!factura) {
              throw new Error(`Factura ID ${alloc.receiptId} no encontrada o no pertenece al mismo proveedor`);
            }

            // Verificar que no se duplique la imputación
            const imputacionExistente = await tx.supplierCreditAllocation.findFirst({
              where: {
                creditNoteId: id,
                receiptId: alloc.receiptId
              }
            });

            if (imputacionExistente) {
              throw new Error(`Ya existe una imputación a la factura ${factura.numeroSerie}-${factura.numeroFactura}`);
            }

            // Calcular saldo pendiente de la factura
            // Saldo = Total - Pagos aplicados - NCAs ya aplicadas
            const pagosAplicados = await tx.paymentOrderReceipt.aggregate({
              where: { receiptId: alloc.receiptId },
              _sum: { montoAplicado: true }
            });

            const ncasAplicadas = await tx.supplierCreditAllocation.aggregate({
              where: {
                receiptId: alloc.receiptId,
                creditNote: { aplicada: true }
              },
              _sum: { amount: true }
            });

            const totalFactura = new Decimal(factura.total?.toString() || '0');
            const totalPagado = new Decimal(pagosAplicados._sum.montoAplicado?.toString() || '0');
            const totalNCAsAplicadas = new Decimal(ncasAplicadas._sum.amount?.toString() || '0');
            const saldoPendiente = totalFactura.sub(totalPagado).sub(totalNCAsAplicadas);

            if (new Decimal(alloc.amount).gt(saldoPendiente)) {
              throw new Error(
                `No se puede imputar $${alloc.amount} a la factura ${factura.numeroSerie}-${factura.numeroFactura}. ` +
                `Saldo pendiente: $${saldoPendiente.toFixed(2)} ` +
                `(Total: $${totalFactura.toFixed(2)}, Pagado: $${totalPagado.toFixed(2)}, NCAs: $${totalNCAsAplicadas.toFixed(2)})`
              );
            }
          }

          if (alloc.debitNoteId) {
            const nda = await tx.creditDebitNote.findFirst({
              where: {
                id: alloc.debitNoteId,
                companyId,
                proveedorId: nota.proveedorId,
                tipo: 'NOTA_DEBITO'
              },
              select: { id: true, numero: true, total: true }
            });

            if (!nda) {
              throw new Error(`Nota de débito ID ${alloc.debitNoteId} no encontrada o no pertenece al mismo proveedor`);
            }

            // Verificar que no se duplique la imputación
            const imputacionExistente = await tx.supplierCreditAllocation.findFirst({
              where: {
                creditNoteId: id,
                debitNoteId: alloc.debitNoteId
              }
            });

            if (imputacionExistente) {
              throw new Error(`Ya existe una imputación a la nota de débito ${nda.numero}`);
            }
          }

          totalImputado = totalImputado.add(new Decimal(alloc.amount));

          allocationRecords.push({
            creditNoteId: id,
            receiptId: alloc.receiptId || null,
            debitNoteId: alloc.debitNoteId || null,
            tipoImputacion: alloc.receiptId ? 'FACTURA' : 'NDA',
            amount: new Decimal(alloc.amount),
            currency: alloc.currency || 'ARS',
            fxRate: alloc.fxRate ? new Decimal(alloc.fxRate) : null,
            amountBase: alloc.fxRate
              ? new Decimal(alloc.amount).mul(new Decimal(alloc.fxRate))
              : null,
          });
        }

        // Validar que el total imputado no excede el total de la nota
        if (totalImputado.gt(new Decimal(nota.total.toString()))) {
          throw new Error(
            `El total imputado ($${totalImputado.toFixed(2)}) excede el total de la nota ($${nota.total})`
          );
        }
      }

      // 4. Crear imputaciones si hay
      if (allocationRecords.length > 0) {
        await tx.supplierCreditAllocation.createMany({
          data: allocationRecords
        });
      }

      // 5. Crear movimiento en cuenta corriente
      // NCA → HABER (reduce deuda), NDA → DEBE (aumenta deuda)
      const tipoMovimiento = nota.tipo === 'NOTA_CREDITO' ? 'NC' : 'ND';
      const montoTotal = new Decimal(nota.total.toString());

      const accountMovement = await tx.supplierAccountMovement.create({
        data: {
          supplierId: nota.proveedorId,
          tipo: tipoMovimiento,
          notaCreditoDebitoId: nota.id,
          debe: nota.tipo === 'NOTA_DEBITO' ? montoTotal : new Decimal(0),
          haber: nota.tipo === 'NOTA_CREDITO' ? montoTotal : new Decimal(0),
          saldoMovimiento: new Decimal(0), // Se recalcula después
          fecha: new Date(),
          descripcion: `${nota.tipo === 'NOTA_CREDITO' ? 'NC' : 'ND'} ${nota.numero} - ${nota.motivo}`,
          comprobante: nota.numero,
          docType: nota.docType,
          companyId,
        }
      });

      // 6. Actualizar estado de la nota
      const notaActualizada = await tx.creditDebitNote.update({
        where: { id },
        data: {
          estado: 'APLICADA',
          aplicada: true,
          aplicadaAt: new Date(),
          notas: nota.notas
            ? `${nota.notas}\n[${new Date().toISOString()}] Aplicada. ${aplicacionData.notas || ''}`
            : `[${new Date().toISOString()}] Aplicada. ${aplicacionData.notas || ''}`,
        }
      });

      // 7. Si es NCA_DEVOLUCION, actualizar el PurchaseReturn a RESUELTA
      if (nota.tipoNca === 'NCA_DEVOLUCION' && nota.purchaseReturnId) {
        await tx.purchaseReturn.update({
          where: { id: nota.purchaseReturnId },
          data: {
            estado: 'RESUELTA',
            fechaResolucion: new Date(),
            resolucion: `NCA aplicada: ${nota.numero}`,
          }
        });
      }

      // 8. Registrar en auditoría
      await tx.purchaseAuditLog.create({
        data: {
          entidad: 'credit_debit_note',
          entidadId: id,
          accion: 'APLICAR',
          datosAnteriores: {
            estado: nota.estado,
            aplicada: false
          },
          datosNuevos: {
            estado: 'APLICADA',
            aplicada: true,
            movimientoCtaCteId: accountMovement.id,
            imputaciones: allocationRecords.length,
            totalImputado: totalImputado.toNumber()
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
        total: nota.total.toString(),
        movimientoCtaCte: {
          id: accountMovement.id,
          tipo: tipoMovimiento,
          monto: nota.total.toString()
        },
        imputaciones: {
          cantidad: allocationRecords.length,
          totalImputado: totalImputado.toNumber(),
          saldoSinImputar: new Decimal(nota.total.toString()).sub(totalImputado).toNumber()
        }
      };
    });

    // Obtener nota actualizada para respuesta
    const notaAplicada = await prisma.creditDebitNote.findUnique({
      where: { id },
      include: {
        proveedor: { select: { id: true, name: true } },
        factura: { select: { id: true, numeroSerie: true, numeroFactura: true } },
        purchaseReturn: {
          select: { id: true, numero: true, estado: true }
        },
        creditAllocations: {
          include: {
            receipt: { select: { id: true, numeroSerie: true, numeroFactura: true } },
            targetDebitNote: { select: { id: true, numero: true } }
          }
        },
        items: true
      }
    });

    const tipoNota = resultado.tipo === 'NOTA_CREDITO' ? 'de crédito' : 'de débito';
    let mensaje = `Nota ${tipoNota} aplicada correctamente a la cuenta corriente.`;

    if (resultado.imputaciones.cantidad > 0) {
      mensaje += ` Imputada a ${resultado.imputaciones.cantidad} documento(s) ` +
                 `por $${resultado.imputaciones.totalImputado.toFixed(2)}.`;
      if (resultado.imputaciones.saldoSinImputar > 0) {
        mensaje += ` Saldo a favor sin imputar: $${resultado.imputaciones.saldoSinImputar.toFixed(2)}.`;
      }
    }

    return NextResponse.json({
      success: true,
      message: mensaje,
      nota: notaAplicada,
      resumen: resultado
    });
  } catch (error: any) {
    console.error('Error aplicando nota:', error);
    return NextResponse.json(
      { error: error.message || 'Error al aplicar la nota' },
      { status: error.message?.includes('no encontrada') ? 404 : 400 }
    );
  }
}
