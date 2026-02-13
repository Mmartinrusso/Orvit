import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyAuth } from '@/lib/auth';

export const dynamic = 'force-dynamic';

// GET - Obtener empresa por ID
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await verifyAuth(request);
    if (!auth || auth.role !== 'SUPERADMIN') {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const companyId = parseInt(params.id);

    const company = await prisma.company.findUnique({
      where: { id: companyId },
      include: {
        users: {
          include: {
            user: {
              select: { id: true, name: true, email: true }
            }
          }
        }
      }
    });

    if (!company) {
      return NextResponse.json({ error: 'Empresa no encontrada' }, { status: 404 });
    }

    // Get enabled modules
    const modules = await prisma.$queryRaw`
      SELECT m.*, cm."isEnabled", cm."enabledAt"
      FROM "modules" m
      LEFT JOIN "company_modules" cm ON m.id = cm."moduleId" AND cm."companyId" = ${companyId}
      ORDER BY m."sortOrder"
    ` as any[];

    return NextResponse.json({ company, modules });
  } catch (error) {
    console.error('Error fetching company:', error);
    return NextResponse.json({ error: 'Error al obtener empresa' }, { status: 500 });
  }
}

// PUT - Actualizar empresa
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await verifyAuth(request);
    if (!auth || auth.role !== 'SUPERADMIN') {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const companyId = parseInt(params.id);
    const body = await request.json();
    const { name, cuit, email, phone, address, isActive } = body;

    await prisma.company.update({
      where: { id: companyId },
      data: {
        name: name !== undefined ? name : undefined,
        cuit: cuit !== undefined ? (cuit || null) : undefined,
        email: email !== undefined ? (email || null) : undefined,
        phone: phone !== undefined ? (phone || null) : undefined,
        address: address !== undefined ? (address || null) : undefined,
        isActive: isActive !== undefined ? isActive : undefined,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating company:', error);
    return NextResponse.json({ error: 'Error al actualizar empresa' }, { status: 500 });
  }
}

// DELETE - Eliminar empresa
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await verifyAuth(request);
    if (!auth || auth.role !== 'SUPERADMIN') {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const companyId = parseInt(params.id);

    // Check if company has users
    const usersCount = await prisma.userOnCompany.count({
      where: { companyId }
    });

    if (usersCount > 0) {
      return NextResponse.json({
        error: `Esta empresa tiene ${usersCount} usuario(s) asociado(s). Elimine los usuarios primero.`
      }, { status: 400 });
    }

    // Delete company modules first
    await prisma.$executeRaw`
      DELETE FROM "company_modules" WHERE "companyId" = ${companyId}
    `;

    // Delete company
    await prisma.company.delete({
      where: { id: companyId }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting company:', error);
    return NextResponse.json({ error: 'Error al eliminar empresa' }, { status: 500 });
  }
}
