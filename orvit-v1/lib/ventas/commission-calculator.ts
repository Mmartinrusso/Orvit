import { prisma } from '@/lib/prisma';

export interface CommissionResult {
  porcentaje: number;
  monto: number;
  desglose: {
    base: number;
    bonoVolumen: number;
    bonoMargen: number;
    total: number;
  };
}

export async function calculateCommission(orden: any): Promise<CommissionResult> {
  const total = Number(orden.total);
  const margen = Number(orden.margenPorcentaje || 0);

  // Comisión base (configurar por vendedor o usar default)
  const baseCommission = orden.seller?.commissionRate || 3;

  // Bono por volumen (escalonado)
  let volumeBonus = 0;
  if (total >= 1000000) {
    volumeBonus = 2; // +2% para ventas > $1M
  } else if (total >= 500000) {
    volumeBonus = 1; // +1% para ventas > $500K
  } else if (total >= 100000) {
    volumeBonus = 0.5; // +0.5% para ventas > $100K
  }

  // Bono por margen alto
  let marginBonus = 0;
  if (margen >= 40) {
    marginBonus = 1.5; // +1.5% si margen > 40%
  } else if (margen >= 30) {
    marginBonus = 1; // +1% si margen > 30%
  } else if (margen >= 20) {
    marginBonus = 0.5; // +0.5% si margen > 20%
  }

  // Total
  const totalPercentage = baseCommission + volumeBonus + marginBonus;
  const amount = (total * totalPercentage) / 100;

  return {
    porcentaje: totalPercentage,
    monto: amount,
    desglose: {
      base: baseCommission,
      bonoVolumen: volumeBonus,
      bonoMargen: marginBonus,
      total: totalPercentage,
    },
  };
}

export async function updateOrdenCommission(ordenId: number) {
  const orden = await prisma.sale.findUnique({
    where: { id: ordenId },
    include: { seller: true },
  });

  if (!orden || !orden.seller) return;

  const commission = await calculateCommission(orden);

  await prisma.sale.update({
    where: { id: ordenId },
    data: {
      comisionPorcentaje: commission.porcentaje,
      comisionMonto: commission.monto,
    },
  });

  return commission;
}

export async function markCommissionPaid(ordenId: number) {
  await prisma.sale.update({
    where: { id: ordenId },
    data: {
      comisionPagada: true,
      comisionPagadaAt: new Date(),
    },
  });
}

export async function getUnpaidCommissions(vendedorId: number, companyId: number) {
  const ordenes = await prisma.sale.findMany({
    where: {
      sellerId: vendedorId,
      companyId,
      comisionPagada: false,
      comisionMonto: { gt: 0 },
      estado: { in: ['FACTURADA', 'COMPLETADA'] },
    },
    select: {
      id: true,
      numero: true,
      fechaEmision: true,
      total: true,
      comisionPorcentaje: true,
      comisionMonto: true,
      client: {
        select: { name: true, legalName: true },
      },
    },
    orderBy: { fechaEmision: 'desc' },
  });

  const totalComisiones = ordenes.reduce((sum, o) => sum + Number(o.comisionMonto), 0);

  return {
    ordenes,
    totalComisiones,
    count: ordenes.length,
  };
}
