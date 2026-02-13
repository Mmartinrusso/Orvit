/**
 * API de Adelantos de Sueldo
 *
 * GET  /api/payroll/advances - Listar adelantos
 * POST /api/payroll/advances - Crear adelanto
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getPayrollAuthUser } from '@/lib/payroll/auth-helper';

export const dynamic = 'force-dynamic';

// GET - Listar adelantos
export async function GET(request: NextRequest) {
  try {
    const user = await getPayrollAuthUser();
    if (!user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const employeeId = searchParams.get('employeeId');

    const advances = await prisma.salaryAdvance.findMany({
      where: {
        company_id: user.companyId,
        ...(status && status !== 'all' ? { status } : {}),
        ...(employeeId ? { employee_id: employeeId } : {}),
      },
      include: {
        employee: {
          select: {
            id: true,
            name: true,
            role: true,
          },
        },
        installments: {
          orderBy: { installment_num: 'asc' },
        },
      },
      orderBy: { created_at: 'desc' },
    });

    return NextResponse.json({
      advances: advances.map((a) => ({
        id: a.id,
        employeeId: a.employee_id,
        employeeName: a.employee.name,
        employeeRole: a.employee.role,
        amount: Number(a.amount),
        installmentsCount: a.installments_count,
        installmentAmount: Number(a.installment_amount),
        remainingAmount: Number(a.remaining_amount),
        requestDate: a.request_date,
        status: a.status,
        notes: a.notes,
        approvedAt: a.approved_at,
        approvedBy: a.approved_by,
        rejectedAt: a.rejected_at,
        rejectedBy: a.rejected_by,
        rejectReason: a.reject_reason,
        installments: a.installments.map((i) => ({
          id: i.id,
          installmentNum: i.installment_num,
          amount: Number(i.amount),
          status: i.status,
          discountedAt: i.discounted_at,
        })),
      })),
    });
  } catch (error) {
    console.error('Error obteniendo adelantos:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}

// POST - Crear adelanto
export async function POST(request: NextRequest) {
  try {
    const user = await getPayrollAuthUser();
    if (!user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const body = await request.json();
    const { employeeId, amount, installmentsCount = 1, notes } = body;

    if (!employeeId || !amount) {
      return NextResponse.json(
        { error: 'employeeId y amount son requeridos' },
        { status: 400 }
      );
    }

    // Verificar que el empleado existe
    const employee = await prisma.employee.findFirst({
      where: {
        id: employeeId,
        company_id: user.companyId,
        active: true,
      },
    });

    if (!employee) {
      return NextResponse.json({ error: 'Empleado no encontrado' }, { status: 404 });
    }

    // Obtener configuración para validar límites
    const config = await prisma.payrollConfig.findUnique({
      where: { company_id: user.companyId },
    });

    if (config) {
      // Verificar cantidad de adelantos activos
      const activeAdvances = await prisma.salaryAdvance.count({
        where: {
          employee_id: employeeId,
          status: { in: ['PENDING', 'APPROVED', 'ACTIVE'] },
        },
      });

      if (activeAdvances >= config.max_active_advances) {
        return NextResponse.json(
          { error: `Máximo ${config.max_active_advances} adelanto(s) activo(s) por empleado` },
          { status: 400 }
        );
      }

      // Verificar porcentaje máximo
      const maxAmount = Number(employee.gross_salary) * (Number(config.max_advance_percent) / 100);
      if (amount > maxAmount) {
        return NextResponse.json(
          { error: `Monto máximo permitido: $${maxAmount.toFixed(2)}` },
          { status: 400 }
        );
      }
    }

    // Calcular monto por cuota
    const installmentAmount = amount / installmentsCount;

    // Crear adelanto con cuotas
    const advance = await prisma.salaryAdvance.create({
      data: {
        company_id: user.companyId,
        employee_id: employeeId,
        amount,
        installments_count: installmentsCount,
        installment_amount: installmentAmount,
        remaining_amount: amount,
        status: 'PENDING',
        notes,
        installments: {
          create: Array.from({ length: installmentsCount }, (_, i) => ({
            installment_num: i + 1,
            amount: installmentAmount,
            status: 'PENDING',
          })),
        },
      },
      include: {
        employee: {
          select: { name: true },
        },
        installments: true,
      },
    });

    return NextResponse.json({
      success: true,
      advance: {
        id: advance.id,
        employeeId: advance.employee_id,
        employeeName: advance.employee.name,
        amount: Number(advance.amount),
        installmentsCount: advance.installments_count,
        installmentAmount: Number(advance.installment_amount),
        status: advance.status,
      },
    });
  } catch (error) {
    console.error('Error creando adelanto:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
