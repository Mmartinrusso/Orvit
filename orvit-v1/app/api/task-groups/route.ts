import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserFromToken, hasAccessToCompany } from '@/lib/tasks/auth-helper';

export const dynamic = 'force-dynamic';

// GET /api/task-groups?companyId=X — listar grupos con conteos de tareas
export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromToken();
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const companyId = parseInt(searchParams.get('companyId') || '0');

    if (!companyId) return NextResponse.json({ error: 'CompanyId requerido' }, { status: 400 });
    if (!hasAccessToCompany(user, companyId))
      return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 });

    const includeArchived = searchParams.get('includeArchived') === 'true';

    const groups = await (prisma as any).taskGroup.findMany({
      where: {
        companyId,
        ...(includeArchived ? {} : { isArchived: false }),
      },
      include: {
        _count: {
          select: {
            tasks: true,
            agendaTasks: true,
          },
        },
        createdBy: {
          select: { id: true, name: true, avatar: true },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    const result = groups.map((g: any) => ({
      id: g.id,
      name: g.name,
      color: g.color,
      icon: g.icon,
      description: g.description,
      isArchived: g.isArchived,
      companyId: g.companyId,
      createdById: g.createdById,
      createdBy: g.createdBy,
      taskCount: g._count.tasks,
      agendaTaskCount: g._count.agendaTasks,
      totalCount: g._count.tasks + g._count.agendaTasks,
      createdAt: g.createdAt.toISOString(),
      updatedAt: g.updatedAt.toISOString(),
    }));

    return NextResponse.json({ data: result });
  } catch (error) {
    console.error('[API] Error fetching task groups:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}

// POST /api/task-groups — crear grupo
export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromToken();
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const body = await request.json();
    const { name, color, icon, description, companyId } = body;

    if (!name?.trim()) return NextResponse.json({ error: 'Nombre requerido' }, { status: 400 });
    if (!companyId) return NextResponse.json({ error: 'CompanyId requerido' }, { status: 400 });
    if (!hasAccessToCompany(user, parseInt(companyId)))
      return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 });

    const group = await (prisma as any).taskGroup.create({
      data: {
        name: name.trim().slice(0, 100),
        color: color || '#6366f1',
        icon: icon || null,
        description: description?.trim() || null,
        companyId: parseInt(companyId),
        createdById: user.id,
      },
    });

    return NextResponse.json({
      id: group.id,
      name: group.name,
      color: group.color,
      icon: group.icon,
      description: group.description,
      isArchived: group.isArchived,
      companyId: group.companyId,
      createdById: group.createdById,
      taskCount: 0,
      agendaTaskCount: 0,
      totalCount: 0,
      createdAt: group.createdAt.toISOString(),
      updatedAt: group.updatedAt.toISOString(),
    }, { status: 201 });
  } catch (error) {
    console.error('[API] Error creating task group:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
