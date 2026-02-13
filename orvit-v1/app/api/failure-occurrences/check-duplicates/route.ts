/**
 * API: /api/failure-occurrences/check-duplicates
 *
 * POST - Verificar duplicados ANTES de crear una nueva ocurrencia de falla
 *        Retorna lista de posibles duplicados con score de similaridad
 */

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth';
import { z } from 'zod';
import { detectDuplicates } from '@/lib/corrective/duplicate-detector';

export const dynamic = 'force-dynamic';

/**
 * Schema de validación para check-duplicates
 */
const checkDuplicatesSchema = z.object({
  machineId: z.number().int().positive('machineId es obligatorio'),
  componentId: z.number().int().positive().optional(),
  subcomponentId: z.number().int().positive().optional(),
  title: z.string().min(3, 'title debe tener al menos 3 caracteres').max(255),
  symptomIds: z.array(z.number().int().positive()).optional().default([]),
});

/**
 * POST /api/failure-occurrences/check-duplicates
 * Verifica si existen duplicados antes de crear una nueva falla
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

    // 2. Parsear y validar body
    const body = await request.json();
    const validationResult = checkDuplicatesSchema.safeParse(body);

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

    // 3. Detectar duplicados usando helper (con ventana configurable)
    const duplicates = await detectDuplicates({
      machineId: data.machineId,
      componentId: data.componentId,
      subcomponentId: data.subcomponentId,
      title: data.title,
      symptomIds: data.symptomIds,
      companyId
    });

    // 4. Retornar resultados
    return NextResponse.json({
      hasDuplicates: duplicates.length > 0,
      count: duplicates.length,
      duplicates: duplicates.map(d => ({
        id: d.id,
        title: d.title,
        status: d.status,
        priority: d.priority,
        reportedAt: d.reportedAt,
        reportedBy: d.reportedBy,
        machineId: d.machineId,
        similarity: d.similarity, // Score de similaridad (0-100)
        // Incluir info adicional útil
        workOrders: d.workOrders,
        linkedDuplicatesCount: d.linkedDuplicates?.length || 0
      }))
    }, { status: 200 });

  } catch (error) {
    console.error('❌ Error en POST /api/failure-occurrences/check-duplicates:', error);
    return NextResponse.json(
      { error: 'Error al verificar duplicados' },
      { status: 500 }
    );
  }
}
