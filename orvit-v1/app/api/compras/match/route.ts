import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';
import { prisma } from '@/lib/prisma';
import { JWT_SECRET } from '@/lib/auth';
import { Prisma } from '@prisma/client';
import { ejecutarMatchYGuardar, verificarPagoPermitido } from '@/lib/compras/match-helper';

export const dynamic = 'force-dynamic';

const JWT_SECRET_KEY = new TextEncoder().encode(JWT_SECRET);

async function getUserFromToken() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;
    if (!token) return null;

    const { payload } = await jwtVerify(token, JWT_SECRET_KEY);

    const user = await prisma.user.findUnique({
      where: { id: payload.userId as number },
      select: {
        id: true,
        name: true,
        companies: {
          select: { companyId: true },
          take: 1
        }
      }
    });

    return user;
  } catch (error) {
    return null;
  }
}

// Obtener configuración de tolerancias
async function getConfig(companyId: number) {
  let config = await prisma.purchaseConfig.findUnique({
    where: { companyId }
  });

  if (!config) {
    // Crear configuración por defecto
    config = await prisma.purchaseConfig.create({
      data: {
        companyId,
        toleranciaCantidad: 5, // 5%
        toleranciaPrecio: 2,   // 2%
        permitirPagoSinMatch: false,
        permitirRecepcionSinOc: true,
        diasAlertaRecepcionSinFactura: 7,
        diasAlertaFacturaVencer: 7,
        diasLimiteRegularizacion: 15,
      }
    });
  }

  return config;
}

