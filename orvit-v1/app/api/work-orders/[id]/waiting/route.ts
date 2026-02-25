/**
 * API: /api/work-orders/[id]/waiting
 *
 * POST - Poner orden de trabajo en estado de espera (EN_ESPERA_*)
 *        Motivo + ETA obligatorios
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

/**
 * Schema de validación para waiting
 */
const waitingSchema = z.object({
  waitingReason: z.enum([
    'SPARE_PART',      // Esperando repuesto
    'VENDOR',          // Esperando proveedor/tercero
    'PRODUCTION',      // Esperando ventana de producción
    'APPROVAL',        // Esperando aprobación
    'RESOURCES',       // Falta de recursos (personal, herramientas)
    'OTHER'            // Otro motivo
  ], { required_error: 'waitingReason es obligatorio' }),

  waitingDescription: z.string()
    .min(10, 'waitingDescription debe tener al menos 10 caracteres')
    .max(500),

  waitingETA: z.string()
    .datetime('waitingETA debe ser una fecha válida (ISO 8601)')
    .refine((dateStr) => {
      const date = new Date(dateStr);
      return date > new Date();
    }, { message: 'waitingETA debe ser una fecha futura' }),
});

/**
 * POST /api/work-orders/[id]/waiting
 * Pone una orden de trabajo en estado de espera
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // 1. Verificar autenticación
    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;

    if (!token) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }

    const payload = await verifyToken(token);
    if (!payload || !payload.companyId || !payload.userId) {
      return NextResponse.json({ error: 'Token inválido' }, { status: 401 });
    }

    const companyId = payload.companyId as number;
    const userId = payload.userId as number;
    const workOrderId = parseInt(params.id);

    if (isNaN(workOrderId)) {
      return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
    }

    // 2. Parsear y validar body
    const body = await request.json();
    const validationResult = waitingSchema.safeParse(body);

    if (!validationResult.success) {
      const errors = validationResult.error.errors.map(e =>
        `${e.path.join('.')}: ${e.message}`
      ).join(', ');

      return NextResponse.json(
        { error: `Validación falló: ${errors}` },
        { status: 400 }
      );
    }

    const { waitingReason, waitingDescription, waitingETA } = validationResult.data;

    // ✅ TRANSACCIÓN: Cambiar estado a waiting es crítico
    const result = await prisma.$transaction(async (tx) => {
      // 3. Verificar que la orden existe y pertenece a la empresa
      const workOrder = await tx.workOrder.findUnique({
        where: { id: workOrderId },
        include: {
          assignedTo: { select: { id: true, name: true } }
        }
      });

      if (!workOrder || workOrder.companyId !== companyId) {
        throw new Error('Orden de trabajo no encontrada');
      }

      // 4. Validaciones de negocio
      if (workOrder.status === 'COMPLETED' || workOrder.status === 'CANCELLED') {
        throw new Error(`No se puede poner en espera una orden ${workOrder.status}`);
      }

      if (workOrder.waitingReason) {
        throw new Error('La orden ya está en estado de espera. Use PATCH para actualizar motivo/ETA.');
      }

      // 5. Actualizar estado a WAITING
      const updatedWorkOrder = await tx.workOrder.update({
        where: { id: workOrderId },
        data: {
          status: 'WAITING', // Cambiar estado
          waitingReason,
          waitingDescription,
          waitingETA: new Date(waitingETA),
          waitingSince: new Date(),
          // Agregar nota en el historial
          notes: workOrder.notes
            ? `${workOrder.notes}\n\n[${new Date().toISOString()}] Puesta en espera: ${waitingDescription}`
            : `[${new Date().toISOString()}] Puesta en espera: ${waitingDescription}`
        },
        include: {
          assignedTo: { select: { id: true, name: true } },
          failureOccurrences: {
            select: {
              id: true,
              title: true,
              status: true,
              machine: { select: { id: true, name: true } }
            }
          }
        }
      });

      // 6. Crear registro de WorkLog (si existe la tabla)
      try {
        await tx.workLog.create({
          data: {
            workOrderId,
            performedById: userId,
            performedByType: 'USER',
            startedAt: new Date(),
            endedAt: new Date(),
            description: `Orden puesta en espera: ${waitingReason} - ${waitingDescription}`,
            activityType: 'WAITING'
          }
        });
      } catch (error) {
        // Si WorkLog no existe, no es crítico
        console.warn('WorkLog table might not exist yet:', error);
      }

      return updatedWorkOrder;
    });

    // 7. Retornar resultado
    return NextResponse.json({
      success: true,
      message: `Orden #${workOrderId} puesta en espera hasta ${waitingETA}`,
      data: result
    }, { status: 200 });

  } catch (error: any) {
    console.error('❌ Error en POST /api/work-orders/[id]/waiting:', error);

    // Si es error de validación de negocio, retornar 400
    if (error.message?.includes('no encontrada') ||
        error.message?.includes('No se puede') ||
        error.message?.includes('ya está en espera')) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Error al poner orden en espera' },
      { status: 500 }
    );
  }
}
