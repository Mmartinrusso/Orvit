import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';
import { JWT_SECRET } from '@/lib/auth';
import { createTemplateSchema } from '@/lib/cargas/validations';

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
 * GET - Obtener todos los templates de carga de la empresa
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await getUserFromToken(request);
    if (!auth || !auth.userId || !auth.companyId) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    // Verificar si la tabla LoadTemplate existe
    try {
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
        WHERE lt."companyId" = ${auth.companyId}
        ORDER BY lt."updatedAt" DESC
      ` as any[];

      return NextResponse.json(templates);
    } catch (error: any) {
      // Si la tabla no existe, retornar array vacío
      if (error.code === '42P01' || error.message?.includes('does not exist')) {
        return NextResponse.json([]);
      }
      throw error;
    }
  } catch (error: any) {
    console.error('Error getting templates:', error);
    return NextResponse.json(
      { error: 'Error al obtener templates', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * POST - Crear un nuevo template de carga
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await getUserFromToken(request);
    if (!auth || !auth.userId || !auth.companyId) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const body = await request.json();

    // Validar con Zod
    const validation = createTemplateSchema.safeParse(body);
    if (!validation.success) {
      const firstError = validation.error.errors[0];
      return NextResponse.json(
        { error: firstError.message, details: validation.error.errors },
        { status: 400 }
      );
    }

    const { name, truckId, items } = validation.data;

    // Verificar si la tabla existe, si no, crearla
    try {
      await prisma.$executeRaw`
        CREATE TABLE IF NOT EXISTS "LoadTemplate" (
          id SERIAL PRIMARY KEY,
          name VARCHAR(100) NOT NULL,
          "companyId" INTEGER NOT NULL REFERENCES "Company"(id),
          "truckId" INTEGER REFERENCES "Truck"(id),
          items JSONB NOT NULL DEFAULT '[]',
          "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `;

      // Crear índice si no existe
      await prisma.$executeRaw`
        CREATE INDEX IF NOT EXISTS "LoadTemplate_companyId_idx" ON "LoadTemplate"("companyId")
      `;
    } catch (createTableError) {
      // Ignorar si ya existe
    }

    // Crear el template
    const result = await prisma.$queryRaw`
      INSERT INTO "LoadTemplate" (name, "companyId", "truckId", items, "createdAt", "updatedAt")
      VALUES (${name}, ${auth.companyId}, ${truckId || null}, ${JSON.stringify(items)}::jsonb, NOW(), NOW())
      RETURNING id, name, "truckId", items, "createdAt", "updatedAt"
    ` as any[];

    return NextResponse.json(result[0], { status: 201 });
  } catch (error: any) {
    console.error('Error creating template:', error);
    return NextResponse.json(
      { error: 'Error al crear template', details: error.message },
      { status: 500 }
    );
  }
}
