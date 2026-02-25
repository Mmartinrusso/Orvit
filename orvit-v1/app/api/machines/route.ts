import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withGuards } from '@/lib/middleware/withGuards';
import { validateRequest } from '@/lib/validations/helpers';
import { CreateMachineSchema } from '@/lib/validations/machines';

export const dynamic = 'force-dynamic';

// GET /api/machines - Obtener máquinas de la empresa
export const GET = withGuards(async (request: NextRequest, { user }) => {
  try {
    const { searchParams } = new URL(request.url);
    const sectorId = searchParams.get('sectorId');
    const search = searchParams.get('search');
    const limit = searchParams.get('limit');

    // Siempre usar companyId del usuario autenticado (no confiar en query param)
    const companyId = user.companyId;

    // Construir filtro dinámico
    const where: any = {
      companyId
    };

    // Filtrar por sectorId si se proporciona
    if (sectorId && sectorId !== 'undefined') {
      where.sectorId = parseInt(sectorId);
    }

    // Filtrar por búsqueda de texto si se proporciona
    if (search && search.trim()) {
      where.OR = [
        { name: { contains: search.trim(), mode: 'insensitive' } },
        { nickname: { contains: search.trim(), mode: 'insensitive' } },
      ];
    }

    // Obtener máquinas de la empresa
    const machines = await prisma.machine.findMany({
      where,
      select: {
        id: true,
        name: true,
        nickname: true,
        type: true,
        brand: true,
        model: true,
        status: true,
        sector: {
          select: {
            id: true,
            name: true,
            area: {
              select: {
                id: true,
                name: true
              }
            }
          }
        }
      },
      orderBy: { name: 'asc' },
      ...(limit ? { take: parseInt(limit) } : {})
    });

    return NextResponse.json({
      success: true,
      machines,
      total: machines.length
    });

  } catch (error) {
    console.error('Error en GET /api/machines:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}, { requiredPermissions: ['machines.view'], permissionMode: 'any' });

// POST: Crear una nueva máquina
export const POST = withGuards(async (request: NextRequest) => {
  try {
    const body = await request.json();
    const validation = validateRequest(CreateMachineSchema, body);
    if (!validation.success) return validation.response;

    const { name, nickname, aliases, type, description, brand, model, serialNumber, status, acquisitionDate, companyId, sectorId, photo, logo } = validation.data;

    const machine = await prisma.machine.create({
      data: {
        name,
        nickname,
        aliases: aliases || null,
        type,
        description,
        brand,
        model,
        serialNumber,
        status,
        acquisitionDate: new Date(acquisitionDate),
        companyId,
        sectorId,
        photo: photo || undefined,
        logo: logo || undefined,
      },
      include: {
        company: true,
        sector: true,
      }
    });
    return NextResponse.json(machine, { status: 201 });
  } catch (error) {
    console.error('Error al crear máquina:', error);
    return NextResponse.json({ error: 'Error al crear máquina', details: error }, { status: 500 });
  }
}, { requiredPermissions: ['machines.create'], permissionMode: 'any' });
