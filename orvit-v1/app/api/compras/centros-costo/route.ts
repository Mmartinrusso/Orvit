import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';
import { prisma } from '@/lib/prisma';
import { JWT_SECRET } from '@/lib/auth';

export const dynamic = 'force-dynamic';

const JWT_SECRET_KEY = new TextEncoder().encode(JWT_SECRET);

// Caché
const centrosCostoCache = new Map<string, { data: any; timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000;

async function getUserFromToken() {
  try {
    const token = cookies().get('token')?.value;
    if (!token) return null;

    const { payload } = await jwtVerify(token, JWT_SECRET_KEY);

    const user = await prisma.user.findUnique({
      where: { id: payload.userId as number },
      select: {
        id: true,
        name: true,
        companies: {
          select: { companyId: true },
          take: 1
        }
      }
    });

    return user;
  } catch (error) {
    return null;
  }
}

// GET - Listar centros de costo
export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromToken();
    if (!user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const companyId = user.companies?.[0]?.companyId;
    if (!companyId) {
      return NextResponse.json({ error: 'Usuario no tiene empresa asignada' }, { status: 400 });
    }

    const { searchParams } = new URL(request.url);
    const includeInactive = searchParams.get('includeInactive') === 'true';
    const flat = searchParams.get('flat') === 'true'; // Sin jerarquía

    // Verificar caché
    const cacheKey = `centros-costo-${companyId}-${includeInactive}-${flat}`;
    const cached = centrosCostoCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return NextResponse.json(cached.data, { headers: { 'X-Cache': 'HIT' } });
    }

    const centrosCosto = await prisma.costCenter.findMany({
      where: {
        companyId,
        ...(includeInactive ? {} : { isActive: true }),
        ...(flat ? {} : { parentId: null }) // Solo raíces si es jerárquico
      },
      include: {
        ...(flat ? {} : {
          children: {
            where: includeInactive ? {} : { isActive: true },
            include: {
              children: {
                where: includeInactive ? {} : { isActive: true }
              }
            }
          }
        }),
        _count: {
          select: { purchaseOrders: true, receipts: true }
        }
      },
      orderBy: { codigo: 'asc' },
    });

    // Guardar en caché
    centrosCostoCache.set(cacheKey, { data: centrosCosto, timestamp: Date.now() });

    return NextResponse.json(centrosCosto);
  } catch (error) {
    console.error('Error fetching centros de costo:', error);
    return NextResponse.json(
      { error: 'Error al obtener los centros de costo' },
      { status: 500 }
    );
  }
}

// POST - Crear centro de costo
export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromToken();
    if (!user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const companyId = user.companies?.[0]?.companyId;
    if (!companyId) {
      return NextResponse.json({ error: 'Usuario no tiene empresa asignada' }, { status: 400 });
    }

    const body = await request.json();
    const { codigo, nombre, descripcion, parentId } = body;

    // Validaciones
    if (!codigo?.trim()) {
      return NextResponse.json({ error: 'El código es requerido' }, { status: 400 });
    }
    if (!nombre?.trim()) {
      return NextResponse.json({ error: 'El nombre es requerido' }, { status: 400 });
    }

    // Verificar código único
    const existente = await prisma.costCenter.findUnique({
      where: {
        companyId_codigo: {
          companyId,
          codigo: codigo.trim().toUpperCase()
        }
      }
    });

    if (existente) {
      return NextResponse.json(
        { error: 'Ya existe un centro de costo con ese código' },
        { status: 400 }
      );
    }

    // Si tiene parent, verificar que existe
    if (parentId) {
      const parent = await prisma.costCenter.findFirst({
        where: { id: parseInt(parentId), companyId }
      });
      if (!parent) {
        return NextResponse.json(
          { error: 'Centro de costo padre no encontrado' },
          { status: 400 }
        );
      }
    }

    const nuevoCentro = await prisma.costCenter.create({
      data: {
        codigo: codigo.trim().toUpperCase(),
        nombre: nombre.trim(),
        descripcion: descripcion?.trim() || null,
        parentId: parentId ? parseInt(parentId) : null,
        companyId,
      },
      include: {
        parent: { select: { id: true, codigo: true, nombre: true } }
      }
    });

    // Invalidar caché
    for (const key of centrosCostoCache.keys()) {
      if (key.startsWith(`centros-costo-${companyId}`)) {
        centrosCostoCache.delete(key);
      }
    }

    return NextResponse.json(nuevoCentro, { status: 201 });
  } catch (error) {
    console.error('Error creating centro de costo:', error);
    return NextResponse.json(
      { error: 'Error al crear el centro de costo' },
      { status: 500 }
    );
  }
}
