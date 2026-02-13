import { NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

interface ProactiveAlert {
  type: 'RISK' | 'OPPORTUNITY' | 'ANOMALY' | 'REMINDER';
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
  title: string;
  description: string;
  relatedEntities: { type: string; id: number; name: string }[];
  suggestedAction: string;
  actionUrl?: string;
  confidence: number;
}

/**
 * GET /api/ai/suggestions
 * Get proactive AI suggestions and alerts
 */
export async function GET(request: Request) {
  try {
    // Verify authentication
    const token = request.headers.get('cookie')?.match(/token=([^;]+)/)?.[1];
    if (!token) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const payload = await verifyToken(token);
    if (!payload) {
      return NextResponse.json({ error: 'Token inválido' }, { status: 401 });
    }

    const companyId = payload.companyId as number;
    const alerts: ProactiveAlert[] = [];

    // Check for SLA at risk
    const slaAtRisk = await checkSLAAtRisk(companyId);
    alerts.push(...slaAtRisk);

    // Check for recurring failures
    const recurringFailures = await checkRecurringFailures(companyId);
    alerts.push(...recurringFailures);

    // Check for overdue PM
    const overduePM = await checkOverduePM(companyId);
    alerts.push(...overduePM);

    // Check for low stock
    const lowStock = await checkLowStock(companyId);
    alerts.push(...lowStock);

    // Check for machines with declining health
    const decliningHealth = await checkDecliningHealth(companyId);
    alerts.push(...decliningHealth);

    // Sort by priority
    const priorityOrder = { HIGH: 0, MEDIUM: 1, LOW: 2 };
    alerts.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

    return NextResponse.json({
      alerts,
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('AI Suggestions error:', error);
    return NextResponse.json(
      { error: 'Error generating suggestions' },
      { status: 500 }
    );
  }
}

async function checkSLAAtRisk(companyId: number): Promise<ProactiveAlert[]> {
  const alerts: ProactiveAlert[] = [];

  try {
    // Get work orders approaching SLA
    const atRiskWOs = await prisma.workOrder.findMany({
      where: {
        companyId,
        status: { in: ['pending', 'in_progress'] },
        dueDate: {
          gte: new Date(),
          lte: new Date(Date.now() + 4 * 60 * 60 * 1000), // Next 4 hours
        },
      },
      include: {
        machine: { select: { name: true } },
      },
      take: 5,
    });

    if (atRiskWOs.length > 0) {
      alerts.push({
        type: 'RISK',
        priority: 'HIGH',
        title: `${atRiskWOs.length} OTs en riesgo de SLA`,
        description: `Las siguientes órdenes de trabajo vencen en las próximas 4 horas: ${atRiskWOs.map((wo) => `OT #${wo.id}`).join(', ')}`,
        relatedEntities: atRiskWOs.map((wo) => ({
          type: 'WORK_ORDER',
          id: wo.id,
          name: wo.title,
        })),
        suggestedAction: 'Priorizar y asignar recursos',
        actionUrl: '/mantenimiento/ordenes?filter=sla_at_risk',
        confidence: 95,
      });
    }

    // Check for already breached SLA
    const breachedWOs = await prisma.workOrder.count({
      where: {
        companyId,
        status: { in: ['pending', 'in_progress'] },
        dueDate: { lt: new Date() },
      },
    });

    if (breachedWOs > 0) {
      alerts.push({
        type: 'RISK',
        priority: 'HIGH',
        title: `${breachedWOs} OTs con SLA vencido`,
        description: `Hay ${breachedWOs} órdenes de trabajo que ya superaron su fecha de vencimiento.`,
        relatedEntities: [],
        suggestedAction: 'Revisar y escalar inmediatamente',
        actionUrl: '/mantenimiento/ordenes?filter=overdue',
        confidence: 100,
      });
    }
  } catch (error) {
    console.error('Error checking SLA:', error);
  }

  return alerts;
}

async function checkRecurringFailures(companyId: number): Promise<ProactiveAlert[]> {
  const alerts: ProactiveAlert[] = [];

  try {
    // Find machines with 3+ failures in last 7 days
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const recurringMachines = await prisma.$queryRaw<any[]>`
      SELECT
        m."id",
        m."name",
        COUNT(f."id") as "failureCount"
      FROM "Machine" m
      JOIN "FailureOccurrence" f ON f."machineId" = m."id"
      WHERE m."companyId" = ${companyId}
      AND f."createdAt" >= ${sevenDaysAgo}
      GROUP BY m."id", m."name"
      HAVING COUNT(f."id") >= 3
      ORDER BY COUNT(f."id") DESC
      LIMIT 5
    `;

    for (const machine of recurringMachines) {
      alerts.push({
        type: 'ANOMALY',
        priority: machine.failureCount >= 5 ? 'HIGH' : 'MEDIUM',
        title: `Reincidencia detectada: ${machine.name}`,
        description: `La máquina ${machine.name} ha tenido ${machine.failureCount} fallas en los últimos 7 días. Puede requerir análisis de causa raíz.`,
        relatedEntities: [
          { type: 'MACHINE', id: machine.id, name: machine.name },
        ],
        suggestedAction: 'Iniciar RCA (Análisis de Causa Raíz)',
        actionUrl: `/mantenimiento/maquinas/${machine.id}?tab=failures`,
        confidence: 85,
      });
    }
  } catch (error) {
    console.error('Error checking recurring failures:', error);
  }

  return alerts;
}

async function checkOverduePM(companyId: number): Promise<ProactiveAlert[]> {
  const alerts: ProactiveAlert[] = [];

  try {
    // Get overdue preventive maintenance
    const overduePMs = await prisma.maintenanceChecklist.findMany({
      where: {
        companyId,
        isActive: true,
        nextDueDate: { lt: new Date() },
      },
      include: {
        machine: { select: { id: true, name: true } },
      },
      take: 10,
    });

    if (overduePMs.length > 0) {
      const criticalPMs = overduePMs.filter((pm) => {
        const daysOverdue = Math.floor((Date.now() - new Date(pm.nextDueDate!).getTime()) / (1000 * 60 * 60 * 24));
        return daysOverdue > 5;
      });

      if (criticalPMs.length > 0) {
        alerts.push({
          type: 'RISK',
          priority: 'HIGH',
          title: `${criticalPMs.length} mantenimientos preventivos muy vencidos`,
          description: `Hay ${criticalPMs.length} PMs con más de 5 días de vencimiento.`,
          relatedEntities: criticalPMs.map((pm) => ({
            type: 'CHECKLIST',
            id: pm.id,
            name: pm.name,
          })),
          suggestedAction: 'Programar ejecución urgente',
          actionUrl: '/mantenimiento/checklists?filter=overdue',
          confidence: 90,
        });
      }

      if (overduePMs.length > criticalPMs.length) {
        alerts.push({
          type: 'REMINDER',
          priority: 'MEDIUM',
          title: `${overduePMs.length - criticalPMs.length} PMs vencidos`,
          description: `Hay mantenimientos preventivos pendientes de ejecutar.`,
          relatedEntities: [],
          suggestedAction: 'Revisar calendario de mantenimiento',
          actionUrl: '/mantenimiento/calendario',
          confidence: 85,
        });
      }
    }
  } catch (error) {
    console.error('Error checking overdue PM:', error);
  }

  return alerts;
}

async function checkLowStock(companyId: number): Promise<ProactiveAlert[]> {
  const alerts: ProactiveAlert[] = [];

  try {
    // Get critical items with low stock
    const lowStockItems = await prisma.tool.findMany({
      where: {
        companyId,
        isCritical: true,
        currentStock: { lte: prisma.tool.fields.minStockLevel },
      },
      take: 10,
    });

    if (lowStockItems.length > 0) {
      alerts.push({
        type: 'RISK',
        priority: 'MEDIUM',
        title: `${lowStockItems.length} repuestos críticos con bajo stock`,
        description: `Los siguientes repuestos críticos están por debajo del nivel mínimo: ${lowStockItems.slice(0, 3).map((i) => i.name).join(', ')}${lowStockItems.length > 3 ? ' y más...' : ''}`,
        relatedEntities: lowStockItems.map((item) => ({
          type: 'INVENTORY',
          id: item.id,
          name: item.name,
        })),
        suggestedAction: 'Generar solicitud de compra',
        actionUrl: '/panol?filter=low_stock',
        confidence: 90,
      });
    }
  } catch (error) {
    console.error('Error checking low stock:', error);
  }

  return alerts;
}

async function checkDecliningHealth(companyId: number): Promise<ProactiveAlert[]> {
  const alerts: ProactiveAlert[] = [];

  try {
    // Find machines with health score below 40
    const unhealthyMachines = await prisma.machine.findMany({
      where: {
        companyId,
        isActive: true,
        healthScore: { lt: 40 },
      },
      select: {
        id: true,
        name: true,
        healthScore: true,
      },
      orderBy: { healthScore: 'asc' },
      take: 5,
    });

    if (unhealthyMachines.length > 0) {
      alerts.push({
        type: 'RISK',
        priority: unhealthyMachines.some((m) => (m.healthScore || 0) < 20) ? 'HIGH' : 'MEDIUM',
        title: `${unhealthyMachines.length} máquinas con salud crítica`,
        description: `Las siguientes máquinas tienen un health score bajo: ${unhealthyMachines.map((m) => `${m.name} (${m.healthScore}%)`).join(', ')}`,
        relatedEntities: unhealthyMachines.map((m) => ({
          type: 'MACHINE',
          id: m.id,
          name: m.name,
        })),
        suggestedAction: 'Revisar y planificar intervención',
        actionUrl: '/mantenimiento/health-score',
        confidence: 80,
      });
    }
  } catch (error) {
    console.error('Error checking health:', error);
  }

  return alerts;
}
