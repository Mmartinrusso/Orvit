import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';
import { JWT_SECRET } from '@/lib/auth'; // ✅ Importar el mismo secret

export const dynamic = 'force-dynamic';

const JWT_SECRET_KEY = new TextEncoder().encode(JWT_SECRET);

// ✨ ULTRA OPTIMIZADO: Helper para obtener usuario con solo campos necesarios
async function getUserFromToken(request: NextRequest) {
  try {
    const token = cookies().get('token')?.value;
    if (!token) return null;

    const { payload } = await jwtVerify(token, JWT_SECRET_KEY);
    
    return await prisma.user.findUnique({
      where: { id: payload.userId as number },
      select: {
        id: true,
        name: true,
        role: true,
        companies: {
          select: {
            company: {
              select: {
                id: true
              }
            },
            role: {
              select: {
                name: true,
                displayName: true
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

// GET /api/admin/user-specific-permissions - Obtener permisos específicos de un usuario
export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromToken(request);
    if (!user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    // ✨ OPTIMIZADO: Verificar permisos de admin (sistema o empresa)
    const { hasAccess } = checkAdminAccess(user);
    if (!hasAccess) {
      return NextResponse.json({ error: 'Sin permisos para gestionar permisos específicos' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json({ error: 'userId es requerido' }, { status: 400 });
    }

    // ✨ ULTRA OPTIMIZADO: Usar Prisma con select en lugar de raw SQL
    const specificPermissions = await prisma.userPermission.findMany({
      where: {
        userId: parseInt(userId),
        permission: { isActive: true },
        OR: [
          { expiresAt: null },
          { expiresAt: { gt: new Date() } }
        ]
      },
      select: {
        id: true,
        permissionId: true,
        isGranted: true,
        grantedById: true,
        reason: true,
        expiresAt: true,
        createdAt: true,
        permission: {
          select: {
            name: true,
            description: true,
            category: true
          }
        },
        grantedBy: {
          select: {
            name: true
          }
        }
      },
      orderBy: [
        { permission: { category: 'asc' } },
        { permission: { name: 'asc' } }
      ]
    });

    // ✨ OPTIMIZADO: Transformar a formato esperado por el frontend
    const formattedPermissions = specificPermissions.map(up => ({
      id: up.id,
      permissionId: up.permissionId,
      isGranted: up.isGranted,
      grantedById: up.grantedById,
      reason: up.reason,
      expiresAt: up.expiresAt,
      createdAt: up.createdAt,
      permission_name: up.permission.name,
      permission_description: up.permission.description,
      permission_category: up.permission.category,
      granted_by_name: up.grantedBy?.name || null
    }));

    return NextResponse.json({
      success: true,
      specificPermissions: formattedPermissions
    });

  } catch (error) {
    console.error('❌ Error obteniendo permisos específicos:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

// POST /api/admin/user-specific-permissions - Asignar permiso específico a usuario
export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromToken(request);
    if (!user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    // ✨ OPTIMIZADO: Verificar permisos de admin (sistema o empresa)
    const { hasAccess, companyId } = checkAdminAccess(user);
    if (!hasAccess || !companyId) {
      return NextResponse.json({ error: 'Sin permisos para gestionar permisos específicos' }, { status: 403 });
    }

    const body = await request.json();
    const { userId, permissionId, isGranted, reason, expiresAt } = body;

    // Validaciones
    if (!userId || !permissionId || typeof isGranted !== 'boolean') {
      return NextResponse.json({ 
        error: 'userId, permissionId y isGranted son requeridos' 
      }, { status: 400 });
    }

    const userIdInt = parseInt(userId);
    const permissionIdInt = parseInt(permissionId);

    // ✨ ULTRA OPTIMIZADO: Verificar usuario y permiso en paralelo
    const [targetUser, permission] = await Promise.all([
      prisma.user.findUnique({
        where: { id: userIdInt },
        select: { id: true, name: true }
      }),
      prisma.permission.findUnique({
        where: { id: permissionIdInt, isActive: true },
        select: { id: true, name: true }
      })
    ]);

    if (!targetUser) {
      return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 });
    }

    if (!permission) {
      return NextResponse.json({ error: 'Permiso no encontrado' }, { status: 404 });
    }

    // ✨ ULTRA OPTIMIZADO: Usar upsert de Prisma (más eficiente que verificar + insert/update)
    // Nota: Prisma usa el formato snake_case para constraints compuestos
    await prisma.userPermission.upsert({
      where: {
        userId_permissionId: {
          userId: userIdInt,
          permissionId: permissionIdInt
        }
      },
      update: {
        isGranted,
        grantedById: user.id,
        reason: reason || null,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
        updatedAt: new Date()
      },
      create: {
        userId: userIdInt,
        permissionId: permissionIdInt,
        isGranted,
        grantedById: user.id,
        reason: reason || null,
        expiresAt: expiresAt ? new Date(expiresAt) : null
      }
    });

    // Registrar en audit log
    await prisma.permissionAuditLog.create({
      data: {
        action: 'USER_PERMISSION_CHANGED',
        targetType: 'USER',
        targetId: userIdInt,
        targetName: targetUser.name,
        permissionId: permissionIdInt,
        permissionName: permission.name,
        performedById: user.id,
        performedByName: user.name,
        companyId,
        details: {
          isGranted,
          reason: reason || null,
          expiresAt: expiresAt || null
        }
      }
    });

    return NextResponse.json({
      success: true,
      message: `Permiso específico ${isGranted ? 'otorgado' : 'revocado'} exitosamente`
    });

  } catch (error: any) {
    console.error('❌ Error asignando permiso específico:', error);
    
    // Manejar error de constraint único
    if (error.code === 'P2002') {
      return NextResponse.json({ 
        error: 'El permiso ya está asignado a este usuario' 
      }, { status: 409 });
    }

    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

// DELETE /api/admin/user-specific-permissions - Eliminar permiso específico
export async function DELETE(request: NextRequest) {
  try {
    const user = await getUserFromToken(request);
    if (!user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    // ✨ OPTIMIZADO: Verificar permisos de admin (sistema o empresa)
    const { hasAccess } = checkAdminAccess(user);
    if (!hasAccess) {
      return NextResponse.json({ error: 'Sin permisos para eliminar permisos específicos' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const permissionId = searchParams.get('permissionId');

    if (!userId || !permissionId) {
      return NextResponse.json({ 
        error: 'userId y permissionId son requeridos' 
      }, { status: 400 });
    }

    // ✨ ULTRA OPTIMIZADO: Usar deleteMany con where (más eficiente que raw SQL)
    const result = await prisma.userPermission.deleteMany({
      where: {
        userId: parseInt(userId),
        permissionId: parseInt(permissionId)
      }
    });

    if (result.count === 0) {
      return NextResponse.json({ 
        error: 'Permiso específico no encontrado' 
      }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      message: 'Permiso específico eliminado exitosamente'
    });

  } catch (error) {
    console.error('❌ Error eliminando permiso específico:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
