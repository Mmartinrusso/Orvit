import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePermission, VENTAS_PERMISSIONS } from '@/lib/ventas/auth';
import { DEFAULT_ENABLED_FEATURES, PRODUCT_FORM_FEATURES, countEnabledOptionalFeatures } from '@/lib/constants/product-form-features';

// GET: Obtener configuración del formulario de productos
export async function GET(request: NextRequest) {
  try {
    const { user, error } = await requirePermission(VENTAS_PERMISSIONS.PRODUCTOS_VIEW);
    if (error) return error;

    const companyId = user!.companyId;

    // Buscar configuración de ventas
    let salesConfig = await prisma.salesConfig.findUnique({
      where: { companyId },
      select: {
        productFormEnabledFields: true,
        maxProductFormFeatures: true,
      },
    });

    // Si no existe, crear con valores por defecto
    if (!salesConfig) {
      salesConfig = await prisma.salesConfig.create({
        data: {
          companyId,
          productFormEnabledFields: DEFAULT_ENABLED_FEATURES,
        },
        select: {
          productFormEnabledFields: true,
          maxProductFormFeatures: true,
        },
      });
    }

    // Asegurar que productFormEnabledFields sea un objeto válido
    const enabledFields = typeof salesConfig.productFormEnabledFields === 'object' && salesConfig.productFormEnabledFields !== null
      ? salesConfig.productFormEnabledFields as Record<string, boolean>
      : DEFAULT_ENABLED_FEATURES;

    // Calcular estadísticas
    const totalFeatures = PRODUCT_FORM_FEATURES.length;
    const coreFeatures = PRODUCT_FORM_FEATURES.filter(f => f.isCore).length;
    const optionalFeatures = totalFeatures - coreFeatures;
    const enabledOptional = countEnabledOptionalFeatures(enabledFields);

    return NextResponse.json({
      enabledFields,
      maxFeatures: salesConfig.maxProductFormFeatures,
      stats: {
        totalFeatures,
        coreFeatures,
        optionalFeatures,
        enabledOptional,
        remainingSlots: salesConfig.maxProductFormFeatures !== null
          ? Math.max(0, salesConfig.maxProductFormFeatures - enabledOptional)
          : null,
      },
      features: PRODUCT_FORM_FEATURES,
    });
  } catch (error) {
    console.error('Error obteniendo config formulario productos:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

// PUT: Actualizar configuración del formulario de productos
export async function PUT(request: NextRequest) {
  try {
    const { user, error } = await requirePermission(VENTAS_PERMISSIONS.PRODUCTOS_EDIT);
    if (error) return error;

    const companyId = user!.companyId;

    const body = await request.json();
    const { enabledFields, maxFeatures } = body;

    if (!enabledFields || typeof enabledFields !== 'object') {
      return NextResponse.json(
        { error: 'enabledFields es requerido y debe ser un objeto' },
        { status: 400 }
      );
    }

    // Validar que los features core no se deshabiliten
    const coreFeatures = PRODUCT_FORM_FEATURES.filter(f => f.isCore);
    for (const feature of coreFeatures) {
      enabledFields[feature.id] = true; // Forzar habilitación
    }

    // Obtener config actual para verificar límite
    const currentConfig = await prisma.salesConfig.findUnique({
      where: { companyId },
      select: { maxProductFormFeatures: true },
    });

    const maxAllowed = maxFeatures !== undefined ? maxFeatures : currentConfig?.maxProductFormFeatures;

    // Validar límite si existe
    if (maxAllowed !== null && maxAllowed !== undefined) {
      const enabledCount = countEnabledOptionalFeatures(enabledFields);
      if (enabledCount > maxAllowed) {
        return NextResponse.json(
          {
            error: `Excede el límite de funcionalidades (${enabledCount}/${maxAllowed})`,
            enabledCount,
            maxAllowed,
          },
          { status: 400 }
        );
      }
    }

    // Actualizar o crear configuración
    const updateData: any = {
      productFormEnabledFields: enabledFields,
    };

    // Solo el superadmin puede cambiar maxFeatures
    if (maxFeatures !== undefined && user!.role === 'SUPERADMIN') {
      updateData.maxProductFormFeatures = maxFeatures;
    }

    const salesConfig = await prisma.salesConfig.upsert({
      where: { companyId },
      update: updateData,
      create: {
        companyId,
        ...updateData,
      },
      select: {
        productFormEnabledFields: true,
        maxProductFormFeatures: true,
      },
    });

    const enabledFieldsResult = salesConfig.productFormEnabledFields as Record<string, boolean>;
    const enabledOptional = countEnabledOptionalFeatures(enabledFieldsResult);

    return NextResponse.json({
      success: true,
      enabledFields: enabledFieldsResult,
      maxFeatures: salesConfig.maxProductFormFeatures,
      stats: {
        enabledOptional,
        remainingSlots: salesConfig.maxProductFormFeatures !== null
          ? Math.max(0, salesConfig.maxProductFormFeatures - enabledOptional)
          : null,
      },
    });
  } catch (error) {
    console.error('Error actualizando config formulario productos:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
