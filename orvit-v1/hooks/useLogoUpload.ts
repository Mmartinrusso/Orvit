import { useState } from 'react';

interface UseLogoUploadProps {
  entityType: 'machine' | 'component' | 'area' | 'sector' | 'company';
  entityId?: string | number;
  onSuccess?: (logoUrl: string) => void;
  onError?: (error: string) => void;
}

interface UploadState {
  isUploading: boolean;
  progress: number;
  error: string | null;
  success: string | null;
}

export function useLogoUpload({
  entityType,
  entityId,
  onSuccess,
  onError
}: UseLogoUploadProps) {
  const [state, setState] = useState<UploadState>({
    isUploading: false,
    progress: 0,
    error: null,
    success: null
  });

  const uploadLogo = async (file: File) => {
    // Validar tipo de archivo
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      const error = 'Solo se permiten archivos de imagen (JPG, PNG, GIF, WebP)';
      setState(prev => ({ ...prev, error }));
      onError?.(error);
      return;
    }

    // Validar tamaño (máximo 5MB)
    if (file.size > 5 * 1024 * 1024) {
      const error = 'El archivo es demasiado grande. Máximo 5MB';
      setState(prev => ({ ...prev, error }));
      onError?.(error);
      return;
    }

    setState(prev => ({
      ...prev,
      isUploading: true,
      progress: 0,
      error: null,
      success: null
    }));

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('entityType', entityType);
      formData.append('entityId', entityId?.toString() || 'temp');
      formData.append('fileType', 'logo');

      // Simular progreso de carga
      const progressInterval = setInterval(() => {
        setState(prev => {
          if (prev.progress >= 90) {
            clearInterval(progressInterval);
            return { ...prev, progress: 90 };
          }
          return { ...prev, progress: prev.progress + 10 };
        });
      }, 100);

      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      clearInterval(progressInterval);
      setState(prev => ({ ...prev, progress: 100 }));

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Error al subir el archivo');
      }

      const data = await response.json();
      const successMessage = 'Logo subido exitosamente';
      
      setState(prev => ({
        ...prev,
        isUploading: false,
        progress: 0,
        success: successMessage
      }));

      onSuccess?.(data.url);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
      setState(prev => ({
        ...prev,
        isUploading: false,
        progress: 0,
        error: errorMessage
      }));
      onError?.(errorMessage);
    }
  };

  const clearState = () => {
    setState({
      isUploading: false,
      progress: 0,
      error: null,
      success: null
    });
  };

  const removeLogo = () => {
    clearState();
    onSuccess?.('');
  };

  return {
    ...state,
    uploadLogo,
    clearState,
    removeLogo
  };
} 