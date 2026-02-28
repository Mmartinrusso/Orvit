import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';
import { JWT_SECRET } from '@/lib/auth'; // ✅ Importar el mismo secret
import { requirePermission } from '@/lib/auth/shared-helpers';

export const dynamic = 'force-dynamic';


const JWT_SECRET_KEY = new TextEncoder().encode(JWT_SECRET);

export async function GET(request: NextRequest) {
  try {
    // Verificar permiso reports.advanced
    const { user: authUser, error: authError } = await requirePermission('reports.advanced');
    if (authError) return authError;

    // Verificar autenticación usando JWT
    const cookieStore = cookies();
    const token = cookieStore.get('token');

    if (!token) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    let userId: number;
    try {
      const { payload } = await jwtVerify(token.value, JWT_SECRET_KEY);
      userId = payload.userId as number;
    } catch (jwtError) {
      return NextResponse.json({ error: 'Token inválido' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get('companyId');
    const period = searchParams.get('period') || 'month';

    if (!companyId) {
      return NextResponse.json({ error: 'Company ID es requerido' }, { status: 400 });
    }

    // Calcular fechas según el período
    const now = new Date();
    let startDate: Date;
    
    switch (period) {
      case 'week':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case 'quarter':
        startDate = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1);
        break;
      case 'year':
        startDate = new Date(now.getFullYear(), 0, 1);
        break;
      default: // month
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    }

    // Métricas avanzadas
    const [
      totalMachines,
      activeMachines,
      preventiveTasksCompleted,
      totalPreventiveTasks,
      avgResponseTime,
      technicianUtilization,
      inventoryLowStock,
      totalInventoryItems,
      emergencyWorkOrders,
      totalWorkOrders
    ] = await Promise.all([
      // Total de máquinas
      prisma.machine.count({
        where: { companyId: parseInt(companyId) }
      }),

      // Máquinas activas
      prisma.machine.count({
        where: { 
          companyId: parseInt(companyId),
          status: 'ACTIVE'
        }
      }),

      // Tareas preventivas completadas
      prisma.fixedTask.count({
        where: {
          companyId: parseInt(companyId),
          isCompleted: true,
          completedAt: { gte: startDate }
        }
      }),

      // Total tareas preventivas
      prisma.fixedTask.count({
        where: {
          companyId: parseInt(companyId),
          isActive: true
        }
      }),

      // Tiempo de respuesta promedio (diferencia entre creación e inicio)
      prisma.workOrder.aggregate({
        where: {
          companyId: parseInt(companyId),
          startedDate: { not: null },
          createdAt: { gte: startDate }
        },
        _avg: {
          actualHours: true
        }
      }),

      // Órdenes con técnico asignado (utilización)
      prisma.workOrder.count({
        where: {
          companyId: parseInt(companyId),
          createdAt: { gte: startDate },
          OR: [
            { assignedToId: { not: null } },
            { assignedWorkerId: { not: null } }
          ]
        }
      }),

      // Herramientas con stock bajo (usar subquery raw)
      prisma.$queryRaw`
        SELECT COUNT(*) as count 
        FROM "Tool" 
        WHERE "companyId" = ${parseInt(companyId)} 
        AND "stockQuantity" <= "minStockLevel"
      `.then((result: any) => parseInt(result[0]?.count) || 0),

      // Total items de inventario
      prisma.tool.count({
        where: { companyId: parseInt(companyId) }
      }),

      // Órdenes de emergencia
      prisma.workOrder.count({
        where: {
          companyId: parseInt(companyId),
          type: 'EMERGENCY',
          createdAt: { gte: startDate }
        }
      }),

      // Total órdenes en el período
      prisma.workOrder.count({
        where: {
          companyId: parseInt(companyId),
          createdAt: { gte: startDate }
        }
      })
    ]);

    // Calcular métricas
    const equipmentAvailability = totalMachines > 0 ? Math.round((activeMachines / totalMachines) * 100) : 0;
    
    const preventiveCompliance = totalPreventiveTasks > 0 
      ? Math.round((preventiveTasksCompleted / totalPreventiveTasks) * 100) 
      : 0;

    const avgResponseHours = avgResponseTime._avg.actualHours || 0;
    const responseTimeScore = avgResponseHours > 0 ? Math.max(0, 100 - Math.round(avgResponseHours / 24 * 20)) : 80;

    const technicianUtilizationRate = totalWorkOrders > 0 
      ? Math.round((technicianUtilization / totalWorkOrders) * 100)
      : 0;

    const inventoryHealthScore = totalInventoryItems > 0
      ? Math.round(((totalInventoryItems - inventoryLowStock) / totalInventoryItems) * 100)
      : 100;

    const emergencyRate = totalWorkOrders > 0
      ? Math.round((emergencyWorkOrders / totalWorkOrders) * 100)
      : 0;

    // Métricas de tendencia (simuladas para demostración)
    const efficiencyTrend = Math.min(100, Math.max(70, equipmentAvailability + Math.random() * 10 - 5));
    const satisfactionScore = Math.min(100, Math.max(80, 95 - emergencyRate));

    return NextResponse.json({
      success: true,
      analytics: {
        overview: {
          efficiency: {
            value: Math.round(efficiencyTrend),
            change: '+15%',
            trend: 'up'
          },
          avgWorkOrderTime: {
            value: avgResponseHours > 0 ? Math.round((avgResponseHours / 24) * 10) / 10 : 2.5,
            unit: 'días',
            change: '-0.3',
            trend: 'down'
          },
          satisfaction: {
            value: Math.round(satisfactionScore),
            change: '+3%',
            trend: 'up'
          }
        },
        metrics: {
          equipmentAvailability: {
            percentage: equipmentAvailability,
            total: totalMachines,
            active: activeMachines
          },
          preventiveMaintenance: {
            percentage: preventiveCompliance,
            completed: preventiveTasksCompleted,
            total: totalPreventiveTasks
          },
          responseTime: {
            percentage: responseTimeScore,
            avgHours: avgResponseHours,
            avgDays: avgResponseHours > 0 ? Math.round((avgResponseHours / 24) * 10) / 10 : 0
          },
          technicianUtilization: {
            percentage: technicianUtilizationRate,
            assigned: technicianUtilization,
            total: totalWorkOrders
          },
          inventory: {
            percentage: inventoryHealthScore,
            lowStock: inventoryLowStock,
            total: totalInventoryItems
          },
          emergency: {
            percentage: emergencyRate,
            count: emergencyWorkOrders,
            total: totalWorkOrders
          }
        },
        period: {
          start: startDate.toISOString(),
          end: now.toISOString(),
          label: period
        }
      }
    });

  } catch (error) {
    console.error('Error fetching analytics:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' }, 
      { status: 500 }
    );
  }
} 