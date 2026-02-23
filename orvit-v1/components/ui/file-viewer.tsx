'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  ZoomIn,
  ZoomOut,
  RotateCw,
  Download,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  Maximize2,
  Minimize2,
  X,
  Loader2,
  FileText,
  Image as ImageIcon,
  File,
  RefreshCw,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ===== TIPOS =====
export type FileType = 'pdf' | 'image' | 'video' | 'office' | 'other';

export interface FileViewerProps {
  url: string;
  fileName: string;
  open: boolean;
  onClose: () => void;
  onDownload?: () => void;
}

// ===== HELPERS =====
export function getFileType(fileName: string): FileType {
  const extension = fileName.toLowerCase().split('.').pop() || '';

  if (extension === 'pdf') return 'pdf';
  if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp', 'ico'].includes(extension)) return 'image';
  if (['mp4', 'webm', 'ogg', 'mov'].includes(extension)) return 'video';
  if (['doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'odt', 'ods', 'odp'].includes(extension)) return 'office';

  return 'other';
}

export function getFileIcon(fileName: string) {
  const fileType = getFileType(fileName);
  switch (fileType) {
    case 'pdf':
      return <FileText className="h-5 w-5 text-destructive" />;
    case 'image':
      return <ImageIcon className="h-5 w-5 text-success" />;
    case 'office':
      return <File className="h-5 w-5 text-primary" />;
    default:
      return <File className="h-5 w-5 text-muted-foreground" />;
  }
}

// ===== VISOR DE IMÁGENES =====
function ImageViewer({ url, fileName }: { url: string; fileName: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);

  const [scale, setScale] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  // Reset cuando cambia la imagen
  useEffect(() => {
    setScale(1);
    setRotation(0);
    setPosition({ x: 0, y: 0 });
    setLoading(true);
    setError(false);
  }, [url]);

  const handleZoomIn = () => setScale(prev => Math.min(prev + 0.25, 5));
  const handleZoomOut = () => setScale(prev => Math.max(prev - 0.25, 0.25));
  const handleRotate = () => setRotation(prev => (prev + 90) % 360);
  const handleReset = () => {
    setScale(1);
    setRotation(0);
    setPosition({ x: 0, y: 0 });
  };

  // Mouse drag
  const handleMouseDown = (e: React.MouseEvent) => {
    if (scale > 1) {
      setIsDragging(true);
      setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging && scale > 1) {
      setPosition({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y,
      });
    }
  };

  const handleMouseUp = () => setIsDragging(false);

  // Touch pinch-to-zoom
  const lastTouchDistance = useRef<number | null>(null);

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      lastTouchDistance.current = Math.sqrt(dx * dx + dy * dy);
    } else if (e.touches.length === 1 && scale > 1) {
      setIsDragging(true);
      setDragStart({
        x: e.touches[0].clientX - position.x,
        y: e.touches[0].clientY - position.y,
      });
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2 && lastTouchDistance.current) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const distance = Math.sqrt(dx * dx + dy * dy);
      const delta = distance - lastTouchDistance.current;

      setScale(prev => Math.min(Math.max(prev + delta * 0.01, 0.5), 5));
      lastTouchDistance.current = distance;
    } else if (e.touches.length === 1 && isDragging && scale > 1) {
      setPosition({
        x: e.touches[0].clientX - dragStart.x,
        y: e.touches[0].clientY - dragStart.y,
      });
    }
  };

  const handleTouchEnd = () => {
    lastTouchDistance.current = null;
    setIsDragging(false);
  };

  // Wheel zoom
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.1 : 0.1;
    setScale(prev => Math.min(Math.max(prev + delta, 0.25), 5));
  };

  // Double click to zoom
  const handleDoubleClick = () => {
    if (scale === 1) {
      setScale(2);
    } else {
      handleReset();
    }
  };

  return (
    <div className="h-full flex flex-col">
      {/* Toolbar */}
      <div className="flex items-center justify-center gap-1 p-2 border-b bg-background/95 backdrop-blur shrink-0">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" onClick={handleZoomOut} disabled={scale <= 0.25}>
                <ZoomOut className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Alejar</TooltipContent>
          </Tooltip>

          <div className="w-24 mx-2">
            <Slider
              value={[scale * 100]}
              min={25}
              max={500}
              step={25}
              onValueChange={([v]) => setScale(v / 100)}
            />
          </div>
          <span className="text-xs text-muted-foreground w-12 text-center">
            {Math.round(scale * 100)}%
          </span>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" onClick={handleZoomIn} disabled={scale >= 5}>
                <ZoomIn className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Acercar</TooltipContent>
          </Tooltip>

          <div className="w-px h-6 bg-border mx-2" />

          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" onClick={handleRotate}>
                <RotateCw className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Rotar 90°</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" onClick={handleReset}>
                <RefreshCw className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Restablecer</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      {/* Image container */}
      <div
        ref={containerRef}
        className={cn(
          "flex-1 min-h-0 overflow-hidden bg-black/90 flex items-center justify-center relative",
          scale > 1 ? "cursor-grab" : "cursor-zoom-in",
          isDragging && "cursor-grabbing"
        )}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onWheel={handleWheel}
        onDoubleClick={handleDoubleClick}
      >
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-white/50" />
          </div>
        )}

        {error ? (
          <div className="text-center text-white/70">
            <ImageIcon className="h-16 w-16 mx-auto mb-4 opacity-50" />
            <p>No se pudo cargar la imagen</p>
            <Button
              variant="outline"
              size="sm"
              className="mt-4"
              onClick={() => {
                setError(false);
                setLoading(true);
              }}
            >
              Reintentar
            </Button>
          </div>
        ) : (
          <img
            ref={imageRef}
            src={url}
            alt={fileName}
            className="max-w-none select-none transition-transform duration-100"
            style={{
              transform: `translate(${position.x}px, ${position.y}px) scale(${scale}) rotate(${rotation}deg)`,
              opacity: loading ? 0 : 1,
            }}
            onLoad={() => setLoading(false)}
            onError={() => {
              setLoading(false);
              setError(true);
            }}
            draggable={false}
          />
        )}

        {/* Hint de zoom en móvil */}
        {scale === 1 && !loading && !error && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-white/50 text-xs bg-black/50 px-3 py-1.5 rounded-full pointer-events-none">
            Pellizca para zoom • Doble tap para ampliar
          </div>
        )}
      </div>
    </div>
  );
}

