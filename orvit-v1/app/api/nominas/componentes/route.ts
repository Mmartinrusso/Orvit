import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { getPayrollAuth, hasPayrollAccess } from '@/lib/nominas/auth-helper';
import { hasUserPermission } from '@/lib/permissions-helpers';

export const dynamic = 'force-dynamic';

// GET - Obtener componentes salariales
export async function GET(request: NextRequest) {
  try {
    const auth = await getPayrollAuth();
    if (!auth) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type'); // EARNING | DEDUCTION | EMPLOYER_COST
    const conceptType = searchParams.get('conceptType'); // CALCULATED | FIXED_INPUT | VARIABLE_INPUT
    const unionId = searchParams.get('unionId'); // Filtrar por gremio específico
    const includeGlobal = searchParams.get('includeGlobal') !== 'false'; // Por defecto incluye globales
    const includeInactive = searchParams.get('includeInactive') === 'true';

    // Verificar si la columna union_id existe en salary_components
    const columnCheck = await prisma.$queryRaw<any[]>`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'salary_components' AND column_name = 'union_id'
    `;
    const hasUnionColumn = columnCheck.length > 0;

    // Construir condiciones dinámicas con Prisma.sql
    const typeCondition = type
      ? Prisma.sql`AND sc.type = ${type}`
      : Prisma.empty;
    const conceptCondition = conceptType
      ? Prisma.sql`AND sc.concept_type = ${conceptType}`
      : Prisma.empty;
    const activeCondition = !includeInactive
      ? Prisma.sql`AND sc.is_active = true`
      : Prisma.empty;

    // Filtro por gremio: si se especifica unionId y la columna existe
    let unionCondition = Prisma.empty;
    if (unionId && hasUnionColumn) {
      if (includeGlobal) {
        unionCondition = Prisma.sql`AND (sc.union_id = ${parseInt(unionId)} OR sc.union_id IS NULL)`;
      } else {
        unionCondition = Prisma.sql`AND sc.union_id = ${parseInt(unionId)}`;
      }
    }

    let components: any[];

    if (hasUnionColumn) {
      // Query con soporte de union_id
      components = await prisma.$queryRaw<any[]>`
        SELECT
          sc.id,
          sc.company_id as "companyId",
          sc.union_id as "unionId",
          pu.name as "unionName",
          sc.code,
          sc.name,
          sc.type,
          sc.concept_type as "conceptType",
          sc.calc_type as "calcType",
          sc.calc_value as "calcValue",
          sc.calc_formula as "calcFormula",
          sc.base_variable as "baseVariable",
          sc.depends_on as "dependsOn",
          sc.rounding_mode as "roundingMode",
          sc.rounding_decimals as "roundingDecimals",
          sc.cap_min as "capMin",
          sc.cap_max as "capMax",
          sc.is_remunerative as "isRemunerative",
          sc.affects_employee_contrib as "affectsEmployeeContrib",
          sc.affects_employer_contrib as "affectsEmployerContrib",
          sc.affects_income_tax as "affectsIncomeTax",
          sc.is_taxable as "isTaxable",
          sc.is_active as "isActive",
          sc.apply_to as "applyTo",
          sc.prorate_on_partial as "prorateOnPartial",
          sc."order",
          sc.created_at as "createdAt"
        FROM salary_components sc
        LEFT JOIN payroll_unions pu ON pu.id = sc.union_id
        WHERE sc.company_id = ${auth.companyId}
          ${typeCondition}
          ${conceptCondition}
          ${unionCondition}
          ${activeCondition}
        ORDER BY sc.union_id NULLS FIRST, sc."order" ASC, sc.type, sc.name ASC
      `;
    } else {
      // Query sin union_id (para bases de datos sin la migración)
      components = await prisma.$queryRaw<any[]>`
        SELECT
          sc.id,
          sc.company_id as "companyId",
          NULL as "unionId",
          NULL as "unionName",
          sc.code,
          sc.name,
          sc.type,
          sc.concept_type as "conceptType",
          sc.calc_type as "calcType",
          sc.calc_value as "calcValue",
          sc.calc_formula as "calcFormula",
          sc.base_variable as "baseVariable",
          sc.depends_on as "dependsOn",
          sc.rounding_mode as "roundingMode",
          sc.rounding_decimals as "roundingDecimals",
          sc.cap_min as "capMin",
          sc.cap_max as "capMax",
          sc.is_remunerative as "isRemunerative",
          sc.affects_employee_contrib as "affectsEmployeeContrib",
          sc.affects_employer_contrib as "affectsEmployerContrib",
          sc.affects_income_tax as "affectsIncomeTax",
          sc.is_taxable as "isTaxable",
          sc.is_active as "isActive",
          sc.apply_to as "applyTo",
          sc.prorate_on_partial as "prorateOnPartial",
          sc."order",
          sc.created_at as "createdAt"
        FROM salary_components sc
        WHERE sc.company_id = ${auth.companyId}
          ${typeCondition}
          ${conceptCondition}
          ${activeCondition}
        ORDER BY sc."order" ASC, sc.type, sc.name ASC
      `;
    }

    const processedComponents = components.map((c: any) => ({
      ...c,
      id: Number(c.id),
      companyId: Number(c.companyId),
      unionId: c.unionId ? Number(c.unionId) : null,
      calcValue: c.calcValue ? parseFloat(c.calcValue) : null,
      capMin: c.capMin ? parseFloat(c.capMin) : null,
      capMax: c.capMax ? parseFloat(c.capMax) : null,
      roundingDecimals: Number(c.roundingDecimals),
      order: Number(c.order)
    }));

    return NextResponse.json(processedComponents);
  } catch (error) {
    console.error('Error obteniendo componentes:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

// POST - Crear componente salarial
export async function POST(request: NextRequest) {
  try {
    const auth = await getPayrollAuth();
    if (!auth || !hasPayrollAccess(auth.user)) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    // Permission check: ingresar_nominas
    const hasPerm = await hasUserPermission(auth.user.id, auth.companyId, 'ingresar_nominas');
    if (!hasPerm) return NextResponse.json({ error: 'Sin permisos' }, { status: 403 });

    const body = await request.json();
    const {
      code,
      name,
      unionId, // Gremio al que pertenece (null = global)
      type = 'EARNING',
      conceptType = 'FIXED_INPUT',
      calcType = 'FIXED',
      calcValue,
      calcFormula,
      baseVariable = 'GROSS_REMUNERATIVE',
      dependsOn = [],
      roundingMode = 'HALF_UP',
      roundingDecimals = 2,
      capMin,
      capMax,
      isRemunerative = true,
      affectsEmployeeContrib = true,
      affectsEmployerContrib = true,
      affectsIncomeTax = false,
      isTaxable = true,
      applyTo = 'ALL',
      prorateOnPartial = true,
      order = 0
    } = body;

    if (!code || !name) {
      return NextResponse.json(
        { error: 'code y name son requeridos' },
        { status: 400 }
      );
    }

    // Verificar si la columna union_id existe
    const columnCheck = await prisma.$queryRaw<any[]>`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'salary_components' AND column_name = 'union_id'
    `;
    const hasUnionColumn = columnCheck.length > 0;

    // Verificar que el código no exista
    let existing: any[];
    if (hasUnionColumn && unionId) {
      existing = await prisma.$queryRaw<any[]>`
        SELECT id FROM salary_components
        WHERE company_id = ${auth.companyId} AND code = ${code.toUpperCase()}
          AND union_id = ${parseInt(unionId)}
      `;
    } else if (hasUnionColumn) {
      existing = await prisma.$queryRaw<any[]>`
        SELECT id FROM salary_components
        WHERE company_id = ${auth.companyId} AND code = ${code.toUpperCase()}
          AND union_id IS NULL
      `;
    } else {
      existing = await prisma.$queryRaw<any[]>`
        SELECT id FROM salary_components
        WHERE company_id = ${auth.companyId} AND code = ${code.toUpperCase()}
      `;
    }

    if (existing.length > 0) {
      return NextResponse.json(
        { error: 'Ya existe un componente con ese código' + (unionId && hasUnionColumn ? ' en este gremio' : '') },
        { status: 400 }
      );
    }

    // Si se especifica unionId y la columna existe, verificar que el gremio pertenece a la empresa
    if (unionId && hasUnionColumn) {
      const union = await prisma.$queryRaw<any[]>`
        SELECT id FROM payroll_unions
        WHERE id = ${parseInt(unionId)} AND company_id = ${auth.companyId}
      `;
      if (union.length === 0) {
        return NextResponse.json(
          { error: 'Gremio no encontrado' },
          { status: 400 }
        );
      }
    }

    let result: any[];

    if (hasUnionColumn) {
      result = await prisma.$queryRaw<any[]>`
        INSERT INTO salary_components (
          company_id, union_id, code, name, type, concept_type,
          calc_type, calc_value, calc_formula, base_variable,
          depends_on, rounding_mode, rounding_decimals,
          cap_min, cap_max, is_remunerative,
          affects_employee_contrib, affects_employer_contrib, affects_income_tax,
          is_taxable, is_active, apply_to, prorate_on_partial, "order",
          created_at, updated_at
        )
        VALUES (
          ${auth.companyId},
          ${unionId ? parseInt(unionId) : null},
          ${code.toUpperCase()},
          ${name},
          ${type},
          ${conceptType},
          ${calcType},
          ${calcValue ? parseFloat(String(calcValue)) : null},
          ${calcFormula || null},
          ${baseVariable},
          ${dependsOn}::int[],
          ${roundingMode},
          ${roundingDecimals},
          ${capMin ? parseFloat(String(capMin)) : null},
          ${capMax ? parseFloat(String(capMax)) : null},
          ${isRemunerative},
          ${affectsEmployeeContrib},
          ${affectsEmployerContrib},
          ${affectsIncomeTax},
          ${isTaxable},
          true,
          ${applyTo},
          ${prorateOnPartial},
          ${order},
          NOW(),
          NOW()
        )
        RETURNING
          id, union_id as "unionId", code, name, type, concept_type as "conceptType",
          is_remunerative as "isRemunerative", is_active as "isActive"
      `;
    } else {
      result = await prisma.$queryRaw<any[]>`
        INSERT INTO salary_components (
          company_id, code, name, type, concept_type,
          calc_type, calc_value, calc_formula, base_variable,
          depends_on, rounding_mode, rounding_decimals,
          cap_min, cap_max, is_remunerative,
          affects_employee_contrib, affects_employer_contrib, affects_income_tax,
          is_taxable, is_active, apply_to, prorate_on_partial, "order",
          created_at, updated_at
        )
        VALUES (
          ${auth.companyId},
          ${code.toUpperCase()},
          ${name},
          ${type},
          ${conceptType},
          ${calcType},
          ${calcValue ? parseFloat(String(calcValue)) : null},
          ${calcFormula || null},
          ${baseVariable},
          ${dependsOn}::int[],
          ${roundingMode},
          ${roundingDecimals},
          ${capMin ? parseFloat(String(capMin)) : null},
          ${capMax ? parseFloat(String(capMax)) : null},
          ${isRemunerative},
          ${affectsEmployeeContrib},
          ${affectsEmployerContrib},
          ${affectsIncomeTax},
          ${isTaxable},
          true,
          ${applyTo},
          ${prorateOnPartial},
          ${order},
          NOW(),
          NOW()
        )
        RETURNING
          id, code, name, type, concept_type as "conceptType",
          is_remunerative as "isRemunerative", is_active as "isActive"
      `;
    }

    const newComponent = result[0];
    return NextResponse.json({
      ...newComponent,
      id: Number(newComponent.id),
      unionId: newComponent.unionId ? Number(newComponent.unionId) : null
    }, { status: 201 });
  } catch (error) {
    console.error('Error creando componente:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
