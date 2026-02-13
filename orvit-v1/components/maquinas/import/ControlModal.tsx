'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  X,
  Maximize2,
  Minimize2,
  Search,
  FileText,
  Loader2,
  ExternalLink,
  ChevronRight,
  ChevronDown,
  Box,
  Cog,
  CheckCircle2,
  AlertCircle,
  Upload,
  Tag,
  Save,
} from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import type { ExtractedComponent } from './ComponentTree';

interface ImportFile {
  id: number;
  fileName: string;
  mimeType: string;
}

interface ControlModalProps {
  open: boolean;
  onClose: () => void;
  components: ExtractedComponent[];
  jobId: number;
  files: ImportFile[];
  onUpdateComponent?: (tempId: string, updates: Partial<ExtractedComponent>) => void;
}

// Readonly tree node for the control view
function ControlTreeNode({
  component,
  children,
  allComponents,
  depth,
  selectedId,
  onSelect,
}: {
  component: ExtractedComponent;
  children: ExtractedComponent[];
  allComponents: ExtractedComponent[];
  depth: number;
  selectedId?: string;
  onSelect: (c: ExtractedComponent) => void;
}) {
  const [isExpanded, setIsExpanded] = useState(true);
  const hasChildren = children.length > 0;
  const isSelected = component.tempId === selectedId;

  return (
    <div>
      <div
        className={cn(
          'flex items-center gap-1.5 py-1 px-2 rounded-md cursor-pointer hover:bg-muted/50 transition-colors group',
          isSelected && 'bg-primary/10'
        )}
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
        onClick={() => onSelect(component)}
      >
        <button
          onClick={(e) => {
            e.stopPropagation();
            setIsExpanded(!isExpanded);
          }}
          className="p-0.5 hover:bg-muted rounded"
          disabled={!hasChildren}
        >
          {hasChildren ? (
            isExpanded ? (
              <ChevronDown className="h-3.5 w-3.5" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5" />
            )
          ) : (
            <span className="w-3.5" />
          )}
        </button>

        {component.logo ? (
          <img
            src={component.logo}
            alt={component.name}
            className="h-4 w-4 rounded object-cover flex-shrink-0"
          />
        ) : component.type === 'SYSTEM' ? (
          <Box className="h-3.5 w-3.5 text-blue-600 flex-shrink-0" />
        ) : (
          <Cog className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
        )}

        <span className="text-sm truncate min-w-0 flex-1" title={component.name}>
          {component.name}
        </span>

        {component.quantity && component.quantity > 1 && (
          <Badge variant="secondary" className="text-[10px] h-4 px-1 shrink-0">
            x{component.quantity}
          </Badge>
        )}

        {component.itemNumber && (
          <span className="text-[10px] text-muted-foreground shrink-0 whitespace-nowrap">
            {component.itemNumber}
          </span>
        )}

        {component.confidence < 0.7 && (
          <AlertCircle className="h-3 w-3 text-amber-500 flex-shrink-0" />
        )}
      </div>

      {hasChildren && isExpanded && (
        <div>
          {children.map((child) => {
            const childChildren = allComponents.filter(
              (c) => c.parentTempId === child.tempId
            );
            return (
              <ControlTreeNode
                key={child.tempId}
                component={child}
                children={childChildren}
                allComponents={allComponents}
                depth={depth + 1}
                selectedId={selectedId}
                onSelect={onSelect}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

export function ControlModal({
  open,
  onClose,
  components,
  jobId,
  files,
  onUpdateComponent,
}: ControlModalProps) {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [selectedFileId, setSelectedFileId] = useState<number | null>(null);
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const [loadingUrl, setLoadingUrl] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(true);
  const [pdfError, setPdfError] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedComponent, setSelectedComponent] = useState<ExtractedComponent | null>(null);

  // Local file upload (for external AI mode where no files are in S3)
  const [localFileUrl, setLocalFileUrl] = useState<string | null>(null);
  const [localFileName, setLocalFileName] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const hasServerFiles = files.length > 0;

  const handleLocalFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Revoke previous blob URL
    if (localFileUrl) {
      URL.revokeObjectURL(localFileUrl);
    }

    const blobUrl = URL.createObjectURL(file);
    setLocalFileUrl(blobUrl);
    setLocalFileName(file.name);
    setPdfLoading(true);
    setPdfError(false);
  };

  // Select first file on open
  useEffect(() => {
    if (open && files.length > 0 && !selectedFileId) {
      setSelectedFileId(files[0].id);
    }
  }, [open, files, selectedFileId]);

  // Reset on close
  useEffect(() => {
    if (!open) {
      setSelectedFileId(null);
      setFileUrl(null);
      setSearch('');
      setSelectedComponent(null);
      // Don't reset localFileUrl/localFileName so user doesn't have to re-upload
    }
  }, [open]);

  // Cleanup blob URL on unmount
  useEffect(() => {
    return () => {
      if (localFileUrl) {
        URL.revokeObjectURL(localFileUrl);
      }
    };
  }, [localFileUrl]);

  // Fetch signed URL when file changes (server files)
  useEffect(() => {
    if (!selectedFileId) return;

    let cancelled = false;
    setLoadingUrl(true);
    setPdfLoading(true);
    setPdfError(false);
    setFileUrl(null);

    fetch(`/api/maquinas/import/files/${selectedFileId}/signed-url`)
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled && data.url) {
          setFileUrl(data.url);
          setLoadingUrl(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setLoadingUrl(false);
          setPdfError(true);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [selectedFileId]);

  // Determine active PDF URL (server file or local upload)
  const selectedFileName = files.find((f) => f.id === selectedFileId)?.fileName || '';
  const activePdfUrl = hasServerFiles ? fileUrl : localFileUrl;
  const activePdfName = hasServerFiles
    ? selectedFileName
    : localFileName || '';
  const isLoadingPdf = hasServerFiles ? (loadingUrl || pdfLoading) : pdfLoading;

  // Fullscreen toggle
  const toggleFullscreen = useCallback(() => {
    setIsFullscreen((prev) => !prev);
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'f' || e.key === 'F') {
        if (
          document.activeElement?.tagName !== 'INPUT' &&
          document.activeElement?.tagName !== 'TEXTAREA'
        ) {
          toggleFullscreen();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, toggleFullscreen]);

  // Filtered components
  const filteredComponents = useMemo(() => {
    if (!search.trim()) return components;
    const term = search.toLowerCase().trim();
    const matchingIds = new Set<string>();
    const parentIds = new Set<string>();

    components.forEach((c) => {
      const matches =
        c.name.toLowerCase().includes(term) ||
        (c.code && c.code.toLowerCase().includes(term)) ||
        (c.itemNumber && c.itemNumber.toLowerCase().includes(term)) ||
        (c.brand && c.brand.toLowerCase().includes(term));

      if (matches) {
        matchingIds.add(c.tempId);
        let parentId = c.parentTempId;
        while (parentId) {
          parentIds.add(parentId);
          const parent = components.find((p) => p.tempId === parentId);
          parentId = parent?.parentTempId || null;
        }
      }
    });

    return components.filter(
      (c) => matchingIds.has(c.tempId) || parentIds.has(c.tempId)
    );
  }, [components, search]);

  const rootComponents = useMemo(() => {
    return filteredComponents.filter((c) => !c.parentTempId);
  }, [filteredComponents]);

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent
        className={cn(
          'flex flex-col p-0 gap-0',
          isFullscreen
            ? 'max-w-none w-screen h-screen rounded-none'
            : 'max-w-[100vw] w-[100vw] h-[100dvh] sm:max-w-[99vw] sm:w-[99vw] sm:h-[99vh] md:max-w-[99vw] md:w-[99vw] md:h-[98vh] rounded-none sm:rounded-lg'
        )}
      >
        {/* Header */}
        <DialogHeader className="flex flex-row items-center justify-between p-3 border-b shrink-0">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <DialogTitle className="text-sm font-medium">
              Controlar extracción
            </DialogTitle>

            {/* File selector (server files) */}
            {files.length > 1 && (
              <Select
                value={String(selectedFileId || '')}
                onValueChange={(v) => setSelectedFileId(Number(v))}
              >
                <SelectTrigger className="w-[220px] h-8 text-xs">
                  <SelectValue placeholder="Seleccionar archivo" />
                </SelectTrigger>
                <SelectContent>
                  {files.map((f) => (
                    <SelectItem key={f.id} value={String(f.id)}>
                      {f.fileName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            {files.length === 1 && (
              <Badge variant="outline" className="text-xs">
                <FileText className="h-3 w-3 mr-1" />
                {files[0].fileName}
              </Badge>
            )}

            {/* Local file info / upload button (for external AI mode) */}
            {!hasServerFiles && (
              <>
                {localFileName && (
                  <Badge variant="outline" className="text-xs">
                    <FileText className="h-3 w-3 mr-1" />
                    {localFileName}
                  </Badge>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs gap-1.5"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload className="h-3.5 w-3.5" />
                  {localFileName ? 'Cambiar plano' : 'Subir plano'}
                </Button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.png,.jpg,.jpeg,.webp"
                  className="hidden"
                  onChange={handleLocalFileUpload}
                />
              </>
            )}
          </div>

          <div className="flex items-center gap-1 shrink-0">
            <TooltipProvider>
              {activePdfUrl && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => window.open(activePdfUrl, '_blank')}
                    >
                      <ExternalLink className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Abrir PDF en nueva pestaña</TooltipContent>
                </Tooltip>
              )}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={toggleFullscreen}
                  >
                    {isFullscreen ? (
                      <Minimize2 className="h-4 w-4" />
                    ) : (
                      <Maximize2 className="h-4 w-4" />
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  {isFullscreen ? 'Salir de pantalla completa' : 'Pantalla completa'}
                </TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={onClose}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Cerrar</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </DialogHeader>

        {/* 3-column layout: PDF | Tree | Edit */}
        <div className="flex-1 min-h-0 flex">
          {/* Left: PDF Viewer — 70% */}
          <div className="flex flex-col border-r min-h-0" style={{ width: '70%' }}>
            <div className="flex-1 relative min-h-0 overflow-hidden bg-muted/30">
              {isLoadingPdf && activePdfUrl && (
                <div className="absolute inset-0 flex items-center justify-center bg-muted z-10">
                  <div className="text-center">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">Cargando documento...</p>
                  </div>
                </div>
              )}

              {pdfError && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-muted">
                  <FileText className="h-16 w-16 text-muted-foreground mb-4" />
                  <p className="text-sm text-muted-foreground mb-4">
                    No se pudo cargar el documento
                  </p>
                  {activePdfUrl && (
                    <Button
                      size="sm"
                      onClick={() => window.open(activePdfUrl, '_blank')}
                    >
                      <ExternalLink className="h-4 w-4 mr-2" />
                      Abrir en nueva pestaña
                    </Button>
                  )}
                </div>
              )}

              {activePdfUrl && !pdfError && (
                localFileUrl && !hasServerFiles ? (
                  <iframe
                    src={activePdfUrl}
                    className="w-full h-full border-0"
                    title={activePdfName}
                    onLoad={() => setPdfLoading(false)}
                    onError={() => {
                      setPdfLoading(false);
                      setPdfError(true);
                    }}
                  />
                ) : (
                  <object
                    data={activePdfUrl}
                    type="application/pdf"
                    className="w-full h-full"
                    onLoad={() => setPdfLoading(false)}
                    onError={() => {
                      setPdfLoading(false);
                      setPdfError(true);
                    }}
                  >
                    <iframe
                      src={activePdfUrl}
                      className="w-full h-full border-0"
                      title={activePdfName}
                      onLoad={() => setPdfLoading(false)}
                      onError={() => {
                        setPdfLoading(false);
                        setPdfError(true);
                      }}
                    />
                  </object>
                )
              )}

              {/* No file loaded — upload prompt */}
              {!activePdfUrl && !loadingUrl && (
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <div
                    className="flex flex-col items-center justify-center p-8 border-2 border-dashed rounded-xl cursor-pointer hover:border-primary/50 hover:bg-muted/50 transition-colors"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Upload className="h-12 w-12 text-muted-foreground mb-4" />
                    <p className="text-sm font-medium mb-1">Subir plano o documento</p>
                    <p className="text-xs text-muted-foreground">
                      PDF, PNG, JPG — para comparar con los componentes extraídos
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Center: Component Tree — 15% */}
          <div className="flex flex-col min-h-0 border-r" style={{ width: '15%' }}>
            {/* Search + stats */}
            <div className="p-3 border-b space-y-2 shrink-0">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">
                  Componentes
                  <span className="text-muted-foreground font-normal ml-1.5">
                    ({components.length})
                  </span>
                </p>
                {search && (
                  <Badge variant="secondary" className="text-xs">
                    {filteredComponents.length} de {components.length}
                  </Badge>
                )}
              </div>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar componente..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-10 h-8 text-sm bg-background"
                />
                {search && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="absolute right-1 top-1/2 -translate-y-1/2 h-6 w-6 p-0"
                    onClick={() => setSearch('')}
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            </div>

            {/* Tree */}
            <ScrollArea className="flex-1 min-h-0">
              <div className="p-2 space-y-0.5">
                {rootComponents.length > 0 ? (
                  rootComponents.map((comp) => {
                    const children = filteredComponents.filter(
                      (c) => c.parentTempId === comp.tempId
                    );
                    return (
                      <ControlTreeNode
                        key={comp.tempId}
                        component={comp}
                        children={children}
                        allComponents={filteredComponents}
                        depth={0}
                        selectedId={selectedComponent?.tempId}
                        onSelect={setSelectedComponent}
                      />
                    );
                  })
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <Box className="h-10 w-10 mx-auto mb-3 opacity-50" />
                    <p className="text-sm">
                      {search
                        ? 'No se encontraron componentes'
                        : 'No hay componentes extraídos'}
                    </p>
                  </div>
                )}
              </div>
            </ScrollArea>
          </div>

          {/* Right: Edit Panel — 15% */}
          <div className="flex flex-col min-h-0" style={{ width: '15%' }}>
            {selectedComponent ? (
              <>
                {/* Header */}
                <div className="p-3 border-b shrink-0">
                  <div className="flex items-center gap-2">
                    {selectedComponent.logo ? (
                      <img
                        src={selectedComponent.logo}
                        alt={selectedComponent.name}
                        className="h-8 w-8 rounded object-cover border"
                      />
                    ) : (
                      <div className="h-8 w-8 rounded bg-muted flex items-center justify-center">
                        <Cog className="h-4 w-4 text-muted-foreground" />
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold truncate">
                        {selectedComponent.name}
                      </p>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <Badge variant="secondary" className="text-[10px] h-4 px-1.5">
                          {selectedComponent.type === 'SYSTEM' ? 'Sistema' : selectedComponent.type === 'PART' ? 'Parte' : 'Componente'}
                        </Badge>
                        <Badge
                          className="text-[10px] h-4 px-1.5"
                          style={{
                            backgroundColor: selectedComponent.confidence >= 0.9
                              ? '#10b98120' : selectedComponent.confidence >= 0.7
                              ? '#f59e0b20' : '#ef444420',
                            color: selectedComponent.confidence >= 0.9
                              ? '#10b981' : selectedComponent.confidence >= 0.7
                              ? '#f59e0b' : '#ef4444',
                          }}
                        >
                          {Math.round(selectedComponent.confidence * 100)}%
                        </Badge>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 shrink-0"
                      onClick={() => setSelectedComponent(null)}
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>

                {/* Edit fields */}
                <ScrollArea className="flex-1 min-h-0">
                  <div className="p-3 space-y-4">
                    {/* Identificación */}
                    <div>
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1">
                        <Tag className="h-3 w-3" />
                        Identificación
                      </p>
                      <div className="space-y-2">
                        <div>
                          <Label className="text-xs">Nombre</Label>
                          <Input
                            value={selectedComponent.name}
                            onChange={(e) => onUpdateComponent?.(selectedComponent.tempId, { name: e.target.value })}
                            className="h-8 text-sm"
                            disabled={!onUpdateComponent}
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <Label className="text-xs">Tipo</Label>
                            <Select
                              value={selectedComponent.type}
                              onValueChange={(v) => onUpdateComponent?.(selectedComponent.tempId, { type: v })}
                              disabled={!onUpdateComponent}
                            >
                              <SelectTrigger className="h-8 text-sm">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="SYSTEM">Sistema</SelectItem>
                                <SelectItem value="COMPONENT">Componente</SelectItem>
                                <SelectItem value="PART">Parte</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <Label className="text-xs">Cantidad</Label>
                            <Input
                              type="number"
                              min={1}
                              value={selectedComponent.quantity || 1}
                              onChange={(e) => onUpdateComponent?.(selectedComponent.tempId, { quantity: parseInt(e.target.value) || 1 })}
                              className="h-8 text-sm"
                              disabled={!onUpdateComponent}
                            />
                          </div>
                        </div>
                        <div>
                          <Label className="text-xs">Pos (N° en plano)</Label>
                          <Input
                            value={selectedComponent.itemNumber || ''}
                            onChange={(e) => onUpdateComponent?.(selectedComponent.tempId, { itemNumber: e.target.value })}
                            placeholder="ej: 12, 3.1, 4.2"
                            className="h-8 text-sm"
                            disabled={!onUpdateComponent}
                          />
                        </div>
                      </div>
                    </div>

                    <Separator />

                    {/* Catálogo */}
                    <div>
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1">
                        <FileText className="h-3 w-3" />
                        Catálogo
                      </p>
                      <div className="space-y-2">
                        <div>
                          <Label className="text-xs">Código</Label>
                          <Input
                            value={selectedComponent.code || ''}
                            onChange={(e) => onUpdateComponent?.(selectedComponent.tempId, { code: e.target.value })}
                            className="h-8 text-sm"
                            disabled={!onUpdateComponent}
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <Label className="text-xs">Marca</Label>
                            <Input
                              value={selectedComponent.brand || ''}
                              onChange={(e) => onUpdateComponent?.(selectedComponent.tempId, { brand: e.target.value })}
                              className="h-8 text-sm"
                              disabled={!onUpdateComponent}
                            />
                          </div>
                          <div>
                            <Label className="text-xs">Modelo</Label>
                            <Input
                              value={selectedComponent.model || ''}
                              onChange={(e) => onUpdateComponent?.(selectedComponent.tempId, { model: e.target.value })}
                              className="h-8 text-sm"
                              disabled={!onUpdateComponent}
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </ScrollArea>
              </>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground">
                <Box className="h-10 w-10 mb-3 opacity-40" />
                <p className="text-sm font-medium">Seleccioná un componente</p>
                <p className="text-xs mt-1">para ver y editar sus datos</p>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
