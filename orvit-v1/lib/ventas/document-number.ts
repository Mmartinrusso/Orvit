import { prisma } from '@/lib/prisma';

export type DocumentType =
  | 'COT'       // Cotización
  | 'OV'        // Orden de Venta
  | 'ENT'       // Entrega
  | 'REM'       // Remito
  | 'FCA'       // Factura A
  | 'FCB'       // Factura B
  | 'FCC'       // Factura C
  | 'NV'        // Nota de Venta (T2)
  | 'REC'       // Recibo
  | 'NC'        // Nota de Crédito
  | 'ND';       // Nota de Débito

interface GenerateNumberOptions {
  companyId: number;
  prefix: DocumentType;
  customPrefix?: string;  // Override default prefix
  padLength?: number;     // Default 5
}

/**
 * Generates a unique document number in format: PREFIX-YYYY-NNNNN
 * Uses the last number in the database to determine the next one.
 *
 * Example: COT-2024-00001, OV-2024-00025, FCA-2024-00100
 */
export async function generateDocumentNumber(options: GenerateNumberOptions): Promise<string> {
  const { companyId, prefix, customPrefix, padLength = 5 } = options;
  const año = new Date().getFullYear();
  const finalPrefix = customPrefix || prefix;
  const fullPrefix = `${finalPrefix}-${año}-`;

  // Get the model and field based on document type
  const lastNumber = await getLastNumber(companyId, prefix, fullPrefix);

  const nextNumber = lastNumber + 1;
  return `${fullPrefix}${String(nextNumber).padStart(padLength, '0')}`;
}

async function getLastNumber(companyId: number, docType: DocumentType, prefix: string): Promise<number> {
  let result: { numero: string } | null = null;

  switch (docType) {
    case 'COT':
      result = await prisma.quote.findFirst({
        where: { companyId, numero: { startsWith: prefix } },
        orderBy: { numero: 'desc' },
        select: { numero: true }
      });
      break;

    case 'OV':
      result = await prisma.sale.findFirst({
        where: { companyId, numero: { startsWith: prefix } },
        orderBy: { numero: 'desc' },
        select: { numero: true }
      });
      break;

    case 'ENT':
      result = await prisma.saleDelivery.findFirst({
        where: { companyId, numero: { startsWith: prefix } },
        orderBy: { numero: 'desc' },
        select: { numero: true }
      });
      break;

    case 'REM':
      result = await prisma.saleRemito.findFirst({
        where: { companyId, numero: { startsWith: prefix } },
        orderBy: { numero: 'desc' },
        select: { numero: true }
      });
      break;

    case 'FCA':
    case 'FCB':
    case 'FCC':
    case 'NV':
      result = await prisma.salesInvoice.findFirst({
        where: { companyId, numero: { startsWith: prefix } },
        orderBy: { numero: 'desc' },
        select: { numero: true }
      });
      break;

    case 'REC':
      result = await prisma.clientPayment.findFirst({
        where: { companyId, numero: { startsWith: prefix } },
        orderBy: { numero: 'desc' },
        select: { numero: true }
      });
      break;

    case 'NC':
    case 'ND':
      result = await prisma.creditNote.findFirst({
        where: { companyId, numero: { startsWith: prefix } },
        orderBy: { numero: 'desc' },
        select: { numero: true }
      });
      break;
  }

  if (result?.numero) {
    // Extract the number part from "PREFIX-YYYY-NNNNN"
    const parts = result.numero.split('-');
    const lastNum = parseInt(parts[parts.length - 1]) || 0;
    return lastNum;
  }

  return 0;
}

/**
 * Generate next quotation number
 */
export async function generateQuoteNumber(companyId: number): Promise<string> {
  return generateDocumentNumber({ companyId, prefix: 'COT' });
}

/**
 * Generate next sales order number
 */
export async function generateSaleNumber(companyId: number): Promise<string> {
  return generateDocumentNumber({ companyId, prefix: 'OV' });
}

/**
 * Generate next delivery number
 */
export async function generateDeliveryNumber(companyId: number): Promise<string> {
  return generateDocumentNumber({ companyId, prefix: 'ENT' });
}

/**
 * Generate next remito number
 */
export async function generateRemitoNumber(companyId: number): Promise<string> {
  return generateDocumentNumber({ companyId, prefix: 'REM' });
}

/**
 * Generate next invoice number based on type
 */
export async function generateInvoiceNumber(companyId: number, tipo: 'A' | 'B' | 'C' | 'NV'): Promise<string> {
  const prefix: DocumentType = tipo === 'NV' ? 'NV' : `FC${tipo}` as DocumentType;
  return generateDocumentNumber({ companyId, prefix });
}

/**
 * Generate next payment receipt number
 */
export async function generatePaymentNumber(companyId: number): Promise<string> {
  return generateDocumentNumber({ companyId, prefix: 'REC' });
}

/**
 * Generate next credit note number
 */
export async function generateCreditNoteNumber(companyId: number): Promise<string> {
  return generateDocumentNumber({ companyId, prefix: 'NC' });
}

/**
 * Generate next debit note number
 */
export async function generateDebitNoteNumber(companyId: number): Promise<string> {
  return generateDocumentNumber({ companyId, prefix: 'ND' });
}
