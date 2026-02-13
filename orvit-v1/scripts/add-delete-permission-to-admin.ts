/**
 * Script para agregar el permiso work_orders.delete al rol admin
 *
 * Ejecutar con: npx tsx scripts/add-delete-permission-to-admin.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🔧 Buscando permiso work_orders.delete...');

  // Buscar o crear el permiso
  let permission = await prisma.permission.findUnique({
    where: { name: 'work_orders.delete' }
  });

  if (!permission) {
    console.log('📝 Creando permiso work_orders.delete...');
    permission = await prisma.permission.create({
      data: {
        name: 'work_orders.delete',
        description: 'Eliminar órdenes de trabajo y fallas',
        category: 'work_orders',
        isActive: true
      }
    });
    console.log('✅ Permiso creado:', permission.id);
  } else {
    console.log('✅ Permiso encontrado:', permission.id);
  }

  // Buscar roles admin
  console.log('\n🔍 Buscando roles admin...');
  const adminRoles = await prisma.role.findMany({
    where: {
      OR: [
        { name: { contains: 'admin', mode: 'insensitive' } },
        { name: { contains: 'Admin', mode: 'insensitive' } },
        { name: { equals: 'Administrador' } },
        { name: { equals: 'ADMIN' } },
      ]
    },
    include: {
      company: true,
      permissions: {
        where: { permissionId: permission.id }
      }
    }
  });

  console.log(`📋 Encontrados ${adminRoles.length} roles admin`);

  for (const role of adminRoles) {
    console.log(`\n👤 Rol: "${role.name}" (Empresa: ${role.company?.name || 'N/A'})`);

    // Verificar si ya tiene el permiso
    if (role.permissions.length > 0) {
      console.log('   ⏭️  Ya tiene el permiso work_orders.delete');
      continue;
    }

    // Agregar el permiso
    try {
      await prisma.rolePermission.create({
        data: {
          roleId: role.id,
          permissionId: permission.id,
          isGranted: true
        }
      });
      console.log('   ✅ Permiso agregado correctamente');
    } catch (error: any) {
      if (error.code === 'P2002') {
        console.log('   ⏭️  El permiso ya existe (constraint único)');
      } else {
        console.error('   ❌ Error:', error.message);
      }
    }
  }

  // También agregar a superadmin si existe
  console.log('\n🔍 Buscando roles superadmin...');
  const superadminRoles = await prisma.role.findMany({
    where: {
      OR: [
        { name: { contains: 'superadmin', mode: 'insensitive' } },
        { name: { contains: 'super_admin', mode: 'insensitive' } },
      ]
    },
    include: {
      permissions: {
        where: { permissionId: permission.id }
      }
    }
  });

  for (const role of superadminRoles) {
    console.log(`\n👑 Rol: "${role.name}"`);

    if (role.permissions.length > 0) {
      console.log('   ⏭️  Ya tiene el permiso');
      continue;
    }

    try {
      await prisma.rolePermission.create({
        data: {
          roleId: role.id,
          permissionId: permission.id,
          isGranted: true
        }
      });
      console.log('   ✅ Permiso agregado correctamente');
    } catch (error: any) {
      if (error.code === 'P2002') {
        console.log('   ⏭️  El permiso ya existe');
      } else {
        console.error('   ❌ Error:', error.message);
      }
    }
  }

  console.log('\n🎉 Proceso completado!');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
