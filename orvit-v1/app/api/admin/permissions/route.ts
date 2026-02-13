import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';
import { UserRole } from '@prisma/client';
import { JWT_SECRET } from '@/lib/auth';
import { cached, invalidateCache, invalidateCachePattern } from '@/lib/cache/cache-manager';
import { permissionKeys, roleKeys, TTL } from '@/lib/cache/cache-keys';

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

// GET /api/admin/permissions - Obtener todos los permisos
export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromToken(request);
    if (!user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { hasAccess } = checkAdminAccess(user);
    if (!hasAccess) {
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 });
    }

    const cacheKey = permissionKeys.adminPermissions();

    const result = await cached(cacheKey, async () => {
      const [permissions, categoriesData] = await Promise.all([
        prisma.permission.findMany({
          where: { isActive: true },
          orderBy: [{ category: 'asc' }, { name: 'asc' }],
          select: {
            id: true,
            name: true,
            description: true,
            category: true,
            isActive: true,
            createdAt: true,
            updatedAt: true
          }
        }),
        prisma.permission.findMany({
          where: {
            isActive: true,
            category: { not: null }
          },
          select: { category: true },
          distinct: ['category']
        })
      ]);

      const categories = categoriesData
        .map(c => c.category)
        .filter((c): c is string => c !== null)
        .sort();

      return {
        permissions,
        categories,
        stats: {
          totalPermissions: permissions.length,
          totalCategories: categories.length
        }
      };
    }, TTL.LONG); // 15 min - permisos del sistema cambian muy poco

    return NextResponse.json({
      success: true,
      ...result
    });
  } catch (error) {
    console.error('Error obteniendo permisos:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}

// POST /api/admin/permissions - Crear nuevo permiso
export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromToken(request);
    if (!user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    if (user.role !== UserRole.SUPERADMIN) {
      return NextResponse.json({ error: 'Solo SUPERADMIN puede crear permisos' }, { status: 403 });
    }

    const { name, description, category } = await request.json();
    
    if (!name || !description || !category) {
      return NextResponse.json({ 
        error: 'name, description y category son requeridos' 
      }, { status: 400 });
    }

    // ✨ OPTIMIZADO: Verificar existencia y crear en una sola transacción
    const existing = await prisma.permission.findUnique({
      where: { name }
    });

    if (existing) {
      return NextResponse.json({ 
        error: 'Ya existe un permiso con ese nombre' 
      }, { status: 409 });
    }

    const permission = await prisma.permission.create({
      data: {
        name,
        description,
        category,
        isActive: true
      }
    });

    // Invalidar caché de permisos
    await invalidateCache([permissionKeys.adminPermissions()]);

    return NextResponse.json({
      success: true,
      message: 'Permiso creado exitosamente',
      permission
    });
  } catch (error) {
    console.error('Error creando permiso:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}

// DELETE /api/admin/permissions - Eliminar todos los permisos y sus asignaciones
export async function DELETE(request: NextRequest) {
  try {
    const user = await getUserFromToken(request);
    if (!user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    if (user.role !== UserRole.SUPERADMIN) {
      return NextResponse.json({ 
        error: 'Solo SUPERADMIN puede eliminar todos los permisos' 
      }, { status: 403 });
    }

    const [deletedRolePermissions, deletedUserPermissions, deletedPermissions] = await Promise.all([
      prisma.rolePermission.deleteMany({}),
      prisma.userPermission.deleteMany({}),
      prisma.permission.deleteMany({})
    ]);

    // Invalidar caché de permisos y roles (los roles incluyen permisos)
    await Promise.all([
      invalidateCache([permissionKeys.adminPermissions()]),
      invalidateCachePattern('roles:list:*'),
    ]);

    return NextResponse.json({
      success: true,
      message: 'Todos los permisos han sido eliminados',
      deleted: {
        permissions: deletedPermissions.count,
        rolePermissions: deletedRolePermissions.count,
        userPermissions: deletedUserPermissions.count
      }
    });
  } catch (error) {
    console.error('Error eliminando permisos:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
