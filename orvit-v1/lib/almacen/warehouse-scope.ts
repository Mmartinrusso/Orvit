import { prisma } from '@/lib/prisma';

/**
 * Warehouse Scope Service
 *
 * Manages user access to specific warehouses.
 * Users can be restricted to view/operate only certain warehouses.
 */

export interface UserWarehouseAccess {
  warehouseId: number;
  canView: boolean;
  canOperate: boolean;
}

export interface WarehouseScopeResult {
  hasFullAccess: boolean;
  accessibleWarehouses: number[];
  operableWarehouses: number[];
}

/**
 * Get the warehouse scope for a user
 *
 * @param userId - The user ID
 * @param companyId - The company ID
 * @returns The warehouse scope for the user
 */
export async function getUserWarehouseScope(
  userId: number,
  companyId: number
): Promise<WarehouseScopeResult> {
  // Check if user has full warehouse access (admin/superadmin)
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      role: true,
      permissions: {
        where: {
          permission: {
            code: { in: ['almacen.manage_all', 'almacen.manage_warehouses'] },
          },
        },
      },
    },
  });

  // Superadmin or users with manage_all permission have full access
  if (user?.role === 'SUPERADMIN' || (user?.permissions && user.permissions.length > 0)) {
    // Get all warehouses for the company
    const allWarehouses = await prisma.warehouse.findMany({
      where: { companyId, isActive: true },
      select: { id: true },
    });

    return {
      hasFullAccess: true,
      accessibleWarehouses: allWarehouses.map((w) => w.id),
      operableWarehouses: allWarehouses.map((w) => w.id),
    };
  }

  // Check user-specific warehouse scopes
  const scopes = await prisma.userWarehouseScope.findMany({
    where: { userId },
    select: {
      warehouseId: true,
      canView: true,
      canOperate: true,
    },
  });

  if (scopes.length === 0) {
    // No specific scopes defined - check if there's a default behavior
    // By default, if no scopes are defined, allow view access to all warehouses
    const allWarehouses = await prisma.warehouse.findMany({
      where: { companyId, isActive: true },
      select: { id: true },
    });

    return {
      hasFullAccess: false,
      accessibleWarehouses: allWarehouses.map((w) => w.id),
      operableWarehouses: [], // No operate access by default
    };
  }

  return {
    hasFullAccess: false,
    accessibleWarehouses: scopes.filter((s) => s.canView).map((s) => s.warehouseId),
    operableWarehouses: scopes.filter((s) => s.canOperate).map((s) => s.warehouseId),
  };
}

/**
 * Check if a user can view a specific warehouse
 */
export async function canUserViewWarehouse(
  userId: number,
  warehouseId: number,
  companyId: number
): Promise<boolean> {
  const scope = await getUserWarehouseScope(userId, companyId);
  return scope.hasFullAccess || scope.accessibleWarehouses.includes(warehouseId);
}

/**
 * Check if a user can operate (dispatch, receive, etc.) in a specific warehouse
 */
export async function canUserOperateWarehouse(
  userId: number,
  warehouseId: number,
  companyId: number
): Promise<boolean> {
  const scope = await getUserWarehouseScope(userId, companyId);
  return scope.hasFullAccess || scope.operableWarehouses.includes(warehouseId);
}

/**
 * Get filtered warehouse IDs based on user scope
 *
 * @param userId - The user ID
 * @param companyId - The company ID
 * @param requestedWarehouseId - Optional specific warehouse ID requested
 * @returns Array of warehouse IDs the user can access
 */
export async function getAccessibleWarehouseIds(
  userId: number,
  companyId: number,
  requestedWarehouseId?: number
): Promise<number[]> {
  const scope = await getUserWarehouseScope(userId, companyId);

  if (requestedWarehouseId) {
    // If a specific warehouse is requested, check access
    if (scope.hasFullAccess || scope.accessibleWarehouses.includes(requestedWarehouseId)) {
      return [requestedWarehouseId];
    }
    return []; // No access to requested warehouse
  }

  return scope.accessibleWarehouses;
}

/**
 * Build a Prisma where clause for warehouse filtering
 */
export async function buildWarehouseWhereClause(
  userId: number,
  companyId: number,
  requestedWarehouseId?: number
): Promise<{ warehouseId?: number | { in: number[] } } | null> {
  const accessibleIds = await getAccessibleWarehouseIds(userId, companyId, requestedWarehouseId);

  if (accessibleIds.length === 0) {
    return null; // No access - will result in empty results
  }

  if (accessibleIds.length === 1) {
    return { warehouseId: accessibleIds[0] };
  }

  return { warehouseId: { in: accessibleIds } };
}

/**
 * Assign warehouse scope to a user
 */
export async function assignWarehouseScope(
  userId: number,
  warehouseId: number,
  canView: boolean = true,
  canOperate: boolean = false
): Promise<void> {
  await prisma.userWarehouseScope.upsert({
    where: {
      userId_warehouseId: {
        userId,
        warehouseId,
      },
    },
    update: {
      canView,
      canOperate,
    },
    create: {
      userId,
      warehouseId,
      canView,
      canOperate,
    },
  });
}

/**
 * Remove warehouse scope from a user
 */
export async function removeWarehouseScope(
  userId: number,
  warehouseId: number
): Promise<void> {
  await prisma.userWarehouseScope.deleteMany({
    where: {
      userId,
      warehouseId,
    },
  });
}

/**
 * Get all warehouse scopes for a user
 */
export async function getWarehouseScopesForUser(
  userId: number
): Promise<UserWarehouseAccess[]> {
  const scopes = await prisma.userWarehouseScope.findMany({
    where: { userId },
    select: {
      warehouseId: true,
      canView: true,
      canOperate: true,
    },
  });

  return scopes;
}
