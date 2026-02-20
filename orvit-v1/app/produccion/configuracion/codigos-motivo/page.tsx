'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Tags,
  Plus,
  Edit2,
  Trash2,
  Loader2,
  ArrowLeft,
  AlertTriangle,
  Wrench,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import Link from 'next/link';

interface ReasonCode {
  id: number;
  code: string;
  name: string;
  type: string;
  parentId?: number;
  parent?: { id: number; name: string };
  requiresNote: boolean;
  triggersMaintenance: boolean;
  affectsOEE: boolean;
  sortOrder: number;
  isActive: boolean;
  _count?: { children: number };
}

const REASON_TYPES = [
  { value: 'DOWNTIME', label: 'Parada', color: 'bg-destructive/10 text-destructive' },
  { value: 'SCRAP', label: 'Scrap', color: 'bg-warning-muted text-warning-muted-foreground' },
  { value: 'REWORK', label: 'Retrabajo', color: 'bg-warning-muted text-warning-muted-foreground' },
  { value: 'QUALITY_HOLD', label: 'Retención Calidad', color: 'bg-purple-100 text-purple-700' },
];

export default function ReasonCodesConfigPage() {
  const [loading, setLoading] = useState(true);
  const [reasonCodes, setReasonCodes] = useState<ReasonCode[]>([]);
  const [activeTab, setActiveTab] = useState('DOWNTIME');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedCode, setSelectedCode] = useState<ReasonCode | null>(null);
  const [saving, setSaving] = useState(false);

  const [formData, setFormData] = useState({
    code: '',
    name: '',
    type: 'DOWNTIME',
    parentId: '',
    requiresNote: false,
    triggersMaintenance: false,
    affectsOEE: true,
    sortOrder: 0,
    isActive: true,
  });

  const fetchReasonCodes = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/production/reason-codes?flat=true');
      const data = await res.json();
      if (data.success) {
        setReasonCodes(data.reasonCodes);
      }
    } catch (error) {
      console.error('Error:', error);
      toast.error('Error al cargar códigos de motivo');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchReasonCodes();
  }, [fetchReasonCodes]);

  const openCreateDialog = () => {
    setSelectedCode(null);
    setFormData({
      code: '',
      name: '',
      type: activeTab,
      parentId: '',
      requiresNote: false,
      triggersMaintenance: false,
      affectsOEE: true,
      sortOrder: 0,
      isActive: true,
    });
    setDialogOpen(true);
  };

  const openEditDialog = (rc: ReasonCode) => {
    setSelectedCode(rc);
    setFormData({
      code: rc.code,
      name: rc.name,
      type: rc.type,
      parentId: rc.parentId?.toString() || '',
      requiresNote: rc.requiresNote,
      triggersMaintenance: rc.triggersMaintenance,
      affectsOEE: rc.affectsOEE,
      sortOrder: rc.sortOrder,
      isActive: rc.isActive,
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formData.code || !formData.name) {
      toast.error('Código y nombre son requeridos');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        ...formData,
        parentId: formData.parentId ? parseInt(formData.parentId) : null,
      };

      const url = selectedCode
        ? `/api/production/reason-codes/${selectedCode.id}`
        : '/api/production/reason-codes';

      const res = await fetch(url, {
        method: selectedCode ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (data.success) {
        toast.success(selectedCode ? 'Código actualizado' : 'Código creado');
        setDialogOpen(false);
        fetchReasonCodes();
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

  const handleDelete = async () => {
    if (!selectedCode) return;

    setSaving(true);
    try {
      const res = await fetch(`/api/production/reason-codes/${selectedCode.id}`, {
        method: 'DELETE',
      });

      const data = await res.json();

      if (data.success) {
        toast.success('Código eliminado');
        setDeleteDialogOpen(false);
        fetchReasonCodes();
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

  const filteredCodes = reasonCodes.filter((rc) => rc.type === activeTab);

  const getTypeBadge = (type: string) => {
    const typeInfo = REASON_TYPES.find((t) => t.value === type);
    return <Badge className={typeInfo?.color}>{typeInfo?.label || type}</Badge>;
  };

  const getParentOptions = () => {
    return reasonCodes.filter(
      (rc) =>
        rc.type === formData.type &&
        rc.id !== selectedCode?.id &&
        !rc.parentId // Only top-level codes can be parents
    );
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
              <Tags className="h-6 w-6 text-warning-muted-foreground" />
              Códigos de Motivo
            </h1>
            <p className="text-muted-foreground text-sm">
              Define motivos para paradas, scrap, retrabajo y calidad
            </p>
          </div>
        </div>

        <Button onClick={openCreateDialog}>
          <Plus className="h-4 w-4 mr-2" />
          Nuevo Código
        </Button>
      </div>

      {/* Tabs by Type */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="w-full max-w-lg justify-start overflow-x-auto">
          {REASON_TYPES.map((type) => (
            <TabsTrigger key={type.value} value={type.value}>
              {type.label}
            </TabsTrigger>
          ))}
        </TabsList>

        {REASON_TYPES.map((type) => (
          <TabsContent key={type.value} value={type.value}>
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
                        <TableHead>Categoría</TableHead>
                        <TableHead>Notas</TableHead>
                        <TableHead>OT</TableHead>
                        <TableHead>OEE</TableHead>
                        <TableHead>Estado</TableHead>
                        <TableHead className="w-24">Acciones</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredCodes.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                            No hay códigos de tipo {type.label.toLowerCase()}
                          </TableCell>
                        </TableRow>
                      ) : (
                        filteredCodes.map((rc) => (
                          <TableRow key={rc.id} className={rc.parentId ? 'bg-muted' : ''}>
                            <TableCell className="font-mono">
                              {rc.parentId && <span className="text-muted-foreground mr-2">└</span>}
                              {rc.code}
                            </TableCell>
                            <TableCell className="font-medium">{rc.name}</TableCell>
                            <TableCell>{rc.parent?.name || '-'}</TableCell>
                            <TableCell>
                              {rc.requiresNote && (
                                <Badge variant="outline" className="text-xs">
                                  Req. Notas
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell>
                              {rc.triggersMaintenance && (
                                <Badge className="bg-info-muted text-info-muted-foreground">
                                  <Wrench className="h-3 w-3 mr-1" />
                                  Crea OT
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell>
                              {rc.affectsOEE ? (
                                <Badge className="bg-destructive/10 text-destructive text-xs">Afecta OEE</Badge>
                              ) : (
                                <span className="text-muted-foreground text-xs">No afecta</span>
                              )}
                            </TableCell>
                            <TableCell>
                              <Badge
                                className={
                                  rc.isActive
                                    ? 'bg-success-muted text-success'
                                    : 'bg-muted text-muted-foreground'
                                }
                              >
                                {rc.isActive ? 'Activo' : 'Inactivo'}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => openEditDialog(rc)}
                                >
                                  <Edit2 className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => {
                                    setSelectedCode(rc);
                                    setDeleteDialogOpen(true);
                                  }}
                                >
                                  <Trash2 className="h-4 w-4 text-destructive" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        ))}
      </Tabs>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {selectedCode ? 'Editar Código de Motivo' : 'Nuevo Código de Motivo'}
            </DialogTitle>
            <DialogDescription>
              {selectedCode
                ? 'Modifica los datos del código'
                : 'Ingresa los datos del nuevo código de motivo'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Código *</Label>
                <Input
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                  placeholder="DT-001"
                />
              </div>
              <div className="space-y-2">
                <Label>Tipo *</Label>
                <Select
                  value={formData.type}
                  onValueChange={(val) =>
                    setFormData({ ...formData, type: val, parentId: '' })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {REASON_TYPES.map((t) => (
                      <SelectItem key={t.value} value={t.value}>
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Nombre *</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Falla Mecánica"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Categoría (Padre)</Label>
                <Select
                  value={formData.parentId}
                  onValueChange={(val) => setFormData({ ...formData, parentId: val })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Sin categoría" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Sin categoría</SelectItem>
                    {getParentOptions().map((rc) => (
                      <SelectItem key={rc.id} value={rc.id.toString()}>
                        [{rc.code}] {rc.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Orden</Label>
                <Input
                  type="number"
                  value={formData.sortOrder}
                  onChange={(e) =>
                    setFormData({ ...formData, sortOrder: parseInt(e.target.value) || 0 })
                  }
                />
              </div>
            </div>

            <div className="space-y-3 pt-2">
              <div className="flex items-center space-x-2">
                <Checkbox
                  checked={formData.requiresNote}
                  onCheckedChange={(checked) =>
                    setFormData({ ...formData, requiresNote: !!checked })
                  }
                />
                <Label>Requiere notas/descripción</Label>
              </div>

              {formData.type === 'DOWNTIME' && (
                <div className="flex items-center space-x-2">
                  <Checkbox
                    checked={formData.triggersMaintenance}
                    onCheckedChange={(checked) =>
                      setFormData({ ...formData, triggersMaintenance: !!checked })
                    }
                  />
                  <div>
                    <Label>Sugiere crear Orden de Trabajo</Label>
                    <p className="text-xs text-muted-foreground">
                      Se mostrará opción de crear OT de mantenimiento
                    </p>
                  </div>
                </div>
              )}

              <div className="flex items-center space-x-2">
                <Checkbox
                  checked={formData.affectsOEE}
                  onCheckedChange={(checked) =>
                    setFormData({ ...formData, affectsOEE: !!checked })
                  }
                />
                <div>
                  <Label>Afecta el cálculo de OEE</Label>
                  <p className="text-xs text-muted-foreground">
                    Si está deshabilitado, no se contabiliza como pérdida
                  </p>
                </div>
              </div>

              <div className="flex items-center space-x-2 pt-2">
                <Switch
                  checked={formData.isActive}
                  onCheckedChange={(checked) => setFormData({ ...formData, isActive: checked })}
                />
                <Label>Código Activo</Label>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {selectedCode ? 'Guardar' : 'Crear'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Eliminar Código de Motivo</DialogTitle>
            <DialogDescription>
              ¿Estás seguro de eliminar "{selectedCode?.name}"? Esta acción no se puede
              deshacer.
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
