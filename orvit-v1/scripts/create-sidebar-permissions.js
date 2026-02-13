const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

// Permisos del sidebar (todos menos Dashboard y Configuración)
const SIDEBAR_PERMISSIONS = [
  // Mantenimiento
  {
    name: 'ordenes_de_trabajo',
    description: 'Permite acceder a Órdenes de trabajo',
    category: 'Mantenimiento'
  },
  {
    name: 'mantenimientos',
    description: 'Permite acceder a Mantenimientos',
    category: 'Mantenimiento'
  },
  {
    name: 'maquinas_mantenimiento',
    description: 'Permite acceder a Máquinas en Mantenimiento',
    category: 'Mantenimiento'
  },
  {
    name: 'unidades_moviles',
    description: 'Permite acceder a Unidades Móviles',
    category: 'Mantenimiento'
  },
  {
    name: 'puestos_trabajo',
    description: 'Permite acceder a Puestos de trabajo',
    category: 'Mantenimiento'
  },
  {
    name: 'panol',
    description: 'Permite acceder a Pañol',
    category: 'Mantenimiento'
  },
  {
    name: 'historial_mantenimiento',
    description: 'Permite acceder a Historial de Mantenimiento',
    category: 'Mantenimiento'
  },
  {
    name: 'reportes_mantenimiento',
    description: 'Permite acceder a Reportes de Mantenimiento',
    category: 'Mantenimiento'
  },
  
  // Administración
  {
    name: 'ventas',
    description: 'Permite acceder al módulo de Ventas completo',
    category: 'Administración'
  },
  {
    name: 'ventas_dashboard',
    description: 'Permite acceder al Dashboard de Ventas',
    category: 'Administración'
  },
  {
    name: 'clientes',
    description: 'Permite acceder a Clientes',
    category: 'Administración'
  },
  {
    name: 'productos',
    description: 'Permite acceder a Productos',
    category: 'Administración'
  },
  {
    name: 'cotizaciones',
    description: 'Permite acceder a Cotizaciones',
    category: 'Administración'
  },
  {
    name: 'ventas_modulo',
    description: 'Permite acceder a Ventas',
    category: 'Administración'
  },
  {
    name: 'costos',
    description: 'Permite acceder al módulo de Costos',
    category: 'Administración'
  },
  {
    name: 'controles',
    description: 'Permite acceder a Controles',
    category: 'Administración'
  },
  
  // Producción
  {
    name: 'maquinas_produccion',
    description: 'Permite acceder a Máquinas de Producción',
    category: 'Producción'
  },
  {
    name: 'vehiculos_produccion',
    description: 'Permite acceder a Vehículos de Producción',
    category: 'Producción'
  }
];

async function createSidebarPermissions() {
  try {
    console.log('🚀 Creando permisos del sidebar...\n');

    let created = 0;
    let skipped = 0;

    for (const permissionData of SIDEBAR_PERMISSIONS) {
      try {
        // Verificar si el permiso ya existe
        const existing = await prisma.permission.findUnique({
          where: { name: permissionData.name }
        });

        if (existing) {
          console.log(`⏭️  Permiso ya existe: ${permissionData.name}`);
          skipped++;
          continue;
        }

        // Crear el permiso
        const permission = await prisma.permission.create({
          data: {
            name: permissionData.name,
            description: permissionData.description,
            category: permissionData.category,
            isActive: true
          }
        });

        console.log(`✅ Permiso creado: ${permission.name} (ID: ${permission.id})`);
        created++;
      } catch (error) {
        console.error(`❌ Error creando permiso ${permissionData.name}:`, error.message);
      }
    }

    console.log('\n📊 RESUMEN:');
    console.log(`✅ Permisos creados: ${created}`);
    console.log(`⏭️  Permisos ya existían: ${skipped}`);
    console.log(`📋 Total procesados: ${SIDEBAR_PERMISSIONS.length}`);

    if (created > 0) {
      console.log('\n🎉 ¡Permisos del sidebar creados exitosamente!');
    } else {
      console.log('\nℹ️  Todos los permisos ya existían.');
    }

  } catch (error) {
    console.error('❌ Error general:', error);
  } finally {
    await prisma.$disconnect();
  }
}

createSidebarPermissions();

