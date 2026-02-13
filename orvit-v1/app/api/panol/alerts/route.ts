/**
 * API: /api/panol/alerts
 *
 * GET - Obtener alertas inteligentes de inventario
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;

    if (!token) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }

    const payload = await verifyToken(token);
    if (!payload || !payload.companyId) {
      return NextResponse.json({ error: 'Token inválido' }, { status: 401 });
    }

    const companyId = payload.companyId as number;

    // 1. Stock crítico para máquinas críticas
    const criticalMachineTools = await prisma.$queryRaw`
      SELECT
        t.id as "toolId",
        t.name as "toolName",
        t."stockQuantity",
        t."minStockLevel",
        t.unit,
        m.id as "machineId",
        m.name as "machineName",
        m."criticalityScore"
      FROM "Tool" t
      JOIN "tool_machines" tm ON t.id = tm."toolId"
      JOIN "Machine" m ON tm."machineId" = m.id
      WHERE t."companyId" = ${companyId}
        AND m."criticalityScore" >= 7
        AND t."stockQuantity" <= t."minStockLevel"
        AND t."isActive" = true
      ORDER BY m."criticalityScore" DESC, t."stockQuantity" ASC
      LIMIT 20
    ` as any[];

    // 2. Items sin movimiento (>60 días)
    const sixtyDaysAgo = new Date();
    sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);

    const noMovementItems = await prisma.tool.findMany({
      where: {
        companyId,
        isActive: true,
        stockQuantity: { gt: 0 },
        movements: {
          none: {
            createdAt: { gte: sixtyDaysAgo }
          }
        }
      },
      select: {
        id: true,
        name: true,
        stockQuantity: true,
        unit: true,
        cost: true,
        category: true,
        lastMovementDate: true
      },
      orderBy: { lastMovementDate: 'asc' },
      take: 20
    });

    // 3. Lotes próximos a vencer
    const thirtyDaysAhead = new Date();
    thirtyDaysAhead.setDate(thirtyDaysAhead.getDate() + 30);

    const expiringLots = await prisma.inventoryLot.findMany({
      where: {
        companyId,
        status: 'AVAILABLE',
        remainingQty: { gt: 0 },
        expiresAt: {
          lte: thirtyDaysAhead,
          gte: new Date()
        }
      },
      include: {
        tool: { select: { id: true, name: true, unit: true } }
      },
      orderBy: { expiresAt: 'asc' },
      take: 20
    });

    // 4. Reservas pendientes antiguas (>3 días)
    const threeDaysAgo = new Date();
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

    const oldPendingReservations = await prisma.sparePartReservation.findMany({
      where: {
        companyId,
        status: 'PENDING',
        reservedAt: { lte: threeDaysAgo }
      },
      include: {
        tool: { select: { id: true, name: true } },
        workOrder: { select: { id: true, title: true, status: true } }
      },
      orderBy: { reservedAt: 'asc' },
      take: 20
    });

    // 5. Stock en cero con demanda (reservas o uso reciente)
    const outOfStockWithDemand = await prisma.tool.findMany({
      where: {
        companyId,
        isActive: true,
        stockQuantity: 0,
        OR: [
          { movements: { some: { createdAt: { gte: sixtyDaysAgo } } } },
          { reservations: { some: { status: 'PENDING' } } }
        ]
      },
      include: {
        reservations: {
          where: { status: 'PENDING' },
          select: { quantity: true }
        },
        _count: {
          select: { movements: true }
        }
      },
      take: 20
    });

    // 6. Items sobre el máximo de stock
    const overstockedItems = await prisma.tool.findMany({
      where: {
        companyId,
        isActive: true,
        maxStockLevel: { not: null },
        stockQuantity: { gt: 0 }
      },
      select: {
        id: true,
        name: true,
        stockQuantity: true,
        maxStockLevel: true,
        unit: true,
        cost: true
      },
      take: 100
    });

    const actualOverstocked = overstockedItems.filter(
      item => item.stockQuantity > (item.maxStockLevel || Infinity)
    ).slice(0, 10);

    // Construir alertas
    const alerts: Array<{
      id: string;
      type: 'CRITICAL' | 'WARNING' | 'INFO';
      category: string;
      title: string;
      description: string;
      count: number;
      items: any[];
      action?: { label: string; href: string };
    }> = [];

    // Alert: Stock crítico para máquinas críticas
    if (criticalMachineTools.length > 0) {
      alerts.push({
        id: 'critical-machine-stock',
        type: 'CRITICAL',
        category: 'Stock Crítico',
        title: 'Repuestos críticos con bajo stock',
        description: `${criticalMachineTools.length} repuestos de máquinas críticas necesitan reposición urgente`,
        count: criticalMachineTools.length,
        items: criticalMachineTools,
        action: { label: 'Ver detalles', href: '/panol?filter=low_stock' }
      });
    }

    // Alert: Out of stock con demanda
    if (outOfStockWithDemand.length > 0) {
      const totalPending = outOfStockWithDemand.reduce((acc, t) =>
        acc + t.reservations.reduce((a, r) => a + r.quantity, 0), 0
      );
      alerts.push({
        id: 'out-of-stock-demand',
        type: 'CRITICAL',
        category: 'Sin Stock',
        title: 'Items agotados con demanda pendiente',
        description: `${outOfStockWithDemand.length} items sin stock tienen ${totalPending} unidades reservadas`,
        count: outOfStockWithDemand.length,
        items: outOfStockWithDemand.map(t => ({
          id: t.id,
          name: t.name,
          pendingReservations: t.reservations.reduce((a, r) => a + r.quantity, 0),
          recentMovements: t._count.movements
        })),
        action: { label: 'Gestionar compras', href: '/panol?filter=out_of_stock' }
      });
    }

    // Alert: Lotes por vencer
    if (expiringLots.length > 0) {
      const expiredValue = expiringLots.reduce((acc, l) =>
        acc + l.remainingQty * (l.unitCost || 0), 0
      );
      alerts.push({
        id: 'expiring-lots',
        type: 'WARNING',
        category: 'Vencimientos',
        title: 'Lotes próximos a vencer',
        description: `${expiringLots.length} lotes vencen en los próximos 30 días`,
        count: expiringLots.length,
        items: expiringLots.map(l => ({
          id: l.id,
          lotNumber: l.lotNumber,
          toolName: l.tool?.name,
          remainingQty: l.remainingQty,
          expiresAt: l.expiresAt,
          daysUntilExpiry: Math.ceil((l.expiresAt!.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
        })),
        action: { label: 'Ver lotes', href: '/panol/lotes?filter=expiring' }
      });
    }

    // Alert: Reservas pendientes antiguas
    if (oldPendingReservations.length > 0) {
      alerts.push({
        id: 'old-reservations',
        type: 'WARNING',
        category: 'Reservas',
        title: 'Reservas pendientes de hace más de 3 días',
        description: `${oldPendingReservations.length} reservas esperando ser despachadas`,
        count: oldPendingReservations.length,
        items: oldPendingReservations.map(r => ({
          id: r.id,
          toolName: r.tool?.name,
          workOrderId: r.workOrderId,
          workOrderTitle: r.workOrder?.title,
          quantity: r.quantity,
          reservedAt: r.reservedAt,
          daysWaiting: Math.floor((Date.now() - r.reservedAt.getTime()) / (1000 * 60 * 60 * 24))
        })),
        action: { label: 'Ver reservas', href: '/panol/reservas?status=PENDING' }
      });
    }

    // Alert: Items sin movimiento
    if (noMovementItems.length > 0) {
      const stagnantValue = noMovementItems.reduce((acc, t) =>
        acc + t.stockQuantity * (t.cost || 0), 0
      );
      alerts.push({
        id: 'no-movement',
        type: 'INFO',
        category: 'Rotación',
        title: 'Items sin movimiento',
        description: `${noMovementItems.length} items sin movimiento en 60+ días (valor: $${stagnantValue.toLocaleString()})`,
        count: noMovementItems.length,
        items: noMovementItems.map(t => ({
          id: t.id,
          name: t.name,
          stockQuantity: t.stockQuantity,
          unit: t.unit,
          value: t.stockQuantity * (t.cost || 0),
          lastMovement: t.lastMovementDate,
          daysSinceMovement: t.lastMovementDate
            ? Math.floor((Date.now() - t.lastMovementDate.getTime()) / (1000 * 60 * 60 * 24))
            : null
        })),
        action: { label: 'Revisar inventario', href: '/panol?sort=last_movement' }
      });
    }

    // Alert: Sobrestock
    if (actualOverstocked.length > 0) {
      alerts.push({
        id: 'overstocked',
        type: 'INFO',
        category: 'Sobrestock',
        title: 'Items sobre el nivel máximo',
        description: `${actualOverstocked.length} items exceden su stock máximo`,
        count: actualOverstocked.length,
        items: actualOverstocked.map(t => ({
          id: t.id,
          name: t.name,
          stockQuantity: t.stockQuantity,
          maxStockLevel: t.maxStockLevel,
          excess: t.stockQuantity - (t.maxStockLevel || 0),
          excessValue: (t.stockQuantity - (t.maxStockLevel || 0)) * (t.cost || 0)
        })),
        action: { label: 'Ver detalles', href: '/panol?filter=overstocked' }
      });
    }

    // Resumen
    const summary = {
      critical: alerts.filter(a => a.type === 'CRITICAL').length,
      warning: alerts.filter(a => a.type === 'WARNING').length,
      info: alerts.filter(a => a.type === 'INFO').length,
      total: alerts.length
    };

    return NextResponse.json({
      success: true,
      data: {
        alerts: alerts.sort((a, b) => {
          const priority = { CRITICAL: 0, WARNING: 1, INFO: 2 };
          return priority[a.type] - priority[b.type];
        }),
        summary
      }
    });

  } catch (error) {
    console.error('Error en GET /api/panol/alerts:', error);
    return NextResponse.json(
      { error: 'Error al obtener alertas' },
      { status: 500 }
    );
  }
}
