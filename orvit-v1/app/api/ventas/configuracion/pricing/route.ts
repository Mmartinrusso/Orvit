import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePermission, VENTAS_PERMISSIONS } from '@/lib/ventas/auth';

// GET: Obtener configuración de pricing
export async function GET(request: NextRequest) {
  try {
    const { user, error } = await requirePermission(VENTAS_PERMISSIONS.CONFIG_VIEW);
    if (error) return error;

    const companyId = user!.companyId;

    // Buscar configuración de ventas
    let salesConfig = await prisma.salesConfig.findUnique({
      where: { companyId },
      select: {
        pricingMethod: true,
        showCostsInQuotes: true,
        showMarginsInQuotes: true,
      },
    });

    // Si no existe, crear con valores por defecto
    if (!salesConfig) {
      salesConfig = await prisma.salesConfig.create({
        data: {
          companyId,
          pricingMethod: 'LIST',
          showCostsInQuotes: false,
          showMarginsInQuotes: false,
        },
        select: {
          pricingMethod: true,
          showCostsInQuotes: true,
          showMarginsInQuotes: true,
        },
      });
    }

    return NextResponse.json({
      config: {
        pricingMethod: salesConfig.pricingMethod || 'LIST',
        showCostsInQuotes: salesConfig.showCostsInQuotes || false,
        showMarginsInQuotes: salesConfig.showMarginsInQuotes || false,
      },
    });
  } catch (error) {
    console.error('Error obteniendo config de pricing:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

// PUT: Actualizar configuración de pricing
export async function PUT(request: NextRequest) {
  try {
    const { user, error } = await requirePermission(VENTAS_PERMISSIONS.CONFIG_EDIT);
    if (error) return error;

    const companyId = user!.companyId;

    const body = await request.json();
    const { config } = body;

    if (!config || typeof config !== 'object') {
      return NextResponse.json(
        { error: 'config es requerido y debe ser un objeto' },
        { status: 400 }
      );
    }

    const { pricingMethod, showCostsInQuotes, showMarginsInQuotes } = config;

    // Validar pricing method
    if (pricingMethod && !['LIST', 'MARGIN', 'DISCOUNT'].includes(pricingMethod)) {
      return NextResponse.json(
        { error: 'pricingMethod debe ser LIST, MARGIN o DISCOUNT' },
        { status: 400 }
      );
    }

    // Si el método es LIST o DISCOUNT, forzar ocultar costos y márgenes
    const updateData: any = {
      pricingMethod: pricingMethod || 'LIST',
    };

    if (pricingMethod === 'LIST' || pricingMethod === 'DISCOUNT') {
      updateData.showCostsInQuotes = false;
      updateData.showMarginsInQuotes = false;
    } else {
      updateData.showCostsInQuotes = showCostsInQuotes !== undefined ? showCostsInQuotes : false;
      updateData.showMarginsInQuotes = showMarginsInQuotes !== undefined ? showMarginsInQuotes : false;
    }

    // Actualizar o crear configuración
    const salesConfig = await prisma.salesConfig.upsert({
      where: { companyId },
      update: updateData,
      create: {
        companyId,
        ...updateData,
      },
      select: {
        pricingMethod: true,
        showCostsInQuotes: true,
        showMarginsInQuotes: true,
      },
    });

    return NextResponse.json({
      success: true,
      config: {
        pricingMethod: salesConfig.pricingMethod,
        showCostsInQuotes: salesConfig.showCostsInQuotes,
        showMarginsInQuotes: salesConfig.showMarginsInQuotes,
      },
    });
  } catch (error) {
    console.error('Error actualizando config de pricing:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
