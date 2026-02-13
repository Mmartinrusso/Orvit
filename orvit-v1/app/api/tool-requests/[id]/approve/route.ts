import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';
import { JWT_SECRET } from '@/lib/auth'; // ✅ Importar el mismo secret

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

// POST /api/tool-requests/[id]/approve - Aprobar solicitud
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();
    const { notes } = body;
    const requestId = params.id;

    // Verificar usuario actual (pañolero)
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json(
        { error: 'Usuario no autenticado' },
        { status: 401 }
      );
    }

    // Obtener la solicitud
    const requestDoc = await prisma.document.findUnique({
      where: { id: requestId }
    });

    if (!requestDoc || requestDoc.entityType !== 'TOOL_REQUEST') {
      return NextResponse.json(
        { error: 'Solicitud no encontrada' },
        { status: 404 }
      );
    }

    const requestData = JSON.parse(requestDoc.url);

    if (requestData.status !== 'PENDING') {
      return NextResponse.json(
        { error: 'Esta solicitud ya fue procesada' },
        { status: 400 }
      );
    }

    // Buscar la herramienta en el inventario
    const tool = await prisma.tool.findFirst({
      where: {
        name: {
          contains: requestData.toolName,
          mode: 'insensitive'
        },
        companyId: requestData.companyId
      }
    });

    if (!tool) {
      return NextResponse.json(
        { error: `Herramienta "${requestData.toolName}" no encontrada en el inventario` },
        { status: 404 }
      );
    }

    // Verificar stock disponible
    if (tool.stockQuantity < requestData.quantity) {
      return NextResponse.json(
        { error: `Stock insuficiente. Disponible: ${tool.stockQuantity}, Solicitado: ${requestData.quantity}` },
        { status: 400 }
      );
    }

    let result: any = {};

    // LÓGICA AUTOMÁTICA: Si es SUPPLY (repuesto) = restar stock, si es TOOL (herramienta) = préstamo
    if (tool.itemType === 'SUPPLY') {
      // REPUESTO: Restar stock directamente
      const newStock = tool.stockQuantity - requestData.quantity;
      
      await prisma.tool.update({
        where: { id: tool.id },
        data: { stockQuantity: newStock }
      });

      // Crear movimiento de stock
      await prisma.toolMovement.create({
        data: {
          toolId: tool.id,
          type: 'OUT',
          quantity: requestData.quantity,
          reason: `Consumo autorizado - ${requestData.reason}`,
          userId: currentUser.id,
          notes: `Solicitud ID: ${requestId} - Sector: ${requestData.sectorName}${notes ? ` - ${notes}` : ''}`
        }
      });

      result = {
        action: 'STOCK_CONSUMED',
        toolName: tool.name,
        quantityConsumed: requestData.quantity,
        newStock: newStock,
        message: `Stock consumido: ${requestData.quantity} unidades de ${tool.name}`
      };

    } else {
      // HERRAMIENTA: Crear préstamo
      const loan = await prisma.toolLoan.create({
        data: {
          toolId: tool.id,
          userId: requestData.requestedById,
          borrowedById: currentUser.id,
          quantity: requestData.quantity,
          notes: `Préstamo autorizado desde solicitud - ${requestData.reason}${notes ? ` - ${notes}` : ''}`,
          status: 'BORROWED'
        }
      });

      // Reducir stock disponible
      const newStock = tool.stockQuantity - requestData.quantity;
      await prisma.tool.update({
        where: { id: tool.id },
        data: {
          stockQuantity: newStock,
          status: newStock === 0 ? 'IN_USE' : tool.status
        }
      });

      // Crear movimiento de stock
      await prisma.toolMovement.create({
        data: {
          toolId: tool.id,
          type: 'OUT',
          quantity: requestData.quantity,
          reason: `Préstamo autorizado - ${requestData.reason}`,
          userId: currentUser.id,
          notes: `Préstamo ID: ${loan.id} - Solicitud ID: ${requestId}${notes ? ` - ${notes}` : ''}`
        }
      });

      result = {
        action: 'LOAN_CREATED',
        toolName: tool.name,
        loanId: loan.id,
        borrowerName: requestData.requestedByName,
        quantityLoaned: requestData.quantity,
        newStock: newStock,
        message: `Préstamo creado: ${requestData.quantity} unidades de ${tool.name} para ${requestData.requestedByName}`
      };
    }

    // Marcar solicitud como aprobada
    const updatedRequestData = {
      ...requestData,
      status: 'APPROVED',
      approvedAt: new Date().toISOString(),
      approvedById: currentUser.id,
      approvedByName: currentUser.name,
      processingNotes: notes || null,
      processingResult: result
    };

    await prisma.document.update({
      where: { id: requestId },
      data: {
        url: JSON.stringify(updatedRequestData)
      }
    });

    // Verificación de notificaciones de stock bajo - VERIFICACIÓN ÚNICA
    if (result.newStock <= tool.minStockLevel && result.newStock > 0) {
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

    return NextResponse.json({
      success: true,
      ...result,
      approvedBy: currentUser.name
    });

  } catch (error) {
    console.error('Error en POST /api/tool-requests/[id]/approve:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor: ' + (error as Error).message },
      { status: 500 }
    );
  }
}

// POST /api/tool-requests/[id]/reject - Rechazar solicitud
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();
    const { reason } = body;
    const requestId = params.id;

    // Verificar usuario actual (pañolero)
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json(
        { error: 'Usuario no autenticado' },
        { status: 401 }
      );
    }

    // Obtener la solicitud
    const requestDoc = await prisma.document.findUnique({
      where: { id: requestId }
    });

    if (!requestDoc || requestDoc.entityType !== 'TOOL_REQUEST') {
      return NextResponse.json(
        { error: 'Solicitud no encontrada' },
        { status: 404 }
      );
    }

    const requestData = JSON.parse(requestDoc.url);

    if (requestData.status !== 'PENDING') {
      return NextResponse.json(
        { error: 'Esta solicitud ya fue procesada' },
        { status: 400 }
      );
    }

    // Marcar solicitud como rechazada
    const updatedRequestData = {
      ...requestData,
      status: 'REJECTED',
      rejectedAt: new Date().toISOString(),
      rejectedById: currentUser.id,
      rejectedByName: currentUser.name,
      rejectionReason: reason || 'Sin motivo especificado'
    };

    await prisma.document.update({
      where: { id: requestId },
      data: {
        url: JSON.stringify(updatedRequestData)
      }
    });

    return NextResponse.json({
      success: true,
      message: `Solicitud rechazada por ${currentUser.name}`,
      rejectionReason: reason || 'Sin motivo especificado'
    });

  } catch (error) {
    console.error('Error en PUT /api/tool-requests/[id]/reject:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor: ' + (error as Error).message },
      { status: 500 }
    );
  }
} 