import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/lib/auth/shared-helpers';

export const dynamic = 'force-dynamic';

// POST /api/tools/restock - Reponer stock de herramientas
export async function POST(request: NextRequest) {
  try {
    const { user: authUser, error } = await requirePermission('tools.manage_stock');
    if (error) return error;

    const body = await request.json();
    const { toolId, quantity, reason, notes, supplier } = body;

    if (!toolId || !quantity) {
      return NextResponse.json(
        { error: 'ID de herramienta y cantidad son requeridos' },
        { status: 400 }
      );
    }

    const currentUser = { id: authUser!.id };

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

    // Calcular nuevo stock
    const newStock = tool.stockQuantity + parseInt(quantity);

    // Actualizar stock
    const updatedTool = await prisma.tool.update({
      where: { id: parseInt(toolId) },
      data: {
        stockQuantity: newStock,
        supplier: supplier || tool.supplier, // Actualizar proveedor si se proporciona
        updatedAt: new Date()
      }
    });

    // Crear movimiento de stock
    await prisma.toolMovement.create({
      data: {
        toolId: parseInt(toolId),
        type: 'IN',
        quantity: parseInt(quantity),
        reason: reason || 'Reposición de stock',
        userId: currentUser.id,
        description: notes || null
      }
    });

    // Verificar si ya no necesita notificaciones (salió del stock bajo)
    // Si estaba en stock bajo/sin stock y ahora está por encima del mínimo,
    // podríamos implementar notificaciones de "stock repuesto" en el futuro

    let stockStatus = 'NORMAL';
    if (newStock === 0) {
      stockStatus = 'SIN_STOCK';
    } else if (newStock <= tool.minStockLevel) {
      stockStatus = 'STOCK_MINIMO';
    }

    // Verificación de notificaciones de stock bajo - DESACTIVADA
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

    return NextResponse.json({
      success: true,
      tool: updatedTool,
      previousStock: tool.stockQuantity,
      newStock: newStock,
      quantityAdded: parseInt(quantity),
      stockStatus: stockStatus,
      message: `Stock repuesto exitosamente. ${stockStatus === 'NORMAL' ? 'Stock normalizado.' : 'Stock aún en nivel bajo.'}`
    });

  } catch (error) {
    console.error('Error en POST /api/tools/restock:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor: ' + (error as Error).message },
      { status: 500 }
    );
  }
  // ✅ OPTIMIZADO: Removido $disconnect()
} 