// ===== VISOR DE PDF =====
type PDFViewMode = 'native' | 'google' | 'embed';

function PDFViewer({ url, fileName }: { url: string; fileName: string }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Detectar si es móvil
  const isMobile = typeof window !== 'undefined' && /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

  // Detectar si es blob URL (PDF generado localmente) - Google Docs no puede cargarlo
  const isBlobUrl = url.startsWith('blob:');

  // Para blob URLs siempre usar embed nativo, Google Docs no puede cargarlo
  // En móvil usar Google Docs solo para URLs externas
  const [viewMode, setViewMode] = useState<PDFViewMode>(
    isBlobUrl ? 'embed' : (isMobile ? 'google' : 'embed')
  );

  // Google Docs viewer
  const googleViewerUrl = `https://docs.google.com/viewer?url=${encodeURIComponent(url)}&embedded=true`;

  useEffect(() => {
    setLoading(true);
    setError(false);
  }, [url]);

  const handleIframeLoad = () => {
    setLoading(false);
  };

  const handleIframeError = () => {
    setLoading(false);
    setError(true);
  };

  // Obtener URL según el modo
  const getViewerUrl = () => {
    switch (viewMode) {
      case 'google':
        return googleViewerUrl;
      case 'native':
      case 'embed':
      default:
        return url;
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar con opciones de vista - responsive */}
      <div className="flex items-center justify-center gap-1 sm:gap-2 p-2 border-b bg-muted/30 shrink-0 flex-wrap">
        {/* Mostrar opciones de vista solo si NO es blob URL (Google Docs no funciona con blob) */}
        {!isBlobUrl && (
          <>
            <span className="text-xs text-muted-foreground mr-1 hidden sm:inline">Vista:</span>
            <div className="flex gap-1">
              <Button
                variant={viewMode === 'embed' ? 'default' : 'outline'}
                size="sm"
                className="h-7 text-xs px-2 sm:px-3"
                onClick={() => {
                  setViewMode('embed');
                  setLoading(true);
                  setError(false);
                }}
              >
                {isMobile ? 'Nativo' : 'Navegador'}
              </Button>
              <Button
                variant={viewMode === 'google' ? 'default' : 'outline'}
                size="sm"
                className="h-7 text-xs px-2 sm:px-3"
                onClick={() => {
                  setViewMode('google');
                  setLoading(true);
                  setError(false);
                }}
              >
                Google
              </Button>
            </div>
            <div className="w-px h-5 bg-border mx-0.5 sm:mx-1 hidden sm:block" />
          </>
        )}
        <Button
          variant="outline"
          size="sm"
          className="h-7 text-xs px-2 sm:px-3"
          onClick={() => window.open(url, '_blank')}
        >
          <ExternalLink className="h-3 w-3 sm:mr-1" />
          <span className="hidden sm:inline">Nueva pestaña</span>
        </Button>
      </div>

      {/* Contenedor del PDF */}
      <div className="flex-1 relative min-h-0 overflow-hidden">
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-muted z-10">
            <div className="text-center">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">Cargando PDF...</p>
            </div>
          </div>
        )}

        {error ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-muted">
            <FileText className="h-16 w-16 text-muted-foreground mb-4" />
            <p className="text-sm text-muted-foreground mb-4">
              No se pudo cargar el PDF con este visor
            </p>
            <div className="flex flex-wrap gap-2 justify-center">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setError(false);
                  setLoading(true);
                }}
              >
                Reintentar
              </Button>
              {viewMode !== 'google' && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setViewMode('google');
                    setError(false);
                    setLoading(true);
                  }}
                >
                  Probar Google Docs
                </Button>
              )}
              <Button size="sm" onClick={() => window.open(url, '_blank')}>
                <ExternalLink className="h-4 w-4 mr-2" />
                Abrir externamente
              </Button>
            </div>
          </div>
        ) : viewMode === 'embed' ? (
          // Para blob URLs usar iframe directo (funciona mejor)
          // Para URLs externas usar object con fallback a iframe
          isBlobUrl ? (
            <iframe
              ref={iframeRef}
              src={url}
              className="w-full h-full border-0"
              title={fileName}
              onLoad={handleIframeLoad}
              onError={handleIframeError}
            />
          ) : (
            <object
              data={url}
              type="application/pdf"
              className="w-full h-full"
              onLoad={handleIframeLoad}
              onError={handleIframeError}
            >
              {/* Fallback si object no funciona */}
              <iframe
                ref={iframeRef}
                src={url}
                className="w-full h-full border-0"
                title={fileName}
                onLoad={handleIframeLoad}
                onError={handleIframeError}
              />
            </object>
          )
        ) : (
          // Google Docs viewer
          <iframe
            ref={iframeRef}
            src={getViewerUrl()}
            className="w-full h-full border-0"
            title={fileName}
            onLoad={handleIframeLoad}
            onError={handleIframeError}
          />
        )}
      </div>
    </div>
  );
}

