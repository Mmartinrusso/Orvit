import { NextResponse } from 'next/server';
import {
  sendTextMessage,
  sendHelloWorldTemplate,
  isWhatsAppConfigured,
} from '@/lib/whatsapp/cloud-api';

export const dynamic = 'force-dynamic';

/**
 * POST /api/whatsapp/test
 *
 * Test WhatsApp Cloud API connection.
 * Body: { to: string, message?: string, useTemplate?: boolean }
 */
export async function POST(req: Request) {
  try {
    if (!isWhatsAppConfigured()) {
      return NextResponse.json(
        {
          success: false,
          error: 'WhatsApp no está configurado. Verificar WHATSAPP_ACCESS_TOKEN y WHATSAPP_PHONE_NUMBER_ID en .env',
        },
        { status: 400 }
      );
    }

    const body = await req.json();
    const { to, message, useTemplate } = body;

    if (!to) {
      return NextResponse.json(
        { success: false, error: 'El campo "to" es requerido (número de teléfono)' },
        { status: 400 }
      );
    }

    let result;

    if (useTemplate) {
      // Send hello_world template (always works, even outside 24h window)
      result = await sendHelloWorldTemplate(to);
    } else if (message) {
      // Send custom text (only works within 24h conversation window)
      result = await sendTextMessage({ to, body: message });
    } else {
      // Default: send hello_world template
      result = await sendHelloWorldTemplate(to);
    }

    return NextResponse.json({
      success: true,
      data: result,
      note: useTemplate || !message
        ? 'Se envió template hello_world. Para mensajes de texto libre, el destinatario debe haberte enviado un mensaje en las últimas 24hs.'
        : 'Mensaje de texto enviado.',
    });
  } catch (error: any) {
    console.error('[WHATSAPP TEST]', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Error desconocido',
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/whatsapp/test
 *
 * Check if WhatsApp is configured
 */
export async function GET() {
  return NextResponse.json({
    configured: isWhatsAppConfigured(),
    phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID ? '***' + process.env.WHATSAPP_PHONE_NUMBER_ID.slice(-4) : null,
    apiVersion: process.env.WHATSAPP_API_VERSION || 'v21.0',
  });
}
