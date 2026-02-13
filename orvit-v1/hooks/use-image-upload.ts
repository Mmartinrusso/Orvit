'use client';

import { useState, useCallback } from 'react';
import { toast } from 'sonner';
import { ImageVariant, UploadImageResponse } from '@/lib/image-processing/types';
import { MAX_IMAGE_SIZE, PROCESSABLE_EXTENSIONS } from '@/lib/image-processing/config';

interface UseImageUploadOptions {
  /** Tipo de entidad (ej: 'equipment', 'component') */
  entityType: string;
  /** ID de la entidad */
  entityId?: string;
  /** Tipo de archivo (ej: 'photo', 'avatar') */
  fileType?: string;
  /** Tamaño máximo en bytes (default: 10MB) */
  maxSize?: number;
  /** Extensiones permitidas (default: imágenes procesables) */
  allowedExtensions?: string[];
  /** Callback al completar upload exitoso */
  onSuccess?: (result: UploadImageResponse) => void;
  /** Callback al fallar el upload */
  onError?: (error: string) => void;
}

interface UseImageUploadReturn {
  /** Subir un archivo */
  upload: (file: File) => Promise<UploadImageResponse | null>;
  /** Estado de carga */
  isUploading: boolean;
  /** Progreso estimado (0-100) */
  progress: number;
  /** URL de preview local (blob URL) */
  preview: string | null;
  /** Resultado del último upload exitoso */
  result: UploadImageResponse | null;
  /** Error del último upload */
  error: string | null;
  /** Limpiar estado */
  reset: () => void;
  /** Validar un archivo antes de subirlo */
  validate: (file: File) => string | null;
}

/**
 * Hook para manejar upload de imágenes con preview, progreso y validación.
 * Integrado con el pipeline de optimización de imágenes.
 */
export function useImageUpload({
  entityType,
  entityId,
  fileType = 'photo',
  maxSize = MAX_IMAGE_SIZE,
  allowedExtensions = PROCESSABLE_EXTENSIONS,
  onSuccess,
  onError,
}: UseImageUploadOptions): UseImageUploadReturn {
  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [preview, setPreview] = useState<string | null>(null);
  const [result, setResult] = useState<UploadImageResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const validate = useCallback(
    (file: File): string | null => {
      // Validar tamaño
      if (file.size > maxSize) {
        const maxMB = Math.round(maxSize / (1024 * 1024));
        return `El archivo es demasiado grande. Máximo ${maxMB}MB`;
      }

      // Validar extensión
      const ext = file.name.split('.').pop()?.toLowerCase();
      if (!ext || !allowedExtensions.includes(ext)) {
        return `Formato no permitido. Formatos válidos: ${allowedExtensions.join(', ')}`;
      }

      return null;
    },
    [maxSize, allowedExtensions]
  );

  const reset = useCallback(() => {
    if (preview) {
      URL.revokeObjectURL(preview);
    }
    setIsUploading(false);
    setProgress(0);
    setPreview(null);
    setResult(null);
    setError(null);
  }, [preview]);

  const upload = useCallback(
    async (file: File): Promise<UploadImageResponse | null> => {
      // Validar antes de subir
      const validationError = validate(file);
      if (validationError) {
        setError(validationError);
        toast.error(validationError);
        onError?.(validationError);
        return null;
      }

      // Revocar preview anterior si existe (evitar memory leak de blob URLs)
      if (preview) {
        URL.revokeObjectURL(preview);
      }

      // Generar preview local
      const previewUrl = URL.createObjectURL(file);
      setPreview(previewUrl);

      setIsUploading(true);
      setProgress(10);
      setError(null);

      try {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('entityType', entityType);
        formData.append('entityId', entityId || 'temp');
        formData.append('fileType', fileType);

        setProgress(30);

        const response = await fetch('/api/upload', {
          method: 'POST',
          body: formData,
        });

        setProgress(80);

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Error al subir imagen');
        }

        const data: UploadImageResponse = await response.json();
        setProgress(100);
        setResult(data);

        toast.success('Imagen subida correctamente');
        onSuccess?.(data);

        return data;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Error desconocido al subir imagen';
        setError(message);
        setProgress(0);
        toast.error(message);
        onError?.(message);
        return null;
      } finally {
        setIsUploading(false);
      }
    },
    [entityType, entityId, fileType, validate, onSuccess, onError, preview]
  );

  return {
    upload,
    isUploading,
    progress,
    preview,
    result,
    error,
    reset,
    validate,
  };
}
