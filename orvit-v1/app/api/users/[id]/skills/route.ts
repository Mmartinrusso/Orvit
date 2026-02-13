// API Routes for User Skills Management
// GET /api/users/[id]/skills - Get user's skills
// POST /api/users/[id]/skills - Assign a skill to user
// PATCH /api/users/[id]/skills - Update user skill (level, verification)

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';

export const dynamic = 'force-dynamic';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET - Get all skills for a user
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id: userId } = await params;
    const token = request.cookies.get('token')?.value;
    if (!token) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const payload = await verifyToken(token);
    if (!payload) {
      return NextResponse.json({ error: 'Token inválido' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const includeExpired = searchParams.get('includeExpired') === 'true';

    // Get user skills
    const userSkills = await prisma.userSkill.findMany({
      where: {
        userId: Number(userId),
        ...(includeExpired ? {} : {
          OR: [
            { expiresAt: null },
            { expiresAt: { gte: new Date() } },
          ],
        }),
      },
      include: {
        skill: true,
        verifiedBy: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: [
        { skill: { category: 'asc' } },
        { skill: { name: 'asc' } },
      ],
    });

    // Group by category
    const skillsByCategory: Record<string, typeof userSkills> = {};
    userSkills.forEach(us => {
      const category = us.skill.category || 'Sin categoría';
      if (!skillsByCategory[category]) {
        skillsByCategory[category] = [];
      }
      skillsByCategory[category].push(us);
    });

    // Calculate summary
    const summary = {
      totalSkills: userSkills.length,
      verifiedSkills: userSkills.filter(s => s.isVerified).length,
      pendingVerification: userSkills.filter(s => !s.isVerified).length,
      expiringSoon: userSkills.filter(s => {
        if (!s.expiresAt) return false;
        const thirtyDaysFromNow = new Date();
        thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
        return s.expiresAt <= thirtyDaysFromNow && s.expiresAt > new Date();
      }).length,
      expired: userSkills.filter(s => s.expiresAt && s.expiresAt < new Date()).length,
      averageLevel: userSkills.length > 0
        ? Number((userSkills.reduce((acc, s) => acc + s.level, 0) / userSkills.length).toFixed(1))
        : 0,
    };

    return NextResponse.json({
      userSkills,
      skillsByCategory,
      summary,
    });
  } catch (error) {
    console.error('Error fetching user skills:', error);
    return NextResponse.json({ error: 'Error al obtener habilidades del usuario' }, { status: 500 });
  }
}

// POST - Assign a skill to user
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { id: userId } = await params;
    const token = request.cookies.get('token')?.value;
    if (!token) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const payload = await verifyToken(token);
    if (!payload) {
      return NextResponse.json({ error: 'Token inválido' }, { status: 401 });
    }

    // Check permission (skills.assign)
    const userOnCompany = await prisma.userOnCompany.findFirst({
      where: {
        userId: payload.userId,
        companyId: payload.companyId,
      },
      include: {
        role: {
          include: {
            permissions: true,
          },
        },
      },
    });

    const hasPermission = userOnCompany?.role?.permissions?.some(
      p => p.permission === 'skills.assign'
    );

    if (!hasPermission && payload.role !== 'SUPERADMIN') {
      return NextResponse.json({ error: 'Sin permiso para asignar habilidades' }, { status: 403 });
    }

    const body = await request.json();
    const { skillId, level, notes, acquiredAt, expiresAt } = body;

    if (!skillId) {
      return NextResponse.json({ error: 'skillId es requerido' }, { status: 400 });
    }

    if (level === undefined || level < 1 || level > 5) {
      return NextResponse.json({ error: 'Nivel debe ser entre 1 y 5' }, { status: 400 });
    }

    // Check if skill exists and belongs to same company
    const skill = await prisma.skill.findUnique({
      where: { id: Number(skillId) },
    });

    if (!skill || !skill.isActive) {
      return NextResponse.json({ error: 'Habilidad no encontrada' }, { status: 404 });
    }

    // Check if user exists
    const targetUser = await prisma.user.findUnique({
      where: { id: Number(userId) },
      include: {
        companies: {
          where: { companyId: skill.companyId },
        },
      },
    });

    if (!targetUser) {
      return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 });
    }

    if (targetUser.companies.length === 0) {
      return NextResponse.json({ error: 'Usuario no pertenece a la misma empresa' }, { status: 400 });
    }

    // Check if skill is already assigned
    const existingUserSkill = await prisma.userSkill.findUnique({
      where: {
        userId_skillId: {
          userId: Number(userId),
          skillId: Number(skillId),
        },
      },
    });

    if (existingUserSkill) {
      return NextResponse.json({ error: 'El usuario ya tiene esta habilidad asignada' }, { status: 400 });
    }

    // Calculate expiration date based on skill settings
    let calculatedExpiresAt = expiresAt ? new Date(expiresAt) : null;
    if (!calculatedExpiresAt && skill.certificationValidityDays) {
      calculatedExpiresAt = new Date();
      calculatedExpiresAt.setDate(calculatedExpiresAt.getDate() + skill.certificationValidityDays);
    }

    const userSkill = await prisma.userSkill.create({
      data: {
        userId: Number(userId),
        skillId: Number(skillId),
        level,
        notes,
        acquiredAt: acquiredAt ? new Date(acquiredAt) : new Date(),
        expiresAt: calculatedExpiresAt,
        isVerified: false,
      },
      include: {
        skill: true,
      },
    });

    return NextResponse.json(userSkill, { status: 201 });
  } catch (error) {
    console.error('Error assigning skill:', error);
    return NextResponse.json({ error: 'Error al asignar habilidad' }, { status: 500 });
  }
}

