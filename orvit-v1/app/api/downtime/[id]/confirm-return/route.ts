/**
 * API: /api/downtime/[id]/confirm-return
 *
 * POST - Confirmar retorno a producción (CRÍTICO)
 *        Usa confirmReturnToProduction() con transacción
 *        Cierra downtime + marca WorkOrder.returnToProductionConfirmed = true
 *        Si QA requiere confirmación, también marca QA
 */

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth';
import { z } from 'zod';
import { confirmReturnToProduction } from '@/lib/corrective/downtime-manager';

export const dynamic = 'force-dynamic';

/**
 * Schema de validación para confirm-return
 */
const confirmReturnSchema = z.object({
  workOrderId: z.number().int().positive().optional(), // Opcional si ya está asociado
  notes: z.string().max(1000).optional(),
  productionImpact: z.string().max(500).optional(), // Impacto final en producción
});

/**
 * POST /api/downtime/[id]/confirm-return
 * Confirma retorno a producción (cierra downtime y marca flags)
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
    const downtimeLogId = parseInt(params.id);

    if (isNaN(downtimeLogId)) {
      return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
    }

    // 2. Parsear y validar body
    let body: any = {};
    try {
      body = await request.json();
    } catch {
      // Body vacío es válido
    }

    const validationResult = confirmReturnSchema.safeParse(body);

    if (!validationResult.success) {
      const errors = validationResult.error.errors.map(e =>
        `${e.path.join('.')}: ${e.message}`
      ).join(', ');

      return NextResponse.json(
        { error: `Validación falló: ${errors}` },
        { status: 400 }
      );
    }

    const data = validationResult.data;

    // 3. ✅ CRÍTICO: Usar confirmReturnToProduction() con transacción interna
    const result = await confirmReturnToProduction({
      downtimeLogId,
      workOrderId: data.workOrderId,
      returnedById: userId,
      notes: data.notes,
      productionImpact: data.productionImpact,
      companyId
    });

    // 4. Retornar resultado
    return NextResponse.json({
      success: true,
      message: 'Retorno a producción confirmado exitosamente',
      data: result
    }, { status: 200 });

  } catch (error: any) {
    console.error('❌ Error en POST /api/downtime/[id]/confirm-return:', error);

    // Si es error de validación de negocio del helper, retornar 400
    if (error.message?.includes('no encontrado') ||
        error.message?.includes('ya fue cerrado') ||
        error.message?.includes('No se encontró') ||
        error.message?.includes('ya está cerrado')) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Error al confirmar retorno a producción' },
      { status: 500 }
    );
  }
}
