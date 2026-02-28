'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Clock,
  Plus,
  Edit2,
  Trash2,
  Loader2,
  ArrowLeft,
  Sun,
  Moon,
  Sunrise,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
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
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import Link from 'next/link';

interface Shift {
  id: number;
  code: string;
  name: string;
  type: string;
  startTime: string;
  endTime: string;
  breakMinutes: number;
  isActive: boolean;
}

const SHIFT_TYPES = [
  { value: 'MORNING', label: 'Mañana', icon: Sunrise },
  { value: 'AFTERNOON', label: 'Tarde', icon: Sun },
  { value: 'NIGHT', label: 'Noche', icon: Moon },
  { value: 'SPLIT', label: 'Partido', icon: Clock },
  { value: 'ROTATIVE', label: 'Rotativo', icon: Clock },
];

export default function ShiftsConfigPage() {
  const { hasPermission } = useAuth();
  const canManageShifts = hasPermission('produccion.config.shifts');
  const [loading, setLoading] = useState(true);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedShift, setSelectedShift] = useState<Shift | null>(null);
  const [saving, setSaving] = useState(false);

  const [formData, setFormData] = useState({
    code: '',
    name: '',
    type: 'MORNING',
    startTime: '06:00',
    endTime: '14:00',
    breakMinutes: 30,
    isActive: true,
  });

  const fetchShifts = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/production/shifts');
      const data = await res.json();
      if (data.success) {
        setShifts(data.shifts);
      }
    } catch (error) {
      console.error('Error:', error);
      toast.error('Error al cargar turnos');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchShifts();
  }, [fetchShifts]);

  const openCreateDialog = () => {
    setSelectedShift(null);
    setFormData({
      code: '',
      name: '',
      type: 'MORNING',
      startTime: '06:00',
      endTime: '14:00',
      breakMinutes: 30,
      isActive: true,
    });
    setDialogOpen(true);
  };

  const openEditDialog = (shift: Shift) => {
    setSelectedShift(shift);
    setFormData({
      code: shift.code,
      name: shift.name,
      type: shift.type,
      startTime: shift.startTime,
      endTime: shift.endTime,
      breakMinutes: shift.breakMinutes,
      isActive: shift.isActive,
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
      const url = selectedShift
        ? `/api/production/shifts/${selectedShift.id}`
        : '/api/production/shifts';

      const res = await fetch(url, {
        method: selectedShift ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const data = await res.json();

      if (data.success) {
        toast.success(selectedShift ? 'Turno actualizado' : 'Turno creado');
        setDialogOpen(false);
        fetchShifts();
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
    if (!selectedShift) return;

    setSaving(true);
    try {
      const res = await fetch(`/api/production/shifts/${selectedShift.id}`, {
        method: 'DELETE',
      });

      const data = await res.json();

      if (data.success) {
        toast.success('Turno eliminado');
        setDeleteDialogOpen(false);
        fetchShifts();
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

  const getTypeInfo = (type: string) => {
    return SHIFT_TYPES.find((t) => t.value === type) || SHIFT_TYPES[0];
  };

  const calculateDuration = (start: string, end: string, breakMin: number) => {
    const [startH, startM] = start.split(':').map(Number);
    const [endH, endM] = end.split(':').map(Number);
    let totalMin = (endH * 60 + endM) - (startH * 60 + startM);
    if (totalMin < 0) totalMin += 24 * 60; // Crosses midnight
    const netMin = totalMin - breakMin;
    const hours = Math.floor(netMin / 60);
    const mins = netMin % 60;
    return `${hours}h ${mins > 0 ? mins + 'm' : ''}`;
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
              <Clock className="h-6 w-6 text-success" />
              Turnos de Trabajo
            </h1>
            <p className="text-muted-foreground text-sm">
              Configura los horarios de los turnos de producción
            </p>
          </div>
        </div>

        {canManageShifts && (
          <Button onClick={openCreateDialog}>
            <Plus className="h-4 w-4 mr-2" />
            Nuevo Turno
          </Button>
        )}
      </div>

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
                  <TableHead>Horario</TableHead>
                  <TableHead>Descanso</TableHead>
                  <TableHead>Duración Neta</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="w-24">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {shifts.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                      No hay turnos configurados
                    </TableCell>
                  </TableRow>
                ) : (
                  shifts.map((shift) => {
                    const typeInfo = getTypeInfo(shift.type);
                    const TypeIcon = typeInfo.icon;
                    return (
                      <TableRow key={shift.id}>
                        <TableCell className="font-mono">{shift.code}</TableCell>
                        <TableCell className="font-medium">{shift.name}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <TypeIcon className="h-4 w-4 text-muted-foreground" />
                            {typeInfo.label}
                          </div>
                        </TableCell>
                        <TableCell>
                          {shift.startTime} - {shift.endTime}
                        </TableCell>
                        <TableCell>{shift.breakMinutes} min</TableCell>
                        <TableCell>
                          {calculateDuration(shift.startTime, shift.endTime, shift.breakMinutes)}
                        </TableCell>
                        <TableCell>
                          <Badge
                            className={
                              shift.isActive
                                ? 'bg-success-muted text-success'
                                : 'bg-muted text-muted-foreground'
                            }
                          >
                            {shift.isActive ? 'Activo' : 'Inactivo'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {canManageShifts && (
                            <div className="flex items-center gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => openEditDialog(shift)}
                              >
                                <Edit2 className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => {
                                  setSelectedShift(shift);
                                  setDeleteDialogOpen(true);
                                }}
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </div>
                          )}
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

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {selectedShift ? 'Editar Turno' : 'Nuevo Turno'}
            </DialogTitle>
            <DialogDescription>
              {selectedShift
                ? 'Modifica los datos del turno'
                : 'Ingresa los datos del nuevo turno'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Código *</Label>
                <Input
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                  placeholder="T1"
                />
              </div>
              <div className="space-y-2">
                <Label>Tipo</Label>
                <Select
                  value={formData.type}
                  onValueChange={(val) => setFormData({ ...formData, type: val })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SHIFT_TYPES.map((t) => (
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
                placeholder="Turno Mañana"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Hora de Inicio</Label>
                <Input
                  type="time"
                  value={formData.startTime}
                  onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Hora de Fin</Label>
                <Input
                  type="time"
                  value={formData.endTime}
                  onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Minutos de Descanso</Label>
              <Input
                type="number"
                value={formData.breakMinutes}
                onChange={(e) =>
                  setFormData({ ...formData, breakMinutes: parseInt(e.target.value) || 0 })
                }
                placeholder="30"
              />
            </div>

            <div className="flex items-center space-x-2">
              <Switch
                checked={formData.isActive}
                onCheckedChange={(checked) => setFormData({ ...formData, isActive: checked })}
              />
              <Label>Turno Activo</Label>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {selectedShift ? 'Guardar' : 'Crear'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Eliminar Turno</DialogTitle>
            <DialogDescription>
              ¿Estás seguro de eliminar "{selectedShift?.name}"? Esta acción no se puede
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
