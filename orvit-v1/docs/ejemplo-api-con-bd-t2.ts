/**
 * =============================================================================
 * EJEMPLO: API de Comprobantes con BD T2 Separada
 * =============================================================================
 *
 * Este archivo muestra cómo modificar una API para consultar la BD T2 separada.
 *
 * CAMBIOS PRINCIPALES:
 * 1. Importar helpers de T2 (shouldQueryT2, prismaT2, enrichT2Receipts)
 * 2. En GET: consultar BD principal (T1) y BD T2 por separado, luego combinar
 * 3. En POST: crear en BD T2 si el documento es T2
 *
 * NO MODIFIQUES ESTE ARCHIVO - Es solo documentación/ejemplo
 * =============================================================================
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getT2Client } from '@/lib/prisma-t2';
import { getViewMode } from '@/lib/view-mode/get-mode';
import { shouldQueryT2, enrichT2Receipts } from '@/lib/view-mode';

// =============================================================================
// GET: Obtener comprobantes (T1 de BD principal + T2 de BD secundaria)
// =============================================================================
export async function GET_EJEMPLO(request: NextRequest) {
  // ... código de autenticación igual que antes ...
  const companyId = 1; // ejemplo
  const user = { id: 1 }; // ejemplo

  const viewMode = getViewMode(request);

  // -------------------------------------------------------------------------
  // PASO 1: Siempre consultar BD principal (solo T1, excluir T2)
  // -------------------------------------------------------------------------
  const t1Receipts = await prisma.purchaseReceipt.findMany({
    where: {
      companyId,
      // IMPORTANTE: Excluir T2 de BD principal (ahora vive en otra BD)
      docType: { not: 'T2' },
    },
    include: {
      proveedor: {
        select: { id: true, razonSocial: true, cuit: true },
      },
    },
    orderBy: { fechaEmision: 'desc' },
    take: 50,
  });

  // -------------------------------------------------------------------------
  // PASO 2: Consultar BD T2 solo si está habilitado
  // -------------------------------------------------------------------------
  let t2Receipts: any[] = [];

  if (await shouldQueryT2(companyId, viewMode)) {
    try {
      const prismaT2 = getT2Client();

      // Consultar comprobantes T2
      const t2Raw = await prismaT2.t2PurchaseReceipt.findMany({
        where: { companyId },
        orderBy: { fechaEmision: 'desc' },
        take: 50,
      });

      // Enriquecer con datos maestros de BD principal (proveedores, etc.)
      t2Receipts = await enrichT2Receipts(t2Raw);
    } catch (error) {
      console.error('[API] Error consultando BD T2:', error);
      // No fallar la request, solo no mostrar T2
    }
  }

  // -------------------------------------------------------------------------
  // PASO 3: Combinar resultados y ordenar
  // -------------------------------------------------------------------------
  const allReceipts = [...t1Receipts, ...t2Receipts].sort((a, b) => {
    const dateA = new Date(a.fechaEmision).getTime();
    const dateB = new Date(b.fechaEmision).getTime();
    return dateB - dateA; // Más recientes primero
  });

  return NextResponse.json(allReceipts);
}

// =============================================================================
// POST: Crear comprobante (en BD principal si T1, en BD T2 si T2)
// =============================================================================
export async function POST_EJEMPLO(request: NextRequest) {
  // ... código de autenticación igual que antes ...
  const companyId = 1; // ejemplo
  const user = { id: 1 }; // ejemplo

  const viewMode = getViewMode(request);
  const body = await request.json();

  const {
    numeroSerie,
    numeroFactura,
    tipo,
    proveedorId,
    fechaEmision,
    neto,
    total,
    docType, // 'T1' o 'T2'
    // ... otros campos
  } = body;

  // -------------------------------------------------------------------------
  // CASO T1: Crear en BD principal (igual que antes)
  // -------------------------------------------------------------------------
  if (docType !== 'T2') {
    const nuevoComprobante = await prisma.purchaseReceipt.create({
      data: {
        numeroSerie,
        numeroFactura,
        tipo,
        proveedorId: parseInt(proveedorId),
        fechaEmision: new Date(fechaEmision),
        fechaImputacion: new Date(fechaEmision),
        tipoPago: 'credito',
        neto: parseFloat(neto) || 0,
        total: parseFloat(total) || 0,
        tipoCuentaId: 1, // ejemplo
        estado: 'pendiente',
        docType: 'T1',
        companyId,
        createdBy: user.id,
      },
    });

    return NextResponse.json(nuevoComprobante, { status: 201 });
  }

  // -------------------------------------------------------------------------
  // CASO T2: Crear en BD secundaria
  // -------------------------------------------------------------------------
  // Verificar que T2 está habilitado
  if (!(await shouldQueryT2(companyId, viewMode))) {
    return NextResponse.json(
      { error: 'No autorizado para crear documentos T2' },
      { status: 403 }
    );
  }

  try {
    const prismaT2 = getT2Client();

    const nuevoComprobanteT2 = await prismaT2.t2PurchaseReceipt.create({
      data: {
        companyId,
        supplierId: parseInt(proveedorId),
        tipoCuentaId: 1, // ejemplo
        createdBy: user.id,
        numeroSerie,
        numeroFactura,
        tipo: 'X', // Tipo especial para T2
        fechaEmision: new Date(fechaEmision),
        fechaImputacion: new Date(fechaEmision),
        tipoPago: 'contado',
        neto: parseFloat(neto) || 0,
        total: parseFloat(total) || 0,
        estado: 'pendiente',
      },
    });

    // Enriquecer con datos del proveedor antes de devolver
    const [enriched] = await enrichT2Receipts([nuevoComprobanteT2]);

    return NextResponse.json(enriched, { status: 201 });
  } catch (error) {
    console.error('[API] Error creando en BD T2:', error);
    return NextResponse.json(
      { error: 'Error al crear documento T2' },
      { status: 500 }
    );
  }
}

// =============================================================================
// RESUMEN DE CAMBIOS NECESARIOS EN CADA API
// =============================================================================
/**
 * Para migrar una API existente a usar BD T2:
 *
 * 1. IMPORTS:
 *    + import { getT2Client } from '@/lib/prisma-t2';
 *    + import { shouldQueryT2, enrichT2Receipts } from '@/lib/view-mode';
 *
 * 2. GET (Leer):
 *    - Cambiar: where: applyViewMode({ companyId }, viewMode)
 *    + Por: where: { companyId, docType: { not: 'T2' } }
 *
 *    + Agregar después:
 *      if (await shouldQueryT2(companyId, viewMode)) {
 *        const t2Data = await getT2Client().t2Model.findMany({ ... });
 *        const enriched = await enrichT2Data(t2Data);
 *        results = [...results, ...enriched];
 *      }
 *
 * 3. POST/PUT (Escribir):
 *    - Si docType === 'T2', usar prismaT2 en lugar de prisma
 *    - Verificar shouldQueryT2() antes de permitir crear T2
 *
 * 4. DELETE:
 *    - Verificar si el documento está en BD principal o T2
 *    - Usar el cliente correcto según corresponda
 *
 * APIs QUE NECESITAN MIGRACIÓN:
 * - /api/compras/comprobantes (este ejemplo)
 * - /api/compras/ordenes-pago
 * - /api/compras/cuenta-corriente
 * - /api/compras/stock/movimientos
 * - /api/ventas/facturas
 * - /api/tesoreria/caja
 */
