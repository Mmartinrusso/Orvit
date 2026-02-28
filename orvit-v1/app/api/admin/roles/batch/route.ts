import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';
import { JWT_SECRET } from '@/lib/auth';
import { invalidateUserPermissions } from '@/lib/permissions-helpers';

export const dynamic = 'force-dynamic';

const JWT_SECRET_KEY = new TextEncoder().encode(JWT_SECRET);

async function getUserFromToken() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;
    if (!token) return null;

    const { payload } = await jwtVerify(token, JWT_SECRET_KEY);
    return await prisma.user.findUnique({
      where: { id: payload.userId as number },
      include: {
        companies: { include: { company: true, role: true } },
        ownedCompanies: true,
      },
    });
  } catch {
    return null;
  }
}

function isAdminRole(
  systemRole: string,
  companyRoleName: string | null | undefined,
  companyRoleDisplayName: string | null | undefined
): boolean {
  const systemAdminRoles = ['SUPERADMIN', 'ADMIN', 'ADMIN_ENTERPRISE'];
  if (systemAdminRoles.includes(systemRole)) return true;
  if (!companyRoleName && !companyRoleDisplayName) return false;
  const normalizedName = (companyRoleName || '').trim().toUpperCase();
  const normalizedDisplay = (companyRoleDisplayName || '').trim().toUpperCase();
  const keywords = ['ADMINISTRADOR', 'ADMIN', 'ADMINISTRATOR', 'ADMIN EMPRESA', 'ADMIN_EMPRESA'];
  return keywords.some(k => normalizedName.includes(k) || normalizedDisplay.includes(k));
}

// POST /api/admin/roles/batch — Asignar múltiples permisos a un rol en una transacción
export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromToken();
    if (!user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }

    const companyId = user.ownedCompanies?.[0]?.id || user.companies?.[0]?.company.id;
    if (!companyId) {
      return NextResponse.json({ error: 'Sin empresa asociada' }, { status: 403 });
    }

    const userCompany = user.companies?.find(uc => uc.company.id === companyId);
    const hasAccess = isAdminRole(user.role, userCompany?.role?.name, userCompany?.role?.displayName);
    if (!hasAccess) {
      return NextResponse.json({ error: 'Sin permisos de administrador' }, { status: 403 });
    }

    const { roleName, permissionNames, isGranted } = await request.json();

    if (!roleName || !Array.isArray(permissionNames) || permissionNames.length === 0) {
      return NextResponse.json({ error: 'roleName y permissionNames[] son requeridos' }, { status: 400 });
    }

    // Buscar rol
    const role = await prisma.role.findFirst({
      where: { name: roleName, companyId },
    });
    if (!role) {
      return NextResponse.json({ error: 'Rol no encontrado' }, { status: 404 });
    }

    // Buscar permisos por nombre
    const permissions = await prisma.permission.findMany({
      where: { name: { in: permissionNames }, isActive: true },
    });

    if (permissions.length === 0) {
      return NextResponse.json({ error: 'Ningún permiso válido encontrado' }, { status: 400 });
    }

    // Ejecutar todo en una transacción
    const grant = isGranted !== false; // default true
    const result = await prisma.$transaction(async (tx) => {
      const results = [];

      for (const perm of permissions) {
        const rp = await tx.rolePermission.upsert({
          where: {
            roleId_permissionId: { roleId: role.id, permissionId: perm.id },
          },
          update: { isGranted: grant },
          create: { roleId: role.id, permissionId: perm.id, isGranted: grant },
        });
        results.push(rp);
      }

      // Audit log — un solo registro para la operación batch
      await tx.permissionAuditLog.create({
        data: {
          action: grant ? 'PERMISSION_GRANTED' : 'PERMISSION_REVOKED',
          targetType: 'ROLE',
          targetId: role.id,
          targetName: role.displayName || role.name,
          permissionId: permissions[0].id,
          permissionName: `BATCH: ${permissions.map(p => p.name).join(', ')}`,
          performedById: user.id,
          performedByName: user.name,
          companyId,
        },
      });

      return results;
    });

    // Invalidar caché Redis de todos los usuarios con este rol
    const usersWithRole = await prisma.userCompany.findMany({
      where: { roleId: role.id },
      select: { userId: true },
    });

    await Promise.all(
      usersWithRole.map(uc => invalidateUserPermissions(uc.userId, companyId))
    );

    const notFound = permissionNames.filter(
      (n: string) => !permissions.some(p => p.name === n)
    );

    return NextResponse.json({
      success: true,
      applied: result.length,
      total: permissionNames.length,
      notFound: notFound.length > 0 ? notFound : undefined,
      message: `${result.length} permisos ${grant ? 'asignados' : 'removidos'} al rol "${role.displayName || role.name}"`,
    });
  } catch (error: any) {
    console.error('Error en batch role permissions:', error);
    return NextResponse.json({ error: error.message || 'Error interno' }, { status: 500 });
  }
}
