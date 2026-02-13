/**
 * Company Factory
 *
 * Creates companies, areas, sectors, roles, and permissions for testing.
 */
import { getTestPrisma } from '../setup/db-setup';

const prisma = getTestPrisma();

// ============================================================================
// Counters
// ============================================================================

let companyCounter = 0;
let sectorCounter = 0;

function nextCompanyCounter(): number {
  return ++companyCounter;
}

function nextSectorCounter(): number {
  return ++sectorCounter;
}

// ============================================================================
// Company
// ============================================================================

interface CreateCompanyOptions {
  name?: string;
  cuit?: string;
}

export async function createCompany(options: CreateCompanyOptions = {}) {
  const n = nextCompanyCounter();
  return prisma.company.create({
    data: {
      name: options.name || `Test Company ${n}`,
      cuit: options.cuit || `20-${30000000 + n}-${n}`,
    },
  });
}

// ============================================================================
// Area & Sector
// ============================================================================

export async function createArea(companyId: number, name?: string) {
  return prisma.area.create({
    data: {
      name: name || `Area ${companyCounter}-${Date.now()}`,
      companyId,
    },
  });
}

export async function createSector(areaId: number, companyId: number, name?: string) {
  const n = nextSectorCounter();
  return prisma.sector.create({
    data: {
      name: name || `Sector ${n}`,
      areaId,
      companyId,
    },
  });
}

// ============================================================================
// Role & Permissions
// ============================================================================

interface CreateRoleOptions {
  name?: string;
  displayName?: string;
  description?: string;
  sectorId?: number;
  permissions?: string[];
}

/**
 * Create a role within a company with optional permissions
 */
export async function createRole(
  companyId: number,
  options: CreateRoleOptions = {}
) {
  const roleName = options.name || `TestRole-${Date.now()}`;

  const role = await prisma.role.create({
    data: {
      name: roleName,
      displayName: options.displayName || roleName,
      description: options.description,
      companyId,
      sectorId: options.sectorId,
    },
  });

  // Create role permissions if provided
  if (options.permissions && options.permissions.length > 0) {
    for (const permName of options.permissions) {
      const perm = await ensurePermission(permName);
      await prisma.rolePermission.create({
        data: {
          roleId: role.id,
          permissionId: perm.id,
          isGranted: true,
        },
      });
    }
  }

  return role;
}

/**
 * Ensure a permission exists in the database, create if not
 */
export async function ensurePermission(name: string, description?: string) {
  return prisma.permission.upsert({
    where: { name },
    update: {},
    create: {
      name,
      description: description || `Permission: ${name}`,
      category: name.split('.')[0],
      isActive: true,
    },
  });
}

/**
 * Create multiple permissions at once
 */
export async function ensurePermissions(names: string[]) {
  const permissions = [];
  for (const name of names) {
    permissions.push(await ensurePermission(name));
  }
  return permissions;
}

/**
 * Grant a specific permission to a user (override)
 */
export async function grantUserPermission(
  userId: number,
  permissionName: string,
  options: { expiresAt?: Date; reason?: string; grantedById?: number } = {}
) {
  const perm = await ensurePermission(permissionName);
  return prisma.userPermission.upsert({
    where: {
      userId_permissionId: {
        userId,
        permissionId: perm.id,
      },
    },
    update: {
      isGranted: true,
      expiresAt: options.expiresAt || null,
      reason: options.reason,
      grantedById: options.grantedById,
    },
    create: {
      userId,
      permissionId: perm.id,
      isGranted: true,
      expiresAt: options.expiresAt || null,
      reason: options.reason,
      grantedById: options.grantedById,
    },
  });
}

/**
 * Deny a specific permission to a user (override)
 */
export async function denyUserPermission(
  userId: number,
  permissionName: string,
  options: { reason?: string; grantedById?: number } = {}
) {
  const perm = await ensurePermission(permissionName);
  return prisma.userPermission.upsert({
    where: {
      userId_permissionId: {
        userId,
        permissionId: perm.id,
      },
    },
    update: {
      isGranted: false,
      reason: options.reason,
      grantedById: options.grantedById,
    },
    create: {
      userId,
      permissionId: perm.id,
      isGranted: false,
      reason: options.reason,
      grantedById: options.grantedById,
    },
  });
}

// ============================================================================
// Full Company Setup
// ============================================================================

interface FullCompanySetup {
  company: Awaited<ReturnType<typeof createCompany>>;
  area: Awaited<ReturnType<typeof createArea>>;
  sector: Awaited<ReturnType<typeof createSector>>;
  adminRole: Awaited<ReturnType<typeof createRole>>;
  userRole: Awaited<ReturnType<typeof createRole>>;
}

/**
 * Create a complete company setup with area, sector, and roles
 */
export async function createFullCompanySetup(
  companyName?: string
): Promise<FullCompanySetup> {
  const company = await createCompany({ name: companyName });
  const area = await createArea(company.id, 'Mantenimiento');
  const sector = await createSector(area.id, company.id, 'Producción');

  const adminRole = await createRole(company.id, {
    name: 'ADMINISTRADOR',
    displayName: 'Administrador',
  });

  const userRole = await createRole(company.id, {
    name: 'OPERARIO',
    displayName: 'Operario',
    permissions: ['machines.view', 'work_orders.view', 'work_orders.create'],
  });

  return { company, area, sector, adminRole, userRole };
}

/**
 * Reset counters (call in beforeEach if needed)
 */
export function resetCompanyCounters(): void {
  companyCounter = 0;
  sectorCounter = 0;
}
