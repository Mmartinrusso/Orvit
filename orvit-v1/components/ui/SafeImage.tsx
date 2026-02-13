'use client';

import Image, { ImageProps } from 'next/image';
import { useState, useEffect, useRef } from 'react';
import { ImageVariant } from '@/lib/image-processing/types';
import { deriveVariantUrl } from '@/lib/image-processing/utils';

interface SafeImageProps extends Omit<ImageProps, 'onError'> {
  fallbackSrc?: string;
  /** Activar modo optimizado: usa variante WebP derivada de la URL original */
  optimized?: boolean;
  /** Variante a usar cuando optimized=true (default: 'medium') */
  variant?: ImageVariant;
  /** URLs de variantes explícitas (del upload response) */
  variants?: Partial<Record<ImageVariant, string>>;
}

/**
 * SafeImage - Componente de imagen con fallback para errores de S3
 *
 * Maneja gracefully los errores 403/404 de imágenes externas
 * mostrando un placeholder en su lugar.
 *
 * Con optimized=true, intenta cargar la variante WebP optimizada
 * y hace fallback a la imagen original si no existe.
 */
export function SafeImage({
  src,
  alt,
  fallbackSrc = '/logo-orvit.png',
  optimized = false,
  variant = 'medium',
  variants,
  ...props
}: SafeImageProps) {
  // Determinar la URL inicial según si está optimizada
  const getInitialSrc = () => {
    if (!optimized || !src || typeof src !== 'string') return src;
    if (variants && variants[variant]) return variants[variant]!;
    return deriveVariantUrl(src as string, variant);
  };

  const [imgSrc, setImgSrc] = useState(getInitialSrc());
  const [hasError, setHasError] = useState(false);
  const [triedOriginal, setTriedOriginal] = useState(false);
  const errorHandledRef = useRef(false);

  // Resetear estado cuando cambia la src
  useEffect(() => {
    setImgSrc(getInitialSrc());
    setHasError(false);
    setTriedOriginal(false);
    errorHandledRef.current = false;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src, variant, optimized]);

  const handleError = () => {
    // Usar ref para evitar race conditions con múltiples errores rápidos
    if (hasError || errorHandledRef.current) return;
    errorHandledRef.current = true;

    if (optimized && !triedOriginal && imgSrc !== src) {
      // La variante optimizada falló, intentar con la original
      errorHandledRef.current = false; // permitir un retry más con la original
      setTriedOriginal(true);
      setImgSrc(src);
    } else {
      // La imagen original también falló, usar fallback
      setHasError(true);
      setImgSrc(fallbackSrc);
    }
  };

  return (
    <Image
      {...props}
      src={imgSrc}
      alt={alt}
      onError={handleError}
    />
  );
}

export default SafeImage;
