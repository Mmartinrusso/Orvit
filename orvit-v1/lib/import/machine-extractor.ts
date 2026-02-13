/**
 * Machine Extractor - AI-powered extraction of machine data from documents
 *
 * Uses OpenAI GPT-4o for text and GPT-4o Vision for images/scanned documents
 * Two-pass approach: per-file extraction then global merge
 */

import 'server-only';
import {
  buildSimpleExtractionPrompt,
  buildFileContext,
  EXTRACTION_SYSTEM_MESSAGE,
  MACHINE_TYPES,
  OutputLanguage,
} from './extraction-prompt';
import { parseAIResponse } from './simple-parser';
import { ImportFileType } from './pdf-processor';

// =============================================================================
// TYPES
// =============================================================================

export interface Evidence {
  fileId: number;
  fileName: string;
  page?: number;
  snippet?: string;
  confidence?: number;
  bbox?: { x: number; y: number; width: number; height: number };
}

export interface ExtractedMachineInfo {
  name: string | null;
  brand: string | null;
  model: string | null;
  serialNumber: string | null;
  manufacturingYear: number | null;
  type: typeof MACHINE_TYPES[number];
  power: string | null;
  voltage: string | null;
  weight: string | null;
  dimensions: string | null;
  description: string | null;
  technicalNotes: string | null;
  confidence: number;
  evidences: Evidence[];
}

export interface ExtractedComponent {
  tempId: string;
  name: string;
  originalName?: string;
  code: string | null;
  itemNumber?: string | null;
  quantity?: number | null;
  fileName?: string | null;
  fileType?: 'assembly' | 'part' | null;
  type: string;
  system: string | null;
  description: string | null;
  parentTempId: string | null;
  confidence: number;
  evidences: Evidence[];
  status: 'confirmed' | 'pending' | 'uncertain';
  needsConfirmation: boolean;
  mergedFrom?: string[];
  logo?: string | null;
}

export interface MergeConflict {
  type: 'DUPLICATE_UNCERTAIN' | 'MULTIPLE_PARENTS' | 'FIELD_MISMATCH';
  items: string[];
  field?: string;
  values?: string[];
  reason: string;
  suggestedResolution?: string | null;
}

export interface DuplicateDetection {
  items: string[];
  matchType: 'EXACT_CODE' | 'EXACT_FILENAME' | 'NORMALIZED_NAME';
  matchValue: string;
  resolution: string;
  confidence: number;
}

export interface MergedAssembly {
  tempId: string;
  sourceFileId: number;
  sourceFileName: string;
  pageIndex: number;
  drawingFileName: string | null;
  title: string | null;
  componentCount: number;
  evidence: {
    snippet: string;
    confidence: number;
  };
}

export interface ExtractedMachineData {
  fileId?: number;
  machine: ExtractedMachineInfo;
  allMachineScopesDetected: MachineScope[];
  machineMatchStatus: 'UNIQUE' | 'AMBIGUOUS' | 'MULTIPLE_VARIANTS' | 'NOT_FOUND';
  assemblies: MergedAssembly[];
  components: ExtractedComponent[];
  conflicts: MergeConflict[];
  duplicatesDetected: DuplicateDetection[];
  warnings: string[];
  overallConfidence: number;
  processingTimeMs: number;
}

export interface FileExtractionInput {
  fileId: number;
  fileName: string;
  fileTypes: ImportFileType[];
  pageCount: number;
  text?: string;
  images?: string[]; // base64 encoded images for vision
  pdfBase64?: string; // raw PDF as base64 for direct GPT-4o input
  needsVision: boolean;
}

export interface MachineScope {
  baseName: string;
  variant: string | null;
  fullPath: string;
  confidence: number;
  sourceFileId?: number;
}

export interface PageAssembly {
  tempId: string;
  pageIndex: number;
  drawingFileName: string | null;
  drawingNumber: string | null;
  title: string | null;
  revision: string | null;
  evidence: {
    snippet: string;
    confidence: number;
  };
}

export interface PartsListInfo {
  pageIndex: number;
  format: 'TABLE' | 'LIST' | 'DIAGRAM_LABELS';
  columns: string[];
  itemCount: number;
  linkedToAssembly: string | null;
}

