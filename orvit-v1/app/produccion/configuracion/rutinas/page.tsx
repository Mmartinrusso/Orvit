'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  ListChecks,
  Plus,
  Edit2,
  Trash2,
  Loader2,
  Search,
  ArrowLeft,
  CheckSquare,
  Hash,
  FileText,
  Play,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
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
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import Link from 'next/link';
import { useCompany } from '@/contexts/CompanyContext';
import NewRoutineTemplateForm from '@/components/production/NewRoutineTemplateForm';
import NewRoutineExecutionForm from '@/components/production/NewRoutineExecutionForm';

interface RoutineTemplate {
  id: number;
  code: string;
  name: string;
  type: string;
  frequency: string;
  isActive: boolean;
  items: any[];
  workCenter: { id: number; name: string; code: string } | null;
  _count: { executions: number };
}

const ROUTINE_TYPES: Record<string, { label: string; color: string }> = {
  SHIFT_START: { label: 'Inicio de Turno', color: 'bg-info' },
  SHIFT_END: { label: 'Fin de Turno', color: 'bg-indigo-500' },
  SETUP: { label: 'Setup/Cambio', color: 'bg-purple-500' },
  SAFETY: { label: 'Seguridad', color: 'bg-destructive' },
  '5S': { label: '5S', color: 'bg-success' },
};

const FREQUENCIES: Record<string, string> = {
  EVERY_SHIFT: 'Cada turno',
  DAILY: 'Diario',
  WEEKLY: 'Semanal',
};

export default function RoutineTemplatesConfigPage() {
  const { currentSector } = useCompany();
  const [loading, setLoading] = useState(true);
  const [templates, setTemplates] = useState<RoutineTemplate[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [executeDialogOpen, setExecuteDialogOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<RoutineTemplate | null>(null);
  const [saving, setSaving] = useState(false);

  const fetchTemplates = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/production/routines/templates?limit=200');
      const data = await res.json();
      if (data.success) {
        setTemplates(data.templates);
      }
    } catch (error) {
      console.error('Error:', error);
      toast.error('Error al cargar plantillas');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  const openCreateDialog = () => {
    setSelectedTemplate(null);
    setDialogOpen(true);
  };

  const openEditDialog = (template: RoutineTemplate) => {
    setSelectedTemplate(template);
    setDialogOpen(true);
  };

  const handleDelete = async () => {
    if (!selectedTemplate) return;

    setSaving(true);
    try {
      const res = await fetch(`/api/production/routines/templates/${selectedTemplate.id}`, {
        method: 'DELETE',
      });

      const data = await res.json();

      if (data.success) {
        toast.success(data.message || 'Plantilla eliminada');
        setDeleteDialogOpen(false);
        setSelectedTemplate(null);
        fetchTemplates();
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

  const filteredTemplates = templates.filter(
    (t) =>
      t.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getTypeInfo = (type: string) => {
    return ROUTINE_TYPES[type] || { label: type, color: 'bg-muted-foreground' };
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
              <ListChecks className="h-6 w-6 text-purple-600" />
              Plantillas de Rutinas
            </h1>
            <p className="text-muted-foreground text-sm">
              Checklists operativos para turnos, setup y seguridad
            </p>
          </div>
        </div>

        <Button onClick={openCreateDialog}>
          <Plus className="h-4 w-4 mr-2" />
          Nueva Plantilla
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
                  <TableHead>Frecuencia</TableHead>
                  <TableHead>Items</TableHead>
                  <TableHead>Ejecuciones</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="w-24">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTemplates.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                      <ListChecks className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      No se encontraron plantillas
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredTemplates.map((template) => {
                    const typeInfo = getTypeInfo(template.type);
                    return (
                      <TableRow key={template.id}>
                        <TableCell className="font-mono">{template.code}</TableCell>
                        <TableCell className="font-medium">{template.name}</TableCell>
                        <TableCell>
                          <Badge className={`${typeInfo.color} text-white`}>
                            {typeInfo.label}
                          </Badge>
                        </TableCell>
                        <TableCell>{FREQUENCIES[template.frequency] || template.frequency}</TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {Array.isArray(template.items) ? template.items.length : 0} items
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <span className="text-muted-foreground">{template._count?.executions || 0}</span>
                        </TableCell>
                        <TableCell>
                          {template.isActive ? (
                            <Badge variant="secondary" className="text-success bg-success-muted">
                              Activa
                            </Badge>
                          ) : (
                            <Badge variant="secondary" className="text-muted-foreground bg-muted">
                              Inactiva
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            {template.isActive && (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => {
                                  setSelectedTemplate(template);
                                  setExecuteDialogOpen(true);
                                }}
                                title="Ejecutar rutina"
                              >
                                <Play className="h-4 w-4 text-success" />
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => openEditDialog(template)}
                              title="Editar"
                            >
                              <Edit2 className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => {
                                setSelectedTemplate(template);
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

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(open) => {
        setDialogOpen(open);
        if (!open) setSelectedTemplate(null);
      }}>
        <DialogContent size="full" className="max-h-[90vh] overflow-y-auto p-0">
          <DialogHeader className="px-6 py-4 border-b sticky top-0 bg-background z-10">
            <DialogTitle>
              {selectedTemplate ? 'Editar Plantilla' : 'Nueva Plantilla de Rutina'}
            </DialogTitle>
            <DialogDescription>
              {selectedTemplate
                ? 'Modifica los datos de la plantilla'
                : 'Configure una nueva plantilla de rutina operativa'}
            </DialogDescription>
          </DialogHeader>
          <div className="p-6">
          <NewRoutineTemplateForm
            template={selectedTemplate}
            defaultSectorId={currentSector?.id}
            onSuccess={() => {
              setDialogOpen(false);
              setSelectedTemplate(null);
              fetchTemplates();
            }}
            onCancel={() => {
              setDialogOpen(false);
              setSelectedTemplate(null);
            }}
          />
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Eliminar Plantilla</DialogTitle>
            <DialogDescription>
              ¿Estás seguro de eliminar "{selectedTemplate?.name}"?
              {selectedTemplate?._count?.executions ? (
                <span className="block mt-2 text-warning-muted-foreground">
                  Esta plantilla tiene {selectedTemplate._count.executions} ejecuciones.
                  Solo se desactivará.
                </span>
              ) : (
                <span className="block mt-2">Esta acción no se puede deshacer.</span>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Eliminar
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Execute Dialog */}
      <Dialog open={executeDialogOpen} onOpenChange={(open) => {
        setExecuteDialogOpen(open);
        if (!open) setSelectedTemplate(null);
      }}>
        <DialogContent className="!max-w-3xl w-[95vw] max-h-[90vh] overflow-y-auto p-0">
          <DialogHeader className="flex-shrink-0 px-6 py-4 border-b sticky top-0 bg-background z-10">
            <DialogTitle>Ejecutar Rutina</DialogTitle>
            <DialogDescription>
              Ejecutar rutina: {selectedTemplate?.name}
            </DialogDescription>
          </DialogHeader>
          <div className="px-6 py-4">
            <NewRoutineExecutionForm
              preselectedTemplate={selectedTemplate as any}
              onSuccess={() => {
                setExecuteDialogOpen(false);
                setSelectedTemplate(null);
                fetchTemplates(); // Refresh to update execution count
                toast.success('Rutina ejecutada correctamente');
              }}
              onCancel={() => {
                setExecuteDialogOpen(false);
                setSelectedTemplate(null);
              }}
            />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
