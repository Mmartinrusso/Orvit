/**
 * API: /api/failure-occurrences/suggest-assignee
 *
 * POST - Obtener sugerencias de asignado para una falla/OT
 *        Retorna top 3 técnicos sugeridos con score y razones
 */

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth';
import { suggestAssignee } from '@/lib/corrective/assignee-suggester';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const suggestAssigneeSchema = z.object({
  machineId: z.number().int().positive(),
  componentId: z.number().int().positive().optional(),
  subcomponentId: z.number().int().positive().optional(),
  failureCategory: z.string().optional(),
  areaId: z.number().int().positive().optional(),
  sectorId: z.number().int().positive().optional(),
});

/**
 * POST /api/failure-occurrences/suggest-assignee
 * Obtener sugerencias de asignado
 */
export async function POST(request: NextRequest) {
  try {
    // 1. Verificar autenticación
    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;

    if (!token) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }

    const payload = await verifyToken(token);
    if (!payload || !payload.companyId) {
      return NextResponse.json({ error: 'Token inválido' }, { status: 401 });
    }

    const companyId = payload.companyId as number;

    // 2. Parsear body
    const body = await request.json();
    const validationResult = suggestAssigneeSchema.safeParse(body);

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

    // 3. Obtener sugerencias
    const suggestions = await suggestAssignee({
      ...data,
      companyId
    });

    return NextResponse.json({
      suggestions,
      count: suggestions.length,
      message: suggestions.length > 0
        ? `${suggestions.length} técnicos sugeridos`
        : 'No hay sugerencias disponibles'
    });

  } catch (error: any) {
    console.error('❌ Error en POST /api/failure-occurrences/suggest-assignee:', error);
    return NextResponse.json(
      { error: 'Error al obtener sugerencias', detail: error.message },
      { status: 500 }
    );
  }
}
