import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth/shared-helpers';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { user, error: authError } = await requireAuth();
    if (authError) return authError;

    const companyId = String(user!.companyId);
    const employeeId = params.id;

    if (!employeeId) {
      return NextResponse.json({ error: 'Employee ID es requerido' }, { status: 400 });
    }

    // Obtener historial de sueldos del empleado desde employee_salary_history
    const salaryHistory = await prisma.employeeSalaryHistory.findMany({
      where: {
        employee_id: employeeId,
        company_id: parseInt(companyId)
      },
      orderBy: {
        effective_from: 'desc'
      }
    });

    // Procesar historial para crear entradas de historial
    // Ordenar por fecha ascendente para crear la progresión correcta
    const entriesOrdenadas = salaryHistory.sort((a, b) => 
      new Date(a.effective_from).getTime() - new Date(b.effective_from).getTime()
    );
    
    const processedHistory = entriesOrdenadas.map((entry, index) => {
      const oldSalary = index > 0 ? entriesOrdenadas[index - 1].gross_salary : 0;
      
      return {
        id: entry.id,
        oldSalary: oldSalary,
        newSalary: entry.gross_salary,
        changeDate: entry.effective_from.toISOString(),
        changeReason: entry.reason || 'Cambio desde planilla',
        companyId: entry.company_id
      };
    });
    
    // Ordenar por fecha descendente para mostrar (más recientes primero)
    processedHistory.sort((a, b) => 
      new Date(b.changeDate).getTime() - new Date(a.changeDate).getTime()
    );

    return NextResponse.json(processedHistory);
  } catch (error) {
    console.error('Error obteniendo historial de sueldos:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { user, error: authError } = await requireAuth();
    if (authError) return authError;

    const body = await request.json();
    const { oldSalary, newSalary, changeReason } = body;
    const companyId = String(user!.companyId);
    const employeeId = params.id;

    if (!employeeId) {
      return NextResponse.json({ error: 'Employee ID es requerido' }, { status: 400 });
    }

    if (!oldSalary || !newSalary) {
      return NextResponse.json({ error: 'Salarios anterior y nuevo son requeridos' }, { status: 400 });
    }

    // Crear entrada en el historial
    const newEntry = await prisma.$executeRaw`
      INSERT INTO employee_salary_history_new (
        employee_id,
        old_salary,
        new_salary,
        change_date,
        change_reason,
        company_id
      ) VALUES (
        ${employeeId},
        ${parseFloat(oldSalary)},
        ${parseFloat(newSalary)},
        NOW(),
        ${changeReason || 'Cambio manual'},
        ${parseInt(companyId)}
      )
    `;

    return NextResponse.json({ 
      message: 'Entrada de historial creada exitosamente',
      success: true 
    });
  } catch (error) {
    console.error('Error creando entrada de historial:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
