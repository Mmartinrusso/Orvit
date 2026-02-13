/**
 * Pedidos de Compra Enforcement
 *
 * Evaluación automática de requisitos de aprobación para pedidos de compra.
 * Incluye reglas de SoD (Segregation of Duties).
 */

import { PrismaClient } from '@prisma/client';

interface PedidoParaEvaluar {
  total?: number;
  presupuestoEstimado?: number | null;
  prioridad: string;
  items: Array<{
    supplierItemId?: number | null;
    descripcion?: string;
  }>;
}

interface EvaluacionAprobacion {
  requiereAprobacion: boolean;
  motivos: string[];
  estadoInicial: 'ENVIADA' | 'EN_APROBACION';
}

/**
 * Evalúa si un pedido requiere aprobación antes de procesar
 */
export async function evaluarRequiereAprobacion(
  pedido: PedidoParaEvaluar,
  companyId: number,
  prismaClient: PrismaClient | any
): Promise<EvaluacionAprobacion> {
  const motivos: string[] = [];

  // Obtener configuración de la empresa
  const config = await prismaClient.purchaseConfig.findUnique({
    where: { companyId },
    select: {
      umbralAprobacionPedido: true,
    },
  });

  // Umbral por defecto: 50,000
  const umbralAprobacion = Number(config?.umbralAprobacionPedido) || 50000;

  // 1. Evaluar por monto
  const monto = pedido.total || pedido.presupuestoEstimado || 0;
  if (monto >= umbralAprobacion) {
    motivos.push(`MONTO_SUPERA_UMBRAL: ${monto} >= ${umbralAprobacion}`);
  }

  // 2. Evaluar por prioridad urgente
  if (pedido.prioridad === 'URGENTE') {
    motivos.push('PRIORIDAD_URGENTE');
  }

  // 3. Evaluar items fuera de catálogo (sin supplierItemId)
  const itemsSinCatalogo = pedido.items.filter(
    (item) => !item.supplierItemId
  );
  if (itemsSinCatalogo.length > 0) {
    motivos.push(`ITEMS_FUERA_CATALOGO: ${itemsSinCatalogo.length} items sin código de proveedor`);
  }

  const requiereAprobacion = motivos.length > 0;

  return {
    requiereAprobacion,
    motivos,
    estadoInicial: requiereAprobacion ? 'EN_APROBACION' : 'ENVIADA',
  };
}

/**
 * Verifica SoD: El creador del pedido no puede aprobarlo
 */
export function verificarSoDPedidoAprobacion(
  solicitanteId: number,
  aprobadorId: number
): { permitido: boolean; mensaje?: string } {
  if (solicitanteId === aprobadorId) {
    return {
      permitido: false,
      mensaje: 'Violación SoD: El creador del pedido no puede aprobarlo. Requiere aprobación de otro usuario.',
    };
  }
  return { permitido: true };
}

/**
 * Estados en los que un pedido NO puede ser editado
 */
export const ESTADOS_NO_EDITABLES = [
  'APROBADA',
  'EN_PROCESO',
  'COMPLETADA',
  'RECHAZADA',
  'CANCELADA',
] as const;

/**
 * Verifica si un pedido puede ser editado según su estado
 */
export function puedeEditarPedido(estado: string): {
  puedeEditar: boolean;
  mensaje?: string;
} {
  if ((ESTADOS_NO_EDITABLES as readonly string[]).includes(estado)) {
    return {
      puedeEditar: false,
      mensaje: `No se puede editar un pedido en estado ${estado}. Solo puede anularse.`,
    };
  }
  return { puedeEditar: true };
}

/**
 * Verifica si se puede crear una OC desde un pedido
 */
export function puedeCrearOCDesdePedido(
  estadoPedido: string
): { permitido: boolean; mensaje?: string } {
  if (estadoPedido !== 'APROBADA') {
    return {
      permitido: false,
      mensaje: `No se puede crear OC desde pedido no aprobado. Estado actual: ${estadoPedido}`,
    };
  }
  return { permitido: true };
}
