// API Route for Skills Matrix
// GET /api/skills/matrix - Get matrix of users and their skills

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';

export const dynamic = 'force-dynamic';

// GET - Get skills matrix for a company
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

    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get('companyId') || payload.companyId;

    if (!companyId) {
      return NextResponse.json({ error: 'companyId es requerido' }, { status: 400 });
    }

    // Get all active users in the company
    const usersOnCompany = await prisma.userOnCompany.findMany({
      where: {
        companyId: Number(companyId),
        user: {
          isActive: true,
        },
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: {
        user: {
          name: 'asc',
        },
      },
    });

    // Get all user skills for users in this company
    const userIds = usersOnCompany.map(uoc => uoc.userId);

    const userSkills = await prisma.userSkill.findMany({
      where: {
        userId: { in: userIds },
        skill: {
          companyId: Number(companyId),
          isActive: true,
        },
      },
      select: {
        userId: true,
        skillId: true,
        level: true,
        isVerified: true,
        expiresAt: true,
      },
    });

    // Build matrix data
    const users = usersOnCompany.map(uoc => {
      const userSkillsList = userSkills.filter(us => us.userId === uoc.userId);
      const skillsMap: Record<number, {
        level: number;
        isVerified: boolean;
        expiresAt: string | null;
      }> = {};

      userSkillsList.forEach(us => {
        skillsMap[us.skillId] = {
          level: us.level,
          isVerified: us.isVerified,
          expiresAt: us.expiresAt?.toISOString() || null,
        };
      });

      return {
        userId: uoc.user.id,
        userName: uoc.user.name,
        skills: skillsMap,
      };
    });

    return NextResponse.json({ users });
  } catch (error) {
    console.error('Error fetching skills matrix:', error);
    return NextResponse.json({ error: 'Error al obtener matriz de habilidades' }, { status: 500 });
  }
}
