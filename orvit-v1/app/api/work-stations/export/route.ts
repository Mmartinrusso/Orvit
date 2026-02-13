import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';
import { cookies } from 'next/headers';

// ============================================================
// GET /api/work-stations/export - Exportar puestos a CSV
// ============================================================
export async function GET(request: NextRequest) {
  try {
    // Verificar autenticación
    const token = cookies().get('token')?.value;
    if (!token) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const payload = await verifyToken(token);
    if (!payload) {
      return NextResponse.json({ error: 'Token inválido' }, { status: 401 });
    }

    // Obtener parámetros
    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get('companyId');
    const sectorId = searchParams.get('sectorId');
    const status = searchParams.get('status');
    const format = searchParams.get('format') || 'csv';

    if (!companyId) {
      return NextResponse.json({ error: 'companyId es requerido' }, { status: 400 });
    }

    // Construir filtros
    const where: any = { companyId: parseInt(companyId) };

    if (sectorId) {
      where.sectorId = parseInt(sectorId);
    }

    if (status) {
      where.status = status;
    }

    // Obtener datos
    const workStations = await prisma.workStation.findMany({
      where,
      include: {
        sector: {
          select: { name: true }
        },
        _count: {
          select: {
            instructives: { where: { isActive: true } },
            machines: true,
            workOrders: { where: { status: { in: ['PENDING', 'IN_PROGRESS'] } } }
          }
        }
      },
      orderBy: { name: 'asc' }
    });

    if (format === 'csv') {
      // Generar CSV
      const headers = [
        'Código',
        'Nombre',
        'Descripción',
        'Sector',
        'Estado',
        'Instructivos Activos',
        'Máquinas Asignadas',
        'OTs Activas',
        'Fecha Creación'
      ];

      const rows = workStations.map(ws => [
        ws.code,
        ws.name,
        ws.description || '',
        ws.sector?.name || '',
        getStatusLabel(ws.status),
        ws._count.instructives,
        ws._count.machines,
        ws._count.workOrders,
        new Date(ws.createdAt).toLocaleDateString('es-AR')
      ]);

      const csvContent = [
        headers.join(','),
        ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      ].join('\n');

      // Agregar BOM para Excel
      const bom = '\uFEFF';
      const csvWithBom = bom + csvContent;

      return new NextResponse(csvWithBom, {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="puestos-trabajo-${new Date().toISOString().split('T')[0]}.csv"`
        }
      });
    }

    // Formato JSON por defecto
    return NextResponse.json({
      workStations: workStations.map(ws => ({
        code: ws.code,
        name: ws.name,
        description: ws.description,
        sector: ws.sector?.name,
        status: ws.status,
        instructivesCount: ws._count.instructives,
        machinesCount: ws._count.machines,
        activeWorkOrdersCount: ws._count.workOrders,
        createdAt: ws.createdAt
      })),
      total: workStations.length,
      exportedAt: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error exportando puestos de trabajo:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}

function getStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    ACTIVE: 'Activo',
    INACTIVE: 'Inactivo',
    MAINTENANCE: 'En Mantenimiento'
  };
  return labels[status] || status;
}
