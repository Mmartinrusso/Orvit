import { prisma } from '@/lib/prisma';

/**
 * Risk Alert Service
 *
 * Automatically detects and creates risk alerts for quotes, sales, invoices, and clients
 */

export type AlertType =
  | 'CREDITO_EXCEDIDO'
  | 'CREDITO_PROXIMO_LIMITE'
  | 'STOCK_INSUFICIENTE'
  | 'ENTREGA_RETRASADA'
  | 'ENTREGA_PROXIMA'
  | 'MARGEN_BAJO'
  | 'MARGEN_NEGATIVO'
  | 'COTIZACION_VENCIDA'
  | 'COTIZACION_POR_VENCER'
  | 'COTIZACION_SIN_RESPUESTA'
  | 'ORDEN_ATASCADA'
  | 'DIRECCION_INCOMPLETA'
  | 'PRECIO_DESACTUALIZADO'
  | 'CLIENTE_MOROSO';

export type AlertCategory = 'CREDITO' | 'STOCK' | 'ENTREGA' | 'MARGEN' | 'VENCIMIENTO' | 'OPERATIVA' | 'OTRO';
export type AlertSeverity = 'CRITICA' | 'ALTA' | 'MEDIA' | 'BAJA';
export type DocumentType = 'QUOTE' | 'SALE' | 'INVOICE' | 'CLIENT';

interface RiskAlert {
  documentType: DocumentType;
  documentId: number;
  tipo: AlertType;
  categoria: AlertCategory;
  severidad: AlertSeverity;
  titulo: string;
  mensaje: string;
  recomendacion?: string;
  datosAdicionales?: any;
  autoResolver?: boolean;
}

/**
 * Create a risk alert (only if doesn't exist already)
 */
export async function createRiskAlert(
  companyId: number,
  alert: RiskAlert
): Promise<{ created: boolean; alertId?: number }> {
  try {
    // Check if active alert already exists
    const existing = await prisma.$queryRaw<any[]>`
      SELECT id FROM sales_risk_alerts
      WHERE "companyId" = ${companyId}
        AND "documentType" = ${alert.documentType}
        AND "documentId" = ${alert.documentId}
        AND tipo = ${alert.tipo}
        AND estado = 'ACTIVA'
    `;

    if (existing.length > 0) {
      return { created: false, alertId: existing[0].id };
    }

    // Create new alert
    const result = await prisma.$queryRaw<any[]>`
      INSERT INTO sales_risk_alerts (
        "companyId", "documentType", "documentId", tipo, categoria, severidad,
        titulo, mensaje, recomendacion, "datosAdicionales", "autoResolver"
      ) VALUES (
        ${companyId}, ${alert.documentType}, ${alert.documentId}, ${alert.tipo},
        ${alert.categoria}, ${alert.severidad}, ${alert.titulo}, ${alert.mensaje},
        ${alert.recomendacion}, ${JSON.stringify(alert.datosAdicionales || {})}::jsonb,
        ${alert.autoResolver || false}
      )
      RETURNING id
    `;

    console.log(`[Alert] Created ${alert.severidad} alert: ${alert.titulo}`);

    return { created: true, alertId: result[0].id };

  } catch (error) {
    console.error('[Alert] Error creating risk alert:', error);
    throw error;
  }
}

/**
 * Resolve an alert
 */
export async function resolveAlert(
  alertId: number,
  userId: number,
  comentario?: string
): Promise<void> {
  await prisma.$executeRaw`
    UPDATE sales_risk_alerts
    SET estado = 'RESUELTA',
        "resolvidaPor" = ${userId},
        "resolvidaAt" = NOW(),
        "comentarioResolucion" = ${comentario}
    WHERE id = ${alertId}
  `;
}

/**
 * Auto-resolve alerts when conditions no longer apply
 */
export async function autoResolveAlert(
  companyId: number,
  documentType: DocumentType,
  documentId: number,
  tipo: AlertType
): Promise<number> {
  const result = await prisma.$executeRaw`
    UPDATE sales_risk_alerts
    SET estado = 'RESUELTA',
        "autoResueltaAt" = NOW(),
        "comentarioResolucion" = 'Auto-resuelta: condición ya no aplica'
    WHERE "companyId" = ${companyId}
      AND "documentType" = ${documentType}
      AND "documentId" = ${documentId}
      AND tipo = ${tipo}
      AND estado = 'ACTIVA'
      AND "autoResolver" = true
  `;

  return Number(result);
}

/**
 * Check credit limit alerts for a client
 */
