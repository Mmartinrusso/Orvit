import { VariantConfig, OutputFormat } from './types';

/** Configuración de variantes de imagen */
export const IMAGE_VARIANTS: VariantConfig[] = [
  {
    name: 'thumbnail',
    maxWidth: 150,
    maxHeight: 150,
    quality: 70,
    suffix: '_thumb',
  },
  {
    name: 'medium',
    maxWidth: 600,
    maxHeight: 600,
    quality: 80,
    suffix: '_medium',
  },
  {
    name: 'large',
    maxWidth: 1200,
    maxHeight: 1200,
    quality: 85,
    suffix: '_large',
  },
];

/** Formato de salida principal */
export const DEFAULT_OUTPUT_FORMAT: OutputFormat = 'webp';

/** Formatos de salida con fallback */
export const OUTPUT_FORMATS: OutputFormat[] = ['webp'];

/** Tipos MIME de imagen que se pueden procesar con Sharp */
export const PROCESSABLE_IMAGE_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/avif',
  'image/tiff',
];

/** Extensiones de imagen procesables */
export const PROCESSABLE_EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp', 'gif', 'avif', 'tiff'];

/** Límite de tamaño para upload de imágenes (10MB) */
export const MAX_IMAGE_SIZE = 10 * 1024 * 1024;

/** Tamaño máximo del lado más largo antes de considerar resize del original */
export const MAX_ORIGINAL_DIMENSION = 4096;

/** Content-Type para cada formato de salida */
export const FORMAT_CONTENT_TYPES: Record<OutputFormat, string> = {
  webp: 'image/webp',
  avif: 'image/avif',
  jpeg: 'image/jpeg',
};

/** Extensión de archivo para cada formato de salida */
export const FORMAT_EXTENSIONS: Record<OutputFormat, string> = {
  webp: 'webp',
  avif: 'avif',
  jpeg: 'jpg',
};
