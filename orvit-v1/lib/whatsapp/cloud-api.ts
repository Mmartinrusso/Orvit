/**
 * WhatsApp Business Cloud API Client (Meta)
 *
 * Sends messages via the official Meta Graph API.
 * Docs: https://developers.facebook.com/docs/whatsapp/cloud-api
 *
 * IMPORTANT: sendTextMessage() enforces the 24-hour conversation window.
 * If the window is closed, it throws WhatsAppWindowClosedError — callers must catch it.
 * sendTemplateMessage() does NOT enforce the window (templates always go through).
 */

import { prisma } from '@/lib/prisma';
import {
  canSendMessage,
  WhatsAppWindowClosedError,
} from './conversation-window';

// Re-export for convenience
export { WhatsAppWindowClosedError } from './conversation-window';

const WHATSAPP_ACCESS_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN;
const WHATSAPP_PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID;
const WHATSAPP_API_VERSION = process.env.WHATSAPP_API_VERSION || 'v21.0';

const BASE_URL = `https://graph.facebook.com/${WHATSAPP_API_VERSION}`;

// =====================================================
// TYPES
// =====================================================

export interface WhatsAppTextMessage {
  to: string;
  body: string;
  companyId?: number;
  sentByUserId?: number;
  triggerSource?: string;
}

export interface WhatsAppTemplateMessage {
  to: string;
  templateName: string;
  languageCode?: string;
  components?: WhatsAppTemplateComponent[];
  companyId?: number;
  sentByUserId?: number;
  triggerSource?: string;
}

export interface WhatsAppTemplateComponent {
  type: 'header' | 'body' | 'button';
  parameters: Array<{
    type: 'text' | 'currency' | 'date_time' | 'image' | 'document';
    text?: string;
    currency?: { fallback_value: string; code: string; amount_1000: number };
    date_time?: { fallback_value: string };
  }>;
}

export interface WhatsAppApiResponse {
  messaging_product: string;
  contacts: Array<{ input: string; wa_id: string }>;
  messages: Array<{ id: string }>;
}

export interface WhatsAppApiError {
  error: {
    message: string;
    type: string;
    code: number;
    error_subcode?: number;
    fbtrace_id: string;
  };
}

// =====================================================
// CONFIG CHECK
// =====================================================

export function isWhatsAppConfigured(): boolean {
  return !!(WHATSAPP_ACCESS_TOKEN && WHATSAPP_PHONE_NUMBER_ID);
}

/**
 * Normalize phone number to WhatsApp format (no +, no spaces, with country code)
 */
function normalizePhone(phone: string): string {
  let cleaned = phone.replace(/[^\d]/g, '');

  // If Argentine number without country code, add 549
  if (cleaned.length === 10 && !cleaned.startsWith('54')) {
    cleaned = `549${cleaned}`;
  }
  // If starts with 0 (local format), remove 0 and add 549
  if (cleaned.startsWith('0') && cleaned.length === 11) {
    cleaned = `549${cleaned.substring(1)}`;
  }

  return cleaned;
}

// =====================================================
// SEND FUNCTIONS
// =====================================================

/**
 * Send a text message via WhatsApp Cloud API.
 *
 * ENFORCES 24h window: throws WhatsAppWindowClosedError if the contact
 * hasn't written to us in the last 24 hours.
 */
export async function sendTextMessage(
  msg: WhatsAppTextMessage
): Promise<WhatsAppApiResponse> {
  if (!isWhatsAppConfigured()) {
    throw new Error('WhatsApp Cloud API no está configurada. Verificar WHATSAPP_ACCESS_TOKEN y WHATSAPP_PHONE_NUMBER_ID en .env');
  }

  const to = normalizePhone(msg.to);

  // --- 24h Window Guard ---
  if (msg.companyId) {
    const windowCheck = await canSendMessage(msg.companyId, to);
    if (!windowCheck.allowed) {
      throw new WhatsAppWindowClosedError(
        windowCheck.reason || 'Ventana cerrada',
        windowCheck.windowExpiresAt
      );
    }
  }

  // --- Send via Meta API ---
  const response = await fetch(
    `${BASE_URL}/${WHATSAPP_PHONE_NUMBER_ID}/messages`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${WHATSAPP_ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to,
        type: 'text',
        text: { preview_url: false, body: msg.body },
      }),
    }
  );

  const data = await response.json();

  if (!response.ok) {
    const error = data as WhatsAppApiError;
    console.error('[WHATSAPP] Error sending message:', error);

    // Log failed message to DB
    if (msg.companyId) {
      await logOutboundMessage(msg.companyId, to, {
        body: msg.body,
        status: 'failed',
        errorCode: String(error.error?.code || ''),
        errorMessage: error.error?.message || 'Unknown error',
        sentByUserId: msg.sentByUserId,
        triggerSource: msg.triggerSource,
      });
    }

    throw new Error(
      `WhatsApp API Error (${error.error?.code}): ${error.error?.message}`
    );
  }

  const apiResponse = data as WhatsAppApiResponse;
  console.log('[WHATSAPP] Message sent successfully:', apiResponse);

  // Log successful message to DB
  if (msg.companyId) {
    await logOutboundMessage(msg.companyId, to, {
      waMessageId: apiResponse.messages?.[0]?.id,
      body: msg.body,
      status: 'sent',
      sentByUserId: msg.sentByUserId,
      triggerSource: msg.triggerSource,
    });
  }

  return apiResponse;
}

