/**
 * PATCH /api/solutions-applied/[id]/obsolete
 *
 * Marca o desmarca una solución como obsoleta.
 * Las soluciones obsoletas no aparecen en sugerencias de IA ni en el top de soluciones.
 *
 * Body: { isObsolete: boolean, reason?: string }
 */

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // 1. Autenticación
    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;
    if (!token) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const payload = await verifyToken(token);
    if (!payload || !payload.companyId) {
      return NextResponse.json({ error: 'Token inválido' }, { status: 401 });
    }

    const companyId = payload.companyId as number;
    const userId = payload.userId as number;

    // 2. Validar ID
    const solutionId = parseInt(params.id);
    if (isNaN(solutionId) || solutionId <= 0) {
      return NextResponse.json({ error: 'ID de solución inválido' }, { status: 400 });
    }

    // 3. Validar body
    const body = await request.json();
    const { isObsolete, reason } = body;

    if (typeof isObsolete !== 'boolean') {
      return NextResponse.json(
        { error: 'isObsolete debe ser un valor booleano' },
        { status: 400 }
      );
    }

    // 4. Verificar que la solución existe y pertenece a la empresa
    const solution = await prisma.solutionApplied.findUnique({
      where: { id: solutionId },
      select: { id: true, companyId: true, isObsolete: true }
    });

    if (!solution) {
      return NextResponse.json({ error: 'Solución no encontrada' }, { status: 404 });
    }

    if (solution.companyId !== companyId) {
      return NextResponse.json({ error: 'No autorizado para esta solución' }, { status: 403 });
    }

    // 5. Actualizar
    const updated = await prisma.solutionApplied.update({
      where: { id: solutionId },
      data: {
        isObsolete,
        obsoleteReason: isObsolete ? (reason?.trim() || null) : null,
        obsoleteAt: isObsolete ? new Date() : null,
        obsoleteById: isObsolete ? userId : null,
      },
      select: {
        id: true,
        isObsolete: true,
        obsoleteReason: true,
        obsoleteAt: true,
        obsoleteById: true,
      }
    });

    return NextResponse.json({
      success: true,
      message: isObsolete
        ? 'Solución marcada como obsoleta'
        : 'Solución reactivada correctamente',
      solution: updated
    });

  } catch (error) {
    console.error('❌ Error en PATCH /api/solutions-applied/[id]/obsolete:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
