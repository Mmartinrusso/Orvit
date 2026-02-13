import { prisma } from '@/lib/prisma';
import { Decimal } from '@prisma/client/runtime/library';
import { asignarOwnerYSLA, calcularPrioridad } from './match-exception-workflow';

// Tipos para el resultado del match por línea
interface LineMatchInput {
  facturaItemId?: number | null;
  receiptItemId?: number | null;
  ocItemId?: number | null;
  supplierItemId?: number | null;
  descripcion: string;
  qtyFacturada: number;
  qtyRecibida: number;
  qtyOC?: number | null;
  precioFactura?: number | null;
  precioRecibido?: number | null;
  precioOC?: number | null;
  // Campos de descuento
  descuentoPorcentaje?: number | null;
  descuentoMonto?: number | null;
  precioConDescuento?: number | null;
}

interface LineMatchOutput extends LineMatchInput {
  status: 'LINE_OK' | 'LINE_WARNING' | 'LINE_BLOCKED' | 'LINE_MISSING_RECEIPT' | 'LINE_MISSING_INVOICE' | 'LINE_EXTRA';
  diffCantidad: number | null;
  diffPorcentaje: number | null;
  diffPrecio: number | null;
  pctVarianzaPrecio: number | null;  // Porcentaje de varianza de precio
  razon: string | null;
  // Campos de descuento evaluados
  descuentoConsiderado: boolean;
  precioComparado: number | null;  // Precio usado para comparación (con o sin descuento)
}

interface MatchConfig {
  toleranciaCantidad: number; // Percentage (e.g., 5 = 5%)
  toleranciaPrecio: number;   // Percentage (e.g., 2 = 2%)
  permitirExceso?: boolean;
  permitirPagoSinMatch?: boolean;
  bloquearPagoConWarning?: boolean;
}

interface MatchResult {
  globalStatus: 'MATCH_PENDING' | 'MATCH_OK' | 'MATCH_WARNING' | 'MATCH_BLOCKED';
  lineResults: LineMatchOutput[];
  summary: {
    totalLineas: number;
    lineasOK: number;
    lineasWarning: number;
    lineasBlocked: number;
    lineasMissing: number;
    descripcion: string;
  };
}

/**
 * Evalúa el match por línea entre factura y recepciones
 * Retorna el estado global y los resultados por línea
 */
