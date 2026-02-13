/**
 * Routine Extractor - AI-powered generation of production routine templates
 *
 * Uses OpenAI GPT-4o for file analysis (PDF/images) and GPT-4o-mini for text descriptions.
 * Supports both flat (single routine) and hierarchical (grouped) templates.
 */

import 'server-only';

// =============================================================================
// TYPES
// =============================================================================

export type RoutineItemType =
  | 'CHECK'
  | 'VALUE'
  | 'TEXT'
  | 'PHOTO'
  | 'SELECT'
  | 'CHECKBOX'
  | 'DATE'
  | 'TIME'
  | 'SIGNATURE'
  | 'RATING'
  | 'EMPLOYEE_SELECT'
  | 'MATERIAL_INPUT'
  | 'MACHINE_SELECT';

export interface AIRoutineItem {
  question: string;
  type: RoutineItemType;
  required: boolean;
  options?: string[];
  unit?: string;
  minValue?: number | null;
  maxValue?: number | null;
  ratingMax?: number;
  conditionalDisplay?: {
    afterQuestionIndex: number; // 0-based index of the parent question within same group
    ifEquals: string;           // value the parent must have to show this item
  };
}

export interface AIRoutineGroup {
  name: string;
  description?: string;
  items: AIRoutineItem[];
  isRepeatable?: boolean;
}

export interface AIRoutineResult {
  name: string;
  type: string;
  frequency: string;
  /** For flat routines */
  items: AIRoutineItem[];
  /** For grouped/hierarchical routines */
  groups?: AIRoutineGroup[];
  confidence: number;
}

export interface RoutineFileInput {
  text?: string;
  images?: string[]; // base64
  fileName?: string;
}

// =============================================================================
// OPENAI CLIENT
// =============================================================================

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

// =============================================================================
// PROMPTS
// =============================================================================

