/**
 * Cliente Prisma para Base de Datos T2 (documentos internos)
 *
 * Esta BD es independiente y solo se usa cuando:
 * 1. DATABASE_URL_T2 está configurada
 * 2. El usuario tiene permiso view.extended
 * 3. La empresa tiene t2DbEnabled = true
 */

// El import del cliente T2 generado
// Nota: Generar con: npx prisma generate --schema=prisma/schema-t2.prisma
let PrismaClientT2: any;

try {
  // Dynamic import para evitar errores si el cliente T2 no existe
  PrismaClientT2 = require('@prisma/client-t2').PrismaClient;
} catch {
  // Cliente T2 no generado aún - se manejará en runtime
  PrismaClientT2 = null;
}

const globalForPrismaT2 = globalThis as unknown as {
  prismaT2: any | undefined;
};

/**
 * Verifica si la BD T2 está configurada y disponible
 */
export function isT2DatabaseConfigured(): boolean {
  return !!process.env.DATABASE_URL_T2 && PrismaClientT2 !== null;
}

/**
 * Cliente Prisma para BD T2
 * Retorna null si no está configurado
 */
function createPrismaT2Client() {
  if (!isT2DatabaseConfigured()) {
    return null;
  }

  // Limitar conexiones en desarrollo para evitar agotamiento del pool
  const baseUrl = process.env.DATABASE_URL_T2 || '';
  const urlWithLimit = process.env.NODE_ENV !== 'production' && !baseUrl.includes('connection_limit')
    ? `${baseUrl}${baseUrl.includes('?') ? '&' : '?'}connection_limit=3`
    : baseUrl;

  return new PrismaClientT2({
    log: ['error', 'warn'],
    ...(process.env.NODE_ENV !== 'production' && {
      datasourceUrl: urlWithLimit,
    }),
  });
}

// Singleton del cliente T2
export const prismaT2 = globalForPrismaT2.prismaT2 ?? createPrismaT2Client();

if (process.env.NODE_ENV !== 'production' && prismaT2) {
  globalForPrismaT2.prismaT2 = prismaT2;
}

/**
 * Helper para obtener el cliente T2 de forma segura
 * Lanza error si T2 no está disponible
 */
export function getT2Client() {
  if (!prismaT2) {
    throw new Error(
      'Base de datos T2 no configurada. ' +
        'Asegurate de tener DATABASE_URL_T2 en .env y haber generado el cliente con: ' +
        'npx prisma generate --schema=prisma/schema-t2.prisma'
    );
  }
  return prismaT2;
}

// Type exports para usar en las APIs
export type {
  T2PurchaseReceipt,
  T2PurchaseReceiptItem,
  T2SupplierAccountMovement,
  T2PaymentOrder,
  T2PaymentOrderReceipt,
  T2StockMovement,
  T2Sale,
  T2SaleItem,
  T2CashMovement,
} from '@prisma/client-t2';
