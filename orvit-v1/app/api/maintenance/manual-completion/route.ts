import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

// POST /api/maintenance/manual-completion - Marcar mantenimiento como completado manualmente
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      maintenanceId,
      companyId,
      sectorId,
      task,
      datePerformed,
      rescheduleDate,
      kilometers,
      hours,
      actualDuration,
      notes,
      problems,
      responsible,
      responsibleId,
      isUnique,
      equipment
    } = body;

    console.log('🔧 [MANUAL COMPLETION] Received request:', {
      maintenanceId,
      companyId,
      sectorId,
      task,
      datePerformed,
      rescheduleDate,
      kilometers,
      hours,
      responsible,
      isUnique,
      equipment
    });

    // Validar datos requeridos
    if (!maintenanceId || !companyId || !sectorId) {
      return NextResponse.json({
        success: false,
        error: 'maintenanceId, companyId y sectorId son requeridos'
      }, { status: 400 });
    }

    // Buscar el mantenimiento preventivo por ID
    const maintenanceDoc = await prisma.document.findFirst({
      where: {
        id: parseInt(maintenanceId),
        entityType: 'PREVENTIVE_MAINTENANCE_TEMPLATE'
      }
    });

    if (!maintenanceDoc) {
      return NextResponse.json({
        success: false,
        error: `No se encontró un mantenimiento preventivo con ID ${maintenanceId}`
      }, { status: 404 });
    }

    // Parsear los datos del mantenimiento
    const maintenanceData = JSON.parse(maintenanceDoc.url);

    // Verificar que pertenece a la empresa y sector correctos
    if (maintenanceData.companyId !== companyId) {
      return NextResponse.json({
        success: false,
        error: 'El mantenimiento no pertenece a la empresa especificada'
      }, { status: 403 });
    }

    // Convertir fecha de realización
    const performedDate = parseDateDDMMYYYY(datePerformed);
    const newDate = rescheduleDate ? parseDateDDMMYYYY(rescheduleDate) : null;

    // Crear registro de ejecución
    const executionRecord = {
      id: `manual-${Date.now()}`,
      executedAt: performedDate.toISOString(),
      actualDuration: actualDuration ? parseFloat(actualDuration) : (hours ? parseFloat(hours) : null),
      actualDurationUnit: 'HOURS',
      actualValue: kilometers ? parseFloat(kilometers) : null,
      actualUnit: kilometers ? 'KILOMETERS' : null,
      notes: `Servicio cargado manualmente: ${task}${equipment ? ` - Equipo: ${equipment}` : ''}${responsible ? ` - Responsable: ${responsible}` : ''}${notes ? ` - Notas: ${notes}` : ''}`,
      issues: problems || '',
      efficiency: null,
      variance: null,
      cost: null,
      qualityScore: null,
      completionStatus: rescheduleDate ? 'RESCHEDULED' : 'COMPLETED',
      executedBy: responsible || 'Usuario del sistema',
      executedById: responsibleId || null,
      originalDate: maintenanceData.nextMaintenanceDate,
      newDate: newDate?.toISOString(),
      rescheduleReason: rescheduleDate ? `Reprogramado manualmente para ${rescheduleDate}` : null,
      isUnique: isUnique || false,
      manualExecutionNotes: notes || '',
      manualExecutionProblems: problems || '',
      manualExecutionKilometers: kilometers || null,
      manualExecutionActualDuration: actualDuration || null
    };

    // Actualizar los datos del mantenimiento
    const updatedData = {
      ...maintenanceData,
      lastMaintenanceDate: rescheduleDate ? null : performedDate.toISOString(),
      lastExecutionDate: performedDate.toISOString(),
      lastExecutionNotes: executionRecord.notes,
      lastExecutedBy: executionRecord.executedBy,
      lastExecutionDuration: executionRecord.actualDuration,
      nextMaintenanceDate: newDate?.toISOString() || maintenanceData.nextMaintenanceDate,
      status: rescheduleDate ? 'SCHEDULED' : 'COMPLETED',
      // Agregar al historial de ejecuciones
      executionHistory: [
        executionRecord,
        ...(maintenanceData.executionHistory || [])
      ]
    };

    // Guardar el documento actualizado
    await prisma.document.update({
      where: { id: parseInt(maintenanceId) },
      data: {
        url: JSON.stringify(updatedData),
        updatedAt: new Date()
      }
    });

    console.log('✅ [MANUAL COMPLETION] Maintenance updated successfully:', {
      maintenanceId,
      status: updatedData.status,
      executedAt: executionRecord.executedAt,
      nextMaintenanceDate: updatedData.nextMaintenanceDate
    });

    return NextResponse.json({
      success: true,
      message: 'Mantenimiento marcado como completado exitosamente',
      data: {
        maintenanceId,
        status: updatedData.status,
        executedAt: executionRecord.executedAt,
        nextMaintenanceDate: updatedData.nextMaintenanceDate
      }
    });

  } catch (error) {
    console.error('❌ [MANUAL COMPLETION] Error:', error);
    return NextResponse.json({
      success: false,
      error: 'Error interno del servidor'
    }, { status: 500 });
  }
}

// Función para parsear fechas en formato DD/MM/YYYY
function parseDateDDMMYYYY(dateString: string): Date {
  if (!dateString || dateString === '//') {
    return new Date();
  }

  const parts = dateString.split('/');
  if (parts.length !== 3) {
    throw new Error('Formato de fecha inválido. Use DD/MM/YYYY');
  }

  const day = parseInt(parts[0]);
  const month = parseInt(parts[1]) - 1; // Los meses en JavaScript van de 0-11
  const year = parseInt(parts[2]);

  if (isNaN(day) || isNaN(month) || isNaN(year)) {
    throw new Error('Fecha inválida');
  }

  return new Date(year, month, day);
}
