import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCounterTriggerStatus } from '@/lib/maintenance/counter-trigger-checker'

export const dynamic = 'force-dynamic'

interface Params {
  params: { id: string }
}

/**
 * GET /api/counters/[id]/triggers
 * Lista los triggers de mantenimiento de un contador
 */
export async function GET(request: Request, { params }: Params) {
  try {
    const counterId = parseInt(params.id)
    if (isNaN(counterId)) {
      return NextResponse.json({ error: 'Invalid counter ID' }, { status: 400 })
    }

    const triggerStatus = await getCounterTriggerStatus(counterId)

    if (!triggerStatus) {
      return NextResponse.json({ error: 'Counter not found' }, { status: 404 })
    }

    return NextResponse.json({ triggers: triggerStatus })
  } catch (error) {
    console.error('Error fetching triggers:', error)
    return NextResponse.json(
      { error: 'Error fetching triggers' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/counters/[id]/triggers
 * Crea un nuevo trigger de mantenimiento para un contador
 */
export async function POST(request: Request, { params }: Params) {
  try {
    const counterId = parseInt(params.id)
    if (isNaN(counterId)) {
      return NextResponse.json({ error: 'Invalid counter ID' }, { status: 400 })
    }

    const counter = await prisma.machineCounter.findUnique({
      where: { id: counterId }
    })

    if (!counter) {
      return NextResponse.json({ error: 'Counter not found' }, { status: 404 })
    }

    const body = await request.json()
    const { checklistId, triggerEvery } = body

    if (!checklistId || !triggerEvery) {
      return NextResponse.json(
        { error: 'checklistId and triggerEvery are required' },
        { status: 400 }
      )
    }

    // Verificar que el checklist existe
    const checklist = await prisma.maintenanceChecklist.findUnique({
      where: { id: checklistId }
    })

    if (!checklist) {
      return NextResponse.json({ error: 'Checklist not found' }, { status: 404 })
    }

    // Verificar que no exista un trigger duplicado
    const existingTrigger = await prisma.counterMaintenanceTrigger.findFirst({
      where: {
        counterId,
        checklistId,
        isActive: true
      }
    })

    if (existingTrigger) {
      return NextResponse.json(
        { error: 'A trigger for this checklist already exists' },
        { status: 400 }
      )
    }

    const currentValue = Number(counter.currentValue)
    const nextTriggerValue = currentValue + Number(triggerEvery)

    const trigger = await prisma.counterMaintenanceTrigger.create({
      data: {
        counterId,
        checklistId,
        triggerEvery,
        lastTriggeredValue: currentValue,
        nextTriggerValue
      },
      include: {
        checklist: { select: { id: true, title: true } }
      }
    })

    return NextResponse.json({ success: true, trigger }, { status: 201 })
  } catch (error) {
    console.error('Error creating trigger:', error)
    return NextResponse.json(
      { error: 'Error creating trigger' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/counters/[id]/triggers
 * Elimina un trigger de mantenimiento
 */
export async function DELETE(request: Request, { params }: Params) {
  try {
    const { searchParams } = new URL(request.url)
    const triggerId = searchParams.get('triggerId')

    if (!triggerId) {
      return NextResponse.json({ error: 'triggerId is required' }, { status: 400 })
    }

    const trigger = await prisma.counterMaintenanceTrigger.findUnique({
      where: { id: parseInt(triggerId) }
    })

    if (!trigger) {
      return NextResponse.json({ error: 'Trigger not found' }, { status: 404 })
    }

    // Soft delete - desactivar en lugar de eliminar
    await prisma.counterMaintenanceTrigger.update({
      where: { id: parseInt(triggerId) },
      data: { isActive: false }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting trigger:', error)
    return NextResponse.json(
      { error: 'Error deleting trigger' },
      { status: 500 }
    )
  }
}
