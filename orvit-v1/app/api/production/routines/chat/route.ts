/**
 * Chat API for conversational routine building
 *
 * Interprets natural language requests and returns structured actions
 * to modify the routine template form.
 */

import { NextResponse } from 'next/server';
import { requirePermission } from '@/lib/auth/shared-helpers';
import { PRODUCCION_PERMISSIONS } from '@/lib/permissions';
import 'server-only';

// Types for form items (matching the frontend schema)
interface FormItem {
  id: string;
  question: string;
  type: string;
  required: boolean;
  options?: { id: string; text: string }[];
  unit?: string;
  minValue?: number | null;
  maxValue?: number | null;
  ratingMax?: number;
  conditionalDisplay?: {
    parentItemId: string;
    parentValue: string;
  };
  employeeConfig?: any;
  materialConfig?: any;
}

// Actions the AI can return
type ActionType =
  | { action: 'add_item'; item: Partial<FormItem>; afterIndex?: number }
  | { action: 'modify_item'; index: number; changes: Partial<FormItem> }
  | { action: 'remove_item'; index: number }
  | { action: 'add_option'; itemIndex: number; optionText: string }
  | { action: 'remove_option'; itemIndex: number; optionIndex: number }
  | { action: 'set_conditional'; itemIndex: number; parentIndex: number; parentValue: string }
  | { action: 'remove_conditional'; itemIndex: number }
  | { action: 'reorder'; fromIndex: number; toIndex: number }
  | { action: 'message'; text: string }; // Just a response, no modification

interface ChatResponse {
  actions: ActionType[];
  message: string;
}

// OpenAI client singleton
let openaiClient: any = null;

async function getOpenAIClient() {
  if (!openaiClient) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY no está configurada');
    }
    const OpenAI = (await import('openai')).default;
    openaiClient = new OpenAI({ apiKey });
  }
  return openaiClient;
}

const SYSTEM_PROMPT = `Eres un asistente experto en crear plantillas de rutinas de producción industrial.
El usuario te pide agregar, modificar o eliminar preguntas de un formulario.

TIPOS DE PREGUNTA DISPONIBLES:
- CHECK: Verificación Sí/No
- VALUE: Valor numérico (requiere "unit" como °C, kg, %, mm, bar, etc.)
- TEXT: Texto libre / observaciones
- PHOTO: Subir foto
- SELECT: Selección única (requiere "options" array con textos)
- CHECKBOX: Selección múltiple (requiere "options" array)
- DATE: Fecha
- TIME: Hora
- SIGNATURE: Firma digital
- RATING: Escala 1-5 o 1-10 (usa "ratingMax")
- EMPLOYEE_SELECT: Selección de empleados con asistencia
- MATERIAL_INPUT: Registro de materiales/insumos

REGLAS:
1. Siempre responde en español
2. Para SELECT y CHECKBOX, siempre incluye "options" con las opciones como array de strings
3. Para VALUE, siempre incluye "unit"
4. Para RATING, incluye "ratingMax" (5 o 10)
5. Puedes hacer una pregunta condicional usando "conditional" con el índice de la pregunta padre y el valor que debe tener
6. Si el usuario pide algo ambiguo, pregunta para clarificar
7. Si el usuario pide múltiples cosas, devuelve múltiples acciones
8. Las preguntas importantes deben ser "required": true

RESPONDE SIEMPRE CON UN JSON VÁLIDO con este formato:
{
  "actions": [
    // Agregar pregunta:
    { "action": "add_item", "item": { "question": "...", "type": "CHECK", "required": true }, "afterIndex": 2 },

    // Modificar pregunta existente:
    { "action": "modify_item", "index": 0, "changes": { "question": "nuevo texto", "required": true } },

    // Eliminar pregunta:
    { "action": "remove_item", "index": 3 },

    // Agregar opción a SELECT/CHECKBOX:
    { "action": "add_option", "itemIndex": 1, "optionText": "Nueva opción" },

    // Hacer condicional (mostrar pregunta 3 si pregunta 1 = "Sí"):
    { "action": "set_conditional", "itemIndex": 3, "parentIndex": 1, "parentValue": "Sí" },

    // Solo mensaje sin modificar nada:
    { "action": "message", "text": "No entendí, ¿podrías ser más específico?" }
  ],
  "message": "Descripción breve de lo que hice o pregunta de clarificación"
}

EJEMPLOS:

Usuario: "Agregame una pregunta sobre la temperatura del horno"
Respuesta: { "actions": [{ "action": "add_item", "item": { "question": "Temperatura del horno", "type": "VALUE", "unit": "°C", "required": true } }], "message": "Agregué una pregunta para registrar la temperatura del horno en °C." }

Usuario: "Que tenga opciones Bueno, Regular y Malo"
Respuesta: { "actions": [{ "action": "modify_item", "index": -1, "changes": { "type": "SELECT", "options": ["Bueno", "Regular", "Malo"] } }], "message": "Cambié la última pregunta a selección con opciones Bueno, Regular y Malo." }
(Nota: index -1 significa la última pregunta)

Usuario: "Si es Malo, que pida foto"
Respuesta: { "actions": [{ "action": "add_item", "item": { "question": "Foto del problema", "type": "PHOTO", "required": true }, "conditional": { "parentIndex": -1, "parentValue": "Malo" } }], "message": "Agregué una pregunta de foto que solo aparece si la anterior es 'Malo'." }

Usuario: "Agregame control de EPP con casco, guantes y lentes"
Respuesta: { "actions": [{ "action": "add_item", "item": { "question": "EPP utilizado", "type": "CHECKBOX", "options": ["Casco", "Guantes", "Lentes"], "required": true } }], "message": "Agregué un checkbox de EPP con las opciones casco, guantes y lentes." }

Usuario: "Agregame firma del supervisor al final"
Respuesta: { "actions": [{ "action": "add_item", "item": { "question": "Firma del supervisor", "type": "SIGNATURE", "required": true } }], "message": "Agregué una firma del supervisor al final." }`;

