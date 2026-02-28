/**
 * API: /api/maintenance/costs/technician-rates
 *
 * GET - Listar tarifas de técnicos
 * POST - Crear nueva tarifa de técnico
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth';

export const dynamic = 'force-dynamic';

/**
 * GET /api/maintenance/costs/technician-rates
 * Listar tarifas de técnicos
 */
export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;

    if (!token) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }

    const payload = await verifyToken(token);
    if (!payload || !payload.companyId) {
      return NextResponse.json({ error: 'Token inválido' }, { status: 401 });
    }

    const companyId = payload.companyId as number;
    const { searchParams } = new URL(request.url);
    const activeOnly = searchParams.get('activeOnly') !== 'false';

    const rates = await prisma.technicianCostRate.findMany({
      where: {
        companyId,
        ...(activeOnly && { isActive: true })
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true
          }
        }
      },
      orderBy: [
        { isActive: 'desc' },
        { effectiveFrom: 'desc' }
      ]
    });

    return NextResponse.json({
      success: true,
      data: rates.map(r => ({
        id: r.id,
        userId: r.userId,
        userName: r.user.name,
        userEmail: r.user.email,
        userRole: r.user.role,
        hourlyRate: Number(r.hourlyRate),
        overtimeRate: r.overtimeRate ? Number(r.overtimeRate) : null,
        role: r.role,
        currency: r.currency,
        isActive: r.isActive,
        effectiveFrom: r.effectiveFrom,
        effectiveTo: r.effectiveTo
      }))
    });

  } catch (error) {
    console.error('Error en GET /api/maintenance/costs/technician-rates:', error);
    return NextResponse.json(
      { error: 'Error al obtener tarifas' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/maintenance/costs/technician-rates
 * Crear nueva tarifa de técnico
 */
export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;

    if (!token) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }

    const payload = await verifyToken(token);
    if (!payload || !payload.companyId) {
      return NextResponse.json({ error: 'Token inválido' }, { status: 401 });
    }

    const companyId = payload.companyId as number;
    const body = await request.json();

    const {
      userId,
      hourlyRate,
      overtimeRate,
      role,
      currency = 'ARS',
      effectiveFrom = new Date()
    } = body;

    // Validaciones
    if (!userId || !hourlyRate) {
      return NextResponse.json(
        { error: 'userId y hourlyRate son requeridos' },
        { status: 400 }
      );
    }

    if (hourlyRate <= 0) {
      return NextResponse.json(
        { error: 'La tarifa debe ser mayor a 0' },
        { status: 400 }
      );
    }

    if (overtimeRate !== undefined && overtimeRate !== null && overtimeRate <= 0) {
      return NextResponse.json(
        { error: 'La tarifa de horas extra debe ser mayor a 0' },
        { status: 400 }
      );
    }

    // Verificar que el usuario existe
    const user = await prisma.user.findUnique({
      where: { id: parseInt(userId) }
    });

    if (!user) {
      return NextResponse.json(
        { error: 'Usuario no encontrado' },
        { status: 404 }
      );
    }

    // Desactivar tarifas anteriores del mismo usuario
    await prisma.technicianCostRate.updateMany({
      where: {
        userId: parseInt(userId),
        companyId,
        isActive: true
      },
      data: {
        isActive: false,
        effectiveTo: new Date()
      }
    });

    // Crear nueva tarifa
    const rate = await prisma.technicianCostRate.create({
      data: {
        userId: parseInt(userId),
        companyId,
        hourlyRate: parseFloat(hourlyRate),
        overtimeRate: overtimeRate ? parseFloat(overtimeRate) : null,
        role: role || null,
        currency,
        effectiveFrom: new Date(effectiveFrom),
        isActive: true
      },
      include: {
        user: {
          select: { id: true, name: true, email: true }
        }
      }
    });

    return NextResponse.json({
      success: true,
      data: {
        id: rate.id,
        userId: rate.userId,
        userName: rate.user.name,
        hourlyRate: Number(rate.hourlyRate),
        overtimeRate: rate.overtimeRate ? Number(rate.overtimeRate) : null,
        role: rate.role,
        currency: rate.currency,
        isActive: rate.isActive,
        effectiveFrom: rate.effectiveFrom
      },
      message: `Tarifa creada para ${rate.user.name}: $${rate.hourlyRate}/hora`
    });

  } catch (error) {
    console.error('Error en POST /api/maintenance/costs/technician-rates:', error);
    return NextResponse.json(
      { error: 'Error al crear tarifa' },
      { status: 500 }
    );
  }
}
