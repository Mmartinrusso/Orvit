// ============================================
// API de Chat del Asistente IA
// ============================================

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAssistantContext } from '@/lib/assistant/auth'
import { processMessage } from '@/lib/assistant/engine'
import { ConversationMessage } from '@/lib/assistant/types'

export const dynamic = 'force-dynamic'

/**
 * POST /api/assistant/chat
 * Envía un mensaje al asistente y recibe una respuesta
 */
export async function POST(request: NextRequest) {
  try {
    // 1. Verificar autenticación
    const context = await getAssistantContext()
    if (!context) {
      return NextResponse.json(
        { error: 'No autorizado' },
        { status: 401 }
      )
    }

    // 2. Parsear request
    const body = await request.json()
    const { message, conversationId, currentPage, currentEntity } = body

    if (!message || typeof message !== 'string') {
      return NextResponse.json(
        { error: 'El mensaje es requerido' },
        { status: 400 }
      )
    }

    // 3. Actualizar contexto con información de la página actual
    const enrichedContext = {
      ...context,
      currentPage,
      currentEntity,
    }

    // 4. Obtener o crear conversación
    let conversation
    if (conversationId) {
      conversation = await prisma.assistantConversation.findUnique({
        where: { id: conversationId },
        include: {
          messages: {
            orderBy: { createdAt: 'asc' },
            take: 20, // Últimos 20 mensajes
          },
        },
      })

      // Verificar que la conversación pertenece al usuario
      if (conversation && conversation.userId !== context.userId) {
        return NextResponse.json(
          { error: 'Conversación no encontrada' },
          { status: 404 }
        )
      }
    }

    if (!conversation) {
      conversation = await prisma.assistantConversation.create({
        data: {
          userId: context.userId,
          companyId: context.companyId,
          context: enrichedContext,
        },
        include: {
          messages: true,
        },
      })
    }

    // 5. Guardar mensaje del usuario
    const userMessage = await prisma.assistantMessage.create({
      data: {
        conversationId: conversation.id,
        role: 'user',
        content: message,
      },
    })

    // 6. Convertir mensajes a formato esperado
    const conversationHistory: ConversationMessage[] = conversation.messages.map(m => ({
      id: m.id,
      role: m.role as 'user' | 'assistant',
      content: m.content,
      timestamp: m.createdAt,
      action: m.actionType ? {
        type: m.actionType as any,
        status: (m.actionStatus as any) || 'pending',
      } : undefined,
      sources: m.sources as any,
    }))

    // 7. Procesar mensaje con el motor de IA
    const startTime = Date.now()
    const response = await processMessage(message, enrichedContext, conversationHistory)
    const responseTime = Date.now() - startTime

    // 8. Guardar respuesta del asistente
    const assistantMessage = await prisma.assistantMessage.create({
      data: {
        conversationId: conversation.id,
        role: 'assistant',
        content: response.message,
        actionType: response.action?.type,
        actionData: response.action?.preview,
        actionStatus: response.action ? 'pending' : null,
        sources: response.sources,
        responseTimeMs: responseTime,
      },
    })

    // 9. Actualizar título de conversación si es el primer mensaje
    if (conversation.messages.length === 0) {
      const title = message.substring(0, 100) + (message.length > 100 ? '...' : '')
      await prisma.assistantConversation.update({
        where: { id: conversation.id },
        data: { title },
      })
    }

    // 10. Devolver respuesta
    return NextResponse.json({
      conversationId: conversation.id,
      messageId: assistantMessage.id,
      response: response.message,
      sources: response.sources,
      action: response.action,
      followUpQuestions: response.followUpQuestions,
    })
  } catch (error) {
    console.error('Error en chat del asistente:', error)
    // Log más detallado del error
    if (error instanceof Error) {
      console.error('Error message:', error.message)
      console.error('Error stack:', error.stack)
    }
    return NextResponse.json(
      { error: 'Error interno del servidor', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

/**
 * GET /api/assistant/chat
 * Obtiene el historial de conversaciones o una conversación específica
 */
export async function GET(request: NextRequest) {
  try {
    // 1. Verificar autenticación
    const context = await getAssistantContext()
    if (!context) {
      return NextResponse.json(
        { error: 'No autorizado' },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(request.url)
    const conversationId = searchParams.get('conversationId')

    // 2. Si se pide una conversación específica
    if (conversationId) {
      const conversation = await prisma.assistantConversation.findUnique({
        where: { id: parseInt(conversationId) },
        include: {
          messages: {
            orderBy: { createdAt: 'asc' },
          },
        },
      })

      if (!conversation || conversation.userId !== context.userId) {
        return NextResponse.json(
          { error: 'Conversación no encontrada' },
          { status: 404 }
        )
      }

      return NextResponse.json({ conversation })
    }

    // 3. Devolver lista de conversaciones recientes
    const conversations = await prisma.assistantConversation.findMany({
      where: {
        userId: context.userId,
        isActive: true,
      },
      orderBy: { updatedAt: 'desc' },
      take: 20,
      include: {
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1, // Solo el último mensaje
        },
      },
    })

    return NextResponse.json({ conversations })
  } catch (error) {
    console.error('Error obteniendo conversaciones:', error)
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/assistant/chat
 * Elimina (archiva) una conversación
 */
export async function DELETE(request: NextRequest) {
  try {
    const context = await getAssistantContext()
    if (!context) {
      return NextResponse.json(
        { error: 'No autorizado' },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(request.url)
    const conversationId = searchParams.get('conversationId')

    if (!conversationId) {
      return NextResponse.json(
        { error: 'conversationId es requerido' },
        { status: 400 }
      )
    }

    // Verificar propiedad y archivar
    const conversation = await prisma.assistantConversation.findUnique({
      where: { id: parseInt(conversationId) },
    })

    if (!conversation || conversation.userId !== context.userId) {
      return NextResponse.json(
        { error: 'Conversación no encontrada' },
        { status: 404 }
      )
    }

    await prisma.assistantConversation.update({
      where: { id: parseInt(conversationId) },
      data: { isActive: false },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error eliminando conversación:', error)
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}
