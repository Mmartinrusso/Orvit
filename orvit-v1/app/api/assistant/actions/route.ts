// ============================================
// API de Acciones del Asistente IA
// ============================================

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAssistantContext } from '@/lib/assistant/auth'
import { AssistantActionType, ActionResult } from '@/lib/assistant/types'
import { reindexEntity } from '@/lib/assistant/indexer'

export const dynamic = 'force-dynamic'

/**
 * POST /api/assistant/actions
 * Ejecuta una acción en el sistema
 */
export async function POST(request: NextRequest) {
  try {
    // 1. Verificar autenticación
    const context = await getAssistantContext()
    if (!context) {
      return NextResponse.json(
        { error: 'No autorizado' },
        { status: 401 }
      )
    }

    // 2. Parsear request
    const body = await request.json()
    const { actionType, actionData, confirmed } = body

    if (!actionType) {
      return NextResponse.json(
        { error: 'actionType es requerido' },
        { status: 400 }
      )
    }

    // 3. Si no está confirmado, generar preview
    if (!confirmed) {
      const preview = await generateActionPreview(actionType, actionData, context)
      return NextResponse.json({ preview })
    }

    // 4. Ejecutar la acción
    const result = await executeAction(actionType, actionData, context)

    // 5. Loggear la acción
    await prisma.assistantActionLog.create({
      data: {
        companyId: context.companyId,
        userId: context.userId,
        actionType,
        actionData,
        success: result.success,
        resultData: result,
        entityType: result.entityType,
        entityId: result.entityId,
        errorMessage: result.error,
      },
    })

    // 6. Reindexar la entidad afectada
    if (result.success && result.entityType && result.entityId) {
      try {
        await reindexEntity(result.entityType as any, result.entityId, context.companyId)
      } catch (indexError) {
        console.warn('Error reindexando entidad:', indexError)
      }
    }

    return NextResponse.json(result)
  } catch (error) {
    console.error('Error ejecutando acción:', error)
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}

/**
 * GET /api/assistant/actions
 * Obtiene el historial de acciones
 */
export async function GET(request: NextRequest) {
  try {
    const context = await getAssistantContext()
    if (!context) {
      return NextResponse.json(
        { error: 'No autorizado' },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '20')

    const actions = await prisma.assistantActionLog.findMany({
      where: { userId: context.userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    })

    return NextResponse.json({ actions })
  } catch (error) {
    console.error('Error obteniendo historial:', error)
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}

// ============================================
// Generador de previews
// ============================================

interface ActionContext {
  userId: number
  companyId: number
  userRole: string
}

async function generateActionPreview(
  actionType: AssistantActionType,
  data: Record<string, any>,
  context: ActionContext
) {
  switch (actionType) {
    case 'create_work_order':
      return generateWorkOrderPreview(data, context)

    case 'create_failure':
      return generateFailurePreview(data, context)

    case 'create_preventive':
      return generatePreventivePreview(data, context)

    case 'assign_work_order':
      return generateAssignPreview(data, context)

    default:
      return {
        description: `Acción: ${actionType}`,
        data,
        canExecute: false,
        warnings: ['Tipo de acción no implementado aún'],
      }
  }
}

async function generateWorkOrderPreview(data: any, context: ActionContext) {
  const warnings: string[] = []
  const missingFields: string[] = []

  // Validar campos requeridos
  if (!data.title && !data.description) {
    missingFields.push('título o descripción')
  }

  // Resolver máquina si se proporcionó nombre
  let machine = null
  if (data.machineName || data.machineId) {
    if (data.machineId) {
      machine = await prisma.machine.findUnique({ where: { id: data.machineId } })
    } else if (data.machineName) {
      machine = await prisma.machine.findFirst({
        where: {
          companyId: context.companyId,
          name: { contains: data.machineName, mode: 'insensitive' },
        },
      })
    }

    if (!machine) {
      warnings.push(`No se encontró la máquina "${data.machineName || data.machineId}"`)
    }
  }

  // Resolver usuario asignado
  let assignedTo = null
  if (data.assignedToName || data.assignedToId) {
    if (data.assignedToId) {
      assignedTo = await prisma.user.findUnique({ where: { id: data.assignedToId } })
    } else if (data.assignedToName) {
      assignedTo = await prisma.user.findFirst({
        where: {
          name: { contains: data.assignedToName, mode: 'insensitive' },
        },
      })
    }
  }

  const preview = {
    title: data.title || `OT - ${data.description?.substring(0, 50) || 'Sin título'}`,
    description: data.description || '',
    type: data.type || 'CORRECTIVE',
    priority: data.priority || 'MEDIUM',
    machine: machine ? { id: machine.id, name: machine.name } : null,
    assignedTo: assignedTo ? { id: assignedTo.id, name: assignedTo.name } : null,
  }

  return {
    description: 'Crear nueva Orden de Trabajo',
    data: preview,
    canExecute: missingFields.length === 0,
    missingFields,
    warnings,
  }
}

async function generateFailurePreview(data: any, context: ActionContext) {
  const warnings: string[] = []
  const missingFields: string[] = []

  if (!data.description) {
    missingFields.push('descripción')
  }

  // Resolver máquina
  let machine = null
  if (data.machineName || data.machineId) {
    machine = data.machineId
      ? await prisma.machine.findUnique({ where: { id: data.machineId } })
      : await prisma.machine.findFirst({
          where: {
            companyId: context.companyId,
            name: { contains: data.machineName, mode: 'insensitive' },
          },
        })

    if (!machine) {
      warnings.push(`No se encontró la máquina`)
    }
  } else {
    missingFields.push('máquina')
  }

  const preview = {
    description: data.description || '',
    symptoms: data.symptoms || '',
    severity: data.severity || 'MEDIUM',
    machine: machine ? { id: machine.id, name: machine.name } : null,
  }

  return {
    description: 'Reportar nueva Falla',
    data: preview,
    canExecute: missingFields.length === 0,
    missingFields,
    warnings,
  }
}

async function generatePreventivePreview(data: any, context: ActionContext) {
  const warnings: string[] = []
  const missingFields: string[] = []

  if (!data.title && !data.description) {
    missingFields.push('título o descripción')
  }
  if (!data.frequency) {
    missingFields.push('frecuencia')
  }

  // Resolver máquinas si se proporcionó
  let machines: any[] = []
  if (data.machineIds && Array.isArray(data.machineIds)) {
    machines = await prisma.machine.findMany({
      where: {
        companyId: context.companyId,
        id: { in: data.machineIds },
      },
    })
  } else if (data.machineType) {
    machines = await prisma.machine.findMany({
      where: {
        companyId: context.companyId,
        name: { contains: data.machineType, mode: 'insensitive' },
      },
      take: 10,
    })
  }

  const preview = {
    title: data.title || data.description?.substring(0, 50) || 'Tarea preventiva',
    description: data.description || '',
    frequency: data.frequency || 'MONTHLY',
    machines: machines.map(m => ({ id: m.id, name: m.name })),
    taskCount: machines.length || 1,
  }

  return {
    description: `Crear ${preview.taskCount} tarea(s) preventiva(s)`,
    data: preview,
    canExecute: missingFields.length === 0 && machines.length > 0,
    missingFields,
    warnings: machines.length === 0 ? ['No se encontraron máquinas'] : warnings,
  }
}

async function generateAssignPreview(data: any, context: ActionContext) {
  const warnings: string[] = []
  const missingFields: string[] = []

  if (!data.workOrderId) {
    missingFields.push('ID de orden de trabajo')
  }
  if (!data.assignedToId && !data.assignedToName) {
    missingFields.push('usuario a asignar')
  }

  // Obtener OT
  let workOrder = null
  if (data.workOrderId) {
    workOrder = await prisma.workOrder.findUnique({
      where: { id: data.workOrderId },
      include: { machine: true, assignedTo: true },
    })
    if (!workOrder) {
      warnings.push('Orden de trabajo no encontrada')
    }
  }

  // Obtener usuario
  let user = null
  if (data.assignedToId) {
    user = await prisma.user.findUnique({ where: { id: data.assignedToId } })
  } else if (data.assignedToName) {
    user = await prisma.user.findFirst({
      where: { name: { contains: data.assignedToName, mode: 'insensitive' } },
    })
  }

  const preview = {
    workOrder: workOrder ? {
      id: workOrder.id,
      title: workOrder.title,
      currentAssignee: workOrder.assignedTo?.name || 'Sin asignar',
    } : null,
    newAssignee: user ? { id: user.id, name: user.name } : null,
  }

  return {
    description: 'Asignar Orden de Trabajo',
    data: preview,
    canExecute: workOrder !== null && user !== null,
    missingFields,
    warnings,
  }
}

// ============================================
// Ejecutor de acciones
// ============================================

async function executeAction(
  actionType: AssistantActionType,
  data: Record<string, any>,
  context: ActionContext
): Promise<ActionResult & { entityType?: string; entityId?: number }> {
  switch (actionType) {
    case 'create_work_order':
      return executeCreateWorkOrder(data, context)

    case 'create_failure':
      return executeCreateFailure(data, context)

    case 'create_preventive':
      return executeCreatePreventive(data, context)

    case 'assign_work_order':
      return executeAssignWorkOrder(data, context)

    case 'add_note':
      return executeAddNote(data, context)

    default:
      return {
        success: false,
        message: 'Tipo de acción no implementado',
        error: `Acción ${actionType} no soportada`,
      }
  }
}

async function executeCreateWorkOrder(data: any, context: ActionContext) {
  try {
    const workOrder = await prisma.workOrder.create({
      data: {
        companyId: context.companyId,
        title: data.title || `OT - ${new Date().toLocaleDateString('es-AR')}`,
        description: data.description || '',
        type: data.type || 'CORRECTIVE',
        priority: data.priority || 'MEDIUM',
        status: 'PENDING',
        machineId: data.machineId || null,
        assignedToId: data.assignedToId || null,
        createdById: context.userId,
      },
    })

    return {
      success: true,
      entityId: workOrder.id,
      entityType: 'work_order',
      entityUrl: `/mantenimiento/ordenes-trabajo/${workOrder.id}`,
      message: `Orden de trabajo #${workOrder.id} creada correctamente`,
    }
  } catch (error) {
    console.error('Error creando OT:', error)
    return {
      success: false,
      message: 'Error al crear la orden de trabajo',
      error: String(error),
    }
  }
}

async function executeCreateFailure(data: any, context: ActionContext) {
  try {
    const failure = await prisma.failureOccurrence.create({
      data: {
        companyId: context.companyId,
        description: data.description,
        symptoms: data.symptoms || null,
        severity: data.severity || 'MEDIUM',
        status: 'OPEN',
        machineId: data.machineId,
        reportedById: context.userId,
      },
    })

    return {
      success: true,
      entityId: failure.id,
      entityType: 'failure_occurrence',
      entityUrl: `/mantenimiento/fallas/${failure.id}`,
      message: `Falla #${failure.id} reportada correctamente`,
    }
  } catch (error) {
    console.error('Error creando falla:', error)
    return {
      success: false,
      message: 'Error al reportar la falla',
      error: String(error),
    }
  }
}

async function executeCreatePreventive(data: any, context: ActionContext) {
  try {
    const machineIds = data.machineIds || (data.machineId ? [data.machineId] : [])
    const createdTasks: any[] = []

    for (const machineId of machineIds) {
      const task = await prisma.fixedTask.create({
        data: {
          companyId: context.companyId,
          title: data.title || 'Tarea preventiva',
          description: data.description || '',
          frequency: data.frequency || 'MONTHLY',
          machineId: machineId,
          assignedToId: data.assignedToId || null,
          createdById: context.userId,
          status: 'ACTIVE',
        },
      })
      createdTasks.push(task)
    }

    if (createdTasks.length === 0) {
      // Crear sin máquina
      const task = await prisma.fixedTask.create({
        data: {
          companyId: context.companyId,
          title: data.title || 'Tarea preventiva',
          description: data.description || '',
          frequency: data.frequency || 'MONTHLY',
          assignedToId: data.assignedToId || null,
          createdById: context.userId,
          status: 'ACTIVE',
        },
      })
      createdTasks.push(task)
    }

    return {
      success: true,
      entityId: createdTasks[0]?.id,
      entityType: 'fixed_task',
      entityUrl: '/mantenimiento/preventivo',
      message: `${createdTasks.length} tarea(s) preventiva(s) creada(s) correctamente`,
    }
  } catch (error) {
    console.error('Error creando preventivo:', error)
    return {
      success: false,
      message: 'Error al crear la tarea preventiva',
      error: String(error),
    }
  }
}

async function executeAssignWorkOrder(data: any, context: ActionContext) {
  try {
    const workOrder = await prisma.workOrder.update({
      where: { id: data.workOrderId },
      data: { assignedToId: data.assignedToId },
    })

    return {
      success: true,
      entityId: workOrder.id,
      entityType: 'work_order',
      entityUrl: `/mantenimiento/ordenes-trabajo/${workOrder.id}`,
      message: `Orden de trabajo #${workOrder.id} asignada correctamente`,
    }
  } catch (error) {
    console.error('Error asignando OT:', error)
    return {
      success: false,
      message: 'Error al asignar la orden de trabajo',
      error: String(error),
    }
  }
}

async function executeAddNote(data: any, context: ActionContext) {
  try {
    // Agregar nota/comentario a una OT
    if (data.workOrderId) {
      const comment = await prisma.workOrderComment.create({
        data: {
          workOrderId: data.workOrderId,
          authorId: context.userId,
          content: data.content || data.note,
        },
      })

      return {
        success: true,
        entityId: comment.id,
        entityType: 'work_order',
        entityUrl: `/mantenimiento/ordenes-trabajo/${data.workOrderId}`,
        message: 'Nota agregada correctamente',
      }
    }

    return {
      success: false,
      message: 'Se requiere workOrderId para agregar nota',
    }
  } catch (error) {
    console.error('Error agregando nota:', error)
    return {
      success: false,
      message: 'Error al agregar la nota',
      error: String(error),
    }
  }
}
