import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth';

export const dynamic = 'force-dynamic';

// GET /api/maintenance/preventive/alerts - Obtener alertas de mantenimientos próximos
export async function GET(request: NextRequest) {
  try {
    // Autenticación
    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;
    if (!token) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }
    const payload = await verifyToken(token);
    if (!payload || !payload.userId) {
      return NextResponse.json({ error: 'Token inválido' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get('companyId');
    const daysAhead = Number(searchParams.get('daysAhead')) || 7;
    const sectorId = searchParams.get('sectorId');

    if (!companyId) {
      return NextResponse.json(
        { error: 'companyId es requerido' },
        { status: 400 }
      );
    }

    // Company boundary check
    const tokenCompanyId = payload.companyId as number | undefined;
    if (tokenCompanyId && Number(companyId) !== tokenCompanyId) {
      return NextResponse.json({ error: 'No autorizado para esta empresa' }, { status: 403 });
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Fecha límite para buscar alertas
    const maxDate = new Date(today);
    maxDate.setDate(maxDate.getDate() + daysAhead);

    // Consulta directa: templates activos con nextMaintenanceDate dentro del rango o vencidos
    const templates = await prisma.preventiveTemplate.findMany({
      where: {
        companyId: Number(companyId),
        isActive: true,
        nextMaintenanceDate: { not: null },
        ...(sectorId ? { sectorId: Number(sectorId) } : {}),
      },
      select: {
        id: true,
        title: true,
        machineName: true,
        nextMaintenanceDate: true,
        alertDaysBefore: true,
        assignedToName: true,
        frequencyDays: true,
      },
    });

    const alerts: {
      id: number;
      type: 'OVERDUE' | 'DUE_TODAY' | 'DUE_SOON' | 'UPCOMING';
      priority: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
      title: string;
      machineName: string;
      nextMaintenanceDate: string;
      daysUntilDue: number;
      alertDaysBefore: number[];
      assignedToName: string | null;
      frequencyDays: number;
    }[] = [];

    for (const template of templates) {
      if (!template.nextMaintenanceDate) continue;

      const nextDate = new Date(template.nextMaintenanceDate);
      nextDate.setHours(0, 0, 0, 0);

      const diffTime = nextDate.getTime() - today.getTime();
      const daysUntilDue = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      const alertDays = template.alertDaysBefore?.length > 0
        ? template.alertDaysBefore
        : [3];

      // Incluir si está vencido, vence hoy, o está dentro del rango
      const maxAlertDay = Math.max(...alertDays, daysAhead);
      if (daysUntilDue > maxAlertDay) continue;

      let type: 'OVERDUE' | 'DUE_TODAY' | 'DUE_SOON' | 'UPCOMING';
      let priority: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';

      if (daysUntilDue < 0) {
        type = 'OVERDUE';
        priority = 'CRITICAL';
      } else if (daysUntilDue === 0) {
        type = 'DUE_TODAY';
        priority = 'HIGH';
      } else if (alertDays.includes(daysUntilDue)) {
        type = 'DUE_SOON';
        priority = daysUntilDue <= 1 ? 'HIGH' : 'MEDIUM';
      } else if (daysUntilDue <= 3) {
        type = 'DUE_SOON';
        priority = 'MEDIUM';
      } else {
        type = 'UPCOMING';
        priority = 'LOW';
      }

      alerts.push({
        id: template.id,
        type,
        priority,
        title: template.title,
        machineName: template.machineName || 'Sin equipo',
        nextMaintenanceDate: template.nextMaintenanceDate.toISOString(),
        daysUntilDue,
        alertDaysBefore: alertDays,
        assignedToName: template.assignedToName || null,
        frequencyDays: template.frequencyDays,
      });
    }

    // Ordenar por prioridad y días hasta vencimiento
    const priorityOrder = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
    alerts.sort((a, b) => {
      const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
      if (priorityDiff !== 0) return priorityDiff;
      return a.daysUntilDue - b.daysUntilDue;
    });

    const summary = {
      total: alerts.length,
      overdue: alerts.filter(a => a.type === 'OVERDUE').length,
      dueToday: alerts.filter(a => a.type === 'DUE_TODAY').length,
      dueSoon: alerts.filter(a => a.type === 'DUE_SOON').length,
      upcoming: alerts.filter(a => a.type === 'UPCOMING').length,
      critical: alerts.filter(a => a.priority === 'CRITICAL').length,
      high: alerts.filter(a => a.priority === 'HIGH').length,
    };

    const response = NextResponse.json({ alerts, summary });
    response.headers.set('Cache-Control', 'private, max-age=60, s-maxage=60');
    return response;

  } catch (error) {
    console.error('Error en GET /api/maintenance/preventive/alerts:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
