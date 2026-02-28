import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserIdFromToken } from '@/lib/auth';
import { requireAuth } from '@/lib/auth/shared-helpers';

// DELETE /api/work-stations/[id]/machines/[machineId]
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string; machineId: string } }
) {
  try {
    const { user, error: authError } = await requireAuth();
    if (authError) return authError;
    const userId = await getUserIdFromToken();
    
    const workStationId = parseInt(params.id);
    const machineId = parseInt(params.machineId);
    
    if (isNaN(workStationId) || isNaN(machineId)) {
      return NextResponse.json({ error: 'IDs inválidos' }, { status: 400 });
    }

    // Verificar que el puesto de trabajo existe
    const workStation = await prisma.workStation.findUnique({
      where: { id: workStationId }
    });

    if (!workStation) {
      return NextResponse.json({ error: 'Puesto de trabajo no encontrado' }, { status: 404 });
    }

    // Verificar que la máquina existe
    const machine = await prisma.machine.findUnique({
      where: { id: machineId }
    });

    if (!machine) {
      return NextResponse.json({ error: 'Máquina no encontrada' }, { status: 404 });
    }

    // Buscar la relación específica
    const relation = await prisma.workStationMachine.findFirst({
      where: {
        workStationId,
        machineId
      }
    });

    if (!relation) {
      return NextResponse.json({ error: 'La máquina no está asignada a este puesto de trabajo' }, { status: 404 });
    }

    // Eliminar la relación
    await prisma.workStationMachine.delete({
      where: {
        id: relation.id
      }
    });

    return NextResponse.json({ message: 'Máquina removida del puesto de trabajo' }, { status: 200 });
  } catch (error) {
    console.error('Error eliminando máquina del puesto de trabajo:', error);
    return NextResponse.json({ error: 'Error al eliminar máquina' }, { status: 500 });
  }
}