export async function POST(request: Request) {
  try {
    const { user, error } = await requirePermission(PRODUCCION_PERMISSIONS.RUTINAS.VIEW);
    if (error) return error;

    const body = await request.json();
    const { message, currentItems, conversationHistory } = body;

    if (!message || typeof message !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Se requiere un mensaje' },
        { status: 400 }
      );
    }

    const openai = await getOpenAIClient();

    // Build context about current form state
    const formContext = currentItems && currentItems.length > 0
      ? `\n\nESTADO ACTUAL DEL FORMULARIO (${currentItems.length} preguntas):\n${currentItems.map((item: FormItem, i: number) =>
          `${i}. [${item.type}] "${item.question}"${item.options ? ` (opciones: ${item.options.map(o => o.text).join(', ')})` : ''}${item.unit ? ` (unidad: ${item.unit})` : ''}${item.required ? ' *obligatorio' : ''}${item.conditionalDisplay ? ` (condicional: si pregunta ${item.conditionalDisplay.parentItemId} = "${item.conditionalDisplay.parentValue}")` : ''}`
        ).join('\n')}`
      : '\n\nEl formulario está vacío.';

    // Build messages array
    const messages: any[] = [
      { role: 'system', content: SYSTEM_PROMPT + formContext },
    ];

    // Add conversation history if provided
    if (conversationHistory && Array.isArray(conversationHistory)) {
      for (const msg of conversationHistory.slice(-10)) { // Last 10 messages for context
        messages.push({
          role: msg.role === 'user' ? 'user' : 'assistant',
          content: msg.content,
        });
      }
    }

    // Add current message
    messages.push({ role: 'user', content: message });

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages,
      max_tokens: 2000,
      temperature: 0.3,
    });

    const responseText = response.choices[0]?.message?.content || '';

    // Parse JSON response
    let parsed: ChatResponse;
    try {
      // Try to extract JSON from response
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsed = JSON.parse(jsonMatch[0]);
      } else {
        // If no JSON, treat as message-only response
        parsed = {
          actions: [{ action: 'message', text: responseText }],
          message: responseText,
        };
      }
    } catch {
      // If JSON parsing fails, return as message
      parsed = {
        actions: [{ action: 'message', text: responseText }],
        message: responseText,
      };
    }

    // Validate and normalize actions
    const validatedActions = validateActions(parsed.actions, currentItems?.length || 0);

    return NextResponse.json({
      success: true,
      actions: validatedActions,
      message: parsed.message || 'OK',
    });
  } catch (error) {
    console.error('Error in routine chat:', error);
    return NextResponse.json(
      { success: false, error: 'Error al procesar el mensaje' },
      { status: 500 }
    );
  }
}

