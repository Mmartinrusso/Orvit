import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/lib/auth/shared-helpers';

export const dynamic = 'force-dynamic';

// GET - Obtener movimientos
export async function GET(request: NextRequest) {
  try {
    const { user, error } = await requirePermission('panol.view_products');
    if (error) return error;

    // companyId always from JWT — ignore query param
    const companyId = user!.companyId;

    const { searchParams } = new URL(request.url);
    const toolId = searchParams.get('toolId');
    const limit = parseInt(searchParams.get('limit') || '50');

    const whereClause: any = {
      tool: { companyId }
    };

    if (toolId) {
      whereClause.toolId = parseInt(toolId);
    }

    // Filtro de rango de fechas
    const dateFrom = searchParams.get('dateFrom');
    const dateTo = searchParams.get('dateTo');

    if (dateFrom) {
      whereClause.createdAt = { ...whereClause.createdAt, gte: new Date(dateFrom) };
    }
    if (dateTo) {
      const endDate = new Date(dateTo);
      endDate.setHours(23, 59, 59, 999);
      whereClause.createdAt = { ...whereClause.createdAt, lte: endDate };
    }

    const movements = await prisma.toolMovement.findMany({
      where: whereClause,
      take: limit,
      orderBy: {
        createdAt: 'desc'
      },
      include: {
        tool: {
          select: {
            id: true,
            name: true,
            itemType: true
          }
        }
      }
    });

    // Batch-lookup de usuarios (ToolMovement no tiene relación Prisma con User)
    const userIds = [...new Set(movements.filter(m => m.userId).map(m => m.userId!))];
    const users = userIds.length > 0
      ? await prisma.user.findMany({
          where: { id: { in: userIds } },
          select: { id: true, name: true }
        })
      : [];
    const userMap = new Map(users.map(u => [u.id, u]));

    const movementsWithUsers = movements.map(m => ({
      ...m,
      user: m.userId ? userMap.get(m.userId) ?? null : null,
    }));

    return NextResponse.json({
      success: true,
      movements: movementsWithUsers
    });

  } catch (error) {
    console.error('Error fetching movements:', error);
    return NextResponse.json(
      { error: 'Error al obtener movimientos' },
      { status: 500 }
    );
  }
  // ✅ OPTIMIZADO: Removido $disconnect()
}

