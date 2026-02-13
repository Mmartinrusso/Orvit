import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withGuards } from '@/lib/middleware/withGuards';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/audit-logs
 *
 * Consulta los audit logs de la empresa.
 * Solo accesible para administradores.
 *
 * Query params:
 *  - page (default 1)
 *  - limit (default 50, max 200)
 *  - action: filtrar por tipo de acción (CREATE, DELETE, ROLE_CHANGE, etc.)
 *  - entityType: filtrar por tipo de entidad (WorkOrder, Role, Permission, etc.)
 *  - userId: filtrar por usuario que realizó la acción
 *  - from: fecha inicio (ISO string)
 *  - to: fecha fin (ISO string)
 *  - search: búsqueda en summary
 */
export const GET = withGuards(
  async (request: NextRequest, { user }) => {
    try {
      const { searchParams } = new URL(request.url);

      const page = Math.max(1, parseInt(searchParams.get('page') || '1') || 1);
      const limit = Math.min(200, Math.max(1, parseInt(searchParams.get('limit') || '50') || 50));
      const skip = (page - 1) * limit;

      const action = searchParams.get('action');
      const entityType = searchParams.get('entityType');
      const userId = searchParams.get('userId');
      const from = searchParams.get('from');
      const to = searchParams.get('to');
      const search = searchParams.get('search');

      // Construir filtro
      const where: Record<string, unknown> = {
        companyId: user.companyId,
      };

      if (action) {
        where.action = action;
      }

      if (entityType) {
        where.entityType = entityType;
      }

      if (userId) {
        const parsedUserId = parseInt(userId);
        if (!isNaN(parsedUserId)) {
          where.performedById = parsedUserId;
        }
      }

      if (from || to) {
        where.performedAt = {};
        if (from) (where.performedAt as Record<string, unknown>).gte = new Date(from);
        if (to) (where.performedAt as Record<string, unknown>).lte = new Date(to);
      }

      if (search) {
        where.summary = { contains: search, mode: 'insensitive' };
      }

      // Ejecutar consulta y conteo en paralelo
      const [logs, total] = await Promise.all([
        prisma.auditLog.findMany({
          where,
          include: {
            performedBy: {
              select: { id: true, name: true, email: true },
            },
          },
          orderBy: { performedAt: 'desc' },
          skip,
          take: limit,
        }),
        prisma.auditLog.count({ where }),
      ]);

      return NextResponse.json({
        success: true,
        data: logs,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      });
    } catch (error) {
      console.error('Error obteniendo audit logs:', error);
      return NextResponse.json(
        { error: 'Error al obtener audit logs' },
        { status: 500 }
      );
    }
  },
  {
    requiredPermissions: ['admin.audit_logs', 'company.settings'],
    permissionMode: 'any',
  }
);
