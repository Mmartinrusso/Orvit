import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';
import { createAndSendInstantNotification } from '@/lib/instant-notifications';
import { hasPermission, createPermissionContext, canManageRole, getAssignableRoles } from '@/lib/permissions';
import { UserRole } from '@prisma/client';
import { JWT_SECRET } from '@/lib/auth';
import { withGuards } from '@/lib/middleware/withGuards';
import { validateRequest } from '@/lib/validations/helpers';
import { UpdateUserSchema } from '@/lib/validations/users';
import { invalidateUserPermissions } from '@/lib/permissions-helpers';

export const dynamic = 'force-dynamic';

const JWT_SECRET_KEY = new TextEncoder().encode(JWT_SECRET);

// Helper para obtener estadísticas del usuario
async function getUserStats(userId: number) {
  try {
    const [assignedTasks, createdTasks, assignedWorkOrders, createdWorkOrders] = await Promise.all([
      prisma.task.count({ where: { assignedToId: userId } }),
      prisma.task.count({ where: { createdById: userId } }),
      prisma.workOrder.count({ where: { assignedToId: userId } }),
      prisma.workOrder.count({ where: { createdById: userId } })
    ]);

    return {
      assignedTasks,
      createdTasks,
      assignedWorkOrders,
      createdWorkOrders
    };
  } catch (error) {
    console.error('Error obteniendo estadísticas del usuario:', error);
    return {
      assignedTasks: 0,
      createdTasks: 0,
      assignedWorkOrders: 0,
      createdWorkOrders: 0
    };
  }
}

// Helper para obtener usuario autenticado
async function getUserFromToken(request: NextRequest) {
  try {
    const token = cookies().get('token')?.value;
    if (!token) return null;

    const { payload } = await jwtVerify(token, JWT_SECRET_KEY);
    
    const user = await prisma.user.findUnique({
      where: { id: payload.userId as number },
      include: {
        companies: {
          include: {
            company: true
          }
        },
        ownedCompanies: true
      }
    });

    return user;
  } catch (error) {
    return null;
  }
}

// Helper para verificar permisos usando el sistema de permisos
async function checkUserPermissions(currentUser: any, targetUserId: number, permission: 'view' | 'edit' | 'delete') {
  // Obtener información del usuario objetivo
  const targetUser = await prisma.user.findUnique({
    where: { id: targetUserId },
    include: {
      companies: {
        include: {
          company: true
        }
      }
    }
  });

  if (!targetUser) {
    return { canAccess: false, targetUser: null };
  }

  // Obtener IDs de empresas del usuario actual
  const currentUserCompanyIds = currentUser.ownedCompanies?.map((c: any) => c.id) || 
                                currentUser.companies?.map((uc: any) => uc.company.id) || [];
  
  // Obtener IDs de empresas del usuario objetivo
  const targetUserCompanyIds = targetUser.companies?.map((uc: any) => uc.company.id) || [];
  
  // Encontrar empresa común
  const commonCompanyId = currentUserCompanyIds.find((id: number) => targetUserCompanyIds.includes(id)) ||
                         currentUserCompanyIds[0] ||
                         targetUserCompanyIds[0]; // Si no hay empresa común, usar la empresa del usuario objetivo

  // Verificación simplificada de permisos
  let canAccess = false;
  
  // SUPERADMIN puede hacer todo
  if (currentUser.role === 'SUPERADMIN') {
    canAccess = true;
  }
  // ADMIN puede editar usuarios de su empresa (excepto SUPERADMIN)
  else if (currentUser.role === 'ADMIN' && targetUser.role !== 'SUPERADMIN') {
    // Si el usuario actual no tiene empresas asignadas, pero el objetivo sí,
    // permitir acceso (asumiendo que es la empresa por defecto)
    if (currentUserCompanyIds.length === 0 && targetUserCompanyIds.length > 0) {
      canAccess = true;
    } else {
      // Verificar que ambos usuarios pertenezcan a la misma empresa
      const hasCommonCompany = currentUserCompanyIds.some((id: number) => targetUserCompanyIds.includes(id));
      canAccess = hasCommonCompany;
    }
  }
  // ADMIN_ENTERPRISE puede editar usuarios de su empresa (excepto SUPERADMIN)
  else if (currentUser.role === 'ADMIN_ENTERPRISE' && targetUser.role !== 'SUPERADMIN') {
    // Si el usuario actual no tiene empresas asignadas, pero el objetivo sí,
    // permitir acceso (asumiendo que es la empresa por defecto)
    if (currentUserCompanyIds.length === 0 && targetUserCompanyIds.length > 0) {
      canAccess = true;
    } else {
      // Verificar que ambos usuarios pertenezcan a la misma empresa
      const hasCommonCompany = currentUserCompanyIds.some((id: number) => targetUserCompanyIds.includes(id));
      canAccess = hasCommonCompany;
    }
  }
  // Usuarios normales solo pueden editar su propio perfil
  else if (currentUser.id === targetUserId) {
    canAccess = true;
  }
  
  return { canAccess, targetUser, context: null };
}

