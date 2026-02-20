'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Building2,
  Plus,
  Edit2,
  Trash2,
  Loader2,
  Search,
  ArrowLeft,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
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
import { toast } from 'sonner';
import Link from 'next/link';

interface WorkCenter {
  id: number;
  code: string;
  name: string;
  type: string;
  description?: string;
  status: string;
  theoreticalCapacity?: number;
  capacityUnit?: string;
  parent?: { id: number; name: string };
  machine?: { id: number; name: string };
}

const WORK_CENTER_TYPES = [
  { value: 'LINE', label: 'Línea' },
  { value: 'MACHINE', label: 'Máquina' },
  { value: 'STATION', label: 'Estación' },
  { value: 'CELL', label: 'Célula' },
  { value: 'MOLD', label: 'Molde' },
  { value: 'OTHER', label: 'Otro' },
];

const STATUS_OPTIONS = [
  { value: 'ACTIVE', label: 'Activo', color: 'bg-success-muted text-success' },
  { value: 'MAINTENANCE', label: 'En Mantenimiento', color: 'bg-warning-muted text-warning-muted-foreground' },
  { value: 'INACTIVE', label: 'Inactivo', color: 'bg-muted text-foreground' },
];

export default function WorkCentersConfigPage() {
  const [loading, setLoading] = useState(true);
  const [workCenters, setWorkCenters] = useState<WorkCenter[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedWorkCenter, setSelectedWorkCenter] = useState<WorkCenter | null>(null);
  const [saving, setSaving] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    code: '',
    name: '',
    type: 'LINE',
    description: '',
    status: 'ACTIVE',
    theoreticalCapacity: '',
    capacityUnit: '',
    parentId: '',
  });

  const fetchWorkCenters = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/production/work-centers?limit=200');
      const data = await res.json();
      if (data.success) {
        setWorkCenters(data.workCenters);
      }
    } catch (error) {
      console.error('Error:', error);
      toast.error('Error al cargar centros de trabajo');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchWorkCenters();
  }, [fetchWorkCenters]);

  const openCreateDialog = () => {
    setSelectedWorkCenter(null);
    setFormData({
      code: '',
      name: '',
      type: 'LINE',
      description: '',
      status: 'ACTIVE',
      theoreticalCapacity: '',
      capacityUnit: '',
      parentId: '',
    });
    setDialogOpen(true);
  };

  const openEditDialog = (wc: WorkCenter) => {
    setSelectedWorkCenter(wc);
    setFormData({
      code: wc.code,
      name: wc.name,
      type: wc.type,
      description: wc.description || '',
      status: wc.status,
      theoreticalCapacity: wc.theoreticalCapacity?.toString() || '',
      capacityUnit: wc.capacityUnit || '',
      parentId: wc.parent?.id?.toString() || '',
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
        theoreticalCapacity: formData.theoreticalCapacity ? parseFloat(formData.theoreticalCapacity) : null,
        parentId: formData.parentId ? parseInt(formData.parentId) : null,
      };

      const url = selectedWorkCenter
        ? `/api/production/work-centers/${selectedWorkCenter.id}`
        : '/api/production/work-centers';

      const res = await fetch(url, {
        method: selectedWorkCenter ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (data.success) {
        toast.success(selectedWorkCenter ? 'Centro actualizado' : 'Centro creado');
        setDialogOpen(false);
        fetchWorkCenters();
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
    if (!selectedWorkCenter) return;

    setSaving(true);
    try {
      const res = await fetch(`/api/production/work-centers/${selectedWorkCenter.id}`, {
        method: 'DELETE',
      });

      const data = await res.json();

      if (data.success) {
        toast.success('Centro eliminado');
        setDeleteDialogOpen(false);
        fetchWorkCenters();
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

  const filteredWorkCenters = workCenters.filter(
    (wc) =>
      wc.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      wc.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getTypeLabel = (type: string) => {
    return WORK_CENTER_TYPES.find((t) => t.value === type)?.label || type;
  };

  const getStatusBadge = (status: string) => {
    const option = STATUS_OPTIONS.find((s) => s.value === status);
    return (
      <Badge className={option?.color || 'bg-muted text-foreground'}>
        {option?.label || status}
      </Badge>
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
              <Building2 className="h-6 w-6 text-info-muted-foreground" />
              Centros de Trabajo
            </h1>
            <p className="text-muted-foreground text-sm">
              Líneas, máquinas, estaciones y celdas de producción
            </p>
          </div>
        </div>

        <Button onClick={openCreateDialog}>
          <Plus className="h-4 w-4 mr-2" />
          Nuevo Centro
        </Button>
      </div>

      {/* Search */}
      <Card>
        <CardContent className="pt-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por código o nombre..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>
        </CardContent>
      </Card>

      {/* Table */}
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
                  <TableHead>Tipo</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Padre</TableHead>
                  <TableHead>Capacidad</TableHead>
                  <TableHead className="w-24">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredWorkCenters.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                      No se encontraron centros de trabajo
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredWorkCenters.map((wc) => (
                    <TableRow key={wc.id}>
                      <TableCell className="font-mono">{wc.code}</TableCell>
                      <TableCell className="font-medium">{wc.name}</TableCell>
                      <TableCell>{getTypeLabel(wc.type)}</TableCell>
                      <TableCell>{getStatusBadge(wc.status)}</TableCell>
                      <TableCell>{wc.parent?.name || '-'}</TableCell>
                      <TableCell>
                        {wc.theoreticalCapacity
                          ? `${wc.theoreticalCapacity} ${wc.capacityUnit || ''}`
                          : '-'}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openEditDialog(wc)}
                          >
                            <Edit2 className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              setSelectedWorkCenter(wc);
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

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {selectedWorkCenter ? 'Editar Centro de Trabajo' : 'Nuevo Centro de Trabajo'}
            </DialogTitle>
            <DialogDescription>
              {selectedWorkCenter
                ? 'Modifica los datos del centro de trabajo'
                : 'Ingresa los datos del nuevo centro de trabajo'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Código *</Label>
                <Input
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                  placeholder="LC-001"
                />
              </div>
              <div className="space-y-2">
                <Label>Tipo *</Label>
                <Select
                  value={formData.type}
                  onValueChange={(val) => setFormData({ ...formData, type: val })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {WORK_CENTER_TYPES.map((t) => (
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
                placeholder="Línea de Corte 1"
              />
            </div>

            <div className="space-y-2">
              <Label>Descripción</Label>
              <Textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Descripción opcional..."
                rows={2}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Estado</Label>
                <Select
                  value={formData.status}
                  onValueChange={(val) => setFormData({ ...formData, status: val })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUS_OPTIONS.map((s) => (
                      <SelectItem key={s.value} value={s.value}>
                        {s.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Centro Padre</Label>
                <Select
                  value={formData.parentId}
                  onValueChange={(val) => setFormData({ ...formData, parentId: val })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Sin padre" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Sin padre</SelectItem>
                    {workCenters
                      .filter((wc) => wc.id !== selectedWorkCenter?.id)
                      .map((wc) => (
                        <SelectItem key={wc.id} value={wc.id.toString()}>
                          [{wc.code}] {wc.name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Capacidad Teórica</Label>
                <Input
                  type="number"
                  value={formData.theoreticalCapacity}
                  onChange={(e) =>
                    setFormData({ ...formData, theoreticalCapacity: e.target.value })
                  }
                  placeholder="100"
                />
              </div>
              <div className="space-y-2">
                <Label>Unidad de Capacidad</Label>
                <Input
                  value={formData.capacityUnit}
                  onChange={(e) => setFormData({ ...formData, capacityUnit: e.target.value })}
                  placeholder="unidades/hora"
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {selectedWorkCenter ? 'Guardar' : 'Crear'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Eliminar Centro de Trabajo</DialogTitle>
            <DialogDescription>
              ¿Estás seguro de eliminar "{selectedWorkCenter?.name}"? Esta acción no se puede
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
