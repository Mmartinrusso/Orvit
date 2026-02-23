'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Boxes,
  Plus,
  Edit2,
  Trash2,
  Loader2,
  ArrowLeft,
  FolderTree,
  Box,
  GripVertical,
  Settings2,
  ListPlus,
  X,
  Hash,
  Type,
  List,
  ToggleLeft,
  ChevronDown,
  ChevronUp,
  Ruler,
  Copy,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { useApiMutation } from '@/hooks/use-api-mutation';
import Link from 'next/link';

interface AttributeSchema {
  type: 'text' | 'number' | 'select' | 'boolean';
  label: string;
  required?: boolean;
  options?: string[];
  unit?: string;
  min?: number;
  max?: number;
  default?: any;
}

interface ResourceType {
  id: number;
  code: string;
  name: string;
  description: string | null;
  uomCode: string | null;
  attributesSchema: Record<string, AttributeSchema> | null;
  config: {
    requiresPhotos?: boolean;
    hasCapacity?: boolean;
    hasOrder?: boolean;
  } | null;
  _count?: {
    resources: number;
  };
}

interface WorkCenter {
  id: number;
  code: string;
  name: string;
}

interface Resource {
  id: number;
  code: string;
  name: string;
  resourceTypeId: number;
  workCenterId: number | null;
  metadata: Record<string, any> | null;
  status: 'ACTIVE' | 'MAINTENANCE' | 'INACTIVE';
  order: number;
  resourceType: {
    id: number;
    code: string;
    name: string;
    config?: any;
  };
  workCenter: WorkCenter | null;
}

const STATUS_OPTIONS = [
  { value: 'ACTIVE', label: 'Activo', color: 'bg-success-muted text-success' },
  { value: 'MAINTENANCE', label: 'En Mantenimiento', color: 'bg-warning-muted text-warning-muted-foreground' },
  { value: 'INACTIVE', label: 'Inactivo', color: 'bg-muted text-muted-foreground' },
];

