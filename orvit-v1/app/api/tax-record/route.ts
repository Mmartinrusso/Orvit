import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { startPerf, endParse, startDb, endDb, startCompute, endCompute, startJson, endJson, withPerfHeaders } from '@/lib/perf';
import { requireAuth } from '@/lib/auth/shared-helpers';

export const dynamic = 'force-dynamic';


// GET - Obtener registros mensuales de impuestos
export async function GET(request: NextRequest) {
  const perfCtx = startPerf();
  const { searchParams } = new URL(request.url);

  try {
    const { user: authUser, error: authError } = await requireAuth();
    if (authError) return authError;

    // Por ahora, obtener el primer usuario activo sin autenticación
    const user = await prisma.user.findFirst({
      where: { isActive: true }
    });
    
    if (!user) {
      return NextResponse.json({ error: 'No se encontró usuario activo' }, { status: 404 });
    }

    const companyId = searchParams.get('companyId');
    const month = searchParams.get('month');
    const status = searchParams.get('status');

    if (!companyId) {
      return NextResponse.json({ error: 'companyId es requerido' }, { status: 400 });
    }

    endParse(perfCtx);
    startDb(perfCtx);

    const where: any = {
      taxBase: {
        companyId: parseInt(companyId)
      }
    };

    if (month) {
      where.month = month;
    }

    if (status && status !== 'all') {
      where.status = status;
    }

    // ✨ FIX: Reducir payload - hacer relaciones opcionales o usar select más específico
    const taxRecords = await prisma.taxRecord.findMany({
      where,
      select: {
        id: true,
        taxBaseId: true,
        amount: true,
        status: true,
        alertDate: true,
        receivedDate: true,
        paymentDate: true,
        receivedBy: true,
        paidBy: true,
        notes: true,
        month: true,
        createdAt: true,
        updatedAt: true,
        taxBase: {
          select: {
            id: true,
            name: true,
            description: true,
            recurringDay: true,
            isRecurring: true
          }
        },
        // ✨ FIX: Solo incluir relaciones si son necesarias (reducir payload)
        receivedByUser: {
          select: {
            id: true,
            name: true,
            email: true
          }
        },
        paidByUser: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      },
      orderBy: {
        alertDate: 'asc'
      }
    });

    endDb(perfCtx);
    startCompute(perfCtx);
    endCompute(perfCtx);
    startJson(perfCtx);

    const response = NextResponse.json(taxRecords);
    const metrics = endJson(perfCtx, taxRecords);
    return withPerfHeaders(response, metrics, searchParams);
  } catch (error) {
    console.error('Error fetching tax records:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}

// POST - Crear o actualizar registro mensual
export async function POST(request: NextRequest) {
  try {
    const { user: authUser, error: authError } = await requireAuth();
    if (authError) return authError;

    // Por ahora, obtener el primer usuario activo sin autenticación
    const user = await prisma.user.findFirst({
      where: { isActive: true }
    });
    
    if (!user) {
      return NextResponse.json({ error: 'No se encontró usuario activo' }, { status: 404 });
    }

    const body = await request.json();
    const { taxBaseId, amount, month, notes, alertDate } = body;

    if (!taxBaseId || !amount || !month) {
      return NextResponse.json({ 
        error: 'Faltan campos requeridos: taxBaseId, amount, month' 
      }, { status: 400 });
    }

    // Obtener la base de impuesto
    const taxBase = await prisma.taxBase.findUnique({
      where: { id: parseInt(taxBaseId) }
    });

    if (!taxBase) {
      return NextResponse.json({ error: 'Base de impuesto no encontrada' }, { status: 404 });
    }

    // Usar la fecha de alerta proporcionada o calcular basada en el día recurrente
    let finalAlertDate;
    if (alertDate) {
      finalAlertDate = new Date(alertDate);
    } else {
      const [year, monthNum] = month.split('-');
      finalAlertDate = new Date(parseInt(year), parseInt(monthNum) - 1, taxBase.recurringDay);
    }

    // Crear o actualizar el registro mensual
    const taxRecord = await prisma.taxRecord.upsert({
      where: {
        taxBaseId_month: {
          taxBaseId: parseInt(taxBaseId),
          month: month
        }
      },
      update: {
        amount: parseFloat(amount),
        notes: notes || null,
        receivedBy: user.id,
        receivedDate: new Date(),
        status: 'RECIBIDO',
        alertDate: finalAlertDate
      },
      create: {
        taxBaseId: parseInt(taxBaseId),
        amount: parseFloat(amount),
        month: month,
        alertDate: finalAlertDate,
        receivedBy: user.id,
        receivedDate: new Date(),
        status: 'RECIBIDO',
        notes: notes || null
      },
      include: {
        taxBase: {
          select: {
            id: true,
            name: true,
            description: true,
            recurringDay: true,
            isRecurring: true
          }
        },
        receivedByUser: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      }
    });

    return NextResponse.json(taxRecord, { status: 201 });
  } catch (error) {
    console.error('Error creating/updating tax record:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
