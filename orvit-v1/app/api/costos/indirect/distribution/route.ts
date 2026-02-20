import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getIndirectCostsForMonth } from '@/lib/costs/integrations/indirect';

export const dynamic = 'force-dynamic';

const CATEGORY_LABELS: Record<string, string> = {
  IMP_SERV: 'Impuestos y Servicios',
  SOCIAL: 'Cargas Sociales',
  VEHICLES: 'Vehículos',
  MKT: 'Marketing',
  OTHER: 'Otros',
  UTILITIES: 'Servicios Públicos',
};

/**
 * GET /api/costos/indirect/distribution?month=YYYY-MM
 *
 * Devuelve la configuración de distribución + los totales reales del mes
 * aplicados a esa configuración.
 *
 * GET /api/costos/indirect/distribution
 * (sin month) → solo devuelve la configuración de distribución sin aplicar totales.
 */
export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;
    if (!token) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

    const payload = await verifyToken(token);
    if (!payload?.companyId) return NextResponse.json({ error: 'Token inválido' }, { status: 401 });

    const companyId = payload.companyId as number;
    const month = request.nextUrl.searchParams.get('month');

    // Traer configuraciones guardadas
    const configs = await prisma.indirectDistributionConfig.findMany({
      where: { companyId },
      orderBy: [{ indirectCategory: 'asc' }, { productCategoryName: 'asc' }],
    });

    // Si no se pidió mes, solo devolver la config
    if (!month || !/^\d{4}-\d{2}$/.test(month)) {
      return NextResponse.json({
        success: true,
        distributions: configs.map((c) => ({
          id: c.id,
          indirectCategory: c.indirectCategory,
          categoryLabel: CATEGORY_LABELS[c.indirectCategory] ?? c.indirectCategory,
          productCategoryId: c.productCategoryId,
          productCategoryName: c.productCategoryName,
          percentage: c.percentage,
        })),
      });
    }

    // Traer totales reales del mes
    const indirectData = await getIndirectCostsForMonth(companyId, month);

    // Construir resumen por categoría con distribución aplicada
    const allCategoryKeys = Object.keys(CATEGORY_LABELS);
    const categories = allCategoryKeys
      .map((key) => {
        const monthTotal = indirectData.byCategory[key]?.total ?? 0;
        const invoiceCount = indirectData.byCategory[key]?.count ?? 0;
        const categoryConfigs = configs.filter((c) => c.indirectCategory === key);

        const distributions = categoryConfigs.map((c) => ({
          id: c.id,
          productCategoryId: c.productCategoryId,
          productCategoryName: c.productCategoryName,
          percentage: c.percentage,
          allocatedAmount: Math.round((monthTotal * c.percentage) / 100),
        }));

        const totalPercent = distributions.reduce((sum, d) => sum + d.percentage, 0);

        return {
          key,
          label: CATEGORY_LABELS[key],
          monthTotal,
          invoiceCount,
          totalPercent,
          isConfigured: categoryConfigs.length > 0,
          distributions,
        };
      })
      .filter((c) => c.monthTotal > 0 || c.isConfigured); // Solo mostrar categorías con datos o configuración

    const totalIndirect = indirectData.total;
    const totalAllocated = categories.reduce(
      (sum, c) =>
        sum + c.distributions.reduce((s, d) => s + d.allocatedAmount, 0),
      0
    );

    return NextResponse.json({
      success: true,
      month,
      categories,
      totalIndirect,
      totalAllocated,
    });
  } catch (error) {
    console.error('Error en distribución de costos indirectos:', error);
    return NextResponse.json({ error: 'Error al obtener distribución' }, { status: 500 });
  }
}

/**
 * POST /api/costos/indirect/distribution
 *
 * Body: { distributions: Array<{
 *   indirectCategory: string,
 *   productCategoryId: number,
 *   productCategoryName: string,
 *   percentage: number
 * }> }
 *
 * Upsert completo: reemplaza toda la config de la empresa.
 * Valida que los porcentajes por categoría sumen <= 100.
 */
export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;
    if (!token) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

    const payload = await verifyToken(token);
    if (!payload?.companyId) return NextResponse.json({ error: 'Token inválido' }, { status: 401 });

    const companyId = payload.companyId as number;
    const body = await request.json();
    const { distributions } = body as {
      distributions: Array<{
        indirectCategory: string;
        productCategoryId: number;
        productCategoryName: string;
        percentage: number;
      }>;
    };

    if (!Array.isArray(distributions)) {
      return NextResponse.json({ error: 'distributions debe ser un array' }, { status: 400 });
    }

    // Validar que los porcentajes por categoría no superen 100
    const byCategory: Record<string, number> = {};
    for (const d of distributions) {
      byCategory[d.indirectCategory] = (byCategory[d.indirectCategory] ?? 0) + d.percentage;
    }
    const overflowCategories = Object.entries(byCategory)
      .filter(([, total]) => total > 100.01)
      .map(([key]) => CATEGORY_LABELS[key] ?? key);

    if (overflowCategories.length > 0) {
      return NextResponse.json(
        { error: `Los porcentajes superan 100% en: ${overflowCategories.join(', ')}` },
        { status: 400 }
      );
    }

    // Upsert: borrar configs existentes y recrear
    await prisma.$transaction([
      prisma.indirectDistributionConfig.deleteMany({ where: { companyId } }),
      prisma.indirectDistributionConfig.createMany({
        data: distributions
          .filter((d) => d.percentage > 0)
          .map((d) => ({
            companyId,
            indirectCategory: d.indirectCategory as any,
            productCategoryId: d.productCategoryId,
            productCategoryName: d.productCategoryName,
            percentage: d.percentage,
          })),
      }),
    ]);

    return NextResponse.json({ success: true, saved: distributions.filter((d) => d.percentage > 0).length });
  } catch (error) {
    console.error('Error guardando distribución de costos indirectos:', error);
    return NextResponse.json({ error: 'Error al guardar distribución' }, { status: 500 });
  }
}
