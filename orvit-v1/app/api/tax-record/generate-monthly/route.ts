import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';


// POST - Generar registros mensuales para todas las bases activas
export async function POST(request: NextRequest) {
  try {
    // Por ahora, obtener el primer usuario activo sin autenticación
    const user = await prisma.user.findFirst({
      where: { isActive: true }
    });
    
    if (!user) {
      return NextResponse.json({ error: 'No se encontró usuario activo' }, { status: 404 });
    }

    const body = await request.json();
    const { companyId, month } = body;

    if (!companyId || !month) {
      return NextResponse.json({ error: 'companyId y month son requeridos' }, { status: 400 });
    }

    // Obtener todas las bases activas de la empresa
    const taxBases = await prisma.taxBase.findMany({
      where: {
        companyId: parseInt(companyId),
        isActive: true,
        isRecurring: true
      }
    });

    let totalCreated = 0;
    const results = [];

    for (const taxBase of taxBases) {
      // Verificar si ya existe un registro para este mes
      const existingRecord = await prisma.taxRecord.findUnique({
        where: {
          taxBaseId_month: {
            taxBaseId: taxBase.id,
            month: month
          }
        }
      });

      if (!existingRecord) {
        // Calcular la fecha de alerta
        const [year, monthNum] = month.split('-');
        const alertDate = new Date(parseInt(year), parseInt(monthNum) - 1, taxBase.recurringDay);

        // Crear el registro mensual
        const taxRecord = await prisma.taxRecord.create({
          data: {
            taxBaseId: taxBase.id,
            amount: 0, // Monto inicial en 0
            month: month,
            alertDate: alertDate,
            status: 'PENDIENTE',
            notes: `Registro generado automáticamente para ${month}`
          }
        });

        totalCreated++;
        results.push({
          taxBaseId: taxBase.id,
          taxBaseName: taxBase.name,
          recordId: taxRecord.id,
          month: month,
          alertDate: alertDate
        });
      }
    }

    return NextResponse.json({
      success: true,
      totalCreated,
      month,
      results
    });

  } catch (error) {
    console.error('Error generating monthly records:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
