const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function listAllPermissions() {
  try {
    const permissions = await prisma.permission.findMany({
      orderBy: [
        { category: 'asc' },
        { name: 'asc' }
      ],
      include: {
        rolePermissions: true
      }
    });

    console.log(`📋 Total de permisos: ${permissions.length}\n`);

    // Agrupar por categoría
    const byCategory = {};
    permissions.forEach(p => {
      const category = p.category || 'Sin categoría';
      if (!byCategory[category]) {
        byCategory[category] = [];
      }
      byCategory[category].push(p);
    });

    // Mostrar por categoría
    Object.keys(byCategory).sort().forEach(category => {
      console.log(`\n📂 ${category} (${byCategory[category].length} permisos):`);
      byCategory[category].forEach(p => {
        const hasDot = p.name.includes('.') ? '❌ (tiene punto)' : '✅';
        console.log(`  ${hasDot} ${p.name} - ${p.description || 'Sin descripción'}`);
      });
    });

    // Mostrar permisos con punto que deberían eliminarse
    const withDot = permissions.filter(p => p.name.includes('.'));
    console.log(`\n\n❌ Permisos con punto (formato antiguo) que deberían eliminarse: ${withDot.length}`);
    withDot.forEach(p => {
      console.log(`  - ${p.name} (ID: ${p.id}, Roles: ${p.rolePermissions.length})`);
    });

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

listAllPermissions();

