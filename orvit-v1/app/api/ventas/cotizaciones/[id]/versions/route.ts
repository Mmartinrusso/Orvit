import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePermission, VENTAS_PERMISSIONS } from '@/lib/ventas/auth';
import { getViewMode, applyViewMode } from '@/lib/view-mode';

export const dynamic = 'force-dynamic';

/**
 * GET - Compare quote versions or get version history
 *
 * Query params:
 * - compare=true: Enable comparison mode
 * - v1=<number>: First version to compare (default: current)
 * - v2=<number>: Second version to compare (default: v1-1)
 * - detail=full|summary: Level of detail (default: summary)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { user, error } = await requirePermission(VENTAS_PERMISSIONS.COTIZACIONES_VIEW);
    if (error) return error;

    const viewMode = getViewMode(request);
    const { id: idParam } = await params;
    const quoteId = parseInt(idParam);

    if (isNaN(quoteId)) {
      return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
    }

    // Verify quote exists and is accessible
    const quote = await prisma.quote.findFirst({
      where: applyViewMode({ id: quoteId, companyId: user!.companyId }, viewMode),
      select: { id: true, numero: true, version: true, titulo: true }
    });

    if (!quote) {
      return NextResponse.json({ error: 'Cotización no encontrada' }, { status: 404 });
    }

    const { searchParams } = new URL(request.url);
    const compareMode = searchParams.get('compare') === 'true';
    const detailLevel = searchParams.get('detail') || 'summary';

    if (!compareMode) {
      // Return version history
      const versions = await prisma.quoteVersion.findMany({
        where: { quoteId },
        orderBy: { version: 'desc' },
        include: {
          createdByUser: {
            select: { id: true, name: true }
          }
        }
      });

      return NextResponse.json({
        quoteId,
        quoteNumber: quote.numero,
        currentVersion: quote.version,
        versions: versions.map(v => ({
          version: v.version,
          createdAt: v.createdAt,
          createdBy: v.createdByUser,
          motivo: v.motivo,
          summary: v.datos
        }))
      });
    }

    // Comparison mode
    const v1 = searchParams.get('v1') ? parseInt(searchParams.get('v1')!) : quote.version;
    const v2 = searchParams.get('v2') ? parseInt(searchParams.get('v2')!) : v1 - 1;

    if (v2 < 1) {
      return NextResponse.json({
        error: 'No hay versión anterior para comparar'
      }, { status: 400 });
    }

    // Fetch both versions
    const [version1, version2] = await Promise.all([
      v1 === quote.version
        ? fetchCurrentVersion(quoteId)
        : fetchHistoricalVersion(quoteId, v1),
      fetchHistoricalVersion(quoteId, v2)
    ]);

    if (!version1 || !version2) {
      return NextResponse.json({
        error: 'Una o ambas versiones no fueron encontradas'
      }, { status: 404 });
    }

    // Compare versions
    const comparison = compareVersions(version1, version2, detailLevel);

    return NextResponse.json({
      quoteId,
      quoteNumber: quote.numero,
      comparison: {
        v1: {
          version: v1,
          date: version1.date,
          user: version1.user
        },
        v2: {
          version: v2,
          date: version2.date,
          user: version2.user
        },
        changes: comparison.changes,
        summary: comparison.summary
      }
    });

  } catch (error) {
    console.error('Error comparing quote versions:', error);
    return NextResponse.json(
      { error: 'Error al comparar versiones' },
      { status: 500 }
    );
  }
}

/**
 * Fetch current version data from quote table
 */