const BASE_RULES = `TIPOS DE RUTINA disponibles:
- SHIFT_START: Inicio de turno
- SHIFT_END: Fin de turno
- SETUP: Preparación/setup de máquina
- SAFETY: Seguridad
- 5S: Metodología 5S
- QUALITY: Control de calidad
- MAINTENANCE: Mantenimiento preventivo

FRECUENCIAS disponibles:
- EVERY_SHIFT: Cada turno
- DAILY: Diaria
- WEEKLY: Semanal

TIPOS DE PREGUNTA disponibles (usa TODOS los tipos según corresponda):

1. CHECK (Verificación Sí/No)
   CUÁNDO USAR: Verificaciones binarias simples donde la respuesta es Sí o No, OK o No OK.
   EJEMPLOS: "¿Limpieza realizada?", "¿Equipo encendido?", "¿EPP completo?", "¿Materia prima disponible?", "¿Área despejada?"
   NO USAR cuando hay más de 2 estados posibles (usar SELECT en su lugar).

2. VALUE (Valor numérico con unidad)
   CUÁNDO USAR: Cuando se necesita registrar una MEDICIÓN numérica con unidad. Solo para valores que se miden con instrumentos.
   CAMPOS: Siempre incluir "unit". Opcionalmente "minValue" y "maxValue" si hay rango aceptable.
   EJEMPLOS: "Temperatura del horno" (unit: "°C", min: 180, max: 220), "Presión de aire" (unit: "bar"), "Espesor" (unit: "mm"), "Peso" (unit: "kg"), "Humedad" (unit: "%")
   NO USAR para estados cualitativos como Bueno/Malo (usar SELECT) ni para cantidades enteras sin unidad (usar SELECT o CHECK).

3. TEXT (Texto libre)
   CUÁNDO USAR: Para observaciones, comentarios, descripciones abiertas, notas, nombres, números de lote o serie.
   EJEMPLOS: "Observaciones generales", "Número de lote", "Descripción del defecto", "Acciones correctivas tomadas", "Comentarios del operador"

4. PHOTO (Foto/evidencia visual)
   CUÁNDO USAR: Cuando se necesita evidencia fotográfica o registro visual. Después de inspecciones visuales, al reportar defectos, para documentar estado de equipos.
   EJEMPLOS: "Foto del estado del equipo", "Evidencia de limpieza", "Foto del defecto encontrado", "Registro visual del producto terminado"

5. SELECT (Selección única entre opciones)
   CUÁNDO USAR: Cuando hay un conjunto FIJO de opciones mutuamente excluyentes (3 o más opciones). FUNDAMENTAL para estados cualitativos.
   CAMPOS: Siempre incluir "options" con las opciones como array de strings.
   EJEMPLOS:
   - "Estado general de la máquina" → options: ["Bueno", "Regular", "Malo"]
   - "Nivel de limpieza" → options: ["Limpio", "Aceptable", "Sucio"]
   - "Tipo de defecto encontrado" → options: ["Fisura", "Rotura", "Deformación", "Manchas", "Ninguno"]
   - "Turno" → options: ["Mañana", "Tarde", "Noche"]
   - "Resultado de la prueba" → options: ["Aprobado", "Rechazado", "Condicional"]
   - "Color del producto" → options: ["Correcto", "Claro", "Oscuro", "Fuera de rango"]
   REGLA CLAVE: Si un ítem del documento evalúa una condición con opciones como Bien/Regular/Mal, Cumple/No cumple, Aprobado/Rechazado → SIEMPRE usar SELECT con las opciones correspondientes, NUNCA usar VALUE.

6. CHECKBOX (Selección múltiple)
   CUÁNDO USAR: Cuando se pueden seleccionar VARIOS ítems de una lista simultáneamente.
   CAMPOS: Incluir "options" con todas las opciones posibles.
   EJEMPLOS:
   - "EPP utilizado" → options: ["Casco", "Guantes", "Lentes", "Zapatos de seguridad", "Protección auditiva"]
   - "Documentación verificada" → options: ["Orden de trabajo", "Plano", "Instrucción", "Registro anterior"]
   - "Defectos encontrados" → options: ["Fisuras", "Manchas", "Burbujas", "Rebabas", "Ninguno"]

7. RATING (Escala numérica 1-5 o 1-10)
   CUÁNDO USAR: Para evaluaciones subjetivas en escala numérica.
   CAMPOS: Incluir "ratingMax" (5 o 10).
   EJEMPLOS: "Calidad general del producto" (ratingMax: 5), "Nivel de orden del área" (ratingMax: 5)

8. SIGNATURE (Firma digital)
   CUÁNDO USAR: Para aprobaciones, confirmaciones de responsabilidad, validaciones de supervisor.
   EJEMPLOS: "Firma del operador", "Aprobación del supervisor", "Validado por control de calidad"
   REGLA: Agregar al FINAL de cada sección/grupo cuando el documento requiera firma o aprobación.

9. DATE (Fecha)
   CUÁNDO USAR: Para registrar fechas específicas (no usar para la fecha del día que es automática).
   EJEMPLOS: "Fecha de vencimiento del material", "Fecha de último mantenimiento", "Fecha de calibración"

10. TIME (Hora)
    CUÁNDO USAR: Para registrar horarios específicos.
    EJEMPLOS: "Hora de inicio de producción", "Hora de parada", "Hora de la medición"

11. EMPLOYEE_SELECT (Selección de empleados con asistencia)
    CUÁNDO USAR: Cuando la rutina necesita registrar qué empleados están presentes, en qué puesto de trabajo están, si faltaron (con motivo) o si fueron transferidos a otro sector.
    EJEMPLOS: "Asistencia del personal del turno", "Control de presencia de empleados", "Registro de operarios en planta", "Asignación de puestos de trabajo"
    NOTA: Este tipo carga automáticamente los empleados del sector/centro de trabajo. El supervisor solo marca excepciones (ausencias, transferencias). Se usa típicamente en rutinas de inicio de turno (SHIFT_START).

12. MATERIAL_INPUT (Registro de materiales/insumos)
    CUÁNDO USAR: Cuando se registran cantidades de materiales, insumos o agregados consumidos durante la producción. Para control de materia prima por turno, por mezcla o por lote.
    EJEMPLOS: "Consumo de áridos por mezcla", "Materiales utilizados en el turno", "Registro de insumos por lote", "Control de materia prima consumida"
    NOTA: Permite registrar múltiples materiales con cantidad y unidad (kg, pulsos, m3, bolsas, etc.). Soporta registro por turno completo o por mezcla/lote individual.

13. MACHINE_SELECT (Selección de máquina/equipo)
    CUÁNDO USAR: Cuando el operario debe indicar en qué máquina o equipo está trabajando. Para asociar la rutina a un activo específico.
    EJEMPLOS: "Máquina en uso", "Equipo a inspeccionar", "Seleccionar mezcladora", "Equipo de producción"
    NOTA: Permite seleccionar una o varias máquinas del sector. Opcionalmente puede pedir lectura de horómetro o contador.

REGLAS DE SELECCIÓN DE TIPO:
1. Si el ítem evalúa un estado cualitativo (Bueno/Malo, Cumple/No cumple, etc.) → SELECT con opciones
2. Si el ítem requiere una medición numérica con instrumento → VALUE con unit
3. Si el ítem es una verificación simple Sí/No → CHECK
4. Si el ítem pide observaciones o texto libre → TEXT
5. Si el ítem requiere evidencia visual → PHOTO
6. Si el ítem permite marcar múltiples opciones → CHECKBOX con options
7. Si el documento pide firma → SIGNATURE
8. Si el ítem requiere registrar asistencia, presencia o asignación de empleados → EMPLOYEE_SELECT
9. Si el ítem requiere registrar cantidades de materiales/insumos consumidos → MATERIAL_INPUT
10. Si el ítem requiere indicar en qué máquina/equipo se trabaja → MACHINE_SELECT
11. VARIEDAD: Usa TODOS los tipos de pregunta apropiados. No uses solo CHECK y VALUE. Una rutina industrial típica tiene CHECK, SELECT, VALUE, TEXT, PHOTO y SIGNATURE como mínimo. Para rutinas de inicio de turno, considerá EMPLOYEE_SELECT para asistencia, MATERIAL_INPUT si se registran consumos, y MACHINE_SELECT si se trabaja con equipos específicos.

LÓGICA CONDICIONAL (conditionalDisplay):
Puedes hacer que una pregunta solo se muestre si una pregunta anterior tiene un valor específico.
Usa el campo "conditionalDisplay" con:
- "afterQuestionIndex": índice (0-based) de la pregunta padre DENTRO DEL MISMO GRUPO
- "ifEquals": valor exacto que debe tener la pregunta padre para que esta se muestre

CUÁNDO USAR condicionales:
- CHECK "¿Hay defectos?" = "Sí" → mostrar TEXT "Descripción del defecto" + PHOTO "Foto del defecto"
- CHECK "¿Hubo incidentes?" = "Sí" → mostrar SELECT "Tipo de incidente" + TEXT "Descripción del incidente"
- CHECK "¿Faltó algún empleado?" = "Sí" → mostrar TEXT "¿Quién faltó?" + TEXT "Motivo de ausencia"
- SELECT "Estado del equipo" = "Malo" → mostrar TEXT "Describir problema" + PHOTO "Foto del problema"
- SELECT "Resultado de inspección" = "Rechazado" → mostrar TEXT "Acciones correctivas"
- CHECK "¿Se necesitan repuestos?" = "Sí" → mostrar TEXT "¿Qué repuestos?"
REGLA: Usa condicionales para preguntas de detalle que SOLO tienen sentido si la pregunta padre tiene cierto valor. No abuses — solo donde es lógico.

INTELIGENCIA CONTEXTUAL — Sé inteligente y completo:
No te limites a lo que dice el documento textualmente. Agregá preguntas que son LÓGICAS para el proceso industrial aunque el documento no las mencione explícitamente:

- PERSONAL/RRHH: asistencia y puestos de trabajo (EMPLOYEE_SELECT), novedades del turno anterior (TEXT), cantidad de empleados por sector (VALUE)
- SEGURIDAD: EPP verificado (CHECKBOX con tipos de EPP), incidentes (CHECK → condicional: tipo, descripción, foto), zonas de riesgo inspeccionadas (CHECK), condiciones inseguras (CHECK → TEXT descripción)
- CALIDAD: parámetros de proceso (VALUE con unidad y rango), defectos encontrados (CHECK → condicional: SELECT tipo, VALUE cantidad, PHOTO foto), criterio de aceptación (SELECT Aprobado/Rechazado/Condicional), acciones correctivas (TEXT condicional), consumo de materiales/insumos (MATERIAL_INPUT)
- MANTENIMIENTO: estado del equipo (SELECT Bueno/Regular/Malo → condicional si Malo: TEXT problema + PHOTO), lubricación realizada (CHECK), repuestos necesarios (CHECK → TEXT cuáles), horas de funcionamiento (VALUE con unit "hs")
- 5S: cada S evaluada (SELECT Cumple/No cumple/Parcial), observaciones condicionales (TEXT si No cumple)
- GENERAL: agregar SIGNATURE "Firma del responsable" al final de cada sección. Agregar TIME "Hora de inicio" y TIME "Hora de fin" donde tenga sentido.

REGLAS GENERALES:
1. Las preguntas deben estar en español
2. Marca como "required: true" los ítems críticos para el proceso
3. Solo incluir los campos relevantes para cada tipo de pregunta. No incluir campos opcionales vacíos o null.
4. Para SELECT y CHECKBOX, SIEMPRE incluir el campo "options" con las opciones apropiadas.
5. Para VALUE, SIEMPRE incluir "unit".
6. Para conditionalDisplay, el "afterQuestionIndex" es el índice 0-based de la pregunta padre DENTRO del mismo grupo de items.`;

