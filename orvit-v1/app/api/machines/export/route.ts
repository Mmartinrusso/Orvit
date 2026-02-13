import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';

export const dynamic = 'force-dynamic';

// GET /api/machines/export - Exportar máquinas a CSV/JSON
export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get('token')?.value;
    if (!token) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const payload = await verifyToken(token);
    if (!payload) {
      return NextResponse.json({ error: 'Token inválido' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const format = searchParams.get('format') || 'csv'; // csv, json
    const sectorId = searchParams.get('sectorId');
    const companyId = searchParams.get('companyId');
    const status = searchParams.get('status');
    const type = searchParams.get('type');
    const includeComponents = searchParams.get('includeComponents') === 'true';

    // Construir filtros
    const where: any = {};
    if (sectorId) where.sectorId = parseInt(sectorId);
    if (companyId) where.companyId = parseInt(companyId);
    if (status && status !== 'all') where.status = status;
    if (type && type !== 'all') where.type = type;

    // Obtener máquinas
    const machines = await prisma.machine.findMany({
      where,
      include: {
        sector: {
          select: { name: true },
        },
        plantZone: {
          select: { name: true },
        },
        components: includeComponents ? {
          select: {
            id: true,
            name: true,
            code: true,
            type: true,
            criticality: true,
          },
        } : false,
        _count: {
          select: {
            components: true,
            workOrders: true,
            failures: true,
          },
        },
      },
      orderBy: [
        { sectorId: 'asc' },
        { name: 'asc' },
      ],
    });

    if (format === 'json') {
      // Exportar como JSON
      return NextResponse.json({
        exportDate: new Date().toISOString(),
        totalMachines: machines.length,
        machines: machines.map((m) => ({
          id: m.id,
          name: m.name,
          nickname: m.nickname,
          brand: m.brand,
          model: m.model,
          serialNumber: m.serialNumber,
          type: m.type,
          status: m.status,
          description: m.description,
          sector: m.sector?.name,
          plantZone: m.plantZone?.name,
          assetCode: m.assetCode,
          sapCode: m.sapCode,
          productionLine: m.productionLine,
          position: m.position,
          installationDate: m.installationDate,
          manufacturingYear: m.manufacturingYear,
          voltage: m.voltage,
          power: m.power,
          weight: m.weight,
          dimensions: m.dimensions,
          healthScore: m.healthScore,
          criticalityScore: m.criticalityScore,
          componentsCount: m._count.components,
          workOrdersCount: m._count.workOrders,
          failuresCount: m._count.failures,
          ...(includeComponents && { components: m.components }),
          createdAt: m.createdAt,
          updatedAt: m.updatedAt,
        })),
      });
    }

    // Exportar como CSV
    const headers = [
      'ID',
      'Nombre',
      'Apodo',
      'Marca',
      'Modelo',
      'Número de Serie',
      'Tipo',
      'Estado',
      'Sector',
      'Zona',
      'Código Activo',
      'Código SAP',
      'Línea Producción',
      'Fecha Instalación',
      'Año Fabricación',
      'Voltaje',
      'Potencia',
      'Peso',
      'Dimensiones',
      'Health Score',
      'Criticidad',
      'Componentes',
      'OTs',
      'Fallas',
      'Creado',
      'Actualizado',
    ];

    const rows = machines.map((m) => [
      m.id,
      escapeCsvField(m.name),
      escapeCsvField(m.nickname || ''),
      escapeCsvField(m.brand || ''),
      escapeCsvField(m.model || ''),
      escapeCsvField(m.serialNumber || ''),
      m.type,
      translateStatus(m.status),
      escapeCsvField(m.sector?.name || ''),
      escapeCsvField(m.plantZone?.name || ''),
      escapeCsvField(m.assetCode || ''),
      escapeCsvField(m.sapCode || ''),
      escapeCsvField(m.productionLine || ''),
      m.installationDate ? new Date(m.installationDate).toLocaleDateString('es-AR') : '',
      m.manufacturingYear || '',
      escapeCsvField(m.voltage || ''),
      escapeCsvField(m.power || ''),
      escapeCsvField(m.weight || ''),
      escapeCsvField(m.dimensions || ''),
      m.healthScore ?? '',
      m.criticalityScore ?? '',
      m._count.components,
      m._count.workOrders,
      m._count.failures,
      new Date(m.createdAt).toLocaleDateString('es-AR'),
      new Date(m.updatedAt).toLocaleDateString('es-AR'),
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map((row) => row.join(',')),
    ].join('\n');

    // BOM for Excel UTF-8 compatibility
    const bom = '\uFEFF';
    const csvWithBom = bom + csvContent;

    return new NextResponse(csvWithBom, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="maquinas_${new Date().toISOString().split('T')[0]}.csv"`,
      },
    });
  } catch (error) {
    console.error('Error al exportar máquinas:', error);
    return NextResponse.json(
      { error: 'Error al exportar las máquinas' },
      { status: 500 }
    );
  }
}

// Helper para escapar campos CSV
function escapeCsvField(field: string): string {
  if (!field) return '';
  // Si contiene comas, comillas o saltos de línea, envolver en comillas
  if (field.includes(',') || field.includes('"') || field.includes('\n')) {
    return `"${field.replace(/"/g, '""')}"`;
  }
  return field;
}

// Traducir estados
function translateStatus(status: string): string {
  const translations: Record<string, string> = {
    ACTIVE: 'Activo',
    OUT_OF_SERVICE: 'Fuera de servicio',
    MAINTENANCE: 'En mantenimiento',
    DECOMMISSIONED: 'Dado de baja',
  };
  return translations[status] || status;
}
