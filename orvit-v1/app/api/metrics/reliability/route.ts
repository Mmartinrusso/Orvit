/**
 * API: /api/metrics/reliability
 *
 * GET - Métricas de confiabilidad (MTBF, MTTR, Disponibilidad)
 *       Incluye: Por máquina, tendencias históricas, Pareto
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth';

export const dynamic = 'force-dynamic';

interface MachineReliability {
  machineId: number;
  machineName: string;
  failureCount: number;
  totalDowntimeMinutes: number;
  mtbfHours: number | null;
  mttrMinutes: number | null;
  availability: number | null;
}

interface MonthlyTrend {
  month: string;
  year: number;
  monthNum: number;
  mtbfHours: number | null;
  mttrMinutes: number | null;
  failureCount: number;
  downtimeMinutes: number;
}

/**
 * GET /api/metrics/reliability
 * Dashboard de métricas de confiabilidad
 */
export async function GET(request: NextRequest) {
  try {
    // 1. Verificar autenticación
    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;

    if (!token) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }

    const payload = await verifyToken(token);
    if (!payload || !payload.companyId) {
      return NextResponse.json({ error: 'Token inválido' }, { status: 401 });
    }

    const companyId = payload.companyId as number;

    // 2. Parsear query params
    const searchParams = request.nextUrl.searchParams;
    const period = parseInt(searchParams.get('period') || '30'); // días
    const machineId = searchParams.get('machineId') ? parseInt(searchParams.get('machineId')!) : undefined;
    const sectorId = searchParams.get('sectorId') ? parseInt(searchParams.get('sectorId')!) : undefined;

    const endDate = new Date();
    const startDate = new Date(Date.now() - period * 24 * 60 * 60 * 1000);

    // Período para tendencias (6 meses)
    const trendStartDate = new Date();
    trendStartDate.setMonth(trendStartDate.getMonth() - 6);

    // 3. Obtener máquinas relevantes
    const machinesFilter: any = { companyId, status: 'ACTIVE' };
    if (machineId) machinesFilter.id = machineId;
    if (sectorId) machinesFilter.sectorId = sectorId;

    const machines = await prisma.machine.findMany({
      where: machinesFilter,
      select: { id: true, name: true }
    });

    const machineIds = machines.map(m => m.id);

    // 4. Fallas en período (excluyendo duplicados)
    const failures = await prisma.failureOccurrence.findMany({
      where: {
        companyId,
        machineId: { in: machineIds },
        reportedAt: { gte: startDate, lte: endDate },
        isLinkedDuplicate: false
      },
      select: {
        id: true,
        machineId: true,
        reportedAt: true,
        resolvedAt: true,
        causedDowntime: true
      }
    });

    // 5. Downtime logs en período
    const downtimeLogs = await prisma.downtimeLog.findMany({
      where: {
        companyId,
        machineId: { in: machineIds },
        startedAt: { gte: startDate, lte: endDate }
      },
      select: {
        machineId: true,
        totalMinutes: true,
        startedAt: true,
        endedAt: true
      }
    });

    // 6. OTs cerradas para MTTR
    const closedWorkOrders = await prisma.workOrder.findMany({
      where: {
        companyId,
        machineId: { in: machineIds },
        type: { in: ['CORRECTIVE', 'FAILURE'] },
        status: 'COMPLETED',
        closedAt: { gte: startDate, lte: endDate }
      },
      select: {
        machineId: true,
        startedAt: true,
        closedAt: true,
        actualHours: true
      }
    });

    // 7. Calcular métricas por máquina
    const periodHours = period * 24;
    const machineReliability: MachineReliability[] = [];

    for (const machine of machines) {
      const machineFailures = failures.filter(f => f.machineId === machine.id);
      const machineDowntime = downtimeLogs.filter(d => d.machineId === machine.id);
      const machineWOs = closedWorkOrders.filter(wo => wo.machineId === machine.id);

      const failureCount = machineFailures.length;
      const totalDowntimeMinutes = machineDowntime.reduce((sum, d) => sum + (d.totalMinutes || 0), 0);

      // MTBF = (Tiempo disponible) / Número de fallas
      // Tiempo disponible = Período total - Downtime
      const availableHours = periodHours - (totalDowntimeMinutes / 60);
      const mtbfHours = failureCount > 0 ? availableHours / failureCount : null;

      // MTTR = Tiempo total de reparación / Número de reparaciones
      let mttrMinutes: number | null = null;
      if (machineWOs.length > 0) {
        const totalRepairMinutes = machineWOs.reduce((sum, wo) => {
          if (wo.actualHours) {
            return sum + (wo.actualHours * 60);
          }
          if (wo.startedAt && wo.closedAt) {
            return sum + ((new Date(wo.closedAt).getTime() - new Date(wo.startedAt).getTime()) / 60000);
          }
          return sum;
        }, 0);
        mttrMinutes = Math.round(totalRepairMinutes / machineWOs.length);
      } else if (totalDowntimeMinutes > 0 && failureCount > 0) {
        // Fallback: usar downtime promedio
        mttrMinutes = Math.round(totalDowntimeMinutes / failureCount);
      }

      // Disponibilidad = MTBF / (MTBF + MTTR)
      let availability: number | null = null;
      if (mtbfHours !== null && mttrMinutes !== null && mttrMinutes > 0) {
        const mttrHours = mttrMinutes / 60;
        availability = Math.round((mtbfHours / (mtbfHours + mttrHours)) * 1000) / 10;
      } else if (failureCount === 0) {
        availability = 100;
      }

      machineReliability.push({
        machineId: machine.id,
        machineName: machine.name,
        failureCount,
        totalDowntimeMinutes,
        mtbfHours: mtbfHours !== null ? Math.round(mtbfHours * 10) / 10 : null,
        mttrMinutes,
        availability
      });
    }

    // 8. Calcular métricas globales
    const totalFailures = failures.length;
    const totalDowntimeMinutes = downtimeLogs.reduce((sum, d) => sum + (d.totalMinutes || 0), 0);
    const totalAvailableHours = (periodHours * machines.length) - (totalDowntimeMinutes / 60);

    const globalMtbfHours = totalFailures > 0
      ? Math.round((totalAvailableHours / totalFailures) * 10) / 10
      : null;

    let globalMttrMinutes: number | null = null;
    if (closedWorkOrders.length > 0) {
      const totalRepairMinutes = closedWorkOrders.reduce((sum, wo) => {
        if (wo.actualHours) return sum + (wo.actualHours * 60);
        if (wo.startedAt && wo.closedAt) {
          return sum + ((new Date(wo.closedAt).getTime() - new Date(wo.startedAt).getTime()) / 60000);
        }
        return sum;
      }, 0);
      globalMttrMinutes = Math.round(totalRepairMinutes / closedWorkOrders.length);
    }

    let globalAvailability: number | null = null;
    if (globalMtbfHours !== null && globalMttrMinutes !== null && globalMttrMinutes > 0) {
      const globalMttrHours = globalMttrMinutes / 60;
      globalAvailability = Math.round((globalMtbfHours / (globalMtbfHours + globalMttrHours)) * 1000) / 10;
    } else if (totalFailures === 0) {
      globalAvailability = 100;
    }

    // 9. Pareto: Top 10 máquinas con más fallas
    const pareto = [...machineReliability]
      .filter(m => m.failureCount > 0)
      .sort((a, b) => b.failureCount - a.failureCount)
      .slice(0, 10);

    // 10. Tendencias mensuales (últimos 6 meses)
    const trendFailures = await prisma.failureOccurrence.findMany({
      where: {
        companyId,
        machineId: { in: machineIds },
        reportedAt: { gte: trendStartDate },
        isLinkedDuplicate: false
      },
      select: { reportedAt: true }
    });

    const trendDowntime = await prisma.downtimeLog.findMany({
      where: {
        companyId,
        machineId: { in: machineIds },
        startedAt: { gte: trendStartDate }
      },
      select: { startedAt: true, totalMinutes: true }
    });

    const trendWOs = await prisma.workOrder.findMany({
      where: {
        companyId,
        machineId: { in: machineIds },
        type: { in: ['CORRECTIVE', 'FAILURE'] },
        status: 'COMPLETED',
        closedAt: { gte: trendStartDate }
      },
      select: { closedAt: true, startedAt: true, actualHours: true }
    });

    // Agrupar por mes
    const monthlyData: Record<string, { failures: number; downtime: number; repairs: number; repairTime: number }> = {};
    const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      const key = `${d.getFullYear()}-${d.getMonth() + 1}`;
      monthlyData[key] = { failures: 0, downtime: 0, repairs: 0, repairTime: 0 };
    }

    trendFailures.forEach(f => {
      const d = new Date(f.reportedAt);
      const key = `${d.getFullYear()}-${d.getMonth() + 1}`;
      if (monthlyData[key]) monthlyData[key].failures++;
    });

    trendDowntime.forEach(d => {
      const date = new Date(d.startedAt);
      const key = `${date.getFullYear()}-${date.getMonth() + 1}`;
      if (monthlyData[key]) monthlyData[key].downtime += d.totalMinutes || 0;
    });

    trendWOs.forEach(wo => {
      const d = new Date(wo.closedAt!);
      const key = `${d.getFullYear()}-${d.getMonth() + 1}`;
      if (monthlyData[key]) {
        monthlyData[key].repairs++;
        if (wo.actualHours) {
          monthlyData[key].repairTime += wo.actualHours * 60;
        } else if (wo.startedAt && wo.closedAt) {
          monthlyData[key].repairTime += (new Date(wo.closedAt).getTime() - new Date(wo.startedAt).getTime()) / 60000;
        }
      }
    });

    const monthlyHours = 30 * 24 * machines.length; // Aprox por mes

    const trends: MonthlyTrend[] = Object.entries(monthlyData).map(([key, data]) => {
      const [year, monthNum] = key.split('-').map(Number);
      const availHours = monthlyHours - (data.downtime / 60);
      const mtbf = data.failures > 0 ? Math.round((availHours / data.failures) * 10) / 10 : null;
      const mttr = data.repairs > 0 ? Math.round(data.repairTime / data.repairs) : null;

      return {
        month: months[monthNum - 1],
        year,
        monthNum,
        mtbfHours: mtbf,
        mttrMinutes: mttr,
        failureCount: data.failures,
        downtimeMinutes: data.downtime
      };
    });

    // 11. Respuesta
    return NextResponse.json({
      success: true,
      data: {
        period: {
          days: period,
          startDate,
          endDate,
          machinesCount: machines.length
        },
        global: {
          mtbf: {
            hours: globalMtbfHours,
            formatted: globalMtbfHours !== null
              ? `${Math.floor(globalMtbfHours)}h ${Math.round((globalMtbfHours % 1) * 60)}m`
              : 'N/A'
          },
          mttr: {
            minutes: globalMttrMinutes,
            formatted: globalMttrMinutes !== null
              ? globalMttrMinutes < 60
                ? `${globalMttrMinutes}m`
                : `${Math.floor(globalMttrMinutes / 60)}h ${globalMttrMinutes % 60}m`
              : 'N/A'
          },
          availability: {
            percentage: globalAvailability,
            formatted: globalAvailability !== null ? `${globalAvailability}%` : 'N/A'
          },
          totalFailures,
          totalDowntime: {
            minutes: totalDowntimeMinutes,
            hours: Math.round(totalDowntimeMinutes / 60 * 10) / 10
          }
        },
        byMachine: machineReliability,
        pareto,
        trends
      }
    });

  } catch (error) {
    console.error('Error en GET /api/metrics/reliability:', error);
    return NextResponse.json(
      { error: 'Error al obtener métricas de confiabilidad' },
      { status: 500 }
    );
  }
}