export async function evaluarMatchPorLinea(
  facturaId: number,
  companyId: number,
  config: MatchConfig
): Promise<MatchResult> {
  // Obtener factura con items
  const factura = await prisma.purchaseReceipt.findFirst({
    where: { id: facturaId, companyId },
    include: {
      items: {
        include: {
          supplierItem: true
        }
      }
    }
  });

  if (!factura) {
    throw new Error('Factura no encontrada');
  }

  // Buscar TODAS las recepciones vinculadas a esta factura (pueden ser varias)
  const recepciones = await prisma.goodsReceipt.findMany({
    where: {
      companyId,
      facturaId: facturaId,
      estado: 'CONFIRMADA'
    },
    include: {
      items: {
        include: { supplierItem: true }
      }
    }
  });

  // Tolerancias (convertir de % a decimal)
  const tolCantidad = config.toleranciaCantidad / 100;
  const tolPrecio = config.toleranciaPrecio / 100;

  const lineResults: LineMatchOutput[] = [];
  let globalStatus: MatchResult['globalStatus'] = 'MATCH_OK';

  // Si no hay recepciones vinculadas, match pendiente
  if (recepciones.length === 0) {
    // Todas las líneas de la factura como MISSING_RECEIPT
    for (const facturaItem of factura.items) {
      const precioFactura = Number(facturaItem.precioUnitario || 0);
      lineResults.push({
        facturaItemId: facturaItem.id,
        receiptItemId: null,
        ocItemId: null,
        supplierItemId: facturaItem.supplierItemId || null,
        descripcion: facturaItem.descripcion || 'Sin descripción',
        qtyFacturada: Number(facturaItem.cantidad || 0),
        qtyRecibida: 0,
        qtyOC: null,
        precioFactura,
        precioRecibido: null,
        precioOC: null,
        descuentoPorcentaje: null,
        descuentoMonto: null,
        precioConDescuento: null,
        status: 'LINE_MISSING_RECEIPT',
        diffCantidad: Number(facturaItem.cantidad || 0),
        diffPorcentaje: 100,
        diffPrecio: null,
        pctVarianzaPrecio: null,
        razon: 'Item facturado pero no recibido (sin recepciones vinculadas)',
        descuentoConsiderado: false,
        precioComparado: precioFactura,
      });
    }

    return {
      globalStatus: 'MATCH_PENDING',
      lineResults,
      summary: {
        totalLineas: lineResults.length,
        lineasOK: 0,
        lineasWarning: 0,
        lineasBlocked: 0,
        lineasMissing: lineResults.length,
        descripcion: 'Sin recepciones vinculadas'
      }
    };
  }

  // Agrupar cantidades recibidas por supplierItemId o descripción
  const recibidoPorItem = new Map<string, {
    qty: number;
    precio: number;
    receiptItemIds: number[];
    descripciones: string[];
  }>();

  for (const recepcion of recepciones) {
    for (const item of recepcion.items) {
      // Usar supplierItemId si existe, sino usar descripción normalizada
      const key = item.supplierItemId?.toString() || normalizeDescripcion(item.descripcion);
      const existing = recibidoPorItem.get(key) || {
        qty: 0,
        precio: 0,
        receiptItemIds: [],
        descripciones: []
      };
      existing.qty += Number(item.cantidadAceptada || 0);
      existing.precio = Number(item.cantidadAceptada || 0) > 0 ? Number(item.cantidadAceptada || 0) : existing.precio;
      existing.receiptItemIds.push(item.id);
      if (!existing.descripciones.includes(item.descripcion)) {
        existing.descripciones.push(item.descripcion);
      }
      recibidoPorItem.set(key, existing);
    }
  }

  // Set para trackear items procesados
  const procesados = new Set<string>();

  // Comparar CADA línea de la factura
  for (const facturaItem of factura.items) {
    const key = facturaItem.supplierItemId?.toString() || normalizeDescripcion(facturaItem.descripcion || '');
    const recibido = recibidoPorItem.get(key);
    procesados.add(key);

    const qtyFacturada = Number(facturaItem.cantidad || 0);
    const precioFactura = Number(facturaItem.precioUnitario || 0);

    // Obtener descuentos del item de factura (si existen)
    const descuentoPct = Number((facturaItem as any).descuento || 0);
    const descuentoMonto = Number((facturaItem as any).descuentoMonto || 0);
    let precioConDescuento = Number((facturaItem as any).precioConDescuento || 0);

    // Si no hay precioConDescuento calculado, calcularlo
    if (!precioConDescuento && (descuentoPct > 0 || descuentoMonto > 0)) {
      if (descuentoPct > 0) {
        precioConDescuento = precioFactura * (1 - descuentoPct / 100);
      } else if (descuentoMonto > 0) {
        precioConDescuento = precioFactura - descuentoMonto;
      }
    }

    // Precio a usar para comparación (con descuento si aplica)
    const precioParaComparar = precioConDescuento > 0 ? precioConDescuento : precioFactura;

    const lineResult: LineMatchOutput = {
      facturaItemId: facturaItem.id,
      receiptItemId: recibido?.receiptItemIds[0] || null,
      ocItemId: null,
      supplierItemId: facturaItem.supplierItemId || null,
      descripcion: facturaItem.descripcion || 'Sin descripción',
      qtyFacturada,
      qtyRecibida: recibido?.qty || 0,
      qtyOC: null,
      precioFactura,
      precioRecibido: recibido?.precio || null,
      precioOC: null,
      descuentoPorcentaje: descuentoPct > 0 ? descuentoPct : null,
      descuentoMonto: descuentoMonto > 0 ? descuentoMonto : null,
      precioConDescuento: precioConDescuento > 0 ? precioConDescuento : null,
      status: 'LINE_OK',
      diffCantidad: null,
      diffPorcentaje: null,
      diffPrecio: null,
      pctVarianzaPrecio: null,
      razon: null,
      descuentoConsiderado: precioConDescuento > 0,
      precioComparado: precioParaComparar,
    };

    if (!recibido || recibido.qty === 0) {
      // Facturado pero NO recibido
      lineResult.status = 'LINE_MISSING_RECEIPT';
      lineResult.diffCantidad = qtyFacturada;
      lineResult.diffPorcentaje = 100;
      lineResult.razon = 'Item facturado pero no recibido';
      globalStatus = 'MATCH_BLOCKED';
    } else {
      // Calcular diferencia de cantidad
      const diffQty = Math.abs(recibido.qty - qtyFacturada);
      const diffPct = qtyFacturada > 0 ? (diffQty / qtyFacturada) * 100 : 0;

      lineResult.diffCantidad = diffQty;
      lineResult.diffPorcentaje = Math.round(diffPct * 100) / 100;

      if (diffPct === 0) {
        lineResult.status = 'LINE_OK';
        lineResult.razon = 'Cantidad coincide exactamente';
      } else if (diffPct <= config.toleranciaCantidad) {
        lineResult.status = 'LINE_WARNING';
        lineResult.razon = `Diferencia ${diffPct.toFixed(1)}% dentro de tolerancia (${config.toleranciaCantidad}%)`;
        if (globalStatus === 'MATCH_OK') {
          globalStatus = 'MATCH_WARNING';
        }
      } else {
        lineResult.status = 'LINE_BLOCKED';
        lineResult.razon = `Diferencia ${diffPct.toFixed(1)}% excede tolerancia (${config.toleranciaCantidad}%)`;
        globalStatus = 'MATCH_BLOCKED';
      }

      // Verificar si recibió más de lo facturado (y no está permitido)
      if (recibido.qty > qtyFacturada && !config.permitirExceso) {
        if (diffPct > config.toleranciaCantidad) {
          lineResult.status = 'LINE_BLOCKED';
          lineResult.razon = `Recibido ${diffPct.toFixed(1)}% más de lo facturado (exceso no permitido)`;
          globalStatus = 'MATCH_BLOCKED';
        }
      }

      // ============================================================
      // EVALUACIÓN DE VARIANZA DE PRECIO (Price Variance)
      // Compara precio factura (con descuento si aplica) vs precio recepción (que refleja precio OC)
      // ============================================================
      const precioReferencia = recibido.precio || 0;
      // IMPORTANTE: Usar precio con descuento si está disponible
      const precioAComparar = precioConDescuento > 0 ? precioConDescuento : precioFactura;

      if (precioAComparar > 0 && precioReferencia > 0) {
        const diffPrecio = Math.abs(precioAComparar - precioReferencia);
        const pctPrecio = (diffPrecio / precioReferencia) * 100;

        lineResult.diffPrecio = Math.round(diffPrecio * 100) / 100;
        lineResult.pctVarianzaPrecio = Math.round(pctPrecio * 100) / 100;

        if (pctPrecio > config.toleranciaPrecio) {
          // Varianza de precio excede tolerancia → BLOQUEAR
          lineResult.status = 'LINE_BLOCKED';
          const descuentoInfo = precioConDescuento > 0
            ? ` (con ${descuentoPct > 0 ? descuentoPct + '% desc.' : '$' + descuentoMonto + ' desc.'})`
            : '';
          const razonPrecio = `Varianza precio ${pctPrecio.toFixed(1)}% excede tolerancia (${config.toleranciaPrecio}%): ` +
            `Factura $${precioAComparar.toFixed(2)}${descuentoInfo} vs Referencia $${precioReferencia.toFixed(2)}`;

          // Si ya había una razón de cantidad, combinar
          if (lineResult.razon && !lineResult.razon.includes('precio')) {
            lineResult.razon = `${lineResult.razon}. ${razonPrecio}`;
          } else {
            lineResult.razon = razonPrecio;
          }
          globalStatus = 'MATCH_BLOCKED';
        } else if (pctPrecio > 0 && lineResult.status === 'LINE_OK') {
          // Hay diferencia pero dentro de tolerancia → WARNING
          const descuentoInfo = precioConDescuento > 0 ? ' (descuento aplicado)' : '';
          lineResult.status = 'LINE_WARNING';
          lineResult.razon = `Varianza precio ${pctPrecio.toFixed(1)}% dentro de tolerancia (${config.toleranciaPrecio}%)${descuentoInfo}`;
          if (globalStatus === 'MATCH_OK') {
            globalStatus = 'MATCH_WARNING';
          }
        } else if (precioConDescuento > 0 && pctPrecio === 0 && lineResult.status === 'LINE_OK') {
          // Precio con descuento coincide exactamente
          lineResult.razon = `Precio coincide (descuento ${descuentoPct > 0 ? descuentoPct + '%' : '$' + descuentoMonto} aplicado)`;
        }
      }
    }

    lineResults.push(lineResult);
  }

  // Buscar items recibidos que NO están en la factura
  for (const [key, recibido] of recibidoPorItem) {
    if (!procesados.has(key)) {
      lineResults.push({
        facturaItemId: null,
        receiptItemId: recibido.receiptItemIds[0],
        ocItemId: null,
        supplierItemId: key.match(/^\d+$/) ? parseInt(key) : null,
        descripcion: recibido.descripciones[0] || key,
        qtyFacturada: 0,
        qtyRecibida: recibido.qty,
        qtyOC: null,
        precioFactura: null,
        precioRecibido: recibido.precio,
        precioOC: null,
        descuentoPorcentaje: null,
        descuentoMonto: null,
        precioConDescuento: null,
        status: 'LINE_MISSING_INVOICE',
        diffCantidad: recibido.qty,
        diffPorcentaje: 100,
        diffPrecio: null,
        pctVarianzaPrecio: null,
        razon: 'Item recibido pero no facturado',
        descuentoConsiderado: false,
        precioComparado: recibido.precio,
      });
      // Esto podría ser un problema o no (según política de la empresa)
      if (globalStatus === 'MATCH_OK') {
        globalStatus = 'MATCH_WARNING';
      }
    }
  }

  // Calcular resumen
  const summary = {
    totalLineas: lineResults.length,
    lineasOK: lineResults.filter(l => l.status === 'LINE_OK').length,
    lineasWarning: lineResults.filter(l => l.status === 'LINE_WARNING').length,
    lineasBlocked: lineResults.filter(l => l.status === 'LINE_BLOCKED').length,
    lineasMissing: lineResults.filter(l =>
      l.status === 'LINE_MISSING_RECEIPT' || l.status === 'LINE_MISSING_INVOICE'
    ).length,
    descripcion: `${lineResults.filter(l => l.status === 'LINE_OK').length}/${lineResults.length} líneas OK`
  };

  return {
    globalStatus,
    lineResults,
    summary
  };
}

