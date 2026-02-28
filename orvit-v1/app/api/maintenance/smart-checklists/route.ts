import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth/shared-helpers';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { user, error: authError } = await requireAuth();
    if (authError) return authError;

    
    const { searchParams } = new URL(request.url);
    const companyId = parseInt(searchParams.get('companyId') || '0');
    const sectorId = searchParams.get('sectorId') ? parseInt(searchParams.get('sectorId')!) : null;
    const machineId = searchParams.get('machineId') ? parseInt(searchParams.get('machineId')!) : null;

    if (!companyId) {
      return NextResponse.json(
        { error: 'companyId es requerido' },
        { status: 400 }
      );
    }

    // 1. Obtener mantenimientos pendientes (hoy y mañana)
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dayAfterTomorrow = new Date(today);
    dayAfterTomorrow.setDate(dayAfterTomorrow.getDate() + 2);

    // ✅ MIGRADO: Queries directas a preventiveTemplate en lugar de JSON-in-Document

    // Construir filtro para templates preventivos
    const templateWhere: any = {
      companyId,
      isActive: true,
      nextMaintenanceDate: {
        gte: today,
        lt: dayAfterTomorrow,
      },
    };
    if (sectorId) templateWhere.sectorId = sectorId;
    if (machineId) templateWhere.machineId = machineId;

    const [pendingWorkOrders, preventiveTemplates] = await Promise.all([
      // Obtener work orders pendientes
      prisma.workOrder.findMany({
        where: {
          companyId,
          ...(sectorId && { sectorId }),
          ...(machineId && { machineId }),
          status: { in: ['PENDING', 'IN_PROGRESS'] }
        },
        include: {
          machine: { select: { id: true, name: true, type: true } },
          assignedTo: { select: { id: true, name: true, email: true } }
        }
      }),
      // Obtener mantenimientos preventivos pendientes directamente de la tabla
      prisma.preventiveTemplate.findMany({
        where: templateWhere,
      })
    ]);

    const pendingPreventiveMaintenances = preventiveTemplates.map((tpl) => ({
      id: tpl.id,
      title: tpl.title,
      description: tpl.description,
      priority: tpl.priority,
      type: 'PREVENTIVE' as const,
      machineId: tpl.machineId,
      machineName: tpl.machineName,
      assignedToId: tpl.assignedToId,
      assignedToName: tpl.assignedToName,
      nextMaintenanceDate: tpl.nextMaintenanceDate?.toISOString() || null,
      frequencyDays: tpl.frequencyDays,
      estimatedHours: tpl.estimatedHours,
      estimatedValue: tpl.timeValue,
      timeUnit: tpl.timeUnit,
      notes: tpl.notes || '',
      componentIds: tpl.componentIds || [],
      subcomponentIds: tpl.subcomponentIds || []
    }));

    // 3. Agrupar mantenimientos por frecuencia
    const groupedMaintenances = {
      DAILY: [],
      WEEKLY: [],
      BIWEEKLY: [],
      MONTHLY: [],
      QUARTERLY: [],
      SEMIANNUAL: [],
      ANNUAL: [],
      CORRECTIVE: [] // Para work orders correctivos
    };

    // Agregar work orders (principalmente correctivos)
    pendingWorkOrders.forEach(wo => {
      groupedMaintenances.CORRECTIVE.push({
        id: wo.id,
        title: wo.title,
        description: wo.description,
        priority: wo.priority,
        type: 'CORRECTIVE',
        machineId: wo.machineId,
        machineName: wo.machine?.name,
        assignedToId: wo.assignedToId,
        assignedToName: wo.assignedTo?.name,
        dueDate: wo.createdAt, // Usar createdAt como fecha de referencia
        estimatedHours: wo.estimatedHours,
        notes: wo.notes || ''
      });
    });

    // Agregar mantenimientos preventivos agrupados por frecuencia
    pendingPreventiveMaintenances.forEach(pm => {
      const frequency = determineFrequency(pm.frequencyDays);
      if (groupedMaintenances[frequency]) {
        groupedMaintenances[frequency].push(pm);
      }
    });

    // 4. Crear checklists inteligentes
    const smartChecklists = [];

    for (const [frequency, maintenances] of Object.entries(groupedMaintenances)) {
      if (maintenances.length > 0) {
        const checklist = {
          id: `smart-${frequency}-${Date.now()}`,
          title: getFrequencyTitle(frequency),
          description: `Mantenimientos ${getFrequencyLabel(frequency)} pendientes para hoy y mañana`,
          frequency: frequency,
          type: 'SMART',
          maintenances: maintenances,
          totalMaintenances: maintenances.length,
          estimatedTotalTime: maintenances.reduce((sum, m) => sum + (m.estimatedHours || 1), 0),
          priorities: {
            HIGH: maintenances.filter(m => m.priority === 'HIGH').length,
            MEDIUM: maintenances.filter(m => m.priority === 'MEDIUM').length,
            LOW: maintenances.filter(m => m.priority === 'LOW').length
          },
          machines: [...new Set(maintenances.map(m => m.machineName).filter(Boolean))],
          assignees: [...new Set(maintenances.map(m => m.assignedToName).filter(Boolean))]
        };

        smartChecklists.push(checklist);
      }
    }

    // Ordenar por prioridad (correctivos primero, luego por frecuencia)
    smartChecklists.sort((a, b) => {
      const priorityOrder = {
        'CORRECTIVE': 0,
        'DAILY': 1,
        'WEEKLY': 2,
        'BIWEEKLY': 3,
        'MONTHLY': 4,
        'QUARTERLY': 5,
        'SEMIANNUAL': 6,
        'ANNUAL': 7
      };
      return priorityOrder[a.frequency] - priorityOrder[b.frequency];
    });

    return NextResponse.json({
      success: true,
      checklists: smartChecklists,
      summary: {
        totalChecklists: smartChecklists.length,
        totalMaintenances: smartChecklists.reduce((sum, c) => sum + c.totalMaintenances, 0),
        estimatedTotalTime: smartChecklists.reduce((sum, c) => sum + c.estimatedTotalTime, 0)
      }
    });

  } catch (error) {
    console.error('❌ Error generating smart checklists:', error);
    console.error('❌ Error stack:', error instanceof Error ? error.stack : 'No stack available');
    return NextResponse.json(
      { error: 'Error interno del servidor', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// Función para determinar frecuencia basada en días
function determineFrequency(frequencyDays: number): string {
  if (frequencyDays <= 1) return 'DAILY';
  if (frequencyDays <= 7) return 'WEEKLY';
  if (frequencyDays <= 14) return 'BIWEEKLY';
  if (frequencyDays <= 31) return 'MONTHLY';
  if (frequencyDays <= 93) return 'QUARTERLY';
  if (frequencyDays <= 186) return 'SEMIANNUAL';
  return 'ANNUAL';
}

// Función para obtener título de frecuencia
function getFrequencyTitle(frequency: string): string {
  const titles = {
    'DAILY': 'Checklist Diario',
    'WEEKLY': 'Checklist Semanal',
    'BIWEEKLY': 'Checklist Quincenal',
    'MONTHLY': 'Checklist Mensual',
    'QUARTERLY': 'Checklist Trimestral',
    'SEMIANNUAL': 'Checklist Semestral',
    'ANNUAL': 'Checklist Anual',
    'CORRECTIVE': 'Checklist Correctivo'
  };
  return titles[frequency] || 'Checklist';
}

// Función para obtener etiqueta de frecuencia
function getFrequencyLabel(frequency: string): string {
  const labels = {
    'DAILY': 'diarios',
    'WEEKLY': 'semanales',
    'BIWEEKLY': 'quincenales',
    'MONTHLY': 'mensuales',
    'QUARTERLY': 'trimestrales',
    'SEMIANNUAL': 'semestrales',
    'ANNUAL': 'anuales',
    'CORRECTIVE': 'correctivos'
  };
  return labels[frequency] || 'periódicos';
}
