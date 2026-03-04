import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserFromToken } from '@/lib/tasks/auth-helper';
import { transcribeAudio } from '@/lib/assistant/purchase-extractor';
import { sendTaskPushNotification } from '@/lib/agenda/push-notifications';

export const dynamic = 'force-dynamic';

/**
 * POST /api/agenda/tasks/from-voice
 * Receives audio (base64), transcribes it, uses GPT to extract task data,
 * and creates an AgendaTask automatically.
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromToken(request);
    if (!user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { companyId, audioBase64, audioMimeType } = await request.json();

    if (!companyId || !audioBase64) {
      return NextResponse.json(
        { error: 'companyId y audioBase64 son requeridos' },
        { status: 400 }
      );
    }

    // 1. Decode audio and transcribe with Whisper
    const audioBuffer = Buffer.from(audioBase64, 'base64');
    const transcript = await transcribeAudio(audioBuffer, audioMimeType || 'audio/m4a');

    if (!transcript || transcript.trim().length === 0) {
      return NextResponse.json(
        { error: 'No se pudo transcribir el audio' },
        { status: 422 }
      );
    }

    // 2. Use GPT to extract task data from transcription
    const taskData = await extractTaskFromTranscript(transcript);

    // 3. Create the task
    const task = await prisma.agendaTask.create({
      data: {
        title: taskData.title,
        description: taskData.description || `Transcripción: "${transcript}"`,
        dueDate: taskData.dueDate ? new Date(taskData.dueDate) : null,
        priority: taskData.priority || 'MEDIUM',
        category: taskData.category || null,
        status: 'PENDING',
        source: 'VOICE',
        createdById: user.id,
        companyId: Number(companyId),
        assignedToUserId: user.id,
        assignedToName: user.name,
      },
      include: {
        createdBy: { select: { id: true, name: true, avatar: true } },
        assignedToUser: { select: { id: true, name: true, avatar: true } },
        group: { select: { id: true, name: true, color: true, icon: true } },
      },
    });

    // 4. Log activity
    try {
      await prisma.agendaVoiceTaskLog.create({
        data: {
          taskId: task.id,
          userId: user.id,
          companyId: Number(companyId),
          transcript,
          extractedData: taskData as any,
          audioMimeType: audioMimeType || 'audio/m4a',
          status: 'SUCCESS',
        },
      });
    } catch {
      // Voice log table may not exist yet — non-blocking
      console.log('[voice-task] Voice log table not available, skipping log');
    }

    return NextResponse.json({
      task: {
        id: task.id,
        title: task.title,
        description: task.description,
        dueDate: task.dueDate?.toISOString() || null,
        priority: task.priority,
        status: task.status,
        category: task.category,
        createdBy: task.createdBy,
        assignedToUser: task.assignedToUser,
        source: task.source,
        companyId: task.companyId,
        createdAt: task.createdAt.toISOString(),
      },
      transcription: transcript,
    });
  } catch (error: any) {
    console.error('[voice-task] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Error procesando audio' },
      { status: 500 }
    );
  }
}

// ── GPT extraction ──────────────────────────────────────────

async function extractTaskFromTranscript(transcript: string) {
  try {
    const OpenAI = (await import('openai')).default;
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const today = new Date().toISOString().split('T')[0];

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      temperature: 0.1,
      messages: [
        {
          role: 'system',
          content: `Eres un asistente que extrae tareas de transcripciones de audio.
Responde SOLO en JSON con este formato:
{
  "title": "título corto de la tarea (máx 100 chars)",
  "description": "descripción detallada si la hay, o null",
  "priority": "LOW" | "MEDIUM" | "HIGH",
  "dueDate": "YYYY-MM-DD" o null si no se menciona fecha,
  "category": "categoría si se puede inferir" o null
}

Reglas:
- El título debe ser claro y accionable (empezar con verbo)
- Hoy es ${today}
- Si dicen "mañana", calcula la fecha. Si dicen "urgente", prioridad HIGH.
- Si dicen "esta semana", la fecha es el viernes de esta semana.
- Solo devuelve JSON válido, nada más.`,
        },
        {
          role: 'user',
          content: transcript,
        },
      ],
    });

    const text = response.choices[0]?.message?.content?.trim() || '';
    // Extract JSON from possible markdown code blocks
    const jsonStr = text.replace(/```json?\s*/g, '').replace(/```/g, '').trim();
    return JSON.parse(jsonStr);
  } catch (error) {
    console.error('[voice-task] GPT extraction failed:', error);
    // Fallback: use transcript as title
    return {
      title: transcript.slice(0, 100),
      description: transcript,
      priority: 'MEDIUM',
      dueDate: null,
      category: null,
    };
  }
}
