import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  console.log('🔍 [SIMPLE BY-ID API] Route called');
  try {
    const { searchParams } = new URL(request.url);
    const maintenanceId = searchParams.get('maintenanceId');
    const companyId = searchParams.get('companyId');

    console.log('🔍 [SIMPLE BY-ID API] Params:', { maintenanceId, companyId });

    if (!maintenanceId || !companyId) {
      console.log('❌ [SIMPLE BY-ID API] Missing params');
      return NextResponse.json({ 
        success: false, 
        error: 'maintenanceId and companyId are required' 
      }, { status: 400 });
    }

    // Buscar primero en documentos (mantenimientos preventivos)
    console.log('🔍 [SIMPLE BY-ID API] Searching document:', { 
      id: parseInt(maintenanceId), 
      companyId: parseInt(companyId) 
    });
    
    const document = await prisma.document.findFirst({
      where: {
        id: parseInt(maintenanceId),
        companyId: parseInt(companyId)
      }
    });

    console.log('🔍 [SIMPLE BY-ID API] Document found:', !!document);

    if (document) {
      // Parsear datos del JSON
      let data: any = {};
      try {
        if (document.url) {
          data = typeof document.url === 'string' ? JSON.parse(document.url) : document.url;
        }
      } catch (parseError) {
        console.error('❌ [SIMPLE BY-ID API] Error parsing document.url:', parseError);
        data = {};
      }
      
      // ✅ OPTIMIZADO: Obtener información del equipo y responsable en paralelo
      const [machine, unidadMovil, employee] = await Promise.all([
        data.machineId ? prisma.machine.findUnique({
          where: { id: data.machineId },
          select: { id: true, name: true }
        }) : null,
        data.unidadMovilId ? prisma.unidadMovil.findUnique({
          where: { id: data.unidadMovilId },
          select: { id: true, nombre: true }
        }) : null,
        data.assignedToId ? prisma.employee.findUnique({
          where: { id: data.assignedToId },
          select: { id: true, name: true }
        }) : null
      ]);

      let equipment = null;
      if (machine) {
        equipment = { id: machine.id, name: machine.name, type: 'MÁQUINA' };
      } else if (unidadMovil) {
        equipment = { id: unidadMovil.id, name: unidadMovil.nombre, type: 'UNIDAD_MOVIL' };
      }

      const responsible = employee ? { id: employee.id, name: employee.name } : null;
      
      // Crear respuesta simple
      const maintenance = {
        id: document.id,
        title: data.title || 'Sin título',
        description: data.description || '',
        estimatedDuration: data.estimatedHours || data.estimatedDuration || 0,
        estimatedHours: data.estimatedHours || data.estimatedDuration || 0,
        estimatedDurationUnit: data.estimatedDurationUnit || 'MINUTES',
        equipment: equipment || {
          id: data.machineId || data.unidadMovilId || 0,
          name: data.machineName || data.unidadMovilName || 'Sin equipo',
          type: data.machineId ? 'MÁQUINA' : 'UNIDAD_MOVIL'
        },
        responsible: responsible || {
          id: data.assignedToId || 0,
          name: data.assignedToName || 'Sin responsable'
        },
        assignedTo: data.assignedToName || '',
        assignedToId: data.assignedToId || null,
        status: data.status || 'SCHEDULED',
        nextMaintenanceDate: data.nextMaintenanceDate,
        lastMaintenanceDate: data.lastMaintenanceDate,
        frequency: data.frequency || '',
        priority: data.priority || 'MEDIUM'
      };

      console.log('✅ [SIMPLE BY-ID API] Returning preventive maintenance:', maintenance.id);
      return NextResponse.json({
        success: true,
        data: maintenance
      });
    }

    // Si no se encuentra en documentos, buscar en WorkOrders (mantenimientos correctivos)
    console.log('🔍 [SIMPLE BY-ID API] Searching workOrder:', { 
      id: parseInt(maintenanceId), 
      companyId: parseInt(companyId) 
    });

    const workOrder = await prisma.workOrder.findFirst({
      where: {
        id: parseInt(maintenanceId),
        companyId: parseInt(companyId)
      },
      include: {
        machine: true,
        unidadMovil: true,
        assignedTo: true
      }
    });

    console.log('🔍 [SIMPLE BY-ID API] WorkOrder found:', !!workOrder);

    if (workOrder) {
      const equipment = workOrder.machine ? {
        id: workOrder.machine.id,
        name: workOrder.machine.name,
        type: 'MÁQUINA'
      } : workOrder.unidadMovil ? {
        id: workOrder.unidadMovil.id,
        name: workOrder.unidadMovil.nombre,
        type: 'UNIDAD_MOVIL'
      } : null;

      const responsible = workOrder.assignedTo ? {
        id: workOrder.assignedTo.id,
        name: workOrder.assignedTo.name
      } : null;

      const maintenance = {
        id: workOrder.id,
        title: workOrder.title || 'Mantenimiento Correctivo',
        description: workOrder.description || '',
        estimatedDuration: 0,
        estimatedHours: 0,
        estimatedDurationUnit: 'MINUTES',
        equipment,
        responsible,
        assignedTo: workOrder.assignedTo?.name || '',
        assignedToId: workOrder.assignedTo?.id || null,
        status: workOrder.status || 'PENDING',
        nextMaintenanceDate: null,
        lastMaintenanceDate: workOrder.completedDate,
        frequency: 'ON_DEMAND',
        priority: workOrder.priority || 'MEDIUM'
      };

      console.log('✅ [SIMPLE BY-ID API] Returning corrective maintenance:', maintenance.id);
      return NextResponse.json({
        success: true,
        data: maintenance
      });
    }

    // Si no se encuentra en ningún lado
    console.log('❌ [SIMPLE BY-ID API] Maintenance not found in document or workOrder');
    return NextResponse.json({ 
      success: false, 
      error: 'Maintenance not found' 
    }, { status: 404 });


  } catch (error) {
    console.error('❌ [SIMPLE BY-ID API] Error:', error);
    return NextResponse.json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Internal server error'
    }, { status: 500 });
  }
}
