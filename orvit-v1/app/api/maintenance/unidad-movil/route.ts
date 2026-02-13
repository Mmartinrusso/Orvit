import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';


// POST - Crear mantenimiento preventivo para unidad móvil
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      id,
      title,
      description,
      type,
      priority,
      unidadMovilId,
      assignedToId,
      estimatedHours,
      estimatedMinutes,
      estimatedTimeType,
      maintenanceTrigger,
      triggerValue,
      maintenanceInterval,
      maintenanceIntervalType,
      currentKilometers,
      nextMaintenanceKilometers,
      scheduledDate,
      tools,
      spareParts,
      instructives,
      uploadedFiles,
      frequency,
      frequencyDays,
      companyId,
      sectorId
    } = body;

    console.log('🔧 Creando mantenimiento preventivo para unidad móvil:', {
      title,
      unidadMovilId,
      type,
      maintenanceTrigger,
      triggerValue,
      maintenanceInterval,
      maintenanceIntervalType,
      companyId,
      sectorId,
      estimatedHours,
      estimatedMinutes,
      estimatedTimeType,
      frequency,
      frequencyDays,
      uploadedFilesCount: uploadedFiles?.length || 0
    });

    // Validar que la unidad móvil existe
    const unidad = await prisma.unidadMovil.findUnique({
      where: { id: unidadMovilId }
    });

    if (!unidad) {
      return NextResponse.json(
        { error: 'Unidad móvil no encontrada' },
        { status: 404 }
      );
    }

    // Verificar si ya existe un mantenimiento con el mismo título para esta unidad móvil
    // Solo verificar si no estamos editando un mantenimiento existente
    const isEditMode = body.id || body.templateId;
    
    if (!isEditMode) {
      const existingMaintenance = await prisma.document.findFirst({
        where: {
          entityType: 'PREVENTIVE_MAINTENANCE_TEMPLATE',
          url: {
            contains: `"unidadMovilId":${unidadMovilId}`
          }
        }
      });

      if (existingMaintenance) {
        try {
          const existingData = JSON.parse(existingMaintenance.url);
          if (existingData.title === title) {
            return NextResponse.json(
              { error: `Ya existe un mantenimiento "${title}" para esta unidad móvil` },
              { status: 400 }
            );
          }
        } catch (error) {
          console.log('Error parsing existing maintenance data:', error);
        }
      }
    }

    // Crear el template de mantenimiento preventivo
    const maintenanceData = {
      title,
      description: description || '',
      type: type || 'PREVENTIVE',
      priority: priority || 'MEDIUM',
      unidadMovilId,
      unidadMovilName: unidad.nombre, // Incluir el nombre de la unidad móvil
      machineId: null, // Para unidades móviles, machineId es null
      companyId,
      sectorId,
      assignedToId: assignedToId || null,
      estimatedHours: estimatedHours || 2,
      estimatedMinutes: estimatedMinutes || 0,
      estimatedTimeType: estimatedTimeType || 'MINUTES',
      maintenanceTrigger: maintenanceTrigger || 'KILOMETERS',
      triggerValue: triggerValue || 10000,
      maintenanceInterval: maintenanceInterval || 0, // Agregar intervalo de mantenimiento
      maintenanceIntervalType: maintenanceIntervalType || 'DAYS', // Agregar tipo de intervalo
      currentKilometers: currentKilometers || 0,
      nextMaintenanceKilometers: nextMaintenanceKilometers || 0,
      scheduledDate: scheduledDate ? new Date(scheduledDate) : new Date(),
      tools: tools || [],
      spareParts: spareParts || [],
      instructives: instructives || [],
      uploadedFiles: uploadedFiles || [], // Incluir información de archivos subidos
      frequency: frequency || 'MONTHLY', // Usar la frecuencia seleccionada
      frequencyDays: frequencyDays || 30, // Incluir días de frecuencia
      isRecurring: true,
      isActive: true
    };

    let preventiveTemplate;

    if (id && isEditMode) {
      // Actualizar mantenimiento existente
      console.log('📝 Actualizando mantenimiento existente con ID:', id);
      
      preventiveTemplate = await prisma.document.update({
        where: { id: parseInt(id) },
        data: {
          name: `Template: ${title}`,
          url: JSON.stringify(maintenanceData),
          uploadedById: assignedToId || null
        }
      });

      console.log('✅ Mantenimiento actualizado exitosamente');
    } else {
      // Crear nuevo mantenimiento
      console.log('📝 Creando nuevo documento en la base de datos...');
      console.log('📝 Datos del documento:', {
        name: `Template: ${title}`,
        url: JSON.stringify(maintenanceData),
        entityType: 'PREVENTIVE_MAINTENANCE_TEMPLATE',
        entityId: `unidad-${unidadMovilId}-${Date.now()}`,
        companyId,
        uploadedById: assignedToId || null
      });

      preventiveTemplate = await prisma.document.create({
        data: {
          name: `Template: ${title}`,
          url: JSON.stringify(maintenanceData),
          entityType: 'PREVENTIVE_MAINTENANCE_TEMPLATE',
          entityId: `unidad-${unidadMovilId}-${Date.now()}`,
          companyId,
          uploadedById: assignedToId || null
        }
      });

      console.log('✅ Template de mantenimiento preventivo creado:', {
        templateId: preventiveTemplate.id,
        unidad: unidad.nombre,
        type: maintenanceData.type
      });

      // Crear la primera instancia programada solo para nuevos mantenimientos
      const firstInstanceData = {
        ...maintenanceData,
        templateId: preventiveTemplate.id,
        status: 'SCHEDULED',
        scheduledDate: maintenanceData.scheduledDate
      };

      const firstInstance = await prisma.document.create({
        data: {
          name: `Instancia: ${title}`,
          url: JSON.stringify(firstInstanceData),
          entityType: 'PREVENTIVE_MAINTENANCE_INSTANCE',
          entityId: `template-${preventiveTemplate.id}-instance-1`,
          companyId,
          uploadedById: assignedToId || null
        }
      });

      console.log('✅ Primera instancia creada:', {
        instanceId: firstInstance.id,
        scheduledDate: maintenanceData.scheduledDate
      });
    }

    // Actualizar la unidad móvil con la información de mantenimiento
    await prisma.unidadMovil.update({
      where: { id: unidadMovilId },
      data: {
        proximoMantenimiento: maintenanceData.scheduledDate,
        updatedAt: new Date()
      }
    });

    console.log('✅ Mantenimiento preventivo para unidad móvil procesado exitosamente');

    const response = {
      success: true,
      template: {
        id: preventiveTemplate.id,
        title,
        unidad: unidad.nombre,
        type: maintenanceData.type,
        nextMaintenance: maintenanceData.scheduledDate.toISOString()
      },
      message: isEditMode ? 'Mantenimiento actualizado correctamente' : 'Mantenimiento preventivo para unidad móvil creado correctamente'
    };

    // Solo incluir instance si no estamos editando
    if (!isEditMode && typeof firstInstance !== 'undefined') {
      response.instance = {
        id: firstInstance.id,
        scheduledDate: maintenanceData.scheduledDate.toISOString(),
        status: 'SCHEDULED'
      };
    }

    return NextResponse.json(response);

  } catch (error) {
    console.error('❌ Error creando mantenimiento para unidad móvil:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

// GET - Obtener mantenimientos de unidades móviles
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get('companyId');
    const unidadMovilId = searchParams.get('unidadMovilId');

    if (!companyId) {
      return NextResponse.json(
        { error: 'Company ID es requerido' },
        { status: 400 }
      );
    }

    const whereClause: any = {
      entityType: 'PREVENTIVE_MAINTENANCE_TEMPLATE',
      companyId: parseInt(companyId)
    };

    // Filtrar por unidad móvil específica si se proporciona
    if (unidadMovilId) {
      whereClause.url = {
        contains: `"unidadMovilId":${parseInt(unidadMovilId)}`
      };
    }

    const templates = await prisma.document.findMany({
      where: whereClause,
      orderBy: {
        createdAt: 'desc'
      }
    });

    // Procesar los templates para extraer información relevante
    const maintenanceData = templates.map(template => {
      try {
        const data = JSON.parse(template.url);
        return {
          id: template.id,
          title: data.title,
          description: data.description,
          type: data.type,
          priority: data.priority,
          unidadMovilId: data.unidadMovilId,
          estimatedHours: data.estimatedHours,
          estimatedMinutes: data.estimatedMinutes,
          estimatedTimeType: data.estimatedTimeType,
          maintenanceTrigger: data.maintenanceTrigger,
          triggerValue: data.triggerValue,
          scheduledDate: data.scheduledDate,
          frequency: data.frequency,
          frequencyDays: data.frequencyDays,
          tools: data.tools,
          instructives: data.instructives,
          uploadedFiles: data.uploadedFiles,
          isActive: data.isActive,
          createdAt: template.createdAt
        };
      } catch (error) {
        console.error('Error parsing template data:', error);
        return null;
      }
    }).filter(Boolean);

    return NextResponse.json({
      success: true,
      maintenances: maintenanceData
    });

  } catch (error) {
    console.error('❌ Error obteniendo mantenimientos de unidades móviles:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
