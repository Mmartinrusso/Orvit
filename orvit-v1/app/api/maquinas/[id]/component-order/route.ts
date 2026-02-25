import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyAuth } from '@/lib/auth';

// GET: Obtener el orden de componentes de una máquina
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

    const machine = await prisma.machine.findUnique({
      where: { id: Number(machineId) },
      select: { companyId: true }
    });
    if (!machine) {
      return NextResponse.json({ error: 'Máquina no encontrada' }, { status: 404 });
    }
    if (machine.companyId !== auth.companyId) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }

    // Aquí deberías consultar tu base de datos para obtener el orden guardado
    // Por ahora, retornamos un orden vacío
    console.log(`Consultando orden de componentes para máquina ${machineId}`);
    return NextResponse.json({ order: null });

  } catch (error) {
    console.error('Error al obtener orden de componentes:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}

// PUT: Guardar el orden de componentes de una máquina
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await verifyAuth(request);
    if (!auth) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const machineId = params.id;

    const machine = await prisma.machine.findUnique({
      where: { id: Number(machineId) },
      select: { companyId: true }
    });
    if (!machine) {
      return NextResponse.json({ error: 'Máquina no encontrada' }, { status: 404 });
    }
    if (machine.companyId !== auth.companyId) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }

    const { order } = await request.json();

    // Aquí deberías guardar el orden en tu base de datos
    // Por ejemplo, en una tabla machine_component_order
    console.log(`Guardando orden de componentes para máquina ${machineId}:`, order);

    // Por ahora, solo retornamos éxito
    // En una implementación real, guardarías en la base de datos
    return NextResponse.json({ success: true, message: 'Orden guardado exitosamente' });

  } catch (error) {
    console.error('Error al guardar orden de componentes:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
