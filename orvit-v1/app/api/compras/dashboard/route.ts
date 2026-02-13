import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';
import { prisma } from '@/lib/prisma';
import { JWT_SECRET } from '@/lib/auth';
import { getViewMode } from '@/lib/view-mode/get-mode';
import { ViewMode } from '@/lib/view-mode/types';
import { applyViewMode } from '@/lib/view-mode/prisma-helper';

export const dynamic = 'force-dynamic';

const JWT_SECRET_KEY = new TextEncoder().encode(JWT_SECRET);

// Cache para dashboard (1 minuto TTL)
const dashboardCache = new Map<string, { data: any; timestamp: number }>();
const DASHBOARD_CACHE_TTL = 60 * 1000;

async function getUserFromToken() {
  try {
    const token = cookies().get('token')?.value;
    if (!token) return null;

    const { payload } = await jwtVerify(token, JWT_SECRET_KEY);

    const user = await prisma.user.findUnique({
      where: { id: payload.userId as number },
      select: {
        id: true,
        role: true,
        companies: {
          select: {
            companyId: true,
            role: {
              select: { name: true }
            }
          },
          take: 1
        }
      }
    });

    return user;
  } catch (error) {
    return null;
  }
}

function isAdminUser(roleName: string | undefined): boolean {
  if (!roleName) return false;
  const normalized = roleName.trim().toUpperCase();
  // Incluir todos los roles que deberían ver el dashboard completo
  const adminRoles = [
    'SUPERADMIN',
    'ADMIN',
    'ADMIN_ENTERPRISE',
    'ADMINISTRADOR',
    'GERENCIA',
    'GERENTE',
    'OWNER',
    'COMPRAS',
    'JEFE_COMPRAS',
    'JEFE DE COMPRAS',
    'ENCARGADO',
    'USER' // Incluir USER para que todos los usuarios autenticados vean el dashboard completo
  ];
  return adminRoles.includes(normalized);
}

interface DashboardStats {
  basico: {
    ordenesPendientes: number;
    proveedoresActivos: number;
    stockBajo: number;
    solicitudesPendientes: number;
  };
  admin: {
    comprasMes: number;
    comprasMesAnterior: number;
    variacionMensual: number; // Porcentaje
    deudaTotal: number;
    facturasVencidas: number;
    aprobacionesPendientes: number;
    comprasPorMes: Array<{ mes: string; total: number }>;
    topProveedores: Array<{ id: number; nombre: string; total: number }>;
    // Nuevos campos
    ordenesPorEstado: Array<{ estado: string; cantidad: number }>;
    recepcionesMes: { cantidad: number; total: number };
    comprasPorCategoria: Array<{ categoria: string; total: number }>;
    ordenesProximasVencer: Array<{ id: number; numero: string; proveedor: string; fechaRequerida: string; diasRestantes: number }>;
    topProductos: Array<{ id: number; nombre: string; cantidad: number; total: number }>;
    flujoPagos: { proximos7: number; proximos15: number; proximos30: number };
    // Extra stats
    promedioMensual: number;
    totalAnual: number;
    devolucionesPendientes: number;
    // ======= NUEVAS MÉTRICAS EJECUTIVAS =======
    ejecutivo: {
      // Salud financiera
      healthScore: number; // 0-100
      healthFactors: {
        pagosPuntuales: number; // % de pagos a tiempo
        deudaSaludable: number; // ratio deuda/compras
        stockOptimo: number; // % items con stock OK
        ordenesEficientes: number; // % OC completadas en tiempo
      };
      // Tendencias
      tendenciaMensual: 'up' | 'down' | 'stable';
      tendenciaAnual: 'up' | 'down' | 'stable';
      // Eficiencia operativa
      eficiencia: {
        tiempoPromedioCiclo: number; // días OC a recepción
        tasaCumplimiento: number; // % OC completadas
        tasaRechazo: number; // % OC rechazadas
        tasaDevolucion: number; // % recepciones con devolución
      };
      // YoY comparisons
      yoy: {
        comprasAnoAnterior: number;
        variacionAnual: number;
        mesAnteriorAnoAnterior: number;
        variacionMesYoY: number;
      };
      // Concentración proveedores
      concentracion: {
        top3Porcentaje: number;
        riesgoConcentracion: 'bajo' | 'medio' | 'alto';
        proveedoresActivos30d: number;
      };
      // Alertas críticas
      alertasCriticas: Array<{
        tipo: 'vencimiento' | 'stock' | 'aprobacion' | 'deuda' | 'contrato';
        mensaje: string;
        prioridad: 'alta' | 'media' | 'baja';
        cantidad?: number;
        monto?: number;
      }>;
    };
    // Categorías y servicios
    categorias: {
      total: number;
      conGasto: number;
      sinGasto: number;
      topCategoria: { nombre: string; total: number } | null;
    };
    servicios: {
      contratosActivos: number;
      gastoMensualEstimado: number;
      proximosVencimientos: number;
      contratosCriticos: number;
    };
  } | null;
  timestamp: string;
}

