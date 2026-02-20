'use client';

import { useUserColors } from '@/hooks/use-user-colors';
import { useState, useMemo, useCallback, useEffect } from 'react';
import {
  Cpu,
  Box,
  AlertTriangle,
  CheckCircle2,
  Filter,
  Eye,
  Edit2,
  Save,
  X,
  ChevronRight,
  FileText,
  Sparkles,
  Search,
  Image as ImageIcon,
  Trash2,
  Tag,
  Wrench,
  Camera,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ComponentTree, ExtractedComponent } from './ComponentTree';
import { EvidencePanel, Evidence } from './EvidencePanel';
import { LogoUpload } from '@/components/ui/LogoUpload';
import { ControlModal } from './ControlModal';
import { v4 as uuidv4 } from 'uuid';


export interface ExtractedMachineData {
  machine: {
    name: string;
    brand?: string;
    model?: string;
    serialNumber?: string;
    type?: string;
    description?: string;
    voltage?: string;
    power?: string;
    weight?: string;
    dimensions?: string;
    confidence: number;
    evidences: Evidence[];
  };
  components: ExtractedComponent[];
  overallConfidence: number;
  warnings: string[];
}

interface ImportReviewProps {
  data: ExtractedMachineData;
  jobId: number;
  onDataChange: (data: ExtractedMachineData) => void;
  onConfirm: () => void;
  onCancel: () => void;
  isConfirming?: boolean;
}