export interface PerFileExtractionResult {
  fileId: number;
  fileName: string;
  machineInfo: Partial<ExtractedMachineInfo>;
  machineScopesDetected: MachineScope[];
  machineMatch: {
    status: 'UNIQUE' | 'AMBIGUOUS' | 'NOT_FOUND';
    selectedScope: number | null;
    reason: string;
  };
  pageAssemblies: PageAssembly[];
  partsListsFound: PartsListInfo[];
  components: Array<{
    tempId: string;
    name: string;
    originalName?: string;
    code: string | null;
    itemNumber: string | null;
    quantity: number | null;
    fileName: string | null;
    fileType: 'assembly' | 'part' | null;
    type: string;
    system: string | null;
    description: string | null;
    parentTempId: string | null;
    evidence: {
      pageIndex: number;
      snippet: string;
      confidence: number;
    };
  }>;
  machineEvidence: Array<{
    field: string;
    pageIndex: number;
    snippet: string;
    confidence: number;
  }>;
  warnings: string[];
  confidence: number;
  tokensUsed?: number;
  model: string;
  processingTimeMs: number;
}

// =============================================================================
// AI CLIENTS (OpenAI for text, Claude for vision)
// =============================================================================

let openaiClient: any = null;
let anthropicClient: any = null;

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

async function getAnthropicClient() {
  if (!anthropicClient) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error('ANTHROPIC_API_KEY no está configurada');
    }
    const Anthropic = (await import('@anthropic-ai/sdk')).default;
    anthropicClient = new Anthropic({ apiKey });
  }
  return anthropicClient;
}

// =============================================================================
// JSON REPAIR UTILITIES
// =============================================================================

/**
 * Attempt to repair truncated JSON by closing open brackets/braces
 */
function repairTruncatedJson(jsonStr: string): string {
  let repaired = jsonStr.trim();

  // Count open brackets and braces
  let openBraces = 0;
  let openBrackets = 0;
  let inString = false;
  let escape = false;

  for (let i = 0; i < repaired.length; i++) {
    const char = repaired[i];

    if (escape) {
      escape = false;
      continue;
    }

    if (char === '\\') {
      escape = true;
      continue;
    }

    if (char === '"' && !escape) {
      inString = !inString;
      continue;
    }

    if (inString) continue;

    if (char === '{') openBraces++;
    if (char === '}') openBraces--;
    if (char === '[') openBrackets++;
    if (char === ']') openBrackets--;
  }

  // If we're in an unclosed string, close it
  if (inString) {
    repaired += '"';
  }

  // Close arrays and objects
  while (openBrackets > 0) {
    repaired += ']';
    openBrackets--;
  }

  while (openBraces > 0) {
    repaired += '}';
    openBraces--;
  }

  return repaired;
}

/**
 * Parse JSON with repair attempt for truncated responses
 */
function safeParseJson(jsonStr: string): any {
  // First try direct parse
  try {
    return JSON.parse(jsonStr);
  } catch (e) {
    console.log('[JSON] Direct parse failed, attempting repair...');
  }

  // Try to repair truncated JSON
  try {
    const repaired = repairTruncatedJson(jsonStr);
    console.log('[JSON] Attempting to parse repaired JSON...');
    return JSON.parse(repaired);
  } catch (e) {
    console.log('[JSON] Repair failed, trying to extract partial data...');
  }

  // Last resort: try to extract machineInfo at minimum
  try {
    // Find machineInfo object
    const machineInfoMatch = jsonStr.match(/"machineInfo"\s*:\s*(\{[^}]*\})/);
    if (machineInfoMatch) {
      return {
        machineInfo: JSON.parse(machineInfoMatch[1]),
        components: [],
        warnings: ['JSON truncado - solo se extrajo información parcial'],
      };
    }
  } catch (e) {
    // Give up
  }

  // Return empty result
  console.error('[JSON] All parsing attempts failed');
  return {
    machineInfo: {},
    components: [],
    warnings: ['Error parseando respuesta JSON del modelo'],
  };
}

// =============================================================================
// PER-FILE EXTRACTION (SIMPLIFIED - uses same prompt as external AI mode)
// =============================================================================

/**
 * Extract machine data from a single file
 * Uses GPT-4o-mini for text, GPT-4o for vision
 * Uses simple text format prompt (same as external AI mode) for consistent results
 */
