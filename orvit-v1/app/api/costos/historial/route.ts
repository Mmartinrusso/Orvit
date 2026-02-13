import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { startPerf, endParse, startDb, endDb, startCompute, endCompute, startJson, endJson, withPerfHeaders, shouldDisableCache } from '@/lib/perf';

export const dynamic = 'force-dynamic';

// ✅ OPTIMIZADO: Usar instancia global de prisma desde @/lib/prisma

export async function GET(request: NextRequest) {
  const perfCtx = startPerf();
  
  try {
    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get('companyId');
    const employeeId = searchParams.get('employeeId'); // Opcional para filtrar
    
    endParse(perfCtx);

    if (!companyId) {
      return NextResponse.json(
        { error: 'companyId es requerido' },
        { status: 400 }
      );
    }

    startDb(perfCtx);
    // Obtener historial de planilla (employee_salary_history)
    const historialPlanilla = await prisma.employeeSalaryHistory.findMany({
      where: {
        company_id: parseInt(companyId),
        ...(employeeId && { employee_id: employeeId })
      },
      include: {
        employees: {
          select: {
            name: true,
            role: true
          }
        }
      },
      orderBy: {
        effective_from: 'desc'
      }
    });
    endDb(perfCtx);

    startCompute(perfCtx);
    // Procesar historial de planilla para crear entradas de historial
    // Agrupar por empleado para crear la progresión correcta
    const empleadosMap = new Map();
    
    historialPlanilla.forEach(entry => {
      const employeeId = entry.employee_id;
      if (!empleadosMap.has(employeeId)) {
        empleadosMap.set(employeeId, []);
      }
      empleadosMap.get(employeeId).push(entry);
    });
    
    const historialProcessed = [];
    
    // Para cada empleado, crear entradas de historial ordenadas por fecha
    empleadosMap.forEach((entries, employeeId) => {
      // Ordenar por fecha ascendente para crear la progresión correcta
      const entriesOrdenadas = entries.sort((a, b) => 
        new Date(a.effective_from).getTime() - new Date(b.effective_from).getTime()
      );
      
      entriesOrdenadas.forEach((entry, index) => {
        const oldSalary = index > 0 ? entriesOrdenadas[index - 1].gross_salary : 0;
        
        historialProcessed.push({
          id: `${entry.id}_${index}`,
          employeeId: entry.employee_id,
          oldSalary: oldSalary,
          newSalary: entry.gross_salary,
          changeDate: entry.effective_from,
          changeReason: entry.reason || 'Cambio desde planilla',
          companyId: entry.company_id,
          employeeName: entry.employees?.name || 'Sin nombre',
          employeeRole: entry.employees?.role || 'Sin rol',
          source: 'planilla'
        });
      });
    });
    
    // Ordenar por fecha descendente (más recientes primero)
    historialProcessed.sort((a, b) => 
      new Date(b.changeDate).getTime() - new Date(a.changeDate).getTime()
    );
    endCompute(perfCtx);

    startJson(perfCtx);
    const response = NextResponse.json(historialProcessed, {
      headers: {
        'Cache-Control': shouldDisableCache(searchParams) 
          ? 'no-cache, no-store, must-revalidate'
          : 'private, max-age=60',
      }
    });
    const metrics = endJson(perfCtx, historialProcessed);
    return withPerfHeaders(response, metrics, searchParams);

  } catch (error) {
    console.error('❌ [API] Error obteniendo historial:', error);
    
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { employeeId, oldSalary, newSalary, changeReason, companyId } = body;

    if (!employeeId || !newSalary || !companyId) {
      return NextResponse.json(
        { error: 'employeeId, newSalary y companyId son requeridos' },
        { status: 400 }
      );
    }

    // Crear entrada en el historial manual
    const newEntry = await prisma.$queryRaw`
      INSERT INTO employee_salary_history_new (
        employee_id, old_salary, new_salary, change_date, change_reason, company_id
      ) VALUES (
        ${employeeId}, ${oldSalary || 0}, ${newSalary}, CURRENT_TIMESTAMP, ${changeReason || 'Cambio manual'}, ${parseInt(companyId)}
      ) RETURNING id
    `;

    return NextResponse.json({
      success: true,
      id: (newEntry as any[])[0].id
    });

  } catch (error) {
    console.error('Error creando entrada en historial:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}