/**
 * API de Feriados
 *
 * GET  /api/payroll/holidays - Listar feriados
 * POST /api/payroll/holidays - Crear feriado
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getPayrollAuthUser } from '@/lib/payroll/auth-helper';

export const dynamic = 'force-dynamic';

// GET - Listar feriados
export async function GET(request: NextRequest) {
  try {
    const user = await getPayrollAuthUser();
    if (!user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const year = searchParams.get('year')
      ? parseInt(searchParams.get('year')!)
      : new Date().getFullYear();

    // Obtener feriados del año
    const startDate = new Date(year, 0, 1);
    const endDate = new Date(year, 11, 31);

    const holidays = await prisma.companyHoliday.findMany({
      where: {
        company_id: user.companyId,
        date: {
          gte: startDate,
          lte: endDate,
        },
      },
      orderBy: { date: 'asc' },
    });

    return NextResponse.json({
      holidays: holidays.map((h) => ({
        id: h.id,
        date: h.date,
        name: h.name,
        isNational: h.is_national,
      })),
    });
  } catch (error) {
    console.error('Error obteniendo feriados:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}

// POST - Crear feriado
export async function POST(request: NextRequest) {
  try {
    const user = await getPayrollAuthUser();
    if (!user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const body = await request.json();
    const { date, name, isNational = true } = body;

    if (!date || !name) {
      return NextResponse.json({ error: 'date y name son requeridos' }, { status: 400 });
    }

    const holiday = await prisma.companyHoliday.create({
      data: {
        company_id: user.companyId,
        date: new Date(date),
        name,
        is_national: isNational,
      },
    });

    return NextResponse.json({
      success: true,
      holiday: {
        id: holiday.id,
        date: holiday.date,
        name: holiday.name,
        isNational: holiday.is_national,
      },
    });
  } catch (error: any) {
    if (error.code === 'P2002') {
      return NextResponse.json({ error: 'Ya existe un feriado en esa fecha' }, { status: 400 });
    }
    console.error('Error creando feriado:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}

// DELETE - Eliminar feriado (usando query param)
export async function DELETE(request: NextRequest) {
  try {
    const user = await getPayrollAuthUser();
    if (!user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'id es requerido' }, { status: 400 });
    }

    await prisma.companyHoliday.delete({
      where: {
        id: parseInt(id),
        company_id: user.companyId,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error eliminando feriado:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
