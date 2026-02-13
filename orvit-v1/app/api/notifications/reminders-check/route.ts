import { NextRequest, NextResponse } from 'next/server';
import { prisma } from "@/lib/prisma";

export const dynamic = 'force-dynamic';


// Helper function para crear notificaciones de recordatorios
async function createReminderNotification(
  type: 'REMINDER_OVERDUE' | 'REMINDER_DUE_SOON' | 'REMINDER_DUE_TODAY',
  userId: number,
  companyId: number,
  reminderId: string,
  title: string,
  message: string,
  extraMetadata?: any
) {
  try {
    // Verificar si la tabla Notification existe
    const notificationExists = await prisma.$queryRaw`
      SELECT COUNT(*) FROM information_schema.tables 
      WHERE table_name = 'Notification'
    ` as any[];

    if (notificationExists[0]?.count > 0) {
      const metadata = {
        reminderId,
        type: 'reminder',
        ...extraMetadata
      };

      await prisma.$executeRaw`
        INSERT INTO "Notification" (type, title, message, "userId", "companyId", metadata, "createdAt")
        VALUES (${type}, ${title}, ${message}, ${userId}, ${companyId}, ${JSON.stringify(metadata)}, NOW())
      `;
      
      console.log(`📬 Notificación ${type} enviada a usuario ${userId} para recordatorio ${reminderId}`);
    }
  } catch (error) {
    console.log('Notificaciones no disponibles, continuando sin notificación');
  }
}

export async function POST(request: NextRequest) {
  try {
    console.log('📅 Iniciando verificación de recordatorios...');
    
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    // Buscar todos los recordatorios activos (no completados)
    const activeReminders = await prisma.$queryRaw`
      SELECT r.*, u.id as userId, u."companyId"
      FROM "Reminder" r
      JOIN "User" u ON u.id = r."userId"
      WHERE r."isCompleted" = false
        AND r."dueDate" IS NOT NULL
    ` as any[];

    // console.log(`📋 Encontrados ${activeReminders.length} recordatorios activos`) // Log reducido;

    let overdueCount = 0;
    let dueTodayCount = 0;
    let dueTomorrowCount = 0;

    for (const reminder of activeReminders) {
      const dueDate = new Date(reminder.dueDate);
      const dueDateOnly = new Date(dueDate.getFullYear(), dueDate.getMonth(), dueDate.getDate());
      
      // Verificar si ya existe una notificación reciente para este recordatorio
      const existingNotification = await prisma.$queryRaw`
        SELECT COUNT(*) as count
        FROM "Notification" n
        WHERE n.metadata::text LIKE '%"reminderId":"${reminder.id}"%'
          AND n."userId" = ${reminder.userId}
          AND n."createdAt" > NOW() - INTERVAL '1 DAY'
      ` as any[];

      if (existingNotification[0]?.count > 0) {
        console.log(`⏭️ Ya existe notificación reciente para recordatorio ${reminder.id}`);
        continue;
      }

      if (dueDateOnly < today) {
        // Recordatorio vencido
        const daysOverdue = Math.floor((today.getTime() - dueDateOnly.getTime()) / (1000 * 60 * 60 * 24));
        
        await createReminderNotification(
          'REMINDER_OVERDUE',
          reminder.userId,
          reminder.companyId,
          reminder.id,
          'Recordatorio vencido',
          `El recordatorio "${reminder.title}" está vencido desde hace ${daysOverdue} día${daysOverdue > 1 ? 's' : ''}`,
          {
            daysOverdue,
            priority: reminder.priority || 'media',
            contactName: reminder.contactName
          }
        );
        
        overdueCount++;
      } else if (dueDateOnly.getTime() === today.getTime()) {
        // Recordatorio vence hoy
        await createReminderNotification(
          'REMINDER_DUE_TODAY',
          reminder.userId,
          reminder.companyId,
          reminder.id,
          'Recordatorio para hoy',
          `El recordatorio "${reminder.title}" vence hoy`,
          {
            priority: reminder.priority || 'media',
            contactName: reminder.contactName
          }
        );
        
        dueTodayCount++;
      } else if (dueDateOnly.getTime() === tomorrow.getTime()) {
        // Recordatorio vence mañana
        await createReminderNotification(
          'REMINDER_DUE_SOON',
          reminder.userId,
          reminder.companyId,
          reminder.id,
          'Recordatorio para mañana',
          `El recordatorio "${reminder.title}" vence mañana`,
          {
            priority: reminder.priority || 'media',
            contactName: reminder.contactName
          }
        );
        
        dueTomorrowCount++;
      }
    }

    console.log(`📅 Verificación de recordatorios completada:
      - Recordatorios vencidos: ${overdueCount}
      - Recordatorios para hoy: ${dueTodayCount}
      - Recordatorios para mañana: ${dueTomorrowCount}
      - Total notificaciones enviadas: ${overdueCount + dueTodayCount + dueTomorrowCount}`);

    return NextResponse.json({
      success: true,
      overdueCount,
      dueTodayCount,
      dueTomorrowCount,
      totalNotifications: overdueCount + dueTodayCount + dueTomorrowCount,
      timestamp: now.toISOString(),
    });

  } catch (error) {
    console.error('❌ Error verificando recordatorios:', error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
} 