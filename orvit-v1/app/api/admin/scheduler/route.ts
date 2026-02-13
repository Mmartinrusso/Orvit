import { NextRequest, NextResponse } from 'next/server';
import { 
  getSchedulerStatus, 
  startTaskAutoScheduler, 
  stopTaskAutoScheduler, 
  executeManualReset 
} from '@/lib/task-auto-scheduler';
import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';
import { prisma } from "@/lib/prisma";
import { JWT_SECRET } from '@/lib/auth'; // ✅ Importar el mismo secret

export const dynamic = 'force-dynamic';

const JWT_SECRET_KEY = new TextEncoder().encode(JWT_SECRET);

// Helper function para verificar autenticación de admin
async function verifyAdminAuth(request: NextRequest) {
  try {
    const token = cookies().get('token')?.value;
    if (!token) return null;

    const { payload } = await jwtVerify(token, JWT_SECRET_KEY);
    
    const user = await prisma.user.findUnique({
      where: { id: payload.userId as number }
    });

    // Solo ADMIN y SUPERADMIN pueden acceder
    if (!user || (user.role !== 'ADMIN' && user.role !== 'SUPERADMIN')) {
      return null;
    }

    return user;
  } catch (error) {
    return null;
  }
}

// GET /api/admin/scheduler - Obtener estado del scheduler
export async function GET(request: NextRequest) {
  try {
    const user = await verifyAdminAuth(request);
    if (!user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    // Obtener estado del scheduler interno
    const schedulerStatus = getSchedulerStatus();

    // ✅ OPTIMIZADO: Ejecutar todas las queries en paralelo
    const now = new Date();
    const next24Hours = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    
    const [taskStats, completedTasks, pendingTasks, upcomingResets, overdueResets] = await Promise.all([
      // Estadísticas de tareas
      prisma.fixedTask.aggregate({
        where: { isActive: true },
        _count: { _all: true }
      }),
      // Tareas completadas
      prisma.fixedTask.count({
        where: { isActive: true, isCompleted: true }
      }),
      // Tareas pendientes
      prisma.fixedTask.count({
        where: { isActive: true, isCompleted: false }
      }),
      // Próximas tareas a reiniciar
      prisma.fixedTask.findMany({
        where: {
          isActive: true,
          isCompleted: true,
          nextExecution: { gte: now, lte: next24Hours }
        },
        select: {
          id: true, title: true, frequency: true, nextExecution: true,
          company: { select: { name: true } }
        },
        orderBy: { nextExecution: 'asc' },
        take: 10
      }),
      // Tareas que necesitan reiniciar ahora
      prisma.fixedTask.findMany({
        where: {
          isActive: true,
          isCompleted: true,
          nextExecution: { lte: now }
        },
        select: {
          id: true, title: true, frequency: true, nextExecution: true,
          company: { select: { name: true } }
        },
        orderBy: { nextExecution: 'asc' }
      })
    ]);

    return NextResponse.json({
      success: true,
      scheduler: schedulerStatus,
      statistics: {
        totalActiveTasks: taskStats._count._all,
        completedTasks,
        pendingTasks,
        overdueResets: overdueResets.length,
        upcomingResets: upcomingResets.length
      },
      overdueResets: overdueResets.map(task => ({
        id: task.id,
        title: task.title,
        frequency: task.frequency,
        nextExecution: task.nextExecution.toISOString(),
        companyName: task.company?.name || 'Sin empresa',
        hoursOverdue: Math.floor((now.getTime() - task.nextExecution.getTime()) / (1000 * 60 * 60))
      })),
      upcomingResets: upcomingResets.map(task => ({
        id: task.id,
        title: task.title,
        frequency: task.frequency,
        nextExecution: task.nextExecution.toISOString(),
        companyName: task.company?.name || 'Sin empresa',
        hoursUntil: Math.ceil((task.nextExecution.getTime() - now.getTime()) / (1000 * 60 * 60))
      })),
      serverTime: now.toISOString(),
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
    });

  } catch (error) {
    console.error('Error obteniendo estado del scheduler:', error);
    return NextResponse.json({
      success: false,
      error: 'Error interno del servidor',
      details: error instanceof Error ? error.message : 'Error desconocido'
    }, { status: 500 });
  }
}

// POST /api/admin/scheduler - Controlar el scheduler
export async function POST(request: NextRequest) {
  try {
    const user = await verifyAdminAuth(request);
    if (!user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const body = await request.json();
    const { action } = body;

    let result: any = {};

    switch (action) {
      case 'start':
        // console.log(`🔧 [ADMIN] Usuario ${user.name} iniciando scheduler`) // Log reducido;
        startTaskAutoScheduler();
        result = {
          message: 'Scheduler iniciado exitosamente',
          status: getSchedulerStatus()
        };
        break;

      case 'stop':
        // console.log(`🔧 [ADMIN] Usuario ${user.name} deteniendo scheduler`) // Log reducido;
        stopTaskAutoScheduler();
        result = {
          message: 'Scheduler detenido exitosamente',
          status: getSchedulerStatus()
        };
        break;

      case 'manual_reset':
        // console.log(`🔧 [ADMIN] Usuario ${user.name} ejecutando reinicio manual`) // Log reducido;
        await executeManualReset();
        result = {
          message: 'Reinicio manual ejecutado exitosamente',
          executedAt: new Date().toISOString(),
          status: getSchedulerStatus()
        };
        break;

      case 'status':
        result = {
          message: 'Estado del scheduler obtenido',
          status: getSchedulerStatus()
        };
        break;

      default:
        return NextResponse.json({
          error: 'Acción no válida',
          validActions: ['start', 'stop', 'manual_reset', 'status']
        }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      action,
      executedBy: user.name,
      executedAt: new Date().toISOString(),
      ...result
    });

  } catch (error) {
    console.error('Error controlando scheduler:', error);
    return NextResponse.json({
      success: false,
      error: 'Error ejecutando acción del scheduler',
      details: error instanceof Error ? error.message : 'Error desconocido'
    }, { status: 500 });
  }
}

// PUT /api/admin/scheduler - Configurar opciones del scheduler
export async function PUT(request: NextRequest) {
  try {
    const user = await verifyAdminAuth(request);
    if (!user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const body = await request.json();
    const { resetAllOverdue } = body;

    if (resetAllOverdue) {
      // console.log(`🔧 [ADMIN] Usuario ${user.name} reiniciando todas las tareas vencidas`) // Log reducido;
      
      // Obtener tareas vencidas
      const now = new Date();
      const overdueTasks = await prisma.fixedTask.findMany({
        where: {
          isActive: true,
          isCompleted: true,
          nextExecution: {
            lte: now
          }
        }
      });

      let resetCount = 0;
      const errors = [];

      for (const task of overdueTasks) {
        try {
          // Ejecutar el endpoint de cron para esta tarea específica
          const response = await fetch(`${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/cron/task-reset-scheduler`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            }
          });

          if (response.ok) {
            resetCount++;
          }
        } catch (error) {
          errors.push({
            taskId: task.id,
            title: task.title,
            error: error instanceof Error ? error.message : 'Error desconocido'
          });
        }
      }

      return NextResponse.json({
        success: true,
        action: 'reset_all_overdue',
        executedBy: user.name,
        executedAt: new Date().toISOString(),
        results: {
          totalOverdue: overdueTasks.length,
          successfulResets: resetCount,
          errors: errors.length
        },
        errors
      });
    }

    return NextResponse.json({
      error: 'Acción no implementada'
    }, { status: 400 });

  } catch (error) {
    console.error('Error configurando scheduler:', error);
    return NextResponse.json({
      success: false,
      error: 'Error configurando scheduler',
      details: error instanceof Error ? error.message : 'Error desconocido'
    }, { status: 500 });
  }
} 