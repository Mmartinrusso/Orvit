import { useState } from 'react';

interface UseFileDeleteReturn {
  deleteFile: (url: string) => Promise<boolean>;
  isDeleting: boolean;
  error: string | null;
}

export function useFileDelete(): UseFileDeleteReturn {
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const deleteFile = async (url: string): Promise<boolean> => {
    if (!url) {
      setError('URL del archivo es requerida');
      return false;
    }

    setIsDeleting(true);
    setError(null);

    try {
      const response = await fetch(`/api/upload/delete?url=${encodeURIComponent(url)}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Error al eliminar archivo');
      }

      return true;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Error desconocido';
      setError(errorMessage);
      return false;
    } finally {
      setIsDeleting(false);
    }
  };

  return {
    deleteFile,
    isDeleting,
    error,
  };
} 