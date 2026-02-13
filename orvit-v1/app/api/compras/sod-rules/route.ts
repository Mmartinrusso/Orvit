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

/**
 * GET /api/compras/sod-rules
 * Lista las reglas SoD de la empresa actual
 */
export async function GET(req: NextRequest) {
  try {
    const { companyId } = await getUserFromToken();

    const rules = await prisma.sodMatrix.findMany({
      where: { companyId },
      orderBy: [
        { isSystemRule: 'desc' },
        { ruleCode: 'asc' },
      ],
    });

    return NextResponse.json({ rules });
  } catch (error) {
    console.error('[SOD-RULES] Error:', error);
    return NextResponse.json(
      { error: 'Error al obtener reglas SoD' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/compras/sod-rules
 * Crea una nueva regla SoD personalizada
 */
export async function POST(req: NextRequest) {
  try {
    const { companyId } = await getUserFromToken();
    const body = await req.json();

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

    // Verificar que no exista el código
    if (ruleCode) {
      const existing = await prisma.sodMatrix.findFirst({
        where: { companyId, ruleCode },
      });
      if (existing) {
        return NextResponse.json(
          { error: 'Ya existe una regla con ese código' },
          { status: 400 }
        );
      }
    }

    // Generar código si no se proporciona
    const finalRuleCode = ruleCode || `SOD_CUSTOM_${Date.now()}`;

    const rule = await prisma.sodMatrix.create({
      data: {
        companyId,
        ruleCode: finalRuleCode,
        name,
        description: description || null,
        action1,
        action2,
        scope: scope || 'SAME_DOCUMENT',
        isEnabled: isEnabled ?? true,
        isSystemRule: false,
      },
    });

    return NextResponse.json({ rule }, { status: 201 });
  } catch (error) {
    console.error('[SOD-RULES] Error creating:', error);
    return NextResponse.json(
      { error: 'Error al crear regla SoD' },
      { status: 500 }
    );
  }
}
