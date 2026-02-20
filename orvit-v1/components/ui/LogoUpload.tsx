'use client';

import React, { useState, useRef, useCallback } from 'react';
import { Button } from './button';
import { Input } from './input';
import { Label } from './label';
import { Upload, X, Image as ImageIcon, CheckCircle, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface LogoUploadProps {
  entityType: 'machine' | 'component' | 'area' | 'sector' | 'company' | 'plantzone';
  entityId?: string | number;
  currentLogo?: string;
  onLogoUploaded: (logoUrl: string) => void;
  onLogoRemoved?: () => void;
  className?: string;
  title?: string;
  description?: string;
  disabled?: boolean;
}

export function LogoUpload({
  entityType,
  entityId,
  currentLogo,
  onLogoUploaded,
  onLogoRemoved,
  className,
  title = 'Logo',
  description = 'Sube un logo para esta entidad',
  disabled = false,
}: LogoUploadProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const uploadFile = useCallback(async (file: File) => {
    setIsUploading(true);
    setError(null);
    setSuccess(null);
    setUploadProgress(0);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('entityType', entityType);
      formData.append('entityId', entityId?.toString() || 'temp');
      formData.append('fileType', 'logo');

      // Simular progreso de carga
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => {
          if (prev >= 90) {
            clearInterval(progressInterval);
            return 90;
          }
          return prev + 10;
        });
      }, 100);

      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      clearInterval(progressInterval);
      setUploadProgress(100);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Error al subir el archivo');
      }

      const data = await response.json();
      setSuccess('Logo subido exitosamente');
      
      // Verificar que onLogoUploaded existe antes de llamarlo
      if (typeof onLogoUploaded === 'function') {
        onLogoUploaded(data.url);
      } else {
        setError('Error: callback onLogoUploaded no está definido correctamente');
      }

      // Limpiar el input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }

    } catch (error) {
      setError(error instanceof Error ? error.message : 'Error desconocido');
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  }, [entityType, entityId, onLogoUploaded]);

  const handleFileSelect = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Limpiar errores previos
    setError(null);
    setSuccess(null);

    // Validar tipo de archivo
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      setError('Solo se permiten archivos de imagen (JPG, PNG, GIF, WebP)');
      return;
    }

    // Validar tamaño (máximo 5MB)
    if (file.size > 5 * 1024 * 1024) {
      setError('El archivo es demasiado grande. Máximo 5MB');
      return;
    }

    try {
      // Subir archivo directamente sin recorte
      await uploadFile(file);
    } catch (error) {
      setError('Error al procesar el archivo');
      console.error('Error en handleFileSelect:', error);
    }
  }, [uploadFile]);

  const handleRemoveLogo = useCallback(() => {
    setError(null);
    setSuccess(null);
    onLogoRemoved?.();
  }, [onLogoRemoved]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      const file = files[0];
      // Crear un FileList mock para pasar al handleFileSelect
      const fileList = {
        0: file,
        length: 1,
        item: (index: number) => index === 0 ? file : null,
        [Symbol.iterator]: function* () { yield file; }
      } as FileList;
      
      const fakeEvent = {
        target: { files: fileList }
      } as unknown as React.ChangeEvent<HTMLInputElement>;
      handleFileSelect(fakeEvent);
    }
  }, [handleFileSelect]);





  return (
    <div className={cn('w-full space-y-4', className)}>
      <div>
        <h3 className="text-sm font-medium flex items-center gap-2 mb-1">
          <ImageIcon className="h-4 w-4" />
          {title}
        </h3>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <div className="space-y-4">
        {/* Logo actual - VERSIÓN CORREGIDA */}
        {currentLogo && (
          <div className="flex items-center gap-4 p-4 border rounded-lg bg-background">
            {/* Contenedor fijo para la imagen con posicionamiento centrado */}
            <div className="logo-container">
              <img
                src={currentLogo}
                alt="Logo actual"
                className="logo-image"
              />
            </div>
            {/* Información del archivo */}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground">Logo actual</p>
              <p className="text-xs text-muted-foreground truncate">
                {currentLogo.split('/').pop()}
              </p>
            </div>
            {/* Botones de acción */}
            <div className="flex flex-col gap-2 items-end flex-shrink-0">
              {!disabled && onLogoRemoved && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleRemoveLogo}
                  className="text-destructive hover:text-destructive hover:bg-destructive/10"
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
        )}

        {/* Área de subida */}
        {!disabled && (
          <div
            className={cn(
              'border-2 border-dashed rounded-lg p-6 text-center transition-colors',
              isUploading ? 'border-primary bg-primary/5' : 'border-muted-foreground/25 hover:border-primary/50',
              'cursor-pointer'
            )}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileSelect}
              className="hidden"
              disabled={isUploading}
            />
            
            <div className="space-y-2">
              <Upload className="h-8 w-8 mx-auto text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">
                  {isUploading ? 'Subiendo...' : 'Haz clic o arrastra un archivo aquí'}
                </p>
                <p className="text-xs text-muted-foreground">
                  PNG, JPG, GIF, WebP hasta 5MB
                </p>
              </div>
            </div>

            {/* Barra de progreso */}
            {isUploading && (
              <div className="mt-4">
                <div className="w-full bg-muted rounded-full h-2">
                  <div
                    className="bg-primary h-2 rounded-full transition-all duration-300"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {uploadProgress}% completado
                </p>
              </div>
            )}
          </div>
        )}

        {/* Mensajes de estado */}
        {error && (
          <div className="flex items-center gap-2 p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
            <AlertCircle className="h-4 w-4 text-destructive" />
            <p className="text-sm text-destructive">{error}</p>
          </div>
        )}

        {success && (
          <div className="flex items-center gap-2 p-3 bg-success-muted border border-success-muted rounded-lg">
            <CheckCircle className="h-4 w-4 text-success" />
            <p className="text-sm text-success">{success}</p>
          </div>
        )}
      </div>
    </div>
  );
} 