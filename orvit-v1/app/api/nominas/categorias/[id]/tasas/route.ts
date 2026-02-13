import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getPayrollAuth, hasPayrollAccess } from '@/lib/nominas/auth-helper';

export const dynamic = 'force-dynamic';

interface RouteParams {
  params: { id: string };
}

// GET - Obtener historial de tasas de una categoría
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const auth = await getPayrollAuth();
    if (!auth) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const categoryId = parseInt(params.id);
    if (isNaN(categoryId)) {
      return NextResponse.json({ error: 'ID de categoría inválido' }, { status: 400 });
    }

    // Verificar que la categoría pertenece a la empresa
    const category = await prisma.$queryRaw<any[]>`
      SELECT id, name, gremio FROM employee_categories
      WHERE id = ${categoryId} AND company_id = ${auth.companyId}
    `;

    if (category.length === 0) {
      return NextResponse.json({ error: 'Categoría no encontrada' }, { status: 404 });
    }

    // Obtener todas las tasas de la categoría ordenadas por fecha
    const rates = await prisma.$queryRaw<any[]>`
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
        ar.updated_at as "updatedAt",
        CASE
          WHEN ar.effective_from <= CURRENT_DATE
            AND (ar.effective_to IS NULL OR ar.effective_to >= CURRENT_DATE)
          THEN true
          ELSE false
        END as "isCurrent"
      FROM agreement_rates ar
      WHERE ar.category_id = ${categoryId}
        AND ar.company_id = ${auth.companyId}
      ORDER BY ar.effective_from DESC
    `;

    const processedRates = rates.map((rate: any) => ({
      ...rate,
      id: Number(rate.id),
      categoryId: Number(rate.categoryId),
      companyId: Number(rate.companyId),
      dailyRate: parseFloat(rate.dailyRate),
      hourlyRate: rate.hourlyRate ? parseFloat(rate.hourlyRate) : null,
      presenteeismRate: rate.presenteeismRate ? parseFloat(rate.presenteeismRate) : null,
      seniorityPct: rate.seniorityPct ? parseFloat(rate.seniorityPct) : null
    }));

    return NextResponse.json({
      category: {
        id: Number(category[0].id),
        name: category[0].name,
        gremio: category[0].gremio
      },
      rates: processedRates
    });
  } catch (error) {
    console.error('Error obteniendo tasas de convenio:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

// POST - Agregar nueva tasa de convenio
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const auth = await getPayrollAuth();
    if (!auth || !hasPayrollAccess(auth.user)) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const categoryId = parseInt(params.id);
    if (isNaN(categoryId)) {
      return NextResponse.json({ error: 'ID de categoría inválido' }, { status: 400 });
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

    // Validaciones
    if (!effectiveFrom || !dailyRate) {
      return NextResponse.json(
        { error: 'Fecha de vigencia y tasa diaria son requeridos' },
        { status: 400 }
      );
    }

    // Verificar que la categoría pertenece a la empresa
    const category = await prisma.$queryRaw<any[]>`
      SELECT id, gremio FROM employee_categories
      WHERE id = ${categoryId} AND company_id = ${auth.companyId}
    `;

    if (category.length === 0) {
      return NextResponse.json({ error: 'Categoría no encontrada' }, { status: 404 });
    }

    // Cerrar tasa anterior si existe una vigente
    await prisma.$queryRaw`
      UPDATE agreement_rates
      SET
        effective_to = ${new Date(effectiveFrom)}::date - interval '1 day',
        updated_at = NOW()
      WHERE category_id = ${categoryId}
        AND company_id = ${auth.companyId}
        AND effective_to IS NULL
        AND effective_from < ${new Date(effectiveFrom)}::date
    `;

    // Insertar nueva tasa
    const result = await prisma.$queryRaw<any[]>`
      INSERT INTO agreement_rates (
        company_id, category_id, gremio,
        effective_from, effective_to,
        daily_rate, hourly_rate, presenteeism_rate, seniority_pct,
        notes, created_at, updated_at
      )
      VALUES (
        ${auth.companyId},
        ${categoryId},
        ${gremio || category[0].gremio || 'Sin Gremio'},
        ${new Date(effectiveFrom)}::date,
        ${effectiveTo ? new Date(effectiveTo) : null}::date,
        ${parseFloat(dailyRate)},
        ${hourlyRate ? parseFloat(hourlyRate) : null},
        ${presenteeismRate ? parseFloat(presenteeismRate) : null},
        ${seniorityPct ? parseFloat(seniorityPct) : null},
        ${notes || null},
        NOW(),
        NOW()
      )
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
        created_at as "createdAt"
    `;

    const newRate = result[0];
    return NextResponse.json({
      ...newRate,
      id: Number(newRate.id),
      categoryId: Number(newRate.categoryId),
      companyId: Number(newRate.companyId),
      dailyRate: parseFloat(newRate.dailyRate),
      hourlyRate: newRate.hourlyRate ? parseFloat(newRate.hourlyRate) : null,
      presenteeismRate: newRate.presenteeismRate ? parseFloat(newRate.presenteeismRate) : null,
      seniorityPct: newRate.seniorityPct ? parseFloat(newRate.seniorityPct) : null,
      isCurrent: true
    }, { status: 201 });
  } catch (error) {
    console.error('Error creando tasa de convenio:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
