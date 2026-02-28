import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth';

export const dynamic = 'force-dynamic';

// POST - Crear mantenimiento preventivo para unidad móvil
export async function POST(request: NextRequest) {
  try {
    // Verificar autenticación
    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;
    if (!token) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }
    const payload = await verifyToken(token);
    if (!payload || !payload.companyId) {
      return NextResponse.json({ error: 'Token inválido' }, { status: 401 });
    }

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

    // Verificar duplicados (solo al crear)
    const isEditMode = body.id || body.templateId;

    if (!isEditMode) {
      const existingMaintenance = await prisma.preventiveTemplate.findFirst({
        where: {
          unidadMovilId,
          title,
        },
      });

      if (existingMaintenance) {
        return NextResponse.json(
          { error: `Ya existe un mantenimiento "${title}" para esta unidad móvil` },
          { status: 400 }
        );
      }
    }

    const schedDate = scheduledDate ? new Date(scheduledDate) : new Date();

    // Datos extra en toolsRequired (reutilizamos JSON para campos específicos de unidades)
    const extraData = {
      maintenanceTrigger: maintenanceTrigger || 'KILOMETERS',
      triggerValue: triggerValue || 10000,
      maintenanceInterval: maintenanceInterval || 0,
      maintenanceIntervalType: maintenanceIntervalType || 'DAYS',
      currentKilometers: currentKilometers || 0,
      nextMaintenanceKilometers: nextMaintenanceKilometers || 0,
      estimatedMinutes: estimatedMinutes || 0,
      estimatedTimeType: estimatedTimeType || 'MINUTES',
      frequency: frequency || 'MONTHLY',
      isRecurring: true,
      tools: tools || [],
      spareParts: spareParts || [],
      uploadedFiles: uploadedFiles || [],
    };

    let preventiveTemplate;
    let firstInstance;

    if (id && isEditMode) {
      // Actualizar existente
      preventiveTemplate = await prisma.preventiveTemplate.update({
        where: { id: parseInt(id) },
        data: {
          title,
          description: description || '',
          priority: priority || 'MEDIUM',
          unidadMovilId,
          machineName: unidad.nombre,
          isMobileUnit: true,
          assignedToId: assignedToId || null,
          estimatedHours: estimatedHours || 2,
          frequencyDays: frequencyDays || 30,
          nextMaintenanceDate: schedDate,
          executionWindow: 'ANY_TIME',
          toolsRequired: extraData,
          instructives: instructives || [],
          companyId,
          sectorId: sectorId || null,
        },
      });
    } else {
      // Crear nuevo
      preventiveTemplate = await prisma.preventiveTemplate.create({
        data: {
          title,
          description: description || '',
          priority: priority || 'MEDIUM',
          unidadMovilId,
          machineName: unidad.nombre,
          isMobileUnit: true,
          assignedToId: assignedToId || null,
          estimatedHours: estimatedHours || 2,
          frequencyDays: frequencyDays || 30,
          nextMaintenanceDate: schedDate,
          executionWindow: 'ANY_TIME',
          toolsRequired: extraData,
          instructives: instructives || [],
          companyId,
          sectorId: sectorId || null,
          isActive: true,
        },
      });

      // Crear primera instancia
      firstInstance = await prisma.preventiveInstance.create({
        data: {
          templateId: preventiveTemplate.id,
          scheduledDate: schedDate,
          status: 'PENDING',
        },
      });
    }

    // Actualizar unidad móvil con próximo mantenimiento
    await prisma.unidadMovil.update({
      where: { id: unidadMovilId },
      data: {
        proximoMantenimiento: schedDate,
        updatedAt: new Date(),
      },
    });

    const response: any = {
      success: true,
      template: {
        id: preventiveTemplate.id,
        title,
        unidad: unidad.nombre,
        type: type || 'PREVENTIVE',
        nextMaintenance: schedDate.toISOString(),
      },
      message: isEditMode
        ? 'Mantenimiento actualizado correctamente'
        : 'Mantenimiento preventivo para unidad móvil creado correctamente',
    };

    if (!isEditMode && firstInstance) {
      response.instance = {
        id: firstInstance.id,
        scheduledDate: schedDate.toISOString(),
        status: 'PENDING',
      };
    }

    return NextResponse.json(response);

  } catch (error) {
    console.error('Error creando mantenimiento para unidad móvil:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

// GET - Obtener mantenimientos de unidades móviles
export async function GET(request: NextRequest) {
  try {
    // Verificar autenticación
    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;
    if (!token) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }
    const authPayload = await verifyToken(token);
    if (!authPayload || !authPayload.companyId) {
      return NextResponse.json({ error: 'Token inválido' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const unidadMovilId = searchParams.get('unidadMovilId');
    const companyId = authPayload.companyId as number; // Siempre del JWT

    const where: any = {
      companyId,
      isMobileUnit: true,
    };

    if (unidadMovilId) {
      where.unidadMovilId = parseInt(unidadMovilId);
    }

    const templates = await prisma.preventiveTemplate.findMany({
      where,
      include: {
        unidadMovil: { select: { id: true, nombre: true } },
        assignedTo: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    const maintenanceData = templates.map(t => {
      const extra = (t.toolsRequired as any) || {};
      return {
        id: t.id,
        title: t.title,
        description: t.description,
        type: 'PREVENTIVE',
        priority: t.priority,
        unidadMovilId: t.unidadMovilId,
        assignedToId: t.assignedToId,
        assignedToName: t.assignedTo?.name ?? null,
        estimatedHours: t.estimatedHours,
        estimatedMinutes: extra.estimatedMinutes ?? 0,
        estimatedTimeType: extra.estimatedTimeType ?? 'MINUTES',
        maintenanceTrigger: extra.maintenanceTrigger ?? 'KILOMETERS',
        triggerValue: extra.triggerValue ?? 10000,
        scheduledDate: t.nextMaintenanceDate?.toISOString() ?? null,
        frequency: extra.frequency ?? 'MONTHLY',
        frequencyDays: t.frequencyDays,
        tools: extra.tools ?? [],
        spareParts: extra.spareParts ?? [],
        instructives: t.instructives,
        uploadedFiles: extra.uploadedFiles ?? [],
        isActive: t.isActive,
        createdAt: t.createdAt,
      };
    });

    return NextResponse.json({
      success: true,
      maintenances: maintenanceData,
    });

  } catch (error) {
    console.error('Error obteniendo mantenimientos de unidades móviles:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
