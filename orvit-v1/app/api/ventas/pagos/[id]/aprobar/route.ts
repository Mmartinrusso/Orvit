/**
 * Payment Approval/Rejection API
 *
 * Handles approval workflow for client payments:
 * - PENDIENTE → CONFIRMADO (approval)
 * - PENDIENTE → RECHAZADO (rejection)
 */

import { NextRequest, NextResponse } from 'next/server';
import { requirePermission, VENTAS_PERMISSIONS } from '@/lib/ventas/auth';
import { approveClientPayment, rejectClientPayment } from '@/lib/ventas/payment-service';
import { logSalesStatusChange } from '@/lib/ventas/audit-helper';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

interface RouteParams {
  params: Promise<{ id: string }>;
}

const approvalSchema = z.object({
  accion: z.enum(['aprobar', 'rechazar']),
  motivo: z.string().optional(),
  notas: z.string().optional(),
});

// ═══════════════════════════════════════════════════════════════════════════════
// POST - Approve or reject payment
// ═══════════════════════════════════════════════════════════════════════════════

export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    // Require payment application permission
    const { user, error } = await requirePermission(VENTAS_PERMISSIONS.PAGOS_APPLY);
    if (error) return error;

    const { id } = await params;
    const paymentId = parseInt(id);

    if (!paymentId || isNaN(paymentId)) {
      return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
    }

    // Parse request body
    const rawBody = await req.json();
    const validationResult = approvalSchema.safeParse(rawBody);

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

    // Fetch payment
    const payment = await prisma.clientPayment.findFirst({
      where: { id: paymentId, companyId: user!.companyId },
      include: { client: { select: { legalName: true } } },
    });

    if (!payment) {
      return NextResponse.json({ error: 'Pago no encontrado' }, { status: 404 });
    }

    if (payment.estado !== 'PENDIENTE') {
      return NextResponse.json(
        {
          error: `El pago ya está ${payment.estado}. Solo se pueden aprobar/rechazar pagos PENDIENTES.`,
        },
        { status: 422 }
      );
    }

    // Execute action
    if (body.accion === 'aprobar') {
      await approveClientPayment(paymentId, user!.id, body.notas);

      // Audit log
      await logSalesStatusChange({
        entidad: 'client_payment',
        entidadId: paymentId,
        estadoAnterior: 'PENDIENTE',
        estadoNuevo: 'CONFIRMADO',
        companyId: user!.companyId,
        userId: user!.id,
        notas: body.notas,
      });

      return NextResponse.json({
        success: true,
        message: `Pago ${payment.numero} aprobado. Se actualizó la cuenta corriente del cliente.`,
      });
    } else {
      const motivo = body.motivo || 'Sin especificar';
      await rejectClientPayment(paymentId, motivo, user!.id);

      // Audit log
      await logSalesStatusChange({
        entidad: 'client_payment',
        entidadId: paymentId,
        estadoAnterior: 'PENDIENTE',
        estadoNuevo: 'RECHAZADO',
        companyId: user!.companyId,
        userId: user!.id,
        notas: motivo,
      });

      return NextResponse.json({
        success: true,
        message: `Pago ${payment.numero} rechazado. No afecta la cuenta corriente.`,
      });
    }
  } catch (error) {
    console.error('Error in payment approval:', error);

    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json(
      { error: 'Error al procesar solicitud de aprobación' },
      { status: 500 }
    );
  }
}
