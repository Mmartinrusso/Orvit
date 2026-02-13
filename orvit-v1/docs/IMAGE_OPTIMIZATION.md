# Pipeline de Optimización de Imágenes

## Arquitectura

```
Upload (cliente) → API /api/upload → Sharp Processing → S3 (original + variantes)
                                          ↓
                                  thumbnail (150px) .webp
                                  medium (600px)    .webp
                                  large (1200px)    .webp
```

### Flujo de procesamiento

1. El cliente sube una imagen via `POST /api/upload`
2. La imagen original se sube a S3 con su formato original
3. Si es una imagen procesable (JPG, PNG, WebP, GIF), Sharp genera 3 variantes:
   - **thumbnail** (150x150px, calidad 70%) - Para listas, avatares, grillas
   - **medium** (600x600px, calidad 80%) - Para cards, previews
   - **large** (1200x1200px, calidad 85%) - Para vistas de detalle
4. Todas las variantes se guardan como WebP en S3
5. La response incluye las URLs de todas las variantes

### Convención de nombres

Las variantes se guardan junto a la imagen original con sufijos:

```
equipment/photo/123/1707000000-uuid.jpg        ← original
equipment/photo/123/1707000000-uuid_thumb.webp  ← thumbnail
equipment/photo/123/1707000000-uuid_medium.webp ← medium
equipment/photo/123/1707000000-uuid_large.webp  ← large
```

---

## Componentes

### OptimizedImage

Componente completo con lazy loading, selección de variante y fallback automático.

```tsx
import { OptimizedImage } from '@/components/ui/optimized-image';

// Uso básico - carga variante medium con lazy loading
<OptimizedImage
  src="https://bucket.s3.region.amazonaws.com/equipment/photo/123/img.jpg"
  alt="Foto del equipo"
  width={400}
  height={300}
/>

// Con variante específica
<OptimizedImage
  src={imageUrl}
  alt="Thumbnail"
  variant="thumbnail"
  width={150}
  height={150}
/>

// Sin lazy loading (above the fold)
<OptimizedImage
  src={imageUrl}
  alt="Hero image"
  variant="large"
  lazyLoad={false}
  width={1200}
  height={800}
/>

// Con URLs de variantes explícitas (del upload response)
<OptimizedImage
  src={imageUrl}
  alt="Foto"
  variant="medium"
  variants={uploadResult.variants}
  width={400}
  height={300}
/>
```

### SafeImage (mejorado)

El componente existente ahora soporta variantes con `optimized={true}`:

```tsx
import { SafeImage } from '@/components/ui/SafeImage';

// Sin cambios - comportamiento original
<SafeImage src={url} alt="foto" width={100} height={100} />

// Con optimización activada
<SafeImage
  src={url}
  alt="foto"
  width={400}
  height={300}
  optimized
  variant="medium"
/>
```

---

## Hook: useImageUpload

```tsx
import { useImageUpload } from '@/hooks/use-image-upload';

function MyUploadComponent() {
  const {
    upload,
    isUploading,
    progress,
    preview,
    result,
    error,
    reset,
    validate,
  } = useImageUpload({
    entityType: 'equipment',
    entityId: '123',
    fileType: 'photo',
    onSuccess: (result) => {
      console.log('URL:', result.url);
      console.log('Variantes:', result.variants);
      console.log('Metadata:', result.imageMetadata);
    },
  });

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await upload(file);
  };

  return (
    <div>
      <input type="file" accept="image/*" onChange={handleFileChange} />
      {preview && <img src={preview} alt="Preview" />}
      {isUploading && <progress value={progress} max={100} />}
      {error && <p className="text-red-500">{error}</p>}
    </div>
  );
}
```

---

## Configuración

La configuración se encuentra en `lib/image-processing/config.ts`:

| Parámetro | Valor | Descripción |
|-----------|-------|-------------|
| Thumbnail | 150x150px, Q70 | Para listas y avatares |
| Medium | 600x600px, Q80 | Para cards y previews |
| Large | 1200x1200px, Q85 | Para vistas detalle |
| Formato salida | WebP | Mejor compresión que JPEG |
| Max upload | 10MB | Validación cliente + servidor |
| Max dimensión | 4096px | Resize automático si excede |

---

## Migración gradual

Los componentes existentes siguen funcionando sin cambios. Para migrar:

1. **SafeImage simple** → agregar `optimized` prop:
   ```tsx
   // Antes
   <SafeImage src={url} alt="foto" width={100} height={100} />

   // Después
   <SafeImage src={url} alt="foto" width={100} height={100} optimized variant="thumbnail" />
   ```

2. **Componentes con Next/Image** → reemplazar con OptimizedImage:
   ```tsx
   // Antes
   <Image src={url} alt="foto" width={400} height={300} />

   // Después
   <OptimizedImage src={url} alt="foto" width={400} height={300} variant="medium" />
   ```

---

## Consideraciones

- **Retrocompatibilidad total**: Las imágenes existentes sin variantes siguen funcionando. Los componentes hacen fallback automático a la imagen original si la variante no existe.
- **Procesamiento síncrono**: Las variantes se generan durante el upload (~300ms extra). No se usa procesamiento asíncrono/background.
- **Sin tabla de metadata**: Las URLs de variantes se derivan deterministicamente del nombre original, no se almacenan en BD.
- **Sharp en servidor**: Sharp solo se usa en el API route (servidor). Los componentes frontend usan derivación de URLs.

---

## Troubleshooting

### Sharp no se instala correctamente
Sharp requiere dependencias nativas. En Windows:
```bash
npm install sharp
```
Si falla, intentar:
```bash
npm install --platform=win32 sharp
```

### Las variantes WebP no se generan
Verificar que el archivo subido es una imagen procesable (JPG, PNG, WebP, GIF). Documentos, PDFs y modelos 3D no se procesan.

### El componente muestra la imagen original en lugar de la variante
El fallback es intencional: si la variante WebP no existe (imagen subida antes de implementar el pipeline), se usa la imagen original automáticamente.
