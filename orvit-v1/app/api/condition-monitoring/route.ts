import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

// GET: List condition monitors, readings, or alerts
export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('auth-token')?.value;

    if (!token) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const payload = await verifyToken(token);
    if (!payload) {
      return NextResponse.json({ error: 'Token inválido' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const companyId = parseInt(searchParams.get('companyId') || '0');
    const machineId = searchParams.get('machineId');
    const view = searchParams.get('view') || 'monitors'; // monitors, readings, alerts, trends

    if (!companyId) {
      return NextResponse.json({ error: 'companyId requerido' }, { status: 400 });
    }

    if (view === 'monitors') {
      const monitors = await prisma.$queryRaw`
        SELECT
          cm.*,
          m.name as machine_name,
          (SELECT cr.value FROM "ConditionReading" cr WHERE cr."monitorId" = cm.id ORDER BY cr."readingAt" DESC LIMIT 1) as last_value,
          (SELECT cr.status FROM "ConditionReading" cr WHERE cr."monitorId" = cm.id ORDER BY cr."readingAt" DESC LIMIT 1) as last_status,
          (SELECT cr."readingAt" FROM "ConditionReading" cr WHERE cr."monitorId" = cm.id ORDER BY cr."readingAt" DESC LIMIT 1) as last_reading_at,
          (SELECT COUNT(*) FROM "ConditionAlert" ca WHERE ca."monitorId" = cm.id AND ca."resolvedAt" IS NULL) as active_alerts
        FROM "ConditionMonitor" cm
        LEFT JOIN "Machine" m ON cm."machineId" = m.id
        WHERE cm."companyId" = ${companyId}
        ${machineId ? prisma.$queryRaw`AND cm."machineId" = ${parseInt(machineId)}` : prisma.$queryRaw``}
        ORDER BY m.name, cm.name
      `;
      return NextResponse.json({ monitors });
    }

    if (view === 'readings') {
      const monitorId = searchParams.get('monitorId');
      if (!monitorId) {
        return NextResponse.json({ error: 'monitorId requerido para readings' }, { status: 400 });
      }

      const readings = await prisma.$queryRaw`
        SELECT
          cr.*,
          u.name as recorded_by_name
        FROM "ConditionReading" cr
        LEFT JOIN "User" u ON cr."recordedById" = u.id
        WHERE cr."monitorId" = ${parseInt(monitorId)}
        ORDER BY cr."readingAt" DESC
        LIMIT 500
      `;
      return NextResponse.json({ readings });
    }

    if (view === 'alerts') {
      const alerts = await prisma.$queryRaw`
        SELECT
          ca.*,
          cm.name as monitor_name,
          cm."monitorType",
          cm.unit,
          m.name as machine_name,
          ua.name as acknowledged_by_name,
          ur.name as resolved_by_name
        FROM "ConditionAlert" ca
        JOIN "ConditionMonitor" cm ON ca."monitorId" = cm.id
        LEFT JOIN "Machine" m ON cm."machineId" = m.id
        LEFT JOIN "User" ua ON ca."acknowledgedById" = ua.id
        LEFT JOIN "User" ur ON ca."resolvedById" = ur.id
        WHERE cm."companyId" = ${companyId}
        ORDER BY ca."createdAt" DESC
        LIMIT 100
      `;
      return NextResponse.json({ alerts });
    }

    if (view === 'trends') {
      const monitorId = searchParams.get('monitorId');
      if (!monitorId) {
        return NextResponse.json({ error: 'monitorId requerido para trends' }, { status: 400 });
      }

      const trends = await prisma.$queryRaw`
        SELECT * FROM "ConditionTrend"
        WHERE "monitorId" = ${parseInt(monitorId)}
        ORDER BY "periodStart" DESC
        LIMIT 365
      `;
      return NextResponse.json({ trends });
    }

    return NextResponse.json({ error: 'Vista no válida' }, { status: 400 });
  } catch (error) {
    console.error('Error fetching condition monitoring data:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}

// POST: Create monitor or record reading
export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('auth-token')?.value;

    if (!token) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const payload = await verifyToken(token);
    if (!payload) {
      return NextResponse.json({ error: 'Token inválido' }, { status: 401 });
    }

    const body = await request.json();
    const action = body.action || 'create_monitor'; // create_monitor, record_reading

    if (action === 'create_monitor') {
      const {
        companyId,
        machineId,
        componentId,
        name,
        monitorType,
        unit,
        normalMin,
        normalMax,
        warningMin,
        warningMax,
        criticalMin,
        criticalMax,
        measurementLocation,
        measurementFrequency,
        sensorId,
      } = body;

      if (!companyId || !machineId || !name || !monitorType || !unit) {
        return NextResponse.json(
          { error: 'companyId, machineId, name, monitorType y unit son requeridos' },
          { status: 400 }
        );
      }

      const result = await prisma.$queryRaw<{ id: number }[]>`
        INSERT INTO "ConditionMonitor" (
          "machineId", "componentId", "name", "monitorType", "unit",
          "normalMin", "normalMax", "warningMin", "warningMax",
          "criticalMin", "criticalMax", "measurementLocation",
          "measurementFrequency", "sensorId", "companyId", "createdAt", "updatedAt"
        ) VALUES (
          ${machineId}, ${componentId || null}, ${name}, ${monitorType}, ${unit},
          ${normalMin || null}, ${normalMax || null}, ${warningMin || null}, ${warningMax || null},
          ${criticalMin || null}, ${criticalMax || null}, ${measurementLocation || null},
          ${measurementFrequency || 'WEEKLY'}, ${sensorId || null}, ${companyId}, NOW(), NOW()
        )
        RETURNING id
      `;

      return NextResponse.json({ success: true, id: result[0]?.id }, { status: 201 });
    }

    if (action === 'record_reading') {
      const { monitorId, value, notes, source } = body;

      if (!monitorId || value === undefined) {
        return NextResponse.json(
          { error: 'monitorId y value son requeridos' },
          { status: 400 }
        );
      }

      // Get monitor thresholds
      const monitors = await prisma.$queryRaw<any[]>`
        SELECT * FROM "ConditionMonitor" WHERE id = ${monitorId}
      `;
      const monitor = monitors[0];

      if (!monitor) {
        return NextResponse.json({ error: 'Monitor no encontrado' }, { status: 404 });
      }

      // Determine status based on thresholds
      let status = 'NORMAL';
      const numValue = parseFloat(value);

      if (monitor.criticalMin && numValue < parseFloat(monitor.criticalMin)) status = 'CRITICAL';
      else if (monitor.criticalMax && numValue > parseFloat(monitor.criticalMax)) status = 'CRITICAL';
      else if (monitor.warningMin && numValue < parseFloat(monitor.warningMin)) status = 'WARNING';
      else if (monitor.warningMax && numValue > parseFloat(monitor.warningMax)) status = 'WARNING';

      // Insert reading
      const readingResult = await prisma.$queryRaw<{ id: number }[]>`
        INSERT INTO "ConditionReading" (
          "monitorId", "value", "status", "recordedById", "source", "notes", "readingAt"
        ) VALUES (
          ${monitorId}, ${numValue}, ${status}, ${payload.userId}, ${source || 'MANUAL'}, ${notes || null}, NOW()
        )
        RETURNING id
      `;

      // Create alert if status is WARNING or CRITICAL
      if (status === 'WARNING' || status === 'CRITICAL') {
        const threshold = status === 'CRITICAL'
          ? (numValue > (monitor.criticalMax || 0) ? monitor.criticalMax : monitor.criticalMin)
          : (numValue > (monitor.warningMax || 0) ? monitor.warningMax : monitor.warningMin);

        await prisma.$executeRaw`
          INSERT INTO "ConditionAlert" (
            "monitorId", "readingId", "alertType", "value", "threshold", "message", "createdAt"
          ) VALUES (
            ${monitorId}, ${readingResult[0]?.id}, ${status}, ${numValue}, ${threshold},
            ${`${monitor.name}: valor ${numValue} ${monitor.unit} fuera de rango ${status}`}, NOW()
          )
        `;
      }

      return NextResponse.json({ success: true, readingId: readingResult[0]?.id, status }, { status: 201 });
    }

    return NextResponse.json({ error: 'Acción no válida' }, { status: 400 });
  } catch (error) {
    console.error('Error in condition monitoring:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
