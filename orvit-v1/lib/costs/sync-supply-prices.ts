/**
 * Sincronización automática de precios de insumos desde Compras
 *
 * Cuando se crea o edita un comprobante de compra, actualiza automáticamente
 * `supply_monthly_prices` con el precio real pagado por cada insumo.
 *
 * Esto evita tener que ingresar el precio manualmente en el módulo de Insumos
 * cada vez que llega una factura.
 */

import { Prisma } from '@prisma/client';

interface SyncSupplyPriceArgs {
  /** ID del SupplierItem (PurchaseReceiptItem.itemId) */
  itemId: number;
  /** Precio unitario del ítem en el comprobante */
  precioUnitario: number;
  /** Costo de flete a incluir (opcional, default 0) */
  freightCost?: number;
  /** Fecha de imputación del comprobante (Date o string YYYY-MM-DD) */
  fechaImputacion: Date | string | null | undefined;
  /** ID de la empresa */
  companyId: number;
  /** Texto identificador para el campo notes, ej: "FC 0001-00000123" */
  referencia?: string;
}

/**
 * Hace upsert del precio mensual de un insumo a partir de un ítem de comprobante.
 *
 * - Si ya existe un precio para ese (supply_id, mes) → lo sobreescribe con el precio real pagado.
 * - Si no existe → crea el registro.
 * - Si el ítem no tiene supplyId vinculado (sin insumo asociado) → no hace nada.
 *
 * Debe llamarse dentro de la misma transacción Prisma del comprobante.
 */
export async function syncSupplyPrice(
  tx: Prisma.TransactionClient,
  {
    itemId,
    precioUnitario,
    freightCost = 0,
    fechaImputacion,
    companyId,
    referencia = '',
  }: SyncSupplyPriceArgs
): Promise<void> {
  // 1. Obtener supplyId desde SupplierItem
  const supplierItem = await tx.supplierItem.findUnique({
    where: { id: itemId },
    select: { supplyId: true },
  });

  // Si el ítem no tiene un insumo vinculado, no hay nada que sincronizar
  if (!supplierItem?.supplyId) return;

  // 2. Determinar el mes de imputación
  //    Usar fechaImputacion del comprobante; si no viene, usar fecha actual
  let date: Date;
  if (!fechaImputacion) {
    date = new Date();
  } else if (fechaImputacion instanceof Date) {
    date = fechaImputacion;
  } else {
    date = new Date(fechaImputacion);
    // Evitar timezone offset (new Date('2026-02-01') puede ser Jan 31 en UTC-3)
    if (isNaN(date.getTime())) {
      date = new Date();
    }
  }

  // Primer día del mes, sin componente horario
  const monthYear = new Date(date.getFullYear(), date.getMonth(), 1);
  const fechaStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

  const notes = referencia ? `Auto: ${referencia}` : 'Auto: compras';

  // 3. UPSERT en supply_monthly_prices
  //    La tabla es legacy (sin model Prisma formal), se accede con raw SQL.
  //    El unique constraint es (supply_id, month_year).
  await tx.$executeRaw`
    INSERT INTO supply_monthly_prices
      (supply_id, month_year, fecha_imputacion, price_per_unit, freight_cost, notes, company_id, created_at, updated_at)
    VALUES
      (${supplierItem.supplyId}, ${monthYear}, ${fechaStr},
       ${precioUnitario}, ${freightCost},
       ${notes}, ${companyId}, NOW(), NOW())
    ON CONFLICT (supply_id, month_year)
    DO UPDATE SET
      price_per_unit = EXCLUDED.price_per_unit,
      freight_cost   = EXCLUDED.freight_cost,
      notes          = EXCLUDED.notes,
      updated_at     = NOW()
  `;
}

/**
 * Sincroniza todos los ítems de un comprobante en un solo loop.
 * Conveniencia para llamar desde la route de POST/PUT.
 *
 * @param tx - Transacción Prisma activa
 * @param items - Array de ítems procesados del comprobante
 * @param fechaImputacion - Fecha de imputación del comprobante
 * @param companyId - ID de la empresa
 * @param referencia - Número de comprobante para trazabilidad
 */
export async function syncAllSupplyPrices(
  tx: Prisma.TransactionClient,
  items: Array<{ itemId?: number | null; precioUnitario?: number | null }>,
  fechaImputacion: Date | string | null | undefined,
  companyId: number,
  referencia: string
): Promise<void> {
  for (const item of items) {
    if (!item.itemId || !item.precioUnitario || item.precioUnitario <= 0) continue;
    await syncSupplyPrice(tx, {
      itemId: item.itemId,
      precioUnitario: item.precioUnitario,
      fechaImputacion,
      companyId,
      referencia,
    });
  }
}
