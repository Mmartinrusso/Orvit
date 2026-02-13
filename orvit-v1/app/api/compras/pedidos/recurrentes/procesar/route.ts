import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { RecurringFrequency } from '@prisma/client';

export const dynamic = 'force-dynamic';

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

// POST - Procesar todos los pedidos recurrentes pendientes (llamado por cron)
// Puede ser llamado por Vercel Cron, GitHub Actions, o cualquier scheduler
export async function POST(request: NextRequest) {
  try {
    // Verificar token de seguridad (opcional, para proteger el endpoint)
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      // Si hay un secreto configurado y no coincide, rechazar
      // Pero si no hay secreto, permitir (para desarrollo)
      if (cronSecret) {
        return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
      }
    }

    const ahora = new Date();
    console.log(`[Cron] Procesando pedidos recurrentes - ${ahora.toISOString()}`);

    // Buscar todos los pedidos recurrentes activos cuya próxima ejecución ya pasó
    const pendientes = await prisma.recurringPurchaseOrder.findMany({
      where: {
        isActive: true,
        proximaEjecucion: {
          lte: ahora
        }
      },
      include: {
        items: true
      }
    });

    console.log(`[Cron] Encontrados ${pendientes.length} pedidos recurrentes para procesar`);

    const resultados = {
      procesados: 0,
      exitosos: 0,
      fallidos: 0,
      detalles: [] as any[]
    };

    for (const recurrente of pendientes) {
      resultados.procesados++;

      try {
        if (recurrente.items.length === 0) {
          throw new Error('El pedido recurrente no tiene items');
        }

        // Crear el pedido en transacción
        const pedido = await prisma.$transaction(async (tx) => {
          const numero = await generateRequestNumber(recurrente.companyId, tx);

          // Calcular fecha de necesidad
          const fechaNecesidad = new Date();
          fechaNecesidad.setDate(fechaNecesidad.getDate() + (recurrente.diasParaNecesidad || 7));

          // Crear el pedido de compra en estado ENVIADA
          const nuevoPedido = await tx.purchaseRequest.create({
            data: {
              numero,
              titulo: recurrente.tituloPedido,
              descripcion: `[Generado automáticamente] Pedido recurrente: ${recurrente.nombre}`,
              estado: 'ENVIADA',
              prioridad: recurrente.prioridad,
              departamento: recurrente.departamento,
              fechaNecesidad,
              notas: recurrente.notas,
              solicitanteId: recurrente.creadorId,
              companyId: recurrente.companyId,
              items: {
                create: recurrente.items.map(item => ({
                  descripcion: item.descripcion,
                  cantidad: item.cantidad,
                  unidad: item.unidad,
                  especificaciones: item.especificaciones
                }))
              }
            }
          });

          // Comentario de sistema
          await tx.purchaseComment.create({
            data: {
              entidad: 'request',
              entidadId: nuevoPedido.id,
              tipo: 'SISTEMA',
              contenido: `Pedido generado automáticamente desde pedido recurrente "${recurrente.nombre}" (ejecución programada)`,
              companyId: recurrente.companyId,
              userId: recurrente.creadorId
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
            where: { id: recurrente.id },
            data: {
              ultimaEjecucion: new Date(),
              proximaEjecucion,
              totalEjecuciones: { increment: 1 }
            }
          });

          // Registrar en historial
          await tx.recurringPurchaseHistory.create({
            data: {
              recurringOrderId: recurrente.id,
              purchaseRequestId: nuevoPedido.id,
              estado: 'SUCCESS'
            }
          });

          return nuevoPedido;
        });

        resultados.exitosos++;
        resultados.detalles.push({
          recurrenteId: recurrente.id,
          nombre: recurrente.nombre,
          pedidoNumero: pedido.numero,
          estado: 'SUCCESS'
        });

        console.log(`[Cron] ✓ Pedido ${pedido.numero} generado para "${recurrente.nombre}"`);

      } catch (error: any) {
        resultados.fallidos++;

        // Registrar fallo en historial
        await prisma.recurringPurchaseHistory.create({
          data: {
            recurringOrderId: recurrente.id,
            estado: 'FAILED',
            errorMessage: error.message
          }
        });

        resultados.detalles.push({
          recurrenteId: recurrente.id,
          nombre: recurrente.nombre,
          estado: 'FAILED',
          error: error.message
        });

        console.error(`[Cron] ✗ Error en "${recurrente.nombre}":`, error.message);
      }
    }

    console.log(`[Cron] Completado: ${resultados.exitosos} exitosos, ${resultados.fallidos} fallidos`);

    return NextResponse.json({
      success: true,
      timestamp: ahora.toISOString(),
      ...resultados
    });
  } catch (error: any) {
    console.error('[Cron] Error general:', error);
    return NextResponse.json(
      { error: error.message || 'Error procesando pedidos recurrentes' },
      { status: 500 }
    );
  }
}

// GET - Estado del sistema de pedidos recurrentes
export async function GET() {
  try {
    const ahora = new Date();

    const stats = await prisma.recurringPurchaseOrder.aggregate({
      where: { isActive: true },
      _count: { id: true }
    });

    const pendientes = await prisma.recurringPurchaseOrder.count({
      where: {
        isActive: true,
        proximaEjecucion: { lte: ahora }
      }
    });

    const proximosHoy = await prisma.recurringPurchaseOrder.count({
      where: {
        isActive: true,
        proximaEjecucion: {
          gte: ahora,
          lt: new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate() + 1)
        }
      }
    });

    return NextResponse.json({
      activos: stats._count.id,
      pendientesEjecucion: pendientes,
      programadosHoy: proximosHoy,
      timestamp: ahora.toISOString()
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Error obteniendo estado' },
      { status: 500 }
    );
  }
}
