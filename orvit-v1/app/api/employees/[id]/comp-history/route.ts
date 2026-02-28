import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth/shared-helpers';

export const dynamic = 'force-dynamic';

// GET /api/employees/[id]/comp-history - Obtener historial de compensaciones
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { user, error: authError } = await requireAuth();
    if (authError) return authError;

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');

    // Verificar que el empleado existe
    const employee = await prisma.costEmployee.findUnique({
      where: { id: params.id },
      select: { 
        id: true, 
        name: true, 
        role: true,
        companyId: true,
      },
    });

    if (!employee) {
      return NextResponse.json(
        { error: 'Empleado no encontrado' },
        { status: 404 }
      );
    }

    // Obtener historial de compensaciones
    const [history, total] = await Promise.all([
      prisma.employeeCompHistory.findMany({
        where: { employeeId: params.id },
        orderBy: { effectiveFrom: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.employeeCompHistory.count({
        where: { employeeId: params.id },
      }),
    ]);

    // Formatear historial con números convertidos
    const formattedHistory = history.map(record => ({
      ...record,
      grossSalary: record.grossSalary.toNumber(),
      payrollTaxes: record.payrollTaxes.toNumber(),
      changePct: record.changePct?.toNumber() || null,
    }));

    // Calcular estadísticas
    let totalIncreases = 0;
    let avgIncrease = 0;
    let totalGrowth = 0;

    if (formattedHistory.length > 0) {
      const increases = formattedHistory.filter(r => r.changePct && r.changePct > 0);
      totalIncreases = increases.length;
      
      if (increases.length > 0) {
        avgIncrease = increases.reduce((sum, r) => sum + (r.changePct || 0), 0) / increases.length;
      }

      if (formattedHistory.length > 1) {
        const firstSalary = formattedHistory[formattedHistory.length - 1].grossSalary;
        const lastSalary = formattedHistory[0].grossSalary;
        totalGrowth = ((lastSalary - firstSalary) / firstSalary) * 100;
      }
    }

    return NextResponse.json({
      employee: {
        id: employee.id,
        name: employee.name,
        role: employee.role,
      },
      history: formattedHistory,
      statistics: {
        totalRecords: total,
        totalIncreases,
        avgIncrease,
        totalGrowth,
      },
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Error fetching employee compensation history:', error);
    return NextResponse.json(
      { error: 'Error al obtener historial de compensaciones' },
      { status: 500 }
    );
  }
}