const FLAT_PROMPT = `Eres un experto en control de calidad y producción industrial. Tu tarea es generar una rutina de producción estructurada.

${BASE_RULES}

Responde SOLO con un JSON válido:
{
  "name": "Nombre de la rutina",
  "type": "TIPO_RUTINA",
  "frequency": "FRECUENCIA",
  "items": [
    {
      "question": "¿Hay defectos visibles?",
      "type": "CHECK",
      "required": true
    },
    {
      "question": "Descripción del defecto",
      "type": "TEXT",
      "required": true,
      "conditionalDisplay": { "afterQuestionIndex": 0, "ifEquals": "Sí" }
    },
    {
      "question": "Foto del defecto",
      "type": "PHOTO",
      "required": false,
      "conditionalDisplay": { "afterQuestionIndex": 0, "ifEquals": "Sí" }
    },
    {
      "question": "Temperatura",
      "type": "VALUE",
      "required": true,
      "unit": "°C",
      "minValue": 180,
      "maxValue": 220
    },
    {
      "question": "Estado general",
      "type": "SELECT",
      "required": true,
      "options": ["Bueno", "Regular", "Malo"]
    }
  ],
  "confidence": 0.85
}`;

const GROUPED_PROMPT = `Eres un experto en control de calidad y producción industrial. Tu tarea es generar una rutina de producción AGRUPADA con múltiples secciones/etapas.

${BASE_RULES}

REGLAS DE AGRUPACIÓN - MUY IMPORTANTE:
- SIEMPRE dividí la rutina en MÚLTIPLES secciones/grupos lógicos, NUNCA generes un solo grupo con todo
- Cada grupo/sección representa una etapa, momento o área diferente del proceso
- Cada grupo tiene su propio nombre descriptivo y descripción breve

SECCIONES TÍPICAS según el tipo de rutina:
- INICIO DE TURNO: "Preparación inicial", "Verificación de EPP y seguridad", "Control de equipos", "Asignación de personal", "Verificaciones pre-arranque"
- DURANTE PRODUCCIÓN: "Control de proceso", "Mediciones y parámetros", "Control de calidad en línea", "Registro de incidencias"
- FIN DE TURNO: "Cierre de producción", "Limpieza y orden", "Registro de novedades", "Entrega de turno"
- PERSONAL: "Asistencia y puestos", "Novedades del turno anterior", "Asignación de tareas", "EPP y seguridad personal"
- MANTENIMIENTO: "Inspección visual", "Mediciones preventivas", "Estado de componentes", "Lubricación y ajustes", "Repuestos y pendientes"
- CALIDAD: "Control de materia prima", "Parámetros de proceso", "Inspección de producto", "Defectos y no conformidades"
- 5S: "Clasificar (Seiri)", "Ordenar (Seiton)", "Limpiar (Seiso)", "Estandarizar (Seiketsu)", "Disciplina (Shitsuke)"

REGLA CLAVE: Aunque el documento sea uno solo, DIVIDÍ su contenido en al menos 2-3 secciones lógicas según las etapas del proceso. Por ejemplo, si un checklist de máquina tiene verificaciones de arranque y parámetros de proceso, creá una sección "Verificaciones de arranque" y otra "Control de proceso".

- Si un grupo se repite por cada unidad (ej: por cada banco, por cada máquina), marcalo como "isRepeatable": true

IMPORTANTE:
- Debes leer y analizar CADA documento proporcionado de forma COMPLETA
- CADA documento debe generar al menos un grupo con TODOS sus ítems
- NO omitas ningún ítem que aparezca en los documentos
- Si un documento tiene 20 ítems, el grupo debe tener 20 preguntas, NO un resumen
- Incluí TODAS las verificaciones, mediciones y controles que aparezcan en cada documento
- Agregá una sección de FIRMA al final si tiene sentido para el proceso

Responde SOLO con un JSON válido:
{
  "name": "Nombre general de la rutina (ej: Viguetas Diario)",
  "type": "TIPO_RUTINA",
  "frequency": "FRECUENCIA",
  "groups": [
    {
      "name": "Nombre del grupo/sección",
      "description": "Descripción breve de la sección",
      "isRepeatable": false,
      "items": [
        {
          "question": "¿Equipo en condiciones?",
          "type": "CHECK",
          "required": true
        },
        {
          "question": "Describir problema del equipo",
          "type": "TEXT",
          "required": true,
          "conditionalDisplay": { "afterQuestionIndex": 0, "ifEquals": "No" }
        },
        {
          "question": "Estado de la pieza",
          "type": "SELECT",
          "required": true,
          "options": ["Bueno", "Regular", "Malo"]
        },
        {
          "question": "Acciones correctivas",
          "type": "TEXT",
          "required": true,
          "conditionalDisplay": { "afterQuestionIndex": 2, "ifEquals": "Malo" }
        },
        {
          "question": "Firma del responsable",
          "type": "SIGNATURE",
          "required": true
        }
      ]
    }
  ],
  "confidence": 0.85
}`;