export async function checkCreditAlerts(
  companyId: number,
  clientId: string,
  newOrderTotal?: number
): Promise<void> {
  const client = await prisma.client.findUnique({
    where: { id: clientId },
    select: {
      id: true,
      legalName: true,
      name: true,
      creditLimit: true,
      currentBalance: true,
    }
  });

  if (!client || !client.creditLimit) return;

  const creditLimit = Number(client.creditLimit);
  const currentBalance = Number(client.currentBalance || 0);
  const totalWithNewOrder = currentBalance + (newOrderTotal || 0);
  const utilizacion = (totalWithNewOrder / creditLimit) * 100;

  // Critical: Limit exceeded
  if (totalWithNewOrder > creditLimit) {
    await createRiskAlert(companyId, {
      documentType: 'CLIENT',
      documentId: parseInt(clientId),
      tipo: 'CREDITO_EXCEDIDO',
      categoria: 'CREDITO',
      severidad: 'CRITICA',
      titulo: `Cliente excede límite de crédito`,
      mensaje: `${client.legalName || client.name} tiene una deuda de $${currentBalance.toFixed(2)} ${newOrderTotal ? `y una nueva orden de $${newOrderTotal.toFixed(2)} ` : ''}que excede el límite de crédito de $${creditLimit.toFixed(2)}`,
      recomendacion: 'Solicitar pago de facturas pendientes antes de procesar nueva orden, o aumentar límite de crédito',
      datosAdicionales: {
        creditLimit,
        currentBalance,
        newOrderTotal,
        totalWithNewOrder,
        exceso: totalWithNewOrder - creditLimit,
        utilizacion: utilizacion.toFixed(1)
      },
      autoResolver: true,
    });
  }
  // High: Approaching limit (80%+)
  else if (utilizacion >= 80) {
    await createRiskAlert(companyId, {
      documentType: 'CLIENT',
      documentId: parseInt(clientId),
      tipo: 'CREDITO_PROXIMO_LIMITE',
      categoria: 'CREDITO',
      severidad: 'ALTA',
      titulo: `Cliente próximo al límite de crédito (${utilizacion.toFixed(0)}%)`,
      mensaje: `${client.legalName || client.name} está utilizando el ${utilizacion.toFixed(1)}% de su línea de crédito`,
      recomendacion: 'Contactar al cliente para coordinar pagos o revisar límite',
      datosAdicionales: {
        creditLimit,
        currentBalance,
        utilizacion: utilizacion.toFixed(1)
      },
      autoResolver: true,
    });
  }
  // Auto-resolve if client is now below 80%
  else {
    await autoResolveAlert(companyId, 'CLIENT', parseInt(clientId), 'CREDITO_EXCEDIDO');
    await autoResolveAlert(companyId, 'CLIENT', parseInt(clientId), 'CREDITO_PROXIMO_LIMITE');
  }
}

/**
 * Check stock alerts for a sale
 */
export async function checkStockAlerts(companyId: number, saleId: number): Promise<void> {
  const sale = await prisma.sale.findUnique({
    where: { id: saleId },
    include: {
      items: {
        include: {
          product: {
            select: { id: true, name: true, stockQuantity: true }
          }
        }
      }
    }
  });

  if (!sale) return;

  const itemsWithLowStock: any[] = [];

  for (const item of sale.items) {
    if (!item.product || item.product.stockQuantity === null) continue;

    const stockDisponible = Number(item.product.stockQuantity);
    const cantidadRequerida = Number(item.cantidad);

    if (stockDisponible < cantidadRequerida) {
      itemsWithLowStock.push({
        productName: item.product.name,
        requerido: cantidadRequerida,
        disponible: stockDisponible,
        faltante: cantidadRequerida - stockDisponible,
      });
    }
  }

  if (itemsWithLowStock.length > 0) {
    await createRiskAlert(companyId, {
      documentType: 'SALE',
      documentId: saleId,
      tipo: 'STOCK_INSUFICIENTE',
      categoria: 'STOCK',
      severidad: 'ALTA',
      titulo: `Stock insuficiente para ${itemsWithLowStock.length} producto(s)`,
      mensaje: `La orden ${sale.numero} tiene ${itemsWithLowStock.length} productos con stock insuficiente`,
      recomendacion: 'Generar orden de compra o informar al cliente sobre demoras',
      datosAdicionales: { items: itemsWithLowStock },
      autoResolver: true,
    });
  } else {
    await autoResolveAlert(companyId, 'SALE', saleId, 'STOCK_INSUFICIENTE');
  }
}

/**
 * Check delivery alerts for sales
 */
