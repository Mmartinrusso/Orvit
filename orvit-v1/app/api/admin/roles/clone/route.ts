import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';
import { JWT_SECRET } from '@/lib/auth';

export const dynamic = 'force-dynamic';

const JWT_SECRET_KEY = new TextEncoder().encode(JWT_SECRET);

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

function getUserCompanyId(user: NonNullable<Awaited<ReturnType<typeof getUserFromToken>>>): number | null {
  if (user.ownedCompanies?.length > 0) {
    return user.ownedCompanies[0].id;
  }
  if (user.companies?.length > 0) {
    return user.companies[0].company.id;
  }
  return null;
}

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

// POST /api/admin/roles/clone - Clonar un rol existente
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

    const { sourceRoleName, newName, newDisplayName, newDescription } = await request.json();

    if (!sourceRoleName || !newName || !newDisplayName) {
      return NextResponse.json({
        error: 'Faltan parámetros requeridos: sourceRoleName, newName, newDisplayName'
      }, { status: 400 });
    }

    // Verificar que el rol origen existe
    const sourceRole = await prisma.role.findFirst({
      where: { name: sourceRoleName, companyId },
      include: {
        permissions: {
          where: { isGranted: true },
          include: {
            permission: true
          }
        }
      }
    });

    if (!sourceRole) {
      return NextResponse.json({ error: 'Rol origen no encontrado' }, { status: 404 });
    }

    // Verificar que no exista un rol con el nuevo nombre
    const existingRole = await prisma.role.findFirst({
      where: { name: newName, companyId }
    });

    if (existingRole) {
      return NextResponse.json({
        error: 'Ya existe un rol con ese nombre en tu empresa'
      }, { status: 409 });
    }

    // Crear el nuevo rol y copiar permisos en una transacción
    const result = await prisma.$transaction(async (tx) => {
      // 1. Crear el nuevo rol
      const newRole = await tx.role.create({
        data: {
          name: newName,
          displayName: newDisplayName,
          description: newDescription || sourceRole.description || '',
          companyId,
          sectorId: sourceRole.sectorId
        }
      });

      // 2. Copiar todos los permisos del rol origen
      const permissionsCopied = [];
      for (const rolePermission of sourceRole.permissions) {
        await tx.rolePermission.create({
          data: {
            roleId: newRole.id,
            permissionId: rolePermission.permissionId,
            isGranted: true
          }
        });
        permissionsCopied.push(rolePermission.permission.name);
      }

      // 3. Crear registro de auditoría
      await tx.permissionAuditLog.create({
        data: {
          action: 'ROLE_CLONED',
          targetType: 'ROLE',
          targetId: newRole.id,
          targetName: newDisplayName,
          performedById: user.id,
          performedByName: user.name,
          companyId,
          details: {
            sourceRoleId: sourceRole.id,
            sourceRoleName: sourceRole.name,
            sourceRoleDisplayName: sourceRole.displayName,
            permissionsCloned: permissionsCopied,
            permissionsCount: permissionsCopied.length
          }
        }
      });

      return {
        role: newRole,
        permissionsCount: permissionsCopied.length
      };
    });

    return NextResponse.json({
      success: true,
      message: `Rol "${newDisplayName}" clonado exitosamente con ${result.permissionsCount} permisos`,
      role: result.role,
      permissionsCloned: result.permissionsCount
    });

  } catch (error) {
    console.error('Error clonando rol:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
