// Barrel export para image-processing
export type {
  ImageVariant,
  OutputFormat,
  VariantConfig,
  ProcessedVariant,
  ImageProcessingResult,
  ImageMetadata,
  ProcessingOptions,
  UploadImageResponse,
} from './types';

export {
  IMAGE_VARIANTS,
  DEFAULT_OUTPUT_FORMAT,
  OUTPUT_FORMATS,
  PROCESSABLE_IMAGE_TYPES,
  PROCESSABLE_EXTENSIONS,
  MAX_IMAGE_SIZE,
  MAX_ORIGINAL_DIMENSION,
  FORMAT_CONTENT_TYPES,
  FORMAT_EXTENSIONS,
} from './config';

export {
  isProcessableImage,
  isProcessableExtension,
  getVariantKey,
  getS3Url,
  deriveVariantUrl,
  getAllVariantUrls,
  getFileExtension,
  validateImageSize,
} from './utils';