// =============================================================================
// EXTRACTION FUNCTIONS
// =============================================================================

/**
 * Extract routine from a single uploaded file (PDF/image)
 */
export async function extractRoutineFromFile(
  input: RoutineFileInput,
  grouped: boolean = true
): Promise<AIRoutineResult> {
  const openai = await getOpenAIClient();
  // Always use grouped prompt to generate sectioned routines
  const prompt = GROUPED_PROMPT;

  if (input.images && input.images.length > 0) {
    const content: any[] = [
      {
        type: 'text',
        text: `${prompt}\n\nAnaliza el siguiente documento y genera la rutina de producción:`,
      },
    ];

    const imagesToProcess = input.images.slice(0, 10);
    for (const imageBase64 of imagesToProcess) {
      const mimeType = imageBase64.startsWith('/9j/') ? 'image/jpeg' : 'image/png';
      content.push({
        type: 'image_url',
        image_url: {
          url: `data:${mimeType};base64,${imageBase64}`,
          detail: 'high',
        },
      });
    }

    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [{ role: 'user', content }],
      max_tokens: 8000,
      temperature: 0.3,
    });

    const responseText = response.choices[0]?.message?.content || '';
    return parseRoutineResponse(responseText, true);
  }

  if (input.text) {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'user',
          content: `${prompt}\n\nContenido del documento "${input.fileName || 'documento'}":\n\n${input.text}`,
        },
      ],
      max_tokens: 8000,
      temperature: 0.3,
    });

    const responseText = response.choices[0]?.message?.content || '';
    return parseRoutineResponse(responseText, true);
  }

  throw new Error('Se requiere texto o imágenes para la extracción');
}

