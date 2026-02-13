import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';
import { JWT_SECRET } from '@/lib/auth'; // ✅ Importar el mismo secret

export const dynamic = 'force-dynamic';

const JWT_SECRET_KEY = new TextEncoder().encode(JWT_SECRET);

// ✨ OPTIMIZADO: Helper para obtener usuario con empresas y roles
async function getUserFromToken(request: NextRequest) {
  try {
    const token = cookies().get('token')?.value;
    if (!token) return null;

    const { payload } = await jwtVerify(token, JWT_SECRET_KEY);
    
    return await prisma.user.findUnique({
      where: { id: payload.userId as number },
      include: {
        companies: {
          include: {
            company: true,
            role: true
          }
        },
        ownedCompanies: true
      }
    });
  } catch (error) {
    console.error('Error obteniendo usuario:', error);
    return null;
  }
}

// ✨ OPTIMIZADO: Helper para obtener companyId del usuario
function getUserCompanyId(user: NonNullable<Awaited<ReturnType<typeof getUserFromToken>>>): number | null {
  if (user.ownedCompanies?.length > 0) {
    return user.ownedCompanies[0].id;
  }
  if (user.companies?.length > 0) {
    return user.companies[0].company.id;
  }
  return null;
}

// ✨ OPTIMIZADO: Helper para obtener rol de la empresa
function getUserCompanyRole(
  user: NonNullable<Awaited<ReturnType<typeof getUserFromToken>>>,
  companyId: number
): { name: string | null; displayName: string | null } {
  const userCompany = user.companies?.find(uc => uc.company.id === companyId);
  return {
    name: userCompany?.role?.name || null,
    displayName: userCompany?.role?.displayName || null
  };
}

// ✨ OPTIMIZADO: Helper para verificar si un rol es administrativo
function isAdminRole(
  systemRole: string,
  companyRoleName: string | null | undefined,
  companyRoleDisplayName: string | null | undefined
): boolean {
  const systemAdminRoles = ['SUPERADMIN', 'ADMIN', 'ADMIN_ENTERPRISE'];
  if (systemAdminRoles.includes(systemRole)) return true;

  if (!companyRoleName && !companyRoleDisplayName) return false;

  const normalizedRoleName = (companyRoleName || '').trim().toUpperCase();
  const normalizedDisplayName = (companyRoleDisplayName || '').trim().toUpperCase();
  
  const adminKeywords = ['ADMINISTRADOR', 'ADMIN', 'ADMINISTRATOR', 'ADMIN EMPRESA', 'ADMIN_EMPRESA'];
  
  return adminKeywords.some(keyword => 
    normalizedRoleName.includes(keyword) || 
    normalizedDisplayName.includes(keyword) ||
    normalizedRoleName === keyword ||
    normalizedDisplayName === keyword
  );
}

// ✨ OPTIMIZADO: Helper para verificar permisos de admin
function checkAdminAccess(user: NonNullable<Awaited<ReturnType<typeof getUserFromToken>>>): {
  hasAccess: boolean;
  companyId: number | null;
} {
  const companyId = getUserCompanyId(user);
  if (!companyId) {
    return { hasAccess: false, companyId: null };
  }

  const { name: companyRoleName, displayName: companyRoleDisplayName } = getUserCompanyRole(user, companyId);
  const hasAccess = isAdminRole(user.role, companyRoleName, companyRoleDisplayName);

  return { hasAccess, companyId };
}

