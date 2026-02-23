const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function listAllPermissionsSpanish() {
  try {
    console.log('🔍 Listando todos los permisos en español...\n');

    const permissions = await prisma.permission.findMany({
      orderBy: [
        { category: 'asc' },
        { name: 'asc' }
      ]
    });

    console.log('📋 Total de permisos: ' + permissions.length + '\n');

    // Agrupar por categoría
    const byCategory = {};
    permissions.forEach(perm => {
      if (!byCategory[perm.category]) {
        byCategory[perm.category] = [];
      }
      byCategory[perm.category].push(perm);
    });

    Object.keys(byCategory).sort().forEach(category => {
      console.log('📁 ' + category + ' (' + byCategory[category].length + ' permisos):');
      byCategory[category].forEach(perm => {
        console.log('   - ' + perm.name + ' (ID: ' + perm.id + ')');
        if (perm.description) {
          console.log('     ' + perm.description);
        }
      });
      console.log('');
    });

    // Buscar permisos en inglés que necesitan cambiar
    console.log('🔍 Permisos en inglés que necesitan cambiar a español:');
    const englishPermissions = permissions.filter(p => 
      p.name.includes('.') || 
      p.name.includes('_') && !p.name.startsWith('ingresar_') && !p.name.startsWith('ver_') && !p.name.startsWith('crear_') && !p.name.startsWith('editar_') && !p.name.startsWith('eliminar_')
    );
    
    englishPermissions.forEach(perm => {
      console.log('   - ' + perm.name + ' (ID: ' + perm.id + ') - ' + perm.description);
    });

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

listAllPermissionsSpanish();

