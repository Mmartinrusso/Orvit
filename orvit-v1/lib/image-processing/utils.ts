import { ImageVariant, OutputFormat } from './types';
import {
  PROCESSABLE_IMAGE_TYPES,
  PROCESSABLE_EXTENSIONS,
  FORMAT_EXTENSIONS,
  IMAGE_VARIANTS,
} from './config';

/**
 * Verifica si un tipo MIME es una imagen procesable por Sharp
 */
export function isProcessableImage(mimeType: string): boolean {
  return PROCESSABLE_IMAGE_TYPES.includes(mimeType);
}

/**
 * Verifica si una extensión es de imagen procesable
 */
export function isProcessableExtension(ext: string): boolean {
  return PROCESSABLE_EXTENSIONS.includes(ext.toLowerCase());
}

/**
 * Genera la key de S3 para una variante de imagen
 *
 * Ejemplo:
 *   originalKey: "equipment/photo/123/1707000000-uuid.jpg"
 *   variant: "thumbnail", format: "webp"
 *   resultado: "equipment/photo/123/1707000000-uuid_thumb.webp"
 */
export function getVariantKey(
  originalKey: string,
  variant: ImageVariant,
  format: OutputFormat
): string {
  const variantConfig = IMAGE_VARIANTS.find(v => v.name === variant);
  if (!variantConfig) {
    throw new Error(`Variante desconocida: ${variant}`);
  }

  const lastDotIndex = originalKey.lastIndexOf('.');
  if (lastDotIndex === -1) {
    return `${originalKey}${variantConfig.suffix}.${FORMAT_EXTENSIONS[format]}`;
  }

  const baseName = originalKey.substring(0, lastDotIndex);
  return `${baseName}${variantConfig.suffix}.${FORMAT_EXTENSIONS[format]}`;
}

/**
 * Genera la URL completa de S3 para una key
 */
export function getS3Url(key: string): string {
  const region = process.env.AWS_REGION;
  const bucket = process.env.AWS_S3_BUCKET;

  if (!region || !bucket) {
    throw new Error('Variables de entorno AWS_REGION y AWS_S3_BUCKET son requeridas para generar URLs de S3');
  }

  return `https://${bucket}.s3.${region}.amazonaws.com/${key}`;
}

/**
 * Dado una URL de imagen original, deriva la URL de una variante
 * Útil en el frontend donde no tenemos acceso a las keys de S3
 */
export function deriveVariantUrl(
  originalUrl: string,
  variant: ImageVariant,
  format: OutputFormat = 'webp'
): string {
  const variantConfig = IMAGE_VARIANTS.find(v => v.name === variant);
  if (!variantConfig) return originalUrl;

  // Separar query params y fragment del path
  let path = originalUrl;
  let suffix = '';
  const queryIndex = originalUrl.indexOf('?');
  const hashIndex = originalUrl.indexOf('#');
  const separatorIndex = queryIndex !== -1 ? queryIndex : hashIndex !== -1 ? hashIndex : -1;

  if (separatorIndex !== -1) {
    path = originalUrl.substring(0, separatorIndex);
    suffix = originalUrl.substring(separatorIndex);
  }

  // Buscar la extensión solo en el path (no en query params)
  const lastDotIndex = path.lastIndexOf('.');
  const lastSlashIndex = path.lastIndexOf('/');

  // El punto debe estar después del último slash para ser una extensión de archivo
  if (lastDotIndex === -1 || lastDotIndex < lastSlashIndex) return originalUrl;

  const basePart = path.substring(0, lastDotIndex);
  return `${basePart}${variantConfig.suffix}.${FORMAT_EXTENSIONS[format]}${suffix}`;
}

/**
 * Genera un mapa de todas las URLs de variantes a partir de la URL original
 */
export function getAllVariantUrls(
  originalUrl: string,
  format: OutputFormat = 'webp'
): Record<ImageVariant, string> {
  return {
    original: originalUrl,
    thumbnail: deriveVariantUrl(originalUrl, 'thumbnail', format),
    medium: deriveVariantUrl(originalUrl, 'medium', format),
    large: deriveVariantUrl(originalUrl, 'large', format),
  };
}

/**
 * Extrae la extensión de un nombre de archivo
 */
export function getFileExtension(filename: string): string {
  const dotIndex = filename.lastIndexOf('.');
  if (dotIndex === -1 || dotIndex === 0) return '';
  return filename.substring(dotIndex + 1).toLowerCase();
}

/**
 * Valida el tamaño de archivo para imágenes
 */
export function validateImageSize(sizeInBytes: number, maxSizeInBytes: number): boolean {
  return sizeInBytes <= maxSizeInBytes;
}
