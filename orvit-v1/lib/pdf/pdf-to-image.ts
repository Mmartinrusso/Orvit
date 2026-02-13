/**
 * Utilidad para convertir páginas de PDF a imágenes
 * IMPORTANTE: Este código solo debe ejecutarse en el cliente
 * Usa pdf.js cargado desde CDN para evitar problemas de compatibilidad con webpack
 */
'use client';

// Versión de pdf.js a usar - 3.11.174 es estable y tiene builds .js tradicionales
const PDFJS_VERSION = '3.11.174';
const PDFJS_CDN_BASE = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${PDFJS_VERSION}`;

// Interfaz para pdf.js (lo necesario)
interface PDFDocumentProxy {
  numPages: number;
  getPage(pageNumber: number): Promise<PDFPageProxy>;
  destroy(): void;
}

interface PDFPageProxy {
  getViewport(params: { scale: number }): PDFViewport;
  render(params: { canvasContext: CanvasRenderingContext2D; viewport: PDFViewport }): { promise: Promise<void> };
}

interface PDFViewport {
  width: number;
  height: number;
}

interface PDFJSLib {
  getDocument(params: { data: ArrayBuffer }): { promise: Promise<PDFDocumentProxy> };
  GlobalWorkerOptions: { workerSrc: string };
}

// Estado de carga
let pdfjsLib: PDFJSLib | null = null;
let loadingPromise: Promise<PDFJSLib> | null = null;

/**
 * Carga pdf.js desde CDN
 */
function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    // Verificar si ya existe
    const existing = document.querySelector(`script[src="${src}"]`);
    if (existing) {
      resolve();
      return;
    }

    const script = document.createElement('script');
    script.src = src;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`Failed to load script: ${src}`));
    document.head.appendChild(script);
  });
}

/**
 * Obtiene la instancia de pdf.js
 */
async function getPdfjs(): Promise<PDFJSLib> {
  // Verificar que estamos en el cliente
  if (typeof window === 'undefined') {
    throw new Error('pdf.js solo puede usarse en el cliente');
  }

  // Si ya está cargado, retornarlo
  if (pdfjsLib) {
    return pdfjsLib;
  }

  // Si ya está cargando, esperar
  if (loadingPromise) {
    return loadingPromise;
  }

  // Cargar desde CDN
  loadingPromise = (async () => {
    try {
      // Cargar el script principal de pdf.js
      await loadScript(`${PDFJS_CDN_BASE}/pdf.min.js`);

      // Obtener la librería del objeto global
      const pdfjs = (window as any).pdfjsLib as PDFJSLib;

      if (!pdfjs) {
        throw new Error('pdf.js no se cargó correctamente');
      }

      // Configurar el worker
      pdfjs.GlobalWorkerOptions.workerSrc = `${PDFJS_CDN_BASE}/pdf.worker.min.js`;

      pdfjsLib = pdfjs;
      return pdfjs;
    } catch (error) {
      loadingPromise = null;
      console.error('Error cargando pdf.js:', error);
      throw new Error('No se pudo cargar la librería de PDF');
    }
  })();

  return loadingPromise;
}

/**
 * Obtiene el número de páginas de un PDF
 */
export async function getPdfPageCount(file: File): Promise<number> {
  const pdfjs = await getPdfjs();
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise;
  const numPages = pdf.numPages;
  pdf.destroy();
  return numPages;
}

/**
 * Convierte una página específica de un PDF a imagen (Blob)
 * @param file - Archivo PDF
 * @param pageNum - Número de página (1-indexed)
 * @param scale - Factor de escala para la resolución (default: 2 para alta calidad OCR)
 */
export async function pdfToImage(
  file: File,
  pageNum: number,
  scale: number = 2
): Promise<Blob> {
  const pdfjs = await getPdfjs();
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise;

  if (pageNum < 1 || pageNum > pdf.numPages) {
    pdf.destroy();
    throw new Error(`Página ${pageNum} fuera de rango (1-${pdf.numPages})`);
  }

  const page = await pdf.getPage(pageNum);
  const viewport = page.getViewport({ scale });

  // Crear canvas para renderizar
  const canvas = document.createElement('canvas');
  canvas.width = viewport.width;
  canvas.height = viewport.height;

  const context = canvas.getContext('2d');
  if (!context) {
    pdf.destroy();
    throw new Error('No se pudo crear contexto 2D');
  }

  // Renderizar página
  await page.render({
    canvasContext: context,
    viewport
  }).promise;

  // Cleanup
  pdf.destroy();

  // Convertir a Blob
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error('Error al crear blob de imagen'));
        }
      },
      'image/png',
      0.95
    );
  });
}

/**
 * Convierte múltiples páginas de un PDF a imágenes
 * @param file - Archivo PDF
 * @param maxPages - Máximo de páginas a convertir (default: 3)
 * @param scale - Factor de escala (default: 2)
 */
export async function pdfToImages(
  file: File,
  maxPages: number = 3,
  scale: number = 2
): Promise<Blob[]> {
  const pdfjs = await getPdfjs();
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise;

  const totalPages = pdf.numPages;
  const numPages = Math.min(totalPages, maxPages);

  const images: Blob[] = [];

  for (let i = 1; i <= numPages; i++) {
    const page = await pdf.getPage(i);
    const viewport = page.getViewport({ scale });

    const canvas = document.createElement('canvas');
    canvas.width = viewport.width;
    canvas.height = viewport.height;

    const context = canvas.getContext('2d');
    if (!context) {
      continue;
    }

    await page.render({
      canvasContext: context,
      viewport
    }).promise;

    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob((b) => resolve(b), 'image/png', 0.95);
    });

    if (blob) {
      images.push(blob);
    }
  }

  pdf.destroy();
  return images;
}

/**
 * Convierte una página de PDF a base64
 * @param file - Archivo PDF
 * @param pageNum - Número de página (1-indexed)
 */
export async function pdfPageToBase64(
  file: File,
  pageNum: number
): Promise<string> {
  const blob = await pdfToImage(file, pageNum);
  return blobToBase64(blob);
}

/**
 * Convierte un Blob a base64
 */
export function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        reject(new Error('Error al convertir blob a base64'));
      }
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/**
 * Calcula el hash SHA-256 de un archivo (para auditoría)
 */
export async function getFileHash(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Obtiene información básica del PDF
 */
export interface PdfInfo {
  pageCount: number;
  fileName: string;
  fileSize: number;
  fileHash: string;
}

export async function getPdfInfo(file: File): Promise<PdfInfo> {
  const [pageCount, fileHash] = await Promise.all([
    getPdfPageCount(file),
    getFileHash(file)
  ]);

  return {
    pageCount,
    fileName: file.name,
    fileSize: file.size,
    fileHash
  };
}

/**
 * Genera un preview (thumbnail) de la primera página
 * @param file - Archivo PDF
 * @param maxWidth - Ancho máximo del preview (default: 300)
 */
export async function generatePdfPreview(
  file: File,
  maxWidth: number = 300
): Promise<string> {
  const pdfjs = await getPdfjs();
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise;

  try {
    const page = await pdf.getPage(1);

    // Calcular escala para que el ancho sea maxWidth
    const originalViewport = page.getViewport({ scale: 1 });
    const scale = maxWidth / originalViewport.width;
    const viewport = page.getViewport({ scale });

    const canvas = document.createElement('canvas');
    canvas.width = viewport.width;
    canvas.height = viewport.height;

    const context = canvas.getContext('2d');
    if (!context) {
      throw new Error('No se pudo crear contexto 2D');
    }

    await page.render({
      canvasContext: context,
      viewport
    }).promise;

    return canvas.toDataURL('image/png', 0.8);
  } finally {
    pdf.destroy();
  }
}
