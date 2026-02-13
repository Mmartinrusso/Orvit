import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getPayrollAuth, hasPayrollAccess } from '@/lib/nominas/auth-helper';

export const dynamic = 'force-dynamic';

// Tipos de schedule de pago
export type PaymentScheduleType =
  | 'BIWEEKLY_FIXED'      // Quincenal: días fijos (15, 30)
  | 'BIWEEKLY_1_15_16_EOM' // Quincenal: 1-15 y 16-fin de mes
  | 'MONTHLY_SAME_MONTH'   // Mensual: mismo mes
  | 'MONTHLY_NEXT_MONTH';  // Mensual: mes siguiente

// GET - Obtener categorías de empleados con campos v4
export async function GET(request: NextRequest) {
  try {
    const auth = await getPayrollAuth();
    if (!auth) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const includeInactive = searchParams.get('includeInactive') === 'true';

    // Intentar query con campos v4, si falla usar query básica
    let categories: any[];
    let hasV4Columns = true;

    try {
      // Query con campos v4 - queries separadas según includeInactive
      if (includeInactive) {
        categories = await prisma.$queryRaw<any[]>`
          SELECT
            ec.id,
            ec.name,
            ec.description,
            ec.is_active as "isActive",
            ec.company_id as "companyId",
            ec.gremio,
            ec.convention_code as "conventionCode",
            ec.payment_schedule_type as "paymentScheduleType",
            ec.payment_rule_json as "paymentRuleJson",
            ec.attendance_policy_json as "attendancePolicyJson",
            ec.created_at as "createdAt",
            ec.updated_at as "updatedAt",
            (
              SELECT COUNT(*)::int
              FROM employees e
              WHERE e.category_id = ec.id
                AND e.company_id = ${auth.companyId}
                AND e.active = true
            ) as "employeeCount",
            (
              SELECT json_build_object(
                'dailyRate', ar.daily_rate,
                'hourlyRate', ar.hourly_rate,
                'presenteeismRate', ar.presenteeism_rate,
                'effectiveFrom', ar.effective_from
              )
              FROM agreement_rates ar
              WHERE ar.category_id = ec.id
                AND ar.effective_from <= CURRENT_DATE
                AND (ar.effective_to IS NULL OR ar.effective_to >= CURRENT_DATE)
              ORDER BY ar.effective_from DESC
              LIMIT 1
            ) as "currentRate"
          FROM employee_categories ec
          WHERE ec.company_id = ${auth.companyId}
          ORDER BY ec.name ASC
        `;
      } else {
        categories = await prisma.$queryRaw<any[]>`
          SELECT
            ec.id,
            ec.name,
            ec.description,
            ec.is_active as "isActive",
            ec.company_id as "companyId",
            ec.gremio,
            ec.convention_code as "conventionCode",
            ec.payment_schedule_type as "paymentScheduleType",
            ec.payment_rule_json as "paymentRuleJson",
            ec.attendance_policy_json as "attendancePolicyJson",
            ec.created_at as "createdAt",
            ec.updated_at as "updatedAt",
            (
              SELECT COUNT(*)::int
              FROM employees e
              WHERE e.category_id = ec.id
                AND e.company_id = ${auth.companyId}
                AND e.active = true
            ) as "employeeCount",
            (
              SELECT json_build_object(
                'dailyRate', ar.daily_rate,
                'hourlyRate', ar.hourly_rate,
                'presenteeismRate', ar.presenteeism_rate,
                'effectiveFrom', ar.effective_from
              )
              FROM agreement_rates ar
              WHERE ar.category_id = ec.id
                AND ar.effective_from <= CURRENT_DATE
                AND (ar.effective_to IS NULL OR ar.effective_to >= CURRENT_DATE)
              ORDER BY ar.effective_from DESC
              LIMIT 1
            ) as "currentRate"
          FROM employee_categories ec
          WHERE ec.company_id = ${auth.companyId}
            AND ec.is_active = true
          ORDER BY ec.name ASC
        `;
      }
    } catch (e) {
      // Fallback: query básica sin campos v4
      hasV4Columns = false;
      console.log('⚠️ Usando query básica - ejecutar migración SQL para habilitar campos v4');
      if (includeInactive) {
        categories = await prisma.$queryRaw<any[]>`
          SELECT
            ec.id,
            ec.name,
            ec.description,
            ec.is_active as "isActive",
            ec.company_id as "companyId",
            ec.created_at as "createdAt",
            ec.updated_at as "updatedAt",
            (
              SELECT COUNT(*)::int
              FROM employees e
              WHERE e.category_id = ec.id
                AND e.company_id = ${auth.companyId}
                AND e.active = true
            ) as "employeeCount"
          FROM employee_categories ec
          WHERE ec.company_id = ${auth.companyId}
          ORDER BY ec.name ASC
        `;
      } else {
        categories = await prisma.$queryRaw<any[]>`
          SELECT
            ec.id,
            ec.name,
            ec.description,
            ec.is_active as "isActive",
            ec.company_id as "companyId",
            ec.created_at as "createdAt",
            ec.updated_at as "updatedAt",
            (
              SELECT COUNT(*)::int
              FROM employees e
              WHERE e.category_id = ec.id
                AND e.company_id = ${auth.companyId}
                AND e.active = true
            ) as "employeeCount"
          FROM employee_categories ec
          WHERE ec.company_id = ${auth.companyId}
            AND ec.is_active = true
          ORDER BY ec.name ASC
        `;
      }
    }

    // Procesar resultados para serialización
    const processedCategories = categories.map((cat: any) => ({
      ...cat,
      id: Number(cat.id),
      companyId: Number(cat.companyId),
      employeeCount: Number(cat.employeeCount || 0),
      // Campos v4 (pueden no existir)
      gremio: cat.gremio || null,
      conventionCode: cat.conventionCode || null,
      paymentScheduleType: cat.paymentScheduleType || 'BIWEEKLY_FIXED',
      paymentRuleJson: cat.paymentRuleJson || null,
      attendancePolicyJson: cat.attendancePolicyJson || null,
      currentRate: cat.currentRate || null,
      _migrationPending: !hasV4Columns
    }));

    return NextResponse.json(processedCategories);
  } catch (error) {
    console.error('Error obteniendo categorías de nóminas:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

// POST - Crear nueva categoría con campos v4
export async function POST(request: NextRequest) {
  try {
    const auth = await getPayrollAuth();
    if (!auth || !hasPayrollAccess(auth.user)) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const body = await request.json();
    const {
      name,
      description,
      gremio,
      conventionCode,
      paymentScheduleType = 'BIWEEKLY_FIXED',
      paymentRuleJson,
      attendancePolicyJson
    } = body;

    if (!name) {
      return NextResponse.json(
        { error: 'El nombre es requerido' },
        { status: 400 }
      );
    }

    // Validar paymentScheduleType
    const validTypes = ['BIWEEKLY_FIXED', 'BIWEEKLY_1_15_16_EOM', 'MONTHLY_SAME_MONTH', 'MONTHLY_NEXT_MONTH'];
    if (!validTypes.includes(paymentScheduleType)) {
      return NextResponse.json(
        { error: 'Tipo de pago inválido' },
        { status: 400 }
      );
    }

    let result: any[];

    try {
      // Intentar con campos v4
      result = await prisma.$queryRaw<any[]>`
        INSERT INTO employee_categories (
          name, description, company_id, is_active,
          gremio, convention_code, payment_schedule_type,
          payment_rule_json, attendance_policy_json,
          created_at, updated_at
        )
        VALUES (
          ${name},
          ${description || null},
          ${auth.companyId},
          true,
          ${gremio || null},
          ${conventionCode || null},
          ${paymentScheduleType},
          ${paymentRuleJson ? JSON.stringify(paymentRuleJson) : null}::jsonb,
          ${attendancePolicyJson ? JSON.stringify(attendancePolicyJson) : null}::jsonb,
          NOW(),
          NOW()
        )
        RETURNING
          id,
          name,
          description,
          is_active as "isActive",
          company_id as "companyId",
          gremio,
          convention_code as "conventionCode",
          payment_schedule_type as "paymentScheduleType",
          payment_rule_json as "paymentRuleJson",
          attendance_policy_json as "attendancePolicyJson",
          created_at as "createdAt",
          updated_at as "updatedAt"
      `;
    } catch (e) {
      // Fallback: crear sin campos v4
      console.log('⚠️ Creando categoría sin campos v4 - ejecutar migración SQL');
      result = await prisma.$queryRaw<any[]>`
        INSERT INTO employee_categories (
          name, description, company_id, is_active,
          created_at, updated_at
        )
        VALUES (
          ${name},
          ${description || null},
          ${auth.companyId},
          true,
          NOW(),
          NOW()
        )
        RETURNING
          id,
          name,
          description,
          is_active as "isActive",
          company_id as "companyId",
          created_at as "createdAt",
          updated_at as "updatedAt"
      `;
    }

    const newCategory = result[0];
    return NextResponse.json({
      ...newCategory,
      id: Number(newCategory.id),
      companyId: Number(newCategory.companyId),
      employeeCount: 0,
      gremio: newCategory.gremio || null,
      conventionCode: newCategory.conventionCode || null,
      paymentScheduleType: newCategory.paymentScheduleType || 'BIWEEKLY_FIXED'
    }, { status: 201 });
  } catch (error) {
    console.error('Error creando categoría:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
