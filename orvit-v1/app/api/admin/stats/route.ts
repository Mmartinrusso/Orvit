import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';
import { UserRole } from '@prisma/client';
import { JWT_SECRET } from '@/lib/auth'; // ✅ Importar el mismo secret

export const dynamic = 'force-dynamic';


const JWT_SECRET_KEY = new TextEncoder().encode(JWT_SECRET);

async function getUserFromToken() {
  try {
    const token = cookies().get('token')?.value;
    if (!token) return null;
    const { payload } = await jwtVerify(token, JWT_SECRET_KEY);
    return payload.userId as number;
  } catch (error) {
    return null;
  }
}

async function checkUserPermission(userId: number, userRole: string, companyId: number | null, permission: string): Promise<boolean> {
  try {
    // SUPERADMIN tiene todos los permisos
    if (userRole === 'SUPERADMIN') {
      return true;
    }

    // Si no hay companyId, no se pueden verificar permisos
    if (!companyId) {
      return false;
    }

    // 1. Verificar permisos específicos del usuario primero
    const userPermission = await prisma.userPermission.findFirst({
      where: {
        userId: userId,
        permission: {
          name: permission,
          isActive: true
        },
        OR: [
          { expiresAt: null },
          { expiresAt: { gt: new Date() } }
        ]
      }
    });

    if (userPermission) {
      return userPermission.isGranted;
    }

    // 2. Verificar permisos del rol
    const rolePermission = await prisma.rolePermission.findFirst({
      where: {
        role: {
          name: userRole,
          companyId: companyId
        },
        permission: {
          name: permission,
          isActive: true
        },
        isGranted: true
      }
    });

    if (rolePermission) {
      return true;
    }

    return false;
  } catch (error) {
    return false;
  }
}

// Caché en memoria para stats (2 minutos TTL)
const statsCache = new Map<string, { data: any; timestamp: number }>();
const STATS_CACHE_TTL = 2 * 60 * 1000; // 2 minutos

