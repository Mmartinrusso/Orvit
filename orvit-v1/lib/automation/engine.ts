/**
 * Motor de Automatizaciones
 *
 * Procesa eventos del sistema y ejecuta reglas de automatización
 * configuradas por el usuario.
 */

import { prisma } from '@/lib/prisma';
import {
  AutomationTriggerType,
  AutomationExecutionStatus,
  AutomationRule
} from '@prisma/client';

// ============================================================================
// TIPOS
// ============================================================================

export interface TriggerContext {
  companyId: number;
  triggerType: AutomationTriggerType;
  data: Record<string, unknown>;
  userId?: number;
}

export interface Condition {
  field: string;
  operator: 'equals' | 'not_equals' | 'contains' | 'not_contains' |
            'greater_than' | 'less_than' | 'in' | 'not_in' |
            'is_empty' | 'is_not_empty';
  value: unknown;
}

export interface ActionConfig {
  type: ActionType;
  config: Record<string, unknown>;
}

export type ActionType =
  | 'NOTIFY_USER'
  | 'NOTIFY_ROLE'
  | 'ASSIGN_USER'
  | 'CHANGE_STATUS'
  | 'ADD_TAG'
  | 'CREATE_TASK'
  | 'SEND_EMAIL'
  | 'SEND_WHATSAPP';

export interface ActionResult {
  type: ActionType;
  success: boolean;
  message?: string;
  data?: unknown;
}

export interface ExecutionResult {
  ruleId: number;
  ruleName: string;
  status: AutomationExecutionStatus;
  conditionsPassed: boolean;
  actionsExecuted: ActionResult[];
  errorMessage?: string;
  durationMs: number;
}

// ============================================================================
// MOTOR PRINCIPAL
// ============================================================================

export class AutomationEngine {
  /**
   * Procesa un evento y ejecuta todas las reglas que apliquen
   */
  static async processEvent(context: TriggerContext): Promise<ExecutionResult[]> {
    const { companyId, triggerType, data } = context;
    const results: ExecutionResult[] = [];

    try {
      // 1. Buscar reglas activas que coincidan con el trigger
      const rules = await prisma.automationRule.findMany({
        where: {
          companyId,
          triggerType,
          isActive: true
        },
        orderBy: {
          priority: 'asc' // Menor prioridad primero
        }
      });

      if (rules.length === 0) {
        return results;
      }

      console.log(`[Automation] Encontradas ${rules.length} reglas para ${triggerType}`);

      // 2. Ejecutar cada regla
      for (const rule of rules) {
        const result = await this.executeRule(rule, context);
        results.push(result);
      }

      return results;
    } catch (error) {
      console.error('[Automation] Error procesando evento:', error);
      throw error;
    }
  }

  /**
   * Ejecuta una regla individual
   */
  private static async executeRule(
    rule: AutomationRule,
    context: TriggerContext
  ): Promise<ExecutionResult> {
    const startTime = Date.now();
    const result: ExecutionResult = {
      ruleId: rule.id,
      ruleName: rule.name,
      status: AutomationExecutionStatus.RUNNING,
      conditionsPassed: false,
      actionsExecuted: [],
      durationMs: 0
    };

    // Crear registro de ejecución
    const execution = await prisma.automationExecution.create({
      data: {
        ruleId: rule.id,
        companyId: context.companyId,
        triggerType: context.triggerType,
        triggerData: context.data as object,
        status: AutomationExecutionStatus.RUNNING
      }
    });

    try {
      // 1. Evaluar condiciones
      const conditions = (rule.conditions as Condition[]) || [];
      result.conditionsPassed = this.evaluateConditions(conditions, context.data);

      if (!result.conditionsPassed) {
        result.status = AutomationExecutionStatus.SKIPPED;
        await this.updateExecution(execution.id, {
          status: AutomationExecutionStatus.SKIPPED,
          conditionsPassed: false,
          completedAt: new Date(),
          durationMs: Date.now() - startTime
        });
        result.durationMs = Date.now() - startTime;
        return result;
      }

      // 2. Ejecutar acciones (o simular si está en modo test)
      const actions = (rule.actions as ActionConfig[]) || [];

      if (rule.isTestMode) {
        // Modo simulación: no ejecutar realmente
        result.actionsExecuted = actions.map(action => ({
          type: action.type,
          success: true,
          message: '[SIMULADO] Acción simulada en modo test'
        }));
        result.status = AutomationExecutionStatus.SIMULATED;
      } else {
        // Modo real: ejecutar acciones
        for (const action of actions) {
          const actionResult = await this.executeAction(action, context);
          result.actionsExecuted.push(actionResult);

          // Si una acción falla, continuar pero marcar el status
          if (!actionResult.success) {
            result.status = AutomationExecutionStatus.FAILED;
            result.errorMessage = actionResult.message;
          }
        }

        if (result.status !== AutomationExecutionStatus.FAILED) {
          result.status = AutomationExecutionStatus.COMPLETED;
        }
      }

      // 3. Actualizar estadísticas de la regla
      await prisma.automationRule.update({
        where: { id: rule.id },
        data: {
          executionCount: { increment: 1 },
          lastExecutedAt: new Date()
        }
      });

      // 4. Actualizar registro de ejecución
      await this.updateExecution(execution.id, {
        status: result.status,
        conditionsPassed: true,
        actionsExecuted: result.actionsExecuted,
        errorMessage: result.errorMessage,
        completedAt: new Date(),
        durationMs: Date.now() - startTime
      });

      result.durationMs = Date.now() - startTime;
      return result;

    } catch (error: any) {
      result.status = AutomationExecutionStatus.FAILED;
      result.errorMessage = error?.message || 'Error desconocido';
      result.durationMs = Date.now() - startTime;

      await this.updateExecution(execution.id, {
        status: AutomationExecutionStatus.FAILED,
        errorMessage: result.errorMessage,
        completedAt: new Date(),
        durationMs: result.durationMs
      });

      console.error(`[Automation] Error ejecutando regla ${rule.name}:`, error);
      return result;
    }
  }

