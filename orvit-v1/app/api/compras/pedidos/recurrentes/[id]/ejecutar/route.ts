import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';
import { prisma } from '@/lib/prisma';
import { JWT_SECRET } from '@/lib/auth';
import { RecurringFrequency } from '@prisma/client';

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

// Genera número de pedido: REQ-2026-00001
async function generateRequestNumber(companyId: number, tx?: any): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `REQ-${year}-`;

  const client = tx || prisma;
  const lastRequest = await client.purchaseRequest.findFirst({
    where: {
      companyId,
      numero: { startsWith: prefix },
    },
    orderBy: { numero: 'desc' },
    select: { numero: true },
  });

  let nextNumber = 1;
  if (lastRequest?.numero) {
    const parts = lastRequest.numero.split('-');
    const lastNum = parseInt(parts[2] || '0', 10);
    nextNumber = lastNum + 1;
  }

  return `${prefix}${String(nextNumber).padStart(5, '0')}`;
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
      proxima.setDate(proxima.getDate() + 1);
      break;

    case 'SEMANAL':
      proxima.setDate(proxima.getDate() + 7);
      break;

    case 'QUINCENAL':
      proxima.setDate(proxima.getDate() + 15);
      break;

    case 'MENSUAL':
      proxima.setMonth(proxima.getMonth() + 1);
      if (diaMes) {
        proxima.setDate(diaMes);
      }
      break;
  }

  return proxima;
}

// POST - Ejecutar manualmente un pedido recurrente (genera el pedido)
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getUserFromToken();
    if (!user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const companyId = user.companies?.[0]?.companyId;
    if (!companyId) {
      return NextResponse.json({ error: 'Usuario no tiene empresa asignada' }, { status: 400 });
    }

    const { id } = await params;
    const recurrenteId = parseInt(id);

    // Obtener el pedido recurrente con items
    const recurrente = await prisma.recurringPurchaseOrder.findFirst({
      where: { id: recurrenteId, companyId },
      include: { items: true }
    });

    if (!recurrente) {
      return NextResponse.json({ error: 'Pedido recurrente no encontrado' }, { status: 404 });
    }

    if (!recurrente.isActive) {
      return NextResponse.json({ error: 'El pedido recurrente está desactivado' }, { status: 400 });
    }

    if (recurrente.items.length === 0) {
      return NextResponse.json({ error: 'El pedido recurrente no tiene items' }, { status: 400 });
    }

    // Crear el pedido en transacción
    const resultado = await prisma.$transaction(async (tx) => {
      const numero = await generateRequestNumber(companyId, tx);

      // Calcular fecha de necesidad
      const fechaNecesidad = new Date();
      fechaNecesidad.setDate(fechaNecesidad.getDate() + (recurrente.diasParaNecesidad || 7));

      // Crear el pedido de compra en estado ENVIADA (pendiente)
      const pedido = await tx.purchaseRequest.create({
        data: {
          numero,
          titulo: recurrente.tituloPedido,
          descripcion: `[Generado automáticamente] Pedido recurrente: ${recurrente.nombre}`,
          estado: 'ENVIADA', // Directo a ENVIADA, no borrador
          prioridad: recurrente.prioridad,
          departamento: recurrente.departamento,
          fechaNecesidad,
          notas: recurrente.notas,
          solicitanteId: recurrente.creadorId,
          companyId,
          items: {
            create: recurrente.items.map(item => ({
              descripcion: item.descripcion,
              cantidad: item.cantidad,
              unidad: item.unidad,
              especificaciones: item.especificaciones
            }))
          }
        },
        include: {
          items: true,
          solicitante: { select: { id: true, name: true } }
        }
      });

      // Registrar comentario de sistema
      await tx.purchaseComment.create({
        data: {
          entidad: 'request',
          entidadId: pedido.id,
          tipo: 'SISTEMA',
          contenido: `Pedido generado automáticamente desde pedido recurrente "${recurrente.nombre}"`,
          companyId,
          userId: user.id
        }
      });

      // Calcular próxima ejecución
      const proximaEjecucion = calcularProximaEjecucion(
        recurrente.frecuencia,
        recurrente.diaSemana,
        recurrente.diaMes,
        recurrente.horaEjecucion
      );

      // Actualizar pedido recurrente
      await tx.recurringPurchaseOrder.update({
        where: { id: recurrenteId },
        data: {
          ultimaEjecucion: new Date(),
          proximaEjecucion,
          totalEjecuciones: { increment: 1 }
        }
      });

      // Registrar en historial
      await tx.recurringPurchaseHistory.create({
        data: {
          recurringOrderId: recurrenteId,
          purchaseRequestId: pedido.id,
          estado: 'SUCCESS'
        }
      });

      return pedido;
    });

    return NextResponse.json({
      success: true,
      pedido: resultado,
      message: `Pedido ${resultado.numero} generado exitosamente`
    });
  } catch (error: any) {
    console.error('Error executing recurring order:', error);

    // Registrar fallo en historial si es posible
    try {
      const { id } = await params;
      await prisma.recurringPurchaseHistory.create({
        data: {
          recurringOrderId: parseInt(id),
          estado: 'FAILED',
          errorMessage: error.message
        }
      });
    } catch {}

    return NextResponse.json(
      { error: error.message || 'Error al ejecutar pedido recurrente' },
      { status: 500 }
    );
  }
}