/**
 * Send a template message via WhatsApp Cloud API.
 * Templates are NOT subject to the 24h window — they can be sent anytime.
 * But we still log them to the DB for audit purposes.
 */
export async function sendTemplateMessage(
  msg: WhatsAppTemplateMessage
): Promise<WhatsAppApiResponse> {
  if (!isWhatsAppConfigured()) {
    throw new Error('WhatsApp Cloud API no está configurada');
  }

  const to = normalizePhone(msg.to);

  const payload: Record<string, any> = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to,
    type: 'template',
    template: {
      name: msg.templateName,
      language: { code: msg.languageCode || 'es_AR' },
    },
  };

  if (msg.components && msg.components.length > 0) {
    payload.template.components = msg.components;
  }

  const response = await fetch(
    `${BASE_URL}/${WHATSAPP_PHONE_NUMBER_ID}/messages`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${WHATSAPP_ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    }
  );

  const data = await response.json();

  if (!response.ok) {
    const error = data as WhatsAppApiError;
    console.error('[WHATSAPP] Error sending template:', error);

    if (msg.companyId) {
      await logOutboundMessage(msg.companyId, to, {
        templateName: msg.templateName,
        messageType: 'template',
        status: 'failed',
        errorCode: String(error.error?.code || ''),
        errorMessage: error.error?.message || 'Unknown error',
        sentByUserId: msg.sentByUserId,
        triggerSource: msg.triggerSource,
      });
    }

    throw new Error(
      `WhatsApp API Error (${error.error?.code}): ${error.error?.message}`
    );
  }

  const apiResponse = data as WhatsAppApiResponse;
  console.log('[WHATSAPP] Template sent successfully:', apiResponse);

  if (msg.companyId) {
    await logOutboundMessage(msg.companyId, to, {
      waMessageId: apiResponse.messages?.[0]?.id,
      templateName: msg.templateName,
      messageType: 'template',
      status: 'sent',
      sentByUserId: msg.sentByUserId,
      triggerSource: msg.triggerSource,
    });
  }

  return apiResponse;
}

/**
 * Send the default "hello_world" template (useful for testing)
 */
export async function sendHelloWorldTemplate(
  to: string
): Promise<WhatsAppApiResponse> {
  return sendTemplateMessage({
    to,
    templateName: 'hello_world',
    languageCode: 'en_US',
  });
}

// =====================================================
// DB LOGGING
// =====================================================

interface OutboundLogData {
  waMessageId?: string;
  body?: string;
  templateName?: string;
  messageType?: string;
  status: string;
  errorCode?: string;
  errorMessage?: string;
  sentByUserId?: number;
  triggerSource?: string;
}

async function logOutboundMessage(
  companyId: number,
  phone: string,
  data: OutboundLogData
): Promise<void> {
  try {
    // Get or create conversation for this phone
    let conversation = await prisma.whatsAppConversation.findUnique({
      where: { companyId_phone: { companyId, phone } },
    });

    if (!conversation) {
      conversation = await prisma.whatsAppConversation.create({
        data: {
          companyId,
          phone,
          lastInboundAt: new Date(0), // No inbound yet — window will be closed
        },
      });
    }

    await prisma.whatsAppMessage.create({
      data: {
        companyId,
        conversationId: conversation.id,
        direction: 'OUTBOUND',
        waMessageId: data.waMessageId || null,
        phone,
        messageType: data.messageType || 'text',
        body: data.body || null,
        templateName: data.templateName || null,
        status: data.status,
        errorCode: data.errorCode || null,
        errorMessage: data.errorMessage || null,
        sentByUserId: data.sentByUserId || null,
        triggerSource: data.triggerSource || null,
      },
    });
  } catch (error) {
    // Never let logging failures break the send flow
    console.error('[WHATSAPP] Error logging outbound message:', error);
  }
}
