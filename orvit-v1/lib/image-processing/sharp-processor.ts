import sharp from 'sharp';
import {
  ImageVariant,
  OutputFormat,
  ProcessedVariant,
  ImageMetadata,
  ProcessingOptions,
  VariantConfig,
} from './types';
import {
  IMAGE_VARIANTS,
  DEFAULT_OUTPUT_FORMAT,
  FORMAT_CONTENT_TYPES,
  MAX_ORIGINAL_DIMENSION,
} from './config';
import { getVariantKey, getS3Url } from './utils';

/**
 * Extrae metadata de una imagen usando Sharp
 */
export async function extractImageMetadata(buffer: Buffer): Promise<ImageMetadata> {
  const metadata = await sharp(buffer).metadata();

  return {
    width: metadata.width || 0,
    height: metadata.height || 0,
    format: metadata.format || 'unknown',
    size: buffer.length,
    hasAlpha: metadata.hasAlpha || false,
  };
}

/**
 * Procesa una variante específica de la imagen
 */
async function processVariant(
  buffer: Buffer,
  variantConfig: VariantConfig,
  format: OutputFormat,
  originalKey: string,
  hasAlpha: boolean
): Promise<ProcessedVariant> {
  let pipeline = sharp(buffer).resize(variantConfig.maxWidth, variantConfig.maxHeight, {
    fit: 'inside',
    withoutEnlargement: true,
  });

  // Aplicar formato con calidad correspondiente
  switch (format) {
    case 'webp':
      pipeline = pipeline.webp({
        quality: variantConfig.quality,
        ...(hasAlpha ? {} : { alphaQuality: 0 }),
      });
      break;
    case 'avif':
      pipeline = pipeline.avif({
        quality: variantConfig.quality,
      });
      break;
    case 'jpeg':
      pipeline = pipeline.jpeg({
        quality: variantConfig.quality,
        mozjpeg: true,
      });
      break;
  }

  const outputBuffer = await pipeline.toBuffer({ resolveWithObject: true });
  const key = getVariantKey(originalKey, variantConfig.name, format);

  return {
    variant: variantConfig.name,
    format,
    width: outputBuffer.info.width,
    height: outputBuffer.info.height,
    size: outputBuffer.info.size,
    buffer: outputBuffer.data,
    key,
    url: getS3Url(key),
  };
}

/**
 * Procesa una imagen generando todas las variantes configuradas
 *
 * @param buffer - Buffer de la imagen original
 * @param originalKey - Key de S3 donde se guardó la imagen original
 * @param options - Opciones de procesamiento
 * @returns Array de variantes procesadas listas para subir a S3
 */
export async function processImage(
  buffer: Buffer,
  originalKey: string,
  options: ProcessingOptions = {}
): Promise<{
  variants: ProcessedVariant[];
  metadata: ImageMetadata;
}> {
  const {
    formats = [DEFAULT_OUTPUT_FORMAT],
    variants: requestedVariants,
  } = options;

  // Extraer metadata
  const metadata = await extractImageMetadata(buffer);

  // Determinar qué variantes generar
  const variantsToProcess = requestedVariants
    ? IMAGE_VARIANTS.filter(v => requestedVariants.includes(v.name))
    : IMAGE_VARIANTS;

  // Si la imagen original es más pequeña que el thumbnail, no tiene sentido generar variantes
  if (metadata.width <= 150 && metadata.height <= 150) {
    return { variants: [], metadata };
  }

  // Optimizar imagen original si es muy grande
  let sourceBuffer = buffer;
  if (metadata.width > MAX_ORIGINAL_DIMENSION || metadata.height > MAX_ORIGINAL_DIMENSION) {
    sourceBuffer = await sharp(buffer)
      .resize(MAX_ORIGINAL_DIMENSION, MAX_ORIGINAL_DIMENSION, {
        fit: 'inside',
        withoutEnlargement: true,
      })
      .toBuffer();
  }

  // Procesar todas las variantes en paralelo
  const processingPromises: Promise<ProcessedVariant>[] = [];

  for (const variantConfig of variantsToProcess) {
    // No generar variante si la imagen original es más pequeña que la variante
    if (metadata.width <= variantConfig.maxWidth && metadata.height <= variantConfig.maxHeight) {
      continue;
    }

    for (const format of formats) {
      processingPromises.push(
        processVariant(sourceBuffer, variantConfig, format, originalKey, metadata.hasAlpha)
      );
    }
  }

  const variants = await Promise.all(processingPromises);

  return { variants, metadata };
}

/**
 * Obtiene el Content-Type para un formato de salida
 */
export function getContentType(format: OutputFormat): string {
  return FORMAT_CONTENT_TYPES[format];
}
