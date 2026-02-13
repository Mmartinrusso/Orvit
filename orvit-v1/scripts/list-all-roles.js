const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function listAllRoles() {
  try {
    console.log('🔍 Listando todos los roles en la base de datos...\n');

    const roles = await prisma.role.findMany({
      include: {
        company: true
      },
      orderBy: [
        { companyId: 'asc' },
        { name: 'asc' }
      ]
    });

    console.log('📋 Total de roles encontrados: ' + roles.length + '\n');

    roles.forEach(role => {
      console.log('   - ' + role.name + ' (ID: ' + role.id + ') - Empresa: ' + role.company.name + ' (ID: ' + role.companyId + ')');
    });

    // Verificar si existe ADMIN_ENTERPRISE
    const adminEnterprise = roles.find(r => r.name === 'ADMIN_ENTERPRISE');
    if (!adminEnterprise) {
      console.log('\n⚠️  El rol ADMIN_ENTERPRISE NO existe en la base de datos');
      console.log('   Este es un rol del sistema que debe ser creado o la lógica debe cambiar');
    } else {
      console.log('\n✅ El rol ADMIN_ENTERPRISE existe en la base de datos');
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

listAllRoles();

