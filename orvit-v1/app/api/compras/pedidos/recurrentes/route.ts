import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';
import { prisma } from '@/lib/prisma';
import { JWT_SECRET } from '@/lib/auth';
import { RecurringFrequency, RequestPriority } from '@prisma/client';

export const dynamic = 'force-dynamic';

const JWT_SECRET_KEY = new TextEncoder().encode(JWT_SECRET);

async function getUserFromToken() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;
    if (!token) return null;

    const { payload } = await jwtVerify(token, JWT_SECRET_KEY);

    const user = await prisma.user.findUnique({
      where: { id: payload.userId as number },
      select: {
        id: true,
        name: true,
        role: true,
        companies: {
          select: { companyId: true },
          take: 1
        }
      }
    });

    return user;
  } catch {
    return null;
  }
}

// Calcula la próxima fecha de ejecución
function calcularProximaEjecucion(
  frecuencia: RecurringFrequency,
  diaSemana?: number | null,
  diaMes?: number | null,
  horaEjecucion: number = 8
): Date {
  const ahora = new Date();
  let proxima = new Date(ahora);
  proxima.setHours(horaEjecucion, 0, 0, 0);

  switch (frecuencia) {
    case 'DIARIO':
      // Si ya pasó la hora, mañana
      if (ahora.getHours() >= horaEjecucion) {
        proxima.setDate(proxima.getDate() + 1);
      }
      break;

    case 'SEMANAL':
      // Próximo día de la semana especificado
      const diaObjetivo = diaSemana ?? 1; // Default lunes
      const diasHastaObjetivo = (diaObjetivo - ahora.getDay() + 7) % 7;
      proxima.setDate(ahora.getDate() + (diasHastaObjetivo === 0 && ahora.getHours() >= horaEjecucion ? 7 : diasHastaObjetivo || 7));
      break;

    case 'QUINCENAL':
      // Día 1 o 15 del mes
      const diaActual = ahora.getDate();
      if (diaActual < 15) {
        proxima.setDate(15);
      } else {
        proxima.setMonth(proxima.getMonth() + 1);
        proxima.setDate(1);
      }
      if (proxima <= ahora) {
        if (proxima.getDate() === 1) {
          proxima.setDate(15);
        } else {
          proxima.setMonth(proxima.getMonth() + 1);
          proxima.setDate(1);
        }
      }
      break;

    case 'MENSUAL':
      // Día específico del mes
      const diaMesObjetivo = diaMes ?? 1;
      proxima.setDate(diaMesObjetivo);
      if (proxima <= ahora) {
        proxima.setMonth(proxima.getMonth() + 1);
        proxima.setDate(diaMesObjetivo);
      }
      break;
  }

  return proxima;
}

// GET - Listar pedidos recurrentes
export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromToken();
    if (!user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const companyId = user.companies?.[0]?.companyId;
    if (!companyId) {
      return NextResponse.json({ error: 'Usuario no tiene empresa asignada' }, { status: 400 });
    }

    const { searchParams } = new URL(request.url);
    const includeInactive = searchParams.get('includeInactive') === 'true';

    const recurrentes = await prisma.recurringPurchaseOrder.findMany({
      where: {
        companyId,
        ...(includeInactive ? {} : { isActive: true })
      },
      include: {
        items: true,
        creador: {
          select: { id: true, name: true }
        },
        _count: {
          select: { historial: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    return NextResponse.json({ data: recurrentes });
  } catch (error: any) {
    console.error('Error fetching recurring orders:', error);
    return NextResponse.json(
      { error: error.message || 'Error al obtener pedidos recurrentes' },
      { status: 500 }
    );
  }
}

// POST - Crear pedido recurrente
export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromToken();
    if (!user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const companyId = user.companies?.[0]?.companyId;
    if (!companyId) {
      return NextResponse.json({ error: 'Usuario no tiene empresa asignada' }, { status: 400 });
    }

    const body = await request.json();
    const {
      nombre,
      descripcion,
      frecuencia,
      diaSemana,
      diaMes,
      horaEjecucion,
      tituloPedido,
      prioridad,
      departamento,
      diasParaNecesidad,
      notas,
      items
    } = body;

    // Validaciones
    if (!nombre || !tituloPedido) {
      return NextResponse.json(
        { error: 'Nombre y título del pedido son requeridos' },
        { status: 400 }
      );
    }

    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { error: 'Debe incluir al menos un item' },
        { status: 400 }
      );
    }

    // Calcular próxima ejecución
    const proximaEjecucion = calcularProximaEjecucion(
      frecuencia as RecurringFrequency || 'MENSUAL',
      diaSemana,
      diaMes,
      horaEjecucion || 8
    );

    const recurrente = await prisma.recurringPurchaseOrder.create({
      data: {
        nombre,
        descripcion,
        frecuencia: frecuencia as RecurringFrequency || 'MENSUAL',
        diaSemana: diaSemana || null,
        diaMes: diaMes || null,
        horaEjecucion: horaEjecucion || 8,
        tituloPedido,
        prioridad: prioridad as RequestPriority || 'NORMAL',
        departamento,
        diasParaNecesidad: diasParaNecesidad || 7,
        notas,
        proximaEjecucion,
        creadorId: user.id,
        companyId,
        items: {
          create: items.map((item: any) => ({
            descripcion: item.descripcion,
            cantidad: parseFloat(item.cantidad) || 1,
            unidad: item.unidad || 'UN',
            especificaciones: item.especificaciones
          }))
        }
      },
      include: {
        items: true,
        creador: { select: { id: true, name: true } }
      }
    });

    return NextResponse.json(recurrente, { status: 201 });
  } catch (error: any) {
    console.error('Error creating recurring order:', error);
    return NextResponse.json(
      { error: error.message || 'Error al crear pedido recurrente' },
      { status: 500 }
    );
  }
}
