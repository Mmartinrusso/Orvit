import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';
import { JWT_SECRET } from '@/lib/auth';
import { withGuards } from '@/lib/middleware/withGuards';
import { validateRequest } from '@/lib/validations/helpers';
import { CheckPermissionsSchema } from '@/lib/validations/permissions';
import { getUserPermissions } from '@/lib/permissions-helpers';

export const dynamic = 'force-dynamic';


type UserRole = 'SUPERADMIN' | 'ADMIN' | 'ADMIN_ENTERPRISE' | 'SUPERVISOR' | 'USER';

const JWT_SECRET_KEY = new TextEncoder().encode(JWT_SECRET);

// Función para obtener el usuario rico desde el token (con companies y roles)
async function getUserFromToken(request: NextRequest) {
  try {
    const token = cookies().get('token')?.value;

    if (!token) {
      return null;
    }

    const { payload } = await jwtVerify(token, JWT_SECRET_KEY);

    const user = await prisma.user.findUnique({
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

    return user;
  } catch (error) {
    return null;
  }
}

export const POST = withGuards(async (request: NextRequest) => {
  try {
    const user = await getUserFromToken(request);
    if (!user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const body = await request.json();
    const validation = validateRequest(CheckPermissionsSchema, body);
    if (!validation.success) return validation.response;
    const { permissions } = validation.data;

    // Obtener la empresa del usuario
    let companyId: number;
    if (user.ownedCompanies && user.ownedCompanies.length > 0) {
      companyId = user.ownedCompanies[0].id;
    } else if (user.companies && user.companies.length > 0) {
      companyId = user.companies[0].company.id;
    } else {
      // SUPERADMIN sin empresa específica - tiene todos los permisos
      if (user.role === 'SUPERADMIN') {
        const result = permissions.reduce((acc, permission) => {
          acc[permission] = true;
          return acc;
        }, {} as Record<string, boolean>);
        return NextResponse.json({ permissions: result });
      }
      return NextResponse.json({ error: "Usuario sin empresa" }, { status: 403 });
    }

    // Obtener el rol específico del usuario en la empresa
    let userRoleInCompany: string = user.role;
    if (user.companies && user.companies.length > 0) {
      const userCompany = user.companies.find(uc => uc.company.id === companyId);
      if (userCompany && userCompany.role) {
        userRoleInCompany = userCompany.role.name;
      }
    }

    // Obtener todos los permisos del usuario en una sola llamada (cached en Redis, 15min TTL)
    const userPermissions = await getUserPermissions(user.id, userRoleInCompany, companyId);
    const userPermissionsSet = new Set(userPermissions);

    // Verificar cada permiso contra el set cacheado (O(1) por permiso)
    const permissionResults: Record<string, boolean> = {};
    for (const permission of permissions) {
      permissionResults[permission] = userPermissionsSet.has(permission);
    }

    return NextResponse.json({ permissions: permissionResults });

  } catch (error) {
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
});

export const GET = withGuards(async (request: NextRequest) => {
  try {
    const user = await getUserFromToken(request);
    if (!user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const permission = searchParams.get('permission');
    const companyIdParam = searchParams.get('companyId');

    if (!permission) {
      return NextResponse.json({ error: "Permiso requerido" }, { status: 400 });
    }

    // Obtener la empresa del usuario (usar companyId de query si está presente, sino obtenerla del usuario)
    let companyId: number;
    if (companyIdParam) {
      const providedCompanyId = parseInt(companyIdParam);
      const hasAccess = user.ownedCompanies?.some(c => c.id === providedCompanyId) ||
                       user.companies?.some(uc => uc.company.id === providedCompanyId);

      if (!hasAccess && user.role !== 'SUPERADMIN') {
        return NextResponse.json({ error: "No tienes acceso a esta empresa" }, { status: 403 });
      }

      companyId = providedCompanyId;
    } else {
      if (user.ownedCompanies && user.ownedCompanies.length > 0) {
        companyId = user.ownedCompanies[0].id;
      } else if (user.companies && user.companies.length > 0) {
        companyId = user.companies[0].company.id;
      } else {
        if (user.role === 'SUPERADMIN') {
          return NextResponse.json({ hasPermission: true });
        }
        return NextResponse.json({ error: "Usuario sin empresa" }, { status: 403 });
      }
    }

    // Obtener el rol específico del usuario en la empresa
    let userRoleInCompany: string = user.role;
    if (user.companies && user.companies.length > 0) {
      const userCompany = user.companies.find(uc => uc.company.id === companyId);
      if (userCompany && userCompany.role) {
        userRoleInCompany = userCompany.role.name;
      }
    }

    // Usar getUserPermissions (cached en Redis, 15min TTL) en lugar de N+1 queries
    const userPermissions = await getUserPermissions(user.id, userRoleInCompany, companyId);
    const hasPermissionResult = userPermissions.includes(permission);

    return NextResponse.json({ hasPermission: hasPermissionResult });

  } catch (error) {
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
});