// GET /api/users/[id] - Obtener datos de un usuario específico
export const GET = withGuards(async (
  request: NextRequest,
  { user: guardedUser, params: _p },
  routeContext
) => {
  const { params } = routeContext!;
  try {
    const currentUser = await getUserFromToken(request);
    if (!currentUser) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const userId = parseInt(params.id);
    if (isNaN(userId)) {
      return NextResponse.json({ error: "ID de usuario inválido" }, { status: 400 });
    }

    const permissionCheck = await checkUserPermissions(currentUser, userId, 'view');
    if (!permissionCheck.canAccess) {
      return NextResponse.json({ error: "Sin permisos para ver este usuario" }, { status: 403 });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        companies: {
          include: {
            company: {
              select: {
                id: true,
                name: true
              }
            }
          }
        },
        ownedCompanies: {
          select: {
            id: true,
            name: true
          }
        },
        _count: {
          select: {
            assignedTasks: true,
            createdTasks: true,
            assignedWorkOrders: true,
            createdWorkOrders: true
          }
        }
      }
    });

    if (!user) {
      return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
    }

    // Obtener estadísticas del usuario
    const stats = await getUserStats(userId);

    // Obtener información de empresa del usuario
    const userCompanies = await prisma.userOnCompany.findMany({
      where: { userId: userId },
      select: {
        id: true,
        userId: true,
        companyId: true,
        roleId: true,
        isActive: true,
        joinedAt: true,
        company: {
          select: {
            id: true,
            name: true,
            cuit: true
          }
        }
      }
    });

    // Obtener el rol específico de la empresa
    const companyRole = userCompanies.find(uc => uc.roleId)?.roleId;
    let roleName: string = user.role; // Por defecto usar el rol global
    
    if (companyRole) {
      // Buscar el nombre del rol específico
      const role = await prisma.role.findUnique({
        where: { id: companyRole }
      });
      if (role) {
        roleName = role.name;
      }
    }

    const responseUser = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: roleName as any, // Usar el rol específico de la empresa
      isActive: user.isActive,
      avatar: user.avatar,
      lastLogin: user.lastLogin,
      createdAt: user.createdAt,
      companies: userCompanies.map(uc => ({
        id: uc.company.id,
        name: uc.company.name,
        cuit: uc.company.cuit,
        roleId: uc.roleId,
        isActive: uc.isActive,
        joinedAt: uc.joinedAt
      })),
      stats
    };

    // console.log(`✅ [User Detail] Devolviendo datos del usuario ${user.name} con ${userCompanies.length} empresas`) // Log reducido;

    return NextResponse.json({
      user: responseUser
    });

  } catch (error) {
    console.error('❌ Error en GET /api/users/[id]:', error);
    return NextResponse.json({
      error: "Error interno del servidor"
    }, { status: 500 });
  }
}, { requiredPermissions: ['users.view'], permissionMode: 'any' });

