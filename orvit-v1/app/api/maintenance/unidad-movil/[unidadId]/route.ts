import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth/shared-helpers';

export async function GET(
  request: NextRequest,
  { params }: { params: { unidadId: string } }
) {
  try {
    const { user, error: authError } = await requireAuth();
    if (authError) return authError;

    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get('companyId');
    const unidadId = params.unidadId;

    if (!companyId || !unidadId) {
      return NextResponse.json({
        success: false,
        error: 'companyId and unidadId are required'
      }, { status: 400 });
    }

    // ✅ OPTIMIZADO: Ejecutar ambas queries en paralelo
    const [preventiveMaintenances, correctiveMaintenances] = await Promise.all([
      // Buscar mantenimientos preventivos asociados a la unidad móvil
      prisma.document.findMany({
        where: {
          companyId: parseInt(companyId),
          OR: [
            {
              entityType: 'PREVENTIVE_MAINTENANCE_TEMPLATE',
              entityId: { startsWith: `mobile-${unidadId}` }
            },
            {
              entityType: 'PREVENTIVE_MAINTENANCE_INSTANCE',
              entityId: { contains: `mobile-${unidadId}` }
            },
            {
              entityType: 'PREVENTIVE_MAINTENANCE_TEMPLATE',
              url: { contains: `"unidadMovilId":${unidadId}` }
            },
            {
              entityType: 'PREVENTIVE_MAINTENANCE_INSTANCE',
              url: { contains: `"unidadMovilId":${unidadId}` }
            }
          ]
        }
      }),
      // Buscar órdenes de trabajo (mantenimientos correctivos) asociadas a la unidad móvil
      prisma.workOrder.findMany({
        where: {
          companyId: parseInt(companyId),
          unidadMovilId: parseInt(unidadId)
        },
        include: { assignedTo: true }
      })
    ]);

    // Procesar mantenimientos preventivos
    const processedPreventive = preventiveMaintenances.map(doc => {
      try {
        const data = JSON.parse(doc.url);
        
        // Extraer frecuencia de los datos almacenados PRIMERO
        let frequency = undefined;
        let frequencyUnit = undefined;

        // Intentar extraer frecuencia de diferentes campos posibles
        let frequencyDays = data.frequencyDays || data.frequency || data.frequencyValue;
        
        if (frequencyDays) {
          const days = Number(frequencyDays);
          
          if (days >= 365) {
            frequency = Math.floor(days / 365).toString();
            frequencyUnit = 'years';
          } else if (days >= 30) {
            frequency = Math.floor(days / 30).toString();
            frequencyUnit = 'months';
          } else if (days >= 7) {
            frequency = Math.floor(days / 7).toString();
            frequencyUnit = 'weeks';
          } else {
            frequency = days.toString();
            frequencyUnit = 'days';
          }
          
        } else {
          // Si no hay datos de frecuencia, usar valores por defecto para mantenimientos preventivos
          if (data.title && data.title.toLowerCase().includes('aceite')) {
            frequency = '1';
            frequencyUnit = 'months';
          } else {
            frequency = '1';
            frequencyUnit = 'months';
          }
        }

        // Determinar fechas correctamente
        let scheduledDate = data.nextMaintenanceDate;
        let completedDate = undefined;
        
        // Si el mantenimiento está completado, usar la fecha de completado
        if (data.status === 'COMPLETED' && data.completedDate) {
          completedDate = data.completedDate;
        } else if (data.status === 'COMPLETED' && data.lastMaintenanceDate) {
          // Si no hay fecha de completado específica, usar la última fecha de mantenimiento
          completedDate = data.lastMaintenanceDate;
        }
        
        // FORZAR cálculo de próxima fecha para mantenimientos completados
        if (completedDate && frequency && frequencyUnit) {
          const completed = new Date(completedDate);
          const freq = parseInt(frequency);

          // Calcular la próxima fecha basada en la frecuencia
          let nextDate = new Date(completed);
          
          switch (frequencyUnit) {
            case 'days':
              nextDate.setDate(nextDate.getDate() + freq);
              break;
            case 'weeks':
              nextDate.setDate(nextDate.getDate() + (freq * 7));
              break;
            case 'months':
              nextDate.setMonth(nextDate.getMonth() + freq);
              break;
            case 'years':
              nextDate.setFullYear(nextDate.getFullYear() + freq);
              break;
          }
          
          scheduledDate = nextDate.toISOString();
        } else {
        }
        
        return {
          id: doc.id,
          title: data.title || 'Mantenimiento Preventivo',
          description: data.description,
          type: 'PREVENTIVE' as const,
          status: data.status === 'COMPLETED' ? 'COMPLETED' : 'PENDING',
          priority: data.priority || 'MEDIUM',
          scheduledDate: scheduledDate,
          completedDate: completedDate,
          assignedTo: data.assignedToId ? {
            id: data.assignedToId,
            name: data.assignedToName || 'Usuario no especificado'
          } : undefined,
          estimatedTime: data.estimatedTime,
          actualTime: data.actualTime,
          notes: data.notes,
          issues: data.issues,
          frequency: frequency, // Usar la frecuencia calculada
          frequencyUnit: frequencyUnit // Usar la unidad calculada
        };
      } catch (error) {
        console.error('Error parsing preventive maintenance data:', error);
        return {
          id: doc.id,
          title: 'Mantenimiento Preventivo',
          description: 'Error al cargar datos',
          type: 'PREVENTIVE' as const,
          status: 'PENDING' as const,
          priority: 'MEDIUM' as const
        };
      }
    });

    // Procesar mantenimientos correctivos
    const processedCorrective = correctiveMaintenances.map(workOrder => ({
      id: workOrder.id,
      title: workOrder.title,
      description: workOrder.description,
      type: 'CORRECTIVE' as const,
      status: workOrder.status === 'COMPLETED' ? 'COMPLETED' : 
              workOrder.status === 'IN_PROGRESS' ? 'IN_PROGRESS' : 'PENDING',
      priority: workOrder.priority || 'MEDIUM',
      scheduledDate: workOrder.scheduledDate,
      completedDate: workOrder.completedDate,
      assignedTo: workOrder.assignedTo ? {
        id: workOrder.assignedTo.id,
        name: workOrder.assignedTo.name
      } : undefined,
      estimatedTime: workOrder.estimatedTime,
      actualTime: workOrder.actualTime,
      notes: workOrder.notes,
      issues: workOrder.issues,
      frequency: workOrder.frequency,
      frequencyUnit: workOrder.frequencyUnit
    }));

    // Combinar todos los mantenimientos
    const allMaintenances = [...processedPreventive, ...processedCorrective];

    // Ordenar por fecha de programación (más recientes primero)
    allMaintenances.sort((a, b) => {
      const dateA = a.scheduledDate ? new Date(a.scheduledDate) : new Date(0);
      const dateB = b.scheduledDate ? new Date(b.scheduledDate) : new Date(0);
      return dateB.getTime() - dateA.getTime();
    });

    return NextResponse.json({
      success: true,
      maintenances: allMaintenances
    });

  } catch (error: any) {
    console.error('Error fetching unit maintenances:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Internal server error'
    }, { status: 500 });
  }
}
