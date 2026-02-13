/**
 * Prompts for AI extraction of machine data from technical documents
 * v2.0 - Improved extraction with pageAssemblies, machineScopesDetected, and anti-inference rules
 */

// =============================================================================
// PER-FILE EXTRACTION PROMPT
// =============================================================================

export const PER_FILE_EXTRACTION_PROMPT = `Eres un experto en análisis de documentación técnica industrial.
Analiza este documento y extrae información estructurada sobre la máquina y sus componentes.

REGLAS CRÍTICAS (MUY IMPORTANTE - SEGUIR AL PIE DE LA LETRA):
1. SOLO incluir datos que estén EXPLÍCITAMENTE visibles en el documento - NUNCA inventar
2. NO inferir ni suponer datos que no estén escritos claramente
3. Si un campo no tiene información explícita en el documento, DEBE ser null - NO rellenar con suposiciones
4. Para cada dato extraído, indicar la página exacta y el texto/área de donde proviene
5. Si un dato no está claro o es ambiguo, marcar confidence < 0.7
6. Los valores de confidence deben estar entre 0 y 1 (ej: 0.95, 0.7, 0.5)

REGLAS DE JERARQUÍA Y ENSAMBLES:
7. Para cada página que contenga "PARTS LIST", "BOM", "LISTA DE PARTES" o similar, crear un rootAssembly
8. El rootAssembly debe usar el nombre del dibujo/archivo (drawingFileName) o título de la página
9. TODOS los items de esa PARTS LIST deben colgar de ese rootAssembly (parentTempId = tempId del root)
10. Solo usar parentTempId = null si NO hay PARTS LIST en la página
11. NO crear jerarquía inventada - solo la que está explícita en el documento

REGLAS DE VARIANTES Y MODELOS:
12. Si el documento contiene múltiples variantes de máquina (ej: GXL 1300 P / A / DS / X), NO elegir una sola
13. Detectar variantes desde rutas de archivos (ej: "Impianto\\GXL 1300\\GXL 1300 X\\...")
14. Devolver TODAS las variantes detectadas en machineScopesDetected[]
15. Si hay ambigüedad sobre qué modelo aplica, usar machineMatch.status = "AMBIGUOUS"

RESPUESTA EN JSON ESTRICTO:
{
  "machineInfo": {
    "name": "string | null - nombre base de la máquina (sin variante específica si hay múltiples)",
    "brand": "string | null - marca/fabricante SOLO si está explícito",
    "model": "string | null - modelo SOLO si está explícito",
    "serialNumber": "string | null - número de serie SOLO si está explícito",
    "manufacturingYear": "number | null - año SOLO si está explícito (solo número)",
    "type": "PRODUCTION | MAINTENANCE | UTILITY | PACKAGING | TRANSPORTATION | OTHER",
    "power": "string | null - potencia SOLO si está explícito",
    "voltage": "string | null - voltaje SOLO si está explícito",
    "weight": "string | null - peso SOLO si está explícito",
    "dimensions": "string | null - dimensiones SOLO si está explícito",
    "description": "string | null - descripción SOLO si está explícito",
    "technicalNotes": "string | null - notas técnicas SOLO si están explícitas"
  },
  "machineScopesDetected": [
    {
      "baseName": "nombre base (ej: GXL 1300)",
      "variant": "variante específica (ej: X, P, A, DS) | null si no hay",
      "fullPath": "ruta completa donde se detectó (ej: Impianto/GXL 1300/GXL 1300 X)",
      "confidence": 0.95
    }
  ],
  "machineMatch": {
    "status": "UNIQUE | AMBIGUOUS | NOT_FOUND",
    "selectedScope": "índice del scope seleccionado si UNIQUE, null si AMBIGUOUS",
    "reason": "explicación de por qué es UNIQUE/AMBIGUOUS/NOT_FOUND"
  },
  "pageAssemblies": [
    {
      "tempId": "page1_assembly",
      "pageIndex": 1,
      "drawingFileName": "nombre del archivo/dibujo de la página",
      "drawingNumber": "número de dibujo si existe | null",
      "title": "título del ensamble/página",
      "revision": "revisión del dibujo | null",
      "evidence": {
        "snippet": "texto del title block o encabezado",
        "confidence": 0.95
      }
    }
  ],
  "components": [
    {
      "tempId": "fileX_comp1",
      "name": "string - nombre del componente (traducido si aplica)",
      "originalName": "string - nombre original sin traducir",
      "code": "string | null - código/part number exacto del documento",
      "itemNumber": "string | null - número de item en la PARTS LIST (ej: 1, 2, 3...)",
      "quantity": "number | null - cantidad indicada en PARTS LIST",
      "fileName": "string | null - nombre de archivo si está en PARTS LIST (ej: nombre.ipt, nombre.iam)",
      "fileType": "assembly | part | null - .iam = assembly, .ipt = part",
      "type": "motor | bomba | valvula | sensor | actuador | estructura | rodamiento | engranaje | correa | cilindro | ensamble | pieza | otro",
      "system": "electrico | hidraulico | neumatico | mecanico | automatizacion | refrigeracion | lubricacion | otro | null",
      "description": "string | null - descripción SOLO si está explícita",
      "parentTempId": "tempId del pageAssembly padre | tempId de otro componente si está explícito | null",
      "evidence": {
        "pageIndex": 1,
        "snippet": "texto exacto de la fila en PARTS LIST o etiqueta",
        "confidence": 0.95
      }
    }
  ],
  "machineEvidence": [
    {
      "field": "nombre del campo (name, brand, model, etc.)",
      "pageIndex": 1,
      "snippet": "texto exacto encontrado",
      "confidence": 0.95
    }
  ],
  "partsListsFound": [
    {
      "pageIndex": 1,
      "format": "TABLE | LIST | DIAGRAM_LABELS",
      "columns": ["ITEM", "QTY", "FILE NAME", "..."],
      "itemCount": 15,
      "linkedToAssembly": "tempId del pageAssembly"
    }
  ],
  "warnings": ["Lista de problemas o ambigüedades encontradas"]
}

TIPOS DE DOCUMENTOS Y QUÉ BUSCAR:
- Planos/Blueprints: Title block (marca, modelo, revisión), PARTS LIST con items numerados
- Manuales técnicos: Índice de partes, especificaciones, variantes del modelo
- BOM (Bill of Materials): Lista completa con columnas ITEM/QTY/FILE NAME/DESCRIPTION
- Fichas técnicas: Datos eléctricos, mecánicos - SOLO si están explícitos
- Archivos CAD exportados: Detectar extensiones .iam (assembly) y .ipt (part)

IMPORTANTE:
- Si no encuentras información de máquina, devuelve machineInfo con todos los campos null
- Si no encuentras componentes, devuelve array vacío en components
- Siempre incluye al menos un warning si hay dudas o datos faltantes
- NUNCA inventes datos - es mejor devolver null que inventar
- Para PARTS LIST: extraer TODOS los items, incluyendo item number, qty, y file name exactos`;

