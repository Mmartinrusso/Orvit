import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';
import { JWT_SECRET } from '@/lib/auth';

const JWT_SECRET_KEY = new TextEncoder().encode(JWT_SECRET);

async function getUserFromToken(request: NextRequest) {
  try {
    const token = cookies().get('token')?.value;
    if (!token) return null;

    const { payload } = await jwtVerify(token, JWT_SECRET_KEY);
    const user = await prisma.user.findUnique({
      where: { id: payload.userId as number },
      include: {
        companies: {
          include: { company: true }
        }
      }
    });

    if (!user || !user.companies || user.companies.length === 0) return null;
    return {
      userId: user.id,
      companyId: user.companies[0].companyId,
    };
  } catch {
    return null;
  }
}

/**
 * GET - Obtener un template específico
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await getUserFromToken(request);
    if (!auth || !auth.userId || !auth.companyId) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const templateId = parseInt(params.id);
    if (isNaN(templateId)) {
      return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
    }

    const templates = await prisma.$queryRaw`
      SELECT
        lt.id,
        lt.name,
        lt."truckId",
        lt.items,
        lt."createdAt",
        lt."updatedAt",
        t.name as "truckName",
        t.type as "truckType"
      FROM "LoadTemplate" lt
      LEFT JOIN "Truck" t ON lt."truckId" = t.id
      WHERE lt.id = ${templateId} AND lt."companyId" = ${auth.companyId}
    ` as any[];

    if (templates.length === 0) {
      return NextResponse.json({ error: 'Template no encontrado' }, { status: 404 });
    }

    return NextResponse.json(templates[0]);
  } catch (error: any) {
    console.error('Error getting template:', error);
    return NextResponse.json(
      { error: 'Error al obtener template', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * PUT - Actualizar un template
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await getUserFromToken(request);
    if (!auth || !auth.userId || !auth.companyId) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const templateId = parseInt(params.id);
    if (isNaN(templateId)) {
      return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
    }

    const body = await request.json();
    const { name, truckId, items } = body;

    // Verificar que el template existe y pertenece a la empresa
    const existing = await prisma.$queryRaw`
      SELECT id FROM "LoadTemplate"
      WHERE id = ${templateId} AND "companyId" = ${auth.companyId}
    ` as any[];

    if (existing.length === 0) {
      return NextResponse.json({ error: 'Template no encontrado' }, { status: 404 });
    }

    // Actualizar
    const result = await prisma.$queryRaw`
      UPDATE "LoadTemplate"
      SET
        name = COALESCE(${name}, name),
        "truckId" = ${truckId || null},
        items = COALESCE(${items ? JSON.stringify(items) : null}::jsonb, items),
        "updatedAt" = NOW()
      WHERE id = ${templateId} AND "companyId" = ${auth.companyId}
      RETURNING id, name, "truckId", items, "createdAt", "updatedAt"
    ` as any[];

    return NextResponse.json(result[0]);
  } catch (error: any) {
    console.error('Error updating template:', error);
    return NextResponse.json(
      { error: 'Error al actualizar template', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * DELETE - Eliminar un template
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await getUserFromToken(request);
    if (!auth || !auth.userId || !auth.companyId) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const templateId = parseInt(params.id);
    if (isNaN(templateId)) {
      return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
    }

    // Verificar que existe y eliminar
    const result = await prisma.$executeRaw`
      DELETE FROM "LoadTemplate"
      WHERE id = ${templateId} AND "companyId" = ${auth.companyId}
    `;

    if (result === 0) {
      return NextResponse.json({ error: 'Template no encontrado' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting template:', error);
    return NextResponse.json(
      { error: 'Error al eliminar template', details: error.message },
      { status: 500 }
    );
  }
}
