import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';
import { JWT_SECRET } from '@/lib/auth';
import { auditRoleChange, auditPermissionChange } from '@/lib/audit';
import { cached, invalidateCache } from '@/lib/cache/cache-manager';
import { roleKeys, TTL } from '@/lib/cache/cache-keys';

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

// GET /api/admin/roles - Obtener roles de la empresa
export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromToken(request);
    if (!user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }

    const { hasAccess, companyId } = checkAdminAccess(user);
    if (!hasAccess || !companyId) {
      return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 });
    }

    const cacheKey = roleKeys.listByCompany(companyId);

    const formattedRoles = await cached(cacheKey, async () => {
      const roles = await prisma.role.findMany({
        where: { companyId },
        include: {
          permissions: {
            where: { isGranted: true },
            include: {
              permission: {
                select: {
                  id: true,
                  name: true,
                  description: true,
                  category: true,
                  isActive: true
                }
              }
            }
          },
          users: {
            select: { id: true }
          }
        }
      });

      return roles.reduce((acc, role) => {
        acc[role.name] = {
          name: role.name,
          displayName: role.displayName || role.name,
          description: role.description || `Rol ${role.name}`,
          isSystem: false,
          userCount: role.users.length,
          permissions: role.permissions.map(rp => ({
            id: rp.permission.id,
            name: rp.permission.name,
            description: rp.permission.description,
            category: rp.permission.category,
            isActive: rp.permission.isActive
          }))
        };
        return acc;
      }, {} as Record<string, any>);
    }, TTL.MEDIUM); // 5 min - permisos de roles

    return NextResponse.json({
      success: true,
      roles: formattedRoles
    });
  } catch (error) {
    console.error('Error obteniendo roles:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}

// POST /api/admin/roles - Asignar permiso a rol
export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromToken(request);
    if (!user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }

    const { hasAccess, companyId } = checkAdminAccess(user);
    if (!hasAccess || !companyId) {
      return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 });
    }

    const { roleName, permissionId, isGranted } = await request.json();

    if (!roleName || permissionId === undefined || isGranted === undefined) {
      return NextResponse.json({ error: 'Faltan parámetros requeridos' }, { status: 400 });
    }

    // ✨ OPTIMIZADO: Verificar rol y permiso en paralelo
    const [role, permission] = await Promise.all([
      prisma.role.findFirst({
        where: { name: roleName, companyId }
      }),
      prisma.permission.findUnique({
        where: { id: permissionId }
      })
    ]);

    if (!role) {
      return NextResponse.json({ error: 'Rol no encontrado' }, { status: 404 });
    }

    if (!permission) {
      return NextResponse.json({ error: 'Permiso no encontrado' }, { status: 404 });
    }

    const rolePermission = await prisma.rolePermission.upsert({
      where: {
        roleId_permissionId: {
          roleId: role.id,
          permissionId: permission.id
        }
      },
      update: { isGranted },
      create: {
        roleId: role.id,
        permissionId: permission.id,
        isGranted
      }
    });

    // Registrar en audit log (permissionAuditLog existente)
    await prisma.permissionAuditLog.create({
      data: {
        action: isGranted ? 'PERMISSION_GRANTED' : 'PERMISSION_REVOKED',
        targetType: 'ROLE',
        targetId: role.id,
        targetName: role.displayName || role.name,
        permissionId: permission.id,
        permissionName: permission.name,
        performedById: user.id,
        performedByName: user.name,
        companyId
      }
    });

    // Invalidar caché de roles
    await invalidateCache([roleKeys.listByCompany(companyId)]);

    // Audit log general
    auditPermissionChange(
      user.id,
      companyId,
      role.id,
      { roleName: role.name, permissionName: permission.name, wasGranted: !isGranted },
      { roleName: role.name, permissionName: permission.name, isGranted },
      `Permiso "${permission.name}" ${isGranted ? 'asignado a' : 'removido de'} rol "${role.displayName || role.name}"`,
      request
    );

    return NextResponse.json({
      success: true,
      message: `Permiso ${isGranted ? 'asignado' : 'removido'} exitosamente`,
      rolePermission
    });
  } catch (error) {
    console.error('Error asignando permiso a rol:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}

// PUT /api/admin/roles - Crear nuevo rol
export async function PUT(request: NextRequest) {
  try {
    const user = await getUserFromToken(request);
    if (!user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }

    const { hasAccess, companyId } = checkAdminAccess(user);
    if (!hasAccess || !companyId) {
      return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 });
    }

    const { name, displayName, description, sectorId } = await request.json();

    if (!name || !displayName) {
      return NextResponse.json({ error: 'Nombre y nombre de visualización son requeridos' }, { status: 400 });
    }

    // ✨ OPTIMIZADO: Verificar existencia y validar sector en paralelo
    const [existingRole, sector] = await Promise.all([
      prisma.role.findFirst({
        where: { name, companyId }
      }),
      sectorId ? prisma.sector.findFirst({
        where: { id: sectorId, companyId }
      }) : Promise.resolve(null)
    ]);

    if (existingRole) {
      return NextResponse.json({ error: 'Ya existe un rol con ese nombre en tu empresa' }, { status: 409 });
    }

    if (sectorId && !sector) {
      return NextResponse.json({ error: 'El sector seleccionado no pertenece a tu empresa' }, { status: 400 });
    }

    const newRole = await prisma.role.create({
      data: {
        name,
        displayName,
        description: description || '',
        companyId,
        sectorId: sectorId || null
      }
    });

    // Registrar en audit log (permissionAuditLog existente)
    await prisma.permissionAuditLog.create({
      data: {
        action: 'ROLE_CREATED',
        targetType: 'ROLE',
        targetId: newRole.id,
        targetName: displayName,
        performedById: user.id,
        performedByName: user.name,
        companyId,
        details: {
          roleName: name,
          roleDisplayName: displayName,
          description: description || '',
          sectorId: sectorId || null
        }
      }
    });

    // Invalidar caché de roles
    await invalidateCache([roleKeys.listByCompany(companyId)]);

    // Audit log general
    auditRoleChange(
      user.id,
      companyId,
      newRole.id,
      null,
      { name, displayName, description: description || '', sectorId: sectorId || null },
      `Rol "${displayName}" creado`,
      request
    );

    return NextResponse.json({
      success: true,
      message: 'Rol creado exitosamente',
      role: newRole
    });
  } catch (error) {
    console.error('Error creando rol:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}

// DELETE /api/admin/roles - Eliminar rol
export async function DELETE(request: NextRequest) {
  try {
    const user = await getUserFromToken(request);
    if (!user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }

    const { hasAccess, companyId } = checkAdminAccess(user);
    if (!hasAccess || !companyId) {
      return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const roleName = searchParams.get('role');

    if (!roleName) {
      return NextResponse.json({ error: 'Nombre del rol es requerido' }, { status: 400 });
    }

    const role = await prisma.role.findFirst({
      where: { name: roleName, companyId },
      include: {
        users: { select: { id: true } },
        permissions: { select: { id: true } }
      }
    });

    if (!role) {
      return NextResponse.json({ error: 'Rol no encontrado' }, { status: 404 });
    }

    if (role.users.length > 0) {
      return NextResponse.json({ 
        error: 'No se puede eliminar un rol que tiene usuarios asignados' 
      }, { status: 400 });
    }

    // Guardar información del rol antes de eliminarlo para el audit log
    const roleInfo = {
      id: role.id,
      name: role.name,
      displayName: role.displayName,
      permissionsCount: role.permissions.length
    };

    // ✨ CORREGIDO: Usar transacción para garantizar atomicidad
    await prisma.$transaction(async (tx) => {
      // 1. Eliminar permisos del rol
      await tx.rolePermission.deleteMany({ where: { roleId: role.id } });
      // 2. Eliminar el rol
      await tx.role.delete({ where: { id: role.id } });
      // 3. Registrar en audit log
      await tx.permissionAuditLog.create({
        data: {
          action: 'ROLE_DELETED',
          targetType: 'ROLE',
          targetId: roleInfo.id,
          targetName: roleInfo.displayName || roleInfo.name,
          performedById: user.id,
          performedByName: user.name,
          companyId,
          details: {
            roleName: roleInfo.name,
            roleDisplayName: roleInfo.displayName,
            permissionsRemoved: roleInfo.permissionsCount
          }
        }
      });
    });

    // Invalidar caché de roles
    await invalidateCache([roleKeys.listByCompany(companyId)]);

    // Audit log general (fire-and-forget, fuera de transacción)
    auditRoleChange(
      user.id,
      companyId,
      roleInfo.id,
      { name: roleInfo.name, displayName: roleInfo.displayName, permissionsCount: roleInfo.permissionsCount },
      {},
      `Rol "${roleInfo.displayName || roleInfo.name}" eliminado`,
      request
    );

    return NextResponse.json({
      success: true,
      message: 'Rol eliminado exitosamente'
    });
  } catch (error) {
    console.error('Error eliminando rol:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
