const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

// Lista de todos los permisos que creamos nosotros (nombres en español)
const OUR_PERMISSIONS = [
  // Iniciales
  'ingreso_mantenimiento',
  'ingreso_administracion',
  'ingreso_produccion',
  
  // Sidebar
  'ordenes_de_trabajo',
  'mantenimientos',
  'maquinas_mantenimiento',
  'unidades_moviles',
  'puestos_trabajo',
  'panol',
  'historial_mantenimiento',
  'reportes_mantenimiento',
  'ventas',
  'ventas_dashboard',
  'clientes',
  'productos',
  'cotizaciones',
  'ventas_modulo',
  'costos',
  'controles',
  'maquinas_produccion',
  'vehiculos_produccion',
  
  // Mantenimientos
  'crear_mantenimiento',
  'crear_checklist',
  'ejecucion_mantenimiento',
  'editar_mantenimiento',
  'eliminar_mantenimiento',
  'duplicar_mantenimiento',
  'editar_checklist',
  'eliminar_checklist',
  
  // Máquinas
  'crear_maquina',
  'ver_historial_maquina',
  'eliminar_maquina',
  'editar_maquina',
  'registrar_falla',
  
  // Unidades móviles
  'crear_unidad_movil',
  'editar_unidad_movil',
  'eliminar_unidad_movil',
  
  // Puestos de trabajo
  'crear_puesto_trabajo',
  'editar_puesto_trabajo',
  'eliminar_puesto_trabajo',
  
  // Configuración
  'configuracion_empresa',
  
  // Admin grupos
  'ingresar_personal',
  'ingresar_permisos_roles',
  'ingresar_ventas',
  'ingresar_costos',
  'ingresar_controles',
  
  // Admin subsecciones
  'ingresar_dashboard_ventas',
  'ingresar_clientes',
  'ingresar_productos',
  'ingresar_cotizaciones',
  'ingresar_ventas_modulo',
  
  // Tareas fijas
  'crear_tarea_fija',
  'editar_tarea_fija',
  'eliminar_tarea_fija',
  'ver_historial_tareas',
  
  // Permisos adicionales que necesitamos mantener
  'ingresar_tareas',
  'ingresar_usuarios',
  'ingresar_permisos'
];

async function deleteOldPermissions() {
  try {
    console.log('🚀 Eliminando permisos antiguos...\n');

    // Obtener todos los permisos
    const allPermissions = await prisma.permission.findMany({
      include: {
        rolePermissions: true,
        userPermissions: true
      }
    });

    console.log(`📋 Total de permisos encontrados: ${allPermissions.length}\n`);

    const permissionsToDelete = [];
    const permissionsToKeep = [];

    // Identificar permisos a eliminar (los que NO están en nuestra lista)
    for (const permission of allPermissions) {
      // Si el permiso está en nuestra lista, lo mantenemos
      if (OUR_PERMISSIONS.includes(permission.name)) {
        permissionsToKeep.push(permission);
        continue;
      }

      // Si el permiso tiene un punto en el nombre, es un permiso antiguo (formato inglés)
      if (permission.name.includes('.')) {
        permissionsToDelete.push(permission);
        continue;
      }

      // Si no tiene punto pero tampoco está en nuestra lista, lo mantenemos por seguridad
      // (puede ser un permiso personalizado que se creó manualmente)
      permissionsToKeep.push(permission);
    }

    console.log(`✅ Permisos a mantener: ${permissionsToKeep.length}`);
    console.log(`❌ Permisos a eliminar: ${permissionsToDelete.length}\n`);

    if (permissionsToDelete.length === 0) {
      console.log('ℹ️  No hay permisos antiguos para eliminar.');
      return;
    }

    console.log('📋 Lista de permisos a eliminar:');
    permissionsToDelete.forEach(p => {
      console.log(`  - ${p.name} (ID: ${p.id}) - Roles: ${p.rolePermissions.length}, Usuarios: ${p.userPermissions.length}`);
    });
    console.log('');

    // Confirmar antes de eliminar
    let deletedCount = 0;
    let errorCount = 0;

    for (const permission of permissionsToDelete) {
      try {
        // Primero eliminar las asignaciones de roles
        if (permission.rolePermissions.length > 0) {
          await prisma.rolePermission.deleteMany({
            where: { permissionId: permission.id }
          });
          console.log(`  ✅ Eliminadas ${permission.rolePermissions.length} asignaciones de roles para ${permission.name}`);
        }

        // Luego eliminar las asignaciones de usuarios
        if (permission.userPermissions.length > 0) {
          await prisma.userPermission.deleteMany({
            where: { permissionId: permission.id }
          });
          console.log(`  ✅ Eliminadas ${permission.userPermissions.length} asignaciones de usuarios para ${permission.name}`);
        }

        // Finalmente eliminar el permiso
        await prisma.permission.delete({
          where: { id: permission.id }
        });

        console.log(`  ✅ Permiso eliminado: ${permission.name} (ID: ${permission.id})`);
        deletedCount++;
      } catch (error) {
        console.error(`  ❌ Error eliminando permiso ${permission.name}:`, error.message);
        errorCount++;
      }
    }

    console.log('\n' + '='.repeat(50));
    console.log('📊 RESUMEN:');
    console.log('='.repeat(50));
    console.log(`✅ Permisos eliminados: ${deletedCount}`);
    console.log(`❌ Errores: ${errorCount}`);
    console.log(`📋 Permisos mantenidos: ${permissionsToKeep.length}`);
    console.log(`📋 Total de permisos ahora: ${permissionsToKeep.length}`);

    if (deletedCount > 0) {
      console.log('\n🎉 ¡Permisos antiguos eliminados exitosamente!');
    }

  } catch (error) {
    console.error('❌ Error general:', error);
  } finally {
    await prisma.$disconnect();
  }
}

deleteOldPermissions();

