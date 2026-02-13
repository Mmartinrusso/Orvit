import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

// GET /api/maintenance/preventive/alerts - Obtener alertas de mantenimientos próximos
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get('companyId');
    const daysAhead = Number(searchParams.get('daysAhead')) || 7;

    if (!companyId) {
      return NextResponse.json(
        { error: 'companyId es requerido' },
        { status: 400 }
      );
    }

    // Obtener todos los templates activos de la empresa
    const templates = await prisma.document.findMany({
      where: {
        entityType: 'PREVENTIVE_MAINTENANCE_TEMPLATE',
        url: { contains: `"companyId":${companyId}` }
      }
    });

    const today = new Date();
    today.setHours(0, 0, 0, 0);

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
      try {
        const data = JSON.parse(template.url);

        // Solo procesar templates activos
        if (!data.isActive) continue;

        // Verificar que tenga fecha de próximo mantenimiento
        if (!data.nextMaintenanceDate) continue;

        const nextDate = new Date(data.nextMaintenanceDate);
        nextDate.setHours(0, 0, 0, 0);

        const diffTime = nextDate.getTime() - today.getTime();
        const daysUntilDue = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        // Determinar si debe generar alerta
        const alertDays = Array.isArray(data.alertDaysBefore)
          ? data.alertDaysBefore.map(Number)
          : data.alertDaysBefore
            ? [Number(data.alertDaysBefore)]
            : [3]; // Por defecto 3 días antes

        // Incluir si está vencido, vence hoy, o está dentro del rango de alertas
        const maxAlertDay = Math.max(...alertDays, daysAhead);
        if (daysUntilDue > maxAlertDay) continue;

        // Determinar tipo y prioridad de alerta
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
          title: data.title,
          machineName: data.machineName || 'Sin equipo',
          nextMaintenanceDate: data.nextMaintenanceDate,
          daysUntilDue,
          alertDaysBefore: alertDays,
          assignedToName: data.assignedToName || null,
          frequencyDays: data.frequencyDays
        });
      } catch {
        // Skip templates con JSON inválido
        continue;
      }
    }

    // Ordenar por prioridad y días hasta vencimiento
    const priorityOrder = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
    alerts.sort((a, b) => {
      const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
      if (priorityDiff !== 0) return priorityDiff;
      return a.daysUntilDue - b.daysUntilDue;
    });

    // Resumen de alertas
    const summary = {
      total: alerts.length,
      overdue: alerts.filter(a => a.type === 'OVERDUE').length,
      dueToday: alerts.filter(a => a.type === 'DUE_TODAY').length,
      dueSoon: alerts.filter(a => a.type === 'DUE_SOON').length,
      upcoming: alerts.filter(a => a.type === 'UPCOMING').length,
      critical: alerts.filter(a => a.priority === 'CRITICAL').length,
      high: alerts.filter(a => a.priority === 'HIGH').length
    };

    // Cache corto para alertas
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
