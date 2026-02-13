/**
 * User Factory
 *
 * Creates test users with different roles, permissions, and company associations.
 */
import { getTestPrisma } from '../setup/db-setup';
import * as bcrypt from 'bcryptjs';

const prisma = getTestPrisma();

// ============================================================================
// Types
// ============================================================================

interface CreateUserOptions {
  name?: string;
  email?: string;
  password?: string;
  role?: 'USER' | 'ADMIN' | 'SUPERADMIN' | 'ADMIN_ENTERPRISE' | 'SUPERVISOR';
  isActive?: boolean;
  companyId?: number;
  roleId?: number;
}

interface UserWithPassword {
  user: Awaited<ReturnType<typeof prisma.user.create>>;
  plainPassword: string;
}

// ============================================================================
// Counters for unique data
// ============================================================================

let userCounter = 0;

function nextUserCounter(): number {
  return ++userCounter;
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create a basic user with hashed password
 */
export async function createUser(options: CreateUserOptions = {}): Promise<UserWithPassword> {
  const n = nextUserCounter();
  const plainPassword = options.password || `TestPass${n}!`;
  const hashedPassword = await bcrypt.hash(plainPassword, 10);

  const user = await prisma.user.create({
    data: {
      name: options.name || `Test User ${n}`,
      email: options.email || `testuser${n}@test.com`,
      password: hashedPassword,
      role: options.role || 'USER',
      isActive: options.isActive ?? true,
    },
  });

  // If companyId provided, create UserOnCompany association
  if (options.companyId) {
    await prisma.userOnCompany.create({
      data: {
        userId: user.id,
        companyId: options.companyId,
        roleId: options.roleId || undefined,
      },
    });
  }

  return { user, plainPassword };
}

/**
 * Create a superadmin user
 */
export async function createSuperAdmin(
  options: Omit<CreateUserOptions, 'role'> = {}
): Promise<UserWithPassword> {
  return createUser({ ...options, role: 'SUPERADMIN' });
}

/**
 * Create an admin user associated to a company
 */
export async function createAdmin(
  companyId: number,
  options: Omit<CreateUserOptions, 'role' | 'companyId'> = {}
): Promise<UserWithPassword> {
  return createUser({ ...options, role: 'ADMIN', companyId });
}

/**
 * Create a supervisor user associated to a company
 */
export async function createSupervisor(
  companyId: number,
  options: Omit<CreateUserOptions, 'role' | 'companyId'> = {}
): Promise<UserWithPassword> {
  return createUser({ ...options, role: 'SUPERVISOR', companyId });
}

/**
 * Create a regular user associated to a company with a role
 */
export async function createRegularUser(
  companyId: number,
  roleId?: number,
  options: Omit<CreateUserOptions, 'role' | 'companyId' | 'roleId'> = {}
): Promise<UserWithPassword> {
  return createUser({ ...options, role: 'USER', companyId, roleId });
}

/**
 * Create an inactive user
 */
export async function createInactiveUser(
  options: Omit<CreateUserOptions, 'isActive'> = {}
): Promise<UserWithPassword> {
  return createUser({ ...options, isActive: false });
}

/**
 * Create a user without a password (e.g., SSO user)
 */
export async function createUserWithoutPassword(
  options: Omit<CreateUserOptions, 'password'> = {}
): Promise<{ user: Awaited<ReturnType<typeof prisma.user.create>> }> {
  const n = nextUserCounter();

  const user = await prisma.user.create({
    data: {
      name: options.name || `NoPass User ${n}`,
      email: options.email || `nopass${n}@test.com`,
      password: null,
      role: options.role || 'USER',
      isActive: options.isActive ?? true,
    },
  });

  return { user };
}

/**
 * Reset user counter (call in beforeEach if needed)
 */
export function resetUserCounter(): void {
  userCounter = 0;
}