  /**
   * Evalúa todas las condiciones (AND lógico)
   */
  private static evaluateConditions(
    conditions: Condition[],
    data: Record<string, unknown>
  ): boolean {
    if (conditions.length === 0) {
      return true; // Sin condiciones = siempre pasa
    }

    return conditions.every(condition =>
      this.evaluateCondition(condition, data)
    );
  }

  /**
   * Evalúa una condición individual
   */
  private static evaluateCondition(
    condition: Condition,
    data: Record<string, unknown>
  ): boolean {
    const { field, operator, value } = condition;

    // Obtener valor del campo (soporta notación con puntos: "workOrder.priority")
    const fieldValue = this.getNestedValue(data, field);

    switch (operator) {
      case 'equals':
        return fieldValue === value;

      case 'not_equals':
        return fieldValue !== value;

      case 'contains':
        if (typeof fieldValue === 'string' && typeof value === 'string') {
          return fieldValue.toLowerCase().includes(value.toLowerCase());
        }
        return false;

      case 'not_contains':
        if (typeof fieldValue === 'string' && typeof value === 'string') {
          return !fieldValue.toLowerCase().includes(value.toLowerCase());
        }
        return true;

      case 'greater_than':
        return Number(fieldValue) > Number(value);

      case 'less_than':
        return Number(fieldValue) < Number(value);

      case 'in':
        if (Array.isArray(value)) {
          return value.includes(fieldValue);
        }
        return false;

      case 'not_in':
        if (Array.isArray(value)) {
          return !value.includes(fieldValue);
        }
        return true;

      case 'is_empty':
        return fieldValue === null ||
               fieldValue === undefined ||
               fieldValue === '' ||
               (Array.isArray(fieldValue) && fieldValue.length === 0);

      case 'is_not_empty':
        return fieldValue !== null &&
               fieldValue !== undefined &&
               fieldValue !== '' &&
               (!Array.isArray(fieldValue) || fieldValue.length > 0);

      default:
        console.warn(`[Automation] Operador desconocido: ${operator}`);
        return false;
    }
  }

  /**
   * Obtiene un valor anidado de un objeto usando notación de puntos
   */
  private static getNestedValue(obj: Record<string, unknown>, path: string): unknown {
    return path.split('.').reduce((current: unknown, key) => {
      if (current && typeof current === 'object') {
        return (current as Record<string, unknown>)[key];
      }
      return undefined;
    }, obj);
  }

