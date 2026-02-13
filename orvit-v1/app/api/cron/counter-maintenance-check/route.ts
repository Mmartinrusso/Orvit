import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { checkAllCounterTriggers } from '@/lib/maintenance/counter-trigger-checker'

export const dynamic = 'force-dynamic'

/**
 * GET /api/cron/counter-maintenance-check
 * Verifica todos los triggers de contadores y genera OTs si corresponde
 * Debe ejecutarse periódicamente (ej: cada 15 minutos)
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

    const results: {
      companyId: number
      companyName: string
      countersChecked: number
      triggersActivated: number
      workOrdersCreated: number[]
    }[] = []

    let totalTriggersActivated = 0
    let totalWorkOrdersCreated = 0

    for (const company of companies) {
      const result = await checkAllCounterTriggers(company.id)
      results.push({
        companyId: company.id,
        companyName: company.name,
        ...result
      })
      totalTriggersActivated += result.triggersActivated
      totalWorkOrdersCreated += result.workOrdersCreated.length
    }

    return NextResponse.json({
      success: true,
      companiesProcessed: companies.length,
      totalTriggersActivated,
      totalWorkOrdersCreated,
      details: results,
      executedAt: new Date().toISOString()
    })
  } catch (error) {
    console.error('Error in counter maintenance check cron:', error)
    return NextResponse.json(
      { error: 'Error checking counter triggers' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/cron/counter-maintenance-check
 * Verifica triggers de contadores de una empresa específica
 */
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { companyId } = body

    if (!companyId) {
      return NextResponse.json({ error: 'companyId is required' }, { status: 400 })
    }

    const result = await checkAllCounterTriggers(companyId)

    return NextResponse.json({
      success: true,
      companyId,
      ...result,
      executedAt: new Date().toISOString()
    })
  } catch (error) {
    console.error('Error checking counter triggers:', error)
    return NextResponse.json(
      { error: 'Error checking counter triggers' },
      { status: 500 }
    )
  }
}
