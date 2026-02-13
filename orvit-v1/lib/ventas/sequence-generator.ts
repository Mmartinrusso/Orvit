/**
 * Sequence Generator - O2C Phase 2
 *
 * Generates document numbers with transactional locks to prevent duplicates.
 * Uses DocumentSequence table with SELECT FOR UPDATE pattern.
 *
 * FEATURES:
 * - Atomic number generation (no duplicates under concurrent load)
 * - Configurable prefixes per document type
 * - Support for punto de venta (AFIP)
 * - Idempotency key support
 */

import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export type SequenceDocType =
  | 'SALE'
  | 'QUOTE'
  | 'DELIVERY'
  | 'REMITO'
  | 'INVOICE_A'
  | 'INVOICE_B'
  | 'INVOICE_C'
  | 'LOADORDER'
  | 'RECEIPT'
  | 'CREDITNOTE'
  | 'DEBITNOTE'
  | 'ACOPIO'
  | 'RETIRO'
  | 'DISPUTE'
  | 'RETURN';

export interface SequenceResult {
  prefix: string;
  number: number;
  formatted: string;
  puntoVenta?: string;
}

export interface SequenceConfig {
  docType: SequenceDocType;
  prefix: string;
  startNumber?: number;
  paddingLength?: number; // Default 8
  puntoVenta?: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// DEFAULT CONFIGURATIONS
// ═══════════════════════════════════════════════════════════════════════════════

const defaultSequenceConfigs: Record<SequenceDocType, { prefix: string; padding: number }> = {
  SALE: { prefix: 'VTA', padding: 8 },
  QUOTE: { prefix: 'COT', padding: 8 },
  DELIVERY: { prefix: 'ENT', padding: 8 },
  REMITO: { prefix: 'REM', padding: 8 },
  INVOICE_A: { prefix: 'FA', padding: 8 },
  INVOICE_B: { prefix: 'FB', padding: 8 },
  INVOICE_C: { prefix: 'FC', padding: 8 },
  LOADORDER: { prefix: 'ORC', padding: 8 }, // ORC = Orden de CaRga
  RECEIPT: { prefix: 'REC', padding: 8 },
  CREDITNOTE: { prefix: 'NC', padding: 8 },
  DEBITNOTE: { prefix: 'ND', padding: 8 },
  ACOPIO: { prefix: 'ACO', padding: 8 },
  RETIRO: { prefix: 'RET', padding: 8 },
  DISPUTE: { prefix: 'DIS', padding: 8 },
  RETURN: { prefix: 'DEV', padding: 8 },
};

// ═══════════════════════════════════════════════════════════════════════════════
// CORE FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Get the next document number with transactional lock.
 *
 * IMPORTANT: This function uses Serializable isolation to prevent race conditions.
 * Under high concurrency, it will serialize requests to ensure unique numbers.
 *
 * @param companyId - Company ID
 * @param docType - Document type
 * @param puntoVenta - Optional punto de venta (for AFIP invoices)
 * @returns SequenceResult with formatted number
 */
export async function getNextNumber(
  companyId: number,
  docType: SequenceDocType,
  puntoVenta?: string
): Promise<SequenceResult> {
  const pvKey = puntoVenta || '';

  return await prisma.$transaction(
    async (tx) => {
      // Try to get existing sequence with lock
      const existingSeq = await tx.documentSequence.findUnique({
        where: {
          companyId_docType_puntoVenta: {
            companyId,
            docType,
            puntoVenta: pvKey,
          },
        },
      });

      if (existingSeq) {
        // Increment and return
        const updated = await tx.documentSequence.update({
          where: { id: existingSeq.id },
          data: { nextNumber: existingSeq.nextNumber + 1 },
        });

        const config = defaultSequenceConfigs[docType];
        const formatted = formatNumber(
          existingSeq.prefix,
          existingSeq.nextNumber,
          config.padding,
          puntoVenta
        );

        return {
          prefix: existingSeq.prefix,
          number: existingSeq.nextNumber,
          formatted,
          puntoVenta: puntoVenta || undefined,
        };
      }

      // Create new sequence if doesn't exist
      const config = defaultSequenceConfigs[docType];
      const newSeq = await tx.documentSequence.create({
        data: {
          companyId,
          docType,
          puntoVenta: pvKey,
          prefix: config.prefix,
          nextNumber: 2, // We return 1, next will be 2
        },
      });

      const formatted = formatNumber(config.prefix, 1, config.padding, puntoVenta);

      return {
        prefix: config.prefix,
        number: 1,
        formatted,
        puntoVenta: puntoVenta || undefined,
      };
    },
    {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      timeout: 10000, // 10 second timeout
    }
  );
}

/**
 * Format a document number with padding
 */
export function formatNumber(
  prefix: string,
  number: number,
  padding: number = 8,
  puntoVenta?: string
): string {
  const paddedNumber = String(number).padStart(padding, '0');

  if (puntoVenta) {
    // AFIP format: FA A 0001-00000001
    return `${prefix}-${puntoVenta}-${paddedNumber}`;
  }

  return `${prefix}-${paddedNumber}`;
}

// ═══════════════════════════════════════════════════════════════════════════════
// BATCH AND PREVIEW
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Preview the next number without consuming it.
 * Useful for showing what number will be assigned.
 *
 * NOTE: This is NOT guaranteed - another user could get this number
 * before you do. Use getNextNumber for actual assignment.
 */
export async function previewNextNumber(
  companyId: number,
  docType: SequenceDocType,
  puntoVenta?: string
): Promise<SequenceResult> {
  const pvKey = puntoVenta || '';

  const seq = await prisma.documentSequence.findUnique({
    where: {
      companyId_docType_puntoVenta: {
        companyId,
        docType,
        puntoVenta: pvKey,
      },
    },
  });

  const config = defaultSequenceConfigs[docType];
  const number = seq?.nextNumber ?? 1;
  const prefix = seq?.prefix ?? config.prefix;
  const formatted = formatNumber(prefix, number, config.padding, puntoVenta);

  return {
    prefix,
    number,
    formatted,
    puntoVenta: puntoVenta || undefined,
  };
}

/**
 * Reserve multiple numbers at once.
 * Useful for bulk operations.
 */
export async function reserveNumbers(
  companyId: number,
  docType: SequenceDocType,
  count: number,
  puntoVenta?: string
): Promise<SequenceResult[]> {
  if (count < 1 || count > 100) {
    throw new Error('Count must be between 1 and 100');
  }

  const pvKey = puntoVenta || '';

  return await prisma.$transaction(
    async (tx) => {
      // Get or create sequence
      let seq = await tx.documentSequence.findUnique({
        where: {
          companyId_docType_puntoVenta: {
            companyId,
            docType,
            puntoVenta: pvKey,
          },
        },
      });

      const config = defaultSequenceConfigs[docType];

      if (!seq) {
        seq = await tx.documentSequence.create({
          data: {
            companyId,
            docType,
            puntoVenta: pvKey,
            prefix: config.prefix,
            nextNumber: count + 1,
          },
        });

        // Return numbers 1 to count
        return Array.from({ length: count }, (_, i) => {
          const num = i + 1;
          return {
            prefix: config.prefix,
            number: num,
            formatted: formatNumber(config.prefix, num, config.padding, puntoVenta),
            puntoVenta: puntoVenta || undefined,
          };
        });
      }

      // Reserve range
      const startNumber = seq.nextNumber;
      const endNumber = startNumber + count;

      await tx.documentSequence.update({
        where: { id: seq.id },
        data: { nextNumber: endNumber },
      });

      return Array.from({ length: count }, (_, i) => {
        const num = startNumber + i;
        return {
          prefix: seq!.prefix,
          number: num,
          formatted: formatNumber(seq!.prefix, num, config.padding, puntoVenta),
          puntoVenta: puntoVenta || undefined,
        };
      });
    },
    {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      timeout: 15000,
    }
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Initialize or update sequence configuration for a company.
 * Call this when setting up a new company or changing prefixes.
 */
export async function initializeSequence(
  companyId: number,
  config: SequenceConfig
): Promise<void> {
  const pvKey = config.puntoVenta || '';

  await prisma.documentSequence.upsert({
    where: {
      companyId_docType_puntoVenta: {
        companyId,
        docType: config.docType,
        puntoVenta: pvKey,
      },
    },
    create: {
      companyId,
      docType: config.docType,
      puntoVenta: pvKey,
      prefix: config.prefix,
      nextNumber: config.startNumber || 1,
    },
    update: {
      prefix: config.prefix,
      // Don't update nextNumber if it would go backwards
    },
  });
}

/**
 * Update the prefix for a sequence.
 * Does not affect the counter.
 */
export async function updateSequencePrefix(
  companyId: number,
  docType: SequenceDocType,
  newPrefix: string,
  puntoVenta?: string
): Promise<void> {
  const pvKey = puntoVenta || '';

  await prisma.documentSequence.update({
    where: {
      companyId_docType_puntoVenta: {
        companyId,
        docType,
        puntoVenta: pvKey,
      },
    },
    data: { prefix: newPrefix },
  });
}

/**
 * Reset a sequence to a specific number.
 * USE WITH CAUTION - can cause duplicate numbers if not careful.
 * Typically only used for testing or migration.
 */
export async function resetSequence(
  companyId: number,
  docType: SequenceDocType,
  newNextNumber: number,
  puntoVenta?: string
): Promise<void> {
  if (newNextNumber < 1) {
    throw new Error('Next number must be at least 1');
  }

  const pvKey = puntoVenta || '';

  await prisma.documentSequence.update({
    where: {
      companyId_docType_puntoVenta: {
        companyId,
        docType,
        puntoVenta: pvKey,
      },
    },
    data: { nextNumber: newNextNumber },
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// IDEMPOTENCY SUPPORT
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Get or create a number with idempotency key.
 * If the key exists, returns the previously generated number.
 * If not, generates a new number and saves the result.
 */
export async function getOrCreateNumber(
  companyId: number,
  docType: SequenceDocType,
  idempotencyKey: string,
  puntoVenta?: string
): Promise<{ result: SequenceResult; wasReplay: boolean }> {
  // Check for existing idempotency record
  const existing = await prisma.idempotencyKey.findUnique({
    where: { key: idempotencyKey },
  });

  if (existing) {
    const result = existing.response as unknown as SequenceResult;
    return { result, wasReplay: true };
  }

  // Generate new number
  const result = await getNextNumber(companyId, docType, puntoVenta);

  // Save idempotency record
  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + 24); // 24 hour expiry

  try {
    await prisma.idempotencyKey.create({
      data: {
        key: idempotencyKey,
        response: result as unknown as Prisma.JsonObject,
        expiresAt,
      },
    });
  } catch (error) {
    // If duplicate key, another request beat us - fetch their result
    const duplicate = await prisma.idempotencyKey.findUnique({
      where: { key: idempotencyKey },
    });
    if (duplicate) {
      return {
        result: duplicate.response as unknown as SequenceResult,
        wasReplay: true,
      };
    }
    throw error;
  }

  return { result, wasReplay: false };
}

// ═══════════════════════════════════════════════════════════════════════════════
// UTILITIES
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Parse a formatted document number back to its components.
 */
export function parseDocumentNumber(formatted: string): {
  prefix: string;
  puntoVenta?: string;
  number: number;
} | null {
  // Try AFIP format: FA-0001-00000001
  const afipMatch = formatted.match(/^([A-Z]+)-(\d+)-(\d+)$/);
  if (afipMatch) {
    return {
      prefix: afipMatch[1],
      puntoVenta: afipMatch[2],
      number: parseInt(afipMatch[3], 10),
    };
  }

  // Try simple format: VTA-00000001
  const simpleMatch = formatted.match(/^([A-Z]+)-(\d+)$/);
  if (simpleMatch) {
    return {
      prefix: simpleMatch[1],
      number: parseInt(simpleMatch[2], 10),
    };
  }

  return null;
}

/**
 * Get current sequence status for all document types of a company.
 */
export async function getSequenceStatus(companyId: number): Promise<
  Array<{
    docType: string;
    puntoVenta: string | null;
    prefix: string;
    nextNumber: number;
    formatted: string;
  }>
> {
  const sequences = await prisma.documentSequence.findMany({
    where: { companyId },
    orderBy: { docType: 'asc' },
  });

  return sequences.map((seq) => {
    const config = defaultSequenceConfigs[seq.docType as SequenceDocType];
    const padding = config?.padding || 8;

    return {
      docType: seq.docType,
      puntoVenta: seq.puntoVenta || null,
      prefix: seq.prefix,
      nextNumber: seq.nextNumber,
      formatted: formatNumber(
        seq.prefix,
        seq.nextNumber,
        padding,
        seq.puntoVenta || undefined
      ),
    };
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// SIMPLIFIED API
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Simplified function to generate a sequential number for any document type.
 * Maps simple document type names to the internal SequenceDocType.
 *
 * @param companyId - Company ID
 * @param prefix - Simple prefix (e.g., 'OC', 'VTA', 'COT')
 * @param documentType - Document type identifier
 * @returns Formatted number string
 */
export async function generateSequentialNumber(
  companyId: number,
  prefix: string,
  documentType: string
): Promise<string> {
  // Map common prefixes to SequenceDocType
  const typeMap: Record<string, SequenceDocType> = {
    sale: 'SALE',
    vta: 'SALE',
    quote: 'QUOTE',
    cot: 'QUOTE',
    delivery: 'DELIVERY',
    ent: 'DELIVERY',
    remito: 'REMITO',
    rem: 'REMITO',
    loadorder: 'LOADORDER',
    loadOrder: 'LOADORDER',
    oc: 'LOADORDER',
    orc: 'LOADORDER',
    receipt: 'RECEIPT',
    rec: 'RECEIPT',
    creditnote: 'CREDITNOTE',
    nc: 'CREDITNOTE',
    debitnote: 'DEBITNOTE',
    nd: 'DEBITNOTE',
    acopio: 'ACOPIO',
    aco: 'ACOPIO',
    retiro: 'RETIRO',
    ret: 'RETIRO',
    dispute: 'DISPUTE',
    dis: 'DISPUTE',
    return: 'RETURN',
    dev: 'RETURN',
  };

  const docType = typeMap[documentType.toLowerCase()] || 'LOADORDER';

  const result = await getNextNumber(companyId, docType);

  // Use the provided prefix if different from default
  if (prefix && prefix.toUpperCase() !== result.prefix) {
    const config = defaultSequenceConfigs[docType];
    return formatNumber(prefix, result.number, config.padding);
  }

  return result.formatted;
}
