/**
 * Centro de Costos V2 - Integración con Costos Indirectos
 *
 * V2: Lee las facturas de Compras marcadas como "esIndirecto = true".
 * La clasificación (IndirectCategory) se elige por factura al momento de cargarla.
 */

import { prisma } from '@/lib/prisma';
import { Decimal } from '@prisma/client/runtime/library';

export interface IndirectCostData {
  total: number;
  itemCount: number;
  byCategory: Record<string, CategorySummary>;
  details: IndirectDetail[];
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
  fechaImputacion: string | null;
  proveedorNombre: string;
  // Conceptos del gasto (items con itemId=null)
  conceptos: IndirectConcept[];
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
 * Lee facturas de Compras marcadas como esIndirecto=true con fechaImputacion en el mes indicado.
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

  const receipts = await prisma.purchaseReceipt.findMany({
    where: {
      companyId,
      esIndirecto: true,
      fechaImputacion: {
        gte: startOfMonth,
        lte: endOfMonth
      }
    },
    include: {
      proveedor: {
        select: { id: true, name: true, razon_social: true }
      },
      items: {
        select: { id: true, descripcion: true, precioUnitario: true, cantidad: true, itemId: true },
        orderBy: { id: 'asc' as const },
      },
    },
    orderBy: [
      { indirectCategory: 'asc' },
      { fechaImputacion: 'asc' }
    ]
  });

  if (receipts.length === 0) {
    return {
      total: 0,
      itemCount: 0,
      byCategory: {},
      details: []
    };
  }

  let total = 0;
  const byCategory: Record<string, CategorySummary> = {};
  const details: IndirectDetail[] = [];

  for (const receipt of receipts) {
    const amount = toNumber(receipt.neto);
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
      fechaImputacion: receipt.fechaImputacion
        ? receipt.fechaImputacion.toISOString().split('T')[0]
        : null,
      proveedorNombre,
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

  return {
    total,
    itemCount: receipts.length,
    byCategory,
    details
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
