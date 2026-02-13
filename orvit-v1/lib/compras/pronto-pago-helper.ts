import { prisma } from '@/lib/prisma';
import { addDays, isBefore, isAfter, differenceInDays } from 'date-fns';

interface ProntoPagoConfig {
  diasParaDescuento: number;
  porcentajeDescuento: number;
  aplicaSobre: 'NETO' | 'TOTAL' | 'NETO_SIN_IVA';
}

interface ProntoPagoCalculo {
  disponible: boolean;
  fechaLimite: Date | null;
  porcentaje: number;
  montoDescuento: number;
  montoAPagar: number;
  montoOriginal: number;
  diasRestantes: number;
  estado: 'DISPONIBLE' | 'VENCIDO' | 'APLICADO' | 'NO_DISPONIBLE';
  mensaje: string;
}

/**
 * Calcula el pronto pago para una factura basándose en las condiciones del proveedor
 */
export async function calcularProntoPago(
  facturaId: number,
  companyId: number
): Promise<ProntoPagoCalculo> {
  const factura = await prisma.purchaseReceipt.findFirst({
    where: { id: facturaId, companyId },
    include: {
      proveedor: {
        select: {
          prontoPagoDias: true,
          prontoPagoPorcentaje: true,
          prontoPagoAplicaSobre: true
        }
      }
    }
  });

  if (!factura) {
    throw new Error('Factura no encontrada');
  }

  // Si ya se aplicó pronto pago
  if (factura.prontoPagoAplicado) {
    return {
      disponible: false,
      fechaLimite: factura.prontoPagoFechaLimite,
      porcentaje: Number(factura.prontoPagoPorcentaje || 0),
      montoDescuento: Number(factura.prontoPagoMonto || 0),
      montoAPagar: Number(factura.total) - Number(factura.prontoPagoMonto || 0),
      montoOriginal: Number(factura.total),
      diasRestantes: 0,
      estado: 'APLICADO',
      mensaje: `Pronto pago ya aplicado el ${factura.prontoPagoAplicadoAt?.toLocaleDateString('es-AR')}`
    };
  }

  // Si el proveedor no tiene condiciones de pronto pago
  if (!factura.proveedor.prontoPagoDias || !factura.proveedor.prontoPagoPorcentaje) {
    return {
      disponible: false,
      fechaLimite: null,
      porcentaje: 0,
      montoDescuento: 0,
      montoAPagar: Number(factura.total),
      montoOriginal: Number(factura.total),
      diasRestantes: 0,
      estado: 'NO_DISPONIBLE',
      mensaje: 'El proveedor no tiene condiciones de pronto pago configuradas'
    };
  }

  // Calcular fecha límite
  const fechaLimite = addDays(
    factura.fechaEmision,
    factura.proveedor.prontoPagoDias
  );

  const hoy = new Date();
  const diasRestantes = differenceInDays(fechaLimite, hoy);

  // Si ya venció
  if (isAfter(hoy, fechaLimite)) {
    return {
      disponible: false,
      fechaLimite,
      porcentaje: Number(factura.proveedor.prontoPagoPorcentaje),
      montoDescuento: 0,
      montoAPagar: Number(factura.total),
      montoOriginal: Number(factura.total),
      diasRestantes,
      estado: 'VENCIDO',
      mensaje: `El período de pronto pago venció el ${fechaLimite.toLocaleDateString('es-AR')}`
    };
  }

  // Calcular monto del descuento
  const porcentaje = Number(factura.proveedor.prontoPagoPorcentaje);
  let montoBase: number;

  switch (factura.proveedor.prontoPagoAplicaSobre || 'NETO') {
    case 'TOTAL':
      montoBase = Number(factura.total);
      break;
    case 'NETO_SIN_IVA':
      montoBase = Number(factura.neto);
      break;
    case 'NETO':
    default:
      montoBase = Number(factura.neto);
      break;
  }

  const montoDescuento = Math.round((montoBase * porcentaje / 100) * 100) / 100;
  const montoAPagar = Number(factura.total) - montoDescuento;

  return {
    disponible: true,
    fechaLimite,
    porcentaje,
    montoDescuento,
    montoAPagar,
    montoOriginal: Number(factura.total),
    diasRestantes,
    estado: 'DISPONIBLE',
    mensaje: `Descuento ${porcentaje}% disponible hasta ${fechaLimite.toLocaleDateString('es-AR')} (${diasRestantes} días restantes)`
  };
}

/**
 * Aplica el pronto pago a una factura al momento del pago
 */
export async function aplicarProntoPago(
  facturaId: number,
  companyId: number,
  userId: number
): Promise<{
  success: boolean;
  montoDescuento: number;
  montoFinal: number;
  mensaje: string;
}> {
  const calculo = await calcularProntoPago(facturaId, companyId);

  if (!calculo.disponible) {
    return {
      success: false,
      montoDescuento: 0,
      montoFinal: calculo.montoOriginal,
      mensaje: calculo.mensaje
    };
  }

  // Actualizar factura con pronto pago aplicado
  await prisma.purchaseReceipt.update({
    where: { id: facturaId },
    data: {
      prontoPagoAplicado: true,
      prontoPagoAplicadoAt: new Date(),
      prontoPagoMonto: calculo.montoDescuento,
      prontoPagoPorcentaje: calculo.porcentaje
    }
  });

  // Registrar en auditoría
  await prisma.purchaseAuditLog.create({
    data: {
      entidad: 'purchase_receipt',
      entidadId: facturaId,
      accion: 'APLICAR_PRONTO_PAGO',
      datosNuevos: {
        porcentaje: calculo.porcentaje,
        montoDescuento: calculo.montoDescuento,
        montoOriginal: calculo.montoOriginal,
        montoFinal: calculo.montoAPagar
      },
      companyId,
      userId
    }
  });

  return {
    success: true,
    montoDescuento: calculo.montoDescuento,
    montoFinal: calculo.montoAPagar,
    mensaje: `Pronto pago aplicado: ${calculo.porcentaje}% de descuento ($${calculo.montoDescuento.toFixed(2)})`
  };
}

