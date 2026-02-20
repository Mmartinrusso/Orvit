'use client';

import { useState, useCallback, useRef } from 'react';
import { Upload, FolderArchive, FileText, X, AlertTriangle, Loader2, Languages, Globe } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

export interface TranslationSettings {
  enabled: boolean;
  sourceLanguage: string; // 'auto' | 'en' | 'pt' | 'de' | 'fr' | 'it' | 'zh'
  targetLanguage: string; // 'es' by default
}

interface ImportDropzoneProps {
  onUploadComplete: (jobId: number) => void;
  disabled?: boolean;
}

interface FileWithPath {
  file: File;
  relativePath: string;
}

const ALLOWED_EXTENSIONS = ['.pdf', '.jpg', '.jpeg', '.png', '.webp', '.gif', '.bmp', '.tiff', '.tif', '.zip'];
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
const MAX_TOTAL_SIZE = 500 * 1024 * 1024; // 500MB
const MAX_FILES = 100;

const LANGUAGES = [
  { value: 'auto', label: 'Auto-detectar' },
  { value: 'en', label: 'Inglés' },
  { value: 'pt', label: 'Portugués' },
  { value: 'de', label: 'Alemán' },
  { value: 'fr', label: 'Francés' },
  { value: 'it', label: 'Italiano' },
  { value: 'zh', label: 'Chino' },
  { value: 'ja', label: 'Japonés' },
  { value: 'ko', label: 'Coreano' },
];

const TARGET_LANGUAGES = [
  { value: 'es', label: 'Español' },
  { value: 'en', label: 'Inglés' },
  { value: 'pt', label: 'Portugués' },
];

