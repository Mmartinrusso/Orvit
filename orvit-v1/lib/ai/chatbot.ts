/**
 * AI Chatbot Service
 *
 * Intelligent customer service chatbot using OpenAI GPT-4 with function calling
 * Provides 24/7 automated support for common queries
 */

import OpenAI from 'openai';
import prisma from '@/lib/prisma';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface ChatbotContext {
  companyId: number;
  userId?: number;
  clientId?: number;
  sessionId: string;
  language?: string;
}

export interface ChatbotResponse {
  message: string;
  functionCalls?: Array<{
    name: string;
    arguments: any;
    result: any;
  }>;
  requiresHuman?: boolean;
  sentiment?: 'positive' | 'neutral' | 'negative';
}

// ═══════════════════════════════════════════════════════════════════════════
// FUNCTION TOOLS
// ═══════════════════════════════════════════════════════════════════════════

const CHATBOT_TOOLS: OpenAI.Chat.Completions.ChatCompletionTool[] = [
  {
    type: 'function',
    function: {
      name: 'get_order_status',
      description: 'Obtiene el estado actual de una orden de venta',
      parameters: {
        type: 'object',
        properties: {
          orderNumber: {
            type: 'string',
            description: 'Número de orden de venta (e.g., OV-00123)',
          },
        },
        required: ['orderNumber'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_client_balance',
      description: 'Obtiene el saldo de cuenta corriente de un cliente',
      parameters: {
        type: 'object',
        properties: {
          clientId: {
            type: 'number',
            description: 'ID del cliente (opcional si ya está en contexto)',
          },
        },
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_invoice_details',
      description: 'Obtiene detalles de una factura específica',
      parameters: {
        type: 'object',
        properties: {
          invoiceNumber: {
            type: 'string',
            description: 'Número de factura (e.g., FC-A-00123)',
          },
        },
        required: ['invoiceNumber'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_pending_deliveries',
      description: 'Obtiene entregas pendientes del cliente',
      parameters: {
        type: 'object',
        properties: {
          clientId: {
            type: 'number',
            description: 'ID del cliente (opcional si ya está en contexto)',
          },
        },
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'search_products',
      description: 'Busca productos en el catálogo',
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'Término de búsqueda para productos',
          },
          limit: {
            type: 'number',
            description: 'Cantidad máxima de resultados (default: 5)',
          },
        },
        required: ['query'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'create_support_ticket',
      description: 'Crea un ticket de soporte cuando el chatbot no puede resolver la consulta',
      parameters: {
        type: 'object',
        properties: {
          subject: {
            type: 'string',
            description: 'Asunto del ticket',
          },
          description: {
            type: 'string',
            description: 'Descripción detallada del problema',
          },
          priority: {
            type: 'string',
            enum: ['LOW', 'MEDIUM', 'HIGH', 'URGENT'],
            description: 'Prioridad del ticket',
          },
        },
        required: ['subject', 'description'],
      },
    },
  },
];

// ═══════════════════════════════════════════════════════════════════════════
// FUNCTION IMPLEMENTATIONS
// ═══════════════════════════════════════════════════════════════════════════

async function getOrderStatus(orderNumber: string, context: ChatbotContext) {
  const order = await prisma.sale.findFirst({
    where: {
      numero: orderNumber,
      companyId: context.companyId,
      ...(context.clientId && { clientId: context.clientId }),
    },
    include: {
      client: { select: { legalName: true } },
      items: {
        select: {
          product: { select: { name: true } },
          cantidad: true,
          precioUnitario: true,
        },
      },
    },
  });

  if (!order) {
    return { error: 'Orden no encontrada' };
  }

  return {
    numero: order.numero,
    fecha: order.fecha,
    estado: order.estado,
    cliente: order.client.legalName,
    total: order.total,
    itemsCount: order.items.length,
    items: order.items.slice(0, 3).map(i => ({
      producto: i.product?.name,
      cantidad: i.cantidad,
      precio: i.precioUnitario,
    })),
  };
}

async function getClientBalance(clientId: number | undefined, context: ChatbotContext) {
  const effectiveClientId = clientId || context.clientId;

  if (!effectiveClientId) {
    return { error: 'ID de cliente no proporcionado' };
  }

  const client = await prisma.client.findFirst({
    where: {
      id: effectiveClientId,
      companyId: context.companyId,
    },
    select: {
      legalName: true,
      cuentaCorrienteSaldo: true,
      cuentaCorrienteLimite: true,
    },
  });

  if (!client) {
    return { error: 'Cliente no encontrado' };
  }

  // Get pending invoices
  const pendingInvoices = await prisma.saleInvoice.findMany({
    where: {
      clientId: effectiveClientId,
      companyId: context.companyId,
      estado: { in: ['PENDIENTE', 'PARCIAL'] },
    },
    select: {
      numero: true,
      fecha: true,
      total: true,
      saldoPendiente: true,
    },
    orderBy: { fecha: 'asc' },
    take: 5,
  });

  return {
    cliente: client.legalName,
    saldoActual: client.cuentaCorrienteSaldo,
    limiteCredito: client.cuentaCorrienteLimite,
    disponible: (client.cuentaCorrienteLimite || 0) - (client.cuentaCorrienteSaldo || 0),
    facturasPendientes: pendingInvoices.length,
    detalleFacturas: pendingInvoices,
  };
}

async function getInvoiceDetails(invoiceNumber: string, context: ChatbotContext) {
  const invoice = await prisma.saleInvoice.findFirst({
    where: {
      numero: invoiceNumber,
      companyId: context.companyId,
      ...(context.clientId && { clientId: context.clientId }),
    },
    include: {
      client: { select: { legalName: true } },
      items: {
        select: {
          product: { select: { name: true } },
          cantidad: true,
          precioUnitario: true,
          subtotal: true,
        },
      },
      pagos: {
        select: {
          fecha: true,
          monto: true,
          metodoPago: true,
        },
      },
    },
  });

  if (!invoice) {
    return { error: 'Factura no encontrada' };
  }

  return {
    numero: invoice.numero,
    fecha: invoice.fecha,
    estado: invoice.estado,
    cliente: invoice.client.legalName,
    subtotal: invoice.subtotal,
    iva: invoice.iva,
    total: invoice.total,
    saldoPendiente: invoice.saldoPendiente,
    items: invoice.items.map(i => ({
      producto: i.product?.name,
      cantidad: i.cantidad,
      precioUnitario: i.precioUnitario,
      subtotal: i.subtotal,
    })),
    pagos: invoice.pagos,
    cae: invoice.cae,
    caeFechaVencimiento: invoice.caeFechaVencimiento,
  };
}

async function getPendingDeliveries(clientId: number | undefined, context: ChatbotContext) {
  const effectiveClientId = clientId || context.clientId;

  if (!effectiveClientId) {
    return { error: 'ID de cliente no proporcionado' };
  }

  const deliveries = await prisma.saleDelivery.findMany({
    where: {
      companyId: context.companyId,
      sale: { clientId: effectiveClientId },
      estado: { in: ['PENDIENTE', 'EN_PREPARACION', 'EN_TRANSITO'] },
    },
    include: {
      sale: { select: { numero: true } },
    },
    orderBy: { fechaProgramada: 'asc' },
    take: 10,
  });

  return {
    cantidadPendientes: deliveries.length,
    entregas: deliveries.map(d => ({
      numero: d.numero,
      ordenVenta: d.sale?.numero,
      estado: d.estado,
      fechaProgramada: d.fechaProgramada,
      direccion: d.direccionEntrega,
      tipo: d.tipo,
    })),
  };
}

async function searchProducts(query: string, limit: number = 5, context: ChatbotContext) {
  const products = await prisma.product.findMany({
    where: {
      companyId: context.companyId,
      isActive: true,
      OR: [
        { code: { contains: query, mode: 'insensitive' } },
        { name: { contains: query, mode: 'insensitive' } },
        { description: { contains: query, mode: 'insensitive' } },
      ],
    },
    select: {
      code: true,
      name: true,
      description: true,
      stockActual: true,
      precioVenta: true,
    },
    take: limit,
  });

  return {
    cantidadResultados: products.length,
    productos: products,
  };
}

async function createSupportTicket(
  subject: string,
  description: string,
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT' = 'MEDIUM',
  context: ChatbotContext
) {
  // Create support ticket (assuming a SupportTicket model exists or will be created)
  // For now, we'll create a work order as a placeholder

  const ticket = await prisma.workOrder.create({
    data: {
      codigo: `TICKET-${Date.now()}`,
      titulo: subject,
      descripcion: description,
      prioridad: priority,
      companyId: context.companyId,
      estado: 'pendiente',
      // Link to client if available
      ...(context.clientId && {
        observaciones: `Cliente ID: ${context.clientId}\nGenerado por chatbot AI`
      }),
    },
  });

  return {
    ticketId: ticket.id,
    codigo: ticket.codigo,
    mensaje: 'Ticket de soporte creado. Un representante se contactará pronto.',
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// FUNCTION ROUTER
// ═══════════════════════════════════════════════════════════════════════════

async function executeFunctionCall(
  functionName: string,
  functionArgs: any,
  context: ChatbotContext
): Promise<any> {
  switch (functionName) {
    case 'get_order_status':
      return await getOrderStatus(functionArgs.orderNumber, context);

    case 'get_client_balance':
      return await getClientBalance(functionArgs.clientId, context);

    case 'get_invoice_details':
      return await getInvoiceDetails(functionArgs.invoiceNumber, context);

    case 'get_pending_deliveries':
      return await getPendingDeliveries(functionArgs.clientId, context);

    case 'search_products':
      return await searchProducts(functionArgs.query, functionArgs.limit, context);

    case 'create_support_ticket':
      return await createSupportTicket(
        functionArgs.subject,
        functionArgs.description,
        functionArgs.priority,
        context
      );

    default:
      return { error: `Función desconocida: ${functionName}` };
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// CHATBOT SERVICE
// ═══════════════════════════════════════════════════════════════════════════

export class ChatbotService {
  private context: ChatbotContext;
  private conversationHistory: ChatMessage[] = [];

  constructor(context: ChatbotContext) {
    this.context = context;

    // System prompt
    this.conversationHistory.push({
      role: 'system',
      content: this.buildSystemPrompt(),
    });
  }

  private buildSystemPrompt(): string {
    const language = this.context.language || 'es';

    return `Eres un asistente virtual inteligente de atención al cliente para un sistema ERP empresarial.

TU ROL:
- Ayudar a clientes y usuarios con consultas sobre órdenes, facturas, entregas y productos
- Ser amable, profesional y eficiente
- Usar las funciones disponibles para obtener información en tiempo real
- Escalar a un humano cuando sea necesario

CAPACIDADES:
- Consultar estado de órdenes de venta
- Verificar saldo de cuenta corriente
- Obtener detalles de facturas
- Consultar entregas pendientes
- Buscar productos en el catálogo
- Crear tickets de soporte

DIRECTRICES:
- Responde en ${language === 'es' ? 'español' : 'inglés'}
- Sé conciso pero completo
- Si no tienes información, ofrece crear un ticket de soporte
- Para consultas complejas o quejas graves, deriva a un humano
- Siempre confirma números de documento antes de buscar
- Formatea números de moneda en formato argentino (ej: $1.234,56)

LIMITACIONES:
- NO puedes modificar datos (órdenes, facturas, precios)
- NO puedes procesar pagos
- NO puedes cancelar órdenes
- Para estas acciones, deriva a un humano

TONO:
Profesional pero cercano. Usa "usted" para clientes externos.`;
  }

  async chat(userMessage: string): Promise<ChatbotResponse> {
    // Add user message to history
    this.conversationHistory.push({
      role: 'user',
      content: userMessage,
    });

    let response: OpenAI.Chat.Completions.ChatCompletion;
    let functionCalls: Array<{ name: string; arguments: any; result: any }> = [];
    let requiresHuman = false;

    try {
      // First API call
      response = await openai.chat.completions.create({
        model: 'gpt-4-turbo-preview',
        messages: this.conversationHistory as any,
        tools: CHATBOT_TOOLS,
        tool_choice: 'auto',
        temperature: 0.7,
        max_tokens: 800,
      });

      let assistantMessage = response.choices[0].message;

      // Handle function calls
      while (assistantMessage.tool_calls && assistantMessage.tool_calls.length > 0) {
        // Add assistant message with tool calls to history
        this.conversationHistory.push(assistantMessage as any);

        // Execute each function call
        for (const toolCall of assistantMessage.tool_calls) {
          const functionName = toolCall.function.name;
          const functionArgs = JSON.parse(toolCall.function.arguments);

          console.log(`[Chatbot] Executing function: ${functionName}`, functionArgs);

          const functionResult = await executeFunctionCall(
            functionName,
            functionArgs,
            this.context
          );

          functionCalls.push({
            name: functionName,
            arguments: functionArgs,
            result: functionResult,
          });

          // Add function result to conversation
          this.conversationHistory.push({
            role: 'assistant',
            content: JSON.stringify(functionResult),
          });

          // Check if support ticket was created (escalation signal)
          if (functionName === 'create_support_ticket') {
            requiresHuman = true;
          }
        }

        // Get next response from GPT with function results
        response = await openai.chat.completions.create({
          model: 'gpt-4-turbo-preview',
          messages: this.conversationHistory as any,
          tools: CHATBOT_TOOLS,
          tool_choice: 'auto',
          temperature: 0.7,
          max_tokens: 800,
        });

        assistantMessage = response.choices[0].message;
      }

      // Final assistant message
      const finalMessage = assistantMessage.content || '';

      this.conversationHistory.push({
        role: 'assistant',
        content: finalMessage,
      });

      // Analyze sentiment
      const sentiment = this.analyzeSentiment(userMessage);

      return {
        message: finalMessage,
        functionCalls: functionCalls.length > 0 ? functionCalls : undefined,
        requiresHuman,
        sentiment,
      };

    } catch (error: any) {
      console.error('[Chatbot] Error:', error);

      return {
        message: 'Disculpe, experimenté un problema técnico. ¿Podría reformular su pregunta?',
        requiresHuman: true,
        sentiment: 'neutral',
      };
    }
  }

  private analyzeSentiment(message: string): 'positive' | 'neutral' | 'negative' {
    const lowerMessage = message.toLowerCase();

    const negativeWords = ['problema', 'error', 'mal', 'reclamo', 'queja', 'enojado', 'molesto', 'nunca', 'terrible'];
    const positiveWords = ['gracias', 'excelente', 'perfecto', 'bien', 'genial', 'bueno'];

    const negativeCount = negativeWords.filter(word => lowerMessage.includes(word)).length;
    const positiveCount = positiveWords.filter(word => lowerMessage.includes(word)).length;

    if (negativeCount > positiveCount) return 'negative';
    if (positiveCount > negativeCount) return 'positive';
    return 'neutral';
  }

  getConversationHistory(): ChatMessage[] {
    return this.conversationHistory;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// FACTORY
// ═══════════════════════════════════════════════════════════════════════════

export function createChatbot(context: ChatbotContext): ChatbotService {
  return new ChatbotService(context);
}
