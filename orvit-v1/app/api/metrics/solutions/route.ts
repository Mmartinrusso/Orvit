/**
 * API: /api/metrics/solutions
 *
 * GET - Base de conocimiento de soluciones aplicadas a fallas
 *       Incluye: KPIs, lista paginada con búsqueda, efectividad, reutilización
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    // 1. Autenticación
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

    // 2. Params
    const searchParams = request.nextUrl.searchParams;
    const search = searchParams.get('search')?.trim().toLowerCase() ?? '';
    const limit = Math.min(parseInt(searchParams.get('limit') || '100'), 200);

    // 3. Obtener soluciones de la empresa (via occurrence.companyId)
    const solutions = await prisma.failureSolution.findMany({
      where: {
        occurrence: { companyId },
      },
      include: {
        occurrence: {
          select: {
            machineId: true,
            failureCategory: true,
            title: true,
            machine: { select: { name: true } },
          },
        },
        appliedBy: {
          select: { name: true },
        },
        applications: {
          select: { id: true, effectiveness: true },
        },
      },
      orderBy: [
        { isPreferred: 'desc' },
        { effectiveness: 'desc' },
        { appliedAt: 'desc' },
      ],
    });

    // 4. Filtrar por búsqueda
    const filtered = search
      ? solutions.filter(
          s =>
            s.title.toLowerCase().includes(search) ||
            s.rootCause?.toLowerCase().includes(search) ||
            s.description.toLowerCase().includes(search) ||
            s.occurrence.machine?.name.toLowerCase().includes(search) ||
            s.occurrence.failureCategory?.toLowerCase().includes(search)
        )
      : solutions;

    // 5. KPIs
    const total = filtered.length;
    const preferred = filtered.filter(s => s.isPreferred).length;

    const effectivenessValues = filtered
      .filter(s => s.effectiveness !== null)
      .map(s => s.effectiveness!);
    const avgEffectiveness =
      effectivenessValues.length > 0
        ? Math.round(
            (effectivenessValues.reduce((s, v) => s + v, 0) / effectivenessValues.length) * 10
          ) / 10
        : null;

    // Solución más reutilizada (por SolutionApplication)
    let mostUsedTitle: string | null = null;
    let mostUsedCount = 0;
    for (const s of filtered) {
      const appCount = s.applications.length;
      if (appCount > mostUsedCount) {
        mostUsedCount = appCount;
        mostUsedTitle = s.title;
      }
    }

    // 6. Mapear a respuesta pública (sin exponer HTML/JSON crudo)
    const mappedSolutions = filtered.slice(0, limit).map(s => {
      const avgAppEffectiveness =
        s.applications.filter(a => a.effectiveness !== null).length > 0
          ? Math.round(
              (s.applications
                .filter(a => a.effectiveness !== null)
                .reduce((sum, a) => sum + a.effectiveness!, 0) /
                s.applications.filter(a => a.effectiveness !== null).length) *
                10
            ) / 10
          : null;

      return {
        id: s.id,
        title: s.title,
        rootCause: s.rootCause ?? null,
        preventiveActions: s.preventiveActions ?? null,
        effectiveness: s.effectiveness,
        isPreferred: s.isPreferred,
        appliedAt: s.appliedAt.toISOString(),
        appliedByName: s.appliedBy.name,
        actualHours: s.actualHours ? Number(s.actualHours) : null,
        reuseCount: s.applications.length,
        avgAppEffectiveness,
        machine: {
          id: s.occurrence.machineId ?? null,
          name: s.occurrence.machine?.name ?? null,
        },
        failureCategory: s.occurrence.failureCategory ?? null,
        occurrenceTitle: s.occurrence.title ?? null,
      };
    });

    return NextResponse.json({
      success: true,
      data: {
        solutions: mappedSolutions,
        kpis: {
          total,
          preferred,
          avgEffectiveness,
          mostUsedTitle,
          mostUsedCount,
        },
      },
    });
  } catch (error) {
    console.error('Error en GET /api/metrics/solutions:', error);
    return NextResponse.json(
      { error: 'Error al obtener base de soluciones' },
      { status: 500 }
    );
  }
}