/**
 * Ejecuta el match completo y guarda los resultados en la base de datos
 */
export async function ejecutarMatchYGuardar(
  facturaId: number,
  companyId: number,
  userId: number
): Promise<{
  matchResult: any;
  factura: any;
  summary: MatchResult['summary'];
}> {
  // Obtener config
  const config = await getMatchConfig(companyId);

  // Evaluar match por línea
  const matchEval = await evaluarMatchPorLinea(facturaId, companyId, config);

  // Buscar o crear MatchResult
  let matchResult = await prisma.matchResult.findFirst({
    where: { facturaId, companyId }
  });

  // Buscar recepciones vinculadas
  const recepciones = await prisma.goodsReceipt.findMany({
    where: {
      facturaId,
      companyId,
      estado: 'CONFIRMADA'
    },
    select: { id: true, purchaseOrderId: true }
  });

  const goodsReceiptId = recepciones[0]?.id || null;
  const purchaseOrderId = recepciones[0]?.purchaseOrderId || null;

  // Determinar estado del MatchResult
  const matchCompleto = matchEval.globalStatus === 'MATCH_OK';
  const estadoMatch = matchEval.globalStatus === 'MATCH_OK' ? 'MATCH_OK' :
    matchEval.globalStatus === 'MATCH_WARNING' ? 'DISCREPANCIA' :
    matchEval.globalStatus === 'MATCH_BLOCKED' ? 'BLOQUEADO' : 'PENDIENTE';

  if (matchResult) {
    // Actualizar existente
    matchResult = await prisma.matchResult.update({
      where: { id: matchResult.id },
      data: {
        purchaseOrderId,
        goodsReceiptId,
        estado: estadoMatch as any,
        matchOcRecepcion: null,
        matchRecepcionFactura: matchEval.globalStatus !== 'MATCH_PENDING',
        matchOcFactura: null,
        matchCompleto,
        discrepancias: matchEval.lineResults.filter(l => l.status !== 'LINE_OK'),
        updatedAt: new Date()
      }
    });

    // Eliminar line results anteriores
    await prisma.matchLineResult.deleteMany({
      where: { matchResultId: matchResult.id }
    });
  } else {
    // Crear nuevo
    matchResult = await prisma.matchResult.create({
      data: {
        purchaseOrderId,
        goodsReceiptId,
        facturaId,
        estado: estadoMatch as any,
        matchOcRecepcion: null,
        matchRecepcionFactura: matchEval.globalStatus !== 'MATCH_PENDING',
        matchOcFactura: null,
        matchCompleto,
        discrepancias: matchEval.lineResults.filter(l => l.status !== 'LINE_OK'),
        companyId
      }
    });
  }

  // Guardar line results
  if (matchEval.lineResults.length > 0) {
    await prisma.matchLineResult.createMany({
      data: matchEval.lineResults.map(line => ({
        matchResultId: matchResult!.id,
        facturaItemId: line.facturaItemId,
        receiptItemId: line.receiptItemId,
        ocItemId: line.ocItemId,
        supplierItemId: line.supplierItemId,
        descripcion: line.descripcion,
        qtyFacturada: line.qtyFacturada,
        qtyRecibida: line.qtyRecibida,
        qtyOC: line.qtyOC,
        precioFactura: line.precioFactura,
        precioRecibido: line.precioRecibido,
        precioOC: line.precioOC,
        status: line.status as any,
        diffCantidad: line.diffCantidad,
        diffPorcentaje: line.diffPorcentaje,
        diffPrecio: line.diffPrecio,
        pctVarianzaPrecio: line.pctVarianzaPrecio,
        razon: line.razon
      }))
    });
  }

  // Eliminar excepciones anteriores y crear nuevas
  await prisma.matchException.deleteMany({
    where: { matchResultId: matchResult!.id }
  });

  // Crear excepciones para líneas con problemas
  const exceptionsToCreate: Array<{
    matchResultId: number;
    tipo: string;
    campo: string;
    valorEsperado: string | null;
    valorRecibido: string | null;
    diferencia: number | null;
    porcentajeDiff: number | null;
    dentroTolerancia: boolean;
    montoAfectado: number | null;
    descuentoAplicado: number | null;
    precioConDescuento: number | null;
    descuentoPorcentaje: number | null;
  }> = [];

  for (const line of matchEval.lineResults) {
    // Calcular monto afectado para la línea
    const montoLinea = (line.precioComparado || line.precioFactura || 0) * (line.qtyFacturada || 0);

    // Excepción por varianza de precio
    if (line.pctVarianzaPrecio !== null && line.pctVarianzaPrecio > 0) {
      const montoAfectado = (line.diffPrecio || 0) * (line.qtyFacturada || 0);
      exceptionsToCreate.push({
        matchResultId: matchResult!.id,
        tipo: 'PRECIO_DIFERENTE',
        campo: `Item: ${line.descripcion}`,
        valorEsperado: line.precioRecibido?.toString() || null,
        valorRecibido: (line.precioComparado || line.precioFactura)?.toString() || null,
        diferencia: line.diffPrecio,
        porcentajeDiff: line.pctVarianzaPrecio,
        dentroTolerancia: line.pctVarianzaPrecio <= config.toleranciaPrecio,
        montoAfectado,
        descuentoAplicado: line.descuentoMonto || null,
        precioConDescuento: line.precioConDescuento || null,
        descuentoPorcentaje: line.descuentoPorcentaje || null,
      });
    }

    // Excepción por varianza de cantidad
    if (line.diffPorcentaje !== null && line.diffPorcentaje > 0 && line.status !== 'LINE_MISSING_RECEIPT' && line.status !== 'LINE_MISSING_INVOICE') {
      const montoAfectado = (line.diffCantidad || 0) * (line.precioComparado || line.precioFactura || 0);
      exceptionsToCreate.push({
        matchResultId: matchResult!.id,
        tipo: 'CANTIDAD_DIFERENTE',
        campo: `Item: ${line.descripcion}`,
        valorEsperado: line.qtyRecibida?.toString() || null,
        valorRecibido: line.qtyFacturada?.toString() || null,
        diferencia: line.diffCantidad,
        porcentajeDiff: line.diffPorcentaje,
        dentroTolerancia: line.diffPorcentaje <= config.toleranciaCantidad,
        montoAfectado,
        descuentoAplicado: null,
        precioConDescuento: null,
        descuentoPorcentaje: null,
      });
    }

    // Excepción por item faltante (facturado pero no recibido)
    if (line.status === 'LINE_MISSING_RECEIPT') {
      exceptionsToCreate.push({
        matchResultId: matchResult!.id,
        tipo: 'SIN_RECEPCION',
        campo: `Item: ${line.descripcion}`,
        valorEsperado: '0',
        valorRecibido: line.qtyFacturada?.toString() || null,
        diferencia: line.qtyFacturada,
        porcentajeDiff: 100,
        dentroTolerancia: false,
        montoAfectado: montoLinea,
        descuentoAplicado: null,
        precioConDescuento: null,
        descuentoPorcentaje: null,
      });
    }

    // Excepción por item extra (recibido pero no facturado)
    if (line.status === 'LINE_MISSING_INVOICE') {
      const montoExtra = (line.precioRecibido || 0) * (line.qtyRecibida || 0);
      exceptionsToCreate.push({
        matchResultId: matchResult!.id,
        tipo: 'ITEM_EXTRA',
        campo: `Item: ${line.descripcion}`,
        valorEsperado: line.qtyRecibida?.toString() || null,
        valorRecibido: '0',
        diferencia: line.qtyRecibida,
        porcentajeDiff: 100,
        dentroTolerancia: false,
        montoAfectado: montoExtra,
        descuentoAplicado: null,
        precioConDescuento: null,
        descuentoPorcentaje: null,
      });
    }
  }

  if (exceptionsToCreate.length > 0) {
    // Crear excepciones con campos adicionales
    const createdExceptions = await prisma.$transaction(async (tx) => {
      const exceptions = [];
      for (const e of exceptionsToCreate) {
        const exc = await tx.matchException.create({
          data: {
            matchResultId: e.matchResultId,
            tipo: e.tipo as any,
            campo: e.campo,
            valorEsperado: e.valorEsperado,
            valorRecibido: e.valorRecibido,
            diferencia: e.diferencia,
            porcentajeDiff: e.porcentajeDiff,
            dentroTolerancia: e.dentroTolerancia,
          }
        });

        // Asignar owner y SLA a cada excepción
        try {
          await asignarOwnerYSLA(
            exc.id,
            companyId,
            e.tipo,
            e.montoAfectado || 0,
            tx as any
          );
        } catch (err) {
          // Si falla la asignación de owner, continuar sin error
          console.warn(`[MATCH] Error asignando owner a excepción ${exc.id}:`, err);
        }

        exceptions.push(exc);
      }
      return exceptions;
    });
  }

  // Actualizar estado de match en la factura
  const payApprovalStatus = matchEval.globalStatus === 'MATCH_BLOCKED'
    ? 'PAY_BLOCKED_BY_MATCH'
    : undefined;

  const factura = await prisma.purchaseReceipt.update({
    where: { id: facturaId },
    data: {
      matchStatus: matchEval.globalStatus as any,
      matchCheckedAt: new Date(),
      matchBlockReason: matchEval.globalStatus === 'MATCH_BLOCKED'
        ? `${matchEval.summary.lineasBlocked} líneas con discrepancias, ${matchEval.summary.lineasMissing} faltantes`
        : null,
      ...(payApprovalStatus && { payApprovalStatus: payApprovalStatus as any })
    }
  });

  // Registrar auditoría
  await prisma.purchaseAuditLog.create({
    data: {
      entidad: 'match_result',
      entidadId: matchResult.id,
      accion: 'EJECUTAR_MATCH_POR_LINEA',
      datosNuevos: {
        globalStatus: matchEval.globalStatus,
        summary: matchEval.summary,
        lineasEvaluadas: matchEval.lineResults.length
      },
      companyId,
      userId
    }
  });

  return {
    matchResult: await prisma.matchResult.findUnique({
      where: { id: matchResult.id },
      include: {
        lineResults: true,
        exceptions: true
      }
    }),
    factura,
    summary: matchEval.summary
  };
}

