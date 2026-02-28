/**
 * API: /api/solutions-applied/bulk
 * POST - Operaciones en lote sobre múltiples soluciones
 *        Soporta: delete
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const bulkOperationSchema = z.object({
  ids: z.array(z.number().int().positive()).min(1, 'Debe seleccionar al menos una solución'),
  operation: z.enum(['delete']),
});

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;
    if (!token) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

    const payload = await verifyToken(token);
    if (!payload || !payload.companyId) {
      return NextResponse.json({ error: 'Token inválido' }, { status: 401 });
    }

    const companyId = payload.companyId as number;
    const body = await request.json();
    const parsed = bulkOperationSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors.map(e => e.message).join(', ') },
        { status: 400 }
      );
    }

    const { ids, operation } = parsed.data;

    if (operation === 'delete') {
      const result = await prisma.solutionApplied.deleteMany({
        where: { id: { in: ids }, companyId },
      });

      return NextResponse.json({
        success: true,
        operation,
        updated: result.count,
        details: `${result.count} soluciones eliminadas`,
      });
    }

    return NextResponse.json({ error: 'Operación no soportada' }, { status: 400 });
  } catch (error: any) {
    console.error('❌ Error en POST /api/solutions-applied/bulk:', error);
    return NextResponse.json({ error: 'Error en operación bulk', detail: error.message }, { status: 500 });
  }
}