async function fetchCurrentVersion(quoteId: number) {
  const quote = await prisma.quote.findUnique({
    where: { id: quoteId },
    include: {
      items: {
        select: {
          id: true,
          productId: true,
          descripcion: true,
          cantidad: true,
          unidad: true,
          precioUnitario: true,
          descuento: true,
          subtotal: true,
          product: {
            select: { name: true, sku: true }
          }
        },
        orderBy: { id: 'asc' }
      },
      client: {
        select: { id: true, name: true, legalName: true }
      },
      seller: {
        select: { id: true, name: true }
      },
      createdByUser: {
        select: { id: true, name: true }
      }
    }
  });

  if (!quote) return null;

  return {
    version: quote.version,
    date: quote.updatedAt,
    user: quote.createdByUser,
    data: {
      titulo: quote.titulo,
      clientId: quote.clientId,
      clientName: quote.client.legalName || quote.client.name,
      sellerId: quote.sellerId,
      sellerName: quote.seller?.name,
      fechaValidez: quote.fechaValidez,
      condicionesPago: quote.condicionesPago,
      condicionesEntrega: quote.condicionesEntrega,
      tiempoEntrega: quote.tiempoEntrega,
      moneda: quote.moneda,
      subtotal: Number(quote.subtotal),
      tasaIva: Number(quote.tasaIva),
      impuestos: Number(quote.impuestos),
      total: Number(quote.total),
      notas: quote.notas,
      notasInternas: quote.notasInternas,
      items: quote.items.map(item => ({
        id: item.id,
        productId: item.productId,
        productName: item.product?.name || item.descripcion,
        sku: item.product?.sku,
        descripcion: item.descripcion,
        cantidad: Number(item.cantidad),
        unidad: item.unidad,
        precioUnitario: Number(item.precioUnitario),
        descuento: Number(item.descuento),
        subtotal: Number(item.subtotal)
      }))
    }
  };
}

/**
 * Fetch historical version data from quote_versions table
 */
async function fetchHistoricalVersion(quoteId: number, version: number) {
  const versionRecord = await prisma.quoteVersion.findFirst({
    where: { quoteId, version },
    include: {
      createdByUser: {
        select: { id: true, name: true }
      }
    }
  });

  if (!versionRecord) return null;

  // The datos field contains version snapshot
  // It may have different structures, so we handle it flexibly
  const datos = versionRecord.datos as any;

  return {
    version: versionRecord.version,
    date: versionRecord.createdAt,
    user: versionRecord.createdByUser,
    data: datos
  };
}

/**
 * Compare two versions and return structured diff
 */
function compareVersions(v1: any, v2: any, detailLevel: string) {
  const changes: any[] = [];
  const summary: any = {
    totalChanges: 0,
    fieldsChanged: [],
    itemsAdded: 0,
    itemsRemoved: 0,
    itemsModified: 0,
    totalDifference: 0
  };

  // Compare basic fields
  const fieldsToCompare = [
    { key: 'titulo', label: 'Título' },
    { key: 'clientId', label: 'Cliente', displayKey: 'clientName' },
    { key: 'sellerId', label: 'Vendedor', displayKey: 'sellerName' },
    { key: 'fechaValidez', label: 'Fecha de Validez', type: 'date' },
    { key: 'condicionesPago', label: 'Condiciones de Pago' },
    { key: 'condicionesEntrega', label: 'Condiciones de Entrega' },
    { key: 'tiempoEntrega', label: 'Tiempo de Entrega' },
    { key: 'moneda', label: 'Moneda' },
    { key: 'tasaIva', label: 'Tasa IVA', type: 'number' },
    { key: 'notas', label: 'Notas' },
    { key: 'notasInternas', label: 'Notas Internas' }
  ];

  fieldsToCompare.forEach(field => {
    const oldValue = v2.data[field.key];
    const newValue = v1.data[field.key];

    if (oldValue !== newValue) {
      const displayKey = field.displayKey || field.key;
      changes.push({
        field: field.label,
        type: 'field',
        oldValue: field.displayKey ? v2.data[field.displayKey] : formatValue(oldValue, field.type),
        newValue: field.displayKey ? v1.data[field.displayKey] : formatValue(newValue, field.type)
      });
      summary.fieldsChanged.push(field.label);
    }
  });

  // Compare totals
  const totalsToCompare = [
    { key: 'subtotal', label: 'Subtotal' },
    { key: 'impuestos', label: 'Impuestos' },
    { key: 'total', label: 'Total' }
  ];

  totalsToCompare.forEach(field => {
    const oldValue = Number(v2.data[field.key] || 0);
    const newValue = Number(v1.data[field.key] || 0);
    const difference = newValue - oldValue;

    if (difference !== 0) {
      changes.push({
        field: field.label,
        type: 'amount',
        oldValue: formatCurrency(oldValue),
        newValue: formatCurrency(newValue),
        difference: formatCurrency(difference),
        percentChange: oldValue > 0 ? ((difference / oldValue) * 100).toFixed(2) + '%' : 'N/A'
      });
      summary.fieldsChanged.push(field.label);

      if (field.key === 'total') {
        summary.totalDifference = difference;
      }
    }
  });

  // Compare items (detailed comparison)
  if (detailLevel === 'full' && v1.data.items && v2.data.items) {
    const itemComparison = compareItems(v1.data.items, v2.data.items);
    changes.push(...itemComparison.changes);
    summary.itemsAdded = itemComparison.added;
    summary.itemsRemoved = itemComparison.removed;
    summary.itemsModified = itemComparison.modified;
  } else {
    // Summary-level item comparison
    const oldItemCount = v2.data.itemsCount || (v2.data.items?.length || 0);
    const newItemCount = v1.data.itemsCount || (v1.data.items?.length || 0);

    if (oldItemCount !== newItemCount) {
      changes.push({
        field: 'Cantidad de Items',
        type: 'items',
        oldValue: oldItemCount,
        newValue: newItemCount,
        difference: newItemCount - oldItemCount
      });
    }
  }

  summary.totalChanges = changes.length;

  return { changes, summary };
}

