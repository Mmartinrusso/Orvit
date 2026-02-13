import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getPayrollAuth, hasPayrollAccess } from '@/lib/nominas/auth-helper';

export const dynamic = 'force-dynamic';

// GET - Listar plantillas de gremios disponibles
export async function GET(request: NextRequest) {
  try {
    const auth = await getPayrollAuth();
    if (!auth) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    // Obtener todas las plantillas con sus categorías
    const templates = await prisma.$queryRaw<any[]>`
      SELECT
        gt.id,
        gt.code,
        gt.name,
        gt.full_name as "fullName",
        gt.convention_code as "conventionCode",
        gt.payment_schedule_type as "paymentScheduleType",
        gt.description,
        gt.is_active as "isActive",
        (
          SELECT COUNT(*)::int
          FROM gremio_category_templates gct
          WHERE gct.gremio_template_id = gt.id
        ) as "categoryCount"
      FROM gremio_templates gt
      WHERE gt.is_active = true
      ORDER BY gt.name ASC
    `;

    // Obtener qué gremios ya tiene habilitados la empresa
    const enabledUnions = await prisma.$queryRaw<any[]>`
      SELECT source_template_id as "templateId"
      FROM payroll_unions
      WHERE company_id = ${auth.companyId}
        AND source_template_id IS NOT NULL
        AND is_active = true
    `;

    const enabledTemplateIds = new Set(enabledUnions.map(u => Number(u.templateId)));

    const processedTemplates = templates.map((t: any) => ({
      ...t,
      id: Number(t.id),
      categoryCount: Number(t.categoryCount),
      isEnabled: enabledTemplateIds.has(Number(t.id))
    }));

    return NextResponse.json({
      templates: processedTemplates,
      total: processedTemplates.length
    });
  } catch (error) {
    console.error('Error obteniendo plantillas de gremios:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

// POST - Habilitar un gremio de plantilla para la empresa
export async function POST(request: NextRequest) {
  try {
    const auth = await getPayrollAuth();
    if (!auth || !hasPayrollAccess(auth.user)) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const body = await request.json();
    const { templateId } = body;

    if (!templateId) {
      return NextResponse.json(
        { error: 'templateId es requerido' },
        { status: 400 }
      );
    }

    // Verificar que la plantilla existe
    const template = await prisma.$queryRaw<any[]>`
      SELECT id, code, name, full_name, convention_code,
             payment_schedule_type, payment_rule_json,
             attendance_policy_json, contribution_rules_json
      FROM gremio_templates
      WHERE id = ${parseInt(templateId)} AND is_active = true
    `;

    if (template.length === 0) {
      return NextResponse.json(
        { error: 'Plantilla no encontrada' },
        { status: 404 }
      );
    }

    // Verificar que la empresa no tiene ya este gremio habilitado
    const existing = await prisma.$queryRaw<any[]>`
      SELECT id FROM payroll_unions
      WHERE company_id = ${auth.companyId}
        AND source_template_id = ${parseInt(templateId)}
        AND is_active = true
    `;

    if (existing.length > 0) {
      return NextResponse.json(
        { error: 'Este gremio ya está habilitado para tu empresa' },
        { status: 400 }
      );
    }

    const t = template[0];

    // Crear el gremio para la empresa
    const newUnion = await prisma.$queryRaw<any[]>`
      INSERT INTO payroll_unions (
        company_id, source_template_id, name, code, convention_code,
        payment_schedule_type, payment_rule_json,
        attendance_policy_json, contribution_rules_json,
        is_active, created_at, updated_at
      )
      VALUES (
        ${auth.companyId},
        ${parseInt(templateId)},
        ${t.name},
        ${t.code},
        ${t.convention_code},
        ${t.payment_schedule_type},
        ${t.payment_rule_json}::jsonb,
        ${t.attendance_policy_json}::jsonb,
        ${t.contribution_rules_json}::jsonb,
        true,
        NOW(),
        NOW()
      )
      RETURNING id
    `;

    const unionId = Number(newUnion[0].id);

    // Copiar las categorías de la plantilla
    await prisma.$queryRaw`
      INSERT INTO union_categories (
        union_id, code, name, description, level,
        is_active, created_at, updated_at
      )
      SELECT
        ${unionId},
        gct.code,
        gct.name,
        COALESCE(gct.group_name || ': ', '') || COALESCE(gct.description, ''),
        gct.level,
        true,
        NOW(),
        NOW()
      FROM gremio_category_templates gct
      WHERE gct.gremio_template_id = ${parseInt(templateId)}
      ORDER BY gct.level ASC
    `;

    // Contar categorías creadas
    const categoryCount = await prisma.$queryRaw<any[]>`
      SELECT COUNT(*)::int as count
      FROM union_categories
      WHERE union_id = ${unionId}
    `;

    return NextResponse.json({
      success: true,
      unionId,
      categoryCount: Number(categoryCount[0].count),
      message: `Gremio ${t.name} habilitado con ${categoryCount[0].count} categorías`
    }, { status: 201 });
  } catch (error) {
    console.error('Error habilitando gremio:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
