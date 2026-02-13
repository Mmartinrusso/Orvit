import 'server-only';
// @ts-ignore - JSZip has default export
import JSZip from 'jszip';
import path from 'path';
import {
  isValidFileType,
  isValidFileSize,
  ALLOWED_EXTENSIONS,
  MAX_FILE_SIZE,
  MAX_FILES,
  MAX_TOTAL_SIZE,
} from './types';

export interface ExtractedFile {
  fileName: string;
  relativePath: string;
  buffer: Buffer;
  mimeType: string;
  size: number;
}

export interface ExtractionResult {
  success: boolean;
  files: ExtractedFile[];
  errors: string[];
  totalSize: number;
}

// =============================================================================
// ZIP SLIP PROTECTION
// =============================================================================

/**
 * Sanitize and validate path to prevent ZIP Slip attacks
 * Throws error if path is malicious
 */
export function sanitizePath(relativePath: string): string {
  // Normalize the path
  const normalized = path.normalize(relativePath);

  // Check for path traversal attempts
  if (normalized.startsWith('..') || path.isAbsolute(normalized)) {
    throw new Error(`Path inválido detectado: ${relativePath}`);
  }

  // Check for null bytes
  if (relativePath.includes('\0')) {
    throw new Error(`Path con null bytes detectado: ${relativePath}`);
  }

  // Remove leading slashes
  const cleaned = normalized.replace(/^[/\\]+/, '');

  // Final check - the cleaned path shouldn't escape
  if (cleaned.includes('..')) {
    throw new Error(`Path escape detectado: ${relativePath}`);
  }

  return cleaned;
}

/**
 * Get MIME type from file extension
 */
function getMimeType(fileName: string): string {
  const ext = fileName.split('.').pop()?.toLowerCase() || '';

  const mimeTypes: Record<string, string> = {
    pdf: 'application/pdf',
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    gif: 'image/gif',
    webp: 'image/webp',
    doc: 'application/msword',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    xls: 'application/vnd.ms-excel',
    xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    txt: 'text/plain',
  };

  return mimeTypes[ext] || 'application/octet-stream';
}

/**
 * Check if file should be skipped (system files, hidden files)
 */
function shouldSkipFile(relativePath: string): boolean {
  const fileName = path.basename(relativePath);

  // Skip hidden files
  if (fileName.startsWith('.')) {
    return true;
  }

  // Skip macOS resource forks
  if (fileName.startsWith('__MACOSX') || relativePath.includes('__MACOSX')) {
    return true;
  }

  // Skip Windows system files
  if (fileName === 'Thumbs.db' || fileName === 'desktop.ini') {
    return true;
  }

  // Skip empty file names
  if (!fileName || fileName.trim() === '') {
    return true;
  }

  return false;
}

// =============================================================================
// ZIP EXTRACTION
// =============================================================================

/**
 * Extract files from a ZIP buffer with security checks
 */
export async function extractZip(zipBuffer: Buffer): Promise<ExtractionResult> {
  const errors: string[] = [];
  const files: ExtractedFile[] = [];
  let totalSize = 0;

  try {
    const zip = await JSZip.loadAsync(zipBuffer);

    // Get all file entries (not directories)
    const fileEntries = Object.entries(zip.files).filter(
      ([_, file]) => !file.dir
    );

    // Check file count limit
    if (fileEntries.length > MAX_FILES) {
      return {
        success: false,
        files: [],
        errors: [`El ZIP contiene demasiados archivos (${fileEntries.length}). Máximo permitido: ${MAX_FILES}`],
        totalSize: 0,
      };
    }

    for (const [relativePath, zipEntry] of fileEntries) {
      try {
        // Skip system/hidden files
        if (shouldSkipFile(relativePath)) {
          continue;
        }

        // Sanitize path (ZIP Slip protection)
        const safePath = sanitizePath(relativePath);
        const fileName = path.basename(safePath);

        // Get file extension
        const ext = '.' + fileName.split('.').pop()?.toLowerCase();

        // Skip files with invalid extensions
        if (!ALLOWED_EXTENSIONS.includes(ext)) {
          errors.push(`Archivo ignorado (extensión no permitida): ${fileName}`);
          continue;
        }

        // Extract file content
        const buffer = await zipEntry.async('nodebuffer');

        // Check individual file size
        if (buffer.length > MAX_FILE_SIZE) {
          errors.push(`Archivo muy grande: ${fileName} (${(buffer.length / 1024 / 1024).toFixed(2)}MB > ${MAX_FILE_SIZE / 1024 / 1024}MB)`);
          continue;
        }

        // Check total size
        if (totalSize + buffer.length > MAX_TOTAL_SIZE) {
          errors.push(`Límite de tamaño total excedido. Archivos restantes ignorados.`);
          break;
        }

        const mimeType = getMimeType(fileName);

        // Validate file type
        if (!isValidFileType(fileName, mimeType)) {
          errors.push(`Tipo de archivo no permitido: ${fileName}`);
          continue;
        }

        files.push({
          fileName,
          relativePath: safePath,
          buffer,
          mimeType,
          size: buffer.length,
        });

        totalSize += buffer.length;

      } catch (fileError) {
        const errorMessage = fileError instanceof Error ? fileError.message : 'Error desconocido';
        errors.push(`Error procesando ${relativePath}: ${errorMessage}`);
      }
    }

    return {
      success: files.length > 0,
      files,
      errors,
      totalSize,
    };

  } catch (zipError) {
    const errorMessage = zipError instanceof Error ? zipError.message : 'Error desconocido';
    return {
      success: false,
      files: [],
      errors: [`Error al leer el archivo ZIP: ${errorMessage}`],
      totalSize: 0,
    };
  }
}

/**
 * Validate that a buffer is a valid ZIP file
 */
export function isValidZip(buffer: Buffer): boolean {
  // ZIP magic bytes: PK (0x50 0x4B)
  if (buffer.length < 4) return false;
  return buffer[0] === 0x50 && buffer[1] === 0x4B;
}

/**
 * Get file info from ZIP without extracting
 */
export async function getZipInfo(zipBuffer: Buffer): Promise<{
  fileCount: number;
  totalUncompressedSize: number;
  files: Array<{ name: string; size: number }>;
}> {
  const zip = await JSZip.loadAsync(zipBuffer);

  const files: Array<{ name: string; size: number }> = [];
  let totalSize = 0;
  let fileCount = 0;

  for (const [relativePath, zipEntry] of Object.entries(zip.files)) {
    if (zipEntry.dir) continue;
    if (shouldSkipFile(relativePath)) continue;

    const fileName = path.basename(relativePath);
    const ext = '.' + fileName.split('.').pop()?.toLowerCase();

    if (!ALLOWED_EXTENSIONS.includes(ext)) continue;

    // @ts-ignore - _data.uncompressedSize exists but not in types
    const size = zipEntry._data?.uncompressedSize || 0;

    files.push({ name: fileName, size });
    totalSize += size;
    fileCount++;
  }

  return {
    fileCount,
    totalUncompressedSize: totalSize,
    files,
  };
}
