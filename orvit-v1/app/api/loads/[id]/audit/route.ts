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
      userName: user.name || user.email,
      companyId: user.companies[0].companyId,
    };
  } catch {
    return null;
  }
}

/**
 * GET - Obtener historial de auditoría de una carga
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

    const loadId = parseInt(params.id);
    if (isNaN(loadId)) {
      return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
    }

    // Verificar que la carga existe y pertenece a la empresa
    const load = await prisma.load.findFirst({
      where: { id: loadId, companyId: auth.companyId },
    });

    if (!load) {
      return NextResponse.json({ error: 'Carga no encontrada' }, { status: 404 });
    }

    // Verificar si la tabla LoadAudit existe
    try {
      const audit = await prisma.$queryRaw`
        SELECT
          la.id,
          la."loadId",
          la."userId",
          la.action,
          la.changes,
          la."createdAt",
          u.name as "userName",
          u.email as "userEmail"
        FROM "LoadAudit" la
        LEFT JOIN "User" u ON la."userId" = u.id
        WHERE la."loadId" = ${loadId}
        ORDER BY la."createdAt" DESC
        LIMIT 100
      ` as any[];

      return NextResponse.json(audit);
    } catch (error: any) {
      // Si la tabla no existe, retornar array vacío
      if (error.code === '42P01' || error.message?.includes('does not exist')) {
        return NextResponse.json([]);
      }
      throw error;
    }
  } catch (error: any) {
    console.error('Error getting audit:', error);
    return NextResponse.json(
      { error: 'Error al obtener historial', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * POST - Registrar evento de auditoría
 * (Usado internamente, no directamente por el frontend)
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await getUserFromToken(request);
    if (!auth || !auth.userId || !auth.companyId) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const loadId = parseInt(params.id);
    if (isNaN(loadId)) {
      return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
    }

    const body = await request.json();
    const { action, changes } = body;

    if (!action) {
      return NextResponse.json({ error: 'Action requerida' }, { status: 400 });
    }

    // Crear tabla si no existe
    try {
      await prisma.$executeRaw`
        CREATE TABLE IF NOT EXISTS "LoadAudit" (
          id SERIAL PRIMARY KEY,
          "loadId" INTEGER NOT NULL REFERENCES "Load"(id) ON DELETE CASCADE,
          "userId" INTEGER NOT NULL REFERENCES "User"(id),
          action VARCHAR(50) NOT NULL,
          changes JSONB DEFAULT '{}',
          "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `;

      await prisma.$executeRaw`
        CREATE INDEX IF NOT EXISTS "LoadAudit_loadId_idx" ON "LoadAudit"("loadId")
      `;
    } catch {
      // Ignorar si ya existe
    }

    // Crear registro de auditoría
    const result = await prisma.$queryRaw`
      INSERT INTO "LoadAudit" ("loadId", "userId", action, changes, "createdAt")
      VALUES (${loadId}, ${auth.userId}, ${action}, ${JSON.stringify(changes || {})}::jsonb, NOW())
      RETURNING id, "loadId", "userId", action, changes, "createdAt"
    ` as any[];

    return NextResponse.json(result[0], { status: 201 });
  } catch (error: any) {
    console.error('Error creating audit:', error);
    return NextResponse.json(
      { error: 'Error al registrar auditoría', details: error.message },
      { status: 500 }
    );
  }
}
