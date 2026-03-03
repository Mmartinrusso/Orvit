/**
 * Centro de Costos V2 - Integración con Costos Indirectos
 *
 * V2: Lee las facturas de Compras marcadas como "esIndirecto = true".
 * La clasificación (IndirectCategory) se elige por factura al momento de cargarla.
 */

import { prisma } from '@/lib/prisma';
import { Decimal } from '@prisma/client/runtime/library';

export interface ItemAggregate {
  supplierItemId: number;
  nombre: string;
  category: string;
  amount: number;
  count: number;
}

export interface IndirectCostData {
  total: number;
  itemCount: number;
  byCategory: Record<string, CategorySummary>;
  details: IndirectDetail[];
  /** Items de proveedores marcados como esGastoIndirecto, sumados por item+categoría en el mes */
  itemAggregates: Record<string, ItemAggregate[]>;
}

export interface CategorySummary {
  total: number;
  count: number;
  items: IndirectDetail[];
}

export interface IndirectConcept {
  id: number;
  descripcion: string;
  monto: number;
}

export interface IndirectDetail {
  id: string;
  category: string;
  label: string;
  amount: number;
  // Campos legacy (compatibilidad con IndirectViewV2 existente)
  itemId: string | null;
  itemCode: string | null;
  quantity: number | null;
  servicePrice: number | null;
  // Campos nuevos desde Compras
  sourceType: 'COMPRAS';
  receiptId: number;
  facturaNumero: string;
  fechaEmision: string | null;
  proveedorNombre: string;
  // Conceptos del gasto (items con itemId=null)
  conceptos: IndirectConcept[];
  // Prorrateo
  prorratear: boolean;
  prorrateoMeses: number | null;
  montoTotal: number; // monto original sin prorratear
}

// Mapeo de categorías a nombres legibles
const CATEGORY_LABELS: Record<string, string> = {
  IMP_SERV: 'Impuestos y Servicios',
  SOCIAL: 'Cargas Sociales',
  VEHICLES: 'Vehículos',
  MKT: 'Marketing',
  OTHER: 'Otros',
  UTILITIES: 'Servicios Públicos'
};

/**
 * Obtiene los costos indirectos para un mes específico.
 * Lee facturas de Compras marcadas como esIndirecto=true con fechaEmision en el mes indicado.
 *
 * @param companyId - ID de la empresa
 * @param month - Mes en formato "YYYY-MM" (ej: "2026-01")
 */
