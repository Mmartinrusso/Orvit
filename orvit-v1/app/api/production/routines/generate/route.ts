/**
 * POST /api/production/routines/generate
 *
 * Genera una rutina de producción usando IA (OpenAI GPT-4o).
 * Acepta uno o varios archivos (PDF/imagen) y/o descripción en texto.
 * Cuando hay múltiples archivos o se indica grouped=true, genera plantilla jerárquica con grupos.
 */

import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/auth/shared-helpers';
import { PRODUCCION_PERMISSIONS } from '@/lib/permissions';
import {
  extractRoutineFromFile,
  extractRoutineFromText,
  extractRoutineFromMultipleFiles,
  type RoutineFileInput,
} from '@/lib/import/routine-extractor';

export const dynamic = 'force-dynamic';

const ALLOWED_EXTENSIONS = ['.pdf', '.jpg', '.jpeg', '.png', '.webp', '.doc', '.docx', '.txt'];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

function validateFile(file: File): string | null {
  const ext = '.' + file.name.toLowerCase().split('.').pop();
  if (!ALLOWED_EXTENSIONS.includes(ext)) {
    return `Archivo "${file.name}": formato no soportado. Permitidos: ${ALLOWED_EXTENSIONS.join(', ')}`;
  }
  if (file.size > MAX_FILE_SIZE) {
    return `Archivo "${file.name}": supera 10MB`;
  }
  return null;
}

async function processFileToInput(file: File): Promise<RoutineFileInput> {
  const buffer = Buffer.from(await file.arrayBuffer());
  const ext = '.' + file.name.toLowerCase().split('.').pop();

  // Plain text
  if (ext === '.txt') {
    const text = buffer.toString('utf-8');
    if (text.trim().length > 10) {
      return { text, fileName: file.name };
    }
    throw new Error(`Archivo "${file.name}" está vacío o tiene muy poco contenido`);
  }

  // Word documents
  if (ext === '.docx' || ext === '.doc') {
    try {
      const mammoth = await import('mammoth');
      const result = await mammoth.extractRawText({ buffer });
      const text = result.value;
      if (text && text.trim().length > 10) {
        return { text, fileName: file.name };
      }
      throw new Error(`No se pudo extraer texto de "${file.name}"`);
    } catch (err) {
      if (err instanceof Error && err.message.includes('No se pudo')) throw err;
      throw new Error(`Error procesando "${file.name}": formato Word no soportado o corrupto`);
    }
  }

  // PDF
  if (ext === '.pdf') {
    const { extractTextFromPDF } = await import('@/lib/import/pdf-processor');
    const { text } = await extractTextFromPDF(buffer);

    if (text && text.trim().length > 50) {
      return { text, fileName: file.name };
    }

    // Scanned PDF
    try {
      const { convertPdfToImages } = await import('@/lib/import/pdf-processor');
      const images = await convertPdfToImages(buffer);
      if (images && images.length > 0) {
        return { images, fileName: file.name };
      }
    } catch {
      // Fall through
    }

    throw new Error(`No se pudo extraer contenido del PDF "${file.name}"`);
  }

  // Image
  const base64 = buffer.toString('base64');
  return { images: [base64], fileName: file.name };
}

export async function POST(request: NextRequest) {
  try {
    const { user, error } = await requirePermission(PRODUCCION_PERMISSIONS.RUTINAS.MANAGE);
    if (error) return error;

    const contentType = request.headers.get('content-type') || '';

    // Handle JSON body (text description)
    if (contentType.includes('application/json')) {
      const body = await request.json();
      const { description, type, grouped } = body;

      if (!description || typeof description !== 'string' || description.trim().length < 10) {
        return NextResponse.json(
          { error: 'Descripción muy corta. Escribí al menos 10 caracteres describiendo qué querés controlar.' },
          { status: 400 }
        );
      }

      const result = await extractRoutineFromText(description.trim(), type, true);
      return NextResponse.json(result);
    }

    // Handle FormData (file upload - single or multiple)
    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData();
      const description = formData.get('description') as string | null;
      const grouped = formData.get('grouped') === 'true';
      const templateName = formData.get('templateName') as string | null;

      // Collect all files (supports 'files' as multiple entries or 'file' as single)
      const files: File[] = [];
      const allEntries = formData.getAll('files');
      for (const entry of allEntries) {
        if (entry instanceof File) files.push(entry);
      }
      // Also check single 'file' field for backwards compat
      const singleFile = formData.get('file');
      if (singleFile instanceof File && !files.some(f => f.name === singleFile.name)) {
        files.push(singleFile);
      }

      // No files - use text description
      if (files.length === 0) {
        if (description && description.trim().length >= 10) {
          const result = await extractRoutineFromText(description.trim(), undefined, true);
          return NextResponse.json(result);
        }
        return NextResponse.json(
          { error: 'Se requiere al menos un archivo o una descripción' },
          { status: 400 }
        );
      }

      // Validate all files
      console.log(`[generate] Received ${files.length} files:`, files.map(f => `${f.name} (${(f.size/1024).toFixed(1)}KB)`));
      for (const file of files) {
        const error = validateFile(file);
        if (error) {
          return NextResponse.json({ error }, { status: 400 });
        }
      }

      // Multiple files → use multi-file extractor
      if (files.length > 1) {
        const fileInputs: RoutineFileInput[] = [];
        for (const file of files) {
          try {
            console.log(`[generate] Processing file: ${file.name}`);
            const input = await processFileToInput(file);
            console.log(`[generate] File "${file.name}" → ${input.text ? `text (${input.text.length} chars)` : `${input.images?.length || 0} images`}`);
            fileInputs.push(input);
          } catch (err) {
            console.error(`[generate] Error processing file "${file.name}":`, err);
            return NextResponse.json(
              { error: err instanceof Error ? err.message : `Error procesando ${file.name}` },
              { status: 400 }
            );
          }
        }
        console.log(`[generate] All ${fileInputs.length} files processed, sending to AI...`);

        const result = await extractRoutineFromMultipleFiles(
          fileInputs,
          templateName || undefined
        );
        return NextResponse.json(result);
      }

      // Single file
      const file = files[0];
      try {
        const input = await processFileToInput(file);
        const result = await extractRoutineFromFile(input, true);
        return NextResponse.json(result);
      } catch (err) {
        return NextResponse.json(
          { error: err instanceof Error ? err.message : 'Error procesando archivo' },
          { status: 400 }
        );
      }
    }

    return NextResponse.json(
      { error: 'Content-Type no soportado. Usá application/json o multipart/form-data.' },
      { status: 400 }
    );
  } catch (error) {
    console.error('Error generando rutina con IA:', error);

    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error al generar la rutina' },
      { status: 500 }
    );
  }
}