// POST - Crear nuevo movimiento
export async function POST(request: NextRequest) {
  try {
    const { user: authUser, error } = await requirePermission('panol.register_movement');
    if (error) return error;

    const body = await request.json();
    const {
      toolId,
      type, // 'IN' | 'OUT' | 'TRANSFER' | 'ADJUSTMENT' | 'LOAN' | 'RETURN'
      quantity,
      fromLocation,
      toLocation,
      reason,
      notes,
      workOrderId
    } = body;

    // Validaciones
    if (!toolId || !type || !quantity || !reason) {
      return NextResponse.json(
        { error: 'Faltan campos requeridos: toolId, type, quantity, reason' },
        { status: 400 }
      );
    }

    if (!['IN', 'OUT', 'TRANSFER', 'ADJUSTMENT', 'LOAN', 'RETURN'].includes(type)) {
      return NextResponse.json(
        { error: 'Tipo de movimiento inválido' },
        { status: 400 }
      );
    }

    // ADJUSTMENT puede enviar cantidad negativa (delta respecto al stock anterior)
    if (type !== 'ADJUSTMENT' && quantity <= 0) {
      return NextResponse.json(
        { error: 'La cantidad debe ser mayor a 0' },
        { status: 400 }
      );
    }

    const userId = authUser!.id;

    // Obtener la herramienta
    const tool = await prisma.tool.findFirst({
      where: {
        id: parseInt(toolId)
      }
    });

    if (!tool) {
      return NextResponse.json(
        { error: 'Herramienta no encontrada' },
        { status: 404 }
      );
    }

    // Verificar que el usuario tiene acceso a la empresa de la herramienta
    const userAccess = await prisma.userOnCompany.findFirst({
      where: { userId, companyId: tool.companyId }
    });
    if (!userAccess) {
      return NextResponse.json({ error: 'Sin acceso a este recurso' }, { status: 403 });
    }

    // Verificar stock para salidas
    if ((type === 'OUT' || type === 'LOAN') && tool.stockQuantity < quantity) {
      return NextResponse.json(
        { error: `Stock insuficiente. Disponible: ${tool.stockQuantity}` },
        { status: 400 }
      );
    }

    // Crear el movimiento en una transacción
    const result = await prisma.$transaction(async (tx) => {
      // 1. Crear el movimiento
      const movement = await tx.toolMovement.create({
        data: {
          toolId: parseInt(toolId),
          type,
          quantity: parseInt(quantity),
          reason,
          description: notes,
          userId: userId,
        },
        include: {
          tool: {
            select: {
              id: true,
              name: true,
              itemType: true
            }
          }
        }
      });

      // 2. Actualizar stock según el tipo de movimiento
      let newStock = tool.stockQuantity;
      
      switch (type) {
        case 'IN':
          newStock += quantity;
          break;
        case 'OUT':
        case 'LOAN':
          newStock -= quantity;
          break;
        case 'RETURN':
          newStock += quantity;
          break;
        case 'ADJUSTMENT':
          // quantity puede ser positivo o negativo según el ajuste
          newStock += quantity;
          break;
        // TRANSFER no afecta el stock total del sistema
      }

      // 3. Actualizar el stock de la herramienta
      await tx.tool.update({
        where: { id: parseInt(toolId) },
        data: { 
          stockQuantity: newStock,
          updatedAt: new Date()
        }
      });

      return movement;
    });

    // Verificación de notificaciones de stock bajo - VERIFICACIÓN ÚNICA
    const newStock = tool.itemType === 'SUPPLY' ?
      (type === 'OUT' || type === 'LOAN' ? tool.stockQuantity - quantity :
       type === 'IN' || type === 'RETURN' || type === 'ADJUSTMENT' ? tool.stockQuantity + quantity :
       tool.stockQuantity) : tool.stockQuantity;

    // Solo notificar cuando llegue al stock mínimo, NO cuando esté en 0
    if (newStock <= tool.minStockLevel && newStock > 0) {
      try {
        const checkResult = await fetch(`${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/notifications/stock-check`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            companyId: tool.companyId,
            toolId: tool.id
          })
        });

        if (checkResult.ok) {
          const checkData = await checkResult.json();
          console.log(`✅ Verificación de stock única completada: ${checkData.notificationsSent} notificaciones enviadas`);
        }
      } catch (notificationError) {
        console.error('Error enviando notificación de stock:', notificationError);
      }
    }
    const message = getMovementMessage(type, tool.name, quantity, toLocation);

    return NextResponse.json({
      success: true,
      movement: result,
      message
    });

  } catch (error) {
    console.error('Error creating movement:', error);
    return NextResponse.json(
      { error: 'Error al registrar movimiento' },
      { status: 500 }
    );
  }
  // ✅ OPTIMIZADO: Removido $disconnect()
}

// Función auxiliar para generar mensajes
function getMovementMessage(type: string, toolName: string, quantity: number, location?: string) {
  const locationText = location ? ` hacia ${location}` : '';
  
  switch (type) {
    case 'IN':
      return `Entrada registrada: ${quantity} unidades de ${toolName}${locationText}`;
    case 'OUT':
      return `Salida registrada: ${quantity} unidades de ${toolName}${locationText}`;
    case 'TRANSFER':
      return `Transferencia registrada: ${quantity} unidades de ${toolName}${locationText}`;
    case 'LOAN':
      return `Préstamo registrado: ${quantity} unidades de ${toolName}${locationText}`;
    case 'ADJUSTMENT':
      return `Ajuste registrado: ${quantity} unidades de ${toolName}${locationText}`;
    case 'RETURN':
      return `Devolución registrada: ${quantity} unidades de ${toolName}${locationText}`;
    default:
      return `Movimiento registrado: ${quantity} unidades de ${toolName}`;
  }
} 