/**
 * Centro de Costos V2 - Consolidador para Simulador / Rentabilidad
 *
 * Cruza datos de Producción + Indirectos (con distribución por categoría)
 * + Ventas para generar una vista unificada de costo y margen por producto.
 */

import { prisma } from '@/lib/prisma';
import { getProductionCostsForMonth } from './production';
import { getIndirectCostsForMonth } from './indirect';
import { getSalesForMonth } from './sales';

export interface ProductCalculatorRow {
  /** ID del CostProduct (producción) */
  productId: string;
  productName: string;
  /** ID de categoría de producto (product_categories) */
  categoryId: number | null;
  categoryName: string | null;

  // Producción
  unitsProduced: number;
  costMaterials: number;   // costo total de insumos del mes
  costMatPerUnit: number;  // costMaterials / unitsProduced

  // Indirectos distribuidos
  costIndirect: number;    // monto de indirectos asignado a este producto
  costIndPerUnit: number;

  // Total de costos reconocidos
  costTotal: number;
  costPerUnit: number;

  // Ventas
  unitsSold: number;
  revenueTotal: number;
  revenuePriceAvg: number; // precio promedio de venta por unidad

  // Márgenes
  grossMargin: number;     // revenueTotal - costTotal
  marginPercent: number;   // grossMargin / revenueTotal * 100

  // Flags
  hasRecipe: boolean;
  hasSales: boolean;
}

export interface CalculatorTotals {
  totalUnitsProduced: number;
  totalCostMaterials: number;
  totalCostIndirect: number;
  totalCostTotal: number;
  totalRevenue: number;
  totalGrossMargin: number;
  avgMarginPercent: number;
  /** Precio promedio ponderado de venta */
  avgSalePrice: number;
  /** Costo promedio ponderado por unidad */
  avgCostPerUnit: number;
}

export interface CalculatorData {
  month: string;
  products: ProductCalculatorRow[];
  totals: CalculatorTotals;
  /** Meses con datos de producción (para navegación) */
  availableMonths: string[];
  /** Advertencias (ej: producto sin receta, sin ventas) */
  warnings: string[];
}

/**
 * Consolida producción + indirectos + ventas en una vista por producto.
 *
 * Estrategia de cruce:
 * 1. Producción → byProduct[] (productId = CostProduct.id, productName)
 * 2. Indirectos → byCategory (total por IndirectCategory)
 * 3. IndirectDistributionConfig → % por (indirectCategory, productCategoryId)
 * 4. Ventas → byProduct[] (productName como clave de cruce con producción)
 *
 * El cruce producción↔ventas se hace por productName (normalizado a minúsculas)
 * porque el modelo CostProduct es independiente del modelo Product de ventas.
 */
