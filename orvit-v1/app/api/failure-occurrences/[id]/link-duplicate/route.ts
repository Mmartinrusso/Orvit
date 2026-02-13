/**
 * API: /api/failure-occurrences/[id]/link-duplicate
 *
 * POST - Vincular esta falla como duplicado de otra (conserva timeline, NO duplica caso)
 *        Usa transacción para evitar estados inconsistentes
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

/**
 * Schema de validación para link-duplicate
 */
const linkDuplicateSchema = z.object({
  mainOccurrenceId: z.number().int().positive('mainOccurrenceId es obligatorio'),
  linkedReason: z.string().min(10, 'linkedReason debe tener al menos 10 caracteres').max(500).optional(),
  notes: z.string().optional(),
});

/**
 * POST /api/failure-occurrences/[id]/link-duplicate
 * Vincula esta ocurrencia como duplicado de otra existente
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

    // 2. Parsear y validar body
    const body = await request.json();
    const validationResult = linkDuplicateSchema.safeParse(body);

    if (!validationResult.success) {
      const errors = validationResult.error.errors.map(e =>
        `${e.path.join('.')}: ${e.message}`
      ).join(', ');

      return NextResponse.json(
        { error: `Validación falló: ${errors}` },
        { status: 400 }
      );
    }

    const { mainOccurrenceId, linkedReason, notes } = validationResult.data;

    // ✅ TRANSACCIÓN: Vincular duplicado es una operación atómica
    const result = await prisma.$transaction(async (tx) => {
      // 3. Verificar que la ocurrencia a vincular existe y pertenece a la empresa
      const currentOccurrence = await tx.failureOccurrence.findUnique({
        where: { id: occurrenceId },
        include: {
          machine: { select: { id: true, name: true } },
          reportedByUser: { select: { id: true, name: true } }
        }
      });

      if (!currentOccurrence || currentOccurrence.companyId !== companyId) {
        throw new Error('Ocurrencia no encontrada');
      }

      // 4. Verificar que la ocurrencia principal existe y pertenece a la empresa
      const mainOccurrence = await tx.failureOccurrence.findUnique({
        where: { id: mainOccurrenceId },
        include: {
          machine: { select: { id: true, name: true } }
        }
      });

      if (!mainOccurrence || mainOccurrence.companyId !== companyId) {
        throw new Error('Ocurrencia principal no encontrada');
      }

      // 5. Validaciones de negocio
      if (currentOccurrence.isLinkedDuplicate) {
        throw new Error('Esta ocurrencia ya está vinculada como duplicado');
      }

      if (currentOccurrence.id === mainOccurrenceId) {
        throw new Error('No se puede vincular una ocurrencia a sí misma');
      }

      if (mainOccurrence.isLinkedDuplicate) {
        throw new Error('No se puede vincular a un duplicado. Debe vincular a la ocurrencia principal.');
      }

      if (currentOccurrence.machineId !== mainOccurrence.machineId) {
        throw new Error('Las ocurrencias deben ser de la misma máquina');
      }

      // 6. Actualizar ocurrencia actual como duplicado vinculado
      const updatedOccurrence = await tx.failureOccurrence.update({
        where: { id: occurrenceId },
        data: {
          isLinkedDuplicate: true,
          linkedToOccurrenceId: mainOccurrenceId,
          linkedById: userId,
          linkedAt: new Date(),
          linkedReason: linkedReason || `Duplicado detectado - Similar a caso principal #${mainOccurrenceId}`,
          // Mantener status como REPORTED pero marcado como duplicado
          status: 'RESOLVED', // Los duplicados se marcan como resueltos
          resolvedAt: new Date(),
          notes: notes
            ? `${currentOccurrence.notes || ''}\n\n[Vinculado como duplicado]: ${notes}`
            : currentOccurrence.notes
        },
        include: {
          machine: { select: { id: true, name: true } },
          reportedByUser: { select: { id: true, name: true } },
          linkedBy: { select: { id: true, name: true } },
          linkedOccurrence: {
            select: {
              id: true,
              title: true,
              status: true,
              priority: true
            }
          }
        }
      });

      // 7. Si la ocurrencia actual tenía WorkOrders, cancelarlas o reasignarlas
      const existingWorkOrders = await tx.workOrder.findMany({
        where: {
          failureOccurrences: {
            some: { id: occurrenceId }
          },
          status: { notIn: ['completed', 'cancelled'] }
        }
      });

      if (existingWorkOrders.length > 0) {
        // Cancelar WorkOrders existentes con nota
        await tx.workOrder.updateMany({
          where: {
            id: { in: existingWorkOrders.map(wo => wo.id) }
          },
          data: {
            status: 'cancelled',
            closedAt: new Date(),
            closedById: userId,
            notes: `Orden cancelada - Falla vinculada como duplicado de caso #${mainOccurrenceId}`
          }
        });
      }

      return {
        linkedOccurrence: updatedOccurrence,
        mainOccurrence,
        cancelledWorkOrders: existingWorkOrders.length
      };
    });

    // 8. Retornar resultado
    return NextResponse.json({
      success: true,
      message: `Falla #${occurrenceId} vinculada exitosamente a caso principal #${mainOccurrenceId}`,
      data: result
    }, { status: 200 });

  } catch (error: any) {
    console.error('❌ Error en POST /api/failure-occurrences/[id]/link-duplicate:', error);

    // Si es error de validación de negocio, retornar 400
    if (error.message?.includes('no encontrada') ||
        error.message?.includes('ya está vinculada') ||
        error.message?.includes('misma máquina') ||
        error.message?.includes('a sí misma')) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Error al vincular duplicado' },
      { status: 500 }
    );
  }
}
