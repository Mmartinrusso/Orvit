import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyAuth } from '@/lib/auth';

// GET /api/machines/[id]/history
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await verifyAuth(request);
    if (!auth) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const machineId = params.id;
    const { searchParams } = new URL(request.url);
    const componentId = searchParams.get('componentId');

    // Verificar que la máquina existe
    const machine = await prisma.machine.findUnique({
      where: { id: Number(machineId) },
      include: {
        sector: {
          include: {
            area: true
          }
        }
      }
    });

    if (!machine) {
      return NextResponse.json(
        { error: 'Máquina no encontrada' },
        { status: 404 }
      );
    }

    if (machine.companyId !== auth.companyId) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }

    // Construir la consulta de historial
    let entityIdPattern = `machine-${machineId}`;
    if (componentId) {
      entityIdPattern += `-component-${componentId}`;
    }

    // Buscar registros de historial
    const historyRecords = await prisma.document.findMany({
      where: {
        entityType: 'MAINTENANCE_HISTORY',
        entityId: {
          startsWith: entityIdPattern
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    // Procesar los registros para extraer la información
    const processedHistory = historyRecords.map(record => {
      try {
        const data = JSON.parse(record.url);
        return {
          id: record.id,
          title: record.originalName || `Historial ${record.id}`,
          type: data.type || 'MAINTENANCE',
          date: data.timestamp || record.createdAt,
          machine: {
            id: data.machineId || Number(machineId),
            name: data.machineName || machine.name
          },
          component: data.componentId ? {
            id: data.componentId,
            name: data.componentName
          } : null,
          subcomponent: data.subcomponentId ? {
            id: data.subcomponentId,
            name: data.subcomponentName
          } : null,
          supervisor: {
            id: data.supervisorId || 0,
            name: data.supervisorName || 'N/A'
          },
          toolsUsed: data.toolsUsed || [],
          detailedDescription: data.detailedDescription || 'Sin descripción',
          photoUrls: data.photoUrls || [],
          sector: data.sectorName || machine.sector?.name || 'N/A',
          plantStopId: data.plantStopId || '',
          createdAt: record.createdAt
        };
      } catch (error) {
        console.error('Error parsing history record:', error);
        return {
          id: record.id,
          title: record.originalName || `Registro ${record.id}`,
          type: 'UNKNOWN',
          date: record.createdAt,
          machine: {
            id: Number(machineId),
            name: machine.name
          },
          component: null,
          subcomponent: null,
          supervisor: {
            id: 0,
            name: 'Sistema'
          },
          toolsUsed: [],
          detailedDescription: 'Error al procesar registro',
          photoUrls: [],
          sector: machine.sector?.name || 'N/A',
          plantStopId: '',
          createdAt: record.createdAt
        };
      }
    });

    return NextResponse.json({
      success: true,
      machine: {
        id: machine.id,
        name: machine.name,
        model: machine.model,
        sector: `${machine.sector.area.name} - ${machine.sector.name}`
      },
      componentId: componentId ? Number(componentId) : null,
      history: processedHistory,
      total: processedHistory.length
    });

  } catch (error) {
    console.error('Error en GET /api/machines/[id]/history:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
} 