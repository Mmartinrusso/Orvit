import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

const ALMACEN_PERMISSIONS = [
  { name: 'ingresar_almacen', description: 'Acceso al módulo de almacén', category: 'almacen' },
  { name: 'almacen.view', description: 'Ver módulo almacén', category: 'almacen' },
  { name: 'almacen.view_dashboard', description: 'Ver dashboard de almacén', category: 'almacen' },
  { name: 'almacen.view_inventory', description: 'Ver inventario unificado', category: 'almacen' },
  { name: 'almacen.view_costs', description: 'Ver costos en almacén', category: 'almacen' },
  { name: 'almacen.request.view', description: 'Ver solicitudes de material', category: 'almacen' },
  { name: 'almacen.request.view_all', description: 'Ver todas las solicitudes', category: 'almacen' },
  { name: 'almacen.request.create', description: 'Crear solicitudes de material', category: 'almacen' },
  { name: 'almacen.request.edit', description: 'Editar solicitudes propias', category: 'almacen' },
  { name: 'almacen.request.approve', description: 'Aprobar solicitudes', category: 'almacen' },
  { name: 'almacen.request.reject', description: 'Rechazar solicitudes', category: 'almacen' },
  { name: 'almacen.request.cancel', description: 'Cancelar solicitudes', category: 'almacen' },
  { name: 'almacen.dispatch.view', description: 'Ver despachos', category: 'almacen' },
  { name: 'almacen.dispatch.create', description: 'Crear despachos', category: 'almacen' },
  { name: 'almacen.dispatch.process', description: 'Procesar despachos', category: 'almacen' },
  { name: 'almacen.dispatch.confirm', description: 'Confirmar entrega', category: 'almacen' },
  { name: 'almacen.dispatch.receive', description: 'Confirmar recepción', category: 'almacen' },
  { name: 'almacen.dispatch.cancel', description: 'Cancelar despachos', category: 'almacen' },
  { name: 'almacen.return.view', description: 'Ver devoluciones', category: 'almacen' },
  { name: 'almacen.return.create', description: 'Crear devoluciones', category: 'almacen' },
  { name: 'almacen.return.process', description: 'Procesar devoluciones', category: 'almacen' },
  { name: 'almacen.reservation.view', description: 'Ver reservas', category: 'almacen' },
  { name: 'almacen.reservation.create', description: 'Crear reservas manuales', category: 'almacen' },
  { name: 'almacen.reservation.release', description: 'Liberar reservas', category: 'almacen' },
  { name: 'almacen.transfer', description: 'Transferir entre depósitos', category: 'almacen' },
  { name: 'almacen.adjust', description: 'Ajustar inventario', category: 'almacen' },
  { name: 'almacen.cycle_count', description: 'Conteo cíclico', category: 'almacen' },
  { name: 'almacen.manage_warehouses', description: 'Administrar depósitos', category: 'almacen' },
  { name: 'almacen.manage_locations', description: 'Administrar ubicaciones', category: 'almacen' },
  { name: 'almacen.manage_all', description: 'Superadmin almacén', category: 'almacen' },
];

export async function POST() {
  try {
    const results = {
      permissionsCreated: 0,
      permissionsExisting: 0,
      rolesUpdated: 0,
      permissionsAssigned: 0,
      details: [] as string[],
    };

    // 1. Crear permisos si no existen
    for (const perm of ALMACEN_PERMISSIONS) {
      const existing = await prisma.permission.findUnique({
        where: { name: perm.name },
      });

      if (!existing) {
        await prisma.permission.create({
          data: {
            name: perm.name,
            description: perm.description,
            category: perm.category,
            isActive: true,
          },
        });
        results.permissionsCreated++;
        results.details.push(`Permiso creado: ${perm.name}`);
      } else {
        results.permissionsExisting++;
      }
    }

    // 2. Buscar roles "Administrador" en todas las empresas
    const adminRoles = await prisma.role.findMany({
      where: {
        name: 'Administrador',
      },
      include: {
        company: true,
      },
    });

    if (adminRoles.length === 0) {
      results.details.push('No se encontraron roles Administrador');
    }

    // 3. Obtener todos los permisos de almacén
    const allPermissions = await prisma.permission.findMany({
      where: {
        OR: [
          { name: { startsWith: 'almacen.' } },
          { name: 'ingresar_almacen' },
        ],
      },
    });

    // 4. Asignar permisos a cada rol Administrador
    for (const role of adminRoles) {
      let assignedToRole = 0;

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
          assignedToRole++;
          results.permissionsAssigned++;
        }
      }

      if (assignedToRole > 0) {
        results.rolesUpdated++;
        results.details.push(
          `Rol "${role.name}" (${role.company?.name || 'Sin empresa'}): ${assignedToRole} permisos asignados`
        );
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Permisos de Almacén aplicados correctamente',
      results,
    });
  } catch (error) {
    console.error('Error seeding almacén permissions:', error);
    return NextResponse.json(
      { error: 'Error al aplicar permisos', details: String(error) },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    message: 'Use POST para aplicar los permisos de Almacén al rol Administrador',
    permissions: ALMACEN_PERMISSIONS.map((p) => p.name),
  });
}
