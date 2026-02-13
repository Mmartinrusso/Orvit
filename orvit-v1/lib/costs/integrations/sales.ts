/**
 * Centro de Costos V2 - Integración con Ventas
 *
 * Lee datos de SalesInvoice (facturas confirmadas) para alimentar
 * el sistema de costos automáticamente.
 *
 * Incluye cálculo de COGS (Cost of Goods Sold) con fallback:
 * 1. Product.costPrice si existe
 * 2. 0 si no hay producto vinculado
 */

import { prisma } from '@/lib/prisma';
import { Decimal } from '@prisma/client/runtime/library';
import { startOfMonth, endOfMonth, parseISO } from 'date-fns';

export interface SalesCostData {
  totalRevenue: number;      // Ingresos totales (facturado sin IVA)
  totalCost: number;         // COGS calculado
  grossMargin: number;       // totalRevenue - totalCost
  marginPercent: number;     // (grossMargin / totalRevenue) * 100
  invoiceCount: number;
  itemCount: number;
  byClient: ClientSalesSummary[];
  byProduct: ProductSalesSummary[];
  details: SalesDetail[];
}

export interface ClientSalesSummary {
  clientId: string;
  clientName: string;
  revenue: number;
  cost: number;
  margin: number;
  invoiceCount: number;
}

export interface ProductSalesSummary {
  productId: string | null;
  productName: string;
  quantity: number;
  revenue: number;
  cost: number;
  margin: number;
}

export interface SalesDetail {
  invoiceId: number;
  invoiceNumber: string;
  clientId: string;
  invoiceDate: Date;
  itemId: number;
  productId: string | null;
  description: string;
  quantity: number;
  unitPrice: number;
  discount: number;
  subtotal: number;
  unitCost: number;
  totalCost: number;
  itemMargin: number;
}

// Estados de factura que consideramos como "confirmadas"
const CONFIRMED_STATUSES = [
  'EMITIDA',
  'ENVIADA',
  'PARCIALMENTE_COBRADA',
  'COBRADA'
];

/**
 * Obtiene los datos de ventas para un mes específico.
 *
 * @param companyId - ID de la empresa
 * @param month - Mes en formato "YYYY-MM" (ej: "2026-01")
 */
export async function getSalesForMonth(
  companyId: number,
  month: string
): Promise<SalesCostData> {
  const startDate = startOfMonth(parseISO(month + '-01'));
  const endDate = endOfMonth(startDate);

  // Buscar facturas confirmadas del mes
  const invoices = await prisma.salesInvoice.findMany({
    where: {
      companyId,
      estado: { in: CONFIRMED_STATUSES as any },
      fechaEmision: {
        gte: startDate,
        lte: endDate
      }
    },
    include: {
      client: {
        select: {
          id: true,
          name: true
        }
      },
      items: {
        include: {
          product: {
            select: {
              id: true,
              name: true,
              costPrice: true
            }
          }
        }
      }
    },
    orderBy: { fechaEmision: 'asc' }
  });

  // Si no hay facturas, retornar valores en cero
  if (invoices.length === 0) {
    return {
      totalRevenue: 0,
      totalCost: 0,
      grossMargin: 0,
      marginPercent: 0,
      invoiceCount: 0,
      itemCount: 0,
      byClient: [],
      byProduct: [],
      details: []
    };
  }

  // Calcular totales
  let totalRevenue = 0;
  let totalCost = 0;
  let totalItems = 0;
  const details: SalesDetail[] = [];
  const clientMap = new Map<string, ClientSalesSummary>();
  const productMap = new Map<string | null, ProductSalesSummary>();

  for (const invoice of invoices) {
    const clientId = invoice.clientId;
    const clientName = invoice.client?.name || 'Sin cliente';

    // Inicializar resumen de cliente si no existe
    if (!clientMap.has(clientId)) {
      clientMap.set(clientId, {
        clientId,
        clientName,
        revenue: 0,
        cost: 0,
        margin: 0,
        invoiceCount: 0
      });
    }

    const clientSummary = clientMap.get(clientId)!;
    clientSummary.invoiceCount += 1;

    for (const item of invoice.items) {
      const quantity = toNumber(item.cantidad);
      const unitPrice = toNumber(item.precioUnitario);
      const discount = toNumber(item.descuento);
      const subtotal = toNumber(item.subtotal);

      // Obtener costo del producto (COGS)
      const unitCost = item.product?.costPrice
        ? toNumber(item.product.costPrice)
        : 0;
      const itemTotalCost = quantity * unitCost;
      const itemMargin = subtotal - itemTotalCost;

      totalRevenue += subtotal;
      totalCost += itemTotalCost;
      totalItems += 1;

      // Actualizar resumen de cliente
      clientSummary.revenue += subtotal;
      clientSummary.cost += itemTotalCost;
      clientSummary.margin += itemMargin;

      // Actualizar resumen de producto
      const productId = item.productId;
      const productKey = productId || 'SIN_PRODUCTO';

      if (!productMap.has(productKey)) {
        productMap.set(productKey, {
          productId,
          productName: item.product?.name || item.descripcion,
          quantity: 0,
          revenue: 0,
          cost: 0,
          margin: 0
        });
      }

      const productSummary = productMap.get(productKey)!;
      productSummary.quantity += quantity;
      productSummary.revenue += subtotal;
      productSummary.cost += itemTotalCost;
      productSummary.margin += itemMargin;

      details.push({
        invoiceId: invoice.id,
        invoiceNumber: invoice.numeroCompleto,
        clientId,
        invoiceDate: invoice.fechaEmision,
        itemId: item.id,
        productId,
        description: item.descripcion,
        quantity,
        unitPrice,
        discount,
        subtotal,
        unitCost,
        totalCost: itemTotalCost,
        itemMargin
      });
    }
  }

  const grossMargin = totalRevenue - totalCost;
  const marginPercent = totalRevenue > 0
    ? (grossMargin / totalRevenue) * 100
    : 0;

  // Convertir mapas a arrays
  const byClient = Array.from(clientMap.values())
    .sort((a, b) => b.revenue - a.revenue);

  const byProduct = Array.from(productMap.values())
    .sort((a, b) => b.revenue - a.revenue);

  return {
    totalRevenue,
    totalCost,
    grossMargin,
    marginPercent,
    invoiceCount: invoices.length,
    itemCount: totalItems,
    byClient,
    byProduct,
    details
  };
}

/**
 * Obtiene solo los ingresos del mes (sin detalle de costos)
 */
export async function getSalesRevenueForMonth(
  companyId: number,
  month: string
): Promise<{
  totalRevenue: number;
  invoiceCount: number;
}> {
  const data = await getSalesForMonth(companyId, month);
  return {
    totalRevenue: data.totalRevenue,
    invoiceCount: data.invoiceCount
  };
}

/**
 * Helper para convertir valores a number
 */
function toNumber(value: Decimal | number | null | undefined): number {
  if (value === null || value === undefined) return 0;
  if (typeof value === 'number') return value;
  return Number(value);
}
