import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';
import { cached, invalidateCache } from '@/lib/cache/cache-manager';
import { companyKeys, TTL } from '@/lib/cache/cache-keys';

export const dynamic = 'force-dynamic';

const UpdateCompanySettingsSchema = z.object({
  batchLabel: z.string().min(1, 'Etiqueta de lote requerida').max(20, 'Etiqueta muy larga').optional(),
  intermediateLabel: z.string().min(1, 'Etiqueta intermedia requerida').max(20, 'Etiqueta muy larga').optional(),
  currency: z.string().min(1, 'Moneda requerida').max(10, 'Moneda muy larga').optional(),
});

// GET /api/company/settings - Obtener configuración de la empresa
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get('companyId');

    if (!companyId) {
      return NextResponse.json(
        { error: 'companyId requerido' },
        { status: 400 }
      );
    }

    const companyIdNum = parseInt(companyId);
    const cacheKey = companyKeys.settings(companyIdNum);

    const company = await prisma.company.findUnique({
      where: { id: companyIdNum },
    });

    if (!company) {
      return NextResponse.json(
        { error: 'Empresa no encontrada' },
        { status: 404 }
      );
    }

    const result = await cached(cacheKey, async () => {
      const companyWithSettings = await prisma.company.findUnique({
        where: { id: companyIdNum },
        include: {
          settings: true,
        },
      });

      // Si no tiene settings, crearlos con valores por defecto
      let settings = companyWithSettings!.settings;
      if (!settings) {
        settings = await prisma.companySettings.create({
          data: {
            companyId: companyIdNum,
            batchLabel: 'batea',
            intermediateLabel: 'placa',
            currency: 'ARS',
          },
        });
      }

      return {
        company: {
          id: companyIdNum,
          name: companyWithSettings!.name,
        },
        settings,
      };
    }, TTL.LONG); // 15 min - configuración cambia poco

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error fetching company settings:', error);
    return NextResponse.json(
      { error: 'Error al obtener configuración de empresa' },
      { status: 500 }
    );
  }
}

// PUT /api/company/settings - Actualizar configuración de la empresa
export async function PUT(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get('companyId');

    if (!companyId) {
      return NextResponse.json(
        { error: 'companyId requerido' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const validatedData = UpdateCompanySettingsSchema.parse(body);

    // Verificar que la empresa existe
    const company = await prisma.company.findUnique({
      where: { id: parseInt(companyId) },
    });

    if (!company) {
      return NextResponse.json(
        { error: 'Empresa no encontrada' },
        { status: 404 }
      );
    }

    // Upsert settings
    const settings = await prisma.companySettings.upsert({
      where: { companyId: company.id },
      update: validatedData,
      create: {
        companyId: company.id,
        batchLabel: validatedData.batchLabel || 'batea',
        intermediateLabel: validatedData.intermediateLabel || 'placa',
        currency: validatedData.currency || 'ARS',
      },
    });

    // Invalidar caché de settings
    await invalidateCache([companyKeys.settings(company.id)]);

    return NextResponse.json({
      company: {
        id: company.id,
        name: company.name,
      },
      settings,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Datos inválidos', details: error.errors },
        { status: 400 }
      );
    }

    console.error('Error updating company settings:', error);
    return NextResponse.json(
      { error: 'Error al actualizar configuración de empresa' },
      { status: 500 }
    );
  }
}
