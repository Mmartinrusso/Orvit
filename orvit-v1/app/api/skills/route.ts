// API Routes for Skills Catalog
// GET /api/skills - List all skills for a company
// POST /api/skills - Create a new skill

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';

export const dynamic = 'force-dynamic';

// GET - List all skills for a company
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
    const category = searchParams.get('category');
    const isCertificationRequired = searchParams.get('isCertificationRequired');
    const search = searchParams.get('search');

    if (!companyId) {
      return NextResponse.json({ error: 'companyId es requerido' }, { status: 400 });
    }

    const where: Record<string, unknown> = {
      companyId: Number(companyId),
      isActive: true,
    };

    if (category) {
      where.category = category;
    }

    if (isCertificationRequired !== null && isCertificationRequired !== undefined) {
      where.isCertificationRequired = isCertificationRequired === 'true';
    }

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        { code: { contains: search, mode: 'insensitive' } },
      ];
    }

    const skills = await prisma.skill.findMany({
      where,
      include: {
        _count: {
          select: {
            userSkills: true,
            taskRequirements: true,
          },
        },
      },
      orderBy: [
        { category: 'asc' },
        { name: 'asc' },
      ],
    });

    // Get unique categories for filters
    const categories = await prisma.skill.findMany({
      where: {
        companyId: Number(companyId),
        isActive: true,
      },
      select: {
        category: true,
      },
      distinct: ['category'],
    });

    return NextResponse.json({
      skills,
      categories: categories.map(c => c.category).filter(Boolean),
    });
  } catch (error) {
    console.error('Error fetching skills:', error);
    return NextResponse.json({ error: 'Error al obtener habilidades' }, { status: 500 });
  }
}

// POST - Create a new skill
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

    // Check permission (skills.create)
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
      p => p.permission === 'skills.create'
    );

    if (!hasPermission && payload.role !== 'SUPERADMIN') {
      return NextResponse.json({ error: 'Sin permiso para crear habilidades' }, { status: 403 });
    }

    const body = await request.json();
    const { name, description, category, code, isCertificationRequired, certificationValidityDays, companyId } = body;

    if (!name) {
      return NextResponse.json({ error: 'El nombre es requerido' }, { status: 400 });
    }

    const targetCompanyId = companyId || payload.companyId;

    // Check if skill with same name or code already exists
    const existingSkill = await prisma.skill.findFirst({
      where: {
        companyId: Number(targetCompanyId),
        OR: [
          { name: { equals: name, mode: 'insensitive' } },
          ...(code ? [{ code: { equals: code, mode: 'insensitive' } }] : []),
        ],
      },
    });

    if (existingSkill) {
      return NextResponse.json({ error: 'Ya existe una habilidad con ese nombre o código' }, { status: 400 });
    }

    const skill = await prisma.skill.create({
      data: {
        name,
        description,
        category,
        code,
        isCertificationRequired: isCertificationRequired || false,
        certificationValidityDays: certificationValidityDays ? Number(certificationValidityDays) : null,
        companyId: Number(targetCompanyId),
        isActive: true,
      },
    });

    return NextResponse.json(skill, { status: 201 });
  } catch (error) {
    console.error('Error creating skill:', error);
    return NextResponse.json({ error: 'Error al crear habilidad' }, { status: 500 });
  }
}