  /**
   * Ejecuta una acción
   */
  private static async executeAction(
    action: ActionConfig,
    context: TriggerContext
  ): Promise<ActionResult> {
    const { type, config } = action;

    try {
      switch (type) {
        case 'NOTIFY_USER':
          return await this.actionNotifyUser(config, context);

        case 'NOTIFY_ROLE':
          return await this.actionNotifyRole(config, context);

        case 'ASSIGN_USER':
          return await this.actionAssignUser(config, context);

        case 'CHANGE_STATUS':
          return await this.actionChangeStatus(config, context);

        case 'ADD_TAG':
          return await this.actionAddTag(config, context);

        case 'CREATE_TASK':
          return await this.actionCreateTask(config, context);

        case 'SEND_EMAIL':
          return await this.actionSendEmail(config, context);

        case 'SEND_WHATSAPP':
          return await this.actionSendWhatsApp(config, context);

        default:
          return {
            type,
            success: false,
            message: `Tipo de acción no soportado: ${type}`
          };
      }
    } catch (error: any) {
      return {
        type,
        success: false,
        message: error?.message || 'Error ejecutando acción'
      };
    }
  }

  // ===========================================================================
  // ACCIONES
  // ===========================================================================

  /**
   * Notificar a un usuario específico
   */
  private static async actionNotifyUser(
    config: Record<string, unknown>,
    context: TriggerContext
  ): Promise<ActionResult> {
    const { userId, title, message } = config;

    if (!userId) {
      return { type: 'NOTIFY_USER', success: false, message: 'userId requerido' };
    }

    const notificationMessage = this.interpolateMessage(
      message as string || 'Notificación automática',
      context.data
    );

    await prisma.notification.create({
      data: {
        userId: userId as number,
        companyId: context.companyId,
        title: (title as string) || 'Automatización',
        message: notificationMessage,
        type: 'SYSTEM',
        link: this.buildLink(context)
      }
    });

    return {
      type: 'NOTIFY_USER',
      success: true,
      message: `Notificación enviada a usuario ${userId}`
    };
  }

  /**
   * Notificar a todos los usuarios de un rol
   */
  private static async actionNotifyRole(
    config: Record<string, unknown>,
    context: TriggerContext
  ): Promise<ActionResult> {
    const { roleId, roleName, title, message } = config;

    // Buscar usuarios del rol
    let users;
    if (roleId) {
      users = await prisma.userOnCompany.findMany({
        where: {
          companyId: context.companyId,
          roleId: roleId as number,
          isActive: true
        },
        select: { userId: true }
      });
    } else if (roleName) {
      const role = await prisma.role.findFirst({
        where: {
          companyId: context.companyId,
          name: roleName as string
        }
      });
      if (!role) {
        return { type: 'NOTIFY_ROLE', success: false, message: `Rol ${roleName} no encontrado` };
      }
      users = await prisma.userOnCompany.findMany({
        where: {
          companyId: context.companyId,
          roleId: role.id,
          isActive: true
        },
        select: { userId: true }
      });
    } else {
      return { type: 'NOTIFY_ROLE', success: false, message: 'roleId o roleName requerido' };
    }

    if (users.length === 0) {
      return { type: 'NOTIFY_ROLE', success: true, message: 'No hay usuarios en el rol' };
    }

    const notificationMessage = this.interpolateMessage(
      message as string || 'Notificación automática',
      context.data
    );

    // Crear notificaciones en batch
    await prisma.notification.createMany({
      data: users.map(u => ({
        userId: u.userId,
        companyId: context.companyId,
        title: (title as string) || 'Automatización',
        message: notificationMessage,
        type: 'SYSTEM' as const,
        link: this.buildLink(context)
      }))
    });

    return {
      type: 'NOTIFY_ROLE',
      success: true,
      message: `Notificación enviada a ${users.length} usuarios`
    };
  }

  /**
   * Asignar usuario a una OT
   */
  private static async actionAssignUser(
    config: Record<string, unknown>,
    context: TriggerContext
  ): Promise<ActionResult> {
    const { userId } = config;
    const workOrderId = context.data.workOrderId ||
                        (context.data.workOrder as any)?.id;

    if (!workOrderId) {
      return { type: 'ASSIGN_USER', success: false, message: 'workOrderId no disponible en contexto' };
    }

    if (!userId) {
      return { type: 'ASSIGN_USER', success: false, message: 'userId requerido' };
    }

    await prisma.workOrder.update({
      where: { id: workOrderId as number },
      data: { assignedToId: userId as number }
    });

    return {
      type: 'ASSIGN_USER',
      success: true,
      message: `Usuario ${userId} asignado a OT #${workOrderId}`
    };
  }

