import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { getPayrollAuth, hasPayrollAccess } from '@/lib/nominas/auth-helper';

export const dynamic = 'force-dynamic';

interface RouteParams {
  params: { id: string };
}

// Tipos de eventos de asistencia
export type AttendanceEventType =
  | 'ABSENCE'       // Falta
  | 'LATE_ARRIVAL'  // Llegada tarde
  | 'EARLY_LEAVE'   // Salida temprana
  | 'VACATION'      // Vacaciones
  | 'SICK_LEAVE'    // Licencia por enfermedad
  | 'ACCIDENT'      // Accidente laboral
  | 'SUSPENSION';   // Suspensión

// GET - Obtener eventos de asistencia de un período
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const auth = await getPayrollAuth();
    if (!auth) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const periodId = parseInt(params.id);
    if (isNaN(periodId)) {
      return NextResponse.json({ error: 'ID de período inválido' }, { status: 400 });
    }

    const { searchParams } = new URL(request.url);
    const employeeId = searchParams.get('employeeId');
    const eventType = searchParams.get('eventType');

    // Verificar período
    const period = await prisma.$queryRaw<any[]>`
      SELECT pp.id, pp.period_type, pp.year, pp.month,
             pp.period_start, pp.period_end, ec.name as category_name,
             ec.attendance_policy_json as attendance_policy
      FROM payroll_periods pp
      LEFT JOIN employee_categories ec ON ec.id = pp.category_id
      WHERE pp.id = ${periodId} AND pp.company_id = ${auth.companyId}
    `;

    if (period.length === 0) {
      return NextResponse.json({ error: 'Período no encontrado' }, { status: 404 });
    }

    // Construir filtros dinámicos
    const employeeFilter = employeeId
      ? Prisma.sql`AND ae.employee_id = ${employeeId}`
      : Prisma.empty;
    const eventTypeFilter = eventType
      ? Prisma.sql`AND ae.event_type = ${eventType}`
      : Prisma.empty;

    const events = await prisma.$queryRaw<any[]>`
      SELECT
        ae.id,
        ae.period_id as "periodId",
        ae.employee_id as "employeeId",
        ae.event_type as "eventType",
        ae.event_date as "eventDate",
        ae.quantity,
        ae.minutes_late as "minutesLate",
        ae.comment,
        ae.generated_concept_id as "generatedConceptId",
        ae.source,
        ae.created_by as "createdBy",
        ae.created_at as "createdAt",
        e.name as "employeeName"
      FROM attendance_events ae
      JOIN employees e ON e.id = ae.employee_id
      WHERE ae.period_id = ${periodId}
        ${employeeFilter}
        ${eventTypeFilter}
      ORDER BY ae.event_date DESC, e.name ASC
    `;

    const processedEvents = events.map((e: any) => ({
      ...e,
      id: Number(e.id),
      periodId: Number(e.periodId),
      quantity: parseFloat(e.quantity),
      minutesLate: e.minutesLate ? Number(e.minutesLate) : null,
      generatedConceptId: e.generatedConceptId ? Number(e.generatedConceptId) : null,
      createdBy: e.createdBy ? Number(e.createdBy) : null
    }));

    // Resumen por empleado y tipo
    const summary = processedEvents.reduce((acc: any, e: any) => {
      if (!acc[e.employeeId]) {
        acc[e.employeeId] = {
          employeeId: e.employeeId,
          employeeName: e.employeeName,
          absences: 0,
          lateArrivals: 0,
          totalLateMinutes: 0,
          vacationDays: 0,
          sickDays: 0,
          otherDays: 0
        };
      }

      switch (e.eventType) {
        case 'ABSENCE':
          acc[e.employeeId].absences += parseFloat(e.quantity);
          break;
        case 'LATE_ARRIVAL':
          acc[e.employeeId].lateArrivals += 1;
          acc[e.employeeId].totalLateMinutes += e.minutesLate || 0;
          break;
        case 'VACATION':
          acc[e.employeeId].vacationDays += parseFloat(e.quantity);
          break;
        case 'SICK_LEAVE':
        case 'ACCIDENT':
          acc[e.employeeId].sickDays += parseFloat(e.quantity);
          break;
        default:
          acc[e.employeeId].otherDays += parseFloat(e.quantity);
      }

      return acc;
    }, {});

    return NextResponse.json({
      period: {
        id: periodId,
        periodType: period[0].period_type,
        year: period[0].year,
        month: period[0].month,
        categoryName: period[0].category_name,
        periodStart: period[0].period_start,
        periodEnd: period[0].period_end,
        attendancePolicy: period[0].attendance_policy
      },
      events: processedEvents,
      summaryByEmployee: Object.values(summary),
      totals: {
        totalEvents: processedEvents.length,
        absences: processedEvents.filter(e => e.eventType === 'ABSENCE').reduce((sum, e) => sum + e.quantity, 0),
        lateArrivals: processedEvents.filter(e => e.eventType === 'LATE_ARRIVAL').length
      }
    });
  } catch (error) {
    console.error('Error obteniendo eventos de asistencia:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

// POST - Crear evento de asistencia
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const auth = await getPayrollAuth();
    if (!auth || !hasPayrollAccess(auth.user)) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const periodId = parseInt(params.id);
    if (isNaN(periodId)) {
      return NextResponse.json({ error: 'ID de período inválido' }, { status: 400 });
    }

    const body = await request.json();
    const {
      employeeId,
      eventType,
      eventDate,
      quantity = 1,
      minutesLate,
      comment,
      source = 'MANUAL',
      generateConcept = true // Si debe generar concepto variable automáticamente
    } = body;

    if (!employeeId || !eventType || !eventDate) {
      return NextResponse.json(
        { error: 'employeeId, eventType y eventDate son requeridos' },
        { status: 400 }
      );
    }

    // Validar eventType
    const validTypes = ['ABSENCE', 'LATE_ARRIVAL', 'EARLY_LEAVE', 'VACATION', 'SICK_LEAVE', 'ACCIDENT', 'SUSPENSION'];
    if (!validTypes.includes(eventType)) {
      return NextResponse.json(
        { error: 'Tipo de evento inválido' },
        { status: 400 }
      );
    }

    // Verificar período
    const period = await prisma.$queryRaw<any[]>`
      SELECT pp.id, pp.is_closed, ec.attendance_policy_json
      FROM payroll_periods pp
      LEFT JOIN employee_categories ec ON ec.id = pp.category_id
      WHERE pp.id = ${periodId} AND pp.company_id = ${auth.companyId}
    `;

    if (period.length === 0) {
      return NextResponse.json({ error: 'Período no encontrado' }, { status: 404 });
    }

    if (period[0].is_closed) {
      return NextResponse.json(
        { error: 'El período está cerrado' },
        { status: 400 }
      );
    }

    // Verificar empleado
    const employee = await prisma.$queryRaw<any[]>`
      SELECT id, name FROM employees
      WHERE id = ${employeeId} AND company_id = ${auth.companyId}
    `;

    if (employee.length === 0) {
      return NextResponse.json({ error: 'Empleado no encontrado' }, { status: 404 });
    }

    let generatedConceptId = null;

    // Generar concepto variable si corresponde
    if (generateConcept && (eventType === 'ABSENCE' || eventType === 'LATE_ARRIVAL')) {
      // Buscar componente de descuento correspondiente
      const discountComponent = await prisma.$queryRaw<any[]>`
        SELECT id, code FROM salary_components
        WHERE company_id = ${auth.companyId}
          AND type = 'DEDUCTION'
          AND is_active = true
          AND (
            (${eventType} = 'ABSENCE' AND (code ILIKE '%FALT%' OR code ILIKE '%AUSENC%'))
            OR
            (${eventType} = 'LATE_ARRIVAL' AND (code ILIKE '%TARD%' OR code ILIKE '%LLEGADA%'))
          )
        LIMIT 1
      `;

      if (discountComponent.length > 0) {
        // Crear concepto variable de descuento
        const conceptResult = await prisma.$queryRaw<any[]>`
          INSERT INTO payroll_variable_concepts (
            period_id, employee_id, component_id,
            quantity, unit_amount, transaction_date, comment,
            status, source, created_by, created_at
          )
          VALUES (
            ${periodId},
            ${employeeId},
            ${discountComponent[0].id},
            ${parseFloat(String(quantity))},
            0, -- El monto se calcula en la liquidación
            ${new Date(eventDate)}::date,
            ${comment || `Generado por evento: ${eventType}`},
            'DRAFT',
            'ATTENDANCE',
            ${auth.user.id},
            NOW()
          )
          RETURNING id
        `;
        generatedConceptId = Number(conceptResult[0].id);
      }
    }

    const result = await prisma.$queryRaw<any[]>`
      INSERT INTO attendance_events (
        period_id, employee_id, event_type, event_date,
        quantity, minutes_late, comment,
        generated_concept_id, source, created_by, created_at
      )
      VALUES (
        ${periodId},
        ${employeeId},
        ${eventType},
        ${new Date(eventDate)}::date,
        ${parseFloat(String(quantity))},
        ${minutesLate ? parseInt(String(minutesLate)) : null},
        ${comment || null},
        ${generatedConceptId},
        ${source},
        ${auth.user.id},
        NOW()
      )
      RETURNING
        id,
        period_id as "periodId",
        employee_id as "employeeId",
        event_type as "eventType",
        event_date as "eventDate",
        quantity,
        minutes_late as "minutesLate",
        comment,
        generated_concept_id as "generatedConceptId",
        source,
        created_at as "createdAt"
    `;

    const newEvent = result[0];
    return NextResponse.json({
      ...newEvent,
      id: Number(newEvent.id),
      periodId: Number(newEvent.periodId),
      quantity: parseFloat(newEvent.quantity),
      minutesLate: newEvent.minutesLate ? Number(newEvent.minutesLate) : null,
      generatedConceptId: newEvent.generatedConceptId ? Number(newEvent.generatedConceptId) : null,
      employeeName: employee[0].name
    }, { status: 201 });
  } catch (error) {
    console.error('Error creando evento de asistencia:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

// DELETE - Eliminar evento de asistencia
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const auth = await getPayrollAuth();
    if (!auth || !hasPayrollAccess(auth.user)) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const periodId = parseInt(params.id);
    const { searchParams } = new URL(request.url);
    const eventId = searchParams.get('eventId');

    if (!eventId) {
      return NextResponse.json(
        { error: 'eventId es requerido' },
        { status: 400 }
      );
    }

    // Verificar que existe
    const existing = await prisma.$queryRaw<any[]>`
      SELECT ae.id, ae.generated_concept_id
      FROM attendance_events ae
      JOIN payroll_periods pp ON pp.id = ae.period_id
      WHERE ae.id = ${parseInt(eventId)}
        AND ae.period_id = ${periodId}
        AND pp.company_id = ${auth.companyId}
    `;

    if (existing.length === 0) {
      return NextResponse.json({ error: 'Evento no encontrado' }, { status: 404 });
    }

    // Si tiene concepto generado, eliminarlo también
    if (existing[0].generated_concept_id) {
      await prisma.$queryRaw`
        DELETE FROM payroll_variable_concepts
        WHERE id = ${existing[0].generated_concept_id}
      `;
    }

    // Eliminar evento
    await prisma.$queryRaw`
      DELETE FROM attendance_events
      WHERE id = ${parseInt(eventId)}
    `;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error eliminando evento de asistencia:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
