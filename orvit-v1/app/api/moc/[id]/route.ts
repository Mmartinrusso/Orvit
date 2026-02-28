import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { cookies } from 'next/headers'
import { verifyToken } from '@/lib/auth'
import { requirePermission } from '@/lib/auth/shared-helpers'

export const dynamic = 'force-dynamic'

interface Params {
  params: Promise<{ id: string }>
}

/**
 * GET /api/moc/[id]
 * Obtiene los detalles de un MOC específico
 */
export async function GET(request: Request, { params }: Params) {
  try {
    const { id } = await params
    const mocId = parseInt(id)
    if (isNaN(mocId)) {
      return NextResponse.json({ error: 'Invalid MOC ID' }, { status: 400 })
    }

    const { user, error } = await requirePermission('moc.view')
    if (error) return error

    const moc = await prisma.managementOfChange.findUnique({
      where: { id: mocId },
      include: {
        machine: { select: { id: true, name: true } },
        component: { select: { id: true, name: true } },
        area: { select: { id: true, name: true } },
        sector: { select: { id: true, name: true } },
        requestedBy: { select: { id: true, name: true } },
        reviewedBy: { select: { id: true, name: true } },
        approvedBy: { select: { id: true, name: true } },
        implementedBy: { select: { id: true, name: true } },
        documents: {
          include: {
            uploadedBy: { select: { id: true, name: true } }
          },
          orderBy: { uploadedAt: 'desc' }
        },
        history: {
          include: {
            changedBy: { select: { id: true, name: true } }
          },
          orderBy: { changedAt: 'desc' }
        },
        tasks: {
          include: {
            assignedTo: { select: { id: true, name: true } },
            completedBy: { select: { id: true, name: true } }
          },
          orderBy: { sequence: 'asc' }
        }
      }
    })

    if (!moc) {
      return NextResponse.json({ error: 'MOC not found' }, { status: 404 })
    }

    return NextResponse.json({ moc })
  } catch (error) {
    console.error('Error fetching MOC:', error)
    return NextResponse.json(
      { error: 'Error fetching MOC' },
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/moc/[id]
 * Actualiza un MOC
 */
export async function PATCH(request: Request, { params }: Params) {
  try {
    const { id } = await params
    const mocId = parseInt(id)
    if (isNaN(mocId)) {
      return NextResponse.json({ error: 'Invalid MOC ID' }, { status: 400 })
    }

    const body = await request.json()

    // Determine required permission based on status change
    let permissionCheck
    if (body.status === 'UNDER_REVIEW' || body.status === 'PENDING_REVIEW') {
      permissionCheck = await requirePermission('moc.review')
    } else if (body.status === 'APPROVED') {
      permissionCheck = await requirePermission('moc.approve')
    } else if (body.status === 'IMPLEMENTING' || body.status === 'COMPLETED') {
      permissionCheck = await requirePermission('moc.implement')
    } else {
      permissionCheck = await requirePermission('moc.edit')
    }
    if (permissionCheck.error) return permissionCheck.error
    const user = permissionCheck.user!

    const moc = await prisma.managementOfChange.findUnique({
      where: { id: mocId }
    })

    if (!moc) {
      return NextResponse.json({ error: 'MOC not found' }, { status: 404 })
    }
    const {
      title,
      description,
      changeType,
      priority,
      status,
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
      actualStartDate,
      actualEndDate,
      isTemporary,
      temporaryUntil,
      requiresTraining,
      trainingCompleted,
      approvalNotes,
      rejectionReason
    } = body

    // Handle status change
    if (status && status !== moc.status) {
      const statusData: any = {
        status,
        updatedAt: new Date()
      }

      // Set appropriate user/date based on status
      if (status === 'UNDER_REVIEW') {
        statusData.reviewedById = user.id
      } else if (status === 'APPROVED') {
        statusData.approvedById = user.id
        statusData.approvalDate = new Date()
        statusData.approvalNotes = approvalNotes
      } else if (status === 'REJECTED') {
        statusData.rejectionReason = rejectionReason
      } else if (status === 'IMPLEMENTING') {
        statusData.actualStartDate = new Date()
      } else if (status === 'COMPLETED') {
        statusData.actualEndDate = new Date()
        statusData.implementedById = user.id
      }

      // Create history entry
      await prisma.mOCHistory.create({
        data: {
          mocId,
          fromStatus: moc.status,
          toStatus: status,
          changedById: user.id,
          notes: body.statusNotes || null
        }
      })
    }

    const updated = await prisma.managementOfChange.update({
      where: { id: mocId },
      data: {
        ...(title && { title }),
        ...(description && { description }),
        ...(changeType && { changeType }),
        ...(priority && { priority }),
        ...(status && { status }),
        ...(justification !== undefined && { justification }),
        ...(scope !== undefined && { scope }),
        ...(impactAssessment !== undefined && { impactAssessment }),
        ...(riskAssessment !== undefined && { riskAssessment }),
        ...(machineId !== undefined && { machineId }),
        ...(componentId !== undefined && { componentId }),
        ...(areaId !== undefined && { areaId }),
        ...(sectorId !== undefined && { sectorId }),
        ...(plannedStartDate !== undefined && { plannedStartDate: plannedStartDate ? new Date(plannedStartDate) : null }),
        ...(plannedEndDate !== undefined && { plannedEndDate: plannedEndDate ? new Date(plannedEndDate) : null }),
        ...(actualStartDate !== undefined && { actualStartDate: actualStartDate ? new Date(actualStartDate) : null }),
        ...(actualEndDate !== undefined && { actualEndDate: actualEndDate ? new Date(actualEndDate) : null }),
        ...(isTemporary !== undefined && { isTemporary }),
        ...(temporaryUntil !== undefined && { temporaryUntil: temporaryUntil ? new Date(temporaryUntil) : null }),
        ...(requiresTraining !== undefined && { requiresTraining }),
        ...(trainingCompleted !== undefined && { trainingCompleted }),
        ...(approvalNotes !== undefined && { approvalNotes }),
        ...(rejectionReason !== undefined && { rejectionReason })
      },
      include: {
        requestedBy: { select: { id: true, name: true } }
      }
    })

    return NextResponse.json({ success: true, moc: updated })
  } catch (error) {
    console.error('Error updating MOC:', error)
    return NextResponse.json(
      { error: 'Error updating MOC' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/moc/[id]
 * Elimina un MOC (solo si está en estado DRAFT o CANCELLED)
 */
export async function DELETE(request: Request, { params }: Params) {
  try {
    const { id } = await params
    const mocId = parseInt(id)
    if (isNaN(mocId)) {
      return NextResponse.json({ error: 'Invalid MOC ID' }, { status: 400 })
    }

    const { user, error } = await requirePermission('moc.delete')
    if (error) return error
    const companyId = user!.companyId

    const moc = await prisma.managementOfChange.findFirst({
      where: { id: mocId, companyId }
    })

    if (!moc) {
      return NextResponse.json({ error: 'MOC not found' }, { status: 404 })
    }

    // Only allow deletion of DRAFT or CANCELLED MOCs
    if (!['DRAFT', 'CANCELLED'].includes(moc.status)) {
      return NextResponse.json(
        { error: 'Only DRAFT or CANCELLED MOCs can be deleted' },
        { status: 400 }
      )
    }

    await prisma.managementOfChange.delete({
      where: { id: mocId }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting MOC:', error)
    return NextResponse.json(
      { error: 'Error deleting MOC' },
      { status: 500 }
    )
  }
}
