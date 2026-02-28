import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';
import { JWT_SECRET } from '@/lib/auth'; // ✅ Importar el mismo secret
import { requirePermission } from '@/lib/auth/shared-helpers';

export const dynamic = 'force-dynamic';


const JWT_SECRET_KEY = new TextEncoder().encode(JWT_SECRET);

export async function GET(request: NextRequest) {
  try {
    // Verificar permiso reports.view
    const { user: authUser, error: authError } = await requirePermission('reports.view');
    if (authError) return authError;

    // Verificar autenticación usando JWT
    const cookieStore = cookies();
    const token = cookieStore.get('token');

    if (!token) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    let userId: number;
    try {
      const { payload } = await jwtVerify(token.value, JWT_SECRET_KEY);
      userId = payload.userId as number;
    } catch (jwtError) {
      return NextResponse.json({ error: 'Token inválido' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get('companyId');
    const category = searchParams.get('category');

    if (!companyId) {
      return NextResponse.json({ error: 'Company ID es requerido' }, { status: 400 });
    }

    // Obtener estadísticas para generar reportes dinámicos
    const [
      workOrdersCount,
      machinesCount,
      toolsCount,
      fixedTasksCount,
      completedWorkOrders,
      recentActivity
    ] = await Promise.all([
      prisma.workOrder.count({
        where: { companyId: parseInt(companyId) }
      }),
      
      prisma.machine.count({
        where: { companyId: parseInt(companyId) }
      }),
      
      prisma.tool.count({
        where: { companyId: parseInt(companyId) }
      }),
      
      prisma.fixedTask.count({
        where: { companyId: parseInt(companyId) }
      }),
      
      prisma.workOrder.count({
        where: { 
          companyId: parseInt(companyId),
          status: 'COMPLETED'
        }
      }),
      
      prisma.workOrder.findFirst({
        where: { companyId: parseInt(companyId) },
        orderBy: { updatedAt: 'desc' },
        select: { updatedAt: true }
      })
    ]);

    // No generar reportes artificiales - solo devolver lista vacía
    // Los reportes deben ser creados y almacenados en la base de datos
    const reports: any[] = [];

    // Filtrar por categoría si se especifica
    const filteredReports = category && category !== 'all' 
      ? reports.filter(report => report.category === category)
      : reports;

    return NextResponse.json({
      success: true,
      reports: filteredReports,
      summary: {
        totalReports: filteredReports.length,
        reportsWithData: filteredReports.filter(r => r.dataAvailable).length,
        lastActivity: recentActivity?.updatedAt || null
      }
    });

  } catch (error) {
    console.error('Error fetching reports list:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' }, 
      { status: 500 }
    );
  }
} 