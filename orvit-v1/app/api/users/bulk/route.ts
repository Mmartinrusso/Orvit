import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';
import { createAndSendInstantNotification } from '@/lib/instant-notifications';
import { hasPermission, createPermissionContext, canManageRole, UserRole } from '@/lib/permissions';
import { JWT_SECRET } from '@/lib/auth'; // ✅ Importar el mismo secret

export const dynamic = 'force-dynamic';


const JWT_SECRET_KEY = new TextEncoder().encode(JWT_SECRET);

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

// POST /api/users/bulk - Operaciones masivas sobre usuarios
export async function POST(request: NextRequest) {
  try {
    const currentUser = await getUserFromToken(request);
    if (!currentUser) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const body = await request.json();
    const { action, userIds, newRole, isActive } = body;

    if (!action || !userIds || !Array.isArray(userIds) || userIds.length === 0) {
      return NextResponse.json({ 
        error: "Acción y lista de usuarios requeridos" 
      }, { status: 400 });
    }

    // console.log(`🔧 [Bulk] Usuario ${currentUser.name} ejecutando acción masiva: ${action} en ${userIds.length} usuarios`) // Log reducido;

    let results = {
      success: 0,
      failed: 0,
      errors: [] as string[]
    };

    // Verificar permisos base
    const context = createPermissionContext(
      { id: currentUser.id, role: currentUser.role as UserRole }
    );

    switch (action) {
      case 'activate':
      case 'deactivate':
        if (!hasPermission('users.activate_deactivate', context)) {
          return NextResponse.json({ 
            error: "Sin permisos para activar/desactivar usuarios" 
          }, { status: 403 });
        }

        const targetActiveState = action === 'activate';
        
        for (const userId of userIds) {
          try {
            // Verificar permisos individuales
            const targetUser = await prisma.user.findUnique({
              where: { id: parseInt(userId) },
              include: {
                companies: {
                  include: {
                    company: true
                  }
                }
              }
            });

            if (!targetUser) {
              results.errors.push(`Usuario ${userId} no encontrado`);
              results.failed++;
              continue;
            }

            // No permitir desactivar SUPERADMIN
            if (targetUser.role === 'SUPERADMIN' && !targetActiveState) {
              results.errors.push(`No se puede desactivar SUPERADMIN: ${targetUser.name}`);
              results.failed++;
              continue;
            }

            // No permitir desactivarse a sí mismo
            if (currentUser.id === targetUser.id && !targetActiveState) {
              results.errors.push(`No puedes desactivar tu propia cuenta`);
              results.failed++;
              continue;
            }

            // Verificar permisos específicos
            const targetCompanyIds = targetUser.companies?.map((uc: any) => uc.company.id) || [];
            // Obtener el companyId del usuario actual
            const currentUserCompanyId = currentUser.ownedCompanies?.[0]?.id || 
                                        currentUser.companies?.[0]?.company?.id || null;
            const userContext = createPermissionContext(
              { id: currentUser.id, role: currentUser.role as UserRole },
              {
                targetUserId: targetUser.id,
                companyId: currentUserCompanyId,
                targetCompanyId: targetCompanyIds[0]
              }
            );

            if (!hasPermission('users.edit', userContext)) {
              results.errors.push(`Sin permisos para editar: ${targetUser.name}`);
              results.failed++;
              continue;
            }

            // Actualizar usuario
            await prisma.user.update({
              where: { id: targetUser.id },
              data: { isActive: targetActiveState }
            });

            // Crear notificación
            if (targetCompanyIds[0]) {
              await createAndSendInstantNotification(
                'USER_UPDATED',
                targetUser.id,
                targetCompanyIds[0],
                null,
                null,
                `Cuenta ${targetActiveState ? 'activada' : 'desactivada'}`,
                `Tu cuenta ha sido ${targetActiveState ? 'activada' : 'desactivada'} por ${currentUser.name}`,
                targetActiveState ? 'medium' : 'high',
                {
                  action: action,
                  updatedBy: currentUser.name
                }
              );
            }

            results.success++;
            // console.log(`✅ [Bulk] Usuario ${targetUser.name} ${targetActiveState ? 'activado' : 'desactivado'}`) // Log reducido;

          } catch (error) {
            console.error(`❌ [Bulk] Error procesando usuario ${userId}:`, error);
            results.errors.push(`Error procesando usuario ${userId}`);
            results.failed++;
          }
        }
        break;

      case 'change_role':
        if (!newRole) {
          return NextResponse.json({ 
            error: "Nuevo rol requerido" 
          }, { status: 400 });
        }

        if (!hasPermission('users.edit_role', context)) {
          return NextResponse.json({ 
            error: "Sin permisos para cambiar roles" 
          }, { status: 403 });
        }

        for (const userId of userIds) {
          try {
            const targetUser = await prisma.user.findUnique({
              where: { id: parseInt(userId) },
              include: {
                companies: {
                  include: {
                    company: true
                  }
                }
              }
            });

            if (!targetUser) {
              results.errors.push(`Usuario ${userId} no encontrado`);
              results.failed++;
              continue;
            }

            // Verificar si puede gestionar este rol
            if (!canManageRole(currentUser.role as UserRole, newRole as UserRole)) {
              results.errors.push(`Sin permisos para asignar rol ${newRole} a ${targetUser.name}`);
              results.failed++;
              continue;
            }

            // No cambiar el rol de SUPERADMIN
            if (targetUser.role === 'SUPERADMIN') {
              results.errors.push(`No se puede cambiar el rol de SUPERADMIN: ${targetUser.name}`);
              results.failed++;
              continue;
            }

            // No cambiar tu propio rol
            if (currentUser.id === targetUser.id) {
              results.errors.push(`No puedes cambiar tu propio rol`);
              results.failed++;
              continue;
            }

            // Verificar permisos específicos
            const targetCompanyIds = targetUser.companies?.map((uc: any) => uc.company.id) || [];
            // Obtener el companyId del usuario actual
            const currentUserCompanyId = currentUser.ownedCompanies?.[0]?.id || 
                                        currentUser.companies?.[0]?.company?.id || null;
            const userContext = createPermissionContext(
              { id: currentUser.id, role: currentUser.role as UserRole },
              {
                targetUserId: targetUser.id,
                companyId: currentUserCompanyId,
                targetCompanyId: targetCompanyIds[0]
              }
            );

            if (!hasPermission('users.edit_role', userContext)) {
              results.errors.push(`Sin permisos para cambiar rol de: ${targetUser.name}`);
              results.failed++;
              continue;
            }

            // Obtener el rol actual específico de la empresa
            const currentCompanyRole = (targetUser.companies?.[0] as any)?.role?.name || 'USER';
            const oldRole = currentCompanyRole;

            // Buscar el nuevo rol en la empresa
            const targetRole = await prisma.role.findFirst({
              where: {
                name: newRole,
                companyId: targetCompanyIds[0]
              }
            });

            if (targetRole) {
              // Actualizar el rol específico de la empresa
              await prisma.userOnCompany.updateMany({
                where: {
                  userId: targetUser.id,
                  companyId: targetCompanyIds[0]
                },
                data: {
                  roleId: targetRole.id
                }
            });
            }

            // Crear notificación
            if (targetCompanyIds[0]) {
              await createAndSendInstantNotification(
                'USER_UPDATED',
                targetUser.id,
                targetCompanyIds[0],
                null,
                null,
                'Rol actualizado',
                `Tu rol ha sido cambiado de ${oldRole} a ${newRole} por ${currentUser.name}`,
                'high',
                {
                  action: 'change_role',
                  oldRole: oldRole,
                  newRole: newRole,
                  updatedBy: currentUser.name
                }
              );
            }

            results.success++;
            // console.log(`✅ [Bulk] Rol de ${targetUser.name} cambiado de ${oldRole} a ${newRole}`) // Log reducido;

          } catch (error) {
            console.error(`❌ [Bulk] Error cambiando rol de usuario ${userId}:`, error);
            results.errors.push(`Error cambiando rol de usuario ${userId}`);
            results.failed++;
          }
        }
        break;

      case 'delete':
        if (!hasPermission('users.delete', context)) {
          return NextResponse.json({ 
            error: "Sin permisos para eliminar usuarios" 
          }, { status: 403 });
        }

        for (const userId of userIds) {
          try {
            const targetUser = await prisma.user.findUnique({
              where: { id: parseInt(userId) },
              include: {
                companies: {
                  include: {
                    company: true
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

            if (!targetUser) {
              results.errors.push(`Usuario ${userId} no encontrado`);
              results.failed++;
              continue;
            }

            // No eliminar SUPERADMIN
            if (targetUser.role === 'SUPERADMIN') {
              results.errors.push(`No se puede eliminar SUPERADMIN: ${targetUser.name}`);
              results.failed++;
              continue;
            }

            // No eliminarse a sí mismo
            if (currentUser.id === targetUser.id) {
              results.errors.push(`No puedes eliminar tu propia cuenta`);
              results.failed++;
              continue;
            }

            // Verificar permisos específicos
            const targetCompanyIds = targetUser.companies?.map((uc: any) => uc.company.id) || [];
            // Obtener el companyId del usuario actual
            const currentUserCompanyId = currentUser.ownedCompanies?.[0]?.id || 
                                        currentUser.companies?.[0]?.company?.id || null;
            const userContext = createPermissionContext(
              { id: currentUser.id, role: currentUser.role as UserRole },
              {
                targetUserId: targetUser.id,
                companyId: currentUserCompanyId,
                targetCompanyId: targetCompanyIds[0]
              }
            );

            if (!hasPermission('users.delete', userContext)) {
              results.errors.push(`Sin permisos para eliminar: ${targetUser.name}`);
              results.failed++;
              continue;
            }

            // Verificar si tiene datos asociados
            const hasImportantData = targetUser._count.assignedTasks > 0 || 
                                   targetUser._count.createdTasks > 0 ||
                                   targetUser._count.assignedWorkOrders > 0 ||
                                   targetUser._count.createdWorkOrders > 0;

            if (hasImportantData) {
              // Desactivar en lugar de eliminar
              await prisma.user.update({
                where: { id: targetUser.id },
                data: { 
                  isActive: false,
                  email: `deleted_${Date.now()}_${targetUser.email}` // Permitir reutilizar el email
                }
              });
              
              results.success++;
              // console.log(`✅ [Bulk] Usuario ${targetUser.name} desactivado (tenía datos asociados)`) // Log reducido;
            } else {
              // Eliminar completamente
              await prisma.user.delete({
                where: { id: targetUser.id }
              });
              
              results.success++;
              // console.log(`✅ [Bulk] Usuario ${targetUser.name} eliminado completamente`) // Log reducido;
            }

          } catch (error) {
            console.error(`❌ [Bulk] Error eliminando usuario ${userId}:`, error);
            results.errors.push(`Error eliminando usuario ${userId}`);
            results.failed++;
          }
        }
        break;

      default:
        return NextResponse.json({ 
          error: "Acción no válida" 
        }, { status: 400 });
    }

    return NextResponse.json({
      message: `Operación completada: ${results.success} exitosos, ${results.failed} fallidos`,
      results: results
    });

  } catch (error) {
    console.error('❌ Error en POST /api/users/bulk:', error);
    return NextResponse.json({ 
      error: "Error interno del servidor" 
    }, { status: 500 });
  }
} 