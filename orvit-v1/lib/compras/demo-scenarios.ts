/**
 * Demo Scenarios - Generador de escenarios de prueba para el sistema P2P
 *
 * Este módulo crea datos de prueba realistas para todos los escenarios
 * posibles del flujo de compras: OC → Recepción → Factura → Match → Pago
 *
 * NOTA: Los documentos se crean sin items detallados para simplificar
 * la generación y evitar dependencias complejas con SupplierItem.
 */

import { PrismaClient } from '@prisma/client';

// ============================================================
// TIPOS Y CONFIGURACIÓN
// ============================================================

export interface ScenarioResult {
  scenario: string;
  description: string;
  created: {
    type: string;
    id: number;
    numero?: string;
  }[];
  success: boolean;
  error?: string;
}

export interface DemoSupplier {
  id: number;
  name: string;
  cuit: string;
}

// Proveedores demo
const DEMO_SUPPLIERS = [
  { name: 'Ferretería Industrial SA', cuit: '30-71234567-8' },
  { name: 'Repuestos del Norte SRL', cuit: '30-71234568-9' },
  { name: 'Lubricantes Premium SA', cuit: '30-71234569-0' },
  { name: 'Herramientas Pro SRL', cuit: '30-71234570-1' },
  { name: 'Insumos Agrícolas SA', cuit: '30-71234571-2' },
];

// Items demo (solo para descripciones, no se crean como records)
const DEMO_ITEMS = [
  { codigo: 'FILT-001', descripcion: 'Filtro de aceite universal', precio: 2500 },
  { codigo: 'ACEI-002', descripcion: 'Aceite motor 15W40 x 20L', precio: 45000 },
  { codigo: 'TORN-003', descripcion: 'Tornillo hexagonal 10mm x100', precio: 850 },
  { codigo: 'RODA-004', descripcion: 'Rodamiento 6205-2RS', precio: 3200 },
  { codigo: 'CORR-005', descripcion: 'Correa dentada HTD 8M', precio: 12500 },
];

// ============================================================
// HELPERS
// ============================================================

function generateNumero(prefix: string): string {
  const timestamp = Date.now().toString().slice(-6);
  const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
  return `${prefix}-${timestamp}-${random}`;
}

