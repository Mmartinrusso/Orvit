import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { getPayrollAuth, hasPayrollAccess } from '@/lib/nominas/auth-helper';

export const dynamic = 'force-dynamic';

interface RouteParams {
  params: { id: string; categoryId: string };
}

// GET - Obtener tasas de una categoría gremial
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const auth = await getPayrollAuth();
    if (!auth) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const unionId = parseInt(params.id);
    const categoryId = parseInt(params.categoryId);

    if (isNaN(unionId) || isNaN(categoryId)) {
      return NextResponse.json({ error: 'IDs inválidos' }, { status: 400 });
    }

    const { searchParams } = new URL(request.url);
    const includeHistorical = searchParams.get('includeHistorical') === 'true';

    // Verificar que la categoría existe y pertenece al gremio/empresa
    const category = await prisma.$queryRaw<any[]>`
      SELECT uc.id, uc.name, uc.code, pu.name as "unionName", pu.convention_code as "conventionCode"
      FROM union_categories uc
      JOIN payroll_unions pu ON pu.id = uc.union_id
      WHERE uc.id = ${categoryId}
        AND uc.union_id = ${unionId}
        AND pu.company_id = ${auth.companyId}
    `;

    if (category.length === 0) {
      return NextResponse.json({ error: 'Categoría no encontrada' }, { status: 404 });
    }

    // Filtro para tasas históricas
    const historicalCondition = !includeHistorical
      ? Prisma.sql`AND (ar.effective_to IS NULL OR ar.effective_to >= CURRENT_DATE)`
      : Prisma.empty;

    const rates = await prisma.$queryRaw<any[]>`
      SELECT
        ar.id,
        ar.company_id as "companyId",
        ar.union_category_id as "unionCategoryId",
        ar.effective_from as "effectiveFrom",
        ar.effective_to as "effectiveTo",
        ar.daily_rate as "dailyRate",
        ar.hourly_rate as "hourlyRate",
        ar.presenteeism_rate as "presenteeismRate",
        ar.seniority_pct as "seniorityPct",
        ar.notes,
        ar.created_at as "createdAt",
        CASE
          WHEN ar.effective_from <= CURRENT_DATE
            AND (ar.effective_to IS NULL OR ar.effective_to >= CURRENT_DATE)
          THEN true
          ELSE false
        END as "isCurrent"
      FROM agreement_rates ar
      WHERE ar.union_category_id = ${categoryId}
        AND ar.company_id = ${auth.companyId}
        ${historicalCondition}
      ORDER BY ar.effective_from DESC
    `;

    const processedRates = rates.map((r: any) => ({
      ...r,
      id: Number(r.id),
      companyId: Number(r.companyId),
      unionCategoryId: Number(r.unionCategoryId),
      dailyRate: parseFloat(r.dailyRate),
      hourlyRate: r.hourlyRate ? parseFloat(r.hourlyRate) : null,
      presenteeismRate: r.presenteeismRate ? parseFloat(r.presenteeismRate) : null,
      seniorityPct: r.seniorityPct ? parseFloat(r.seniorityPct) : null
    }));

    // Encontrar la tasa actual
    const currentRate = processedRates.find(r => r.isCurrent) || null;

    return NextResponse.json({
      category: {
        id: Number(category[0].id),
        name: category[0].name,
        code: category[0].code,
        unionName: category[0].unionName,
        conventionCode: category[0].conventionCode
      },
      rates: processedRates,
      currentRate,
      total: processedRates.length
    });
  } catch (error) {
    console.error('Error obteniendo tasas:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

// POST - Crear nueva tasa de convenio
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const auth = await getPayrollAuth();
    if (!auth || !hasPayrollAccess(auth.user)) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const unionId = parseInt(params.id);
    const categoryId = parseInt(params.categoryId);

    if (isNaN(unionId) || isNaN(categoryId)) {
      return NextResponse.json({ error: 'IDs inválidos' }, { status: 400 });
    }

    const body = await request.json();
    const {
      effectiveFrom,
      effectiveTo,
      dailyRate,
      hourlyRate,
      presenteeismRate,
      seniorityPct,
      notes
    } = body;

    if (!effectiveFrom || dailyRate === undefined) {
      return NextResponse.json(
        { error: 'effectiveFrom y dailyRate son requeridos' },
        { status: 400 }
      );
    }

    // Verificar que la categoría existe
    const category = await prisma.$queryRaw<any[]>`
      SELECT uc.id
      FROM union_categories uc
      JOIN payroll_unions pu ON pu.id = uc.union_id
      WHERE uc.id = ${categoryId}
        AND uc.union_id = ${unionId}
        AND pu.company_id = ${auth.companyId}
    `;

    if (category.length === 0) {
      return NextResponse.json({ error: 'Categoría no encontrada' }, { status: 404 });
    }

    // Cerrar tasa anterior si existe y se superpone
    await prisma.$queryRaw`
      UPDATE agreement_rates
      SET
        effective_to = ${new Date(effectiveFrom)}::date - interval '1 day',
        updated_at = NOW()
      WHERE union_category_id = ${categoryId}
        AND company_id = ${auth.companyId}
        AND effective_to IS NULL
        AND effective_from < ${new Date(effectiveFrom)}::date
    `;

    const result = await prisma.$queryRaw<any[]>`
      INSERT INTO agreement_rates (
        company_id, union_category_id,
        effective_from, effective_to,
        daily_rate, hourly_rate, presenteeism_rate, seniority_pct,
        notes, created_at, updated_at
      )
      VALUES (
        ${auth.companyId},
        ${categoryId},
        ${new Date(effectiveFrom)}::date,
        ${effectiveTo ? new Date(effectiveTo) : null}::date,
        ${parseFloat(String(dailyRate))},
        ${hourlyRate !== undefined ? parseFloat(String(hourlyRate)) : null},
        ${presenteeismRate !== undefined ? parseFloat(String(presenteeismRate)) : null},
        ${seniorityPct !== undefined ? parseFloat(String(seniorityPct)) : null},
        ${notes || null},
        NOW(),
        NOW()
      )
      RETURNING
        id,
        company_id as "companyId",
        union_category_id as "unionCategoryId",
        effective_from as "effectiveFrom",
        effective_to as "effectiveTo",
        daily_rate as "dailyRate",
        hourly_rate as "hourlyRate",
        presenteeism_rate as "presenteeismRate",
        seniority_pct as "seniorityPct",
        notes,
        created_at as "createdAt"
    `;

    const newRate = result[0];
    return NextResponse.json({
      ...newRate,
      id: Number(newRate.id),
      companyId: Number(newRate.companyId),
      unionCategoryId: Number(newRate.unionCategoryId),
      dailyRate: parseFloat(newRate.dailyRate),
      hourlyRate: newRate.hourlyRate ? parseFloat(newRate.hourlyRate) : null,
      presenteeismRate: newRate.presenteeismRate ? parseFloat(newRate.presenteeismRate) : null,
      seniorityPct: newRate.seniorityPct ? parseFloat(newRate.seniorityPct) : null
    }, { status: 201 });
  } catch (error) {
    console.error('Error creando tasa:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

// PUT - Actualizar tasa de convenio
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const auth = await getPayrollAuth();
    if (!auth || !hasPayrollAccess(auth.user)) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const categoryId = parseInt(params.categoryId);

    const body = await request.json();
    const {
      rateId,
      effectiveTo,
      dailyRate,
      hourlyRate,
      presenteeismRate,
      seniorityPct,
      notes
    } = body;

    if (!rateId) {
      return NextResponse.json(
        { error: 'El ID de la tasa es requerido' },
        { status: 400 }
      );
    }

    // Verificar que existe y pertenece a la categoría/empresa
    const existing = await prisma.$queryRaw<any[]>`
      SELECT ar.id
      FROM agreement_rates ar
      WHERE ar.id = ${parseInt(rateId)}
        AND ar.union_category_id = ${categoryId}
        AND ar.company_id = ${auth.companyId}
    `;

    if (existing.length === 0) {
      return NextResponse.json(
        { error: 'Tasa no encontrada' },
        { status: 404 }
      );
    }

    const result = await prisma.$queryRaw<any[]>`
      UPDATE agreement_rates
      SET
        effective_to = ${effectiveTo !== undefined ? (effectiveTo ? new Date(effectiveTo) : null) : null}::date,
        daily_rate = COALESCE(${dailyRate !== undefined ? parseFloat(String(dailyRate)) : null}, daily_rate),
        hourly_rate = ${hourlyRate !== undefined ? (hourlyRate ? parseFloat(String(hourlyRate)) : null) : null},
        presenteeism_rate = ${presenteeismRate !== undefined ? (presenteeismRate ? parseFloat(String(presenteeismRate)) : null) : null},
        seniority_pct = ${seniorityPct !== undefined ? (seniorityPct ? parseFloat(String(seniorityPct)) : null) : null},
        notes = ${notes !== undefined ? notes : null},
        updated_at = NOW()
      WHERE id = ${parseInt(rateId)}
      RETURNING
        id,
        company_id as "companyId",
        union_category_id as "unionCategoryId",
        effective_from as "effectiveFrom",
        effective_to as "effectiveTo",
        daily_rate as "dailyRate",
        hourly_rate as "hourlyRate",
        presenteeism_rate as "presenteeismRate",
        seniority_pct as "seniorityPct",
        notes,
        updated_at as "updatedAt"
    `;

    const updated = result[0];
    return NextResponse.json({
      ...updated,
      id: Number(updated.id),
      companyId: Number(updated.companyId),
      unionCategoryId: Number(updated.unionCategoryId),
      dailyRate: parseFloat(updated.dailyRate),
      hourlyRate: updated.hourlyRate ? parseFloat(updated.hourlyRate) : null,
      presenteeismRate: updated.presenteeismRate ? parseFloat(updated.presenteeismRate) : null,
      seniorityPct: updated.seniorityPct ? parseFloat(updated.seniorityPct) : null
    });
  } catch (error) {
    console.error('Error actualizando tasa:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

// DELETE - Eliminar tasa de convenio (solo si no está en uso)
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const auth = await getPayrollAuth();
    if (!auth || !hasPayrollAccess(auth.user)) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const categoryId = parseInt(params.categoryId);
    const { searchParams } = new URL(request.url);
    const rateId = searchParams.get('rateId');

    if (!rateId) {
      return NextResponse.json(
        { error: 'El ID de la tasa es requerido' },
        { status: 400 }
      );
    }

    // Verificar que existe
    const existing = await prisma.$queryRaw<any[]>`
      SELECT ar.id, ar.effective_from
      FROM agreement_rates ar
      WHERE ar.id = ${parseInt(rateId)}
        AND ar.union_category_id = ${categoryId}
        AND ar.company_id = ${auth.companyId}
    `;

    if (existing.length === 0) {
      return NextResponse.json(
        { error: 'Tasa no encontrada' },
        { status: 404 }
      );
    }

    // Verificar que no hay liquidaciones que usen esta tasa
    // (por el rango de fechas)
    const usageCheck = await prisma.$queryRaw<any[]>`
      SELECT COUNT(*)::int as count
      FROM payroll_run_items pri
      JOIN payroll_runs pr ON pr.id = pri.run_id
      JOIN payroll_periods pp ON pp.id = pr.period_id
      JOIN employees e ON e.id = pri.employee_id
      WHERE e.union_category_id = ${categoryId}
        AND pp.period_start >= ${existing[0].effective_from}::date
        AND pr.status IN ('APPROVED', 'PAID', 'LOCKED')
    `;

    if (usageCheck[0].count > 0) {
      return NextResponse.json(
        { error: 'No se puede eliminar: hay liquidaciones que usan esta tasa' },
        { status: 400 }
      );
    }

    // Eliminar
    await prisma.$queryRaw`
      DELETE FROM agreement_rates
      WHERE id = ${parseInt(rateId)}
    `;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error eliminando tasa:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
