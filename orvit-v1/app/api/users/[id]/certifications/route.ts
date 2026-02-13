// API Routes for User Certifications Management
// GET /api/users/[id]/certifications - Get user's certifications
// POST /api/users/[id]/certifications - Create/register a certification

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';

export const dynamic = 'force-dynamic';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET - Get all certifications for a user
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
    const status = searchParams.get('status');
    const skillId = searchParams.get('skillId');

    const where: Record<string, unknown> = {
      userId: Number(userId),
    };

    if (status) {
      where.status = status;
    }

    if (skillId) {
      where.skillId = Number(skillId);
    }

    const certifications = await prisma.userCertification.findMany({
      where,
      include: {
        skill: true,
        issuedBy: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: [
        { status: 'asc' },
        { expiresAt: 'asc' },
      ],
    });

    // Calculate summary
    const now = new Date();
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

    const summary = {
      total: certifications.length,
      active: certifications.filter(c => c.status === 'ACTIVE').length,
      expired: certifications.filter(c => c.status === 'EXPIRED').length,
      pending: certifications.filter(c => c.status === 'PENDING').length,
      revoked: certifications.filter(c => c.status === 'REVOKED').length,
      expiringSoon: certifications.filter(c =>
        c.status === 'ACTIVE' &&
        c.expiresAt &&
        c.expiresAt <= thirtyDaysFromNow &&
        c.expiresAt > now
      ).length,
    };

    return NextResponse.json({
      certifications,
      summary,
    });
  } catch (error) {
    console.error('Error fetching certifications:', error);
    return NextResponse.json({ error: 'Error al obtener certificaciones' }, { status: 500 });
  }
}

// POST - Create/register a certification
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

    // Check permission (certifications.create)
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
      p => p.permission === 'certifications.create'
    );

    if (!hasPermission && payload.role !== 'SUPERADMIN') {
      return NextResponse.json({ error: 'Sin permiso para registrar certificaciones' }, { status: 403 });
    }

    const body = await request.json();
    const {
      skillId,
      certificationNumber,
      certificationName,
      issuingOrganization,
      issuedAt,
      expiresAt,
      documentUrl,
      notes,
    } = body;

    if (!skillId) {
      return NextResponse.json({ error: 'skillId es requerido' }, { status: 400 });
    }

    if (!certificationName) {
      return NextResponse.json({ error: 'Nombre de certificación es requerido' }, { status: 400 });
    }

    // Check if skill exists
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

    // Determine status based on dates
    let status: 'ACTIVE' | 'PENDING' | 'EXPIRED' = 'PENDING';
    const now = new Date();

    if (issuedAt) {
      const issuedDate = new Date(issuedAt);
      if (issuedDate <= now) {
        status = 'ACTIVE';
      }
    }

    if (expiresAt) {
      const expiresDate = new Date(expiresAt);
      if (expiresDate < now) {
        status = 'EXPIRED';
      }
    }

    const certification = await prisma.userCertification.create({
      data: {
        userId: Number(userId),
        skillId: Number(skillId),
        certificationNumber,
        certificationName,
        issuingOrganization,
        issuedAt: issuedAt ? new Date(issuedAt) : null,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
        documentUrl,
        notes,
        status,
        issuedById: payload.userId,
      },
      include: {
        skill: true,
        issuedBy: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    // If certification is active and skill requires certification, update user skill
    if (status === 'ACTIVE') {
      const userSkill = await prisma.userSkill.findUnique({
        where: {
          userId_skillId: {
            userId: Number(userId),
            skillId: Number(skillId),
          },
        },
      });

      if (userSkill) {
        await prisma.userSkill.update({
          where: {
            userId_skillId: {
              userId: Number(userId),
              skillId: Number(skillId),
            },
          },
          data: {
            isVerified: true,
            verifiedAt: new Date(),
            verifiedById: payload.userId,
            expiresAt: expiresAt ? new Date(expiresAt) : null,
          },
        });
      }
    }

    return NextResponse.json(certification, { status: 201 });
  } catch (error) {
    console.error('Error creating certification:', error);
    return NextResponse.json({ error: 'Error al registrar certificación' }, { status: 500 });
  }
}

// PATCH - Update a certification
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

    // Check permission (certifications.edit)
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
      p => p.permission === 'certifications.edit'
    );

    if (!hasPermission && payload.role !== 'SUPERADMIN') {
      return NextResponse.json({ error: 'Sin permiso para editar certificaciones' }, { status: 403 });
    }

    const body = await request.json();
    const {
      certificationId,
      certificationNumber,
      certificationName,
      issuingOrganization,
      issuedAt,
      expiresAt,
      documentUrl,
      notes,
      status,
    } = body;

    if (!certificationId) {
      return NextResponse.json({ error: 'certificationId es requerido' }, { status: 400 });
    }

    const existingCert = await prisma.userCertification.findUnique({
      where: { id: Number(certificationId) },
    });

    if (!existingCert) {
      return NextResponse.json({ error: 'Certificación no encontrada' }, { status: 404 });
    }

    if (existingCert.userId !== Number(userId)) {
      return NextResponse.json({ error: 'Certificación no pertenece al usuario' }, { status: 400 });
    }

    const updateData: Record<string, unknown> = {};

    if (certificationNumber !== undefined) updateData.certificationNumber = certificationNumber;
    if (certificationName !== undefined) updateData.certificationName = certificationName;
    if (issuingOrganization !== undefined) updateData.issuingOrganization = issuingOrganization;
    if (issuedAt !== undefined) updateData.issuedAt = issuedAt ? new Date(issuedAt) : null;
    if (expiresAt !== undefined) updateData.expiresAt = expiresAt ? new Date(expiresAt) : null;
    if (documentUrl !== undefined) updateData.documentUrl = documentUrl;
    if (notes !== undefined) updateData.notes = notes;
    if (status !== undefined) updateData.status = status;

    const certification = await prisma.userCertification.update({
      where: { id: Number(certificationId) },
      data: updateData,
      include: {
        skill: true,
        issuedBy: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    return NextResponse.json(certification);
  } catch (error) {
    console.error('Error updating certification:', error);
    return NextResponse.json({ error: 'Error al actualizar certificación' }, { status: 500 });
  }
}

// DELETE - Delete a certification
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

    // Check permission (certifications.delete)
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
      p => p.permission === 'certifications.delete'
    );

    if (!hasPermission && payload.role !== 'SUPERADMIN') {
      return NextResponse.json({ error: 'Sin permiso para eliminar certificaciones' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const certificationId = searchParams.get('certificationId');

    if (!certificationId) {
      return NextResponse.json({ error: 'certificationId es requerido' }, { status: 400 });
    }

    const existingCert = await prisma.userCertification.findUnique({
      where: { id: Number(certificationId) },
    });

    if (!existingCert) {
      return NextResponse.json({ error: 'Certificación no encontrada' }, { status: 404 });
    }

    if (existingCert.userId !== Number(userId)) {
      return NextResponse.json({ error: 'Certificación no pertenece al usuario' }, { status: 400 });
    }

    await prisma.userCertification.delete({
      where: { id: Number(certificationId) },
    });

    return NextResponse.json({ success: true, message: 'Certificación eliminada' });
  } catch (error) {
    console.error('Error deleting certification:', error);
    return NextResponse.json({ error: 'Error al eliminar certificación' }, { status: 500 });
  }
}