// PUT /api/users/[id] - Actualizar datos de un usuario
export const PUT = withGuards(async (
  request: NextRequest,
  { user: guardedUser, params: _p },
  routeContext
) => {
  const { params } = routeContext!;
  try {
    const currentUser = await getUserFromToken(request);
    if (!currentUser) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const userId = parseInt(params.id);
    if (isNaN(userId)) {
      return NextResponse.json({ error: "ID de usuario inválido" }, { status: 400 });
    }

    const permissionCheck = await checkUserPermissions(currentUser, userId, 'edit');
    
    if (!permissionCheck.canAccess) {
      return NextResponse.json({ error: "Sin permisos para editar este usuario" }, { status: 403 });
    }

    const body = await request.json();
    const validation = validateRequest(UpdateUserSchema, body);
    if (!validation.success) return validation.response;

    const { name, email, role, isActive, newPassword, avatar, phone } = validation.data;

    // Obtener usuario actual para comparar cambios
    const existingUser = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        companies: {
          include: {
            company: true
          }
        }
      }
    });

    if (!existingUser) {
      return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
    }

    // Obtener IDs de empresas del usuario objetivo para roles personalizados
    const targetUserCompanyIds = existingUser.companies?.map((uc: any) => uc.company.id) || [];

    // Verificar email único si se cambia
    if (email && email !== existingUser.email) {
      const emailExists = await prisma.user.findUnique({
        where: { email }
      });
      
      if (emailExists) {
        return NextResponse.json({ error: "El email ya está en uso" }, { status: 400 });
      }
    }

    // Preparar datos de actualización
    const updateData: any = {};
    
    if (name !== undefined) updateData.name = name;
    if (email !== undefined) updateData.email = email;
    if (avatar !== undefined) updateData.avatar = avatar;
    if (phone !== undefined) updateData.phone = phone;
    if (isActive !== undefined) updateData.isActive = isActive;

    // Manejar cambio de rol - SIEMPRE cambiar el rol específico de la empresa
    if (role !== undefined) {
      // Obtener el rol actual específico de la empresa para comparar
      const currentCompanyRole = (existingUser.companies?.[0] as any)?.role?.name || 'USER';
      
      // Buscar el rol en la empresa del usuario
      const targetUserCompanyIds = existingUser.companies?.map((uc: any) => uc.company.id) || [];
      if (targetUserCompanyIds.length === 0) {
        return NextResponse.json({ error: "Usuario sin empresa asociada" }, { status: 400 });
          }
      
      // Buscar el rol (puede ser del sistema o personalizado)
      // Primero obtener todos los roles de la empresa y buscar por nombre (case-insensitive con trim)
      const allCompanyRoles = await prisma.role.findMany({
        where: {
          companyId: targetUserCompanyIds[0]
        }
      });
      
      const targetRole = allCompanyRoles.find(
        r => r.name.trim().toUpperCase() === role.trim().toUpperCase()
      );
      
      if (targetRole) {
        // Actualizar la relación UserOnCompany con el nuevo rol
        await prisma.userOnCompany.updateMany({
          where: {
            userId: userId,
            companyId: targetUserCompanyIds[0]
          },
          data: {
            roleId: targetRole.id
          }
        });
        
      } else {
        return NextResponse.json({ error: `Rol '${role}' no encontrado en la empresa` }, { status: 404 });
      }
    }

    // Manejar cambio de contraseña
    if (newPassword) {
      if (newPassword.length < 6) {
        return NextResponse.json({ error: "La contraseña debe tener al menos 6 caracteres" }, { status: 400 });
      }
      updateData.password = await bcrypt.hash(newPassword, 10);
    }

    // Actualizar usuario
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: updateData,
      include: {
        companies: {
          include: {
            company: {
              select: {
                id: true,
                name: true
              }
            }
          }
        }
      }
    });



    // Invalidar cache de permisos si hubo cambios de rol o estado
    if (role !== undefined || isActive !== undefined) {
      const userCompanyIds = existingUser.companies?.map((uc: any) => uc.company.id) || [];
      for (const cId of userCompanyIds) {
        await invalidateUserPermissions(userId, cId);
      }
    }

    // Registrar cambios para auditoría
    const changes = [];
    if (name && name !== existingUser.name) changes.push(`Nombre: ${existingUser.name} → ${name}`);
    if (email && email !== existingUser.email) changes.push(`Email: ${existingUser.email} → ${email}`);
    
    // Registrar cambio de rol específico de empresa
    const currentCompanyRole = (existingUser.companies?.[0] as any)?.role?.name || 'USER';
    if (role && role !== currentCompanyRole) {
      changes.push(`Rol de empresa: ${currentCompanyRole} → ${role}`);
    }
    
    if (isActive !== undefined && isActive !== existingUser.isActive) {
      changes.push(`Estado: ${existingUser.isActive ? 'Activo' : 'Inactivo'} → ${isActive ? 'Activo' : 'Inactivo'}`);
    }
    if (newPassword) changes.push('Contraseña actualizada');

    // Crear notificación si es un cambio importante
    if (changes.length > 0 && currentUser.id !== userId) {
      // Obtener empresa del usuario para la notificación
      let targetCompanyId = updatedUser.companies?.[0]?.company?.id || 
                           currentUser.ownedCompanies?.[0]?.id ||
                           currentUser.companies?.[0]?.company?.id;

      if (targetCompanyId) {
        await createAndSendInstantNotification(
          'USER_UPDATED',
          userId,
          targetCompanyId,
          null, // taskId
          null, // reminderId
          'Perfil actualizado',
          `Tu perfil ha sido actualizado por ${currentUser.name}. Cambios: ${changes.join(', ')}`,
          'medium',
          {
            updatedBy: currentUser.name,
            changes: changes
          }
        );
      }
    }

    // Log para auditoría
    // console.log(`🔧 Usuario ${userId} actualizado por ${currentUser.name} (${currentUser.id}). Cambios: ${changes.join(', ')}`) // Log reducido;

    // No incluir contraseña en la respuesta
    const { password, ...userWithoutPassword } = updatedUser;

    return NextResponse.json({
      user: {
        ...userWithoutPassword,
        companies: updatedUser.companies.map(uc => uc.company)
      },
      message: "Usuario actualizado exitosamente"
    });

  } catch (error) {
    console.error('Error en PUT /api/users/[id]:', error);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}, { requiredPermissions: ['users.edit'], permissionMode: 'any' });

