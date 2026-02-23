const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

async function restoreDatabase() {
  try {
    console.log('🔄 Iniciando restauración de la base de datos...');
    
    // Leer el archivo de backup
    const backupPath = path.join(__dirname, 'backups', 'permissions-backup-2025-07-30T14-05-26-153Z.json');
    const backupData = JSON.parse(fs.readFileSync(backupPath, 'utf8'));
    
    console.log('📋 Datos del backup cargados:');
    console.log(`- Permisos: ${backupData.permissions.length}`);
    console.log(`- Roles: ${backupData.roles.length}`);
    console.log(`- Permisos por rol: ${backupData.rolePermissions.length}`);
    console.log(`- Usuarios: ${backupData.users.length}`);
    console.log(`- Empresas: ${backupData.companies.length}`);
    console.log(`- Usuarios en empresas: ${backupData.userOnCompany.length}`);
    
    // 1. Limpiar datos existentes (en orden inverso a las dependencias)
    console.log('\n🧹 Limpiando datos existentes...');
    await prisma.userOnCompany.deleteMany();
    await prisma.userPermission.deleteMany();
    await prisma.rolePermission.deleteMany();
    await prisma.role.deleteMany();
    await prisma.permission.deleteMany();
    await prisma.user.deleteMany();
    await prisma.company.deleteMany();
    
    // 2. Restaurar permisos
    console.log('\n🔑 Restaurando permisos...');
    for (const permission of backupData.permissions) {
      await prisma.permission.create({
        data: {
          id: permission.id,
          name: permission.name,
          description: permission.description,
          category: permission.category,
          isActive: permission.isActive,
          createdAt: new Date(permission.createdAt),
          updatedAt: new Date(permission.updatedAt)
        }
      });
    }
    console.log(`✅ ${backupData.permissions.length} permisos restaurados`);
    
    // 3. Restaurar empresas PRIMERO (antes que roles)
    console.log('\n🏢 Restaurando empresas...');
    for (const company of backupData.companies) {
      await prisma.company.create({
        data: {
          id: company.id,
          name: company.name,
          cuit: company.cuit,
          logo: company.logo,
          address: company.address,
          phone: company.phone,
          email: company.email,
          website: company.website,
          createdAt: new Date(company.createdAt),
          updatedAt: new Date(company.updatedAt)
        }
      });
    }
    console.log(`✅ ${backupData.companies.length} empresas restauradas`);
    
    // 4. Restaurar roles (después de empresas)
    console.log('\n👥 Restaurando roles...');
    for (const role of backupData.roles) {
      await prisma.role.create({
        data: {
          id: role.id,
          name: role.name,
          displayName: role.displayName,
          description: role.description,
          isActive: role.isActive,
          companyId: role.companyId,
          createdAt: new Date(role.createdAt),
          updatedAt: new Date(role.updatedAt)
        }
      });
    }
    console.log(`✅ ${backupData.roles.length} roles restaurados`);
    
    // 5. Restaurar permisos por rol
    console.log('\n🔗 Restaurando permisos por rol...');
    for (const rolePermission of backupData.rolePermissions) {
      await prisma.rolePermission.create({
        data: {
          id: rolePermission.id,
          roleId: rolePermission.roleId,
          permissionId: rolePermission.permissionId,
          isGranted: rolePermission.isGranted,
          createdAt: new Date(rolePermission.createdAt),
          updatedAt: new Date(rolePermission.updatedAt)
        }
      });
    }
    console.log(`✅ ${backupData.rolePermissions.length} permisos por rol restaurados`);
    
    // 6. Restaurar usuarios
    console.log('\n👤 Restaurando usuarios...');
    for (const user of backupData.users) {
      await prisma.user.create({
        data: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          isActive: user.isActive,
          createdAt: new Date(user.createdAt),
          updatedAt: new Date(user.updatedAt)
        }
      });
    }
    console.log(`✅ ${backupData.users.length} usuarios restaurados`);
    
    // 7. Restaurar usuarios en empresas
    console.log('\n🔗 Restaurando usuarios en empresas...');
    for (const userOnCompany of backupData.userOnCompany) {
      await prisma.userOnCompany.create({
        data: {
          id: userOnCompany.id,
          userId: userOnCompany.userId,
          companyId: userOnCompany.companyId,
          roleId: userOnCompany.roleId,
          isActive: userOnCompany.isActive,
          joinedAt: new Date(userOnCompany.joinedAt)
        }
      });
    }
    console.log(`✅ ${backupData.userOnCompany.length} usuarios en empresas restaurados`);
    
    // 8. Restaurar permisos de usuario
    console.log('\n🔐 Restaurando permisos de usuario...');
    for (const userPermission of backupData.userPermissions) {
      await prisma.userPermission.create({
        data: {
          id: userPermission.id,
          userId: userPermission.userId,
          permissionId: userPermission.permissionId,
          isGranted: userPermission.isGranted,
          grantedById: userPermission.grantedById,
          reason: userPermission.reason,
          expiresAt: userPermission.expiresAt ? new Date(userPermission.expiresAt) : null,
          createdAt: new Date(userPermission.createdAt),
          updatedAt: new Date(userPermission.updatedAt)
        }
      });
    }
    console.log(`✅ ${backupData.userPermissions.length} permisos de usuario restaurados`);
    
    console.log('\n🎉 ¡Restauración completada exitosamente!');
    console.log('\n📊 Resumen de datos restaurados:');
    console.log(`- Permisos: ${backupData.permissions.length}`);
    console.log(`- Roles: ${backupData.roles.length}`);
    console.log(`- Permisos por rol: ${backupData.rolePermissions.length}`);
    console.log(`- Usuarios: ${backupData.users.length}`);
    console.log(`- Empresas: ${backupData.companies.length}`);
    console.log(`- Usuarios en empresas: ${backupData.userOnCompany.length}`);
    console.log(`- Permisos de usuario: ${backupData.userPermissions.length}`);
    
    // Mostrar información de usuarios para login
    console.log('\n🔑 Información de usuarios para login:');
    backupData.users.forEach(user => {
      console.log(`- ${user.name} (${user.email}) - Rol: ${user.role}`);
    });
    
  } catch (error) {
    console.error('❌ Error durante la restauración:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Ejecutar la restauración
restoreDatabase()
  .then(() => {
    console.log('\n✅ Restauración completada');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Error en la restauración:', error);
    process.exit(1);
  }); 