  /**
   * Cambiar estado de una OT
   */
  private static async actionChangeStatus(
    config: Record<string, unknown>,
    context: TriggerContext
  ): Promise<ActionResult> {
    const { status } = config;
    const workOrderId = context.data.workOrderId ||
                        (context.data.workOrder as any)?.id;

    if (!workOrderId) {
      return { type: 'CHANGE_STATUS', success: false, message: 'workOrderId no disponible en contexto' };
    }

    if (!status) {
      return { type: 'CHANGE_STATUS', success: false, message: 'status requerido' };
    }

    await prisma.workOrder.update({
      where: { id: workOrderId as number },
      data: { status: status as any }
    });

    return {
      type: 'CHANGE_STATUS',
      success: true,
      message: `Estado de OT #${workOrderId} cambiado a ${status}`
    };
  }

  /**
   * Agregar tag a una OT
   */
  private static async actionAddTag(
    config: Record<string, unknown>,
    context: TriggerContext
  ): Promise<ActionResult> {
    const { tag } = config;
    const workOrderId = context.data.workOrderId ||
                        (context.data.workOrder as any)?.id;

    if (!workOrderId) {
      return { type: 'ADD_TAG', success: false, message: 'workOrderId no disponible en contexto' };
    }

    if (!tag) {
      return { type: 'ADD_TAG', success: false, message: 'tag requerido' };
    }

    // Obtener tags actuales
    const workOrder = await prisma.workOrder.findUnique({
      where: { id: workOrderId as number },
      select: { tags: true }
    });

    const currentTags = (workOrder?.tags as string[]) || [];
    if (!currentTags.includes(tag as string)) {
      await prisma.workOrder.update({
        where: { id: workOrderId as number },
        data: { tags: [...currentTags, tag as string] }
      });
    }

    return {
      type: 'ADD_TAG',
      success: true,
      message: `Tag "${tag}" agregado a OT #${workOrderId}`
    };
  }

  /**
   * Crear tarea de seguimiento
   */
  private static async actionCreateTask(
    config: Record<string, unknown>,
    context: TriggerContext
  ): Promise<ActionResult> {
    const { title, description, assigneeId, priority, dueInDays } = config;

    if (!title) {
      return { type: 'CREATE_TASK', success: false, message: 'title requerido' };
    }

    const taskTitle = this.interpolateMessage(title as string, context.data);
    const taskDescription = description
      ? this.interpolateMessage(description as string, context.data)
      : undefined;

    const dueDate = dueInDays
      ? new Date(Date.now() + (dueInDays as number) * 24 * 60 * 60 * 1000)
      : undefined;

    await prisma.task.create({
      data: {
        title: taskTitle,
        description: taskDescription,
        companyId: context.companyId,
        assignedToId: assigneeId as number || context.userId,
        priority: (priority as any) || 'MEDIUM',
        status: 'PENDING',
        dueDate,
        createdById: context.userId || 1
      }
    });

    return {
      type: 'CREATE_TASK',
      success: true,
      message: `Tarea "${taskTitle}" creada`
    };
  }

  /**
   * Enviar email (placeholder - requiere integración con servicio de email)
   */
  private static async actionSendEmail(
    config: Record<string, unknown>,
    context: TriggerContext
  ): Promise<ActionResult> {
    const { to, subject, body } = config;

    // TODO: Implementar integración con servicio de email
    console.log('[Automation] Email pendiente de enviar:', { to, subject, body });

    return {
      type: 'SEND_EMAIL',
      success: true,
      message: 'Email en cola (pendiente de implementación)'
    };
  }

  /**
   * Enviar WhatsApp (placeholder - requiere integración con Evolution API)
   */
  private static async actionSendWhatsApp(
    config: Record<string, unknown>,
    context: TriggerContext
  ): Promise<ActionResult> {
    const { phone, message } = config;

    // TODO: Implementar integración con Evolution API
    console.log('[Automation] WhatsApp pendiente de enviar:', { phone, message });

    return {
      type: 'SEND_WHATSAPP',
      success: true,
      message: 'WhatsApp en cola (pendiente de implementación)'
    };
  }

  // ===========================================================================
  // HELPERS
  // ===========================================================================

