const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function setupPasswords() {
  try {
    console.log('🔍 Configurando contraseñas para usuarios...');
    
    // Obtener todos los usuarios
    const users = await prisma.user.findMany();
    console.log(`📋 Usuarios encontrados: ${users.length}`);
    
    for (const user of users) {
      console.log(`\n👤 Procesando usuario: ${user.name} (${user.email})`);
      
      // Verificar si ya tiene contraseña
      if (user.password) {
        console.log(`  ✅ Ya tiene contraseña configurada`);
        continue;
      }
      
      // Generar contraseña por defecto basada en el email
      const defaultPassword = '123456'; // Contraseña simple para desarrollo
      const hashedPassword = await bcrypt.hash(defaultPassword, 10);
      
      // Actualizar usuario con contraseña
      await prisma.user.update({
        where: { id: user.id },
        data: { password: hashedPassword }
      });
      
      console.log(`  ✅ Contraseña configurada: ${defaultPassword}`);
      console.log(`  📧 Email: ${user.email}`);
      console.log(`  🔑 Contraseña: ${defaultPassword}`);
    }
    
    console.log('\n🎉 Contraseñas configuradas exitosamente');
    console.log('\n📋 Resumen de usuarios:');
    users.forEach(user => {
      console.log(`- ${user.name} (${user.email}) - Rol: ${user.role}`);
    });
    
    console.log('\n🔑 Información de login:');
    console.log('Puedes iniciar sesión con cualquiera de estos usuarios usando la contraseña: 123456');
    
  } catch (error) {
    console.error('❌ Error configurando contraseñas:', error);
  } finally {
    await prisma.$disconnect();
  }
}

setupPasswords()
  .then(() => {
    console.log('\n✅ Script completado');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Error en el script:', error);
    process.exit(1);
  }); 