// Helper: Obtener compras por mes (últimos N meses)
async function getComprasPorMes(companyId: number, meses: number, viewMode: ViewMode): Promise<Array<{ mes: string; total: number }>> {
  const result: Array<{ mes: string; total: number }> = [];
  const now = new Date();

  for (let i = meses - 1; i >= 0; i--) {
    const targetDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const startOfMonth = new Date(targetDate.getFullYear(), targetDate.getMonth(), 1);
    const endOfMonth = new Date(targetDate.getFullYear(), targetDate.getMonth() + 1, 0, 23, 59, 59);

    const compras = await prisma.purchaseReceipt.aggregate({
      where: applyViewMode({
        companyId,
        fechaEmision: {
          gte: startOfMonth,
          lte: endOfMonth
        }
      }, viewMode),
      _sum: { total: true }
    });

    const mesNombre = targetDate.toLocaleDateString('es-AR', { month: 'short' });
    result.push({
      mes: mesNombre.charAt(0).toUpperCase() + mesNombre.slice(1),
      total: Number(compras._sum.total || 0)
    });
  }

  return result;
}

// Helper: Obtener top proveedores por monto
async function getTopProveedores(companyId: number, limit: number, viewMode: ViewMode): Promise<Array<{ id: number; nombre: string; total: number }>> {
  // Agrupar comprobantes por proveedor y sumar totales
  // Note: groupBy doesn't support complex AND/OR, so we use raw query or filter manually
  // For now, we'll filter using a simple approach since ViewMode adds AND clause
  const comprasAgrupadas = await prisma.purchaseReceipt.groupBy({
    by: ['proveedorId'],
    where: applyViewMode({
      companyId,
      // Últimos 6 meses
      fechaEmision: {
        gte: new Date(new Date().setMonth(new Date().getMonth() - 6))
      }
    }, viewMode),
    _sum: { total: true },
    orderBy: {
      _sum: { total: 'desc' }
    },
    take: limit
  });

  // Obtener nombres de proveedores
  const proveedorIds = comprasAgrupadas.map(c => c.proveedorId);
  const proveedores = await prisma.suppliers.findMany({
    where: { id: { in: proveedorIds } },
    select: { id: true, name: true }
  });

  const proveedoresMap = new Map(proveedores.map(p => [p.id, p.name]));

  return comprasAgrupadas.map(c => ({
    id: c.proveedorId,
    nombre: proveedoresMap.get(c.proveedorId) || 'Proveedor desconocido',
    total: Number(c._sum.total || 0)
  }));
}

// Helper: Obtener ordenes por estado
async function getOrdenesPorEstado(companyId: number, viewMode: ViewMode): Promise<Array<{ estado: string; cantidad: number }>> {
  try {
    const ordenes = await prisma.purchaseOrder.groupBy({
      by: ['estado'],
      where: applyViewMode({ companyId }, viewMode),
      _count: { id: true }
    });

    const estadoLabels: Record<string, string> = {
      'BORRADOR': 'Borrador',
      'PENDIENTE_APROBACION': 'Pend. Aprob.',
      'APROBADA': 'Aprobada',
      'RECHAZADA': 'Rechazada',
      'ENVIADA_PROVEEDOR': 'Enviada',
      'CONFIRMADA': 'Confirmada',
      'RECIBIDA_PARCIAL': 'Parcial',
      'COMPLETADA': 'Completada',
      'CANCELADA': 'Cancelada'
    };

    return ordenes.map(o => ({
      estado: estadoLabels[o.estado] || o.estado,
      cantidad: o._count.id
    }));
  } catch (e) {
    console.error('[Dashboard] Error getOrdenesPorEstado:', e);
    return [];
  }
}

// Helper: Obtener recepciones del mes
async function getRecepcionesMes(companyId: number, startOfMonth: Date, endOfMonth: Date, viewMode: ViewMode): Promise<{ cantidad: number; total: number }> {
  try {
    const whereClause = applyViewMode({
      companyId,
      fechaEmision: { gte: startOfMonth, lte: endOfMonth }
    }, viewMode);

    const [count, sum] = await Promise.all([
      prisma.purchaseReceipt.count({ where: whereClause }),
      prisma.purchaseReceipt.aggregate({
        where: whereClause,
        _sum: { total: true }
      })
    ]);

    return {
      cantidad: count,
      total: Number(sum._sum.total || 0)
    };
  } catch (e) {
    console.error('[Dashboard] Error getRecepcionesMes:', e);
    return { cantidad: 0, total: 0 };
  }
}

// Helper: Obtener compras por categoria (agrupando por proveedor como proxy de categoria)
async function getComprasPorCategoria(companyId: number, viewMode: ViewMode): Promise<Array<{ categoria: string; total: number }>> {
  try {
    // Agrupar recepciones por proveedor como proxy de categoria
    const compras = await prisma.purchaseReceipt.groupBy({
      by: ['proveedorId'],
      where: applyViewMode({
        companyId,
        fechaEmision: { gte: new Date(new Date().setMonth(new Date().getMonth() - 6)) }
      }, viewMode),
      _sum: { total: true },
      orderBy: { _sum: { total: 'desc' } },
      take: 6
    });

    // Obtener nombres de proveedores
    const proveedorIds = compras.map(c => c.proveedorId);
    const proveedores = await prisma.suppliers.findMany({
      where: { id: { in: proveedorIds } },
      select: { id: true, name: true }
    });
    const provMap = new Map(proveedores.map(p => [p.id, p.name]));

    return compras.map(c => ({
      categoria: provMap.get(c.proveedorId) || 'Sin proveedor',
      total: Number(c._sum.total || 0)
    }));
  } catch (e) {
    console.error('[Dashboard] Error getComprasPorCategoria:', e);
    return [];
  }
}

