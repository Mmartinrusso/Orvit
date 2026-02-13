import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const data = await request.json();
    
    console.log('🔍 Datos de duplicación recibidos:', data);

    const {
      title,
      description,
      type,
      priority,
      machineId,
      unidadMovilId,
      companyId,
      sectorId,
      estimatedHours,
      estimatedMinutes,
      estimatedTimeType,
      timeValue,
      timeUnit,
      frequency,
      frequencyUnit,
      frequencyDays,
      executionWindow,
      assignedToId,
      notes
    } = data;

    // Validar datos requeridos
    if (!title || (!machineId && !unidadMovilId) || !companyId) {
      return NextResponse.json(
        { error: 'Title, machineId o unidadMovilId, y companyId son requeridos' },
        { status: 400 }
      );
    }

    // Crear el mantenimiento duplicado
    const duplicatedMaintenance = await prisma.workOrder.create({
      data: {
        title,
        description,
        type: type || 'PREVENTIVE',
        priority: priority || 'MEDIUM',
        status: 'PENDING',
        machineId: machineId || null,
        unidadMovilId: unidadMovilId || null,
        companyId,
        sectorId,
        estimatedHours,
        actualHours: null,
        cost: null,
        notes,
        assignedToId,
        createdById: 1, // TODO: Obtener del usuario actual
        scheduledDate: null, // Se calculará automáticamente
        startedDate: null,
        completedDate: null
      }
    });

    console.log('✅ Mantenimiento duplicado creado:', duplicatedMaintenance.id);

    return NextResponse.json({
      success: true,
      message: 'Mantenimiento duplicado exitosamente',
      data: {
        id: duplicatedMaintenance.id,
        title: duplicatedMaintenance.title,
        machineId: duplicatedMaintenance.machineId,
        unidadMovilId: duplicatedMaintenance.unidadMovilId
      }
    });

  } catch (error) {
    console.error('Error duplicando mantenimiento:', error);
    return NextResponse.json(
      { 
        error: 'Error interno del servidor', 
        details: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    );
  }
}
