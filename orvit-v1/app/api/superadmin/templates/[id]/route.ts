import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyAuth } from '@/lib/auth';

export const dynamic = 'force-dynamic';

// GET - Obtener template por ID
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await verifyAuth(request);
    if (!auth || auth.role !== 'SUPERADMIN') {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const templates = await prisma.$queryRaw`
      SELECT * FROM "company_templates" WHERE "id" = ${params.id}
    ` as any[];

    if (templates.length === 0) {
      return NextResponse.json({ error: 'Template no encontrado' }, { status: 404 });
    }

    return NextResponse.json({ template: templates[0] });
  } catch (error) {
    console.error('Error fetching template:', error);
    return NextResponse.json({ error: 'Error al obtener template' }, { status: 500 });
  }
}

// PUT - Actualizar template
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await verifyAuth(request);
    if (!auth || auth.role !== 'SUPERADMIN') {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const body = await request.json();
    const { name, description, icon, color, moduleKeys, config, isDefault, isActive } = body;

    // If setting as default, unset other defaults
    if (isDefault) {
      await prisma.$executeRaw`
        UPDATE "company_templates" SET "isDefault" = false WHERE "isDefault" = true AND "id" != ${params.id}
      `;
    }

    await prisma.$executeRaw`
      UPDATE "company_templates"
      SET
        "name" = COALESCE(${name}, "name"),
        "description" = COALESCE(${description}, "description"),
        "icon" = COALESCE(${icon}, "icon"),
        "color" = COALESCE(${color}, "color"),
        "moduleKeys" = COALESCE(${moduleKeys}::TEXT[], "moduleKeys"),
        "config" = COALESCE(${config ? JSON.stringify(config) : null}::JSONB, "config"),
        "isDefault" = COALESCE(${isDefault}, "isDefault"),
        "isActive" = COALESCE(${isActive}, "isActive"),
        "updatedAt" = NOW()
      WHERE "id" = ${params.id}
    `;

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error updating template:', error);
    if (error.code === '23505') {
      return NextResponse.json({ error: 'Ya existe un template con ese nombre' }, { status: 400 });
    }
    return NextResponse.json({ error: 'Error al actualizar template' }, { status: 500 });
  }
}

// DELETE - Eliminar template
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await verifyAuth(request);
    if (!auth || auth.role !== 'SUPERADMIN') {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    // Check if template is in use
    const companies = await prisma.$queryRaw`
      SELECT COUNT(*) as count FROM "Company" WHERE "templateId" = ${params.id}
    ` as any[];

    if (companies[0]?.count > 0) {
      return NextResponse.json({
        error: `Este template está siendo usado por ${companies[0].count} empresa(s). Desasócielo primero.`
      }, { status: 400 });
    }

    await prisma.$executeRaw`
      DELETE FROM "company_templates" WHERE "id" = ${params.id}
    `;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting template:', error);
    return NextResponse.json({ error: 'Error al eliminar template' }, { status: 500 });
  }
}
