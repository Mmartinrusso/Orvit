/**
 * API: /api/automations/[id]/test
 *
 * POST - Probar una regla con datos simulados
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth';
import { AutomationEngine, TriggerContext } from '@/lib/automation/engine';

export const dynamic = 'force-dynamic';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/automations/[id]/test
 * Probar una regla en modo simulación
 *
 * Body:
 * - testData: object - datos para simular el trigger
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;

    if (!token) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }

    const payload = await verifyToken(token);
    if (!payload || !payload.companyId || !payload.userId) {
      return NextResponse.json({ error: 'Token inválido' }, { status: 401 });
    }

    const companyId = payload.companyId as number;
    const userId = payload.userId as number;
    const ruleId = parseInt(id);

    if (isNaN(ruleId)) {
      return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
    }

    // Get the rule
    const rule = await prisma.automationRule.findFirst({
      where: { id: ruleId, companyId }
    });

    if (!rule) {
      return NextResponse.json(
        { error: 'Regla no encontrada' },
        { status: 404 }
      );
    }

    const body = await request.json();
    const { testData } = body;

    // Generate sample data based on trigger type if not provided
    const sampleData = testData || generateSampleData(rule.triggerType);

    // Temporarily set rule to test mode
    const originalTestMode = rule.isTestMode;
    if (!originalTestMode) {
      await prisma.automationRule.update({
        where: { id: ruleId },
        data: { isTestMode: true }
      });
    }

    try {
      // Create test context
      const context: TriggerContext = {
        companyId,
        triggerType: rule.triggerType as any,
        data: sampleData,
        userId
      };

      // Execute with the engine
      const results = await AutomationEngine.processEvent(context);

      // Find our rule's result
      const ruleResult = results.find(r => r.ruleId === ruleId);

      return NextResponse.json({
        success: true,
        testMode: true,
        rule: {
          id: rule.id,
          name: rule.name,
          triggerType: rule.triggerType
        },
        testData: sampleData,
        result: ruleResult || {
          status: 'NOT_TRIGGERED',
          message: 'La regla no se activó con los datos de prueba'
        }
      });
    } finally {
      // Restore original test mode setting
      if (!originalTestMode) {
        await prisma.automationRule.update({
          where: { id: ruleId },
          data: { isTestMode: false }
        });
      }
    }
  } catch (error) {
    console.error('Error en POST /api/automations/[id]/test:', error);
    return NextResponse.json(
      { error: 'Error al probar la regla' },
      { status: 500 }
    );
  }
}

/**
 * Generate sample data for different trigger types
 */
function generateSampleData(triggerType: string): Record<string, unknown> {
  const now = new Date().toISOString();

  switch (triggerType) {
    case 'WORK_ORDER_CREATED':
      return {
        workOrder: {
          id: 999,
          title: '[TEST] Orden de trabajo de prueba',
          description: 'Esta es una orden de trabajo de prueba para simular el trigger',
          type: 'CORRECTIVE',
          priority: 'HIGH',
          status: 'PENDING',
          machineId: 1,
          machine: { id: 1, name: 'Máquina de Prueba' },
          createdAt: now
        },
        workOrderId: 999
      };

    case 'WORK_ORDER_STATUS_CHANGED':
      return {
        workOrder: {
          id: 999,
          title: '[TEST] Orden de trabajo de prueba',
          type: 'CORRECTIVE',
          priority: 'MEDIUM',
          status: 'IN_PROGRESS'
        },
        workOrderId: 999,
        previousStatus: 'PENDING',
        newStatus: 'IN_PROGRESS'
      };

    case 'WORK_ORDER_ASSIGNED':
      return {
        workOrder: {
          id: 999,
          title: '[TEST] Orden de trabajo de prueba',
          type: 'CORRECTIVE',
          priority: 'MEDIUM',
          status: 'PENDING'
        },
        workOrderId: 999,
        assignedToId: 1
      };

    case 'FAILURE_REPORTED':
      return {
        failure: {
          id: 999,
          title: '[TEST] Falla de prueba',
          description: 'Esta es una falla de prueba para simular el trigger',
          priority: 'URGENT',
          status: 'OPEN',
          machineId: 1
        },
        failureId: 999
      };

    case 'STOCK_LOW':
      return {
        tool: {
          id: 999,
          name: '[TEST] Repuesto de prueba',
          stockQuantity: 5,
          minStock: 10,
          itemType: 'SPARE_PART'
        },
        toolId: 999
      };

    case 'PREVENTIVE_DUE':
      return {
        template: {
          id: 999,
          name: '[TEST] Mantenimiento preventivo de prueba',
          frequency: 'MONTHLY'
        },
        machine: {
          id: 1,
          name: 'Máquina de Prueba'
        },
        templateId: 999,
        machineId: 1
      };

    case 'MACHINE_STATUS_CHANGED':
      return {
        machine: {
          id: 1,
          name: 'Máquina de Prueba',
          status: 'OUT_OF_SERVICE'
        },
        machineId: 1,
        previousStatus: 'OPERATIONAL',
        newStatus: 'OUT_OF_SERVICE'
      };

    default:
      return {
        testEvent: true,
        timestamp: now,
        message: 'Datos de prueba genéricos'
      };
  }
}
