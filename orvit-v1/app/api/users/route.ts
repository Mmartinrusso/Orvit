import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { UserRole } from "@prisma/client";
import bcrypt from "bcryptjs";
import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';
import { createAndSendInstantNotification } from '@/lib/instant-notifications';
import { hasPermission, createPermissionContext, getAssignableRoles } from '@/lib/permissions';
import { JWT_SECRET } from '@/lib/auth';
import { withGuards } from '@/lib/middleware/withGuards';
import { validateRequest } from '@/lib/validations/helpers';
import { CreateUserSchema } from '@/lib/validations/users';
import { invalidateUserPermissions } from '@/lib/permissions-helpers';

export const dynamic = 'force-dynamic';


const JWT_SECRET_KEY = new TextEncoder().encode(JWT_SECRET);

// Helper para obtener usuario desde JWT (rich user with companies for internal logic)
async function getUserFromToken(request: NextRequest) {
  try {
    const token = cookies().get('token')?.value;

    if (!token) {
      return null;
    }

    const { payload } = await jwtVerify(token, JWT_SECRET_KEY);

    const user = await prisma.user.findUnique({
      where: { id: payload.userId as number },
      select: {
        id: true,
        name: true,
        role: true,
        companies: {
          select: {
            company: { select: { id: true } },
          },
        },
        ownedCompanies: {
          select: { id: true },
        },
      },
    });

    return user;
  } catch (error) {
    console.error('Error obteniendo usuario desde JWT:', error);
    return null;
  }
}

// GET /api/users - Obtener usuarios de la empresa
export const GET = withGuards(async (request: NextRequest, { user: guardedUser }) => {
  try {
    // console.log('📋 Solicitando usuarios...') // Log reducido;
    
    const { searchParams } = new URL(request.url);
    const checkExists = searchParams.get('checkExists');
    
    // Si solo queremos verificar si existen usuarios
    if (checkExists === 'true') {
      // console.log('🔍 Verificando si existen usuarios en la base de datos...') // Log reducido;
      
      try {
        const userCount = await prisma.user.count();
        // console.log(`📊 Total de usuarios en la base de datos: ${userCount}`) // Log reducido;
        
        return NextResponse.json({ 
          hasUsers: userCount > 0,
          count: userCount
        });
      } catch (error) {
        console.error('❌ Error verificando usuarios:', error);
        return NextResponse.json({ 
          hasUsers: false,
          count: 0,
          error: 'Error verificando usuarios'
        });
      }
    }
    
    const currentUser = await getUserFromToken(request);
    if (!currentUser) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    // Helper to fetch all system users (SUPERADMIN/ADMIN without company)
    const fetchAllSystemUsers = async () => {
      const allUsers = await prisma.user.findMany({
        where: { role: { not: 'SUPERADMIN' } },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          isActive: true,
          lastLogin: true,
          createdAt: true,
          updatedAt: true,
          companies: {
            select: {
              role: { select: { name: true, displayName: true } },
            },
            take: 1,
          },
        },
        orderBy: { createdAt: 'desc' },
      });

      return allUsers.map((user) => {
        let displayRole = user.role?.toLowerCase() || 'user';
        const customRole = user.companies.find(uc => uc.role);
        if (customRole?.role) {
          displayRole = customRole.role.displayName || customRole.role.name;
        }

        return {
          id: user.id.toString(),
          name: user.name,
          email: user.email,
          role: displayRole,
          isActive: user.isActive,
          lastLogin: user.lastLogin?.toISOString() || null,
          createdAt: user.createdAt.toISOString(),
          updatedAt: user.updatedAt.toISOString(),
        };
      });
    };

    // Verificar si es SUPERADMIN (puede ver todos los usuarios)
    if (currentUser.role === 'SUPERADMIN') {
      return NextResponse.json(await fetchAllSystemUsers());
    }

    // Obtener la empresa del usuario (puede ser owner o miembro)
    let companyId: number;
    if (currentUser.ownedCompanies && currentUser.ownedCompanies.length > 0) {
      companyId = currentUser.ownedCompanies[0].id;
    } else if (currentUser.companies && currentUser.companies.length > 0) {
      companyId = currentUser.companies[0].company.id;
    } else {
      // Para usuarios ADMIN que no tienen empresa, permitir ver usuarios del sistema
      if (currentUser.role === 'ADMIN') {
        return NextResponse.json(await fetchAllSystemUsers());
      }

      return NextResponse.json({ error: "Usuario sin empresa" }, { status: 403 });
    }

    // Obtener todos los usuarios de la empresa a través de UserOnCompany
    const userCompanies = await prisma.userOnCompany.findMany({
      where: { companyId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            isActive: true,
            lastLogin: true,
            createdAt: true,
            updatedAt: true,
          }
        },
        role: true
      }
    });

    // Filtrar SUPERADMIN de la lista (no debe aparecer en selectores)
    const filteredUserCompanies = userCompanies.filter(uc => uc.user.role !== 'SUPERADMIN');
    
    const transformedUsers = filteredUserCompanies.map((uc) => {
      // Usar SIEMPRE el rol específico de la empresa
      const companyRole = uc.role ? (uc.role.displayName || uc.role.name) : 'Usuario';
      const companyRoleCode = uc.role ? uc.role.name : 'USER';
      
      // Información del rol global para referencia
      const globalRole = uc.user.role || 'USER';
      
      return {
        id: uc.user.id.toString(),
        name: uc.user.name,
        email: uc.user.email,
        role: companyRoleCode, // Código del rol específico de la empresa
        roleDisplay: companyRole, // Nombre del rol específico de la empresa
        companyRole: companyRole, // Rol específico de la empresa
        globalRole: globalRole, // Rol global del usuario (solo para referencia)
        isActive: uc.user.isActive,
        lastLogin: uc.user.lastLogin?.toISOString() || null,
        createdAt: uc.user.createdAt.toISOString(),
        updatedAt: uc.user.updatedAt.toISOString(),
      };
    });

    return NextResponse.json(transformedUsers);
    
  } catch (error) {
    console.error('❌ Error en GET /api/users:', error);
    return NextResponse.json([]);
  }
}, { requiredPermissions: ['users.view'], permissionMode: 'any' });

