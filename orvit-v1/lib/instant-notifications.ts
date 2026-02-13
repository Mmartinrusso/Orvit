import { prisma } from "@/lib/prisma";
import { NotificationType } from "@prisma/client";

// Helper para mapear strings a valores válidos del enum NotificationType
function mapToValidNotificationType(type: string): NotificationType {
  const typeMap: { [key: string]: NotificationType } = {
    // Notificaciones de tareas
    'TASK_ASSIGNED': 'task_assigned',
    'TASK_OVERDUE': 'task_overdue',
    'TASK_UPDATED': 'task_updated',
    'TASK_DELETED': 'task_deleted',
    'TASK_COMPLETED': 'task_completed',
    'TASK_DUE_SOON': 'task_due_soon',
    'TASK_DUE_TODAY': 'task_due_soon',
    'TASK_AUTO_RESET': 'task_auto_reset',
    'TASK_COMMENTED': 'task_commented',
    
    // Notificaciones de órdenes de trabajo
    'WORK_ORDER_ASSIGNED': 'work_order_assigned',
    'WORK_ORDER_OVERDUE': 'work_order_overdue',
    'WORK_ORDER_DUE_SOON': 'work_order_due_soon',
    
    // Notificaciones de inventario
    'STOCK_LOW': 'stock_low',
    'STOCK_OUT': 'stock_out',
    
    // Notificaciones de recordatorios
    'REMINDER_OVERDUE': 'reminder_overdue',
    'REMINDER_DUE_TODAY': 'reminder_due_today',
    'REMINDER_DUE_SOON': 'reminder_due_soon',
    
    // Notificaciones de herramientas
    'TOOL_REQUEST_NEW': 'tool_request_new',
    'TOOL_REQUEST_APPROVED': 'tool_request_approved',
    'TOOL_REQUEST_REJECTED': 'tool_request_rejected',
    
    // Notificaciones del sistema
    'MAINTENANCE_DUE': 'maintenance_due',
    'SYSTEM_ALERT': 'system_alert',

    // Notificaciones de ventas
    'INVOICE_DUE_SOON': 'invoice_due_soon',
    'INVOICE_OVERDUE': 'invoice_overdue',
    'CHEQUE_DUE_SOON': 'cheque_due_soon',
    'CHEQUE_OVERDUE': 'cheque_overdue',
    'QUOTE_EXPIRING': 'quote_expiring',
    'PAYMENT_RECEIVED': 'payment_received',

    // Fallbacks para compatibilidad
    'USER_CREATED': 'system_alert',
    'USER_UPDATED': 'system_alert',
    'USER_DELETED': 'system_alert',
  };
  
  return typeMap[type.toUpperCase()] || 'system_alert';
}

// Store active SSE connections
const activeConnections = new Map<number, {
  controller: ReadableStreamDefaultController;
  userId: number;
  companyId: number;
}>();

// Función para registrar una conexión SSE
export function registerSSEConnection(userId: number, companyId: number, controller: ReadableStreamDefaultController) {
  activeConnections.set(userId, {
    controller,
    userId,
    companyId
  });
  // console.log(`🔗 Usuario ${userId} conectado al SSE`) // Log reducido;
}

// Función para desregistrar una conexión SSE
export function unregisterSSEConnection(userId: number) {
  activeConnections.delete(userId);
  console.log(`🔌 Usuario ${userId} desconectado del SSE`);
}

// Función para enviar notificación instantánea a un usuario específico
export function sendInstantNotification(userId: number, notification: any) {
  const connection = activeConnections.get(userId);
  if (connection) {
    try {
      const data = JSON.stringify({
        type: 'notification',
        data: notification,
        timestamp: new Date().toISOString()
      });
      connection.controller.enqueue(`data: ${data}\n\n`);
      console.log(`📱 Notificación instantánea enviada a usuario ${userId}: ${notification.title}`);
      return true;
    } catch (error) {
      console.error(`Error enviando notificación instantánea a ${userId}:`, error);
      activeConnections.delete(userId);
      return false;
    }
  }
  return false;
}

// Función para broadcast a todos los usuarios de una empresa
export function broadcastToCompany(companyId: number, notification: any) {
  let sent = 0;
  for (const [userId, connection] of Array.from(activeConnections.entries())) {
    if (connection.companyId === companyId) {
      if (sendInstantNotification(userId, notification)) {
        sent++;
      }
    }
  }
  console.log(`📢 Broadcast enviado a ${sent} usuarios de empresa ${companyId}`);
  return sent;
}

// Función para crear notificación instantánea completa
export async function createAndSendInstantNotification(
  type: string,
  userId: number,
  companyId: number,
  taskId: number | null,
  reminderId: string | null,
  title: string,
  message: string,
  priority: 'low' | 'medium' | 'high' | 'urgent' = 'medium',
  extraMetadata?: any
) {
  // Removido el bloqueo de notificaciones de stock bajo
  try {
    // 1. Verificar si existe la tabla de notificaciones
    let dbNotificationId = null;
    try {
      // Intentar crear la notificación en la base de datos
      const metadata = {
        taskId,
        reminderId,
        type: taskId ? 'task' : 'reminder',
        ...extraMetadata
      };

      const dbNotification = await prisma.notification.create({
        data: {
          type: mapToValidNotificationType(type),
          title,
          message,
          userId,
          companyId,
          metadata: metadata as any, // Prisma manejará la serialización JSON
        }
      });
      
      dbNotificationId = dbNotification.id;
      console.log(`💾 Notificación guardada en BD con ID: ${dbNotificationId}`);
    } catch (dbError) {
      console.log('⚠️ No se pudo guardar en BD (tabla posiblemente no existe):', dbError instanceof Error ? dbError.message : 'Error desconocido');
    }

    // 2. Preparar objeto de notificación
    const notification = {
      id: dbNotificationId?.toString() || `temp_${Date.now()}`,
      type: type.toLowerCase(),
      title,
      message,
      priority,
      taskId,
      reminderId,
      timestamp: new Date(),
      read: false,
      userId,
      relatedData: extraMetadata
    };

    // 3. Enviar instantáneamente por SSE
    const sent = sendInstantNotification(userId, notification);
    
    console.log(`🚀 Notificación ${type} procesada: BD=${!!dbNotificationId}, SSE=${sent}`);
    
    return {
      success: true,
      dbSaved: !!dbNotificationId,
      sseSent: sent,
      notificationId: dbNotificationId
    };

  } catch (error) {
    console.error('Error creando notificación instantánea:', error);
    return {
      success: false,
      dbSaved: false,
      sseSent: false,
      error: error
    };
  }
}

// Función para obtener estadísticas de conexiones
export function getConnectionStats() {
  return {
    totalConnections: activeConnections.size,
    userIds: Array.from(activeConnections.keys()),
    companies: Array.from(new Set(Array.from(activeConnections.values()).map(c => c.companyId)))
  };
}

// Función para limpiar conexiones muertas
export function cleanupDeadConnections() {
  const deadConnections: number[] = [];
  
  for (const [userId, connection] of Array.from(activeConnections.entries())) {
    try {
      // Intentar enviar un ping
      connection.controller.enqueue(`data: ${JSON.stringify({
        type: 'ping',
        timestamp: new Date().toISOString()
      })}\n\n`);
    } catch (error) {
      deadConnections.push(userId);
    }
  }
  
  deadConnections.forEach(userId => {
    activeConnections.delete(userId);
  });
  
  if (deadConnections.length > 0) {
    console.log(`🧹 Limpiadas ${deadConnections.length} conexiones muertas`);
  }
  
  return deadConnections.length;
} 