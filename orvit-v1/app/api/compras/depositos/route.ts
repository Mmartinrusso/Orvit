import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';
import { prisma } from '@/lib/prisma';
import { JWT_SECRET } from '@/lib/auth';

export const dynamic = 'force-dynamic';

const JWT_SECRET_KEY = new TextEncoder().encode(JWT_SECRET);

// Caché en memoria (5 minutos TTL)
const depositosCache = new Map<string, { data: any; timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000;

// Caché para getUserFromToken
const userTokenCache = new Map<string, { data: any; timestamp: number }>();
const USER_TOKEN_CACHE_TTL = 30 * 1000;

async function getUserFromToken() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;
    if (!token) return null;

    const cacheKey = `user-${token.substring(0, 20)}`;
    const cached = userTokenCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < USER_TOKEN_CACHE_TTL) {
      return cached.data;
    }

    const { payload } = await jwtVerify(token, JWT_SECRET_KEY);

    const user = await prisma.user.findUnique({
      where: { id: payload.userId as number },
      select: {
        id: true,
        companies: {
          select: { companyId: true },
          take: 1
        }
      }
    });

    if (user) {
      userTokenCache.set(cacheKey, { data: user, timestamp: Date.now() });
    }

    return user;
  } catch (error) {
    console.error('Error obteniendo usuario desde JWT:', error);
    return null;
  }
}

// GET - Listar depósitos
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

    // Verificar caché
    const cacheKey = `depositos-${companyId}-${includeInactive}`;
    const cached = depositosCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return NextResponse.json(cached.data, {
        headers: { 'X-Cache': 'HIT' }
      });
    }

    const depositos = await prisma.warehouse.findMany({
      where: {
        companyId,
        ...(includeInactive ? {} : { isActive: true }),
      },
      select: {
        id: true,
        codigo: true,
        nombre: true,
        descripcion: true,
        direccion: true,
        isDefault: true,
        isActive: true,
        createdAt: true,
        _count: {
          select: {
            stockLocations: true,
            goodsReceipts: true,
          }
        }
      },
      orderBy: [
        { isDefault: 'desc' },
        { nombre: 'asc' }
      ],
    });

    // Guardar en caché
    const responseData = { data: depositos };
    depositosCache.set(cacheKey, { data: responseData, timestamp: Date.now() });

    return NextResponse.json(responseData, {
      headers: { 'X-Cache': 'MISS' }
    });
  } catch (error) {
    console.error('Error fetching depositos:', error);
    return NextResponse.json(
      { error: 'Error al obtener los depósitos' },
      { status: 500 }
    );
  }
}

// POST - Crear depósito
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
    const { codigo, nombre, descripcion, direccion, isDefault } = body;

    // Validaciones
    if (!codigo?.trim()) {
      return NextResponse.json({ error: 'El código es requerido' }, { status: 400 });
    }
    if (!nombre?.trim()) {
      return NextResponse.json({ error: 'El nombre es requerido' }, { status: 400 });
    }

    // Verificar código único
    const existente = await prisma.warehouse.findUnique({
      where: {
        companyId_codigo: {
          companyId,
          codigo: codigo.trim().toUpperCase()
        }
      }
    });

    if (existente) {
      return NextResponse.json(
        { error: 'Ya existe un depósito con ese código' },
        { status: 400 }
      );
    }

    // Si es default, quitar default de los demás
    if (isDefault) {
      await prisma.warehouse.updateMany({
        where: { companyId, isDefault: true },
        data: { isDefault: false }
      });
    }

    const nuevoDeposito = await prisma.warehouse.create({
      data: {
        codigo: codigo.trim().toUpperCase(),
        nombre: nombre.trim(),
        descripcion: descripcion?.trim() || null,
        direccion: direccion?.trim() || null,
        isDefault: isDefault || false,
        isActive: true,
        companyId,
      },
    });

    // Invalidar caché
    for (const key of depositosCache.keys()) {
      if (key.startsWith(`depositos-${companyId}`)) {
        depositosCache.delete(key);
      }
    }

    return NextResponse.json(nuevoDeposito, { status: 201 });
  } catch (error) {
    console.error('Error creating deposito:', error);
    return NextResponse.json(
      { error: 'Error al crear el depósito' },
      { status: 500 }
    );
  }
}
