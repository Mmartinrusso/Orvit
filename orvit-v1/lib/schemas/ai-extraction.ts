/**
 * Zod Schema para validación de extracción de facturas con IA
 * Versión: v1
 */
import { z } from 'zod';

// Schema para proveedor extraído
const ProveedorExtraidoSchema = z.object({
  razon_social: z.string(),
  cuit: z.string().regex(/^\d{2}-?\d{8}-?\d$/, 'CUIT inválido'),
  direccion: z.string().optional(),
  condicion_iva: z.string().optional()
}).nullable();

// Schema para items extraídos
const ItemExtraidoSchema = z.object({
  codigo: z.string().optional(),
  descripcion: z.string(),
  cantidad: z.number(),
  unidad: z.string().optional(),
  precio_unitario: z.number(),
  subtotal: z.number(),
  iva_porcentaje: z.number().optional()
});

// Schema principal de extracción IA
export const AIExtractionSchema = z.object({
  // Tipo de comprobante
  tipo_comprobante: z.string(), // FACTURA, NOTA DE CREDITO, NOTA DE DEBITO, REMITO, etc.
  letra_comprobante: z.string().length(1).optional(), // A, B, C

  // Números
  punto_venta: z.string(),
  numero_comprobante: z.string(),

  // Fechas
  fecha_emision: z.string(),
  fecha_vencimiento_pago: z.string().nullable().optional(),

  // Proveedor
  proveedor: ProveedorExtraidoSchema,

  // Importes (todos opcionales con default 0)
  subtotal_neto_gravado: z.number().default(0),
  subtotal_neto_no_gravado: z.number().default(0),
  subtotal_exento: z.number().default(0),
  iva_21: z.number().default(0),
  iva_10_5: z.number().default(0),
  iva_27: z.number().default(0),
  percepciones_iva: z.number().default(0),
  percepciones_iibb: z.number().default(0),
  otros_impuestos: z.number().default(0),
  total: z.number(),

  // CAE
  cae: z.string().nullable().optional(),
  fecha_vencimiento_cae: z.string().nullable().optional(),

  // Items detallados
  items: z.array(ItemExtraidoSchema).optional(),

  // Moneda
  moneda: z.string().default('ARS'),

  // Confianza (0-1)
  confianza: z.number().min(0).max(1).default(0.5),

  // Confianza por campo (opcional)
  fieldConfidence: z.record(z.number()).optional()
});

export type AIExtraction = z.infer<typeof AIExtractionSchema>;
export type ItemExtraido = z.infer<typeof ItemExtraidoSchema>;
export type ProveedorExtraido = z.infer<typeof ProveedorExtraidoSchema>;

// Metadata de extracción para auditoría
export interface ExtractionMetadata {
  extractionVersion: 'v1';
  model: string;
  pagesProcessed: number;
  processingTimeMs: number;
  rawResponse?: string;
}

// Resultado completo de extracción
export interface ExtractionResult {
  success: boolean;
  extraction?: AIExtraction;
  metadata: ExtractionMetadata;
  errors?: Array<{ path: string; message: string }>;
  needsManualReview: boolean;
}

// Mapeo de tipos de comprobante extraídos a tipos del sistema
export const TIPO_COMPROBANTE_MAP: Record<string, string> = {
  'FACTURA-A': 'FACTURA_A',
  'FACTURA-B': 'FACTURA_B',
  'FACTURA-C': 'FACTURA_C',
  'NOTA DE CREDITO-A': 'NC_A',
  'NOTA DE CREDITO-B': 'NC_B',
  'NOTA DE CREDITO-C': 'NC_C',
  'NOTA DE DEBITO-A': 'ND_A',
  'NOTA DE DEBITO-B': 'ND_B',
  'NOTA DE DEBITO-C': 'ND_C',
  'REMITO': 'REMITO',
  'PRESUPUESTO': 'PRESUPUESTO',
  'TICKET': 'TICKET',
  'OTRO': 'OTRO'
};

/**
 * Mapea el tipo extraído al tipo del sistema
 */
export function mapTipoComprobante(extraction: AIExtraction): string {
  const tipo = extraction.tipo_comprobante?.toUpperCase() || '';
  const letra = extraction.letra_comprobante?.toUpperCase() || '';

  const key = letra ? `${tipo}-${letra}` : tipo;
  return TIPO_COMPROBANTE_MAP[key] || 'FACTURA_A';
}

/**
 * Detecta el docType (T1 fiscal, T2 interno) basado en la extracción
 */
export function detectDocType(extraction: AIExtraction): { docType: 'T1' | 'T2'; suggestedTipo?: string } {
  const tipo = (extraction.tipo_comprobante || '').toUpperCase();

  // Documentos claramente internos (T2)
  const tiposInternos = ['REMITO', 'PRESUPUESTO', 'TICKET', 'ORDEN', 'RECIBO'];
  if (tiposInternos.some(t => tipo.includes(t))) {
    return { docType: 'T2', suggestedTipo: tipo };
  }

  // Factura/NC/ND sin CAE → sospechoso, podría ser T2
  const tiposFiscales = ['FACTURA', 'NOTA DE CREDITO', 'NOTA DE DEBITO'];
  if (tiposFiscales.some(t => tipo.includes(t)) && !extraction.cae) {
    return { docType: 'T2', suggestedTipo: 'TICKET' };
  }

  return { docType: 'T1' };
}

/**
 * Mapea extracción completa a datos de PurchaseReceipt
 */
export function mapExtractionToReceipt(
  extraction: AIExtraction,
  supplierId: number
): Record<string, unknown> {
  const { docType } = detectDocType(extraction);

  return {
    proveedorId: supplierId,
    tipo: mapTipoComprobante(extraction),
    numeroSerie: extraction.punto_venta || '',
    numeroFactura: extraction.numero_comprobante || '',
    fechaEmision: extraction.fecha_emision ? new Date(extraction.fecha_emision) : new Date(),
    fechaVencimiento: extraction.fecha_vencimiento_pago
      ? new Date(extraction.fecha_vencimiento_pago)
      : null,

    neto: extraction.subtotal_neto_gravado || 0,
    noGravado: extraction.subtotal_neto_no_gravado || 0,
    exento: extraction.subtotal_exento || 0,
    iva21: extraction.iva_21 || 0,
    iva105: extraction.iva_10_5 || 0,
    iva27: extraction.iva_27 || 0,
    percepcionIVA: extraction.percepciones_iva || 0,
    percepcionIIBB: extraction.percepciones_iibb || 0,
    otrosConceptos: extraction.otros_impuestos || 0,
    total: extraction.total,

    cae: extraction.cae || null,
    fechaVtoCae: extraction.fecha_vencimiento_cae
      ? new Date(extraction.fecha_vencimiento_cae)
      : null,

    moneda: extraction.moneda || 'ARS',
    tipoPago: extraction.fecha_vencimiento_pago ? 'cta_cte' : 'contado',
    docType,
  };
}
