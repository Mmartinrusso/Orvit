/**
 * AI Chatbot API
 *
 * Handles chat interactions with the intelligent customer service bot
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyJWT } from '@/lib/auth';
import { createChatbot } from '@/lib/ai/chatbot';
import prisma from '@/lib/prisma';
import { z } from 'zod';
import { requireAuth } from '@/lib/auth/shared-helpers';

export const dynamic = 'force-dynamic';

// ═══════════════════════════════════════════════════════════════════════════
// VALIDATION SCHEMAS
// ═══════════════════════════════════════════════════════════════════════════

const chatRequestSchema = z.object({
  message: z.string().min(1).max(2000),
  sessionId: z.string().optional(),
  language: z.enum(['es', 'en']).optional().default('es'),
});

// ═══════════════════════════════════════════════════════════════════════════
// POST - Send Message to Chatbot
// ═══════════════════════════════════════════════════════════════════════════

export async function POST(req: NextRequest) {
  const { error } = await requireAuth();
  if (error) return error;

  try {
    // Get user from JWT
    const token = req.cookies.get('token')?.value;
    let user: any = null;
    let clientId: number | undefined = undefined;

    if (token) {
      try {
        user = await verifyJWT(token);
      } catch {
        // Continue as anonymous
      }
    }

    // Parse request
    const body = await req.json();
    const validation = chatRequestSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Datos inválidos', details: validation.error.issues },
        { status: 400 }
      );
    }

    const { message, sessionId, language } = validation.data;

    // Get or create company ID (for multi-tenant)
    // If no user, try to get from public client portal
    let companyId = user?.companyId || 1; // Default to company 1 for demo

    // If user is a client (portal), get their client ID
    if (user && user.clientId) {
      clientId = user.clientId;
    }

    // Get or create chat session
    let session;
    if (sessionId) {
      session = await prisma.chatSession.findUnique({
        where: { id: sessionId },
      });
    }

    if (!session) {
      session = await prisma.chatSession.create({
        data: {
          id: sessionId || `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          companyId,
          userId: user?.id,
          clientId,
          language,
          metadata: {},
        },
      });
    }

    // Load conversation history
    const previousMessages = await prisma.chatMessage.findMany({
      where: { sessionId: session.id },
      orderBy: { createdAt: 'asc' },
      take: 20, // Last 20 messages for context
    });

    // Create chatbot instance
    const chatbot = createChatbot({
      companyId,
      userId: user?.id,
      clientId,
      sessionId: session.id,
      language,
    });

    // If there's history, rebuild conversation
    for (const msg of previousMessages) {
      chatbot.getConversationHistory().push({
        role: msg.role as 'user' | 'assistant' | 'system',
        content: msg.content,
      });
    }

    // Get response
    const response = await chatbot.chat(message);

    // Save user message
    await prisma.chatMessage.create({
      data: {
        sessionId: session.id,
        role: 'user',
        content: message,
      },
    });

    // Save assistant response
    await prisma.chatMessage.create({
      data: {
        sessionId: session.id,
        role: 'assistant',
        content: response.message,
        metadata: {
          functionCalls: response.functionCalls,
          sentiment: response.sentiment,
        },
      },
    });

    // Update session metadata
    await prisma.chatSession.update({
      where: { id: session.id },
      data: {
        lastMessageAt: new Date(),
        metadata: {
          lastSentiment: response.sentiment,
          requiresHuman: response.requiresHuman,
          messageCount: previousMessages.length + 2,
        },
      },
    });

    // If requires human intervention, create notification
    if (response.requiresHuman) {
      // TODO: Create notification for support team
      console.log(`[Chatbot] Human intervention required for session ${session.id}`);
    }

    return NextResponse.json({
      success: true,
      sessionId: session.id,
      message: response.message,
      requiresHuman: response.requiresHuman,
      sentiment: response.sentiment,
      timestamp: new Date().toISOString(),
    });

  } catch (error: any) {
    console.error('Error in chatbot API:', error);
    return NextResponse.json(
      { error: 'Error al procesar mensaje', details: error.message },
      { status: 500 }
    );
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// GET - Get Chat History
// ═══════════════════════════════════════════════════════════════════════════

export async function GET(req: NextRequest) {
  const { error: getError } = await requireAuth();
  if (getError) return getError;

  try {
    const { searchParams } = new URL(req.url);
    const sessionId = searchParams.get('sessionId');

    if (!sessionId) {
      return NextResponse.json(
        { error: 'sessionId requerido' },
        { status: 400 }
      );
    }

    const session = await prisma.chatSession.findUnique({
      where: { id: sessionId },
      include: {
        messages: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!session) {
      return NextResponse.json(
        { error: 'Sesión no encontrada' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      sessionId: session.id,
      createdAt: session.createdAt,
      lastMessageAt: session.lastMessageAt,
      language: session.language,
      messages: session.messages.map(msg => ({
        role: msg.role,
        content: msg.content,
        createdAt: msg.createdAt,
        metadata: msg.metadata,
      })),
      metadata: session.metadata,
    });

  } catch (error: any) {
    console.error('Error fetching chat history:', error);
    return NextResponse.json(
      { error: 'Error al obtener historial', details: error.message },
      { status: 500 }
    );
  }
}