/**
 * Obtiene la configuración de match para una empresa
 */
async function getMatchConfig(companyId: number): Promise<MatchConfig> {
  let config = await prisma.purchaseConfig.findUnique({
    where: { companyId }
  });

  if (!config) {
    // Crear configuración por defecto
    config = await prisma.purchaseConfig.create({
      data: {
        companyId,
        toleranciaCantidad: 5,
        toleranciaPrecio: 2,
        permitirPagoSinMatch: false,
        permitirRecepcionSinOc: true,
        diasAlertaRecepcionSinFactura: 7,
        diasAlertaFacturaVencer: 7,
        diasLimiteRegularizacion: 15,
      }
    });
  }

  return {
    toleranciaCantidad: Number(config.toleranciaCantidad || 5),
    toleranciaPrecio: Number(config.toleranciaPrecio || 2),
    permitirExceso: config.permitirExceso || false,
    permitirPagoSinMatch: config.permitirPagoSinMatch || false,
    bloquearPagoConWarning: config.bloquearPagoConWarning || false
  };
}

/**
 * Normaliza una descripción para comparación
 */
function normalizeDescripcion(desc: string): string {
  return desc.toLowerCase().trim().replace(/\s+/g, ' ');
}

/**
 * Verifica si una factura puede ser pagada según su estado de match
 */
