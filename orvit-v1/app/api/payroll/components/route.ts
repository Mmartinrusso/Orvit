/**
 * API de Componentes Salariales (Fórmulas)
 *
 * GET  /api/payroll/components - Listar componentes
 * POST /api/payroll/components - Crear componente
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getPayrollAuthUser } from '@/lib/payroll/auth-helper';
import { validateFormula } from '@/lib/payroll/formula-parser';
import { DEFAULT_COMPONENTS_AR } from '@/lib/payroll/config';

export const dynamic = 'force-dynamic';

// GET - Listar componentes
export async function GET(request: NextRequest) {
  try {
    const user = await getPayrollAuthUser();
    if (!user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const activeOnly = searchParams.get('active') !== 'false';

    const components = await prisma.salaryComponent.findMany({
      where: {
        company_id: user.companyId,
        ...(activeOnly ? { is_active: true } : {}),
      },
      orderBy: { order: 'asc' },
    });

    return NextResponse.json({
      components: components.map((c) => ({
        id: c.id,
        code: c.code,
        name: c.name,
        type: c.type,
        calcType: c.calc_type,
        calcValue: c.calc_value ? Number(c.calc_value) : null,
        calcFormula: c.calc_formula,
        baseVariable: c.base_variable,
        dependsOn: c.depends_on,
        roundingMode: c.rounding_mode,
        roundingDecimals: c.rounding_decimals,
        capMin: c.cap_min ? Number(c.cap_min) : null,
        capMax: c.cap_max ? Number(c.cap_max) : null,
        isTaxable: c.is_taxable,
        isActive: c.is_active,
        applyTo: c.apply_to,
        prorateOnPartial: c.prorate_on_partial,
        order: c.order,
      })),
    });
  } catch (error) {
    console.error('Error obteniendo componentes:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}

// POST - Crear componente
export async function POST(request: NextRequest) {
  try {
    const user = await getPayrollAuthUser();
    if (!user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const body = await request.json();

    // Si es inicialización con defaults
    if (body.initializeDefaults) {
      const existing = await prisma.salaryComponent.count({
        where: { company_id: user.companyId },
      });

      if (existing > 0) {
        return NextResponse.json(
          { error: 'Ya existen componentes configurados' },
          { status: 400 }
        );
      }

      // Crear componentes por defecto
      const created = await prisma.$transaction(
        DEFAULT_COMPONENTS_AR.map((comp) =>
          prisma.salaryComponent.create({
            data: {
              company_id: user.companyId,
              code: comp.code!,
              name: comp.name!,
              type: comp.type!,
              calc_type: comp.calcType!,
              calc_value: comp.calcValue,
              calc_formula: comp.calcFormula,
              base_variable: comp.baseVariable || 'gross',
              depends_on: comp.dependsOn || [],
              rounding_mode: comp.roundingMode || 'HALF_UP',
              rounding_decimals: comp.roundingDecimals ?? 2,
              cap_min: comp.capMin,
              cap_max: comp.capMax,
              is_taxable: comp.isTaxable ?? true,
              is_active: comp.isActive ?? true,
              apply_to: comp.applyTo || 'ALL',
              prorate_on_partial: comp.prorateOnPartial ?? true,
              order: comp.order ?? 0,
            },
          })
        )
      );

      return NextResponse.json({
        success: true,
        message: `${created.length} componentes creados`,
      });
    }

    // Crear componente individual
    const {
      code,
      name,
      type,
      calcType,
      calcValue,
      calcFormula,
      baseVariable = 'gross',
      dependsOn = [],
      roundingMode = 'HALF_UP',
      roundingDecimals = 2,
      capMin,
      capMax,
      isTaxable = true,
      isActive = true,
      applyTo = 'ALL',
      prorateOnPartial = true,
      order = 0,
    } = body;

    if (!code || !name || !type || !calcType) {
      return NextResponse.json(
        { error: 'code, name, type y calcType son requeridos' },
        { status: 400 }
      );
    }

    // Validar fórmula si existe
    if (calcFormula) {
      const validation = validateFormula(calcFormula);
      if (!validation.valid) {
        return NextResponse.json(
          { error: `Fórmula inválida: ${validation.error}` },
          { status: 400 }
        );
      }
    }

    const component = await prisma.salaryComponent.create({
      data: {
        company_id: user.companyId,
        code,
        name,
        type,
        calc_type: calcType,
        calc_value: calcValue,
        calc_formula: calcFormula,
        base_variable: baseVariable,
        depends_on: dependsOn,
        rounding_mode: roundingMode,
        rounding_decimals: roundingDecimals,
        cap_min: capMin,
        cap_max: capMax,
        is_taxable: isTaxable,
        is_active: isActive,
        apply_to: applyTo,
        prorate_on_partial: prorateOnPartial,
        order,
      },
    });

    return NextResponse.json({
      success: true,
      component: {
        id: component.id,
        code: component.code,
        name: component.name,
      },
    });
  } catch (error: any) {
    if (error.code === 'P2002') {
      return NextResponse.json(
        { error: 'Ya existe un componente con ese código' },
        { status: 400 }
      );
    }
    console.error('Error creando componente:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