// DELETE /api/users/[id] - Eliminar usuario
export const DELETE = withGuards(async (
  request: NextRequest,
  { user: guardedUser, params: _p },
  routeContext
) => {
  const { params } = routeContext!;
  try {
    const currentUser = await getUserFromToken(request);
    if (!currentUser) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const userId = parseInt(params.id);
    if (isNaN(userId)) {
      return NextResponse.json({ error: "ID de usuario inválido" }, { status: 400 });
    }

    // Verificar que no se elimine a sí mismo
    if (currentUser.id === userId) {
      return NextResponse.json({ error: "No puedes eliminar tu propia cuenta" }, { status: 400 });
    }

    const permissionCheck = await checkUserPermissions(currentUser, userId, 'delete');
    if (!permissionCheck.canAccess) {
      return NextResponse.json({ error: "Sin permisos para eliminar este usuario" }, { status: 403 });
    }

    const userToDelete = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        _count: {
          select: {
            assignedTasks: true,
            createdTasks: true,
            assignedWorkOrders: true,
            createdWorkOrders: true
          }
        }
      }
    });

    if (!userToDelete) {
      return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
    }

    // Verificar que no sea SUPERADMIN (extra protección)
    if (userToDelete.role === 'SUPERADMIN') {
      return NextResponse.json({ error: "No se puede eliminar un SUPERADMIN" }, { status: 403 });
    }

    // Verificar si tiene datos asociados importantes
    const hasImportantData = userToDelete._count.assignedTasks > 0 || 
                           userToDelete._count.createdTasks > 0 ||
                           userToDelete._count.assignedWorkOrders > 0 ||
                           userToDelete._count.createdWorkOrders > 0;

    // Obtener empresas del usuario para invalidar cache
    const userCompanies = await prisma.userOnCompany.findMany({
      where: { userId },
      select: { companyId: true }
    });

    if (hasImportantData) {
      // En lugar de eliminar completamente, desactivar el usuario
      await prisma.user.update({
        where: { id: userId },
        data: {
          isActive: false,
          email: `deleted_${Date.now()}_${userToDelete.email}` // Permitir reutilizar el email
        }
      });

      // Invalidar cache de permisos
      for (const uc of userCompanies) {
        await invalidateUserPermissions(userId, uc.companyId);
      }

      return NextResponse.json({
        message: "Usuario desactivado exitosamente (tenía datos asociados)",
        action: "deactivated"
      });
    }

    // Si no tiene datos importantes, eliminar completamente
    await prisma.user.delete({
      where: { id: userId }
    });

    // Invalidar cache de permisos
    for (const uc of userCompanies) {
      await invalidateUserPermissions(userId, uc.companyId);
    }

    return NextResponse.json({
      message: "Usuario eliminado exitosamente",
      action: "deleted"
    });

  } catch (error) {
    console.error('Error en DELETE /api/users/[id]:', error);
    
    // Si es error de constraint, significa que tiene datos relacionados
    if (error instanceof Error && error.message.includes('constraint')) {
      return NextResponse.json({ 
        error: "No se puede eliminar el usuario porque tiene datos asociados. Se desactivará en su lugar." 
      }, { status: 400 });
    }
    
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}, { requiredPermissions: ['users.delete'], permissionMode: 'any' });
