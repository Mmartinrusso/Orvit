import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const maintenanceId = searchParams.get('maintenanceId');
    const companyId = searchParams.get('companyId');

    if (!maintenanceId || !companyId) {
      return NextResponse.json({ 
        success: false, 
        error: 'maintenanceId and companyId are required' 
      }, { status: 400 });
    }

    // Buscar en documentos preventivos
    const preventiveDoc = await prisma.document.findFirst({
      where: {
        id: parseInt(maintenanceId),
        companyId: parseInt(companyId)
      }
    });

    if (preventiveDoc) {
      try {
        const data = JSON.parse(preventiveDoc.url);
        
        // Obtener información de la máquina o unidad móvil
        let equipment = null;
        if (data.machineId) {
          const machine = await prisma.machine.findUnique({
            where: { id: data.machineId },
            select: { id: true, name: true, type: true }
          });
          if (machine) {
            equipment = {
              id: machine.id,
              name: machine.name,
              type: 'MÁQUINA'
            };
          }
        } else if (data.unidadMovilId) {
          const unidadMovil = await prisma.unidadMovil.findUnique({
            where: { id: data.unidadMovilId },
            select: { id: true, nombre: true, tipo: true }
          });
          if (unidadMovil) {
            equipment = {
              id: unidadMovil.id,
              name: unidadMovil.nombre,
              type: 'UNIDAD_MOVIL'
            };
          }
        }

        // Obtener información del responsable
        let responsible = null;
        if (data.assignedToId) {
          const employee = await prisma.employee.findUnique({
            where: { id: data.assignedToId },
            select: { id: true, name: true }
          });
          if (employee) {
            responsible = {
              id: employee.id,
              name: employee.name
            };
          }
        }

        const maintenance = {
          id: preventiveDoc.id,
          title: data.title || 'Sin título',
          description: data.description || '',
          estimatedDuration: data.estimatedHours || data.estimatedDuration || 0,
          estimatedHours: data.estimatedHours || data.estimatedDuration || 0,
          estimatedDurationUnit: data.estimatedDurationUnit || 'MINUTES',
          equipment,
          responsible,
          assignedTo: data.assignedTo || '',
          assignedToId: data.assignedToId || null,
          status: data.status || 'SCHEDULED',
          nextMaintenanceDate: data.nextMaintenanceDate,
          lastMaintenanceDate: data.lastMaintenanceDate,
          frequency: data.frequency || '',
          priority: data.priority || 'MEDIUM'
        };

        return NextResponse.json({
          success: true,
          data: maintenance
        });
      } catch (error) {
        console.error('❌ [BY-ID API] Error parsing preventive maintenance data:', error);
        return NextResponse.json({ 
          success: false, 
          error: 'Error parsing maintenance data' 
        }, { status: 500 });
      }
    }

    // Buscar en WorkOrders (mantenimientos correctivos)
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

      return NextResponse.json({
        success: true,
        data: maintenance
      });
    }

    return NextResponse.json({ 
      success: false, 
      error: 'Maintenance not found' 
    }, { status: 404 });

  } catch (error) {
    console.error('❌ [BY-ID API] Error:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Internal server error' 
    }, { status: 500 });
  }
}