import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

interface Params {
  params: { code: string }
}

/**
 * GET /api/qr/[code]
 * Busca una máquina por su código QR (slug o id)
 */
export async function GET(request: Request, { params }: Params) {
  try {
    const code = params.code

    // Buscar por slug primero
    let machine = await prisma.machine.findFirst({
      where: { slug: code },
      include: {
        company: { select: { id: true, name: true } },
        area: { select: { id: true, name: true } },
        sector: { select: { id: true, name: true } }
      }
    })

    // Si no se encuentra por slug, intentar por ID (formato machine-{id})
    if (!machine && code.startsWith('machine-')) {
      const machineId = parseInt(code.replace('machine-', ''))
      if (!isNaN(machineId)) {
        machine = await prisma.machine.findUnique({
          where: { id: machineId },
          include: {
            company: { select: { id: true, name: true } },
            area: { select: { id: true, name: true } },
            sector: { select: { id: true, name: true } }
          }
        })
      }
    }

    if (!machine) {
      return NextResponse.json({ error: 'Machine not found' }, { status: 404 })
    }

    // Obtener estadísticas básicas
    const [activeWOs, recentFailures] = await Promise.all([
      prisma.workOrder.count({
        where: {
          machineId: machine.id,
          status: { in: ['PENDING', 'IN_PROGRESS'] }
        }
      }),
      prisma.failureOccurrence.count({
        where: {
          machineId: machine.id,
          reportedAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }
        }
      })
    ])

    return NextResponse.json({
      machine: {
        id: machine.id,
        name: machine.name,
        assetCode: machine.assetCode,
        status: machine.status,
        healthScore: machine.healthScore,
        company: machine.company,
        area: machine.area,
        sector: machine.sector
      },
      stats: {
        activeWorkOrders: activeWOs,
        recentFailures
      }
    })
  } catch (error) {
    console.error('Error fetching machine by QR:', error)
    return NextResponse.json(
      { error: 'Error fetching machine' },
      { status: 500 }
    )
  }
}