export default function ResourcesConfigPage() {
  const [activeTab, setActiveTab] = useState('types');
  const [loading, setLoading] = useState(true);

  // Resource Types state
  const [resourceTypes, setResourceTypes] = useState<ResourceType[]>([]);
  const [typeDialogOpen, setTypeDialogOpen] = useState(false);
  const [selectedType, setSelectedType] = useState<ResourceType | null>(null);
  const [typeForm, setTypeForm] = useState({
    code: '',
    name: '',
    description: '',
    uomCode: '',
    attributesSchema: {} as Record<string, AttributeSchema>,
    config: {
      requiresPhotos: false,
      hasCapacity: false,
      hasOrder: true,
    },
  });
  const [showAttributesBuilder, setShowAttributesBuilder] = useState(false);
  const [newAttrKey, setNewAttrKey] = useState('');
  const [newAttrSchema, setNewAttrSchema] = useState<AttributeSchema>({
    type: 'text',
    label: '',
    required: false,
  });
  const [editingAttrKey, setEditingAttrKey] = useState<string | null>(null);

  // Resources state
  const [resources, setResources] = useState<Resource[]>([]);
  const [resourceDialogOpen, setResourceDialogOpen] = useState(false);
  const [selectedResource, setSelectedResource] = useState<Resource | null>(null);
  const [resourceForm, setResourceForm] = useState({
    code: '',
    name: '',
    resourceTypeId: 0,
    workCenterId: null as number | null,
    status: 'ACTIVE' as 'ACTIVE' | 'MAINTENANCE' | 'INACTIVE',
    order: 0,
    metadata: {} as Record<string, any>,
  });
  const [filterTypeId, setFilterTypeId] = useState<number | null>(null);

  // Work Centers for dropdown
  const [workCenters, setWorkCenters] = useState<WorkCenter[]>([]);

  // Delete states
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ type: 'resourceType' | 'resource'; item: any } | null>(null);
  const [saving, setSaving] = useState(false);

  // Fetch resource types
  const fetchResourceTypes = useCallback(async () => {
    try {
      const res = await fetch('/api/production/resource-types');
      const data = await res.json();
      if (data.success) {
        setResourceTypes(data.resourceTypes);
      }
    } catch (error) {
      console.error('Error:', error);
      toast.error('Error al cargar tipos de recursos');
    }
  }, []);

  // Fetch resources
  const fetchResources = useCallback(async () => {
    try {
      const url = filterTypeId
        ? `/api/production/resources?resourceTypeId=${filterTypeId}`
        : '/api/production/resources';
      const res = await fetch(url);
      const data = await res.json();
      if (data.success) {
        setResources(data.resources);
      }
    } catch (error) {
      console.error('Error:', error);
      toast.error('Error al cargar recursos');
    }
  }, [filterTypeId]);

  // Fetch work centers
  const fetchWorkCenters = useCallback(async () => {
    try {
      const res = await fetch('/api/production/work-centers?status=ACTIVE');
      const data = await res.json();
      if (data.success) {
        setWorkCenters(data.workCenters);
      }
    } catch (error) {
      console.error('Error:', error);
    }
  }, []);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await Promise.all([fetchResourceTypes(), fetchResources(), fetchWorkCenters()]);
      setLoading(false);
    };
    loadData();
  }, [fetchResourceTypes, fetchResources, fetchWorkCenters]);

  useEffect(() => {
    fetchResources();
  }, [filterTypeId, fetchResources]);

  // === Resource Type handlers ===
  const openTypeCreateDialog = () => {
    setSelectedType(null);
    setTypeForm({
      code: '',
      name: '',
      description: '',
      uomCode: '',
      attributesSchema: {},
      config: { requiresPhotos: false, hasCapacity: false, hasOrder: true },
    });
    setShowAttributesBuilder(false);
    setNewAttrKey('');
    setNewAttrSchema({ type: 'text', label: '', required: false });
    setEditingAttrKey(null);
    setTypeDialogOpen(true);
  };

  const openTypeEditDialog = (type: ResourceType) => {
    setSelectedType(type);
    setTypeForm({
      code: type.code,
      name: type.name,
      description: type.description || '',
      uomCode: type.uomCode || '',
      attributesSchema: type.attributesSchema || {},
      config: type.config || { requiresPhotos: false, hasCapacity: false, hasOrder: true },
    });
    setShowAttributesBuilder(Object.keys(type.attributesSchema || {}).length > 0);
    setNewAttrKey('');
    setNewAttrSchema({ type: 'text', label: '', required: false });
    setEditingAttrKey(null);
    setTypeDialogOpen(true);
  };

  // Attribute schema handlers
  const addAttribute = () => {
    if (!newAttrKey || !newAttrSchema.label) {
      toast.error('Campo clave y etiqueta son requeridos');
      return;
    }
    const key = newAttrKey.toLowerCase().replace(/\s+/g, '_');
    if (typeForm.attributesSchema[key]) {
      toast.error('Ya existe un atributo con esa clave');
      return;
    }
    setTypeForm({
      ...typeForm,
      attributesSchema: {
        ...typeForm.attributesSchema,
        [key]: { ...newAttrSchema },
      },
    });
    setNewAttrKey('');
    setNewAttrSchema({ type: 'text', label: '', required: false });
  };

  const removeAttribute = (key: string) => {
    const updated = { ...typeForm.attributesSchema };
    delete updated[key];
    setTypeForm({ ...typeForm, attributesSchema: updated });
  };

  const updateAttribute = (key: string, schema: AttributeSchema) => {
    setTypeForm({
      ...typeForm,
      attributesSchema: {
        ...typeForm.attributesSchema,
        [key]: schema,
      },
    });
  };

  const getAttributeTypeIcon = (type: string) => {
    switch (type) {
      case 'text': return <Type className="h-4 w-4" />;
      case 'number': return <Hash className="h-4 w-4" />;
      case 'select': return <List className="h-4 w-4" />;
      case 'boolean': return <ToggleLeft className="h-4 w-4" />;
      default: return <Type className="h-4 w-4" />;
    }
  };

  const handleSaveType = async () => {
    if (!typeForm.code || !typeForm.name) {
      toast.error('Código y nombre son requeridos');
      return;
    }

    setSaving(true);
    try {
      const url = selectedType
        ? `/api/production/resource-types/${selectedType.id}`
        : '/api/production/resource-types';

      const payload = {
        ...typeForm,
        uomCode: typeForm.uomCode || null,
        attributesSchema: Object.keys(typeForm.attributesSchema).length > 0
          ? typeForm.attributesSchema
          : null,
      };

      const res = await fetch(url, {
        method: selectedType ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (data.success) {
        toast.success(selectedType ? 'Tipo actualizado' : 'Tipo creado');
        setTypeDialogOpen(false);
        fetchResourceTypes();
      } else {
        toast.error(data.error || 'Error al guardar');
      }
    } catch (error) {
      console.error('Error:', error);
      toast.error('Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  // === Resource handlers ===
  const openResourceCreateDialog = () => {
    setSelectedResource(null);
    setResourceForm({
      code: '',
      name: '',
      resourceTypeId: filterTypeId || (resourceTypes[0]?.id ?? 0),
      workCenterId: null,
      status: 'ACTIVE',
      order: 0,
      metadata: {},
    });
    setResourceDialogOpen(true);
  };

  const openResourceEditDialog = (resource: Resource) => {
    setSelectedResource(resource);
    setResourceForm({
      code: resource.code,
      name: resource.name,
      resourceTypeId: resource.resourceTypeId,
      workCenterId: resource.workCenterId,
      status: resource.status,
      order: resource.order,
      metadata: resource.metadata || {},
    });
    setResourceDialogOpen(true);
  };

  const handleDuplicateResource = (resource: Resource) => {
    setSelectedResource(null);
    const nextOrder = resources.length > 0
      ? Math.max(...resources.map(r => r.order)) + 1
      : 0;
    setResourceForm({
      code: `${resource.code}-COPIA`,
      name: `${resource.name} (Copia)`,
      resourceTypeId: resource.resourceTypeId,
      workCenterId: resource.workCenterId,
      status: resource.status,
      order: nextOrder,
      metadata: resource.metadata ? { ...resource.metadata } : {},
    });
    setResourceDialogOpen(true);
  };

  const saveResourceMutation = useApiMutation<unknown, { isEdit: boolean; id?: number; form: typeof resourceForm }>({
    mutationFn: async ({ isEdit, id, form }) => {
      const url = isEdit ? `/api/production/resources/${id}` : '/api/production/resources';
      const res = await fetch(url, {
        method: isEdit ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Error al guardar');
      return data;
    },
    successMessage: null,
    errorMessage: 'Error al guardar',
    onSuccess: (_data, vars) => {
      toast.success(vars.isEdit ? 'Recurso actualizado' : 'Recurso creado');
      setResourceDialogOpen(false);
      fetchResources();
    },
  });

  const handleSaveResource = () => {
    if (!resourceForm.code || !resourceForm.name || !resourceForm.resourceTypeId) {
      toast.error('Código, nombre y tipo son requeridos');
      return;
    }
    saveResourceMutation.mutate({
      isEdit: !!selectedResource,
      id: selectedResource?.id,
      form: resourceForm,
    });
  };

  // === Delete handler ===
  const handleDelete = async () => {
    if (!deleteTarget) return;

    setSaving(true);
    try {
      const url =
        deleteTarget.type === 'resourceType'
          ? `/api/production/resource-types/${deleteTarget.item.id}`
          : `/api/production/resources/${deleteTarget.item.id}`;

      const res = await fetch(url, { method: 'DELETE' });
      const data = await res.json();

      if (data.success) {
        toast.success(deleteTarget.type === 'resourceType' ? 'Tipo eliminado' : 'Recurso eliminado');
        setDeleteDialogOpen(false);
        setDeleteTarget(null);
        if (deleteTarget.type === 'resourceType') {
          fetchResourceTypes();
        } else {
          fetchResources();
        }
      } else {
        toast.error(data.error || 'Error al eliminar');
      }
    } catch (error) {
      console.error('Error:', error);
      toast.error('Error al eliminar');
    } finally {
      setSaving(false);
    }
  };

  const getStatusInfo = (status: string) => {
    return STATUS_OPTIONS.find((s) => s.value === status) || STATUS_OPTIONS[0];
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/produccion/configuracion">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Boxes className="h-6 w-6 text-warning-muted-foreground" />
              Recursos de Producción
            </h1>
            <p className="text-muted-foreground text-sm">
              Gestiona tipos de recursos (bancos, silos, etc.) y sus instancias
            </p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="types" className="gap-2">
            <FolderTree className="h-4 w-4" />
            Tipos de Recursos
          </TabsTrigger>
          <TabsTrigger value="resources" className="gap-2">
            <Box className="h-4 w-4" />
            Recursos
          </TabsTrigger>
        </TabsList>

        {/* Types Tab */}
        <TabsContent value="types" className="space-y-4">
          <div className="flex justify-end">
            <Button onClick={openTypeCreateDialog}>
              <Plus className="h-4 w-4 mr-2" />
              Nuevo Tipo
            </Button>
          </div>

          <Card>
            <CardContent className="p-0">
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Código</TableHead>
                      <TableHead>Nombre</TableHead>
                      <TableHead>Unidad</TableHead>
                      <TableHead>Atributos</TableHead>
                      <TableHead>Configuración</TableHead>
                      <TableHead>Recursos</TableHead>
                      <TableHead className="w-24">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {resourceTypes.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                          No hay tipos de recursos. Crea el primero (ej: BANCO, SILO)
                        </TableCell>
                      </TableRow>
                    ) : (
                      resourceTypes.map((type) => {
                        const attrCount = type.attributesSchema ? Object.keys(type.attributesSchema).length : 0;
                        return (
                          <TableRow key={type.id}>
                            <TableCell className="font-mono font-medium">{type.code}</TableCell>
                            <TableCell>
                              <div>
                                <p className="font-medium">{type.name}</p>
                                {type.description && (
                                  <p className="text-xs text-muted-foreground truncate max-w-[150px]">
                                    {type.description}
                                  </p>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              {type.uomCode ? (
                                <Badge variant="outline" className="text-xs font-mono">
                                  {type.uomCode}
                                </Badge>
                              ) : (
                                <span className="text-muted-foreground text-xs">-</span>
                              )}
                            </TableCell>
                            <TableCell>
                              {attrCount > 0 ? (
                                <Badge variant="secondary" className="text-xs">
                                  {attrCount} campo{attrCount !== 1 ? 's' : ''}
                                </Badge>
                              ) : (
                                <span className="text-muted-foreground text-xs">-</span>
                              )}
                            </TableCell>
                            <TableCell>
                              <div className="flex gap-1 flex-wrap">
                                {type.config?.requiresPhotos && (
                                  <Badge variant="outline" className="text-xs">Fotos</Badge>
                                )}
                                {type.config?.hasCapacity && (
                                  <Badge variant="outline" className="text-xs">Capacidad</Badge>
                                )}
                                {type.config?.hasOrder && (
                                  <Badge variant="outline" className="text-xs">Ordenable</Badge>
                                )}
                                {!type.config?.requiresPhotos && !type.config?.hasCapacity && !type.config?.hasOrder && (
                                  <span className="text-muted-foreground text-xs">-</span>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge variant="secondary">{type._count?.resources || 0}</Badge>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => openTypeEditDialog(type)}
                                >
                                  <Edit2 className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => {
                                    setDeleteTarget({ type: 'resourceType', item: type });
                                    setDeleteDialogOpen(true);
                                  }}
                                >
                                  <Trash2 className="h-4 w-4 text-destructive" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Resources Tab */}
        <TabsContent value="resources" className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <Label>Filtrar por tipo:</Label>
              <Select
                value={filterTypeId?.toString() || 'all'}
                onValueChange={(val) => setFilterTypeId(val === 'all' ? null : parseInt(val))}
              >
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Todos los tipos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los tipos</SelectItem>
                  {resourceTypes.map((type) => (
                    <SelectItem key={type.id} value={type.id.toString()}>
                      {type.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Button onClick={openResourceCreateDialog} disabled={resourceTypes.length === 0}>
              <Plus className="h-4 w-4 mr-2" />
              Nuevo Recurso
            </Button>
          </div>

          {resourceTypes.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                Primero crea un tipo de recurso en la pestaña "Tipos de Recursos"
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="p-0">
                {loading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-8"></TableHead>
                        <TableHead>Código</TableHead>
                        <TableHead>Nombre</TableHead>
                        <TableHead>Tipo</TableHead>
                        <TableHead>Atributos</TableHead>
                        <TableHead>Centro de Trabajo</TableHead>
                        <TableHead>Estado</TableHead>
                        <TableHead className="w-24">Acciones</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {resources.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                            No hay recursos. Crea el primero (ej: Banco 1, Silo A)
                          </TableCell>
                        </TableRow>
                      ) : (
                        resources.map((resource) => {
                          const statusInfo = getStatusInfo(resource.status);
                          const resourceType = resourceTypes.find(t => t.id === resource.resourceTypeId);
                          const schema = resourceType?.attributesSchema;
                          const metadata = resource.metadata || {};
                          const metadataEntries = schema
                            ? Object.entries(schema).map(([key, attr]) => ({
                                key,
                                label: attr.label,
                                value: metadata[key],
                                unit: attr.unit,
                                type: attr.type,
                              })).filter(e => e.value !== undefined && e.value !== null && e.value !== '')
                            : [];

                          return (
                            <TableRow key={resource.id}>
                              <TableCell>
                                <GripVertical className="h-4 w-4 text-muted-foreground cursor-grab" />
                              </TableCell>
                              <TableCell className="font-mono font-medium">{resource.code}</TableCell>
                              <TableCell className="font-medium">{resource.name}</TableCell>
                              <TableCell>
                                <Badge variant="outline">{resource.resourceType.name}</Badge>
                              </TableCell>
                              <TableCell>
                                {metadataEntries.length > 0 ? (
                                  <div className="flex flex-wrap gap-1">
                                    {metadataEntries.slice(0, 3).map((entry) => (
                                      <Badge
                                        key={entry.key}
                                        variant="secondary"
                                        className="text-xs font-normal"
                                      >
                                        {entry.label}:{' '}
                                        {entry.type === 'boolean'
                                          ? (entry.value ? 'Sí' : 'No')
                                          : entry.value}
                                        {entry.unit && ` ${entry.unit}`}
                                      </Badge>
                                    ))}
                                    {metadataEntries.length > 3 && (
                                      <Badge variant="outline" className="text-xs">
                                        +{metadataEntries.length - 3}
                                      </Badge>
                                    )}
                                  </div>
                                ) : (
                                  <span className="text-muted-foreground text-xs">-</span>
                                )}
                              </TableCell>
                              <TableCell className="text-muted-foreground">
                                {resource.workCenter?.name || '-'}
                              </TableCell>
                              <TableCell>
                                <Badge className={statusInfo.color}>{statusInfo.label}</Badge>
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center gap-1">
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => openResourceEditDialog(resource)}
                                    title="Editar"
                                  >
                                    <Edit2 className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => handleDuplicateResource(resource)}
                                    title="Duplicar"
                                  >
                                    <Copy className="h-4 w-4 text-info-muted-foreground" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => {
                                      setDeleteTarget({ type: 'resource', item: resource });
                                      setDeleteDialogOpen(true);
                                    }}
                                    title="Eliminar"
                                  >
                                    <Trash2 className="h-4 w-4 text-destructive" />
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          );
                        })
                      )}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {/* Type Create/Edit Dialog */}
      <Dialog open={typeDialogOpen} onOpenChange={setTypeDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {selectedType ? 'Editar Tipo de Recurso' : 'Nuevo Tipo de Recurso'}
            </DialogTitle>
            <DialogDescription>
              Los tipos de recursos definen categorías como BANCO, SILO, ESTACIÓN, etc.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Código *</Label>
                <Input
                  value={typeForm.code}
                  onChange={(e) => setTypeForm({ ...typeForm, code: e.target.value.toUpperCase() })}
                  placeholder="BANCO"
                />
              </div>
              <div className="space-y-2">
                <Label>Nombre *</Label>
                <Input
                  value={typeForm.name}
                  onChange={(e) => setTypeForm({ ...typeForm, name: e.target.value })}
                  placeholder="Banco de Pretensado"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Descripción</Label>
                <Textarea
                  value={typeForm.description}
                  onChange={(e) => setTypeForm({ ...typeForm, description: e.target.value })}
                  placeholder="Descripción opcional..."
                  rows={2}
                />
              </div>
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Ruler className="h-4 w-4" />
                  Unidad de medida
                </Label>
                <Select
                  value={typeForm.uomCode || 'none'}
                  onValueChange={(val) => setTypeForm({ ...typeForm, uomCode: val === 'none' ? '' : val })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Sin unidad" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sin unidad</SelectItem>
                    <SelectItem value="m">Metros (m)</SelectItem>
                    <SelectItem value="m2">Metros² (m²)</SelectItem>
                    <SelectItem value="m3">Metros³ (m³)</SelectItem>
                    <SelectItem value="kg">Kilogramos (kg)</SelectItem>
                    <SelectItem value="tn">Toneladas (tn)</SelectItem>
                    <SelectItem value="u">Unidades (u)</SelectItem>
                    <SelectItem value="l">Litros (l)</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">Unidad principal para medir este tipo</p>
              </div>
            </div>

            <div className="space-y-3">
              <Label className="flex items-center gap-2">
                <Settings2 className="h-4 w-4" />
                Configuración
              </Label>
              <div className="space-y-2 pl-2">
                <div className="flex items-center space-x-2">
                  <Switch
                    checked={typeForm.config.requiresPhotos}
                    onCheckedChange={(checked) =>
                      setTypeForm({
                        ...typeForm,
                        config: { ...typeForm.config, requiresPhotos: checked },
                      })
                    }
                  />
                  <Label className="font-normal">Requiere fotos en rutinas</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Switch
                    checked={typeForm.config.hasCapacity}
                    onCheckedChange={(checked) =>
                      setTypeForm({
                        ...typeForm,
                        config: { ...typeForm.config, hasCapacity: checked },
                      })
                    }
                  />
                  <Label className="font-normal">Tiene capacidad configurable</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Switch
                    checked={typeForm.config.hasOrder}
                    onCheckedChange={(checked) =>
                      setTypeForm({
                        ...typeForm,
                        config: { ...typeForm.config, hasOrder: checked },
                      })
                    }
                  />
                  <Label className="font-normal">Es ordenable (secuencia de producción)</Label>
                </div>
              </div>
            </div>

            {/* Attributes Schema Builder */}
            <div className="space-y-3 border-t pt-4">
              <div className="flex items-center justify-between">
                <Label className="flex items-center gap-2">
                  <ListPlus className="h-4 w-4" />
                  Atributos personalizados
                </Label>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowAttributesBuilder(!showAttributesBuilder)}
                >
                  {showAttributesBuilder ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  {showAttributesBuilder ? 'Ocultar' : 'Configurar'}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Define qué datos adicionales pedir al crear recursos de este tipo (ej: largo, capacidad, zona)
              </p>

              {showAttributesBuilder && (
                <div className="space-y-4 p-3 bg-muted/30 rounded-lg">
                  {/* Existing attributes */}
                  {Object.keys(typeForm.attributesSchema).length > 0 && (
                    <div className="space-y-2">
                      {Object.entries(typeForm.attributesSchema).map(([key, schema]) => (
                        <div
                          key={key}
                          className="flex items-center gap-2 p-2 bg-background rounded-md border"
                        >
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            {getAttributeTypeIcon(schema.type)}
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">{schema.label}</p>
                              <p className="text-xs text-muted-foreground">
                                {key} · {schema.type}
                                {schema.unit && ` (${schema.unit})`}
                                {schema.required && ' · requerido'}
                                {schema.options && ` · ${schema.options.length} opciones`}
                              </p>
                            </div>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => removeAttribute(key)}
                          >
                            <X className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Add new attribute form */}
                  <div className="space-y-3 p-3 border rounded-lg bg-background">
                    <p className="text-sm font-medium">Agregar atributo</p>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label className="text-xs">Clave (ID)</Label>
                        <Input
                          value={newAttrKey}
                          onChange={(e) => setNewAttrKey(e.target.value.toLowerCase().replace(/\s+/g, '_'))}
                          placeholder="largo_m"
                          className="h-8 text-sm"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Etiqueta</Label>
                        <Input
                          value={newAttrSchema.label}
                          onChange={(e) => setNewAttrSchema({ ...newAttrSchema, label: e.target.value })}
                          placeholder="Largo"
                          className="h-8 text-sm"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      <div className="space-y-1">
                        <Label className="text-xs">Tipo</Label>
                        <Select
                          value={newAttrSchema.type}
                          onValueChange={(val) => setNewAttrSchema({
                            ...newAttrSchema,
                            type: val as AttributeSchema['type'],
                            options: val === 'select' ? [] : undefined,
                            unit: val === 'number' ? '' : undefined,
                          })}
                        >
                          <SelectTrigger className="h-8 text-sm">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="text">Texto</SelectItem>
                            <SelectItem value="number">Número</SelectItem>
                            <SelectItem value="select">Selección</SelectItem>
                            <SelectItem value="boolean">Sí/No</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      {newAttrSchema.type === 'number' && (
                        <div className="space-y-1">
                          <Label className="text-xs">Unidad</Label>
                          <Input
                            value={newAttrSchema.unit || ''}
                            onChange={(e) => setNewAttrSchema({ ...newAttrSchema, unit: e.target.value })}
                            placeholder="m, kg, etc."
                            className="h-8 text-sm"
                          />
                        </div>
                      )}
                      <div className="space-y-1 flex items-end">
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={newAttrSchema.required || false}
                            onCheckedChange={(checked) => setNewAttrSchema({ ...newAttrSchema, required: checked })}
                          />
                          <Label className="text-xs font-normal">Requerido</Label>
                        </div>
                      </div>
                    </div>
                    {newAttrSchema.type === 'select' && (
                      <div className="space-y-1">
                        <Label className="text-xs">Opciones (separadas por coma)</Label>
                        <Input
                          value={(newAttrSchema.options || []).join(', ')}
                          onChange={(e) => setNewAttrSchema({
                            ...newAttrSchema,
                            options: e.target.value.split(',').map(s => s.trim()).filter(Boolean),
                          })}
                          placeholder="Norte, Sur, Centro"
                          className="h-8 text-sm"
                        />
                      </div>
                    )}
                    <Button
                      size="sm"
                      onClick={addAttribute}
                      disabled={!newAttrKey || !newAttrSchema.label}
                    >
                      <Plus className="h-4 w-4 mr-1" />
                      Agregar
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setTypeDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSaveType} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {selectedType ? 'Guardar' : 'Crear'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Resource Create/Edit Dialog */}
      <Dialog open={resourceDialogOpen} onOpenChange={setResourceDialogOpen}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {selectedResource ? 'Editar Recurso' : 'Nuevo Recurso'}
            </DialogTitle>
            <DialogDescription>
              Los recursos son instancias específicas (ej: Banco 1, Banco 2, Silo A)
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Tipo de Recurso *</Label>
              <Select
                value={resourceForm.resourceTypeId?.toString() || ''}
                onValueChange={(val) => {
                  const typeId = parseInt(val);
                  const selectedType = resourceTypes.find(t => t.id === typeId);
                  // Reset metadata when type changes
                  const newMetadata: Record<string, any> = {};
                  if (selectedType?.attributesSchema) {
                    Object.entries(selectedType.attributesSchema).forEach(([key, schema]) => {
                      if (schema.default !== undefined) {
                        newMetadata[key] = schema.default;
                      } else if (schema.type === 'boolean') {
                        newMetadata[key] = false;
                      } else if (schema.type === 'number') {
                        newMetadata[key] = null;
                      } else {
                        newMetadata[key] = '';
                      }
                    });
                  }
                  setResourceForm({ ...resourceForm, resourceTypeId: typeId, metadata: newMetadata });
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar tipo" />
                </SelectTrigger>
                <SelectContent>
                  {resourceTypes.map((type) => (
                    <SelectItem key={type.id} value={type.id.toString()}>
                      {type.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Código *</Label>
                <Input
                  value={resourceForm.code}
                  onChange={(e) => setResourceForm({ ...resourceForm, code: e.target.value.toUpperCase() })}
                  placeholder="BANCO_01"
                />
              </div>
              <div className="space-y-2">
                <Label>Nombre *</Label>
                <Input
                  value={resourceForm.name}
                  onChange={(e) => setResourceForm({ ...resourceForm, name: e.target.value })}
                  placeholder="Banco 1"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Centro de Trabajo</Label>
                <Select
                  value={resourceForm.workCenterId?.toString() || 'none'}
                  onValueChange={(val) =>
                    setResourceForm({
                      ...resourceForm,
                      workCenterId: val === 'none' ? null : parseInt(val),
                    })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Sin asignar" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sin asignar</SelectItem>
                    {workCenters.map((wc) => (
                      <SelectItem key={wc.id} value={wc.id.toString()}>
                        {wc.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Estado</Label>
                <Select
                  value={resourceForm.status}
                  onValueChange={(val) =>
                    setResourceForm({
                      ...resourceForm,
                      status: val as 'ACTIVE' | 'MAINTENANCE' | 'INACTIVE',
                    })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUS_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Orden (para secuencia de producción)</Label>
              <Input
                type="number"
                value={resourceForm.order}
                onChange={(e) =>
                  setResourceForm({ ...resourceForm, order: parseInt(e.target.value) || 0 })
                }
                placeholder="0"
              />
            </div>

            {/* Dynamic metadata fields based on attributesSchema */}
            {(() => {
              const selectedType = resourceTypes.find(t => t.id === resourceForm.resourceTypeId);
              const schema = selectedType?.attributesSchema;
              if (!schema || Object.keys(schema).length === 0) return null;

              return (
                <div className="space-y-3 border-t pt-4">
                  <Label className="flex items-center gap-2">
                    <ListPlus className="h-4 w-4" />
                    Atributos del {selectedType?.name}
                  </Label>
                  <div className="grid grid-cols-2 gap-3">
                    {Object.entries(schema).map(([key, attrSchema]) => (
                      <div key={key} className="space-y-1">
                        <Label className="text-sm">
                          {attrSchema.label}
                          {attrSchema.required && <span className="text-destructive ml-1">*</span>}
                          {attrSchema.unit && (
                            <span className="text-muted-foreground font-normal ml-1">({attrSchema.unit})</span>
                          )}
                        </Label>
                        {attrSchema.type === 'text' && (
                          <Input
                            value={resourceForm.metadata[key] || ''}
                            onChange={(e) => setResourceForm({
                              ...resourceForm,
                              metadata: { ...resourceForm.metadata, [key]: e.target.value },
                            })}
                            placeholder={attrSchema.label}
                            className="h-9"
                          />
                        )}
                        {attrSchema.type === 'number' && (
                          <Input
                            type="number"
                            value={resourceForm.metadata[key] ?? ''}
                            onChange={(e) => setResourceForm({
                              ...resourceForm,
                              metadata: {
                                ...resourceForm.metadata,
                                [key]: e.target.value ? parseFloat(e.target.value) : null,
                              },
                            })}
                            placeholder={attrSchema.label}
                            min={attrSchema.min}
                            max={attrSchema.max}
                            className="h-9"
                          />
                        )}
                        {attrSchema.type === 'select' && attrSchema.options && (
                          <Select
                            value={resourceForm.metadata[key] || ''}
                            onValueChange={(val) => setResourceForm({
                              ...resourceForm,
                              metadata: { ...resourceForm.metadata, [key]: val },
                            })}
                          >
                            <SelectTrigger className="h-9">
                              <SelectValue placeholder="Seleccionar..." />
                            </SelectTrigger>
                            <SelectContent>
                              {attrSchema.options.map((opt) => (
                                <SelectItem key={opt} value={opt}>
                                  {opt}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                        {attrSchema.type === 'boolean' && (
                          <div className="flex items-center gap-2 pt-1">
                            <Switch
                              checked={resourceForm.metadata[key] || false}
                              onCheckedChange={(checked) => setResourceForm({
                                ...resourceForm,
                                metadata: { ...resourceForm.metadata, [key]: checked },
                              })}
                            />
                            <span className="text-sm text-muted-foreground">
                              {resourceForm.metadata[key] ? 'Sí' : 'No'}
                            </span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setResourceDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSaveResource} disabled={saveResourceMutation.isPending}>
              {saveResourceMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {selectedResource ? 'Guardar' : 'Crear'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Eliminar {deleteTarget?.type === 'resourceType' ? 'Tipo de Recurso' : 'Recurso'}
            </DialogTitle>
            <DialogDescription>
              ¿Estás seguro de eliminar "{deleteTarget?.item?.name}"? Esta acción no se puede deshacer.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Eliminar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
