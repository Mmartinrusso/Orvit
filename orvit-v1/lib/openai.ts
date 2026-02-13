/**
 * Funciones de IA para optimización de cargas con GPT-4o-mini
 *
 * Nota: El cliente OpenAI ya está configurado en el proyecto.
 * Este módulo agrega funciones específicas para optimización de cargas.
 */

import 'server-only';
import { LoadItem, TruckData } from './cargas/types';

// Lazy load OpenAI client (mismo patrón del proyecto)
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

// Tipos para la respuesta de IA
export interface AIPlacement {
  itemIndex: number;
  productName: string;
  floor: number;
  row: number;
  col: number;
  packages: number;
}

export interface AIOptimizationStats {
  weightPerFloor: number[];
  centerOfGravity: { x: number; y: number; z: number };
  balanceScore: number; // 0-100, donde 100 es perfecto balance
  utilizationPercent: number;
  totalWeight: number;
}

export interface AIOptimizationResult {
  placements: AIPlacement[];
  stats: AIOptimizationStats;
  reasoning?: string;
  warnings?: string[];
}

export interface OptimizeLoadRequest {
  items: LoadItem[];
  truck: TruckData;
  preferences?: {
    prioritize?: 'weight_balance' | 'space_utilization' | 'delivery_order';
  };
}

/**
 * Construye el prompt para GPT-4o-mini
 */
function buildOptimizationPrompt(items: LoadItem[], truck: TruckData, preferences?: OptimizeLoadRequest['preferences']): string {
  const priority = preferences?.prioritize || 'weight_balance';

  const priorityDescription = {
    weight_balance: 'Priorizar balance de peso entre frente/atrás y pisos',
    space_utilization: 'Maximizar utilización del espacio disponible',
    delivery_order: 'Organizar para fácil acceso en orden de descarga'
  };

  const itemsList = items.map((item, index) =>
    `${index}. ${item.productName}: ${item.quantity} unidades, ${item.length || 0}m largo, ${item.weight || 0}kg c/u`
  ).join('\n');

  // Calcular dimensiones del camión
  const truckLength = truck.type === 'EQUIPO'
    ? `Chasis: ${truck.chasisLength}m, Acoplado: ${truck.acopladoLength}m`
    : `${truck.length}m`;

  const truckWeight = truck.type === 'EQUIPO'
    ? `Chasis: ${truck.chasisWeight} ton, Acoplado: ${truck.acopladoWeight} ton`
    : `${truck.maxWeight} ton máximo`;

  return `Eres un experto en logística de cargas de viguetas pretensadas. Optimiza el acomodo en un camión.

CAMIÓN:
- Tipo: ${truck.type}
- Nombre: ${truck.name}
- Largo: ${truckLength}
- Capacidad de peso: ${truckWeight}

ITEMS A CARGAR:
${itemsList}

REGLAS DE NEGOCIO:
1. Grilla 3D: 4 pisos × 3 filas × columnas dinámicas
2. Items >= 5.80m van en paquetes de 10 unidades
3. Items < 5.80m van en paquetes de 20 unidades
4. Paquetes grandes (>=5.80m) PUEDEN ir encima de cualquier cosa
5. Paquetes chicos (<5.80m) NO PUEDEN ir encima de paquetes grandes
6. Cada piso superior necesita soporte vertical o lateral del piso inferior
7. El largo total por fila no puede exceder el largo del camión
8. Piso 1 es el de abajo, piso 4 el de arriba

PRIORIDAD: ${priorityDescription[priority]}

OBJETIVO: Crear un acomodo óptimo que:
- Maximice utilización del espacio
- Mantenga buen balance de peso (score 70-100)
- Respete todas las reglas de negocio
- Coloque items más pesados/largos en pisos inferiores

Responde ÚNICAMENTE con JSON válido (sin markdown, sin explicaciones fuera del JSON):
{
  "placements": [
    { "itemIndex": 0, "productName": "nombre", "floor": 1, "row": 1, "col": 1, "packages": 5 }
  ],
  "stats": {
    "weightPerFloor": [peso_piso1_kg, peso_piso2_kg, peso_piso3_kg, peso_piso4_kg],
    "centerOfGravity": { "x": 0.5, "y": 0.5, "z": 0.3 },
    "balanceScore": 85,
    "utilizationPercent": 78,
    "totalWeight": 5000
  },
  "reasoning": "Breve explicación de la estrategia usada",
  "warnings": ["advertencias si hay problemas"]
}`;
}

/**
 * Optimiza la distribución de carga usando GPT-4o-mini
 */
export async function optimizeLoadWithAI(request: OptimizeLoadRequest): Promise<AIOptimizationResult> {
  const { items, truck, preferences } = request;

  if (!items || items.length === 0) {
    throw new Error('No hay items para optimizar');
  }

  const openai = await getOpenAIClient();
  const prompt = buildOptimizationPrompt(items, truck, preferences);

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'Eres un sistema de optimización de cargas. Responde SOLO con JSON válido, sin markdown ni texto adicional.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      response_format: { type: 'json_object' },
      temperature: 0.3, // Más determinístico para resultados consistentes
      max_tokens: 2500,
    });

    const content = response.choices[0]?.message?.content;

    if (!content) {
      throw new Error('Respuesta vacía de OpenAI');
    }

    const result = JSON.parse(content) as AIOptimizationResult;

    // Validar estructura básica
    if (!result.placements || !Array.isArray(result.placements)) {
      throw new Error('Respuesta inválida: falta array de placements');
    }

    if (!result.stats) {
      throw new Error('Respuesta inválida: faltan stats');
    }

    return result;
  } catch (error: any) {
    // Si es error de parsing JSON, intentar extraer JSON del contenido
    if (error instanceof SyntaxError) {
      console.error('Error parseando respuesta de IA:', error);
      throw new Error('La IA devolvió un formato inválido. Intenta de nuevo.');
    }

    // Re-throw otros errores
    throw error;
  }
}

/**
 * Convierte el resultado de IA a formato compatible con el sistema existente
 */
export function convertAIResultToLoadItems(
  originalItems: LoadItem[],
  aiResult: AIOptimizationResult
): LoadItem[] {
  return aiResult.placements.map(placement => {
    const originalItem = originalItems[placement.itemIndex];
    if (!originalItem) {
      console.warn(`Item no encontrado para índice ${placement.itemIndex}`);
      return null;
    }

    return {
      ...originalItem,
      gridPosition: {
        floor: placement.floor,
        row: placement.row,
        col: placement.col,
      },
    };
  }).filter((item): item is LoadItem => item !== null);
}

/**
 * Verifica si la API de OpenAI está configurada
 */
export function isOpenAIConfigured(): boolean {
  return !!process.env.OPENAI_API_KEY;
}
