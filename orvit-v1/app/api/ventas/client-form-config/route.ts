import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePermission, VENTAS_PERMISSIONS } from '@/lib/ventas/auth';
import { DEFAULT_ENABLED_FEATURES, CLIENT_FORM_FEATURES, countEnabledOptionalFeatures } from '@/lib/constants/client-form-features';

// GET: Obtener configuración del formulario de clientes
export async function GET(request: NextRequest) {
  try {
    const { user, error } = await requirePermission(VENTAS_PERMISSIONS.CLIENTES_VIEW);
    if (error) return error;

    const companyId = user!.companyId;

    // Buscar configuración de ventas
    let salesConfig = await prisma.salesConfig.findUnique({
      where: { companyId },
      select: {
        clientFormEnabledFields: true,
        maxClientFormFeatures: true,
      },
    });

    // Si no existe, crear con valores por defecto
    if (!salesConfig) {
      salesConfig = await prisma.salesConfig.create({
        data: {
          companyId,
          clientFormEnabledFields: DEFAULT_ENABLED_FEATURES,
        },
        select: {
          clientFormEnabledFields: true,
          maxClientFormFeatures: true,
        },
      });
    }

    // Asegurar que clientFormEnabledFields sea un objeto válido
    const enabledFields = typeof salesConfig.clientFormEnabledFields === 'object' && salesConfig.clientFormEnabledFields !== null
      ? salesConfig.clientFormEnabledFields as Record<string, boolean>
      : DEFAULT_ENABLED_FEATURES;

    // Calcular estadísticas
    const totalFeatures = CLIENT_FORM_FEATURES.length;
    const coreFeatures = CLIENT_FORM_FEATURES.filter(f => f.isCore).length;
    const optionalFeatures = totalFeatures - coreFeatures;
    const enabledOptional = countEnabledOptionalFeatures(enabledFields);

    return NextResponse.json({
      enabledFields,
      maxFeatures: salesConfig.maxClientFormFeatures,
      stats: {
        totalFeatures,
        coreFeatures,
        optionalFeatures,
        enabledOptional,
        remainingSlots: salesConfig.maxClientFormFeatures !== null
          ? Math.max(0, salesConfig.maxClientFormFeatures - enabledOptional)
          : null,
      },
      features: CLIENT_FORM_FEATURES,
    });
  } catch (error) {
    console.error('Error obteniendo config formulario clientes:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

// PUT: Actualizar configuración del formulario de clientes
export async function PUT(request: NextRequest) {
  try {
    const { user, error } = await requirePermission(VENTAS_PERMISSIONS.CLIENTES_EDIT);
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
    const coreFeatures = CLIENT_FORM_FEATURES.filter(f => f.isCore);
    for (const feature of coreFeatures) {
      enabledFields[feature.id] = true; // Forzar habilitación
    }

    // Obtener config actual para verificar límite
    const currentConfig = await prisma.salesConfig.findUnique({
      where: { companyId },
      select: { maxClientFormFeatures: true },
    });

    const maxAllowed = maxFeatures !== undefined ? maxFeatures : currentConfig?.maxClientFormFeatures;

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
      clientFormEnabledFields: enabledFields,
    };

    // Solo el superadmin puede cambiar maxFeatures
    if (maxFeatures !== undefined && user!.role === 'SUPERADMIN') {
      updateData.maxClientFormFeatures = maxFeatures;
    }

    const salesConfig = await prisma.salesConfig.upsert({
      where: { companyId },
      update: updateData,
      create: {
        companyId,
        ...updateData,
      },
      select: {
        clientFormEnabledFields: true,
        maxClientFormFeatures: true,
      },
    });

    const enabledFieldsResult = salesConfig.clientFormEnabledFields as Record<string, boolean>;
    const enabledOptional = countEnabledOptionalFeatures(enabledFieldsResult);

    return NextResponse.json({
      success: true,
      enabledFields: enabledFieldsResult,
      maxFeatures: salesConfig.maxClientFormFeatures,
      stats: {
        enabledOptional,
        remainingSlots: salesConfig.maxClientFormFeatures !== null
          ? Math.max(0, salesConfig.maxClientFormFeatures - enabledOptional)
          : null,
      },
    });
  } catch (error) {
    console.error('Error actualizando config formulario clientes:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
