'use client';

import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  Upload, 
  Image as ImageIcon, 
  Eye,
  Trash2,
  Loader2
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface ToolFile {
  id: string;
  name: string;
  url: string;
  type: 'image' | 'document';
  size: number;
  uploadedAt: string;
}

interface ToolFileUploadProps {
  toolId: string;
  companyId: number;
  onFilesChange?: (files: ToolFile[]) => void;
  initialFiles?: ToolFile[];
}

export function ToolFileUpload({ 
  toolId, 
  companyId, 
  onFilesChange,
  initialFiles = []
}: ToolFileUploadProps) {
  const { toast } = useToast();
  const [files, setFiles] = useState<ToolFile[]>(initialFiles);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{[key: string]: number}>({});
  const imageInputRef = useRef<HTMLInputElement>(null);

  // Sincronizar cuando cambien los archivos iniciales o cambie la herramienta (por ejemplo, al cerrar/reabrir el diálogo)
  useEffect(() => {
    setFiles(initialFiles || []);
  }, [initialFiles, toolId]);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>, fileType: 'image' | 'document') => {
    const selectedFiles = event.target.files;
    if (!selectedFiles || selectedFiles.length === 0) return;

    // Permitimos subir aunque la herramienta sea temporal (toolId === 'temp')

    setUploading(true);
    setUploadProgress({});

    try {
      const uploadPromises = Array.from(selectedFiles).map(async (file, index) => {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('entityType', 'tool');
        formData.append('entityId', toolId);
        formData.append('fileType', fileType);

        setUploadProgress(prev => ({ ...prev, [file.name]: 0 }));

        const response = await fetch('/api/upload', {
          method: 'POST',
          body: formData
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Error al subir el archivo');
        }

        const data = await response.json();
        setUploadProgress(prev => ({ ...prev, [file.name]: 100 }));

        return {
          id: `${Date.now()}-${index}`,
          name: file.name,
          url: data.url,
          type: fileType,
          size: file.size,
          uploadedAt: new Date().toISOString()
        };
      });

      const uploadedFiles = await Promise.all(uploadPromises);
      const newFiles = [...files, ...uploadedFiles];
      setFiles(newFiles);
      onFilesChange?.(newFiles);

      toast({
        title: 'Éxito',
        description: `${uploadedFiles.length} archivo(s) subido(s) correctamente`
      });

    } catch (error) {
      console.error('Error uploading files:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Error al subir archivos',
        variant: 'destructive'
      });
    } finally {
      setUploading(false);
      setUploadProgress({});
      // Limpiar los inputs
      if (imageInputRef.current) imageInputRef.current.value = '';
    }
  };

  const handleRemoveFile = (fileId: string) => {
    const newFiles = files.filter(file => file.id !== fileId);
    setFiles(newFiles);
    onFilesChange?.(newFiles);
    toast({
      title: 'Archivo eliminado',
      description: 'El archivo ha sido eliminado de la lista'
    });
  };

  const handleViewFile = (file: ToolFile) => {
    window.open(file.url, '_blank');
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const images = files.filter(f => f.type === 'image');

  return (
    <div className="space-y-4">
      {/* Sección de Imágenes */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm">
            <ImageIcon className="h-4 w-4" />
            Imágenes
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Permitido subir imágenes aun si toolId es temporal */}
          
          {/* Upload de imágenes */}
          <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-4 text-center">
            <ImageIcon className="h-6 w-6 text-muted-foreground mx-auto mb-2" />
            <p className="text-xs text-muted-foreground mb-2">
              Arrastra imágenes aquí o haz clic para seleccionar
            </p>
            <Input
              ref={imageInputRef}
              type="file"
              accept="image/*"
              multiple
              onChange={(e) => handleFileUpload(e, 'image')}
              className="hidden"
              disabled={uploading}
            />
            <Button
              variant="outline"
              size="sm"
              onClick={() => imageInputRef.current?.click()}
              disabled={uploading}
            >
              {uploading ? (
                <>
                  <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                  Subiendo...
                </>
              ) : (
                <>
                  <Upload className="mr-2 h-3 w-3" />
                  Seleccionar imágenes
                </>
              )}
            </Button>
          </div>

          {/* Lista de imágenes */}
          {images.length > 0 && (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {images.map((file) => (
                <div key={file.id} className="relative group">
                  <div className="aspect-square rounded-lg border overflow-hidden">
                    <img
                      src={file.url}
                      alt={file.name}
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1">
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => handleViewFile(file)}
                      >
                        <Eye className="h-3 w-3" />
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => handleRemoveFile(file.id)}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1 truncate">
                    {file.name}
                  </p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Progress indicators */}
      {Object.keys(uploadProgress).length > 0 && (
        <div className="space-y-2">
          {Object.entries(uploadProgress).map(([fileName, progress]) => (
            <div key={fileName} className="flex items-center gap-2">
              <div className="flex-1 bg-muted rounded-full h-1">
                <div 
                  className="bg-primary h-1 rounded-full transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <span className="text-xs text-muted-foreground">{fileName}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
} 