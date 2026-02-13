import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { sendInstantNotification } from '@/lib/instant-notifications';

export const dynamic = 'force-dynamic';

// Cache temporal para evitar múltiples verificaciones en corto tiempo
const stockCheckCache = new Map<string, number>();
const CACHE_DURATION = 10 * 60 * 1000; // 10 minutos (aumentado)

// POST /api/notifications/stock-check - REACTIVADO CON LÓGICA CORRECTA
export async function POST(request: NextRequest) {
  console.log('🔍 [STOCK CHECK] Iniciando verificación de stock...');
  
  // Verificar cache para evitar ejecuciones múltiples
  const cacheKey = 'stock_check_last_run';
  const lastRun = stockCheckCache.get(cacheKey);
  const now = Date.now();
  
  if (lastRun && (now - lastRun) < CACHE_DURATION) {
    console.log('⏭️ [STOCK CHECK] Cache activo, saltando verificación');
    return NextResponse.json({
      success: true,
      message: 'Verificación reciente, usando cache',
      notificationsSent: 0,
      cached: true
    });
  }
  
  // Actualizar cache
  stockCheckCache.set(cacheKey, now);

  try {
    const body = await request.json();
    const { companyId, toolId } = body;

    if (!companyId) {
      return NextResponse.json(
        { error: 'Company ID es requerido' },
        { status: 400 }
      );
    }

    // Si se proporciona toolId, verificar solo esa herramienta
    // Si no, verificar todas las herramientas de la empresa
    let tools: any[] = [];
    
    if (toolId) {
      const tool = await prisma.tool.findUnique({
        where: { id: parseInt(toolId) },
        include: {
          company: true
        }
      });
      if (tool && tool.companyId === parseInt(companyId)) {
        tools = [tool];
      }
    } else {
      tools = await prisma.tool.findMany({
        where: { companyId: parseInt(companyId) },
        include: {
          company: true
        }
      });
    }

    // Obtener usuarios de la empresa para notificar
    const users = await prisma.userOnCompany.findMany({
      where: { companyId: parseInt(companyId) },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true
          }
        }
      }
    });

    // Filtrar usuarios por roles
    const pañoleros = users.filter(uc => 
      uc.user.role === 'ADMIN' || 
      uc.user.role === 'SUPERADMIN'
    );
    
    const encargadosCompras = users.filter(uc => 
      uc.user.role === 'ADMIN' || 
      uc.user.role === 'SUPERADMIN'
    );

    const notificationsSent = [];

    // PROTECCIÓN 2: Solo procesar notificaciones de stock bajo, NO de sin stock
    const lowStockTools = tools.filter(tool => {
      const isOutOfStock = tool.stockQuantity === 0;
      const isLowStock = tool.stockQuantity > 0 && tool.stockQuantity <= tool.minStockLevel;
      return isLowStock && !isOutOfStock;
    });

    // Si hay herramientas con stock bajo, crear una sola notificación general
    if (lowStockTools.length > 0) {
      const notificationType = 'stock_low';
      const recipients = [...pañoleros, ...encargadosCompras];
      
      for (const userCompany of recipients) {
        try {
          // PROTECCIÓN 3: Verificar que no exista una notificación reciente de stock bajo general
          const existingNotification = await prisma.notification.findFirst({
            where: {
              userId: userCompany.user.id,
              type: notificationType,
              // Buscar notificación general (sin toolId específico)
              metadata: {
                path: ['isGeneralStockAlert'],
                equals: true
              },
              // Solo considerar notificaciones de las últimas 24 horas
              createdAt: {
                gte: new Date(Date.now() - 24 * 60 * 60 * 1000)
              }
            }
          });

          // Si ya existe una notificación reciente general, NO crear otra
          if (existingNotification) {
            console.log(`⏭️ [STOCK CHECK] Notificación general ya existe para usuario ${userCompany.user.id}, omitiendo`);
            continue;
          }

          // PROTECCIÓN 4: Verificar que no haya demasiadas notificaciones recientes del mismo tipo
          const recentNotificationsCount = await prisma.notification.count({
            where: {
              userId: userCompany.user.id,
              type: notificationType,
              createdAt: {
                gte: new Date(Date.now() - 60 * 60 * 1000) // Última hora
              }
            }
          });

          if (recentNotificationsCount >= 3) {
            console.log(`⏭️ [STOCK CHECK] Demasiadas notificaciones recientes para usuario ${userCompany.user.id}, omitiendo`);
            continue;
          }

          // Crear una sola notificación general con todas las herramientas con stock bajo
          const toolsList = lowStockTools.map(tool => 
            `${tool.name} (${tool.stockQuantity} unidades)`
          ).join(', ');

          const notificationData = {
            type: notificationType,
            title: 'Stock Bajo - Múltiples Productos',
            message: `${lowStockTools.length} producto${lowStockTools.length > 1 ? 's' : ''} con stock bajo: ${toolsList}`,
            userId: userCompany.user.id,
            companyId: parseInt(companyId),
            priority: 'HIGH',
            metadata: {
              isGeneralStockAlert: true,
              lowStockToolsCount: lowStockTools.length,
              lowStockTools: lowStockTools.map(tool => ({
                id: tool.id,
                name: tool.name,
                stockQuantity: tool.stockQuantity,
                minStockLevel: tool.minStockLevel
              })),
              companyId: parseInt(companyId),
              notificationDate: new Date().toISOString()
            }
          };

          const notification = await prisma.notification.create({
            data: notificationData
          });

          // Enviar notificación SSE en tiempo real
          const sseNotification = {
            id: notification.id.toString(),
            type: 'stock_low',
            title: notificationData.title,
            message: notificationData.message,
            priority: 'high',
            timestamp: new Date(),
            read: false,
            userId: userCompany.user.id,
            relatedData: {
              lowStockToolsCount: lowStockTools.length,
              toolIds: lowStockTools.map(t => t.id)
            }
          };

          const sseSent = sendInstantNotification(userCompany.user.id, sseNotification);

          notificationsSent.push({
            userId: userCompany.user.id,
            type: notificationType,
            toolsCount: lowStockTools.length,
            notificationId: notification.id,
            sseSent
          });

          console.log(`✅ [STOCK CHECK] Notificación creada para ${lowStockTools.length} herramientas y usuario ${userCompany.user.id} (SSE: ${sseSent})`);
        } catch (error) {
          console.error('❌ [STOCK CHECK] Error enviando notificación:', error);
        }
      }
    }

    console.log(`✅ [STOCK CHECK] Verificación completada. ${notificationsSent.length} notificaciones generales enviadas.`);

    return NextResponse.json({
      success: true,
      message: `Verificación de stock completada. ${notificationsSent.length} notificaciones generales enviadas.`,
      toolsChecked: tools.length,
      lowStockToolsCount: lowStockTools.length,
      notificationsSent: notificationsSent.length,
      notifications: notificationsSent
    });

  } catch (error) {
    console.error('❌ [STOCK CHECK] Error en stock check:', error);
    return NextResponse.json(
      { error: 'Error al verificar stock', details: error },
      { status: 500 }
    );
  }
} 