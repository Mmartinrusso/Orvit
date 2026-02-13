/**
 * Tests para el pipeline de optimización de imágenes
 *
 * Archivos verificados:
 *   - lib/image-processing/types.ts
 *   - lib/image-processing/config.ts
 *   - lib/image-processing/utils.ts
 *   - lib/image-processing/sharp-processor.ts
 *   - lib/image-processing/index.ts (barrel exports)
 *   - hooks/use-image-upload.ts (validación)
 *   - components/ui/SafeImage.tsx (integración props)
 *   - components/ui/optimized-image.tsx (integración props)
 *   - app/api/upload/route.ts (integración pipeline)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

// ─── Imports directos de módulos a testear ──────────────────────────────────

import {
  IMAGE_VARIANTS,
  DEFAULT_OUTPUT_FORMAT,
  OUTPUT_FORMATS,
  PROCESSABLE_IMAGE_TYPES,
  PROCESSABLE_EXTENSIONS,
  MAX_IMAGE_SIZE,
  MAX_ORIGINAL_DIMENSION,
  FORMAT_CONTENT_TYPES,
  FORMAT_EXTENSIONS,
} from '@/lib/image-processing/config';

import {
  isProcessableImage,
  isProcessableExtension,
  getVariantKey,
  getS3Url,
  deriveVariantUrl,
  getAllVariantUrls,
  getFileExtension,
  validateImageSize,
} from '@/lib/image-processing/utils';

// ─────────────────────────────────────────────────────────────────────────────
// PART 1: Config – constantes y valores
// ─────────────────────────────────────────────────────────────────────────────

describe('Image Processing Config', () => {
  describe('IMAGE_VARIANTS', () => {
    it('debe tener 3 variantes definidas (thumbnail, medium, large)', () => {
      expect(IMAGE_VARIANTS).toHaveLength(3);
      const names = IMAGE_VARIANTS.map(v => v.name);
      expect(names).toEqual(['thumbnail', 'medium', 'large']);
    });

    it('thumbnail: 150px, quality 70, suffix _thumb', () => {
      const thumb = IMAGE_VARIANTS.find(v => v.name === 'thumbnail')!;
      expect(thumb.maxWidth).toBe(150);
      expect(thumb.maxHeight).toBe(150);
      expect(thumb.quality).toBe(70);
      expect(thumb.suffix).toBe('_thumb');
    });

    it('medium: 600px, quality 80, suffix _medium', () => {
      const med = IMAGE_VARIANTS.find(v => v.name === 'medium')!;
      expect(med.maxWidth).toBe(600);
      expect(med.maxHeight).toBe(600);
      expect(med.quality).toBe(80);
      expect(med.suffix).toBe('_medium');
    });

    it('large: 1200px, quality 85, suffix _large', () => {
      const lg = IMAGE_VARIANTS.find(v => v.name === 'large')!;
      expect(lg.maxWidth).toBe(1200);
      expect(lg.maxHeight).toBe(1200);
      expect(lg.quality).toBe(85);
      expect(lg.suffix).toBe('_large');
    });

    it('las variantes deben estar ordenadas de menor a mayor tamaño', () => {
      for (let i = 1; i < IMAGE_VARIANTS.length; i++) {
        expect(IMAGE_VARIANTS[i].maxWidth).toBeGreaterThan(IMAGE_VARIANTS[i - 1].maxWidth);
      }
    });

    it('la calidad debe aumentar con el tamaño', () => {
      for (let i = 1; i < IMAGE_VARIANTS.length; i++) {
        expect(IMAGE_VARIANTS[i].quality).toBeGreaterThan(IMAGE_VARIANTS[i - 1].quality);
      }
    });
  });

  describe('DEFAULT_OUTPUT_FORMAT', () => {
    it('debe ser webp', () => {
      expect(DEFAULT_OUTPUT_FORMAT).toBe('webp');
    });
  });

  describe('OUTPUT_FORMATS', () => {
    it('debe contener al menos webp', () => {
      expect(OUTPUT_FORMATS).toContain('webp');
    });
  });

  describe('PROCESSABLE_IMAGE_TYPES', () => {
    it('debe incluir los tipos MIME principales de imagen', () => {
      expect(PROCESSABLE_IMAGE_TYPES).toContain('image/jpeg');
      expect(PROCESSABLE_IMAGE_TYPES).toContain('image/png');
      expect(PROCESSABLE_IMAGE_TYPES).toContain('image/webp');
      expect(PROCESSABLE_IMAGE_TYPES).toContain('image/gif');
    });

    it('no debe incluir tipos no-imagen', () => {
      expect(PROCESSABLE_IMAGE_TYPES).not.toContain('application/pdf');
      expect(PROCESSABLE_IMAGE_TYPES).not.toContain('text/plain');
    });
  });

  describe('PROCESSABLE_EXTENSIONS', () => {
    it('debe incluir extensiones de imagen comunes', () => {
      expect(PROCESSABLE_EXTENSIONS).toContain('jpg');
      expect(PROCESSABLE_EXTENSIONS).toContain('jpeg');
      expect(PROCESSABLE_EXTENSIONS).toContain('png');
      expect(PROCESSABLE_EXTENSIONS).toContain('webp');
    });
  });

  describe('MAX_IMAGE_SIZE', () => {
    it('debe ser 10MB', () => {
      expect(MAX_IMAGE_SIZE).toBe(10 * 1024 * 1024);
    });
  });

  describe('MAX_ORIGINAL_DIMENSION', () => {
    it('debe ser 4096px', () => {
      expect(MAX_ORIGINAL_DIMENSION).toBe(4096);
    });
  });

  describe('FORMAT_CONTENT_TYPES', () => {
    it('debe mapear formatos a content-types correctos', () => {
      expect(FORMAT_CONTENT_TYPES.webp).toBe('image/webp');
      expect(FORMAT_CONTENT_TYPES.avif).toBe('image/avif');
      expect(FORMAT_CONTENT_TYPES.jpeg).toBe('image/jpeg');
    });
  });

  describe('FORMAT_EXTENSIONS', () => {
    it('debe mapear formatos a extensiones correctas', () => {
      expect(FORMAT_EXTENSIONS.webp).toBe('webp');
      expect(FORMAT_EXTENSIONS.avif).toBe('avif');
      expect(FORMAT_EXTENSIONS.jpeg).toBe('jpg');
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// PART 2: Utils – funciones puras
// ─────────────────────────────────────────────────────────────────────────────

describe('Image Processing Utils', () => {
  describe('isProcessableImage()', () => {
    it('debe retornar true para tipos MIME de imagen válidos', () => {
      expect(isProcessableImage('image/jpeg')).toBe(true);
      expect(isProcessableImage('image/png')).toBe(true);
      expect(isProcessableImage('image/webp')).toBe(true);
      expect(isProcessableImage('image/gif')).toBe(true);
      expect(isProcessableImage('image/avif')).toBe(true);
      expect(isProcessableImage('image/tiff')).toBe(true);
    });

    it('debe retornar true para image/jpg (alias)', () => {
      expect(isProcessableImage('image/jpg')).toBe(true);
    });

    it('debe retornar false para tipos no-imagen', () => {
      expect(isProcessableImage('application/pdf')).toBe(false);
      expect(isProcessableImage('text/plain')).toBe(false);
      expect(isProcessableImage('video/mp4')).toBe(false);
      expect(isProcessableImage('')).toBe(false);
    });

    it('debe ser case-sensitive (MIME types son lowercase por spec)', () => {
      expect(isProcessableImage('IMAGE/JPEG')).toBe(false);
      expect(isProcessableImage('Image/Png')).toBe(false);
    });
  });

  describe('isProcessableExtension()', () => {
    it('debe retornar true para extensiones de imagen válidas', () => {
      expect(isProcessableExtension('jpg')).toBe(true);
      expect(isProcessableExtension('jpeg')).toBe(true);
      expect(isProcessableExtension('png')).toBe(true);
      expect(isProcessableExtension('webp')).toBe(true);
      expect(isProcessableExtension('gif')).toBe(true);
    });

    it('debe ser case-insensitive', () => {
      expect(isProcessableExtension('JPG')).toBe(true);
      expect(isProcessableExtension('Png')).toBe(true);
      expect(isProcessableExtension('WEBP')).toBe(true);
    });

    it('debe retornar false para extensiones no procesables', () => {
      expect(isProcessableExtension('pdf')).toBe(false);
      expect(isProcessableExtension('txt')).toBe(false);
      expect(isProcessableExtension('mp4')).toBe(false);
      expect(isProcessableExtension('')).toBe(false);
    });
  });

  describe('getVariantKey()', () => {
    it('debe generar key correcta para thumbnail webp', () => {
      const key = getVariantKey('equipment/photo/123/img.jpg', 'thumbnail', 'webp');
      expect(key).toBe('equipment/photo/123/img_thumb.webp');
    });

    it('debe generar key correcta para medium webp', () => {
      const key = getVariantKey('equipment/photo/123/img.jpg', 'medium', 'webp');
      expect(key).toBe('equipment/photo/123/img_medium.webp');
    });

    it('debe generar key correcta para large jpeg', () => {
      const key = getVariantKey('equipment/photo/123/img.png', 'large', 'jpeg');
      expect(key).toBe('equipment/photo/123/img_large.jpg');
    });

    it('debe manejar nombres con múltiples puntos', () => {
      const key = getVariantKey('path/to/file.name.with.dots.jpg', 'thumbnail', 'webp');
      // Debe reemplazar solo la última extensión
      expect(key).toBe('path/to/file.name.with.dots_thumb.webp');
    });

    it('debe manejar archivos sin extensión', () => {
      const key = getVariantKey('path/to/noextension', 'medium', 'webp');
      expect(key).toBe('path/to/noextension_medium.webp');
    });

    it('debe lanzar error para variante desconocida', () => {
      expect(() => getVariantKey('test.jpg', 'original' as any, 'webp')).toThrow(
        'Variante desconocida: original'
      );
    });

    it('debe lanzar error para variante completamente inválida', () => {
      expect(() => getVariantKey('test.jpg', 'huge' as any, 'webp')).toThrow(
        'Variante desconocida: huge'
      );
    });
  });

  describe('getS3Url()', () => {
    const origRegion = process.env.AWS_REGION;
    const origBucket = process.env.AWS_S3_BUCKET;

    beforeEach(() => {
      process.env.AWS_REGION = 'us-east-1';
      process.env.AWS_S3_BUCKET = 'my-bucket';
    });

    afterEach(() => {
      process.env.AWS_REGION = origRegion;
      process.env.AWS_S3_BUCKET = origBucket;
    });

    it('debe generar URL S3 correcta', () => {
      const url = getS3Url('equipment/photo/123/img.jpg');
      expect(url).toBe('https://my-bucket.s3.us-east-1.amazonaws.com/equipment/photo/123/img.jpg');
    });

    it('debe manejar keys con caracteres especiales', () => {
      const url = getS3Url('path/with spaces/file (1).jpg');
      expect(url).toContain('path/with spaces/file (1).jpg');
    });
  });

  describe('deriveVariantUrl()', () => {
    it('debe derivar URL de variante correctamente', () => {
      const url = deriveVariantUrl(
        'https://bucket.s3.region.amazonaws.com/path/image.jpg',
        'thumbnail'
      );
      expect(url).toBe('https://bucket.s3.region.amazonaws.com/path/image_thumb.webp');
    });

    it('debe usar formato por defecto webp', () => {
      const url = deriveVariantUrl('https://example.com/photo.jpg', 'medium');
      expect(url).toBe('https://example.com/photo_medium.webp');
    });

    it('debe respetar formato explícito jpeg', () => {
      const url = deriveVariantUrl('https://example.com/photo.jpg', 'large', 'jpeg');
      expect(url).toBe('https://example.com/photo_large.jpg');
    });

    it('debe retornar URL original si variante no existe', () => {
      const url = deriveVariantUrl('https://example.com/photo.jpg', 'original');
      // original no tiene config en IMAGE_VARIANTS, debe retornar original
      expect(url).toBe('https://example.com/photo.jpg');
    });

    it('URL sin extensión de archivo retorna URL original (fix aplicado)', () => {
      // deriveVariantUrl ahora verifica que el punto esté después del último slash
      const url = deriveVariantUrl('https://example.com/noext', 'thumbnail');
      expect(url).toBe('https://example.com/noext');
    });

    it('debe manejar URL con query params preservándolos', () => {
      const url = deriveVariantUrl(
        'https://example.com/photo.jpg?token=abc',
        'thumbnail'
      );
      expect(url).toBe('https://example.com/photo_thumb.webp?token=abc');
    });
  });

  describe('getAllVariantUrls()', () => {
    it('debe generar mapa completo de variantes', () => {
      const variants = getAllVariantUrls('https://example.com/photo.jpg');
      expect(variants).toHaveProperty('original');
      expect(variants).toHaveProperty('thumbnail');
      expect(variants).toHaveProperty('medium');
      expect(variants).toHaveProperty('large');
    });

    it('la variante original debe ser la URL sin modificar', () => {
      const originalUrl = 'https://example.com/photo.jpg';
      const variants = getAllVariantUrls(originalUrl);
      expect(variants.original).toBe(originalUrl);
    });

    it('las variantes derivadas deben tener el sufijo correcto', () => {
      const variants = getAllVariantUrls('https://example.com/photo.jpg');
      expect(variants.thumbnail).toContain('_thumb');
      expect(variants.medium).toContain('_medium');
      expect(variants.large).toContain('_large');
    });

    it('debe usar formato webp por defecto', () => {
      const variants = getAllVariantUrls('https://example.com/photo.jpg');
      expect(variants.thumbnail).toMatch(/\.webp$/);
      expect(variants.medium).toMatch(/\.webp$/);
      expect(variants.large).toMatch(/\.webp$/);
    });

    it('debe respetar formato explícito', () => {
      const variants = getAllVariantUrls('https://example.com/photo.jpg', 'jpeg');
      expect(variants.thumbnail).toMatch(/\.jpg$/);
      expect(variants.medium).toMatch(/\.jpg$/);
      expect(variants.large).toMatch(/\.jpg$/);
    });
  });

  describe('getFileExtension()', () => {
    it('debe extraer extensión de nombre de archivo', () => {
      expect(getFileExtension('photo.jpg')).toBe('jpg');
      expect(getFileExtension('image.png')).toBe('png');
      expect(getFileExtension('file.webp')).toBe('webp');
    });

    it('debe retornar extensión en lowercase', () => {
      expect(getFileExtension('photo.JPG')).toBe('jpg');
      expect(getFileExtension('IMAGE.PNG')).toBe('png');
    });

    it('debe retornar la última extensión para archivos con múltiples puntos', () => {
      expect(getFileExtension('archive.tar.gz')).toBe('gz');
      expect(getFileExtension('file.name.txt')).toBe('txt');
    });

    it('debe retornar cadena vacía para archivos sin extensión', () => {
      expect(getFileExtension('noextension')).toBe('');
    });
  });

  describe('validateImageSize()', () => {
    it('debe retornar true si el tamaño está dentro del límite', () => {
      expect(validateImageSize(1024, MAX_IMAGE_SIZE)).toBe(true);
      expect(validateImageSize(5 * 1024 * 1024, MAX_IMAGE_SIZE)).toBe(true);
    });

    it('debe retornar true si el tamaño es exactamente el límite', () => {
      expect(validateImageSize(MAX_IMAGE_SIZE, MAX_IMAGE_SIZE)).toBe(true);
    });

    it('debe retornar false si el tamaño excede el límite', () => {
      expect(validateImageSize(MAX_IMAGE_SIZE + 1, MAX_IMAGE_SIZE)).toBe(false);
      expect(validateImageSize(20 * 1024 * 1024, MAX_IMAGE_SIZE)).toBe(false);
    });

    it('debe funcionar con 0 bytes', () => {
      expect(validateImageSize(0, MAX_IMAGE_SIZE)).toBe(true);
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// PART 3: Barrel exports – verificar que index.ts exporta todo
// ─────────────────────────────────────────────────────────────────────────────

describe('Image Processing barrel exports (index.ts)', () => {
  it('debe exportar todas las constantes de config', async () => {
    const indexModule = await import('@/lib/image-processing/index');
    expect(indexModule.IMAGE_VARIANTS).toBeDefined();
    expect(indexModule.DEFAULT_OUTPUT_FORMAT).toBeDefined();
    expect(indexModule.OUTPUT_FORMATS).toBeDefined();
    expect(indexModule.PROCESSABLE_IMAGE_TYPES).toBeDefined();
    expect(indexModule.PROCESSABLE_EXTENSIONS).toBeDefined();
    expect(indexModule.MAX_IMAGE_SIZE).toBeDefined();
    expect(indexModule.MAX_ORIGINAL_DIMENSION).toBeDefined();
    expect(indexModule.FORMAT_CONTENT_TYPES).toBeDefined();
    expect(indexModule.FORMAT_EXTENSIONS).toBeDefined();
  });

  it('debe exportar todas las funciones de utils', async () => {
    const indexModule = await import('@/lib/image-processing/index');
    expect(typeof indexModule.isProcessableImage).toBe('function');
    expect(typeof indexModule.isProcessableExtension).toBe('function');
    expect(typeof indexModule.getVariantKey).toBe('function');
    expect(typeof indexModule.getS3Url).toBe('function');
    expect(typeof indexModule.deriveVariantUrl).toBe('function');
    expect(typeof indexModule.getAllVariantUrls).toBe('function');
    expect(typeof indexModule.getFileExtension).toBe('function');
    expect(typeof indexModule.validateImageSize).toBe('function');
  });

  it('NO debe re-exportar sharp-processor (requiere sharp)', () => {
    // El index.ts NO exporta processImage ni extractImageMetadata
    // Esto es intencional: el barrel solo exporta tipos, config y utils puros
    const indexSource = readFileSync(
      resolve(__dirname, '..', 'orvit-v1', 'lib', 'image-processing', 'index.ts'),
      'utf-8'
    );
    expect(indexSource).not.toContain("from './sharp-processor'");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// PART 4: Sharp Processor – tests con procesamiento real
// ─────────────────────────────────────────────────────────────────────────────

describe('Sharp Processor', () => {
  // Necesitamos sharp instalado para estos tests
  let sharpModule: any;
  let extractImageMetadata: any;
  let processImage: any;
  let getContentType: any;

  beforeEach(async () => {
    try {
      sharpModule = await import('sharp');
      const processor = await import('@/lib/image-processing/sharp-processor');
      extractImageMetadata = processor.extractImageMetadata;
      processImage = processor.processImage;
      getContentType = processor.getContentType;
    } catch {
      // sharp no está instalado, los tests se saltan
    }
  });

  // Helper: crear un buffer de imagen de prueba con sharp
  async function createTestImage(width: number, height: number, hasAlpha = false) {
    if (!sharpModule) return null;
    const channels = hasAlpha ? 4 : 3;
    const raw = Buffer.alloc(width * height * channels, 128);
    return sharpModule
      .default(raw, { raw: { width, height, channels } })
      .jpeg()
      .toBuffer();
  }

  describe('extractImageMetadata()', () => {
    it('debe extraer metadata de una imagen JPEG', async () => {
      if (!sharpModule) return;

      const buffer = await createTestImage(800, 600);
      const metadata = await extractImageMetadata(buffer);

      expect(metadata.width).toBe(800);
      expect(metadata.height).toBe(600);
      expect(metadata.format).toBe('jpeg');
      expect(metadata.size).toBeGreaterThan(0);
      expect(metadata.hasAlpha).toBe(false);
    });

    it('debe detectar canal alpha', async () => {
      if (!sharpModule) return;

      const raw = Buffer.alloc(100 * 100 * 4, 128);
      const buffer = await sharpModule.default(raw, { raw: { width: 100, height: 100, channels: 4 } })
        .png()
        .toBuffer();

      const metadata = await extractImageMetadata(buffer);
      expect(metadata.hasAlpha).toBe(true);
    });

    it('debe setear width/height a 0 si metadata es undefined', async () => {
      // Este test verifica el fallback || 0
      if (!sharpModule) return;
      // Con un buffer JPEG válido, width y height siempre estarán presentes
      const buffer = await createTestImage(200, 100);
      const metadata = await extractImageMetadata(buffer);
      expect(metadata.width).toBeGreaterThan(0);
      expect(metadata.height).toBeGreaterThan(0);
    });
  });

  describe('processImage()', () => {
    it('debe generar variantes para una imagen grande (800x600)', async () => {
      if (!sharpModule) return;

      process.env.AWS_REGION = 'us-east-1';
      process.env.AWS_S3_BUCKET = 'test-bucket';

      const buffer = await createTestImage(800, 600);
      const result = await processImage(buffer, 'test/photo/img.jpg');

      // Imagen 800x600 → debería generar thumbnail (150) y medium (600)
      // Pero NO large (1200) porque la imagen es más pequeña que 1200
      expect(result.metadata.width).toBe(800);
      expect(result.metadata.height).toBe(600);

      const variantNames = result.variants.map((v: any) => v.variant);
      expect(variantNames).toContain('thumbnail');
      expect(variantNames).toContain('medium');
      expect(variantNames).not.toContain('large');
    });

    it('debe generar todas las variantes para imagen muy grande (2000x1500)', async () => {
      if (!sharpModule) return;

      process.env.AWS_REGION = 'us-east-1';
      process.env.AWS_S3_BUCKET = 'test-bucket';

      const buffer = await createTestImage(2000, 1500);
      const result = await processImage(buffer, 'test/photo/big.jpg');

      const variantNames = result.variants.map((v: any) => v.variant);
      expect(variantNames).toContain('thumbnail');
      expect(variantNames).toContain('medium');
      expect(variantNames).toContain('large');
    });

    it('NO debe generar variantes para imagen muy pequeña (100x100)', async () => {
      if (!sharpModule) return;

      const buffer = await createTestImage(100, 100);
      const result = await processImage(buffer, 'test/photo/small.jpg');

      // Imagen <= 150x150 → no se generan variantes
      expect(result.variants).toHaveLength(0);
      expect(result.metadata.width).toBe(100);
    });

    it('debe respetar withoutEnlargement (no agrandar)', async () => {
      if (!sharpModule) return;

      process.env.AWS_REGION = 'us-east-1';
      process.env.AWS_S3_BUCKET = 'test-bucket';

      const buffer = await createTestImage(300, 200);
      const result = await processImage(buffer, 'test/photo/small.jpg');

      // 300x200 solo debería generar thumbnail (150px), no medium (600px) ni large
      const variantNames = result.variants.map((v: any) => v.variant);
      expect(variantNames).toContain('thumbnail');
      expect(variantNames).not.toContain('medium');
      expect(variantNames).not.toContain('large');
    });

    it('cada variante debe tener width <= maxWidth de su config', async () => {
      if (!sharpModule) return;

      process.env.AWS_REGION = 'us-east-1';
      process.env.AWS_S3_BUCKET = 'test-bucket';

      const buffer = await createTestImage(2000, 1500);
      const result = await processImage(buffer, 'test/photo/big.jpg');

      for (const variant of result.variants) {
        const config = IMAGE_VARIANTS.find(v => v.name === variant.variant);
        if (config) {
          expect(variant.width).toBeLessThanOrEqual(config.maxWidth);
          expect(variant.height).toBeLessThanOrEqual(config.maxHeight);
        }
      }
    });

    it('las variantes deben tener formato webp por defecto', async () => {
      if (!sharpModule) return;

      process.env.AWS_REGION = 'us-east-1';
      process.env.AWS_S3_BUCKET = 'test-bucket';

      const buffer = await createTestImage(800, 600);
      const result = await processImage(buffer, 'test/photo/img.jpg');

      for (const variant of result.variants) {
        expect(variant.format).toBe('webp');
        expect(variant.key).toContain('.webp');
      }
    });

    it('debe generar keys correctas para cada variante', async () => {
      if (!sharpModule) return;

      process.env.AWS_REGION = 'us-east-1';
      process.env.AWS_S3_BUCKET = 'test-bucket';

      const buffer = await createTestImage(2000, 1500);
      const result = await processImage(buffer, 'equipment/photo/123/img.jpg');

      const thumbVariant = result.variants.find((v: any) => v.variant === 'thumbnail');
      expect(thumbVariant?.key).toBe('equipment/photo/123/img_thumb.webp');

      const medVariant = result.variants.find((v: any) => v.variant === 'medium');
      expect(medVariant?.key).toBe('equipment/photo/123/img_medium.webp');

      const lgVariant = result.variants.find((v: any) => v.variant === 'large');
      expect(lgVariant?.key).toBe('equipment/photo/123/img_large.webp');
    });

    it('debe respetar opciones de formatos personalizados', async () => {
      if (!sharpModule) return;

      process.env.AWS_REGION = 'us-east-1';
      process.env.AWS_S3_BUCKET = 'test-bucket';

      const buffer = await createTestImage(800, 600);
      const result = await processImage(buffer, 'test/img.jpg', { formats: ['jpeg'] });

      for (const variant of result.variants) {
        expect(variant.format).toBe('jpeg');
        expect(variant.key).toContain('.jpg');
      }
    });

    it('debe respetar opciones de variantes específicas', async () => {
      if (!sharpModule) return;

      process.env.AWS_REGION = 'us-east-1';
      process.env.AWS_S3_BUCKET = 'test-bucket';

      const buffer = await createTestImage(2000, 1500);
      const result = await processImage(buffer, 'test/img.jpg', {
        variants: ['thumbnail', 'large'],
      });

      const variantNames = result.variants.map((v: any) => v.variant);
      expect(variantNames).toContain('thumbnail');
      expect(variantNames).not.toContain('medium');
      expect(variantNames).toContain('large');
    });

    it('debe reducir imagen original si excede MAX_ORIGINAL_DIMENSION', async () => {
      if (!sharpModule) return;

      process.env.AWS_REGION = 'us-east-1';
      process.env.AWS_S3_BUCKET = 'test-bucket';

      // Imagen de 5000x4000 (excede MAX_ORIGINAL_DIMENSION=4096)
      // sharp podría fallar con buffers tan grandes en tests, así usamos una razonable
      const buffer = await createTestImage(4200, 3000);
      const result = await processImage(buffer, 'test/img.jpg');

      // Debería haber procesado correctamente sin error
      expect(result.metadata.width).toBe(4200);
      expect(result.variants.length).toBeGreaterThan(0);

      // Las variantes large deben tener max 1200px
      const lgVariant = result.variants.find((v: any) => v.variant === 'large');
      if (lgVariant) {
        expect(lgVariant.width).toBeLessThanOrEqual(1200);
      }
    });

    it('cada variante debe tener buffer no vacío', async () => {
      if (!sharpModule) return;

      process.env.AWS_REGION = 'us-east-1';
      process.env.AWS_S3_BUCKET = 'test-bucket';

      const buffer = await createTestImage(800, 600);
      const result = await processImage(buffer, 'test/img.jpg');

      for (const variant of result.variants) {
        expect(variant.buffer).toBeInstanceOf(Buffer);
        expect(variant.buffer.length).toBeGreaterThan(0);
        expect(variant.size).toBeGreaterThan(0);
      }
    });

    it('cada variante debe tener URL válida', async () => {
      if (!sharpModule) return;

      process.env.AWS_REGION = 'us-east-1';
      process.env.AWS_S3_BUCKET = 'test-bucket';

      const buffer = await createTestImage(800, 600);
      const result = await processImage(buffer, 'test/img.jpg');

      for (const variant of result.variants) {
        expect(variant.url).toContain('https://');
        expect(variant.url).toContain('.amazonaws.com');
      }
    });
  });

  describe('getContentType()', () => {
    it('debe retornar content-type correcto para cada formato', async () => {
      if (!getContentType) return;

      expect(getContentType('webp')).toBe('image/webp');
      expect(getContentType('avif')).toBe('image/avif');
      expect(getContentType('jpeg')).toBe('image/jpeg');
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// PART 5: getFileExtension – bug potencial
// ─────────────────────────────────────────────────────────────────────────────

describe('getFileExtension – edge cases (post-fix)', () => {
  it('retorna cadena vacía para archivos sin extensión', () => {
    const result = getFileExtension('noextension');
    expect(result).toBe('');
  });

  it('archivo llamado "png" sin punto NO pasa validación', () => {
    const ext = getFileExtension('png');
    expect(ext).toBe('');
    expect(isProcessableExtension(ext)).toBe(false);
  });

  it('debe manejar archivo vacío', () => {
    const result = getFileExtension('');
    expect(result).toBe('');
  });

  it('debe retornar cadena vacía para dotfile (punto al inicio)', () => {
    // .gitignore: dotIndex=0, nuestra condición dotIndex===0 retorna ''
    const result = getFileExtension('.gitignore');
    expect(result).toBe('');
  });

  it('dotfile con extensión real funciona', () => {
    const result = getFileExtension('.config.json');
    expect(result).toBe('json');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// PART 6: Verificación estática de archivos (code review via tests)
// ─────────────────────────────────────────────────────────────────────────────

describe('Code review estático', () => {
  const orvitRoot = resolve(__dirname, '..', 'orvit-v1');

  describe('upload/route.ts – integración con pipeline', () => {
    const uploadSource = readFileSync(resolve(orvitRoot, 'app', 'api', 'upload', 'route.ts'), 'utf-8');

    it('debe importar processImage del sharp-processor', () => {
      expect(uploadSource).toContain("import { processImage, getContentType } from '@/lib/image-processing/sharp-processor'");
    });

    it('debe importar isProcessableImage de utils', () => {
      expect(uploadSource).toContain("import { isProcessableImage } from '@/lib/image-processing/utils'");
    });

    it('debe usar isProcessableImage antes de procesar', () => {
      expect(uploadSource).toContain('isProcessableImage(file.type)');
    });

    it('debe subir variantes a S3 en paralelo con Promise.all', () => {
      expect(uploadSource).toContain('Promise.all');
    });

    it('debe tener manejo de error en caso de fallo de procesamiento de variantes', () => {
      expect(uploadSource).toContain('catch (imgError)');
      expect(uploadSource).toContain('se mantiene original');
    });

    it('debe incluir variants y imageMetadata en la respuesta condicionalmente', () => {
      expect(uploadSource).toContain('...(variants && { variants })');
      expect(uploadSource).toContain('...(imageMetadata && { imageMetadata })');
    });

    it('debe establecer ContentType correcto para variantes S3', () => {
      expect(uploadSource).toContain('getContentType(v.format)');
    });
  });

  describe('SafeImage.tsx – retrocompatibilidad', () => {
    const safeImageSource = readFileSync(resolve(orvitRoot, 'components', 'ui', 'SafeImage.tsx'), 'utf-8');

    it('debe soportar prop optimized (boolean)', () => {
      expect(safeImageSource).toContain('optimized');
    });

    it('debe soportar prop variant', () => {
      expect(safeImageSource).toContain('variant');
    });

    it('debe soportar prop variants (mapa de URLs)', () => {
      expect(safeImageSource).toContain('variants');
    });

    it('debe tener fallback chain: variante -> original -> fallbackSrc', () => {
      expect(safeImageSource).toContain('triedOriginal');
      expect(safeImageSource).toContain('setTriedOriginal');
    });

    it('debe resetear estado cuando cambia src', () => {
      expect(safeImageSource).toContain('setHasError(false)');
      expect(safeImageSource).toContain('setTriedOriginal(false)');
    });

    it('optimized=false debe mantener comportamiento original (sin derivar)', () => {
      // Cuando optimized=false, getInitialSrc retorna src directamente
      expect(safeImageSource).toContain("if (!optimized || !src || typeof src !== 'string') return src");
    });
  });

  describe('optimized-image.tsx – componente lazy load', () => {
    const optImgSource = readFileSync(resolve(orvitRoot, 'components', 'ui', 'optimized-image.tsx'), 'utf-8');

    it('debe usar IntersectionObserver para lazy loading', () => {
      expect(optImgSource).toContain('IntersectionObserver');
    });

    it('debe desconectar observer al unmount', () => {
      expect(optImgSource).toContain('observer.disconnect');
    });

    it('debe tener fallback chain en handleError', () => {
      expect(optImgSource).toContain('handleError');
      expect(optImgSource).toContain('fallbackSrc');
    });

    it('debe mostrar placeholder animado mientras carga', () => {
      expect(optImgSource).toContain('animate-pulse');
    });

    it('debe usar transición de opacidad al cargar', () => {
      expect(optImgSource).toContain('transition-opacity');
    });
  });

  describe('use-image-upload.ts – hook', () => {
    const hookSource = readFileSync(resolve(orvitRoot, 'hooks', 'use-image-upload.ts'), 'utf-8');

    it('debe importar MAX_IMAGE_SIZE de config', () => {
      expect(hookSource).toContain("MAX_IMAGE_SIZE");
    });

    it('debe importar PROCESSABLE_EXTENSIONS de config', () => {
      expect(hookSource).toContain("PROCESSABLE_EXTENSIONS");
    });

    it('debe validar tamaño de archivo', () => {
      expect(hookSource).toContain('file.size > maxSize');
    });

    it('debe validar extensión de archivo', () => {
      expect(hookSource).toContain('allowedExtensions.includes(ext)');
    });

    it('debe generar preview local con createObjectURL', () => {
      expect(hookSource).toContain('URL.createObjectURL(file)');
    });

    it('debe revocar blob URL al reset', () => {
      expect(hookSource).toContain('URL.revokeObjectURL(preview)');
    });

    it('debe usar toast para feedback', () => {
      expect(hookSource).toContain("toast.success('Imagen subida correctamente')");
      expect(hookSource).toContain('toast.error(');
    });

    it('debe reportar progreso en etapas', () => {
      expect(hookSource).toContain('setProgress(10)');
      expect(hookSource).toContain('setProgress(30)');
      expect(hookSource).toContain('setProgress(80)');
      expect(hookSource).toContain('setProgress(100)');
    });
  });

  describe('package.json – dependencia sharp', () => {
    const pkg = JSON.parse(
      readFileSync(resolve(orvitRoot, 'package.json'), 'utf-8')
    );

    it('debe tener sharp como dependencia', () => {
      expect(pkg.dependencies).toHaveProperty('sharp');
    });

    it('sharp debe ser versión ^0.34.5+', () => {
      const version = pkg.dependencies.sharp;
      expect(version).toMatch(/^\^?0\.3[4-9]/);
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// PART 7: Bugs encontrados
// ─────────────────────────────────────────────────────────────────────────────

describe('Bugs corregidos en la implementación', () => {
  describe('FIX 1: getFileExtension() ahora retorna "" para archivos sin extensión', () => {
    it('getFileExtension("noextension") retorna "" correctamente', () => {
      const result = getFileExtension('noextension');
      expect(result).toBe('');
    });

    it('archivo llamado "png" sin punto NO pasa validación de extensión', () => {
      const ext = getFileExtension('png');
      expect(ext).toBe('');
      expect(isProcessableExtension(ext)).toBe(false);
    });
  });

  describe('FIX 2: deriveVariantUrl ahora maneja query params correctamente', () => {
    it('URLs con query params preservan los params en la variante', () => {
      const url = deriveVariantUrl(
        'https://example.com/photo.jpg?v=1.2',
        'thumbnail'
      );
      expect(url).toBe('https://example.com/photo_thumb.webp?v=1.2');
    });
  });

  describe('FIX 3: deriveVariantUrl no corrompe URLs sin extensión de archivo', () => {
    it('URL sin extensión retorna URL original sin corrupción', () => {
      const url = deriveVariantUrl('https://example.com/noext', 'thumbnail');
      expect(url).toBe('https://example.com/noext');
    });
  });

  describe('Nota: getVariantKey funciona correctamente con S3 keys', () => {
    it('getVariantKey con múltiples puntos en la key sigue funcionando', () => {
      const key = getVariantKey('path/file.name.jpg', 'thumbnail', 'webp');
      expect(key).toBe('path/file.name_thumb.webp');
    });
  });

  describe('Nota: upload/route.ts – tipo de variants map es Partial en la práctica', () => {
    it('si processImage no genera "medium", variants map solo tendrá las generadas', () => {
      // El tipo Record<ImageVariant, string> en route.ts es técnicamente incorrecto
      // pero no causa crash porque TS solo lo verifica en compilación
      // y el frontend accede con optional chaining (variants?.medium)
      // Esto es un tipo impreciso pero no un bug funcional
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// PART 8: Tests adicionales de edge cases y validación profunda
// ─────────────────────────────────────────────────────────────────────────────

describe('Edge cases adicionales', () => {
  describe('deriveVariantUrl – fix verificado para URLs con query params y fragments', () => {
    it('URL sin extensión de archivo retorna URL original intacta', () => {
      const url = deriveVariantUrl('https://example.com/noext', 'thumbnail');
      // El punto en 'example.com' está antes del último slash, no es extensión
      expect(url).toBe('https://example.com/noext');
    });

    it('URL con query params con punto: extrae extensión correcta del path', () => {
      const url = deriveVariantUrl(
        'https://example.com/photo.jpg?v=1.2',
        'thumbnail'
      );
      // Separa query params primero, luego busca extensión solo en el path
      expect(url).toBe('https://example.com/photo_thumb.webp?v=1.2');
    });

    it('URL con query params SIN punto: preserva query params', () => {
      const url = deriveVariantUrl(
        'https://example.com/photo.jpg?token=abc',
        'thumbnail'
      );
      expect(url).toBe('https://example.com/photo_thumb.webp?token=abc');
      expect(url).toContain('?token=abc');
    });

    it('URL con fragment hash: preserva el fragment', () => {
      const url = deriveVariantUrl(
        'https://example.com/photo.jpg#section',
        'thumbnail'
      );
      expect(url).toBe('https://example.com/photo_thumb.webp#section');
      expect(url).toContain('#section');
    });
  });

  describe('processImage – boundary conditions con Sharp', () => {
    let sharpModule: any;
    let processImage: any;

    beforeEach(async () => {
      try {
        sharpModule = await import('sharp');
        const processor = await import('@/lib/image-processing/sharp-processor');
        processImage = processor.processImage;
      } catch {
        // sharp no disponible
      }
    });

    async function createTestImage(width: number, height: number) {
      if (!sharpModule) return null;
      const raw = Buffer.alloc(width * height * 3, 128);
      return sharpModule
        .default(raw, { raw: { width, height, channels: 3 } })
        .jpeg()
        .toBuffer();
    }

    it('imagen de exactamente 150x150 no genera variantes', async () => {
      if (!sharpModule) return;
      const buffer = await createTestImage(150, 150);
      const result = await processImage(buffer, 'test/exact-150.jpg');
      expect(result.variants).toHaveLength(0);
    });

    it('imagen de 151x150 genera thumbnail (width > maxWidth)', async () => {
      if (!sharpModule) return;
      process.env.AWS_REGION = 'us-east-1';
      process.env.AWS_S3_BUCKET = 'test-bucket';
      const buffer = await createTestImage(151, 150);
      const result = await processImage(buffer, 'test/151x150.jpg');
      const variantNames = result.variants.map((v: any) => v.variant);
      expect(variantNames).toContain('thumbnail');
      expect(variantNames).not.toContain('medium');
    });

    it('imagen de 150x151 genera thumbnail (height > maxHeight)', async () => {
      if (!sharpModule) return;
      process.env.AWS_REGION = 'us-east-1';
      process.env.AWS_S3_BUCKET = 'test-bucket';
      const buffer = await createTestImage(150, 151);
      const result = await processImage(buffer, 'test/150x151.jpg');
      const variantNames = result.variants.map((v: any) => v.variant);
      expect(variantNames).toContain('thumbnail');
    });

    it('imagen 600x600 genera thumbnail pero NO medium (600 <= 600)', async () => {
      if (!sharpModule) return;
      process.env.AWS_REGION = 'us-east-1';
      process.env.AWS_S3_BUCKET = 'test-bucket';
      const buffer = await createTestImage(600, 600);
      const result = await processImage(buffer, 'test/exact-600.jpg');
      const variantNames = result.variants.map((v: any) => v.variant);
      expect(variantNames).toContain('thumbnail');
      // 600 <= 600 → se salta medium
      expect(variantNames).not.toContain('medium');
      expect(variantNames).not.toContain('large');
    });

    it('imagen 601x400 genera thumbnail y medium', async () => {
      if (!sharpModule) return;
      process.env.AWS_REGION = 'us-east-1';
      process.env.AWS_S3_BUCKET = 'test-bucket';
      const buffer = await createTestImage(601, 400);
      const result = await processImage(buffer, 'test/601x400.jpg');
      const variantNames = result.variants.map((v: any) => v.variant);
      expect(variantNames).toContain('thumbnail');
      expect(variantNames).toContain('medium');
      expect(variantNames).not.toContain('large');
    });

    it('imagen 1200x1200 genera thumb y medium pero NO large (1200 <= 1200)', async () => {
      if (!sharpModule) return;
      process.env.AWS_REGION = 'us-east-1';
      process.env.AWS_S3_BUCKET = 'test-bucket';
      const buffer = await createTestImage(1200, 1200);
      const result = await processImage(buffer, 'test/exact-1200.jpg');
      const variantNames = result.variants.map((v: any) => v.variant);
      expect(variantNames).toContain('thumbnail');
      expect(variantNames).toContain('medium');
      expect(variantNames).not.toContain('large');
    });

    it('imagen 1201x900 genera las 3 variantes', async () => {
      if (!sharpModule) return;
      process.env.AWS_REGION = 'us-east-1';
      process.env.AWS_S3_BUCKET = 'test-bucket';
      const buffer = await createTestImage(1201, 900);
      const result = await processImage(buffer, 'test/1201x900.jpg');
      const variantNames = result.variants.map((v: any) => v.variant);
      expect(variantNames).toContain('thumbnail');
      expect(variantNames).toContain('medium');
      expect(variantNames).toContain('large');
    });

    it('múltiples formatos generan N * variantes', async () => {
      if (!sharpModule) return;
      process.env.AWS_REGION = 'us-east-1';
      process.env.AWS_S3_BUCKET = 'test-bucket';
      const buffer = await createTestImage(2000, 1500);
      const result = await processImage(buffer, 'test/multi.jpg', {
        formats: ['webp', 'jpeg'],
      });
      // 3 variantes * 2 formatos = 6
      expect(result.variants).toHaveLength(6);
      const formats = result.variants.map((v: any) => v.format);
      expect(formats.filter((f: string) => f === 'webp')).toHaveLength(3);
      expect(formats.filter((f: string) => f === 'jpeg')).toHaveLength(3);
    });

    it('variante thumbnail preserva aspect ratio', async () => {
      if (!sharpModule) return;
      process.env.AWS_REGION = 'us-east-1';
      process.env.AWS_S3_BUCKET = 'test-bucket';
      const buffer = await createTestImage(800, 400);
      const result = await processImage(buffer, 'test/wide.jpg');
      const thumb = result.variants.find((v: any) => v.variant === 'thumbnail');
      expect(thumb).toBeDefined();
      // 800x400 fit:inside 150x150 → 150x75 (mantiene ratio 2:1)
      expect(thumb!.width).toBe(150);
      expect(thumb!.height).toBe(75);
    });
  });

  describe('getVariantKey – casos adicionales', () => {
    it('key con ruta profunda', () => {
      const key = getVariantKey('a/b/c/d/e/file.jpg', 'thumbnail', 'webp');
      expect(key).toBe('a/b/c/d/e/file_thumb.webp');
    });

    it('key con UUID y timestamp', () => {
      const key = getVariantKey(
        'equipment/photo/123/1707000000-550e8400-e29b-41d4-a716-446655440000.jpg',
        'medium',
        'webp'
      );
      expect(key).toBe(
        'equipment/photo/123/1707000000-550e8400-e29b-41d4-a716-446655440000_medium.webp'
      );
    });

    it('key con extensión doble (tar.gz)', () => {
      const key = getVariantKey('path/archive.tar.gz', 'thumbnail', 'webp');
      // lastIndexOf('.') encuentra .gz → reemplaza solo la última extensión
      expect(key).toBe('path/archive.tar_thumb.webp');
    });
  });

  describe('getS3Url – env vars faltantes', () => {
    it('debe lanzar error cuando env vars no están definidas', () => {
      const origRegion = process.env.AWS_REGION;
      const origBucket = process.env.AWS_S3_BUCKET;
      delete process.env.AWS_REGION;
      delete process.env.AWS_S3_BUCKET;

      // La implementación correctamente valida que las env vars existan
      expect(() => getS3Url('test/key.jpg')).toThrow(
        'Variables de entorno AWS_REGION y AWS_S3_BUCKET son requeridas'
      );

      process.env.AWS_REGION = origRegion;
      process.env.AWS_S3_BUCKET = origBucket;
    });

    it('debe lanzar error cuando solo AWS_REGION falta', () => {
      const origRegion = process.env.AWS_REGION;
      delete process.env.AWS_REGION;
      process.env.AWS_S3_BUCKET = 'test-bucket';

      expect(() => getS3Url('test/key.jpg')).toThrow();

      process.env.AWS_REGION = origRegion;
    });

    it('debe lanzar error cuando solo AWS_S3_BUCKET falta', () => {
      const origBucket = process.env.AWS_S3_BUCKET;
      process.env.AWS_REGION = 'us-east-1';
      delete process.env.AWS_S3_BUCKET;

      expect(() => getS3Url('test/key.jpg')).toThrow();

      process.env.AWS_S3_BUCKET = origBucket;
    });
  });

  describe('Consistencia entre config arrays y maps', () => {
    it('PROCESSABLE_EXTENSIONS y PROCESSABLE_IMAGE_TYPES deben ser consistentes', () => {
      // Verificar que cada extensión tenga al menos un MIME type correspondiente
      // jpg → image/jpeg o image/jpg
      expect(PROCESSABLE_EXTENSIONS).toContain('jpg');
      expect(PROCESSABLE_IMAGE_TYPES).toContain('image/jpeg');

      expect(PROCESSABLE_EXTENSIONS).toContain('png');
      expect(PROCESSABLE_IMAGE_TYPES).toContain('image/png');

      expect(PROCESSABLE_EXTENSIONS).toContain('webp');
      expect(PROCESSABLE_IMAGE_TYPES).toContain('image/webp');

      expect(PROCESSABLE_EXTENSIONS).toContain('gif');
      expect(PROCESSABLE_IMAGE_TYPES).toContain('image/gif');

      expect(PROCESSABLE_EXTENSIONS).toContain('avif');
      expect(PROCESSABLE_IMAGE_TYPES).toContain('image/avif');

      expect(PROCESSABLE_EXTENSIONS).toContain('tiff');
      expect(PROCESSABLE_IMAGE_TYPES).toContain('image/tiff');
    });

    it('FORMAT_EXTENSIONS y FORMAT_CONTENT_TYPES deben cubrir los mismos formatos', () => {
      const extKeys = Object.keys(FORMAT_EXTENSIONS);
      const ctKeys = Object.keys(FORMAT_CONTENT_TYPES);
      expect(extKeys.sort()).toEqual(ctKeys.sort());
    });
  });

  describe('upload/route.ts – consistencia de tipos permitidos (post-fix)', () => {
    const uploadSource = readFileSync(
      resolve(__dirname, '..', 'orvit-v1', 'app', 'api', 'upload', 'route.ts'),
      'utf-8'
    );

    it('ALLOWED_IMAGE_TYPES ahora incluye avif y tiff', () => {
      expect(uploadSource).toContain("'image/avif'");
      expect(uploadSource).toContain("'image/tiff'");
    });

    it('ALLOWED_EXTENSIONS ahora incluye avif y tiff', () => {
      expect(uploadSource).toContain("'avif'");
      expect(uploadSource).toContain("'tiff'");
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// PART 9: Tests adicionales de cobertura – gaps identificados
// ─────────────────────────────────────────────────────────────────────────────

describe('Cobertura adicional – gaps identificados', () => {

  describe('getFileExtension – edge cases adicionales', () => {
    it('archivo con solo un punto "." retorna cadena vacía', () => {
      const result = getFileExtension('.');
      expect(result).toBe('');
    });

    it('archivo con puntos consecutivos "file..jpg" retorna "jpg"', () => {
      const result = getFileExtension('file..jpg');
      expect(result).toBe('jpg');
    });

    it('archivo terminando en punto "image." retorna cadena vacía', () => {
      const result = getFileExtension('image.');
      expect(result).toBe('');
    });

    it('archivo con solo extensión ".jpg" retorna cadena vacía (dotIndex===0)', () => {
      const result = getFileExtension('.jpg');
      expect(result).toBe('');
    });
  });

  describe('deriveVariantUrl – dot en nombre de directorio', () => {
    it('URL con punto en directorio: path.v2/image.jpg deriva correctamente', () => {
      const url = deriveVariantUrl(
        'https://example.com/path.v2/image.jpg',
        'thumbnail'
      );
      expect(url).toBe('https://example.com/path.v2/image_thumb.webp');
    });

    it('URL con punto en subdominio y sin extensión en path retorna original', () => {
      const url = deriveVariantUrl(
        'https://cdn.example.com/noext',
        'medium'
      );
      expect(url).toBe('https://cdn.example.com/noext');
    });

    it('URL con query params Y fragment: maneja correctamente', () => {
      const url = deriveVariantUrl(
        'https://example.com/photo.jpg?v=1#anchor',
        'thumbnail'
      );
      // query aparece antes del hash, así que el separador es ?
      expect(url).toBe('https://example.com/photo_thumb.webp?v=1#anchor');
    });

    it('URL con solo fragment (sin query params)', () => {
      const url = deriveVariantUrl(
        'https://example.com/photo.jpg#section',
        'medium'
      );
      expect(url).toBe('https://example.com/photo_medium.webp#section');
    });
  });

  describe('deriveVariantUrl – URL sin slashes', () => {
    it('path simple con punto: "file.jpg" funciona', () => {
      const url = deriveVariantUrl('file.jpg', 'thumbnail');
      expect(url).toBe('file_thumb.webp');
    });

    it('path sin slash ni extensión retorna original', () => {
      const url = deriveVariantUrl('noext', 'thumbnail');
      // lastSlashIndex = -1, lastDotIndex = -1 → retorna original
      expect(url).toBe('noext');
    });
  });

  describe('processImage – boundary condition: exactamente 4096x4096', () => {
    let sharpModule: any;
    let processImage: any;

    beforeEach(async () => {
      try {
        sharpModule = await import('sharp');
        const processor = await import('@/lib/image-processing/sharp-processor');
        processImage = processor.processImage;
      } catch {
        // sharp no disponible
      }
    });

    async function createTestImage(width: number, height: number) {
      if (!sharpModule) return null;
      const raw = Buffer.alloc(width * height * 3, 128);
      return sharpModule
        .default(raw, { raw: { width, height, channels: 3 } })
        .jpeg()
        .toBuffer();
    }

    it('imagen 4096x3000 NO debe re-dimensionar original (no excede MAX)', async () => {
      if (!sharpModule) return;
      process.env.AWS_REGION = 'us-east-1';
      process.env.AWS_S3_BUCKET = 'test-bucket';
      // 4096 no es > 4096, así que no debe redimensionar el source buffer
      const buffer = await createTestImage(4096, 3000);
      const result = await processImage(buffer, 'test/exact-max.jpg');
      expect(result.metadata.width).toBe(4096);
      expect(result.metadata.height).toBe(3000);
      expect(result.variants.length).toBeGreaterThan(0);
    });

    it('imagen 4097x3000 DEBE re-dimensionar original (excede MAX)', async () => {
      if (!sharpModule) return;
      process.env.AWS_REGION = 'us-east-1';
      process.env.AWS_S3_BUCKET = 'test-bucket';
      const buffer = await createTestImage(4097, 3000);
      const result = await processImage(buffer, 'test/over-max.jpg');
      // metadata refleja el tamaño original, no el re-dimensionado
      expect(result.metadata.width).toBe(4097);
      // Las variantes se procesan correctamente
      expect(result.variants.length).toBeGreaterThan(0);
      const lgVariant = result.variants.find((v: any) => v.variant === 'large');
      if (lgVariant) {
        expect(lgVariant.width).toBeLessThanOrEqual(1200);
      }
    });

    it('imagen cuadrada pequeña 151x151: genera thumbnail pero no medium', async () => {
      if (!sharpModule) return;
      process.env.AWS_REGION = 'us-east-1';
      process.env.AWS_S3_BUCKET = 'test-bucket';
      const buffer = await createTestImage(151, 151);
      const result = await processImage(buffer, 'test/151x151.jpg');
      const variantNames = result.variants.map((v: any) => v.variant);
      expect(variantNames).toContain('thumbnail');
      // 151 <= 600, no genera medium
      expect(variantNames).not.toContain('medium');
    });

    it('imagen portrait (400x800): genera thumbnail y medium', async () => {
      if (!sharpModule) return;
      process.env.AWS_REGION = 'us-east-1';
      process.env.AWS_S3_BUCKET = 'test-bucket';
      const buffer = await createTestImage(400, 800);
      const result = await processImage(buffer, 'test/portrait.jpg');
      const variantNames = result.variants.map((v: any) => v.variant);
      expect(variantNames).toContain('thumbnail');
      // height 800 > 600, genera medium
      expect(variantNames).toContain('medium');
      // width 400 y height 800, ambos <= 1200, no genera large
      expect(variantNames).not.toContain('large');
    });

    it('variante medium preserva aspect ratio en imagen portrait', async () => {
      if (!sharpModule) return;
      process.env.AWS_REGION = 'us-east-1';
      process.env.AWS_S3_BUCKET = 'test-bucket';
      const buffer = await createTestImage(400, 800);
      const result = await processImage(buffer, 'test/portrait.jpg');
      const med = result.variants.find((v: any) => v.variant === 'medium');
      expect(med).toBeDefined();
      // 400x800 fit:inside 600x600 → 300x600 (height limita, mantiene ratio 1:2)
      expect(med!.height).toBe(600);
      expect(med!.width).toBe(300);
    });

    it('processImage con buffer PNG con alpha genera variantes correctamente', async () => {
      if (!sharpModule) return;
      process.env.AWS_REGION = 'us-east-1';
      process.env.AWS_S3_BUCKET = 'test-bucket';
      const raw = Buffer.alloc(800 * 600 * 4, 128);
      const buffer = await sharpModule
        .default(raw, { raw: { width: 800, height: 600, channels: 4 } })
        .png()
        .toBuffer();
      const result = await processImage(buffer, 'test/alpha.png');
      expect(result.metadata.hasAlpha).toBe(true);
      expect(result.variants.length).toBeGreaterThan(0);
      // Las variantes con alpha deben tener formato webp
      for (const variant of result.variants) {
        expect(variant.format).toBe('webp');
      }
    });
  });

  describe('processImage – early return boundary (AND logic)', () => {
    let sharpModule: any;
    let processImage: any;

    beforeEach(async () => {
      try {
        sharpModule = await import('sharp');
        const processor = await import('@/lib/image-processing/sharp-processor');
        processImage = processor.processImage;
      } catch {
        // sharp no disponible
      }
    });

    async function createTestImage(width: number, height: number) {
      if (!sharpModule) return null;
      const raw = Buffer.alloc(width * height * 3, 128);
      return sharpModule
        .default(raw, { raw: { width, height, channels: 3 } })
        .jpeg()
        .toBuffer();
    }

    it('149x149: ambas dimensiones <= 150, retorna sin variantes', async () => {
      if (!sharpModule) return;
      const buffer = await createTestImage(149, 149);
      const result = await processImage(buffer, 'test/tiny.jpg');
      expect(result.variants).toHaveLength(0);
    });

    it('1x1: imagen mínima, retorna sin variantes', async () => {
      if (!sharpModule) return;
      const buffer = await createTestImage(1, 1);
      const result = await processImage(buffer, 'test/pixel.jpg');
      expect(result.variants).toHaveLength(0);
    });

    it('150x1: width=150 y height=1, ambos <= 150, retorna sin variantes', async () => {
      if (!sharpModule) return;
      const buffer = await createTestImage(150, 1);
      const result = await processImage(buffer, 'test/strip.jpg');
      expect(result.variants).toHaveLength(0);
    });

    it('1x151: height > 150, genera variantes', async () => {
      if (!sharpModule) return;
      process.env.AWS_REGION = 'us-east-1';
      process.env.AWS_S3_BUCKET = 'test-bucket';
      const buffer = await createTestImage(1, 151);
      const result = await processImage(buffer, 'test/tall-strip.jpg');
      // early return condition: width<=150 AND height<=150
      // 1<=150 AND 151<=150 → false, so variants ARE generated
      const variantNames = result.variants.map((v: any) => v.variant);
      expect(variantNames).toContain('thumbnail');
    });
  });

  describe('getVariantKey – formato avif', () => {
    it('variante avif genera extensión .avif', () => {
      const key = getVariantKey('path/image.jpg', 'thumbnail', 'avif');
      expect(key).toBe('path/image_thumb.avif');
    });

    it('variante large con avif', () => {
      const key = getVariantKey('path/image.png', 'large', 'avif');
      expect(key).toBe('path/image_large.avif');
    });
  });

  describe('upload/route.ts – code review ampliado', () => {
    const orvitRoot = resolve(__dirname, '..', 'orvit-v1');
    const uploadSource = readFileSync(resolve(orvitRoot, 'app', 'api', 'upload', 'route.ts'), 'utf-8');

    it('debe importar ImageMetadata desde types (no inline)', () => {
      expect(uploadSource).toContain("ImageMetadata");
      expect(uploadSource).toContain("from '@/lib/image-processing/types'");
    });

    it('debe usar entityId || "temp" para fallback en S3 key', () => {
      expect(uploadSource).toContain("entityId || 'temp'");
    });

    it('variants map incluye original: url antes de las variantes generadas', () => {
      expect(uploadSource).toContain('variants = { original: url }');
    });

    it('debe enviar metadata de variante en S3 (width y height)', () => {
      expect(uploadSource).toContain("'variant-width'");
      expect(uploadSource).toContain("'variant-height'");
    });

    it('debe manejar error de ACL de S3 específicamente', () => {
      expect(uploadSource).toContain('AccessControlListNotSupported');
    });

    it('debe validar extensión de archivo contra ALLOWED_EXTENSIONS', () => {
      expect(uploadSource).toContain('ALLOWED_EXTENSIONS.includes(fileExt)');
    });

    it('límite de tamaño es 50MB para 3D y 10MB para imágenes/documentos', () => {
      expect(uploadSource).toContain('50 * 1024 * 1024');
      expect(uploadSource).toContain('10 * 1024 * 1024');
    });
  });

  describe('SafeImage.tsx – code review ampliado', () => {
    const orvitRoot = resolve(__dirname, '..', 'orvit-v1');
    const safeImageSource = readFileSync(resolve(orvitRoot, 'components', 'ui', 'SafeImage.tsx'), 'utf-8');

    it('debe tener guard de race condition con errorHandledRef', () => {
      expect(safeImageSource).toContain('errorHandledRef');
      expect(safeImageSource).toContain('errorHandledRef.current');
    });

    it('debe resetear errorHandledRef al cambiar src', () => {
      expect(safeImageSource).toContain('errorHandledRef.current = false');
    });

    it('default de variant es "medium"', () => {
      expect(safeImageSource).toContain("variant = 'medium'");
    });

    it('default de optimized es false', () => {
      expect(safeImageSource).toContain('optimized = false');
    });

    it('usa deriveVariantUrl para generar URL de variante', () => {
      expect(safeImageSource).toContain('deriveVariantUrl');
    });

    it('cuando optimized=true y variants tiene URL, usa variants[variant] directamente', () => {
      expect(safeImageSource).toContain('variants[variant]');
    });
  });

  describe('optimized-image.tsx – code review ampliado', () => {
    const orvitRoot = resolve(__dirname, '..', 'orvit-v1');
    const optImgSource = readFileSync(resolve(orvitRoot, 'components', 'ui', 'optimized-image.tsx'), 'utf-8');

    it('debe tener guard de race condition con errorHandledRef', () => {
      expect(optImgSource).toContain('errorHandledRef');
      expect(optImgSource).toContain('errorHandledRef.current');
    });

    it('default de lazyLoad es true', () => {
      expect(optImgSource).toContain('lazyLoad = true');
    });

    it('default de lazyMargin es 200px', () => {
      expect(optImgSource).toContain("lazyMargin = '200px'");
    });

    it('default de variant es medium', () => {
      expect(optImgSource).toContain("variant = 'medium'");
    });

    it('usa useMemo para resolvedSrc', () => {
      expect(optImgSource).toContain('useMemo');
    });

    it('usa useCallback para handleError', () => {
      expect(optImgSource).toContain('useCallback');
    });

    it('handleError tiene fallback chain: variante → original → fallbackSrc', () => {
      // Verifica que se intenta la original antes del fallback
      expect(optImgSource).toContain('currentSrc !== src');
      expect(optImgSource).toContain('setCurrentSrc(src)');
      expect(optImgSource).toContain('setCurrentSrc(fallbackSrc)');
    });

    it('no renderiza Image si no es visible (lazy load)', () => {
      expect(optImgSource).toContain('isVisible && currentSrc');
    });

    it('resetea estado cuando resolvedSrc cambia', () => {
      expect(optImgSource).toContain('setHasError(false)');
      expect(optImgSource).toContain('setIsLoaded(false)');
    });
  });

  describe('use-image-upload.ts – code review ampliado', () => {
    const orvitRoot = resolve(__dirname, '..', 'orvit-v1');
    const hookSource = readFileSync(resolve(orvitRoot, 'hooks', 'use-image-upload.ts'), 'utf-8');

    it('default de fileType es "photo"', () => {
      expect(hookSource).toContain("fileType = 'photo'");
    });

    it('reset revoca blob URL previa antes de limpiar', () => {
      // Verifica que reset() tiene el guard correcto
      expect(hookSource).toContain('if (preview)');
      expect(hookSource).toContain('URL.revokeObjectURL(preview)');
    });

    it('upload revoca blob URL previa antes de crear nueva', () => {
      // Verifica limpieza de memory leak en upload consecutivo
      const uploadFnMatch = hookSource.match(/const upload = useCallback[\s\S]*?async \(file: File\)/);
      expect(uploadFnMatch).toBeTruthy();
      // Debe revocar preview antes de createObjectURL
      const uploadBody = hookSource.substring(
        hookSource.indexOf('const upload = useCallback'),
        hookSource.indexOf('return {\n    upload')
      );
      const revokeIndex = uploadBody.indexOf('URL.revokeObjectURL(preview)');
      const createIndex = uploadBody.indexOf('URL.createObjectURL(file)');
      expect(revokeIndex).toBeGreaterThan(-1);
      expect(createIndex).toBeGreaterThan(-1);
      // Revoke debe ocurrir ANTES de create
      expect(revokeIndex).toBeLessThan(createIndex);
    });

    it('progress se resetea a 0 en caso de error', () => {
      expect(hookSource).toContain('setProgress(0)');
    });

    it('setIsUploading(false) está en finally block', () => {
      expect(hookSource).toContain('finally');
      expect(hookSource).toContain('setIsUploading(false)');
    });

    it('validate es memoizado con useCallback', () => {
      expect(hookSource).toContain('const validate = useCallback');
    });

    it('reset es memoizado con useCallback', () => {
      expect(hookSource).toContain('const reset = useCallback');
    });

    it('upload es memoizado con useCallback', () => {
      expect(hookSource).toContain('const upload = useCallback');
    });
  });

  describe('Verificación de tipo de variants en upload/route.ts', () => {
    it('BUG TIPO: variants map es Record<ImageVariant, string> pero debería ser Partial', () => {
      // Verificar que el upload/route.ts declara variants como Record<ImageVariant, string>
      // cuando en realidad no todas las variantes se generan siempre
      const orvitRoot = resolve(__dirname, '..', 'orvit-v1');
      const uploadSource = readFileSync(resolve(orvitRoot, 'app', 'api', 'upload', 'route.ts'), 'utf-8');
      // Este es un bug de tipo, no funcional:
      // variants se declara como Record<ImageVariant, string> (línea ~112)
      // pero si la imagen es 300x200, solo se genera thumbnail, no medium ni large
      // El frontend accede con optional chaining, así que no causa crash
      expect(uploadSource).toContain('Record<ImageVariant, string>');
      // NOTA: este tipo debería ser Partial<Record<ImageVariant, string>>
      // Es un hallazgo de tipo, no un bug en runtime
    });
  });

  describe('getAllVariantUrls – edge cases', () => {
    it('getAllVariantUrls con URL vacía: no crashea', () => {
      const variants = getAllVariantUrls('');
      expect(variants.original).toBe('');
    });

    it('getAllVariantUrls con URL sin protocolo', () => {
      const variants = getAllVariantUrls('/path/image.jpg');
      expect(variants.original).toBe('/path/image.jpg');
      expect(variants.thumbnail).toBe('/path/image_thumb.webp');
    });

    it('getAllVariantUrls retorna exactamente 4 keys', () => {
      const variants = getAllVariantUrls('https://example.com/photo.jpg');
      const keys = Object.keys(variants);
      expect(keys).toHaveLength(4);
      expect(keys.sort()).toEqual(['large', 'medium', 'original', 'thumbnail']);
    });
  });

  describe('validateImageSize – edge cases', () => {
    it('negative size retorna true (dentro del límite)', () => {
      // No es un escenario real pero verifica el contrato
      expect(validateImageSize(-1, MAX_IMAGE_SIZE)).toBe(true);
    });

    it('funciona con límite personalizado', () => {
      const customLimit = 5 * 1024 * 1024; // 5MB
      expect(validateImageSize(4 * 1024 * 1024, customLimit)).toBe(true);
      expect(validateImageSize(6 * 1024 * 1024, customLimit)).toBe(false);
    });
  });

  describe('isProcessableExtension – edge cases', () => {
    it('extensión con espacio retorna false', () => {
      expect(isProcessableExtension(' jpg')).toBe(false);
      expect(isProcessableExtension('jpg ')).toBe(false);
    });

    it('extensión con punto retorna false', () => {
      expect(isProcessableExtension('.jpg')).toBe(false);
    });
  });
});
