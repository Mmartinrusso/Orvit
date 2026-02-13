import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';
import { JWT_SECRET } from '@/lib/auth'; // ✅ Importar el mismo secret

export const dynamic = 'force-dynamic';


const JWT_SECRET_KEY = new TextEncoder().encode(JWT_SECRET);

// Helper para obtener usuario desde JWT
async function getUserFromToken(request: NextRequest) {
  try {
    const token = cookies().get('token')?.value;
    
    // console.log('🔍 Token encontrado en cookies:', token ? 'Sí' : 'No') // Log reducido;
    
    if (!token) {
      return null;
    }

    const { payload } = await jwtVerify(token, JWT_SECRET_KEY);

    const user = await prisma.user.findUnique({
      where: { id: payload.userId as number },
      include: {
        companies: {
          include: {
            company: true
          }
        },
        ownedCompanies: true
      }
    });

    // console.log('👤 Usuario encontrado:', user ? `${user.name} (${user.role})` : 'No encontrado') // Log reducido;
    return user;
  } catch (error) {
    console.error('❌ Error obteniendo usuario desde JWT:', error);
    return null;
  }
}

// POST /api/admin/user-permissions - Obtener permisos combinados de un usuario (rol + específicos)
export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromToken(request);
    if (!user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    // SUPERADMIN y ADMIN pueden consultar permisos
    if (user.role !== 'SUPERADMIN' && user.role !== 'ADMIN' && user.role !== 'ADMIN_ENTERPRISE') {
      return NextResponse.json({ error: 'Sin permisos para consultar permisos de usuarios' }, { status: 403 });
    }

    const body = await request.json();
    const { userId } = body;

    if (!userId) {
      return NextResponse.json({ error: 'userId es requerido' }, { status: 400 });
    }

    // // // console.log(`🔍 Obteniendo permisos combinados para usuario ${userId}...`) // Log reducido // Log reducido; // Log reducido

    // Obtener información del usuario primero (necesario para el rol)
    const targetUserResult = await prisma.$queryRaw`
      SELECT id, name, email, role FROM "User" WHERE id = ${parseInt(userId)}
    `;

    if (!Array.isArray(targetUserResult) || targetUserResult.length === 0) {
      return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 });
    }

    const targetUser = targetUserResult[0] as any;

    // ✅ OPTIMIZADO: Ejecutar las 3 queries restantes en paralelo
    const [rolePermissionsResult, specificPermissionsResult, allPermissionsResult] = await Promise.all([
      // Permisos del rol
      prisma.$queryRaw`
        SELECT p.id, p.name, p.description, p.category, rp."isGranted", 'role' as source
        FROM "RolePermission" rp
        INNER JOIN "Permission" p ON rp."permissionId" = p.id
        INNER JOIN "Role" r ON rp."roleId" = r.id
        WHERE r.name::text = ${targetUser.role} AND p."isActive" = true AND rp."isGranted" = true
        ORDER BY p.category ASC, p.name ASC
      `,
      // Permisos específicos del usuario (overrides)
      prisma.$queryRaw`
        SELECT up.id as user_permission_id, p.id, p.name, p.description, p.category,
               up."isGranted", up.reason, up."expiresAt", up."createdAt" as granted_at,
               granter.name as granted_by_name, 'specific' as source
        FROM "UserPermission" up
        INNER JOIN "Permission" p ON up."permissionId" = p.id
        LEFT JOIN "User" granter ON up."grantedById" = granter.id
        WHERE up."userId" = ${parseInt(userId)} AND p."isActive" = true
          AND (up."expiresAt" IS NULL OR up."expiresAt" > NOW())
        ORDER BY p.category ASC, p.name ASC
      `,
      // Todos los permisos disponibles
      prisma.$queryRaw`
        SELECT id, name, description, category FROM "Permission"
        WHERE "isActive" = true ORDER BY category ASC, name ASC
      `
    ]);

    const rolePermissions = Array.isArray(rolePermissionsResult) ? rolePermissionsResult : [];
    const specificPermissions = Array.isArray(specificPermissionsResult) ? specificPermissionsResult : [];
    const allPermissions = Array.isArray(allPermissionsResult) ? allPermissionsResult : [];

    // Crear mapa de permisos finales
    const permissionMap = new Map();

    // Primero agregar permisos del rol
    rolePermissions.forEach((perm: any) => {
      permissionMap.set(perm.id, {
        ...perm,
        source: 'role',
        finalGranted: perm.isGranted
      });
    });

    // Luego sobrescribir con permisos específicos
    specificPermissions.forEach((perm: any) => {
      permissionMap.set(perm.id, {
        ...perm,
        source: 'specific',
        finalGranted: perm.isGranted,
        reason: perm.reason,
        expiresAt: perm.expiresAt,
        grantedAt: perm.granted_at,
        grantedByName: perm.granted_by_name
      });
    });

    // Crear lista final con todos los permisos (marcando cuáles están otorgados)
    const finalPermissions = allPermissions.map((perm: any) => {
      const userPerm = permissionMap.get(perm.id);
      return {
        ...perm,
        isGranted: userPerm ? userPerm.finalGranted : false,
        source: userPerm ? userPerm.source : 'none',
        reason: userPerm?.reason || null,
        expiresAt: userPerm?.expiresAt || null,
        grantedAt: userPerm?.grantedAt || null,
        grantedByName: userPerm?.grantedByName || null
      };
    });

    // Estadísticas
    const stats = {
      totalPermissions: allPermissions.length,
      grantedPermissions: finalPermissions.filter((p: any) => p.isGranted).length,
      rolePermissions: rolePermissions.length,
      specificPermissions: specificPermissions.length,
      specificOverrides: specificPermissions.filter((p: any) => {
        const rolePerm = rolePermissions.find((rp: any) => rp.id === p.id);
        return !rolePerm || rolePerm.isGranted !== p.isGranted;
      }).length
    };

    // // // console.log(`✅ Permisos combinados obtenidos: ${stats.grantedPermissions}/${stats.totalPermissions} otorgados`) // Log reducido // Log reducido; // Log reducido

    return NextResponse.json({
      success: true,
      user: {
        id: targetUser.id,
        name: targetUser.name,
        email: targetUser.email,
        role: targetUser.role
      },
      permissions: finalPermissions,
      stats,
      rolePermissions,
      specificPermissions
    });

  } catch (error) {
    console.error('❌ Error obteniendo permisos combinados:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
} 