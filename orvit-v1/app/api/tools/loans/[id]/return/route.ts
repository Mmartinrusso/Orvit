import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/lib/auth/shared-helpers';

// POST /api/tools/loans/[id]/return - Devolver herramienta prestada
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { user: authUser, error } = await requirePermission('tools.manage_loans');
    if (error) return error;

    const body = await request.json();
    const { returnNotes, condition, returnedBy } = body;
    const { id } = await params;
    const loanId = parseInt(id);

    const currentUser = { id: authUser!.id, name: authUser!.name };

    // Obtener el préstamo
    const loan = await prisma.toolLoan.findUnique({
      where: { id: loanId },
      include: {
        tool: true,
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
      }
    });

    if (!loan) {
      return NextResponse.json(
        { error: 'Préstamo no encontrado' },
        { status: 404 }
      );
    }

    if (loan.status !== 'BORROWED') {
      return NextResponse.json(
        { error: 'Esta herramienta ya fue devuelta' },
        { status: 400 }
      );
    }

    // Actualizar préstamo como devuelto
    const returnedLoan = await prisma.toolLoan.update({
      where: { id: loanId },
      data: {
        status: 'RETURNED',
        returnedAt: new Date(),
        notes: [
          returnNotes || null,
          condition ? `Estado: ${condition}` : null,
          returnedBy ? `Devuelto por: ${returnedBy}` : null
        ].filter(Boolean).join(' - ')
      },
      include: {
        tool: true,
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
      }
    });

    // Devolver stock y actualizar estado de herramienta
    const newStock = loan.tool.stockQuantity + loan.quantity;
    
    // Determinar nuevo estado basado en condición y stock
    let newStatus = loan.tool.status;
    if (condition === 'DAMAGED') {
      newStatus = 'DAMAGED';
    } else if (condition === 'MAINTENANCE') {
      newStatus = 'MAINTENANCE';
    } else {
      // Si la herramienta estaba EN USO por préstamos, verificar si hay más préstamos activos
      const activeLoanCount = await prisma.toolLoan.count({
        where: {
          toolId: loan.toolId,
          status: 'BORROWED'
        }
      });
      
      // Si no hay más préstamos activos, cambiar a AVAILABLE
      if (activeLoanCount === 0) {
        newStatus = 'AVAILABLE';
      }
    }

    await prisma.tool.update({
      where: { id: loan.toolId },
      data: {
        stockQuantity: newStock,
        status: newStatus
      }
    });

    // Crear movimiento de stock (devolución)
    const borrowerName = loan.user?.name || 'Usuario';
    const returnedByText = returnedBy ? `por ${returnedBy}` : `por ${borrowerName}`;
    
    await prisma.toolMovement.create({
      data: {
        toolId: loan.toolId,
        type: 'RETURN',
        quantity: loan.quantity,
        reason: `Devolución ${returnedByText}`,
        userId: currentUser.id,
        description: `ID Préstamo: ${loan.id}${returnNotes ? ` - ${returnNotes}` : ''}${condition ? ` - Estado: ${condition}` : ''}`
      }
    });

    return NextResponse.json({
      success: true,
      loan: returnedLoan,
      newStock: newStock,
      toolStatus: newStatus,
      message: `Herramienta devuelta exitosamente. ${loan.tool.name} devuelto ${returnedByText}`
    });

  } catch (error) {
    console.error('Error en POST /api/tools/loans/[id]/return:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor: ' + (error as Error).message },
      { status: 500 }
    );
  }
} 