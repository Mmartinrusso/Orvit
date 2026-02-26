import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';
import { cookies } from 'next/headers';

// GET /api/work-stations/[id]/components
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const token = cookies().get('token')?.value;
    if (!token || !(await verifyToken(token))) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const workStationId = parseInt(params.id);

    if (isNaN(workStationId)) {
      return NextResponse.json({ error: 'ID de puesto de trabajo inválido' }, { status: 400 });
    }

    const components = await prisma.workStationComponent.findMany({
      where: { workStationId },
      include: {
        component: {
          select: {
            id: true,
            name: true,
            code: true,
            type: true,
            description: true,
            logo: true,
            machineId: true,
            machine: {
              select: {
                id: true,
                name: true,
                nickname: true
              }
            }
          }
        }
      },
      orderBy: { createdAt: 'asc' }
    });

    return NextResponse.json(components);
  } catch (error) {
    console.error('Error obteniendo componentes del puesto de trabajo:', error);
    return NextResponse.json({ error: 'Error al obtener componentes' }, { status: 500 });
  }
}

// POST /api/work-stations/[id]/components
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const token = cookies().get('token')?.value;
    if (!token || !(await verifyToken(token))) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const workStationId = parseInt(params.id);
    const body = await request.json();

    if (isNaN(workStationId)) {
      return NextResponse.json({ error: 'ID de puesto de trabajo inválido' }, { status: 400 });
    }

    const { componentId, isRequired = true, notes } = body;

    if (!componentId) {
      return NextResponse.json({ error: 'componentId es requerido' }, { status: 400 });
    }

    // Ejecutar verificaciones en paralelo
    const [workStation, component, existingRelation] = await Promise.all([
      prisma.workStation.findUnique({ where: { id: workStationId } }),
      prisma.component.findUnique({ where: { id: componentId } }),
      prisma.workStationComponent.findFirst({ where: { workStationId, componentId } })
    ]);

    if (!workStation) {
      return NextResponse.json({ error: 'Puesto de trabajo no encontrado' }, { status: 404 });
    }

    if (!component) {
      return NextResponse.json({ error: 'Componente no encontrado' }, { status: 404 });
    }

    if (existingRelation) {
      return NextResponse.json({ error: 'El componente ya está asignado a este puesto de trabajo' }, { status: 400 });
    }

    // Crear la relación
    const workStationComponent = await prisma.workStationComponent.create({
      data: {
        workStationId,
        componentId,
        isRequired,
        notes: notes || null
      },
      include: {
        component: {
          select: {
            id: true,
            name: true,
            code: true,
            type: true,
            description: true,
            logo: true,
            machineId: true,
            machine: {
              select: {
                id: true,
                name: true,
                nickname: true
              }
            }
          }
        }
      }
    });

    return NextResponse.json(workStationComponent, { status: 201 });
  } catch (error) {
    console.error('Error agregando componente al puesto de trabajo:', error);
    return NextResponse.json({ error: 'Error al agregar componente' }, { status: 500 });
  }
}

// DELETE /api/work-stations/[id]/components
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const token = cookies().get('token')?.value;
    if (!token || !(await verifyToken(token))) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const workStationId = parseInt(params.id);
    const { searchParams } = new URL(request.url);
    const componentId = searchParams.get('componentId');

    if (isNaN(workStationId)) {
      return NextResponse.json({ error: 'ID de puesto de trabajo inválido' }, { status: 400 });
    }

    if (!componentId) {
      return NextResponse.json({ error: 'componentId es requerido' }, { status: 400 });
    }

    await prisma.workStationComponent.deleteMany({
      where: {
        workStationId,
        componentId: parseInt(componentId)
      }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error eliminando componente del puesto de trabajo:', error);
    return NextResponse.json({ error: 'Error al eliminar componente' }, { status: 500 });
  }
}