function validateActions(actions: any[], itemCount: number): ActionType[] {
  if (!Array.isArray(actions)) return [];

  const generateId = () => `q_${Math.random().toString(36).substr(2, 9)}`;
  const generateOptionId = () => `opt_${Math.random().toString(36).substr(2, 6)}`;

  return actions.map(action => {
    if (!action || typeof action !== 'object') return null;

    switch (action.action) {
      case 'add_item': {
        const item = action.item || {};
        // Normalize index (-1 means end)
        let afterIndex = action.afterIndex;
        if (afterIndex === -1 || afterIndex === undefined) {
          afterIndex = itemCount - 1;
        }

        // Convert options array of strings to proper format
        let options = item.options;
        if (options && Array.isArray(options)) {
          options = options.map((opt: any) =>
            typeof opt === 'string'
              ? { id: generateOptionId(), text: opt }
              : opt
          );
        }

        return {
          action: 'add_item',
          item: {
            id: generateId(),
            question: item.question || '',
            type: item.type || 'CHECK',
            required: item.required !== false,
            options,
            unit: item.unit,
            minValue: item.minValue,
            maxValue: item.maxValue,
            ratingMax: item.ratingMax,
          },
          afterIndex,
          // Pass conditional info separately for processing
          conditional: action.conditional || (item.conditional ? item.conditional : undefined),
        };
      }

      case 'modify_item': {
        let index = action.index;
        if (index === -1) index = itemCount - 1;
        if (index < 0 || index >= itemCount) return null;

        const changes = action.changes || {};
        // Convert options if present
        if (changes.options && Array.isArray(changes.options)) {
          changes.options = changes.options.map((opt: any) =>
            typeof opt === 'string'
              ? { id: generateOptionId(), text: opt }
              : opt
          );
        }

        return { action: 'modify_item', index, changes };
      }

      case 'remove_item': {
        let index = action.index;
        if (index === -1) index = itemCount - 1;
        if (index < 0 || index >= itemCount) return null;
        return { action: 'remove_item', index };
      }

      case 'add_option': {
        let itemIndex = action.itemIndex;
        if (itemIndex === -1) itemIndex = itemCount - 1;
        if (itemIndex < 0 || itemIndex >= itemCount) return null;
        return {
          action: 'add_option',
          itemIndex,
          optionText: action.optionText || 'Nueva opción'
        };
      }

      case 'remove_option': {
        let itemIndex = action.itemIndex;
        if (itemIndex === -1) itemIndex = itemCount - 1;
        return {
          action: 'remove_option',
          itemIndex,
          optionIndex: action.optionIndex || 0
        };
      }

      case 'set_conditional': {
        let itemIndex = action.itemIndex;
        let parentIndex = action.parentIndex;
        if (itemIndex === -1) itemIndex = itemCount - 1;
        if (parentIndex === -1) parentIndex = itemCount - 2;
        return {
          action: 'set_conditional',
          itemIndex,
          parentIndex,
          parentValue: action.parentValue || 'Sí',
        };
      }

      case 'remove_conditional': {
        let itemIndex = action.itemIndex;
        if (itemIndex === -1) itemIndex = itemCount - 1;
        return { action: 'remove_conditional', itemIndex };
      }

      case 'reorder': {
        return {
          action: 'reorder',
          fromIndex: action.fromIndex,
          toIndex: action.toIndex,
        };
      }

      case 'message':
        return { action: 'message', text: action.text || '' };

      default:
        return null;
    }
  }).filter(Boolean) as ActionType[];
}