/**
 * Actualiza los campos de pronto pago de una factura al cargarla
 * (llamar desde el POST de comprobantes)
 */
export async function inicializarProntoPago(
  facturaId: number,
  proveedorId: number,
  fechaEmision: Date,
  neto: number,
  total: number
): Promise<{
  prontoPagoDisponible: boolean;
  prontoPagoFechaLimite: Date | null;
  prontoPagoPorcentaje: number | null;
  prontoPagoMonto: number | null;
}> {
  // Obtener condiciones del proveedor
  const proveedor = await prisma.suppliers.findUnique({
    where: { id: proveedorId },
    select: {
      prontoPagoDias: true,
      prontoPagoPorcentaje: true,
      prontoPagoAplicaSobre: true
    }
  });

  if (!proveedor?.prontoPagoDias || !proveedor?.prontoPagoPorcentaje) {
    return {
      prontoPagoDisponible: false,
      prontoPagoFechaLimite: null,
      prontoPagoPorcentaje: null,
      prontoPagoMonto: null
    };
  }

  const fechaLimite = addDays(fechaEmision, proveedor.prontoPagoDias);
  const porcentaje = Number(proveedor.prontoPagoPorcentaje);

  let montoBase: number;
  switch (proveedor.prontoPagoAplicaSobre || 'NETO') {
    case 'TOTAL':
      montoBase = total;
      break;
    case 'NETO_SIN_IVA':
    case 'NETO':
    default:
      montoBase = neto;
      break;
  }

  const montoDescuento = Math.round((montoBase * porcentaje / 100) * 100) / 100;

  return {
    prontoPagoDisponible: true,
    prontoPagoFechaLimite: fechaLimite,
    prontoPagoPorcentaje: porcentaje,
    prontoPagoMonto: montoDescuento
  };
}

/**
 * Obtiene las facturas con pronto pago disponible o por vencer
 */
export async function obtenerFacturasConProntoPago(
  companyId: number,
  options?: {
    diasRestantes?: number; // Filtrar por días restantes (ej: 3 = vence en 3 días)
    soloDisponibles?: boolean;
    page?: number;
    limit?: number;
  }
): Promise<{
  data: any[];
  total: number;
  disponibleHoy: number;
  venceEn3Dias: number;
  venceEn7Dias: number;
  vencidas: number;
}> {
  const { diasRestantes, soloDisponibles = true, page = 1, limit = 20 } = options || {};

  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);

  const en3Dias = addDays(hoy, 3);
  const en7Dias = addDays(hoy, 7);

  const baseWhere: any = {
    companyId,
    prontoPagoDisponible: true,
    prontoPagoAplicado: false,
    estado: { notIn: ['ANULADA', 'PAGADA'] }
  };

  // Construir where según opciones
  let where: any = { ...baseWhere };
  if (soloDisponibles) {
    where.prontoPagoFechaLimite = { gte: hoy };
  }
  if (diasRestantes !== undefined) {
    const fechaLimite = addDays(hoy, diasRestantes);
    where.prontoPagoFechaLimite = {
      gte: hoy,
      lte: fechaLimite
    };
  }

  const [data, total, disponibleHoy, venceEn3Dias, venceEn7Dias, vencidas] = await Promise.all([
    prisma.purchaseReceipt.findMany({
      where,
      include: {
        proveedor: { select: { id: true, name: true } }
      },
      orderBy: { prontoPagoFechaLimite: 'asc' },
      skip: (page - 1) * limit,
      take: limit
    }),
    prisma.purchaseReceipt.count({ where }),
    // Disponible hoy (fecha límite >= hoy)
    prisma.purchaseReceipt.count({
      where: {
        ...baseWhere,
        prontoPagoFechaLimite: { gte: hoy }
      }
    }),
    // Vence en 3 días
    prisma.purchaseReceipt.count({
      where: {
        ...baseWhere,
        prontoPagoFechaLimite: {
          gte: hoy,
          lte: en3Dias
        }
      }
    }),
    // Vence en 7 días
    prisma.purchaseReceipt.count({
      where: {
        ...baseWhere,
        prontoPagoFechaLimite: {
          gte: hoy,
          lte: en7Dias
        }
      }
    }),
    // Vencidas (no aplicadas)
    prisma.purchaseReceipt.count({
      where: {
        ...baseWhere,
        prontoPagoFechaLimite: { lt: hoy }
      }
    })
  ]);

  // Agregar cálculo de días restantes a cada factura
  const dataConDias = data.map(factura => ({
    ...factura,
    diasRestantes: factura.prontoPagoFechaLimite
      ? differenceInDays(factura.prontoPagoFechaLimite, hoy)
      : 0
  }));

  return {
    data: dataConDias,
    total,
    disponibleHoy,
    venceEn3Dias,
    venceEn7Dias,
    vencidas
  };
}
