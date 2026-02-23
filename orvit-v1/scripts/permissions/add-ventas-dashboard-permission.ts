import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

async function main() {
  console.log('🚀 Adding ventas.dashboard.view permission...\n');

  try {
    const sqlPath = path.join(__dirname, '../prisma/migrations/add_ventas_dashboard_permission.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');

    // Execute the migration
    await prisma.$executeRawUnsafe(sql);

    console.log('✅ Migration executed successfully!\n');

    // Verify the permission was created
    const permission = await prisma.permission.findUnique({
      where: { name: 'ventas.dashboard.view' }
    });

    if (permission) {
      console.log(`✅ Permission found: ${permission.name}`);
      console.log(`   Description: ${permission.description}`);

      // Count how many roles have this permission
      const rolePermissions = await prisma.rolePermission.count({
        where: { permissionId: permission.id }
      });

      console.log(`   Assigned to ${rolePermissions} role(s)\n`);
    } else {
      console.error('❌ Permission not found after migration');
    }

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