// Función principal de 3-Way Match
async function ejecutarMatch(
  facturaId: number,
  companyId: number,
  userId: number,
  config: any
): Promise<any> {
  // Obtener factura con items
  const factura = await prisma.purchaseReceipt.findFirst({
    where: { id: facturaId, companyId },
    include: {
      items: {
        include: {
          supplierItem: true
        }
      }
    }
  });

  if (!factura) {
    throw new Error('Factura no encontrada');
  }

  // Buscar OC vinculada (por proveedor o directamente)
  const purchaseOrder = await prisma.purchaseOrder.findFirst({
    where: {
      companyId,
      proveedorId: factura.supplierId,
      estado: { in: ['ENVIADA_PROVEEDOR', 'CONFIRMADA', 'PARCIALMENTE_RECIBIDA', 'COMPLETADA'] }
    },
    include: {
      items: {
        include: { supplierItem: true }
      }
    },
    orderBy: { createdAt: 'desc' }
  });

  // Buscar recepción vinculada
  const goodsReceipt = await prisma.goodsReceipt.findFirst({
    where: {
      companyId,
      proveedorId: factura.supplierId,
      estado: 'CONFIRMADA',
      facturaId: null // Aún no vinculada
    },
    include: {
      items: {
        include: { supplierItem: true }
      }
    },
    orderBy: { fechaRecepcion: 'desc' }
  });

  const discrepancias: any[] = [];
  const exceptions: any[] = [];

  // Tolerancias
  const tolCantidad = parseFloat(config.toleranciaCantidad.toString()) / 100;
  const tolPrecio = parseFloat(config.toleranciaPrecio.toString()) / 100;

  // Match OC-Factura
  let matchOcFactura: boolean | null = null;
  if (purchaseOrder) {
    matchOcFactura = true;

    // Comparar totales
    const totalOC = parseFloat(purchaseOrder.total.toString());
    const totalFactura = parseFloat(factura.monto_total.toString());
    const diffTotal = Math.abs(totalOC - totalFactura);
    const porcDiffTotal = totalOC > 0 ? diffTotal / totalOC : 0;

    if (porcDiffTotal > tolPrecio) {
      matchOcFactura = false;
      exceptions.push({
        tipo: 'TOTAL_DIFERENTE',
        campo: 'total',
        valorEsperado: totalOC.toString(),
        valorRecibido: totalFactura.toString(),
        diferencia: diffTotal,
        porcentajeDiff: porcDiffTotal * 100,
        dentroTolerancia: false
      });
    }

    // Comparar items
    for (const itemOC of purchaseOrder.items) {
      const itemFactura = factura.items.find(i =>
        i.supplierItemId === itemOC.supplierItemId ||
        i.descripcion?.toLowerCase().includes(itemOC.descripcion?.toLowerCase() || '')
      );

      if (!itemFactura) {
        exceptions.push({
          tipo: 'ITEM_FALTANTE',
          campo: `item_${itemOC.supplierItemId}`,
          valorEsperado: itemOC.descripcion,
          valorRecibido: null,
          dentroTolerancia: false
        });
        matchOcFactura = false;
        continue;
      }

      // Comparar cantidad
      const cantOC = parseFloat(itemOC.cantidad.toString());
      const cantFactura = parseFloat(itemFactura.cantidad?.toString() || '0');
      const diffCant = Math.abs(cantOC - cantFactura);
      const porcDiffCant = cantOC > 0 ? diffCant / cantOC : 0;

      if (porcDiffCant > tolCantidad) {
        matchOcFactura = false;
        exceptions.push({
          tipo: 'CANTIDAD_DIFERENTE',
          campo: `cantidad_${itemOC.supplierItemId}`,
          valorEsperado: cantOC.toString(),
          valorRecibido: cantFactura.toString(),
          diferencia: diffCant,
          porcentajeDiff: porcDiffCant * 100,
          dentroTolerancia: false
        });
      }

      // Comparar precio
      const precioOC = parseFloat(itemOC.precioUnitario.toString());
      const precioFactura = parseFloat(itemFactura.precioUnitario?.toString() || '0');
      const diffPrecio = Math.abs(precioOC - precioFactura);
      const porcDiffPrecio = precioOC > 0 ? diffPrecio / precioOC : 0;

      if (porcDiffPrecio > tolPrecio) {
        matchOcFactura = false;
        exceptions.push({
          tipo: 'PRECIO_DIFERENTE',
          campo: `precio_${itemOC.supplierItemId}`,
          valorEsperado: precioOC.toString(),
          valorRecibido: precioFactura.toString(),
          diferencia: diffPrecio,
          porcentajeDiff: porcDiffPrecio * 100,
          dentroTolerancia: false
        });
      }
    }
  } else {
    exceptions.push({
      tipo: 'SIN_OC',
      campo: 'purchaseOrder',
      valorEsperado: 'OC vinculada',
      valorRecibido: null,
      dentroTolerancia: false
    });
  }

  // Match Recepción-Factura
  let matchRecepcionFactura: boolean | null = null;
  if (goodsReceipt) {
    matchRecepcionFactura = true;

    for (const itemRecep of goodsReceipt.items) {
      const itemFactura = factura.items.find(i =>
        i.supplierItemId === itemRecep.supplierItemId
      );

      if (!itemFactura) {
        // Item recibido pero no en factura (podría ser correcto si es parcial)
        continue;
      }

      // Comparar cantidad recibida vs facturada
      const cantRecibida = parseFloat(itemRecep.cantidadAceptada.toString());
      const cantFacturada = parseFloat(itemFactura.cantidad?.toString() || '0');
      const diffCant = Math.abs(cantRecibida - cantFacturada);
      const porcDiff = cantRecibida > 0 ? diffCant / cantRecibida : 0;

      if (porcDiff > tolCantidad) {
        matchRecepcionFactura = false;
        exceptions.push({
          tipo: 'CANTIDAD_DIFERENTE',
          campo: `recepcion_cantidad_${itemRecep.supplierItemId}`,
          valorEsperado: cantRecibida.toString(),
          valorRecibido: cantFacturada.toString(),
          diferencia: diffCant,
          porcentajeDiff: porcDiff * 100,
          dentroTolerancia: false
        });
      }
    }
  } else {
    exceptions.push({
      tipo: 'SIN_RECEPCION',
      campo: 'goodsReceipt',
      valorEsperado: 'Recepción vinculada',
      valorRecibido: null,
      dentroTolerancia: false
    });
  }

  // Match OC-Recepción
  let matchOcRecepcion: boolean | null = null;
  if (purchaseOrder && goodsReceipt) {
    matchOcRecepcion = true;

    for (const itemOC of purchaseOrder.items) {
      const itemRecep = goodsReceipt.items.find(i =>
        i.purchaseOrderItemId === itemOC.id || i.supplierItemId === itemOC.supplierItemId
      );

      if (!itemRecep) {
        // No se recibió este item
        const cantPendiente = parseFloat(itemOC.cantidadPendiente?.toString() || itemOC.cantidad.toString());
        if (cantPendiente > 0) {
          matchOcRecepcion = false;
        }
        continue;
      }

      // Verificar que se recibió lo esperado
      const cantOC = parseFloat(itemOC.cantidad.toString());
      const cantRecibida = parseFloat(itemRecep.cantidadAceptada.toString());
      const porcRecibido = cantOC > 0 ? cantRecibida / cantOC : 0;

      // Si se recibió menos del 95%, marcar discrepancia
      if (porcRecibido < 0.95) {
        matchOcRecepcion = false;
      }
    }
  }

  // Determinar estado final
  const matchCompleto = matchOcFactura === true &&
    matchRecepcionFactura === true &&
    matchOcRecepcion === true;

  const tieneExcepciones = exceptions.length > 0;
  const estado = matchCompleto ? 'MATCH_OK' :
    (tieneExcepciones ? 'DISCREPANCIA' : 'PENDIENTE');

  // Crear o actualizar resultado de match
  const existingMatch = await prisma.matchResult.findFirst({
    where: { facturaId, companyId }
  });

  let matchResult;
  if (existingMatch) {
    matchResult = await prisma.matchResult.update({
      where: { id: existingMatch.id },
      data: {
        purchaseOrderId: purchaseOrder?.id || null,
        goodsReceiptId: goodsReceipt?.id || null,
        estado: estado as any,
        matchOcRecepcion,
        matchRecepcionFactura,
        matchOcFactura,
        matchCompleto,
        discrepancias: exceptions
      }
    });

    // Eliminar excepciones anteriores
    await prisma.matchException.deleteMany({
      where: { matchResultId: existingMatch.id }
    });
  } else {
    matchResult = await prisma.matchResult.create({
      data: {
        purchaseOrderId: purchaseOrder?.id || null,
        goodsReceiptId: goodsReceipt?.id || null,
        facturaId,
        estado: estado as any,
        matchOcRecepcion,
        matchRecepcionFactura,
        matchOcFactura,
        matchCompleto,
        discrepancias: exceptions,
        companyId
      }
    });
  }

  // Crear excepciones detalladas
  if (exceptions.length > 0) {
    await prisma.matchException.createMany({
      data: exceptions.map(exc => ({
        matchResultId: matchResult.id,
        tipo: exc.tipo as any,
        campo: exc.campo,
        valorEsperado: exc.valorEsperado,
        valorRecibido: exc.valorRecibido,
        diferencia: exc.diferencia || null,
        porcentajeDiff: exc.porcentajeDiff || null,
        dentroTolerancia: exc.dentroTolerancia || false
      }))
    });
  }

  // Si hay recepción y match OK, vincular factura a recepción
  if (goodsReceipt && matchCompleto) {
    await prisma.goodsReceipt.update({
      where: { id: goodsReceipt.id },
      data: {
        facturaId,
        tieneFactura: true
      }
    });
  }

  // Registrar en auditoría
  await prisma.purchaseAuditLog.create({
    data: {
      entidad: 'match_result',
      entidadId: matchResult.id,
      accion: 'EJECUTAR_MATCH',
      datosNuevos: {
        estado,
        matchCompleto,
        excepciones: exceptions.length,
        ocId: purchaseOrder?.id,
        recepcionId: goodsReceipt?.id
      },
      companyId,
      userId
    }
  });

  return {
    matchResult,
    exceptions,
    summary: {
      matchOcFactura,
      matchRecepcionFactura,
      matchOcRecepcion,
      matchCompleto,
      estado,
      excepcionesCount: exceptions.length
    }
  };
}

