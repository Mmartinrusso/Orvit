import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyAuth } from '@/lib/auth';

export const dynamic = 'force-dynamic';

// GET - Listar todos los templates
export async function GET(request: NextRequest) {
  try {
    const auth = await verifyAuth(request);
    if (!auth || auth.role !== 'SUPERADMIN') {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const templates = await prisma.$queryRaw`
      SELECT
        ct.*,
        (SELECT COUNT(*) FROM "Company" c WHERE c."templateId" = ct.id) as "companiesCount"
      FROM "company_templates" ct
      ORDER BY ct."isDefault" DESC, ct."usageCount" DESC, ct."name" ASC
    ` as any[];

    // Get modules for each template
    const modules = await prisma.$queryRaw`
      SELECT "key", "name", "category", "icon" FROM "modules" WHERE "isActive" = true
    ` as any[];

    const modulesMap = new Map(modules.map(m => [m.key, m]));

    // Convert BigInt to Number for JSON serialization
    const templatesWithModules = templates.map(t => ({
      ...t,
      companiesCount: Number(t.companiesCount || 0),
      usageCount: Number(t.usageCount || 0),
      modules: (t.moduleKeys || []).map((key: string) => modulesMap.get(key)).filter(Boolean)
    }));

    return NextResponse.json({ templates: templatesWithModules, modules });
  } catch (error) {
    console.error('Error fetching templates:', error);
    return NextResponse.json({ error: 'Error al obtener templates' }, { status: 500 });
  }
}

// POST - Crear nuevo template
export async function POST(request: NextRequest) {
  try {
    const auth = await verifyAuth(request);
    if (!auth || auth.role !== 'SUPERADMIN') {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const body = await request.json();
    const { name, description, icon, color, moduleKeys, config, isDefault } = body;

    if (!name) {
      return NextResponse.json({ error: 'El nombre es requerido' }, { status: 400 });
    }

    // If setting as default, unset other defaults
    if (isDefault) {
      await prisma.$executeRaw`
        UPDATE "company_templates" SET "isDefault" = false WHERE "isDefault" = true
      `;
    }

    const id = crypto.randomUUID();

    await prisma.$executeRaw`
      INSERT INTO "company_templates" ("id", "name", "description", "icon", "color", "moduleKeys", "config", "isDefault", "createdBy")
      VALUES (${id}, ${name}, ${description}, ${icon}, ${color || '#8B5CF6'}, ${moduleKeys || []}::TEXT[], ${JSON.stringify(config || {})}::JSONB, ${isDefault || false}, ${auth.userId})
    `;

    return NextResponse.json({ success: true, id });
  } catch (error: any) {
    console.error('Error creating template:', error);
    if (error.code === '23505') {
      return NextResponse.json({ error: 'Ya existe un template con ese nombre' }, { status: 400 });
    }
    return NextResponse.json({ error: 'Error al crear template' }, { status: 500 });
  }
}
