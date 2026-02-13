import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

// ✅ OPTIMIZADO: Usar instancia global de prisma desde @/lib/prisma

// GET - Obtener movimientos
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get('companyId');
    const toolId = searchParams.get('toolId');
    const limit = parseInt(searchParams.get('limit') || '50');

    if (!companyId) {
      return NextResponse.json({ error: 'Company ID requerido' }, { status: 400 });
    }

    const whereClause: any = {
      tool: {
        companyId: parseInt(companyId)
      }
    };

    if (toolId) {
      whereClause.toolId = parseInt(toolId);
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

    return NextResponse.json({
      success: true,
      movements
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
    const body = await request.json();
    const {
      toolId,
      type, // 'IN' | 'OUT' | 'TRANSFER' | 'MAINTENANCE' | 'RETURN'
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

    if (!['IN', 'OUT', 'TRANSFER', 'MAINTENANCE', 'RETURN'].includes(type)) {
      return NextResponse.json(
        { error: 'Tipo de movimiento inválido' },
        { status: 400 }
      );
    }

    if (quantity <= 0) {
      return NextResponse.json(
        { error: 'La cantidad debe ser mayor a 0' },
        { status: 400 }
      );
    }

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

    // Verificar stock para salidas
    if (type === 'OUT' && tool.stockQuantity < quantity) {
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
          userId: 1 // Usuario por defecto temporal
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
          newStock -= quantity;
          break;
        case 'RETURN':
          newStock += quantity;
          break;
        // TRANSFER y MAINTENANCE no afectan el stock total
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
      (type === 'OUT' ? tool.stockQuantity - quantity : 
       type === 'IN' || type === 'RETURN' ? tool.stockQuantity + quantity : 
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
    // const newStock = tool.itemType === 'SUPPLY' ? 
    //   (type === 'OUT' ? tool.stockQuantity - quantity : 
    //    type === 'IN' || type === 'RETURN' ? tool.stockQuantity + quantity : 
    //    tool.stockQuantity) : tool.stockQuantity;

    // // Solo notificar cuando llegue al stock mínimo, NO cuando esté en 0
    // if (newStock <= tool.minStockLevel && newStock > 0) {
    //   try {
    //     await fetch(`${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/notifications/stock-check`, {
    //       method: 'POST',
    //       headers: {
    //         'Content-Type': 'application/json',
    //       },
    //       body: JSON.stringify({
    //         companyId: tool.companyId,
    //         toolId: tool.id
    //       })
    //     });
    //   } catch (notificationError) {
    //     console.error('Error enviando notificación de stock:', notificationError);
    //   }
    // }

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
      return `✅ Entrada registrada: ${quantity} unidades de ${toolName}${locationText}`;
    case 'OUT':
      return `📤 Salida registrada: ${quantity} unidades de ${toolName}${locationText}`;
    case 'TRANSFER':
      return `🔄 Transferencia registrada: ${quantity} unidades de ${toolName}${locationText}`;
    case 'MAINTENANCE':
      return `🔧 Movimiento de mantenimiento: ${quantity} unidades de ${toolName}${locationText}`;
    case 'RETURN':
      return `↩️ Devolución registrada: ${quantity} unidades de ${toolName}${locationText}`;
    default:
      return `Movimiento registrado: ${quantity} unidades de ${toolName}`;
  }
} 