export async function extractFromSingleFile(
  input: FileExtractionInput,
  language: OutputLanguage = 'es'
): Promise<ExtractedMachineData> {
  const startTime = Date.now();
  const openai = await getOpenAIClient();

  const fileContext = buildFileContext(
    0,
    input.fileName,
    input.fileTypes,
    input.pageCount
  );

  const model = 'gpt-4o';

  try {
    let responseText: string;

    if (input.pdfBase64) {
      // PRIMARY PATH: Send raw PDF to GPT-4o via Responses API
      // This is EXACTLY how ChatGPT receives files — the most reliable extraction method
      console.log(`[Extractor] Using GPT-4o RESPONSES API with PDF file for ${input.fileName} (${Math.round(input.pdfBase64.length / 1024)} KB)`);

      // Build the prompt (same as external AI mode, without document text since GPT reads the PDF directly)
      const prompt = buildSimpleExtractionPrompt(null, fileContext, language);

      const response = await openai.responses.create({
        model,
        instructions: EXTRACTION_SYSTEM_MESSAGE[language],
        input: [
          {
            role: 'user',
            content: [
              {
                type: 'input_file',
                filename: input.fileName,
                file_data: `data:application/pdf;base64,${input.pdfBase64}`,
              },
              {
                type: 'input_text',
                text: prompt,
              },
            ],
          },
        ],
        max_output_tokens: 16000,
      });

      responseText = response.output_text || '';
      console.log(`[Extractor] GPT-4o Responses API result (${responseText.length} chars)`);
      console.log(`[Extractor] Response preview:\n${responseText.substring(0, 800)}`);

    } else if (input.needsVision && input.images && input.images.length > 0) {
      // FALLBACK: Vision extraction for non-PDF image files
      console.log(`[Extractor] Using GPT-4o VISION for ${input.fileName} (${input.images.length} images)`);

      const prompt = buildSimpleExtractionPrompt(null, fileContext, language);

      const content: any[] = [{ type: 'text', text: prompt }];
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
        model,
        messages: [
          { role: 'system', content: EXTRACTION_SYSTEM_MESSAGE[language] },
          { role: 'user', content },
        ],
        max_tokens: 16000,
      });

      responseText = response.choices[0]?.message?.content || '';
      console.log(`[Extractor] GPT-4o vision response (${responseText.length} chars)`);

    } else {
      // LAST RESORT: Text-only extraction (non-PDF, non-image files)
      console.log(`[Extractor] Using GPT-4o TEXT-ONLY for ${input.fileName} (${(input.text || '').length} chars)`);

      const prompt = buildSimpleExtractionPrompt(input.text || '', fileContext, language);

      const response = await openai.chat.completions.create({
        model,
        messages: [
          { role: 'system', content: EXTRACTION_SYSTEM_MESSAGE[language] },
          { role: 'user', content: prompt },
        ],
        max_tokens: 16000,
      });

      responseText = response.choices[0]?.message?.content || '';
      console.log(`[Extractor] GPT-4o text response (${responseText.length} chars)`);
      console.log(`[Extractor] Response preview:\n${responseText.substring(0, 800)}`);
    }

    // Parse response using the simple parser (same as external AI mode)
    const result = parseAIResponse(responseText, input.fileId, input.fileName);

    console.log(`[Extractor] === EXTRACTION RESULT for ${input.fileName} ===`);
    console.log(`[Extractor] Machine name: ${result.machine.name || 'NOT FOUND'}`);
    console.log(`[Extractor] Components: ${result.components.length}`);

    return {
      ...result,
      fileId: input.fileId,
      processingTimeMs: Date.now() - startTime,
    };

  } catch (error) {
    console.error(`[Extractor] Error extracting from file ${input.fileName}:`, error);

    return {
      fileId: input.fileId,
      machine: {
        name: null,
        brand: null,
        model: null,
        serialNumber: null,
        manufacturingYear: null,
        type: 'OTHER',
        power: null,
        voltage: null,
        weight: null,
        dimensions: null,
        description: null,
        technicalNotes: null,
        confidence: 0,
        evidences: [],
      },
      allMachineScopesDetected: [],
      machineMatchStatus: 'NOT_FOUND',
      assemblies: [],
      components: [],
      conflicts: [],
      duplicatesDetected: [],
      warnings: [`Error de extracción: ${error instanceof Error ? error.message : 'Error desconocido'}`],
      overallConfidence: 0,
      processingTimeMs: Date.now() - startTime,
    };
  }
}

// =============================================================================
// MERGE EXTRACTIONS (SIMPLIFIED)
// =============================================================================