// ===== VISOR DE VIDEO =====
function VideoViewer({ url, fileName }: { url: string; fileName: string }) {
  const [error, setError] = useState(false);

  return (
    <div className="h-full flex items-center justify-center bg-black overflow-auto">
      {error ? (
        <div className="text-center text-white/70 p-8">
          <File className="h-16 w-16 mx-auto mb-4 opacity-50" />
          <p>No se pudo reproducir el video</p>
          <Button
            variant="outline"
            size="sm"
            className="mt-4"
            onClick={() => window.open(url, '_blank')}
          >
            Abrir externamente
          </Button>
        </div>
      ) : (
        <video
          src={url}
          controls
          className="max-w-full max-h-full"
          onError={() => setError(true)}
        >
          Tu navegador no soporta la reproducción de video.
        </video>
      )}
    </div>
  );
}

// ===== VISOR DE OFFICE (Google Docs Viewer) =====
function OfficeViewer({ url, fileName }: { url: string; fileName: string }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const googleViewerUrl = `https://docs.google.com/viewer?url=${encodeURIComponent(url)}&embedded=true`;

  return (
    <div className="h-full flex flex-col">
      <div className="flex-1 relative min-h-0">
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-muted z-10">
            <div className="text-center">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">Cargando documento...</p>
            </div>
          </div>
        )}

        {error ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-muted p-8 overflow-auto">
            <File className="h-16 w-16 text-muted-foreground mb-4 shrink-0" />
            <p className="text-sm text-muted-foreground mb-4 text-center">
              No se pudo cargar el documento
            </p>
            <Button size="sm" onClick={() => window.open(url, '_blank')}>
              <Download className="h-4 w-4 mr-2" />
              Descargar archivo
            </Button>
          </div>
        ) : (
          <iframe
            src={googleViewerUrl}
            className="w-full h-full border-0"
            title={fileName}
            onLoad={() => setLoading(false)}
            onError={() => {
              setLoading(false);
              setError(true);
            }}
          />
        )}
      </div>
    </div>
  );
}

