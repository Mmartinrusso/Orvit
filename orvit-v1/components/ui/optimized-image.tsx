'use client';

import Image, { ImageProps } from 'next/image';
import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { ImageVariant } from '@/lib/image-processing/types';
import { deriveVariantUrl } from '@/lib/image-processing/utils';

interface OptimizedImageProps extends Omit<ImageProps, 'onError' | 'src'> {
  /** URL de la imagen original */
  src: string;
  /** Variante preferida según el contexto de uso */
  variant?: ImageVariant;
  /** URLs de variantes (si se tienen del upload response) */
  variants?: Partial<Record<ImageVariant, string>>;
  /** Imagen de fallback si falla la carga */
  fallbackSrc?: string;
  /** Habilitar lazy loading con Intersection Observer */
  lazyLoad?: boolean;
  /** Margen del viewport para pre-cargar (IntersectionObserver rootMargin) */
  lazyMargin?: string;
  /** Placeholder mientras carga */
  showPlaceholder?: boolean;
}

/**
 * Componente de imagen optimizada con:
 * - Selección automática de variante según viewport/contexto
 * - Lazy loading con Intersection Observer
 * - Fallback a imagen original si la variante falla
 * - Placeholder animado mientras carga
 */
export function OptimizedImage({
  src,
  variant = 'medium',
  variants,
  fallbackSrc = '/logo-orvit.png',
  lazyLoad = true,
  lazyMargin = '200px',
  showPlaceholder = true,
  alt,
  className,
  ...props
}: OptimizedImageProps) {
  const [isVisible, setIsVisible] = useState(!lazyLoad);
  const [hasError, setHasError] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const [currentSrc, setCurrentSrc] = useState<string>('');
  const containerRef = useRef<HTMLDivElement>(null);
  const errorHandledRef = useRef(false);

  // Determinar la URL a usar según variante
  const resolvedSrc = useMemo(() => {
    if (hasError) return fallbackSrc;
    if (!src) return fallbackSrc;

    // Si tenemos URLs de variantes explícitas del upload, usarlas
    if (variants && variants[variant]) {
      return variants[variant]!;
    }

    // Derivar URL de variante a partir de la URL original
    if (variant !== 'original') {
      return deriveVariantUrl(src, variant);
    }

    return src;
  }, [src, variant, variants, hasError, fallbackSrc]);

  // Actualizar src cuando cambia
  useEffect(() => {
    setCurrentSrc(resolvedSrc);
    setHasError(false);
    setIsLoaded(false);
    errorHandledRef.current = false;
  }, [resolvedSrc]);

  // Intersection Observer para lazy loading
  useEffect(() => {
    if (!lazyLoad || isVisible) return;

    const element = containerRef.current;
    if (!element) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: lazyMargin }
    );

    observer.observe(element);
    return () => observer.disconnect();
  }, [lazyLoad, lazyMargin, isVisible]);

  const handleError = useCallback(() => {
    // Usar ref para evitar race conditions con múltiples errores rápidos
    if (errorHandledRef.current) return;
    errorHandledRef.current = true;

    if (!hasError) {
      // Intentar fallback: variante -> original -> fallbackSrc
      if (currentSrc !== src && currentSrc !== fallbackSrc) {
        // La variante falló, intentar con la original
        errorHandledRef.current = false; // permitir un retry más con la original
        setCurrentSrc(src);
      } else {
        // La original también falló, usar fallback
        setHasError(true);
        setCurrentSrc(fallbackSrc);
      }
    }
  }, [hasError, currentSrc, src, fallbackSrc]);

  const handleLoad = () => {
    setIsLoaded(true);
  };

  return (
    <div ref={containerRef} className={`relative ${className || ''}`}>
      {/* Placeholder mientras carga */}
      {showPlaceholder && !isLoaded && isVisible && (
        <div className="absolute inset-0 bg-muted animate-pulse rounded" />
      )}

      {isVisible && currentSrc && (
        <Image
          {...props}
          src={currentSrc}
          alt={alt}
          className={`transition-opacity duration-300 ${isLoaded ? 'opacity-100' : 'opacity-0'} ${className || ''}`}
          onError={handleError}
          onLoad={handleLoad}
        />
      )}
    </div>
  );
}

export default OptimizedImage;
