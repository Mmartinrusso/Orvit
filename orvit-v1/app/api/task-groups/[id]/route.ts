import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserFromToken, hasAccessToCompany } from '@/lib/tasks/auth-helper';

export const dynamic = 'force-dynamic';

// PUT /api/task-groups/[id] — editar grupo
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getUserFromToken();
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const groupId = parseInt(params.id);
    if (isNaN(groupId)) return NextResponse.json({ error: 'ID inválido' }, { status: 400 });

    const existing = await (prisma as any).taskGroup.findUnique({
      where: { id: groupId },
      select: { id: true, companyId: true },
    });

    if (!existing) return NextResponse.json({ error: 'Grupo no encontrado' }, { status: 404 });
    if (!hasAccessToCompany(user, existing.companyId))
      return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 });

    const body = await request.json();
    const { name, color, icon, description, isArchived } = body;

    if (name !== undefined && !name?.trim())
      return NextResponse.json({ error: 'Nombre no puede estar vacío' }, { status: 400 });

    const updated = await (prisma as any).taskGroup.update({
      where: { id: groupId },
      data: {
        ...(name !== undefined ? { name: name.trim().slice(0, 100) } : {}),
        ...(color !== undefined ? { color } : {}),
        ...(icon !== undefined ? { icon: icon || null } : {}),
        ...(description !== undefined ? { description: description?.trim() || null } : {}),
        ...(isArchived !== undefined ? { isArchived } : {}),
        updatedAt: new Date(),
      },
      include: {
        _count: { select: { tasks: true, agendaTasks: true } },
      },
    });

    return NextResponse.json({
      id: updated.id,
      name: updated.name,
      color: updated.color,
      icon: updated.icon,
      description: updated.description,
      isArchived: updated.isArchived,
      companyId: updated.companyId,
      createdById: updated.createdById,
      taskCount: updated._count.tasks,
      agendaTaskCount: updated._count.agendaTasks,
      totalCount: updated._count.tasks + updated._count.agendaTasks,
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
    });
  } catch (error) {
    console.error('[API] Error updating task group:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}

// DELETE /api/task-groups/[id] — eliminar grupo (tareas quedan sin grupo por ON DELETE SET NULL)
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getUserFromToken();
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const groupId = parseInt(params.id);
    if (isNaN(groupId)) return NextResponse.json({ error: 'ID inválido' }, { status: 400 });

    const existing = await (prisma as any).taskGroup.findUnique({
      where: { id: groupId },
      select: { id: true, companyId: true },
    });

    if (!existing) return NextResponse.json({ error: 'Grupo no encontrado' }, { status: 404 });
    if (!hasAccessToCompany(user, existing.companyId))
      return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 });

    await (prisma as any).taskGroup.delete({ where: { id: groupId } });

    return NextResponse.json({ success: true, message: 'Grupo eliminado. Las tareas quedan sin grupo.' });
  } catch (error) {
    console.error('[API] Error deleting task group:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