// GET /api/admin/users-with-roles - Obtener usuarios de la empresa con información de roles
export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromToken(request);
    if (!user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { hasAccess, companyId } = checkAdminAccess(user);
    if (!hasAccess || !companyId) {
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || '';
    const roleFilter = searchParams.get('role') || 'all';

    // ✨ OPTIMIZADO: Construir filtros para UserOnCompany
    const whereClause: any = {
      companyId,
      isActive: true,
      user: {
        role: { not: 'SUPERADMIN' }
      }
    };

    // Filtro de búsqueda
    if (search) {
      whereClause.user = {
        ...whereClause.user,
        OR: [
          { name: { contains: search, mode: 'insensitive' } },
          { email: { contains: search, mode: 'insensitive' } }
        ]
      };
    }

    // Filtro por rol de la empresa
    if (roleFilter !== 'all') {
      whereClause.role = {
        name: roleFilter
      };
    }

    // ✨ ULTRA OPTIMIZADO: Ejecutar TODAS las consultas en paralelo
    const [
      userCompanies,
      roles,
      statsByRole,
      roleNamesForStats
    ] = await Promise.all([
      // 1. Usuarios de la empresa
      prisma.userOnCompany.findMany({
        where: whereClause,
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              role: true,
              isActive: true,
              createdAt: true
            }
          },
          role: {
            select: {
              id: true,
              name: true,
              displayName: true
            }
          }
        },
        orderBy: {
          user: {
            name: 'asc'
          }
        },
        take: 50
      }),
      
      // 2. Roles con conteo de permisos (solo lo necesario)
      prisma.role.findMany({
        where: { companyId },
        select: {
          id: true,
          name: true,
          displayName: true,
          _count: {
            select: {
              permissions: {
                where: {
                  isGranted: true,
                  permission: { isActive: true }
                }
              }
            }
          }
        }
      }),
      
      // 3. Estadísticas por rol (en paralelo)
      prisma.userOnCompany.groupBy({
        by: ['roleId'],
        where: {
          companyId,
          isActive: true,
          user: {
            role: { not: 'SUPERADMIN' }
          }
        },
        _count: { id: true }
      }),
      
      // 4. Nombres de roles para estadísticas (solo los que tienen usuarios)
      prisma.userOnCompany.findMany({
        where: {
          companyId,
          isActive: true,
          user: {
            role: { not: 'SUPERADMIN' }
          },
          roleId: { not: null }
        },
        select: {
          roleId: true,
          role: {
            select: {
              id: true,
              name: true
            }
          }
        },
        distinct: ['roleId']
      })
    ]);

    // ✨ OPTIMIZADO: Calcular conteos de permisos por rol (usando _count)
    const rolePermissions = roles.reduce((acc, role) => {
      acc[role.name] = role._count.permissions;
      return acc;
    }, {} as Record<string, number>);

    // ✨ OPTIMIZADO: Obtener permisos específicos de usuarios (solo si hay usuarios)
    const userIds = userCompanies.map(uc => uc.user.id);
    const userSpecificPerms = userIds.length > 0 ? await prisma.userPermission.groupBy({
      by: ['userId'],
      where: {
        userId: { in: userIds },
        isGranted: true,
        permission: { isActive: true },
        OR: [
          { expiresAt: null },
          { expiresAt: { gt: new Date() } }
        ]
      },
      _count: { id: true }
    }) : [];

    const userPermCounts = userSpecificPerms.reduce((acc, up) => {
      acc[up.userId] = up._count.id;
      return acc;
    }, {} as Record<number, number>);

    // ✨ OPTIMIZADO: Mapa de nombres de roles para estadísticas (usando datos ya obtenidos)
    const roleNamesMap = roleNamesForStats.reduce((acc, item) => {
      if (item.roleId && item.role) {
        acc[item.roleId] = item.role.name;
      }
      return acc;
    }, {} as Record<number, string>);

    // ✨ OPTIMIZADO: Procesar usuarios con información de la empresa
    const processedUsers = userCompanies.map(uc => {
      const companyRoleName = uc.role?.name || 'USER';
      const companyRoleDisplayName = uc.role?.displayName || uc.role?.name || 'Usuario';
      
      return {
        id: uc.user.id,
        name: uc.user.name,
        email: uc.user.email,
        role: companyRoleName,
        roleDisplay: companyRoleDisplayName,
        isActive: uc.user.isActive,
        createdAt: uc.user.createdAt,
        rolePermissionCount: rolePermissions[companyRoleName] || 0,
        userSpecificPermissions: [],
        userSpecificPermissionsCount: userPermCounts[uc.user.id] || 0,
        companies: []
      };
    });

    // ✨ OPTIMIZADO: Estadísticas usando datos ya procesados
    const stats = {
      total: processedUsers.length,
      byRole: statsByRole.reduce((acc, stat) => {
        if (stat.roleId) {
          const roleName = roleNamesMap[stat.roleId] || 'Sin rol';
          acc[roleName] = stat._count.id;
        }
        return acc;
      }, {} as Record<string, number>)
    };

    return NextResponse.json({
      success: true,
      users: processedUsers,
      stats,
      rolePermissions
    });
  } catch (error) {
    console.error('Error obteniendo usuarios:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
