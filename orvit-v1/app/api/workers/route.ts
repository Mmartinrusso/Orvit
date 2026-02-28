import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth/shared-helpers';

export const dynamic = 'force-dynamic';

// ✅ OPTIMIZADO: Usar instancia global de prisma desde @/lib/prisma

// ✅ OPTIMIZADO: GET - Obtener trabajadores de una empresa
export async function GET(request: NextRequest) {
  try {
    const { user, error: authError } = await requireAuth();
    if (authError) return authError;
    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get('companyId');

    if (!companyId) {
      return NextResponse.json({ error: 'Company ID requerido' }, { status: 400 });
    }

    // ✅ OPTIMIZADO: Eliminada query innecesaria de verificación de empresa
    // Si no hay workers, simplemente devolvemos array vacío
    const workers = await prisma.worker.findMany({
      where: {
        companyId: parseInt(companyId),
        isActive: true
      },
      select: {
        id: true,
        name: true,
        specialty: true,
        phone: true
      },
      orderBy: {
        name: 'asc'
      }
    });

    return NextResponse.json({
      success: true,
      workers
    });

  } catch (error) {
    console.error('Error fetching workers:', error);
    return NextResponse.json(
      { error: 'Error al obtener trabajadores' },
      { status: 500 }
    );
  }
}

// POST /api/workers
export async function POST(request: NextRequest) {
  try {
    const { user, error: authError } = await requireAuth();
    if (authError) return authError;

    const body = await request.json();

    const { name, phone, specialty, companyId } = body;

    // Validaciones básicas
    if (!name || !companyId) {
      return NextResponse.json(
        { error: 'Nombre y empresa son requeridos' },
        { status: 400 }
      );
    }

    // Verificar que la empresa existe
    const company = await prisma.company.findUnique({
      where: { id: Number(companyId) }
    });

    if (!company) {
      return NextResponse.json(
        { error: 'Empresa no encontrada' },
        { status: 404 }
      );
    }

    // Verificar que no existe otro operario con el mismo nombre en la empresa
    const existingWorker = await prisma.worker.findFirst({
      where: {
        name: name.trim(),
        companyId: Number(companyId),
        isActive: true
      }
    });

    if (existingWorker) {
      return NextResponse.json(
        { error: 'Ya existe un operario con ese nombre en esta empresa' },
        { status: 400 }
      );
    }

    const newWorker = await prisma.worker.create({
      data: {
        name: name.trim(),
        phone: phone?.trim() || null,
        specialty: specialty?.trim() || null,
        companyId: Number(companyId)
      }
    });

    return NextResponse.json(newWorker, { status: 201 });
  } catch (error) {
    console.error('Error en POST /api/workers:', error);
    return NextResponse.json(
      { error: 'Error al crear operario', details: error },
      { status: 500 }
    );
  }
} 