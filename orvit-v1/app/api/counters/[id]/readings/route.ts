import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { cookies } from 'next/headers'
import { verifyToken } from '@/lib/auth'
import { checkCounterTriggers } from '@/lib/maintenance/counter-trigger-checker'
import { requirePermission } from '@/lib/auth/shared-helpers'

export const dynamic = 'force-dynamic'

interface Params {
  params: Promise<{ id: string }>
}

/**
 * GET /api/counters/[id]/readings
 * Lista las lecturas de un contador
 */
export async function GET(request: Request, { params }: Params) {
  try {
    const { user, error } = await requirePermission('counters.view')
    if (error) return error

    const { id } = await params
    const counterId = parseInt(id)
    if (isNaN(counterId)) {
      return NextResponse.json({ error: 'Invalid counter ID' }, { status: 400 })
    }

    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')

    const counter = await prisma.machineCounter.findUnique({
      where: { id: counterId },
      select: { id: true, name: true, unit: true, currentValue: true }
    })

    if (!counter) {
      return NextResponse.json({ error: 'Counter not found' }, { status: 404 })
    }

    const readings = await prisma.machineCounterReading.findMany({
      where: { counterId },
      orderBy: { recordedAt: 'desc' },
      take: limit,
      skip: offset,
      include: {
        recordedBy: { select: { id: true, name: true } }
      }
    })

    const total = await prisma.machineCounterReading.count({
      where: { counterId }
    })

    return NextResponse.json({
      counter,
      readings,
      pagination: { total, limit, offset }
    })
  } catch (error) {
    console.error('Error fetching readings:', error)
    return NextResponse.json(
      { error: 'Error fetching readings' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/counters/[id]/readings
 * Registra una nueva lectura del contador
 */
export async function POST(request: Request, { params }: Params) {
  try {
    const { id } = await params
    const counterId = parseInt(id)
    if (isNaN(counterId)) {
      return NextResponse.json({ error: 'Invalid counter ID' }, { status: 400 })
    }

    const { user, error } = await requirePermission('counters.record_reading')
    if (error) return error

    const counter = await prisma.machineCounter.findUnique({
      where: { id: counterId }
    })

    if (!counter) {
      return NextResponse.json({ error: 'Counter not found' }, { status: 404 })
    }

    const body = await request.json()
    const { value, notes, source } = body

    if (value === undefined || value === null) {
      return NextResponse.json({ error: 'Value is required' }, { status: 400 })
    }

    const numericValue = parseFloat(value)
    if (isNaN(numericValue)) {
      return NextResponse.json({ error: 'Invalid value' }, { status: 400 })
    }

    // Validar que el valor no sea menor al actual (contadores solo incrementan)
    const currentValue = Number(counter.currentValue)
    if (numericValue < currentValue) {
      return NextResponse.json(
        { error: `Value cannot be less than current (${currentValue})` },
        { status: 400 }
      )
    }

    const delta = numericValue - currentValue

    // Crear la lectura en una transacción
    const result = await prisma.$transaction(async (tx) => {
      // Crear la lectura
      const reading = await tx.machineCounterReading.create({
        data: {
          counterId,
          value: numericValue,
          previousValue: currentValue,
          delta,
          recordedById: user!.id,
          source: source || 'MANUAL',
          notes
        }
      })

      // Actualizar el contador
      await tx.machineCounter.update({
        where: { id: counterId },
        data: {
          currentValue: numericValue,
          lastReadingAt: new Date(),
          lastReadingById: user!.id
        }
      })

      return reading
    })

    // Verificar triggers de mantenimiento (no bloquea respuesta)
    checkCounterTriggers(counterId, numericValue).catch(err => {
      console.error('Error checking counter triggers:', err)
    })

    return NextResponse.json({
      success: true,
      reading: result,
      delta
    }, { status: 201 })
  } catch (error) {
    console.error('Error creating reading:', error)
    return NextResponse.json(
      { error: 'Error creating reading' },
      { status: 500 }
    )
  }
}
