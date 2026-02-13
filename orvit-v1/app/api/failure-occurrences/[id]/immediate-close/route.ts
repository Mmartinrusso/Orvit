/**
 * API: /api/failure-occurrences/[id]/immediate-close
 *
 * POST - Cierre inmediato de falla SIN necesidad de OT
 *        Para casos simples que se resolvieron en el momento
 *        Respeta reglas de downtime (debe cerrarse antes o junto con la falla)
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

/**
 * Schema para cierre inmediato
 */
const immediateCloseSchema = z.object({
  // Diagnóstico y solución (OBLIGATORIO)
  diagnosis: z.string().min(5, 'El diagnóstico debe tener al menos 5 caracteres'),
  solution: z.string().min(5, 'La solución debe tener al menos 5 caracteres'),
  outcome: z.enum(['FUNCIONÓ', 'PARCIAL', 'NO_FUNCIONÓ']),

  // Tiempo real de trabajo (opcional)
  actualMinutes: z.number().int().positive().optional(),

  // Si hay downtime activo, ¿cerrarlo también?
  closeDowntime: z.boolean().optional().default(false),

  // Notas adicionales
  notes: z.string().optional(),
});

/**
 * POST /api/failure-occurrences/[id]/immediate-close
 * Cierre inmediato sin OT
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
    const occurrenceId = parseInt(params.id);

    if (isNaN(occurrenceId)) {
      return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
    }

    // 2. Parsear body
    const body = await request.json();
    const validationResult = immediateCloseSchema.safeParse(body);

    if (!validationResult.success) {
      const errors = validationResult.error.errors
        .map((e) => `${e.path.join('.')}: ${e.message}`)
        .join(', ');
      return NextResponse.json(
        { error: `Validación falló: ${errors}` },
        { status: 400 }
      );
    }

    const data = validationResult.data;

    // 3. Obtener la falla
    const occurrence = await prisma.failureOccurrence.findFirst({
      where: {
        id: occurrenceId,
        companyId,
      },
      include: {
        workOrder: true,
      },
    });

    if (!occurrence) {
      return NextResponse.json(
        { error: 'Falla no encontrada' },
        { status: 404 }
      );
    }

    if (occurrence.status === 'RESOLVED' || occurrence.status === 'RESOLVED_IMMEDIATE') {
      return NextResponse.json(
        { error: 'La falla ya está resuelta' },
        { status: 400 }
      );
    }

    // 4. Verificar downtime activo
    let activeDowntime = null;
    try {
      activeDowntime = await prisma.downtimeLog.findFirst({
        where: {
          failureOccurrenceId: occurrenceId,
          endedAt: null,
        },
      });
    } catch (e) {
      // Tabla no existe, ignorar
    }

    if (activeDowntime && !data.closeDowntime) {
      return NextResponse.json(
        {
          error: 'Hay un downtime activo. Debe cerrarlo primero o marcar closeDowntime=true',
          hasActiveDowntime: true,
          downtimeId: activeDowntime.id,
          startedAt: activeDowntime.startedAt,
        },
        { status: 400 }
      );
    }

    // 5. Transacción: cerrar downtime (si aplica) + crear SolutionApplied + actualizar falla
    const result = await prisma.$transaction(async (tx) => {
      // 5.1 Cerrar downtime si está activo y closeDowntime=true
      let closedDowntime = null;
      if (activeDowntime && data.closeDowntime) {
        const now = new Date();
        const startedAt = new Date(activeDowntime.startedAt);
        const totalMinutes = Math.floor((now.getTime() - startedAt.getTime()) / 1000 / 60);

        closedDowntime = await tx.downtimeLog.update({
          where: { id: activeDowntime.id },
          data: {
            endedAt: now,
            totalMinutes,
            returnToProductionBy: userId,
            returnToProductionAt: now,
          },
        });
      }

      // 5.2 Crear SolutionApplied (historial de solución)
      const solutionApplied = await tx.solutionApplied.create({
        data: {
          failureOccurrenceId: occurrenceId,
          workOrderId: occurrence.failureId, // El failureId ES el workOrderId
          companyId,
          diagnosis: data.diagnosis,
          solution: data.solution,
          outcome: data.outcome,
          performedById: userId,
          performedAt: new Date(),
          actualMinutes: data.actualMinutes,
          notes: data.notes,
          fixType: 'DEFINITIVA', // Cierre inmediato = solución definitiva
        },
        include: {
          performedBy: {
            select: { id: true, name: true, email: true },
          },
        },
      });

      // 5.3 Actualizar FailureOccurrence a RESOLVED_IMMEDIATE
      const updatedOccurrence = await tx.failureOccurrence.update({
        where: { id: occurrenceId },
        data: {
          status: 'RESOLVED_IMMEDIATE',
          resolvedAt: new Date(),
          resolvedImmediately: true,
        },
      });

      // 5.4 Actualizar WorkOrder asociada a COMPLETED
      // Nota: Usamos solo campos existentes en el schema actual
      await tx.workOrder.update({
        where: { id: occurrence.failureId },
        data: {
          status: 'COMPLETED',
          completedDate: new Date(), // ✅ Usar campo existente (no closedAt)
          isCompleted: true,
          // Guardar diagnóstico y solución en campos existentes
          rootCause: data.diagnosis,
          solution: data.solution,
          notes: `[${data.outcome}] ${data.notes || ''}`.trim(),
        },
      });

      return {
        solutionApplied,
        updatedOccurrence,
        closedDowntime,
      };
    });

    console.log(`✅ Falla ${occurrenceId} cerrada inmediatamente por usuario ${userId}`);

    return NextResponse.json({
      success: true,
      message: 'Falla resuelta inmediatamente',
      occurrence: result.updatedOccurrence,
      solutionApplied: result.solutionApplied,
      downtimeClosed: !!result.closedDowntime,
    });
  } catch (error: any) {
    console.error('❌ Error en POST /api/failure-occurrences/[id]/immediate-close:', error);
    return NextResponse.json(
      { error: 'Error al cerrar falla', detail: error.message },
      { status: 500 }
    );
  }
}
