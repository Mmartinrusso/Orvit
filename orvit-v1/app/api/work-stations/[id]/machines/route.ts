import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';
import { cookies } from 'next/headers';

// GET /api/work-stations/[id]/machines
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

    const machines = await prisma.workStationMachine.findMany({
      where: { workStationId },
      include: {
        machine: {
          select: {
            id: true,
            name: true,
            nickname: true,
            type: true,
            brand: true,
            model: true,
            status: true,
            photo: true,
            logo: true
          }
        }
      },
      orderBy: { createdAt: 'asc' }
    });

    return NextResponse.json(machines);
  } catch (error) {
    console.error('Error obteniendo máquinas del puesto de trabajo:', error);
    return NextResponse.json({ error: 'Error al obtener máquinas' }, { status: 500 });
  }
}

// POST /api/work-stations/[id]/machines
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

    const { machineId, isRequired = true, notes } = body;

    if (!machineId) {
      return NextResponse.json({ error: 'machineId es requerido' }, { status: 400 });
    }

    // ✅ OPTIMIZADO: Ejecutar todas las verificaciones en paralelo
    const [workStation, machine, existingRelation] = await Promise.all([
      prisma.workStation.findUnique({ where: { id: workStationId } }),
      prisma.machine.findUnique({ where: { id: machineId } }),
      prisma.workStationMachine.findFirst({ where: { workStationId, machineId } })
    ]);

    if (!workStation) {
      return NextResponse.json({ error: 'Puesto de trabajo no encontrado' }, { status: 404 });
    }

    // Verificar que es una máquina real (no un componente)
    if (!machine) {
      return NextResponse.json({
        error: 'Solo se pueden asociar máquinas al puesto de trabajo. Los componentes deben asociarse a través de instructivos.'
      }, { status: 400 });
    }

    if (existingRelation) {
      return NextResponse.json({ error: 'La máquina ya está asignada a este puesto de trabajo' }, { status: 400 });
    }

    // Crear la relación
    const workStationMachine = await prisma.workStationMachine.create({
      data: {
        workStationId,
        machineId,
        isRequired,
        notes: notes || null
      },
      include: {
        machine: {
          select: {
            id: true,
            name: true,
            nickname: true,
            type: true,
            brand: true,
            model: true,
            status: true,
            photo: true,
            logo: true
          }
        }
      }
    });

    return NextResponse.json(workStationMachine, { status: 201 });
  } catch (error) {
    console.error('Error agregando máquina al puesto de trabajo:', error);
    return NextResponse.json({ error: 'Error al agregar máquina' }, { status: 500 });
  }
}
