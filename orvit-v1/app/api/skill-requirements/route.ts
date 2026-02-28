// API Routes for Task Skill Requirements
// GET /api/skill-requirements - List requirements with filters
// POST /api/skill-requirements - Create a new requirement

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';

export const dynamic = 'force-dynamic';

// GET - List skill requirements
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

    // companyId always from JWT — never from client
    const companyId = payload.companyId as number;

    // Require skills.view or skills.requirements.manage
    if (payload.role !== 'SUPERADMIN') {
      const userOnCompany = await prisma.userOnCompany.findFirst({
        where: { userId: payload.userId, companyId },
        include: { role: { include: { permissions: true } } },
      });
      const hasPermission = userOnCompany?.role?.permissions?.some(
        (p) =>
          p.permission === 'skills.view' ||
          p.permission === 'skills.requirements.manage'
      );
      if (!hasPermission) {
        return NextResponse.json(
          { error: 'Sin permiso para ver requisitos de habilidades' },
          { status: 403 }
        );
      }
    }

    const { searchParams } = new URL(request.url);
    const checklistId = searchParams.get('checklistId');
    const machineId = searchParams.get('machineId');
    const maintenanceType = searchParams.get('maintenanceType');

    const where: Record<string, unknown> = {
      companyId: Number(companyId),
    };

    if (checklistId) {
      where.checklistId = Number(checklistId);
    }

    if (machineId) {
      where.machineId = Number(machineId);
    }

    if (maintenanceType) {
      where.maintenanceType = maintenanceType;
    }

    const requirements = await prisma.taskSkillRequirement.findMany({
      where,
      include: {
        skill: true,
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
      orderBy: [
        { skill: { name: 'asc' } },
        { minimumLevel: 'desc' },
      ],
    });

    return NextResponse.json(requirements);
  } catch (error) {
    console.error('Error fetching skill requirements:', error);
    return NextResponse.json({ error: 'Error al obtener requisitos de habilidades' }, { status: 500 });
  }
}

// POST - Create a new skill requirement
export async function POST(request: NextRequest) {
  try {
    const token = request.cookies.get('token')?.value;
    if (!token) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const payload = await verifyToken(token);
    if (!payload) {
      return NextResponse.json({ error: 'Token inválido' }, { status: 401 });
    }

    // Check permission (skills.requirements.manage)
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
      p => p.permission === 'skills.requirements.manage'
    );

    if (!hasPermission && payload.role !== 'SUPERADMIN') {
      return NextResponse.json({ error: 'Sin permiso para gestionar requisitos de habilidades' }, { status: 403 });
    }

    const body = await request.json();
    const {
      skillId,
      minimumLevel,
      checklistId,
      machineId,
      maintenanceType,
      isRequired,
      companyId,
    } = body;

    if (!skillId) {
      return NextResponse.json({ error: 'skillId es requerido' }, { status: 400 });
    }

    if (minimumLevel === undefined || minimumLevel < 1 || minimumLevel > 5) {
      return NextResponse.json({ error: 'minimumLevel debe ser entre 1 y 5' }, { status: 400 });
    }

    // At least one of checklist, machine, or maintenanceType should be specified
    if (!checklistId && !machineId && !maintenanceType) {
      return NextResponse.json({
        error: 'Debe especificar al menos checklistId, machineId o maintenanceType'
      }, { status: 400 });
    }

    const targetCompanyId = companyId || payload.companyId;

    // Check if skill exists and belongs to company
    const skill = await prisma.skill.findUnique({
      where: { id: Number(skillId) },
    });

    if (!skill || skill.companyId !== Number(targetCompanyId)) {
      return NextResponse.json({ error: 'Habilidad no encontrada' }, { status: 404 });
    }

    // Check for existing requirement with same criteria
    const existingWhere: Record<string, unknown> = {
      skillId: Number(skillId),
      companyId: Number(targetCompanyId),
    };

    if (checklistId) existingWhere.checklistId = Number(checklistId);
    else existingWhere.checklistId = null;

    if (machineId) existingWhere.machineId = Number(machineId);
    else existingWhere.machineId = null;

    if (maintenanceType) existingWhere.maintenanceType = maintenanceType;
    else existingWhere.maintenanceType = null;

    const existingRequirement = await prisma.taskSkillRequirement.findFirst({
      where: existingWhere,
    });

    if (existingRequirement) {
      return NextResponse.json({
        error: 'Ya existe un requisito con los mismos criterios'
      }, { status: 400 });
    }

    const requirement = await prisma.taskSkillRequirement.create({
      data: {
        skillId: Number(skillId),
        minimumLevel,
        checklistId: checklistId ? Number(checklistId) : null,
        machineId: machineId ? Number(machineId) : null,
        maintenanceType: maintenanceType || null,
        isRequired: isRequired ?? true,
        companyId: Number(targetCompanyId),
      },
      include: {
        skill: true,
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
    });

    return NextResponse.json(requirement, { status: 201 });
  } catch (error) {
    console.error('Error creating skill requirement:', error);
    return NextResponse.json({ error: 'Error al crear requisito de habilidad' }, { status: 500 });
  }
}

// DELETE - Delete a skill requirement
export async function DELETE(request: NextRequest) {
  try {
    const token = request.cookies.get('token')?.value;
    if (!token) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const payload = await verifyToken(token);
    if (!payload) {
      return NextResponse.json({ error: 'Token inválido' }, { status: 401 });
    }

    // Check permission (skills.requirements.manage)
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
      p => p.permission === 'skills.requirements.manage'
    );

    if (!hasPermission && payload.role !== 'SUPERADMIN') {
      return NextResponse.json({ error: 'Sin permiso para gestionar requisitos de habilidades' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'id es requerido' }, { status: 400 });
    }

    const requirement = await prisma.taskSkillRequirement.findUnique({
      where: { id: Number(id) },
    });

    if (!requirement) {
      return NextResponse.json({ error: 'Requisito no encontrado' }, { status: 404 });
    }

    // Verify company access
    if (requirement.companyId !== payload.companyId && payload.role !== 'SUPERADMIN') {
      return NextResponse.json({ error: 'Sin acceso a este requisito' }, { status: 403 });
    }

    await prisma.taskSkillRequirement.delete({
      where: { id: Number(id) },
    });

    return NextResponse.json({ success: true, message: 'Requisito eliminado' });
  } catch (error) {
    console.error('Error deleting skill requirement:', error);
    return NextResponse.json({ error: 'Error al eliminar requisito' }, { status: 500 });
  }
}
