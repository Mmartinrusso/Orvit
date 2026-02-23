'use client'

import { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import { MessageCircle, X, Send, Loader2, Bot, User, ExternalLink, Mic, MicOff, Maximize2, Minimize2, History, Trash2, Zap, AlertTriangle, ClipboardList, Users, BarChart3, Copy, Check, ImagePlus, Wrench, ChevronDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'
import { sanitizeHtml } from '@/lib/sanitize'
import { useConfirm } from '@/components/ui/confirm-dialog-provider'
import { toast } from 'sonner'

// Categorías de acciones rápidas
const QUICK_ACTION_CATEGORIES = [
  {
    name: 'Estado General',
    actions: [
      { label: '¿Cómo estamos?', query: '¿Cómo estamos hoy?', emoji: '📊' },
      { label: 'Resumen del día', query: 'Dame el resumen del día', emoji: '📋' },
    ]
  },
  {
    name: 'Órdenes de Trabajo',
    actions: [
      { label: 'OTs pendientes', query: '¿Cuántas OTs hay pendientes?', emoji: '📝' },
      { label: 'OTs urgentes', query: '¿Hay OTs urgentes?', emoji: '🚨' },
    ]
  },
  {
    name: 'Fallas',
    actions: [
      { label: 'Fallas abiertas', query: '¿Hay fallas sin resolver?', emoji: '⚠️' },
      { label: 'Algo urgente', query: '¿Hay algo urgente?', emoji: '🔴' },
    ]
  },
  {
    name: 'Preventivo',
    actions: [
      { label: 'Vencidos', query: '¿Hay preventivos vencidos?', emoji: '🔧' },
      { label: 'Esta semana', query: '¿Qué preventivos hay esta semana?', emoji: '📅' },
    ]
  },
  {
    name: 'Equipo',
    actions: [
      { label: 'Carga de trabajo', query: '¿Cómo está la carga de los técnicos?', emoji: '👥' },
      { label: 'Quién está libre', query: '¿Quién está más libre?', emoji: '✋' },
    ]
  },
]

// Acciones rápidas simplificadas para chips
const QUICK_ACTIONS = [
  { label: '¿Cómo estamos?', icon: BarChart3, query: '¿Cómo estamos hoy?' },
  { label: 'OTs pendientes', icon: ClipboardList, query: '¿Cuántas OTs hay pendientes?' },
  { label: 'Urgentes', icon: AlertTriangle, query: '¿Hay algo urgente?' },
  { label: 'Preventivos', icon: Zap, query: '¿Hay preventivos vencidos?' },
  { label: 'Técnicos', icon: Users, query: '¿Cómo está la carga de los técnicos?' },
]

// Sugerencias para autocompletado
const SUGGESTIONS = [
  // Estado general
  { text: '¿Cómo estamos hoy?', keywords: ['como', 'estamos', 'hoy', 'estado', 'que', 'onda'] },
  { text: '¿Qué novedades hay?', keywords: ['novedades', 'nuevo', 'hay'] },
  { text: 'Dame el resumen del día', keywords: ['resumen', 'dia', 'dame'] },
  // OTs
  { text: '¿Cuántas OTs hay pendientes?', keywords: ['ot', 'ots', 'orden', 'ordenes', 'pendiente', 'cuantas'] },
  { text: '¿Hay OTs urgentes?', keywords: ['ot', 'urgente', 'critico'] },
  { text: 'Mostrame las OTs de hoy', keywords: ['ot', 'mostrar', 'hoy'] },
  // Fallas
  { text: '¿Cuántas fallas hubo este mes?', keywords: ['falla', 'fallas', 'cuantas', 'mes'] },
  { text: '¿Hay fallas sin resolver?', keywords: ['falla', 'resolver', 'pendiente', 'abierta'] },
  { text: '¿Qué se rompió?', keywords: ['rompio', 'roto', 'fallo'] },
  // Preventivos
  { text: '¿Hay preventivos vencidos?', keywords: ['preventivo', 'vencido', 'atrasado'] },
  { text: '¿Estamos al día con preventivos?', keywords: ['preventivo', 'dia', 'al'] },
  { text: '¿Qué preventivos hay esta semana?', keywords: ['preventivo', 'semana'] },
  // Técnicos
  { text: '¿Cómo está la carga de los técnicos?', keywords: ['tecnico', 'carga', 'trabajo'] },
  { text: '¿Quién está más libre?', keywords: ['quien', 'libre', 'disponible'] },
  { text: '¿A quién le asigno una OT?', keywords: ['asigno', 'asignar', 'quien'] },
  // Máquinas
  { text: '¿Qué máquinas tenemos?', keywords: ['maquina', 'maquinas', 'equipo', 'cuantas'] },
  { text: 'Historial de fallas de una máquina', keywords: ['historial', 'falla', 'maquina'] },
]

interface FailureOption {
  id: number
  title: string
  description: string | null
  status: string
  priority: string
  failureCategory: string | null
  componentName?: string
  subcomponentName?: string
}

interface Message {
  id: number
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
  imageUrl?: string  // URL o base64 de imagen adjunta
  sources?: {
    type: string
    id: number
    title: string
    url: string
  }[]
  action?: {
    type: string
    preview: any
  }
  followUpQuestions?: string[]
  // Para flujo interactivo de selección de fallas
  interactiveSelection?: {
    type: 'failure_selection'
    machineId: number
    machineName: string
    failures: FailureOption[]
  }
}

interface Conversation {
  id: number
  title: string | null
  updatedAt: string
  messages: {
    id: number
    role: string
    content: string
    createdAt: string
  }[]
}

interface AssistantChatProps {
  className?: string
}

export function AssistantChat({ className }: AssistantChatProps) {
  const confirm = useConfirm()
  const [isOpen, setIsOpen] = useState(false)
  const [isExpanded, setIsExpanded] = useState(false)
  const [showHistory, setShowHistory] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [inputValue, setInputValue] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [conversationId, setConversationId] = useState<number | null>(null)
  const [isRecording, setIsRecording] = useState(false)
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [isLoadingHistory, setIsLoadingHistory] = useState(false)
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState(0)
  const [copiedMessageId, setCopiedMessageId] = useState<number | null>(null)
  const [isTranscribing, setIsTranscribing] = useState(false)
  const [attachedImage, setAttachedImage] = useState<{ file: File, preview: string } | null>(null)
  const [showScrollButton, setShowScrollButton] = useState(false)

  const scrollRef = useRef<HTMLDivElement>(null)

  // Refs para swipe-to-close en móvil
  const touchStartY = useRef<number>(0)
  const touchCurrentY = useRef<number>(0)
  const panelRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])

  // Función para copiar mensaje
  const copyMessage = async (messageId: number, content: string) => {
    try {
      await navigator.clipboard.writeText(content)
      setCopiedMessageId(messageId)
      setTimeout(() => setCopiedMessageId(null), 2000)
    } catch (err) {
      console.error('Error copiando:', err)
    }
  }

  // Función para manejar selección de imagen
  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Validar que sea una imagen
    if (!file.type.startsWith('image/')) {
      toast.warning('Solo se permiten archivos de imagen')
      return
    }

    // Validar tamaño (máximo 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.warning('La imagen no puede superar los 5MB')
      return
    }

    // Crear preview
    const reader = new FileReader()
    reader.onloadend = () => {
      setAttachedImage({
        file,
        preview: reader.result as string
      })
    }
    reader.readAsDataURL(file)
  }

  // Función para remover imagen adjunta
  const removeAttachedImage = () => {
    setAttachedImage(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  // Función para iniciar/detener grabación de audio
  const toggleRecording = async () => {
    if (isRecording) {
      // Detener grabación
      if (mediaRecorderRef.current) {
        mediaRecorderRef.current.stop()
      }
    } else {
      // Iniciar grabación
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
        const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' })
        mediaRecorderRef.current = mediaRecorder
        audioChunksRef.current = []

        mediaRecorder.ondataavailable = (event) => {
          if (event.data.size > 0) {
            audioChunksRef.current.push(event.data)
          }
        }

        mediaRecorder.onstop = async () => {
          // Detener tracks del stream
          stream.getTracks().forEach(track => track.stop())

          // Crear blob de audio
          const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' })

          // Transcribir audio
          setIsTranscribing(true)
          try {
            const formData = new FormData()
            formData.append('audio', audioBlob, 'recording.webm')

            const response = await fetch('/api/assistant/voice', {
              method: 'POST',
              body: formData,
            })

            if (response.ok) {
              const data = await response.json()
              if (data.transcript) {
                setInputValue(data.transcript)
                inputRef.current?.focus()
              }
            } else {
              const errorData = await response.json().catch(() => ({}))
              console.error('Error transcribiendo audio:', errorData.error || 'Unknown error')
            }
          } catch (error) {
            console.error('Error enviando audio:', error)
          } finally {
            setIsTranscribing(false)
          }
        }

        mediaRecorder.start()
        setIsRecording(true)
      } catch (error) {
        console.error('Error accediendo al micrófono:', error)
        toast.error('No se pudo acceder al micrófono. Verifica los permisos.')
      }
    }
  }

  // Detener grabación al cambiar de estado
  useEffect(() => {
    if (!isRecording && mediaRecorderRef.current) {
      mediaRecorderRef.current = null
    }
  }, [isRecording])

  // Filtrar sugerencias basadas en el input
  const filteredSuggestions = useMemo(() => {
    if (!inputValue.trim() || inputValue.length < 2) return []

    const inputLower = inputValue.toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // Quitar tildes
    const inputWords = inputLower.split(/\s+/).filter(w => w.length > 1)

    if (inputWords.length === 0) return []

    return SUGGESTIONS
      .map(suggestion => {
        // Calcular score basado en coincidencias
        let score = 0
        for (const word of inputWords) {
          // Match en keywords
          for (const keyword of suggestion.keywords) {
            if (keyword.includes(word) || word.includes(keyword)) {
              score += keyword === word ? 3 : 1
            }
          }
          // Match en texto completo
          const textNormalized = suggestion.text.toLowerCase()
            .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
          if (textNormalized.includes(word)) {
            score += 2
          }
        }
        return { ...suggestion, score }
      })
      .filter(s => s.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 5) // Máximo 5 sugerencias
  }, [inputValue])

  // Auto-scroll cuando hay nuevos mensajes
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
      setShowScrollButton(false)
    }
  }, [messages])

  // Detectar scroll para mostrar botón "scroll to bottom"
  useEffect(() => {
    const scrollElement = scrollRef.current
    if (!scrollElement) return

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = scrollElement
      const isNotAtBottom = scrollHeight - scrollTop - clientHeight > 100
      setShowScrollButton(isNotAtBottom)
    }

    scrollElement.addEventListener('scroll', handleScroll)
    return () => scrollElement.removeEventListener('scroll', handleScroll)
  }, [])

  // Scroll to bottom function
  const scrollToBottom = () => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior: 'smooth'
      })
    }
  }

  // Swipe down to close en móvil
  useEffect(() => {
    if (!isOpen || window.innerWidth >= 768) return

    const panel = panelRef.current
    if (!panel) return

    const handleTouchStart = (e: TouchEvent) => {
      touchStartY.current = e.touches[0].clientY
      touchCurrentY.current = e.touches[0].clientY
    }

    const handleTouchMove = (e: TouchEvent) => {
      touchCurrentY.current = e.touches[0].clientY
      const diff = touchCurrentY.current - touchStartY.current

      // Solo si está arrastrando hacia abajo desde cerca del top
      if (diff > 0 && touchStartY.current < 100) {
        // Aplicar transform para feedback visual
        panel.style.transform = `translateY(${Math.min(diff * 0.5, 100)}px)`
        panel.style.opacity = `${1 - Math.min(diff / 300, 0.5)}`
      }
    }

    const handleTouchEnd = () => {
      const diff = touchCurrentY.current - touchStartY.current

      // Si arrastró más de 80px hacia abajo, cerrar
      if (diff > 80 && touchStartY.current < 100) {
        setIsOpen(false)
      }

      // Resetear estilos
      panel.style.transform = ''
      panel.style.opacity = ''
    }

    panel.addEventListener('touchstart', handleTouchStart, { passive: true })
    panel.addEventListener('touchmove', handleTouchMove, { passive: true })
    panel.addEventListener('touchend', handleTouchEnd, { passive: true })

    return () => {
      panel.removeEventListener('touchstart', handleTouchStart)
      panel.removeEventListener('touchmove', handleTouchMove)
      panel.removeEventListener('touchend', handleTouchEnd)
    }
  }, [isOpen])

  // Focus en input cuando se abre (solo en desktop para no abrir teclado en móvil)
  useEffect(() => {
    if (isOpen && inputRef.current && window.innerWidth >= 768) {
      inputRef.current.focus()
    }
  }, [isOpen])

  // Ref para trackear el estado sin recrear el listener
  const isOpenRef = useRef(isOpen)
  useEffect(() => {
    isOpenRef.current = isOpen
  }, [isOpen])

  // Ref para detectar doble Tab (desktop)
  const lastTabPress = useRef<number>(0)

  // Ref para detectar triple tap (móvil)
  const tapCount = useRef<number>(0)
  const lastTapTime = useRef<number>(0)

  // Atajo de teclado: Doble Tab para abrir/cerrar el chat (desktop)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Doble Tab para abrir/cerrar
      if (e.key === 'Tab') {
        const now = Date.now()
        const timeSinceLastTab = now - lastTabPress.current

        if (timeSinceLastTab < 300) {
          e.preventDefault()
          e.stopPropagation()
          setIsOpen(prev => !prev)
          lastTabPress.current = 0
        } else {
          lastTabPress.current = now
        }
        return
      }
      // Escape para cerrar
      if (e.key === 'Escape' && isOpenRef.current) {
        e.preventDefault()
        setIsOpen(false)
      }
    }

    window.addEventListener('keydown', handleKeyDown, true)
    return () => {
      window.removeEventListener('keydown', handleKeyDown, true)
    }
  }, [])

  // Triple tap para abrir/cerrar el chat (móvil)
  useEffect(() => {
    const handleTouchEnd = (e: TouchEvent) => {
      // Solo en móvil (pantallas < 768px)
      if (window.innerWidth >= 768) return

      // No detectar si el chat está abierto (para no interferir con la interacción)
      if (isOpenRef.current) return

      const now = Date.now()
      const timeSinceLastTap = now - lastTapTime.current

      if (timeSinceLastTap < 400) {
        tapCount.current++
        if (tapCount.current >= 4) {
          setIsOpen(true)
          tapCount.current = 0
        }
      } else {
        tapCount.current = 1
      }
      lastTapTime.current = now
    }

    document.addEventListener('touchend', handleTouchEnd)
    return () => {
      document.removeEventListener('touchend', handleTouchEnd)
    }
  }, [])

  // Cargar lista de conversaciones
  const loadConversations = useCallback(async () => {
    setIsLoadingHistory(true)
    try {
      const response = await fetch('/api/assistant/chat')
      if (response.ok) {
        const data = await response.json()
        setConversations(data.conversations || [])
      }
    } catch (error) {
      console.error('Error cargando historial:', error)
    } finally {
      setIsLoadingHistory(false)
    }
  }, [])

  // Cargar una conversación específica
  const loadConversation = useCallback(async (convId: number) => {
    setIsLoading(true)
    try {
      const response = await fetch(`/api/assistant/chat?conversationId=${convId}`)
      if (response.ok) {
        const data = await response.json()
        const conv = data.conversation

        // Convertir mensajes al formato del componente
        const loadedMessages: Message[] = conv.messages.map((m: any) => ({
          id: m.id,
          role: m.role as 'user' | 'assistant',
          content: m.content,
          timestamp: new Date(m.createdAt),
          sources: m.sources,
        }))

        setMessages(loadedMessages)
        setConversationId(convId)
        setShowHistory(false)
      }
    } catch (error) {
      console.error('Error cargando conversación:', error)
    } finally {
      setIsLoading(false)
    }
  }, [])

  // Eliminar conversación
  const deleteConversation = useCallback(async (convId: number, e: React.MouseEvent) => {
    e.stopPropagation()
    const ok = await confirm({
      title: 'Eliminar conversación',
      description: '¿Eliminar esta conversación?',
      confirmText: 'Eliminar',
      variant: 'destructive',
    })
    if (!ok) return

    try {
      const response = await fetch(`/api/assistant/chat?conversationId=${convId}`, {
        method: 'DELETE',
      })
      if (response.ok) {
        setConversations(prev => prev.filter(c => c.id !== convId))
        // Si eliminamos la conversación actual, limpiar
        if (conversationId === convId) {
          startNewConversation()
        }
      }
    } catch (error) {
      console.error('Error eliminando conversación:', error)
    }
  }, [conversationId])

  // Cargar historial cuando se abre el panel
  useEffect(() => {
    if (showHistory && conversations.length === 0) {
      loadConversations()
    }
  }, [showHistory, loadConversations, conversations.length])

  const sendMessage = useCallback(async (content: string) => {
    if ((!content.trim() && !attachedImage) || isLoading) return

    // Capturar imagen adjunta antes de limpiarla
    const imageToSend = attachedImage

    const userMessage: Message = {
      id: Date.now(),
      role: 'user',
      content: content.trim(),
      timestamp: new Date(),
      imageUrl: imageToSend?.preview,
    }

    setMessages(prev => [...prev, userMessage])
    setInputValue('')
    setAttachedImage(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
    setIsLoading(true)

    // Crear mensaje placeholder para el asistente (streaming)
    const assistantMessageId = Date.now() + 1
    const assistantMessage: Message = {
      id: assistantMessageId,
      role: 'assistant',
      content: '',
      timestamp: new Date(),
    }
    setMessages(prev => [...prev, assistantMessage])

    try {
      const response = await fetch('/api/assistant/chat/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: content.trim(),
          conversationId,
          currentPage: window.location.pathname,
          imageBase64: imageToSend?.preview,
        }),
      })

      if (!response.ok) {
        throw new Error('Error en la respuesta')
      }

      const reader = response.body?.getReader()
      if (!reader) throw new Error('No se pudo leer el stream')

      const decoder = new TextDecoder()
      let streamedContent = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const chunk = decoder.decode(value, { stream: true })
        const lines = chunk.split('\n')

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6))

              if (data.type === 'chunk') {
                streamedContent += data.content
                // Actualizar mensaje del asistente con nuevo contenido
                setMessages(prev => prev.map(msg =>
                  msg.id === assistantMessageId
                    ? { ...msg, content: streamedContent }
                    : msg
                ))
              } else if (data.type === 'done') {
                // Actualizar con metadata final
                setConversationId(data.conversationId)
                setMessages(prev => prev.map(msg =>
                  msg.id === assistantMessageId
                    ? {
                        ...msg,
                        id: data.messageId,
                        content: streamedContent,
                        sources: data.sources,
                        followUpQuestions: data.followUpQuestions,
                        interactiveSelection: data.interactiveSelection,
                      }
                    : msg
                ))
              }
            } catch (e) {
              // Ignorar líneas que no son JSON válido
            }
          }
        }
      }
    } catch (error) {
      console.error('Error enviando mensaje:', error)
      // Actualizar mensaje de error
      setMessages(prev => prev.map(msg =>
        msg.id === assistantMessageId
          ? { ...msg, content: 'Lo siento, hubo un error al procesar tu mensaje. Por favor, intenta nuevamente.' }
          : msg
      ))
    } finally {
      setIsLoading(false)
    }
  }, [conversationId, isLoading, attachedImage])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    sendMessage(inputValue)
  }

  // Mostrar sugerencias cuando hay matches
  useEffect(() => {
    setShowSuggestions(filteredSuggestions.length > 0)
    setSelectedSuggestionIndex(0)
  }, [filteredSuggestions.length])

  const handleInputKeyDown = (e: React.KeyboardEvent) => {
    // Si hay sugerencias visibles, manejar navegación
    if (showSuggestions && filteredSuggestions.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSelectedSuggestionIndex(prev =>
          prev < filteredSuggestions.length - 1 ? prev + 1 : 0
        )
        return
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSelectedSuggestionIndex(prev =>
          prev > 0 ? prev - 1 : filteredSuggestions.length - 1
        )
        return
      }
      if (e.key === 'Tab' || (e.key === 'Enter' && filteredSuggestions.length > 0)) {
        e.preventDefault()
        const selected = filteredSuggestions[selectedSuggestionIndex]
        if (selected) {
          setInputValue(selected.text)
          setShowSuggestions(false)
          // Si es Enter, también enviar
          if (e.key === 'Enter') {
            sendMessage(selected.text)
          }
        }
        return
      }
      if (e.key === 'Escape') {
        setShowSuggestions(false)
        return
      }
    }

    // Comportamiento normal: Enter para enviar
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage(inputValue)
    }
  }

  const selectSuggestion = (suggestion: typeof SUGGESTIONS[0]) => {
    setInputValue(suggestion.text)
    setShowSuggestions(false)
    inputRef.current?.focus()
  }

  const startNewConversation = () => {
    setMessages([])
    setConversationId(null)
    setShowHistory(false)
  }

  // Handler para selección de falla del flujo interactivo
  const handleFailureSelect = useCallback(async (failure: FailureOption, machineId: number, machineName: string) => {
    // Enviar mensaje indicando la selección
    const selectionMessage = `Seleccioné la falla #${failure.id}: "${failure.title}" de ${machineName}. Necesito ayuda para resolverla.`

    // Agregar metadata de contexto para que el backend haga deep search
    const userMessage: Message = {
      id: Date.now(),
      role: 'user',
      content: selectionMessage,
      timestamp: new Date(),
    }

    setMessages(prev => [...prev, userMessage])
    setIsLoading(true)

    // Crear mensaje placeholder
    const assistantMessageId = Date.now() + 1
    const assistantMessage: Message = {
      id: assistantMessageId,
      role: 'assistant',
      content: '',
      timestamp: new Date(),
    }
    setMessages(prev => [...prev, assistantMessage])

    try {
      // Enviar con contexto especial para deep search
      const response = await fetch('/api/assistant/chat/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: selectionMessage,
          conversationId,
          currentPage: window.location.pathname,
          // Contexto especial para triggear deep search
          currentEntity: {
            type: 'failure_occurrence',
            id: failure.id,
            data: {
              machineId,
              machineName,
              failureTitle: failure.title,
              failureDescription: failure.description,
              componentName: failure.componentName,
              subcomponentName: failure.subcomponentName,
              triggerDeepSearch: true, // Flag para que el backend haga búsqueda profunda
            }
          }
        }),
      })

      if (!response.ok) throw new Error('Error en la respuesta')

      const reader = response.body?.getReader()
      if (!reader) throw new Error('No se pudo leer el stream')

      const decoder = new TextDecoder()
      let streamedContent = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const chunk = decoder.decode(value, { stream: true })
        const lines = chunk.split('\n')

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6))

              if (data.type === 'chunk') {
                streamedContent += data.content
                setMessages(prev => prev.map(msg =>
                  msg.id === assistantMessageId
                    ? { ...msg, content: streamedContent }
                    : msg
                ))
              } else if (data.type === 'done') {
                setConversationId(data.conversationId)
                setMessages(prev => prev.map(msg =>
                  msg.id === assistantMessageId
                    ? {
                        ...msg,
                        id: data.messageId,
                        content: streamedContent,
                        sources: data.sources,
                        followUpQuestions: data.followUpQuestions,
                      }
                    : msg
                ))
              }
            } catch (e) {
              // Ignorar líneas inválidas
            }
          }
        }
      }
    } catch (error) {
      console.error('Error procesando selección de falla:', error)
      setMessages(prev => prev.map(msg =>
        msg.id === assistantMessageId
          ? { ...msg, content: 'Lo siento, hubo un error al procesar tu solicitud. Por favor, intenta nuevamente.' }
          : msg
      ))
    } finally {
      setIsLoading(false)
    }
  }, [conversationId])

  // Renderizar mensaje con formato
  const renderMessageContent = (content: string) => {
    // Convertir markdown básico a HTML
    const formatted = content
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/`(.*?)`/g, '<code class="bg-muted px-1 py-0.5 rounded text-sm">$1</code>')
      .replace(/\n/g, '<br />')

    return <div dangerouslySetInnerHTML={{ __html: sanitizeHtml(formatted) }} />
  }

  return (
    <>
      {/* Panel de chat - Se abre con doble Tab (desktop) o 4 taps (móvil) */}
      <div
        ref={panelRef}
        className={cn(
          'fixed z-50',
          'bg-background border rounded-lg shadow-xl',
          'flex flex-col overflow-hidden',
          'transition-all duration-200',
          isOpen
            ? 'opacity-100 translate-y-0'
            : 'opacity-0 translate-y-2 pointer-events-none',
          isExpanded
            ? 'inset-4 w-auto h-auto'
            : 'bottom-5 right-5 w-[380px] h-[550px] max-h-[80vh]',
          // En móvil ocupa más espacio
          !isExpanded && 'max-md:inset-x-2 max-md:bottom-2 max-md:w-auto max-md:h-[85vh]'
        )}
      >
        {/* Indicador swipe-to-close (móvil) */}
        <div className="md:hidden flex justify-center pt-2 pb-0 bg-primary">
          <div className="w-10 h-1 rounded-full bg-background/30" />
        </div>

        {/* Header limpio */}
        <div className="flex items-center justify-between p-3 md:pt-3 pt-1 border-b bg-primary text-primary-foreground">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-background/15 flex items-center justify-center">
              <Bot className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-semibold">ORVIT</h3>
              <p className="text-xs opacity-80">Asistente de Mantenimiento</p>
            </div>
          </div>
          <div className="flex items-center gap-0.5">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setShowHistory(!showHistory)}
              className={cn(
                "h-8 w-8 text-primary-foreground/80 hover:text-primary-foreground hover:bg-background/15",
                showHistory && "bg-background/15"
              )}
              title="Historial"
            >
              <History className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={startNewConversation}
              className="h-8 w-8 text-primary-foreground/80 hover:text-primary-foreground hover:bg-background/15"
              title="Nueva conversación"
            >
              <MessageCircle className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsExpanded(!isExpanded)}
              className="h-8 w-8 text-primary-foreground/80 hover:text-primary-foreground hover:bg-background/15"
              title={isExpanded ? "Minimizar" : "Expandir"}
            >
              {isExpanded ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsOpen(false)}
              className="h-8 w-8 text-primary-foreground/80 hover:text-primary-foreground hover:bg-background/15"
              title="Cerrar (Esc)"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Contenedor principal con historial y mensajes */}
        <div className="flex-1 flex overflow-hidden">
          {/* Panel de historial */}
          {showHistory && (
            <div className={cn(
              "border-r bg-muted/20 flex flex-col",
              isExpanded ? "w-72" : "w-56"
            )}>
              <div className="p-3 border-b">
                <h4 className="font-medium text-sm">Conversaciones anteriores</h4>
              </div>
              <ScrollArea className="flex-1">
                {isLoadingHistory ? (
                  <div className="flex items-center justify-center p-4">
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  </div>
                ) : conversations.length === 0 ? (
                  <div className="p-4 text-center text-sm text-muted-foreground">
                    No hay conversaciones anteriores
                  </div>
                ) : (
                  <div className="p-2 space-y-1">
                    {conversations.map((conv) => (
                      <div
                        key={conv.id}
                        onClick={() => loadConversation(conv.id)}
                        className={cn(
                          "group flex items-start gap-2 p-2 rounded-md cursor-pointer transition-colors",
                          "hover:bg-muted",
                          conversationId === conv.id && "bg-muted"
                        )}
                      >
                        <MessageCircle className="h-4 w-4 mt-0.5 text-muted-foreground flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">
                            {conv.title || 'Sin título'}
                          </p>
                          {conv.messages[0] && (
                            <p className="text-xs text-muted-foreground truncate">
                              {conv.messages[0].content.substring(0, 50)}...
                            </p>
                          )}
                          <p className="text-xs text-muted-foreground/70 mt-1">
                            {new Date(conv.updatedAt).toLocaleDateString('es-AR', {
                              day: 'numeric',
                              month: 'short',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </p>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={(e) => deleteConversation(conv.id, e)}
                          className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
              <div className="p-2 border-t">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={loadConversations}
                  disabled={isLoadingHistory}
                  className="w-full text-xs"
                >
                  {isLoadingHistory ? (
                    <Loader2 className="h-3 w-3 animate-spin mr-1" />
                  ) : null}
                  Actualizar
                </Button>
              </div>
            </div>
          )}

          {/* Mensajes */}
          <div className="flex-1 relative">
            <ScrollArea className="h-full p-4" ref={scrollRef}>

            {/* Botón scroll to bottom */}
            {showScrollButton && (
              <button
                onClick={scrollToBottom}
                className="absolute bottom-2 left-1/2 -translate-x-1/2 z-10 flex items-center gap-1 px-3 py-1.5 rounded-full bg-primary text-primary-foreground text-xs shadow-lg hover:bg-primary/90 transition-all animate-in fade-in slide-in-from-bottom-2"
              >
                <ChevronDown className="h-3 w-3" />
                Nuevos mensajes
              </button>
            )}
          {messages.length === 0 ? (
            <div className="flex flex-col h-full py-3 px-1">
              {/* Saludo */}
              <div className="text-center mb-5">
                <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-3">
                  <Bot className="h-6 w-6 text-primary" />
                </div>
                <h2 className="text-lg font-semibold text-foreground">¡Hola! Soy ORVIT</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  ¿En qué puedo ayudarte hoy?
                </p>
              </div>

              {/* Acciones rápidas en grid simple */}
              <div className="flex-1 space-y-4 overflow-y-auto">
                {QUICK_ACTION_CATEGORIES.map((category) => (
                  <div key={category.name}>
                    <p className="text-xs font-medium text-muted-foreground mb-2 px-1">
                      {category.name}
                    </p>
                    <div className="space-y-1">
                      {category.actions.map((action, idx) => (
                        <button
                          key={idx}
                          onClick={() => sendMessage(action.query)}
                          disabled={isLoading}
                          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left text-sm bg-muted/50 hover:bg-muted transition-colors disabled:opacity-50"
                        >
                          <span>{action.emoji}</span>
                          <span className="text-foreground">{action.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              {/* Footer con atajo */}
              <div className="mt-3 pt-2 border-t text-center">
                <p className="text-xs text-muted-foreground hidden md:block">
                  <kbd className="px-1.5 py-0.5 rounded bg-muted border text-xs font-mono">Tab</kbd> × 2 para abrir/cerrar
                </p>
                <p className="text-xs text-muted-foreground md:hidden">
                  4 taps en pantalla para abrir
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {messages.map((message) => {
                // Skip empty assistant messages (placeholder while waiting for stream)
                if (message.role === 'assistant' && message.content === '' && isLoading) {
                  return null
                }
                return (
                <div
                  key={message.id}
                  className={cn(
                    'flex gap-2',
                    message.role === 'user' ? 'justify-end' : 'justify-start'
                  )}
                >
                  {message.role === 'assistant' && (
                    <div className="flex-shrink-0 w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center mt-0.5">
                      <Bot className="h-4 w-4 text-primary" />
                    </div>
                  )}
                  <div
                    className={cn(
                      'max-w-[85%] rounded-xl px-3 py-2 text-sm group relative',
                      message.role === 'user'
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted'
                    )}
                  >
                    {/* Botón de copiar */}
                    {message.role === 'assistant' && (
                      <button
                        onClick={() => copyMessage(message.id, message.content)}
                        className="absolute -top-1.5 -right-1.5 p-1 rounded-full bg-background border shadow-sm opacity-0 group-hover:opacity-100 transition-opacity"
                        title="Copiar"
                      >
                        {copiedMessageId === message.id ? (
                          <Check className="h-3 w-3 text-success" />
                        ) : (
                          <Copy className="h-3 w-3 text-muted-foreground" />
                        )}
                      </button>
                    )}

                    {/* Imagen adjunta */}
                    {message.imageUrl && (
                      <div className="mb-2">
                        <img
                          src={message.imageUrl}
                          alt="Imagen adjunta"
                          className="max-w-full max-h-48 rounded-lg cursor-pointer hover:opacity-90 transition-opacity"
                          onClick={() => window.open(message.imageUrl, '_blank')}
                        />
                      </div>
                    )}

                    {renderMessageContent(message.content)}

                    {/* Timestamp */}
                    <span
                      className={cn(
                        'block text-xs mt-1',
                        message.role === 'user' ? 'text-primary-foreground/60' : 'text-muted-foreground/60'
                      )}
                    >
                      {message.timestamp.toLocaleTimeString('es-AR', {
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </span>

                    {/* Fuentes/Referencias */}
                    {message.sources && message.sources.length > 0 && (
                      <div className="mt-2 pt-2 border-t border-border/50">
                        <p className="text-xs font-medium mb-1 opacity-70">Referencias:</p>
                        <div className="space-y-1">
                          {message.sources.map((source, idx) => (
                            <a
                              key={idx}
                              href={source.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-1 text-xs text-primary hover:underline"
                            >
                              <ExternalLink className="h-3 w-3" />
                              {source.title}
                            </a>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Preview de acción */}
                    {message.action && (
                      <div className="mt-2 pt-2 border-t border-border/50">
                        <p className="text-xs font-medium mb-2">Acción pendiente:</p>
                        <div className="flex gap-2">
                          <Button size="sm" variant="default" className="text-xs h-7">
                            Confirmar
                          </Button>
                          <Button size="sm" variant="outline" className="text-xs h-7">
                            Cancelar
                          </Button>
                        </div>
                      </div>
                    )}

                    {/* Selección interactiva de fallas */}
                    {message.interactiveSelection?.type === 'failure_selection' && (
                      <div className="mt-3 pt-3 border-t border-border/50">
                        <p className="text-xs font-medium mb-3 opacity-70">
                          Fallas activas en {message.interactiveSelection.machineName}:
                        </p>
                        <div className="space-y-2">
                          {message.interactiveSelection.failures.map((failure) => {
                            const priorityColor = {
                              'CRITICAL': 'border-destructive bg-destructive/10',
                              'HIGH': 'border-warning bg-warning/10',
                              'MEDIUM': 'border-warning bg-warning/10',
                              'LOW': 'border-success bg-success/10',
                            }[failure.priority] || 'border-border'

                            const priorityEmoji = {
                              'CRITICAL': '🔴',
                              'HIGH': '🟠',
                              'MEDIUM': '🟡',
                              'LOW': '🟢',
                            }[failure.priority] || '⚪'

                            return (
                              <button
                                key={failure.id}
                                onClick={() => handleFailureSelect(
                                  failure,
                                  message.interactiveSelection!.machineId,
                                  message.interactiveSelection!.machineName
                                )}
                                disabled={isLoading}
                                className={cn(
                                  "w-full text-left p-3 rounded-lg border-2 transition-all",
                                  "hover:shadow-md hover:scale-[1.01]",
                                  "disabled:opacity-50 disabled:cursor-not-allowed",
                                  priorityColor
                                )}
                              >
                                <div className="flex items-start gap-2">
                                  <span className="text-lg">{priorityEmoji}</span>
                                  <div className="flex-1 min-w-0">
                                    <p className="font-medium text-sm">
                                      [#{failure.id}] {failure.title}
                                    </p>
                                    {failure.componentName && (
                                      <p className="text-xs text-muted-foreground mt-0.5">
                                        📍 {failure.componentName}
                                        {failure.subcomponentName && ` → ${failure.subcomponentName}`}
                                      </p>
                                    )}
                                    {failure.description && (
                                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                                        {failure.description}
                                      </p>
                                    )}
                                    <div className="flex items-center gap-2 mt-1.5">
                                      <span className="text-xs px-1.5 py-0.5 rounded bg-background/50">
                                        {failure.status}
                                      </span>
                                      {failure.failureCategory && (
                                        <span className="text-xs text-muted-foreground">
                                          {failure.failureCategory}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              </button>
                            )
                          })}
                        </div>
                        {message.interactiveSelection.failures.length === 0 && (
                          <p className="text-sm text-muted-foreground text-center py-2">
                            No hay fallas activas registradas.
                          </p>
                        )}
                      </div>
                    )}

                    {/* Preguntas de seguimiento */}
                    {message.followUpQuestions && message.followUpQuestions.length > 0 && (
                      <div className="mt-2 pt-2 border-t border-border/50">
                        <p className="text-xs font-medium mb-2 opacity-70">Preguntas sugeridas:</p>
                        <div className="space-y-1">
                          {message.followUpQuestions.map((question, idx) => (
                            <button
                              key={idx}
                              onClick={() => sendMessage(question)}
                              disabled={isLoading}
                              className="block w-full text-left text-xs px-2 py-1.5 rounded bg-background/50 hover:bg-background border border-border/30 hover:border-border transition-colors disabled:opacity-50"
                            >
                              {question}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                  {message.role === 'user' && (
                    <div className="flex-shrink-0 w-7 h-7 rounded-full bg-primary flex items-center justify-center mt-0.5">
                      <User className="h-4 w-4 text-primary-foreground" />
                    </div>
                  )}
                </div>
              )})}


              {/* Indicador de escribiendo */}
              {isLoading && messages.length > 0 && messages[messages.length - 1].role === 'assistant' && messages[messages.length - 1].content === '' && (
                <div className="flex gap-2 justify-start">
                  <div className="flex-shrink-0 w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center mt-0.5">
                    <Bot className="h-4 w-4 text-primary" />
                  </div>
                  <div className="bg-muted rounded-xl px-3 py-2">
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground">Pensando</span>
                      <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
            </ScrollArea>
          </div>
        </div>

        {/* Input */}
        <div className="border-t">
          {/* Sugerencias */}
          {showSuggestions && filteredSuggestions.length > 0 && (
            <div className="border-b bg-muted/30 p-2">
              <div className="space-y-0.5">
                {filteredSuggestions.map((suggestion, idx) => (
                  <button
                    key={idx}
                    onClick={() => selectSuggestion(suggestion)}
                    className={cn(
                      "w-full text-left px-3 py-2 rounded-lg text-sm transition-colors",
                      idx === selectedSuggestionIndex
                        ? "bg-primary text-primary-foreground"
                        : "hover:bg-muted"
                    )}
                  >
                    {suggestion.text}
                  </button>
                ))}
              </div>
              <p className="text-xs text-muted-foreground mt-2 px-1">
                ↑↓ navegar • Tab completar • Enter enviar
              </p>
            </div>
          )}

          {/* Chips rápidos */}
          {messages.length > 0 && !showSuggestions && (
            <div className="px-3 pt-2 pb-1 flex gap-1.5 overflow-x-auto">
              {QUICK_ACTIONS.slice(0, 3).map((action, idx) => (
                <button
                  key={idx}
                  onClick={() => sendMessage(action.query)}
                  disabled={isLoading}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-muted text-xs whitespace-nowrap hover:bg-muted/80 disabled:opacity-50"
                >
                  <action.icon className="h-3 w-3" />
                  {action.label}
                </button>
              ))}
            </div>
          )}

          <form onSubmit={handleSubmit} className="p-3 pt-2">
            {/* Preview de imagen */}
            {attachedImage && (
              <div className="mb-2 relative inline-block">
                <img
                  src={attachedImage.preview}
                  alt="Preview"
                  className="h-16 w-16 object-cover rounded-lg border"
                />
                <button
                  type="button"
                  onClick={removeAttachedImage}
                  className="absolute -top-1.5 -right-1.5 p-1 rounded-full bg-destructive text-destructive-foreground shadow"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            )}

            <div className="flex gap-1.5">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleImageSelect}
                className="hidden"
              />

              <Input
                ref={inputRef}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={handleInputKeyDown}
                onFocus={() => filteredSuggestions.length > 0 && setShowSuggestions(true)}
                onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                placeholder={attachedImage ? "Describe la imagen..." : "Escribí tu pregunta..."}
                disabled={isLoading}
                className="flex-1"
              />

              <Button
                type="button"
                variant="ghost"
                size="icon"
                disabled={isLoading}
                onClick={() => fileInputRef.current?.click()}
                title="Adjuntar imagen"
                className="h-9 w-9"
              >
                <ImagePlus className="h-4 w-4" />
              </Button>

              <Button
                type="button"
                variant="ghost"
                size="icon"
                disabled={isLoading || isTranscribing}
                onClick={toggleRecording}
                className={cn(
                  "h-9 w-9",
                  isRecording && 'bg-destructive/10 text-destructive',
                  isTranscribing && 'bg-warning-muted text-warning-muted-foreground'
                )}
                title={isTranscribing ? 'Transcribiendo...' : isRecording ? 'Detener' : 'Grabar'}
              >
                {isTranscribing ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : isRecording ? (
                  <MicOff className="h-4 w-4" />
                ) : (
                  <Mic className="h-4 w-4" />
                )}
              </Button>

              <Button
                type="submit"
                size="icon"
                disabled={isLoading || (!inputValue.trim() && !attachedImage)}
                className="h-9 w-9"
              >
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </>
  )
}
