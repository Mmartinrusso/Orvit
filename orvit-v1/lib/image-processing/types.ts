// Tipos para el pipeline de procesamiento de imágenes

/** Variantes de tamaño generadas para cada imagen */
export type ImageVariant = 'thumbnail' | 'medium' | 'large' | 'original';

/** Formatos de salida soportados */
export type OutputFormat = 'webp' | 'avif' | 'jpeg';

/** Configuración de una variante específica */
export interface VariantConfig {
  /** Nombre de la variante */
  name: ImageVariant;
  /** Ancho máximo en píxeles */
  maxWidth: number;
  /** Alto máximo en píxeles */
  maxHeight: number;
  /** Calidad de compresión (1-100) */
  quality: number;
  /** Sufijo agregado al nombre del archivo */
  suffix: string;
}

/** Resultado del procesamiento de una variante */
export interface ProcessedVariant {
  variant: ImageVariant;
  format: OutputFormat;
  width: number;
  height: number;
  size: number;
  buffer: Buffer;
  key: string;
  url: string;
}

/** Resultado completo del procesamiento de una imagen */
export interface ImageProcessingResult {
  /** URL de la imagen original */
  originalUrl: string;
  /** Key de la imagen original en S3 */
  originalKey: string;
  /** Variantes generadas */
  variants: ProcessedVariant[];
  /** Metadata de la imagen original */
  metadata: ImageMetadata;
}

/** Metadata extraída de la imagen original */
export interface ImageMetadata {
  width: number;
  height: number;
  format: string;
  size: number;
  hasAlpha: boolean;
}

/** Opciones para el procesamiento de imágenes */
export interface ProcessingOptions {
  /** Formatos de salida a generar (default: ['webp']) */
  formats?: OutputFormat[];
  /** Variantes a generar (default: todas) */
  variants?: ImageVariant[];
  /** Preservar metadata EXIF */
  preserveMetadata?: boolean;
}

/** Respuesta del endpoint de upload con variantes */
export interface UploadImageResponse {
  url: string;
  fileName: string;
  fileType: string;
  entityType: string;
  entityId: string;
  originalName: string;
  size: number;
  /** URLs de variantes optimizadas (solo para imágenes procesadas) */
  variants?: Record<ImageVariant, string>;
  /** Metadata de la imagen (solo para imágenes procesadas) */
  imageMetadata?: ImageMetadata;
}
