import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserFromToken } from '@/lib/tasks/auth-helper';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

interface RouteParams { params: Promise<{ id: string }> }

const AddMemberSchema = z.object({
  userId: z.number().int().positive(),
  role: z.enum(['owner', 'member']).default('member'),
});

// POST /api/agenda/task-groups/[id]/members — Add member
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await getUserFromToken();
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const { id } = await params;
    const groupId = parseInt(id);

    const group = await prisma.taskGroup.findUnique({
      where: { id: groupId },
      select: { createdById: true, companyId: true },
    });
    if (!group) return NextResponse.json({ error: 'Grupo no encontrado' }, { status: 404 });
    if (group.createdById !== user.id) {
      return NextResponse.json({ error: 'Solo el dueño puede gestionar miembros' }, { status: 403 });
    }

    const body = await request.json();
    const validation = AddMemberSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 });
    }

    const member = await prisma.taskGroupMember.upsert({
      where: { groupId_userId: { groupId, userId: validation.data.userId } },
      create: { groupId, userId: validation.data.userId, role: validation.data.role },
      update: { role: validation.data.role },
      include: { user: { select: { id: true, name: true, avatar: true } } },
    });

    return NextResponse.json({
      id: member.id,
      userId: member.userId,
      role: member.role,
      user: member.user,
      createdAt: member.createdAt.toISOString(),
    }, { status: 201 });
  } catch (error) {
    console.error('[API] Error adding group member:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}

// DELETE /api/agenda/task-groups/[id]/members?userId=X — Remove member
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await getUserFromToken();
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const { id } = await params;
    const groupId = parseInt(id);
    const { searchParams } = new URL(request.url);
    const userId = parseInt(searchParams.get('userId') || '0');

    if (!userId) return NextResponse.json({ error: 'userId requerido' }, { status: 400 });

    const group = await prisma.taskGroup.findUnique({
      where: { id: groupId },
      select: { createdById: true },
    });
    if (!group) return NextResponse.json({ error: 'Grupo no encontrado' }, { status: 404 });
    if (group.createdById !== user.id && user.id !== userId) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }

    await prisma.taskGroupMember.deleteMany({
      where: { groupId, userId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[API] Error removing group member:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
