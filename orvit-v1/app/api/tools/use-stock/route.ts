import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';
import { JWT_SECRET } from '@/lib/auth';
import { createAndSendInstantNotification, broadcastToCompany } from '@/lib/instant-notifications';

export const dynamic = 'force-dynamic';

const JWT_SECRET_KEY = new TextEncoder().encode(JWT_SECRET);

// Helper para obtener el usuario actual
async function getCurrentUser() {
  try {
    const token = cookies().get('token')?.value;
    if (!token) {
      throw new Error('No hay token de autenticación');
    }

    const { payload } = await jwtVerify(token, JWT_SECRET_KEY);
    
    const user = await prisma.user.findUnique({
      where: { id: payload.userId as number }
    });

    return user;
  } catch (error) {
    console.error('Error obteniendo usuario:', error);
    return null;
  }
}

// POST /api/tools/use-stock - Usar/consumir stock de herramientas
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { toolId, quantity, workOrderId, reason, notes } = body;

    if (!toolId || !quantity) {
      return NextResponse.json(
        { error: 'ID de herramienta y cantidad son requeridos' },
        { status: 400 }
      );
    }

    // Verificar usuario
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json(
        { error: 'Usuario no autenticado' },
        { status: 401 }
      );
    }

    // Obtener la herramienta actual
    const tool = await prisma.tool.findUnique({
      where: { id: parseInt(toolId) }
    });

    if (!tool) {
      return NextResponse.json(
        { error: 'Herramienta no encontrada' },
        { status: 404 }
      );
    }

    // Verificar stock disponible
    if (tool.stockQuantity < parseInt(quantity)) {
      return NextResponse.json(
        { error: `Stock insuficiente. Disponible: ${tool.stockQuantity}, Solicitado: ${quantity}` },
        { status: 400 }
      );
    }

    // Calcular nuevo stock
    const newStock = tool.stockQuantity - parseInt(quantity);

    // Actualizar stock
    const updatedTool = await prisma.tool.update({
      where: { id: parseInt(toolId) },
      data: {
        stockQuantity: newStock,
        updatedAt: new Date()
      }
    });

    // Crear movimiento de stock
    await prisma.toolMovement.create({
      data: {
        toolId: parseInt(toolId),
        type: 'OUT',
        quantity: parseInt(quantity),
        reason: reason || 'Uso en trabajo/mantenimiento',
        userId: currentUser.id,
        description: notes || null
      }
    });

    // Notificación instantánea de stock bajo via SSE
    if (newStock <= tool.minStockLevel) {
      try {
        const isCritical = tool.isCritical;
        const isOutOfStock = newStock === 0;

        // Notificación instantánea a todos los usuarios de la empresa
        const notificationData = {
          id: `stock_${tool.id}_${Date.now()}`,
          type: isOutOfStock ? 'stock_out' : 'stock_low',
          title: isOutOfStock
            ? `🚨 ${isCritical ? 'CRÍTICO: ' : ''}${tool.name} SIN STOCK`
            : `⚠️ Stock bajo: ${tool.name}`,
          message: isOutOfStock
            ? `El item "${tool.name}" se quedó sin stock. Reponer urgentemente.`
            : `Stock: ${newStock}/${tool.minStockLevel} unidades.`,
          priority: isOutOfStock || isCritical ? 'urgent' : 'high',
          timestamp: new Date(),
          read: false,
          relatedData: {
            toolId: tool.id,
            toolName: tool.name,
            toolCode: tool.code,
            previousStock: tool.stockQuantity,
            newStock,
            minStock: tool.minStockLevel,
            isCritical,
            itemType: tool.itemType
          }
        };

        // Broadcast a todos los usuarios conectados de la empresa
        const broadcastCount = broadcastToCompany(tool.companyId, notificationData);
        console.log(`📢 Stock alert broadcast enviado a ${broadcastCount} usuarios de empresa ${tool.companyId}`);

        // Llamar al endpoint de stock-check para crear notificaciones persistentes (con cache)
        fetch(`${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/notifications/stock-check`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            companyId: tool.companyId,
            toolId: tool.id
          })
        }).catch(err => console.error('Error en stock-check async:', err));

      } catch (notificationError) {
        console.error('Error enviando notificación de stock:', notificationError);
      }
    }

    return NextResponse.json({
      success: true,
      tool: updatedTool,
      previousStock: tool.stockQuantity,
      newStock: newStock,
      quantityUsed: parseInt(quantity),
      message: `Stock actualizado.`,
      stockAlert: newStock === 0 ? 'SIN_STOCK' : newStock <= tool.minStockLevel ? 'STOCK_MINIMO' : null
    });

  } catch (error) {
    console.error('Error en POST /api/tools/use-stock:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor: ' + (error as Error).message },
      { status: 500 }
    );
  }
} 