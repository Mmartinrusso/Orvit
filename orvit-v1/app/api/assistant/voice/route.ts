// ============================================
// API de Voz del Asistente IA
// ============================================

import { NextRequest, NextResponse } from 'next/server'
import { getAssistantContext } from '@/lib/assistant/auth'
import { transcribeAudio } from '@/lib/assistant/engine'
import { requireAuth } from '@/lib/auth/shared-helpers'

export const dynamic = 'force-dynamic'

// Tamaño máximo de archivo de audio (10MB)
const MAX_FILE_SIZE = 10 * 1024 * 1024

/**
 * POST /api/assistant/voice
 * Transcribe audio a texto usando Whisper
 */
export async function POST(request: NextRequest) {
  const { error } = await requireAuth()
  if (error) return error

  try {
    // 1. Verificar autenticación
    const context = await getAssistantContext()
    if (!context) {
      return NextResponse.json(
        { error: 'No autorizado' },
        { status: 401 }
      )
    }

    // 2. Obtener el archivo de audio
    const formData = await request.formData()
    const audioFile = formData.get('audio') as File | null

    if (!audioFile) {
      return NextResponse.json(
        { error: 'No se proporcionó archivo de audio' },
        { status: 400 }
      )
    }

    // 3. Validar tamaño
    if (audioFile.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: 'El archivo es demasiado grande. Máximo 10MB.' },
        { status: 400 }
      )
    }

    // 4. Validar tipo
    const validTypes = ['audio/webm', 'audio/mp4', 'audio/mpeg', 'audio/wav', 'audio/ogg']
    if (!validTypes.some(t => audioFile.type.startsWith(t.split('/')[0]))) {
      return NextResponse.json(
        { error: 'Formato de audio no soportado' },
        { status: 400 }
      )
    }

    // 5. Convertir a buffer
    const arrayBuffer = await audioFile.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    // 6. Transcribir
    const startTime = Date.now()
    const transcript = await transcribeAudio(buffer, audioFile.type)
    const processingTime = Date.now() - startTime

    return NextResponse.json({
      success: true,
      transcript,
      processingTimeMs: processingTime,
      audioSizeBytes: audioFile.size,
    })
  } catch (error) {
    console.error('Error transcribiendo audio:', error)
    return NextResponse.json(
      { error: 'Error al transcribir el audio' },
      { status: 500 }
    )
  }
}