// Helper para nombres de roles
function getRoleDisplayName(role: string): string {
  const names = {
    'SUPERADMIN': 'Super Administrador',
    'ADMIN': 'Administrador', 
    'SUPERVISOR': 'Supervisor',
    'USER': 'Usuario'
  };
  return names[role as keyof typeof names] || role;
}

// POST /api/users - Crear nuevo usuario
export const POST = withGuards(async (request: NextRequest, { user: guardedUser }) => {
  try {
    const body = await request.json();
    const validation = validateRequest(CreateUserSchema, body);
    if (!validation.success) return validation.response;

    const { name, email, role, password, isActive, companyId } = validation.data;

    // Verificar si el email ya existe
    const existingUser = await prisma.user.findUnique({
      where: { email }
    });

    if (existingUser) {
      return NextResponse.json({
        error: "El email ya está registrado"
      }, { status: 400 });
    }

    // Determinar empresa: body > guardedUser (siempre disponible via withGuards)
    const targetCompanyId = companyId
      ? parseInt(companyId.toString())
      : guardedUser.companyId;

    // Validar rol contra los roles de la empresa
    const requestedRole = (role || 'USER').trim();

    // Obtener roles de la empresa
    const companyRoles = await prisma.role.findMany({
      where: { companyId: targetCompanyId },
      select: { name: true, displayName: true }
    });

    const companyRoleNames = companyRoles.map(r => r.name.trim().toUpperCase());
    const requestedRoleUpper = requestedRole.trim().toUpperCase();

    // Validar que el rol solicitado exista en la empresa
    if (!companyRoleNames.includes(requestedRoleUpper)) {
      return NextResponse.json({
        error: `El rol "${requestedRole}" no existe en esta empresa. Roles disponibles: ${companyRoles.map(r => r.displayName || r.name).join(', ')}`
      }, { status: 400 });
    }

    // Para roles del sistema, validar permisos de asignación
    const systemRoles = ['USER', 'SUPERVISOR', 'ADMIN', 'ADMIN_ENTERPRISE', 'SUPERADMIN'];
    if (systemRoles.includes(requestedRoleUpper)) {
      const assignableRoles = getAssignableRoles(guardedUser.role as UserRole);
      if (!assignableRoles.includes(requestedRoleUpper as UserRole)) {
        return NextResponse.json({
          error: `No tienes permisos para asignar el rol ${requestedRole}`
        }, { status: 403 });
      }
    }

    // Encriptar contraseña
    const hashedPassword = await bcrypt.hash(password, 10);

    // Determinar el rol del sistema (si es personalizado, usar USER como base)
    const systemRole = systemRoles.includes(requestedRole.toUpperCase())
      ? requestedRole.toUpperCase() as UserRole
      : 'USER' as UserRole;

    // Buscar el roleId para la asociación
    const allCompanyRoles = await prisma.role.findMany({
      where: { companyId: targetCompanyId }
    });
    const roleRecord = allCompanyRoles.find(
      r => r.name.trim().toUpperCase() === requestedRoleUpper
    );
    const roleDisplayName = roleRecord?.displayName || roleRecord?.name || requestedRole;

    // Crear usuario + asociación a empresa en una transacción
    const newUser = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          name: name.trim(),
          email: email.toLowerCase().trim(),
          password: hashedPassword,
          role: systemRole,
          isActive
        },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          isActive: true,
          createdAt: true
        }
      });

      // Crear asociación a empresa (siempre — nunca crear usuario huérfano)
      await tx.userOnCompany.create({
        data: {
          userId: user.id,
          companyId: targetCompanyId,
          roleId: roleRecord?.id || null,
          isActive: true
        }
      });

      return user;
    });

    // Invalidar cache de permisos del nuevo usuario
    await invalidateUserPermissions(newUser.id, targetCompanyId);

    // Crear notificación de bienvenida (no-crítico, catch silencioso OK)
    try {
      await createAndSendInstantNotification(
        'USER_CREATED',
        newUser.id,
        targetCompanyId,
        null,
        null,
        '¡Bienvenido al sistema!',
        `Tu cuenta ha sido creada exitosamente por ${guardedUser.name}. Tu rol es: ${roleDisplayName}`,
        'medium',
        {
          createdBy: guardedUser.name,
          role: roleDisplayName,
          welcome: true
        }
      );
    } catch (error) {
      console.error('❌ Error enviando notificación de bienvenida:', error);
    }

    return NextResponse.json({
      user: newUser,
      message: "Usuario creado exitosamente"
    }, { status: 201 });

  } catch (error) {
    console.error('❌ Error en POST /api/users:', error);
    return NextResponse.json({
      error: "Error interno del servidor"
    }, { status: 500 });
  }
}, { requiredPermissions: ['users.create'], permissionMode: 'any' });
