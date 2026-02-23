'use client';

import React, { useState, useMemo, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogBody,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Box,
  Search,
  Upload,
  FileText,
  ExternalLink,
  Info,
  Loader2,
  Download,
  Link as LinkIcon,
  Folder,
  AlertCircle,
  CheckCircle,
  Database,
  Globe,
  Wrench,
  Cog,
  CircleDot,
  ChevronRight,
  Sparkles,
} from 'lucide-react';
import { toast } from 'sonner';
import { Machine, MachineComponent } from '@/lib/types';
import { cn } from '@/lib/utils';

// Patrones de piezas estándar que tienen modelos 3D disponibles
const STANDARD_PART_PATTERNS = [
  { pattern: /\bSKF\b/i, source: 'skf', name: 'SKF', confidence: 'high' },
  { pattern: /\bFAG\b/i, source: 'schaeffler', name: 'FAG/Schaeffler', confidence: 'high' },
  { pattern: /\bNSK\b/i, source: 'nsk', name: 'NSK', confidence: 'high' },
  { pattern: /\bNTN\b/i, source: 'ntn', name: 'NTN', confidence: 'high' },
  { pattern: /\bTIMKEN\b/i, source: 'timken', name: 'Timken', confidence: 'high' },
  { pattern: /\bDIN\s*\d+/i, source: 'traceparts', name: 'DIN Standard', confidence: 'high' },
  { pattern: /\bISO\s*\d+/i, source: 'traceparts', name: 'ISO Standard', confidence: 'high' },
  { pattern: /\bUCF[A-Z]?\d+/i, source: 'traceparts', name: 'Bearing Unit', confidence: 'high' },
  { pattern: /\bUCP[A-Z]?\d+/i, source: 'traceparts', name: 'Pillow Block', confidence: 'high' },
  { pattern: /rodamiento|bearing/i, source: 'traceparts', name: 'Rodamiento', confidence: 'medium' },
  { pattern: /motor|motore/i, source: 'traceparts', name: 'Motor', confidence: 'medium' },
  { pattern: /cilindro|cylinder/i, source: 'traceparts', name: 'Cilindro', confidence: 'medium' },
  { pattern: /valvula|valve/i, source: 'traceparts', name: 'Válvula', confidence: 'medium' },
  { pattern: /reductor|gearbox/i, source: 'traceparts', name: 'Reductor', confidence: 'medium' },
  { pattern: /FESTO/i, source: 'festo', name: 'FESTO', confidence: 'high' },
  { pattern: /SMC/i, source: 'smc', name: 'SMC', confidence: 'high' },
  { pattern: /SIEMENS/i, source: 'siemens', name: 'Siemens', confidence: 'medium' },
  { pattern: /ABB/i, source: 'abb', name: 'ABB', confidence: 'medium' },
];

// URLs de búsqueda por fuente
const SEARCH_URLS: Record<string, string> = {
  skf: 'https://www.skf.com/group/search-results.html?q=',
  schaeffler: 'https://medias.schaeffler.com/en/search?q=',
  nsk: 'https://www.nsk.com/en/search.html?q=',
  traceparts: 'https://www.traceparts.com/en/search/',
  grabcad: 'https://grabcad.com/library?query=',
  festo: 'https://www.festo.com/cat/search?query=',
  smc: 'https://www.smcworld.com/webcatalog/search.do?searchWord=',
  siemens: 'https://mall.industry.siemens.com/mall/en/WW/Catalog/Products?SearchWord=',
  abb: 'https://new.abb.com/search#?term=',
  generic: 'https://www.traceparts.com/en/search/',
};

// Función para detectar si un componente tiene modelo 3D disponible
function detectModel3DAvailability(component: { name?: string; brand?: string; model?: string; partNumber?: string }) {
  const searchText = [
    component.name || '',
    component.brand || '',
    component.model || '',
    component.partNumber || '',
  ].join(' ');

  for (const { pattern, source, name, confidence } of STANDARD_PART_PATTERNS) {
    if (pattern.test(searchText)) {
      return { available: true, source, sourceName: name, confidence };
    }
  }

  return { available: false, source: 'generic', sourceName: null, confidence: 'low' };
}

