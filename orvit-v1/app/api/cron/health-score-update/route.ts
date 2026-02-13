import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { updateAllMachinesHealthScore } from '@/lib/maintenance/health-score-calculator'

export const dynamic = 'force-dynamic'

/**
 * GET /api/cron/health-score-update
 * Actualiza el health score de todas las máquinas activas
 * Debe ejecutarse periódicamente (ej: cada 24h)
 */
export async function GET(request: Request) {
  try {
    // Verificar cron secret si está configurado
    const authHeader = request.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Obtener todas las empresas activas
    const companies = await prisma.company.findMany({
      where: { isActive: true },
      select: { id: true, name: true }
    })

    const results: { companyId: number; companyName: string; updated: number }[] = []

    for (const company of companies) {
      const updated = await updateAllMachinesHealthScore(company.id)
      results.push({
        companyId: company.id,
        companyName: company.name,
        updated
      })
    }

    const totalUpdated = results.reduce((sum, r) => sum + r.updated, 0)

    return NextResponse.json({
      success: true,
      totalMachinesUpdated: totalUpdated,
      companiesProcessed: companies.length,
      details: results,
      executedAt: new Date().toISOString()
    })
  } catch (error) {
    console.error('Error in health score cron:', error)
    return NextResponse.json(
      { error: 'Error updating health scores' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/cron/health-score-update
 * Actualiza health scores de una empresa específica
 */
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { companyId } = body

    if (!companyId) {
      return NextResponse.json({ error: 'companyId is required' }, { status: 400 })
    }

    const updated = await updateAllMachinesHealthScore(companyId)

    return NextResponse.json({
      success: true,
      companyId,
      machinesUpdated: updated,
      executedAt: new Date().toISOString()
    })
  } catch (error) {
    console.error('Error updating health scores:', error)
    return NextResponse.json(
      { error: 'Error updating health scores' },
      { status: 500 }
    )
  }
}
