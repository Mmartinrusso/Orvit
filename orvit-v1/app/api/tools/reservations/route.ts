/**
 * API: /api/tools/reservations
 *
 * GET - Listar reservas de repuestos con filtros
 * POST - Crear nueva reserva para una orden de trabajo
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth';

export const dynamic = 'force-dynamic';

/**
 * GET /api/tools/reservations
 * Listar reservas con filtros por companyId, workOrderId, status, etc.
 */
export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;

    if (!token) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }

    const payload = await verifyToken(token);
    if (!payload || !payload.companyId) {
      return NextResponse.json({ error: 'Token inválido' }, { status: 401 });
    }

    const companyId = payload.companyId as number;
    const { searchParams } = new URL(request.url);

    const workOrderId = searchParams.get('workOrderId');
    const toolId = searchParams.get('toolId');
    const status = searchParams.get('status');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');

    const where: any = { companyId };

    if (workOrderId) {
      where.workOrderId = parseInt(workOrderId);
    }

    if (toolId) {
      where.toolId = parseInt(toolId);
    }

    if (status && status !== 'all') {
      where.status = status;
    }

    const [reservations, total] = await Promise.all([
      prisma.sparePartReservation.findMany({
        where,
        include: {
          tool: {
            select: {
              id: true,
              name: true,
              itemType: true,
              category: true,
              stockQuantity: true,
              minStockLevel: true,
              unit: true
            }
          },
          workOrder: {
            select: {
              id: true,
              title: true,
              status: true,
              type: true,
              priority: true,
              machine: {
                select: {
                  id: true,
                  name: true
                }
              }
            }
          },
          pickedBy: {
            select: {
              id: true,
              name: true
            }
          },
          returnedBy: {
            select: {
              id: true,
              name: true
            }
          }
        },
        orderBy: { reservedAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit
      }),
      prisma.sparePartReservation.count({ where })
    ]);

    // Calcular estadísticas
    const stats = await prisma.sparePartReservation.groupBy({
      by: ['status'],
      where: { companyId },
      _count: { id: true }
    });

    const statusCounts = {
      PENDING: 0,
      PICKED: 0,
      CANCELLED: 0,
      RETURNED: 0
    };

    stats.forEach(s => {
      statusCounts[s.status as keyof typeof statusCounts] = s._count.id;
    });

    return NextResponse.json({
      success: true,
      data: reservations,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      },
      stats: statusCounts
    });

  } catch (error) {
    console.error('Error en GET /api/tools/reservations:', error);
    return NextResponse.json(
      { error: 'Error al obtener reservas' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/tools/reservations
 * Crear una nueva reserva de repuesto para una orden de trabajo
 */
export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;

    if (!token) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }

    const payload = await verifyToken(token);
    if (!payload || !payload.companyId) {
      return NextResponse.json({ error: 'Token inválido' }, { status: 401 });
    }

    const companyId = payload.companyId as number;
    const userId = payload.userId as number;

    const body = await request.json();
    const { toolId, workOrderId, quantity, notes } = body;

    // Validaciones
    if (!toolId || !workOrderId || !quantity) {
      return NextResponse.json(
        { error: 'toolId, workOrderId y quantity son requeridos' },
        { status: 400 }
      );
    }

    if (quantity <= 0) {
      return NextResponse.json(
        { error: 'La cantidad debe ser mayor a 0' },
        { status: 400 }
      );
    }

    // Verificar que la herramienta existe y pertenece a la compañía
    const tool = await prisma.tool.findFirst({
      where: {
        id: parseInt(toolId),
        companyId
      }
    });

    if (!tool) {
      return NextResponse.json(
        { error: 'Herramienta no encontrada' },
        { status: 404 }
      );
    }

    // Verificar stock disponible (stock actual menos reservas pendientes)
    const pendingReservations = await prisma.sparePartReservation.aggregate({
      where: {
        toolId: parseInt(toolId),
        status: 'PENDING'
      },
      _sum: { quantity: true }
    });

    const reservedQuantity = pendingReservations._sum.quantity || 0;
    const availableStock = tool.stockQuantity - reservedQuantity;

    if (availableStock < quantity) {
      return NextResponse.json(
        {
          error: `Stock insuficiente. Disponible: ${availableStock} (${tool.stockQuantity} en stock - ${reservedQuantity} reservados)`,
          availableStock,
          requested: quantity
        },
        { status: 400 }
      );
    }

    // Verificar que la orden de trabajo existe y pertenece a la compañía
    const workOrder = await prisma.workOrder.findFirst({
      where: {
        id: parseInt(workOrderId),
        companyId
      }
    });

    if (!workOrder) {
      return NextResponse.json(
        { error: 'Orden de trabajo no encontrada' },
        { status: 404 }
      );
    }

    // Verificar que la OT no esté cerrada o cancelada
    if (['completed', 'cancelled'].includes(workOrder.status)) {
      return NextResponse.json(
        { error: 'No se pueden reservar repuestos para órdenes cerradas o canceladas' },
        { status: 400 }
      );
    }

    // Verificar si ya existe una reserva pendiente para esta herramienta en esta OT
    const existingReservation = await prisma.sparePartReservation.findFirst({
      where: {
        toolId: parseInt(toolId),
        workOrderId: parseInt(workOrderId),
        status: 'PENDING'
      }
    });

    if (existingReservation) {
      // Actualizar la cantidad de la reserva existente
      const newQuantity = existingReservation.quantity + quantity;

      // Verificar que la nueva cantidad total no exceda el stock disponible
      const newAvailable = availableStock + existingReservation.quantity; // Devolver lo que ya estaba reservado
      if (newAvailable < newQuantity) {
        return NextResponse.json(
          { error: `Stock insuficiente para aumentar la reserva. Máximo disponible: ${newAvailable}` },
          { status: 400 }
        );
      }

      const updated = await prisma.sparePartReservation.update({
        where: { id: existingReservation.id },
        data: {
          quantity: newQuantity,
          notes: notes ? `${existingReservation.notes || ''}\n${notes}`.trim() : existingReservation.notes
        },
        include: {
          tool: { select: { id: true, name: true } },
          workOrder: { select: { id: true, title: true } }
        }
      });

      return NextResponse.json({
        success: true,
        data: updated,
        message: `Reserva actualizada. Nueva cantidad: ${newQuantity} ${tool.unit || 'unidades'}`,
        updated: true
      });
    }

    // Crear nueva reserva
    const reservation = await prisma.sparePartReservation.create({
      data: {
        toolId: parseInt(toolId),
        workOrderId: parseInt(workOrderId),
        quantity: parseInt(quantity),
        notes: notes || null,
        companyId
      },
      include: {
        tool: {
          select: {
            id: true,
            name: true,
            stockQuantity: true,
            unit: true
          }
        },
        workOrder: {
          select: {
            id: true,
            title: true,
            machine: {
              select: { name: true }
            }
          }
        }
      }
    });

    return NextResponse.json({
      success: true,
      data: reservation,
      message: `Reserva creada: ${quantity} ${tool.unit || 'unidades'} de ${tool.name} para OT #${workOrderId}`,
      created: true
    });

  } catch (error) {
    console.error('Error en POST /api/tools/reservations:', error);
    return NextResponse.json(
      { error: 'Error al crear reserva' },
      { status: 500 }
    );
  }
}
