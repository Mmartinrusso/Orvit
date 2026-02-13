const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const readline = require('readline');

const prisma = new PrismaClient();

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(prompt) {
  return new Promise((resolve) => {
    rl.question(prompt, resolve);
  });
}

async function createSuperAdmin() {
  try {
    console.log('🚀 Creando SUPERADMIN del sistema\n');

    // Verificar si ya existe un superadmin
    const existingSuperAdmin = await prisma.user.findFirst({
      where: { role: 'SUPERADMIN' }
    });

    if (existingSuperAdmin) {
      console.log('⚠️  Ya existe un SUPERADMIN en el sistema:');
      console.log(`   Nombre: ${existingSuperAdmin.name}`);
      console.log(`   Email: ${existingSuperAdmin.email}`);
      console.log(`   ID: ${existingSuperAdmin.id}\n`);
      
      const overwrite = await question('¿Quieres crear otro SUPERADMIN? (y/N): ');
      if (overwrite.toLowerCase() !== 'y' && overwrite.toLowerCase() !== 'yes') {
        console.log('❌ Operación cancelada');
        return;
      }
    }

    // Solicitar datos del superadmin
    console.log('📝 Ingresa los datos del SUPERADMIN:\n');
    
    const name = await question('Nombre completo: ');
    if (!name.trim()) {
      throw new Error('El nombre es requerido');
    }

    const email = await question('Email: ');
    if (!email.trim() || !email.includes('@')) {
      throw new Error('Email válido es requerido');
    }

    // Verificar que el email no exista
    const existingUser = await prisma.user.findUnique({
      where: { email: email.trim().toLowerCase() }
    });

    if (existingUser) {
      throw new Error(`Ya existe un usuario con el email: ${email}`);
    }

    const password = await question('Contraseña (mínimo 6 caracteres): ');
    if (!password || password.length < 6) {
      throw new Error('La contraseña debe tener al menos 6 caracteres');
    }

    const confirmPassword = await question('Confirmar contraseña: ');
    if (password !== confirmPassword) {
      throw new Error('Las contraseñas no coinciden');
    }

    console.log('\n🔒 Encriptando contraseña...');
    const hashedPassword = await bcrypt.hash(password, 10);

    console.log('💾 Creando SUPERADMIN en la base de datos...');
    const superAdmin = await prisma.user.create({
      data: {
        name: name.trim(),
        email: email.trim().toLowerCase(),
        password: hashedPassword,
        role: 'SUPERADMIN',
        isActive: true
      }
    });

    console.log('\n✅ SUPERADMIN creado exitosamente!');
    // console.log('📋 Detalles:') // Log reducido;
    console.log(`   ID: ${superAdmin.id}`);
    console.log(`   Nombre: ${superAdmin.name}`);
    console.log(`   Email: ${superAdmin.email}`);
    console.log(`   Rol: ${superAdmin.role}`);
    console.log(`   Creado: ${superAdmin.createdAt.toLocaleString()}`);
    
    console.log('\n🎉 Ahora puedes iniciar sesión en el sistema con estas credenciales.');
    console.log('🔐 Como SUPERADMIN puedes crear otros administradores desde la interfaz web.');

  } catch (error) {
    console.error('\n❌ Error creando SUPERADMIN:', error instanceof Error ? error.message : error);
    process.exit(1);
  } finally {
    rl.close();
    await prisma.$disconnect();
  }
}

// Ejecutar el script
createSuperAdmin().catch((error) => {
  console.error('❌ Error fatal:', error);
  process.exit(1);
}); 