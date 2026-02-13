import { NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { processCopilotQuery, CopilotContext, CopilotMessage } from '@/lib/ai/copilot-core';

export const dynamic = 'force-dynamic';

/**
 * POST /api/ai/chat
 * Send a message to the AI Copilot
 */
export async function POST(request: Request) {
  try {
    // Verify authentication
    const token = request.headers.get('cookie')?.match(/token=([^;]+)/)?.[1];
    if (!token) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const payload = await verifyToken(token);
    if (!payload) {
      return NextResponse.json({ error: 'Token inválido' }, { status: 401 });
    }

    const body = await request.json();
    const { message, entityType, entityId, history } = body;

    if (!message) {
      return NextResponse.json({ error: 'Message required' }, { status: 400 });
    }

    const context: CopilotContext = {
      companyId: payload.companyId as number,
      userId: payload.userId as number,
      entityType,
      entityId,
    };

    const messageHistory: CopilotMessage[] = history || [];

    const response = await processCopilotQuery(message, context, messageHistory);

    return NextResponse.json(response);
  } catch (error) {
    console.error('AI Chat error:', error);
    return NextResponse.json(
      { error: 'Error processing chat message' },
      { status: 500 }
    );
  }
}