// Helper: Obtener ordenes proximas a vencer
async function getOrdenesProximasVencer(companyId: number, viewMode: ViewMode): Promise<Array<{ id: number; numero: string; proveedor: string; fechaRequerida: string; diasRestantes: number }>> {
  try {
    const now = new Date();
    const in15Days = new Date();
    in15Days.setDate(in15Days.getDate() + 15);

    const ordenes = await prisma.purchaseOrder.findMany({
      where: applyViewMode({
        companyId,
        estado: { in: ['PENDIENTE_APROBACION', 'APROBADA', 'ENVIADA_PROVEEDOR', 'CONFIRMADA'] },
        fechaEntregaEsperada: { gte: now, lte: in15Days }
      }, viewMode),
      include: {
        proveedor: { select: { name: true } }
      },
      orderBy: { fechaEntregaEsperada: 'asc' },
      take: 5
    });

    return ordenes.map(o => {
      const fechaReq = o.fechaEntregaEsperada ? new Date(o.fechaEntregaEsperada) : now;
      const diasRestantes = Math.ceil((fechaReq.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      return {
        id: o.id,
        numero: o.numero,
        proveedor: o.proveedor?.name || 'Sin proveedor',
        fechaRequerida: fechaReq.toISOString(),
        diasRestantes: Math.max(0, diasRestantes)
      };
    });
  } catch (e) {
    console.error('[Dashboard] Error getOrdenesProximasVencer:', e);
    return [];
  }
}

// Helper: Obtener top productos comprados (agrupados por descripcion)
async function getTopProductos(companyId: number, viewMode: ViewMode): Promise<Array<{ id: number; nombre: string; cantidad: number; total: number }>> {
  try {
    // Agrupar items por descripcion ya que no hay relacion directa a producto
    // Note: Items inherit ViewMode from their parent comprobante
    const items = await prisma.purchaseReceiptItem.groupBy({
      by: ['descripcion'],
      where: {
        companyId,
        comprobante: applyViewMode({
          fechaEmision: { gte: new Date(new Date().setMonth(new Date().getMonth() - 3)) }
        }, viewMode)
      },
      _sum: { cantidad: true, subtotal: true },
      orderBy: { _sum: { subtotal: 'desc' } },
      take: 5
    });

    return items.map((i, idx) => ({
      id: idx + 1,
      nombre: i.descripcion.substring(0, 40) + (i.descripcion.length > 40 ? '...' : ''),
      cantidad: Number(i._sum.cantidad || 0),
      total: Number(i._sum.subtotal || 0)
    }));
  } catch (e) {
    console.error('[Dashboard] Error getTopProductos:', e);
    return [];
  }
}

// Helper: Obtener flujo de pagos proyectado
async function getFlujoPagos(companyId: number, viewMode: ViewMode): Promise<{ proximos7: number; proximos15: number; proximos30: number }> {
  try {
    const now = new Date();
    const in7Days = new Date(); in7Days.setDate(in7Days.getDate() + 7);
    const in15Days = new Date(); in15Days.setDate(in15Days.getDate() + 15);
    const in30Days = new Date(); in30Days.setDate(in30Days.getDate() + 30);

    const [p7, p15, p30] = await Promise.all([
      prisma.purchaseReceipt.aggregate({
        where: applyViewMode({
          companyId,
          estado: { in: ['pendiente', 'parcial'] },
          fechaVencimiento: { gte: now, lte: in7Days }
        }, viewMode),
        _sum: { total: true }
      }),
      prisma.purchaseReceipt.aggregate({
        where: applyViewMode({
          companyId,
          estado: { in: ['pendiente', 'parcial'] },
          fechaVencimiento: { gte: now, lte: in15Days }
        }, viewMode),
        _sum: { total: true }
      }),
      prisma.purchaseReceipt.aggregate({
        where: applyViewMode({
          companyId,
          estado: { in: ['pendiente', 'parcial'] },
          fechaVencimiento: { gte: now, lte: in30Days }
        }, viewMode),
        _sum: { total: true }
      })
    ]);

    return {
      proximos7: Number(p7._sum.total || 0),
      proximos15: Number(p15._sum.total || 0),
      proximos30: Number(p30._sum.total || 0)
    };
  } catch (e) {
    console.error('[Dashboard] Error getFlujoPagos:', e);
    return { proximos7: 0, proximos15: 0, proximos30: 0 };
  }
}

// =============== NUEVOS HELPERS MÉTRICAS EJECUTIVAS ===============

// Helper: Calcular métricas de eficiencia
async function getEficienciaMetrics(companyId: number, viewMode: ViewMode): Promise<{
  tiempoPromedioCiclo: number;
  tasaCumplimiento: number;
  tasaRechazo: number;
  tasaDevolucion: number;
}> {
  try {
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    // Obtener OC completadas y sus tiempos
    const ordenesCompletadas = await prisma.purchaseOrder.findMany({
      where: applyViewMode({
        companyId,
        estado: 'COMPLETADA',
        fechaAprobacion: { gte: sixMonthsAgo }
      }, viewMode),
      select: {
        createdAt: true,
        fechaAprobacion: true,
        updatedAt: true
      }
    });

    // Tiempo promedio de ciclo (creación a completado)
    let tiempoTotal = 0;
    ordenesCompletadas.forEach(oc => {
      const inicio = new Date(oc.createdAt);
      const fin = new Date(oc.updatedAt);
      tiempoTotal += (fin.getTime() - inicio.getTime()) / (1000 * 60 * 60 * 24);
    });
    const tiempoPromedioCiclo = ordenesCompletadas.length > 0
      ? Math.round(tiempoTotal / ordenesCompletadas.length)
      : 0;

    // Tasa de cumplimiento y rechazo
    const [totalOrdenes, completadas, rechazadas] = await Promise.all([
      prisma.purchaseOrder.count({
        where: applyViewMode({
          companyId,
          createdAt: { gte: sixMonthsAgo }
        }, viewMode)
      }),
      prisma.purchaseOrder.count({
        where: applyViewMode({
          companyId,
          estado: 'COMPLETADA',
          createdAt: { gte: sixMonthsAgo }
        }, viewMode)
      }),
      prisma.purchaseOrder.count({
        where: applyViewMode({
          companyId,
          estado: 'RECHAZADA',
          createdAt: { gte: sixMonthsAgo }
        }, viewMode)
      })
    ]);

    const tasaCumplimiento = totalOrdenes > 0 ? Math.round((completadas / totalOrdenes) * 100) : 0;
    const tasaRechazo = totalOrdenes > 0 ? Math.round((rechazadas / totalOrdenes) * 100) : 0;

    // Tasa de devolución
    const [totalRecepciones, recepcionesConDevolucion] = await Promise.all([
      prisma.purchaseReceipt.count({
        where: applyViewMode({
          companyId,
          createdAt: { gte: sixMonthsAgo }
        }, viewMode)
      }),
      prisma.purchaseReturn.count({
        where: {
          companyId,
          createdAt: { gte: sixMonthsAgo }
        }
      })
    ]);
    const tasaDevolucion = totalRecepciones > 0
      ? Math.round((recepcionesConDevolucion / totalRecepciones) * 100)
      : 0;

    return { tiempoPromedioCiclo, tasaCumplimiento, tasaRechazo, tasaDevolucion };
  } catch (e) {
    console.error('[Dashboard] Error getEficienciaMetrics:', e);
    return { tiempoPromedioCiclo: 0, tasaCumplimiento: 0, tasaRechazo: 0, tasaDevolucion: 0 };
  }
}

// Helper: Calcular YoY comparisons
async function getYoYMetrics(companyId: number, viewMode: ViewMode): Promise<{
  comprasAnoAnterior: number;
  variacionAnual: number;
  mesAnteriorAnoAnterior: number;
  variacionMesYoY: number;
}> {
  try {
    const now = new Date();
    const startOfYear = new Date(now.getFullYear(), 0, 1);
    const startOfLastYear = new Date(now.getFullYear() - 1, 0, 1);
    const endOfLastYear = new Date(now.getFullYear() - 1, 11, 31, 23, 59, 59);

    // Mismo período año anterior (hasta el día actual)
    const sameDayLastYear = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());

    // Mes actual año anterior
    const startOfMonthLastYear = new Date(now.getFullYear() - 1, now.getMonth(), 1);
    const endOfMonthLastYear = new Date(now.getFullYear() - 1, now.getMonth() + 1, 0, 23, 59, 59);

    const [ytdActual, ytdAnterior, mesActual, mesAnteriorYoY] = await Promise.all([
      prisma.purchaseReceipt.aggregate({
        where: applyViewMode({
          companyId,
          fechaEmision: { gte: startOfYear }
        }, viewMode),
        _sum: { total: true }
      }),
      prisma.purchaseReceipt.aggregate({
        where: applyViewMode({
          companyId,
          fechaEmision: { gte: startOfLastYear, lte: sameDayLastYear }
        }, viewMode),
        _sum: { total: true }
      }),
      prisma.purchaseReceipt.aggregate({
        where: applyViewMode({
          companyId,
          fechaEmision: {
            gte: new Date(now.getFullYear(), now.getMonth(), 1),
            lte: now
          }
        }, viewMode),
        _sum: { total: true }
      }),
      prisma.purchaseReceipt.aggregate({
        where: applyViewMode({
          companyId,
          fechaEmision: { gte: startOfMonthLastYear, lte: endOfMonthLastYear }
        }, viewMode),
        _sum: { total: true }
      })
    ]);

    const comprasAnoAnterior = Number(ytdAnterior._sum.total || 0);
    const comprasYTD = Number(ytdActual._sum.total || 0);
    const variacionAnual = comprasAnoAnterior > 0
      ? Math.round(((comprasYTD - comprasAnoAnterior) / comprasAnoAnterior) * 100)
      : 0;

    const mesAnteriorAnoAnterior = Number(mesAnteriorYoY._sum.total || 0);
    const mesActualVal = Number(mesActual._sum.total || 0);
    const variacionMesYoY = mesAnteriorAnoAnterior > 0
      ? Math.round(((mesActualVal - mesAnteriorAnoAnterior) / mesAnteriorAnoAnterior) * 100)
      : 0;

    return { comprasAnoAnterior, variacionAnual, mesAnteriorAnoAnterior, variacionMesYoY };
  } catch (e) {
    console.error('[Dashboard] Error getYoYMetrics:', e);
    return { comprasAnoAnterior: 0, variacionAnual: 0, mesAnteriorAnoAnterior: 0, variacionMesYoY: 0 };
  }
}

// Helper: Calcular concentración de proveedores
async function getConcentracionProveedores(companyId: number, viewMode: ViewMode): Promise<{
  top3Porcentaje: number;
  riesgoConcentracion: 'bajo' | 'medio' | 'alto';
  proveedoresActivos30d: number;
}> {
  try {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    // Total compras 6 meses
    const totalCompras = await prisma.purchaseReceipt.aggregate({
      where: applyViewMode({
        companyId,
        fechaEmision: { gte: sixMonthsAgo }
      }, viewMode),
      _sum: { total: true }
    });

    // Top 3 proveedores
    const topProveedores = await prisma.purchaseReceipt.groupBy({
      by: ['proveedorId'],
      where: applyViewMode({
        companyId,
        fechaEmision: { gte: sixMonthsAgo }
      }, viewMode),
      _sum: { total: true },
      orderBy: { _sum: { total: 'desc' } },
      take: 3
    });

    const totalGeneral = Number(totalCompras._sum.total || 0);
    const top3Total = topProveedores.reduce((sum, p) => sum + Number(p._sum.total || 0), 0);
    const top3Porcentaje = totalGeneral > 0 ? Math.round((top3Total / totalGeneral) * 100) : 0;

    // Riesgo de concentración
    let riesgoConcentracion: 'bajo' | 'medio' | 'alto' = 'bajo';
    if (top3Porcentaje >= 80) riesgoConcentracion = 'alto';
    else if (top3Porcentaje >= 60) riesgoConcentracion = 'medio';

    // Proveedores activos últimos 30 días
    const proveedoresActivos30d = await prisma.purchaseReceipt.findMany({
      where: applyViewMode({
        companyId,
        fechaEmision: { gte: thirtyDaysAgo }
      }, viewMode),
      select: { proveedorId: true },
      distinct: ['proveedorId']
    });

    return {
      top3Porcentaje,
      riesgoConcentracion,
      proveedoresActivos30d: proveedoresActivos30d.length
    };
  } catch (e) {
    console.error('[Dashboard] Error getConcentracionProveedores:', e);
    return { top3Porcentaje: 0, riesgoConcentracion: 'bajo', proveedoresActivos30d: 0 };
  }
}

// Helper: Generar alertas críticas
async function getAlertasCriticas(companyId: number, viewMode: ViewMode): Promise<Array<{
  tipo: 'vencimiento' | 'stock' | 'aprobacion' | 'deuda' | 'contrato';
  mensaje: string;
  prioridad: 'alta' | 'media' | 'baja';
  cantidad?: number;
  monto?: number;
}>> {
  const alertas: Array<{
    tipo: 'vencimiento' | 'stock' | 'aprobacion' | 'deuda' | 'contrato';
    mensaje: string;
    prioridad: 'alta' | 'media' | 'baja';
    cantidad?: number;
    monto?: number;
  }> = [];

  try {
    const now = new Date();
    const in7Days = new Date();
    in7Days.setDate(in7Days.getDate() + 7);

    // Facturas vencidas
    const facturasVencidas = await prisma.purchaseReceipt.aggregate({
      where: applyViewMode({
        companyId,
        estado: { in: ['pendiente', 'parcial'] },
        fechaVencimiento: { lt: now }
      }, viewMode),
      _count: true,
      _sum: { total: true }
    });
    if (facturasVencidas._count > 0) {
      alertas.push({
        tipo: 'vencimiento',
        mensaje: `${facturasVencidas._count} facturas vencidas`,
        prioridad: 'alta',
        cantidad: facturasVencidas._count,
        monto: Number(facturasVencidas._sum.total || 0)
      });
    }

    // Facturas por vencer en 7 días
    const facturasPorVencer = await prisma.purchaseReceipt.aggregate({
      where: applyViewMode({
        companyId,
        estado: { in: ['pendiente', 'parcial'] },
        fechaVencimiento: { gte: now, lte: in7Days }
      }, viewMode),
      _count: true,
      _sum: { total: true }
    });
    if (facturasPorVencer._count > 0) {
      alertas.push({
        tipo: 'vencimiento',
        mensaje: `${facturasPorVencer._count} facturas vencen en 7 días`,
        prioridad: 'media',
        cantidad: facturasPorVencer._count,
        monto: Number(facturasPorVencer._sum.total || 0)
      });
    }

    // OC pendientes de aprobación > 3 días
    const threeDaysAgo = new Date();
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
    const ocPendientesAntiguas = await prisma.purchaseOrder.count({
      where: applyViewMode({
        companyId,
        estado: 'PENDIENTE_APROBACION',
        createdAt: { lt: threeDaysAgo }
      }, viewMode)
    });
    if (ocPendientesAntiguas > 0) {
      alertas.push({
        tipo: 'aprobacion',
        mensaje: `${ocPendientesAntiguas} OC esperando aprobación > 3 días`,
        prioridad: 'alta',
        cantidad: ocPendientesAntiguas
      });
    }

    // Stock crítico
    const stockCritico = await prisma.stockLocation.count({
      where: {
        companyId,
        cantidad: { lte: 0 }
      }
    });
    if (stockCritico > 0) {
      alertas.push({
        tipo: 'stock',
        mensaje: `${stockCritico} items sin stock`,
        prioridad: 'alta',
        cantidad: stockCritico
      });
    }

    // Contratos por vencer en 30 días
    const in30Days = new Date();
    in30Days.setDate(in30Days.getDate() + 30);
    const contratosPorVencer = await prisma.serviceContract.count({
      where: {
        companyId,
        estado: 'ACTIVO',
        fechaFin: { gte: now, lte: in30Days }
      }
    }).catch(() => 0);
    if (contratosPorVencer > 0) {
      alertas.push({
        tipo: 'contrato',
        mensaje: `${contratosPorVencer} contratos vencen en 30 días`,
        prioridad: 'media',
        cantidad: contratosPorVencer
      });
    }

    return alertas.sort((a, b) => {
      const prioridadOrder = { alta: 0, media: 1, baja: 2 };
      return prioridadOrder[a.prioridad] - prioridadOrder[b.prioridad];
    });
  } catch (e) {
    console.error('[Dashboard] Error getAlertasCriticas:', e);
    return alertas;
  }
}

// Helper: Calcular Health Score
function calculateHealthScore(factors: {
  pagosPuntuales: number;
  deudaSaludable: number;
  stockOptimo: number;
  ordenesEficientes: number;
}): number {
  // Weighted average
  const weights = {
    pagosPuntuales: 0.3,
    deudaSaludable: 0.25,
    stockOptimo: 0.2,
    ordenesEficientes: 0.25
  };

  return Math.round(
    factors.pagosPuntuales * weights.pagosPuntuales +
    factors.deudaSaludable * weights.deudaSaludable +
    factors.stockOptimo * weights.stockOptimo +
    factors.ordenesEficientes * weights.ordenesEficientes
  );
}

// Helper: Calcular health factors
async function getHealthFactors(companyId: number, viewMode: ViewMode, totalAnual: number, deudaTotal: number): Promise<{
  pagosPuntuales: number;
  deudaSaludable: number;
  stockOptimo: number;
  ordenesEficientes: number;
}> {
  try {
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    // Pagos puntuales (% facturas pagadas antes de vencimiento)
    const [facturasTotal, facturasPagadasATiempo] = await Promise.all([
      prisma.purchaseReceipt.count({
        where: applyViewMode({
          companyId,
          estado: 'pagado',
          fechaEmision: { gte: sixMonthsAgo }
        }, viewMode)
      }),
      prisma.purchaseReceipt.count({
        where: applyViewMode({
          companyId,
          estado: 'pagado',
          fechaEmision: { gte: sixMonthsAgo },
          fechaPago: { lte: prisma.purchaseReceipt.fields.fechaVencimiento }
        }, viewMode)
      }).catch(() => 0)
    ]);
    const pagosPuntuales = facturasTotal > 0 ? Math.round((facturasPagadasATiempo / facturasTotal) * 100) : 100;

    // Deuda saludable (ratio deuda/compras mensual promedio)
    // Si deuda < 2x promedio mensual = 100, si > 4x = 0
    const promedioMensual = totalAnual / 12;
    const ratioDeuda = promedioMensual > 0 ? deudaTotal / promedioMensual : 0;
    let deudaSaludable = 100;
    if (ratioDeuda > 4) deudaSaludable = 0;
    else if (ratioDeuda > 2) deudaSaludable = Math.round(100 - ((ratioDeuda - 2) * 50));

    // Stock óptimo
    const [stockTotal, stockBajo] = await Promise.all([
      prisma.stockLocation.count({ where: { companyId } }),
      prisma.stockLocation.count({ where: { companyId, cantidad: { lte: 0 } } })
    ]);
    const stockOptimo = stockTotal > 0 ? Math.round(((stockTotal - stockBajo) / stockTotal) * 100) : 100;

    // Ordenes eficientes (% completadas del total cerradas)
    const [ordenesCerradas, ordenesCompletadas] = await Promise.all([
      prisma.purchaseOrder.count({
        where: applyViewMode({
          companyId,
          estado: { in: ['COMPLETADA', 'CANCELADA', 'RECHAZADA'] },
          createdAt: { gte: sixMonthsAgo }
        }, viewMode)
      }),
      prisma.purchaseOrder.count({
        where: applyViewMode({
          companyId,
          estado: 'COMPLETADA',
          createdAt: { gte: sixMonthsAgo }
        }, viewMode)
      })
    ]);
    const ordenesEficientes = ordenesCerradas > 0 ? Math.round((ordenesCompletadas / ordenesCerradas) * 100) : 100;

    return { pagosPuntuales, deudaSaludable, stockOptimo, ordenesEficientes };
  } catch (e) {
    console.error('[Dashboard] Error getHealthFactors:', e);
    return { pagosPuntuales: 100, deudaSaludable: 100, stockOptimo: 100, ordenesEficientes: 100 };
  }
}

// Helper: Obtener métricas de categorías
async function getCategoriasMetrics(companyId: number): Promise<{
  total: number;
  conGasto: number;
  sinGasto: number;
  topCategoria: { nombre: string; total: number } | null;
}> {
  try {
    const categorias = await prisma.supplyCategory.findMany({
      where: { companyId },
      include: {
        supplies: {
          include: {
            receiptItems: {
              select: { subtotal: true }
            }
          }
        }
      }
    });

    let conGasto = 0;
    let topCategoria: { nombre: string; total: number } | null = null;

    categorias.forEach(cat => {
      const total = cat.supplies.reduce((sum, s) => {
        return sum + s.receiptItems.reduce((ssum, ri) => ssum + Number(ri.subtotal || 0), 0);
      }, 0);
      if (total > 0) {
        conGasto++;
        if (!topCategoria || total > topCategoria.total) {
          topCategoria = { nombre: cat.name, total };
        }
      }
    });

    return {
      total: categorias.length,
      conGasto,
      sinGasto: categorias.length - conGasto,
      topCategoria
    };
  } catch (e) {
    console.error('[Dashboard] Error getCategoriasMetrics:', e);
    return { total: 0, conGasto: 0, sinGasto: 0, topCategoria: null };
  }
}

// Helper: Obtener métricas de servicios
async function getServiciosMetrics(companyId: number): Promise<{
  contratosActivos: number;
  gastoMensualEstimado: number;
  proximosVencimientos: number;
  contratosCriticos: number;
}> {
  try {
    const now = new Date();
    const in30Days = new Date();
    in30Days.setDate(in30Days.getDate() + 30);

    const contratos = await prisma.serviceContract.findMany({
      where: { companyId, estado: 'ACTIVO' }
    });

    let gastoMensualEstimado = 0;
    contratos.forEach(c => {
      const monto = Number(c.montoPeriodo || c.montoTotal || 0);
      switch (c.frecuenciaPago) {
        case 'MENSUAL': gastoMensualEstimado += monto; break;
        case 'BIMESTRAL': gastoMensualEstimado += monto / 2; break;
        case 'TRIMESTRAL': gastoMensualEstimado += monto / 3; break;
        case 'SEMESTRAL': gastoMensualEstimado += monto / 6; break;
        case 'ANUAL': gastoMensualEstimado += monto / 12; break;
      }
    });

    const proximosVencimientos = contratos.filter(c =>
      c.fechaFin && new Date(c.fechaFin) >= now && new Date(c.fechaFin) <= in30Days
    ).length;

    // Contratos críticos: vencidos o sin pago registrado
    const contratosCriticos = await prisma.serviceContract.count({
      where: {
        companyId,
        OR: [
          { estado: 'VENCIDO' },
          { fechaFin: { lt: now }, estado: 'ACTIVO' }
        ]
      }
    }).catch(() => 0);

    return {
      contratosActivos: contratos.length,
      gastoMensualEstimado: Math.round(gastoMensualEstimado),
      proximosVencimientos,
      contratosCriticos
    };
  } catch (e) {
    console.error('[Dashboard] Error getServiciosMetrics:', e);
    return { contratosActivos: 0, gastoMensualEstimado: 0, proximosVencimientos: 0, contratosCriticos: 0 };
  }
}

// GET /api/compras/dashboard
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

    // Fix: user.role is an enum string, not an object
    const roleName = user.companies?.[0]?.role?.name || String(user.role || '');
    const isAdmin = isAdminUser(roleName);

    // Get mode from middleware header
    const viewMode = getViewMode(request);

    const { searchParams } = new URL(request.url);
    const forceRefresh = searchParams.get('_refresh') === 'true';

    // Check cache - include viewMode in key
    const cacheKey = `dashboard-${companyId}-${isAdmin}-${viewMode}`;
    if (!forceRefresh) {
      const cached = dashboardCache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < DASHBOARD_CACHE_TTL) {
        return NextResponse.json(cached.data, {
          headers: { 'X-Cache': 'HIT' }
        });
      }
    }

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

    // Estadísticas básicas (todos los usuarios) - con manejo de errores individual
    let ordenesPendientes = 0;
    let proveedoresActivos = 0;
    let stockBajoData = 0;
    let solicitudesPendientes = 0;

    try {
      ordenesPendientes = await prisma.purchaseOrder.count({
        where: applyViewMode({
          companyId,
          estado: { in: ['PENDIENTE_APROBACION', 'ENVIADA_PROVEEDOR', 'CONFIRMADA'] }
        }, viewMode)
      });
    } catch (e) {
      console.error('[Dashboard] Error ordenesPendientes:', e);
    }

    try {
      proveedoresActivos = await prisma.suppliers.count({
        where: { company_id: companyId }
      });
    } catch (e) {
      console.error('[Dashboard] Error proveedoresActivos:', e);
    }

    try {
      // Items con stock bajo - simplificado (solo sin stock)
      stockBajoData = await prisma.stockLocation.count({
        where: {
          companyId,
          cantidad: { lte: 0 }
        }
      });
    } catch (e) {
      console.error('[Dashboard] Error stockBajoData:', e);
    }

    try {
      solicitudesPendientes = await prisma.paymentRequest.count({
        where: {
          companyId,
          estado: { in: ['SOLICITADA', 'EN_REVISION'] }
        }
      });
    } catch (e) {
      console.error('[Dashboard] Error solicitudesPendientes:', e);
    }

    // Datos básicos
    const basico = {
      ordenesPendientes,
      proveedoresActivos,
      stockBajo: stockBajoData,
      solicitudesPendientes
    };

    // Estadísticas admin
    let admin = null;
    if (isAdmin) {
      try {
        // Calcular mes anterior
        const startOfPrevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const endOfPrevMonth = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
        const startOfYear = new Date(now.getFullYear(), 0, 1);

        const [
          comprasMesData,
          comprasMesAnteriorData,
          totalAnualData,
          deudaTotalData,
          facturasVencidasCount,
          aprobacionesPendientesCount,
          comprasPorMes,
          topProveedores,
          // Nuevos datos
          ordenesPorEstado,
          recepcionesMes,
          comprasPorCategoria,
          ordenesProximasVencer,
          topProductos,
          flujoPagos,
          devolucionesPendientesCount
        ] = await Promise.all([
          // Total compras del mes
          prisma.purchaseReceipt.aggregate({
            where: applyViewMode({
              companyId,
              fechaEmision: { gte: startOfMonth, lte: endOfMonth }
            }, viewMode),
            _sum: { total: true }
          }),
          // Total compras mes anterior
          prisma.purchaseReceipt.aggregate({
            where: applyViewMode({
              companyId,
              fechaEmision: { gte: startOfPrevMonth, lte: endOfPrevMonth }
            }, viewMode),
            _sum: { total: true }
          }),
          // Total anual
          prisma.purchaseReceipt.aggregate({
            where: applyViewMode({
              companyId,
              fechaEmision: { gte: startOfYear }
            }, viewMode),
            _sum: { total: true }
          }),
          // Deuda total a proveedores (facturas pendientes) - usar total ya que saldo no existe
          prisma.purchaseReceipt.aggregate({
            where: applyViewMode({
              companyId,
              estado: { in: ['pendiente', 'parcial'] }
            }, viewMode),
            _sum: { total: true }
          }),
          // Facturas vencidas
          prisma.purchaseReceipt.count({
            where: applyViewMode({
              companyId,
              estado: { in: ['pendiente', 'parcial'] },
              fechaVencimiento: { lt: now }
            }, viewMode)
          }),
          // Aprobaciones pendientes (OC + Solicitudes)
          Promise.all([
            prisma.purchaseOrder.count({
              where: applyViewMode({ companyId, estado: 'PENDIENTE_APROBACION' }, viewMode)
            }),
            prisma.paymentRequest.count({
              where: { companyId, estado: { in: ['SOLICITADA', 'EN_REVISION'] } }
            }).catch(() => 0)
          ]).then(([oc, sr]) => oc + sr),
          // Gráfico: Compras últimos 6 meses
          getComprasPorMes(companyId, 6, viewMode).catch(() => []),
          // Top 5 proveedores
          getTopProveedores(companyId, 5, viewMode).catch(() => []),
          // Nuevos datos
          getOrdenesPorEstado(companyId, viewMode),
          getRecepcionesMes(companyId, startOfMonth, endOfMonth, viewMode),
          getComprasPorCategoria(companyId, viewMode),
          getOrdenesProximasVencer(companyId, viewMode),
          getTopProductos(companyId, viewMode),
          getFlujoPagos(companyId, viewMode),
          // Devoluciones pendientes
          prisma.purchaseReturn.count({
            where: {
              companyId,
              estado: { in: ['BORRADOR', 'SOLICITADA', 'APROBADA_PROVEEDOR', 'ENVIADA', 'EN_EVALUACION'] }
            }
          }).catch(() => 0)
        ]);

        const comprasMes = Number(comprasMesData._sum.total || 0);
        const comprasMesAnterior = Number(comprasMesAnteriorData._sum.total || 0);
        const totalAnual = Number(totalAnualData._sum.total || 0);

        // Calcular variacion mensual
        const variacionMensual = comprasMesAnterior > 0
          ? ((comprasMes - comprasMesAnterior) / comprasMesAnterior) * 100
          : 0;

        // Calcular promedio mensual (del año)
        const mesActual = now.getMonth() + 1;
        const promedioMensual = totalAnual / mesActual;

        const deudaTotal = Number(deudaTotalData._sum.total || 0);

        // ========= NUEVAS MÉTRICAS EJECUTIVAS =========
        const [
          eficiencia,
          yoy,
          concentracion,
          alertasCriticas,
          healthFactors,
          categoriasMetrics,
          serviciosMetrics
        ] = await Promise.all([
          getEficienciaMetrics(companyId, viewMode),
          getYoYMetrics(companyId, viewMode),
          getConcentracionProveedores(companyId, viewMode),
          getAlertasCriticas(companyId, viewMode),
          getHealthFactors(companyId, viewMode, totalAnual, deudaTotal),
          getCategoriasMetrics(companyId),
          getServiciosMetrics(companyId)
        ]);

        const healthScore = calculateHealthScore(healthFactors);

        // Determinar tendencias
        const tendenciaMensual: 'up' | 'down' | 'stable' =
          variacionMensual > 5 ? 'up' : variacionMensual < -5 ? 'down' : 'stable';
        const tendenciaAnual: 'up' | 'down' | 'stable' =
          yoy.variacionAnual > 5 ? 'up' : yoy.variacionAnual < -5 ? 'down' : 'stable';

        admin = {
          comprasMes,
          comprasMesAnterior,
          variacionMensual: Math.round(variacionMensual * 10) / 10, // 1 decimal
          deudaTotal,
          facturasVencidas: facturasVencidasCount,
          aprobacionesPendientes: aprobacionesPendientesCount,
          comprasPorMes,
          topProveedores,
          // Nuevos datos
          ordenesPorEstado,
          recepcionesMes,
          comprasPorCategoria,
          ordenesProximasVencer,
          topProductos,
          flujoPagos,
          // Extra stats
          promedioMensual: Math.round(promedioMensual),
          totalAnual,
          devolucionesPendientes: devolucionesPendientesCount,
          // ======= NUEVAS MÉTRICAS EJECUTIVAS =======
          ejecutivo: {
            healthScore,
            healthFactors,
            tendenciaMensual,
            tendenciaAnual,
            eficiencia,
            yoy,
            concentracion,
            alertasCriticas
          },
          categorias: categoriasMetrics,
          servicios: serviciosMetrics
        };
      } catch (e) {
        console.error('[Dashboard] Error admin stats:', e);
        // Return null admin if there's an error
        admin = null;
      }
    }

    const response: DashboardStats = {
      basico,
      admin,
      timestamp: new Date().toISOString()
    };

    // Save to cache
    dashboardCache.set(cacheKey, { data: response, timestamp: Date.now() });

    // Clean old cache entries
    if (dashboardCache.size > 50) {
      const now = Date.now();
      for (const [key, value] of dashboardCache.entries()) {
        if (now - value.timestamp > DASHBOARD_CACHE_TTL * 5) {
          dashboardCache.delete(key);
        }
      }
    }

    return NextResponse.json(response, {
      headers: {
        'Cache-Control': 'public, max-age=60',
        'X-Cache': 'MISS'
      }
    });
  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    return NextResponse.json(
      { error: 'Error al obtener estadísticas del dashboard' },
      { status: 500 }
    );
  }
}
