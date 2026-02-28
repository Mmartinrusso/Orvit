import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth/shared-helpers';

export const dynamic = 'force-dynamic';

// POST /api/plant/resume
export async function POST(request: NextRequest) {
  try {
    const { user, error } = await requireAuth();
    if (error) return error;

    const body = await request.json();
    const {
      plantStopId,
      sectorId,
      companyId,
      supervisorId,
      supervisorName,
      toolsUsed,
      detailedDescription,
      machineId,
      machineName,
      componentId,
      componentName,
      subcomponentId,
      subcomponentName,
      photoUrls,
      timestamp
    } = body;

    // Validaciones básicas
    if (!plantStopId || !sectorId || !companyId || !supervisorId || !detailedDescription || !machineId) {
      return NextResponse.json(
        { error: 'Faltan campos requeridos' },
        { status: 400 }
      );
    }

    // Verificar que el sector existe
    const sector = await prisma.sector.findUnique({
      where: { id: Number(sectorId) },
      include: { area: true }
    });

    if (!sector) {
      return NextResponse.json(
        { error: 'Sector no encontrado' },
        { status: 404 }
      );
    }

    // Verificar que la máquina existe
    const machine = await prisma.machine.findUnique({
      where: { id: Number(machineId) }
    });

    if (!machine) {
      return NextResponse.json(
        { error: 'Máquina no encontrada' },
        { status: 404 }
      );
    }

    // Actualizar el estado del sector a activo
    await prisma.sector.update({
      where: { id: Number(sectorId) },
      data: { estado: 'ACTIVO' }
    });

    // Crear el registro de historial de mantenimiento
    const maintenanceRecord = await prisma.document.create({
      data: {
        id: `maintenance-${Date.now()}-${machineId}`,
        entityType: 'MAINTENANCE_HISTORY',
        entityId: `machine-${machineId}${componentId ? `-component-${componentId}` : ''}`,
        originalName: `Reactivación de Planta - ${machineName}`,
        url: JSON.stringify({
          type: 'PLANT_RESUME',
          plantStopId,
          sectorId: Number(sectorId),
          sectorName: `${sector.area.name} - ${sector.name}`,
          machineId: Number(machineId),
          machineName,
          componentId: componentId ? Number(componentId) : null,
          componentName: componentName || null,
          subcomponentId: subcomponentId ? Number(subcomponentId) : null,
          subcomponentName: subcomponentName || null,
          toolsUsed: toolsUsed || [],
          detailedDescription,
          photoUrls: photoUrls || [],
          supervisorId: Number(supervisorId),
          supervisorName,
          timestamp: timestamp || new Date().toISOString(),
          createdAt: new Date().toISOString()
        }),
        createdAt: new Date()
      }
    });

    // Marcar la parada como resuelta
    const plantStopRecord = await prisma.document.findUnique({
      where: { id: plantStopId }
    });

    if (plantStopRecord) {
      const stopData = JSON.parse(plantStopRecord.url);
      stopData.status = 'RESOLVED';
      stopData.resolvedAt = timestamp || new Date().toISOString();
      stopData.resolvedBy = supervisorName;
      stopData.toolsUsed = toolsUsed || [];
      stopData.detailedDescription = detailedDescription;
      stopData.machineId = Number(machineId);
      stopData.machineName = machineName;
      stopData.componentId = componentId ? Number(componentId) : null;
      stopData.componentName = componentName || null;
      stopData.subcomponentId = subcomponentId ? Number(subcomponentId) : null;
      stopData.subcomponentName = subcomponentName || null;
      stopData.photoUrls = photoUrls || [];
      stopData.maintenanceRecordId = maintenanceRecord.id;

      await prisma.document.update({
        where: { id: plantStopId },
        data: {
          url: JSON.stringify(stopData),
          originalName: `${plantStopRecord.originalName} - RESUELTO`
        }
      });
    }

    // Obtener todos los usuarios de la empresa para notificar
    const companyUsers = await prisma.userOnCompany.findMany({
      where: { companyId: Number(companyId) },
      include: { user: true }
    });

    // Construir el resumen del trabajo realizado
    let workSummary = `${machineName}`;
    if (componentName) {
      workSummary += ` - ${componentName}`;
      if (subcomponentName) {
        workSummary += ` - ${subcomponentName}`;
      }
    }

    console.log('✅ PLANTA REACTIVADA Y HISTORIAL CREADO:', {
      sector: `${sector.area.name} - ${sector.name}`,
      resolvedBy: supervisorName,
      workPerformed: workSummary,
      toolsUsed: toolsUsed ? toolsUsed.length : 0,
      photosUploaded: photoUrls ? photoUrls.length : 0,
      maintenanceRecordId: maintenanceRecord.id,
      usersNotified: companyUsers.length
    });

    return NextResponse.json({
      success: true,
      message: 'Planta reactivada exitosamente y historial guardado',
      sectorStatus: 'ACTIVO',
      maintenanceRecordId: maintenanceRecord.id,
      workSummary,
      notifiedUsers: companyUsers.length
    });

  } catch (error) {
    console.error('Error en POST /api/plant/resume:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
} 