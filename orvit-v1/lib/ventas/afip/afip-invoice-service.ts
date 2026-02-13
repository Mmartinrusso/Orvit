/**
 * AFIP Invoice Service
 *
 * Servicio que integra facturas del sistema con AFIP
 */

import prisma from '@/lib/prisma';
import { AFIPClient, createAFIPClient } from './afip-client';
import type {
  AFIPComprobante,
  AFIPInvoiceData,
  AFIPAuthorizationResult,
  AFIPIvaItem,
} from './afip-types';
import { AFIP_TIPO_COMPROBANTE, AFIP_TIPO_DOCUMENTO, AFIP_TIPO_IVA, AFIP_TIPO_CONCEPTO } from './afip-types';

// ═══════════════════════════════════════════════════════════════════════════════
// Authorize Invoice with AFIP
// ═══════════════════════════════════════════════════════════════════════════════

export async function authorizeInvoiceWithAFIP(
  invoiceId: number,
  companyId: number
): Promise<AFIPAuthorizationResult> {
  try {
    // 1. Obtener factura con todos sus datos
    const invoice = await prisma.salesInvoice.findFirst({
      where: { id: invoiceId, companyId },
      include: {
        client: true,
        items: {
          include: {
            product: true,
          },
        },
      },
    });

    if (!invoice) {
      throw new Error('Factura no encontrada');
    }

    // 2. Verificar que no esté ya autorizada
    if (invoice.estadoAFIP === 'AUTORIZADO') {
      throw new Error('La factura ya está autorizada en AFIP');
    }

    // 3. Crear cliente AFIP
    const afipClient = await createAFIPClient(companyId);

    // 4. Preparar datos del comprobante
    const comprobante = await prepareComprobanteData(invoice, afipClient);

    // 5. Solicitar CAE a AFIP
    const caeResponse = await afipClient.solicitarCAE(comprobante);

    // 6. Verificar resultado
    if (caeResponse.Resultado === 'R') {
      // Rechazado
      const errores = caeResponse.Errors?.map((e) => `${e.Code}: ${e.Msg}`).join(', ') || 'Error desconocido';

      // Actualizar factura con error
      await prisma.salesInvoice.update({
        where: { id: invoiceId },
        data: {
          estadoAFIP: 'RECHAZADO',
          afipObservaciones: errores,
        },
      });

      return {
        success: false,
        errores: caeResponse.Errors?.map((e) => e.Msg),
        fechaProceso: new Date(),
      };
    }

    // 7. Autorizado - Guardar CAE
    const caeFechaVto = parseAFIPDate(caeResponse.CAEFchVto);

    await prisma.salesInvoice.update({
      where: { id: invoiceId },
      data: {
        estadoAFIP: 'AUTORIZADO',
        cae: caeResponse.CAE,
        caeFechaVencimiento: caeFechaVto,
        afipObservaciones: caeResponse.Observaciones?.map((o) => `${o.Code}: ${o.Msg}`).join(', ') || null,
        afipAutorizadoAt: new Date(),
      },
    });

    // 8. Log en auditoría
    await prisma.auditLog.create({
      data: {
        entidad: 'SalesInvoice',
        entidadId: invoiceId.toString(),
        accion: 'AFIP_AUTORIZACION',
        detalles: {
          cae: caeResponse.CAE,
          caeFechaVto: caeFechaVto,
          observaciones: caeResponse.Observaciones,
        },
        companyId,
        userId: null, // Sistema automático
      },
    });

    return {
      success: true,
      cae: caeResponse.CAE,
      caeFechaVencimiento: caeFechaVto,
      observaciones: caeResponse.Observaciones?.map((o) => o.Msg),
      fechaProceso: new Date(),
    };
  } catch (error: any) {
    console.error('Error al autorizar factura con AFIP:', error);

    // Actualizar factura con error
    await prisma.salesInvoice.update({
      where: { id: invoiceId },
      data: {
        estadoAFIP: 'ERROR',
        afipObservaciones: error.message,
      },
    });

    return {
      success: false,
      errores: [error.message],
      fechaProceso: new Date(),
    };
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// Prepare Comprobante Data
// ═══════════════════════════════════════════════════════════════════════════════

async function prepareComprobanteData(invoice: any, afipClient: AFIPClient): Promise<AFIPComprobante> {
  // Determinar tipo de comprobante según responsabilidad fiscal
  const tipoComprobante = getTipoComprobante(invoice);

  // Consultar último número autorizado
  const ultimoNumero = await afipClient.consultarUltimoComprobante(
    invoice.puntoVenta || 1,
    tipoComprobante
  );
  const siguienteNumero = ultimoNumero + 1;

  // Parsear número de documento del cliente
  const docNumero = parseInt(invoice.client.cuit?.replace(/-/g, '') || '0', 10);
  const docTipo = invoice.client.cuit ? AFIP_TIPO_DOCUMENTO.CUIT : AFIP_TIPO_DOCUMENTO.CONSUMIDOR_FINAL;

  // Calcular IVA
  const ivaItems = calcularIVA(invoice);

  // Fecha en formato YYYYMMDD
  const fecha = formatAFIPDate(invoice.fechaEmision);

  const comprobante: AFIPComprobante = {
    CbteTipo: tipoComprobante,
    PtoVta: invoice.puntoVenta || 1,
    CbteDesde: siguienteNumero,
    CbteHasta: siguienteNumero,
    CbteFch: fecha,
    ImpTotal: Number(invoice.total),
    ImpTotConc: 0, // No gravado
    ImpNeto: Number(invoice.subtotal),
    ImpOpEx: 0, // Exento
    ImpIVA: Number(invoice.impuestos),
    ImpTrib: 0, // Tributos (percepciones)
    MonId: invoice.moneda === 'USD' ? 'DOL' : 'PES',
    MonCotiz: Number(invoice.tipoCambio || 1),
    DocTipo: docTipo,
    DocNro: docNumero,
    Concepto: AFIP_TIPO_CONCEPTO.PRODUCTOS, // TODO: Detectar si es servicio
    Iva: ivaItems,
  };

  return comprobante;
}

/**
 * Determina tipo de comprobante según responsabilidad fiscal
 */
function getTipoComprobante(invoice: any): number {
  // Por ahora asumimos Factura B
  // TODO: Detectar según categoría fiscal del cliente
  return AFIP_TIPO_COMPROBANTE.FACTURA_B;
}

/**
 * Calcula items de IVA
 */
function calcularIVA(invoice: any): AFIPIvaItem[] {
  const tasaIva = Number(invoice.tasaIva || 21);

  // Determinar código de IVA según tasa
  let codigoIVA = AFIP_TIPO_IVA.IVA_21;
  if (tasaIva === 0) codigoIVA = AFIP_TIPO_IVA.IVA_0;
  else if (tasaIva === 10.5) codigoIVA = AFIP_TIPO_IVA.IVA_10_5;
  else if (tasaIva === 21) codigoIVA = AFIP_TIPO_IVA.IVA_21;
  else if (tasaIva === 27) codigoIVA = AFIP_TIPO_IVA.IVA_27;

  return [
    {
      Id: codigoIVA,
      BaseImp: Number(invoice.subtotal),
      Importe: Number(invoice.impuestos),
    },
  ];
}

/**
 * Formatea fecha para AFIP (YYYYMMDD)
 */
function formatAFIPDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}${month}${day}`;
}

/**
 * Parsea fecha de AFIP (YYYYMMDD) a Date
 */
function parseAFIPDate(dateStr: string): Date {
  const year = parseInt(dateStr.substring(0, 4), 10);
  const month = parseInt(dateStr.substring(4, 6), 10) - 1;
  const day = parseInt(dateStr.substring(6, 8), 10);
  return new Date(year, month, day);
}

// ═══════════════════════════════════════════════════════════════════════════════
// Batch Authorization
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Autoriza múltiples facturas en lote
 */
export async function authorizeBatchInvoices(
  invoiceIds: number[],
  companyId: number
): Promise<{
  succeeded: number[];
  failed: Array<{ invoiceId: number; error: string }>;
}> {
  const succeeded: number[] = [];
  const failed: Array<{ invoiceId: number; error: string }> = [];

  for (const invoiceId of invoiceIds) {
    try {
      const result = await authorizeInvoiceWithAFIP(invoiceId, companyId);

      if (result.success) {
        succeeded.push(invoiceId);
      } else {
        failed.push({
          invoiceId,
          error: result.errores?.join(', ') || 'Error desconocido',
        });
      }

      // Esperar 1 segundo entre requests para no saturar AFIP
      await new Promise((resolve) => setTimeout(resolve, 1000));
    } catch (error: any) {
      failed.push({
        invoiceId,
        error: error.message,
      });
    }
  }

  return { succeeded, failed };
}

// ═══════════════════════════════════════════════════════════════════════════════
// Retry Authorization
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Reintenta autorización de factura rechazada
 */
export async function retryInvoiceAuthorization(
  invoiceId: number,
  companyId: number
): Promise<AFIPAuthorizationResult> {
  // Reset estado AFIP
  await prisma.salesInvoice.update({
    where: { id: invoiceId },
    data: {
      estadoAFIP: 'PENDIENTE',
      afipObservaciones: null,
    },
  });

  // Reintentar
  return authorizeInvoiceWithAFIP(invoiceId, companyId);
}

// ═══════════════════════════════════════════════════════════════════════════════
// Get Authorization Status
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Obtiene estado de autorización de factura
 */
export async function getInvoiceAFIPStatus(invoiceId: number, companyId: number) {
  const invoice = await prisma.salesInvoice.findFirst({
    where: { id: invoiceId, companyId },
    select: {
      id: true,
      numero: true,
      estadoAFIP: true,
      cae: true,
      caeFechaVencimiento: true,
      afipObservaciones: true,
      afipAutorizadoAt: true,
    },
  });

  if (!invoice) {
    throw new Error('Factura no encontrada');
  }

  return {
    id: invoice.id,
    numero: invoice.numero,
    estado: invoice.estadoAFIP,
    cae: invoice.cae,
    caeFechaVencimiento: invoice.caeFechaVencimiento,
    observaciones: invoice.afipObservaciones,
    autorizadoAt: invoice.afipAutorizadoAt,
  };
}
