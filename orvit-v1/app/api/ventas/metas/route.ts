import { NextRequest, NextResponse } from 'next/server';
import { requirePermission, VENTAS_PERMISSIONS } from '@/lib/ventas/auth';
import { prisma } from '@/lib/prisma';
import { getViewMode, applyViewMode } from '@/lib/view-mode';

export const dynamic = 'force-dynamic';

/**
 * GET - List sales goals with filters
 *
 * Query params:
 * - vendedorId: Filter by seller
 * - periodo: Filter by period
 * - isActive: Filter active/inactive
 */
export async function GET(request: NextRequest) {
  try {
    const { user, error } = await requirePermission(VENTAS_PERMISSIONS.VENTAS_VIEW);
    if (error) return error;

    const { searchParams } = new URL(request.url);
    const vendedorId = searchParams.get('vendedorId');
    const periodo = searchParams.get('periodo');
    const isActive = searchParams.get('isActive');
    const nivel = searchParams.get('nivel');

    const viewMode = getViewMode(request);

    const where: any = applyViewMode({ companyId: user!.companyId }, viewMode);

    if (vendedorId) where.vendedorId = parseInt(vendedorId);
    if (periodo) where.periodo = periodo;
    if (isActive !== null) where.isActive = isActive === 'true';
    if (nivel) where.nivel = nivel;

    const goals = await prisma.salesGoal.findMany({
      where,
      include: {
        vendedor: {
          select: { id: true, name: true, email: true },
        },
        creator: {
          select: { id: true, name: true },
        },
        progress: {
          orderBy: { fecha: 'desc' },
          take: 30, // Last 30 days
        },
      },
      orderBy: { fechaInicio: 'desc' },
    });

    // Calculate summary statistics
    const summary = {
      totalMetas: goals.length,
      metasActivas: goals.filter(g => g.isActive && !g.isClosed).length,
      metasCerradas: goals.filter(g => g.isClosed).length,
      cumplimientoPromedio: 0,
    };

    // Calculate average completion
    const goalsWithProgress = goals.filter(g => g.progress.length > 0);
    if (goalsWithProgress.length > 0) {
      const totalCompletion = goalsWithProgress.reduce((sum, goal) => {
        const latestProgress = goal.progress[0];
        return sum + Number(latestProgress.porcentajeCumplimiento);
      }, 0);
      summary.cumplimientoPromedio = totalCompletion / goalsWithProgress.length;
    }

    return NextResponse.json({
      data: goals,
      summary,
    });
  } catch (error) {
    console.error('Error fetching goals:', error);
    return NextResponse.json({ error: 'Error al obtener metas' }, { status: 500 });
  }
}

/**
 * POST - Create new sales goal
 */
export async function POST(request: NextRequest) {
  try {
    const { user, error } = await requirePermission(VENTAS_PERMISSIONS.VENTAS_CONFIG);
    if (error) return error;

    const body = await request.json();
    const {
      nombre,
      descripcion,
      tipo,
      nivel,
      periodo,
      fechaInicio,
      fechaFin,
      metaValor,
      unidad,
      vendedorId,
      equipoId,
      productoId,
      categoriaId,
      tieneIncentivo,
      incentivoPorcentaje,
      incentivoFijo,
      descripcionIncentivo,
    } = body;

    const goal = await prisma.salesGoal.create({
      data: {
        companyId: user!.companyId,
        nombre,
        descripcion,
        tipo,
        nivel,
        periodo,
        fechaInicio: new Date(fechaInicio),
        fechaFin: new Date(fechaFin),
        metaValor,
        unidad: unidad || 'ARS',
        vendedorId: vendedorId ? parseInt(vendedorId) : null,
        equipoId,
        productoId,
        categoriaId: categoriaId ? parseInt(categoriaId) : null,
        tieneIncentivo: tieneIncentivo || false,
        incentivoPorcentaje,
        incentivoFijo,
        descripcionIncentivo,
        createdBy: user!.id,
      },
      include: {
        vendedor: {
          select: { id: true, name: true },
        },
      },
    });

    return NextResponse.json(goal, { status: 201 });
  } catch (error) {
    console.error('Error creating goal:', error);
    return NextResponse.json({ error: 'Error al crear meta' }, { status: 500 });
  }
}
