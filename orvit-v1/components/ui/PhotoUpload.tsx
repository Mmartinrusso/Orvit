import React, { useState, useRef, useCallback, useMemo } from 'react';
import { Button } from './button';
import { Card, CardContent, CardHeader, CardTitle } from './card';
import { Upload, X, Image as ImageIcon, CheckCircle, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import Cropper from 'react-easy-crop';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './dialog';
import getCroppedImg from '@/lib/getCroppedImg';
import { Slider } from './slider';

interface PhotoUploadProps {
  entityType: 'machine' | 'component' | 'area' | 'sector' | 'company' | 'product';
  entityId?: string | number;
  currentPhoto?: string;
  onPhotoUploaded: (photoUrl: string) => void;
  onPhotoRemoved?: () => void;
  className?: string;
  title?: string;
  description?: string;
  disabled?: boolean;
  showCropper?: boolean;
  setShowCropper?: (v: boolean) => void;
  imageSrc?: string | null;
  setImageSrc?: (v: string | null) => void;
  crop?: { x: number; y: number };
  setCrop?: (v: { x: number; y: number }) => void;
  zoom?: number;
  setZoom?: (v: number) => void;
  croppedAreaPixels?: any;
  setCroppedAreaPixels?: (v: any) => void;
}

export function PhotoUpload({
  entityType,
  entityId,
  currentPhoto,
  onPhotoUploaded,
  onPhotoRemoved,
  className,
  title = 'Foto',
  description = 'Sube una foto para esta entidad',
  disabled = false,
  showCropper: showCropperProp,
  setShowCropper: setShowCropperProp,
  imageSrc: imageSrcProp,
  setImageSrc: setImageSrcProp,
  crop: cropProp,
  setCrop: setCropProp,
  zoom: zoomProp,
  setZoom: setZoomProp,
  croppedAreaPixels: croppedAreaPixelsProp,
  setCroppedAreaPixels: setCroppedAreaPixelsProp,
}: PhotoUploadProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showCropperState, setShowCropperState] = useState(false);
  const [imageSrcState, setImageSrcState] = useState<string | null>(null);
  const [cropState, setCropState] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [zoomState, setZoomState] = useState(1);
  const [croppedAreaPixelsState, setCroppedAreaPixelsState] = useState<any>(null);

  const showCropper = showCropperProp !== undefined ? showCropperProp : showCropperState;
  const setShowCropper = setShowCropperProp || setShowCropperState;
  const imageSrc = imageSrcProp !== undefined ? imageSrcProp : imageSrcState;
  const setImageSrc = setImageSrcProp || setImageSrcState;
  const crop = cropProp !== undefined ? cropProp : cropState;
  const setCrop = setCropProp || setCropState;
  const zoom = zoomProp !== undefined ? zoomProp : zoomState;
  const setZoom = setZoomProp || setZoomState;
  const croppedAreaPixels = croppedAreaPixelsProp !== undefined ? croppedAreaPixelsProp : croppedAreaPixelsState;
  const setCroppedAreaPixels = setCroppedAreaPixelsProp || setCroppedAreaPixelsState;

  const handleFileSelect = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

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

    const reader = new FileReader();
    reader.onload = () => {
      setImageSrc(reader.result as string);
      setShowCropper(true);
    };
    reader.readAsDataURL(file);
  }, [setImageSrc, setShowCropper]);

  const onCropComplete = useCallback((_: any, croppedAreaPixels: any) => {
    setCroppedAreaPixels(croppedAreaPixels);
  }, [setCroppedAreaPixels]);

  const handleCropConfirm = useCallback(async () => {
    if (!imageSrc || !croppedAreaPixels) return;
    const croppedBlob = await getCroppedImg(imageSrc, croppedAreaPixels);
    setShowCropper(false);
    setImageSrc(null);
    await uploadFile(new File([croppedBlob], 'photo_cropped.png', { type: 'image/png' }));
  }, [imageSrc, croppedAreaPixels, setShowCropper, setImageSrc]);

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
      formData.append('fileType', 'photo');

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
      setSuccess('Foto subida exitosamente');
      
      if (typeof onPhotoUploaded === 'function') {
        onPhotoUploaded(data.url);
      } else {
        setError('Error: callback onPhotoUploaded no está definido correctamente');
      }

      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }

    } catch (error) {
      setError(error instanceof Error ? error.message : 'Error desconocido');
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  }, [entityType, entityId, onPhotoUploaded]);

  const handleRemovePhoto = useCallback(() => {
    setError(null);
    setSuccess(null);
    onPhotoRemoved?.();
  }, [onPhotoRemoved]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      uploadFile(files[0]);
    }
  }, [uploadFile]);

  const handleAdjustPhoto = useCallback(() => {
    if (currentPhoto) {
      setImageSrc(currentPhoto);
      setShowCropper(true);
    }
  }, [currentPhoto, setImageSrc, setShowCropper]);

  const handleCancelCrop = useCallback(() => {
    setShowCropper(false);
  }, [setShowCropper]);

  const handleZoomChange = useCallback(([z]: number[]) => {
    setZoom(z);
  }, [setZoom]);

  const handleDialogChange = useCallback((open: boolean) => {
    if (!open) setShowCropper(false);
  }, [setShowCropper]);

  const cropperContent = useMemo(() => {
    if (!imageSrc) return null;
    
    return (
      <Cropper
        image={imageSrc}
        crop={crop}
        zoom={zoom}
        aspect={1}
        onCropChange={setCrop}
        onZoomChange={setZoom}
        onCropComplete={onCropComplete}
        minZoom={1}
        maxZoom={3}
        cropShape="rect"
        showGrid={false}
        style={{ containerStyle: { borderRadius: 12 } }}
      />
    );
  }, [imageSrc, crop, zoom, setCrop, setZoom, onCropComplete]);

  return (
    <Card className={cn('w-full', className)}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ImageIcon className="h-5 w-5" />
          {title}
        </CardTitle>
        <p className="text-sm text-muted-foreground">{description}</p>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Foto actual */}
        {currentPhoto && (
          <div className="flex items-center gap-4 p-4 border rounded-lg">
            <img
              src={currentPhoto}
              alt="Foto actual"
              className="h-16 w-16 object-contain rounded-lg border"
            />
            <div className="flex-1">
              <p className="text-sm font-medium">Foto actual</p>
              <p className="text-xs text-muted-foreground">
                {currentPhoto.split('/').pop()}
              </p>
            </div>
            <div className="flex flex-col gap-2 items-end">
              <Button
                variant="outline"
                size="sm"
                onClick={handleAdjustPhoto}
                className="text-primary border-primary"
              >
                Ajustar foto
              </Button>
              {!disabled && onPhotoRemoved && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleRemovePhoto}
                  className="text-destructive hover:text-destructive"
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
          <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-lg">
            <CheckCircle className="h-4 w-4 text-green-600" />
            <p className="text-sm text-green-600">{success}</p>
          </div>
        )}

        {showCropper && (
          <Dialog
            open={showCropper}
            onOpenChange={handleDialogChange}
          >
            <DialogContent size="default">
              <DialogHeader>
                <DialogTitle>Ajusta la foto</DialogTitle>
                <DialogDescription>
                  Recorta y ajusta la foto para que se vea perfecta. Usa el zoom para acercar o alejar la imagen.
                </DialogDescription>
              </DialogHeader>
              <div className="w-full h-[320px] relative bg-background rounded-lg flex flex-col items-center justify-center">
                {cropperContent}
              </div>
              <div className="w-full flex flex-col items-center mt-4 gap-2">
                <label className="text-xs text-muted-foreground mb-1">Zoom</label>
                <Slider
                  min={1}
                  max={3}
                  step={0.01}
                  value={[zoom]}
                  onValueChange={handleZoomChange}
                  className="w-3/4"
                />
              </div>
              <div className="flex gap-4 mt-6 justify-end">
                <Button onClick={handleCancelCrop} variant="outline">Cancelar</Button>
                <Button onClick={handleCropConfirm} variant="default">Confirmar recorte</Button>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </CardContent>
    </Card>
  );
} 