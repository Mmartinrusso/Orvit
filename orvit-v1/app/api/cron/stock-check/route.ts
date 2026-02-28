import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { createAndSendInstantNotification } from '@/lib/instant-notifications';

export const dynamic = 'force-dynamic';

// Verificación de stock bajo para todas las empresas
// Este cron debe ejecutarse cada hora o cada 4 horas

export async function GET(request: NextRequest) {
  console.log('⏰ CRON STOCK: Iniciando verificación automática de stock...');

  try {
    // Obtener todas las empresas activas
    const companies = await prisma.company.findMany({
      where: { isActive: true },
      select: { id: true, name: true }
    });

    const results = {
      companiesChecked: 0,
      totalLowStock: 0,
      totalOutOfStock: 0,
      totalCritical: 0,
      notificationsSent: 0,
      details: [] as Array<{
        companyId: number;
        companyName: string;
        lowStock: number;
        outOfStock: number;
        critical: number;
        notified: number;
      }>
    };

    for (const company of companies) {
      results.companiesChecked++;

      // Usar raw query para la comparación de campos (stockQuantity <= minStockLevel)
      const lowStockItemsRaw = await prisma.$queryRaw<Array<{
        id: number;
        name: string;
        code: string | null;
        stockQuantity: number;
        minStockLevel: number;
        reorderPoint: number | null;
        isCritical: boolean;
        itemType: string;
      }>>`
        SELECT id, name, code, "stockQuantity", "minStockLevel", "reorderPoint", "isCritical", "itemType"
        FROM "Tool"
        WHERE "companyId" = ${company.id}
          AND "minStockLevel" > 0
          AND "stockQuantity" <= "minStockLevel"
      `;

      if (lowStockItemsRaw.length === 0) {
        continue;
      }

      // Clasificar items
      const outOfStock = lowStockItemsRaw.filter(t => t.stockQuantity === 0);
      const lowStock = lowStockItemsRaw.filter(t => t.stockQuantity > 0 && t.stockQuantity <= t.minStockLevel);
      const criticalItems = lowStockItemsRaw.filter(t => t.isCritical);

      results.totalLowStock += lowStock.length;
      results.totalOutOfStock += outOfStock.length;
      results.totalCritical += criticalItems.length;

      // Obtener usuarios admin de la empresa para notificar
      const admins = await prisma.userOnCompany.findMany({
        where: {
          companyId: company.id,
          user: {
            role: { in: ['ADMIN', 'SUPERADMIN'] },
            isActive: true
          }
        },
        include: {
          user: {
            select: { id: true, name: true }
          }
        }
      });

      let notifiedCount = 0;

      // Notificar si hay items críticos sin stock
      if (criticalItems.filter(i => i.stockQuantity === 0).length > 0) {
        const criticalOutOfStock = criticalItems.filter(i => i.stockQuantity === 0);

        for (const admin of admins) {
          // Verificar notificación reciente (últimas 4 horas)
          const recentNotification = await prisma.notification.findFirst({
            where: {
              userId: admin.user.id,
              type: 'stock_out',
              metadata: {
                path: ['isCriticalAlert'],
                equals: true
              },
              createdAt: {
                gte: new Date(Date.now() - 4 * 60 * 60 * 1000)
              }
            }
          });

          if (!recentNotification) {
            const itemsList = criticalOutOfStock.slice(0, 5).map(i => i.name).join(', ');

            await createAndSendInstantNotification(
              'STOCK_OUT',
              admin.user.id,
              company.id,
              null,
              null,
              '🚨 Items CRÍTICOS sin stock',
              `${criticalOutOfStock.length} item(s) crítico(s) sin stock: ${itemsList}${criticalOutOfStock.length > 5 ? '...' : ''}`,
              'urgent',
              {
                isCriticalAlert: true,
                itemsCount: criticalOutOfStock.length,
                items: criticalOutOfStock.map(i => ({
                  id: i.id,
                  name: i.name,
                  code: i.code,
                  type: i.itemType
                }))
              }
            );
            notifiedCount++;
          }
        }
      }

      // Notificar si hay muchos items con stock bajo (más de 5)
      if (lowStock.length >= 5) {
        for (const admin of admins) {
          const recentNotification = await prisma.notification.findFirst({
            where: {
              userId: admin.user.id,
              type: 'stock_low',
              metadata: {
                path: ['isGeneralStockAlert'],
                equals: true
              },
              createdAt: {
                gte: new Date(Date.now() - 8 * 60 * 60 * 1000) // 8 horas
              }
            }
          });

          if (!recentNotification) {
            await createAndSendInstantNotification(
              'STOCK_LOW',
              admin.user.id,
              company.id,
              null,
              null,
              '⚠️ Múltiples items con stock bajo',
              `${lowStock.length} items con stock bajo en Pañol. Revisar para reposición.`,
              'high',
              {
                isGeneralStockAlert: true,
                lowStockCount: lowStock.length,
                outOfStockCount: outOfStock.length,
                criticalCount: criticalItems.length
              }
            );
            notifiedCount++;
          }
        }
      }

      results.notificationsSent += notifiedCount;
      results.details.push({
        companyId: company.id,
        companyName: company.name,
        lowStock: lowStock.length,
        outOfStock: outOfStock.length,
        critical: criticalItems.length,
        notified: notifiedCount
      });
    }

    console.log(`✅ CRON STOCK: Verificación completada. ${results.companiesChecked} empresas, ${results.totalLowStock} con stock bajo, ${results.notificationsSent} notificaciones`);

    return NextResponse.json({
      success: true,
      message: 'Verificación de stock completada',
      ...results,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ CRON STOCK: Error:', error);
    return NextResponse.json(
      {
        error: 'Error en verificación de stock',
        details: error instanceof Error ? error.message : 'Error desconocido'
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  return GET(request);
}
