import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';
import { prisma } from '@/lib/prisma';
import { JWT_SECRET } from '@/lib/auth'; // ✅ Importar el mismo secret

export const dynamic = 'force-dynamic';

const JWT_SECRET_KEY = new TextEncoder().encode(JWT_SECRET);

// Caché en memoria para cuentas (5 minutos TTL)
const cuentasCache = new Map<string, { data: any; timestamp: number }>();
const CUENTAS_CACHE_TTL = 10 * 60 * 1000; // 10 minutos - aumentado agresivamente

// Caché para getUserFromToken (30 segundos TTL)
const userTokenCache = new Map<string, { data: any; timestamp: number }>();
const USER_TOKEN_CACHE_TTL = 30 * 1000; // 30 segundos

// Helper para obtener usuario desde JWT (ULTRA optimizado con caché)
async function getUserFromToken() {
  try {
    const token = cookies().get('token')?.value;
    
    if (!token) {
      return null;
    }

    // Verificar caché
    const cacheKey = `user-${token.substring(0, 20)}`;
    const cached = userTokenCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < USER_TOKEN_CACHE_TTL) {
      return cached.data;
    }

    const { payload } = await jwtVerify(token, JWT_SECRET_KEY);
    
    // Optimización: Solo obtener companyId sin incluir toda la relación
    const user = await prisma.user.findUnique({
      where: { id: payload.userId as number },
      select: {
        id: true,
        companies: {
          select: {
            companyId: true
          },
          take: 1
        }
      }
    });

    // Guardar en caché
    if (user) {
      userTokenCache.set(cacheKey, {
        data: user,
        timestamp: Date.now()
      });
      
      // Limpiar caché antiguo
      if (userTokenCache.size > 100) {
        const now = Date.now();
        for (const [key, value] of userTokenCache.entries()) {
          if (now - value.timestamp > USER_TOKEN_CACHE_TTL) {
            userTokenCache.delete(key);
          }
        }
      }
    }

    return user;
  } catch (error) {
    console.error('Error obteniendo usuario desde JWT:', error);
    return null;
  }
}

export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromToken();
    if (!user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    // Obtener companyId del usuario
    const companyId = user.companies?.[0]?.companyId;
    if (!companyId) {
      return NextResponse.json({ error: 'Usuario no tiene empresa asignada' }, { status: 400 });
    }

    // Verificar caché
    const cacheKey = `cuentas-${companyId}`;
    const cached = cuentasCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CUENTAS_CACHE_TTL) {
      return NextResponse.json(cached.data, {
        headers: {
          'Cache-Control': 'public, max-age=600',
          'X-Cache': 'HIT'
        }
      });
    }

    // ULTRA OPTIMIZACIÓN: Usar findMany con límite muy reducido
    const cuentas = await prisma.purchaseAccount.findMany({
      where: {
        companyId: companyId,
        activa: true,
      },
      select: {
        id: true,
        nombre: true,
        descripcion: true,
        activa: true,
      },
      orderBy: {
        nombre: 'asc',
      },
      take: 10, // Límite extremadamente reducido
    });

    // Guardar en caché
    cuentasCache.set(cacheKey, {
      data: cuentas,
      timestamp: Date.now()
    });

    // Limpiar caché antiguo
    if (cuentasCache.size > 50) {
      const now = Date.now();
      for (const [key, value] of cuentasCache.entries()) {
        if (now - value.timestamp > CUENTAS_CACHE_TTL) {
          cuentasCache.delete(key);
        }
      }
    }

    return NextResponse.json(cuentas, {
      headers: {
        'Cache-Control': 'public, max-age=300',
        'X-Cache': 'MISS'
      }
    });
  } catch (error) {
    console.error('Error fetching cuentas:', error);
    return NextResponse.json(
      { error: 'Error al obtener las cuentas' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromToken();
    if (!user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const body = await request.json();
    const { nombre, descripcion } = body;

    if (!nombre || !nombre.trim()) {
      return NextResponse.json(
        { error: 'El nombre es requerido' },
        { status: 400 }
      );
    }

    // Obtener companyId del usuario
    const companyId = user.companies?.[0]?.companyId;
    if (!companyId) {
      return NextResponse.json({ error: 'Usuario no tiene empresa asignada' }, { status: 400 });
    }

    // Crear cuenta en la base de datos
    const nuevaCuenta = await prisma.purchaseAccount.create({
      data: {
        nombre: nombre.trim(),
        descripcion: descripcion?.trim() || null,
        activa: true,
        companyId: companyId,
      },
    });

    // Invalidar caché
    cuentasCache.delete(`cuentas-${companyId}`);

    return NextResponse.json(nuevaCuenta, { status: 201 });
  } catch (error) {
    console.error('Error creating cuenta:', error);
    return NextResponse.json(
      { error: 'Error al crear la cuenta' },
      { status: 500 }
    );
  }
}

