import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

// GET /api/machines/check-duplicate - Verificar si existe una máquina con el mismo serial/SAP
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const companyId = searchParams.get('companyId');
    const serialNumber = searchParams.get('serialNumber');
    const sapCode = searchParams.get('sapCode');
    const excludeId = searchParams.get('excludeId');

    if (!companyId) {
      return NextResponse.json({ error: 'companyId requerido' }, { status: 400 });
    }

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

    const whereClause: any = {
      companyId: parseInt(companyId),
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