  /**
   * Interpola variables en un mensaje
   * Ejemplo: "OT #{workOrder.code} creada" -> "OT #OT-001 creada"
   */
  private static interpolateMessage(
    template: string,
    data: Record<string, unknown>
  ): string {
    return template.replace(/\{([^}]+)\}/g, (match, path) => {
      const value = this.getNestedValue(data, path);
      return value !== undefined ? String(value) : match;
    });
  }

  /**
   * Construye un link basado en el contexto
   */
  private static buildLink(context: TriggerContext): string | null {
    const { triggerType, data } = context;

    switch (triggerType) {
      case 'WORK_ORDER_CREATED':
      case 'WORK_ORDER_STATUS_CHANGED':
      case 'WORK_ORDER_ASSIGNED':
        const woId = data.workOrderId || (data.workOrder as any)?.id;
        return woId ? `/mantenimiento/ordenes-trabajo?workOrderId=${woId}` : null;

      case 'FAILURE_REPORTED':
      case 'FAILURE_RECURRENCE':
        const failureId = data.failureId || (data.failure as any)?.id;
        return failureId ? `/mantenimiento/fallas?failureId=${failureId}` : null;

      case 'STOCK_LOW':
        const toolId = data.toolId || (data.tool as any)?.id;
        return toolId ? `/panol?toolId=${toolId}` : null;

      default:
        return null;
    }
  }

  /**
   * Actualiza un registro de ejecución
   */
  private static async updateExecution(
    id: number,
    data: {
      status: AutomationExecutionStatus;
      conditionsPassed?: boolean;
      actionsExecuted?: ActionResult[];
      errorMessage?: string | null;
      completedAt: Date;
      durationMs: number;
    }
  ): Promise<void> {
    await prisma.automationExecution.update({
      where: { id },
      data: {
        status: data.status,
        conditionsPassed: data.conditionsPassed,
        actionsExecuted: data.actionsExecuted as unknown as object,
        errorMessage: data.errorMessage,
        completedAt: data.completedAt,
        durationMs: data.durationMs
      }
    });
  }
}

// ============================================================================
// FUNCIONES DE CONVENIENCIA
// ============================================================================

/**
 * Dispara evento de OT creada
 */
export async function triggerWorkOrderCreated(
  companyId: number,
  workOrder: Record<string, unknown>,
  userId?: number
): Promise<ExecutionResult[]> {
  return AutomationEngine.processEvent({
    companyId,
    triggerType: 'WORK_ORDER_CREATED',
    data: { workOrder, workOrderId: workOrder.id },
    userId
  });
}

/**
 * Dispara evento de cambio de estado de OT
 */
export async function triggerWorkOrderStatusChanged(
  companyId: number,
  workOrder: Record<string, unknown>,
  previousStatus: string,
  newStatus: string,
  userId?: number
): Promise<ExecutionResult[]> {
  return AutomationEngine.processEvent({
    companyId,
    triggerType: 'WORK_ORDER_STATUS_CHANGED',
    data: {
      workOrder,
      workOrderId: workOrder.id,
      previousStatus,
      newStatus
    },
    userId
  });
}

/**
 * Dispara evento de OT asignada
 */
export async function triggerWorkOrderAssigned(
  companyId: number,
  workOrder: Record<string, unknown>,
  assignedToId: number,
  userId?: number
): Promise<ExecutionResult[]> {
  return AutomationEngine.processEvent({
    companyId,
    triggerType: 'WORK_ORDER_ASSIGNED',
    data: {
      workOrder,
      workOrderId: workOrder.id,
      assignedToId
    },
    userId
  });
}

/**
 * Dispara evento de falla reportada
 */
export async function triggerFailureReported(
  companyId: number,
  failure: Record<string, unknown>,
  userId?: number
): Promise<ExecutionResult[]> {
  return AutomationEngine.processEvent({
    companyId,
    triggerType: 'FAILURE_REPORTED',
    data: { failure, failureId: failure.id },
    userId
  });
}

/**
 * Dispara evento de stock bajo
 */
export async function triggerStockLow(
  companyId: number,
  tool: Record<string, unknown>
): Promise<ExecutionResult[]> {
  return AutomationEngine.processEvent({
    companyId,
    triggerType: 'STOCK_LOW',
    data: { tool, toolId: tool.id }
  });
}

/**
 * Dispara evento de mantenimiento preventivo próximo
 */
export async function triggerPreventiveDue(
  companyId: number,
  template: Record<string, unknown>,
  machine: Record<string, unknown>
): Promise<ExecutionResult[]> {
  return AutomationEngine.processEvent({
    companyId,
    triggerType: 'PREVENTIVE_DUE',
    data: { template, machine, templateId: template.id, machineId: machine.id }
  });
}
