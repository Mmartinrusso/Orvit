import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { cookies } from 'next/headers'
import { verifyToken } from '@/lib/auth'
import { requirePermission } from '@/lib/auth/shared-helpers'

export const dynamic = 'force-dynamic'

/**
 * GET /api/moc
 * Lista los MOC (Management of Change) de una empresa
 */
export async function GET(request: Request) {
  try {
    const { user, error } = await requirePermission('moc.view')
    if (error) return error
    const companyId = user!.companyId

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const machineId = searchParams.get('machineId')
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')

    const where: any = { companyId }

    if (status && status !== 'all') {
      where.status = status
    }

    if (machineId) {
      where.machineId = parseInt(machineId)
    }

    const [mocs, total] = await Promise.all([
      prisma.managementOfChange.findMany({
        where,
        include: {
          machine: { select: { id: true, name: true } },
          requestedBy: { select: { id: true, name: true } },
          approvedBy: { select: { id: true, name: true } },
          _count: {
            select: {
              tasks: true,
              documents: true
            }
          }
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset
      }),
      prisma.managementOfChange.count({ where })
    ])

    // Calculate summary
    const statusCounts = await prisma.managementOfChange.groupBy({
      by: ['status'],
      where: { companyId },
      _count: { id: true }
    })

    const summary = {
      total,
      draft: statusCounts.find(s => s.status === 'DRAFT')?._count?.id || 0,
      pendingReview: statusCounts.find(s => s.status === 'PENDING_REVIEW')?._count?.id || 0,
      underReview: statusCounts.find(s => s.status === 'UNDER_REVIEW')?._count?.id || 0,
      approved: statusCounts.find(s => s.status === 'APPROVED')?._count?.id || 0,
      implementing: statusCounts.find(s => s.status === 'IMPLEMENTING')?._count?.id || 0,
      completed: statusCounts.find(s => s.status === 'COMPLETED')?._count?.id || 0,
      rejected: statusCounts.find(s => s.status === 'REJECTED')?._count?.id || 0
    }

    return NextResponse.json({
      mocs,
      summary,
      pagination: { total, limit, offset }
    })
  } catch (error) {
    console.error('Error fetching MOCs:', error)
    return NextResponse.json(
      { error: 'Error fetching MOCs' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/moc
 * Crea un nuevo MOC
 */
export async function POST(request: Request) {
  try {
    const { user, error } = await requirePermission('moc.create')
    if (error) return error
    const companyId = user!.companyId

    const body = await request.json()
    const {
      title,
      description,
      changeType,
      priority,
      justification,
      scope,
      impactAssessment,
      riskAssessment,
      machineId,
      componentId,
      areaId,
      sectorId,
      plannedStartDate,
      plannedEndDate,
      isTemporary,
      temporaryUntil,
      requiresTraining
    } = body

    if (!title || !description || !changeType) {
      return NextResponse.json(
        { error: 'companyId, title, description, and changeType are required' },
        { status: 400 }
      )
    }

    // Generate MOC number
    const year = new Date().getFullYear()
    const count = await prisma.managementOfChange.count({
      where: {
        companyId,
        createdAt: {
          gte: new Date(`${year}-01-01`),
          lt: new Date(`${year + 1}-01-01`)
        }
      }
    })
    const mocNumber = `MOC-${year}-${String(count + 1).padStart(4, '0')}`

    const moc = await prisma.managementOfChange.create({
      data: {
        mocNumber,
        title,
        description,
        changeType,
        priority: priority || 'MEDIUM',
        status: 'DRAFT',
        justification,
        scope,
        impactAssessment,
        riskAssessment,
        machineId,
        componentId,
        areaId,
        sectorId,
        requestedById: user!.id,
        plannedStartDate: plannedStartDate ? new Date(plannedStartDate) : null,
        plannedEndDate: plannedEndDate ? new Date(plannedEndDate) : null,
        isTemporary: isTemporary || false,
        temporaryUntil: temporaryUntil ? new Date(temporaryUntil) : null,
        requiresTraining: requiresTraining || false,
        companyId
      },
      include: {
        requestedBy: { select: { id: true, name: true } }
      }
    })

    // Create initial history entry
    await prisma.mOCHistory.create({
      data: {
        mocId: moc.id,
        toStatus: 'DRAFT',
        changedById: user!.id,
        notes: 'MOC creado'
      }
    })

    return NextResponse.json({ success: true, moc }, { status: 201 })
  } catch (error) {
    console.error('Error creating MOC:', error)
    return NextResponse.json(
      { error: 'Error creating MOC' },
      { status: 500 }
    )
  }
}
