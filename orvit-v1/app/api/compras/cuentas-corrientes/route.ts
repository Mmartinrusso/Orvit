import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';
import { prisma } from '@/lib/prisma';
import { JWT_SECRET } from '@/lib/auth';
import { Prisma } from '@prisma/client';
import { getViewMode } from '@/lib/view-mode/get-mode';
import { MODE } from '@/lib/view-mode/types';

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

// GET - Listar cuentas corrientes de proveedores con saldos
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
    const search = searchParams.get('search');
    const conSaldo = searchParams.get('conSaldo'); // 'true' para solo con saldo pendiente
    const orderBy = searchParams.get('orderBy') || 'saldo'; // 'saldo', 'nombre', 'ultimoMovimiento'
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');

    // Get ViewMode from middleware header
    const viewMode = getViewMode(request);

    // =================================================================
    // BD T2 SEPARADA: Siempre excluir T2 (ahora vive en BD separada)
    // Los movimientos T2 se consultan de BD T2 por separado si está habilitado
    // =================================================================
    const docTypeFilter = Prisma.sql`AND (m."docType" != 'T2' OR m."docType" IS NULL)`;

    // Verificar si la tabla SupplierAccountMovement existe
    let tableExists = true;
    try {
      await prisma.$queryRaw`SELECT 1 FROM "SupplierAccountMovement" LIMIT 1`;
    } catch {
      tableExists = false;
    }

    // Si la tabla no existe, devolver proveedores sin movimientos
    if (!tableExists) {
      const proveedores = await prisma.suppliers.findMany({
        where: {
          company_id: companyId,
          ...(search ? {
            OR: [
              { name: { contains: search, mode: Prisma.QueryMode.insensitive } },
              { razon_social: { contains: search, mode: Prisma.QueryMode.insensitive } },
              { cuit: { contains: search, mode: Prisma.QueryMode.insensitive } }
            ]
          } : {})
        },
        orderBy: orderBy === 'nombre' ? { name: 'asc' } : { name: 'asc' },
        skip: (page - 1) * limit,
        take: limit
      });

      return NextResponse.json({
        data: proveedores.map(p => ({
          supplierId: p.id,
          supplierName: p.name,
          razonSocial: p.razon_social,
          cuit: p.cuit,
          condicionIva: p.condicion_iva,
          totalDebe: 0,
          totalHaber: 0,
          saldoActual: 0,
          totalFacturas: 0,
          totalPagos: 0,
          facturasVencidas: 0,
          ultimoMovimiento: null
        })),
        totales: {
          totalProveedores: proveedores.length,
          totalDeuda: 0,
          totalPagado: 0,
          saldoTotal: 0,
          facturasVencidas: 0
        },
        aging: {
          corriente: 0,
          vencido_1_30: 0,
          vencido_31_60: 0,
          vencido_61_90: 0,
          vencido_mas_90: 0
        },
        pagination: { page, limit },
        warning: 'La tabla de movimientos no existe. Ejecuta la migración SQL para habilitar cuentas corrientes.'
      });
    }

    // Obtener todos los proveedores con sus movimientos agregados
    // Filtrado por ViewMode (docType)
    const proveedoresRaw = await prisma.$queryRaw<any[]>`
      SELECT
        s.id as "supplierId",
        s.name as "supplierName",
        s.razon_social as "razonSocial",
        s.cuit,
        s.condicion_iva as "condicionIva",
        s.condiciones_pago as "condicionesPago",
        COALESCE(SUM(m."debe"), 0)::decimal as "totalDebe",
        COALESCE(SUM(m."haber"), 0)::decimal as "totalHaber",
        (COALESCE(SUM(m."debe"), 0) - COALESCE(SUM(m."haber"), 0))::decimal as "saldoActual",
        COUNT(DISTINCT CASE WHEN m."tipo" = 'FACTURA' THEN m.id END)::int as "totalFacturas",
        COUNT(DISTINCT CASE WHEN m."tipo" = 'PAGO' THEN m.id END)::int as "totalPagos",
        COUNT(DISTINCT CASE
          WHEN m."tipo" = 'FACTURA'
          AND m."fechaVencimiento" < CURRENT_DATE
          AND m."conciliado" = false
          THEN m.id
        END)::int as "facturasVencidas",
        MAX(m."fecha") as "ultimoMovimiento"
      FROM "suppliers" s
      LEFT JOIN "SupplierAccountMovement" m ON s.id = m."supplierId" ${docTypeFilter}
      WHERE s.company_id = ${companyId}
      ${search ? Prisma.sql`AND (
        s.name ILIKE ${`%${search}%`}
        OR s.razon_social ILIKE ${`%${search}%`}
        OR s.cuit ILIKE ${`%${search}%`}
      )` : Prisma.empty}
      GROUP BY s.id, s.name, s.razon_social, s.cuit, s.condicion_iva, s.condiciones_pago
      ${conSaldo === 'true' ? Prisma.sql`HAVING (COALESCE(SUM(m."debe"), 0) - COALESCE(SUM(m."haber"), 0)) <> 0` : Prisma.empty}
      ORDER BY ${orderBy === 'nombre' ? Prisma.sql`s.name ASC` : orderBy === 'ultimoMovimiento' ? Prisma.sql`MAX(m."fecha") DESC NULLS LAST` : Prisma.sql`(COALESCE(SUM(m."debe"), 0) - COALESCE(SUM(m."haber"), 0)) DESC`}
      LIMIT ${limit}
      OFFSET ${(page - 1) * limit}
    `;

    // Obtener totales generales (filtrado por ViewMode)
    const totales = await prisma.$queryRaw<any[]>`
      SELECT
        COUNT(DISTINCT s.id)::int as "totalProveedores",
        COALESCE(SUM(m."debe"), 0)::decimal as "totalDeuda",
        COALESCE(SUM(m."haber"), 0)::decimal as "totalPagado",
        (COALESCE(SUM(m."debe"), 0) - COALESCE(SUM(m."haber"), 0))::decimal as "saldoTotal",
        COUNT(DISTINCT CASE
          WHEN m."tipo" = 'FACTURA'
          AND m."fechaVencimiento" < CURRENT_DATE
          AND m."conciliado" = false
          THEN m.id
        END)::int as "facturasVencidas"
      FROM "suppliers" s
      LEFT JOIN "SupplierAccountMovement" m ON s.id = m."supplierId" ${docTypeFilter}
      WHERE s.company_id = ${companyId}
    `;

    // Antigüedad de saldos (aging) - excluir T2 (está en BD separada)
    const agingDocTypeFilter = Prisma.sql`AND (m."docType" != 'T2' OR m."docType" IS NULL)`;

    const aging = await prisma.$queryRaw<any[]>`
      SELECT
        COALESCE(SUM(CASE
          WHEN m."fechaVencimiento" >= CURRENT_DATE
          THEN m."debe" - m."haber"
          ELSE 0
        END), 0)::decimal as "corriente",
        COALESCE(SUM(CASE
          WHEN m."fechaVencimiento" < CURRENT_DATE
          AND m."fechaVencimiento" >= CURRENT_DATE - INTERVAL '30 days'
          THEN m."debe" - m."haber"
          ELSE 0
        END), 0)::decimal as "vencido_1_30",
        COALESCE(SUM(CASE
          WHEN m."fechaVencimiento" < CURRENT_DATE - INTERVAL '30 days'
          AND m."fechaVencimiento" >= CURRENT_DATE - INTERVAL '60 days'
          THEN m."debe" - m."haber"
          ELSE 0
        END), 0)::decimal as "vencido_31_60",
        COALESCE(SUM(CASE
          WHEN m."fechaVencimiento" < CURRENT_DATE - INTERVAL '60 days'
          AND m."fechaVencimiento" >= CURRENT_DATE - INTERVAL '90 days'
          THEN m."debe" - m."haber"
          ELSE 0
        END), 0)::decimal as "vencido_61_90",
        COALESCE(SUM(CASE
          WHEN m."fechaVencimiento" < CURRENT_DATE - INTERVAL '90 days'
          THEN m."debe" - m."haber"
          ELSE 0
        END), 0)::decimal as "vencido_mas_90"
      FROM "SupplierAccountMovement" m
      JOIN "suppliers" s ON m."supplierId" = s.id
      WHERE s.company_id = ${companyId}
      AND m."tipo" = 'FACTURA'
      ${agingDocTypeFilter}
    `;

    return NextResponse.json({
      data: proveedoresRaw.map(p => ({
        ...p,
        totalDebe: Number(p.totalDebe),
        totalHaber: Number(p.totalHaber),
        saldoActual: Number(p.saldoActual)
      })),
      totales: {
        totalProveedores: totales[0]?.totalProveedores || 0,
        totalDeuda: Number(totales[0]?.totalDeuda || 0),
        totalPagado: Number(totales[0]?.totalPagado || 0),
        saldoTotal: Number(totales[0]?.saldoTotal || 0),
        facturasVencidas: totales[0]?.facturasVencidas || 0
      },
      aging: {
        corriente: Number(aging[0]?.corriente || 0),
        vencido_1_30: Number(aging[0]?.vencido_1_30 || 0),
        vencido_31_60: Number(aging[0]?.vencido_31_60 || 0),
        vencido_61_90: Number(aging[0]?.vencido_61_90 || 0),
        vencido_mas_90: Number(aging[0]?.vencido_mas_90 || 0)
      },
      pagination: {
        page,
        limit
      }
    });
  } catch (error) {
    console.error('Error fetching cuentas corrientes:', error);
    return NextResponse.json(
      { error: 'Error al obtener cuentas corrientes' },
      { status: 500 }
    );
  }
}
