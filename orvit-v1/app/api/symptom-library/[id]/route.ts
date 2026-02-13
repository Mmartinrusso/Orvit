/**
 * API: /api/symptom-library/[id]
 *
 * GET - Obtener síntoma por ID
 * PATCH - Actualizar síntoma
 * DELETE - Eliminar síntoma (solo admin)
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

/**
 * Schema para actualizar síntoma
 */
const updateSymptomSchema = z.object({
  title: z.string().min(3).max(100).optional(),
  keywords: z.array(z.string()).optional(),
  shortNote: z.string().max(255).optional().nullable(),
  componentId: z.number().int().positive().optional().nullable(),
  subcomponentId: z.number().int().positive().optional().nullable(),
  machineId: z.number().int().positive().optional().nullable(),
  isActive: z.boolean().optional(),
}).strict();

/**
 * GET /api/symptom-library/[id]
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
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
    const symptomId = parseInt(params.id);

    if (isNaN(symptomId)) {
      return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
    }

    const symptom = await prisma.symptomLibrary.findUnique({
      where: { id: symptomId }
    });

    if (!symptom || symptom.companyId !== companyId) {
      return NextResponse.json(
        { error: 'Síntoma no encontrado' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: symptom
    });

  } catch (error) {
    console.error('❌ Error en GET /api/symptom-library/[id]:', error);
    return NextResponse.json(
      { error: 'Error al obtener síntoma' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/symptom-library/[id]
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
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
    const symptomId = parseInt(params.id);

    if (isNaN(symptomId)) {
      return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
    }

    // Verificar que existe
    const existing = await prisma.symptomLibrary.findUnique({
      where: { id: symptomId }
    });

    if (!existing || existing.companyId !== companyId) {
      return NextResponse.json(
        { error: 'Síntoma no encontrado' },
        { status: 404 }
      );
    }

    // Parsear body
    const body = await request.json();
    const validationResult = updateSymptomSchema.safeParse(body);

    if (!validationResult.success) {
      const errors = validationResult.error.errors.map(e =>
        `${e.path.join('.')}: ${e.message}`
      ).join(', ');

      return NextResponse.json(
        { error: `Validación falló: ${errors}` },
        { status: 400 }
      );
    }

    const updates = validationResult.data;

    const updated = await prisma.symptomLibrary.update({
      where: { id: symptomId },
      data: updates
    });

    return NextResponse.json({
      success: true,
      data: updated
    });

  } catch (error) {
    console.error('❌ Error en PATCH /api/symptom-library/[id]:', error);
    return NextResponse.json(
      { error: 'Error al actualizar síntoma' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/symptom-library/[id]
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
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
    const symptomId = parseInt(params.id);

    if (isNaN(symptomId)) {
      return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
    }

    // Verificar que existe
    const existing = await prisma.symptomLibrary.findUnique({
      where: { id: symptomId }
    });

    if (!existing || existing.companyId !== companyId) {
      return NextResponse.json(
        { error: 'Síntoma no encontrado' },
        { status: 404 }
      );
    }

    // Soft delete (marcar como inactivo)
    await prisma.symptomLibrary.update({
      where: { id: symptomId },
      data: { isActive: false }
    });

    return NextResponse.json({
      success: true,
      message: 'Síntoma eliminado'
    });

  } catch (error) {
    console.error('❌ Error en DELETE /api/symptom-library/[id]:', error);
    return NextResponse.json(
      { error: 'Error al eliminar síntoma' },
      { status: 500 }
    );
  }
}
