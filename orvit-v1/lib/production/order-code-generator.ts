import { prisma } from '@/lib/prisma';

/**
 * Genera un código único para una orden de producción
 * Formato: OP-YYYY-NNNNN (ej: OP-2025-00001)
 */
export async function generateOrderCode(companyId: number): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `OP-${year}-`;

  // Buscar la última orden del año actual para esta empresa
  const lastOrder = await prisma.productionOrder.findFirst({
    where: {
      companyId,
      code: { startsWith: prefix }
    },
    orderBy: { code: 'desc' },
    select: { code: true }
  });

  let nextNumber = 1;
  if (lastOrder?.code) {
    // Extraer el número de la última orden
    const lastNumberStr = lastOrder.code.replace(prefix, '');
    const lastNumber = parseInt(lastNumberStr, 10);
    if (!isNaN(lastNumber)) {
      nextNumber = lastNumber + 1;
    }
  }

  // Formatear con ceros a la izquierda (5 dígitos)
  const code = `${prefix}${nextNumber.toString().padStart(5, '0')}`;

  return code;
}

/**
 * Genera un código único para un lote de producción
 * Formato: L-YYYY-MM-NNNNN (ej: L-2025-01-00001)
 */
export async function generateLotCode(companyId: number): Promise<string> {
  const now = new Date();
  const year = now.getFullYear();
  const month = (now.getMonth() + 1).toString().padStart(2, '0');
  const prefix = `L-${year}-${month}-`;

  // Buscar el último lote del mes actual para esta empresa
  const lastLot = await prisma.productionBatchLot.findFirst({
    where: {
      companyId,
      lotCode: { startsWith: prefix }
    },
    orderBy: { lotCode: 'desc' },
    select: { lotCode: true }
  });

  let nextNumber = 1;
  if (lastLot?.lotCode) {
    const lastNumberStr = lastLot.lotCode.replace(prefix, '');
    const lastNumber = parseInt(lastNumberStr, 10);
    if (!isNaN(lastNumber)) {
      nextNumber = lastNumber + 1;
    }
  }

  const lotCode = `${prefix}${nextNumber.toString().padStart(5, '0')}`;

  return lotCode;
}