/**
 * Extract routine from multiple files - generates a grouped template
 * Each file can become one or more groups
 */
export async function extractRoutineFromMultipleFiles(
  files: RoutineFileInput[],
  templateName?: string
): Promise<AIRoutineResult> {
  const openai = await getOpenAIClient();

  // Log what we're processing
  console.log(`[routine-extractor] Processing ${files.length} files:`);
  for (let i = 0; i < files.length; i++) {
    const f = files[i];
    const contentType = f.images ? `${f.images.length} images` : `text (${f.text?.length || 0} chars)`;
    console.log(`  [${i + 1}] ${f.fileName || 'unknown'} → ${contentType}`);
  }

  // Build combined content for all files
  const filesSummary = files.map((f, i) => `${i + 1}. "${f.fileName || `Archivo ${i + 1}`}"`).join('\n');

  const content: any[] = [
    {
      type: 'text',
      text: `${GROUPED_PROMPT}

Se proporcionan ${files.length} documentos de control de producción:
${filesSummary}

INSTRUCCIONES CRÍTICAS:
- Debes analizar CADA UNO de los ${files.length} documentos por separado
- Cada documento debe convertirse en al menos 1 grupo/sección en la rutina
- Lee TODOS los ítems/verificaciones de cada documento - NO resumas ni omitas ninguno
- Si un documento tiene una lista de 15 controles, el grupo debe tener 15 preguntas
- La rutina final DEBE tener al menos ${files.length} grupos (uno por documento como mínimo)
${templateName ? `\nEl nombre general de la rutina debería ser: "${templateName}"` : ''}

A continuación los documentos:`,
    },
  ];

  for (let i = 0; i < files.length; i++) {
    const file = files[i];

    if (file.images && file.images.length > 0) {
      content.push({
        type: 'text',
        text: `\n========================================\nDOCUMENTO ${i + 1} de ${files.length}: "${file.fileName || `Archivo ${i + 1}`}"\nLee TODOS los ítems de este documento.\n========================================`,
      });
      const imagesToProcess = file.images.slice(0, 5);
      for (const imageBase64 of imagesToProcess) {
        const mimeType = imageBase64.startsWith('/9j/') ? 'image/jpeg' : 'image/png';
        content.push({
          type: 'image_url',
          image_url: {
            url: `data:${mimeType};base64,${imageBase64}`,
            detail: 'high',
          },
        });
      }
    } else if (file.text) {
      content.push({
        type: 'text',
        text: `\n========================================\nDOCUMENTO ${i + 1} de ${files.length}: "${file.fileName || `Archivo ${i + 1}`}"\nLee TODOS los ítems de este documento.\n========================================\n${file.text}`,
      });
    }
  }

  // Add final reminder
  content.push({
    type: 'text',
    text: `\n========================================\nRECORDATORIO FINAL: Acabas de leer ${files.length} documentos. Tu respuesta JSON DEBE tener al menos ${files.length} grupos, uno por cada documento. Incluí TODOS los ítems de cada documento sin omitir ninguno.\n========================================`,
  });

  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [{ role: 'user', content }],
    max_tokens: 16000,
    temperature: 0.2,
  });

  const responseText = response.choices[0]?.message?.content || '';
  console.log(`[routine-extractor] Response length: ${responseText.length} chars`);

  const result = parseRoutineResponse(responseText, true);

  // Log result summary
  if (result.groups) {
    console.log(`[routine-extractor] Generated ${result.groups.length} groups:`);
    for (const g of result.groups) {
      console.log(`  - "${g.name}": ${g.items.length} items`);
    }
  }

  return result;
}

