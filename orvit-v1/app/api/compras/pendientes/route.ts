import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';
import { prisma } from '@/lib/prisma';
import { JWT_SECRET } from '@/lib/auth';
import { Prisma } from '@prisma/client';
import { getViewMode } from '@/lib/view-mode/get-mode';
import { applyViewMode } from '@/lib/view-mode/prisma-helper';

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
  } catch {
    return null;
  }
}

/**
 * GET - Bandeja de Pendientes (Torre de Control)
 *
 * Muestra trabajo pendiente sin tocar funcionalidad existente:
 *
 * 1. devolucionesAprobadas: PR aprobadas por proveedor pero NO enviadas
 * 2. devolucionesSinNCA: PR enviadas/recibidas sin NCA asociada
 * 3. ncasPendientesAplicar: NCAs emitidas pero no aplicadas
 * 4. ndaPendientesAplicar: NDAs emitidas pero no aplicadas
 *
 * Query params:
 * - proveedorId: filtrar por proveedor específico
 * - limit: límite de items por categoría (default: 10)
 */
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
    const proveedorId = searchParams.get('proveedorId');
    const limit = parseInt(searchParams.get('limit') || '10');

    // Get ViewMode from middleware header
    const viewMode = getViewMode(request);

    // Base filters
    const proveedorFilter = proveedorId ? { proveedorId: parseInt(proveedorId) } : {};

    // 1. Devoluciones aprobadas pero NO enviadas
    const devolucionesAprobadas = await prisma.purchaseReturn.findMany({
      where: {
        companyId,
        ...proveedorFilter,
        estado: 'APROBADA_PROVEEDOR'
      },
      include: {
        proveedor: { select: { id: true, name: true } },
        warehouse: { select: { id: true, codigo: true, nombre: true } },
        items: {
          include: {
            supplierItem: { select: { id: true, nombre: true } }
          }
        },
        _count: { select: { items: true } }
      },
      orderBy: { fechaSolicitud: 'asc' }, // Más antiguas primero
      take: limit
    });

    const countDevolucionesAprobadas = await prisma.purchaseReturn.count({
      where: {
        companyId,
        ...proveedorFilter,
        estado: 'APROBADA_PROVEEDOR'
      }
    });

    // 2. Devoluciones enviadas/recibidas sin NCA asociada
    const devolucionesSinNCA = await prisma.purchaseReturn.findMany({
      where: {
        companyId,
        ...proveedorFilter,
        estado: { in: ['ENVIADA', 'RECIBIDA_PROVEEDOR'] },
        creditNotes: {
          none: {
            estado: { not: 'ANULADA' }
          }
        }
      },
      include: {
        proveedor: { select: { id: true, name: true } },
        warehouse: { select: { id: true, codigo: true, nombre: true } },
        items: {
          include: {
            supplierItem: { select: { id: true, nombre: true } }
          }
        },
        _count: { select: { items: true } }
      },
      orderBy: { fechaEnvio: 'asc' }, // Más antiguas primero
      take: limit
    });

    const countDevolucionesSinNCA = await prisma.purchaseReturn.count({
      where: {
        companyId,
        ...proveedorFilter,
        estado: { in: ['ENVIADA', 'RECIBIDA_PROVEEDOR'] },
        creditNotes: {
          none: {
            estado: { not: 'ANULADA' }
          }
        }
      }
    });

    // 3. NCAs pendientes de aplicar (con ViewMode filter)
    const ncaWhereBase: Prisma.CreditDebitNoteWhereInput = {
      companyId,
      ...(proveedorFilter.proveedorId && { proveedorId: proveedorFilter.proveedorId }),
      tipo: 'NOTA_CREDITO',
      aplicada: false,
      estado: { in: ['PENDIENTE', 'EMITIDA', 'APROBADA'] }
    };

    const ncaWhere = applyViewMode(ncaWhereBase, viewMode);

    const ncasPendientes = await prisma.creditDebitNote.findMany({
      where: ncaWhere,
      include: {
        proveedor: { select: { id: true, name: true, cuit: true } },
        factura: { select: { id: true, numero_factura: true } },
        purchaseReturn: { select: { id: true, numero: true, estado: true } },
        _count: { select: { items: true } }
      },
      orderBy: { fechaEmision: 'asc' }, // Más antiguas primero
      take: limit
    });

    const countNcasPendientes = await prisma.creditDebitNote.count({ where: ncaWhere });

    // 4. NDAs pendientes de aplicar (con ViewMode filter)
    const ndaWhereBase: Prisma.CreditDebitNoteWhereInput = {
      companyId,
      ...(proveedorFilter.proveedorId && { proveedorId: proveedorFilter.proveedorId }),
      tipo: 'NOTA_DEBITO',
      aplicada: false,
      estado: { in: ['PENDIENTE', 'EMITIDA', 'APROBADA'] }
    };

    const ndaWhere = applyViewMode(ndaWhereBase, viewMode);

    const ndaPendientes = await prisma.creditDebitNote.findMany({
      where: ndaWhere,
      include: {
        proveedor: { select: { id: true, name: true, cuit: true } },
        factura: { select: { id: true, numero_factura: true } },
        _count: { select: { items: true } }
      },
      orderBy: { fechaEmision: 'asc' }, // Más antiguas primero
      take: limit
    });

    const countNdaPendientes = await prisma.creditDebitNote.count({ where: ndaWhere });

    // Calcular totales monetarios
    const totalNcasPendientes = ncasPendientes.reduce(
      (acc, nca) => acc + parseFloat(nca.total.toString()),
      0
    );

    const totalNdaPendientes = ndaPendientes.reduce(
      (acc, nda) => acc + parseFloat(nda.total.toString()),
      0
    );

    // Calcular valor estimado de devoluciones (si tienen precio de referencia)
    let valorDevolucionesAprobadas = 0;
    for (const dev of devolucionesAprobadas) {
      for (const item of dev.items) {
        if (item.precioReferencia) {
          valorDevolucionesAprobadas += parseFloat(item.cantidad.toString()) *
                                        parseFloat(item.precioReferencia.toString());
        }
      }
    }

    let valorDevolucionesSinNCA = 0;
    for (const dev of devolucionesSinNCA) {
      for (const item of dev.items) {
        if (item.precioReferencia) {
          valorDevolucionesSinNCA += parseFloat(item.cantidad.toString()) *
                                    parseFloat(item.precioReferencia.toString());
        }
      }
    }

    return NextResponse.json({
      resumen: {
        totalPendientes: countDevolucionesAprobadas + countDevolucionesSinNCA +
                        countNcasPendientes + countNdaPendientes,
        devoluciones: {
          aprobadasParaEnviar: countDevolucionesAprobadas,
          esperandoNCA: countDevolucionesSinNCA,
          valorEstimadoAprobadas: valorDevolucionesAprobadas,
          valorEstimadoSinNCA: valorDevolucionesSinNCA
        },
        notas: {
          ncasPendientes: countNcasPendientes,
          ndaPendientes: countNdaPendientes,
          totalNcas: totalNcasPendientes,
          totalNdas: totalNdaPendientes,
          diferenciaNeta: totalNcasPendientes - totalNdaPendientes // Saldo a favor si > 0
        }
      },
      devolucionesAprobadas: {
        items: devolucionesAprobadas.map(dev => ({
          ...dev,
          diasEsperando: Math.floor(
            (Date.now() - new Date(dev.fechaSolicitud).getTime()) / (1000 * 60 * 60 * 24)
          )
        })),
        count: countDevolucionesAprobadas,
        accion: 'Enviar mercadería al proveedor'
      },
      devolucionesSinNCA: {
        items: devolucionesSinNCA.map(dev => ({
          ...dev,
          diasDesdeEnvio: dev.fechaEnvio
            ? Math.floor((Date.now() - new Date(dev.fechaEnvio).getTime()) / (1000 * 60 * 60 * 24))
            : null
        })),
        count: countDevolucionesSinNCA,
        accion: 'Solicitar/Registrar NCA del proveedor'
      },
      ncasPendientesAplicar: {
        items: ncasPendientes.map(nca => ({
          ...nca,
          diasSinAplicar: Math.floor(
            (Date.now() - new Date(nca.fechaEmision).getTime()) / (1000 * 60 * 60 * 24)
          )
        })),
        count: countNcasPendientes,
        total: totalNcasPendientes,
        accion: 'Aplicar a cuenta corriente e imputar a facturas'
      },
      ndaPendientesAplicar: {
        items: ndaPendientes.map(nda => ({
          ...nda,
          diasSinAplicar: Math.floor(
            (Date.now() - new Date(nda.fechaEmision).getTime()) / (1000 * 60 * 60 * 24)
          )
        })),
        count: countNdaPendientes,
        total: totalNdaPendientes,
        accion: 'Aplicar a cuenta corriente'
      }
    });
  } catch (error) {
    console.error('Error fetching pendientes:', error);
    return NextResponse.json(
      { error: 'Error al obtener los pendientes' },
      { status: 500 }
    );
  }
}
