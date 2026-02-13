import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';
import { JWT_SECRET } from '@/lib/auth';
import { cached, invalidateCache } from '@/lib/cache/cache-manager';
import { companyKeys, TTL } from '@/lib/cache/cache-keys';

export const dynamic = 'force-dynamic';

const JWT_SECRET_KEY = new TextEncoder().encode(JWT_SECRET);

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

    const cacheKey = companyKeys.modules(companyId);

    const responseData = await cached(cacheKey, async () => {
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

      return {
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
    }, TTL.MEDIUM); // 5 min

    return NextResponse.json(responseData, {
      headers: {
        'Cache-Control': 'private, max-age=300',
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

// Función para invalidar caché de módulos de una empresa
export async function invalidateCompanyModulesCache(companyId: number) {
  await invalidateCache([companyKeys.modules(companyId)]);
}
