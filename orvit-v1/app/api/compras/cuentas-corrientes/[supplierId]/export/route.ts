import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';
import { prisma } from '@/lib/prisma';
import { getT2Client } from '@/lib/prisma-t2';
import { JWT_SECRET } from '@/lib/auth';
import { Prisma } from '@prisma/client';
import { getViewMode } from '@/lib/view-mode/get-mode';
import { MODE } from '@/lib/view-mode/types';
import { shouldQueryT2 } from '@/lib/view-mode';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

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
 * GET - Exportar cuenta corriente de un proveedor
 *
 * Query params:
 * - format: 'csv' | 'txt' (default: csv)
 * - fechaDesde?: string (ISO date)
 * - fechaHasta?: string (ISO date)
 * - incluirPendientes?: 'true' | 'false'
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ supplierId: string }> }
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

    const { supplierId: supplierIdStr } = await params;
    const supplierId = parseInt(supplierIdStr);
    if (isNaN(supplierId)) {
      return NextResponse.json({ error: 'ID de proveedor inválido' }, { status: 400 });
    }

    const { searchParams } = new URL(request.url);
    const exportFormat = searchParams.get('format') || 'csv';
    const fechaDesde = searchParams.get('fechaDesde');
    const fechaHasta = searchParams.get('fechaHasta');
    const incluirPendientes = searchParams.get('incluirPendientes') !== 'false';

    // Verificar que el proveedor existe
    const proveedor = await prisma.suppliers.findFirst({
      where: { id: supplierId, company_id: companyId }
    });

    if (!proveedor) {
      return NextResponse.json({ error: 'Proveedor no encontrado' }, { status: 404 });
    }

    // Get ViewMode
    const viewMode = getViewMode(request);

    // Filtro por docType según ViewMode
    const docTypeWhereFilter: Prisma.SupplierAccountMovementWhereInput = viewMode === MODE.STANDARD
      ? { OR: [{ docType: 'T1' }, { docType: null }] }
      : {};

    // Construir filtros
    const where: Prisma.SupplierAccountMovementWhereInput = {
      supplierId,
      companyId,
      ...docTypeWhereFilter,
      ...(fechaDesde && { fecha: { gte: new Date(fechaDesde) } }),
      ...(fechaHasta && { fecha: { lte: new Date(fechaHasta) } })
    };

    // Obtener todos los movimientos (sin paginación para export)
    const movimientos = await prisma.supplierAccountMovement.findMany({
      where,
      include: {
        factura: {
          select: { id: true, numeroSerie: true, numeroFactura: true, tipo: true }
        },
        pago: {
          select: { id: true, fechaPago: true }
        },
        notaCreditoDebito: {
          select: { id: true, numero: true, tipo: true }
        }
      },
      orderBy: [
        { fecha: 'asc' },
        { id: 'asc' }
      ]
    });

    // Calcular saldo acumulado
    let saldoAcumulado = 0;
    const movimientosConSaldo = movimientos.map(m => {
      saldoAcumulado += Number(m.debe) - Number(m.haber);
      return {
        ...m,
        saldoAcumulado
      };
    });

    // Obtener facturas pendientes si se solicita
    let facturasPendientes: any[] = [];
    if (incluirPendientes) {
      // T1
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
          estado: true
        },
        orderBy: { fechaVencimiento: 'asc' }
      });

      // Calcular saldo pendiente
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

      facturasPendientes = facturasPendientesT1.map(f => ({
        ...f,
        pagado: pagosMapT1.get(f.id) || 0,
        saldo: Number(f.total) - (pagosMapT1.get(f.id) || 0),
        docType: 'T1'
      })).filter(f => f.saldo > 0);

      // T2 si corresponde
      if (await shouldQueryT2(companyId, viewMode)) {
        try {
          const prismaT2 = getT2Client();
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

          const pendientesT2 = facturasPendientesT2.map(f => ({
            ...f,
            pagado: pagosMapT2.get(f.id) || 0,
            saldo: Number(f.total) - (pagosMapT2.get(f.id) || 0),
            docType: 'T2'
          })).filter(f => f.saldo > 0);

          facturasPendientes = [...facturasPendientes, ...pendientesT2];
        } catch (error) {
          console.error('Error fetching T2 for export:', error);
        }
      }
    }

    // Generar contenido según formato
    if (exportFormat === 'csv') {
      const csvContent = generateCSV(proveedor, movimientosConSaldo, facturasPendientes, fechaDesde, fechaHasta);
      return new NextResponse(csvContent, {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="cuenta_corriente_${proveedor.name?.replace(/[^a-zA-Z0-9]/g, '_')}_${format(new Date(), 'yyyyMMdd')}.csv"`
        }
      });
    } else {
      // Formato TXT (resumen legible)
      const txtContent = generateTXT(proveedor, movimientosConSaldo, facturasPendientes, fechaDesde, fechaHasta);
      return new NextResponse(txtContent, {
        headers: {
          'Content-Type': 'text/plain; charset=utf-8',
          'Content-Disposition': `attachment; filename="cuenta_corriente_${proveedor.name?.replace(/[^a-zA-Z0-9]/g, '_')}_${format(new Date(), 'yyyyMMdd')}.txt"`
        }
      });
    }
  } catch (error) {
    console.error('Error exporting cuenta corriente:', error);
    return NextResponse.json(
      { error: 'Error al exportar cuenta corriente' },
      { status: 500 }
    );
  }
}

function generateCSV(
  proveedor: any,
  movimientos: any[],
  facturasPendientes: any[],
  fechaDesde: string | null,
  fechaHasta: string | null
): string {
  const lines: string[] = [];

  // BOM para Excel UTF-8
  const BOM = '\uFEFF';

  // Encabezado
  lines.push('ESTADO DE CUENTA CORRIENTE');
  lines.push(`Proveedor:,${proveedor.name || ''}`);
  lines.push(`Razón Social:,${proveedor.razon_social || ''}`);
  lines.push(`CUIT:,${proveedor.cuit || ''}`);
  lines.push(`Fecha de emisión:,${format(new Date(), 'dd/MM/yyyy HH:mm', { locale: es })}`);
  if (fechaDesde || fechaHasta) {
    lines.push(`Período:,${fechaDesde ? format(new Date(fechaDesde), 'dd/MM/yyyy') : 'Inicio'} - ${fechaHasta ? format(new Date(fechaHasta), 'dd/MM/yyyy') : 'Actual'}`);
  }
  lines.push('');

  // Movimientos
  lines.push('MOVIMIENTOS');
  lines.push('Fecha,Tipo,Comprobante,Descripción,Debe,Haber,Saldo,Conciliado');

  for (const m of movimientos) {
    const fecha = format(new Date(m.fecha), 'dd/MM/yyyy');
    const tipo = m.tipo;
    const comprobante = m.comprobante || '';
    const descripcion = (m.descripcion || '').replace(/,/g, ';').replace(/\n/g, ' ');
    const debe = Number(m.debe).toFixed(2);
    const haber = Number(m.haber).toFixed(2);
    const saldo = m.saldoAcumulado.toFixed(2);
    const conciliado = m.conciliado ? 'Sí' : 'No';

    lines.push(`${fecha},${tipo},${comprobante},"${descripcion}",${debe},${haber},${saldo},${conciliado}`);
  }

  // Totales
  const totalDebe = movimientos.reduce((sum, m) => sum + Number(m.debe), 0);
  const totalHaber = movimientos.reduce((sum, m) => sum + Number(m.haber), 0);
  const saldoFinal = totalDebe - totalHaber;

  lines.push('');
  lines.push(`TOTALES,,,,"${totalDebe.toFixed(2)}","${totalHaber.toFixed(2)}","${saldoFinal.toFixed(2)}",`);

  // Facturas pendientes
  if (facturasPendientes.length > 0) {
    lines.push('');
    lines.push('FACTURAS PENDIENTES');
    lines.push('Número,Tipo,Fecha Emisión,Vencimiento,Total,Pagado,Saldo,Estado');

    for (const f of facturasPendientes) {
      const numero = `${f.numeroSerie || ''}-${f.numeroFactura || ''}`;
      const fechaEmision = f.fechaEmision ? format(new Date(f.fechaEmision), 'dd/MM/yyyy') : '';
      const vencimiento = f.fechaVencimiento ? format(new Date(f.fechaVencimiento), 'dd/MM/yyyy') : '';
      const vencida = f.fechaVencimiento && new Date(f.fechaVencimiento) < new Date() ? 'VENCIDA' : '';

      lines.push(`${numero},${f.tipo || ''},${fechaEmision},${vencimiento},${Number(f.total).toFixed(2)},${f.pagado.toFixed(2)},${f.saldo.toFixed(2)},${vencida}`);
    }

    const totalPendiente = facturasPendientes.reduce((sum, f) => sum + f.saldo, 0);
    lines.push('');
    lines.push(`TOTAL PENDIENTE,,,,,,${totalPendiente.toFixed(2)},`);
  }

  return BOM + lines.join('\n');
}

function generateTXT(
  proveedor: any,
  movimientos: any[],
  facturasPendientes: any[],
  fechaDesde: string | null,
  fechaHasta: string | null
): string {
  const lines: string[] = [];
  const separator = '='.repeat(80);
  const subSeparator = '-'.repeat(80);

  lines.push(separator);
  lines.push('                    ESTADO DE CUENTA CORRIENTE');
  lines.push(separator);
  lines.push('');
  lines.push(`Proveedor:     ${proveedor.name || ''}`);
  lines.push(`Razón Social:  ${proveedor.razon_social || ''}`);
  lines.push(`CUIT:          ${proveedor.cuit || ''}`);
  lines.push(`Fecha emisión: ${format(new Date(), 'dd/MM/yyyy HH:mm', { locale: es })}`);
  if (fechaDesde || fechaHasta) {
    lines.push(`Período:       ${fechaDesde ? format(new Date(fechaDesde), 'dd/MM/yyyy') : 'Inicio'} - ${fechaHasta ? format(new Date(fechaHasta), 'dd/MM/yyyy') : 'Actual'}`);
  }
  lines.push('');
  lines.push(subSeparator);
  lines.push('                           MOVIMIENTOS');
  lines.push(subSeparator);
  lines.push('');
  lines.push('Fecha        Tipo           Comprobante          Debe          Haber         Saldo');
  lines.push(subSeparator);

  for (const m of movimientos) {
    const fecha = format(new Date(m.fecha), 'dd/MM/yyyy').padEnd(12);
    const tipo = (m.tipo || '').padEnd(14);
    const comprobante = (m.comprobante || '').slice(0, 18).padEnd(18);
    const debe = Number(m.debe).toFixed(2).padStart(12);
    const haber = Number(m.haber).toFixed(2).padStart(14);
    const saldo = m.saldoAcumulado.toFixed(2).padStart(14);

    lines.push(`${fecha} ${tipo} ${comprobante} ${debe} ${haber} ${saldo}`);
  }

  const totalDebe = movimientos.reduce((sum, m) => sum + Number(m.debe), 0);
  const totalHaber = movimientos.reduce((sum, m) => sum + Number(m.haber), 0);
  const saldoFinal = totalDebe - totalHaber;

  lines.push(subSeparator);
  lines.push(`${'TOTALES'.padEnd(46)} ${totalDebe.toFixed(2).padStart(12)} ${totalHaber.toFixed(2).padStart(14)} ${saldoFinal.toFixed(2).padStart(14)}`);
  lines.push('');

  if (facturasPendientes.length > 0) {
    lines.push(subSeparator);
    lines.push('                       FACTURAS PENDIENTES');
    lines.push(subSeparator);
    lines.push('');
    lines.push('Número           Tipo     Vencimiento        Total        Saldo   Estado');
    lines.push(subSeparator);

    for (const f of facturasPendientes) {
      const numero = `${f.numeroSerie || ''}-${f.numeroFactura || ''}`.slice(0, 15).padEnd(16);
      const tipo = (f.tipo || '').padEnd(8);
      const vencimiento = (f.fechaVencimiento ? format(new Date(f.fechaVencimiento), 'dd/MM/yyyy') : '').padEnd(18);
      const total = Number(f.total).toFixed(2).padStart(12);
      const saldo = f.saldo.toFixed(2).padStart(12);
      const estado = f.fechaVencimiento && new Date(f.fechaVencimiento) < new Date() ? 'VENCIDA' : '';

      lines.push(`${numero} ${tipo} ${vencimiento} ${total} ${saldo}   ${estado}`);
    }

    const totalPendiente = facturasPendientes.reduce((sum, f) => sum + f.saldo, 0);
    lines.push(subSeparator);
    lines.push(`${'TOTAL PENDIENTE'.padEnd(44)} ${' '.repeat(12)} ${totalPendiente.toFixed(2).padStart(12)}`);
  }

  lines.push('');
  lines.push(separator);

  return lines.join('\n');
}
