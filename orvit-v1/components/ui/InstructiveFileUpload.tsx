import React, { useState, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Upload,
  FileText,
  X,
  Download,
  Eye,
  Paperclip
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { FileViewer } from '@/components/ui/file-viewer';

interface FileAttachment {
  url: string;
  name: string;
  size: number;
  type: string;
}

interface InstructiveFileUploadProps {
  entityType: string;
  entityId?: string | number;
  attachments: FileAttachment[];
  onAttachmentsChange: (attachments: FileAttachment[]) => void;
  className?: string;
  title?: string;
  description?: string;
  disabled?: boolean;
  maxFiles?: number;
}

// Tipos de archivo permitidos para instructivos
const ALLOWED_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'image/jpeg',
  'image/jpg', 
  'image/png',
  'image/gif',
  'image/webp',
  'text/plain'
];

const ALLOWED_EXTENSIONS = ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'jpg', 'jpeg', 'png', 'gif', 'webp', 'txt'];

export function InstructiveFileUpload({
  entityType,
  entityId,
  attachments,
  onAttachmentsChange,
  className,
  title = 'Archivos Adjuntos',
  description = 'Sube documentos, imágenes o archivos de referencia',
  disabled = false,
  maxFiles = 5
}: InstructiveFileUploadProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Estado para el visor de archivos
  const [viewerOpen, setViewerOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<FileAttachment | null>(null);

  const handleViewFile = useCallback((attachment: FileAttachment) => {
    setSelectedFile(attachment);
    setViewerOpen(true);
  }, []);

  const handleFileSelect = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files) return;

    if (attachments.length + files.length > maxFiles) {
      setError(`Máximo ${maxFiles} archivos permitidos`);
      return;
    }

    const filesToUpload = Array.from(files);
    await uploadFiles(filesToUpload);
  }, [attachments.length, maxFiles]);

  const uploadFiles = useCallback(async (files: File[]) => {
    setIsUploading(true);
    setError(null);
    setSuccess(null);
    setUploadProgress(0);

    const newAttachments: FileAttachment[] = [];

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];

        // Validar tipo de archivo
        if (!ALLOWED_TYPES.includes(file.type)) {
          const fileExt = file.name.split('.').pop()?.toLowerCase();
          if (!fileExt || !ALLOWED_EXTENSIONS.includes(fileExt)) {
            throw new Error(`Tipo de archivo no permitido: ${file.name}`);
          }
        }

        // Validar tamaño (máximo 10MB)
        if (file.size > 10 * 1024 * 1024) {
          throw new Error(`El archivo ${file.name} es demasiado grande. Máximo 10MB`);
        }

        const formData = new FormData();
        formData.append('file', file);
        formData.append('entityType', entityType);
        formData.append('entityId', entityId?.toString() || 'temp');
        formData.append('fileType', 'instructive');

        const response = await fetch('/api/upload', {
          method: 'POST',
          body: formData,
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || `Error al subir ${file.name}`);
        }

        const data = await response.json();
        newAttachments.push({
          url: data.url,
          name: data.originalName,
          size: data.size,
          type: data.fileType || file.type
        });

        // Actualizar progreso
        setUploadProgress(((i + 1) / files.length) * 100);
      }

      // Agregar nuevos attachments
      onAttachmentsChange([...attachments, ...newAttachments]);
      setSuccess(`${files.length} archivo(s) subido(s) exitosamente`);

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
  }, [entityType, entityId, attachments, onAttachmentsChange]);

  const removeAttachment = useCallback((index: number) => {
    const newAttachments = attachments.filter((_, i) => i !== index);
    onAttachmentsChange(newAttachments);
  }, [attachments, onAttachmentsChange]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      uploadFiles(files);
    }
  }, [uploadFiles]);

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getFileIcon = (fileName: string, fileType: string) => {
    const ext = fileName.split('.').pop()?.toLowerCase();
    
    if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext || '')) {
      return <Eye className="h-4 w-4" />;
    }
    
    return <FileText className="h-4 w-4" />;
  };

  return (
    <Card className={cn('w-full', className)}>
      <CardContent className="p-4 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-medium flex items-center gap-2">
              <Paperclip className="h-4 w-4" />
              {title}
              {attachments.length > 0 && (
                <Badge variant="secondary" className="ml-2">
                  {attachments.length}
                </Badge>
              )}
            </h3>
            <p className="text-xs text-muted-foreground">{description}</p>
          </div>
        </div>

        {/* Lista de archivos adjuntos */}
        {attachments.length > 0 && (
          <div className="space-y-2">
            {attachments.map((attachment, index) => (
              <div
                key={index}
                className="flex items-center justify-between p-2 bg-muted/50 rounded-lg border"
              >
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  {getFileIcon(attachment.name, attachment.type)}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">
                      {attachment.name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatFileSize(attachment.size)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleViewFile(attachment)}
                    className="h-8 w-8 p-0"
                    title="Ver archivo"
                  >
                    <Eye className="h-3 w-3" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeAttachment(index)}
                    className="h-8 w-8 p-0 text-red-600 hover:bg-red-100 dark:text-red-400 dark:hover:bg-red-900/30"
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Área de carga */}
        {!disabled && attachments.length < maxFiles && (
          <div
            className={cn(
              'border-2 border-dashed rounded-lg p-4 text-center transition-colors',
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
              accept={ALLOWED_EXTENSIONS.map(ext => `.${ext}`).join(',')}
              onChange={handleFileSelect}
              className="hidden"
              disabled={isUploading}
              multiple
            />
            
            <div className="space-y-2">
              <Upload className="h-6 w-6 mx-auto text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">
                  {isUploading ? 'Subiendo...' : 'Haz clic o arrastra archivos aquí'}
                </p>
                <p className="text-xs text-muted-foreground">
                  PDF, DOC, XLS, imágenes, TXT hasta 10MB cada uno
                </p>
                <p className="text-xs text-muted-foreground">
                  {attachments.length}/{maxFiles} archivos
                </p>
              </div>
            </div>

            {/* Barra de progreso */}
            {isUploading && (
              <div className="mt-3">
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
          <div className="text-sm text-red-600 bg-red-50 dark:bg-red-900/30 p-2 rounded">
            {error}
          </div>
        )}
        
        {success && (
          <div className="text-sm text-green-600 bg-green-50 dark:bg-green-900/30 p-2 rounded">
            {success}
          </div>
        )}

        {/* Visor de archivos */}
        {selectedFile && (
          <FileViewer
            url={selectedFile.url}
            fileName={selectedFile.name}
            open={viewerOpen}
            onClose={() => {
              setViewerOpen(false);
              setSelectedFile(null);
            }}
          />
        )}
      </CardContent>
    </Card>
  );
} 