/**
 * API de Liquidación Individual
 *
 * GET  /api/payroll/[id] - Obtener detalle de liquidación
 * PUT  /api/payroll/[id] - Aprobar/Pagar/Cancelar
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getPayrollAuthUser } from '@/lib/payroll/auth-helper';

export const dynamic = 'force-dynamic';

// GET - Obtener detalle de liquidación
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

    const payroll = await prisma.payroll.findFirst({
      where: {
        id: parseInt(id),
        company_id: user.companyId,
      },
      include: {
        period: true,
        items: {
          include: {
            employee: {
              select: {
                id: true,
                name: true,
                role: true,
              },
            },
            lines: {
              orderBy: { id: 'asc' },
            },
          },
          orderBy: {
            employee: { name: 'asc' },
          },
        },
        auditLogs: {
          orderBy: { created_at: 'desc' },
          take: 10,
        },
      },
    });

    if (!payroll) {
      return NextResponse.json({ error: 'Liquidación no encontrada' }, { status: 404 });
    }

    return NextResponse.json({
      payroll: {
        id: payroll.id,
        period: {
          id: payroll.period.id,
          periodType: payroll.period.period_type,
          year: payroll.period.year,
          month: payroll.period.month,
          periodStart: payroll.period.period_start,
          periodEnd: payroll.period.period_end,
          paymentDate: payroll.period.payment_date,
        },
        status: payroll.status,
        totalGross: Number(payroll.total_gross),
        totalDeductions: Number(payroll.total_deductions),
        totalNet: Number(payroll.total_net),
        totalEmployerCost: Number(payroll.total_employer_cost),
        employeeCount: payroll.employee_count,
        notes: payroll.notes,
        calculatedAt: payroll.calculated_at,
        approvedAt: payroll.approved_at,
        paidAt: payroll.paid_at,
        items: payroll.items.map((item) => ({
          id: item.id,
          employeeId: item.employee.id,
          employeeName: item.employee.name,
          employeeRole: item.employee.role,
          daysWorked: item.days_worked,
          daysInPeriod: item.days_in_period,
          prorateFactor: Number(item.prorate_factor),
          baseSalary: Number(item.base_salary),
          totalEarnings: Number(item.total_earnings),
          totalDeductions: Number(item.total_deductions),
          advancesDiscounted: Number(item.advances_discounted),
          netSalary: Number(item.net_salary),
          employerCost: Number(item.employer_cost),
          lines: item.lines.map((line) => ({
            id: line.id,
            code: line.code,
            name: line.name,
            type: line.type,
            baseAmount: Number(line.base_amount),
            calculatedAmount: Number(line.calculated_amount),
            finalAmount: Number(line.final_amount),
          })),
        })),
        auditLogs: payroll.auditLogs.map((log) => ({
          action: log.action,
          userId: log.user_id,
          createdAt: log.created_at,
          details: log.details,
        })),
      },
    });
  } catch (error) {
    console.error('Error obteniendo liquidación:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}

// PUT - Aprobar, Pagar o Cancelar
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
    const { action, cancelReason } = body;

    if (!['approve', 'pay', 'cancel'].includes(action)) {
      return NextResponse.json(
        { error: 'action debe ser "approve", "pay" o "cancel"' },
        { status: 400 }
      );
    }

    const payroll = await prisma.payroll.findFirst({
      where: {
        id: parseInt(id),
        company_id: user.companyId,
      },
    });

    if (!payroll) {
      return NextResponse.json({ error: 'Liquidación no encontrada' }, { status: 404 });
    }

    // Validar transiciones de estado
    if (action === 'approve') {
      if (payroll.status !== 'CALCULATED') {
        return NextResponse.json(
          { error: 'Solo se puede aprobar una liquidación calculada' },
          { status: 400 }
        );
      }

      await prisma.$transaction([
        prisma.payroll.update({
          where: { id: parseInt(id) },
          data: {
            status: 'APPROVED',
            approved_at: new Date(),
            approved_by: user.id,
          },
        }),
        prisma.payrollAuditLog.create({
          data: {
            payroll_id: parseInt(id),
            action: 'APPROVED',
            user_id: user.id,
          },
        }),
      ]);

      return NextResponse.json({ success: true, message: 'Liquidación aprobada' });
    }

    if (action === 'pay') {
      if (payroll.status !== 'APPROVED') {
        return NextResponse.json(
          { error: 'Solo se puede marcar como pagada una liquidación aprobada' },
          { status: 400 }
        );
      }

      await prisma.$transaction(async (tx) => {
        await tx.payroll.update({
          where: { id: parseInt(id) },
          data: {
            status: 'PAID',
            paid_at: new Date(),
            paid_by: user.id,
          },
        });

        // Cerrar el período
        await tx.payrollPeriod.update({
          where: { id: payroll.period_id },
          data: { is_closed: true },
        });

        await tx.payrollAuditLog.create({
          data: {
            payroll_id: parseInt(id),
            action: 'PAID',
            user_id: user.id,
          },
        });
      });

      return NextResponse.json({ success: true, message: 'Liquidación marcada como pagada' });
    }

    if (action === 'cancel') {
      if (payroll.status === 'PAID') {
        return NextResponse.json(
          { error: 'No se puede cancelar una liquidación pagada' },
          { status: 400 }
        );
      }

      if (!cancelReason) {
        return NextResponse.json(
          { error: 'cancelReason es requerido' },
          { status: 400 }
        );
      }

      await prisma.$transaction([
        prisma.payroll.update({
          where: { id: parseInt(id) },
          data: {
            status: 'CANCELLED',
            cancelled_at: new Date(),
            cancelled_by: user.id,
            cancel_reason: cancelReason,
          },
        }),
        prisma.payrollAuditLog.create({
          data: {
            payroll_id: parseInt(id),
            action: 'CANCELLED',
            user_id: user.id,
            details: { reason: cancelReason },
          },
        }),
      ]);

      return NextResponse.json({ success: true, message: 'Liquidación cancelada' });
    }

    return NextResponse.json({ error: 'Acción no válida' }, { status: 400 });
  } catch (error) {
    console.error('Error actualizando liquidación:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
