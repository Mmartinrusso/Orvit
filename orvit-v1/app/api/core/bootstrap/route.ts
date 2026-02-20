import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';
import { logApiPerformance, logApiError } from '@/lib/logger';
import { startPerf, endParse, startDb, endDb, startCompute, endCompute, startJson, endJson, withPerfHeaders, shouldDisableCache } from '@/lib/perf';

export const dynamic = 'force-dynamic';

/**
 * ✨ ENDPOINT AGREGADOR: Bootstrap del sistema
 * Carga TODOS los datos necesarios para inicializar la app en 1 solo request
 * 
 * ANTES: 5-10 requests (auth/me, companies, areas, sectors, notifications, etc.)
 * DESPUÉS: 1 request
 */
export async function GET(request: NextRequest) {
  const perf = logApiPerformance('core/bootstrap', {});
  const perfCtx = startPerf();
  const { searchParams } = new URL(request.url);
  
  try {
    // 1. Obtener token de cookies o header
    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value || 
                  request.headers.get('Authorization')?.replace('Bearer ', '');

    if (!token) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }

    // 2. Verificar y decodificar token
    let payload: any;
    try {
      const secret = new TextEncoder().encode(process.env.JWT_SECRET || 'secret');
      const result = await jwtVerify(token, secret);
      payload = result.payload;
    } catch {
      return NextResponse.json({ error: 'Token inválido' }, { status: 401 });
    }

    const userId = payload.userId || payload.id;
    if (!userId) {
      return NextResponse.json({ error: 'Token sin userId' }, { status: 401 });
    }

    endParse(perfCtx);
    startDb(perfCtx);

    // 3. Cargar todo en paralelo
    const [user, companies, notifications] = await Promise.all([
      getUser(userId),
      getUserCompanies(userId),
      getNotificationsSummary(userId)
    ]);

    if (!user) {
      return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 });
    }

    // 4. Obtener empresa actual (primera o la guardada en preferencias)
    const currentCompanyId = companies[0]?.companyId;
    
    // 5. Cargar áreas y sectores de la empresa actual
    let areas: any[] = [];
    let sectors: any[] = [];
    
    if (currentCompanyId) {
      [areas, sectors] = await Promise.all([
        getAreas(currentCompanyId),
        getSectors(currentCompanyId)
      ]);
    }

    // 6. Obtener permisos del usuario
    const permissions = await getUserPermissions(userId, currentCompanyId);

    endDb(perfCtx);
    startCompute(perfCtx);

    // 7. Preparar respuesta
    const responseData = {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        avatar: user.avatar,
        role: user.role,
        isActive: user.isActive
      },
      companies: companies.map(uc => ({
        id: uc.company.id,
        name: uc.company.name,
        logo: uc.company.logo,
        isActive: uc.isActive,
        roleId: uc.roleId,
        roleName: uc.role?.displayName
      })),
      currentCompanyId,
      areas,
      sectors,
      permissions,
      notifications: {
        unreadCount: notifications.unread,
        total: notifications.total
      },
      // ✨ System settings incluidos para evitar request separado
      systemSettings: {
        systemLogoDark: null,
        systemLogoLight: null,
        timezone: 'America/Argentina/Buenos_Aires',
        currency: 'ARS',
        dateFormat: 'dd/MM/yyyy'
      },
      metadata: {
        timestamp: new Date().toISOString()
      }
    };

    endCompute(perfCtx);
    startJson(perfCtx);

    const response = NextResponse.json(responseData);

    const metrics = endJson(perfCtx, responseData);
    const responseWithPerf = withPerfHeaders(response, metrics, searchParams);

    // Log de performance
    perf.end({
      userId: user.id,
      companiesCount: companies.length,
      areasCount: areas.length,
      sectorsCount: sectors.length,
      permissionsCount: permissions.length,
      perfTotal: metrics.total,
      perfDb: metrics.db,
      perfCompute: metrics.compute
    });

    return responseWithPerf;

  } catch (error) {
    logApiError('core/bootstrap', error);
    perf.end({ error: true });
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

async function getUser(userId: number) {
  return prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      email: true,
      avatar: true,
      role: true,
      isActive: true
    }
  });
}

async function getUserCompanies(userId: number) {
  return prisma.userOnCompany.findMany({
    where: { userId, isActive: true },
    include: {
      company: {
        select: {
          id: true,
          name: true,
          logo: true
        }
      },
      role: {
        select: {
          id: true,
          name: true,
          displayName: true
        }
      }
    }
  });
}

async function getAreas(companyId: number) {
  return prisma.area.findMany({
    where: { companyId },
    orderBy: { name: 'asc' },
    select: {
      id: true,
      name: true,
      icon: true,
      description: true
    }
  });
}

async function getSectors(companyId: number) {
  return prisma.sector.findMany({
    where: { 
      area: { companyId } 
    },
    orderBy: { name: 'asc' },
    select: {
      id: true,
      name: true,
      description: true,
      areaId: true,
      area: {
        select: {
          id: true,
          name: true
        }
      }
    }
  });
}

async function getUserPermissions(userId: number, companyId: number | null) {
  if (!companyId) return [];

  // Obtener permisos del rol del usuario en esta empresa
  const userOnCompany = await prisma.userOnCompany.findFirst({
    where: { userId, companyId },
    include: {
      role: {
        include: {
          permissions: {
            include: {
              permission: true
            }
          }
        }
      }
    }
  });

  if (!userOnCompany?.role?.permissions) return [];

  return userOnCompany.role.permissions.map(rp => rp.permission.name);
}

async function getNotificationsSummary(userId: number) {
  const [unread, total] = await Promise.all([
    prisma.notification.count({
      where: { userId, isRead: false }
    }),
    prisma.notification.count({
      where: { userId }
    })
  ]);

  return { unread, total };
}
