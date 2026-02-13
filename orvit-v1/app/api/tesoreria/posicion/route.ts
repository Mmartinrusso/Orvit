import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getViewMode, applyViewMode } from '@/lib/view-mode';
import { requirePermission, TESORERIA_PERMISSIONS } from '@/lib/tesoreria/auth';
import { cached } from '@/lib/cache/cache-manager';
import { TTL, tesoreriaKeys } from '@/lib/cache/cache-keys';

export const dynamic = 'force-dynamic';

// GET /api/tesoreria/posicion - Posición consolidada de tesorería
export async function GET(request: NextRequest) {
  try {
    const { user, error } = await requirePermission(TESORERIA_PERMISSIONS.POSICION_VIEW);
    if (error) return error;

    const companyId = user!.companyId;
    const viewMode = getViewMode(request);

    const cacheKey = tesoreriaKeys.summary(companyId, viewMode);

    const data = await cached(cacheKey, async () => {
      // Fechas para vencimientos
      const hoy = new Date();
      const en7Dias = new Date();
      en7Dias.setDate(en7Dias.getDate() + 7);

      // === PARALELO 1: Todas las queries independientes en Promise.all() ===
      const [
        cajas,
        saldosCajas,
        bancos,
        saldosBancos,
        chequesCartera,
        chequesProximosVencer,
        facturasPorPagar,
      ] = await Promise.all([
        // 1a. Cajas activas
        prisma.cashAccount.findMany({
          where: { companyId, isActive: true }
        }),
        // 1b. Saldos de cajas agrupados por cuenta y docType (filtro por companyId)
        prisma.cashMovement.groupBy({
          by: ['cashAccountId', 'docType'],
          where: { cashAccount: { companyId } },
          _sum: { ingreso: true, egreso: true }
        }),
        // 2a. Bancos activos
        prisma.bankAccount.findMany({
          where: { companyId, isActive: true }
        }),
        // 2b. Saldos de bancos agrupados por cuenta (filtro por companyId)
        prisma.bankMovement.groupBy({
          by: ['bankAccountId'],
          where: { bankAccount: { companyId } },
          _sum: { ingreso: true, egreso: true }
        }),
        // 3. Cheques en cartera
        prisma.cheque.findMany({
          where: applyViewMode({ companyId, estado: 'CARTERA' }, viewMode),
          select: {
            id: true,
            numero: true,
            banco: true,
            importe: true,
            moneda: true,
            fechaVencimiento: true,
            origen: true,
            tipo: true,
            docType: true,
          },
          orderBy: { fechaVencimiento: 'asc' }
        }),
        // 4. Cheques próximos a vencer
        prisma.cheque.findMany({
          where: applyViewMode({
            companyId,
            estado: 'CARTERA',
            fechaVencimiento: { gte: hoy, lte: en7Dias }
          }, viewMode),
          select: {
            id: true,
            numero: true,
            banco: true,
            importe: true,
            moneda: true,
            fechaVencimiento: true,
          },
          orderBy: { fechaVencimiento: 'asc' }
        }),
        // 5. Facturas por pagar próximas
        prisma.purchaseReceipt.findMany({
          where: applyViewMode({
            companyId,
            estado: 'pendiente',
            fechaVencimiento: { gte: hoy, lte: en7Dias }
          }, viewMode),
          select: {
            id: true,
            numeroFactura: true,
            total: true,
            fechaVencimiento: true,
            proveedor: {
              select: { name: true }
            }
          },
          orderBy: { fechaVencimiento: 'asc' },
          take: 10
        }),
      ]);

      // === PROCESAMIENTO EN MEMORIA ===

      // Set de IDs activos para filtrar movimientos de cuentas inactivas
      const cajaIdsActivos = new Set(cajas.map(c => c.id));
      const bancoIdsActivos = new Set(bancos.map(b => b.id));

      // Procesar saldos de cajas: calcular saldo T1 y total por caja
      const cajaSaldos = new Map<number, { t1: number; total: number }>();
      for (const row of saldosCajas) {
        const id = row.cashAccountId;
        if (!cajaIdsActivos.has(id)) continue; // Ignorar cuentas inactivas
        if (!cajaSaldos.has(id)) {
          cajaSaldos.set(id, { t1: 0, total: 0 });
        }
        const entry = cajaSaldos.get(id)!;
        const neto = Number(row._sum.ingreso || 0) - Number(row._sum.egreso || 0);
        entry.total += neto;
        if (row.docType === 'T1') {
          entry.t1 += neto;
        }
      }

      const cajasConSaldo = cajas.map((caja) => {
        const saldos = cajaSaldos.get(caja.id) || { t1: 0, total: 0 };
        return {
          id: caja.id,
          codigo: caja.codigo,
          nombre: caja.nombre,
          moneda: caja.moneda,
          saldoT1: saldos.t1,
          saldoTotal: viewMode === 'E' ? saldos.total : null,
        };
      });

      // Procesar saldos de bancos
      const bancoSaldoMap = new Map<number, number>();
      for (const row of saldosBancos) {
        if (!bancoIdsActivos.has(row.bankAccountId)) continue; // Ignorar cuentas inactivas
        bancoSaldoMap.set(
          row.bankAccountId,
          Number(row._sum.ingreso || 0) - Number(row._sum.egreso || 0)
        );
      }

      const bancosConSaldo = bancos.map((banco) => ({
        id: banco.id,
        codigo: banco.codigo,
        nombre: banco.nombre,
        banco: banco.banco,
        moneda: banco.moneda,
        saldoContable: bancoSaldoMap.get(banco.id) || 0,
        saldoBancario: Number(banco.saldoBancario),
      }));

      // Agrupar cheques por moneda
      const chequesResumen: Record<string, { cantidad: number; total: number; t1: number; t2: number }> = {};
      chequesCartera.forEach((cheque) => {
        const moneda = cheque.moneda;
        if (!chequesResumen[moneda]) {
          chequesResumen[moneda] = { cantidad: 0, total: 0, t1: 0, t2: 0 };
        }
        chequesResumen[moneda].cantidad++;
        chequesResumen[moneda].total += Number(cheque.importe);
        if (cheque.docType === 'T1') {
          chequesResumen[moneda].t1 += Number(cheque.importe);
        } else {
          chequesResumen[moneda].t2 += Number(cheque.importe);
        }
      });

      // 4. Calcular totales por moneda
      const totalesPorMoneda: Record<string, {
        efectivo: { t1: number; total: number };
        bancos: number;
        chequesCartera: { t1: number; total: number };
        total: { t1: number; total: number };
      }> = {};

      const ensureMoneda = (moneda: string) => {
        if (!totalesPorMoneda[moneda]) {
          totalesPorMoneda[moneda] = {
            efectivo: { t1: 0, total: 0 },
            bancos: 0,
            chequesCartera: { t1: 0, total: 0 },
            total: { t1: 0, total: 0 }
          };
        }
      };

      cajasConSaldo.forEach((caja) => {
        ensureMoneda(caja.moneda);
        totalesPorMoneda[caja.moneda].efectivo.t1 += caja.saldoT1;
        totalesPorMoneda[caja.moneda].efectivo.total += caja.saldoTotal || caja.saldoT1;
      });

      bancosConSaldo.forEach((banco) => {
        ensureMoneda(banco.moneda);
        totalesPorMoneda[banco.moneda].bancos += banco.saldoContable;
      });

      Object.entries(chequesResumen).forEach(([moneda, data]) => {
        ensureMoneda(moneda);
        totalesPorMoneda[moneda].chequesCartera.t1 = data.t1;
        totalesPorMoneda[moneda].chequesCartera.total = data.total;
      });

      Object.keys(totalesPorMoneda).forEach((moneda) => {
        const m = totalesPorMoneda[moneda];
        m.total.t1 = m.efectivo.t1 + m.bancos + m.chequesCartera.t1;
        m.total.total = m.efectivo.total + m.bancos + m.chequesCartera.total;
      });

      return {
        cajas: cajasConSaldo,
        bancos: bancosConSaldo,
        chequesCartera: {
          items: viewMode === 'E' ? chequesCartera : chequesCartera.filter(c => c.docType === 'T1'),
          resumen: chequesResumen,
        },
        totalesPorMoneda,
        proximosVencimientos: {
          cheques: chequesProximosVencer,
          facturas: facturasPorPagar,
        },
      };
    }, TTL.SHORT); // 60 seconds cache

    return NextResponse.json({
      ...data,
      _m: viewMode
    });
  } catch (error) {
    console.error('Error fetching posicion tesoreria:', error);
    return NextResponse.json(
      { error: 'Error al obtener la posición de tesorería' },
      { status: 500 }
    );
  }
}
