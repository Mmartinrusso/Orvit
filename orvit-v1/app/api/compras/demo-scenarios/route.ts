import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import { JWT_SECRET } from '@/lib/auth';
import {
  createAllDemoScenarios,
  createScenarioFlujoCompletoOK,
  createScenarioMatchExcepcionPrecio,
  createScenarioMatchExcepcionCantidad,
  createScenarioGRNI,
  createScenarioOCAtrasada,
  createScenarioFacturaVencida,
  createScenarioFacturaProntoPago,
  createScenarioProveedorBloqueado,
  createScenarioMatchSLAVencido,
  createScenarioRecepcionParcial,
  createScenarioPedidoPendiente,
  createScenarioNCPendiente,
  AVAILABLE_SCENARIOS,
} from '@/lib/compras/demo-scenarios';

export const dynamic = 'force-dynamic';

const JWT_SECRET_KEY = new TextEncoder().encode(JWT_SECRET);

async function getUserFromToken() {
  const token = cookies().get('token')?.value;
  if (!token) throw new Error('No token provided');
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET_KEY);
    return { userId: payload.userId as number, companyId: payload.companyId as number };
  } catch {
    throw new Error('Invalid token');
  }
}

/**
 * GET /api/compras/demo-scenarios
 * Lista los escenarios disponibles
 */