/**
 * Generate routine from text description
 */
export async function extractRoutineFromText(
  description: string,
  routineType?: string,
  grouped: boolean = true
): Promise<AIRoutineResult> {
  const openai = await getOpenAIClient();
  // Always use grouped prompt to generate sectioned routines
  const prompt = GROUPED_PROMPT;

  let userMessage = `${prompt}\n\nEl usuario describe lo que quiere controlar:\n\n"${description}"`;

  if (routineType) {
    userMessage += `\n\nEl usuario indica que el tipo de rutina debería ser: ${routineType}`;
  }

  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [{ role: 'user', content: userMessage }],
    max_tokens: 8000,
    temperature: 0.3,
  });

  const responseText = response.choices[0]?.message?.content || '';
  return parseRoutineResponse(responseText, true);
}

// =============================================================================
// RESPONSE PARSING
// =============================================================================

function parseRoutineResponse(responseText: string, expectGrouped: boolean = false): AIRoutineResult {
  let jsonStr = responseText.trim();

  const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (jsonMatch) {
    jsonStr = jsonMatch[1].trim();
  }

  try {
    const parsed = JSON.parse(jsonStr);
    return validateRoutineResult(parsed, expectGrouped);
  } catch {
    try {
      const repaired = repairTruncatedJson(jsonStr);
      const parsed = JSON.parse(repaired);
      return validateRoutineResult(parsed, expectGrouped);
    } catch {
      throw new Error('No se pudo parsear la respuesta de la IA');
    }
  }
}

