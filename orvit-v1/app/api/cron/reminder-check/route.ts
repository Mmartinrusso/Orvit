import { NextRequest, NextResponse } from 'next/server';
import { loggers } from '@/lib/logger';

export const dynamic = 'force-dynamic';


export async function GET(request: NextRequest) {
  try {
    loggers.cron.info('Starting automatic reminder check');
    
    // Llamar al endpoint de verificación de recordatorios
    const checkResponse = await fetch(`${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/notifications/reminders-check`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (checkResponse.ok) {
      const data = await checkResponse.json();
      // console.log(`✅ CRON: Verificación de recordatorios exitosa - ${data.totalNotifications} notificaciones enviadas`) // Log reducido;
      
      return NextResponse.json({
        success: true,
        message: 'Verificación de recordatorios completada',
        ...data
      });
    } else {
      loggers.cron.error('Reminder check failed');
      return NextResponse.json(
        { error: "Error en verificación de recordatorios" },
        { status: 500 }
      );
    }
  } catch (error) {
    loggers.cron.error({ err: error }, 'Error executing reminder check');
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  // Permitir tanto GET como POST para compatibilidad con diferentes sistemas cron
  return GET(request);
} 