/**
 * Counter Trigger Checker
 * Verifica si una lectura de contador debe disparar un PM basado en uso
 */

import { prisma } from '@/lib/prisma'

export interface TriggerResult {
  triggerId: number
  checklistId: number
  checklistTitle: string
  triggered: boolean
  workOrderId?: number
  message: string
}

/**
 * Verifica los triggers de un contador específico y genera OTs si corresponde
 */
export async function checkCounterTriggers(
  counterId: number,
  currentValue: number
): Promise<TriggerResult[]> {
  const results: TriggerResult[] = []

  const triggers = await prisma.counterMaintenanceTrigger.findMany({
    where: {
      counterId,
      isActive: true
    },
    include: {
      counter: {
        include: {
          machine: { select: { id: true, name: true, companyId: true } }
        }
      },
      checklist: { select: { id: true, title: true } }
    }
  })

  for (const trigger of triggers) {
    const nextTriggerValue = Number(trigger.nextTriggerValue || 0)
    const lastTriggeredValue = Number(trigger.lastTriggeredValue || 0)
    const triggerEvery = Number(trigger.triggerEvery)

    // Calcular el próximo valor de trigger si no está definido
    let effectiveNextTrigger = nextTriggerValue
    if (!nextTriggerValue || nextTriggerValue <= lastTriggeredValue) {
      effectiveNextTrigger = lastTriggeredValue + triggerEvery
    }

    // Verificar si debemos disparar
    if (currentValue >= effectiveNextTrigger) {
      try {
        // Crear OT de mantenimiento
        const workOrder = await prisma.workOrder.create({
          data: {
            title: `PM por uso: ${trigger.checklist.title}`,
            description: `Mantenimiento preventivo basado en uso del contador "${trigger.counter.name}". Valor actual: ${currentValue} ${trigger.counter.unit}. Trigger: cada ${triggerEvery} ${trigger.counter.unit}.`,
            type: 'PREVENTIVE',
            priority: 'MEDIUM',
            status: 'PENDING',
            machineId: trigger.counter.machineId,
            companyId: trigger.counter.machine.companyId,
            createdById: 1, // Sistema
            scheduledDate: new Date()
          }
        })

        // Calcular nuevo próximo trigger (puede haber múltiples triggers acumulados)
        let newNextTrigger = effectiveNextTrigger + triggerEvery
        while (currentValue >= newNextTrigger) {
          newNextTrigger += triggerEvery
        }

        // Actualizar el trigger
        await prisma.counterMaintenanceTrigger.update({
          where: { id: trigger.id },
          data: {
            lastTriggeredValue: currentValue,
            nextTriggerValue: newNextTrigger
          }
        })

        results.push({
          triggerId: trigger.id,
          checklistId: trigger.checklist.id,
          checklistTitle: trigger.checklist.title,
          triggered: true,
          workOrderId: workOrder.id,
          message: `OT #${workOrder.id} creada para ${trigger.checklist.title}`
        })

        console.log(`Counter trigger: OT #${workOrder.id} created for checklist "${trigger.checklist.title}" on machine "${trigger.counter.machine.name}"`)
      } catch (error) {
        console.error(`Error creating WO for trigger ${trigger.id}:`, error)
        results.push({
          triggerId: trigger.id,
          checklistId: trigger.checklist.id,
          checklistTitle: trigger.checklist.title,
          triggered: false,
          message: `Error al crear OT: ${error}`
        })
      }
    } else {
      results.push({
        triggerId: trigger.id,
        checklistId: trigger.checklist.id,
        checklistTitle: trigger.checklist.title,
        triggered: false,
        message: `No activado. Próximo trigger en ${effectiveNextTrigger} ${trigger.counter.unit}`
      })
    }
  }

  return results
}

/**
 * Verifica todos los triggers de todos los contadores de una empresa
 * Usado por el cron job
 */
export async function checkAllCounterTriggers(companyId: number): Promise<{
  countersChecked: number
  triggersActivated: number
  workOrdersCreated: number[]
}> {
  const counters = await prisma.machineCounter.findMany({
    where: { companyId },
    select: { id: true, currentValue: true }
  })

  let triggersActivated = 0
  const workOrdersCreated: number[] = []

  for (const counter of counters) {
    const results = await checkCounterTriggers(counter.id, Number(counter.currentValue))

    for (const result of results) {
      if (result.triggered && result.workOrderId) {
        triggersActivated++
        workOrdersCreated.push(result.workOrderId)
      }
    }
  }

  return {
    countersChecked: counters.length,
    triggersActivated,
    workOrdersCreated
  }
}

/**
 * Obtiene el estado de triggers de un contador
 */
export async function getCounterTriggerStatus(counterId: number) {
  const counter = await prisma.machineCounter.findUnique({
    where: { id: counterId },
    include: {
      triggers: {
        where: { isActive: true },
        include: {
          checklist: { select: { id: true, title: true } }
        }
      }
    }
  })

  if (!counter) return null

  const currentValue = Number(counter.currentValue)

  return counter.triggers.map(trigger => {
    const triggerEvery = Number(trigger.triggerEvery)
    const lastTriggeredValue = Number(trigger.lastTriggeredValue || 0)
    const nextTriggerValue = Number(trigger.nextTriggerValue || lastTriggeredValue + triggerEvery)

    const unitsUntilTrigger = nextTriggerValue - currentValue
    const progressPercent = Math.min(100, ((currentValue - lastTriggeredValue) / triggerEvery) * 100)

    return {
      triggerId: trigger.id,
      checklistId: trigger.checklistId,
      checklistTitle: trigger.checklist.title,
      triggerEvery,
      lastTriggeredValue,
      nextTriggerValue,
      currentValue,
      unitsUntilTrigger,
      progressPercent: Math.round(progressPercent),
      isNearTrigger: unitsUntilTrigger <= triggerEvery * 0.1 // Dentro del 10% del trigger
    }
  })
}
