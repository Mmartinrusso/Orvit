/**
 * AFIP Types and Interfaces
 *
 * Tipos para integración con Web Services de AFIP:
 * - WSAA (Web Service de Autenticación y Autorización)
 * - WSFEv1 (Web Service de Facturación Electrónica versión 1)
 */

// ═══════════════════════════════════════════════════════════════════════════════
// WSAA (Autenticación)
// ═══════════════════════════════════════════════════════════════════════════════

export interface AFIPAuth {
  token: string;
  sign: string;
  expirationTime: Date;
}

export interface AFIPLoginTicketRequest {
  uniqueId: number;
  generationTime: Date;
  expirationTime: Date;
  service: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// WSFEv1 (Facturación)
// ═══════════════════════════════════════════════════════════════════════════════

export type AFIPAmbiente = 'PRODUCCION' | 'HOMOLOGACION';

export interface AFIPConfig {
  cuit: string;
  certPath: string;
  keyPath: string;
  ambiente: AFIPAmbiente;
  puntoVenta: number;
}

export interface AFIPComprobante {
  // Identificación
  CbteTipo: number; // Tipo de comprobante (1=FA A, 6=FA B, etc.)
  PtoVta: number; // Punto de venta
  CbteDesde: number; // Número de comprobante desde
  CbteHasta: number; // Número de comprobante hasta

  // Fecha
  CbteFch: string; // Formato YYYYMMDD

  // Importes
  ImpTotal: number; // Importe total
  ImpTotConc: number; // Importe neto no gravado
  ImpNeto: number; // Importe neto gravado
  ImpOpEx: number; // Importe exento
  ImpIVA: number; // Importe total de IVA
  ImpTrib: number; // Importe total de tributos

  // Moneda
  MonId: string; // Código de moneda (PES, DOL, etc.)
  MonCotiz: number; // Cotización de moneda

  // Cliente
  DocTipo: number; // Tipo de documento (80=CUIT, 96=DNI, etc.)
  DocNro: number; // Número de documento

  // Concepto
  Concepto: number; // 1=Productos, 2=Servicios, 3=Productos y Servicios

  // Fechas servicio (solo si Concepto != 1)
  FchServDesde?: string;
  FchServHasta?: string;
  FchVtoPago?: string;

  // Detalle IVA
  Iva?: AFIPIvaItem[];

  // Tributos (percepciones, etc.)
  Tributos?: AFIPTributoItem[];

  // Comprobantes asociados (para NC/ND)
  CbtesAsoc?: AFIPComprobanteAsociado[];
}

export interface AFIPIvaItem {
  Id: number; // Código de IVA (3=0%, 4=10.5%, 5=21%, 6=27%)
  BaseImp: number; // Base imponible
  Importe: number; // Importe de IVA
}

export interface AFIPTributoItem {
  Id: number; // Código de tributo
  Desc: string; // Descripción
  BaseImp: number; // Base imponible
  Alic: number; // Alícuota
  Importe: number; // Importe
}

export interface AFIPComprobanteAsociado {
  Tipo: number; // Tipo de comprobante asociado
  PtoVta: number; // Punto de venta
  Nro: number; // Número de comprobante
  Cuit?: number; // CUIT (opcional)
}

export interface AFIPCAEResponse {
  CAE: string; // Código de Autorización Electrónico
  CAEFchVto: string; // Fecha de vencimiento del CAE (YYYYMMDD)
  CbteFch: string; // Fecha del comprobante
  Resultado: 'A' | 'R' | 'P'; // A=Aprobado, R=Rechazado, P=Parcial
  Observaciones?: AFIPObservacion[];
  Errors?: AFIPError[];
}

export interface AFIPObservacion {
  Code: number;
  Msg: string;
}

export interface AFIPError {
  Code: number;
  Msg: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Últimos comprobantes autorizados
// ═══════════════════════════════════════════════════════════════════════════════

export interface AFIPUltimoComprobanteResponse {
  PtoVta: number;
  CbteTipo: number;
  CbteNro: number;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Mapeos de códigos AFIP
// ═══════════════════════════════════════════════════════════════════════════════

export const AFIP_TIPO_COMPROBANTE = {
  FACTURA_A: 1,
  NOTA_DEBITO_A: 2,
  NOTA_CREDITO_A: 3,
  FACTURA_B: 6,
  NOTA_DEBITO_B: 7,
  NOTA_CREDITO_B: 8,
  FACTURA_C: 11,
  NOTA_DEBITO_C: 12,
  NOTA_CREDITO_C: 13,
  FACTURA_E: 19,
  NOTA_DEBITO_E: 20,
  NOTA_CREDITO_E: 21,
} as const;

export const AFIP_TIPO_DOCUMENTO = {
  CUIT: 80,
  CUIL: 86,
  CDI: 87,
  LE: 89,
  LC: 90,
  CI_EXTRANJERA: 91,
  EN_TRAMITE: 92,
  ACTA_NACIMIENTO: 93,
  CI_BS_AS_RNP: 95,
  DNI: 96,
  PASAPORTE: 94,
  CI_POLICIA_FEDERAL: 0,
  CI_BUENOS_AIRES: 1,
  CI_CATAMARCA: 2,
  CONSUMIDOR_FINAL: 99,
} as const;

export const AFIP_TIPO_IVA = {
  IVA_0: 3,
  IVA_10_5: 4,
  IVA_21: 5,
  IVA_27: 6,
  IVA_5: 8,
  IVA_2_5: 9,
} as const;

export const AFIP_TIPO_CONCEPTO = {
  PRODUCTOS: 1,
  SERVICIOS: 2,
  PRODUCTOS_Y_SERVICIOS: 3,
} as const;

export const AFIP_MONEDA = {
  PESOS: 'PES',
  DOLARES: 'DOL',
  EUROS: 'EUR',
} as const;

// ═══════════════════════════════════════════════════════════════════════════════
// Helper Types
// ═══════════════════════════════════════════════════════════════════════════════

export interface AFIPInvoiceData {
  invoiceId: number;
  tipoComprobante: keyof typeof AFIP_TIPO_COMPROBANTE;
  puntoVenta: number;
  numeroComprobante: number;
  fecha: Date;
  tipoDocumento: number;
  numeroDocumento: string;
  importeTotal: number;
  importeNeto: number;
  importeIVA: number;
  importeExento: number;
  importeNoGravado: number;
  moneda: string;
  cotizacion: number;
  concepto: number;
  iva: Array<{
    tipo: number;
    baseImponible: number;
    importe: number;
  }>;
  tributos?: Array<{
    codigo: number;
    descripcion: string;
    baseImponible: number;
    alicuota: number;
    importe: number;
  }>;
  comprobantesAsociados?: Array<{
    tipo: number;
    puntoVenta: number;
    numero: number;
  }>;
}

export interface AFIPAuthorizationResult {
  success: boolean;
  cae?: string;
  caeFechaVencimiento?: Date;
  observaciones?: string[];
  errores?: string[];
  fechaProceso?: Date;
}