/**
 * Merge multiple file extractions into a unified machine tree
 * Now works with ExtractedMachineData directly (simplified flow)
 */
export function mergeExtractions(
  extractions: ExtractedMachineData[]
): ExtractedMachineData {
  const startTime = Date.now();

  // If only one file, return directly
  if (extractions.length === 1) {
    return extractions[0];
  }

  // If no valid extractions, return empty
  if (extractions.length === 0) {
    return createEmptyResult(startTime);
  }

  // Simple merge: combine all extractions
  const machine = extractions.find(e => e.machine.name)?.machine || extractions[0].machine;

  // Combine all components with unique tempIds
  const allComponents: ExtractedComponent[] = [];
  extractions.forEach((ext, fileIdx) => {
    ext.components.forEach((comp, compIdx) => {
      allComponents.push({
        ...comp,
        tempId: `file${fileIdx}_${comp.tempId || `comp${compIdx}`}`,
        parentTempId: comp.parentTempId ? `file${fileIdx}_${comp.parentTempId}` : null,
      });
    });
  });

  // Combine warnings
  const allWarnings = extractions.flatMap(e => e.warnings);

  // Calculate overall confidence
  const overallConfidence = extractions.reduce((sum, e) => sum + e.overallConfidence, 0) / extractions.length;

  return {
    machine,
    allMachineScopesDetected: extractions.flatMap(e => e.allMachineScopesDetected),
    machineMatchStatus: 'UNIQUE',
    assemblies: extractions.flatMap(e => e.assemblies),
    components: allComponents,
    conflicts: [],
    duplicatesDetected: [],
    warnings: allWarnings,
    overallConfidence,
    processingTimeMs: Date.now() - startTime,
  };
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

function createEmptyResult(startTime: number): ExtractedMachineData {
  return {
    machine: {
      name: null,
      brand: null,
      model: null,
      serialNumber: null,
      manufacturingYear: null,
      type: 'OTHER',
      power: null,
      voltage: null,
      weight: null,
      dimensions: null,
      description: null,
      technicalNotes: null,
      confidence: 0,
      evidences: [],
    },
    allMachineScopesDetected: [],
    machineMatchStatus: 'NOT_FOUND',
    assemblies: [],
    components: [],
    conflicts: [],
    duplicatesDetected: [],
    warnings: ['No se encontró información en los documentos proporcionados'],
    overallConfidence: 0,
    processingTimeMs: Date.now() - startTime,
  };
}

// =============================================================================
// BATCH EXTRACTION
// =============================================================================

/**
 * Extract from multiple files with concurrency control
 */
export async function extractFromMultipleFiles(
  files: FileExtractionInput[],
  concurrency: number = 3,
  onProgress?: (processed: number, total: number, currentFile: string) => void,
  language: OutputLanguage = 'es'
): Promise<ExtractedMachineData[]> {
  const results: ExtractedMachineData[] = [];

  // Process in batches
  for (let i = 0; i < files.length; i += concurrency) {
    const batch = files.slice(i, i + concurrency);

    const batchResults = await Promise.all(
      batch.map(file => extractFromSingleFile(file, language))
    );

    results.push(...batchResults);

    if (onProgress) {
      onProgress(results.length, files.length, batch[batch.length - 1]?.fileName || '');
    }
  }

  return results;
}

/**
 * Full extraction pipeline: extract per file then merge
 */
export async function extractMachineFromDocuments(
  files: FileExtractionInput[],
  onProgress?: (stage: string, percent: number, detail: string) => void,
  language: OutputLanguage = 'es'
): Promise<ExtractedMachineData> {
  const startTime = Date.now();

  if (files.length === 0) {
    return createEmptyResult(startTime);
  }

  // Stage 1: Per-file extraction
  onProgress?.('extracting', 0, `Procesando ${files.length} archivos...`);

  const perFileResults = await extractFromMultipleFiles(
    files,
    3,
    (processed, total, currentFile) => {
      const percent = Math.round((processed / total) * 70); // 0-70%
      onProgress?.('extracting', percent, `Archivo ${processed}/${total}: ${currentFile}`);
    },
    language
  );

  // Stage 2: Merge
  onProgress?.('merging', 75, 'Consolidando resultados...');

  const merged = mergeExtractions(perFileResults);

  onProgress?.('complete', 100, 'Extracción completada');

  return {
    ...merged,
    processingTimeMs: Date.now() - startTime,
  };
}