// Función para generar URL de búsqueda para un componente
function generateSearchUrl(component: { name?: string; brand?: string; model?: string; partNumber?: string }) {
  const detection = detectModel3DAvailability(component);
  const baseUrl = SEARCH_URLS[detection.source] || SEARCH_URLS.generic;

  // Construir query de búsqueda
  const queryParts = [
    component.partNumber,
    component.model,
    component.brand,
    component.name,
  ].filter(Boolean);

  const query = queryParts.join(' ').trim();
  return { url: `${baseUrl}${encodeURIComponent(query)}`, detection, query };
}

// Lazy load del visor 3D para no afectar carga inicial
const Machine3DViewer = dynamic(
  () => import('../Machine3DViewer').then(mod => mod.Machine3DViewer),
  {
    loading: () => (
      <div className="h-[400px] rounded-lg border bg-muted/30 flex items-center justify-center">
        <div className="flex flex-col items-center gap-2">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Cargando visor 3D...</p>
        </div>
      </div>
    ),
    ssr: false // Three.js no funciona en SSR
  }
);

interface ComponentWithTools {
  id: number | string;
  name: string;
  type?: string;
  brand?: string;
  model?: string;
  partNumber?: string;
  description?: string;
  model3dUrl?: string; // URL del modelo 3D del componente
  tools?: Array<{
    id: number;
    name: string;
    brand?: string;
    model?: string;
    partNumber?: string;
    model3dUrl?: string; // URL del modelo 3D del tool/repuesto
  }>;
  children?: ComponentWithTools[];
}

interface Machine3DViewerTabProps {
  machine: Machine & { components?: ComponentWithTools[] };
  companyId: number;
  documents?: Array<{
    id: number | string;
    url: string;
    fileName: string;
    folder?: string | null;
  }>;
  onUpload3DModel?: (file: File) => Promise<void>;
  onLinkModel?: (url: string, fileName: string) => Promise<void>;
}

// Fuentes de modelos 3D externos
const MODEL_SOURCES = [
  {
    id: 'traceparts',
    name: 'TraceParts',
    description: 'Catálogo de piezas industriales',
    url: 'https://www.traceparts.com/en/search/',
    icon: Database,
  },
  {
    id: '3dcontentcentral',
    name: '3D ContentCentral',
    description: 'Biblioteca de Dassault Systèmes',
    url: 'https://www.3dcontentcentral.com/',
    icon: Globe,
  },
  {
    id: 'grabcad',
    name: 'GrabCAD',
    description: 'Comunidad de modelos CAD',
    url: 'https://grabcad.com/library',
    icon: Globe,
  },
  {
    id: 'skf',
    name: 'SKF CAD Models',
    description: 'Rodamientos y piezas SKF',
    url: 'https://www.skf.com/group/digital-tools/select-and-evaluate/cad-information',
    icon: Database,
  },
];