export function ImportDropzone({ onUploadComplete, disabled }: ImportDropzoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [files, setFiles] = useState<FileWithPath[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [errors, setErrors] = useState<string[]>([]);

  // Translation settings
  const [translationSettings, setTranslationSettings] = useState<TranslationSettings>({
    enabled: false,
    sourceLanguage: 'auto',
    targetLanguage: 'es',
  });

  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  const validateFiles = useCallback((newFiles: FileWithPath[]): { valid: FileWithPath[], errors: string[] } => {
    const validFiles: FileWithPath[] = [];
    const fileErrors: string[] = [];
    let totalSize = files.reduce((sum, f) => sum + f.file.size, 0);

    for (const fileItem of newFiles) {
      const ext = '.' + fileItem.file.name.split('.').pop()?.toLowerCase();

      // Check extension
      if (!ALLOWED_EXTENSIONS.includes(ext)) {
        fileErrors.push(`${fileItem.file.name}: extensión no permitida`);
        continue;
      }

      // Check individual file size
      if (fileItem.file.size > MAX_FILE_SIZE) {
        fileErrors.push(`${fileItem.file.name}: excede 50MB`);
        continue;
      }

      // Check total size
      if (totalSize + fileItem.file.size > MAX_TOTAL_SIZE) {
        fileErrors.push(`${fileItem.file.name}: excedería límite total de 500MB`);
        continue;
      }

      // Check total file count
      if (validFiles.length + files.length >= MAX_FILES) {
        fileErrors.push(`Máximo ${MAX_FILES} archivos permitidos`);
        break;
      }

      validFiles.push(fileItem);
      totalSize += fileItem.file.size;
    }

    return { valid: validFiles, errors: fileErrors };
  }, [files]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!disabled) setIsDragging(true);
  }, [disabled]);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const processEntry = async (entry: FileSystemEntry, basePath: string = ''): Promise<FileWithPath[]> => {
    const results: FileWithPath[] = [];

    if (entry.isFile) {
      const fileEntry = entry as FileSystemFileEntry;
      const file = await new Promise<File>((resolve, reject) => {
        fileEntry.file(resolve, reject);
      });
      results.push({
        file,
        relativePath: basePath ? `${basePath}/${file.name}` : file.name,
      });
    } else if (entry.isDirectory) {
      const dirEntry = entry as FileSystemDirectoryEntry;
      const reader = dirEntry.createReader();
      const entries = await new Promise<FileSystemEntry[]>((resolve, reject) => {
        reader.readEntries(resolve, reject);
      });

      for (const childEntry of entries) {
        const childResults = await processEntry(
          childEntry,
          basePath ? `${basePath}/${entry.name}` : entry.name
        );
        results.push(...childResults);
      }
    }

    return results;
  };

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    if (disabled) return;

    const items = Array.from(e.dataTransfer.items);
    const newFiles: FileWithPath[] = [];

    // Process dropped items (supports folders via webkitGetAsEntry)
    for (const item of items) {
      const entry = item.webkitGetAsEntry?.();
      if (entry) {
        const entryFiles = await processEntry(entry);
        newFiles.push(...entryFiles);
      }
    }

    // Check for ZIP files
    const zipFiles = newFiles.filter(f => f.file.name.toLowerCase().endsWith('.zip'));
    if (zipFiles.length > 0) {
      // If there's a ZIP, only process that one
      if (zipFiles.length > 1) {
        setErrors(['Solo se puede subir un archivo ZIP a la vez']);
        return;
      }
      setFiles([zipFiles[0]]);
      setErrors([]);
      return;
    }

    const { valid, errors: validationErrors } = validateFiles(newFiles);

    if (validationErrors.length > 0) {
      setErrors(validationErrors);
    }

    if (valid.length > 0) {
      setFiles(prev => [...prev, ...valid]);
    }
  }, [disabled, validateFiles]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;

    const inputFiles = Array.from(e.target.files);

    const newFiles: FileWithPath[] = inputFiles.map(file => {
      // For webkitdirectory, webkitRelativePath contains the relative path
      const relativePath = (file as any).webkitRelativePath || file.name;
      return { file, relativePath };
    });

    // Check for ZIP files
    const zipFiles = newFiles.filter(f => f.file.name.toLowerCase().endsWith('.zip'));
    if (zipFiles.length > 0) {
      if (zipFiles.length > 1) {
        setErrors(['Solo se puede subir un archivo ZIP a la vez']);
        return;
      }
      setFiles([zipFiles[0]]);
      setErrors([]);
      return;
    }

    const { valid, errors: validationErrors } = validateFiles(newFiles);

    if (validationErrors.length > 0) {
      setErrors(validationErrors);
    }

    if (valid.length > 0) {
      setFiles(prev => [...prev, ...valid]);
    }

    // Reset input
    e.target.value = '';
  }, [validateFiles]);

  const removeFile = useCallback((index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
    setErrors([]);
  }, []);

  const clearFiles = useCallback(() => {
    setFiles([]);
    setErrors([]);
  }, []);

  const handleUpload = async () => {
    if (files.length === 0) return;

    setIsUploading(true);
    setUploadProgress(0);
    setErrors([]);

    try {
      const formData = new FormData();
      const isZip = files.length === 1 && files[0].file.name.toLowerCase().endsWith('.zip');

      formData.append('isZip', String(isZip));

      // Add translation settings
      formData.append('translateEnabled', String(translationSettings.enabled));
      if (translationSettings.enabled) {
        formData.append('sourceLanguage', translationSettings.sourceLanguage);
        formData.append('targetLanguage', translationSettings.targetLanguage);
      }

      for (const fileItem of files) {
        formData.append('files', fileItem.file, fileItem.relativePath);
      }

      // Simulate progress for better UX
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => Math.min(prev + 10, 90));
      }, 200);

      const response = await fetch('/api/maquinas/import', {
        method: 'POST',
        body: formData,
      });

      clearInterval(progressInterval);
      setUploadProgress(100);

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Error al subir archivos');
      }

      const result = await response.json();

      toast.success(`${result.totalFiles} archivos subidos correctamente`);

      if (result.warnings?.length > 0) {
        result.warnings.forEach((w: string) => toast.warning(w));
      }

      setFiles([]);
      onUploadComplete(result.importJobId);

    } catch (error) {
      console.error('Upload error:', error);
      setErrors([error instanceof Error ? error.message : 'Error al subir archivos']);
      toast.error('Error al subir archivos');
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  const totalSize = files.reduce((sum, f) => sum + f.file.size, 0);
  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="space-y-4">
      {/* Dropzone */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={cn(
          "relative border-2 border-dashed rounded-lg p-8 transition-colors",
          isDragging && "border-primary bg-primary/5",
          !isDragging && "border-muted-foreground/25 hover:border-muted-foreground/50",
          disabled && "opacity-50 cursor-not-allowed"
        )}
      >
        <div className="flex flex-col items-center justify-center gap-4 text-center">
          <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center">
            <Upload className="h-8 w-8 text-muted-foreground" />
          </div>

          <div>
            <p className="text-lg font-medium">Arrastra archivos o carpetas aquí</p>
            <p className="text-sm text-muted-foreground mt-1">
              Soporta PDF, imágenes, o un archivo ZIP con la documentación técnica
            </p>
          </div>

          <div className="flex gap-2">
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept={ALLOWED_EXTENSIONS.join(',')}
              onChange={handleFileSelect}
              className="hidden"
              disabled={disabled}
            />
            <input
              ref={folderInputRef}
              type="file"
              {...{ webkitdirectory: '', directory: '' } as any}
              onChange={handleFileSelect}
              className="hidden"
              disabled={disabled}
            />

            <Button
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              disabled={disabled || isUploading}
            >
              <FileText className="h-4 w-4 mr-2" />
              Seleccionar archivos
            </Button>

            <Button
              variant="outline"
              onClick={() => folderInputRef.current?.click()}
              disabled={disabled || isUploading}
            >
              <FolderArchive className="h-4 w-4 mr-2" />
              Seleccionar carpeta
            </Button>
          </div>

          <p className="text-xs text-muted-foreground">
            Máx. {MAX_FILES} archivos, {formatSize(MAX_FILE_SIZE)} por archivo, {formatSize(MAX_TOTAL_SIZE)} total
          </p>
        </div>
      </div>

      {/* Translation Settings */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-info-muted flex items-center justify-center">
                <Languages className="h-5 w-5 text-info" />
              </div>
              <div>
                <Label htmlFor="translate-toggle" className="font-medium cursor-pointer">
                  Traducir documentos
                </Label>
                <p className="text-xs text-muted-foreground">
                  La IA traducirá el contenido durante el análisis
                </p>
              </div>
            </div>
            <Switch
              id="translate-toggle"
              checked={translationSettings.enabled}
              onCheckedChange={(checked) =>
                setTranslationSettings(prev => ({ ...prev, enabled: checked }))
              }
              disabled={disabled || isUploading}
            />
          </div>

          {translationSettings.enabled && (
            <div className="mt-4 pt-4 border-t grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground flex items-center gap-1">
                  <Globe className="h-3 w-3" />
                  Idioma de origen
                </Label>
                <Select
                  value={translationSettings.sourceLanguage}
                  onValueChange={(value) =>
                    setTranslationSettings(prev => ({ ...prev, sourceLanguage: value }))
                  }
                  disabled={disabled || isUploading}
                >
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {LANGUAGES.map(lang => (
                      <SelectItem key={lang.value} value={lang.value}>
                        {lang.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground flex items-center gap-1">
                  <Globe className="h-3 w-3" />
                  Traducir a
                </Label>
                <Select
                  value={translationSettings.targetLanguage}
                  onValueChange={(value) =>
                    setTranslationSettings(prev => ({ ...prev, targetLanguage: value }))
                  }
                  disabled={disabled || isUploading}
                >
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TARGET_LANGUAGES.map(lang => (
                      <SelectItem key={lang.value} value={lang.value}>
                        {lang.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Errors */}
      {errors.length > 0 && (
        <Card className="border-destructive bg-destructive/5">
          <CardContent className="p-4">
            <div className="flex items-start gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
              <div className="space-y-1">
                {errors.map((error, i) => (
                  <p key={i} className="text-sm text-destructive">{error}</p>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* File List */}
      {files.length > 0 && (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="font-medium">{files.length} archivos</span>
                <Badge variant="secondary">{formatSize(totalSize)}</Badge>
                {translationSettings.enabled && (
                  <Badge variant="outline" className="gap-1">
                    <Languages className="h-3 w-3" />
                    {LANGUAGES.find(l => l.value === translationSettings.sourceLanguage)?.label} → {TARGET_LANGUAGES.find(l => l.value === translationSettings.targetLanguage)?.label}
                  </Badge>
                )}
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={clearFiles}
                disabled={isUploading}
              >
                <X className="h-4 w-4 mr-1" />
                Limpiar
              </Button>
            </div>

            <div className="max-h-48 overflow-y-auto space-y-1">
              {files.slice(0, 20).map((fileItem, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between py-1 px-2 rounded hover:bg-muted/50 group"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <FileText className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    <span className="text-sm truncate" title={fileItem.relativePath}>
                      {fileItem.relativePath}
                    </span>
                    <span className="text-xs text-muted-foreground flex-shrink-0">
                      {formatSize(fileItem.file.size)}
                    </span>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 opacity-0 group-hover:opacity-100"
                    onClick={() => removeFile(index)}
                    disabled={isUploading}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              ))}
              {files.length > 20 && (
                <p className="text-xs text-muted-foreground text-center py-2">
                  ... y {files.length - 20} archivos más
                </p>
              )}
            </div>

            {/* Upload Progress */}
            {isUploading && (
              <div className="mt-4 space-y-2">
                <Progress value={uploadProgress} className="h-2" />
                <p className="text-xs text-center text-muted-foreground">
                  Subiendo archivos... {uploadProgress}%
                </p>
              </div>
            )}

            {/* Upload Button */}
            {!isUploading && (
              <div className="mt-4 flex justify-end">
                <Button onClick={handleUpload}>
                  <Upload className="h-4 w-4 mr-2" />
                  Subir y procesar con IA
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Loading Overlay */}
      {isUploading && (
        <div className="fixed inset-0 bg-background/80 flex items-center justify-center z-50">
          <div className="flex flex-col items-center gap-4">
            <Loader2 className="h-12 w-12 animate-spin text-primary" />
            <p className="text-lg font-medium">Subiendo documentación...</p>
            <Progress value={uploadProgress} className="w-64" />
          </div>
        </div>
      )}
    </div>
  );
}