function randomItem<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomBetween(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function subtractDays(date: Date, days: number): Date {
  return addDays(date, -days);
}

async function getOrCreateSupplier(
  prisma: PrismaClient,
  companyId: number,
  supplierData?: { name: string; cuit: string; notes?: string }
): Promise<{ id: number; name: string }> {
  const data = supplierData || randomItem(DEMO_SUPPLIERS);

  let supplier = await prisma.suppliers.findFirst({
    where: { company_id: companyId, cuit: data.cuit }
  });

  if (!supplier) {
    supplier = await prisma.suppliers.create({
      data: {
        company_id: companyId,
        name: data.name,
        cuit: data.cuit,
        condicion_iva: 'Responsable Inscripto',
        notes: supplierData?.notes, // Only set if provided
      }
    });
  }

  return { id: supplier.id, name: supplier.name };
}

/**
 * Get or create a default warehouse for the company
 */
async function getOrCreateDefaultWarehouse(
  prisma: PrismaClient,
  companyId: number
): Promise<number> {
  let warehouse = await prisma.warehouse.findFirst({
    where: { companyId, isDefault: true }
  });

  if (!warehouse) {
    warehouse = await prisma.warehouse.findFirst({
      where: { companyId }
    });
  }

  if (!warehouse) {
    warehouse = await prisma.warehouse.create({
      data: {
        companyId,
        codigo: 'ALM-001',
        nombre: 'Almacén Principal',
        descripcion: 'Almacén principal de recepción',
        isDefault: true,
        isActive: true,
      }
    });
  }

  return warehouse.id;
}

/**
 * Get or create a default purchase account (tipoCuenta) for the company
 */
async function getOrCreateDefaultTipoCuenta(
  prisma: PrismaClient,
  companyId: number
): Promise<number> {
  // Find first active purchase account
  let tipoCuenta = await prisma.purchaseAccount.findFirst({
    where: { companyId, activa: true }
  });

  if (!tipoCuenta) {
    tipoCuenta = await prisma.purchaseAccount.findFirst({
      where: { companyId }
    });
  }

  if (!tipoCuenta) {
    tipoCuenta = await prisma.purchaseAccount.create({
      data: {
        companyId,
        nombre: 'Proveedores General',
        descripcion: 'Cuenta general de proveedores',
        activa: true,
      }
    });
  }

  return tipoCuenta.id;
}

// ============================================================
// SCENARIO GENERATORS
// ============================================================

/**
 * Escenario 1: Flujo completo OK
 * OC aprobada → Recepción completa → Factura → Match OK → Listo para pagar
 */
export async function createScenarioFlujoCompletoOK(
  prisma: PrismaClient,
  companyId: number,
  userId: number
): Promise<ScenarioResult> {
  const created: ScenarioResult['created'] = [];

  try {
    const supplier = await getOrCreateSupplier(prisma, companyId);
    const warehouseId = await getOrCreateDefaultWarehouse(prisma, companyId);
    const tipoCuentaId = await getOrCreateDefaultTipoCuenta(prisma, companyId);
    const subtotal = randomBetween(50000, 200000);
    const iva = subtotal * 0.21;
    const total = subtotal + iva;

    // 1. Crear OC
    const ocNumero = generateNumero('OC');
    const oc = await prisma.purchaseOrder.create({
      data: {
        companyId,
        proveedorId: supplier.id,
        numero: ocNumero,
        fechaEmision: new Date(),
        fechaEntregaEsperada: addDays(new Date(), 7),
        estado: 'COMPLETADA',
        subtotal,
        impuestos: iva,
        total,
        moneda: 'ARS',
        createdBy: userId,
      }
    });
    created.push({ type: 'OC', id: oc.id, numero: ocNumero });

    // 2. Crear Recepción completa
    const recNumero = generateNumero('REC');
    const recepcion = await prisma.goodsReceipt.create({
      data: {
        companyId,
        proveedorId: supplier.id,
        purchaseOrderId: oc.id,
        warehouseId,
        numero: recNumero,
        fechaRecepcion: new Date(),
        estado: 'CONFIRMADA',
        estadoCalidad: 'APROBADO',
        tieneFactura: true,
        createdBy: userId,
      }
    });
    created.push({ type: 'Recepción', id: recepcion.id, numero: recNumero });

    // 3. Crear Factura
    const factNumeroSerie = '0001';
    const factNumeroFactura = generateNumero('').replace('-', '');
    const factura = await prisma.purchaseReceipt.create({
      data: {
        companyId,
        proveedorId: supplier.id,
        numeroSerie: factNumeroSerie,
        numeroFactura: factNumeroFactura,
        tipo: 'FACTURA_A',
        fechaEmision: new Date(),
        fechaVencimiento: addDays(new Date(), 30),
        fechaImputacion: new Date(),
        tipoPago: 'CREDITO',
        neto: subtotal,
        iva21: iva,
        total,
        tipoCuentaId,
        estado: 'pendiente',
        matchStatus: 'MATCH_OK',
        cae: '12345678901234',
        fechaVtoCae: addDays(new Date(), 10),
        createdBy: userId,
      }
    });
    const factNumero = `A-${factNumeroSerie}-${factNumeroFactura}`;
    created.push({ type: 'Factura', id: factura.id, numero: factNumero });

    // Vincular factura a recepción
    await prisma.goodsReceipt.update({
      where: { id: recepcion.id },
      data: { facturaId: factura.id }
    });

    // 4. Crear Match Result OK
    const match = await prisma.matchResult.create({
      data: {
        companyId,
        facturaId: factura.id,
        purchaseOrderId: oc.id,
        goodsReceiptId: recepcion.id,
        estado: 'MATCH_OK',
        matchOcRecepcion: true,
        matchRecepcionFactura: true,
        matchOcFactura: true,
        matchCompleto: true,
      }
    });
    created.push({ type: 'Match', id: match.id });

    return {
      scenario: 'flujo_completo_ok',
      description: `Flujo completo OK: ${supplier.name} - $${total.toLocaleString()}. Listo para pagar.`,
      created,
      success: true,
    };
  } catch (error: any) {
    return {
      scenario: 'flujo_completo_ok',
      description: 'Flujo completo: OC → Recepción → Factura → Match OK',
      created,
      success: false,
      error: error.message,
    };
  }
}

/**
 * Escenario 2: Match con excepción de precio
 */
export async function createScenarioMatchExcepcionPrecio(
  prisma: PrismaClient,
  companyId: number,
  userId: number
): Promise<ScenarioResult> {
  const created: ScenarioResult['created'] = [];

  try {
    const supplier = await getOrCreateSupplier(prisma, companyId);
    const warehouseId = await getOrCreateDefaultWarehouse(prisma, companyId);
    const tipoCuentaId = await getOrCreateDefaultTipoCuenta(prisma, companyId);
    const subtotalOC = randomBetween(80000, 150000);
    const subtotalFactura = Math.round(subtotalOC * 1.15); // 15% más
    const diferencia = subtotalFactura - subtotalOC;

    // OC
    const ocNumero = generateNumero('OC');
    const oc = await prisma.purchaseOrder.create({
      data: {
        companyId,
        proveedorId: supplier.id,
        numero: ocNumero,
        fechaEmision: subtractDays(new Date(), 10),
        estado: 'COMPLETADA',
        subtotal: subtotalOC,
        impuestos: subtotalOC * 0.21,
        total: subtotalOC * 1.21,
        moneda: 'ARS',
        createdBy: userId,
      }
    });
    created.push({ type: 'OC', id: oc.id, numero: ocNumero });

    // Recepción
    const recNumero = generateNumero('REC');
    const recepcion = await prisma.goodsReceipt.create({
      data: {
        companyId,
        proveedorId: supplier.id,
        purchaseOrderId: oc.id,
        warehouseId,
        numero: recNumero,
        fechaRecepcion: subtractDays(new Date(), 5),
        estado: 'CONFIRMADA',
        estadoCalidad: 'APROBADO',
        tieneFactura: true,
        createdBy: userId,
      }
    });
    created.push({ type: 'Recepción', id: recepcion.id, numero: recNumero });

    // Factura con precio más alto
    const factNumeroSerie = '0001';
    const factNumeroFactura = generateNumero('').replace('-', '');
    const factura = await prisma.purchaseReceipt.create({
      data: {
        companyId,
        proveedorId: supplier.id,
        numeroSerie: factNumeroSerie,
        numeroFactura: factNumeroFactura,
        tipo: 'FACTURA_A',
        fechaEmision: new Date(),
        fechaVencimiento: addDays(new Date(), 30),
        fechaImputacion: new Date(),
        tipoPago: 'CREDITO',
        neto: subtotalFactura,
        iva21: subtotalFactura * 0.21,
        total: subtotalFactura * 1.21,
        tipoCuentaId,
        estado: 'pendiente',
        matchStatus: 'MATCH_BLOCKED',
        createdBy: userId,
      }
    });
    const factNumero = `A-${factNumeroSerie}-${factNumeroFactura}`;
    created.push({ type: 'Factura', id: factura.id, numero: factNumero });

    await prisma.goodsReceipt.update({
      where: { id: recepcion.id },
      data: { facturaId: factura.id }
    });

    // Match con excepción
    const match = await prisma.matchResult.create({
      data: {
        companyId,
        facturaId: factura.id,
        purchaseOrderId: oc.id,
        goodsReceiptId: recepcion.id,
        estado: 'DISCREPANCIA',
        matchOcRecepcion: true,
        matchRecepcionFactura: false,
        matchOcFactura: false,
        matchCompleto: false,
        exceptions: {
          create: [{
            tipo: 'PRECIO_DIFERENTE',
            campo: 'total',
            valorEsperado: (subtotalOC * 1.21).toString(),
            valorRecibido: (subtotalFactura * 1.21).toString(),
            diferencia: diferencia * 1.21,
            porcentajeDiff: 15,
            resuelto: false,
          }]
        }
      }
    });
    created.push({ type: 'Match con Excepción', id: match.id });

    return {
      scenario: 'match_excepcion_precio',
      description: `Match bloqueado: Factura 15% más cara ($${diferencia.toLocaleString()} diferencia). Requiere resolución.`,
      created,
      success: true,
    };
  } catch (error: any) {
    return {
      scenario: 'match_excepcion_precio',
      description: 'Match con excepción de precio',
      created,
      success: false,
      error: error.message,
    };
  }
}

/**
 * Escenario 3: Match con excepción de cantidad
 */
export async function createScenarioMatchExcepcionCantidad(
  prisma: PrismaClient,
  companyId: number,
  userId: number
): Promise<ScenarioResult> {
  const created: ScenarioResult['created'] = [];

  try {
    const supplier = await getOrCreateSupplier(prisma, companyId);
    const warehouseId = await getOrCreateDefaultWarehouse(prisma, companyId);
    const tipoCuentaId = await getOrCreateDefaultTipoCuenta(prisma, companyId);
    const precio = randomBetween(50000, 120000);
    const cantidadRecibida = 85;
    const cantidadFacturada = 100;
    const diferencia = (cantidadFacturada - cantidadRecibida) * precio / 100;

    const ocNumero = generateNumero('OC');
    const oc = await prisma.purchaseOrder.create({
      data: {
        companyId,
        proveedorId: supplier.id,
        numero: ocNumero,
        fechaEmision: subtractDays(new Date(), 15),
        estado: 'PARCIALMENTE_RECIBIDA',
        subtotal: precio,
        impuestos: precio * 0.21,
        total: precio * 1.21,
        moneda: 'ARS',
        createdBy: userId,
      }
    });
    created.push({ type: 'OC', id: oc.id, numero: ocNumero });

    const recNumero = generateNumero('REC');
    const recepcion = await prisma.goodsReceipt.create({
      data: {
        companyId,
        proveedorId: supplier.id,
        purchaseOrderId: oc.id,
        warehouseId,
        numero: recNumero,
        fechaRecepcion: subtractDays(new Date(), 10),
        estado: 'CONFIRMADA',
        estadoCalidad: 'APROBADO',
        tieneFactura: true,
        createdBy: userId,
      }
    });
    created.push({ type: 'Recepción', id: recepcion.id, numero: recNumero });

    const factNumeroSerie = '0001';
    const factNumeroFactura = generateNumero('').replace('-', '');
    const factura = await prisma.purchaseReceipt.create({
      data: {
        companyId,
        proveedorId: supplier.id,
        numeroSerie: factNumeroSerie,
        numeroFactura: factNumeroFactura,
        tipo: 'FACTURA_A',
        fechaEmision: new Date(),
        fechaVencimiento: addDays(new Date(), 30),
        fechaImputacion: new Date(),
        tipoPago: 'CREDITO',
        neto: precio,
        iva21: precio * 0.21,
        total: precio * 1.21,
        tipoCuentaId,
        estado: 'pendiente',
        matchStatus: 'MATCH_BLOCKED',
        createdBy: userId,
      }
    });
    const factNumero = `A-${factNumeroSerie}-${factNumeroFactura}`;
    created.push({ type: 'Factura', id: factura.id, numero: factNumero });

    await prisma.goodsReceipt.update({
      where: { id: recepcion.id },
      data: { facturaId: factura.id }
    });

    const match = await prisma.matchResult.create({
      data: {
        companyId,
        facturaId: factura.id,
        purchaseOrderId: oc.id,
        goodsReceiptId: recepcion.id,
        estado: 'DISCREPANCIA',
        matchOcRecepcion: false,
        matchRecepcionFactura: false,
        matchOcFactura: true,
        matchCompleto: false,
        exceptions: {
          create: [{
            tipo: 'CANTIDAD_DIFERENTE',
            campo: 'cantidad',
            valorEsperado: cantidadRecibida.toString(),
            valorRecibido: cantidadFacturada.toString(),
            diferencia: cantidadFacturada - cantidadRecibida,
            porcentajeDiff: ((cantidadFacturada - cantidadRecibida) / cantidadRecibida) * 100,
            resuelto: false,
          }]
        }
      }
    });
    created.push({ type: 'Match con Excepción', id: match.id });

    return {
      scenario: 'match_excepcion_cantidad',
      description: `Match bloqueado: Facturado 100 vs Recibido 85. Se facturaron 15 unidades de más.`,
      created,
      success: true,
    };
  } catch (error: any) {
    return {
      scenario: 'match_excepcion_cantidad',
      description: 'Match con excepción de cantidad',
      created,
      success: false,
      error: error.message,
    };
  }
}

/**
 * Escenario 4: GRNI - Recepción sin factura (varios aging buckets)
 */
export async function createScenarioGRNI(
  prisma: PrismaClient,
  companyId: number,
  userId: number,
  diasAntiguedad: number
): Promise<ScenarioResult> {
  const created: ScenarioResult['created'] = [];

  try {
    const supplier = await getOrCreateSupplier(prisma, companyId);
    const warehouseId = await getOrCreateDefaultWarehouse(prisma, companyId);
    const subtotal = randomBetween(30000, 100000);
    const total = subtotal * 1.21;

    const ocNumero = generateNumero('OC');
    const oc = await prisma.purchaseOrder.create({
      data: {
        companyId,
        proveedorId: supplier.id,
        numero: ocNumero,
        fechaEmision: subtractDays(new Date(), diasAntiguedad + 5),
        estado: 'COMPLETADA',
        subtotal,
        impuestos: subtotal * 0.21,
        total,
        moneda: 'ARS',
        createdBy: userId,
      }
    });
    created.push({ type: 'OC', id: oc.id, numero: ocNumero });

    // Recepción SIN factura (genera GRNI)
    const recNumero = generateNumero('REC');
    const fechaRecepcion = subtractDays(new Date(), diasAntiguedad);
    const recepcion = await prisma.goodsReceipt.create({
      data: {
        companyId,
        proveedorId: supplier.id,
        purchaseOrderId: oc.id,
        warehouseId,
        numero: recNumero,
        fechaRecepcion,
        estado: 'CONFIRMADA',
        estadoCalidad: 'APROBADO',
        tieneFactura: false, // SIN FACTURA = GRNI
        createdBy: userId,
      }
    });
    created.push({ type: 'Recepción (GRNI)', id: recepcion.id, numero: recNumero });

    // Crear registro GRNI
    const periodo = `${fechaRecepcion.getFullYear()}-${String(fechaRecepcion.getMonth() + 1).padStart(2, '0')}`;
    const grniAccrual = await prisma.gRNIAccrual.create({
      data: {
        companyId,
        goodsReceiptId: recepcion.id,
        supplierId: supplier.id,
        montoEstimado: total,
        estado: 'PENDIENTE',
        periodoCreacion: periodo,
        docType: 'T1',
        createdBy: userId,
        createdAt: fechaRecepcion,
      }
    });
    created.push({ type: 'GRNI Accrual', id: grniAccrual.id });

    const bucket = diasAntiguedad <= 30 ? '0-30' :
                   diasAntiguedad <= 60 ? '31-60' :
                   diasAntiguedad <= 90 ? '61-90' : '90+';

    return {
      scenario: `grni_${diasAntiguedad}_dias`,
      description: `GRNI ${diasAntiguedad} días (bucket ${bucket}): ${supplier.name} - $${total.toLocaleString()}`,
      created,
      success: true,
    };
  } catch (error: any) {
    return {
      scenario: `grni_${diasAntiguedad}_dias`,
      description: `GRNI ${diasAntiguedad} días`,
      created,
      success: false,
      error: error.message,
    };
  }
}

/**
 * Escenario 5: OC pendiente de recepción (atrasada)
 */
export async function createScenarioOCAtrasada(
  prisma: PrismaClient,
  companyId: number,
  userId: number
): Promise<ScenarioResult> {
  const created: ScenarioResult['created'] = [];

  try {
    const supplier = await getOrCreateSupplier(prisma, companyId);
    const subtotal = randomBetween(80000, 250000);
    const total = subtotal * 1.21;

    const ocNumero = generateNumero('OC');
    const oc = await prisma.purchaseOrder.create({
      data: {
        companyId,
        proveedorId: supplier.id,
        numero: ocNumero,
        fechaEmision: subtractDays(new Date(), 20),
        fechaEntregaEsperada: subtractDays(new Date(), 5), // Fecha pasada = atrasada
        estado: 'ENVIADA_PROVEEDOR',
        subtotal,
        impuestos: subtotal * 0.21,
        total,
        moneda: 'ARS',
        createdBy: userId,
      }
    });
    created.push({ type: 'OC Atrasada', id: oc.id, numero: ocNumero });

    return {
      scenario: 'oc_atrasada',
      description: `OC atrasada 5 días: ${supplier.name} - $${total.toLocaleString()}. Sin recepción.`,
      created,
      success: true,
    };
  } catch (error: any) {
    return {
      scenario: 'oc_atrasada',
      description: 'OC atrasada',
      created,
      success: false,
      error: error.message,
    };
  }
}

/**
 * Escenario 6: Factura vencida sin pagar
 */
export async function createScenarioFacturaVencida(
  prisma: PrismaClient,
  companyId: number,
  userId: number
): Promise<ScenarioResult> {
  const created: ScenarioResult['created'] = [];

  try {
    const supplier = await getOrCreateSupplier(prisma, companyId);
    const tipoCuentaId = await getOrCreateDefaultTipoCuenta(prisma, companyId);
    const subtotal = randomBetween(40000, 120000);
    const total = subtotal * 1.21;

    const factNumeroSerie = '0001';
    const factNumeroFactura = generateNumero('').replace('-', '');
    const factura = await prisma.purchaseReceipt.create({
      data: {
        companyId,
        proveedorId: supplier.id,
        numeroSerie: factNumeroSerie,
        numeroFactura: factNumeroFactura,
        tipo: 'FACTURA_A',
        fechaEmision: subtractDays(new Date(), 45),
        fechaVencimiento: subtractDays(new Date(), 15), // Vencida hace 15 días
        fechaImputacion: subtractDays(new Date(), 45),
        tipoPago: 'CREDITO',
        neto: subtotal,
        iva21: subtotal * 0.21,
        total,
        tipoCuentaId,
        estado: 'pendiente',
        matchStatus: 'MATCH_OK',
        createdBy: userId,
      }
    });
    const factNumero = `A-${factNumeroSerie}-${factNumeroFactura}`;
    created.push({ type: 'Factura Vencida', id: factura.id, numero: factNumero });

    return {
      scenario: 'factura_vencida',
      description: `Factura vencida hace 15 días: ${supplier.name} - $${total.toLocaleString()}`,
      created,
      success: true,
    };
  } catch (error: any) {
    return {
      scenario: 'factura_vencida',
      description: 'Factura vencida',
      created,
      success: false,
      error: error.message,
    };
  }
}

/**
 * Escenario 7: Factura con pronto pago disponible
 */
export async function createScenarioFacturaProntoPago(
  prisma: PrismaClient,
  companyId: number,
  userId: number
): Promise<ScenarioResult> {
  const created: ScenarioResult['created'] = [];

  try {
    const supplier = await getOrCreateSupplier(prisma, companyId);
    const tipoCuentaId = await getOrCreateDefaultTipoCuenta(prisma, companyId);
    const subtotal = randomBetween(100000, 300000);
    const total = subtotal * 1.21;
    const descuento = total * 0.03; // 3% pronto pago

    const factNumeroSerie = '0001';
    const factNumeroFactura = generateNumero('').replace('-', '');
    const factura = await prisma.purchaseReceipt.create({
      data: {
        companyId,
        proveedorId: supplier.id,
        numeroSerie: factNumeroSerie,
        numeroFactura: factNumeroFactura,
        tipo: 'FACTURA_A',
        fechaEmision: subtractDays(new Date(), 5),
        fechaVencimiento: addDays(new Date(), 25),
        fechaImputacion: subtractDays(new Date(), 5),
        tipoPago: 'CREDITO',
        neto: subtotal,
        iva21: subtotal * 0.21,
        total,
        tipoCuentaId,
        estado: 'pendiente',
        matchStatus: 'MATCH_OK',
        prontoPagoDisponible: true,
        prontoPagoFechaLimite: addDays(new Date(), 5),
        prontoPagoPorcentaje: 3,
        prontoPagoMonto: descuento,
        createdBy: userId,
      }
    });
    const factNumero = `A-${factNumeroSerie}-${factNumeroFactura}`;
    created.push({ type: 'Factura Pronto Pago', id: factura.id, numero: factNumero });

    return {
      scenario: 'factura_pronto_pago',
      description: `Factura con pronto pago: Total $${total.toLocaleString()}, ahorro 3% ($${descuento.toLocaleString()}) si paga en 5 días`,
      created,
      success: true,
    };
  } catch (error: any) {
    return {
      scenario: 'factura_pronto_pago',
      description: 'Factura con pronto pago',
      created,
      success: false,
      error: error.message,
    };
  }
}

/**
 * Escenario 8: Proveedor problemático con facturas pendientes
 */
export async function createScenarioProveedorBloqueado(
  prisma: PrismaClient,
  companyId: number,
  userId: number
): Promise<ScenarioResult> {
  const created: ScenarioResult['created'] = [];

  try {
    const tipoCuentaId = await getOrCreateDefaultTipoCuenta(prisma, companyId);

    // Crear proveedor marcado como problemático
    const supplier = await getOrCreateSupplier(prisma, companyId, {
      name: 'Proveedor Problemático SRL',
      cuit: `30-99${Date.now().toString().slice(-6)}-0`,
      notes: 'BLOQUEADO: Incumplimiento reiterado de entregas. No realizar pagos sin autorización.',
    });
    created.push({ type: 'Proveedor (Problemático)', id: supplier.id });

    const total = randomBetween(50000, 200000);
    const factNumeroSerie = '0001';
    const factNumeroFactura = generateNumero('').replace('-', '');
    const factura = await prisma.purchaseReceipt.create({
      data: {
        companyId,
        proveedorId: supplier.id,
        numeroSerie: factNumeroSerie,
        numeroFactura: factNumeroFactura,
        tipo: 'FACTURA_A',
        fechaEmision: subtractDays(new Date(), 10),
        fechaVencimiento: addDays(new Date(), 20),
        fechaImputacion: subtractDays(new Date(), 10),
        tipoPago: 'CREDITO',
        neto: total / 1.21,
        iva21: total - (total / 1.21),
        total,
        tipoCuentaId,
        estado: 'pendiente',
        matchStatus: 'MATCH_OK',
        createdBy: userId,
      }
    });
    const factNumero = `A-${factNumeroSerie}-${factNumeroFactura}`;
    created.push({ type: 'Factura (Prov Bloq)', id: factura.id, numero: factNumero });

    return {
      scenario: 'proveedor_bloqueado',
      description: `Proveedor problemático con factura pendiente de $${total.toLocaleString()}. Verificar notas antes de pagar.`,
      created,
      success: true,
    };
  } catch (error: any) {
    return {
      scenario: 'proveedor_bloqueado',
      description: 'Proveedor problemático',
      created,
      success: false,
      error: error.message,
    };
  }
}

/**
 * Escenario 9: Match con SLA vencido (urgente)
 */
export async function createScenarioMatchSLAVencido(
  prisma: PrismaClient,
  companyId: number,
  userId: number
): Promise<ScenarioResult> {
  const created: ScenarioResult['created'] = [];

  try {
    const supplier = await getOrCreateSupplier(prisma, companyId);
    const tipoCuentaId = await getOrCreateDefaultTipoCuenta(prisma, companyId);
    const subtotal = randomBetween(60000, 150000);
    const total = subtotal * 1.21;

    const factNumeroSerie = '0001';
    const factNumeroFactura = generateNumero('').replace('-', '');
    const factura = await prisma.purchaseReceipt.create({
      data: {
        companyId,
        proveedorId: supplier.id,
        numeroSerie: factNumeroSerie,
        numeroFactura: factNumeroFactura,
        tipo: 'FACTURA_A',
        fechaEmision: subtractDays(new Date(), 10),
        fechaVencimiento: addDays(new Date(), 20),
        fechaImputacion: subtractDays(new Date(), 10),
        tipoPago: 'CREDITO',
        neto: subtotal,
        iva21: subtotal * 0.21,
        total,
        tipoCuentaId,
        estado: 'pendiente',
        matchStatus: 'MATCH_BLOCKED',
        createdBy: userId,
      }
    });
    const factNumero = `A-${factNumeroSerie}-${factNumeroFactura}`;
    created.push({ type: 'Factura', id: factura.id, numero: factNumero });

    const match = await prisma.matchResult.create({
      data: {
        companyId,
        facturaId: factura.id,
        estado: 'DISCREPANCIA',
        matchOcRecepcion: false,
        matchRecepcionFactura: false,
        matchOcFactura: false,
        matchCompleto: false,
        notas: 'SLA vencido hace 2 días - URGENTE',
        exceptions: {
          create: [{
            tipo: 'SIN_OC',
            campo: 'purchaseOrderId',
            notas: 'Factura sin OC vinculada - SLA vencido',
            resuelto: false,
          }]
        }
      }
    });
    created.push({ type: 'Match SLA Vencido', id: match.id });

    return {
      scenario: 'match_sla_vencido',
      description: `Match URGENTE con SLA vencido hace 2 días: Factura sin OC - $${total.toLocaleString()}`,
      created,
      success: true,
    };
  } catch (error: any) {
    return {
      scenario: 'match_sla_vencido',
      description: 'Match con SLA vencido',
      created,
      success: false,
      error: error.message,
    };
  }
}

/**
 * Escenario 10: Recepción parcial
 */
export async function createScenarioRecepcionParcial(
  prisma: PrismaClient,
  companyId: number,
  userId: number
): Promise<ScenarioResult> {
  const created: ScenarioResult['created'] = [];

  try {
    const supplier = await getOrCreateSupplier(prisma, companyId);
    const warehouseId = await getOrCreateDefaultWarehouse(prisma, companyId);
    const subtotal = randomBetween(100000, 300000);
    const total = subtotal * 1.21;

    const ocNumero = generateNumero('OC');
    const oc = await prisma.purchaseOrder.create({
      data: {
        companyId,
        proveedorId: supplier.id,
        numero: ocNumero,
        fechaEmision: subtractDays(new Date(), 10),
        fechaEntregaEsperada: addDays(new Date(), 5),
        estado: 'PARCIALMENTE_RECIBIDA',
        subtotal,
        impuestos: subtotal * 0.21,
        total,
        moneda: 'ARS',
        createdBy: userId,
        notas: 'Recepción parcial: 60% recibido, falta 40%',
      }
    });
    created.push({ type: 'OC Parcial', id: oc.id, numero: ocNumero });

    const recNumero = generateNumero('REC');
    const recepcion = await prisma.goodsReceipt.create({
      data: {
        companyId,
        proveedorId: supplier.id,
        purchaseOrderId: oc.id,
        warehouseId,
        numero: recNumero,
        fechaRecepcion: new Date(),
        estado: 'CONFIRMADA',
        estadoCalidad: 'APROBADO',
        tieneFactura: false,
        createdBy: userId,
        notas: 'Recepción parcial: 60% del pedido',
      }
    });
    created.push({ type: 'Recepción Parcial', id: recepcion.id, numero: recNumero });

    return {
      scenario: 'recepcion_parcial',
      description: `OC parcialmente recibida: 60% recibido. Faltan $${Math.round(total * 0.4).toLocaleString()}`,
      created,
      success: true,
    };
  } catch (error: any) {
    return {
      scenario: 'recepcion_parcial',
      description: 'Recepción parcial',
      created,
      success: false,
      error: error.message,
    };
  }
}

/**
 * Escenario 11: Pedido pendiente de aprobación
 */
export async function createScenarioPedidoPendiente(
  prisma: PrismaClient,
  companyId: number,
  userId: number
): Promise<ScenarioResult> {
  const created: ScenarioResult['created'] = [];

  try {
    const presupuesto = randomBetween(100000, 500000);
    const pedidoNumero = generateNumero('REQ');
    const item = randomItem(DEMO_ITEMS);

    const pedido = await prisma.purchaseRequest.create({
      data: {
        companyId,
        numero: pedidoNumero,
        titulo: `Reposición urgente - ${item.descripcion}`,
        descripcion: 'Reposición de stock urgente por faltante detectado en producción',
        estado: 'EN_APROBACION',
        prioridad: 'ALTA',
        solicitanteId: userId,
        departamento: 'Producción',
        fechaNecesidad: addDays(new Date(), 10),
        fechaLimite: addDays(new Date(), 15),
        presupuestoEstimado: presupuesto,
        moneda: 'ARS',
        notas: 'Requiere aprobación por monto elevado',
      }
    });
    created.push({ type: 'Pedido Pendiente', id: pedido.id, numero: pedidoNumero });

    return {
      scenario: 'pedido_pendiente_aprobacion',
      description: `Pedido urgente pendiente de aprobación: $${presupuesto.toLocaleString()} - Esperando aprobación`,
      created,
      success: true,
    };
  } catch (error: any) {
    return {
      scenario: 'pedido_pendiente_aprobacion',
      description: 'Pedido pendiente de aprobación',
      created,
      success: false,
      error: error.message,
    };
  }
}

/**
 * Escenario 12: Nota de Crédito pendiente de aplicar
 */
export async function createScenarioNCPendiente(
  prisma: PrismaClient,
  companyId: number,
  userId: number
): Promise<ScenarioResult> {
  const created: ScenarioResult['created'] = [];

  try {
    const supplier = await getOrCreateSupplier(prisma, companyId);
    const tipoCuentaId = await getOrCreateDefaultTipoCuenta(prisma, companyId);

    // Factura original
    const factTotal = 150000;
    const factNumeroSerie = '0001';
    const factNumeroFactura = generateNumero('').replace('-', '');
    const factura = await prisma.purchaseReceipt.create({
      data: {
        companyId,
        proveedorId: supplier.id,
        numeroSerie: factNumeroSerie,
        numeroFactura: factNumeroFactura,
        tipo: 'FACTURA_A',
        fechaEmision: subtractDays(new Date(), 30),
        fechaVencimiento: subtractDays(new Date(), 5),
        fechaImputacion: subtractDays(new Date(), 30),
        tipoPago: 'CREDITO',
        neto: factTotal / 1.21,
        iva21: factTotal - (factTotal / 1.21),
        total: factTotal,
        tipoCuentaId,
        estado: 'pendiente',
        matchStatus: 'MATCH_OK',
        createdBy: userId,
      }
    });
    const factNumero = `A-${factNumeroSerie}-${factNumeroFactura}`;
    created.push({ type: 'Factura Original', id: factura.id, numero: factNumero });

    // NC por diferencia de precio
    const ncNeto = 12396.69;
    const ncIva = 2603.31;
    const ncTotal = 15000;
    const ncNumero = `NCA-0001-${generateNumero('')}`;
    const nc = await prisma.creditDebitNote.create({
      data: {
        companyId,
        proveedorId: supplier.id,
        facturaId: factura.id,
        numero: ncNumero,
        numeroSerie: '0001',
        tipo: 'NOTA_CREDITO',
        motivo: 'Diferencia de precio según cotización original',
        fechaEmision: subtractDays(new Date(), 10),
        neto: ncNeto,
        iva21: ncIva,
        total: ncTotal,
        estado: 'EMITIDA',
        aplicada: false,
        tipoNca: 'NCA_PRECIO',
        createdBy: userId,
      }
    });
    created.push({ type: 'NC Pendiente', id: nc.id, numero: ncNumero });

    return {
      scenario: 'nc_pendiente_aplicar',
      description: `NC $${ncTotal.toLocaleString()} pendiente de aplicar a factura ${factNumero} ($${factTotal.toLocaleString()})`,
      created,
      success: true,
    };
  } catch (error: any) {
    return {
      scenario: 'nc_pendiente_aplicar',
      description: 'NC pendiente de aplicar',
      created,
      success: false,
      error: error.message,
    };
  }
}

// ============================================================
// FUNCIÓN PRINCIPAL - CREAR TODOS LOS ESCENARIOS
// ============================================================

export async function createAllDemoScenarios(
  prisma: PrismaClient,
  companyId: number,
  userId: number
): Promise<ScenarioResult[]> {
  const results: ScenarioResult[] = [];

  // 1. Flujo completo OK (x2)
  results.push(await createScenarioFlujoCompletoOK(prisma, companyId, userId));
  results.push(await createScenarioFlujoCompletoOK(prisma, companyId, userId));

  // 2. Match con excepciones
  results.push(await createScenarioMatchExcepcionPrecio(prisma, companyId, userId));
  results.push(await createScenarioMatchExcepcionCantidad(prisma, companyId, userId));

  // 3. GRNI en diferentes buckets
  results.push(await createScenarioGRNI(prisma, companyId, userId, 15));  // 0-30
  results.push(await createScenarioGRNI(prisma, companyId, userId, 45));  // 31-60
  results.push(await createScenarioGRNI(prisma, companyId, userId, 75));  // 61-90
  results.push(await createScenarioGRNI(prisma, companyId, userId, 120)); // 90+

  // 4. OC atrasada
  results.push(await createScenarioOCAtrasada(prisma, companyId, userId));

  // 5. Factura vencida
  results.push(await createScenarioFacturaVencida(prisma, companyId, userId));

  // 6. Factura con pronto pago
  results.push(await createScenarioFacturaProntoPago(prisma, companyId, userId));

  // 7. Proveedor problemático
  results.push(await createScenarioProveedorBloqueado(prisma, companyId, userId));

  // 8. Match SLA vencido
  results.push(await createScenarioMatchSLAVencido(prisma, companyId, userId));

  // 9. Recepción parcial
  results.push(await createScenarioRecepcionParcial(prisma, companyId, userId));

  // 10. Pedido pendiente
  results.push(await createScenarioPedidoPendiente(prisma, companyId, userId));

  // 11. NC pendiente
  results.push(await createScenarioNCPendiente(prisma, companyId, userId));

  return results;
}

// Lista de escenarios disponibles
export const AVAILABLE_SCENARIOS = [
  {
    id: 'flujo_completo_ok',
    name: 'Flujo Completo OK',
    description: 'OC aprobada → Recepción completa → Factura → Match OK. Listo para pagar.',
    category: 'Flujo Normal',
  },
  {
    id: 'match_excepcion_precio',
    name: 'Match - Excepción Precio',
    description: 'Factura con precio 15% mayor al de la OC. Match bloqueado.',
    category: 'Excepciones Match',
  },
  {
    id: 'match_excepcion_cantidad',
    name: 'Match - Excepción Cantidad',
    description: 'Factura por cantidad mayor a la recibida. Match bloqueado.',
    category: 'Excepciones Match',
  },
  {
    id: 'grni_15_dias',
    name: 'GRNI 0-30 días',
    description: 'Recepción sin factura, antigüedad 15 días.',
    category: 'GRNI',
  },
  {
    id: 'grni_45_dias',
    name: 'GRNI 31-60 días',
    description: 'Recepción sin factura, antigüedad 45 días.',
    category: 'GRNI',
  },
  {
    id: 'grni_75_dias',
    name: 'GRNI 61-90 días',
    description: 'Recepción sin factura, antigüedad 75 días.',
    category: 'GRNI',
  },
  {
    id: 'grni_120_dias',
    name: 'GRNI > 90 días (Alerta)',
    description: 'Recepción sin factura, antigüedad 120 días. Requiere seguimiento urgente.',
    category: 'GRNI',
  },
  {
    id: 'oc_atrasada',
    name: 'OC Atrasada',
    description: 'Orden de compra con fecha de entrega vencida, sin recepción.',
    category: 'Órdenes de Compra',
  },
  {
    id: 'factura_vencida',
    name: 'Factura Vencida',
    description: 'Factura con fecha de vencimiento pasada, sin pagar.',
    category: 'Facturas',
  },
  {
    id: 'factura_pronto_pago',
    name: 'Factura con Pronto Pago',
    description: 'Factura con descuento por pronto pago disponible (3%).',
    category: 'Facturas',
  },
  {
    id: 'proveedor_bloqueado',
    name: 'Proveedor Problemático',
    description: 'Proveedor marcado como problemático con factura pendiente. Verificar notas.',
    category: 'Proveedores',
  },
  {
    id: 'match_sla_vencido',
    name: 'Match SLA Vencido',
    description: 'Match con excepción y SLA vencido. Urgente.',
    category: 'Excepciones Match',
  },
  {
    id: 'recepcion_parcial',
    name: 'Recepción Parcial',
    description: 'OC parcialmente recibida (60%). Esperando resto.',
    category: 'Recepciones',
  },
  {
    id: 'pedido_pendiente_aprobacion',
    name: 'Pedido Pendiente Aprobación',
    description: 'Pedido de compra urgente esperando aprobación.',
    category: 'Pedidos',
  },
  {
    id: 'nc_pendiente_aplicar',
    name: 'NC Pendiente de Aplicar',
    description: 'Nota de crédito recibida pero no aplicada a factura.',
    category: 'NC/ND',
  },
];
