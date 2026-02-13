import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePermission, VENTAS_PERMISSIONS } from '@/lib/ventas/auth';

// Configuración por defecto de productos
const DEFAULT_PRODUCT_CONFIG = {
  autoCostUpdate: true,
  weightedAverage: true,
  costHistory: true,
  marginAlerts: true,
  stockAlerts: true,
  priceLists: false,
  defaultMinMargin: 15,
  defaultAlertStockDays: 7,
};

// GET: Obtener configuración de productos
export async function GET(request: NextRequest) {
  try {
    const { user, error } = await requirePermission(VENTAS_PERMISSIONS.PRODUCTOS_VIEW);
    if (error) return error;

    const companyId = user!.companyId;

    // Buscar configuración existente
    const salesConfig = await prisma.salesConfig.findUnique({
      where: { companyId },
    });

    // Si tiene productConfig en JSON, usarlo, sino usar defaults
    const productConfig = salesConfig?.clientFormEnabledFields &&
      typeof salesConfig.clientFormEnabledFields === 'object' &&
      (salesConfig.clientFormEnabledFields as any).productConfig
      ? (salesConfig.clientFormEnabledFields as any).productConfig
      : DEFAULT_PRODUCT_CONFIG;

    // Obtener estadísticas de productos
    const stats = await prisma.product.groupBy({
      by: ['costType'],
      where: { companyId, isActive: true },
      _count: true,
    });

    const productStats = {
      total: 0,
      byType: {
        PRODUCTION: 0,
        PURCHASE: 0,
        MANUAL: 0,
      },
    };

    for (const stat of stats) {
      productStats.total += stat._count;
      if (stat.costType) {
        productStats.byType[stat.costType] = stat._count;
      }
    }

    return NextResponse.json({
      config: productConfig,
      stats: productStats,
    });
  } catch (error) {
    console.error('Error obteniendo config productos:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

// PUT: Actualizar configuración de productos
export async function PUT(request: NextRequest) {
  try {
    const { user, error } = await requirePermission(VENTAS_PERMISSIONS.PRODUCTOS_EDIT);
    if (error) return error;

    const companyId = user!.companyId;

    const body = await request.json();
    const { config } = body;

    if (!config || typeof config !== 'object') {
      return NextResponse.json({ error: 'Configuración inválida' }, { status: 400 });
    }

    // Obtener config actual
    const currentConfig = await prisma.salesConfig.findUnique({
      where: { companyId },
    });

    const currentFields = currentConfig?.clientFormEnabledFields &&
      typeof currentConfig.clientFormEnabledFields === 'object'
      ? currentConfig.clientFormEnabledFields as Record<string, any>
      : {};

    // Mezclar con la nueva configuración de productos
    const updatedFields = {
      ...currentFields,
      productConfig: {
        ...DEFAULT_PRODUCT_CONFIG,
        ...config,
      },
    };

    // Actualizar o crear
    await prisma.salesConfig.upsert({
      where: { companyId },
      update: {
        clientFormEnabledFields: updatedFields,
      },
      create: {
        companyId,
        clientFormEnabledFields: updatedFields,
      },
    });

    return NextResponse.json({
      success: true,
      config: updatedFields.productConfig,
    });
  } catch (error) {
    console.error('Error actualizando config productos:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
