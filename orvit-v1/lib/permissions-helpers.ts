// Helper functions for permissions management
import { prisma } from './prisma';
import { ROLE_PERMISSIONS, Permission, UserRole } from './permissions';
import { loggers } from './logger';
import { cached, invalidateCache } from '@/lib/cache/cache-manager';
import { permissionKeys, TTL } from '@/lib/cache/cache-keys';

/**
 * Get all permissions for a user
 * This consolidates role permissions and specific user permissions
 * Used by /api/auth/me to send all permissions in one response
 *
 * Cached in Redis with 15min TTL. Eliminates N+1 queries in hasPermission.
 */
export async function getUserPermissions(
  userId: number,
  userRole: string,
  companyId: number
): Promise<string[]> {
  const cacheKey = permissionKeys.userPermissions(userId, companyId);

  return cached(cacheKey, async () => {
    try {
      const permissionsSet = new Set<string>();

      const normalizedRole = userRole?.trim().toUpperCase() || 'USER';

      const isAdminRole = normalizedRole === 'SUPERADMIN' ||
                          normalizedRole === 'ADMIN' ||
                          normalizedRole === 'ADMIN_ENTERPRISE' ||
                          normalizedRole === 'ADMINISTRADOR';

      if (isAdminRole) {
        // Cache admin permissions list in Redis separately
        const allPermissions = await cached(
          permissionKeys.adminPermissions(),
          () => prisma.permission.findMany({
            where: { isActive: true },
            select: { name: true },
            take: 1000
          }),
          TTL.LONG
        );

        const userPermissions = await prisma.userPermission.findMany({
          where: {
            userId: userId,
            permission: { isActive: true },
            OR: [
              { expiresAt: null },
              { expiresAt: { gt: new Date() } }
            ],
            isGranted: false
          },
          select: {
            permission: { select: { name: true } }
          },
          take: 100
        });

        // Add static role permissions first
        const staticRolePerms = ROLE_PERMISSIONS[normalizedRole as UserRole] ||
                                ROLE_PERMISSIONS['ADMIN'] ||
                                [];
        for (const perm of staticRolePerms) {
          permissionsSet.add(perm);
        }

        for (const perm of allPermissions) {
          permissionsSet.add(perm.name);
        }

        // Remove denied permissions
        for (const userPerm of userPermissions) {
          permissionsSet.delete(userPerm.permission.name);
        }
      } else {
        // For SUPERVISOR and USER, run queries in parallel
        const normalizedRoleKey = normalizedRole as UserRole;
        const rolePermissions = ROLE_PERMISSIONS[normalizedRoleKey] ||
                                ROLE_PERMISSIONS[userRole as UserRole] ||
                                [];
        for (const perm of rolePermissions) {
          permissionsSet.add(perm);
        }

        const [rolePermissionsFromDb, userPermissions] = await Promise.all([
          prisma.rolePermission.findMany({
            where: {
              role: { name: userRole, companyId: companyId },
              permission: { isActive: true },
              isGranted: true
            },
            select: {
              permission: { select: { name: true } }
            },
            take: 500
          }),
          prisma.userPermission.findMany({
            where: {
              userId: userId,
              permission: { isActive: true },
              OR: [
                { expiresAt: null },
                { expiresAt: { gt: new Date() } }
              ]
            },
            select: {
              isGranted: true,
              permission: { select: { name: true } }
            },
            take: 500
          })
        ]);

        for (const rolePerm of rolePermissionsFromDb) {
          permissionsSet.add(rolePerm.permission.name);
        }

        for (const userPerm of userPermissions) {
          if (userPerm.isGranted) {
            permissionsSet.add(userPerm.permission.name);
          } else {
            permissionsSet.delete(userPerm.permission.name);
          }
        }
      }

      return Array.from(permissionsSet);
    } catch (error) {
      loggers.permissions.error({ err: error }, 'Error getting user permissions');
      return ROLE_PERMISSIONS[userRole as UserRole] || [];
    }
  }, TTL.LONG);
}

/**
 * Get permissions for multiple users at once
 * Useful for bulk operations
 */
export async function getUserPermissionsBulk(
  userIds: number[],
  companyId: number
): Promise<Map<number, string[]>> {
  const result = new Map<number, string[]>();

  try {
    const users = await prisma.user.findMany({
      where: {
        id: { in: userIds }
      },
      include: {
        companies: {
          where: {
            companyId: companyId
          },
          include: {
            role: true
          }
        }
      }
    });

    for (const user of users) {
      const userRole = user.role || 'USER';
      const permissions = await getUserPermissions(user.id, userRole, companyId);
      result.set(user.id, permissions);
    }

    return result;
  } catch (error) {
    loggers.permissions.error({ err: error }, 'Error getting bulk user permissions');
    return result;
  }
}

/**
 * Check if a user has a specific permission
 * Uses cached permissions to avoid N+1 queries
 */
export async function hasUserPermission(
  userId: number,
  companyId: number,
  permission: string
): Promise<boolean> {
  try {
    // Get user role (needed for getUserPermissions)
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true }
    });

    if (!user) return false;

    const userRole = user.role || 'USER';
    // getUserPermissions is already cached in Redis (15min TTL),
    // so repeated calls within the same request are essentially free
    const permissions = await getUserPermissions(userId, userRole, companyId);

    return permissions.includes(permission);
  } catch (error) {
    loggers.permissions.error({ err: error }, 'Error checking user permission');
    return false;
  }
}

/**
 * Invalidate cached permissions for a user
 * Call this when user permissions or roles change
 */
export async function invalidateUserPermissions(userId: number, companyId: number): Promise<void> {
  await invalidateCache([permissionKeys.userPermissions(userId, companyId)]);
}

