import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';


export async function GET(request: NextRequest) {
  try {
    console.log('🚀 Iniciando smart checklists API...');
    
    const { searchParams } = new URL(request.url);
    const companyId = parseInt(searchParams.get('companyId') || '0');
    const sectorId = searchParams.get('sectorId') ? parseInt(searchParams.get('sectorId')!) : null;
    const machineId = searchParams.get('machineId') ? parseInt(searchParams.get('machineId')!) : null;

    console.log('📋 Parámetros recibidos:', { companyId, sectorId, machineId });

    if (!companyId) {
      console.log('❌ companyId no proporcionado');
      return NextResponse.json(
        { error: 'companyId es requerido' },
        { status: 400 }
      );
    }

    console.log('🔍 Generando smart checklists para:', {
      companyId,
      sectorId,
      machineId
    });

    // 1. Obtener mantenimientos pendientes (hoy y mañana)
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dayAfterTomorrow = new Date(today);
    dayAfterTomorrow.setDate(dayAfterTomorrow.getDate() + 2);

    console.log('🔍 Buscando work orders y templates en paralelo...');
    
    // ✅ OPTIMIZADO: Ejecutar ambas queries en paralelo
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
      // Obtener mantenimientos preventivos pendientes
      prisma.document.findMany({
        where: {
          entityType: 'PREVENTIVE_MAINTENANCE_TEMPLATE',
          url: { contains: `"companyId":${companyId}` }
        }
      })
    ]);

    console.log('✅ Work orders pendientes:', pendingWorkOrders.length, '| Templates preventivos:', preventiveTemplates.length);

    const pendingPreventiveMaintenances = [];
    
    console.log('🔍 Procesando templates preventivos...');
    
    for (const template of preventiveTemplates) {
      try {
        const templateData = JSON.parse(template.url);
        
        if (templateData.isActive && templateData.nextMaintenanceDate) {
          const nextDate = new Date(templateData.nextMaintenanceDate);
          
          // Solo incluir si vence hoy o mañana
          if (nextDate >= today && nextDate < dayAfterTomorrow) {
            // Aplicar filtros adicionales
            if (sectorId && templateData.sectorId !== sectorId) continue;
            if (machineId && templateData.machineId !== machineId) continue;
            
            pendingPreventiveMaintenances.push({
              id: template.id,
              title: templateData.title,
              description: templateData.description,
              priority: templateData.priority,
              type: 'PREVENTIVE',
              machineId: templateData.machineId,
              machineName: templateData.machineName,
              assignedToId: templateData.assignedToId,
              assignedToName: templateData.assignedToName,
              nextMaintenanceDate: templateData.nextMaintenanceDate,
              frequencyDays: templateData.frequencyDays,
              estimatedHours: templateData.estimatedHours,
              estimatedValue: templateData.estimatedValue,
              timeUnit: templateData.timeUnit,
              notes: templateData.notes || '',
              componentIds: templateData.componentIds || [],
              subcomponentIds: templateData.subcomponentIds || []
            });
          }
        }
      } catch (error) {
        console.error('Error parsing preventive template:', template.id, error);
      }
    }

    console.log('✅ Mantenimientos preventivos pendientes procesados:', pendingPreventiveMaintenances.length);

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

    console.log('✅ Smart checklists generados:', {
      totalChecklists: smartChecklists.length,
      breakdown: smartChecklists.map(c => ({ 
        frequency: c.frequency, 
        count: c.totalMaintenances 
      }))
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