export async function GET(req: NextRequest) {
  try {
    await getUserFromToken();

    return NextResponse.json({
      scenarios: AVAILABLE_SCENARIOS,
      categories: [...new Set(AVAILABLE_SCENARIOS.map(s => s.category))],
    });
  } catch (error) {
    console.error('[DEMO-SCENARIOS] Error:', error);
    return NextResponse.json(
      { error: 'Error al obtener escenarios' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/compras/demo-scenarios
 * Crea uno o todos los escenarios de prueba
 */
export async function POST(req: NextRequest) {
  try {
    const { companyId, userId } = await getUserFromToken();
    const body = await req.json();
    const { scenarioId, createAll } = body;

    if (createAll) {
      // Crear todos los escenarios
      const results = await createAllDemoScenarios(prisma, companyId, userId);

      const successful = results.filter(r => r.success).length;
      const failed = results.filter(r => !r.success).length;

      return NextResponse.json({
        message: `${successful} escenarios creados, ${failed} fallidos`,
        results,
        totalCreated: results.reduce((sum, r) => sum + r.created.length, 0),
      });
    }

    if (!scenarioId) {
      return NextResponse.json(
        { error: 'Se requiere scenarioId o createAll=true' },
        { status: 400 }
      );
    }

    // Crear escenario específico
    let result;
    switch (scenarioId) {
      case 'flujo_completo_ok':
        result = await createScenarioFlujoCompletoOK(prisma, companyId, userId);
        break;
      case 'match_excepcion_precio':
        result = await createScenarioMatchExcepcionPrecio(prisma, companyId, userId);
        break;
      case 'match_excepcion_cantidad':
        result = await createScenarioMatchExcepcionCantidad(prisma, companyId, userId);
        break;
      case 'grni_15_dias':
        result = await createScenarioGRNI(prisma, companyId, userId, 15);
        break;
      case 'grni_45_dias':
        result = await createScenarioGRNI(prisma, companyId, userId, 45);
        break;
      case 'grni_75_dias':
        result = await createScenarioGRNI(prisma, companyId, userId, 75);
        break;
      case 'grni_120_dias':
        result = await createScenarioGRNI(prisma, companyId, userId, 120);
        break;
      case 'oc_atrasada':
        result = await createScenarioOCAtrasada(prisma, companyId, userId);
        break;
      case 'factura_vencida':
        result = await createScenarioFacturaVencida(prisma, companyId, userId);
        break;
      case 'factura_pronto_pago':
        result = await createScenarioFacturaProntoPago(prisma, companyId, userId);
        break;
      case 'proveedor_bloqueado':
        result = await createScenarioProveedorBloqueado(prisma, companyId, userId);
        break;
      case 'match_sla_vencido':
        result = await createScenarioMatchSLAVencido(prisma, companyId, userId);
        break;
      case 'recepcion_parcial':
        result = await createScenarioRecepcionParcial(prisma, companyId, userId);
        break;
      case 'pedido_pendiente_aprobacion':
        result = await createScenarioPedidoPendiente(prisma, companyId, userId);
        break;
      case 'nc_pendiente_aplicar':
        result = await createScenarioNCPendiente(prisma, companyId, userId);
        break;
      default:
        return NextResponse.json(
          { error: `Escenario desconocido: ${scenarioId}` },
          { status: 400 }
        );
    }

    if (!result.success) {
      return NextResponse.json(
        { error: result.error, scenario: result.scenario },
        { status: 500 }
      );
    }

    return NextResponse.json(result, { status: 201 });
  } catch (error: any) {
    console.error('[DEMO-SCENARIOS] Error creating:', error);
    return NextResponse.json(
      { error: error.message || 'Error al crear escenario' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/compras/demo-scenarios
 * Limpia datos de prueba (cuidado!)
 */
export async function DELETE(req: NextRequest) {
  try {
    const { companyId } = await getUserFromToken();

    // Solo permitir en ambiente de desarrollo
    if (process.env.NODE_ENV === 'production') {
      return NextResponse.json(
        { error: 'No permitido en producción' },
        { status: 403 }
      );
    }

    // Eliminar en orden correcto (por foreign keys)
    const deleted = {
      matchExceptions: 0,
      matchResults: 0,
      grniAccruals: 0,
      goodsReceiptItems: 0,
      goodsReceipts: 0,
      purchaseReceiptItems: 0,
      purchaseReceipts: 0,
      purchaseOrderItems: 0,
      purchaseOrders: 0,
      creditDebitNotes: 0,
      purchaseRequests: 0,
    };

    // Match Exceptions
    const delMatchEx = await prisma.matchException.deleteMany({
      where: { companyId }
    });
    deleted.matchExceptions = delMatchEx.count;

    // Match Results
    const delMatch = await prisma.matchResult.deleteMany({
      where: { companyId }
    });
    deleted.matchResults = delMatch.count;

    // GRNI Accruals
    const delGrni = await prisma.gRNIAccrual.deleteMany({
      where: { companyId }
    });
    deleted.grniAccruals = delGrni.count;

    // Goods Receipt Items
    const delGrItems = await prisma.goodsReceiptItem.deleteMany({
      where: { companyId }
    });
    deleted.goodsReceiptItems = delGrItems.count;

    // Goods Receipts
    const delGr = await prisma.goodsReceipt.deleteMany({
      where: { companyId }
    });
    deleted.goodsReceipts = delGr.count;

    // Credit Debit Notes
    const delNc = await prisma.creditDebitNote.deleteMany({
      where: { companyId }
    });
    deleted.creditDebitNotes = delNc.count;

    // Purchase Receipt Items
    const delPrItems = await prisma.purchaseReceiptItem.deleteMany({
      where: { companyId }
    });
    deleted.purchaseReceiptItems = delPrItems.count;

    // Purchase Receipts (Facturas)
    const delPr = await prisma.purchaseReceipt.deleteMany({
      where: { companyId }
    });
    deleted.purchaseReceipts = delPr.count;

    // Purchase Order Items
    const delPoItems = await prisma.purchaseOrderItem.deleteMany({
      where: { companyId }
    });
    deleted.purchaseOrderItems = delPoItems.count;

    // Purchase Orders
    const delPo = await prisma.purchaseOrder.deleteMany({
      where: { companyId }
    });
    deleted.purchaseOrders = delPo.count;

    // Purchase Request Items (antes de Purchase Requests por FK)
    const delPreqItems = await prisma.purchaseRequestItem.deleteMany({
      where: { request: { companyId } }
    });

    // Purchase Requests
    const delPreq = await prisma.purchaseRequest.deleteMany({
      where: { companyId }
    });
    deleted.purchaseRequests = delPreq.count;

    return NextResponse.json({
      message: 'Datos de prueba eliminados',
      deleted,
    });
  } catch (error: any) {
    console.error('[DEMO-SCENARIOS] Error deleting:', error);
    return NextResponse.json(
      { error: error.message || 'Error al eliminar datos' },
      { status: 500 }
    );
  }
}
