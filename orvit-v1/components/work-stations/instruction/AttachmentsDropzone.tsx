'use client';

import React, { useCallback, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import {
  Upload,
  FileText,
  FileImage,
  FileSpreadsheet,
  File,
  Trash2,
  Download,
  Loader2,
  X,
  AlertCircle,
} from 'lucide-react';
import { AttachmentDraft } from './types';
import { cn } from '@/lib/utils';
import { GoogleDrivePicker, GoogleDriveFile } from '@/components/ui/google-drive-picker';

interface AttachmentsDropzoneProps {
  attachments: AttachmentDraft[];
  onChange: (attachments: AttachmentDraft[]) => void;
  maxFiles?: number;
  maxSizeMB?: number;
  acceptedTypes?: string[];
  disabled?: boolean;
  showGoogleDrive?: boolean;
  entityType?: string;
  entityId?: string | number;
}

const DEFAULT_ACCEPTED_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/gif',
  'image/webp',
];

const getFileIcon = (mime?: string, name?: string) => {
  if (!mime && name) {
    const ext = name.split('.').pop()?.toLowerCase();
    if (['pdf'].includes(ext || '')) return <FileText className="h-5 w-5 text-red-500" />;
    if (['doc', 'docx'].includes(ext || '')) return <FileText className="h-5 w-5 text-blue-500" />;
    if (['xls', 'xlsx'].includes(ext || '')) return <FileSpreadsheet className="h-5 w-5 text-green-500" />;
    if (['png', 'jpg', 'jpeg', 'gif', 'webp'].includes(ext || '')) return <FileImage className="h-5 w-5 text-purple-500" />;
  }
  if (mime?.includes('pdf')) return <FileText className="h-5 w-5 text-red-500" />;
  if (mime?.includes('word') || mime?.includes('document')) return <FileText className="h-5 w-5 text-blue-500" />;
  if (mime?.includes('excel') || mime?.includes('spreadsheet')) return <FileSpreadsheet className="h-5 w-5 text-green-500" />;
  if (mime?.includes('image')) return <FileImage className="h-5 w-5 text-purple-500" />;
  return <File className="h-5 w-5 text-muted-foreground" />;
};