export async function getIndirectCostsForMonth(
  companyId: number,
  month: string
): Promise<IndirectCostData> {
  const [year, monthNum] = month.split('-').map(Number);
  const startOfMonth = new Date(year, monthNum - 1, 1);
  const endOfMonth = new Date(year, monthNum, 0, 23, 59, 59, 999);

  const includeConfig = {
    proveedor: {
      select: { id: true, name: true, razon_social: true }
    },
    items: {
      select: {
        id: true,
        descripcion: true,
        precioUnitario: true,
        cantidad: true,
        itemId: true,
        subtotal: true,
        supplierItem: {
          select: { id: true, nombre: true, esGastoIndirecto: true, categoriaIndirecta: true }
        }
      },
      orderBy: { id: 'asc' as const },
    },
  };

  // Query 1: comprobantes normales (no prorrateados) cuya fechaEmision cae en el mes
  const normalReceipts = await prisma.purchaseReceipt.findMany({
    where: {
      companyId,
      esIndirecto: true,
      prorratear: false,
      fechaEmision: { gte: startOfMonth, lte: endOfMonth }
    },
    include: includeConfig,
    orderBy: [{ indirectCategory: 'asc' }, { fechaEmision: 'asc' }]
  });

  // Query 2: comprobantes prorrateados cuyo período cubre el mes consultado
  const candidatosProrrateo = await prisma.purchaseReceipt.findMany({
    where: {
      companyId,
      esIndirecto: true,
      prorratear: true,
      prorrateoFechaInicio: { lte: endOfMonth }
    },
    include: includeConfig,
    orderBy: [{ indirectCategory: 'asc' }, { fechaEmision: 'asc' }]
  });

  // Filtrar solo los que todavía están dentro del período de prorrateo
  const prorrateoReceipts = candidatosProrrateo.filter(r => {
    if (!r.prorrateoFechaInicio || !r.prorrateoMeses) return false;
    const inicio = new Date(r.prorrateoFechaInicio);
    const fin = new Date(inicio.getFullYear(), inicio.getMonth() + r.prorrateoMeses, 0, 23, 59, 59, 999);
    return fin >= startOfMonth;
  });

  const receipts = [...normalReceipts, ...prorrateoReceipts];

  if (receipts.length === 0) {
    return {
      total: 0,
      itemCount: 0,
      byCategory: {},
      details: [],
      itemAggregates: {}
    };
  }

  let total = 0;
  const byCategory: Record<string, CategorySummary> = {};
  const details: IndirectDetail[] = [];

  for (const receipt of receipts) {
    // Si está prorrateado, el monto del mes es neto / cantidad de meses
    const netoTotal = toNumber(receipt.neto);
    const amount = receipt.prorratear && receipt.prorrateoMeses
      ? Math.round((netoTotal / receipt.prorrateoMeses) * 100) / 100
      : netoTotal;
    const category = receipt.indirectCategory ?? 'OTHER';

    const proveedorNombre = receipt.proveedor.razon_social || receipt.proveedor.name;
    const detail: IndirectDetail = {
      id: String(receipt.id),
      category,
      label: proveedorNombre,
      amount,
      // Campos legacy en null (esta fuente no los usa)
      itemId: null,
      itemCode: null,
      quantity: null,
      servicePrice: null,
      // Campos Compras
      sourceType: 'COMPRAS',
      receiptId: receipt.id,
      facturaNumero: `${receipt.numeroSerie ?? ''}-${receipt.numeroFactura ?? ''}`.replace(/^-|-$/, ''),
      fechaEmision: receipt.fechaEmision
        ? receipt.fechaEmision.toISOString().split('T')[0]
        : null,
      proveedorNombre,
      prorratear: receipt.prorratear,
      prorrateoMeses: receipt.prorrateoMeses,
      montoTotal: netoTotal,
      // Conceptos: items con itemId=null (descriptivos, sin supply vinculado)
      conceptos: receipt.items
        .filter(it => it.itemId === null)
        .map(it => ({
          id: it.id,
          descripcion: it.descripcion ?? '',
          monto: toNumber(it.precioUnitario) * toNumber(it.cantidad),
        })),
    };

    details.push(detail);
    total += amount;

    if (!byCategory[category]) {
      byCategory[category] = { total: 0, count: 0, items: [] };
    }
    byCategory[category].total += amount;
    byCategory[category].count += 1;
    byCategory[category].items.push(detail);
  }

  // Agregación por item: items con esGastoIndirecto=true se suman por supplierItemId+category dentro del mes
  const itemAggMap = new Map<string, ItemAggregate>();
  for (const receipt of receipts) {
    for (const item of receipt.items) {
      if (item.itemId && item.supplierItem?.esGastoIndirecto) {
        const cat = item.supplierItem.categoriaIndirecta ?? receipt.indirectCategory ?? 'OTHER';
        const key = `${cat}::${item.itemId}`;
        const amount = toNumber(item.subtotal);
        const existing = itemAggMap.get(key);
        if (existing) {
          existing.amount += amount;
          existing.count += 1;
        } else {
          itemAggMap.set(key, {
            supplierItemId: item.itemId,
            nombre: item.supplierItem.nombre,
            category: String(cat),
            amount,
            count: 1,
          });
        }
      }
    }
  }

  // Agrupar aggregates por categoría
  const itemAggregates: Record<string, ItemAggregate[]> = {};
  for (const agg of itemAggMap.values()) {
    if (!itemAggregates[agg.category]) itemAggregates[agg.category] = [];
    itemAggregates[agg.category].push(agg);
  }

  return {
    total,
    itemCount: receipts.length,
    byCategory,
    details,
    itemAggregates
  };
}

/**
 * Obtiene el total de facturas marcadas como indirecto para una empresa.
 * Reemplaza getIndirectItemsCount (que contaba IndirectItem configurados).
 */
export async function getIndirectItemsCount(companyId: number): Promise<number> {
  return prisma.purchaseReceipt.count({
    where: { companyId, esIndirecto: true }
  });
}

/**
 * Obtiene resumen de costos indirectos con nombres de categoría legibles
 */
export async function getIndirectSummaryWithLabels(
  companyId: number,
  month: string
): Promise<{
  total: number;
  categories: Array<{
    key: string;
    label: string;
    total: number;
    count: number;
  }>;
}> {
  const data = await getIndirectCostsForMonth(companyId, month);

  const categories = Object.entries(data.byCategory).map(([key, value]) => ({
    key,
    label: CATEGORY_LABELS[key] || key,
    total: value.total,
    count: value.count
  }));

  categories.sort((a, b) => b.total - a.total);

  return {
    total: data.total,
    categories
  };
}

/**
 * Helper para convertir Decimal de Prisma a number
 */
function toNumber(value: Decimal | number | null | undefined): number {
  if (value === null || value === undefined) return 0;
  if (typeof value === 'number') return value;
  return Number(value);
}