export function Machine3DViewerTab({
  machine,
  companyId,
  documents = [],
  onUpload3DModel,
  onLinkModel,
}: Machine3DViewerTabProps) {
  // Estados
  const [selectedModelUrl, setSelectedModelUrl] = useState<string | null>(null);
  const [showUploadDialog, setShowUploadDialog] = useState(false);
  const [showLinkDialog, setShowLinkDialog] = useState(false);
  const [showSourcesDialog, setShowSourcesDialog] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');
  const [linkFileName, setLinkFileName] = useState('');
  const [selectedComponent, setSelectedComponent] = useState<string | null>(null);

  // Estados para modelos 3D de componentes individuales
  const [viewingComponent, setViewingComponent] = useState<ComponentWithTools | null>(null);
  const [editingComponent, setEditingComponent] = useState<{
    type: 'component' | 'tool';
    id: number | string;
    name: string;
    currentUrl?: string;
  } | null>(null);
  const [componentModelUrl, setComponentModelUrl] = useState('');
  const [isSavingComponentModel, setIsSavingComponentModel] = useState(false);

  // Filtrar documentos 3D (GLB, GLTF, OBJ)
  const model3DDocuments = useMemo(() => {
    return documents.filter(doc => {
      const ext = doc.fileName.toLowerCase().split('.').pop();
      return ['glb', 'gltf', 'obj'].includes(ext || '');
    });
  }, [documents]);

  // Modelo actualmente seleccionado o el primero disponible
  const activeModelUrl = useMemo(() => {
    if (selectedModelUrl) return selectedModelUrl;
    if (model3DDocuments.length > 0) return model3DDocuments[0].url;
    return null;
  }, [selectedModelUrl, model3DDocuments]);

  // Handlers
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const ext = file.name.toLowerCase().split('.').pop();
    if (!['glb', 'gltf'].includes(ext || '')) {
      toast.error('Formato no soportado. Usa archivos GLB o GLTF');
      return;
    }

    if (file.size > 50 * 1024 * 1024) { // 50MB max
      toast.error('El archivo es muy grande. Máximo 50MB');
      return;
    }

    try {
      setIsUploading(true);
      if (onUpload3DModel) {
        await onUpload3DModel(file);
        toast.success('Modelo 3D subido exitosamente');
        setShowUploadDialog(false);
      }
    } catch (error) {
      toast.error('Error al subir el modelo 3D');
    } finally {
      setIsUploading(false);
    }
  };

  const handleLinkModel = async () => {
    if (!linkUrl.trim()) {
      toast.error('Ingresa una URL válida');
      return;
    }

    const ext = linkUrl.toLowerCase().split('.').pop()?.split('?')[0];
    if (!['glb', 'gltf'].includes(ext || '')) {
      toast.error('La URL debe apuntar a un archivo GLB o GLTF');
      return;
    }

    try {
      setIsUploading(true);
      if (onLinkModel) {
        await onLinkModel(linkUrl, linkFileName || 'modelo-3d.glb');
        toast.success('Modelo 3D vinculado');
        setShowLinkDialog(false);
        setLinkUrl('');
        setLinkFileName('');
      } else {
        // Si no hay handler, usar directamente la URL
        setSelectedModelUrl(linkUrl);
        setShowLinkDialog(false);
      }
    } catch (error) {
      toast.error('Error al vincular el modelo');
    } finally {
      setIsUploading(false);
    }
  };

  const handleComponentClick = useCallback((componentName: string) => {
    setSelectedComponent(componentName);
    toast.info(`Componente: ${componentName}`);
  }, []);

  // Handler para ver modelo 3D de un componente
  const handleViewComponentModel = useCallback((component: ComponentWithTools) => {
    if (component.model3dUrl) {
      setViewingComponent(component);
      setSelectedModelUrl(component.model3dUrl);
    }
  }, []);

  // Handler para ver modelo 3D de un tool
  const handleViewToolModel = useCallback((tool: { id: number; name: string; model3dUrl?: string }) => {
    if (tool.model3dUrl) {
      setViewingComponent({ id: tool.id, name: tool.name, model3dUrl: tool.model3dUrl });
      setSelectedModelUrl(tool.model3dUrl);
    }
  }, []);

  // Handler para abrir diálogo de edición de modelo de componente
  const handleEditComponentModel = useCallback((component: ComponentWithTools) => {
    setEditingComponent({
      type: 'component',
      id: component.id,
      name: component.name,
      currentUrl: component.model3dUrl,
    });
    setComponentModelUrl(component.model3dUrl || '');
  }, []);

  // Handler para abrir diálogo de edición de modelo de tool
  const handleEditToolModel = useCallback((tool: { id: number; name: string; model3dUrl?: string }) => {
    setEditingComponent({
      type: 'tool',
      id: tool.id,
      name: tool.name,
      currentUrl: tool.model3dUrl,
    });
    setComponentModelUrl(tool.model3dUrl || '');
  }, []);

  // Handler para guardar modelo 3D de componente o tool
  const handleSaveComponentModel = useCallback(async () => {
    if (!editingComponent) return;

    // Validar URL si se proporciona
    if (componentModelUrl.trim()) {
      const ext = componentModelUrl.toLowerCase().split('.').pop()?.split('?')[0];
      if (!['glb', 'gltf'].includes(ext || '')) {
        toast.error('La URL debe apuntar a un archivo GLB o GLTF');
        return;
      }
    }

    try {
      setIsSavingComponentModel(true);
      const endpoint = editingComponent.type === 'component'
        ? `/api/components/${editingComponent.id}`
        : `/api/tools/${editingComponent.id}`;

      const response = await fetch(endpoint, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model3dUrl: componentModelUrl.trim() || null,
        }),
      });

      if (!response.ok) {
        throw new Error('Error al guardar');
      }

      toast.success(`Modelo 3D ${componentModelUrl.trim() ? 'guardado' : 'eliminado'} exitosamente`);
      setEditingComponent(null);
      setComponentModelUrl('');

      // Forzar recarga de la página para actualizar los datos
      // En producción, sería mejor usar un callback o invalidar cache
      window.location.reload();
    } catch (error) {
      console.error('Error saving component model:', error);
      toast.error('Error al guardar el modelo 3D');
    } finally {
      setIsSavingComponentModel(false);
    }
  }, [editingComponent, componentModelUrl]);

  // Contar componentes con modelos 3D
  const componentsWithModels = useMemo(() => {
    if (!machine.components) return { count: 0, total: 0 };

    let count = 0;
    let total = 0;

    const countRecursive = (components: ComponentWithTools[]) => {
      for (const comp of components) {
        total++;
        if (comp.model3dUrl) count++;

        if (comp.tools) {
          for (const tool of comp.tools) {
            total++;
            if (tool.model3dUrl) count++;
          }
        }

        if (comp.children) {
          countRecursive(comp.children);
        }
      }
    };

    countRecursive(machine.components);
    return { count, total };
  }, [machine.components]);

  return (
    <TooltipProvider>
      <div className="p-4 space-y-4">
        {/* Header con controles */}
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <Box className="h-5 w-5 text-primary" />
              Visor 3D
            </h3>
            <p className="text-xs text-muted-foreground">
              Visualiza el modelo 3D de la máquina y sus componentes
            </p>
          </div>

          <div className="flex items-center gap-2">
            {/* Selector de modelo si hay varios */}
            {model3DDocuments.length > 1 && (
              <Select
                value={selectedModelUrl || model3DDocuments[0]?.url}
                onValueChange={setSelectedModelUrl}
              >
                <SelectTrigger className="w-[200px] h-8 text-xs">
                  <SelectValue placeholder="Seleccionar modelo" />
                </SelectTrigger>
                <SelectContent>
                  {model3DDocuments.map((doc) => (
                    <SelectItem key={doc.id} value={doc.url}>
                      {doc.fileName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            {/* Botón para vincular modelo por URL */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 gap-1"
                  onClick={() => setShowLinkDialog(true)}
                >
                  <LinkIcon className="h-4 w-4" />
                  <span className="hidden sm:inline">Vincular URL</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent>Vincular modelo desde URL</TooltipContent>
            </Tooltip>

            {/* Botón para subir modelo */}
            {onUpload3DModel && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 gap-1"
                    onClick={() => setShowUploadDialog(true)}
                  >
                    <Upload className="h-4 w-4" />
                    <span className="hidden sm:inline">Subir modelo</span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Subir archivo GLB/GLTF</TooltipContent>
              </Tooltip>
            )}

            {/* Botón para buscar en fuentes externas */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="default"
                  size="sm"
                  className="h-8 gap-1"
                  onClick={() => setShowSourcesDialog(true)}
                >
                  <Search className="h-4 w-4" />
                  <span className="hidden sm:inline">Buscar modelos</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent>Buscar en catálogos 3D</TooltipContent>
            </Tooltip>
          </div>
        </div>

        {/* Visor 3D */}
        <Machine3DViewer
          modelUrl={activeModelUrl}
          height="450px"
          onComponentClick={handleComponentClick}
        />

        {/* Info del modelo actual */}
        {activeModelUrl && (
          <Card>
            <CardContent className="p-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-success" />
                  <span className="text-sm font-medium">Modelo cargado</span>
                </div>
                <Badge variant="secondary" className="text-xs">
                  {model3DDocuments.find(d => d.url === activeModelUrl)?.fileName || 'Modelo externo'}
                </Badge>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Componentes con modelos 3D */}
        {machine.components && machine.components.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-warning" />
                Modelos 3D de Componentes
                <Badge variant="secondary" className="ml-auto text-xs">
                  {componentsWithModels.count}/{componentsWithModels.total} con modelo
                </Badge>
              </CardTitle>
              <CardDescription className="text-xs">
                Haz clic en un componente para ver su modelo 3D o agregar uno nuevo
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[300px] pr-4">
                <div className="space-y-1">
                  {machine.components.map((component) => {
                    const { url, detection } = generateSearchUrl({
                      name: component.name,
                      brand: component.brand,
                      model: component.model,
                      partNumber: component.partNumber,
                    });
                    const hasModel = !!component.model3dUrl;
                    const isViewing = viewingComponent?.id === component.id;

                    return (
                      <div key={component.id}>
                        {/* Componente principal */}
                        <div
                          className={cn(
                            "flex items-center gap-2 p-2 rounded-lg transition-colors group",
                            hasModel
                              ? "bg-primary/5 hover:bg-primary/10 border border-primary/20"
                              : "hover:bg-muted/50",
                            isViewing && "ring-2 ring-primary"
                          )}
                        >
                          <div className={cn(
                            "h-8 w-8 rounded-full flex items-center justify-center flex-shrink-0",
                            hasModel
                              ? "bg-primary/20"
                              : detection.available
                                ? detection.confidence === 'high'
                                  ? "bg-success-muted"
                                  : "bg-warning-muted"
                                : "bg-muted"
                          )}>
                            {hasModel ? (
                              <Box className="h-4 w-4 text-primary" />
                            ) : detection.available ? (
                              <CheckCircle className={cn(
                                "h-4 w-4",
                                detection.confidence === 'high' ? "text-success" : "text-warning"
                              )} />
                            ) : (
                              <Cog className="h-4 w-4 text-muted-foreground" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">
                              {component.name}
                            </p>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              {component.brand && <span>{component.brand}</span>}
                              {component.model && <span>• {component.model}</span>}
                              {component.partNumber && <span>• {component.partNumber}</span>}
                            </div>
                          </div>
                          <div className="flex items-center gap-1">
                            {hasModel ? (
                              <>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-7 w-7 p-0"
                                      onClick={() => handleViewComponentModel(component)}
                                    >
                                      <Box className="h-3.5 w-3.5 text-primary" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>Ver modelo 3D</TooltipContent>
                                </Tooltip>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-7 w-7 p-0"
                                      onClick={() => handleEditComponentModel(component)}
                                    >
                                      <LinkIcon className="h-3.5 w-3.5" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>Editar URL del modelo</TooltipContent>
                                </Tooltip>
                              </>
                            ) : (
                              <>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-7 px-2 text-xs"
                                      onClick={() => handleEditComponentModel(component)}
                                    >
                                      <LinkIcon className="h-3 w-3 mr-1" />
                                      Agregar 3D
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>Agregar modelo 3D</TooltipContent>
                                </Tooltip>
                                {detection.available && (
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <a
                                        href={url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="h-7 w-7 p-0 inline-flex items-center justify-center rounded-md hover:bg-muted"
                                        onClick={(e) => e.stopPropagation()}
                                      >
                                        <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
                                      </a>
                                    </TooltipTrigger>
                                    <TooltipContent>Buscar en {detection.sourceName}</TooltipContent>
                                  </Tooltip>
                                )}
                              </>
                            )}
                          </div>
                        </div>

                        {/* Herramientas/repuestos del componente */}
                        {component.tools && component.tools.length > 0 && (
                          <div className="ml-6 pl-4 border-l border-dashed space-y-1 mt-1">
                            {component.tools.map((tool) => {
                              const toolSearch = generateSearchUrl({
                                name: tool.name,
                                brand: tool.brand,
                                model: tool.model,
                                partNumber: tool.partNumber,
                              });
                              const toolHasModel = !!tool.model3dUrl;
                              const isToolViewing = viewingComponent?.id === tool.id;

                              return (
                                <div
                                  key={tool.id}
                                  className={cn(
                                    "flex items-center gap-2 p-1.5 rounded-md transition-colors group text-xs",
                                    toolHasModel
                                      ? "bg-primary/5 border border-primary/20"
                                      : "hover:bg-muted/50",
                                    isToolViewing && "ring-2 ring-primary"
                                  )}
                                >
                                  {toolHasModel ? (
                                    <Box className="h-3 w-3 text-primary flex-shrink-0" />
                                  ) : toolSearch.detection.available ? (
                                    <CircleDot className={cn(
                                      "h-3 w-3 flex-shrink-0",
                                      toolSearch.detection.confidence === 'high' ? "text-success" : "text-warning"
                                    )} />
                                  ) : (
                                    <Wrench className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                                  )}
                                  <span className="truncate flex-1">{tool.name}</span>
                                  {tool.partNumber && (
                                    <span className="text-muted-foreground">#{tool.partNumber}</span>
                                  )}
                                  <div className="flex items-center gap-0.5">
                                    {toolHasModel ? (
                                      <>
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          className="h-5 w-5 p-0"
                                          onClick={() => handleViewToolModel(tool)}
                                        >
                                          <Box className="h-3 w-3 text-primary" />
                                        </Button>
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          className="h-5 w-5 p-0"
                                          onClick={() => handleEditToolModel(tool)}
                                        >
                                          <LinkIcon className="h-3 w-3" />
                                        </Button>
                                      </>
                                    ) : (
                                      <>
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          className="h-5 px-1.5 text-[9px]"
                                          onClick={() => handleEditToolModel(tool)}
                                        >
                                          +3D
                                        </Button>
                                        {toolSearch.detection.available && (
                                          <a
                                            href={toolSearch.url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="h-5 w-5 p-0 inline-flex items-center justify-center rounded hover:bg-muted"
                                          >
                                            <ExternalLink className="h-3 w-3 text-muted-foreground" />
                                          </a>
                                        )}
                                      </>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>

              {/* Leyenda */}
              <div className="flex items-center gap-4 mt-3 pt-3 border-t text-xs text-muted-foreground flex-wrap">
                <div className="flex items-center gap-1">
                  <Box className="h-3 w-3 text-primary" />
                  <span>Modelo cargado</span>
                </div>
                <div className="flex items-center gap-1">
                  <CheckCircle className="h-3 w-3 text-success" />
                  <span>Disponible online</span>
                </div>
                <div className="flex items-center gap-1">
                  <Cog className="h-3 w-3 text-muted-foreground" />
                  <span>Sin modelo</span>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Cards de información */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Modelos disponibles */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Folder className="h-4 w-4 text-warning" />
                Modelos Guardados
              </CardTitle>
              <CardDescription className="text-xs">
                Modelos 3D asociados a esta máquina
              </CardDescription>
            </CardHeader>
            <CardContent>
              {model3DDocuments.length === 0 ? (
                <div className="text-center py-4">
                  <Box className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                  <p className="text-xs text-muted-foreground">
                    No hay modelos 3D guardados
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Sube un archivo GLB/GLTF o vincúlalo desde una URL
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {model3DDocuments.map((doc) => (
                    <div
                      key={doc.id}
                      className={cn(
                        "flex items-center justify-between p-2 rounded-lg cursor-pointer transition-colors",
                        activeModelUrl === doc.url
                          ? "bg-primary/10 border border-primary/20"
                          : "hover:bg-muted/50"
                      )}
                      onClick={() => setSelectedModelUrl(doc.url)}
                    >
                      <div className="flex items-center gap-2">
                        <Box className="h-4 w-4 text-primary" />
                        <span className="text-sm truncate max-w-[150px]">
                          {doc.fileName}
                        </span>
                      </div>
                      {activeModelUrl === doc.url && (
                        <Badge variant="default" className="text-xs">
                          Activo
                        </Badge>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Fuentes externas rápidas */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Globe className="h-4 w-4 text-info" />
                Buscar en Catálogos
              </CardTitle>
              <CardDescription className="text-xs">
                Encuentra modelos 3D de piezas industriales
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {MODEL_SOURCES.slice(0, 3).map((source) => (
                  <a
                    key={source.id}
                    href={`${source.url}${encodeURIComponent(machine.brand || machine.name)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/50 transition-colors group"
                  >
                    <div className="flex items-center gap-2">
                      <source.icon className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="text-sm font-medium">{source.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {source.description}
                        </p>
                      </div>
                    </div>
                    <ExternalLink className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                  </a>
                ))}
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full text-xs"
                  onClick={() => setShowSourcesDialog(true)}
                >
                  Ver todas las fuentes
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Dialog para vincular URL */}
        <Dialog open={showLinkDialog} onOpenChange={setShowLinkDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <LinkIcon className="h-5 w-5" />
                Vincular Modelo 3D
              </DialogTitle>
              <DialogDescription>
                Ingresa la URL de un modelo 3D en formato GLB o GLTF
              </DialogDescription>
            </DialogHeader>
            <DialogBody>
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">URL del modelo</label>
                <Input
                  placeholder="https://ejemplo.com/modelo.glb"
                  value={linkUrl}
                  onChange={(e) => setLinkUrl(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Nombre (opcional)</label>
                <Input
                  placeholder="Mi modelo 3D"
                  value={linkFileName}
                  onChange={(e) => setLinkFileName(e.target.value)}
                />
              </div>
              <div className="flex items-start gap-2 p-3 bg-muted/50 rounded-lg">
                <Info className="h-4 w-4 text-muted-foreground mt-0.5" />
                <p className="text-xs text-muted-foreground">
                  Formatos soportados: GLB, GLTF. El archivo debe ser accesible públicamente.
                </p>
              </div>
            </div>
            </DialogBody>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowLinkDialog(false)}>
                Cancelar
              </Button>
              <Button onClick={handleLinkModel} disabled={isUploading || !linkUrl.trim()}>
                {isUploading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Vinculando...
                  </>
                ) : (
                  'Vincular'
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Dialog para subir archivo */}
        <Dialog open={showUploadDialog} onOpenChange={setShowUploadDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Upload className="h-5 w-5" />
                Subir Modelo 3D
              </DialogTitle>
              <DialogDescription>
                Selecciona un archivo GLB o GLTF (máx. 50MB)
              </DialogDescription>
            </DialogHeader>
            <DialogBody>
              <label
                htmlFor="model-upload"
                className={cn(
                  "flex flex-col items-center justify-center p-8 border-2 border-dashed rounded-lg cursor-pointer transition-colors",
                  "hover:border-primary hover:bg-primary/5"
                )}
              >
                <Upload className="h-10 w-10 text-muted-foreground mb-2" />
                <p className="text-sm font-medium">Click para seleccionar archivo</p>
                <p className="text-xs text-muted-foreground mt-1">
                  GLB o GLTF, máximo 50MB
                </p>
                <input
                  id="model-upload"
                  type="file"
                  accept=".glb,.gltf"
                  className="hidden"
                  onChange={handleFileUpload}
                  disabled={isUploading}
                />
              </label>
              {isUploading && (
                <div className="flex items-center justify-center gap-2 mt-4">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <p className="text-sm">Subiendo modelo...</p>
                </div>
              )}
            </DialogBody>
          </DialogContent>
        </Dialog>

        {/* Dialog para fuentes externas */}
        <Dialog open={showSourcesDialog} onOpenChange={setShowSourcesDialog}>
          <DialogContent size="default">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Search className="h-5 w-5" />
                Catálogos de Modelos 3D
              </DialogTitle>
              <DialogDescription>
                Busca "{machine.brand || machine.name}" en estos catálogos de piezas industriales
              </DialogDescription>
            </DialogHeader>
            <DialogBody>
            <div className="space-y-2">
              {MODEL_SOURCES.map((source) => (
                <a
                  key={source.id}
                  href={`${source.url}${encodeURIComponent(machine.brand || machine.name)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 transition-colors group"
                >
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <source.icon className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium">{source.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {source.description}
                      </p>
                    </div>
                  </div>
                  <ExternalLink className="h-5 w-5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                </a>
              ))}
            </div>
            <div className="flex items-start gap-2 p-3 bg-muted/50 rounded-lg mt-4">
              <Info className="h-4 w-4 text-muted-foreground mt-0.5" />
              <div className="text-xs text-muted-foreground">
                <p className="font-medium mb-1">Cómo usar:</p>
                <ol className="list-decimal list-inside space-y-1">
                  <li>Busca el modelo en el catálogo</li>
                  <li>Descarga en formato GLB o GLTF</li>
                  <li>Súbelo aquí o copia la URL directa</li>
                </ol>
              </div>
            </div>
            </DialogBody>
          </DialogContent>
        </Dialog>

        {/* Dialog para editar modelo 3D de componente/tool */}
        <Dialog open={!!editingComponent} onOpenChange={(open) => !open && setEditingComponent(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Box className="h-5 w-5" />
                Modelo 3D - {editingComponent?.name}
              </DialogTitle>
              <DialogDescription>
                {editingComponent?.type === 'component' ? 'Componente' : 'Repuesto/Herramienta'}
                {editingComponent?.currentUrl && ' - Actualmente tiene un modelo asignado'}
              </DialogDescription>
            </DialogHeader>
            <DialogBody>
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">URL del modelo 3D</label>
                <Input
                  placeholder="https://ejemplo.com/modelo.glb"
                  value={componentModelUrl}
                  onChange={(e) => setComponentModelUrl(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Formatos soportados: GLB, GLTF. Deja vacío para eliminar el modelo actual.
                </p>
              </div>

              {editingComponent?.currentUrl && (
                <div className="p-3 bg-muted/50 rounded-lg">
                  <p className="text-xs font-medium mb-1">Modelo actual:</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {editingComponent.currentUrl}
                  </p>
                </div>
              )}

              <div className="flex items-start gap-2 p-3 bg-info-muted rounded-lg border border-info-muted">
                <Info className="h-4 w-4 text-info mt-0.5" />
                <div className="text-xs text-info-muted-foreground">
                  <p className="font-medium mb-1">Dónde obtener modelos 3D:</p>
                  <ul className="list-disc list-inside space-y-0.5">
                    <li>TraceParts, GrabCAD para piezas estándar</li>
                    <li>SKF, FAG para rodamientos</li>
                    <li>FESTO, SMC para neumática</li>
                  </ul>
                </div>
              </div>
            </div>
            </DialogBody>
            <DialogFooter className="gap-2">
              {editingComponent?.currentUrl && (
                <Button
                  variant="outline"
                  className="text-destructive hover:bg-destructive/10"
                  onClick={() => {
                    setComponentModelUrl('');
                    handleSaveComponentModel();
                  }}
                  disabled={isSavingComponentModel}
                >
                  Eliminar modelo
                </Button>
              )}
              <div className="flex-1" />
              <Button variant="outline" onClick={() => setEditingComponent(null)}>
                Cancelar
              </Button>
              <Button
                onClick={handleSaveComponentModel}
                disabled={isSavingComponentModel}
              >
                {isSavingComponentModel ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Guardando...
                  </>
                ) : (
                  'Guardar'
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Info del componente viendo modelo */}
        {viewingComponent && (
          <Card className="border-primary">
            <CardContent className="p-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Box className="h-4 w-4 text-primary" />
                  <span className="text-sm font-medium">Viendo: {viewingComponent.name}</span>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => {
                    setViewingComponent(null);
                    setSelectedModelUrl(null);
                  }}
                >
                  Volver a máquina
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </TooltipProvider>
  );
}

export default Machine3DViewerTab;