function validateItem(item: any): AIRoutineItem {
  const validItemTypes: RoutineItemType[] = [
    'CHECK', 'VALUE', 'TEXT', 'PHOTO', 'SELECT', 'CHECKBOX',
    'DATE', 'TIME', 'SIGNATURE', 'RATING', 'EMPLOYEE_SELECT', 'MATERIAL_INPUT', 'MACHINE_SELECT',
  ];

  const result: AIRoutineItem = {
    question: item.question || 'Sin pregunta',
    type: validItemTypes.includes(item.type) ? item.type : 'CHECK',
    required: item.required !== false,
  };

  if (item.options && Array.isArray(item.options) && item.options.length > 0) {
    result.options = item.options.map(String);
  }
  if (item.unit) result.unit = String(item.unit);
  if (item.minValue != null) result.minValue = Number(item.minValue);
  if (item.maxValue != null) result.maxValue = Number(item.maxValue);
  if (item.ratingMax) result.ratingMax = Number(item.ratingMax);

  return result;
}

function validateRoutineResult(parsed: any, expectGrouped: boolean): AIRoutineResult {
  const validTypes = [
    'SHIFT_START', 'SHIFT_END', 'SETUP', 'SAFETY', '5S', 'QUALITY', 'MAINTENANCE',
  ];
  const validFrequencies = ['EVERY_SHIFT', 'DAILY', 'WEEKLY'];

  const result: AIRoutineResult = {
    name: parsed.name || 'Rutina sin nombre',
    type: validTypes.includes(parsed.type) ? parsed.type : 'QUALITY',
    frequency: validFrequencies.includes(parsed.frequency) ? parsed.frequency : 'DAILY',
    items: [],
    confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 0.7,
  };

  // Handle grouped response
  if (parsed.groups && Array.isArray(parsed.groups) && parsed.groups.length > 0) {
    result.groups = parsed.groups.map((group: any, idx: number) => ({
      name: group.name || `Sección ${idx + 1}`,
      description: group.description || undefined,
      isRepeatable: group.isRepeatable === true,
      items: (group.items || []).map(validateItem),
    }));
  }
  // Handle flat response
  else if (parsed.items && Array.isArray(parsed.items)) {
    result.items = parsed.items.map(validateItem);
  }

  return result;
}

function repairTruncatedJson(jsonStr: string): string {
  let repaired = jsonStr.trim();
  let openBraces = 0;
  let openBrackets = 0;
  let inString = false;
  let escape = false;

  for (let i = 0; i < repaired.length; i++) {
    const char = repaired[i];
    if (escape) { escape = false; continue; }
    if (char === '\\') { escape = true; continue; }
    if (char === '"' && !escape) { inString = !inString; continue; }
    if (inString) continue;
    if (char === '{') openBraces++;
    if (char === '}') openBraces--;
    if (char === '[') openBrackets++;
    if (char === ']') openBrackets--;
  }

  if (inString) repaired += '"';
  while (openBrackets > 0) { repaired += ']'; openBrackets--; }
  while (openBraces > 0) { repaired += '}'; openBraces--; }

  return repaired;
}
