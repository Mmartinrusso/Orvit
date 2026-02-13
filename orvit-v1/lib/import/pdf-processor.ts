import 'server-only';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

// Re-export types and constants from types.ts
export {
  type ImportFileType,
  type ProcessedFile,
  type PageContent,
  ALLOWED_EXTENSIONS,
  ALLOWED_MIMES,
  MAX_FILE_SIZE,
  MAX_TOTAL_SIZE,
  MAX_FILES,
  MAX_PAGES,
  FILE_TYPE_PATTERNS,
  classifyFile,
  isValidFileType,
  isValidFileSize,
  getFileExtension,
  isPDF,
  isImage,
  generateUniqueFileName,
  sanitizeFileName,
} from './types';

import { type ImportFileType, type PageContent } from './types';

// =============================================================================
// SHA256 HASH
// =============================================================================

/**
 * Calculate SHA256 hash of buffer for deduplication
 */
export function calculateSHA256(buffer: Buffer): string {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

// =============================================================================
// PDF PROCESSING
// =============================================================================

/**
 * Extract text from PDF using pdf-parse
 * Returns text content and page count
 */
export async function extractTextFromPDF(buffer: Buffer): Promise<{
  text: string;
  pageCount: number;
  pages: PageContent[];
}> {
  try {
    // Check buffer is valid
    if (!buffer || buffer.length === 0) {
      console.error('[PDF] Empty buffer received');
      return { text: '', pageCount: 0, pages: [] };
    }

    console.log('[PDF] Processing buffer of size:', buffer.length);

    // Use eval('require') to completely bypass webpack's static analysis
    // eslint-disable-next-line no-eval
    const pdfParseModule = eval('require')('pdf-parse');

    // pdf-parse v2.x API: pass data in options, then call load() and getText()
    const PDFParseClass = pdfParseModule.PDFParse;
    const VerbosityLevel = pdfParseModule.VerbosityLevel || { ERRORS: 0 };

    // Create parser with buffer in options
    const parser = new PDFParseClass({
      verbosity: VerbosityLevel.ERRORS,
      data: buffer,
    });

    // Load the document
    const doc = await parser.load();
    const numPages = doc.numPages || 1;

    // Get text from all pages
    const textResult = await parser.getText();
    const fullText = textResult?.text || '';
    const pageCount = numPages;

    // For now, we'll estimate pages by splitting text
    // In production, you might want to use a more sophisticated approach
    const pages: PageContent[] = [];
    const avgCharsPerPage = Math.ceil(fullText.length / pageCount);

    for (let i = 0; i < pageCount; i++) {
      const start = i * avgCharsPerPage;
      const end = Math.min((i + 1) * avgCharsPerPage, fullText.length);
      const pageText = fullText.slice(start, end).trim();

      pages.push({
        pageIndex: i + 1,
        text: pageText,
        hasSignificantText: pageText.length > 100,
        needsVision: pageText.length < 100, // Likely scanned if little text
      });
    }

    return {
      text: fullText,
      pageCount,
      pages,
    };
  } catch (error) {
    console.error('Error extracting PDF text:', error);
    return {
      text: '',
      pageCount: 0,
      pages: [],
    };
  }
}

/**
 * Determine if a PDF page needs Vision processing
 * Returns true if:
 * - Page has little text (likely scanned)
 * - File name suggests it's a blueprint/diagram/manual
 * - Text looks like low-quality OCR or metadata only
 * - Text doesn't contain PARTS LIST data (tables are usually images)
 */
export function shouldUseVision(
  fileName: string,
  pageText: string,
  fileTypes: ImportFileType[]
): boolean {
  const fileNameLower = fileName.toLowerCase();

  // ALWAYS use vision for technical manuals - PARTS LIST are almost always images
  const isTechnicalManual = /manual|tecnico|technical|catalogo|catalog|spare\s*parts/i.test(fileNameLower);
  if (isTechnicalManual) {
    console.log(`[PDF] Technical manual detected (${fileName}) - FORCING vision mode`);
    return true;
  }

  // Little text = likely scanned or diagram
  if (pageText.length < 100) {
    console.log(`[PDF] Very little text (${pageText.length} chars) - using vision`);
    return true;
  }

  // Check if text looks like low-quality extraction (lots of gibberish or mostly numbers)
  const alphaNumRatio = (pageText.match(/[a-zA-Z]/g) || []).length / pageText.length;
  if (alphaNumRatio < 0.3) {
    console.log(`[PDF] Low alpha ratio (${alphaNumRatio.toFixed(2)}) - using vision`);
    return true;
  }

  // Check if text contains structured PARTS LIST data (table format with items)
  // Look for patterns like: "1 | 2 | filename.ipt" or "ITEM QTY FILENAME"
  const hasStructuredPartsData = /\d+\s*[\|,]\s*\d+\s*[\|,]\s*\S+\.(ipt|iam|stp|step)/i.test(pageText) ||
    /item\s+qty\s+file/i.test(pageText);

  // Check for generic parts keywords (less reliable)
  const hasPartsListKeywords = /parts\s*list|bom|bill\s*of\s*material|lista\s*de\s*partes/i.test(pageText);
  const hasComponentKeywords = /motor|pump|valve|sensor|bearing|gear|assembly|ensamble|bomba|valvula/i.test(pageText);

  // Blueprint/diagram files
  const isBlueprint = fileTypes.includes('BLUEPRINT') ||
    /exploded|parts|diagram|drawing|plano|despiece/i.test(fileNameLower);

  // If it's a technical document, almost always use vision
  if (isBlueprint) {
    console.log(`[PDF] Blueprint/drawing detected - using vision`);
    return true;
  }

  // If we have structured parts data in text, we might not need vision
  if (hasStructuredPartsData) {
    console.log(`[PDF] Structured parts data found in text - using text mode`);
    return false;
  }

  // If text exists but no parts data structure, use vision
  if (!hasStructuredPartsData && pageText.length > 0) {
    console.log(`[PDF] No structured parts data in ${pageText.length} chars - using vision`);
    return true;
  }

  // For any document without proper parts keywords, use vision
  if (!hasPartsListKeywords && !hasComponentKeywords) {
    console.log(`[PDF] No parts keywords found - using vision`);
    return true;
  }

  return false;
}

// =============================================================================
// PDF TO IMAGE CONVERSION
// =============================================================================

/**
 * Convert PDF pages to base64 images for Vision processing
 * Uses pdf-to-img library which handles images properly
 * @param buffer - PDF file buffer
 * @param maxPages - Maximum number of pages to convert (default 20)
 * @returns Array of base64 encoded PNG images
 */
export async function convertPdfToImages(
  buffer: Buffer,
  maxPages: number = 20
): Promise<string[]> {
  // pdf-to-img works with embedded images, use it directly
  try {
    console.log('[PDF] Converting PDF to images using pdf-to-img...');
    return await convertWithPdfToImg(buffer, maxPages);
  } catch (error) {
    console.error('[PDF] PDF to image conversion failed:', error instanceof Error ? error.message : String(error));
    return [];
  }
}

/**
 * Primary method: Use pdf-to-img library (v5.x API)
 * Spawns a child process to avoid webpack bundling issues
 */
async function convertWithPdfToImg(buffer: Buffer, maxPages: number): Promise<string[]> {
  const { spawn } = await import('child_process');

  // Write buffer to temp file
  const tempDir = os.tmpdir();
  const tempPdf = path.join(tempDir, `pdf-${Date.now()}-${Math.random().toString(36).slice(2)}.pdf`);
  const tempOutput = path.join(tempDir, `pdf-output-${Date.now()}.json`);

  try {
    fs.writeFileSync(tempPdf, buffer);
    console.log(`[PDF] Written temp PDF: ${tempPdf} (${buffer.length} bytes)`);

    // Create inline script to run pdf-to-img in a clean Node.js process
    const script = `
      const { pdf } = require('pdf-to-img');
      const fs = require('fs');

      async function convert() {
        const images = [];
        let pageNum = 0;
        const maxPages = ${maxPages};

        for await (const image of await pdf('${tempPdf.replace(/\\/g, '\\\\')}', { scale: 1.5 })) {
          pageNum++;
          if (pageNum > maxPages) break;
          images.push(image.toString('base64'));
          console.error('[PDF-Child] Page ' + pageNum + ' converted');
        }

        fs.writeFileSync('${tempOutput.replace(/\\/g, '\\\\')}', JSON.stringify(images));
        console.error('[PDF-Child] Complete: ' + images.length + ' pages');
      }

      convert().catch(err => {
        console.error('[PDF-Child] Error:', err.message);
        fs.writeFileSync('${tempOutput.replace(/\\/g, '\\\\')}', JSON.stringify({ error: err.message }));
        process.exit(1);
      });
    `;

    console.log(`[PDF] Spawning child process for pdf-to-img...`);

    // Run the script in a child process
    await new Promise<void>((resolve, reject) => {
      const child = spawn('node', ['-e', script], {
        cwd: process.cwd(),
        stdio: ['ignore', 'inherit', 'inherit'],
        env: { ...process.env, NODE_PATH: path.join(process.cwd(), 'node_modules') },
      });

      child.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`Child process exited with code ${code}`));
        }
      });

      child.on('error', reject);
    });

    // Read the output
    if (fs.existsSync(tempOutput)) {
      const result = JSON.parse(fs.readFileSync(tempOutput, 'utf-8'));
      if (result.error) {
        throw new Error(result.error);
      }
      console.log(`[PDF] pdf-to-img: ${result.length} pages converted`);
      return result;
    }

    return [];
  } finally {
    // Clean up temp files
    setTimeout(() => {
      try {
        if (fs.existsSync(tempPdf)) fs.unlinkSync(tempPdf);
        if (fs.existsSync(tempOutput)) fs.unlinkSync(tempOutput);
        console.log(`[PDF] Cleaned up temp files`);
      } catch (e) {
        // Ignore cleanup errors
      }
    }, 1000);
  }
}

