import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';

export type ProductionEventType =
  // Production Order events
  | 'ORDER_CREATED'
  | 'ORDER_RELEASED'
  | 'ORDER_STARTED'
  | 'ORDER_PAUSED'
  | 'ORDER_RESUMED'
  | 'ORDER_COMPLETED'
  | 'ORDER_CANCELLED'
  | 'ORDER_UPDATED'
  // Daily Report events
  | 'REPORT_CREATED'
  | 'REPORT_UPDATED'
  | 'REPORT_CONFIRMED'
  | 'REPORT_REVIEWED'
  // Batch Lot events
  | 'LOT_CREATED'
  | 'LOT_BLOCKED'
  | 'LOT_RELEASED'
  | 'LOT_SHIPPED'
  // Downtime events
  | 'DOWNTIME_STARTED'
  | 'DOWNTIME_ENDED'
  | 'DOWNTIME_LINKED_TO_WO';

export type EntityType =
  | 'PRODUCTION_ORDER'
  | 'DAILY_REPORT'
  | 'BATCH_LOT'
  | 'DOWNTIME'
  | 'QUALITY_CONTROL'
  | 'DEFECT'
  | 'ROUTINE';

interface LogEventParams {
  entityType: EntityType;
  entityId: number;
  eventType: ProductionEventType;
  previousValue?: Prisma.InputJsonValue;
  newValue?: Prisma.InputJsonValue;
  notes?: string;
  performedById: number;
  productionOrderId?: number;
  companyId: number;
}

/**
 * Registra un evento de producción para auditoría
 */
export async function logProductionEvent(params: LogEventParams) {
  const event = await prisma.productionEvent.create({
    data: {
      entityType: params.entityType,
      entityId: params.entityId,
      eventType: params.eventType,
      previousValue: params.previousValue,
      newValue: params.newValue,
      notes: params.notes,
      performedById: params.performedById,
      productionOrderId: params.productionOrderId,
      companyId: params.companyId,
    }
  });

  return event;
}

/**
 * Registra un cambio de estado en una orden de producción
 */
export async function logOrderStatusChange(
  orderId: number,
  previousStatus: string,
  newStatus: string,
  performedById: number,
  companyId: number,
  notes?: string
) {
  const eventTypeMap: Record<string, ProductionEventType> = {
    'RELEASED': 'ORDER_RELEASED',
    'IN_PROGRESS': 'ORDER_STARTED',
    'PAUSED': 'ORDER_PAUSED',
    'COMPLETED': 'ORDER_COMPLETED',
    'CANCELLED': 'ORDER_CANCELLED',
  };

  // Caso especial: reanudar (de PAUSED a IN_PROGRESS)
  let eventType = eventTypeMap[newStatus] || 'ORDER_UPDATED';
  if (previousStatus === 'PAUSED' && newStatus === 'IN_PROGRESS') {
    eventType = 'ORDER_RESUMED';
  }

  return logProductionEvent({
    entityType: 'PRODUCTION_ORDER',
    entityId: orderId,
    eventType,
    previousValue: { status: previousStatus },
    newValue: { status: newStatus },
    notes,
    performedById,
    productionOrderId: orderId,
    companyId,
  });
}
