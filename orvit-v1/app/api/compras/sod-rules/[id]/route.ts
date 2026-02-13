import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import { JWT_SECRET } from '@/lib/auth';

export const dynamic = 'force-dynamic';

const JWT_SECRET_KEY = new TextEncoder().encode(JWT_SECRET);

async function getUserFromToken() {
  const token = cookies().get('token')?.value;
  if (!token) throw new Error('No token provided');
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET_KEY);
    return { userId: payload.userId as number, companyId: payload.companyId as number };
  } catch {
    throw new Error('Invalid token');
  }
}

interface Params {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/compras/sod-rules/[id]
 * Obtiene una regla SoD específica
 */
export async function GET(req: NextRequest, { params }: Params) {
  try {
    const { companyId } = await getUserFromToken();
    const { id } = await params;
    const ruleId = parseInt(id, 10);

    const rule = await prisma.sodMatrix.findFirst({
      where: { id: ruleId, companyId },
    });

    if (!rule) {
      return NextResponse.json({ error: 'Regla no encontrada' }, { status: 404 });
    }

    return NextResponse.json({ rule });
  } catch (error) {
    console.error('[SOD-RULES] Error:', error);
    return NextResponse.json(
      { error: 'Error al obtener regla SoD' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/compras/sod-rules/[id]
 * Actualiza parcialmente una regla (ej: toggle isEnabled)
 */
export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const { companyId } = await getUserFromToken();
    const { id } = await params;
    const ruleId = parseInt(id, 10);
    const body = await req.json();

    // Verificar que la regla existe
    const existing = await prisma.sodMatrix.findFirst({
      where: { id: ruleId, companyId },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Regla no encontrada' }, { status: 404 });
    }

    // Solo permitir cambiar isEnabled para reglas del sistema
    const allowedFields = existing.isSystemRule
      ? ['isEnabled']
      : ['isEnabled', 'name', 'description', 'action1', 'action2', 'scope'];

    const updateData: Record<string, any> = {};
    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updateData[field] = body[field];
      }
    }

    const rule = await prisma.sodMatrix.update({
      where: { id: ruleId },
      data: updateData,
    });

    return NextResponse.json({ rule });
  } catch (error) {
    console.error('[SOD-RULES] Error updating:', error);
    return NextResponse.json(
      { error: 'Error al actualizar regla SoD' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/compras/sod-rules/[id]
 * Actualiza completamente una regla personalizada
 */
export async function PUT(req: NextRequest, { params }: Params) {
  try {
    const { companyId } = await getUserFromToken();
    const { id } = await params;
    const ruleId = parseInt(id, 10);
    const body = await req.json();

    // Verificar que la regla existe
    const existing = await prisma.sodMatrix.findFirst({
      where: { id: ruleId, companyId },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Regla no encontrada' }, { status: 404 });
    }

    if (existing.isSystemRule) {
      return NextResponse.json(
        { error: 'Las reglas del sistema no pueden modificarse completamente' },
        { status: 403 }
      );
    }

    const { ruleCode, name, description, action1, action2, scope, isEnabled } = body;

    // Validaciones
    if (!name || !action1 || !action2) {
      return NextResponse.json(
        { error: 'Nombre, action1 y action2 son requeridos' },
        { status: 400 }
      );
    }

    if (action1 === action2) {
      return NextResponse.json(
        { error: 'Las acciones deben ser diferentes' },
        { status: 400 }
      );
    }

    // Verificar código duplicado
    if (ruleCode && ruleCode !== existing.ruleCode) {
      const duplicateCode = await prisma.sodMatrix.findFirst({
        where: { companyId, ruleCode, id: { not: ruleId } },
      });
      if (duplicateCode) {
        return NextResponse.json(
          { error: 'Ya existe otra regla con ese código' },
          { status: 400 }
        );
      }
    }

    const rule = await prisma.sodMatrix.update({
      where: { id: ruleId },
      data: {
        ruleCode: ruleCode || existing.ruleCode,
        name,
        description: description || null,
        action1,
        action2,
        scope: scope || 'SAME_DOCUMENT',
        isEnabled: isEnabled ?? existing.isEnabled,
      },
    });

    return NextResponse.json({ rule });
  } catch (error) {
    console.error('[SOD-RULES] Error updating:', error);
    return NextResponse.json(
      { error: 'Error al actualizar regla SoD' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/compras/sod-rules/[id]
 * Elimina una regla personalizada
 */
export async function DELETE(req: NextRequest, { params }: Params) {
  try {
    const { companyId } = await getUserFromToken();
    const { id } = await params;
    const ruleId = parseInt(id, 10);

    // Verificar que la regla existe
    const existing = await prisma.sodMatrix.findFirst({
      where: { id: ruleId, companyId },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Regla no encontrada' }, { status: 404 });
    }

    if (existing.isSystemRule) {
      return NextResponse.json(
        { error: 'Las reglas del sistema no pueden eliminarse' },
        { status: 403 }
      );
    }

    await prisma.sodMatrix.delete({
      where: { id: ruleId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[SOD-RULES] Error deleting:', error);
    return NextResponse.json(
      { error: 'Error al eliminar regla SoD' },
      { status: 500 }
    );
  }
}
