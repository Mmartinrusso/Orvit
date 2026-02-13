import { NextRequest, NextResponse } from 'next/server';
import { prisma } from "@/lib/prisma";
import { Priority } from '@prisma/client';
import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';
import { JWT_SECRET } from '@/lib/auth'; // ✅ Importar el mismo secret

export const dynamic = 'force-dynamic';

// Caché en memoria para notificaciones (30 segundos TTL)
const notificationsCache = new Map<string, { data: any; timestamp: number }>();
const NOTIFICATIONS_CACHE_TTL = 30 * 1000; // 30 segundos


const JWT_SECRET_KEY = new TextEncoder().encode(JWT_SECRET);

// Helper function para obtener usuario desde JWT (optimizado)
async function getUserFromToken(request: NextRequest) {
  try {
    const token = cookies().get('token')?.value;
    
    if (!token) {
      return null;
    }

    const { payload } = await jwtVerify(token, JWT_SECRET_KEY);
    
    // Optimización: Solo obtener datos necesarios
    const user = await prisma.user.findUnique({
      where: { id: payload.userId as number },
      select: {
        id: true,
        companies: {
          select: {
            companyId: true
          },
          take: 1
        },
        ownedCompanies: {
          select: {
            id: true
          },
          take: 1
        }
      }
    });

    return user;
  } catch (error) {
    console.error('Error obteniendo usuario desde JWT:', error);
    return null;
  }
}

// Helper para obtener companyId del usuario
function getUserCompanyId(user: any): number | null {
  if (user.ownedCompanies && user.ownedCompanies.length > 0) {
    return user.ownedCompanies[0].id;
  } else if (user.companies && user.companies.length > 0) {
    return user.companies[0].companyId;
  }
  return null;
}

