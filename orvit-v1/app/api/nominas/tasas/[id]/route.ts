import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getPayrollAuth, hasPayrollAccess } from '@/lib/nominas/auth-helper';

export const dynamic = 'force-dynamic';

interface RouteParams {
  params: { id: string };
}

// GET - Obtener una tasa específica
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const auth = await getPayrollAuth();
    if (!auth) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const rateId = parseInt(params.id);
    if (isNaN(rateId)) {
      return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
    }

    const result = await prisma.$queryRaw<any[]>`
      SELECT
        ar.id,
        ar.category_id as "categoryId",
        ar.company_id as "companyId",
        ar.gremio,
        ar.effective_from as "effectiveFrom",
        ar.effective_to as "effectiveTo",
        ar.daily_rate as "dailyRate",
        ar.hourly_rate as "hourlyRate",
        ar.presenteeism_rate as "presenteeismRate",
        ar.seniority_pct as "seniorityPct",
        ar.notes,
        ar.created_at as "createdAt",
        ec.name as "categoryName"
      FROM agreement_rates ar
      JOIN employee_categories ec ON ec.id = ar.category_id
      WHERE ar.id = ${rateId} AND ar.company_id = ${auth.companyId}
    `;

    if (result.length === 0) {
      return NextResponse.json({ error: 'Tasa no encontrada' }, { status: 404 });
    }

    const rate = result[0];
    return NextResponse.json({
      ...rate,
      id: Number(rate.id),
      categoryId: Number(rate.categoryId),
      companyId: Number(rate.companyId),
      dailyRate: parseFloat(rate.dailyRate),
      hourlyRate: rate.hourlyRate ? parseFloat(rate.hourlyRate) : null,
      presenteeismRate: rate.presenteeismRate ? parseFloat(rate.presenteeismRate) : null,
      seniorityPct: rate.seniorityPct ? parseFloat(rate.seniorityPct) : null
    });
  } catch (error) {
    console.error('Error obteniendo tasa:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

// PUT - Actualizar una tasa
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const auth = await getPayrollAuth();
    if (!auth || !hasPayrollAccess(auth.user)) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const rateId = parseInt(params.id);
    if (isNaN(rateId)) {
      return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
    }

    const body = await request.json();
    const {
      gremio,
      effectiveFrom,
      effectiveTo,
      dailyRate,
      hourlyRate,
      presenteeismRate,
      seniorityPct,
      notes
    } = body;

    // Verificar que existe y pertenece a la empresa
    const existing = await prisma.$queryRaw<any[]>`
      SELECT id, category_id FROM agreement_rates
      WHERE id = ${rateId} AND company_id = ${auth.companyId}
    `;

    if (existing.length === 0) {
      return NextResponse.json({ error: 'Tasa no encontrada' }, { status: 404 });
    }

    const result = await prisma.$queryRaw<any[]>`
      UPDATE agreement_rates
      SET
        gremio = COALESCE(${gremio}, gremio),
        effective_from = COALESCE(${effectiveFrom ? new Date(effectiveFrom) : null}::date, effective_from),
        effective_to = ${effectiveTo ? new Date(effectiveTo) : null}::date,
        daily_rate = COALESCE(${dailyRate ? parseFloat(dailyRate) : null}, daily_rate),
        hourly_rate = ${hourlyRate !== undefined ? (hourlyRate ? parseFloat(hourlyRate) : null) : null},
        presenteeism_rate = ${presenteeismRate !== undefined ? (presenteeismRate ? parseFloat(presenteeismRate) : null) : null},
        seniority_pct = ${seniorityPct !== undefined ? (seniorityPct ? parseFloat(seniorityPct) : null) : null},
        notes = ${notes !== undefined ? notes : null},
        updated_at = NOW()
      WHERE id = ${rateId} AND company_id = ${auth.companyId}
      RETURNING
        id,
        category_id as "categoryId",
        company_id as "companyId",
        gremio,
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
      categoryId: Number(updated.categoryId),
      companyId: Number(updated.companyId),
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

// DELETE - Eliminar una tasa
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const auth = await getPayrollAuth();
    if (!auth || !hasPayrollAccess(auth.user)) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const rateId = parseInt(params.id);
    if (isNaN(rateId)) {
      return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
    }

    // Verificar que existe
    const existing = await prisma.$queryRaw<any[]>`
      SELECT id FROM agreement_rates
      WHERE id = ${rateId} AND company_id = ${auth.companyId}
    `;

    if (existing.length === 0) {
      return NextResponse.json({ error: 'Tasa no encontrada' }, { status: 404 });
    }

    // Eliminar la tasa
    await prisma.$queryRaw`
      DELETE FROM agreement_rates
      WHERE id = ${rateId} AND company_id = ${auth.companyId}
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
