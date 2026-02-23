'use client';

// ✅ OPTIMIZACIÓN: Desactivar logs en producción
const DEBUG = false;
const log = DEBUG ? (...args: unknown[]) => { /* debug */ } : () => {};

import { useState, useRef, useEffect } from 'react';
import { formatDate } from '@/lib/date-utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Upload, 
  Image as ImageIcon, 
  FileText, 
  X, 
  Download,
  Eye,
  Trash2,
  Loader2
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface ProductFile {
  id: string;
  name: string;
  url: string;
  type: 'image' | 'document';
  size: number;
  uploadedAt: string;
}

interface ProductFileUploadProps {
  productId: string;
  companyId: number;
  onFilesChange?: (files: ProductFile[]) => void;
  initialFiles?: ProductFile[];
}

export function ProductFileUpload({ 
  productId, 
  companyId, 
  onFilesChange,
  initialFiles = []
}: ProductFileUploadProps) {
  const { toast } = useToast();
  const [files, setFiles] = useState<ProductFile[]>(initialFiles);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{[key: string]: number}>({});
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  // Debug log
  useEffect(() => {
    log('🔍 ProductFileUpload renderizado con:', { productId, companyId, initialFiles });
  }, [productId, companyId, initialFiles]);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>, fileType: 'image' | 'document') => {
    const selectedFiles = event.target.files;
    if (!selectedFiles || selectedFiles.length === 0) return;

    // Si el producto aún no existe (productId === 'temp'), mostrar mensaje
    if (productId === 'temp') {
      toast({
        title: 'Información',
        description: 'Guarda el producto primero para poder subir archivos',
        variant: 'default'
      });
      return;
    }

    setUploading(true);
    setUploadProgress({});

    try {
      const uploadPromises = Array.from(selectedFiles).map(async (file, index) => {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('entityType', 'product');
        formData.append('entityId', productId);
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
      if (fileInputRef.current) fileInputRef.current.value = '';
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

  const handleViewFile = (file: ProductFile) => {
    window.open(file.url, '_blank');
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getFileIcon = (file: ProductFile) => {
    if (file.type === 'image') {
      return <ImageIcon className="h-4 w-4" />;
    }
    return <FileText className="h-4 w-4" />;
  };

  const images = files.filter(f => f.type === 'image');
  const documents = files.filter(f => f.type === 'document');

  return (
    <div className="space-y-6">
      {/* Debug info */}
      <div className="bg-warning-muted border border-warning-muted rounded-lg p-2 text-xs text-warning-muted-foreground">
        Debug: ProductFileUpload renderizado - productId: {productId}, companyId: {companyId}
      </div>

      {/* Sección de Imágenes */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ImageIcon className="h-5 w-5" />
            Imágenes del Producto
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Mensaje cuando el producto no existe */}
          {productId === 'temp' && (
            <div className="bg-info-muted border border-info-muted rounded-lg p-4 text-center">
              <p className="text-sm text-info-muted-foreground">
                💡 Guarda el producto primero para poder subir imágenes y documentos
              </p>
            </div>
          )}
          
          {/* Upload de imágenes */}
          <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-6 text-center">
            <ImageIcon className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground mb-2">
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
              onClick={() => imageInputRef.current?.click()}
              disabled={uploading || productId === 'temp'}
            >
              {uploading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Subiendo...
                </>
              ) : (
                <>
                  <Upload className="mr-2 h-4 w-4" />
                  Seleccionar imágenes
                </>
              )}
            </Button>
          </div>

          {/* Lista de imágenes */}
          {images.length > 0 && (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {images.map((file) => (
                <div key={file.id} className="relative group">
                  <div className="aspect-square rounded-lg border overflow-hidden">
                    <img
                      src={file.url}
                      alt={file.name}
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
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

      {/* Sección de Documentos */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Documentos del Producto
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Mensaje cuando el producto no existe */}
          {productId === 'temp' && (
            <div className="bg-info-muted border border-info-muted rounded-lg p-4 text-center">
              <p className="text-sm text-info-muted-foreground">
                💡 Guarda el producto primero para poder subir imágenes y documentos
              </p>
            </div>
          )}
          
          {/* Upload de documentos */}
          <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-6 text-center">
            <FileText className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground mb-2">
              Arrastra documentos aquí o haz clic para seleccionar
            </p>
            <Input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.doc,.docx,.txt,.xls,.xlsx"
              multiple
              onChange={(e) => handleFileUpload(e, 'document')}
              className="hidden"
              disabled={uploading}
            />
            <Button
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading || productId === 'temp'}
            >
              {uploading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Subiendo...
                </>
              ) : (
                <>
                  <Upload className="mr-2 h-4 w-4" />
                  Seleccionar documentos
                </>
              )}
            </Button>
          </div>

          {/* Lista de documentos */}
          {documents.length > 0 && (
            <div className="space-y-2">
              {documents.map((file) => (
                <div key={file.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center gap-3">
                    {getFileIcon(file)}
                    <div>
                      <p className="text-sm font-medium">{file.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatFileSize(file.size)} • {formatDate(file.uploadedAt)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleViewFile(file)}
                    >
                      <Eye className="h-3 w-3" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => window.open(file.url, '_blank')}
                    >
                      <Download className="h-3 w-3" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleRemoveFile(file.id)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
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
              <div className="flex-1 bg-muted rounded-full h-2">
                <div 
                  className="bg-primary h-2 rounded-full transition-all duration-300"
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