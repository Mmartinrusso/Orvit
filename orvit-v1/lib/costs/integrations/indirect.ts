/**
 * Centro de Costos V2 - Integración con Costos Indirectos
 *
 * Lee datos de MonthlyIndirect y IndirectItem para alimentar
 * el sistema de costos automáticamente.
 */

import { prisma } from '@/lib/prisma';
import { Decimal } from '@prisma/client/runtime/library';
import { IndirectCategory } from '@prisma/client';

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

export interface IndirectDetail {
  id: string;
  category: string;
  label: string;
  amount: number;
  itemId: string | null;
  itemCode: string | null;
  quantity: number | null;
  servicePrice: number | null;
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
 *
 * @param companyId - ID de la empresa
 * @param month - Mes en formato "YYYY-MM" (ej: "2026-01")
 */
export async function getIndirectCostsForMonth(
  companyId: number,
  month: string
): Promise<IndirectCostData> {
  // Buscar todos los registros de costos indirectos del mes
  const monthlyIndirects = await prisma.monthlyIndirect.findMany({
    where: {
      companyId,
      month
    },
    include: {
      item: {
        select: {
          id: true,
          code: true,
          label: true,
          category: true
        }
      }
    },
    orderBy: [
      { category: 'asc' },
      { label: 'asc' }
    ]
  });

  // Si no hay datos, retornar valores en cero
  if (monthlyIndirects.length === 0) {
    return {
      total: 0,
      itemCount: 0,
      byCategory: {},
      details: []
    };
  }

  // Procesar y agrupar por categoría
  let total = 0;
  const byCategory: Record<string, CategorySummary> = {};
  const details: IndirectDetail[] = [];

  for (const indirect of monthlyIndirects) {
    const amount = toNumber(indirect.amount);
    const category = indirect.category;

    const detail: IndirectDetail = {
      id: indirect.id,
      category,
      label: indirect.label,
      amount,
      itemId: indirect.itemId,
      itemCode: indirect.item?.code || null,
      quantity: indirect.quantity ? toNumber(indirect.quantity) : null,
      servicePrice: indirect.servicePrice ? toNumber(indirect.servicePrice) : null
    };

    details.push(detail);
    total += amount;

    // Agrupar por categoría
    if (!byCategory[category]) {
      byCategory[category] = {
        total: 0,
        count: 0,
        items: []
      };
    }

    byCategory[category].total += amount;
    byCategory[category].count += 1;
    byCategory[category].items.push(detail);
  }

  return {
    total,
    itemCount: monthlyIndirects.length,
    byCategory,
    details
  };
}

/**
 * Obtiene el total de ítems de costos indirectos configurados
 * (independiente del mes, para verificación de prerrequisitos)
 */
export async function getIndirectItemsCount(companyId: number): Promise<number> {
  return prisma.indirectItem.count({
    where: { companyId }
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

  // Ordenar por total descendente
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
