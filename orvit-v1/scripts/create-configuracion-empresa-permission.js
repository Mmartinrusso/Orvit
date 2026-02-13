const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

// Permiso para configuración de empresa
const PERMISSION = {
  name: 'configuracion_empresa',
  description: 'Permite acceder a la configuración de empresa',
  category: 'Administración'
};

async function createConfiguracionEmpresaPermission() {
  try {
    console.log('🚀 Creando permiso de configuración de empresa...\n');

    // Verificar si el permiso ya existe
    const existing = await prisma.permission.findUnique({
      where: { name: PERMISSION.name }
    });

    if (existing) {
      console.log(`⏭️  Permiso ya existe: ${PERMISSION.name} (ID: ${existing.id})`);
      return;
    }

    // Crear el permiso
    const permission = await prisma.permission.create({
      data: {
        name: PERMISSION.name,
        description: PERMISSION.description,
        category: PERMISSION.category,
        isActive: true
      }
    });

    console.log(`✅ Permiso creado: ${permission.name} (ID: ${permission.id})`);
    console.log('\n🎉 ¡Permiso creado exitosamente!');

  } catch (error) {
    console.error('❌ Error general:', error);
  } finally {
    await prisma.$disconnect();
  }
}

createConfiguracionEmpresaPermission();

