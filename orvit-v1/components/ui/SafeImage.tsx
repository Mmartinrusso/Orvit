'use client';

import Image, { ImageProps } from 'next/image';
import { useState } from 'react';

interface SafeImageProps extends Omit<ImageProps, 'onError'> {
  fallbackSrc?: string;
}

/**
 * ✨ SafeImage - Componente de imagen con fallback para errores de S3
 * 
 * Maneja gracefully los errores 403/404 de imágenes externas
 * mostrando un placeholder en su lugar.
 */
export function SafeImage({ 
  src, 
  alt, 
  fallbackSrc = '/logo-orvit.png',
  ...props 
}: SafeImageProps) {
  const [imgSrc, setImgSrc] = useState(src);
  const [hasError, setHasError] = useState(false);

  const handleError = () => {
    if (!hasError) {
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
