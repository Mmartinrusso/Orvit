import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';


// POST /api/cron/task-due-check - Cron job para verificar tareas próximas a vencer
export async function POST(request: NextRequest) {
  try {
    console.log('⏰ Ejecutando cron job: verificación de tareas próximas a vencer');

    // Ejecutar la verificación de tareas próximas a vencer
    const checkResponse = await fetch(`${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/tasks/check-overdue`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!checkResponse.ok) {
      throw new Error(`Error en verificación: ${checkResponse.status}`);
    }

    const result = await checkResponse.json();

    console.log('✅ Cron job completado:', {
      tasksDueTomorrow: result.tasksDueTomorrow,
      tasksDueToday: result.tasksDueToday,
      notificationsSent: result.notificationsSent,
      timestamp: result.timestamp
    });

    return NextResponse.json({
      success: true,
      message: 'Cron job ejecutado exitosamente',
      result: result,
      executedAt: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Error en cron job de verificación de tareas:', error);
    return NextResponse.json(
      { 
        error: 'Error en cron job', 
        details: error instanceof Error ? error.message : 'Error desconocido',
        executedAt: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}

// GET /api/cron/task-due-check - Para testing manual
export async function GET(request: NextRequest) {
  return POST(request);
} 