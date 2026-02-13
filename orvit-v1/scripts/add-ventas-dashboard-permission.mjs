import { PrismaClient } from '@prisma/client';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const prisma = new PrismaClient();

async function main() {
  console.log('🚀 Adding ventas.dashboard.view permission...\n');

  try {
    // Step 1: Create the permission
    console.log('Step 1: Creating permission...');
    await prisma.$executeRaw`
      INSERT INTO "Permission" (name, description, category, "isActive", "createdAt", "updatedAt")
      VALUES (
        'ventas.dashboard.view',
        'Ver dashboard de ventas con KPIs y estadísticas',
        'ventas',
        true,
        NOW(),
        NOW()
      )
      ON CONFLICT (name) DO NOTHING
    `;

    // Step 2: Get the permission
    const permission = await prisma.permission.findUnique({
      where: { name: 'ventas.dashboard.view' }
    });

    if (!permission) {
      console.error('❌ Permission not created');
      return;
    }

    console.log(`✅ Permission created: ${permission.name}\n`);

    // Step 3: Assign to all roles
    console.log('Step 2: Assigning permission to all roles...');
    const result = await prisma.$executeRaw`
      INSERT INTO "RolePermission" ("roleId", "permissionId", "isGranted", "createdAt", "updatedAt")
      SELECT
        r.id as "roleId",
        ${permission.id} as "permissionId",
        true as "isGranted",
        NOW() as "createdAt",
        NOW() as "updatedAt"
      FROM "Role" r
      WHERE NOT EXISTS (
        SELECT 1 FROM "RolePermission" rp
        WHERE rp."roleId" = r.id AND rp."permissionId" = ${permission.id}
      )
    `;

    console.log(`✅ Assigned to roles (${result} assignments created)\n`);

    // Verify final state
    const rolePermissions = await prisma.rolePermission.count({
      where: { permissionId: permission.id }
    });

    console.log('📊 Final state:');
    console.log(`   Permission: ${permission.name}`);
    console.log(`   Description: ${permission.description}`);
    console.log(`   Assigned to ${rolePermissions} role(s)\n`);

    console.log('✅ Migration completed successfully!\n');

  } catch (error) {
    console.error('❌ Error executing migration:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
