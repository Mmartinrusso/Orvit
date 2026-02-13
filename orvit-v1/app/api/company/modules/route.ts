import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';
import { JWT_SECRET } from '@/lib/auth';

export const dynamic = 'force-dynamic';

const JWT_SECRET_KEY = new TextEncoder().encode(JWT_SECRET);

// Caché en memoria para módulos (5 minutos TTL)
const modulesCache = new Map<string, { data: any; timestamp: number }>();
const MODULES_CACHE_TTL = 5 * 60 * 1000; // 5 minutos

/**
 * GET /api/company/modules
 * Obtiene los módulos habilitados para la empresa del usuario actual
 */
export async function GET(request: NextRequest) {
  try {
    // Verificar autenticación
    const token = cookies().get('token')?.value;

    if (!token) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    let userId: number;
    try {
      const { payload } = await jwtVerify(token, JWT_SECRET_KEY);
      userId = payload.userId as number;
    } catch {
      return NextResponse.json({ error: 'Token inválido' }, { status: 401 });
    }

    // Obtener la empresa del usuario
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        role: true,
        ownedCompanies: {
          take: 1,
          select: { id: true }
        },
        companies: {
          take: 1,
          select: {
            company: { select: { id: true } }
          }
        }
      }
    });

    if (!user) {
      return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 });
    }

    // Si es SUPERADMIN, tiene acceso a todos los módulos
    if (user.role === 'SUPERADMIN') {
      const allModules = await prisma.module.findMany({
        where: { isActive: true },
        orderBy: { sortOrder: 'asc' },
        select: {
          id: true,
          key: true,
          name: true,
          category: true,
          icon: true,
        }
      });

      return NextResponse.json({
        modules: allModules.map(m => ({
          moduleId: m.id,
          moduleKey: m.key,
          isEnabled: true,
          config: null
        }))
      });
    }

    // Determinar companyId
    let companyId: number | null = null;
    if (user.ownedCompanies?.length) {
      companyId = user.ownedCompanies[0].id;
    } else if (user.companies?.length) {
      companyId = user.companies[0].company.id;
    }

    if (!companyId) {
      return NextResponse.json({ modules: [] });
    }

    // Verificar caché
    const cacheKey = `company-modules-${companyId}`;
    const cached = modulesCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < MODULES_CACHE_TTL) {
      return NextResponse.json(cached.data, {
        headers: {
          'Cache-Control': 'private, max-age=300',
          'X-Cache': 'HIT'
        }
      });
    }

    // Obtener módulos habilitados para la empresa
    const companyModules = await prisma.companyModule.findMany({
      where: {
        companyId,
        isEnabled: true
      },
      include: {
        module: {
          select: {
            id: true,
            key: true,
            name: true,
            category: true,
            icon: true,
            dependencies: true
          }
        }
      }
    });

    const responseData = {
      modules: companyModules.map(cm => ({
        moduleId: cm.module.id,
        moduleKey: cm.module.key,
        moduleName: cm.module.name,
        category: cm.module.category,
        icon: cm.module.icon,
        isEnabled: cm.isEnabled,
        config: cm.config,
        dependencies: cm.module.dependencies
      }))
    };

    // Guardar en caché
    modulesCache.set(cacheKey, {
      data: responseData,
      timestamp: Date.now()
    });

    return NextResponse.json(responseData, {
      headers: {
        'Cache-Control': 'private, max-age=300',
        'X-Cache': 'MISS'
      }
    });
  } catch (error) {
    console.error('Error fetching company modules:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

// Función para invalidar caché de una empresa
export function invalidateCompanyModulesCache(companyId: number) {
  const cacheKey = `company-modules-${companyId}`;
  modulesCache.delete(cacheKey);
}