/**
 * Detailed item-by-item comparison
 */
function compareItems(newItems: any[], oldItems: any[]) {
  const changes: any[] = [];
  let added = 0;
  let removed = 0;
  let modified = 0;

  // Create maps for easier comparison
  const oldItemsMap = new Map(oldItems.map(item => [item.productId || item.descripcion, item]));
  const newItemsMap = new Map(newItems.map(item => [item.productId || item.descripcion, item]));

  // Find added items
  newItems.forEach(newItem => {
    const key = newItem.productId || newItem.descripcion;
    if (!oldItemsMap.has(key)) {
      changes.push({
        field: `Item: ${newItem.productName || newItem.descripcion}`,
        type: 'item_added',
        action: 'AGREGADO',
        details: `${newItem.cantidad} x ${formatCurrency(newItem.precioUnitario)} = ${formatCurrency(newItem.subtotal)}`
      });
      added++;
    }
  });

  // Find removed items
  oldItems.forEach(oldItem => {
    const key = oldItem.productId || oldItem.descripcion;
    if (!newItemsMap.has(key)) {
      changes.push({
        field: `Item: ${oldItem.productName || oldItem.descripcion}`,
        type: 'item_removed',
        action: 'ELIMINADO',
        details: `${oldItem.cantidad} x ${formatCurrency(oldItem.precioUnitario)} = ${formatCurrency(oldItem.subtotal)}`
      });
      removed++;
    }
  });

  // Find modified items
  newItems.forEach(newItem => {
    const key = newItem.productId || newItem.descripcion;
    const oldItem = oldItemsMap.get(key);

    if (oldItem) {
      const itemChanges: any[] = [];

      // Compare quantity
      if (Number(newItem.cantidad) !== Number(oldItem.cantidad)) {
        itemChanges.push({
          property: 'Cantidad',
          oldValue: Number(oldItem.cantidad),
          newValue: Number(newItem.cantidad)
        });
      }

      // Compare price
      if (Number(newItem.precioUnitario) !== Number(oldItem.precioUnitario)) {
        itemChanges.push({
          property: 'Precio Unitario',
          oldValue: formatCurrency(Number(oldItem.precioUnitario)),
          newValue: formatCurrency(Number(newItem.precioUnitario))
        });
      }

      // Compare discount
      if (Number(newItem.descuento || 0) !== Number(oldItem.descuento || 0)) {
        itemChanges.push({
          property: 'Descuento',
          oldValue: `${Number(oldItem.descuento || 0)}%`,
          newValue: `${Number(newItem.descuento || 0)}%`
        });
      }

      // Compare subtotal
      if (Number(newItem.subtotal) !== Number(oldItem.subtotal)) {
        itemChanges.push({
          property: 'Subtotal',
          oldValue: formatCurrency(Number(oldItem.subtotal)),
          newValue: formatCurrency(Number(newItem.subtotal))
        });
      }

      if (itemChanges.length > 0) {
        changes.push({
          field: `Item: ${newItem.productName || newItem.descripcion}`,
          type: 'item_modified',
          action: 'MODIFICADO',
          changes: itemChanges
        });
        modified++;
      }
    }
  });

  return { changes, added, removed, modified };
}

/**
 * Format value based on type
 */
function formatValue(value: any, type?: string): any {
  if (value === null || value === undefined) return '-';

  switch (type) {
    case 'date':
      return value ? new Date(value).toLocaleDateString('es-AR') : '-';
    case 'number':
      return Number(value);
    default:
      return value;
  }
}

/**
 * Format currency
 */
function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    minimumFractionDigits: 2
  }).format(amount);
}
