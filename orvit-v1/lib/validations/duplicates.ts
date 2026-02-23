/**
 * Detección mejorada de duplicados para facturas
 * Incluye check por número exacto, CAE y heurísticas
 */
import { prisma } from '@/lib/prisma';
import type { AIExtraction } from '@/lib/schemas/ai-extraction';

export type DuplicateConfidence = 'confirmed' | 'probable' | 'none';

export interface DuplicateCheck {
  isDuplicate: boolean;
  confidence: DuplicateConfidence;
  matchedReceipt?: {
    id: number;
    numero: string;
    proveedor: string;
    total: number;
    fecha: Date;
  };
  reason?: string;
}

/**
 * Verifica si una factura ya existe en el sistema
 * Orden de checks:
 * 1. Número exacto (punto_venta + numero) → confirmed
 * 2. CAE exacto → confirmed
 * 3. Heurística (mismo total + fecha cercana + punto_venta) → probable
 */
export async function checkDuplicate(
  extraction: AIExtraction,
  companyId: number,
  excludeReceiptId?: number
): Promise<DuplicateCheck> {
  const puntoVenta = extraction.punto_venta || '';
  const numeroComprobante = extraction.numero_comprobante || '';

  // Condición de exclusión (para edición)
  const excludeCondition = excludeReceiptId ? { NOT: { id: excludeReceiptId } } : {};

  // Check 1: Número exacto (confirmado)
  if (puntoVenta && numeroComprobante) {
    const exactMatch = await prisma.purchaseReceipt.findFirst({
      where: {
        companyId,
        numeroSerie: puntoVenta,
        numeroFactura: numeroComprobante,
        ...excludeCondition
      },
      select: {
        id: true,
        numeroSerie: true,
        numeroFactura: true,
        total: true,
        fechaEmision: true,
        proveedor: {
          select: { name: true }
        }
      }
    });

    if (exactMatch) {
      return {
        isDuplicate: true,
        confidence: 'confirmed',
        matchedReceipt: {
          id: exactMatch.id,
          numero: `${exactMatch.numeroSerie}-${exactMatch.numeroFactura}`,
          proveedor: exactMatch.proveedor.name,
          total: Number(exactMatch.total),
          fecha: exactMatch.fechaEmision
        },
        reason: 'Número de factura ya existe en el sistema'
      };
    }
  }

  // Check 2: CAE exacto (confirmado)
  if (extraction.cae) {
    const caeMatch = await prisma.purchaseReceipt.findFirst({
      where: {
        companyId,
        cae: extraction.cae,
        ...excludeCondition
      },
      select: {
        id: true,
        numeroSerie: true,
        numeroFactura: true,
        total: true,
        fechaEmision: true,
        proveedor: {
          select: { name: true }
        }
      }
    });

    if (caeMatch) {
      return {
        isDuplicate: true,
        confidence: 'confirmed',
        matchedReceipt: {
          id: caeMatch.id,
          numero: `${caeMatch.numeroSerie}-${caeMatch.numeroFactura}`,
          proveedor: caeMatch.proveedor.name,
          total: Number(caeMatch.total),
          fecha: caeMatch.fechaEmision
        },
        reason: 'CAE ya registrado en el sistema'
      };
    }
  }

  // Check 3: Heurística (probable)
  // Mismo punto de venta + mismo total + fecha cercana (±2 días)
  if (extraction.fecha_emision && extraction.total > 0 && puntoVenta) {
    const fechaBase = new Date(extraction.fecha_emision);
    if (!isNaN(fechaBase.getTime())) {
      const fechaMin = new Date(fechaBase);
      fechaMin.setDate(fechaMin.getDate() - 2);
      const fechaMax = new Date(fechaBase);
      fechaMax.setDate(fechaMax.getDate() + 2);

      // Tolerancia de $0.01 en el total para evitar problemas de decimales
      const totalMin = extraction.total - 0.01;
      const totalMax = extraction.total + 0.01;

      const probableMatch = await prisma.purchaseReceipt.findFirst({
        where: {
          companyId,
          total: {
            gte: totalMin,
            lte: totalMax
          },
          numeroSerie: puntoVenta,
          fechaEmision: {
            gte: fechaMin,
            lte: fechaMax
          },
          ...excludeCondition
        },
        select: {
          id: true,
          numeroSerie: true,
          numeroFactura: true,
          total: true,
          fechaEmision: true,
          proveedor: {
            select: { name: true }
          }
        }
      });

      if (probableMatch) {
        return {
          isDuplicate: true,
          confidence: 'probable',
          matchedReceipt: {
            id: probableMatch.id,
            numero: `${probableMatch.numeroSerie}-${probableMatch.numeroFactura}`,
            proveedor: probableMatch.proveedor.name,
            total: Number(probableMatch.total),
            fecha: probableMatch.fechaEmision
          },
          reason: 'Mismo punto de venta, total y fecha similar - posible duplicado'
        };
      }
    }
  }

  return {
    isDuplicate: false,
    confidence: 'none'
  };
}

/**
 * Verifica CUIT mismatch cuando hay un proveedor pre-seleccionado
 */
export interface CUITMismatch {
  hasMismatch: boolean;
  selectedSupplierCuit: string;
  extractedCuit: string;
  selectedSupplierName: string;
  extractedSupplierName?: string;
}

export async function checkCUITMismatch(
  extraction: AIExtraction,
  selectedSupplierId: number
): Promise<CUITMismatch | null> {
  if (!extraction.proveedor?.cuit) {
    return null;
  }

  const selectedSupplier = await prisma.suppliers.findUnique({
    where: { id: selectedSupplierId },
    select: { cuit: true, name: true }
  });

  if (!selectedSupplier?.cuit) {
    return null;
  }

  // Normalizar CUITs (quitar guiones)
  const extractedCuit = extraction.proveedor.cuit.replace(/-/g, '');
  const selectedCuit = selectedSupplier.cuit.replace(/-/g, '');

  if (extractedCuit !== selectedCuit) {
    return {
      hasMismatch: true,
      selectedSupplierCuit: selectedSupplier.cuit,
      extractedCuit: extraction.proveedor.cuit,
      selectedSupplierName: selectedSupplier.name,
      extractedSupplierName: extraction.proveedor.razon_social
    };
  }

  return null;
}

/**
 * Busca proveedor existente por CUIT
 */
export async function findSupplierByCuit(
  cuit: string,
  companyId: number
): Promise<{ id: number; name: string; cuit: string } | null> {
  if (!cuit) return null;

  // Normalizar CUIT
  const normalizedCuit = cuit.replace(/-/g, '');

  const supplier = await prisma.suppliers.findFirst({
    where: {
      company_id: companyId,
      OR: [
        { cuit: cuit },
        { cuit: normalizedCuit },
        // Formato con guiones
        { cuit: `${normalizedCuit.slice(0, 2)}-${normalizedCuit.slice(2, 10)}-${normalizedCuit.slice(10)}` }
      ]
    },
    select: {
      id: true,
      name: true,
      cuit: true
    }
  });

  return supplier;
}
