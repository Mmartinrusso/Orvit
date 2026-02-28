// API Routes for Individual Skill Operations
// GET /api/skills/[id] - Get skill details
// PATCH /api/skills/[id] - Update a skill
// DELETE /api/skills/[id] - Delete (soft) a skill

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';
import { requirePermission } from '@/lib/auth/shared-helpers';

export const dynamic = 'force-dynamic';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET - Get skill details with users who have it
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const { user, error } = await requirePermission('skills.view');
    if (error) return error;

    const skill = await prisma.skill.findUnique({
      where: { id: Number(id) },
      include: {
        userSkills: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
            verifiedBy: {
              select: {
                id: true,
                name: true,
              },
            },
          },
          orderBy: { level: 'desc' },
        },
        taskRequirements: {
          include: {
            checklist: {
              select: {
                id: true,
                name: true,
              },
            },
            machine: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
    });

    if (!skill) {
      return NextResponse.json({ error: 'Habilidad no encontrada' }, { status: 404 });
    }

    return NextResponse.json(skill);
  } catch (error) {
    console.error('Error fetching skill:', error);
    return NextResponse.json({ error: 'Error al obtener habilidad' }, { status: 500 });
  }
}

// PATCH - Update a skill
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const { user, error } = await requirePermission('skills.edit');
    if (error) return error;

    const existingSkill = await prisma.skill.findUnique({
      where: { id: Number(id) },
    });

    if (!existingSkill) {
      return NextResponse.json({ error: 'Habilidad no encontrada' }, { status: 404 });
    }

    const body = await request.json();
    const { name, description, category, code, isCertificationRequired, certificationValidityDays, isActive } = body;

    // If name or code is changing, check for duplicates
    if (name && name !== existingSkill.name) {
      const duplicate = await prisma.skill.findFirst({
        where: {
          companyId: existingSkill.companyId,
          name: { equals: name, mode: 'insensitive' },
          id: { not: Number(id) },
        },
      });
      if (duplicate) {
        return NextResponse.json({ error: 'Ya existe una habilidad con ese nombre' }, { status: 400 });
      }
    }

    if (code && code !== existingSkill.code) {
      const duplicate = await prisma.skill.findFirst({
        where: {
          companyId: existingSkill.companyId,
          code: { equals: code, mode: 'insensitive' },
          id: { not: Number(id) },
        },
      });
      if (duplicate) {
        return NextResponse.json({ error: 'Ya existe una habilidad con ese código' }, { status: 400 });
      }
    }

    const skill = await prisma.skill.update({
      where: { id: Number(id) },
      data: {
        ...(name !== undefined && { name }),
        ...(description !== undefined && { description }),
        ...(category !== undefined && { category }),
        ...(code !== undefined && { code }),
        ...(isCertificationRequired !== undefined && { isCertificationRequired }),
        ...(certificationValidityDays !== undefined && {
          certificationValidityDays: certificationValidityDays ? Number(certificationValidityDays) : null
        }),
        ...(isActive !== undefined && { isActive }),
      },
    });

    return NextResponse.json(skill);
  } catch (error) {
    console.error('Error updating skill:', error);
    return NextResponse.json({ error: 'Error al actualizar habilidad' }, { status: 500 });
  }
}

// DELETE - Soft delete a skill
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const { user, error } = await requirePermission('skills.delete');
    if (error) return error;

    const existingSkill = await prisma.skill.findUnique({
      where: { id: Number(id) },
    });

    if (!existingSkill) {
      return NextResponse.json({ error: 'Habilidad no encontrada' }, { status: 404 });
    }

    // Soft delete
    await prisma.skill.update({
      where: { id: Number(id) },
      data: { isActive: false },
    });

    return NextResponse.json({ success: true, message: 'Habilidad eliminada' });
  } catch (error) {
    console.error('Error deleting skill:', error);
    return NextResponse.json({ error: 'Error al eliminar habilidad' }, { status: 500 });
  }
}