// =============================================================================
// MERGE EXTRACTION PROMPT
// =============================================================================

export const MERGE_EXTRACTION_PROMPT = `Eres un experto en consolidación de datos técnicos industriales.
Tu tarea es combinar extracciones de múltiples documentos PRESERVANDO la estructura original.

ENTRADA: Array de extracciones individuales por archivo, cada una con:
- machineInfo: datos de la máquina
- machineScopesDetected: variantes/modelos detectados
- pageAssemblies: ensambles raíz por página
- components: lista de componentes encontrados
- evidence: evidencias por campo

SALIDA: Estructura consolidada SIN perder información ni crear jerarquía inventada

REGLAS CRÍTICAS DE MERGE (MUY IMPORTANTE):
1. NO CREAR JERARQUÍA NUEVA - Solo:
   - Conservar los pageAssemblies/roots de cada archivo original
   - Linkear un componente a un padre SOLO si hay evidencia explícita (misma página o texto que diga "parte de...")
   - NUNCA inventar relaciones padre-hijo que no estén documentadas

2. DEDUPLICACIÓN ESTRICTA - Solo deduplicar si:
   a) Coincide EXACTAMENTE el fileName/partNumber (case-insensitive, trim spaces)
   b) Si coincide por normalización obvia (espacios extra), marcar confidence < 0.7
   c) En caso de duda, NO deduplicar - mantener ambos con warning

3. CONFLICTOS - NO resolver automáticamente:
   - Si un componente tiene dos posibles padres, devolver en conflicts[]
   - Si hay valores diferentes para el mismo campo de máquina, devolver en conflicts[]
   - La UI decidirá cómo resolver los conflictos

4. MÚLTIPLES VARIANTES DE MÁQUINA:
   - Si hay múltiples machineScopesDetected entre archivos, MANTENER TODOS
   - NO elegir uno sobre otro - la máquina puede cubrir múltiples variantes
   - Consolidar en allMachineScopesDetected[]

5. MACHINE INFO:
   - Para cada campo, tomar el valor con mayor confidence
   - Si hay conflicto real (valores diferentes que no son variantes), agregar a conflicts[]
   - Los campos sin dato explícito DEBEN permanecer null - NO inventar

6. PRESERVAR ESTRUCTURA DE PARTS LIST:
   - Cada pageAssembly de cada archivo debe mantenerse como root separado
   - Los componentes mantienen su parentTempId original (referencia al assembly de su página)
   - NO aplanar la jerarquía de diferentes PARTS LIST en un solo árbol

RESPUESTA JSON:
{
  "machine": {
    "name": "string - nombre base común | null",
    "brand": "string | null - SOLO si está explícito",
    "model": "string | null - SOLO si está explícito",
    "serialNumber": "string | null - SOLO si está explícito",
    "manufacturingYear": "number | null - SOLO si está explícito",
    "type": "PRODUCTION | MAINTENANCE | UTILITY | PACKAGING | TRANSPORTATION | OTHER",
    "power": "string | null - SOLO si está explícito",
    "voltage": "string | null - SOLO si está explícito",
    "weight": "string | null - SOLO si está explícito",
    "dimensions": "string | null - SOLO si está explícito",
    "description": "string | null - SOLO si está explícito",
    "technicalNotes": "string | null - SOLO si está explícito",
    "evidence": [
      {
        "field": "name",
        "fileId": 1,
        "fileName": "manual.pdf",
        "pageIndex": 1,
        "snippet": "texto exacto",
        "confidence": 0.95
      }
    ]
  },
  "allMachineScopesDetected": [
    {
      "baseName": "GXL 1300",
      "variant": "X | P | A | DS | null",
      "fullPath": "ruta completa",
      "sourceFileId": 1,
      "confidence": 0.95
    }
  ],
  "machineMatchStatus": "UNIQUE | AMBIGUOUS | MULTIPLE_VARIANTS",
  "assemblies": [
    {
      "tempId": "file1_page1_assembly",
      "sourceFileId": 1,
      "sourceFileName": "manual.pdf",
      "pageIndex": 1,
      "drawingFileName": "nombre del dibujo",
      "title": "título",
      "componentCount": 15,
      "evidence": {...}
    }
  ],
  "components": [
    {
      "tempId": "merged_comp_1",
      "name": "string",
      "originalName": "string - sin traducir",
      "code": "string | null",
      "itemNumber": "string | null",
      "quantity": "number | null",
      "fileName": "string | null",
      "fileType": "assembly | part | null",
      "type": "string",
      "system": "string | null",
      "description": "string | null",
      "parentTempId": "string | null - referencia al assembly padre",
      "evidence": [...],
      "status": "confirmed | pending | uncertain",
      "needsConfirmation": false,
      "mergedFrom": ["file1_comp1"]
    }
  ],
  "conflicts": [
    {
      "type": "DUPLICATE_UNCERTAIN | MULTIPLE_PARENTS | FIELD_MISMATCH",
      "items": ["tempId1", "tempId2"],
      "field": "parentTempId | name | etc",
      "values": ["valor1", "valor2"],
      "reason": "explicación del conflicto",
      "suggestedResolution": "descripción de posible resolución | null"
    }
  ],
  "duplicatesDetected": [
    {
      "items": ["file1_comp1", "file2_comp3"],
      "matchType": "EXACT_CODE | EXACT_FILENAME | NORMALIZED_NAME",
      "matchValue": "ABC123.ipt",
      "resolution": "merged into merged_comp_1",
      "confidence": 0.95
    }
  ],
  "warnings": ["Lista de problemas encontrados durante el merge"],
  "overallConfidence": 0.85
}`;

// =============================================================================
// VISION-SPECIFIC PROMPT (for scanned/diagram pages)
// =============================================================================

