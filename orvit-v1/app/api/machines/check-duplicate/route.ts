import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyAuth } from '@/lib/auth';

export const dynamic = 'force-dynamic';

// GET /api/machines/check-duplicate - Verificar si existe una máquina con el mismo serial/SAP
export async function GET(request: NextRequest) {
  try {
    const auth = await verifyAuth(request);
    if (!auth) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const serialNumber = searchParams.get('serialNumber');
    const sapCode = searchParams.get('sapCode');
    const excludeId = searchParams.get('excludeId');

    const conditions: any[] = [];

    if (serialNumber) {
      conditions.push({ serialNumber: serialNumber });
    }

    if (sapCode) {
      conditions.push({ sapCode: sapCode });
    }

    if (conditions.length === 0) {
      return NextResponse.json({ duplicate: false });
    }

    // Siempre usar companyId del usuario autenticado
    const whereClause: any = {
      companyId: auth.companyId,
      OR: conditions,
    };

    if (excludeId) {
      whereClause.id = { not: parseInt(excludeId) };
    }

    const existingMachine = await prisma.machine.findFirst({
      where: whereClause,
      select: {
        id: true,
        name: true,
        serialNumber: true,
        sapCode: true,
      },
    });

    if (existingMachine) {
      const field = serialNumber && existingMachine.serialNumber === serialNumber
        ? 'serialNumber'
        : 'sapCode';

      return NextResponse.json({
        duplicate: true,
        field,
        machineId: existingMachine.id,
        machineName: existingMachine.name,
      });
    }

    return NextResponse.json({ duplicate: false });
  } catch (error) {
    console.error('Error verificando duplicados:', error);
    return NextResponse.json({ duplicate: false });
  }
}
