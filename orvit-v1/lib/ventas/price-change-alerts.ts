import { prisma } from '@/lib/prisma';

/**
 * Price Change Alert & Logging Service
 *
 * Logs all sale price changes and generates alerts for significant changes.
 */

// Default threshold for price change alerts (20%)
const DEFAULT_ALERT_THRESHOLD_PERCENT = 20;

interface SalePriceChangeParams {
  productId: string;
  companyId: number;
  previousPrice?: number;
  newPrice: number;
  salesPriceListId?: number;
  changeSource: string;
  createdById: number;
  reason?: string;
  notes?: string;
}

/**
 * Log a sale price change and optionally create an alert if the change is significant.
 */
export async function logSalePriceChange(params: SalePriceChangeParams): Promise<{ logId: string; alertCreated: boolean }> {
  const {
    productId,
    companyId,
    previousPrice,
    newPrice,
    salesPriceListId,
    changeSource,
    createdById,
    reason,
    notes,
  } = params;

  try {
    // Create the price log
    const log = await prisma.salesPriceLog.create({
      data: {
        productId,
        companyId,
        previousPrice: previousPrice ?? null,
        newPrice,
        salesPriceListId: salesPriceListId ?? null,
        changeSource,
        createdById,
        reason: reason ?? null,
        notes: notes ?? null,
      },
    });

    // Check if alert should be created
    let alertCreated = false;
    if (previousPrice && previousPrice > 0) {
      const changePercent = Math.abs(((newPrice - previousPrice) / previousPrice) * 100);

      // Get configurable threshold from company settings, fallback to default
      const threshold = await getPriceChangeThreshold(companyId);

      if (changePercent >= threshold) {
        await createPriceChangeAlert({
          companyId,
          productId,
          previousPrice,
          newPrice,
          changePercent,
          threshold,
          changeSource,
          salesPriceListId,
          createdById,
        });
        alertCreated = true;
      }
    }

    return { logId: log.id, alertCreated };
  } catch (error) {
    console.error('[SalesPriceLog] Error logging price change:', error);
    // Don't throw - price logging should not block the main operation
    return { logId: '', alertCreated: false };
  }
}

/**
 * Get the price change alert threshold for a company.
 * Returns the configured percentage or the default (20%).
 */
async function getPriceChangeThreshold(companyId: number): Promise<number> {
  try {
    const config = await prisma.$queryRaw<any[]>`
      SELECT "priceChangeAlertThreshold"
      FROM "SalesConfig"
      WHERE "companyId" = ${companyId}
      LIMIT 1
    `;
    if (config.length > 0 && config[0].priceChangeAlertThreshold != null) {
      return parseFloat(config[0].priceChangeAlertThreshold);
    }
  } catch {
    // Column may not exist yet - ignore
  }
  return DEFAULT_ALERT_THRESHOLD_PERCENT;
}

/**
 * Create a risk alert for a significant price change.
 */
async function createPriceChangeAlert(params: {
  companyId: number;
  productId: string;
  previousPrice: number;
  newPrice: number;
  changePercent: number;
  threshold: number;
  changeSource: string;
  salesPriceListId?: number;
  createdById: number;
}): Promise<void> {
  const {
    companyId,
    productId,
    previousPrice,
    newPrice,
    changePercent,
    threshold,
    changeSource,
    salesPriceListId,
    createdById,
  } = params;

  try {
    // Get product name for the alert message
    const product = await prisma.product.findUnique({
      where: { id: productId },
      select: { name: true, code: true },
    });

    const productLabel = product ? `${product.name} (${product.code})` : productId;
    const direction = newPrice > previousPrice ? 'aumento' : 'disminucion';
    const severidad = changePercent >= threshold * 2 ? 'CRITICA' : changePercent >= threshold ? 'ALTA' : 'MEDIA';

    // Check if a similar active alert already exists
    const existing = await prisma.$queryRaw<any[]>`
      SELECT id FROM sales_risk_alerts
      WHERE "companyId" = ${companyId}
        AND tipo = 'PRECIO_DESACTUALIZADO'
        AND estado = 'ACTIVA'
        AND "datosAdicionales"->>'productId' = ${productId}
    `;

    if (existing.length > 0) return;

    await prisma.$queryRaw`
      INSERT INTO sales_risk_alerts (
        "companyId", "documentType", "documentId", tipo, categoria, severidad,
        titulo, mensaje, recomendacion, "datosAdicionales", "autoResolver"
      ) VALUES (
        ${companyId}, 'CLIENT', 0, 'PRECIO_DESACTUALIZADO',
        'MARGEN', ${severidad},
        ${`Cambio de precio significativo: ${direction} del ${changePercent.toFixed(1)}%`},
        ${`El producto ${productLabel} tuvo un ${direction} de precio del ${changePercent.toFixed(1)}% (de $${previousPrice.toFixed(2)} a $${newPrice.toFixed(2)}). Supera el umbral configurado del ${threshold}%.`},
        ${'Verificar que el cambio de precio es correcto y revisar impacto en cotizaciones activas'},
        ${JSON.stringify({
          productId,
          previousPrice,
          newPrice,
          changePercent: changePercent.toFixed(1),
          threshold,
          changeSource,
          salesPriceListId: salesPriceListId ?? null,
          createdById,
        })}::jsonb,
        true
      )
    `;

    console.log(`[PriceAlert] Created ${severidad} alert for ${productLabel}: ${changePercent.toFixed(1)}% change`);
  } catch (error) {
    console.error('[PriceAlert] Error creating price change alert:', error);
  }
}