export const VISION_EXTRACTION_PROMPT = `Eres un experto en análisis de documentación técnica industrial con visión por computador.
Tu tarea PRINCIPAL es extraer TODOS los componentes de las tablas PARTS LIST.

═══════════════════════════════════════════════════════════════════════════════
██  TAREA CRÍTICA: EXTRAER CADA FILA DE LA PARTS LIST - SIN EXCEPCIONES  ██
═══════════════════════════════════════════════════════════════════════════════

BUSCA la tabla "PARTS LIST" en cada imagen. Típicamente tiene columnas:
| ITEM | QTY | FILE NAME |

OBLIGATORIO - EXTRAER CADA FILA:
- Fila 1: ITEM=1, QTY=X, FILE NAME=...  → componente 1
- Fila 2: ITEM=2, QTY=X, FILE NAME=...  → componente 2
- Fila 3: ITEM=3, QTY=X, FILE NAME=...  → componente 3
- ... CONTINUAR HASTA LA ÚLTIMA FILA ...
- Fila N: ITEM=N, QTY=X, FILE NAME=... → componente N

CADA FILA = UN COMPONENTE EN EL ARRAY "components[]"
Si hay 5 filas → 5 componentes
Si hay 10 filas → 10 componentes
Si hay 15 filas → 15 componentes

ARCHIVOS CAD:
- .iam = ASSEMBLY (ensamble)
- .ipt = PART (pieza individual)

LEER NOMBRES DE ARCHIVO EXACTAMENTE COMO APARECEN:
Ejemplos reales: "Ponte Pressatore 1300.iam", "H1300.iam", "Barra Rinforzo.ipt"

═══════════════════════════════════════════════════════════════════════════════
TITLE BLOCK (esquina inferior derecha)
═══════════════════════════════════════════════════════════════════════════════
Buscar: Nombre del dibujo, Marca (ej: "Gervasi srl"), Modelo (ej: "GXL 1300")

═══════════════════════════════════════════════════════════════════════════════
VARIANTES DE MÁQUINA (buscar en rutas de archivo)
═══════════════════════════════════════════════════════════════════════════════
- "...\\GXL 1300 P\\..." → variante "P"
- "...\\GXL 1300 A\\..." → variante "A"
- "...\\GXL 1300 DS\\..." → variante "DS"
Reportar en machineScopesDetected[].

═══════════════════════════════════════════════════════════════════════════════
REGLAS DE EXTRACCIÓN
═══════════════════════════════════════════════════════════════════════════════
✓ EXTRAER cada fila de la PARTS LIST como un componente separado
✓ LEER el texto exactamente como aparece
✓ NO saltear ninguna fila de la tabla
✗ NO inventar datos que no estén visibles
✗ NO interpretar el dibujo 3D - solo extraer de la TABLA

═══════════════════════════════════════════════════════════════════════════════
FORMATO DE RESPUESTA JSON
═══════════════════════════════════════════════════════════════════════════════
{
  "machineInfo": {
    "name": "GXL 1300",
    "brand": "Gervasi srl",
    "model": "GXL 1300",
    "type": "PRODUCTION",
    "weight": "MASS visible | null",
    "serialNumber": null, "manufacturingYear": null, "power": null,
    "voltage": null, "dimensions": null, "description": null, "technicalNotes": null
  },
  "machineScopesDetected": [
    {"baseName": "GXL 1300", "variant": "P", "fullPath": "ruta\\vista", "confidence": 0.95}
  ],
  "machineMatch": {"status": "UNIQUE", "selectedScope": 0, "reason": ""},
  "pageAssemblies": [
    {
      "tempId": "page1_assembly",
      "pageIndex": 1,
      "drawingFileName": "INSIEME.iam",
      "title": "título del ensamble",
      "drawingNumber": null, "revision": null,
      "evidence": {"snippet": "title block text", "confidence": 0.9}
    }
  ],
  "partsListsFound": [
    {"pageIndex": 1, "format": "TABLE", "columns": ["ITEM","QTY","FILE NAME"], "itemCount": 5, "linkedToAssembly": "page1_assembly"}
  ],
  "components": [
    {
      "tempId": "page1_comp1",
      "name": "Nombre descriptivo",
      "originalName": "Nombre original",
      "itemNumber": "1",
      "quantity": 2,
      "fileName": "H1300.iam",
      "fileType": "assembly",
      "type": "ensamble",
      "parentTempId": "page1_assembly",
      "code": null, "system": null, "description": null,
      "evidence": {"pageIndex": 1, "snippet": "1 | 2 | H1300.iam", "confidence": 0.95}
    },
    {
      "tempId": "page1_comp2",
      "name": "Segundo componente",
      "originalName": "Original name",
      "itemNumber": "2",
      "quantity": 1,
      "fileName": "Barra.ipt",
      "fileType": "part",
      "type": "pieza",
      "parentTempId": "page1_assembly",
      "code": null, "system": null, "description": null,
      "evidence": {"pageIndex": 1, "snippet": "2 | 1 | Barra.ipt", "confidence": 0.95}
    }
  ],
  "machineEvidence": [{"field": "brand", "pageIndex": 1, "snippet": "Gervasi srl", "confidence": 0.95}],
  "warnings": []
}

RECUERDA: Si la PARTS LIST tiene 10 filas, DEBES devolver 10 componentes en el array.
CADA FILA = UN OBJETO EN components[].`;

// =============================================================================
// COMPONENT TYPE MAPPING
// =============================================================================

export const COMPONENT_TYPES = [
  'motor',
  'bomba',
  'valvula',
  'sensor',
  'actuador',
  'estructura',
  'rodamiento',
  'engranaje',
  'correa',
  'cilindro',
  'compresor',
  'reductor',
  'variador',
  'plc',
  'hmi',
  'tablero',
  'transformador',
  'otro',
] as const;

export const SYSTEM_TYPES = [
  'electrico',
  'hidraulico',
  'neumatico',
  'mecanico',
  'automatizacion',
  'refrigeracion',
  'lubricacion',
  'combustible',
  'control',
  'seguridad',
  'otro',
] as const;

export const MACHINE_TYPES = [
  'PRODUCTION',
  'MAINTENANCE',
  'UTILITY',
  'PACKAGING',
  'TRANSPORTATION',
  'OTHER',
] as const;

