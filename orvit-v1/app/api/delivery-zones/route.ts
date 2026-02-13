import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';
import { JWT_SECRET } from '@/lib/auth';

const JWT_SECRET_KEY = new TextEncoder().encode(JWT_SECRET);

async function getUserFromToken() {
  try {
    const token = cookies().get('token')?.value;
    if (!token) return null;
    const { payload } = await jwtVerify(token, JWT_SECRET_KEY);
    const user = await prisma.user.findUnique({
      where: { id: payload.userId as number },
      include: { companies: { select: { companyId: true }, take: 1 } }
    });
    if (!user?.companies?.[0]) return null;
    return { userId: user.id, companyId: user.companies[0].companyId };
  } catch {
    return null;
  }
}

// GET - Obtener todas las zonas de reparto
export async function GET(request: NextRequest) {
  try {
    const auth = await getUserFromToken();
    if (!auth) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    try {
      const zones = await prisma.deliveryZone.findMany({
        where: {
          companyId: auth.companyId,
          isActive: true,
        },
        orderBy: { name: 'asc' },
      });
      return NextResponse.json(zones);
    } catch (error: any) {
      // Si la tabla no existe, devolver array vacío
      if (error.code === '42P01' || error.message?.includes('does not exist')) {
        return NextResponse.json([]);
      }
      // Si el modelo no está en Prisma, intentar raw
      if (error.message?.includes('Unknown model') || error.message?.includes('deliveryZone')) {
        try {
          const zones = await prisma.$queryRaw`
            SELECT id, name, description, "companyId", "isActive", "createdAt", "updatedAt"
            FROM "DeliveryZone"
            WHERE "companyId" = ${auth.companyId} AND "isActive" = true
            ORDER BY name ASC
          ` as any[];
          return NextResponse.json(zones || []);
        } catch {
          return NextResponse.json([]);
        }
      }
      throw error;
    }
  } catch (error: any) {
    console.error('Error al obtener zonas de reparto:', error);
    return NextResponse.json([]);
  }
}

// POST - Crear nueva zona de reparto
export async function POST(request: NextRequest) {
  try {
    const auth = await getUserFromToken();
    if (!auth) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const body = await request.json();
    const { name, description } = body;

    if (!name?.trim()) {
      return NextResponse.json({ error: 'El nombre es requerido' }, { status: 400 });
    }

    try {
      const zone = await prisma.deliveryZone.create({
        data: {
          name: name.trim(),
          description: description?.trim() || null,
          companyId: auth.companyId,
        },
      });
      return NextResponse.json(zone, { status: 201 });
    } catch (error: any) {
      if (error.code === 'P2002') {
        return NextResponse.json({ error: 'Ya existe una zona con ese nombre' }, { status: 409 });
      }
      // Si el modelo no está en Prisma, intentar raw
      if (error.message?.includes('Unknown model') || error.message?.includes('deliveryZone')) {
        const cuid = () => `dz${Date.now().toString(36)}${Math.random().toString(36).substring(2, 15)}`;
        const zoneId = cuid();

        await prisma.$executeRaw`
          INSERT INTO "DeliveryZone" (id, name, description, "companyId", "isActive", "createdAt", "updatedAt")
          VALUES (${zoneId}, ${name.trim()}, ${description?.trim() || null}, ${auth.companyId}, true, NOW(), NOW())
        `;

        const created = await prisma.$queryRaw`
          SELECT * FROM "DeliveryZone" WHERE id = ${zoneId}
        ` as any[];

        return NextResponse.json(created[0], { status: 201 });
      }
      throw error;
    }
  } catch (error: any) {
    console.error('Error al crear zona de reparto:', error);
    if (error.code === '42P01' || error.message?.includes('does not exist')) {
      return NextResponse.json(
        { error: 'La tabla de zonas no está disponible. Ejecute la migración primero.' },
        { status: 503 }
      );
    }
    return NextResponse.json({ error: 'Error al crear zona de reparto' }, { status: 500 });
  }
}
