import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { resetCompletedTask, shouldTaskReset } from '@/lib/task-scheduler';

export const dynamic = 'force-dynamic';

// POST /api/fixed-tasks/auto-reset
export async function POST(request: NextRequest) {
  try {
    console.log('🔄 Ejecutando verificación automática de reinicios de tareas...');

    // Obtener todas las tareas fijas completadas
    const completedTasks = await prisma.fixedTask.findMany({
      where: {
        isCompleted: true,
        isActive: true
      }
    });

    // console.log(`📋 Encontradas ${completedTasks.length} tareas completadas para verificar`) // Log reducido;

    const resetTasks = [];
    const now = new Date();

    for (const task of completedTasks) {
      // Verificar si la tarea debe reiniciarse
      const shouldReset = now >= new Date(task.nextExecution);
      
      if (shouldReset) {
        console.log(`🔄 Reiniciando tarea: ${task.title}`);
        
        try {
          // Calcular datos del reinicio
          const resetData = resetCompletedTask(
            task.frequency as any,
            new Date(task.completedAt || new Date())
          );

          // Actualizar la tarea en la base de datos
          const updatedTask = await prisma.fixedTask.update({
            where: { id: task.id },
            data: {
              isCompleted: false,
              completedAt: null,
              lastExecuted: task.completedAt,
              nextExecution: new Date(resetData.nextExecution),
              updatedAt: new Date()
            }
          });

          resetTasks.push({
            id: task.id,
            title: task.title,
            frequency: task.frequency,
            nextExecution: resetData.nextExecution,
            previousCompletedAt: task.completedAt
          });

          // console.log(`✅ Tarea reiniciada: ${task.title} - Próxima ejecución: ${resetData.nextExecution}`) // Log reducido;

        } catch (error) {
          console.error(`❌ Error reiniciando tarea ${task.title}:`, error);
        }
      }
    }

    // console.log(`✅ Verificación completada. ${resetTasks.length} tareas reiniciadas automáticamente.`) // Log reducido;

    return NextResponse.json({
      success: true,
      message: `Verificación automática completada. ${resetTasks.length} tareas reiniciadas.`,
      tasksReset: resetTasks.length,
      resetTasks: resetTasks,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Error en verificación automática de reinicios:', error);
    return NextResponse.json(
      { error: 'Error en verificación automática', details: error },
      { status: 500 }
    );
  }
}

// GET /api/fixed-tasks/auto-reset - Para verificar el estado
export async function GET(request: NextRequest) {
  try {
    const completedTasks = await prisma.fixedTask.findMany({
      where: {
        isCompleted: true,
        isActive: true
      },
      select: {
        id: true,
        title: true,
        frequency: true,
        completedAt: true,
        nextExecution: true
      }
    });

    const now = new Date();
    const tasksNeedingReset = completedTasks.filter(task => 
      now >= new Date(task.nextExecution)
    );

    return NextResponse.json({
      success: true,
      totalCompletedTasks: completedTasks.length,
      tasksNeedingReset: tasksNeedingReset.length,
      tasks: tasksNeedingReset,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error obteniendo estado de reinicios:', error);
    return NextResponse.json(
      { error: 'Error obteniendo estado', details: error },
      { status: 500 }
    );
  }
} 