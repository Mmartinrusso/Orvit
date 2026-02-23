'use client';

import { formatNumber } from '@/lib/utils';
import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogBody,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { FileText, Upload, Loader2, X } from 'lucide-react';

interface Instructive {
  id: number;
  title: string;
  description?: string;
  fileUrl?: string;
  fileName?: string;
  fileType?: string;
  fileSize?: number;
  isActive: boolean;
  createdAt: string;
  createdBy: {
    id: number;
    name: string;
  };
}

interface InstructiveDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workStationId: number;
  instructive?: Instructive | null;
  onSuccess: () => void;
}

export default function InstructiveDialog({
  open,
  onOpenChange,
  workStationId,
  instructive,
  onSuccess
}: InstructiveDialogProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    fileUrl: '',
    fileName: '',
    fileType: '',
    fileSize: 0,
    isActive: true
  });

  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  // Cargar datos del instructivo si se está editando
  useEffect(() => {
    if (instructive) {
      setFormData({
        title: instructive.title,
        description: instructive.description || '',
        fileUrl: instructive.fileUrl || '',
        fileName: instructive.fileName || '',
        fileType: instructive.fileType || '',
        fileSize: instructive.fileSize || 0,
        isActive: instructive.isActive
      });
      setSelectedFile(null);
    } else {
      setFormData({
        title: '',
        description: '',
        fileUrl: '',
        fileName: '',
        fileType: '',
        fileSize: 0,
        isActive: true
      });
      setSelectedFile(null);
    }
  }, [instructive]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setFormData(prev => ({
        ...prev,
        fileName: file.name,
        fileType: file.type,
        fileSize: file.size
      }));
    }
  };

  const handleRemoveFile = () => {
    setSelectedFile(null);
    setFormData(prev => ({
      ...prev,
      fileName: '',
      fileType: '',
      fileSize: 0
    }));
  };

  const uploadFile = async (file: File): Promise<string> => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('entityType', 'workstation');
    formData.append('entityId', workStationId.toString());
    formData.append('fileType', 'instructive');

    // Usar directamente el endpoint de upload
    const response = await fetch('/api/upload', {
      method: 'POST',
      body: formData
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('❌ Error en upload:', errorData);
      throw new Error(errorData.error || 'Error al subir el archivo');
    }

    const data = await response.json();
    return data.url;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.title) {
      toast({
        title: 'Error',
        description: 'Por favor ingresa el título del instructivo',
        variant: 'destructive'
      });
      return;
    }

    setLoading(true);

    try {
      let fileUrl = formData.fileUrl;

      // Si hay un archivo seleccionado, subirlo primero
      if (selectedFile) {
        setUploading(true);
        fileUrl = await uploadFile(selectedFile);
        setUploading(false);
      }

      const url = instructive 
        ? `/api/work-stations/${workStationId}/instructives/${instructive.id}`
        : `/api/work-stations/${workStationId}/instructives`;
      
      const method = instructive ? 'PUT' : 'POST';
      
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...formData,
          fileUrl
        }),
      });

      if (response.ok) {
        toast({
          title: 'Éxito',
          description: instructive 
            ? 'Instructivo actualizado correctamente'
            : 'Instructivo creado correctamente'
        });
        onSuccess();
      } else {
        const errorData = await response.json();
        toast({
          title: 'Error',
          description: errorData.error || 'Error al guardar el instructivo',
          variant: 'destructive'
        });
      }
    } catch (error) {
      console.error('Error guardando instructivo:', error);
      toast({
        title: 'Error',
        description: 'Error al guardar el instructivo',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (field: string, value: string | boolean) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            {instructive ? 'Editar Instructivo' : 'Nuevo Instructivo'}
          </DialogTitle>
          <DialogDescription>
            {instructive 
              ? 'Modifica la información del instructivo'
              : 'Crea un nuevo instructivo para este puesto de trabajo'
            }
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
          <DialogBody>
          <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Título *</Label>
            <Input
              id="title"
              value={formData.title}
              onChange={(e) => handleInputChange('title', e.target.value)}
              placeholder="Ej: Procedimiento de soldadura"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Descripción</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => handleInputChange('description', e.target.value)}
              placeholder="Descripción del instructivo..."
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="file">Archivo</Label>
            <div className="space-y-2">
              {selectedFile ? (
                <div className="flex items-center justify-between p-3 border rounded-lg bg-muted/50">
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">{selectedFile.name}</span>
                    <span className="text-xs text-muted-foreground">
                      ({formatNumber(selectedFile.size / 1024 / 1024, 2)} MB)
                    </span>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={handleRemoveFile}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-6 text-center">
                  <Upload className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground mb-2">
                    Arrastra un archivo aquí o haz clic para seleccionar
                  </p>
                  <Input
                    id="file"
                    type="file"
                    onChange={handleFileChange}
                    className="hidden"
                    accept=".pdf,.doc,.docx,.txt,.jpg,.jpeg,.png"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => document.getElementById('file')?.click()}
                  >
                    Seleccionar archivo
                  </Button>
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id="isActive"
              checked={formData.isActive}
              onChange={(e) => handleInputChange('isActive', e.target.checked)}
              className="rounded"
            />
            <Label htmlFor="isActive" className="text-sm">
              Instructivo activo
            </Label>
          </div>
          </div>
          </DialogBody>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
              size="default"
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={loading || uploading} size="default">
              {(loading || uploading) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {uploading ? 'Subiendo archivo...' : (instructive ? 'Actualizar' : 'Crear')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
} 