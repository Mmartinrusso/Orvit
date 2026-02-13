import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';
import { hasPermission, createPermissionContext, UserRole } from '@/lib/permissions';
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

// GET /api/users/activity - Obtener estadísticas de actividad de usuarios
export async function GET(request: NextRequest) {
  try {
    const currentUser = await getUserFromToken(request);
    if (!currentUser) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const targetUserId = searchParams.get('userId');
    const period = searchParams.get('period') || '30'; // días
    const detailed = searchParams.get('detailed') === 'true';

    // Verificar permisos
    const context = createPermissionContext(
      { id: currentUser.id, role: currentUser.role as UserRole }
    );

    if (!hasPermission('users.view', context)) {
      return NextResponse.json({ error: "Sin permisos para ver actividad de usuarios" }, { status: 403 });
    }

    const periodDays = parseInt(period);
    const fromDate = new Date();
    fromDate.setDate(fromDate.getDate() - periodDays);

    if (targetUserId) {
      // Actividad de un usuario específico
      const userId = parseInt(targetUserId);
      
      // Verificar permisos para ver este usuario específico
      const targetContext = createPermissionContext(
        { id: currentUser.id, role: currentUser.role as UserRole },
        { targetUserId: userId }
      );

      if (!hasPermission('users.view', targetContext)) {
        return NextResponse.json({ error: "Sin permisos para ver este usuario" }, { status: 403 });
      }

      const userActivity = await getUserActivity(userId, fromDate, detailed);
      return NextResponse.json(userActivity);
    } else {
      // Actividad general de todos los usuarios visibles
      let userIds: number[] = [];

      if (currentUser.role === 'SUPERADMIN') {
        // SUPERADMIN puede ver todos los usuarios
        const allUsers = await prisma.user.findMany({
          select: { id: true },
          where: { role: { not: 'SUPERADMIN' } } // Excluir otros SUPERADMIN
        });
        userIds = allUsers.map(u => u.id);
      } else {
        // Otros roles: usuarios de su empresa
        const companyIds = currentUser.ownedCompanies?.map(c => c.id) || 
                          currentUser.companies?.map(uc => uc.company.id) || [];
        
        if (companyIds.length > 0) {
          const companyUsers = await prisma.userOnCompany.findMany({
            where: { companyId: { in: companyIds } },
            select: { userId: true }
          });
          userIds = companyUsers.map(uc => uc.userId);
        }
      }

      const activitiesPromises = userIds.map(userId => 
        getUserActivity(userId, fromDate, false)
      );
      
      const activities = (await Promise.all(activitiesPromises)).filter(a => a !== null);
      
      // Agregar resumen general
      const summary = {
        totalUsers: activities.length,
        activeUsers: activities.filter(a => a.user.isActive).length,
        recentlyActive: activities.filter(a => a.user.lastLogin && new Date(a.user.lastLogin) >= fromDate).length,
        totalTasks: activities.reduce((sum, a) => sum + (a.stats.totalTasks || 0), 0),
        totalWorkOrders: activities.reduce((sum, a) => sum + (a.stats.totalWorkOrders || 0), 0),
        avgTasksPerUser: activities.length > 0 ? 
          activities.reduce((sum, a) => sum + (a.stats.totalTasks || 0), 0) / activities.length : 0
      };

      return NextResponse.json({
        summary,
        users: activities,
        period: `${periodDays} días`
      });
    }

  } catch (error) {
    console.error('❌ Error en GET /api/users/activity:', error);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}

// Función helper para obtener actividad de un usuario
async function getUserActivity(userId: number, fromDate: Date, detailed: boolean = false) {
  try {
    // Información básica del usuario
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        lastLogin: true,
        createdAt: true
      }
    });

    if (!user) {
      return null;
    }

    // Estadísticas generales
    const stats = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        _count: {
          select: {
            assignedTasks: true,
            createdTasks: true,
            assignedWorkOrders: true,
            createdWorkOrders: true,
            taskComments: true,
            workOrderComments: true,
            notifications: true,
            toolLoans: true
          }
        }
      }
    });

    // Actividad reciente (últimos X días)
    const recentTasks = await prisma.task.count({
      where: {
        OR: [
          { assignedToId: userId },
          { createdById: userId }
        ],
        updatedAt: {
          gte: fromDate
        }
      }
    });

    const recentWorkOrders = await prisma.workOrder.count({
      where: {
        OR: [
          { assignedToId: userId },
          { createdById: userId }
        ],
        updatedAt: {
          gte: fromDate
        }
      }
    });

    const recentComments = await prisma.taskComment.count({
      where: {
        userId: userId,
        createdAt: {
          gte: fromDate
        }
      }
    });

    // Información detallada si se solicita
    let detailedActivity = null;
    if (detailed) {
      // Últimas tareas
      const recentTasksDetailed = await prisma.task.findMany({
        where: {
          OR: [
            { assignedToId: userId },
            { createdById: userId }
          ],
          updatedAt: {
            gte: fromDate
          }
        },
        select: {
          id: true,
          title: true,
          status: true,
          priority: true,
          updatedAt: true,
          createdAt: true,
          assignedToId: true,
          createdById: true
        },
        orderBy: {
          updatedAt: 'desc'
        },
        take: 10
      });

      // Últimas órdenes de trabajo
      const recentWorkOrdersDetailed = await prisma.workOrder.findMany({
        where: {
          OR: [
            { assignedToId: userId },
            { createdById: userId }
          ],
          updatedAt: {
            gte: fromDate
          }
        },
        select: {
          id: true,
          title: true,
          status: true,
          priority: true,
          updatedAt: true,
          createdAt: true,
          assignedToId: true,
          createdById: true
        },
        orderBy: {
          updatedAt: 'desc'
        },
        take: 10
      });

      // Últimos comentarios
      const recentCommentsDetailed = await prisma.taskComment.findMany({
        where: {
          userId: userId,
          createdAt: {
            gte: fromDate
          }
        },
        select: {
          id: true,
          content: true,
          createdAt: true,
          task: {
            select: {
              id: true,
              title: true
            }
          }
        },
        orderBy: {
          createdAt: 'desc'
        },
        take: 10
      });

      detailedActivity = {
        recentTasks: recentTasksDetailed,
        recentWorkOrders: recentWorkOrdersDetailed,
        recentComments: recentCommentsDetailed
      };
    }

    // Calcular días desde último acceso
    const daysSinceLastLogin = user.lastLogin ? 
      Math.floor((new Date().getTime() - new Date(user.lastLogin).getTime()) / (1000 * 60 * 60 * 24)) : 
      null;

    // Calcular días desde creación de cuenta
    const daysSinceCreation = Math.floor((new Date().getTime() - new Date(user.createdAt).getTime()) / (1000 * 60 * 60 * 24));

    return {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        isActive: user.isActive,
        lastLogin: user.lastLogin,
        createdAt: user.createdAt,
        daysSinceLastLogin,
        daysSinceCreation
      },
      stats: {
        totalTasks: (stats?._count?.assignedTasks || 0) + (stats?._count?.createdTasks || 0),
        assignedTasks: stats?._count?.assignedTasks || 0,
        createdTasks: stats?._count?.createdTasks || 0,
        totalWorkOrders: (stats?._count?.assignedWorkOrders || 0) + (stats?._count?.createdWorkOrders || 0),
        assignedWorkOrders: stats?._count?.assignedWorkOrders || 0,
        createdWorkOrders: stats?._count?.createdWorkOrders || 0,
        totalComments: (stats?._count?.taskComments || 0) + (stats?._count?.workOrderComments || 0),
        taskComments: stats?._count?.taskComments || 0,
        workOrderComments: stats?._count?.workOrderComments || 0,
        notifications: stats?._count?.notifications || 0,
        toolLoans: stats?._count?.toolLoans || 0
      },
      recentActivity: {
        tasks: recentTasks,
        workOrders: recentWorkOrders,
        comments: recentComments,
        period: `últimos ${Math.floor((new Date().getTime() - fromDate.getTime()) / (1000 * 60 * 60 * 24))} días`
      },
      ...(detailed && { detailedActivity })
    };

  } catch (error) {
    console.error(`❌ Error obteniendo actividad del usuario ${userId}:`, error);
    return {
      user: { id: userId, name: 'Error', email: '', role: 'USER', isActive: false },
      stats: {},
      recentActivity: {},
      error: 'Error obteniendo datos'
    };
  }
}

// POST /api/users/activity - Registrar actividad del usuario (último acceso)
export async function POST(request: NextRequest) {
  try {
    const currentUser = await getUserFromToken(request);
    if (!currentUser) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    // Actualizar último acceso
    await prisma.user.update({
      where: { id: currentUser.id },
      data: { lastLogin: new Date() }
    });

    // console.log(`📊 Actividad registrada para usuario ${currentUser.name} (${currentUser.id})`) // Log reducido;

    return NextResponse.json({
      message: "Actividad registrada",
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Error en POST /api/users/activity:', error);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
} 