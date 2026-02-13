/**
 * Types and constants for machine import
 * This file is safe to import from both client and server
 */

// Types for file processing
export type ImportFileType =
  | 'BLUEPRINT'
  | 'MANUAL'
  | 'DATASHEET'
  | 'BOM'
  | 'CERTIFICATE'
  | 'PHOTO'
  | 'OTHER';

export interface ProcessedFile {
  fileName: string;
  mimeType: string;
  fileSize: number;
  sha256: string;
  fileTypes: ImportFileType[];
  needsVision: boolean;
  pageCount?: number;
  extractedText?: string;
}

export interface PageContent {
  pageIndex: number; // 1-based
  text: string;
  hasSignificantText: boolean; // true if > 100 chars
  needsVision: boolean;
}

// File validation constants
export const ALLOWED_EXTENSIONS = ['.pdf', '.png', '.jpg', '.jpeg', '.doc', '.docx', '.xls', '.xlsx'];
export const ALLOWED_MIMES = [
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/jpg',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
];

export const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB per file
export const MAX_TOTAL_SIZE = 50 * 1024 * 1024; // 50MB total
export const MAX_FILES = 20;
export const MAX_PAGES = 100;

// File type patterns for classification
export const FILE_TYPE_PATTERNS: Record<ImportFileType, RegExp[]> = {
  BLUEPRINT: [
    /plano/i,
    /blueprint/i,
    /drawing/i,
    /diagram/i,
    /exploded/i,
    /layout/i,
    /esquema/i,
    /dwg/i,
    /assembly/i,
    /despiece/i,
  ],
  MANUAL: [
    /manual/i,
    /instruction/i,
    /guide/i,
    /guia/i,
    /operation/i,
    /maintenance/i,
    /service/i,
    /user/i,
  ],
  DATASHEET: [
    /datasheet/i,
    /data\s*sheet/i,
    /ficha\s*tecnica/i,
    /technical\s*data/i,
    /spec/i,
    /specification/i,
  ],
  BOM: [
    /bom/i,
    /bill\s*of\s*material/i,
    /parts\s*list/i,
    /lista\s*de\s*partes/i,
    /componentes/i,
    /spare\s*parts/i,
    /repuestos/i,
  ],
  CERTIFICATE: [
    /certificate/i,
    /certificado/i,
    /cert/i,
    /warranty/i,
    /garantia/i,
    /compliance/i,
  ],
  PHOTO: [
    /photo/i,
    /foto/i,
    /image/i,
    /picture/i,
    /img/i,
  ],
  OTHER: [],
};

/**
 * Classify file type based on filename and content patterns
 */
export function classifyFile(fileName: string, mimeType: string): ImportFileType[] {
  const types: ImportFileType[] = [];
  const lowerName = fileName.toLowerCase();

  // Check each pattern
  for (const [type, patterns] of Object.entries(FILE_TYPE_PATTERNS)) {
    if (type === 'OTHER') continue;

    for (const pattern of patterns) {
      if (pattern.test(lowerName)) {
        types.push(type as ImportFileType);
        break;
      }
    }
  }

  // Check mime type for photos
  if (mimeType.startsWith('image/') && !types.includes('PHOTO')) {
    types.push('PHOTO');
  }

  // Default to OTHER if no classification
  if (types.length === 0) {
    types.push('OTHER');
  }

  return types;
}

/**
 * Validate file type by extension and MIME
 */
export function isValidFileType(fileName: string, mimeType: string): boolean {
  const ext = '.' + fileName.split('.').pop()?.toLowerCase();

  if (!ALLOWED_EXTENSIONS.includes(ext)) {
    return false;
  }

  // Some browsers may not provide accurate MIME types
  // So we're lenient if extension is valid
  if (mimeType && !ALLOWED_MIMES.includes(mimeType)) {
    // Check if it's a generic type
    if (!mimeType.startsWith('application/') && !mimeType.startsWith('image/')) {
      return false;
    }
  }

  return true;
}

/**
 * Validate file size
 */
export function isValidFileSize(size: number): boolean {
  return size > 0 && size <= MAX_FILE_SIZE;
}

/**
 * Get file extension from name
 */
export function getFileExtension(fileName: string): string {
  return fileName.split('.').pop()?.toLowerCase() || '';
}

/**
 * Check if file is a PDF
 */
export function isPDF(fileName: string, mimeType: string): boolean {
  return mimeType === 'application/pdf' ||
    fileName.toLowerCase().endsWith('.pdf');
}

/**
 * Check if file is an image
 */
export function isImage(fileName: string, mimeType: string): boolean {
  return mimeType.startsWith('image/') ||
    /\.(png|jpg|jpeg|gif|webp)$/i.test(fileName);
}

/**
 * Generate a unique filename with timestamp
 */
export function generateUniqueFileName(originalName: string): string {
  const ext = getFileExtension(originalName);
  const baseName = originalName.replace(/\.[^/.]+$/, '');
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  return `${baseName}-${timestamp}-${random}.${ext}`;
}

/**
 * Sanitize filename for S3 storage
 */
export function sanitizeFileName(fileName: string): string {
  return fileName
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .replace(/__+/g, '_')
    .substring(0, 200);
}