// =============================================================================
// TRANSLATION SETTINGS
// =============================================================================

export interface TranslationSettings {
  enabled: boolean;
  sourceLanguage: string | null; // 'auto' | 'en' | 'pt' | 'de' | 'fr' | 'it' | 'zh' | 'ja' | 'ko'
  targetLanguage: string | null; // 'es' | 'en' | 'pt'
}

export const LANGUAGE_NAMES: Record<string, string> = {
  auto: 'automática',
  es: 'español',
  en: 'inglés',
  pt: 'portugués',
  de: 'alemán',
  fr: 'francés',
  it: 'italiano',
  zh: 'chino',
  ja: 'japonés',
  ko: 'coreano',
};

/**
 * Build translation instructions for prompts
 */
export function buildTranslationInstructions(settings: TranslationSettings): string {
  if (!settings.enabled || !settings.targetLanguage) {
    return '';
  }

  const sourceLang = settings.sourceLanguage === 'auto' || !settings.sourceLanguage
    ? 'el idioma del documento (detectar automáticamente)'
    : LANGUAGE_NAMES[settings.sourceLanguage] || settings.sourceLanguage;

  const targetLang = LANGUAGE_NAMES[settings.targetLanguage] || settings.targetLanguage;

  return `
═══════════════════════════════════════════════════════════════════════════════
INSTRUCCIONES DE TRADUCCIÓN - OBLIGATORIO SEGUIR
═══════════════════════════════════════════════════════════════════════════════

IDIOMA ORIGEN: ${sourceLang}
IDIOMA DESTINO: ${targetLang}

CAMPOS QUE DEBEN TRADUCIRSE AL ${targetLang.toUpperCase()}:
✓ name (nombre de máquina y componentes)
✓ description (descripciones)
✓ technicalNotes (notas técnicas)
✓ title (títulos de ensambles/páginas)
✓ Cualquier texto descriptivo

CAMPOS QUE NO SE TRADUCEN (mantener original):
✗ code / partNumber (códigos de parte)
✗ fileName (nombres de archivo como "pieza.ipt")
✗ serialNumber (números de serie)
✗ brand (marcas comerciales)
✗ model (modelos)
✗ Valores numéricos (dimensiones, pesos, etc.)
✗ snippet en evidence (SIEMPRE texto original para referencia)

ESTRUCTURA DE RESPUESTA PARA TRADUCCIONES:
- Campo "name": valor traducido al ${targetLang}
- Campo "originalName": valor original sin traducir (para referencia)

EJEMPLOS DE TRADUCCIÓN (${sourceLang} → ${targetLang}):
- "Main Motor" → "Motor Principal"
- "Hydraulic Pump" → "Bomba Hidráulica"
- "Gear Assembly" → "Ensamble de Engranajes"
- "Bearing Housing" → "Carcasa de Rodamiento"
- "Control Panel" → "Panel de Control"
- "Safety Guard" → "Protección de Seguridad"

IMPORTANTE: La traducción es OBLIGATORIA para los campos indicados.
Si el documento ya está en ${targetLang}, mantener el texto original.
═══════════════════════════════════════════════════════════════════════════════
`;
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Build the context message for AI with file information
 */
export function buildFileContext(
  fileIndex: number,
  fileName: string,
  fileTypes: string[],
  pageCount: number
): string {
  return `
ARCHIVO ${fileIndex + 1}: ${fileName}
- Tipo detectado: ${fileTypes.join(', ')}
- Páginas: ${pageCount}
`.trim();
}

/**
 * Build prompt for text-based extraction
 */
export function buildTextExtractionPrompt(
  text: string,
  fileContext: string,
  translationSettings?: TranslationSettings
): string {
  const translationInstructions = translationSettings
    ? buildTranslationInstructions(translationSettings)
    : '';

  return `${PER_FILE_EXTRACTION_PROMPT}
${translationInstructions}
${fileContext}

CONTENIDO DEL DOCUMENTO:
---
${text.substring(0, 30000)}
${text.length > 30000 ? '\n... [texto truncado por longitud]' : ''}
---

Extrae la información según las instrucciones. Responde SOLO con JSON válido.`;
}

/**
 * Build prompt for vision-based extraction
 */
export function buildVisionExtractionPrompt(
  fileContext: string,
  translationSettings?: TranslationSettings
): string {
  const translationInstructions = translationSettings
    ? buildTranslationInstructions(translationSettings)
    : '';

  return `${VISION_EXTRACTION_PROMPT}
${translationInstructions}
${fileContext}

Analiza la imagen y extrae toda la información técnica visible.
Responde SOLO con JSON válido.`;
}

/**
 * Build prompt for merging multiple extractions
 */
export function buildMergePrompt(
  extractions: Array<{
    fileId: number;
    fileName: string;
    extraction: any;
  }>,
  translationSettings?: TranslationSettings
): string {
  const extractionsJson = JSON.stringify(extractions, null, 2);

  const translationNote = translationSettings?.enabled && translationSettings.targetLanguage
    ? `\nNOTA: Los datos ya fueron traducidos al ${LANGUAGE_NAMES[translationSettings.targetLanguage] || translationSettings.targetLanguage}. Mantén el idioma traducido en la consolidación.\n`
    : '';

  return `${MERGE_EXTRACTION_PROMPT}
${translationNote}
EXTRACCIONES A CONSOLIDAR:
${extractionsJson}

Consolida todas las extracciones en un árbol unificado.
Responde SOLO con JSON válido.`;
}

// =============================================================================
// SIMPLE EXTRACTION PROMPTS (unified for upload and external AI modes)
// =============================================================================

export type OutputLanguage = 'es' | 'en' | 'it' | 'pt';

/**
 * Simple prompts that produce text output (easier to parse than JSON)
 * Used by both upload mode (internal AI) and external AI mode
 */
export const SIMPLE_EXTRACTION_PROMPTS: Record<OutputLanguage, string> = {
  es: `Analiza los documentos técnicos y extrae la información en el formato indicado.

⚠️ TRADUCCIÓN OBLIGATORIA: Traduce TODOS los nombres de componentes al ESPAÑOL.
- Si el documento está en italiano/inglés/otro idioma, traduce los nombres
- Ejemplo: "Banco Vibrante" en vez de "Vibrating Bench"
- Ejemplo: "Rodamiento" en vez de "Bearing" o "Cuscinetto"
- Mantén los códigos y números de parte originales

IMPORTANTE:
- La MÁQUINA es el equipo completo (solo información general)
- Los COMPONENTES son las partes físicas que la componen
- NO crear un componente con el mismo nombre que la máquina

=== MÁQUINA ===
Nombre: [nombre completo del equipo]
Marca: [fabricante]
Modelo: [modelo]
Número de serie: [si está disponible]
Año: [año de fabricación]
Tipo: PRODUCTION
Descripción: [breve descripción]

=== ÁRBOL DE COMPONENTES ===
Muestra la estructura jerárquica visual. Los ensambles principales van al nivel superior (sin padre):

├── [Ensamble Principal 1]
│   ├── [Pieza 1.1]
│   ├── [Pieza 1.2]
│   └── [Sub-ensamble 1.3]
│       └── [Pieza 1.3.1]
├── [Ensamble Principal 2]
│   └── [Pieza 2.1]
└── [Ensamble Principal 3]

=== DETALLE DE COMPONENTES ===
Lista cada componente. Los ensambles principales NO tienen padre (Padre: vacío):

[Nombre del ensamble principal 1]
Pos: [número de posición en el plano, ej: 1, 2, 3]
Código: [código de parte/referencia]
Cantidad: 1
Tipo: ensamble
Sistema: mecánico
Padre:

[Nombre de pieza 1.1]
Pos: [número de posición en el plano]
Código: [código de parte]
Cantidad: [cantidad]
Tipo: [pieza/rodamiento/motor/válvula/sensor/etc]
Sistema: [mecánico/hidráulico/eléctrico/neumático]
Padre: [Nombre del ensamble principal 1]

[Nombre del ensamble principal 2]
Pos: [número de posición]
Código: [código de parte]
Cantidad: [cantidad]
Tipo: ensamble
Sistema: [mecánico/hidráulico/eléctrico/neumático]
Padre:

REGLAS:
1. Los ENSAMBLES PRINCIPALES van sin padre (Padre: vacío) - pueden ser varios
2. NO crear un componente raíz con el mismo nombre que la máquina
3. Las piezas y sub-ensambles DEBEN tener "Padre:" con el nombre EXACTO del ensamble que los contiene
4. En "Padre:" usar SOLO el nombre, sin paréntesis ni referencias a archivos
5. Incluir TODOS los componentes de las PARTS LIST del documento
6. "Pos:" es el número de ítem/posición que aparece en el plano de despiece (1, 2, 3...)`,

  en: `Analyze the technical documents and extract information in the indicated format.

⚠️ MANDATORY TRANSLATION: Translate ALL component names to ENGLISH.
- If the document is in Italian/Spanish/other language, translate the names
- Example: "Vibrating Bench" instead of "Banco Vibrante"
- Example: "Bearing" instead of "Cuscinetto" or "Rodamiento"
- Keep original part numbers and codes unchanged

IMPORTANT:
- The MACHINE is the complete equipment (general info only)
- COMPONENTS are the physical parts that make it up
- DO NOT create a component with the same name as the machine

=== MACHINE ===
Name: [full equipment name]
Brand: [manufacturer]
Model: [model]
Serial Number: [if available]
Year: [manufacturing year]
Type: PRODUCTION
Description: [brief description]

=== COMPONENT TREE ===
Show the visual hierarchical structure. Main assemblies go at top level (no parent):

├── [Main Assembly 1]
│   ├── [Part 1.1]
│   ├── [Part 1.2]
│   └── [Sub-assembly 1.3]
│       └── [Part 1.3.1]
├── [Main Assembly 2]
│   └── [Part 2.1]
└── [Main Assembly 3]

=== COMPONENT DETAILS ===
List each component. Main assemblies have NO parent (Parent: empty):

[Main assembly 1 name]
Pos: [position number in the drawing, e.g.: 1, 2, 3]
Code: [part code/reference]
Quantity: 1
Type: assembly
System: mechanical
Parent:

[Part 1.1 name]
Pos: [position number in the drawing]
Code: [part code]
Quantity: [quantity]
Type: [part/bearing/motor/valve/sensor/etc]
System: [mechanical/hydraulic/electrical/pneumatic]
Parent: [Main assembly 1 name]

[Main assembly 2 name]
Pos: [position number]
Code: [part code]
Quantity: [quantity]
Type: assembly
System: [mechanical/hydraulic/electrical/pneumatic]
Parent:

RULES:
1. MAIN ASSEMBLIES have no parent (Parent: empty) - there can be multiple
2. DO NOT create a root component with the same name as the machine
3. Parts and sub-assemblies MUST have "Parent:" with the EXACT name of the containing assembly
4. In "Parent:" use ONLY the name, no parentheses or file references
5. Include ALL components from the PARTS LIST in the document
6. "Pos:" is the item/position number shown in the exploded diagram (1, 2, 3...)`,

  it: `Analizza i documenti tecnici ed estrai le informazioni nel formato indicato.

⚠️ TRADUZIONE OBBLIGATORIA: Traduci TUTTI i nomi dei componenti in ITALIANO.
- Se il documento è in inglese/spagnolo/altra lingua, traduci i nomi
- Esempio: "Banco Vibrante" invece di "Vibrating Bench"
- Esempio: "Cuscinetto" invece di "Bearing" o "Rodamiento"
- Mantieni i codici e i numeri di parte originali

IMPORTANTE:
- La MACCHINA è l'attrezzatura completa (solo informazioni generali)
- I COMPONENTI sono le parti fisiche che la compongono
- NON creare un componente con lo stesso nome della macchina

=== MACCHINA ===
Nome: [nome completo dell'attrezzatura]
Marca: [produttore]
Modello: [modello]
Numero di serie: [se disponibile]
Anno: [anno di fabbricazione]
Tipo: PRODUCTION
Descrizione: [breve descrizione]

=== ALBERO DEI COMPONENTI ===
Mostra la struttura gerarchica visiva. Gli assiemi principali vanno al livello superiore (senza padre):

├── [Assieme Principale 1]
│   ├── [Pezzo 1.1]
│   ├── [Pezzo 1.2]
│   └── [Sotto-assieme 1.3]
│       └── [Pezzo 1.3.1]
├── [Assieme Principale 2]
│   └── [Pezzo 2.1]
└── [Assieme Principale 3]

=== DETTAGLIO COMPONENTI ===
Elenca ogni componente. Gli assiemi principali NON hanno padre (Padre: vuoto):

[Nome dell'assieme principale 1]
Pos: [numero di posizione nel disegno, es: 1, 2, 3]
Codice: [codice parte/riferimento]
Quantità: 1
Tipo: assieme
Sistema: meccanico
Padre:

[Nome del pezzo 1.1]
Pos: [numero di posizione nel disegno]
Codice: [codice parte]
Quantità: [quantità]
Tipo: [pezzo/cuscinetto/motore/valvola/sensore/ecc]
Sistema: [meccanico/idraulico/elettrico/pneumatico]
Padre: [Nome dell'assieme principale 1]

[Nome dell'assieme principale 2]
Pos: [numero di posizione]
Codice: [codice parte]
Quantità: [quantità]
Tipo: assieme
Sistema: [meccanico/idraulico/elettrico/pneumatico]
Padre:

REGOLE:
1. Gli ASSIEMI PRINCIPALI vanno senza padre (Padre: vuoto) - possono essere più di uno
2. NON creare un componente radice con lo stesso nome della macchina
3. I pezzi e sotto-assiemi DEVONO avere "Padre:" con il nome ESATTO dell'assieme che li contiene
4. In "Padre:" usare SOLO il nome, senza parentesi o riferimenti a file
5. Includere TUTTI i componenti dalle PARTS LIST del documento
6. "Pos:" è il numero di posizione/item mostrato nel disegno esploso (1, 2, 3...)`,

  pt: `Analise os documentos técnicos e extraia as informações no formato indicado.

⚠️ TRADUÇÃO OBRIGATÓRIA: Traduza TODOS os nomes dos componentes para PORTUGUÊS.
- Se o documento está em italiano/inglês/outra língua, traduza os nomes
- Exemplo: "Banco Vibratório" em vez de "Vibrating Bench"
- Exemplo: "Rolamento" em vez de "Bearing" ou "Cuscinetto"
- Mantenha os códigos e números de peça originais

IMPORTANTE:
- A MÁQUINA é o equipamento completo (apenas informações gerais)
- Os COMPONENTES são as peças físicas que a compõem
- NÃO criar um componente com o mesmo nome da máquina

=== MÁQUINA ===
Nome: [nome completo do equipamento]
Marca: [fabricante]
Modelo: [modelo]
Número de série: [se disponível]
Ano: [ano de fabricação]
Tipo: PRODUCTION
Descrição: [breve descrição]

=== ÁRVORE DE COMPONENTES ===
Mostre a estrutura hierárquica visual. As montagens principais vão no nível superior (sem pai):

├── [Montagem Principal 1]
│   ├── [Peça 1.1]
│   ├── [Peça 1.2]
│   └── [Sub-montagem 1.3]
│       └── [Peça 1.3.1]
├── [Montagem Principal 2]
│   └── [Peça 2.1]
└── [Montagem Principal 3]

=== DETALHES DOS COMPONENTES ===
Liste cada componente. As montagens principais NÃO têm pai (Pai: vazio):

[Nome da montagem principal 1]
Pos: [número de posição no desenho, ex: 1, 2, 3]
Código: [código da peça/referência]
Quantidade: 1
Tipo: montagem
Sistema: mecânico
Pai:

[Nome da peça 1.1]
Pos: [número de posição no desenho]
Código: [código da peça]
Quantidade: [quantidade]
Tipo: [peça/rolamento/motor/válvula/sensor/etc]
Sistema: [mecânico/hidráulico/elétrico/pneumático]
Pai: [Nome da montagem principal 1]

[Nome da montagem principal 2]
Pos: [número de posição]
Código: [código da peça]
Quantidade: [quantidade]
Tipo: montagem
Sistema: [mecânico/hidráulico/elétrico/pneumático]
Pai:

REGRAS:
1. As MONTAGENS PRINCIPAIS vão sem pai (Pai: vazio) - podem ser várias
2. NÃO criar um componente raiz com o mesmo nome da máquina
3. As peças e sub-montagens DEVEM ter "Pai:" com o nome EXATO da montagem que as contém
4. Em "Pai:" usar APENAS o nome, sem parênteses ou referências a arquivos
5. Incluir TODOS os componentes das PARTS LIST do documento
6. "Pos:" é o número de posição/item mostrado no desenho explodido (1, 2, 3...)`,
};

/**
 * Component-only extraction prompts — same as SIMPLE_EXTRACTION_PROMPTS but
 * WITHOUT the machine section. Used when adding components to an EXISTING machine.
 */
export const COMPONENT_ONLY_PROMPTS: Record<OutputLanguage, string> = {
  es: `Analiza los documentos técnicos y extrae SOLO los componentes en el formato indicado.
La máquina ya existe en el sistema, NO incluir información de máquina.

⚠️ TRADUCCIÓN OBLIGATORIA: Traduce TODOS los nombres de componentes al ESPAÑOL.
- Si el documento está en italiano/inglés/otro idioma, traduce los nombres
- Ejemplo: "Banco Vibrante" en vez de "Vibrating Bench"
- Ejemplo: "Rodamiento" en vez de "Bearing" o "Cuscinetto"
- Mantén los códigos y números de parte originales

=== ÁRBOL DE COMPONENTES ===
Muestra la estructura jerárquica visual. Los ensambles principales van al nivel superior (sin padre):

├── [Ensamble Principal 1]
│   ├── [Pieza 1.1]
│   ├── [Pieza 1.2]
│   └── [Sub-ensamble 1.3]
│       └── [Pieza 1.3.1]
├── [Ensamble Principal 2]
│   └── [Pieza 2.1]
└── [Ensamble Principal 3]

=== DETALLE DE COMPONENTES ===
Lista cada componente. Los ensambles principales NO tienen padre (Padre: vacío):

[Nombre del ensamble principal 1]
Pos: [número de posición en el plano, ej: 1, 2, 3]
Código: [código de parte/referencia]
Cantidad: 1
Tipo: ensamble
Sistema: mecánico
Padre:

[Nombre de pieza 1.1]
Pos: [número de posición en el plano]
Código: [código de parte]
Cantidad: [cantidad]
Tipo: [pieza/rodamiento/motor/válvula/sensor/etc]
Sistema: [mecánico/hidráulico/eléctrico/neumático]
Padre: [Nombre del ensamble principal 1]

[Nombre del ensamble principal 2]
Pos: [número de posición]
Código: [código de parte]
Cantidad: [cantidad]
Tipo: ensamble
Sistema: [mecánico/hidráulico/eléctrico/neumático]
Padre:

REGLAS:
1. Los ENSAMBLES PRINCIPALES van sin padre (Padre: vacío) - pueden ser varios
2. Las piezas y sub-ensambles DEBEN tener "Padre:" con el nombre EXACTO del ensamble que los contiene
3. En "Padre:" usar SOLO el nombre, sin paréntesis ni referencias a archivos
4. Incluir TODOS los componentes de las PARTS LIST del documento
5. "Pos:" es el número de ítem/posición que aparece en el plano de despiece (1, 2, 3...)
6. NO incluir sección de máquina — solo componentes`,

  en: `Analyze the technical documents and extract ONLY the components in the indicated format.
The machine already exists in the system, DO NOT include machine information.

⚠️ MANDATORY TRANSLATION: Translate ALL component names to ENGLISH.
- If the document is in Italian/Spanish/other language, translate the names
- Example: "Vibrating Bench" instead of "Banco Vibrante"
- Example: "Bearing" instead of "Cuscinetto" or "Rodamiento"
- Keep original part numbers and codes unchanged

=== COMPONENT TREE ===
Show the visual hierarchical structure. Main assemblies go at top level (no parent):

├── [Main Assembly 1]
│   ├── [Part 1.1]
│   ├── [Part 1.2]
│   └── [Sub-assembly 1.3]
│       └── [Part 1.3.1]
├── [Main Assembly 2]
│   └── [Part 2.1]
└── [Main Assembly 3]

=== COMPONENT DETAILS ===
List each component. Main assemblies have NO parent (Parent: empty):

[Main assembly 1 name]
Pos: [position number in the drawing, e.g.: 1, 2, 3]
Code: [part code/reference]
Quantity: 1
Type: assembly
System: mechanical
Parent:

[Part 1.1 name]
Pos: [position number in the drawing]
Code: [part code]
Quantity: [quantity]
Type: [part/bearing/motor/valve/sensor/etc]
System: [mechanical/hydraulic/electrical/pneumatic]
Parent: [Main assembly 1 name]

[Main assembly 2 name]
Pos: [position number]
Code: [part code]
Quantity: [quantity]
Type: assembly
System: [mechanical/hydraulic/electrical/pneumatic]
Parent:

RULES:
1. MAIN ASSEMBLIES have no parent (Parent: empty) - there can be multiple
2. Parts and sub-assemblies MUST have "Parent:" with the EXACT name of the containing assembly
3. In "Parent:" use ONLY the name, no parentheses or file references
4. Include ALL components from the PARTS LIST in the document
5. "Pos:" is the item/position number shown in the exploded diagram (1, 2, 3...)
6. DO NOT include machine section — only components`,

  it: `Analizza i documenti tecnici ed estrai SOLO i componenti nel formato indicato.
La macchina esiste già nel sistema, NON includere informazioni sulla macchina.

⚠️ TRADUZIONE OBBLIGATORIA: Traduci TUTTI i nomi dei componenti in ITALIANO.
- Se il documento è in inglese/spagnolo/altra lingua, traduci i nomi
- Esempio: "Banco Vibrante" invece di "Vibrating Bench"
- Esempio: "Cuscinetto" invece di "Bearing" o "Rodamiento"
- Mantieni i codici e i numeri di parte originali

=== ALBERO DEI COMPONENTI ===
Mostra la struttura gerarchica visiva. Gli assiemi principali vanno al livello superiore (senza padre):

├── [Assieme Principale 1]
│   ├── [Pezzo 1.1]
│   ├── [Pezzo 1.2]
│   └── [Sotto-assieme 1.3]
│       └── [Pezzo 1.3.1]
├── [Assieme Principale 2]
│   └── [Pezzo 2.1]
└── [Assieme Principale 3]

=== DETTAGLIO COMPONENTI ===
Elenca ogni componente. Gli assiemi principali NON hanno padre (Padre: vuoto):

[Nome dell'assieme principale 1]
Pos: [numero di posizione nel disegno, es: 1, 2, 3]
Codice: [codice parte/riferimento]
Quantità: 1
Tipo: assieme
Sistema: meccanico
Padre:

[Nome del pezzo 1.1]
Pos: [numero di posizione nel disegno]
Codice: [codice parte]
Quantità: [quantità]
Tipo: [pezzo/cuscinetto/motore/valvola/sensore/ecc]
Sistema: [meccanico/idraulico/elettrico/pneumatico]
Padre: [Nome dell'assieme principale 1]

[Nome dell'assieme principale 2]
Pos: [numero di posizione]
Codice: [codice parte]
Quantità: [quantità]
Tipo: assieme
Sistema: [meccanico/idraulico/elettrico/pneumatico]
Padre:

REGOLE:
1. Gli ASSIEMI PRINCIPALI vanno senza padre (Padre: vuoto) - possono essere più di uno
2. I pezzi e sotto-assiemi DEVONO avere "Padre:" con il nome ESATTO dell'assieme che li contiene
3. In "Padre:" usare SOLO il nome, senza parentesi o riferimenti a file
4. Includere TUTTI i componenti dalle PARTS LIST del documento
5. "Pos:" è il numero di posizione/item mostrato nel disegno esploso (1, 2, 3...)
6. NON includere sezione macchina — solo componenti`,

  pt: `Analise os documentos técnicos e extraia APENAS os componentes no formato indicado.
A máquina já existe no sistema, NÃO incluir informações da máquina.

⚠️ TRADUÇÃO OBRIGATÓRIA: Traduza TODOS os nomes dos componentes para PORTUGUÊS.
- Se o documento está em italiano/inglês/outra língua, traduza os nomes
- Exemplo: "Banco Vibratório" em vez de "Vibrating Bench"
- Exemplo: "Rolamento" em vez de "Bearing" ou "Cuscinetto"
- Mantenha os códigos e números de peça originais

=== ÁRVORE DE COMPONENTES ===
Mostre a estrutura hierárquica visual. As montagens principais vão no nível superior (sem pai):

├── [Montagem Principal 1]
│   ├── [Peça 1.1]
│   ├── [Peça 1.2]
│   └── [Sub-montagem 1.3]
│       └── [Peça 1.3.1]
├── [Montagem Principal 2]
│   └── [Peça 2.1]
└── [Montagem Principal 3]

=== DETALHES DOS COMPONENTES ===
Liste cada componente. As montagens principais NÃO têm pai (Pai: vazio):

[Nome da montagem principal 1]
Pos: [número de posição no desenho, ex: 1, 2, 3]
Código: [código da peça/referência]
Quantidade: 1
Tipo: montagem
Sistema: mecânico
Pai:

[Nome da peça 1.1]
Pos: [número de posição no desenho]
Código: [código da peça]
Quantidade: [quantidade]
Tipo: [peça/rolamento/motor/válvula/sensor/etc]
Sistema: [mecânico/hidráulico/elétrico/pneumático]
Pai: [Nome da montagem principal 1]

[Nome da montagem principal 2]
Pos: [número de posição]
Código: [código da peça]
Quantidade: [quantidade]
Tipo: montagem
Sistema: [mecânico/hidráulico/elétrico/pneumático]
Pai:

REGRAS:
1. As MONTAGENS PRINCIPAIS vão sem pai (Pai: vazio) - podem ser várias
2. As peças e sub-montagens DEVEM ter "Pai:" com o nome EXATO da montagem que as contém
3. Em "Pai:" usar APENAS o nome, sem parênteses ou referências a arquivos
4. Incluir TODOS os componentes das PARTS LIST do documento
5. "Pos:" é o número de posição/item mostrado no desenho explodido (1, 2, 3...)
6. NÃO incluir seção de máquina — apenas componentes`,
};

/**
 * System message for GPT extraction — sets the role as a structured data extractor.
 */
export const EXTRACTION_SYSTEM_MESSAGE: Record<OutputLanguage, string> = {
  es: `Eres un extractor de datos técnicos de maquinaria industrial.

REGLAS ABSOLUTAS:
1. Responde ÚNICAMENTE usando las secciones exactas: === MÁQUINA ===, === ÁRBOL DE COMPONENTES === y === DETALLE DE COMPONENTES ===
2. NUNCA uses secciones en inglés como "Machine Information" o "Components"
3. Traduce TODOS los nombres de componentes al ESPAÑOL
4. NUNCA repitas el contenido del documento — solo extrae datos en el formato indicado
5. Sigue el formato de la instrucción del usuario AL PIE DE LA LETRA`,

  en: `You are a technical data extractor for industrial machinery.

ABSOLUTE RULES:
1. Respond ONLY using the exact sections: === MACHINE ===, === COMPONENT TREE === and === COMPONENT DETAILS ===
2. NEVER use different section headers
3. Translate ALL component names to ENGLISH
4. NEVER repeat the document content — only extract data in the indicated format
5. Follow the user instruction format EXACTLY`,

  it: `Sei un estrattore di dati tecnici per macchinari industriali.

REGOLE ASSOLUTE:
1. Rispondi SOLO usando le sezioni esatte: === MACCHINA ===, === ALBERO DEI COMPONENTI === e === DETTAGLIO COMPONENTI ===
2. NON usare MAI sezioni in inglese come "Machine Information" o "Components"
3. Traduci TUTTI i nomi dei componenti in ITALIANO
4. NON ripetere MAI il contenuto del documento — estrai solo i dati nel formato indicato
5. Segui il formato dell'istruzione dell'utente ALLA LETTERA`,

  pt: `Você é um extrator de dados técnicos de maquinaria industrial.

REGRAS ABSOLUTAS:
1. Responda APENAS usando as seções exatas: === MÁQUINA ===, === ÁRVORE DE COMPONENTES === e === DETALHES DOS COMPONENTES ===
2. NUNCA use seções em inglês como "Machine Information" ou "Components"
3. Traduza TODOS os nomes dos componentes para PORTUGUÊS
4. NUNCA repita o conteúdo do documento — apenas extraia dados no formato indicado
5. Siga o formato da instrução do usuário AO PÉ DA LETRA`,
};

/**
 * Build prompt for simple extraction (text or vision).
 *
 * Uses the EXACT same prompt as external AI mode (SIMPLE_EXTRACTION_PROMPTS)
 * with the document content appended at the end.
 * This is the same prompt the user copies to ChatGPT in external mode — and it works.
 */
export function buildSimpleExtractionPrompt(
  text: string | null,
  fileContext: string,
  language: OutputLanguage = 'es'
): string {
  // Use the EXACT same prompt that works in external AI mode
  const prompt = SIMPLE_EXTRACTION_PROMPTS[language];

  // Format reminders per language — placed AFTER the document content so GPT doesn't forget
  const FORMAT_REMINDERS: Record<OutputLanguage, string> = {
    es: `RECORDATORIO: Responde EXACTAMENTE con las secciones === MÁQUINA ===, === ÁRBOL DE COMPONENTES === y === DETALLE DE COMPONENTES ===. NO uses inglés. Traduce los nombres al español. Incluí TODOS los componentes y sub-ensambles con su jerarquía completa (Padre). No omitas ningún componente de las PARTS LIST.`,
    en: `REMINDER: Respond EXACTLY with sections === MACHINE ===, === COMPONENT TREE === and === COMPONENT DETAILS ===. Translate names to English.`,
    it: `PROMEMORIA: Rispondi ESATTAMENTE con le sezioni === MACCHINA ===, === ALBERO DEI COMPONENTI === e === DETTAGLIO COMPONENTI ===. NON usare inglese. Traduci i nomi in italiano.`,
    pt: `LEMBRETE: Responda EXATAMENTE com as seções === MÁQUINA ===, === ÁRVORE DE COMPONENTES === e === DETALHES DOS COMPONENTES ===. NÃO use inglês. Traduza os nomes para português.`,
  };

  if (text) {
    // Same prompt + document content + format reminder at the end
    return `${prompt}

${fileContext}

CONTENIDO DEL DOCUMENTO:
---
${text.substring(0, 30000)}
${text.length > 30000 ? '\n... [texto truncado por longitud]' : ''}
---

${FORMAT_REMINDERS[language]}`;
  }

  // Vision mode (no text, just images)
  return `${prompt}

${fileContext}

Analiza las imágenes y extrae toda la información técnica visible siguiendo el formato indicado arriba.

${FORMAT_REMINDERS[language]}`;
}
