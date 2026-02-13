import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const ALMACEN_PERMISSIONS = [
  // Acceso base
  { key: 'ingresar_almacen', name: 'Ingresar a Almacén', description: 'Acceso al módulo de almacén', category: 'almacen' },
  { key: 'almacen.view', name: 'Ver Almacén', description: 'Ver módulo almacén', category: 'almacen' },
  { key: 'almacen.view_dashboard', name: 'Ver Dashboard Almacén', description: 'Ver dashboard de almacén', category: 'almacen' },
  { key: 'almacen.view_inventory', name: 'Ver Inventario', description: 'Ver inventario unificado', category: 'almacen' },
  { key: 'almacen.view_costs', name: 'Ver Costos Almacén', description: 'Ver costos en almacén', category: 'almacen' },
  // Solicitudes
  { key: 'almacen.request.view', name: 'Ver Solicitudes', description: 'Ver solicitudes de material', category: 'almacen' },
  { key: 'almacen.request.view_all', name: 'Ver Todas las Solicitudes', description: 'Ver todas las solicitudes', category: 'almacen' },
  { key: 'almacen.request.create', name: 'Crear Solicitudes', description: 'Crear solicitudes de material', category: 'almacen' },
  { key: 'almacen.request.edit', name: 'Editar Solicitudes', description: 'Editar solicitudes propias', category: 'almacen' },
  { key: 'almacen.request.approve', name: 'Aprobar Solicitudes', description: 'Aprobar solicitudes', category: 'almacen' },
  { key: 'almacen.request.reject', name: 'Rechazar Solicitudes', description: 'Rechazar solicitudes', category: 'almacen' },
  { key: 'almacen.request.cancel', name: 'Cancelar Solicitudes', description: 'Cancelar solicitudes', category: 'almacen' },
  // Despachos
  { key: 'almacen.dispatch.view', name: 'Ver Despachos', description: 'Ver despachos', category: 'almacen' },
  { key: 'almacen.dispatch.create', name: 'Crear Despachos', description: 'Crear despachos', category: 'almacen' },
  { key: 'almacen.dispatch.process', name: 'Procesar Despachos', description: 'Procesar despachos', category: 'almacen' },
  { key: 'almacen.dispatch.confirm', name: 'Confirmar Despachos', description: 'Confirmar entrega', category: 'almacen' },
  { key: 'almacen.dispatch.receive', name: 'Recibir Despachos', description: 'Confirmar recepción', category: 'almacen' },
  { key: 'almacen.dispatch.cancel', name: 'Cancelar Despachos', description: 'Cancelar despachos', category: 'almacen' },
  // Devoluciones
  { key: 'almacen.return.view', name: 'Ver Devoluciones', description: 'Ver devoluciones', category: 'almacen' },
  { key: 'almacen.return.create', name: 'Crear Devoluciones', description: 'Crear devoluciones', category: 'almacen' },
  { key: 'almacen.return.process', name: 'Procesar Devoluciones', description: 'Procesar devoluciones', category: 'almacen' },
  // Reservas
  { key: 'almacen.reservation.view', name: 'Ver Reservas', description: 'Ver reservas', category: 'almacen' },
  { key: 'almacen.reservation.create', name: 'Crear Reservas', description: 'Crear reservas manuales', category: 'almacen' },
  { key: 'almacen.reservation.release', name: 'Liberar Reservas', description: 'Liberar reservas', category: 'almacen' },
  // Operaciones
  { key: 'almacen.transfer', name: 'Transferir Stock', description: 'Transferir entre depósitos', category: 'almacen' },
  { key: 'almacen.adjust', name: 'Ajustar Inventario', description: 'Ajustar inventario', category: 'almacen' },
  { key: 'almacen.cycle_count', name: 'Conteo Cíclico', description: 'Conteo cíclico', category: 'almacen' },
  // Admin
  { key: 'almacen.manage_warehouses', name: 'Administrar Depósitos', description: 'Administrar depósitos', category: 'almacen' },
  { key: 'almacen.manage_locations', name: 'Administrar Ubicaciones', description: 'Administrar ubicaciones', category: 'almacen' },
  { key: 'almacen.manage_all', name: 'Administrar Todo Almacén', description: 'Superadmin almacén', category: 'almacen' },
];

async function main() {
  console.log('🏭 Iniciando seed de permisos de Almacén...\n');

  // 1. Crear permisos si no existen
  console.log('📝 Creando permisos...');
  let createdCount = 0;
  let existingCount = 0;

  for (const perm of ALMACEN_PERMISSIONS) {
    const existing = await prisma.permission.findUnique({
      where: { key: perm.key },
    });

    if (!existing) {
      await prisma.permission.create({
        data: {
          key: perm.key,
          name: perm.name,
          description: perm.description,
          category: perm.category,
          isActive: true,
        },
      });
      createdCount++;
      console.log(`  ✅ Creado: ${perm.key}`);
    } else {
      existingCount++;
    }
  }
  console.log(`\n  Permisos creados: ${createdCount}, ya existían: ${existingCount}\n`);

  // 2. Buscar roles "Administrador" en todas las empresas
  console.log('🔍 Buscando roles Administrador...');
  const adminRoles = await prisma.role.findMany({
    where: {
      name: 'Administrador',
    },
    include: {
      company: true,
    },
  });

  if (adminRoles.length === 0) {
    console.log('  ⚠️  No se encontraron roles "Administrador". Creando uno por defecto...\n');

    // Buscar la primera empresa
    const firstCompany = await prisma.company.findFirst();
    if (firstCompany) {
      const newRole = await prisma.role.create({
        data: {
          name: 'Administrador',
          description: 'Administrador con acceso completo',
          companyId: firstCompany.id,
        },
      });
      adminRoles.push({ ...newRole, company: firstCompany } as any);
      console.log(`  ✅ Rol Administrador creado en empresa: ${firstCompany.name}\n`);
    }
  } else {
    console.log(`  Encontrados ${adminRoles.length} rol(es) Administrador\n`);
  }

  // 3. Asignar permisos a cada rol Administrador
  console.log('🔐 Asignando permisos a roles Administrador...');

  const allPermissions = await prisma.permission.findMany({
    where: {
      OR: [
        { key: { startsWith: 'almacen.' } },
        { key: 'ingresar_almacen' },
      ],
    },
  });

  for (const role of adminRoles) {
    console.log(`\n  📦 Empresa: ${role.company?.name || 'Desconocida'} (Rol ID: ${role.id})`);
    let assignedCount = 0;

    for (const permission of allPermissions) {
      const existing = await prisma.rolePermission.findUnique({
        where: {
          roleId_permissionId: {
            roleId: role.id,
            permissionId: permission.id,
          },
        },
      });

      if (!existing) {
        await prisma.rolePermission.create({
          data: {
            roleId: role.id,
            permissionId: permission.id,
            isGranted: true,
          },
        });
        assignedCount++;
      }
    }
    console.log(`     ✅ Permisos asignados: ${assignedCount} (ya tenía: ${allPermissions.length - assignedCount})`);
  }

  console.log('\n✨ Seed completado exitosamente!\n');

  // Resumen
  console.log('📊 Resumen:');
  console.log(`   - Permisos totales de almacén: ${allPermissions.length}`);
  console.log(`   - Roles Administrador actualizados: ${adminRoles.length}`);
  console.log('\n🔄 Reinicia la aplicación para ver los cambios en el sidebar.\n');
}

main()
  .catch((e) => {
    console.error('❌ Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
