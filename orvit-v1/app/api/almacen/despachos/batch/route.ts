import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { DespachoStatus } from '@prisma/client';
import { requirePermission } from '@/lib/auth/shared-helpers';

export const dynamic = 'force-dynamic';

interface BatchResult {
  id: number;
  success: boolean;
  error?: string;
}

/**
 * POST /api/almacen/despachos/batch
 *
 * Realizar acciones masivas sobre despachos
 *
 * Body:
 * - ids: number[] (required) - IDs de los despachos
 * - action: string (required) - 'prepare' | 'ready' | 'dispatch' | 'cancel'
 * - userId: number (required for dispatch)
 * - motivo: string (optional for cancel)
 * - companyId: number (required)
 */
export async function POST(request: NextRequest) {
  try {
    // Permission check: batch actions require almacen.dispatch.process
    const { user, error: authError } = await requirePermission('almacen.dispatch.process');
    if (authError) return authError;

    const body = await request.json();
    const { ids, action, userId, motivo, companyId } = body;

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json(
        { error: 'ids es requerido y debe ser un array no vacío' },
        { status: 400 }
      );
    }

    if (!action) {
      return NextResponse.json(
        { error: 'action es requerido' },
        { status: 400 }
      );
    }

    if (!companyId) {
      return NextResponse.json(
        { error: 'companyId es requerido' },
        { status: 400 }
      );
    }

    const results: BatchResult[] = [];
    const errors: BatchResult[] = [];

    for (const id of ids) {
      try {
        const despacho = await prisma.materialDespacho.findFirst({
          where: { id: Number(id), companyId: Number(companyId) },
        });

        if (!despacho) {
          errors.push({ id, success: false, error: 'Despacho no encontrado' });
          continue;
        }

        switch (action) {
          case 'prepare': {
            if (despacho.estado !== DespachoStatus.BORRADOR) {
              errors.push({ id, success: false, error: 'Solo se pueden preparar despachos en BORRADOR' });
              continue;
            }

            await prisma.materialDespacho.update({
              where: { id: Number(id) },
              data: { estado: DespachoStatus.EN_PREPARACION },
            });
            results.push({ id, success: true });
            break;
          }

          case 'ready': {
            if (despacho.estado !== DespachoStatus.EN_PREPARACION) {
              errors.push({ id, success: false, error: 'Solo se pueden marcar listos despachos EN_PREPARACION' });
              continue;
            }

            await prisma.materialDespacho.update({
              where: { id: Number(id) },
              data: { estado: DespachoStatus.LISTO_DESPACHO },
            });
            results.push({ id, success: true });
            break;
          }

          case 'dispatch': {
            if (!userId) {
              errors.push({ id, success: false, error: 'userId es requerido para despachar' });
              continue;
            }

            if (despacho.estado !== DespachoStatus.LISTO_DESPACHO) {
              errors.push({ id, success: false, error: 'Solo se pueden despachar items LISTO_DESPACHO' });
              continue;
            }

            await prisma.materialDespacho.update({
              where: { id: Number(id) },
              data: {
                estado: DespachoStatus.DESPACHADO,
                fechaDespacho: new Date(),
              },
            });
            results.push({ id, success: true });
            break;
          }

          case 'cancel': {
            if (
              despacho.estado === DespachoStatus.DESPACHADO ||
              despacho.estado === DespachoStatus.RECIBIDO ||
              despacho.estado === DespachoStatus.CANCELADO
            ) {
              errors.push({ id, success: false, error: 'No se puede cancelar este despacho' });
              continue;
            }

            await prisma.materialDespacho.update({
              where: { id: Number(id) },
              data: {
                estado: DespachoStatus.CANCELADO,
                notas: motivo
                  ? `${despacho.notas || ''}\n[CANCELADO MASIVAMENTE] ${motivo}`
                  : despacho.notas,
              },
            });
            results.push({ id, success: true });
            break;
          }

          default:
            errors.push({ id, success: false, error: 'Acción no válida' });
        }
      } catch (err) {
        errors.push({
          id,
          success: false,
          error: err instanceof Error ? err.message : 'Error desconocido',
        });
      }
    }

    return NextResponse.json({
      results,
      errors,
      total: ids.length,
      success: results.length,
      failed: errors.length,
    });
  } catch (error) {
    console.error('Error en POST /api/almacen/despachos/batch:', error);
    return NextResponse.json(
      { error: 'Error en acción masiva' },
      { status: 500 }
    );
  }
}
