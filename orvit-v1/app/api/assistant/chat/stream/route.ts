// ============================================
// API de Chat con Streaming del Asistente IA
// ============================================

import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAssistantContext } from '@/lib/assistant/auth'
import { processMessageStream } from '@/lib/assistant/engine'
import { ConversationMessage } from '@/lib/assistant/types'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * POST /api/assistant/chat/stream
 * Envía un mensaje al asistente y recibe una respuesta en streaming
 */
export async function POST(request: NextRequest) {
  try {
    // 1. Verificar autenticación
    const context = await getAssistantContext()
    if (!context) {
      return new Response(
        JSON.stringify({ error: 'No autorizado' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // 2. Parsear request
    const body = await request.json()
    const { message, conversationId, currentPage, currentEntity, imageBase64 } = body

    // Validar que haya mensaje o imagen
    if ((!message || typeof message !== 'string') && !imageBase64) {
      return new Response(
        JSON.stringify({ error: 'El mensaje o imagen es requerido' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      )
    }
    const messageText = message || '¿Qué ves en esta imagen?'

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
            take: 20,
          },
        },
      })

      if (conversation && conversation.userId !== context.userId) {
        return new Response(
          JSON.stringify({ error: 'Conversación no encontrada' }),
          { status: 404, headers: { 'Content-Type': 'application/json' } }
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
    await prisma.assistantMessage.create({
      data: {
        conversationId: conversation.id,
        role: 'user',
        content: messageText,
        // Note: imageBase64 no se guarda en BD por tamaño, solo en el frontend
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

    // 7. Procesar mensaje con streaming
    const startTime = Date.now()
    const { stream, metadata } = await processMessageStream(messageText, enrichedContext, conversationHistory, imageBase64)

    // 8. Crear un TransformStream para capturar el contenido completo
    let fullContent = ''
    const encoder = new TextEncoder()
    const decoder = new TextDecoder()

    const transformStream = new TransformStream({
      transform(chunk, controller) {
        const text = decoder.decode(chunk, { stream: true })
        fullContent += text
        // Enviar chunk como SSE
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'chunk', content: text })}\n\n`))
      },
      async flush(controller) {
        const responseTime = Date.now() - startTime
        const meta = await metadata

        // Guardar respuesta del asistente
        const assistantMessage = await prisma.assistantMessage.create({
          data: {
            conversationId: conversation.id,
            role: 'assistant',
            content: fullContent,
            sources: meta.sources,
            responseTimeMs: responseTime,
          },
        })

        // Actualizar título si es primer mensaje
        if (conversation.messages.length === 0) {
          const title = messageText.substring(0, 100) + (messageText.length > 100 ? '...' : '')
          await prisma.assistantConversation.update({
            where: { id: conversation.id },
            data: { title },
          })
        }

        // Enviar metadata final
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({
          type: 'done',
          conversationId: conversation.id,
          messageId: assistantMessage.id,
          sources: meta.sources,
          followUpQuestions: meta.followUpQuestions,
          interactiveSelection: meta.interactiveSelection,
        })}\n\n`))
      }
    })

    // 9. Pipe el stream a través del transform y devolver como SSE
    const responseStream = stream.pipeThrough(transformStream)

    return new Response(responseStream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    })
  } catch (error) {
    console.error('Error en chat streaming del asistente:', error)
    return new Response(
      JSON.stringify({ error: 'Error interno del servidor', details: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
}