/**
 * Convert PDF to images using pdfjs-dist with node-canvas
 * Requires special handling for pdfjs-dist 5.x compatibility
 */
async function convertWithPdfjsCanvas(buffer: Buffer, maxPages: number): Promise<string[]> {
  console.log('[PDF] Starting pdfjs-dist + canvas conversion...');

  // Dynamic imports
  const canvasModule = await import('canvas');
  const { createCanvas, Image, ImageData } = canvasModule;

  // CRITICAL: Set global polyfills BEFORE importing pdfjs-dist
  // pdfjs-dist checks for these at import time
  (globalThis as any).Image = Image;
  (globalThis as any).ImageData = ImageData;

  // Create a custom canvas class that wraps node-canvas
  // This helps pdfjs-dist recognize it as a valid canvas
  class NodeCanvas {
    _canvas: any;
    _ctx: any;

    constructor(width: number, height: number) {
      this._canvas = createCanvas(width, height);
      this._ctx = this._canvas.getContext('2d');

      // Patch drawImage to handle pdfjs internal image formats
      const originalDrawImage = this._ctx.drawImage.bind(this._ctx);
      this._ctx.drawImage = (img: any, ...args: any[]) => {
        try {
          // Handle various image formats pdfjs-dist might pass
          if (!img) return;

          // If it's already a canvas, use it
          if (img._canvas || img.getContext) {
            return originalDrawImage(img._canvas || img, ...args);
          }

          // If it has raw image data, convert to ImageData and draw
          if (img.data && img.width && img.height) {
            const imgData = this._ctx.createImageData(img.width, img.height);
            imgData.data.set(new Uint8ClampedArray(img.data));
            // Create temp canvas to draw ImageData
            const tempCanvas = createCanvas(img.width, img.height);
            const tempCtx = tempCanvas.getContext('2d');
            tempCtx.putImageData(imgData, 0, 0);
            return originalDrawImage(tempCanvas, ...args);
          }

          // Default: try to draw it directly
          return originalDrawImage(img, ...args);
        } catch (err) {
          // Log but don't throw - some images may not be renderable
          console.debug('[PDF] Image draw skipped');
        }
      };
    }

    get width() { return this._canvas.width; }
    set width(v: number) { this._canvas.width = v; }
    get height() { return this._canvas.height; }
    set height(v: number) { this._canvas.height = v; }

    getContext(type: string) {
      return this._ctx;
    }

    toBuffer(format: string) {
      return this._canvas.toBuffer(format);
    }
  }

  // Custom CanvasFactory that pdfjs-dist will use
  class NodeCanvasFactory {
    create(width: number, height: number) {
      const nodeCanvas = new NodeCanvas(width, height);
      return {
        canvas: nodeCanvas,
        context: nodeCanvas.getContext('2d'),
      };
    }

    reset(canvasAndContext: any, width: number, height: number) {
      canvasAndContext.canvas.width = width;
      canvasAndContext.canvas.height = height;
    }

    destroy(canvasAndContext: any) {
      canvasAndContext.canvas.width = 0;
      canvasAndContext.canvas.height = 0;
    }
  }

  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const images: string[] = [];

  // Load PDF with our custom canvas factory
  const loadingTask = pdfjs.getDocument({
    data: new Uint8Array(buffer),
    useSystemFonts: true,
    canvasFactory: new NodeCanvasFactory() as any,
    isOffscreenCanvasSupported: false,
    disableFontFace: true, // Disable font loading issues
  });

  const pdfDoc = await loadingTask.promise;
  const numPages = Math.min(pdfDoc.numPages, maxPages);

  console.log(`[PDF] pdfjs loaded ${pdfDoc.numPages} pages, processing ${numPages}`);

  for (let pageNum = 1; pageNum <= numPages; pageNum++) {
    try {
      const page = await pdfDoc.getPage(pageNum);
      const scale = 1.5;
      const viewport = page.getViewport({ scale });

      // Create canvas for this page
      const nodeCanvas = new NodeCanvas(viewport.width, viewport.height);

      // Render with error handling for individual operations
      try {
        await page.render({
          canvasContext: nodeCanvas.getContext('2d') as any,
          viewport: viewport,
        }).promise;
      } catch (renderError: any) {
        // If render fails partially, we still try to capture what was drawn
        console.warn(`[PDF] Render warning on page ${pageNum}: ${renderError.message || 'unknown'}`);
      }

      // Convert to PNG base64
      const pngBuffer = nodeCanvas.toBuffer('image/png');
      const base64 = pngBuffer.toString('base64');
      images.push(base64);

      console.log(`[PDF] Page ${pageNum}/${numPages} converted (${Math.round(base64.length / 1024)}KB)`);
    } catch (pageError: any) {
      console.error(`[PDF] Failed to process page ${pageNum}:`, pageError.message || pageError);
      // Continue with other pages
    }
  }

  console.log(`[PDF] Conversion complete: ${images.length}/${numPages} pages`);
  return images;
}

/**
 * Check if PDF needs vision and convert to images if so
 * @returns Object with text and optional images array
 */
export async function processPdfForExtraction(
  buffer: Buffer,
  fileName: string
): Promise<{
  text: string;
  pageCount: number;
  needsVision: boolean;
  images: string[];
}> {
  // First try to extract text
  const textResult = await extractTextFromPDF(buffer);

  // Determine if we need vision
  const needsVision = shouldUseVision(fileName, textResult.text, []);

  let images: string[] = [];

  if (needsVision) {
    console.log(`[PDF] File "${fileName}" needs vision processing (text length: ${textResult.text.length})`);
    images = await convertPdfToImages(buffer);
  }

  return {
    text: textResult.text,
    pageCount: textResult.pageCount || images.length || 1,
    needsVision: needsVision && images.length > 0,
    images,
  };
}
