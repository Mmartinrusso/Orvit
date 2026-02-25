import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';
import { JWT_SECRET } from '@/lib/auth'; // ✅ Importar el mismo secret

export const dynamic = 'force-dynamic';

// ✅ OPTIMIZADO: Usar instancia global de prisma desde @/lib/prisma

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
      where: { id: payload.userId as number },
      include: {
        companies: {
          include: {
            company: true
          }
        },
        ownedCompanies: true
      }
    });

    return user;
  } catch (error) {
    console.error('Error obteniendo usuario:', error);
    return null;
  }
}

// GET /api/tools/loans - Obtener préstamos activos
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get('companyId');
    const status = searchParams.get('status') || 'BORROWED';
    const toolId = searchParams.get('toolId');

    if (!companyId) {
      return NextResponse.json(
        { error: 'Company ID es requerido' },
        { status: 400 }
      );
    }

    const whereConditions: any = {
      tool: {
        companyId: parseInt(companyId)
      },
      status: status
    };

    if (toolId) {
      whereConditions.toolId = parseInt(toolId);
    }

    const loans = await prisma.toolLoan.findMany({
      where: whereConditions,
      include: {
        tool: {
          select: {
            id: true,
            name: true,
            itemType: true,
            category: true,
            serialNumber: true
          }
        },
        user: {
          select: {
            id: true,
            name: true,
            email: true
          }
        },
        worker: {
          select: {
            id: true,
            name: true,
            phone: true,
            specialty: true
          }
        }
      },
      orderBy: { borrowedAt: 'desc' }
    });

    return NextResponse.json({
      success: true,
      loans: loans,
      total: loans.length
    });

  } catch (error) {
    console.error('Error en GET /api/tools/loans:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
  // ✅ OPTIMIZADO: Removido $disconnect()
}

// POST /api/tools/loans - Crear nuevo préstamo
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
      toolId, 
      userId, // A quién se le presta (puede ser usuario o operario)
      borrowerType, // "USER" o "WORKER"
      quantity, 
      expectedReturnDate,
      notes 
    } = body;

    if (!toolId || !userId || !quantity || !borrowerType) {
      return NextResponse.json(
        { error: 'ID de herramienta, usuario/operario, tipo y cantidad son requeridos' },
        { status: 400 }
      );
    }

    // Verificar usuario actual (pañolero)
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json(
        { error: 'Usuario no autenticado' },
        { status: 401 }
      );
    }

    // Verificar que la herramienta existe y tiene stock
    const tool = await prisma.tool.findUnique({
      where: { id: parseInt(toolId) }
    });

    if (!tool) {
      return NextResponse.json(
        { error: 'Herramienta no encontrada' },
        { status: 404 }
      );
    }

    if (tool.stockQuantity < parseInt(quantity)) {
      return NextResponse.json(
        { error: `Stock insuficiente. Disponible: ${tool.stockQuantity}, Solicitado: ${quantity}` },
        { status: 400 }
      );
    }

    // Verificar que el usuario/operario destino existe
    let borrower: any;
    let borrowerName: string;
    
    if (borrowerType === 'USER') {
      borrower = await prisma.user.findUnique({
        where: { id: parseInt(userId) }
      });
      if (!borrower) {
        return NextResponse.json(
          { error: 'Usuario no encontrado' },
          { status: 404 }
        );
      }
      borrowerName = borrower.name;
    } else if (borrowerType === 'WORKER') {
      borrower = await prisma.worker.findUnique({
        where: { id: parseInt(userId) }
      });
      if (!borrower) {
        return NextResponse.json(
          { error: 'Operario no encontrado' },
          { status: 404 }
        );
      }
      borrowerName = borrower.name;
    } else {
      return NextResponse.json(
        { error: 'Tipo de prestamista inválido' },
        { status: 400 }
      );
    }

    // Crear préstamo
    const loanData: any = {
      toolId: parseInt(toolId),
      quantity: parseInt(quantity),
      expectedReturnDate: expectedReturnDate ? new Date(expectedReturnDate) : null,
      notes: notes || null,
      status: 'BORROWED',
    };

    // Agregar el ID correspondiente según el tipo
    if (borrowerType === 'USER') {
      loanData.userId = parseInt(userId);
    } else {
      loanData.workerId = parseInt(userId);
    }

    // Configurar include según tipo de prestatario
    const includeConfig: any = {
      tool: {
        select: {
          id: true,
          name: true,
          itemType: true,
          category: true
        }
      },
    };

    if (borrowerType === 'USER') {
      includeConfig.user = {
        select: { id: true, name: true, email: true }
      };
    } else {
      includeConfig.worker = {
        select: { id: true, name: true, phone: true, specialty: true }
      };
    }

    const loan = await prisma.toolLoan.create({
      data: loanData,
      include: includeConfig
    });

    // Reducir stock disponible
    const newStock = tool.stockQuantity - parseInt(quantity);
    await prisma.tool.update({
      where: { id: parseInt(toolId) },
      data: {
        stockQuantity: newStock,
        status: newStock === 0 ? 'IN_USE' : tool.status // Cambiar a EN USO si no queda stock
      }
    });

    // Crear movimiento de stock
    await prisma.toolMovement.create({
      data: {
        toolId: parseInt(toolId),
        type: 'OUT',
        quantity: parseInt(quantity),
        reason: `Préstamo a ${borrowerName} (${borrowerType === 'USER' ? 'Usuario' : 'Operario'})`,
        userId: currentUser.id,
        description: `ID Préstamo: ${loan.id}${notes ? ` - ${notes}` : ''}`
      }
    });

    // Verificación de notificaciones de stock bajo - VERIFICACIÓN ÚNICA
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

    return NextResponse.json({
      success: true,
      loan,
      message: `Préstamo registrado exitosamente. ${tool.name} prestado a ${borrowerName}`,
      newStock: newStock,
      borrowerType: borrowerType
    });

  } catch (error) {
    console.error('Error en POST /api/tools/loans:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor: ' + (error as Error).message },
      { status: 500 }
    );
  }
  // ✅ OPTIMIZADO: Removido $disconnect()
} 