export async function GET(request: NextRequest) {
  try {
    const userId = await getUserFromToken();
    if (!userId) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    // Obtener companyId desde query params
    const { searchParams } = new URL(request.url);
    const companyIdParam = searchParams.get('companyId');
    let companyId: number | null = companyIdParam ? parseInt(companyIdParam) : null;

    // Verificar caché
    const cacheKey = `stats-${userId}-${companyId || 'all'}`;
    const cached = statsCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < STATS_CACHE_TTL) {
      return NextResponse.json(cached.data, {
        headers: {
          'Cache-Control': 'public, max-age=120',
          'X-Cache': 'HIT'
        }
      });
    }

    // Optimización: Solo obtener datos necesarios del usuario
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        role: true,
        companies: {
          select: {
            companyId: true,
            company: {
              select: {
                id: true
              }
            },
            role: {
              select: {
                name: true
              }
            }
          }
        },
        ownedCompanies: {
          select: {
            id: true
          },
          take: 1
        }
      }
    });

    if (!user) {
      return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
    }

    // Si no se pasó companyId, usar el del usuario
    let userRole: string = user.role;
    if (!companyId) {
      if (user.ownedCompanies && user.ownedCompanies.length > 0) {
        companyId = user.ownedCompanies[0].id;
      } else if (user.companies && user.companies.length > 0) {
        companyId = user.companies[0].company.id;
        if (user.companies[0].role) {
          userRole = user.companies[0].role.name;
        }
      }
    } else {
      // Si se pasó companyId, obtener el rol del usuario en esa empresa
      const userCompany = user.companies.find(uc => uc.company.id === companyId);
      if (userCompany?.role) {
        userRole = userCompany.role.name;
      }
    }

    // Verificar permisos del usuario
    const permissionsToCheck = [
      'gestionar_usuarios',
      'users.view',
      'ingresar_permisos',
      'admin.roles',
      'admin.permissions',
      'companies.view',
      'ingresar_administracion' // Para verificar acceso a costos
    ];

    const userPermissions: Record<string, boolean> = {};
    
    if (userRole === 'SUPERADMIN') {
      // SUPERADMIN tiene todos los permisos
      permissionsToCheck.forEach(perm => {
        userPermissions[perm] = true;
      });
    } else if (companyId) {
      // Optimización: Verificar todos los permisos en paralelo
      const permissionChecks = await Promise.all(
        permissionsToCheck.map(perm => 
          checkUserPermission(userId, userRole, companyId, perm).then(result => ({ perm, result }))
        )
      );
      permissionChecks.forEach(({ perm, result }) => {
        userPermissions[perm] = result;
      });
    } else {
      // Usuario sin empresa y no SUPERADMIN - sin permisos
      permissionsToCheck.forEach(perm => {
        userPermissions[perm] = false;
      });
    }

    // Determinar qué puede ver el usuario
    const canViewUsers = userPermissions['gestionar_usuarios'] || userPermissions['users.view'] || userRole === 'SUPERADMIN';
    const canViewRoles = userPermissions['admin.roles'] || userRole === 'SUPERADMIN';
    const canViewPermissions = userPermissions['ingresar_permisos'] || userPermissions['admin.permissions'] || userRole === 'SUPERADMIN';
    const canViewCompanies = userPermissions['companies.view'] || userRole === 'SUPERADMIN';
    const canViewCosts = userPermissions['ingresar_administracion'] || userRole === 'SUPERADMIN' || userRole === 'ADMIN';

    // Construir filtros según permisos y empresa
    // Siempre filtrar por empresa si hay companyId (incluso para SUPERADMIN)
    const userWhere = companyId 
      ? {
          companies: {
            some: {
              companyId: companyId,
              isActive: true
            }
          },
          // Excluir SUPERADMIN
          role: {
            not: UserRole.SUPERADMIN
          }
        }
      : {
          // Si no hay companyId, excluir SUPERADMIN de todas formas
          role: {
            not: UserRole.SUPERADMIN
          }
        };
    
    const roleWhere = companyId
      ? { 
          companyId: companyId,
          // Excluir roles de sistema (SUPERADMIN)
          name: {
            not: 'SUPERADMIN'
          }
        }
      : {
          // Excluir roles de sistema
          name: {
            not: 'SUPERADMIN'
          }
        };

    // Obtener estadísticas según permisos
    // Siempre agregar todas las promesas en el mismo orden para mantener el índice consistente
    const promises: Promise<any>[] = [
      // Estadísticas de usuarios (4 promesas)
      canViewUsers ? prisma.user.count({ where: userWhere }) : Promise.resolve(0),
      canViewUsers ? prisma.user.count({ where: { ...userWhere, isActive: true } }) : Promise.resolve(0),
      canViewUsers ? prisma.user.count({ where: { ...userWhere, isActive: false } }) : Promise.resolve(0),
      // Usuarios por rol de la empresa (desde UserOnCompany.role, no User.role)
      // Usar findMany y agrupar manualmente porque roleId puede ser null
      canViewUsers && companyId ? prisma.userOnCompany.findMany({
        where: {
          companyId: companyId,
          isActive: true,
          role: {
            name: {
              not: 'SUPERADMIN'
            }
          },
          roleId: {
            not: null
          }
        },
        select: {
          roleId: true,
          role: {
            select: {
              name: true,
              displayName: true
            }
          }
        }
      }).then(users => {
        // Agrupar manualmente por roleId
        const grouped = users.reduce((acc, uc) => {
          if (uc.roleId) {
            const key = uc.roleId.toString();
            if (!acc[key]) {
              acc[key] = { roleId: uc.roleId, _count: { roleId: 0 } };
            }
            acc[key]._count.roleId++;
          }
          return acc;
        }, {} as Record<string, any>);
        return Object.values(grouped);
      }) : Promise.resolve([]),
      
      // Estadísticas de roles (2 promesas) - Optimizado con select explícito
      canViewRoles ? prisma.role.count({ where: roleWhere }) : Promise.resolve(0),
      canViewRoles ? prisma.role.findMany({
        where: roleWhere,
        select: {
          id: true,
          name: true,
          displayName: true,
          _count: {
            select: {
              userOnCompanies: true
            }
          }
        },
        take: 20
      }) : Promise.resolve([]),
      
      // Estadísticas de permisos (2 promesas)
      canViewPermissions ? prisma.permission.count({ where: { isActive: true } }) : Promise.resolve(0),
      canViewPermissions ? prisma.rolePermission.groupBy({
        by: ['permissionId'],
        where: {
          isGranted: true,
          ...(roleWhere.companyId ? {
            role: roleWhere
          } : {})
        },
        _count: {
          permissionId: true
        },
        orderBy: {
          _count: {
            permissionId: 'desc'
          }
        },
        take: 10
      }) : Promise.resolve([]),
      
      // Estadísticas de empresas (1 promesa)
      canViewCompanies ? prisma.company.count() : Promise.resolve(0),
      
      // Usuarios recientes de la empresa (1 promesa)
      canViewUsers && companyId ? prisma.userOnCompany.findMany({
        where: {
          companyId: companyId,
          isActive: true,
          user: {
            role: {
              not: 'SUPERADMIN'
            }
          }
        },
        orderBy: {
          joinedAt: 'desc'
        },
        take: 5,
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              isActive: true,
              createdAt: true
            }
          },
          role: {
            select: {
              name: true,
              displayName: true
            }
          }
        }
      }) : Promise.resolve([]),
      
      // Roles recientes de la empresa (1 promesa)
      canViewRoles ? prisma.role.findMany({
        where: roleWhere,
        orderBy: {
          createdAt: 'desc'
        },
        take: 5,
        select: {
          id: true,
          name: true,
          displayName: true,
          description: true,
          createdAt: true,
          _count: {
            select: {
              users: {
                where: companyId ? { companyId: companyId } : {}
              }
            }
          }
        }
      }) : Promise.resolve([])
    ];

    const results = await Promise.all(promises);
    
    // Extraer resultados en el mismo orden que las promesas
    let idx = 0;
    const totalUsers = Number(results[idx++]) || 0;
    const activeUsers = Number(results[idx++]) || 0;
    const inactiveUsers = Number(results[idx++]) || 0;
    const usersByRoleRaw = results[idx++];
    const usersByRole = Array.isArray(usersByRoleRaw) ? usersByRoleRaw : [];
    const totalRoles = Number(results[idx++]) || 0;
    const rolesWithUsersRaw = results[idx++];
    const rolesWithUsers = Array.isArray(rolesWithUsersRaw) ? rolesWithUsersRaw : [];
    const totalPermissions = Number(results[idx++]) || 0;
    const permissionsByRoleRaw = results[idx++];
    const permissionsByRole = Array.isArray(permissionsByRoleRaw) ? permissionsByRoleRaw : [];
    const totalCompanies = Number(results[idx++]) || 0;
    const recentUsersRaw = results[idx++];
    const recentUsersRawArray = Array.isArray(recentUsersRaw) ? recentUsersRaw : [];
    // Formatear usuarios recientes desde UserOnCompany
    const recentUsers = recentUsersRawArray.map((uc: any) => ({
      id: uc.user?.id || uc.id,
      name: uc.user?.name || uc.name,
      email: uc.user?.email || uc.email,
      role: uc.role?.displayName || uc.role?.name || uc.role || 'Sin rol',
      isActive: uc.user?.isActive !== undefined ? uc.user.isActive : uc.isActive,
      createdAt: uc.joinedAt || uc.user?.createdAt || new Date().toISOString()
    }));
    
    const recentRolesRaw = results[idx++];
    const recentRoles = Array.isArray(recentRolesRaw) ? recentRolesRaw : [];

    // Optimización: Ejecutar consultas adicionales en paralelo
    const [permissions, rolesForUsers] = await Promise.all([
      // Obtener nombres de permisos más comunes
      (async () => {
        const permissionIds = permissionsByRole.map(p => p.permissionId);
        if (permissionIds.length === 0) return [];
        return await prisma.permission.findMany({
          where: {
            id: { in: permissionIds }
          },
          select: {
            id: true,
            name: true,
            description: true
          }
        });
      })(),
      // Obtener los nombres de los roles para usuarios por rol
      (async () => {
        if (!canViewUsers || !companyId || !Array.isArray(usersByRole) || usersByRole.length === 0) {
          return [];
        }
        const roleIds = usersByRole.map((item: any) => item.roleId);
        if (roleIds.length === 0) return [];
        return await prisma.role.findMany({
          where: {
            id: { in: roleIds },
            companyId: companyId
          },
          select: {
            id: true,
            name: true,
            displayName: true
          }
        });
      })()
    ]);

    const permissionsWithCount = permissions.map(perm => {
      const count = permissionsByRole.find(p => p.permissionId === perm.id)?._count.permissionId || 0;
      return {
        ...perm,
        roleCount: count
      };
    }).sort((a, b) => b.roleCount - a.roleCount);

    // Formatear usuarios por rol de la empresa
    let usersByRoleFormatted: Record<string, number> = {};
    if (canViewUsers && companyId && Array.isArray(usersByRole) && usersByRole.length > 0 && rolesForUsers.length > 0) {
      usersByRoleFormatted = usersByRole.reduce((acc, item: any) => {
        const role = rolesForUsers.find(r => r.id === item.roleId);
        if (role) {
          const roleName = role.displayName || role.name;
          acc[roleName] = (acc[roleName] || 0) + item._count.roleId;
        }
        return acc;
      }, {} as Record<string, number>);
    }

    // Estadísticas de UserOnCompany (solo si puede ver usuarios)
    // ✅ OPTIMIZADO: Ejecutar ambas queries en paralelo
    let totalUserCompanyRelations = 0;
    let activeUserCompanyRelations = 0;
    if (canViewUsers) {
      const relationWhere = companyId
        ? { companyId: companyId }
        : {};
      const [totalRelations, activeRelations] = await Promise.all([
        prisma.userOnCompany.count({ where: relationWhere }),
        prisma.userOnCompany.count({ where: { ...relationWhere, isActive: true } })
      ]);
      totalUserCompanyRelations = totalRelations;
      activeUserCompanyRelations = activeRelations;
    }

    // ✅ SUPER OPTIMIZADO: Estadísticas de costos con una sola query combinada
    let costsStats = null;
    if (canViewCosts && companyId) {
      try {
        const currentMonth = new Date().toISOString().slice(0, 7);
        
        // Una sola query que obtiene todas las estadísticas de costos
        const [costStatsResult] = await prisma.$queryRaw<any[]>`
          SELECT 
            (SELECT COUNT(*) FROM employees WHERE company_id = ${companyId}) as total_employees,
            (SELECT COUNT(*) FROM employee_categories WHERE company_id = ${companyId}) as total_employee_categories,
            (SELECT COALESCE(SUM(total_cost), 0) FROM employee_monthly_salaries WHERE company_id = ${companyId} AND fecha_imputacion = ${currentMonth}) as total_employee_costs,
            (SELECT COUNT(*) FROM indirect_cost_base WHERE company_id = ${companyId}) as total_indirect_costs,
            (SELECT COUNT(DISTINCT category_id) FROM indirect_cost_base WHERE company_id = ${companyId}) as total_indirect_categories,
            (SELECT COALESCE(SUM(icmr.amount), 0) FROM indirect_cost_monthly_records icmr 
             INNER JOIN indirect_cost_base icb ON icmr.cost_base_id = icb.id 
             WHERE icb.company_id = ${companyId} AND icmr.month = ${currentMonth}) as total_indirect_monthly
        `;

        const employeeCosts = Number(costStatsResult?.total_employee_costs) || 0;
        const indirectCosts = Number(costStatsResult?.total_indirect_monthly) || 0;

        costsStats = {
          employees: {
            total: Number(costStatsResult?.total_employees) || 0,
            categories: Number(costStatsResult?.total_employee_categories) || 0,
            monthlyCost: employeeCosts
          },
          indirectCosts: {
            total: Number(costStatsResult?.total_indirect_costs) || 0,
            categories: Number(costStatsResult?.total_indirect_categories) || 0,
            monthlyCost: indirectCosts
          },
          totalMonthlyCost: employeeCosts + indirectCosts
        };
      } catch (costsError) {
        console.error('Error obteniendo estadísticas de costos:', costsError);
        costsStats = null;
      }
    }

    const response = {
      permissions: {
        canViewUsers,
        canViewRoles,
        canViewPermissions,
        canViewCompanies,
        canViewCosts
      },
      users: canViewUsers ? {
        total: totalUsers,
        active: activeUsers,
        inactive: inactiveUsers,
        byRole: usersByRoleFormatted
      } : null,
      roles: canViewRoles ? {
        total: totalRoles,
        topRoles: rolesWithUsers
          .map(role => ({
            id: role.id,
            name: role.name,
            displayName: role.displayName,
            userCount: role._count?.userOnCompanies || 0
          }))
          .sort((a, b) => b.userCount - a.userCount)
          .slice(0, 10)
      } : null,
      permissionsData: canViewPermissions ? {
        total: totalPermissions,
        mostCommon: permissionsWithCount
      } : null,
      companies: canViewCompanies ? {
        total: totalCompanies
      } : null,
      relations: canViewUsers ? {
        total: totalUserCompanyRelations,
        active: activeUserCompanyRelations
      } : null,
      recent: {
        users: canViewUsers ? (Array.isArray(recentUsers) ? recentUsers : []) : [],
        roles: canViewRoles ? (Array.isArray(recentRoles) ? recentRoles : []) : []
      },
      costs: costsStats
    };

    // Guardar en caché
    statsCache.set(cacheKey, {
      data: response,
      timestamp: Date.now()
    });

    // Limpiar caché antiguo
    if (statsCache.size > 50) {
      const now = Date.now();
      for (const [key, value] of statsCache.entries()) {
        if (now - value.timestamp > STATS_CACHE_TTL) {
          statsCache.delete(key);
        }
      }
    }

    return NextResponse.json(response, {
      headers: {
        'Cache-Control': 'public, max-age=120',
        'X-Cache': 'MISS'
      }
    });

  } catch (error) {
    console.error('Error obteniendo estadísticas de administración:', error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}


