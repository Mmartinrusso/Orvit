/**
 * API de Adelanto Individual
 *
 * GET    /api/payroll/advances/[id] - Obtener detalle
 * PUT    /api/payroll/advances/[id] - Aprobar/Rechazar
 * DELETE /api/payroll/advances/[id] - Cancelar
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getPayrollAuthUser } from '@/lib/payroll/auth-helper';

export const dynamic = 'force-dynamic';

// GET - Obtener detalle de adelanto
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getPayrollAuthUser();
    if (!user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { id } = await params;

    const advance = await prisma.salaryAdvance.findFirst({
      where: {
        id: parseInt(id),
        company_id: user.companyId,
      },
      include: {
        employee: {
          select: {
            id: true,
            name: true,
            role: true,
            gross_salary: true,
          },
        },
        installments: {
          orderBy: { installment_num: 'asc' },
        },
      },
    });

    if (!advance) {
      return NextResponse.json({ error: 'Adelanto no encontrado' }, { status: 404 });
    }

    return NextResponse.json({
      advance: {
        id: advance.id,
        employeeId: advance.employee_id,
        employee: {
          name: advance.employee.name,
          role: advance.employee.role,
          grossSalary: Number(advance.employee.gross_salary),
        },
        amount: Number(advance.amount),
        installmentsCount: advance.installments_count,
        installmentAmount: Number(advance.installment_amount),
        remainingAmount: Number(advance.remaining_amount),
        requestDate: advance.request_date,
        status: advance.status,
        notes: advance.notes,
        approvedAt: advance.approved_at,
        approvedBy: advance.approved_by,
        rejectedAt: advance.rejected_at,
        rejectedBy: advance.rejected_by,
        rejectReason: advance.reject_reason,
        installments: advance.installments.map((i) => ({
          id: i.id,
          installmentNum: i.installment_num,
          amount: Number(i.amount),
          duePeriodId: i.due_period_id,
          status: i.status,
          discountedAt: i.discounted_at,
        })),
      },
    });
  } catch (error) {
    console.error('Error obteniendo adelanto:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}

// PUT - Aprobar o Rechazar adelanto
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getPayrollAuthUser();
    if (!user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const { action, rejectReason } = body;

    if (!['approve', 'reject'].includes(action)) {
      return NextResponse.json(
        { error: 'action debe ser "approve" o "reject"' },
        { status: 400 }
      );
    }

    const advance = await prisma.salaryAdvance.findFirst({
      where: {
        id: parseInt(id),
        company_id: user.companyId,
        status: 'PENDING',
      },
    });

    if (!advance) {
      return NextResponse.json(
        { error: 'Adelanto no encontrado o no está pendiente' },
        { status: 404 }
      );
    }

    if (action === 'approve') {
      await prisma.salaryAdvance.update({
        where: { id: parseInt(id) },
        data: {
          status: 'APPROVED',
          approved_at: new Date(),
          approved_by: user.id,
        },
      });

      return NextResponse.json({
        success: true,
        message: 'Adelanto aprobado',
      });
    } else {
      if (!rejectReason) {
        return NextResponse.json(
          { error: 'rejectReason es requerido para rechazar' },
          { status: 400 }
        );
      }

      await prisma.salaryAdvance.update({
        where: { id: parseInt(id) },
        data: {
          status: 'REJECTED',
          rejected_at: new Date(),
          rejected_by: user.id,
          reject_reason: rejectReason,
        },
      });

      return NextResponse.json({
        success: true,
        message: 'Adelanto rechazado',
      });
    }
  } catch (error) {
    console.error('Error actualizando adelanto:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}

// DELETE - Cancelar adelanto
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getPayrollAuthUser();
    if (!user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { id } = await params;

    const advance = await prisma.salaryAdvance.findFirst({
      where: {
        id: parseInt(id),
        company_id: user.companyId,
        status: { in: ['PENDING', 'APPROVED'] },
      },
    });

    if (!advance) {
      return NextResponse.json(
        { error: 'Adelanto no encontrado o no se puede cancelar' },
        { status: 404 }
      );
    }

    await prisma.salaryAdvance.update({
      where: { id: parseInt(id) },
      data: {
        status: 'CANCELLED',
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Adelanto cancelado',
    });
  } catch (error) {
    console.error('Error cancelando adelanto:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
