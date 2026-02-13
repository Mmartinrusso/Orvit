/**
 * API: /api/discord/test-webhook
 *
 * POST - Probar un webhook de Discord
 *        Envía un mensaje de prueba al webhook proporcionado
 */

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth';
import { testDiscordWebhook, isValidDiscordWebhook } from '@/lib/discord';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    // 1. Verificar autenticación
    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;

    if (!token) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }

    const payload = await verifyToken(token);
    if (!payload || !payload.userId) {
      return NextResponse.json({ error: 'Token inválido' }, { status: 401 });
    }

    // 2. Obtener webhook URL del body
    const body = await request.json();
    const { webhookUrl } = body;

    if (!webhookUrl) {
      return NextResponse.json(
        { error: 'Se requiere webhookUrl' },
        { status: 400 }
      );
    }

    // 3. Validar formato del webhook
    if (!isValidDiscordWebhook(webhookUrl)) {
      return NextResponse.json(
        { error: 'URL de webhook inválida. Debe ser una URL de Discord válida.' },
        { status: 400 }
      );
    }

    // 4. Enviar mensaje de prueba
    const result = await testDiscordWebhook(webhookUrl);

    if (result.success) {
      return NextResponse.json({
        success: true,
        message: 'Webhook probado exitosamente. Revisa el canal de Discord.',
      });
    } else {
      return NextResponse.json(
        { error: result.error || 'Error al enviar mensaje de prueba' },
        { status: 400 }
      );
    }

  } catch (error: any) {
    console.error('❌ Error en POST /api/discord/test-webhook:', error);
    return NextResponse.json(
      { error: 'Error al probar webhook', detail: error.message },
      { status: 500 }
    );
  }
}
