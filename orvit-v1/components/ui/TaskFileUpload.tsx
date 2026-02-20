"use client";

import React, { useState, useRef } from 'react';
import { cn } from '@/lib/utils';
import { Upload, X, File, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';

export interface TaskFileAttachment {
  id?: string;
  name: string;
  url: string;
  size: number;
  type: string;
}

interface TaskFileUploadProps {
  attachments: TaskFileAttachment[];
  onChange: (attachments: TaskFileAttachment[]) => void;
  maxFiles?: number;
  maxSizePerFile?: number;
  allowedTypes?: string[];
}

export function TaskFileUpload({
  attachments,
  onChange,
  maxFiles = 5,
  maxSizePerFile = 10 * 1024 * 1024, // 10MB
  allowedTypes = [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/plain',
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp'
  ]
}: TaskFileUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{ [key: string]: number }>({});
  const [errors, setErrors] = useState<string[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const validateFile = (file: File): string | null => {
    if (file.size > maxSizePerFile) {
      return `El archivo "${file.name}" excede el tamaño máximo de ${Math.round(maxSizePerFile / 1024 / 1024)}MB`;
    }

    if (!allowedTypes.includes(file.type)) {
      return `El tipo de archivo "${file.type}" no está permitido para "${file.name}"`;
    }

    return null;
  };

  const uploadFile = async (file: File): Promise<TaskFileAttachment | null> => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('entityType', 'task');
    formData.append('entityId', 'temp'); // Temporal hasta que se cree la tarea
    formData.append('fileType', 'attachment');

    try {
      // Simular progreso de upload
      const fileId = Math.random().toString(36).substring(2, 15);
      
      // Actualizar progreso
      for (let i = 0; i <= 100; i += 10) {
        setUploadProgress(prev => ({ ...prev, [fileId]: i }));
        await new Promise(resolve => setTimeout(resolve, 50));
      }

      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token') || 'mock-token'}`
        }
      });

      if (!response.ok) {
        throw new Error(`Error uploading file: ${response.statusText}`);
      }

      const result = await response.json();
      
      // Limpiar progreso
      setUploadProgress(prev => {
        const newProgress = { ...prev };
        delete newProgress[fileId];
        return newProgress;
      });

      return {
        name: result.originalName,
        url: result.url,
        size: result.size,
        type: file.type
      };
    } catch (error) {
      console.error('Error uploading file:', error);
      
      // Limpiar progreso en caso de error
      const fileId = Object.keys(uploadProgress).find(id => uploadProgress[id] === 100);
      if (fileId) {
        setUploadProgress(prev => {
          const newProgress = { ...prev };
          delete newProgress[fileId];
          return newProgress;
        });
      }
      
      throw error;
    }
  };

  const handleFiles = async (files: FileList | File[]) => {
    const fileArray = Array.from(files);
    const newErrors: string[] = [];

    // Validar que no exceda el máximo de archivos
    if (attachments.length + fileArray.length > maxFiles) {
      newErrors.push(`No puedes subir más de ${maxFiles} archivos en total`);
      setErrors(newErrors);
      return;
    }

    // Validar cada archivo
    const validFiles: File[] = [];
    for (const file of fileArray) {
      const error = validateFile(file);
      if (error) {
        newErrors.push(error);
      } else {
        validFiles.push(file);
      }
    }

    if (newErrors.length > 0) {
      setErrors(newErrors);
      return;
    }

    setErrors([]);
    setIsUploading(true);

    try {
      const uploadPromises = validFiles.map(file => uploadFile(file));
      const uploadedFiles = await Promise.all(uploadPromises);
      
      const successfulUploads = uploadedFiles.filter(file => file !== null) as TaskFileAttachment[];
      onChange([...attachments, ...successfulUploads]);
    } catch (error) {
      console.error('Error uploading files:', error);
      setErrors(['Error al subir los archivos. Inténtalo de nuevo.']);
    } finally {
      setIsUploading(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleFiles(files);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleFiles(files);
    }
  };

  const removeFile = (index: number) => {
    const newAttachments = [...attachments];
    newAttachments.splice(index, 1);
    onChange(newAttachments);
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getFileIcon = (type: string) => {
    if (type.startsWith('image/')) return '🖼️';
    if (type.includes('pdf')) return '📄';
    if (type.includes('word')) return '📝';
    if (type.includes('sheet') || type.includes('excel')) return '📊';
    if (type.includes('text')) return '📋';
    return '📎';
  };

  return (
    <div className="space-y-4">
      {/* Área de drop */}
      <div
        className={cn(
          'border-2 border-dashed rounded-lg p-6 text-center transition-colors',
          isDragging
            ? 'border-primary bg-primary/5'
            : 'border-border hover:border-primary/50',
          isUploading ? 'pointer-events-none opacity-50' : 'cursor-pointer'
        )}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={() => fileInputRef.current?.click()}
      >
        <Upload className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
        <p className="text-sm text-foreground mb-2">
          Arrastra archivos aquí o haz click para seleccionar
        </p>
        <p className="text-xs text-muted-foreground">
          Máximo {maxFiles} archivos, {Math.round(maxSizePerFile / 1024 / 1024)}MB cada uno
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          PDF, DOC, DOCX, XLS, XLSX, TXT, Imágenes
        </p>
      </div>

      {/* Input oculto */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept={allowedTypes.join(',')}
        onChange={handleFileSelect}
        className="hidden"
      />

      {/* Progreso de upload */}
      {Object.keys(uploadProgress).length > 0 && (
        <div className="space-y-2">
          {Object.entries(uploadProgress).map(([fileId, progress]) => (
            <div key={fileId} className="space-y-1">
              <div className="flex justify-between text-sm">
                <span>Subiendo archivo...</span>
                <span>{progress}%</span>
              </div>
              <Progress value={progress} className="h-2" />
            </div>
          ))}
        </div>
      )}

      {/* Errores */}
      {errors.length > 0 && (
        <div className="space-y-2">
          {errors.map((error, index) => (
            <Alert key={index} variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ))}
        </div>
      )}

      {/* Lista de archivos */}
      {attachments.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-foreground">
            Archivos adjuntos ({attachments.length}/{maxFiles})
          </h4>
          <div className="space-y-2">
            {attachments.map((file, index) => (
              <div
                key={index}
                className="flex items-center justify-between p-3 bg-muted rounded-lg border"
              >
                <div className="flex items-center space-x-3 min-w-0 flex-1">
                  <span className="text-lg">{getFileIcon(file.type)}</span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-foreground truncate">
                      {file.name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatFileSize(file.size)}
                    </p>
                  </div>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => removeFile(index)}
                  className="text-destructive hover:text-destructive hover:bg-destructive/10"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
} 