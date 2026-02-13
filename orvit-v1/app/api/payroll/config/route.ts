/**
 * API de Configuración de Nóminas
 *
 * GET  /api/payroll/config - Obtener configuración
 * POST /api/payroll/config - Crear/actualizar configuración
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getPayrollAuthUser } from '@/lib/payroll/auth-helper';

export const dynamic = 'force-dynamic';

// GET - Obtener configuración de nómina
export async function GET(request: NextRequest) {
  try {
    const user = await getPayrollAuthUser();
    if (!user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const companyId = user.companyId;

    // Obtener configuración
    const config = await prisma.payrollConfig.findUnique({
      where: { company_id: companyId },
    });

    // Si no existe, retornar valores por defecto
    if (!config) {
      return NextResponse.json({
        exists: false,
        config: {
          companyId,
          paymentFrequency: 'BIWEEKLY',
          firstPaymentDay: 15,
          secondPaymentDay: 30,
          quincenaPercentage: 50,
          paymentDayRule: 'PREVIOUS_BUSINESS_DAY',
          maxAdvancePercent: 30,
          maxActiveAdvances: 1,
        },
      });
    }

    return NextResponse.json({
      exists: true,
      config: {
        id: config.id,
        companyId: config.company_id,
        paymentFrequency: config.payment_frequency,
        firstPaymentDay: config.first_payment_day,
        secondPaymentDay: config.second_payment_day,
        quincenaPercentage: Number(config.quincena_percentage),
        paymentDayRule: config.payment_day_rule,
        maxAdvancePercent: Number(config.max_advance_percent),
        maxActiveAdvances: config.max_active_advances,
        createdAt: config.created_at,
        updatedAt: config.updated_at,
      },
    });
  } catch (error) {
    console.error('Error obteniendo config de nómina:', error);
    console.error('Error stack:', error instanceof Error ? error.stack : 'No stack');
    return NextResponse.json({
      error: 'Error interno del servidor'
    }, { status: 500 });
  }
}

// POST - Crear o actualizar configuración
export async function POST(request: NextRequest) {
  try {
    const user = await getPayrollAuthUser();
    if (!user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const companyId = user.companyId;

    const body = await request.json();

    // Validar datos
    const {
      paymentFrequency = 'BIWEEKLY',
      firstPaymentDay = 15,
      secondPaymentDay = 30,
      quincenaPercentage = 50,
      paymentDayRule = 'PREVIOUS_BUSINESS_DAY',
      maxAdvancePercent = 30,
      maxActiveAdvances = 1,
    } = body;

    // Validaciones
    if (!['MONTHLY', 'BIWEEKLY'].includes(paymentFrequency)) {
      return NextResponse.json(
        { error: 'paymentFrequency debe ser MONTHLY o BIWEEKLY' },
        { status: 400 }
      );
    }

    if (firstPaymentDay < 1 || firstPaymentDay > 31) {
      return NextResponse.json(
        { error: 'firstPaymentDay debe estar entre 1 y 31' },
        { status: 400 }
      );
    }

    if (secondPaymentDay < 1 || secondPaymentDay > 31) {
      return NextResponse.json(
        { error: 'secondPaymentDay debe estar entre 1 y 31' },
        { status: 400 }
      );
    }

    if (quincenaPercentage < 0 || quincenaPercentage > 100) {
      return NextResponse.json(
        { error: 'quincenaPercentage debe estar entre 0 y 100' },
        { status: 400 }
      );
    }

    // Upsert configuración
    const config = await prisma.payrollConfig.upsert({
      where: { company_id: companyId },
      create: {
        company_id: companyId,
        payment_frequency: paymentFrequency,
        first_payment_day: firstPaymentDay,
        second_payment_day: secondPaymentDay,
        quincena_percentage: quincenaPercentage,
        payment_day_rule: paymentDayRule,
        max_advance_percent: maxAdvancePercent,
        max_active_advances: maxActiveAdvances,
      },
      update: {
        payment_frequency: paymentFrequency,
        first_payment_day: firstPaymentDay,
        second_payment_day: secondPaymentDay,
        quincena_percentage: quincenaPercentage,
        payment_day_rule: paymentDayRule,
        max_advance_percent: maxAdvancePercent,
        max_active_advances: maxActiveAdvances,
      },
    });

    return NextResponse.json({
      success: true,
      config: {
        id: config.id,
        companyId: config.company_id,
        paymentFrequency: config.payment_frequency,
        firstPaymentDay: config.first_payment_day,
        secondPaymentDay: config.second_payment_day,
        quincenaPercentage: Number(config.quincena_percentage),
        paymentDayRule: config.payment_day_rule,
        maxAdvancePercent: Number(config.max_advance_percent),
        maxActiveAdvances: config.max_active_advances,
      },
    });
  } catch (error) {
    console.error('Error guardando config de nómina:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