export async function checkDeliveryAlerts(companyId: number, saleId: number): Promise<void> {
  const sale = await prisma.sale.findUnique({
    where: { id: saleId },
    select: {
      id: true,
      numero: true,
      estado: true,
      fechaEntregaEstimada: true,
      fechaEntregaReal: true,
    }
  });

  if (!sale || !sale.fechaEntregaEstimada) return;
  if (['ENTREGADA', 'CANCELADA'].includes(sale.estado)) return;

  const now = new Date();
  const fechaEstimada = new Date(sale.fechaEntregaEstimada);
  const diasHastaEntrega = Math.ceil((fechaEstimada.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

  // Critical: Overdue
  if (diasHastaEntrega < 0) {
    await createRiskAlert(companyId, {
      documentType: 'SALE',
      documentId: saleId,
      tipo: 'ENTREGA_RETRASADA',
      categoria: 'ENTREGA',
      severidad: 'CRITICA',
      titulo: `Entrega retrasada ${Math.abs(diasHastaEntrega)} día(s)`,
      mensaje: `La orden ${sale.numero} debía entregarse el ${fechaEstimada.toLocaleDateString('es-AR')} y aún no se completó`,
      recomendacion: 'Contactar al cliente para informar demora y reprogramar',
      datosAdicionales: {
        fechaEstimada,
        diasRetraso: Math.abs(diasHastaEntrega),
        estado: sale.estado,
      },
      autoResolver: true,
    });
  }
  // High: Due in 1 day
  else if (diasHastaEntrega <= 1 && !['PREPARADA', 'EN_TRANSITO'].includes(sale.estado)) {
    await createRiskAlert(companyId, {
      documentType: 'SALE',
      documentId: saleId,
      tipo: 'ENTREGA_PROXIMA',
      categoria: 'ENTREGA',
      severidad: 'ALTA',
      titulo: `Entrega comprometida en ${diasHastaEntrega} día(s)`,
      mensaje: `La orden ${sale.numero} debe entregarse pronto y está en estado ${sale.estado}`,
      recomendacion: 'Verificar que la orden esté preparada y lista para envío',
      datosAdicionales: {
        fechaEstimada,
        diasRestantes: diasHastaEntrega,
        estado: sale.estado,
      },
      autoResolver: true,
    });
  }
  // Auto-resolve if delivered or far enough
  else if (diasHastaEntrega > 1 || sale.fechaEntregaReal) {
    await autoResolveAlert(companyId, 'SALE', saleId, 'ENTREGA_RETRASADA');
    await autoResolveAlert(companyId, 'SALE', saleId, 'ENTREGA_PROXIMA');
  }
}

/**
 * Check margin alerts for quotes/sales
 */
export async function checkMarginAlerts(
  companyId: number,
  documentType: 'QUOTE' | 'SALE',
  documentId: number
): Promise<void> {
  let items: any[];
  let numero: string;

  if (documentType === 'QUOTE') {
    const quote = await prisma.quote.findUnique({
      where: { id: documentId },
      include: { items: true }
    });
    if (!quote) return;
    items = quote.items;
    numero = quote.numero;
  } else {
    const sale = await prisma.sale.findUnique({
      where: { id: documentId },
      include: { items: true }
    });
    if (!sale) return;
    items = sale.items;
    numero = sale.numero;
  }

  const itemsWithLowMargin: any[] = [];
  const itemsWithNegativeMargin: any[] = [];

  for (const item of items) {
    const precio = Number(item.precioUnitario);
    const costo = Number(item.costoUnitario || 0);

    if (costo === 0) continue;

    const margen = ((precio - costo) / precio) * 100;

    if (margen < 0) {
      itemsWithNegativeMargin.push({
        descripcion: item.descripcion,
        precio,
        costo,
        margen: margen.toFixed(2),
      });
    } else if (margen < 10) {
      itemsWithLowMargin.push({
        descripcion: item.descripcion,
        precio,
        costo,
        margen: margen.toFixed(2),
      });
    }
  }

  // Critical: Negative margin
  if (itemsWithNegativeMargin.length > 0) {
    await createRiskAlert(companyId, {
      documentType,
      documentId,
      tipo: 'MARGEN_NEGATIVO',
      categoria: 'MARGEN',
      severidad: 'CRITICA',
      titulo: `Margen negativo en ${itemsWithNegativeMargin.length} item(s)`,
      mensaje: `El documento ${numero} tiene items con precio menor al costo`,
      recomendacion: 'Revisar precios o verificar costos ingresados',
      datosAdicionales: { items: itemsWithNegativeMargin },
      autoResolver: false,
    });
  }

  // High: Low margin (<10%)
  if (itemsWithLowMargin.length > 0) {
    await createRiskAlert(companyId, {
      documentType,
      documentId,
      tipo: 'MARGEN_BAJO',
      categoria: 'MARGEN',
      severidad: 'ALTA',
      titulo: `Margen bajo (<10%) en ${itemsWithLowMargin.length} item(s)`,
      mensaje: `El documento ${numero} tiene items con margen menor al 10%`,
      recomendacion: 'Considerar ajustar precios o solicitar aprobación especial',
      datosAdicionales: { items: itemsWithLowMargin },
      autoResolver: false,
    });
  }
}

/**
 * Check quote expiration alerts
 */
export async function checkQuoteExpirationAlerts(companyId: number): Promise<number> {
  const now = new Date();
  const in7Days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  // Find quotes expiring soon
  const quotesExpiringSoon = await prisma.quote.findMany({
    where: {
      companyId,
      estado: { in: ['ENVIADA', 'EN_NEGOCIACION'] },
      fechaValidez: {
        gte: now,
        lte: in7Days,
      }
    },
    select: { id: true, numero: true, fechaValidez: true, total: true }
  });

  let created = 0;

  for (const quote of quotesExpiringSoon) {
    if (!quote.fechaValidez) continue;

    const diasRestantes = Math.ceil((quote.fechaValidez.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    const result = await createRiskAlert(companyId, {
      documentType: 'QUOTE',
      documentId: quote.id,
      tipo: 'COTIZACION_POR_VENCER',
      categoria: 'VENCIMIENTO',
      severidad: diasRestantes <= 2 ? 'ALTA' : 'MEDIA',
      titulo: `Cotización vence en ${diasRestantes} día(s)`,
      mensaje: `La cotización ${quote.numero} vence el ${quote.fechaValidez.toLocaleDateString('es-AR')}`,
      recomendacion: 'Contactar al cliente para consultar interés o renovar cotización',
      datosAdicionales: {
        fechaValidez: quote.fechaValidez,
        diasRestantes,
        total: Number(quote.total),
      },
      autoResolver: true,
    });

    if (result.created) created++;
  }

  return created;
}

/**
 * Get active alerts for a company
 */
export async function getActiveAlerts(
  companyId: number,
  filters?: {
    severidad?: AlertSeverity;
    categoria?: AlertCategory;
    documentType?: DocumentType;
    limit?: number;
  }
): Promise<any[]> {
  const limit = filters?.limit || 50;

  const alerts = await prisma.$queryRaw<any[]>`
    SELECT *
    FROM sales_risk_alerts
    WHERE "companyId" = ${companyId}
      AND estado = 'ACTIVA'
      ${filters?.severidad ? `AND severidad = '${filters.severidad}'` : ''}
      ${filters?.categoria ? `AND categoria = '${filters.categoria}'` : ''}
      ${filters?.documentType ? `AND "documentType" = '${filters.documentType}'` : ''}
    ORDER BY
      CASE severidad
        WHEN 'CRITICA' THEN 1
        WHEN 'ALTA' THEN 2
        WHEN 'MEDIA' THEN 3
        WHEN 'BAJA' THEN 4
      END,
      "createdAt" DESC
    LIMIT ${limit}
  `;

  return alerts;
}

/**
 * Get alert summary for a company
 */
export async function getAlertsSummary(companyId: number): Promise<any> {
  const summary = await prisma.$queryRaw<any[]>`
    SELECT
      COUNT(*) as total,
      SUM(CASE WHEN severidad = 'CRITICA' THEN 1 ELSE 0 END) as criticas,
      SUM(CASE WHEN severidad = 'ALTA' THEN 1 ELSE 0 END) as altas,
      SUM(CASE WHEN severidad = 'MEDIA' THEN 1 ELSE 0 END) as medias,
      SUM(CASE WHEN severidad = 'BAJA' THEN 1 ELSE 0 END) as bajas
    FROM sales_risk_alerts
    WHERE "companyId" = ${companyId}
      AND estado = 'ACTIVA'
  `;

  const byCategoria = await prisma.$queryRaw<any[]>`
    SELECT categoria, COUNT(*) as count
    FROM sales_risk_alerts
    WHERE "companyId" = ${companyId}
      AND estado = 'ACTIVA'
    GROUP BY categoria
  `;

  return {
    ...summary[0],
    byCategoria: byCategoria.reduce((acc, c) => {
      acc[c.categoria] = parseInt(c.count);
      return acc;
    }, {} as Record<string, number>)
  };
}