// PATCH - Update user skill (level, verify, etc.)
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { id: userId } = await params;
    const token = request.cookies.get('token')?.value;
    if (!token) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const payload = await verifyToken(token);
    if (!payload) {
      return NextResponse.json({ error: 'Token inválido' }, { status: 401 });
    }

    const body = await request.json();
    const { skillId, level, notes, expiresAt, isVerified } = body;

    if (!skillId) {
      return NextResponse.json({ error: 'skillId es requerido' }, { status: 400 });
    }

    // Find existing user skill
    const existingUserSkill = await prisma.userSkill.findUnique({
      where: {
        userId_skillId: {
          userId: Number(userId),
          skillId: Number(skillId),
        },
      },
      include: {
        skill: true,
      },
    });

    if (!existingUserSkill) {
      return NextResponse.json({ error: 'Habilidad de usuario no encontrada' }, { status: 404 });
    }

    // Check permissions based on what's being updated
    const userOnCompany = await prisma.userOnCompany.findFirst({
      where: {
        userId: payload.userId,
        companyId: existingUserSkill.skill.companyId,
      },
      include: {
        role: {
          include: {
            permissions: true,
          },
        },
      },
    });

    // If verifying, need skills.verify permission
    if (isVerified !== undefined) {
      const canVerify = userOnCompany?.role?.permissions?.some(
        p => p.permission === 'skills.verify'
      );

      if (!canVerify && payload.role !== 'SUPERADMIN') {
        return NextResponse.json({ error: 'Sin permiso para verificar habilidades' }, { status: 403 });
      }
    } else {
      // For other updates, need skills.assign permission
      const canAssign = userOnCompany?.role?.permissions?.some(
        p => p.permission === 'skills.assign'
      );

      if (!canAssign && payload.role !== 'SUPERADMIN') {
        return NextResponse.json({ error: 'Sin permiso para modificar habilidades' }, { status: 403 });
      }
    }

    const updateData: Record<string, unknown> = {};

    if (level !== undefined) {
      if (level < 1 || level > 5) {
        return NextResponse.json({ error: 'Nivel debe ser entre 1 y 5' }, { status: 400 });
      }
      updateData.level = level;
    }

    if (notes !== undefined) {
      updateData.notes = notes;
    }

    if (expiresAt !== undefined) {
      updateData.expiresAt = expiresAt ? new Date(expiresAt) : null;
    }

    if (isVerified !== undefined) {
      updateData.isVerified = isVerified;
      if (isVerified) {
        updateData.verifiedAt = new Date();
        updateData.verifiedById = payload.userId;
      } else {
        updateData.verifiedAt = null;
        updateData.verifiedById = null;
      }
    }

    const userSkill = await prisma.userSkill.update({
      where: {
        userId_skillId: {
          userId: Number(userId),
          skillId: Number(skillId),
        },
      },
      data: updateData,
      include: {
        skill: true,
        verifiedBy: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    return NextResponse.json(userSkill);
  } catch (error) {
    console.error('Error updating user skill:', error);
    return NextResponse.json({ error: 'Error al actualizar habilidad' }, { status: 500 });
  }
}

// DELETE - Remove a skill from user
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { id: userId } = await params;
    const token = request.cookies.get('token')?.value;
    if (!token) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const payload = await verifyToken(token);
    if (!payload) {
      return NextResponse.json({ error: 'Token inválido' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const skillId = searchParams.get('skillId');

    if (!skillId) {
      return NextResponse.json({ error: 'skillId es requerido' }, { status: 400 });
    }

    // Find existing user skill
    const existingUserSkill = await prisma.userSkill.findUnique({
      where: {
        userId_skillId: {
          userId: Number(userId),
          skillId: Number(skillId),
        },
      },
      include: {
        skill: true,
      },
    });

    if (!existingUserSkill) {
      return NextResponse.json({ error: 'Habilidad de usuario no encontrada' }, { status: 404 });
    }

    // Check permission (skills.assign)
    const userOnCompany = await prisma.userOnCompany.findFirst({
      where: {
        userId: payload.userId,
        companyId: existingUserSkill.skill.companyId,
      },
      include: {
        role: {
          include: {
            permissions: true,
          },
        },
      },
    });

    const hasPermission = userOnCompany?.role?.permissions?.some(
      p => p.permission === 'skills.assign'
    );

    if (!hasPermission && payload.role !== 'SUPERADMIN') {
      return NextResponse.json({ error: 'Sin permiso para quitar habilidades' }, { status: 403 });
    }

    await prisma.userSkill.delete({
      where: {
        userId_skillId: {
          userId: Number(userId),
          skillId: Number(skillId),
        },
      },
    });

    return NextResponse.json({ success: true, message: 'Habilidad removida del usuario' });
  } catch (error) {
    console.error('Error removing user skill:', error);
    return NextResponse.json({ error: 'Error al quitar habilidad' }, { status: 500 });
  }
}