// GET - Listar resultados de match
export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromToken();
    if (!user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const companyId = user.companies?.[0]?.companyId;
    if (!companyId) {
      return NextResponse.json({ error: 'Usuario no tiene empresa asignada' }, { status: 400 });
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const estado = searchParams.get('estado');
    const pendientes = searchParams.get('pendientes');

    const where: Prisma.MatchResultWhereInput = {
      companyId,
      ...(estado && { estado: estado as any }),
      ...(pendientes === 'true' && {
        estado: { in: ['PENDIENTE', 'DISCREPANCIA'] }
      }),
    };

    const [matchResults, total] = await Promise.all([
      prisma.matchResult.findMany({
        where,
        include: {
          purchaseOrder: {
            select: { id: true, numero: true, total: true }
          },
          goodsReceipt: {
            select: { id: true, numero: true }
          },
          factura: {
            select: {
              id: true,
              numeroFactura: true,
              numeroSerie: true,
              total: true,
              fechaEmision: true,
              matchStatus: true,
              payApprovalStatus: true,
              proveedor: { select: { id: true, name: true } }
            }
          },
          exceptions: true,
          lineResults: {
            select: {
              id: true,
              status: true,
              descripcion: true,
              qtyFacturada: true,
              qtyRecibida: true,
              diffPorcentaje: true,
              razon: true
            }
          },
          resueltoByUser: { select: { id: true, name: true } }
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.matchResult.count({ where })
    ]);

    return NextResponse.json({
      data: matchResults,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching match results:', error);
    return NextResponse.json(
      { error: 'Error al obtener los resultados de match' },
      { status: 500 }
    );
  }
}

// POST - Ejecutar match para una factura (NUEVO: por línea)
export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromToken();
    if (!user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const companyId = user.companies?.[0]?.companyId;
    if (!companyId) {
      return NextResponse.json({ error: 'Usuario no tiene empresa asignada' }, { status: 400 });
    }

    const body = await request.json();
    const { facturaId, verificarPago } = body;

    if (!facturaId) {
      return NextResponse.json({ error: 'facturaId es requerido' }, { status: 400 });
    }

    // Si solo quiere verificar si puede pagar
    if (verificarPago) {
      const resultadoPago = await verificarPagoPermitido(parseInt(facturaId), companyId);
      return NextResponse.json(resultadoPago);
    }

    // Ejecutar match por línea y guardar resultados
    const resultado = await ejecutarMatchYGuardar(
      parseInt(facturaId),
      companyId,
      user.id
    );

    return NextResponse.json({
      matchResult: resultado.matchResult,
      factura: {
        id: resultado.factura.id,
        matchStatus: resultado.factura.matchStatus,
        matchCheckedAt: resultado.factura.matchCheckedAt,
        matchBlockReason: resultado.factura.matchBlockReason,
        payApprovalStatus: resultado.factura.payApprovalStatus
      },
      summary: resultado.summary
    });
  } catch (error: any) {
    console.error('Error ejecutando match:', error);
    return NextResponse.json(
      { error: error.message || 'Error al ejecutar el match' },
      { status: 500 }
    );
  }
}