export async function verificarPagoPermitido(
  facturaId: number,
  companyId: number
): Promise<{
  permitido: boolean;
  requiereAprobacion: boolean;
  mensaje: string;
}> {
  const factura = await prisma.purchaseReceipt.findFirst({
    where: { id: facturaId, companyId }
  });

  if (!factura) {
    return { permitido: false, requiereAprobacion: false, mensaje: 'Factura no encontrada' };
  }

  const config = await getMatchConfig(companyId);

  // 1. Verificar si está validada
  if (!factura.facturaValidada) {
    return {
      permitido: false,
      requiereAprobacion: false,
      mensaje: 'La factura debe ser validada primero'
    };
  }

  // 2. Verificar aprobación de pago
  if (factura.payApprovalStatus === 'PAY_REJECTED') {
    return {
      permitido: false,
      requiereAprobacion: false,
      mensaje: factura.payRejectedReason || 'Pago rechazado'
    };
  }

  if (factura.payApprovalStatus === 'PAY_APPROVED') {
    return { permitido: true, requiereAprobacion: false, mensaje: 'Aprobada para pago' };
  }

  // 3. Evaluar según estado de match
  switch (factura.matchStatus) {
    case 'MATCH_OK':
      return { permitido: true, requiereAprobacion: false, mensaje: 'Match OK' };

    case 'MATCH_WARNING':
      return {
        permitido: !config.bloquearPagoConWarning,
        requiereAprobacion: true,
        mensaje: 'Hay diferencias menores. Requiere aprobación.'
      };

    case 'MATCH_BLOCKED':
      return {
        permitido: config.permitirPagoSinMatch || false,
        requiereAprobacion: true,
        mensaje: factura.matchBlockReason || 'Hay discrepancias importantes. Requiere aprobación de supervisor.'
      };

    case 'MATCH_PENDING':
    default:
      return {
        permitido: config.permitirPagoSinMatch || false,
        requiereAprobacion: true,
        mensaje: 'Sin recepciones vinculadas. ¿Pagar sin confirmar recepción?'
      };
  }
}

/**
 * Recalcula el match automáticamente cuando se vincula una recepción
 */
export async function recalcularMatchAlVincular(
  facturaId: number,
  goodsReceiptId: number,
  companyId: number,
  userId: number
): Promise<void> {
  // Ejecutar match y guardar
  await ejecutarMatchYGuardar(facturaId, companyId, userId);
}
