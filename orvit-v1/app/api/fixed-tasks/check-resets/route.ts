import { NextRequest, NextResponse } from 'next/server';
import { prisma } from "@/lib/prisma";
import { resetCompletedTask } from '@/lib/task-scheduler';
import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';
import { JWT_SECRET } from '@/lib/auth'; // ✅ Importar el mismo secret

export const dynamic = 'force-dynamic';


const JWT_SECRET_KEY = new TextEncoder().encode(JWT_SECRET);

// Helper para obtener el usuario actual
async function getCurrentUser() {
  try {
    const token = cookies().get('token')?.value;
    if (!token) {
      console.log('⚠️ No hay token JWT, usando usuario mock para desarrollo');
      const mockUser = await prisma.user.findFirst();
      return mockUser;
    }

    const { payload } = await jwtVerify(token, JWT_SECRET_KEY);
    
    const user = await prisma.user.findUnique({
      where: { id: payload.userId as number }
    });

    return user;
  } catch (error) {
    console.error('Error obteniendo usuario:', error);
    const mockUser = await prisma.user.findFirst();
    return mockUser;
  }
}

// POST /api/fixed-tasks/check-resets
// Endpoint para verificar y reiniciar tareas cuando el usuario entra a la pestaña "Fijas"
export async function POST(request: NextRequest) {
  try {
    const session = await getCurrentUser();
    if (!session?.id) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const body = await request.json();
    const { companyId } = body;

    if (!companyId) {
      return NextResponse.json({ error: 'Company ID requerido' }, { status: 400 });
    }

    const now = new Date();
    console.log(`🔄 [MANUAL CHECK] Usuario ${session.name} verificando reinicios para empresa ${companyId}`);

    // Obtener tareas fijas completadas de la empresa que necesitan reiniciar
    const tasksNeedingReset = await prisma.fixedTask.findMany({
      where: {
        companyId: parseInt(companyId),
        isCompleted: true,
        isActive: true,
        nextExecution: {
          lte: now
        }
      },
      include: {
        company: {
          select: { name: true }
        }
      }
    });

    if (tasksNeedingReset.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No hay tareas que necesiten reiniciarse',
        tasksReset: 0,
        resetTasks: []
      });
    }

    console.log(`📋 [MANUAL CHECK] Encontradas ${tasksNeedingReset.length} tareas que necesitan reiniciar`);

    const resetResults = [];
    const errorResults = [];
    let totalReset = 0;

    // Procesar cada tarea que necesita reiniciar
    for (const task of tasksNeedingReset) {
      try {
        console.log(`🔄 [MANUAL CHECK] Reiniciando tarea: "${task.title}" (${task.frequency})`);
        
        // Calcular nueva fecha de próxima ejecución
        const resetData = resetCompletedTask(
          task.frequency,
          new Date(task.completedAt || new Date()),
          now
        );

        // Actualizar la tarea en la base de datos
        await prisma.fixedTask.update({
          where: { id: task.id },
          data: {
            isCompleted: false,
            completedAt: null,
            lastExecuted: task.completedAt,
            nextExecution: new Date(resetData.nextExecution),
            updatedAt: now
          }
        });

        const result = {
          taskId: task.id,
          title: task.title,
          frequency: task.frequency,
          previousCompletedAt: task.completedAt?.toISOString(),
          newNextExecution: resetData.nextExecution,
          resetAt: now.toISOString()
        };

        resetResults.push(result);
        totalReset++;

        console.log(`✅ [MANUAL CHECK] Tarea "${task.title}" reiniciada exitosamente`);
        console.log(`   📅 Próxima ejecución: ${resetData.nextExecution}`);

        // Crear notificación de reinicio manual
        try {
          await prisma.$executeRaw`
            INSERT INTO "Notification" (type, title, message, "userId", "companyId", metadata, "createdAt")
            VALUES (
              'TASK_MANUAL_RESET',
              'Tarea reiniciada manualmente',
              ${`La tarea fija "${task.title}" se reinició al acceder a la sección de tareas fijas.`},
              ${session.id},
              ${parseInt(companyId)},
              ${JSON.stringify({ 
                taskId: task.id, 
                frequency: task.frequency,
                resetType: 'manual',
                resetBy: session.name,
                nextExecution: resetData.nextExecution
              })},
              NOW()
            )
          `;
        } catch (notificationError) {
          console.log(`⚠️ [MANUAL CHECK] Error creando notificación para tarea ${task.id}:`, notificationError);
        }

      } catch (taskError) {
        console.error(`❌ [MANUAL CHECK] Error procesando tarea ${task.id} (${task.title}):`, taskError);
        errorResults.push({
          taskId: task.id,
          title: task.title,
          error: taskError instanceof Error ? taskError.message : 'Error desconocido'
        });
      }
    }

    const message = totalReset > 0 
      ? `${totalReset} tarea${totalReset > 1 ? 's' : ''} reiniciada${totalReset > 1 ? 's' : ''} automáticamente`
      : 'No se reiniciaron tareas';

    console.log(`🎯 [MANUAL CHECK] Proceso completado. ${totalReset} tareas reiniciadas, ${errorResults.length} errores`);

    return NextResponse.json({
      success: true,
      message,
      tasksReset: totalReset,
      tasksWithErrors: errorResults.length,
      resetTasks: resetResults,
      errors: errorResults,
      timestamp: now.toISOString()
    });

  } catch (error) {
    console.error('❌ [MANUAL CHECK] Error en verificación manual:', error);
    return NextResponse.json({
      success: false,
      error: 'Error en verificación manual de reinicios',
      details: error instanceof Error ? error.message : 'Error desconocido'
    }, { status: 500 });
  }
}

// GET /api/fixed-tasks/check-resets
// Endpoint para obtener información sobre tareas que necesitan reiniciar
export async function GET(request: NextRequest) {
  try {
    const session = await getCurrentUser();
    if (!session?.id) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get('companyId');

    if (!companyId) {
      return NextResponse.json({ error: 'Company ID requerido' }, { status: 400 });
    }

    const now = new Date();

    // Obtener tareas que necesitan reiniciar
    const tasksNeedingReset = await prisma.fixedTask.findMany({
      where: {
        companyId: parseInt(companyId),
        isCompleted: true,
        isActive: true,
        nextExecution: {
          lte: now
        }
      },
      select: {
        id: true,
        title: true,
        frequency: true,
        completedAt: true,
        nextExecution: true
      },
      orderBy: {
        nextExecution: 'asc'
      }
    });

    return NextResponse.json({
      success: true,
      tasksNeedingReset: tasksNeedingReset.length,
      tasks: tasksNeedingReset.map(task => ({
        id: task.id,
        title: task.title,
        frequency: task.frequency,
        completedAt: task.completedAt?.toISOString(),
        nextExecution: task.nextExecution.toISOString(),
        hoursOverdue: Math.ceil((now.getTime() - new Date(task.nextExecution).getTime()) / (1000 * 60 * 60))
      })),
      timestamp: now.toISOString()
    });

  } catch (error) {
    console.error('Error obteniendo tareas para reiniciar:', error);
    return NextResponse.json({
      success: false,
      error: 'Error obteniendo información de reinicios',
      details: error instanceof Error ? error.message : 'Error desconocido'
    }, { status: 500 });
  }
} 