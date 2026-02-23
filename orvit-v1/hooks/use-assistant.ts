'use client'

import { useState, useCallback } from 'react'

interface Message {
  id: number
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
  sources?: {
    type: string
    id: number
    title: string
    url: string
  }[]
  action?: {
    type: string
    preview: any
    status: 'pending' | 'confirmed' | 'executed' | 'cancelled'
  }
}

interface UseAssistantOptions {
  onMessage?: (message: Message) => void
  onError?: (error: Error) => void
}

interface UseAssistantReturn {
  messages: Message[]
  isLoading: boolean
  conversationId: number | null
  sendMessage: (content: string) => Promise<void>
  sendVoice: (audioBlob: Blob) => Promise<string>
  executeAction: (actionType: string, actionData: any, confirmed?: boolean) => Promise<any>
  clearConversation: () => void
}

/**
 * Hook para interactuar con el asistente IA
 */
export function useAssistant(options: UseAssistantOptions = {}): UseAssistantReturn {
  const [messages, setMessages] = useState<Message[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [conversationId, setConversationId] = useState<number | null>(null)

  /**
   * Envía un mensaje de texto al asistente
   */
  const sendMessage = useCallback(async (content: string) => {
    if (!content.trim() || isLoading) return

    const userMessage: Message = {
      id: Date.now(),
      role: 'user',
      content: content.trim(),
      timestamp: new Date(),
    }

    setMessages(prev => [...prev, userMessage])
    setIsLoading(true)

    try {
      const response = await fetch('/api/assistant/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: content.trim(),
          conversationId,
          currentPage: typeof window !== 'undefined' ? window.location.pathname : undefined,
        }),
      })

      if (!response.ok) {
        throw new Error('Error en la respuesta del asistente')
      }

      const data = await response.json()

      setConversationId(data.conversationId)

      const assistantMessage: Message = {
        id: data.messageId || Date.now() + 1,
        role: 'assistant',
        content: data.response,
        timestamp: new Date(),
        sources: data.sources,
        action: data.action ? {
          ...data.action,
          status: 'pending',
        } : undefined,
      }

      setMessages(prev => [...prev, assistantMessage])
      options.onMessage?.(assistantMessage)
    } catch (error) {
      const err = error instanceof Error ? error : new Error('Error desconocido')
      options.onError?.(err)

      const errorMessage: Message = {
        id: Date.now() + 1,
        role: 'assistant',
        content: 'Lo siento, hubo un error al procesar tu mensaje. Por favor, intenta nuevamente.',
        timestamp: new Date(),
      }
      setMessages(prev => [...prev, errorMessage])
    } finally {
      setIsLoading(false)
    }
  }, [conversationId, isLoading, options])

  /**
   * Envía un audio para transcripción
   */
  const sendVoice = useCallback(async (audioBlob: Blob): Promise<string> => {
    const formData = new FormData()
    formData.append('audio', audioBlob, 'audio.webm')

    const response = await fetch('/api/assistant/voice', {
      method: 'POST',
      body: formData,
    })

    if (!response.ok) {
      throw new Error('Error al transcribir el audio')
    }

    const data = await response.json()
    return data.transcript
  }, [])

  /**
   * Ejecuta una acción del asistente
   */
  const executeAction = useCallback(async (
    actionType: string,
    actionData: any,
    confirmed = false
  ): Promise<any> => {
    const response = await fetch('/api/assistant/actions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        actionType,
        actionData,
        confirmed,
      }),
    })

    if (!response.ok) {
      throw new Error('Error al ejecutar la acción')
    }

    return response.json()
  }, [])

  /**
   * Limpia la conversación actual
   */
  const clearConversation = useCallback(() => {
    setMessages([])
    setConversationId(null)
  }, [])

  return {
    messages,
    isLoading,
    conversationId,
    sendMessage,
    sendVoice,
    executeAction,
    clearConversation,
  }
}

/**
 * Hook para indexar datos (solo para admins)
 */
export function useAssistantIndexer() {
  const [isIndexing, setIsIndexing] = useState(false)
  const [progress, setProgress] = useState<Record<string, { indexed: number; total: number }>>({})

  const indexEntityType = useCallback(async (entityType: string) => {
    setIsIndexing(true)
    try {
      const response = await fetch('/api/assistant/index', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entityType,
          indexAll: true,
        }),
      })

      if (!response.ok) {
        throw new Error('Error al indexar')
      }

      return response.json()
    } finally {
      setIsIndexing(false)
    }
  }, [])

  const getIndexStatus = useCallback(async () => {
    const response = await fetch('/api/assistant/index')
    if (!response.ok) {
      throw new Error('Error al obtener estado')
    }
    const data = await response.json()
    setProgress(data.status)
    return data
  }, [])

  return {
    isIndexing,
    progress,
    indexEntityType,
    getIndexStatus,
  }
}