export function ImportReview({
  data,
  jobId,
  onDataChange,
  onConfirm,
  onCancel,
  isConfirming,
}: ImportReviewProps) {
  const [selectedComponent, setSelectedComponent] = useState<ExtractedComponent | null>(null);
  const [showUncertainOnly, setShowUncertainOnly] = useState(false);
  const [isEditingMachine, setIsEditingMachine] = useState(false);
  const [editedMachine, setEditedMachine] = useState(data.machine);
  const [viewingFile, setViewingFile] = useState<{ fileId: number; page?: number } | null>(null);
  const [componentSearch, setComponentSearch] = useState('');
  const [editedFieldsMap, setEditedFieldsMap] = useState<Record<string, Set<string>>>({});
  const [showControlModal, setShowControlModal] = useState(false);
  const [jobFiles, setJobFiles] = useState<Array<{ id: number; fileName: string; mimeType: string }>>([]);

  const userColors = useUserColors();

  // Fetch job files for control modal
  useEffect(() => {
    fetch(`/api/maquinas/import/${jobId}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.files) {
          setJobFiles(data.files.map((f: any) => ({
            id: f.id,
            fileName: f.fileName,
            mimeType: f.mimeType || 'application/pdf',
          })));
        }
      })
      .catch(() => {});
  }, [jobId]);

  // Stats
  const stats = useMemo(() => {
    const totalComponents = data.components.length;
    const highConfidence = data.components.filter(c => c.confidence >= 0.9).length;
    const mediumConfidence = data.components.filter(c => c.confidence >= 0.7 && c.confidence < 0.9).length;
    const lowConfidence = data.components.filter(c => c.confidence < 0.7).length;
    const uncertainCount = data.components.filter(
      c => c.confidence < 0.7 || (c.uncertainFields?.length ?? 0) > 0
    ).length;

    return {
      totalComponents,
      highConfidence,
      mediumConfidence,
      lowConfidence,
      uncertainCount,
    };
  }, [data.components]);

  // Filtered components for search
  const filteredComponents = useMemo(() => {
    if (!componentSearch.trim()) return data.components;
    const term = componentSearch.toLowerCase().trim();
    // Get matching component IDs
    const matchingIds = new Set<string>();
    const parentIds = new Set<string>();

    data.components.forEach(c => {
      const matches =
        c.name.toLowerCase().includes(term) ||
        (c.code && c.code.toLowerCase().includes(term)) ||
        (c.itemNumber && c.itemNumber.toLowerCase().includes(term)) ||
        (c.brand && c.brand.toLowerCase().includes(term)) ||
        (c.model && c.model.toLowerCase().includes(term));

      if (matches) {
        matchingIds.add(c.tempId);
        // Include all ancestors so the tree structure is preserved
        let parentId = c.parentTempId;
        while (parentId) {
          parentIds.add(parentId);
          const parent = data.components.find(p => p.tempId === parentId);
          parentId = parent?.parentTempId || null;
        }
      }
    });

    return data.components.filter(c => matchingIds.has(c.tempId) || parentIds.has(c.tempId));
  }, [data.components, componentSearch]);

  // Handlers
  const handleUpdateComponent = useCallback((tempId: string, updates: Partial<ExtractedComponent>) => {
    // Track edited fields
    setEditedFieldsMap(prev => {
      const existing = new Set(prev[tempId] || []);
      Object.keys(updates).forEach(k => existing.add(k));
      return { ...prev, [tempId]: existing };
    });

    const newComponents = data.components.map(c =>
      c.tempId === tempId ? { ...c, ...updates } : c
    );
    onDataChange({ ...data, components: newComponents });

    if (selectedComponent?.tempId === tempId) {
      setSelectedComponent({ ...selectedComponent, ...updates });
    }
  }, [data, selectedComponent, onDataChange]);

  const handleDeleteComponent = useCallback((tempId: string) => {
    // Also delete all children recursively
    const toDelete = new Set<string>([tempId]);
    let changed = true;
    while (changed) {
      changed = false;
      for (const c of data.components) {
        if (c.parentTempId && toDelete.has(c.parentTempId) && !toDelete.has(c.tempId)) {
          toDelete.add(c.tempId);
          changed = true;
        }
      }
    }

    const newComponents = data.components.filter(c => !toDelete.has(c.tempId));
    onDataChange({ ...data, components: newComponents });

    if (selectedComponent && toDelete.has(selectedComponent.tempId)) {
      setSelectedComponent(null);
    }
  }, [data, selectedComponent, onDataChange]);

  const handleAddComponent = useCallback((parentTempId?: string) => {
    const newComponent: ExtractedComponent = {
      tempId: uuidv4(),
      name: 'Nuevo componente',
      type: 'COMPONENT',
      confidence: 1.0,
      parentTempId: parentTempId || null,
      evidences: [],
    };

    onDataChange({
      ...data,
      components: [...data.components, newComponent],
    });

    setSelectedComponent(newComponent);
  }, [data, onDataChange]);

  const handleSaveMachine = () => {
    onDataChange({
      ...data,
      machine: editedMachine,
    });
    setIsEditingMachine(false);
  };

  const handleViewFile = async (fileId: number, page?: number) => {
    try {
      const response = await fetch(`/api/maquinas/import/files/${fileId}/signed-url`);
      if (response.ok) {
        const { url } = await response.json();
        window.open(url, '_blank');
      }
    } catch (error) {
      console.error('Error opening file:', error);
    }
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.9) return userColors.kpiPositive;
    if (confidence >= 0.7) return userColors.chart4;
    return userColors.kpiNegative;
  };

  const isFieldEdited = (tempId: string, field: string) => {
    return editedFieldsMap[tempId]?.has(field) || false;
  };

  const EditDot = ({ tempId, field }: { tempId: string; field: string }) => {
    if (!isFieldEdited(tempId, field)) return null;
    return <span className="h-1.5 w-1.5 rounded-full bg-info inline-block" title="Editado manualmente" />;
  };

  return (
    <div className="space-y-6">
      {/* Header Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground uppercase tracking-wider">Confianza</span>
                </div>
                <p className="text-2xl font-bold" style={{ color: getConfidenceColor(data.overallConfidence) }}>
                  {Math.round(data.overallConfidence * 100)}%
                </p>
              </div>
              <div
                className="h-10 w-10 rounded-full flex items-center justify-center"
                style={{ backgroundColor: `${userColors.chart1}15` }}
              >
                <Sparkles className="h-5 w-5" style={{ color: userColors.chart1 }} />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs text-muted-foreground uppercase tracking-wider">Componentes</span>
                <p className="text-2xl font-bold">{stats.totalComponents}</p>
              </div>
              <div
                className="h-10 w-10 rounded-full flex items-center justify-center"
                style={{ backgroundColor: `${userColors.chart6}15` }}
              >
                <Box className="h-5 w-5" style={{ color: userColors.chart6 }} />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs text-muted-foreground uppercase tracking-wider">Alta conf.</span>
                <p className="text-2xl font-bold" style={{ color: userColors.kpiPositive }}>{stats.highConfidence}</p>
              </div>
              <div
                className="h-10 w-10 rounded-full flex items-center justify-center"
                style={{ backgroundColor: `${userColors.kpiPositive}15` }}
              >
                <CheckCircle2 className="h-5 w-5" style={{ color: userColors.kpiPositive }} />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs text-muted-foreground uppercase tracking-wider">Media conf.</span>
                <p className="text-2xl font-bold" style={{ color: userColors.chart4 }}>{stats.mediumConfidence}</p>
              </div>
              <div
                className="h-10 w-10 rounded-full flex items-center justify-center"
                style={{ backgroundColor: `${userColors.chart4}15` }}
              >
                <AlertTriangle className="h-5 w-5" style={{ color: userColors.chart4 }} />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs text-muted-foreground uppercase tracking-wider">Requiere revisión</span>
                <p className="text-2xl font-bold" style={{ color: userColors.kpiNegative }}>{stats.uncertainCount}</p>
              </div>
              <div
                className="h-10 w-10 rounded-full flex items-center justify-center"
                style={{ backgroundColor: `${userColors.kpiNegative}15` }}
              >
                <AlertTriangle className="h-5 w-5" style={{ color: userColors.kpiNegative }} />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Warnings */}
      {data.warnings.length > 0 && (
        <Card style={{
          borderColor: `${userColors.chart4}50`,
          backgroundColor: `${userColors.chart4}08`
        }}>
          <CardContent className="p-4">
            <div className="flex items-start gap-2">
              <AlertTriangle className="h-5 w-5 flex-shrink-0" style={{ color: userColors.chart4 }} />
              <div>
                <p className="font-medium" style={{ color: userColors.chart4 }}>Advertencias del análisis</p>
                <ul className="mt-1 space-y-1">
                  {data.warnings.map((warning, i) => (
                    <li key={i} className="text-sm text-muted-foreground">{warning}</li>
                  ))}
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Main Content: 3-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Left Column: Machine Info */}
        <div className="lg:col-span-3 space-y-4">
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <Cpu className="h-4 w-4" />
                  Máquina
                </CardTitle>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsEditingMachine(!isEditingMachine)}
                >
                  {isEditingMachine ? <X className="h-4 w-4" /> : <Edit2 className="h-4 w-4" />}
                </Button>
              </div>
              <Badge
                style={{
                  backgroundColor: `${getConfidenceColor(data.machine.confidence)}20`,
                  color: getConfidenceColor(data.machine.confidence),
                }}
              >
                {Math.round(data.machine.confidence * 100)}% confianza
              </Badge>
            </CardHeader>
            <CardContent className="space-y-4">
              {isEditingMachine ? (
                // Edit Mode
                <div className="space-y-3">
                  <div>
                    <Label>Nombre *</Label>
                    <Input
                      value={editedMachine.name}
                      onChange={(e) => setEditedMachine({ ...editedMachine, name: e.target.value })}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label>Marca</Label>
                      <Input
                        value={editedMachine.brand || ''}
                        onChange={(e) => setEditedMachine({ ...editedMachine, brand: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label>Modelo</Label>
                      <Input
                        value={editedMachine.model || ''}
                        onChange={(e) => setEditedMachine({ ...editedMachine, model: e.target.value })}
                      />
                    </div>
                  </div>
                  <div>
                    <Label>N° Serie</Label>
                    <Input
                      value={editedMachine.serialNumber || ''}
                      onChange={(e) => setEditedMachine({ ...editedMachine, serialNumber: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label>Tipo</Label>
                    <Select
                      value={editedMachine.type || 'PRODUCTION'}
                      onValueChange={(v) => setEditedMachine({ ...editedMachine, type: v })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="PRODUCTION">Producción</SelectItem>
                        <SelectItem value="MAINTENANCE">Mantenimiento</SelectItem>
                        <SelectItem value="UTILITY">Utilidad</SelectItem>
                        <SelectItem value="PACKAGING">Empaque</SelectItem>
                        <SelectItem value="OTHER">Otro</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Descripción</Label>
                    <Textarea
                      value={editedMachine.description || ''}
                      onChange={(e) => setEditedMachine({ ...editedMachine, description: e.target.value })}
                      rows={3}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label>Voltaje</Label>
                      <Input
                        value={editedMachine.voltage || ''}
                        onChange={(e) => setEditedMachine({ ...editedMachine, voltage: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label>Potencia</Label>
                      <Input
                        value={editedMachine.power || ''}
                        onChange={(e) => setEditedMachine({ ...editedMachine, power: e.target.value })}
                      />
                    </div>
                  </div>
                  <Button onClick={handleSaveMachine} className="w-full">
                    <Save className="h-4 w-4 mr-2" />
                    Guardar cambios
                  </Button>
                </div>
              ) : (
                // View Mode
                <div className="space-y-2">
                  <div>
                    <p className="text-lg font-semibold">{data.machine.name}</p>
                    {data.machine.brand && (
                      <p className="text-sm text-muted-foreground">
                        {data.machine.brand} {data.machine.model && `- ${data.machine.model}`}
                      </p>
                    )}
                  </div>

                  {data.machine.serialNumber && (
                    <div>
                      <p className="text-xs text-muted-foreground">N° Serie</p>
                      <p className="text-sm">{data.machine.serialNumber}</p>
                    </div>
                  )}

                  {data.machine.description && (
                    <div>
                      <p className="text-xs text-muted-foreground">Descripción</p>
                      <p className="text-sm">{data.machine.description}</p>
                    </div>
                  )}

                  {(data.machine.voltage || data.machine.power) && (
                    <div className="flex gap-4">
                      {data.machine.voltage && (
                        <div>
                          <p className="text-xs text-muted-foreground">Voltaje</p>
                          <p className="text-sm">{data.machine.voltage}</p>
                        </div>
                      )}
                      {data.machine.power && (
                        <div>
                          <p className="text-xs text-muted-foreground">Potencia</p>
                          <p className="text-sm">{data.machine.power}</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              <Separator />

              {/* Machine Evidences */}
              <EvidencePanel
                evidences={data.machine.evidences}
                componentName={data.machine.name}
                onViewFile={handleViewFile}
                jobId={jobId}
              />
            </CardContent>
          </Card>
        </div>

        {/* Center Column: Component Tree */}
        <div className="lg:col-span-4">
          <Card className="h-full">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <Box className="h-4 w-4" />
                  Componentes
                  {componentSearch && (
                    <Badge variant="secondary" className="text-xs">
                      {filteredComponents.length} de {data.components.length}
                    </Badge>
                  )}
                </CardTitle>
                <div className="flex items-center gap-2">
                  <Switch
                    id="uncertain-filter"
                    checked={showUncertainOnly}
                    onCheckedChange={setShowUncertainOnly}
                  />
                  <Label htmlFor="uncertain-filter" className="text-xs">
                    Solo inciertos ({stats.uncertainCount})
                  </Label>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {/* Component Search */}
              <div className="relative mb-3">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar componente..."
                  value={componentSearch}
                  onChange={(e) => setComponentSearch(e.target.value)}
                  className="pl-10 bg-background"
                />
                {componentSearch && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0"
                    onClick={() => setComponentSearch('')}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>

              <ScrollArea className="h-[calc(100vh-320px)]">
                <ComponentTree
                  components={filteredComponents}
                  onUpdateComponent={handleUpdateComponent}
                  onDeleteComponent={handleDeleteComponent}
                  onAddComponent={handleAddComponent}
                  onSelectComponent={setSelectedComponent}
                  selectedComponentId={selectedComponent?.tempId}
                  showUncertainOnly={showUncertainOnly}
                />
              </ScrollArea>
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Component Detail */}
        <div className="lg:col-span-5">
          {selectedComponent ? (
            <Card className="h-full">
              <CardHeader className="pb-3">
                <div className="flex items-center gap-3">
                  {selectedComponent.logo ? (
                    <img
                      src={selectedComponent.logo}
                      alt={selectedComponent.name}
                      className="h-10 w-10 rounded-lg object-cover border"
                    />
                  ) : (
                    <div
                      className="h-10 w-10 rounded-lg flex items-center justify-center"
                      style={{ backgroundColor: `${userColors.chart1}15` }}
                    >
                      {selectedComponent.type === 'SYSTEM' ? (
                        <Box className="h-5 w-5" style={{ color: userColors.chart1 }} />
                      ) : (
                        <Wrench className="h-5 w-5" style={{ color: userColors.chart1 }} />
                      )}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-lg truncate">{selectedComponent.name}</CardTitle>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant="secondary" className="text-xs">
                        {selectedComponent.type === 'SYSTEM' ? 'Sistema' : selectedComponent.type === 'PART' ? 'Parte' : 'Componente'}
                      </Badge>
                      <Badge
                        className="text-xs"
                        style={{
                          backgroundColor: `${getConfidenceColor(selectedComponent.confidence)}20`,
                          color: getConfidenceColor(selectedComponent.confidence),
                        }}
                      >
                        {Math.round(selectedComponent.confidence * 100)}%
                      </Badge>
                      {selectedComponent.quantity && selectedComponent.quantity > 1 && (
                        <Badge variant="outline" className="text-xs">
                          x{selectedComponent.quantity}
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[calc(100vh-320px)] pr-3">
                  <div className="space-y-5">
                    {/* Section: Identificación */}
                    <div>
                      <p className="text-xs text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-1.5">
                        <Tag className="h-3 w-3" />
                        Identificación
                      </p>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <Label className="flex items-center gap-1.5 text-xs">
                            Nombre
                            <EditDot tempId={selectedComponent.tempId} field="name" />
                          </Label>
                          <Input
                            value={selectedComponent.name}
                            onChange={(e) => handleUpdateComponent(selectedComponent.tempId, { name: e.target.value })}
                          />
                        </div>
                        <div>
                          <Label className="flex items-center gap-1.5 text-xs">
                            Tipo
                            <EditDot tempId={selectedComponent.tempId} field="type" />
                          </Label>
                          <Select
                            value={selectedComponent.type}
                            onValueChange={(v) => handleUpdateComponent(selectedComponent.tempId, { type: v })}
                          >
                            <SelectTrigger>
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
                          <Label className="flex items-center gap-1.5 text-xs">
                            Cantidad
                            <EditDot tempId={selectedComponent.tempId} field="quantity" />
                          </Label>
                          <Input
                            type="number"
                            min={1}
                            value={selectedComponent.quantity || 1}
                            onChange={(e) => handleUpdateComponent(selectedComponent.tempId, { quantity: parseInt(e.target.value) || 1 })}
                          />
                        </div>
                        <div>
                          <Label className="flex items-center gap-1.5 text-xs">
                            Pos (N° en plano)
                            <EditDot tempId={selectedComponent.tempId} field="itemNumber" />
                          </Label>
                          <Input
                            value={selectedComponent.itemNumber || ''}
                            onChange={(e) => handleUpdateComponent(selectedComponent.tempId, { itemNumber: e.target.value })}
                            placeholder="ej: 12, 3.1, 4.2"
                          />
                        </div>
                      </div>
                    </div>

                    <Separator />

                    {/* Section: Catálogo */}
                    <div>
                      <p className="text-xs text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-1.5">
                        <FileText className="h-3 w-3" />
                        Catálogo
                      </p>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="col-span-2">
                          <Label className="flex items-center gap-1.5 text-xs">
                            Código
                            <EditDot tempId={selectedComponent.tempId} field="code" />
                          </Label>
                          <Input
                            value={selectedComponent.code || ''}
                            onChange={(e) => handleUpdateComponent(selectedComponent.tempId, { code: e.target.value })}
                            placeholder="ej: DIN 472 - 90x3.ipt"
                          />
                        </div>
                        <div>
                          <Label className="flex items-center gap-1.5 text-xs">
                            Marca
                            <EditDot tempId={selectedComponent.tempId} field="brand" />
                          </Label>
                          <Input
                            value={selectedComponent.brand || ''}
                            onChange={(e) => handleUpdateComponent(selectedComponent.tempId, { brand: e.target.value })}
                          />
                        </div>
                        <div>
                          <Label className="flex items-center gap-1.5 text-xs">
                            Modelo
                            <EditDot tempId={selectedComponent.tempId} field="model" />
                          </Label>
                          <Input
                            value={selectedComponent.model || ''}
                            onChange={(e) => handleUpdateComponent(selectedComponent.tempId, { model: e.target.value })}
                          />
                        </div>
                      </div>
                    </div>

                    <Separator />

                    {/* Section: Foto */}
                    <div>
                      <p className="text-xs text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-1.5">
                        <Camera className="h-3 w-3" />
                        Foto del componente
                      </p>
                      {selectedComponent.logo ? (
                        <div className="flex items-start gap-3">
                          <img
                            src={selectedComponent.logo}
                            alt={selectedComponent.name}
                            className="h-24 w-24 rounded-lg object-cover border"
                          />
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive hover:text-destructive"
                            onClick={() => handleUpdateComponent(selectedComponent.tempId, { logo: null })}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      ) : (
                        <LogoUpload
                          entityType="component"
                          entityId={jobId}
                          onLogoUploaded={(url) => handleUpdateComponent(selectedComponent.tempId, { logo: url })}
                          title="Foto"
                          description="Sube una foto para este componente"
                        />
                      )}
                    </div>

                    <Separator />

                    {/* Section: Especificaciones (if available) */}
                    {selectedComponent.specifications && Object.keys(selectedComponent.specifications).length > 0 && (
                      <>
                        <div>
                          <p className="text-xs text-muted-foreground uppercase tracking-wider mb-3">
                            Especificaciones
                          </p>
                          <div className="rounded-lg bg-muted/50 p-3 space-y-1.5">
                            {Object.entries(selectedComponent.specifications).map(([key, value]) => (
                              <div key={key} className="flex items-center justify-between text-sm">
                                <span className="text-muted-foreground">{key}</span>
                                <span className="font-medium">{value}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                        <Separator />
                      </>
                    )}

                    {/* Section: Evidencias */}
                    <div>
                      <p className="text-xs text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-1.5">
                        <Eye className="h-3 w-3" />
                        Evidencias
                      </p>
                      <EvidencePanel
                        evidences={selectedComponent.evidences}
                        componentName={selectedComponent.name}
                        onViewFile={handleViewFile}
                        jobId={jobId}
                      />
                    </div>
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          ) : (
            /* Empty State - no component selected */
            <Card className="h-full">
              <CardContent className="p-8 h-full flex items-center justify-center">
                <div className="text-center">
                  <div className="h-16 w-16 mx-auto mb-4 rounded-full bg-muted flex items-center justify-center">
                    <Box className="h-8 w-8 text-muted-foreground" />
                  </div>
                  <h3 className="text-lg font-medium mb-1">Seleccioná un componente</h3>
                  <p className="text-muted-foreground text-sm">
                    Hacé clic en un componente del árbol para ver y editar sus detalles, agregar fotos y revisar evidencias.
                  </p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Actions - sticky bottom bar */}
      <div className="sticky bottom-0 bg-background flex items-center justify-between pt-4 pb-2 border-t z-10">
        <Button variant="outline" onClick={onCancel} disabled={isConfirming}>
          Cancelar
        </Button>
        <div className="flex items-center gap-3">
          {stats.uncertainCount > 0 && (
            <p className="text-sm text-muted-foreground">
              {stats.uncertainCount} items requieren revisión
            </p>
          )}
          <Button
            variant="outline"
            onClick={() => setShowControlModal(true)}
          >
            <Eye className="h-4 w-4 mr-2" />
            Controlar
          </Button>
          <Button onClick={onConfirm} disabled={isConfirming} size="lg">
            {isConfirming ? (
              <>
                <Cpu className="h-4 w-4 mr-2 animate-spin" />
                Creando máquina...
              </>
            ) : (
              <>
                <CheckCircle2 className="h-4 w-4 mr-2" />
                Confirmar y crear máquina
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Control Modal */}
      <ControlModal
        open={showControlModal}
        onClose={() => setShowControlModal(false)}
        components={data.components}
        jobId={jobId}
        files={jobFiles}
        onUpdateComponent={handleUpdateComponent}
      />
    </div>
  );
}
