import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

/**
 * GET /api/costos/config
 *
 * Obtiene la configuración actual del sistema de costos para la empresa.
 */
export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;

    if (!token) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }

    const payload = await verifyToken(token);
    if (!payload) {
      return NextResponse.json({ error: 'Token inválido' }, { status: 401 });
    }

    // Check role for SUPERADMIN access
    const userRole = (payload.role as string)?.toUpperCase();
    const isSuperAdmin = userRole === 'SUPERADMIN';

    // Allow query param companyId to override (useful for different company context)
    const queryCompanyId = request.nextUrl.searchParams.get('companyId');

    // SUPERADMIN can access any company's config via queryCompanyId
    // Regular users must have companyId in their token
    let companyId: number;
    if (queryCompanyId) {
      // If SUPERADMIN, allow accessing any company
      if (isSuperAdmin) {
        companyId = parseInt(queryCompanyId);
      } else if (payload.companyId) {
        // Non-SUPERADMIN can only access their own company
        companyId = payload.companyId as number;
      } else {
        return NextResponse.json({ error: 'Sin acceso a empresa' }, { status: 401 });
      }
    } else if (payload.companyId) {
      companyId = payload.companyId as number;
    } else if (isSuperAdmin) {
      // SUPERADMIN without queryCompanyId - return error asking for companyId
      return NextResponse.json({ error: 'SUPERADMIN debe especificar companyId' }, { status: 400 });
    } else {
      return NextResponse.json({ error: 'Sin empresa asociada' }, { status: 401 });
    }

    // Obtener o crear configuración
    let config = await prisma.costSystemConfig.findUnique({
      where: { companyId }
    });

    if (!config) {
      config = await prisma.costSystemConfig.create({
        data: {
          companyId,
          version: 'V1',
          usePayrollData: false,
          useComprasData: false,
          useVentasData: false,
          useProdData: false,
          useIndirectData: false,
          useMaintData: false,
          enablePretensadosSim: false
        }
      });
    }

    // Return flattened response for easier access
    return NextResponse.json({
      success: true,
      ...config,
      config // Also keep full config for backwards compatibility
    });

  } catch (error) {
    console.error('Error obteniendo configuración de costos:', error);
    return NextResponse.json(
      { error: 'Error al obtener configuración' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/costos/config
 *
 * Actualiza la configuración del sistema de costos.
 */
export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;

    if (!token) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }

    const payload = await verifyToken(token);
    if (!payload) {
      return NextResponse.json({ error: 'Token inválido' }, { status: 401 });
    }

    // Verificar permisos (solo admin puede cambiar configuración)
    const userRole = (payload.role as string)?.toUpperCase();
    const isSuperAdmin = userRole === 'SUPERADMIN';
    const isAdmin = userRole === 'ADMIN' || isSuperAdmin || userRole?.includes('ADMIN');
    if (!isAdmin) {
      return NextResponse.json(
        { error: 'Solo administradores pueden modificar la configuración' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const {
      version,
      usePayrollData,
      useComprasData,
      useVentasData,
      useProdData,
      useIndirectData,
      useMaintData,
      enablePretensadosSim,
      targetCompanyId // For superadmin to update other company's config
    } = body;

    // Determine the company ID to update
    // SUPERADMIN must provide targetCompanyId if they don't have a companyId in token
    let finalCompanyId: number;
    if (isSuperAdmin && targetCompanyId) {
      finalCompanyId = parseInt(targetCompanyId);
    } else if (payload.companyId) {
      finalCompanyId = payload.companyId as number;
    } else if (isSuperAdmin) {
      return NextResponse.json(
        { error: 'SUPERADMIN debe especificar targetCompanyId' },
        { status: 400 }
      );
    } else {
      return NextResponse.json({ error: 'Sin empresa asociada' }, { status: 401 });
    }

    // Validar version si se proporciona
    if (version && !['V1', 'V2', 'HYBRID'].includes(version)) {
      return NextResponse.json(
        { error: 'Versión inválida. Use V1, V2 o HYBRID' },
        { status: 400 }
      );
    }

    // Construir datos de actualización
    const updateData: any = {
      updatedAt: new Date()
    };

    if (version !== undefined) {
      updateData.version = version;

      // Si se activa V2 o HYBRID por primera vez, registrar fecha
      if ((version === 'V2' || version === 'HYBRID')) {
        const currentConfig = await prisma.costSystemConfig.findUnique({
          where: { companyId: finalCompanyId }
        });

        if (currentConfig?.version === 'V1' && !currentConfig?.v2EnabledAt) {
          updateData.v2EnabledAt = new Date();
        }
      }
    }

    if (usePayrollData !== undefined) updateData.usePayrollData = usePayrollData;
    if (useComprasData !== undefined) updateData.useComprasData = useComprasData;
    if (useVentasData !== undefined) updateData.useVentasData = useVentasData;
    if (useProdData !== undefined) updateData.useProdData = useProdData;
    if (useIndirectData !== undefined) updateData.useIndirectData = useIndirectData;
    if (useMaintData !== undefined) updateData.useMaintData = useMaintData;

    // enablePretensadosSim solo puede ser modificado por SUPERADMIN
    if (enablePretensadosSim !== undefined && isSuperAdmin) {
      updateData.enablePretensadosSim = enablePretensadosSim;
    }

    // Actualizar o crear configuración
    const config = await prisma.costSystemConfig.upsert({
      where: { companyId: finalCompanyId },
      create: {
        companyId: finalCompanyId,
        version: version || 'V1',
        usePayrollData: usePayrollData ?? false,
        useComprasData: useComprasData ?? false,
        useVentasData: useVentasData ?? false,
        useProdData: useProdData ?? false,
        useIndirectData: useIndirectData ?? false,
        useMaintData: useMaintData ?? false,
        enablePretensadosSim: (isSuperAdmin && enablePretensadosSim) ?? false
      },
      update: updateData
    });

    return NextResponse.json({
      success: true,
      message: 'Configuración actualizada',
      config
    });

  } catch (error) {
    console.error('Error actualizando configuración de costos:', error);
    return NextResponse.json(
      { error: 'Error al actualizar configuración' },
      { status: 500 }
    );
  }
}
