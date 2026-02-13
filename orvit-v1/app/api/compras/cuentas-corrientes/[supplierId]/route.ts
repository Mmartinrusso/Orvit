import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';
import { prisma } from '@/lib/prisma';
import { JWT_SECRET } from '@/lib/auth';
import { Prisma } from '@prisma/client';
import { getViewMode } from '@/lib/view-mode/get-mode';
import { MODE } from '@/lib/view-mode/types';
import { executeT2Query, createT2StatusResponse } from '@/lib/view-mode';

export const dynamic = 'force-dynamic';

const JWT_SECRET_KEY = new TextEncoder().encode(JWT_SECRET);

async function getUserFromToken() {
  try {
    const token = cookies().get('token')?.value;
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

// GET - Obtener estado de cuenta de un proveedor
export async function GET(
  request: NextRequest,
  { params }: { params: { supplierId: string } }
) {
  try {
    const user = await getUserFromToken();
    if (!user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const companyId = user.companies?.[0]?.companyId;
    if (!companyId) {
      return NextResponse.json({ error: 'Usuario no tiene empresa asignada' }, { status: 400 });
    }

    const supplierId = parseInt(params.supplierId);
    if (isNaN(supplierId)) {
      return NextResponse.json({ error: 'ID de proveedor inválido' }, { status: 400 });
    }

    const { searchParams } = new URL(request.url);
    const fechaDesde = searchParams.get('fechaDesde');
    const fechaHasta = searchParams.get('fechaHasta');
    const tipo = searchParams.get('tipo'); // FACTURA, PAGO, NC, ND, etc.
    const pendientes = searchParams.get('pendientes'); // Solo no conciliados
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '100');

    // Verificar que el proveedor existe y pertenece a la empresa
    const proveedor = await prisma.suppliers.findFirst({
      where: { id: supplierId, company_id: companyId }
    });

    if (!proveedor) {
      return NextResponse.json({ error: 'Proveedor no encontrado' }, { status: 404 });
    }

    // Verificar si la tabla SupplierAccountMovement existe
    let tableExists = true;
    try {
      await prisma.$queryRaw`SELECT 1 FROM "SupplierAccountMovement" LIMIT 1`;
    } catch {
      tableExists = false;
    }

    // Si la tabla no existe, devolver datos vacíos del proveedor
    if (!tableExists) {
      return NextResponse.json({
        proveedor: {
          id: proveedor.id,
          nombre: proveedor.name,
          razonSocial: proveedor.razon_social,
          cuit: proveedor.cuit,
          condicionIva: proveedor.condicion_iva,
          condicionesPago: proveedor.condiciones_pago,
          cbu: proveedor.cbu,
          aliasCbu: proveedor.alias_cbu,
          banco: proveedor.banco
        },
        saldos: {
          totalDebe: 0,
          totalHaber: 0,
          saldoActual: 0,
          saldoAnterior: 0
        },
        movimientos: [],
        facturasPendientes: [],
        pagination: { page, limit, total: 0, totalPages: 0 },
        warning: 'La tabla de movimientos no existe. Ejecuta la migración SQL para habilitar cuentas corrientes.'
      });
    }

    // Get ViewMode from middleware header
    const viewMode = getViewMode(request);
    console.log('[cuentas-corrientes/supplierId] ViewMode:', viewMode);

    // Filtro SQL para docType según ViewMode
    // Standard: T1 + null (legacy), Extended: todos
    const docTypeFilter = viewMode === MODE.STANDARD
      ? Prisma.sql`AND (m."docType" = 'T1' OR m."docType" IS NULL)`
      : Prisma.empty;

    // Prisma where filter for docType
    const docTypeWhereFilter: Prisma.SupplierAccountMovementWhereInput = viewMode === MODE.STANDARD
      ? { OR: [{ docType: 'T1' }, { docType: null }] }
      : {};

    // Construir filtros
    const where: Prisma.SupplierAccountMovementWhereInput = {
      supplierId,
      companyId,
      ...docTypeWhereFilter,
      ...(fechaDesde && { fecha: { gte: new Date(fechaDesde) } }),
      ...(fechaHasta && { fecha: { lte: new Date(fechaHasta) } }),
      ...(tipo && { tipo: tipo as any }),
      ...(pendientes === 'true' && { conciliado: false })
    };

    // Obtener movimientos con saldo acumulado
    const [movimientos, total] = await Promise.all([
      prisma.supplierAccountMovement.findMany({
        where,
        include: {
          factura: {
            select: {
              id: true,
              numeroSerie: true,
              numeroFactura: true,
              tipo: true,
              estado: true
            }
          },
          pago: {
            select: {
              id: true,
              fechaPago: true,
              totalPago: true,
              efectivo: true,
              transferencia: true,
              chequesTerceros: true,
              chequesPropios: true
            }
          },
          notaCreditoDebito: {
            select: {
              id: true,
              numero: true,
              tipo: true,
              estado: true
            }
          },
          createdByUser: {
            select: { id: true, name: true }
          }
        },
        orderBy: [
          { fecha: 'desc' },
          { id: 'desc' }
        ],
        skip: (page - 1) * limit,
        take: limit
      }),
      prisma.supplierAccountMovement.count({ where })
    ]);

    // Calcular saldos (filtrado por ViewMode)
    const saldos = await prisma.$queryRaw<any[]>`
      SELECT
        COALESCE(SUM(m."debe"), 0)::decimal as "totalDebe",
        COALESCE(SUM(m."haber"), 0)::decimal as "totalHaber",
        (COALESCE(SUM(m."debe"), 0) - COALESCE(SUM(m."haber"), 0))::decimal as "saldoActual"
      FROM "SupplierAccountMovement" m
      WHERE m."supplierId" = ${supplierId}
      AND m."companyId" = ${companyId}
      ${docTypeFilter}
    `;

    // Saldo anterior (antes de fechaDesde si está definido) - filtrado por ViewMode
    let saldoAnterior = 0;
    if (fechaDesde) {
      const saldoAnt = await prisma.$queryRaw<any[]>`
        SELECT
          (COALESCE(SUM(m."debe"), 0) - COALESCE(SUM(m."haber"), 0))::decimal as "saldo"
        FROM "SupplierAccountMovement" m
        WHERE m."supplierId" = ${supplierId}
        AND m."companyId" = ${companyId}
        AND m."fecha" < ${new Date(fechaDesde)}
        ${docTypeFilter}
      `;
      saldoAnterior = Number(saldoAnt[0]?.saldo || 0);
    }

    // Facturas pendientes T1 (de BD principal)
    // Standard: solo T1 + null, Extended: T1 + null (T2 viene de BD separada)
    const facturasPendientesT1 = await prisma.purchaseReceipt.findMany({
      where: {
        proveedorId: supplierId,
        companyId,
        estado: { in: ['pendiente', 'parcial'] },
        OR: [{ docType: 'T1' }, { docType: null }]
      },
      select: {
        id: true,
        numeroSerie: true,
        numeroFactura: true,
        tipo: true,
        fechaEmision: true,
        fechaVencimiento: true,
        total: true,
        estado: true,
        docType: true
      },
      orderBy: { fechaVencimiento: 'asc' }
    });

    // Calcular saldo pendiente por factura T1 (optimizado: una sola query)
    const facturaIdsT1 = facturasPendientesT1.map(f => f.id);
    const pagosAgrupadosT1 = facturaIdsT1.length > 0
      ? await prisma.paymentOrderReceipt.groupBy({
          by: ['receiptId'],
          where: { receiptId: { in: facturaIdsT1 } },
          _sum: { montoAplicado: true }
        })
      : [];

    const pagosMapT1 = new Map(
      pagosAgrupadosT1.map(p => [p.receiptId, Number(p._sum.montoAplicado || 0)])
    );

    const facturasPendientesT1ConSaldo = facturasPendientesT1.map(factura => {
      const pagado = pagosMapT1.get(factura.id) || 0;
      const saldo = Number(factura.total) - pagado;
      return {
        ...factura,
        total: Number(factura.total),
        pagado,
        saldo,
        vencida: factura.fechaVencimiento && new Date(factura.fechaVencimiento) < new Date()
      };
    });

    // Facturas pendientes T2 (de BD separada) - usando helper con manejo de errores consistente
    const t2Result = await executeT2Query(
      companyId,
      viewMode,
      async (prismaT2) => {
        const facturasPendientesT2 = await prismaT2.t2PurchaseReceipt.findMany({
          where: {
            supplierId,
            companyId,
            estado: { in: ['pendiente', 'parcial'] }
          },
          select: {
            id: true,
            numeroSerie: true,
            numeroFactura: true,
            tipo: true,
            fechaEmision: true,
            fechaVencimiento: true,
            total: true,
            estado: true
          },
          orderBy: { fechaVencimiento: 'asc' }
        });

        // Calcular saldo pendiente por factura T2 (optimizado: una sola query)
        const facturaIdsT2 = facturasPendientesT2.map(f => f.id);
        const pagosAgrupadosT2 = facturaIdsT2.length > 0
          ? await prismaT2.t2PaymentOrderReceipt.groupBy({
              by: ['receiptId'],
              where: { receiptId: { in: facturaIdsT2 } },
              _sum: { montoAplicado: true }
            })
          : [];

        const pagosMapT2 = new Map(
          pagosAgrupadosT2.map(p => [p.receiptId, Number(p._sum.montoAplicado || 0)])
        );

        return facturasPendientesT2.map(factura => {
          const pagado = pagosMapT2.get(factura.id) || 0;
          const saldo = Number(factura.total) - pagado;
          return {
            ...factura,
            total: Number(factura.total),
            pagado,
            saldo,
            docType: 'T2' as const,
            vencida: factura.fechaVencimiento && new Date(factura.fechaVencimiento) < new Date()
          };
        });
      },
      [] // fallback: array vacío si T2 no disponible
    );

    const facturasPendientesT2ConSaldo = t2Result.data;

    // Combinar facturas T1 y T2
    const facturasPendientesConSaldo = [
      ...facturasPendientesT1ConSaldo,
      ...facturasPendientesT2ConSaldo
    ].sort((a, b) => {
      // Ordenar por fecha de vencimiento
      const fechaA = a.fechaVencimiento ? new Date(a.fechaVencimiento).getTime() : Infinity;
      const fechaB = b.fechaVencimiento ? new Date(b.fechaVencimiento).getTime() : Infinity;
      return fechaA - fechaB;
    });

    return NextResponse.json({
      proveedor: {
        id: proveedor.id,
        nombre: proveedor.name,
        razonSocial: proveedor.razon_social,
        cuit: proveedor.cuit,
        condicionIva: proveedor.condicion_iva,
        condicionesPago: proveedor.condiciones_pago,
        cbu: proveedor.cbu,
        aliasCbu: proveedor.alias_cbu,
        banco: proveedor.banco
      },
      saldos: {
        totalDebe: Number(saldos[0]?.totalDebe || 0),
        totalHaber: Number(saldos[0]?.totalHaber || 0),
        saldoActual: Number(saldos[0]?.saldoActual || 0),
        saldoAnterior
      },
      movimientos: movimientos.map(m => ({
        ...m,
        debe: Number(m.debe),
        haber: Number(m.haber),
        saldoMovimiento: Number(m.saldoMovimiento)
      })),
      facturasPendientes: facturasPendientesConSaldo.filter(f => f.saldo > 0),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      },
      // Metadata de disponibilidad T2
      t2Status: createT2StatusResponse(t2Result.status),
      viewMode
    });
  } catch (error) {
    console.error('Error fetching cuenta corriente:', error);
    return NextResponse.json(
      { error: 'Error al obtener cuenta corriente' },
      { status: 500 }
    );
  }
}

// POST - Crear movimiento manual (ajuste)
export async function POST(
  request: NextRequest,
  { params }: { params: { supplierId: string } }
) {
  try {
    const user = await getUserFromToken();
    if (!user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const companyId = user.companies?.[0]?.companyId;
    if (!companyId) {
      return NextResponse.json({ error: 'Usuario no tiene empresa asignada' }, { status: 400 });
    }

    const supplierId = parseInt(params.supplierId);
    if (isNaN(supplierId)) {
      return NextResponse.json({ error: 'ID de proveedor inválido' }, { status: 400 });
    }

    // Verificar que el proveedor existe
    const proveedor = await prisma.suppliers.findFirst({
      where: { id: supplierId, company_id: companyId }
    });

    if (!proveedor) {
      return NextResponse.json({ error: 'Proveedor no encontrado' }, { status: 404 });
    }

    const body = await request.json();
    const { tipo, fecha, monto, descripcion, comprobante } = body;

    // Validaciones
    if (!tipo || tipo !== 'AJUSTE') {
      return NextResponse.json(
        { error: 'Solo se permiten movimientos de tipo AJUSTE' },
        { status: 400 }
      );
    }

    if (!monto || monto === 0) {
      return NextResponse.json({ error: 'El monto es requerido' }, { status: 400 });
    }

    if (!descripcion) {
      return NextResponse.json({ error: 'La descripción es requerida' }, { status: 400 });
    }

    // Crear el movimiento de ajuste
    const movimiento = await prisma.supplierAccountMovement.create({
      data: {
        supplierId,
        companyId,
        tipo: 'AJUSTE',
        fecha: fecha ? new Date(fecha) : new Date(),
        debe: monto > 0 ? monto : 0, // Positivo = aumenta deuda
        haber: monto < 0 ? Math.abs(monto) : 0, // Negativo = disminuye deuda
        descripcion,
        comprobante: comprobante || `AJUSTE-${Date.now()}`,
        createdBy: user.id
      }
    });

    // Registrar en auditoría
    await prisma.purchaseAuditLog.create({
      data: {
        entidad: 'supplier_account',
        entidadId: supplierId,
        accion: 'AJUSTE_MANUAL',
        datosNuevos: {
          movimientoId: movimiento.id,
          monto,
          descripcion
        },
        companyId,
        userId: user.id
      }
    });

    return NextResponse.json({
      message: 'Ajuste creado exitosamente',
      movimiento
    }, { status: 201 });
  } catch (error) {
    console.error('Error creating ajuste:', error);
    return NextResponse.json(
      { error: 'Error al crear ajuste' },
      { status: 500 }
    );
  }
}
