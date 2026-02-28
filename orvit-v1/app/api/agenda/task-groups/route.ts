import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserFromToken } from '@/lib/tasks/auth-helper';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const CreateGroupSchema = z.object({
  name: z.string().trim().min(1).max(100),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).default('#6366f1'),
  icon: z.string().max(50).optional(),
  description: z.string().max(500).optional(),
  isProject: z.boolean().default(false),
  companyId: z.number().int().positive(),
  memberUserIds: z.array(z.number().int().positive()).optional(),
});

// GET /api/agenda/task-groups?companyId=X&includeArchived=false
export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromToken();
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const companyId = parseInt(searchParams.get('companyId') || '0');
    if (!companyId) return NextResponse.json({ error: 'companyId requerido' }, { status: 400 });

    const includeArchived = searchParams.get('includeArchived') === 'true';

    const groups = await prisma.taskGroup.findMany({
      where: {
        companyId,
        isArchived: includeArchived ? undefined : false,
      },
      include: {
        createdBy: { select: { id: true, name: true, avatar: true } },
        members: {
          include: {
            user: { select: { id: true, name: true, avatar: true } },
          },
          orderBy: { createdAt: 'asc' },
        },
        _count: { select: { agendaTasks: true } },
      },
      orderBy: [{ isProject: 'asc' }, { createdAt: 'desc' }],
    });

    return NextResponse.json(
      groups.map((g) => ({
        id: g.id,
        name: g.name,
        color: g.color,
        icon: g.icon,
        description: g.description,
        isArchived: g.isArchived,
        isProject: (g as any).isProject ?? false,
        companyId: g.companyId,
        createdById: g.createdById,
        createdBy: g.createdBy,
        members: g.members.map((m) => ({
          id: m.id,
          userId: m.userId,
          role: m.role,
          user: m.user,
          createdAt: m.createdAt.toISOString(),
        })),
        taskCount: g._count.agendaTasks,
        createdAt: g.createdAt.toISOString(),
        updatedAt: g.updatedAt.toISOString(),
      }))
    );
  } catch (error) {
    console.error('[API] Error fetching task groups:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}

// POST /api/agenda/task-groups
export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromToken();
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const body = await request.json();
    const validation = CreateGroupSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Datos inválidos', details: validation.error.errors },
        { status: 400 }
      );
    }

    const data = validation.data;

    // Create group + members in transaction
    const group = await prisma.$transaction(async (tx) => {
      const g = await tx.taskGroup.create({
        data: {
          name: data.name,
          color: data.color,
          icon: data.icon,
          description: data.description,
          isProject: data.isProject,
          companyId: data.companyId,
          createdById: user.id,
        },
      });

      // Auto-add creator as owner
      const memberIds = new Set([user.id, ...(data.memberUserIds ?? [])]);
      await tx.taskGroupMember.createMany({
        data: Array.from(memberIds).map((uid) => ({
          groupId: g.id,
          userId: uid,
          role: uid === user.id ? 'owner' : 'member',
        })),
        skipDuplicates: true,
      });

      return tx.taskGroup.findUnique({
        where: { id: g.id },
        include: {
          createdBy: { select: { id: true, name: true, avatar: true } },
          members: {
            include: { user: { select: { id: true, name: true, avatar: true } } },
          },
          _count: { select: { agendaTasks: true } },
        },
      });
    });

    if (!group) throw new Error('Error creating group');

    return NextResponse.json(
      {
        id: group.id,
        name: group.name,
        color: group.color,
        icon: group.icon,
        description: group.description,
        isArchived: group.isArchived,
        isProject: (group as any).isProject ?? false,
        companyId: group.companyId,
        createdById: group.createdById,
        createdBy: group.createdBy,
        members: group.members.map((m) => ({
          id: m.id,
          userId: m.userId,
          role: m.role,
          user: m.user,
          createdAt: m.createdAt.toISOString(),
        })),
        taskCount: group._count.agendaTasks,
        createdAt: group.createdAt.toISOString(),
        updatedAt: group.updatedAt.toISOString(),
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('[API] Error creating task group:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
