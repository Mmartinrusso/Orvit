import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { cookies } from 'next/headers'
import { verifyToken } from '@/lib/auth'

export const dynamic = 'force-dynamic'

interface Params {
  params: { id: string }
}

/**
 * GET /api/counters/[id]
 * Obtiene detalles de un contador específico
 */
export async function GET(request: Request, { params }: Params) {
  try {
    const counterId = parseInt(params.id)
    if (isNaN(counterId)) {
      return NextResponse.json({ error: 'Invalid counter ID' }, { status: 400 })
    }

    const counter = await prisma.machineCounter.findUnique({
      where: { id: counterId },
      include: {
        machine: { select: { id: true, name: true } },
        lastReadingBy: { select: { id: true, name: true } },
        triggers: {
          include: {
            checklist: { select: { id: true, title: true, frequency: true } }
          }
        },
        readings: {
          orderBy: { recordedAt: 'desc' },
          take: 20,
          include: {
            recordedBy: { select: { id: true, name: true } }
          }
        }
      }
    })

    if (!counter) {
      return NextResponse.json({ error: 'Counter not found' }, { status: 404 })
    }

    return NextResponse.json({ counter })
  } catch (error) {
    console.error('Error fetching counter:', error)
    return NextResponse.json(
      { error: 'Error fetching counter' },
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/counters/[id]
 * Actualiza un contador
 */
export async function PATCH(request: Request, { params }: Params) {
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
    const { name, unit, source } = body

    const updated = await prisma.machineCounter.update({
      where: { id: counterId },
      data: {
        ...(name && { name }),
        ...(unit && { unit }),
        ...(source && { source })
      }
    })

    return NextResponse.json({ success: true, counter: updated })
  } catch (error) {
    console.error('Error updating counter:', error)
    return NextResponse.json(
      { error: 'Error updating counter' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/counters/[id]
 * Elimina un contador
 */
export async function DELETE(request: Request, { params }: Params) {
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

    await prisma.machineCounter.delete({
      where: { id: counterId }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting counter:', error)
    return NextResponse.json(
      { error: 'Error deleting counter' },
      { status: 500 }
    )
  }
}