export async function getCalculatorData(
  companyId: number,
  month: string
): Promise<CalculatorData> {
  const warnings: string[] = [];

  // 1. Obtener los tres datasets en paralelo
  const [production, indirect, sales, distributionConfigs, availableMonthsRaw] =
    await Promise.all([
      getProductionCostsForMonth(companyId, month),
      getIndirectCostsForMonth(companyId, month),
      getSalesForMonth(companyId, month),
      prisma.indirectDistributionConfig.findMany({
        where: { companyId },
        include: {
          productCategory: {
            select: { id: true, name: true }
          }
        }
      }),
      // Obtener meses disponibles de MonthlyProduction
      prisma.monthlyProduction.findMany({
        where: { companyId },
        select: { month: true },
        distinct: ['month'],
        orderBy: { month: 'desc' }
      })
    ]);

  const availableMonths = availableMonthsRaw.map((r) => r.month);

  // 2. Construir mapa: productCategoryId → cantidad producida del mes
  //    para poder distribuir indirectos proporcionalmente por categoría
  //
  // Para esto necesitamos saber qué categoría tiene cada CostProduct.
  // CostProduct → lineId → Line → no tiene categoryId directamente.
  // Usamos IndirectDistributionConfig.productCategoryId como referencia de categorías.
  // Luego cruzamos por productCategoryName con el nombre del producto de producción.
  //
  // Solución pragmática: leer CostProduct con su línea y categoría de producto
  // para cruzar contra IndirectDistributionConfig.
  const costProducts = await prisma.costProduct.findMany({
    where: {
      companyId,
      id: { in: production.byProduct.map((p) => p.productId) }
    },
    include: {
      line: {
        select: { id: true, name: true }
      }
    }
  });

  // Mapa: productId → { lineId, lineName }
  const productLineMap = new Map(
    costProducts.map((cp) => [cp.id, { lineId: cp.lineId, lineName: cp.line?.name ?? null }])
  );

  // 3. Distribuir costos indirectos por categoría de producto
  //
  // Cada IndirectDistributionConfig tiene:
  //   indirectCategory (UTILITIES, VEHICLES, ...) → percentage → productCategoryId
  //
  // Calculamos el monto de indirectos por productCategoryId:
  //   montoCategoria[catId] = Σ (indirect.byCategory[ic].total × config.percentage / 100)
  //
  // Luego necesitamos asignar ese monto entre los CostProducts de esa categoría
  // proporcionalmente a sus unidades producidas.
  //
  // PROBLEMA: CostProduct no tiene productCategoryId directamente.
  // SOLUCIÓN: Usamos el nombre de categoría guardado en IndirectDistributionConfig.productCategoryName
  // y lo mapeamos a los productos de producción por la categoría de línea.
  //
  // Para simplificar (y dado que el seed tiene categorías bien definidas), distribuimos
  // los indirectos de forma proporcional a unidades producidas entre TODOS los productos,
  // respetando el % que cada categoría tiene configurado.

  // Calcular total de indirectos por categoría de producto (product_categories)
  // distributionConfigs está agrupado por (indirectCategory, productCategoryId)
  const indirectByCatId = new Map<number, number>(); // productCategoryId → monto asignado

  for (const config of distributionConfigs) {
    const icTotal = indirect.byCategory[config.indirectCategory]?.total ?? 0;
    const amount = (icTotal * config.percentage) / 100;
    const prev = indirectByCatId.get(config.productCategoryId) ?? 0;
    indirectByCatId.set(config.productCategoryId, prev + amount);
  }

  // Si no hay configs de distribución, asignar indirectos uniformemente a todos los productos
  const totalIndirect = indirect.total;
  const noDistribution = distributionConfigs.length === 0;

  // 4. Mapear ventas por productName (normalizado)
  const salesByName = new Map<string, { quantity: number; revenue: number; cost: number }>();
  for (const ps of sales.byProduct) {
    const key = ps.productName.toLowerCase().trim();
    const existing = salesByName.get(key);
    if (existing) {
      existing.quantity += ps.quantity;
      existing.revenue += ps.revenue;
      existing.cost += ps.cost;
    } else {
      salesByName.set(key, {
        quantity: ps.quantity,
        revenue: ps.revenue,
        cost: ps.cost
      });
    }
  }

  // 5. Necesitamos las categorías de cada producto de producción para distribuir indirectos
  //    Leemos product_categories a través de IndirectDistributionConfig (ya cargado)
  //    Si hay distribución configurada, asignamos por categoría; si no, por partes iguales.

  // Para saber qué categoría tiene cada CostProduct necesitamos consulta adicional.
  // La relación en el schema: CostProduct → Line → (sin categoría directa)
  // Alternativa: leer product_categories y cruzar por nombre.
  // Como tenemos pocos productos, hacemos fetch simple.

  // Mapa: productCategoryName (lower) → productCategoryId
  const catNameToId = new Map<string, number>();
  for (const config of distributionConfigs) {
    catNameToId.set(config.productCategoryName.toLowerCase().trim(), config.productCategoryId);
  }

  // Intentar inferir categoría del producto desde su nombre o línea
  // (heurística: si el nombre del producto contiene el nombre de la categoría)
  // Para el seed: "Adoquín 20×10×6" → categoría "Adoquines", "Bloque Calcareo" → "Bloques"
  function inferCategoryId(productName: string): number | null {
    const nameLower = productName.toLowerCase();
    for (const [catName, catId] of catNameToId) {
      // Match parcial: si el nombre de la categoría está contenido en el producto
      // o viceversa (ej: "adoquines" dentro de "adoquín 20×10×6")
      const catSingular = catName.replace(/s$/, ''); // "adoquines" → "adoquine"
      if (nameLower.includes(catName) || nameLower.includes(catSingular)) {
        return catId;
      }
    }
    return null;
  }

  // 6. Construir rows por producto
  const totalProduced = production.byProduct.reduce((s, p) => s + p.quantity, 0);
  const rows: ProductCalculatorRow[] = [];

  for (const prod of production.byProduct) {
    const salesKey = prod.productName.toLowerCase().trim();
    const salesData = salesByName.get(salesKey);

    const unitsProduced = prod.quantity;
    const costMaterials = prod.inputCost;
    const costMatPerUnit = unitsProduced > 0 ? costMaterials / unitsProduced : 0;

    // Distribuir indirectos a este producto
    let costIndirect = 0;
    const inferredCatId = inferCategoryId(prod.productName);

    if (noDistribution) {
      // Sin configuración: distribuir uniformemente por unidades producidas
      costIndirect = totalProduced > 0
        ? (totalIndirect * unitsProduced) / totalProduced
        : 0;
    } else if (inferredCatId !== null) {
      // Hay distribución configurada y pudimos inferir la categoría
      const catTotal = indirectByCatId.get(inferredCatId) ?? 0;
      // Distribuir dentro de la categoría proporcionalmente a unidades producidas
      // Calcular total producido de productos de la misma categoría
      const sameCategory = production.byProduct.filter(
        (p) => inferCategoryId(p.productName) === inferredCatId
      );
      const catTotalUnits = sameCategory.reduce((s, p) => s + p.quantity, 0);
      costIndirect = catTotalUnits > 0
        ? (catTotal * unitsProduced) / catTotalUnits
        : 0;
    } else {
      // No hay distribución para esta categoría → distribuir por peso de unidades
      costIndirect = totalProduced > 0
        ? (totalIndirect * unitsProduced) / totalProduced
        : 0;
      warnings.push(`Producto "${prod.productName}" sin categoría configurada para distribución de indirectos`);
    }

    const costIndPerUnit = unitsProduced > 0 ? costIndirect / unitsProduced : 0;
    const costTotal = costMaterials + costIndirect;
    const costPerUnit = unitsProduced > 0 ? costTotal / unitsProduced : 0;

    const unitsSold = salesData?.quantity ?? 0;
    const revenueTotal = salesData?.revenue ?? 0;
    const revenuePriceAvg = unitsSold > 0 ? revenueTotal / unitsSold : 0;

    // Margen: ingreso de ventas vs costo de producción (full costing)
    // Usamos el costo por unidad × unidades vendidas para comparar con ingresos
    const costForSoldUnits = costPerUnit * unitsSold;
    const grossMargin = revenueTotal - costForSoldUnits;
    const marginPercent = revenueTotal > 0 ? (grossMargin / revenueTotal) * 100 : 0;

    if (!prod.hasRecipe) {
      warnings.push(`Producto "${prod.productName}" sin receta activa — costo de materiales = 0`);
    }

    rows.push({
      productId: prod.productId,
      productName: prod.productName,
      categoryId: inferredCatId,
      categoryName: inferredCatId
        ? (distributionConfigs.find((c) => c.productCategoryId === inferredCatId)?.productCategoryName ?? null)
        : null,
      unitsProduced,
      costMaterials,
      costMatPerUnit,
      costIndirect,
      costIndPerUnit,
      costTotal,
      costPerUnit,
      unitsSold,
      revenueTotal,
      revenuePriceAvg,
      grossMargin,
      marginPercent,
      hasRecipe: prod.hasRecipe,
      hasSales: !!salesData && salesData.revenue > 0
    });
  }

  // 7. Calcular totales
  const totalCostMaterials = rows.reduce((s, r) => s + r.costMaterials, 0);
  const totalCostIndirectDistrib = rows.reduce((s, r) => s + r.costIndirect, 0);
  const totalCostTotal = rows.reduce((s, r) => s + r.costTotal, 0);
  const totalRevenue = rows.reduce((s, r) => s + r.revenueTotal, 0);
  const totalGrossMargin = rows.reduce((s, r) => s + r.grossMargin, 0);
  const avgMarginPercent = totalRevenue > 0
    ? (totalGrossMargin / totalRevenue) * 100
    : 0;
  const totalUnitsSold = rows.reduce((s, r) => s + r.unitsSold, 0);
  const avgSalePrice = totalUnitsSold > 0 ? totalRevenue / totalUnitsSold : 0;
  const totalUnitsProduced = rows.reduce((s, r) => s + r.unitsProduced, 0);
  const avgCostPerUnit = totalUnitsProduced > 0 ? totalCostTotal / totalUnitsProduced : 0;

  // Advertir si hay ventas sin producción
  for (const sp of sales.byProduct) {
    const inProduction = rows.some(
      (r) => r.productName.toLowerCase().trim() === sp.productName.toLowerCase().trim()
    );
    if (!inProduction && sp.revenue > 0) {
      warnings.push(`Ventas de "${sp.productName}" sin producción registrada en el período`);
    }
  }

  return {
    month,
    products: rows.sort((a, b) => b.revenueTotal - a.revenueTotal),
    totals: {
      totalUnitsProduced,
      totalCostMaterials,
      totalCostIndirect: totalCostIndirectDistrib,
      totalCostTotal,
      totalRevenue,
      totalGrossMargin,
      avgMarginPercent,
      avgSalePrice,
      avgCostPerUnit
    },
    availableMonths,
    warnings
  };
}
