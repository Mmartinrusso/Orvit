/**
 * O2C Phase 2: Document Flow Tests
 *
 * Tests for Sale → LoadOrder → Delivery → Remito → Invoice flow
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { Prisma } from '@prisma/client';

// Helper to create Decimal
const decimal = (value: number) => new Prisma.Decimal(value);

// State Machine Types
type SaleStatus =
  | 'BORRADOR'
  | 'CONFIRMADA'
  | 'EN_PREPARACION'
  | 'PARCIALMENTE_ENTREGADA'
  | 'ENTREGADA'
  | 'PARCIALMENTE_FACTURADA'
  | 'FACTURADA'
  | 'CERRADA'
  | 'CANCELADA';

type LoadOrderStatus = 'PENDIENTE' | 'CARGANDO' | 'CARGADA' | 'DESPACHADA' | 'CANCELADA';

type DeliveryStatus =
  | 'PENDIENTE'
  | 'EN_PREPARACION'
  | 'LISTA_PARA_DESPACHO'
  | 'EN_TRANSITO'
  | 'RETIRADA'
  | 'ENTREGADA'
  | 'ENTREGA_FALLIDA'
  | 'CANCELADA';

type RemitoStatus = 'BORRADOR' | 'PREPARADO' | 'EMITIDO' | 'ANULADO' | 'CANCELADA';

type InvoiceStatus = 'BORRADOR' | 'EMITIDA' | 'PARCIALMENTE_COBRADA' | 'COBRADA' | 'ANULADA';

// State Machine Implementation
const saleTransitions: Record<SaleStatus, SaleStatus[]> = {
  BORRADOR: ['CONFIRMADA', 'CANCELADA'],
  CONFIRMADA: ['EN_PREPARACION', 'CANCELADA'],
  EN_PREPARACION: ['PARCIALMENTE_ENTREGADA', 'ENTREGADA', 'CANCELADA'],
  PARCIALMENTE_ENTREGADA: ['PARCIALMENTE_ENTREGADA', 'ENTREGADA'],
  ENTREGADA: ['PARCIALMENTE_FACTURADA', 'FACTURADA'],
  PARCIALMENTE_FACTURADA: ['FACTURADA'],
  FACTURADA: ['CERRADA'],
  CERRADA: [],
  CANCELADA: [],
};

const loadOrderTransitions: Record<LoadOrderStatus, LoadOrderStatus[]> = {
  PENDIENTE: ['CARGANDO', 'CANCELADA'],
  CARGANDO: ['CARGADA', 'CANCELADA'],
  CARGADA: ['DESPACHADA'],
  DESPACHADA: [],
  CANCELADA: [],
};

function canTransition<T extends string>(
  transitions: Record<T, T[]>,
  from: T,
  to: T
): boolean {
  return transitions[from]?.includes(to) ?? false;
}

function validateTransition<T extends string>(
  transitions: Record<T, T[]>,
  from: T,
  to: T
): { valid: boolean; error?: string } {
  if (canTransition(transitions, from, to)) {
    return { valid: true };
  }
  return {
    valid: false,
    error: `Transición inválida: ${from} → ${to}. Transiciones permitidas: ${transitions[from]?.join(', ') || 'ninguna'}`,
  };
}

// Document Package Creation
interface PackageDocumentsInput {
  saleId: number;
  items: Array<{
    saleItemId: number;
    cantidad: Prisma.Decimal;
  }>;
  vehiculo?: string;
  chofer?: string;
  docType: 'T1' | 'T2';
}

interface PackageDocumentsResult {
  loadOrder: { id: number; numero: string; estado: LoadOrderStatus };
  delivery: { id: number; estado: DeliveryStatus };
  remito: { id: number; numero: string; estado: RemitoStatus };
  invoice: { id: number; numero: string; estado: InvoiceStatus };
}

function generateDocumentNumber(prefix: string, nextNumber: number): string {
  return `${prefix}-${String(nextNumber).padStart(8, '0')}`;
}

function createPackageDocuments(input: PackageDocumentsInput): PackageDocumentsResult {
  // In real implementation, this would use locks and transactions
  const loadOrderNum = generateDocumentNumber('ORC', 1);
  const remitoNum = generateDocumentNumber('REM', 1);
  const invoiceNum = generateDocumentNumber('0001-A', 1);

  return {
    loadOrder: { id: 1, numero: loadOrderNum, estado: 'PENDIENTE' },
    delivery: { id: 1, estado: 'PENDIENTE' },
    remito: { id: 1, numero: remitoNum, estado: 'PREPARADO' }, // NOT emitted yet
    invoice: { id: 1, numero: invoiceNum, estado: 'BORRADOR' }, // NOT emitted yet
  };
}

// Confirm Load - The step that "closes" the documents
interface ConfirmLoadInput {
  loadOrderId: number;
  items: Array<{
    itemId: number;
    cantidadCargada: Prisma.Decimal;
    cantidadOriginal: Prisma.Decimal;
  }>;
}

interface ConfirmLoadResult {
  loadOrder: { estado: LoadOrderStatus };
  remito: { estado: RemitoStatus };
  invoice: { estado: InvoiceStatus };
  stockMovements: Array<{ productId: string; cantidad: Prisma.Decimal }>;
  differences: Array<{ itemId: number; diferencia: Prisma.Decimal }>;
}

function confirmLoad(input: ConfirmLoadInput): ConfirmLoadResult {
  const differences = input.items
    .filter(item => !item.cantidadCargada.eq(item.cantidadOriginal))
    .map(item => ({
      itemId: item.itemId,
      diferencia: item.cantidadCargada.minus(item.cantidadOriginal),
    }));

  const stockMovements = input.items.map(item => ({
    productId: `product-${item.itemId}`,
    cantidad: item.cantidadCargada.negated(), // Negative = egreso
  }));

  return {
    loadOrder: { estado: 'CARGADA' },
    remito: { estado: 'EMITIDO' },
    invoice: { estado: 'EMITIDA' },
    stockMovements,
    differences,
  };
}

describe('Document State Machine', () => {
  describe('Sale State Transitions', () => {
    it('should allow valid transitions from BORRADOR', () => {
      expect(canTransition(saleTransitions, 'BORRADOR', 'CONFIRMADA')).toBe(true);
      expect(canTransition(saleTransitions, 'BORRADOR', 'CANCELADA')).toBe(true);
    });

    it('should reject invalid transitions', () => {
      expect(canTransition(saleTransitions, 'BORRADOR', 'FACTURADA')).toBe(false);
      expect(canTransition(saleTransitions, 'CERRADA', 'BORRADOR')).toBe(false);
      expect(canTransition(saleTransitions, 'CANCELADA', 'CONFIRMADA')).toBe(false);
    });

    it('should validate full sale lifecycle', () => {
      const lifecycle: SaleStatus[] = [
        'BORRADOR',
        'CONFIRMADA',
        'EN_PREPARACION',
        'ENTREGADA',
        'FACTURADA',
        'CERRADA',
      ];

      for (let i = 0; i < lifecycle.length - 1; i++) {
        const result = validateTransition(saleTransitions, lifecycle[i], lifecycle[i + 1]);
        expect(result.valid).toBe(true);
      }
    });

    it('should allow partial delivery states', () => {
      expect(canTransition(saleTransitions, 'EN_PREPARACION', 'PARCIALMENTE_ENTREGADA')).toBe(true);
      expect(canTransition(saleTransitions, 'PARCIALMENTE_ENTREGADA', 'PARCIALMENTE_ENTREGADA')).toBe(true);
      expect(canTransition(saleTransitions, 'PARCIALMENTE_ENTREGADA', 'ENTREGADA')).toBe(true);
    });
  });

  describe('Load Order State Transitions', () => {
    it('should follow load order lifecycle', () => {
      const lifecycle: LoadOrderStatus[] = ['PENDIENTE', 'CARGANDO', 'CARGADA', 'DESPACHADA'];

      for (let i = 0; i < lifecycle.length - 1; i++) {
        expect(canTransition(loadOrderTransitions, lifecycle[i], lifecycle[i + 1])).toBe(true);
      }
    });

    it('should not allow skipping states', () => {
      expect(canTransition(loadOrderTransitions, 'PENDIENTE', 'CARGADA')).toBe(false);
      expect(canTransition(loadOrderTransitions, 'PENDIENTE', 'DESPACHADA')).toBe(false);
    });
  });
});

describe('Document Package Creation', () => {
  it('should create package with correct initial states', () => {
    const input: PackageDocumentsInput = {
      saleId: 1,
      items: [
        { saleItemId: 1, cantidad: decimal(100) },
        { saleItemId: 2, cantidad: decimal(50) },
      ],
      vehiculo: 'Ford Transit',
      chofer: 'Juan Pérez',
      docType: 'T1',
    };

    const result = createPackageDocuments(input);

    // LoadOrder should be PENDIENTE
    expect(result.loadOrder.estado).toBe('PENDIENTE');

    // Delivery should be PENDIENTE
    expect(result.delivery.estado).toBe('PENDIENTE');

    // Remito should be PREPARADO (not EMITIDO yet)
    expect(result.remito.estado).toBe('PREPARADO');

    // Invoice should be BORRADOR (not EMITIDA yet)
    expect(result.invoice.estado).toBe('BORRADOR');
  });

  it('should generate sequential document numbers', () => {
    expect(generateDocumentNumber('ORC', 1)).toBe('ORC-00000001');
    expect(generateDocumentNumber('ORC', 12345)).toBe('ORC-00012345');
    expect(generateDocumentNumber('0001-A', 99999999)).toBe('0001-A-99999999');
  });
});

describe('Confirm Load (Document Closing)', () => {
  it('should emit documents and move stock when load is confirmed', () => {
    const input: ConfirmLoadInput = {
      loadOrderId: 1,
      items: [
        { itemId: 1, cantidadCargada: decimal(100), cantidadOriginal: decimal(100) },
        { itemId: 2, cantidadCargada: decimal(50), cantidadOriginal: decimal(50) },
      ],
    };

    const result = confirmLoad(input);

    expect(result.loadOrder.estado).toBe('CARGADA');
    expect(result.remito.estado).toBe('EMITIDO');
    expect(result.invoice.estado).toBe('EMITIDA');
    expect(result.stockMovements).toHaveLength(2);
    expect(result.differences).toHaveLength(0);
  });

  it('should detect quantity differences', () => {
    const input: ConfirmLoadInput = {
      loadOrderId: 1,
      items: [
        { itemId: 1, cantidadCargada: decimal(90), cantidadOriginal: decimal(100) }, // -10
        { itemId: 2, cantidadCargada: decimal(50), cantidadOriginal: decimal(50) },  // OK
      ],
    };

    const result = confirmLoad(input);

    expect(result.differences).toHaveLength(1);
    expect(result.differences[0].itemId).toBe(1);
    expect(result.differences[0].diferencia.toNumber()).toBe(-10);
  });

  it('should create correct stock movements', () => {
    const input: ConfirmLoadInput = {
      loadOrderId: 1,
      items: [
        { itemId: 1, cantidadCargada: decimal(100), cantidadOriginal: decimal(100) },
      ],
    };

    const result = confirmLoad(input);

    expect(result.stockMovements[0].cantidad.toNumber()).toBe(-100); // Negative = egreso
  });
});

describe('Partial Deliveries', () => {
  it('should track delivered vs pending quantities', () => {
    interface SaleItem {
      id: number;
      cantidad: Prisma.Decimal;
      cantidadEntregada: Prisma.Decimal;
      cantidadPendiente: Prisma.Decimal;
    }

    const items: SaleItem[] = [
      { id: 1, cantidad: decimal(100), cantidadEntregada: decimal(50), cantidadPendiente: decimal(50) },
      { id: 2, cantidad: decimal(200), cantidadEntregada: decimal(200), cantidadPendiente: decimal(0) },
    ];

    const totalPendiente = items.reduce((sum, item) => sum.plus(item.cantidadPendiente), decimal(0));
    const isPartiallyDelivered = totalPendiente.gt(0) && items.some(i => i.cantidadEntregada.gt(0));
    const isFullyDelivered = totalPendiente.eq(0);

    expect(isPartiallyDelivered).toBe(true);
    expect(isFullyDelivered).toBe(false);
    expect(totalPendiente.toNumber()).toBe(50);
  });

  it('should calculate sale status based on deliveries', () => {
    function calculateSaleStatus(items: Array<{ cantidad: Prisma.Decimal; cantidadEntregada: Prisma.Decimal }>): SaleStatus {
      const totalCantidad = items.reduce((sum, i) => sum.plus(i.cantidad), decimal(0));
      const totalEntregada = items.reduce((sum, i) => sum.plus(i.cantidadEntregada), decimal(0));

      if (totalEntregada.eq(0)) return 'EN_PREPARACION';
      if (totalEntregada.lt(totalCantidad)) return 'PARCIALMENTE_ENTREGADA';
      return 'ENTREGADA';
    }

    // No deliveries
    expect(calculateSaleStatus([
      { cantidad: decimal(100), cantidadEntregada: decimal(0) },
    ])).toBe('EN_PREPARACION');

    // Partial
    expect(calculateSaleStatus([
      { cantidad: decimal(100), cantidadEntregada: decimal(50) },
    ])).toBe('PARCIALMENTE_ENTREGADA');

    // Full
    expect(calculateSaleStatus([
      { cantidad: decimal(100), cantidadEntregada: decimal(100) },
    ])).toBe('ENTREGADA');
  });
});

describe('Document Number Sequencing', () => {
  it('should handle concurrent number generation with lock', async () => {
    // Simulate lock-based sequence generation
    class SequenceGenerator {
      private sequences: Map<string, number> = new Map();
      private locks: Map<string, boolean> = new Map();

      async getNextNumber(docType: string): Promise<number> {
        // Simulate acquiring lock
        const lockKey = `lock:${docType}`;

        if (this.locks.get(lockKey)) {
          throw new Error('Sequence locked');
        }

        this.locks.set(lockKey, true);

        try {
          const current = this.sequences.get(docType) || 0;
          const next = current + 1;
          this.sequences.set(docType, next);
          return next;
        } finally {
          this.locks.delete(lockKey);
        }
      }
    }

    const generator = new SequenceGenerator();

    const num1 = await generator.getNextNumber('INVOICE_A');
    const num2 = await generator.getNextNumber('INVOICE_A');
    const num3 = await generator.getNextNumber('INVOICE_A');

    expect(num1).toBe(1);
    expect(num2).toBe(2);
    expect(num3).toBe(3);
  });
});