// GET /api/notifications - Obtener notificaciones del usuario
export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromToken(request);
    if (!user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const companyId = getUserCompanyId(user);
    if (!companyId) {
      return NextResponse.json({ error: "Usuario sin empresa" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');
    const unreadOnly = searchParams.get('unreadOnly') === 'true';
    const type = searchParams.get('type');

    // Generar clave de caché (solo para lectura completa, no para filtros complejos)
    const cacheKey = `notifications-${user.id}-${companyId}-${limit}-${offset}-${unreadOnly}-${type || ''}`;
    if (!type && !unreadOnly) {
      const cached = notificationsCache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < NOTIFICATIONS_CACHE_TTL) {
        return NextResponse.json(cached.data, {
          headers: {
            'Cache-Control': 'private, max-age=30',
            'X-Cache': 'HIT'
          }
        });
      }
    }

    // Construir filtros de manera segura
    const whereConditions: any = {
      userId: user.id,
      companyId: companyId
    };
    
    if (unreadOnly) {
      whereConditions.readAt = null;
    }
    
    if (type) {
      whereConditions.type = type;
    }

    // Verificar si la tabla existe
    try {
      await prisma.$queryRaw`SELECT 1 FROM "Notification" LIMIT 1`;
    } catch (error) {
      // Si la tabla no existe, devolver respuesta vacía
      const emptyResponse = {
        success: true,
        notifications: [],
        unreadCount: 0,
        hasMore: false
      };
      return NextResponse.json(emptyResponse, {
        headers: {
          'Cache-Control': 'private, max-age=30'
        }
      });
    }

    // ✅ OPTIMIZADO: Ejecutar queries en paralelo
    const [notifications, unreadCount] = await Promise.all([
      // Obtener notificaciones - Optimizado con límite más estricto
      prisma.notification.findMany({
        where: whereConditions,
        orderBy: { createdAt: 'desc' },
        take: Math.min(limit, 50), // Limitar a máximo 50
        skip: offset,
        select: {
          id: true,
          type: true,
          title: true,
          message: true,
          createdAt: true,
          readAt: true,
          userId: true,
          metadata: true
        }
      }),
      // Obtener conteo de no leídas
      prisma.notification.count({
        where: {
          userId: user.id,
          companyId: companyId,
          readAt: null
        }
      })
    ]);

    const formattedNotifications = notifications.map((n: any) => ({
      id: n.id.toString(),
      type: mapNotificationType(n.type),
      title: n.title,
      message: n.message,
      priority: getPriorityFromType(n.type),
      timestamp: new Date(n.createdAt),
      read: n.readAt !== null,
      userId: n.userId,
      taskId: n.metadata?.taskId,
      relatedData: null // Se puede expandir más tarde
    }));

    // Verificar si hay más resultados
    const hasMore = notifications.length === limit;

    const response = {
      success: true,
      notifications: formattedNotifications,
      unreadCount: unreadCount,
      hasMore
    };

    // Guardar en caché solo para lecturas completas
    if (!type && !unreadOnly) {
      notificationsCache.set(cacheKey, {
        data: response,
        timestamp: Date.now()
      });

      // Limpiar caché antiguo
      if (notificationsCache.size > 100) {
        const now = Date.now();
        for (const [key, value] of notificationsCache.entries()) {
          if (now - value.timestamp > NOTIFICATIONS_CACHE_TTL) {
            notificationsCache.delete(key);
          }
        }
      }
    }

    return NextResponse.json(response, {
      headers: {
        'Cache-Control': 'private, max-age=30',
        'X-Cache': (!type && !unreadOnly) ? 'MISS' : 'BYPASS'
      }
    });

  } catch (error) {
    console.error('❌ [Notifications] Error obteniendo notificaciones:', error);
    
    // Si es un error de tabla no existe, devolver respuesta vacía
    if (error instanceof Error && error.message.includes('does not exist')) {
      return NextResponse.json({
        success: true,
        notifications: [],
        unreadCount: 0,
        hasMore: false
      });
    }
    
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}

// PUT /api/notifications - Marcar como leída(s)
export async function PUT(request: NextRequest) {
  try {
    const user = await getUserFromToken(request);
    if (!user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const companyId = getUserCompanyId(user);
    if (!companyId) {
      return NextResponse.json({ error: "Usuario sin empresa" }, { status: 401 });
    }

    const body = await request.json();
    const { notificationId, markAll } = body;

    if (markAll) {
      // Marcar todas como leídas
      await prisma.$executeRaw`
        UPDATE "Notification" 
        SET "readAt" = NOW()
        WHERE "userId" = ${user.id} 
          AND "companyId" = ${companyId}
          AND "readAt" IS NULL
      `;
    } else if (notificationId) {
      // Marcar una específica como leída
      await prisma.$executeRaw`
        UPDATE "Notification" 
        SET "readAt" = NOW()
        WHERE id = ${parseInt(notificationId)}
          AND "userId" = ${user.id} 
          AND "companyId" = ${companyId}
      `;
    }

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('Error marcando notificaciones:', error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}

// DELETE /api/notifications - Eliminar notificación
export async function DELETE(request: NextRequest) {
  try {
    const user = await getUserFromToken(request);
    if (!user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const companyId = getUserCompanyId(user);
    if (!companyId) {
      return NextResponse.json({ error: "Usuario sin empresa" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const notificationId = searchParams.get('id');

    if (!notificationId) {
      return NextResponse.json({ error: "ID de notificación requerido" }, { status: 400 });
    }

    await prisma.$executeRaw`
      DELETE FROM "Notification" 
      WHERE id = ${parseInt(notificationId)}
        AND "userId" = ${user.id} 
        AND "companyId" = ${companyId}
    `;

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('Error eliminando notificación:', error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}

// POST /api/notifications - Crear notificación
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { type } = body;
    
    // Removido el bloqueo de notificaciones de stock bajo
    const user = await getUserFromToken(request);
    if (!user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const companyId = getUserCompanyId(user);
    if (!companyId) {
      return NextResponse.json({ error: "Usuario sin empresa" }, { status: 401 });
    }

    const { title, message, metadata } = body;

    if (!title || !message) {
      return NextResponse.json({ error: "Título y mensaje son requeridos" }, { status: 400 });
    }

    const notification = await prisma.notification.create({
      data: {
        userId: user.id,
        companyId: companyId,
        type: type,
        title: title,
        message: message,
        priority: getPriorityFromType(type).toUpperCase() as Priority,
        metadata: metadata,
        readAt: null
      }
    });

    return NextResponse.json({ success: true, notification: notification });

  } catch (error) {
    console.error('Error creando notificación:', error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}

// Helper functions
function mapNotificationType(dbType: string): string {
  const typeMap: { [key: string]: string } = {
    // Notificaciones de tareas
    'task_assigned': 'task_assigned',
    'task_overdue': 'task_overdue',
    'task_updated': 'task_updated',
    'task_deleted': 'task_deleted',
    'task_completed': 'task_completed',
    'task_due_soon': 'task_due_soon',
    'task_auto_reset': 'task_auto_reset',
    'task_commented': 'task_commented',
    
    // Notificaciones de órdenes de trabajo
    'work_order_assigned': 'work_order_assigned',
    'work_order_overdue': 'work_order_overdue',
    'work_order_due_soon': 'work_order_due_soon',
    
    // Notificaciones de inventario
    'stock_low': 'stock_low',
    'stock_out': 'stock_out',
    
    // Notificaciones de recordatorios
    'reminder_overdue': 'reminder_overdue',
    'reminder_due_today': 'reminder_due_today',
    'reminder_due_soon': 'reminder_due_soon',
    
    // Notificaciones de herramientas
    'tool_request_new': 'tool_request_new',
    'tool_request_approved': 'tool_request_approved',
    'tool_request_rejected': 'tool_request_rejected',
    
    // Sistema
    'maintenance_due': 'maintenance_due',
    'system_alert': 'system_alert',

    // Ventas
    'invoice_due_soon': 'invoice_due_soon',
    'invoice_overdue': 'invoice_overdue',
    'cheque_due_soon': 'cheque_due_soon',
    'cheque_overdue': 'cheque_overdue',
    'quote_expiring': 'quote_expiring',
    'payment_received': 'payment_received',

    // Compatibilidad con nombres antiguos
    'TASK_OVERDUE': 'task_overdue',
    'DEADLINE_APPROACHING': 'task_due_soon',
    'TASK_ASSIGNED': 'task_assigned',
    'TASK_COMPLETED': 'task_completed',
    'TASK_UPDATED': 'task_updated',
    'TASK_DELETED': 'task_deleted',
    'TASK_AUTO_RESET': 'task_auto_reset',
    'WORK_ORDER_OVERDUE': 'work_order_overdue',
    'WORK_ORDER_ASSIGNED': 'work_order_assigned',
    'WORK_ORDER_DUE_SOON': 'work_order_due_soon',
    'STOCK_LOW': 'stock_low',
    'STOCK_OUT': 'stock_out',
    'SYSTEM_ALERT': 'system_alert'
  };
  
  return typeMap[dbType] || 'system_alert';
}

function getPriorityFromType(type: string): 'low' | 'medium' | 'high' | 'urgent' {
  const priorityMap: { [key: string]: 'low' | 'medium' | 'high' | 'urgent' } = {
    // Notificaciones de tareas
    'task_assigned': 'medium',
    'task_overdue': 'urgent',
    'task_updated': 'medium',
    'task_deleted': 'high',
    'task_completed': 'low',
    'task_due_soon': 'high',
    'task_auto_reset': 'low',
    'task_commented': 'medium',
    
    // Notificaciones de órdenes de trabajo
    'work_order_assigned': 'medium',
    'work_order_overdue': 'urgent',
    'work_order_due_soon': 'high',
    
    // Notificaciones de inventario
    'stock_low': 'high',
    'stock_out': 'urgent',
    
    // Notificaciones de recordatorios
    'reminder_overdue': 'urgent',
    'reminder_due_today': 'high',
    'reminder_due_soon': 'medium',
    
    // Notificaciones de herramientas
    'tool_request_new': 'medium',
    'tool_request_approved': 'low',
    'tool_request_rejected': 'medium',
    
    // Sistema
    'maintenance_due': 'high',
    'system_alert': 'medium',

    // Ventas
    'invoice_due_soon': 'medium',
    'invoice_overdue': 'high',
    'cheque_due_soon': 'high',
    'cheque_overdue': 'urgent',
    'quote_expiring': 'medium',
    'payment_received': 'low',

    // Compatibilidad con nombres antiguos
    'TASK_OVERDUE': 'urgent',
    'DEADLINE_APPROACHING': 'high',
    'TASK_ASSIGNED': 'medium',
    'TASK_COMPLETED': 'low',
    'TASK_UPDATED': 'medium',
    'TASK_DELETED': 'high',
    'TASK_AUTO_RESET': 'low',
    'WORK_ORDER_OVERDUE': 'urgent',
    'WORK_ORDER_ASSIGNED': 'medium',
    'WORK_ORDER_DUE_SOON': 'high',
    'STOCK_LOW': 'high',
    'STOCK_OUT': 'urgent',
    'SYSTEM_ALERT': 'medium'
  };
  
  return priorityMap[type] || 'medium';
} 