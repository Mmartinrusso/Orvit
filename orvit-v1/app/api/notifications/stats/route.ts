import { NextRequest, NextResponse } from 'next/server';
import { getConnectionStats, cleanupDeadConnections } from '@/lib/instant-notifications';
import { getScheduledJobsStats, cleanupExpiredJobs } from '@/lib/reminder-scheduler';
import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';
import { prisma } from "@/lib/prisma";
import { JWT_SECRET } from '@/lib/auth'; // ✅ Importar el mismo secret

export const dynamic = 'force-dynamic';


const JWT_SECRET_KEY = new TextEncoder().encode(JWT_SECRET);

// Helper function para obtener usuario desde JWT
async function getUserFromToken(request: NextRequest) {
  try {
    const token = cookies().get('token')?.value;
    
    if (!token) {
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

export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromToken(request);
    
    if (!user) {
      return NextResponse.json(
        { error: 'No autorizado' },
        { status: 401 }
      );
    }

    // Solo permitir a administradores
    if (user.role !== 'ADMIN' && user.role !== 'SUPERADMIN') {
      return NextResponse.json(
        { error: 'Acceso denegado - Solo administradores' },
        { status: 403 }
      );
    }

    // Obtener estadísticas de conexiones SSE
    const connectionStats = getConnectionStats();
    
    // Obtener estadísticas de jobs programados
    const jobStats = getScheduledJobsStats();
    
    // Limpiar conexiones y jobs expirados
    const cleanedConnections = cleanupDeadConnections();
    const cleanedJobs = cleanupExpiredJobs();

    // Obtener estadísticas de notificaciones de la BD
    let dbStats = {
      totalNotifications: 0,
      unreadNotifications: 0,
      notificationsByType: {},
      recentNotifications: 0
    };

    try {
      const dbStatsResult = await prisma.$queryRaw`
        SELECT 
          COUNT(*) as total,
          COUNT(CASE WHEN "readAt" IS NULL THEN 1 END) as unread,
          COUNT(CASE WHEN "createdAt" > NOW() - INTERVAL '24 hours' THEN 1 END) as recent
        FROM "Notification"
      ` as any[];

      if (dbStatsResult.length > 0) {
        dbStats.totalNotifications = parseInt(dbStatsResult[0].total);
        dbStats.unreadNotifications = parseInt(dbStatsResult[0].unread);
        dbStats.recentNotifications = parseInt(dbStatsResult[0].recent);
      }

      // Obtener distribución por tipo
      const typeStatsResult = await prisma.$queryRaw`
        SELECT type, COUNT(*) as count
        FROM "Notification"
        WHERE "createdAt" > NOW() - INTERVAL '7 days'
        GROUP BY type
        ORDER BY count DESC
      ` as any[];

      dbStats.notificationsByType = typeStatsResult.reduce((acc: any, row: any) => {
        acc[row.type] = parseInt(row.count);
        return acc;
      }, {});

    } catch (error) {
      console.log('Tabla Notification no disponible');
    }

    const stats = {
      timestamp: new Date().toISOString(),
      server: {
        status: 'running',
        uptime: process.uptime(),
        nodeVersion: process.version
      },
      sse: {
        activeConnections: connectionStats.totalConnections,
        connectedUsers: connectionStats.userIds,
        companies: connectionStats.companies,
        cleanedConnections
      },
      scheduledJobs: {
        totalJobs: jobStats.totalJobs,
        jobsByType: jobStats.jobsByType,
        upcomingJobs: jobStats.jobs.filter(job => job.timeUntilExecution > 0).length,
        overdueJobs: jobStats.jobs.filter(job => job.timeUntilExecution < 0).length,
        cleanedJobs
      },
      database: dbStats,
      system: {
        instantNotifications: 'active',
        pollingRemoved: true,
        webhookStyle: true
      }
    };

    return NextResponse.json({
      success: true,
      stats
    });

  } catch (error) {
    console.error('Error obteniendo estadísticas:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromToken(request);
    
    if (!user) {
      return NextResponse.json(
        { error: 'No autorizado' },
        { status: 401 }
      );
    }

    // Solo permitir a administradores
    if (user.role !== 'ADMIN' && user.role !== 'SUPERADMIN') {
      return NextResponse.json(
        { error: 'Acceso denegado - Solo administradores' },
        { status: 403 }
      );
    }

    const { action } = await request.json();

    let result = {};

    switch (action) {
      case 'cleanup':
        const cleanedConnections = cleanupDeadConnections();
        const cleanedJobs = cleanupExpiredJobs();
        result = {
          message: 'Limpieza completada',
          cleanedConnections,
          cleanedJobs
        };
        break;

      case 'test_notification':
        // Enviar notificación de prueba al admin
        const { createAndSendInstantNotification } = await import('@/lib/instant-notifications');
        
        // Obtener companyId del usuario
        const userWithCompany = await prisma.user.findUnique({
          where: { id: user.id },
          include: {
            companies: { include: { company: true } },
            ownedCompanies: true
          }
        });

        let companyId: number | null = null;
        if (userWithCompany?.ownedCompanies?.[0]) {
          companyId = userWithCompany.ownedCompanies[0].id;
        } else if (userWithCompany?.companies?.[0]) {
          companyId = userWithCompany.companies[0].company.id;
        }

        if (companyId) {
          await createAndSendInstantNotification(
            'TASK_ASSIGNED', // Tipo de prueba
            user.id,
            companyId,
            null,
            null,
            'Notificación de Prueba',
            'Esta es una prueba del sistema de notificaciones instantáneas',
            'medium',
            {
              testMessage: true,
              timestamp: new Date().toISOString(),
              sentBy: 'admin'
            }
          );
          result = { message: 'Notificación de prueba enviada' };
        } else {
          result = { error: 'No se pudo encontrar companyId para el usuario' };
        }
        break;

      default:
        return NextResponse.json(
          { error: 'Acción no válida' },
          { status: 400 }
        );
    }

    return NextResponse.json({
      success: true,
      result
    });

  } catch (error) {
    console.error('Error ejecutando acción:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
} 