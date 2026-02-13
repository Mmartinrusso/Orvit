/**
 * Test Database Lifecycle Management
 *
 * Manages PostgreSQL test database:
 * - Syncs schema with `prisma db push`
 * - Provides cleanup between test suites (TRUNCATE CASCADE)
 * - Provides cleanup between individual tests (delete by company)
 */
import { PrismaClient } from '@prisma/client';
import { execSync } from 'child_process';
import path from 'path';

let testPrisma: PrismaClient | null = null;

/**
 * Get the test Prisma client (singleton)
 */
export function getTestPrisma(): PrismaClient {
  if (!testPrisma) {
    testPrisma = new PrismaClient({
      datasources: {
        db: {
          url: process.env.DATABASE_URL,
        },
      },
      log: process.env.DEBUG_PRISMA === 'true' ? ['query', 'error'] : ['error'],
    });
  }
  return testPrisma;
}

/**
 * Initialize test database: sync schema using db push
 */
export async function initTestDatabase(): Promise<void> {
  const schemaPath = path.resolve(__dirname, '../../prisma/schema.prisma');

  try {
    execSync(
      `npx prisma db push --force-reset --schema="${schemaPath}" --skip-generate`,
      {
        env: { ...process.env },
        stdio: process.env.DEBUG_PRISMA === 'true' ? 'inherit' : 'pipe',
        timeout: 60_000,
      }
    );
  } catch (error) {
    console.error('Failed to initialize test database. Is PostgreSQL running?');
    console.error('Run: docker compose -f docker-compose.test.yml up -d');
    throw error;
  }

  // Connect prisma client
  const prisma = getTestPrisma();
  await prisma.$connect();
}

/**
 * Clean all data from all tables (preserving schema).
 * Uses TRUNCATE CASCADE for speed.
 */
export async function cleanDatabase(): Promise<void> {
  const prisma = getTestPrisma();

  // Get all table names from the public schema
  const tables = await prisma.$queryRaw<Array<{ tablename: string }>>`
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public'
    AND tablename NOT LIKE '_prisma%'
  `;

  if (tables.length === 0) return;

  const tableNames = tables.map((t) => `"${t.tablename}"`).join(', ');

  await prisma.$executeRawUnsafe(
    `TRUNCATE TABLE ${tableNames} CASCADE`
  );

  // Clear admin permissions cache
  (global as any).__adminPermissionsCache = undefined;
}

/**
 * Clean data for a specific company (useful between individual tests)
 */
export async function cleanCompanyData(companyId: number): Promise<void> {
  const prisma = getTestPrisma();

  // Delete in order to respect FK constraints
  await prisma.$transaction([
    prisma.loginAttempt.deleteMany({}),
    prisma.tokenBlacklist.deleteMany({}),
    prisma.rateLimitEntry.deleteMany({}),
    prisma.refreshToken.deleteMany({}),
    prisma.session.deleteMany({}),
    prisma.userPermission.deleteMany({}),
    prisma.rolePermission.deleteMany({}),
    prisma.workOrder.deleteMany({ where: { companyId } }),
    prisma.userOnCompany.deleteMany({ where: { companyId } }),
    prisma.role.deleteMany({ where: { companyId } }),
    prisma.permission.deleteMany({}),
    prisma.user.deleteMany({}),
    prisma.company.deleteMany({ where: { id: companyId } }),
  ]);
}

/**
 * Disconnect test database
 */
export async function disconnectTestDatabase(): Promise<void> {
  if (testPrisma) {
    await testPrisma.$disconnect();
    testPrisma = null;
  }
}
