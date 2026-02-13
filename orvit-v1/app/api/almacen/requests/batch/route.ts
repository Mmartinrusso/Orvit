import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { MaterialRequestStatus } from '@prisma/client';

export const dynamic = 'force-dynamic';

interface BatchResult {
  id: number;
  success: boolean;
  error?: string;
}

/**
 * POST /api/almacen/requests/batch
 *
 * Realizar acciones masivas sobre solicitudes de material
 *
 * Body:
 * - ids: number[] (required) - IDs de las solicitudes
 * - action: string (required) - 'approve' | 'reject' | 'cancel' | 'submit'
 * - userId: number (required for approve/reject)
 * - motivo: string (optional for reject/cancel)
 * - companyId: number (required)
 */
export async function POST(request: NextRequest) {
  try {
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
        const request = await prisma.materialRequest.findFirst({
          where: { id: Number(id), companyId: Number(companyId) },
        });

        if (!request) {
          errors.push({ id, success: false, error: 'Solicitud no encontrada' });
          continue;
        }

        switch (action) {
          case 'submit': {
            if (request.estado !== MaterialRequestStatus.BORRADOR) {
              errors.push({ id, success: false, error: 'Solo se pueden enviar solicitudes en BORRADOR' });
              continue;
            }

            await prisma.materialRequest.update({
              where: { id: Number(id) },
              data: { estado: MaterialRequestStatus.PENDIENTE_APROBACION },
            });
            results.push({ id, success: true });
            break;
          }

          case 'approve': {
            if (!userId) {
              errors.push({ id, success: false, error: 'userId es requerido para aprobar' });
              continue;
            }

            if (request.estado !== MaterialRequestStatus.PENDIENTE_APROBACION) {
              errors.push({ id, success: false, error: 'Solo se pueden aprobar solicitudes PENDIENTE_APROBACION' });
              continue;
            }

            // Aprobar todas las cantidades solicitadas
            const items = await prisma.materialRequestItem.findMany({
              where: { requestId: Number(id) },
            });

            await prisma.$transaction([
              ...items.map((item) =>
                prisma.materialRequestItem.update({
                  where: { id: item.id },
                  data: { cantidadAprobada: item.cantidadSolicitada },
                })
              ),
              prisma.materialRequest.update({
                where: { id: Number(id) },
                data: {
                  estado: MaterialRequestStatus.APROBADA,
                  fechaAprobacion: new Date(),
                  aprobadoPor: Number(userId),
                },
              }),
            ]);

            results.push({ id, success: true });
            break;
          }

          case 'reject': {
            if (!userId) {
              errors.push({ id, success: false, error: 'userId es requerido para rechazar' });
              continue;
            }

            if (request.estado !== MaterialRequestStatus.PENDIENTE_APROBACION) {
              errors.push({ id, success: false, error: 'Solo se pueden rechazar solicitudes PENDIENTE_APROBACION' });
              continue;
            }

            await prisma.materialRequest.update({
              where: { id: Number(id) },
              data: {
                estado: MaterialRequestStatus.RECHAZADA,
                fechaAprobacion: new Date(),
                aprobadoPor: Number(userId),
                notas: motivo
                  ? `${request.notas || ''}\n[RECHAZADA MASIVAMENTE] ${motivo}`
                  : request.notas,
              },
            });

            results.push({ id, success: true });
            break;
          }

          case 'cancel': {
            if (
              request.estado === MaterialRequestStatus.DESPACHADA ||
              request.estado === MaterialRequestStatus.CANCELADA
            ) {
              errors.push({ id, success: false, error: 'No se puede cancelar esta solicitud' });
              continue;
            }

            await prisma.materialRequest.update({
              where: { id: Number(id) },
              data: {
                estado: MaterialRequestStatus.CANCELADA,
                notas: motivo
                  ? `${request.notas || ''}\n[CANCELADA MASIVAMENTE] ${motivo}`
                  : request.notas,
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
    console.error('Error en POST /api/almacen/requests/batch:', error);
    return NextResponse.json(
      { error: 'Error en acción masiva' },
      { status: 500 }
    );
  }
}
