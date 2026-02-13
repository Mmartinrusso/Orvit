import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { cookies } from 'next/headers'
import { verifyToken } from '@/lib/auth'

export const dynamic = 'force-dynamic'

interface Params {
  params: { id: string }
}

/**
 * GET /api/moc/[id]/tasks
 * Lista las tareas de un MOC
 */
export async function GET(request: Request, { params }: Params) {
  try {
    const mocId = parseInt(params.id)
    if (isNaN(mocId)) {
      return NextResponse.json({ error: 'Invalid MOC ID' }, { status: 400 })
    }

    const tasks = await prisma.mOCTask.findMany({
      where: { mocId },
      include: {
        assignedTo: { select: { id: true, name: true } },
        completedBy: { select: { id: true, name: true } }
      },
      orderBy: { sequence: 'asc' }
    })

    const summary = {
      total: tasks.length,
      pending: tasks.filter(t => t.status === 'PENDING').length,
      inProgress: tasks.filter(t => t.status === 'IN_PROGRESS').length,
      completed: tasks.filter(t => t.status === 'COMPLETED').length,
      skipped: tasks.filter(t => t.status === 'SKIPPED').length
    }

    return NextResponse.json({ tasks, summary })
  } catch (error) {
    console.error('Error fetching MOC tasks:', error)
    return NextResponse.json(
      { error: 'Error fetching tasks' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/moc/[id]/tasks
 * Crea una nueva tarea para un MOC
 */
export async function POST(request: Request, { params }: Params) {
  try {
    const mocId = parseInt(params.id)
    if (isNaN(mocId)) {
      return NextResponse.json({ error: 'Invalid MOC ID' }, { status: 400 })
    }

    const moc = await prisma.managementOfChange.findUnique({
      where: { id: mocId }
    })

    if (!moc) {
      return NextResponse.json({ error: 'MOC not found' }, { status: 404 })
    }

    const body = await request.json()
    const { title, description, assignedToId, dueDate, sequence } = body

    if (!title) {
      return NextResponse.json({ error: 'Title is required' }, { status: 400 })
    }

    // Get max sequence if not provided
    let taskSequence = sequence
    if (taskSequence === undefined) {
      const maxSeq = await prisma.mOCTask.findFirst({
        where: { mocId },
        orderBy: { sequence: 'desc' },
        select: { sequence: true }
      })
      taskSequence = (maxSeq?.sequence || 0) + 1
    }

    const task = await prisma.mOCTask.create({
      data: {
        mocId,
        title,
        description,
        sequence: taskSequence,
        assignedToId,
        dueDate: dueDate ? new Date(dueDate) : null
      },
      include: {
        assignedTo: { select: { id: true, name: true } }
      }
    })

    return NextResponse.json({ success: true, task }, { status: 201 })
  } catch (error) {
    console.error('Error creating MOC task:', error)
    return NextResponse.json(
      { error: 'Error creating task' },
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/moc/[id]/tasks
 * Actualiza una tarea de MOC
 */
export async function PATCH(request: Request, { params }: Params) {
  try {
    const { searchParams } = new URL(request.url)
    const taskId = searchParams.get('taskId')

    if (!taskId) {
      return NextResponse.json({ error: 'taskId is required' }, { status: 400 })
    }

    const cookieStore = await cookies()
    const token = cookieStore.get('auth-token')?.value
    if (!token) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const payload = await verifyToken(token)
    if (!payload?.userId) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
    }

    const task = await prisma.mOCTask.findUnique({
      where: { id: parseInt(taskId) }
    })

    if (!task) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 })
    }

    const body = await request.json()
    const { title, description, status, assignedToId, dueDate, notes } = body

    const updateData: any = {}

    if (title) updateData.title = title
    if (description !== undefined) updateData.description = description
    if (assignedToId !== undefined) updateData.assignedToId = assignedToId
    if (dueDate !== undefined) updateData.dueDate = dueDate ? new Date(dueDate) : null
    if (notes !== undefined) updateData.notes = notes

    if (status) {
      updateData.status = status
      if (status === 'COMPLETED') {
        updateData.completedAt = new Date()
        updateData.completedById = payload.userId
      }
    }

    const updated = await prisma.mOCTask.update({
      where: { id: parseInt(taskId) },
      data: updateData,
      include: {
        assignedTo: { select: { id: true, name: true } },
        completedBy: { select: { id: true, name: true } }
      }
    })

    return NextResponse.json({ success: true, task: updated })
  } catch (error) {
    console.error('Error updating MOC task:', error)
    return NextResponse.json(
      { error: 'Error updating task' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/moc/[id]/tasks
 * Elimina una tarea de MOC
 */
export async function DELETE(request: Request, { params }: Params) {
  try {
    const { searchParams } = new URL(request.url)
    const taskId = searchParams.get('taskId')

    if (!taskId) {
      return NextResponse.json({ error: 'taskId is required' }, { status: 400 })
    }

    const task = await prisma.mOCTask.findUnique({
      where: { id: parseInt(taskId) }
    })

    if (!task) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 })
    }

    await prisma.mOCTask.delete({
      where: { id: parseInt(taskId) }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting MOC task:', error)
    return NextResponse.json(
      { error: 'Error deleting task' },
      { status: 500 }
    )
  }
}