// ===== VISOR DE OTROS ARCHIVOS =====
function OtherViewer({ url, fileName }: { url: string; fileName: string }) {
  return (
    <div className="h-full flex flex-col items-center justify-center bg-muted p-8 overflow-auto">
      <File className="h-20 w-20 text-muted-foreground mb-6 shrink-0" />
      <h3 className="text-lg font-medium mb-2 text-center">{fileName}</h3>
      <p className="text-sm text-muted-foreground mb-6 text-center">
        Este tipo de archivo no se puede previsualizar.<br />
        Puedes descargarlo para verlo en tu dispositivo.
      </p>
      <div className="flex flex-wrap gap-3 justify-center">
        <Button variant="outline" onClick={() => window.open(url, '_blank')}>
          <ExternalLink className="h-4 w-4 mr-2" />
          Abrir en nueva pestaña
        </Button>
        <Button asChild>
          <a href={url} download={fileName}>
            <Download className="h-4 w-4 mr-2" />
            Descargar
          </a>
        </Button>
      </div>
    </div>
  );
}

// ===== COMPONENTE PRINCIPAL =====
export function FileViewer({ url, fileName, open, onClose, onDownload }: FileViewerProps) {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);

  const fileType = getFileType(fileName);

  // Toggle fullscreen
  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      dialogRef.current?.requestFullscreen?.();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen?.();
      setIsFullscreen(false);
    }
  }, []);

  // Listener para cambios de fullscreen
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!open) return;
      if (e.key === 'Escape' && !document.fullscreenElement) {
        onClose();
      }
      if (e.key === 'f' || e.key === 'F') {
        toggleFullscreen();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose, toggleFullscreen]);

  const handleDownload = () => {
    if (onDownload) {
      onDownload();
    } else {
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      link.click();
    }
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent
        ref={dialogRef}
        className={cn(
          "flex flex-col p-0 gap-0",
          isFullscreen
            ? "max-w-none w-screen h-screen rounded-none"
            : "max-w-[100vw] w-[100vw] h-[100dvh] sm:max-w-[95vw] sm:w-[95vw] sm:h-[90vh] md:max-w-[90vw] md:w-[90vw] md:h-[85vh] rounded-none sm:rounded-lg"
        )}
      >
        {/* Header - responsive */}
        <DialogHeader className="flex flex-row items-center justify-between p-2 sm:p-3 border-b shrink-0">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <div className="shrink-0">{getFileIcon(fileName)}</div>
            <DialogTitle className="text-xs sm:text-sm font-medium truncate">
              {fileName}
            </DialogTitle>
          </div>
          <div className="flex items-center gap-0.5 sm:gap-1 shrink-0">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8 sm:h-9 sm:w-9" onClick={handleDownload}>
                    <Download className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Descargar</TooltipContent>
              </Tooltip>

              {/* Ocultar en móvil - ya está en el toolbar del PDF */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8 sm:h-9 sm:w-9 hidden sm:flex" onClick={() => window.open(url, '_blank')}>
                    <ExternalLink className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Abrir en nueva pestaña</TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8 sm:h-9 sm:w-9 hidden sm:flex" onClick={toggleFullscreen}>
                    {isFullscreen ? (
                      <Minimize2 className="h-4 w-4" />
                    ) : (
                      <Maximize2 className="h-4 w-4" />
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>{isFullscreen ? 'Salir de pantalla completa' : 'Pantalla completa'}</TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8 sm:h-9 sm:w-9" onClick={onClose}>
                    <X className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Cerrar</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </DialogHeader>

        {/* Content */}
        <div className="flex-1 min-h-0 overflow-auto">
          {fileType === 'image' && <ImageViewer url={url} fileName={fileName} />}
          {fileType === 'pdf' && <PDFViewer url={url} fileName={fileName} />}
          {fileType === 'video' && <VideoViewer url={url} fileName={fileName} />}
          {fileType === 'office' && <OfficeViewer url={url} fileName={fileName} />}
          {fileType === 'other' && <OtherViewer url={url} fileName={fileName} />}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default FileViewer;