const formatFileSize = (bytes?: number) => {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

export function AttachmentsDropzone({
  attachments,
  onChange,
  maxFiles = 10,
  maxSizeMB = 25,
  acceptedTypes = DEFAULT_ACCEPTED_TYPES,
  disabled = false,
  showGoogleDrive = true,
  entityType,
  entityId,
}: AttachmentsDropzoneProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const activeAttachments = attachments.filter(a => !a.isDeleted);

  // Handler para archivos importados desde Google Drive
  const handleGoogleDriveImport = useCallback((importedFiles: { url: string; name: string; size: number; type: string }[]) => {
    const newAttachments: AttachmentDraft[] = importedFiles.map(file => ({
      id: `gdrive-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      url: file.url,
      name: file.name,
      size: file.size,
      mime: file.type,
      isNew: true,
    }));
    onChange([...attachments, ...newAttachments]);
  }, [attachments, onChange]);

  const validateFile = useCallback((file: File): string | null => {
    if (file.size > maxSizeMB * 1024 * 1024) {
      return `El archivo "${file.name}" excede el límite de ${maxSizeMB}MB`;
    }
    if (acceptedTypes.length > 0 && !acceptedTypes.includes(file.type)) {
      return `Tipo de archivo no permitido: ${file.name}`;
    }
    return null;
  }, [maxSizeMB, acceptedTypes]);

  const handleFiles = useCallback((files: FileList | File[]) => {
    setError(null);
    const fileArray = Array.from(files);
    
    if (activeAttachments.length + fileArray.length > maxFiles) {
      setError(`Máximo ${maxFiles} archivos permitidos`);
      return;
    }

    const newAttachments: AttachmentDraft[] = [];
    const errors: string[] = [];

    for (const file of fileArray) {
      const validationError = validateFile(file);
      if (validationError) {
        errors.push(validationError);
        continue;
      }

      newAttachments.push({
        id: `new-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        file,
        name: file.name,
        size: file.size,
        mime: file.type,
        isNew: true,
      });
    }

    if (errors.length > 0) {
      setError(errors.join('. '));
    }

    if (newAttachments.length > 0) {
      onChange([...attachments, ...newAttachments]);
    }
  }, [attachments, onChange, activeAttachments.length, maxFiles, validateFile]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (disabled) return;
    handleFiles(e.dataTransfer.files);
  }, [handleFiles, disabled]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    if (!disabled) setIsDragging(true);
  }, [disabled]);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleRemove = useCallback((id: string) => {
    const attachment = attachments.find(a => a.id === id);
    if (!attachment) return;

    if (attachment.isNew) {
      // Remove completely if it's new
      onChange(attachments.filter(a => a.id !== id));
    } else {
      // Mark as deleted if it's existing
      onChange(attachments.map(a => a.id === id ? { ...a, isDeleted: true } : a));
    }
  }, [attachments, onChange]);

  const handleDownload = useCallback((attachment: AttachmentDraft) => {
    if (attachment.url) {
      window.open(attachment.url, '_blank');
    } else if (attachment.file) {
      const url = URL.createObjectURL(attachment.file);
      const a = document.createElement('a');
      a.href = url;
      a.download = attachment.name;
      a.click();
      URL.revokeObjectURL(url);
    }
  }, []);

  return (
    <div className="space-y-4">
      {/* Dropzone */}
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={() => !disabled && fileInputRef.current?.click()}
        className={cn(
          'relative border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all',
          isDragging && 'border-primary bg-primary/5',
          disabled && 'opacity-50 cursor-not-allowed',
          !isDragging && !disabled && 'border-border hover:border-primary/50 hover:bg-muted/30'
        )}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept={acceptedTypes.join(',')}
          onChange={(e) => e.target.files && handleFiles(e.target.files)}
          className="hidden"
          disabled={disabled}
        />
        <div className="flex flex-col items-center gap-2">
          <div className={cn(
            'h-12 w-12 rounded-full flex items-center justify-center',
            isDragging ? 'bg-primary/10' : 'bg-muted'
          )}>
            <Upload className={cn('h-6 w-6', isDragging ? 'text-primary' : 'text-muted-foreground')} />
          </div>
          <div>
            <p className="text-sm font-medium text-foreground">
              {isDragging ? 'Suelta los archivos aquí' : 'Arrastra archivos o haz clic para seleccionar'}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              PDF, Word, Excel, Imágenes • Máx {maxFiles} archivos, {maxSizeMB}MB c/u
            </p>
          </div>
        </div>
      </div>

      {/* Google Drive button */}
      {showGoogleDrive && !disabled && activeAttachments.length < maxFiles && (
        <div className="flex items-center justify-center">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>o importar desde</span>
            <GoogleDrivePicker
              onFilesSelected={() => {}}
              onImportComplete={handleGoogleDriveImport}
              autoImport
              entityType={entityType}
              entityId={entityId}
              multiSelect
              disabled={disabled}
              buttonSize="sm"
              buttonClassName="h-7"
            />
          </div>
        </div>
      )}

      {/* Error message */}
      {error && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 text-destructive text-xs">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setError(null)}
            className="h-6 w-6 p-0 ml-auto"
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      )}

      {/* File list */}
      {activeAttachments.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">
              Archivos adjuntos ({activeAttachments.length}/{maxFiles})
            </span>
            {activeAttachments.length > 0 && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => onChange(attachments.map(a => a.isNew ? null : { ...a, isDeleted: true }).filter(Boolean) as AttachmentDraft[])}
                className="h-7 text-xs text-muted-foreground hover:text-destructive"
              >
                Quitar todos
              </Button>
            )}
          </div>
          <ScrollArea className="max-h-[200px]">
            <div className="space-y-2">
              {activeAttachments.map((attachment) => (
                <Card key={attachment.id} className="p-3">
                  <div className="flex items-center gap-3">
                    {getFileIcon(attachment.mime, attachment.name)}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{attachment.name}</p>
                      <div className="flex items-center gap-2">
                        {attachment.size && (
                          <span className="text-xs text-muted-foreground">
                            {formatFileSize(attachment.size)}
                          </span>
                        )}
                        {attachment.isNew && (
                          <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                            Nuevo
                          </Badge>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      {(attachment.url || attachment.file) && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDownload(attachment)}
                          className="h-8 w-8 p-0"
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                      )}
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemove(attachment.id)}
                        className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                        disabled={disabled}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </ScrollArea>
        </div>
      )}
    </div>
  );
}

