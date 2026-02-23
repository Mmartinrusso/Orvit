const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

// Permiso para registrar falla
const PERMISSION = {
  name: 'registrar_falla',
  description: 'Permite registrar fallas en máquinas',
  category: 'Mantenimiento'
};

async function createRegistrarFallaPermission() {
  try {
    console.log('🚀 Creando permiso de registrar falla...\n');

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

createRegistrarFallaPermission();

