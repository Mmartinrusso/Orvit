import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyAuth } from '@/lib/auth'
import {
  calculateHealthScore,
  updateMachineHealthScore,
  calculateCriticalityScore,
  getHealthBadge,
  type HealthScoreFactors
} from '@/lib/maintenance/health-score-calculator'

export const dynamic = 'force-dynamic'

interface Params {
  params: { id: string }
}

/**
 * GET /api/machines/[id]/health-score
 * Obtiene el health score actual y detalles de una máquina
 */
export async function GET(request: NextRequest, { params }: Params) {
  try {
    const auth = await verifyAuth(request)
    if (!auth) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const machineId = parseInt(params.id)

    if (isNaN(machineId)) {
      return NextResponse.json({ error: 'Invalid machine ID' }, { status: 400 })
    }

    const machine = await prisma.machine.findUnique({
      where: { id: machineId },
      select: {
        id: true,
        name: true,
        companyId: true,
        healthScore: true,
        healthScoreUpdatedAt: true,
        criticalityScore: true,
        criticalityProduction: true,
        criticalitySafety: true,
        criticalityQuality: true,
        criticalityCost: true
      }
    })

    if (!machine) {
      return NextResponse.json({ error: 'Machine not found' }, { status: 404 })
    }

    if (machine.companyId !== auth.companyId) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
    }

    // Calcular factores del health score
    const healthFactors = await calculateHealthScore(machineId)
    const badge = getHealthBadge(healthFactors.totalScore)

    return NextResponse.json({
      machine: {
        id: machine.id,
        name: machine.name
      },
      healthScore: {
        current: machine.healthScore,
        calculated: healthFactors.totalScore,
        updatedAt: machine.healthScoreUpdatedAt,
        badge
      },
      factors: healthFactors,
      criticality: {
        total: machine.criticalityScore,
        production: machine.criticalityProduction,
        safety: machine.criticalitySafety,
        quality: machine.criticalityQuality,
        cost: machine.criticalityCost
      }
    })
  } catch (error) {
    console.error('Error fetching health score:', error)
    return NextResponse.json(
      { error: 'Error fetching health score' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/machines/[id]/health-score
 * Recalcula y actualiza el health score de una máquina
 */
export async function POST(request: NextRequest, { params }: Params) {
  try {
    const auth = await verifyAuth(request)
    if (!auth) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const machineId = parseInt(params.id)

    if (isNaN(machineId)) {
      return NextResponse.json({ error: 'Invalid machine ID' }, { status: 400 })
    }

    const machine = await prisma.machine.findUnique({
      where: { id: machineId },
      select: { id: true, companyId: true }
    })

    if (!machine) {
      return NextResponse.json({ error: 'Machine not found' }, { status: 404 })
    }

    if (machine.companyId !== auth.companyId) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
    }

    // Recalcular y actualizar
    const healthFactors = await updateMachineHealthScore(machineId)
    const badge = getHealthBadge(healthFactors.totalScore)

    return NextResponse.json({
      success: true,
      healthScore: healthFactors.totalScore,
      badge,
      factors: healthFactors,
      updatedAt: new Date().toISOString()
    })
  } catch (error) {
    console.error('Error updating health score:', error)
    return NextResponse.json(
      { error: 'Error updating health score' },
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/machines/[id]/health-score
 * Actualiza la criticidad de una máquina
 */
export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    const auth = await verifyAuth(request)
    if (!auth) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const machineId = parseInt(params.id)
    const body = await request.json()

    if (isNaN(machineId)) {
      return NextResponse.json({ error: 'Invalid machine ID' }, { status: 400 })
    }

    // Verificar que la máquina pertenece a la empresa del usuario
    const machine = await prisma.machine.findUnique({
      where: { id: machineId },
      select: { id: true, companyId: true }
    })

    if (!machine) {
      return NextResponse.json({ error: 'Machine not found' }, { status: 404 })
    }

    if (machine.companyId !== auth.companyId) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
    }

    const { production, safety, quality, cost } = body

    // Validar valores (1-10)
    const validate = (v: any) => v === null || v === undefined || (typeof v === 'number' && v >= 1 && v <= 10)
    if (!validate(production) || !validate(safety) || !validate(quality) || !validate(cost)) {
      return NextResponse.json(
        { error: 'Criticality values must be between 1 and 10' },
        { status: 400 }
      )
    }

    // Calcular score total
    const criticalityScore = calculateCriticalityScore(production, safety, quality, cost)

    const updated = await prisma.machine.update({
      where: { id: machineId },
      data: {
        criticalityProduction: production,
        criticalitySafety: safety,
        criticalityQuality: quality,
        criticalityCost: cost,
        criticalityScore
      },
      select: {
        id: true,
        criticalityScore: true,
        criticalityProduction: true,
        criticalitySafety: true,
        criticalityQuality: true,
        criticalityCost: true
      }
    })

    return NextResponse.json({
      success: true,
      criticality: {
        total: updated.criticalityScore,
        production: updated.criticalityProduction,
        safety: updated.criticalitySafety,
        quality: updated.criticalityQuality,
        cost: updated.criticalityCost
      }
    })
  } catch (error) {
    console.error('Error updating criticality:', error)
    return NextResponse.json(
      { error: 'Error updating criticality' },
      { status: 500 }
    )
  }
}
