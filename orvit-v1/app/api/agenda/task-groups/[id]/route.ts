import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserFromToken } from '@/lib/tasks/auth-helper';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const UpdateGroupSchema = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  icon: z.string().max(50).optional().nullable(),
  description: z.string().max(500).optional().nullable(),
  isArchived: z.boolean().optional(),
  isProject: z.boolean().optional(),
});

interface RouteParams { params: Promise<{ id: string }> }

// PUT /api/agenda/task-groups/[id]
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await getUserFromToken();
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const { id } = await params;
    const groupId = parseInt(id);
    if (isNaN(groupId)) return NextResponse.json({ error: 'ID inválido' }, { status: 400 });

    const group = await prisma.taskGroup.findUnique({
      where: { id: groupId },
      select: { createdById: true, companyId: true },
    });

    if (!group) return NextResponse.json({ error: 'Grupo no encontrado' }, { status: 404 });
    if (group.createdById !== user.id) {
      return NextResponse.json({ error: 'Solo el creador puede editar el grupo' }, { status: 403 });
    }

    const body = await request.json();
    const validation = UpdateGroupSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json({ error: 'Datos inválidos', details: validation.error.errors }, { status: 400 });
    }

    const updated = await prisma.taskGroup.update({
      where: { id: groupId },
      data: validation.data,
      include: {
        createdBy: { select: { id: true, name: true, avatar: true } },
        members: {
          include: { user: { select: { id: true, name: true, avatar: true } } },
        },
        _count: { select: { agendaTasks: true } },
      },
    });

    return NextResponse.json({
      id: updated.id,
      name: updated.name,
      color: updated.color,
      icon: updated.icon,
      description: updated.description,
      isArchived: updated.isArchived,
      isProject: (updated as any).isProject ?? false,
      companyId: updated.companyId,
      createdById: updated.createdById,
      createdBy: updated.createdBy,
      members: updated.members.map((m) => ({
        id: m.id, userId: m.userId, role: m.role, user: m.user,
        createdAt: m.createdAt.toISOString(),
      })),
      taskCount: updated._count.agendaTasks,
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
    });
  } catch (error) {
    console.error('[API] Error updating task group:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}

// DELETE /api/agenda/task-groups/[id]
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await getUserFromToken();
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const { id } = await params;
    const groupId = parseInt(id);
    if (isNaN(groupId)) return NextResponse.json({ error: 'ID inválido' }, { status: 400 });

    const group = await prisma.taskGroup.findUnique({
      where: { id: groupId },
      select: { createdById: true },
    });

    if (!group) return NextResponse.json({ error: 'Grupo no encontrado' }, { status: 404 });
    if (group.createdById !== user.id) {
      return NextResponse.json({ error: 'Solo el creador puede eliminar el grupo' }, { status: 403 });
    }

    // Tasks will have groupId set to null via onDelete: SetNull
    await prisma.taskGroup.delete({ where: { id: groupId } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[API] Error deleting task group:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
