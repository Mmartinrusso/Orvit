import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withGuards } from '@/lib/middleware/withGuards';

export const dynamic = 'force-dynamic';

/**
 * GET /api/maintenance/export
 *
 * Exporta historial de mantenimiento a CSV.
 *
 * Parámetros:
 *   companyId  (requerido) - ID de la empresa
 *   sectorId   (opcional)  - Filtrar por sector
 *   type       (opcional)  - PREVENTIVE | CORRECTIVE | all (default: all)
 *   status     (opcional)  - PENDING | IN_PROGRESS | COMPLETED | all (default: all)
 *   startDate  (opcional)  - Fecha inicio (ISO)
 *   endDate    (opcional)  - Fecha fin (ISO)
 *   format     (opcional)  - csv (default)
 */
export const GET = withGuards(async (request, ctx) => {
  const { searchParams } = new URL(request.url);
  const companyId = parseInt(searchParams.get('companyId') || ctx.user.companyId.toString());
  const sectorId = searchParams.get('sectorId');
  const type = searchParams.get('type');
  const status = searchParams.get('status');
  const startDate = searchParams.get('startDate');
  const endDate = searchParams.get('endDate');

  // Validar acceso a la empresa
  if (companyId !== ctx.user.companyId) {
    return NextResponse.json({ error: 'No autorizado para esta empresa' }, { status: 403 });
  }

  // Construir filtros
  const where: any = { companyId };

  if (sectorId) where.sectorId = parseInt(sectorId);
  if (type && type !== 'all') where.type = type;
  if (status && status !== 'all') where.status = status;

  if (startDate || endDate) {
    where.createdAt = {};
    if (startDate) where.createdAt.gte = new Date(startDate);
    if (endDate) where.createdAt.lte = new Date(endDate);
  }

  const workOrders = await prisma.workOrder.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: 5000, // Límite seguro para evitar OOM
    select: {
      id: true,
      title: true,
      description: true,
      type: true,
      priority: true,
      status: true,
      scheduledDate: true,
      startedDate: true,
      completedDate: true,
      estimatedHours: true,
      actualHours: true,
      cost: true,
      notes: true,
      createdAt: true,
      machine: { select: { name: true, nickname: true } },
      unidadMovil: { select: { nombre: true, patente: true } },
      assignedTo: { select: { name: true } },
      createdBy: { select: { name: true } },
      sector: { select: { name: true } },
    }
  });

  // Generar CSV
  const headers = [
    'ID',
    'Título',
    'Descripción',
    'Tipo',
    'Prioridad',
    'Estado',
    'Máquina',
    'Unidad Móvil',
    'Sector',
    'Asignado a',
    'Creado por',
    'Fecha Programada',
    'Fecha Inicio',
    'Fecha Completado',
    'Horas Estimadas',
    'Horas Reales',
    'Costo',
    'Notas',
    'Fecha Creación',
  ];

  const translateType = (t: string) => t === 'PREVENTIVE' ? 'Preventivo' : t === 'CORRECTIVE' ? 'Correctivo' : t;
  const translateStatus = (s: string) => {
    const map: Record<string, string> = {
      PENDING: 'Pendiente',
      IN_PROGRESS: 'En Progreso',
      COMPLETED: 'Completado',
      CANCELLED: 'Cancelado',
    };
    return map[s] || s;
  };
  const translatePriority = (p: string) => {
    const map: Record<string, string> = {
      CRITICAL: 'Crítica', HIGH: 'Alta', MEDIUM: 'Media', LOW: 'Baja',
    };
    return map[p] || p;
  };
  const formatDate = (d: Date | null) => d ? d.toISOString().replace('T', ' ').slice(0, 19) : '';
  const escCsv = (v: string | null | undefined) => {
    if (!v) return '';
    const s = v.replace(/"/g, '""').replace(/\n/g, ' ');
    return s.includes(',') || s.includes('"') ? `"${s}"` : s;
  };

  const rows = workOrders.map(wo => [
    wo.id,
    escCsv(wo.title),
    escCsv(wo.description),
    translateType(wo.type),
    translatePriority(wo.priority),
    translateStatus(wo.status),
    escCsv(wo.machine?.name || wo.machine?.nickname || ''),
    escCsv(wo.unidadMovil ? `${wo.unidadMovil.nombre} (${wo.unidadMovil.patente || ''})` : ''),
    escCsv(wo.sector?.name || ''),
    escCsv(wo.assignedTo?.name || ''),
    escCsv(wo.createdBy?.name || ''),
    formatDate(wo.scheduledDate),
    formatDate(wo.startedDate),
    formatDate(wo.completedDate),
    wo.estimatedHours ?? '',
    wo.actualHours ?? '',
    wo.cost ?? '',
    escCsv(wo.notes),
    formatDate(wo.createdAt),
  ].join(','));

  const csvContent = [headers.join(','), ...rows].join('\n');

  // BOM para que Excel detecte UTF-8
  const bom = '\uFEFF';

  return new NextResponse(bom + csvContent, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="mantenimiento_${new Date().toISOString().split('T')[0]}.csv"`,
    },
  });
});
