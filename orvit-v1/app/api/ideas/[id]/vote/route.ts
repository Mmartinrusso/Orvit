/**
 * API: /api/ideas/[id]/vote
 *
 * POST - Votar/Quitar voto de una idea
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth';

export const dynamic = 'force-dynamic';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/ideas/[id]/vote
 * Toggle vote on an idea
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;

    if (!token) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }

    const payload = await verifyToken(token);
    if (!payload || !payload.companyId || !payload.userId) {
      return NextResponse.json({ error: 'Token inválido' }, { status: 401 });
    }

    const companyId = payload.companyId as number;
    const userId = payload.userId as number;
    const ideaId = parseInt(id);

    if (isNaN(ideaId)) {
      return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
    }

    // Verify idea exists and belongs to company
    const idea = await prisma.idea.findFirst({
      where: { id: ideaId, companyId },
      select: { id: true },
    });

    if (!idea) {
      return NextResponse.json(
        { error: 'Idea no encontrada' },
        { status: 404 }
      );
    }

    // Check if user already voted
    const existingVote = await prisma.ideaVote.findUnique({
      where: {
        ideaId_userId: { ideaId, userId }
      }
    });

    // Toggle vote + count atomically
    let voted: boolean;
    let voteCount: number;

    if (existingVote) {
      const [, count] = await prisma.$transaction([
        prisma.ideaVote.delete({ where: { id: existingVote.id } }),
        prisma.ideaVote.count({ where: { ideaId } }),
      ]);
      voted = false;
      voteCount = count;
    } else {
      const [, count] = await prisma.$transaction([
        prisma.ideaVote.create({ data: { ideaId, userId } }),
        prisma.ideaVote.count({ where: { ideaId } }),
      ]);
      voted = true;
      voteCount = count;
    }

    return NextResponse.json({
      success: true,
      voted,
      voteCount,
    });
  } catch (error) {
    console.error('Error en POST /api/ideas/[id]/vote:', error);
    return NextResponse.json(
      { error: 'Error al votar' },
      { status: 500 }
    );
  }
}
