import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';
import { UserRole } from '@/lib/permissions';
import { JWT_SECRET } from '@/lib/auth'; // ✅ Importar el mismo secret
import { requirePermission, requireAuth } from '@/lib/auth/shared-helpers';

export const dynamic = 'force-dynamic';

// ✅ OPTIMIZADO: Usar instancia global de prisma desde @/lib/prisma

const JWT_SECRET_KEY = new TextEncoder().encode(JWT_SECRET);

// Helper para obtener usuario desde JWT
async function getUserFromToken() {
  try {
    const token = cookies().get('token')?.value;

    if (!token) {
      console.log('❌ No hay token JWT');
      return null;
    }

    const { payload } = await jwtVerify(token, JWT_SECRET_KEY);

    const user = await prisma.user.findUnique({
      where: { id: payload.userId as number }
    });

    return user;
  } catch (error) {
    console.error('Error obteniendo usuario desde JWT:', error);
    return null;
  }
}

// GET /api/companies - Obtener empresas reales de la base de datos
export async function GET(request: Request) {
  try {
    // Solo requiere autenticación — ver tus propias empresas es un derecho básico
    const { user: currentUser, error: authError } = await requireAuth();
    if (authError) return authError;

    let companies = [];

    // SUPERADMIN puede ver todas las empresas
    if (currentUser.role === 'SUPERADMIN') {
      companies = await prisma.company.findMany({
        orderBy: { id: 'asc' }
      });
    } else {
      // Otros usuarios solo ven las empresas a las que están asociados
      const userCompanies = await prisma.userOnCompany.findMany({
        where: {
          userId: currentUser.id,
          isActive: true
        },
        include: {
          company: true
        }
      });

      companies = userCompanies.map(uc => uc.company);
    }

    return NextResponse.json(companies, { status: 200 });
  } catch (error) {
    console.error('❌ Error al obtener empresas:', error);
    return NextResponse.json(
      { error: 'Error al obtener las empresas' },
      { status: 500 }
    );
  }
  // ✅ OPTIMIZADO: Removido $disconnect() - no es necesario con connection pooling
}

// POST /api/companies - Crear nueva empresa en la base de datos
export async function POST(request: Request) {
  try {
    // Verificar permiso companies.create
    const { user: authUser, error: authError } = await requirePermission('companies.create');
    if (authError) return authError;

    console.log('📝 POST /api/companies - Creando empresa en la base de datos...');

    // Obtener usuario autenticado
    const currentUser = await getUserFromToken();
    if (!currentUser) {
      console.log('❌ Usuario no autenticado');
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    console.log('✅ Usuario autenticado:', currentUser.name, '| ID:', currentUser.id, '| Rol:', currentUser.role);
    
    const body = await request.json();
    
    // Validaciones básicas
    if (!body.name || !body.cuit) {
      return NextResponse.json(
        { error: 'Nombre y CUIT son requeridos' },
        { status: 400 }
      );
    }

    // El usuario autenticado será el owner de la empresa
    const ownerId = currentUser.id;
    
    const newCompany = await prisma.company.create({
      data: {
        name: body.name,
        cuit: body.cuit,
        address: body.address || body.direccion || '',
        phone: body.phone || body.telefono || '',
        email: body.email || body.gmail || '',
        logo: body.logo || null,
      }
    });

    // Crear roles básicos para la nueva empresa
    const basicRoles = [
      { name: 'ADMIN', displayName: 'Administrador', description: 'Administrador de empresa con permisos completos' },
      { name: 'SUPERVISOR', displayName: 'Supervisor', description: 'Supervisor con permisos de gestión' },
      { name: 'USER', displayName: 'Usuario', description: 'Usuario básico con permisos limitados' },
      { name: 'Administrador', displayName: 'Administrador', description: 'Administrador con todos los permisos del sistema' }
    ];

    const createdRoles: Record<string, any> = {};
    
    for (const roleData of basicRoles) {
      const role = await prisma.role.create({
        data: {
          name: roleData.name,
          displayName: roleData.displayName,
          description: roleData.description,
          companyId: newCompany.id
        }
      });
      createdRoles[roleData.name] = role;
      console.log(`✅ Rol creado: ${role.name} (ID: ${role.id})`);
    }

    // Asignar todos los permisos al rol "Administrador" recién creado
    if (createdRoles['Administrador']) {
      try {
        // Obtener todos los permisos activos (esto incluye todos los permisos: iniciales + sidebar)
        const allPermissions = await prisma.permission.findMany({
          where: { isActive: true }
        });

        console.log(`🔐 Asignando ${allPermissions.length} permisos al rol "Administrador"...`);

        for (const permission of allPermissions) {
          await prisma.rolePermission.upsert({
            where: {
              roleId_permissionId: {
                roleId: createdRoles['Administrador'].id,
                permissionId: permission.id
              }
            },
            update: {
              isGranted: true
            },
            create: {
              roleId: createdRoles['Administrador'].id,
              permissionId: permission.id,
              isGranted: true
            }
          });
        }

        console.log(`✅ ${allPermissions.length} permisos asignados al rol "Administrador"`);
      } catch (permError) {
        console.error('❌ Error asignando permisos al rol "Administrador":', permError);
        // No fallar la creación de la empresa si hay un error asignando permisos
      }
    }

    // Crear la relación del owner con la empresa (como ADMIN)
    try {
      await prisma.userOnCompany.create({
        data: {
          userId: ownerId,
          companyId: newCompany.id,
          roleId: createdRoles['ADMIN'].id, // Asignar rol de ADMIN en la empresa
          isActive: true,
        }
      });
      console.log('✅ Relación owner-empresa creada:');
      console.log('   Usuario:', currentUser.name, '(ID:', ownerId, ')');
      console.log('   Empresa:', newCompany.name, '(ID:', newCompany.id, ')');
      console.log('   Rol en empresa: ADMIN');
    } catch (relationError) {
      console.error('❌ Error creando relación owner-empresa:', relationError);
    }

    // Crear las áreas del sistema automáticamente
    const SYSTEM_AREAS = [
      { name: "Administración", icon: "users" },
      { name: "Mantenimiento", icon: "wrench" },
      { name: "Producción", icon: "settings" }
    ];

    try {
      for (const area of SYSTEM_AREAS) {
        await prisma.area.create({
          data: {
            name: area.name,
            icon: area.icon,
            companyId: newCompany.id,
          },
        });
      }
      console.log('✅ Áreas del sistema creadas para la nueva empresa:', newCompany.id);
    } catch (areaError) {
      console.error('❌ Error creando áreas del sistema:', areaError);
    }

    console.log('✅ Empresa creada en la base de datos:', newCompany.name);
    return NextResponse.json(newCompany, { status: 201 });
  } catch (error: any) {
    console.error('❌ Error al crear empresa:', error);
    
    // Si el error es por CUIT duplicado
    if (error.code === 'P2002') {
      return NextResponse.json(
        { error: 'Ya existe una empresa con ese CUIT' },
        { status: 400 }
      );
    }
    
    return NextResponse.json(
      { error: 'Error al crear la empresa' },
      { status: 500 }
    );
  }
  // ✅ OPTIMIZADO: Removido $disconnect() - no es necesario con connection pooling
} 