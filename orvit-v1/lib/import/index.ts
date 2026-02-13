/**
 * Machine Import Module - AI-powered import of machines from technical documentation
 *
 * IMPORTANT: This module is SERVER-ONLY due to dependencies on pdf-parse and other
 * server-side libraries. For client-safe types and constants, import from:
 * import { ... } from '@/lib/import/types'
 *
 * Usage:
 * 1. Upload ZIP/files via POST /api/maquinas/import
 * 2. Start processing via POST /api/maquinas/import/[id]/process
 * 3. Poll status via GET /api/maquinas/import/[id]
 * 4. Review and edit draft
 * 5. Confirm via POST /api/maquinas/import/[id]/confirm
 */

import 'server-only';

// Client-safe types and constants (also available from './types' directly)
export {
  classifyFile,
  isValidFileType,
  isValidFileSize,
  isPDF,
  isImage,
  sanitizeFileName,
  generateUniqueFileName,
  getFileExtension,
  ALLOWED_EXTENSIONS,
  ALLOWED_MIMES,
  MAX_FILE_SIZE,
  MAX_TOTAL_SIZE,
  MAX_FILES,
  MAX_PAGES,
  FILE_TYPE_PATTERNS,
  type ImportFileType,
  type ProcessedFile,
  type PageContent,
} from './types';

// PDF Processing (server-only - uses pdf-parse)
export {
  calculateSHA256,
  extractTextFromPDF,
  shouldUseVision,
} from './pdf-processor';

// ZIP Utilities (server-only - uses jszip)
export {
  extractZip,
  sanitizePath,
  isValidZip,
  getZipInfo,
  type ExtractedFile,
  type ExtractionResult,
} from './zip-utils';

// AI Extraction (server-only - uses openai)
export {
  extractFromSingleFile,
  mergeExtractions,
  extractFromMultipleFiles,
  extractMachineFromDocuments,
  type Evidence,
  type ExtractedMachineInfo,
  type ExtractedComponent,
  type ExtractedMachineData,
  type FileExtractionInput,
  type MachineScope,
} from './machine-extractor';

// Simple Parser (text format parsing, same as external AI mode)
export {
  parseAIResponse,
  parseTreeFormat,
  tryParseJson,
  transformToExtractedData,
} from './simple-parser';

// Prompts (can be used for reference, but mainly server-side)
export {
  // Simple prompts (preferred - same as external AI mode)
  SIMPLE_EXTRACTION_PROMPTS,
  buildSimpleExtractionPrompt,
  type OutputLanguage,
  // Legacy JSON prompts (kept for reference)
  PER_FILE_EXTRACTION_PROMPT,
  MERGE_EXTRACTION_PROMPT,
  VISION_EXTRACTION_PROMPT,
  // Constants
  COMPONENT_TYPES,
  SYSTEM_TYPES,
  MACHINE_TYPES,
  LANGUAGE_NAMES,
  // Builders
  buildFileContext,
  buildTextExtractionPrompt,
  buildVisionExtractionPrompt,
  buildMergePrompt,
  buildTranslationInstructions,
  type TranslationSettings,
} from './extraction-prompt';

// Worker (server-only - background processing)
export {
  processImportJob,
  getNextQueuedJob,
  processQueuedJobs,
  retryFailedJobs,
  cleanupAbandonedImports,
} from './worker';
