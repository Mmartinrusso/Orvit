/**
 * Cheque Detail API - O2C Phase 3
 *
 * Get cheque details and update cheque state.
 * All state changes are idempotent and validated.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getViewMode, applyViewMode } from '@/lib/view-mode';
import { requirePermission, TESORERIA_PERMISSIONS } from '@/lib/tesoreria/auth';
import { chequeStateChangeSchema } from '@/lib/tesoreria/validation-schemas';
import {
  withIdempotency,
  getIdempotencyKey,
  handleIdempotencyError,
  idempotencyHeaders,
} from '@/lib/tesoreria/idempotency-helper';

export const dynamic = 'force-dynamic';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// ═══════════════════════════════════════════════════════════════════════════════
// GET - Get cheque by ID
// ═══════════════════════════════════════════════════════════════════════════════

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { user, error } = await requirePermission(TESORERIA_PERMISSIONS.CHEQUES_VIEW);
    if (error) return error;

    const companyId = user!.companyId;

    const { id } = await params;
    const chequeId = parseInt(id);
    if (isNaN(chequeId)) {
      return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
    }

    const viewMode = getViewMode(request);

    const cheque = await prisma.cheque.findFirst({
      where: applyViewMode({ id: chequeId, companyId }, viewMode),
      include: {
        clientPayment: {
          select: {
            id: true,
            numero: true,
            client: { select: { id: true, name: true } },
          },
        },
        paymentOrder: {
          select: {
            id: true,
            numero: true,
            proveedor: { select: { id: true, name: true } },
          },
        },
        bankAccount: {
          select: { id: true, codigo: true, nombre: true, banco: true },
        },
        bankMovements: {
          select: {
            id: true,
            tipo: true,
            ingreso: true,
            egreso: true,
            fecha: true,
          },
        },
      },
    });

    if (!cheque) {
      return NextResponse.json({ error: 'Cheque no encontrado' }, { status: 404 });
    }

    return NextResponse.json(cheque);
  } catch (error) {
    console.error('Error fetching cheque:', error);
    return NextResponse.json(
      { error: 'Error al obtener el cheque' },
      { status: 500 }
    );
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// PATCH - Update cheque state
// ═══════════════════════════════════════════════════════════════════════════════

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { user, error } = await requirePermission(TESORERIA_PERMISSIONS.CHEQUES_EDIT);
    if (error) return error;

    const companyId = user!.companyId;

    const { id } = await params;
    const chequeId = parseInt(id);
    if (isNaN(chequeId)) {
      return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
    }

    // Parse and validate request body
    const rawBody = await request.json();
    const validationResult = chequeStateChangeSchema.safeParse(rawBody);

    if (!validationResult.success) {
      return NextResponse.json(
        {
          error: 'Datos de solicitud inválidos',
          details: validationResult.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const body = validationResult.data;
    const idempotencyKey = getIdempotencyKey(request);

    // Execute with idempotency
    const { response, isReplay, idempotencyKey: usedKey } = await withIdempotency(
      idempotencyKey,
      companyId,
      'UPDATE_CHEQUE',
      async () => {
        // Get current cheque
        const cheque = await prisma.cheque.findFirst({
          where: { id: chequeId, companyId },
        });

        if (!cheque) {
          throw new Error('Cheque no encontrado');
        }

        // Validate state transitions
        const transicionesValidas: Record<string, string[]> = {
          CARTERA: ['DEPOSITADO', 'ENDOSADO', 'ANULADO'],
          DEPOSITADO: ['COBRADO', 'RECHAZADO'],
          RECHAZADO: ['CARTERA'], // Can return to portfolio if negotiated
          COBRADO: [], // Final state
          ENDOSADO: [], // Final state
          ANULADO: [], // Final state
          VENCIDO: [], // Final state
        };

        // Map action to new state
        const accionEstado: Record<string, string> = {
          depositar: 'DEPOSITADO',
          cobrar: 'COBRADO',
          rechazar: 'RECHAZADO',
          endosar: 'ENDOSADO',
          anular: 'ANULADO',
          volver_cartera: 'CARTERA',
        };

        const nuevoEstado = accionEstado[body.accion];

        // Validate transition
        const estadoActual = cheque.estado;
        if (!transicionesValidas[estadoActual]?.includes(nuevoEstado)) {
          throw new Error(`No se puede cambiar de ${estadoActual} a ${nuevoEstado}`);
        }

        // Action-specific validations
        if (body.accion === 'depositar' && cheque.origen !== 'RECIBIDO') {
          throw new Error('Solo se pueden depositar cheques recibidos');
        }

        if (body.accion === 'endosar' && cheque.origen !== 'RECIBIDO') {
          throw new Error('Solo se pueden endosar cheques recibidos');
        }

        // Update in transaction
        const chequeActualizado = await prisma.$transaction(async (tx) => {
          // Prepare update data based on action
          const updateData: Record<string, unknown> = {
            estado: nuevoEstado,
          };

          if (body.accion === 'depositar') {
            updateData.depositoBankAccountId = body.bankAccountId;
            updateData.fechaDeposito = new Date();
          } else if (body.accion === 'cobrar') {
            updateData.fechaCobro = new Date();
          } else if (body.accion === 'rechazar') {
            updateData.motivoRechazo = body.motivoRechazo;
          } else if (body.accion === 'endosar') {
            updateData.endosadoA = body.endosadoA;
            updateData.endosadoPaymentOrderId = body.endosadoPaymentOrderId || null;
          }

          // Update cheque
          const updated = await tx.cheque.update({
            where: { id: chequeId },
            data: updateData,
            include: {
              bankAccount: { select: { codigo: true, nombre: true } },
            },
          });

          // Create bank movement if depositing
          if (body.accion === 'depositar') {
            const banco = await tx.bankAccount.findUnique({
              where: { id: body.bankAccountId },
            });

            if (banco) {
              // Get previous balance
              const saldoResult = await tx.bankMovement.aggregate({
                where: { bankAccountId: banco.id },
                _sum: { ingreso: true, egreso: true },
              });
              const saldoAnterior =
                Number(saldoResult._sum.ingreso || 0) - Number(saldoResult._sum.egreso || 0);

              await tx.bankMovement.create({
                data: {
                  bankAccountId: banco.id,
                  companyId,
                  tipo: 'DEPOSITO_CHEQUE',
                  chequeId: chequeId,
                  ingreso: cheque.importe,
                  egreso: 0,
                  saldoAnterior,
                  saldoPosterior: saldoAnterior + Number(cheque.importe),
                  fecha: new Date(),
                  descripcion: `Depósito cheque ${cheque.numero} - ${cheque.banco}`,
                  createdBy: user!.id,
                },
              });
            }
          }

          // Reverse deposit if rejecting a deposited check
          if (body.accion === 'rechazar' && cheque.depositoBankAccountId) {
            const banco = await tx.bankAccount.findUnique({
              where: { id: cheque.depositoBankAccountId },
            });

            if (banco) {
              const saldoResult = await tx.bankMovement.aggregate({
                where: { bankAccountId: banco.id },
                _sum: { ingreso: true, egreso: true },
              });
              const saldoAnterior =
                Number(saldoResult._sum.ingreso || 0) - Number(saldoResult._sum.egreso || 0);

              await tx.bankMovement.create({
                data: {
                  bankAccountId: banco.id,
                  companyId,
                  tipo: 'DEBITO_CHEQUE',
                  chequeId: chequeId,
                  ingreso: 0,
                  egreso: cheque.importe,
                  saldoAnterior,
                  saldoPosterior: saldoAnterior - Number(cheque.importe),
                  fecha: new Date(),
                  descripcion: `Rechazo cheque ${cheque.numero} - ${body.motivoRechazo}`,
                  createdBy: user!.id,
                },
              });
            }
          }

          return updated;
        });

        return { success: true, cheque: chequeActualizado };
      },
      {
        entityType: 'Cheque',
        getEntityId: () => chequeId,
      }
    );

    return NextResponse.json(response, {
      headers: idempotencyHeaders(usedKey, isReplay),
    });
  } catch (error) {
    // Handle idempotency errors
    const idempotencyError = handleIdempotencyError(error);
    if (idempotencyError) return idempotencyError;

    console.error('Error updating cheque:', error);
    const message =
      error instanceof Error ? error.message : 'Error al actualizar el cheque';

    // Return 422 for business logic errors
    const status =
      message.includes('No se puede') ||
      message.includes('Solo se pueden') ||
      message.includes('no encontrado')
        ? 422
        : 500;

    return NextResponse.json({ error: message }, { status });
  }
}
