import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { cookies } from 'next/headers'
import { verifyToken } from '@/lib/auth'

export const dynamic = 'force-dynamic'

interface Params {
  params: { id: string }
}

/**
 * GET /api/machines/[id]/counters
 * Lista todos los contadores de una máquina
 */
export async function GET(request: Request, { params }: Params) {
  try {
    const machineId = parseInt(params.id)
    if (isNaN(machineId)) {
      return NextResponse.json({ error: 'Invalid machine ID' }, { status: 400 })
    }

    const machine = await prisma.machine.findUnique({
      where: { id: machineId },
      select: { id: true, name: true, companyId: true }
    })

    if (!machine) {
      return NextResponse.json({ error: 'Machine not found' }, { status: 404 })
    }

    const counters = await prisma.machineCounter.findMany({
      where: { machineId },
      include: {
        lastReadingBy: { select: { id: true, name: true } },
        triggers: {
          where: { isActive: true },
          include: {
            checklist: { select: { id: true, title: true } }
          }
        },
        readings: {
          orderBy: { recordedAt: 'desc' },
          take: 5,
          include: {
            recordedBy: { select: { id: true, name: true } }
          }
        }
      },
      orderBy: { name: 'asc' }
    })

    return NextResponse.json({
      machine: { id: machine.id, name: machine.name },
      counters
    })
  } catch (error) {
    console.error('Error fetching counters:', error)
    return NextResponse.json(
      { error: 'Error fetching counters' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/machines/[id]/counters
 * Crea un nuevo contador para una máquina
 */
export async function POST(request: Request, { params }: Params) {
  try {
    const machineId = parseInt(params.id)
    if (isNaN(machineId)) {
      return NextResponse.json({ error: 'Invalid machine ID' }, { status: 400 })
    }

    // Verificar autenticación
    const cookieStore = await cookies()
    const token = cookieStore.get('auth-token')?.value
    if (!token) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const payload = await verifyToken(token)
    if (!payload?.userId) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
    }

    const machine = await prisma.machine.findUnique({
      where: { id: machineId },
      select: { id: true, companyId: true }
    })

    if (!machine) {
      return NextResponse.json({ error: 'Machine not found' }, { status: 404 })
    }

    const body = await request.json()
    const { name, unit, initialValue, source } = body

    if (!name || !unit) {
      return NextResponse.json(
        { error: 'Name and unit are required' },
        { status: 400 }
      )
    }

    const counter = await prisma.machineCounter.create({
      data: {
        machineId,
        name,
        unit,
        currentValue: initialValue || 0,
        source: source || 'MANUAL',
        companyId: machine.companyId,
        lastReadingAt: initialValue ? new Date() : null,
        lastReadingById: initialValue ? payload.userId : null
      }
    })

    return NextResponse.json({ success: true, counter }, { status: 201 })
  } catch (error) {
    console.error('Error creating counter:', error)
    return NextResponse.json(
      { error: 'Error creating counter' },
      { status: 500 }
    )
  }
}
