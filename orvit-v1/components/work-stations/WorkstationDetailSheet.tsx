'use client';

import React, { useState, useEffect } from 'react';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetBody,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogBody,
} from '@/components/ui/dialog';
import {
  Building2,
  Edit,
  MoreVertical,
  FileText,
  Wrench,
  Clock,
  Copy,
  Power,
  PowerOff,
  Plus,
  Trash2,
  Search,
  Users,
  Eye,
} from 'lucide-react';
import { WorkStation } from './WorkstationCard';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface WorkstationDetailSheetProps {
  workstation: WorkStation | null;
  isOpen: boolean;
  onClose: () => void;
  onEdit?: (workstation: WorkStation) => void;
  onDelete?: (workstation: WorkStation) => void;
  onDuplicate?: (workstation: WorkStation) => void;
  onToggleStatus?: (workstation: WorkStation) => void;
  onAddInstructive?: (workstation: WorkStation) => void;
  onManageMachines?: (workstation: WorkStation) => void;
  canEdit?: boolean;
  canDelete?: boolean;
  loading?: boolean;
}

const statusLabels: Record<string, string> = {
  'ACTIVE': 'Activo',
  'INACTIVE': 'Inactivo',
  'MAINTENANCE': 'En mantenimiento',
};

const statusColors: Record<string, string> = {
  'ACTIVE': 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20',
  'INACTIVE': 'bg-muted text-muted-foreground border-border',
  'MAINTENANCE': 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20',
};

export function WorkstationDetailSheet({
  workstation,
  isOpen,
  onClose,
  onEdit,
  onDelete,
  onDuplicate,
  onToggleStatus,
  onAddInstructive,
  onManageMachines,
  canEdit = false,
  canDelete = false,
  loading = false,
}: WorkstationDetailSheetProps) {
  const [activeTab, setActiveTab] = useState('resumen');
  const [searchInstructives, setSearchInstructives] = useState('');
  const [selectedInstructive, setSelectedInstructive] = useState<any | null>(null);
  const [instructiveDialogOpen, setInstructiveDialogOpen] = useState(false);
  const [loadingComponents, setLoadingComponents] = useState(false);
  const [componentsMap, setComponentsMap] = useState<Map<number, any>>(new Map());

  useEffect(() => {
    if (isOpen) {
      setActiveTab('resumen');
      setSearchInstructives('');
    }
  }, [isOpen]);

  if (!workstation) return null;

  const formatDate = (date?: string | Date) => {
    if (!date) return 'Sin dato';
    try {
      const dateObj = typeof date === 'string' ? new Date(date) : date;
      return format(dateObj, 'dd/MM/yyyy', { locale: es });
    } catch {
      return 'Sin dato';
    }
  };

  const instructives = workstation.instructives || [];
  // Transformar las máquinas para obtener la estructura correcta (pueden venir como WorkStationMachine con .machine anidado)
  const machines = (workstation.machines || []).map((m: any) => {
    // Si tiene .machine anidado, extraer la info
    if (m.machine) {
      return {
        id: m.machine.id,
        name: m.machine.name || m.machine.nickname || 'Sin nombre',
      };
    }
    // Si ya viene plano, usarlo directamente
    return {
      id: m.id,
      name: m.name || 'Sin nombre',
    };
  });
  const filteredInstructives = instructives.filter(instr =>
    instr.title.toLowerCase().includes(searchInstructives.toLowerCase())
  );

  const handleViewInstructive = async (instructive: any) => {
    setSelectedInstructive(instructive);
    setInstructiveDialogOpen(true);

    // Cargar componentes si el instructivo tiene componentIds
    const componentIds = (() => {
      try {
        if (Array.isArray(instructive?.componentIds)) {
          return instructive.componentIds;
        }
        if (typeof instructive?.componentIds === 'string') {
          return JSON.parse(instructive.componentIds);
        }
        return [];
      } catch {
        return [];
      }
    })();

    if (componentIds.length > 0 && workstation?.companyId) {
      setLoadingComponents(true);
      try {
        const response = await fetch(`/api/components`);
        if (response.ok) {
          const allComponents = await response.json();
          const newMap = new Map();

          // Filtrar solo los componentes que necesitamos
          allComponents.forEach((comp: any) => {
            if (componentIds.includes(comp.id)) {
              newMap.set(comp.id, comp);
            }
          });

          setComponentsMap(newMap);
        }
      } catch (error) {
        console.error('Error cargando componentes:', error);
      } finally {
        setLoadingComponents(false);
      }
    }
  };

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent side="right" size="lg">
        <SheetHeader>
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <SheetTitle className="text-lg font-semibold line-clamp-2">
                {workstation.name || 'Sin nombre'}
              </SheetTitle>
              <SheetDescription className="mt-1 text-xs text-muted-foreground">
                Código: {workstation.code} • Sector: {workstation.sector.name}
              </SheetDescription>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Badge
                variant="outline"
                className={cn('text-xs px-2 py-0.5 h-5 border', statusColors[workstation.status])}
              >
                {statusLabels[workstation.status] || workstation.status}
              </Badge>
              {canEdit && onEdit && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onEdit(workstation)}
                  className="h-8 text-xs"
                >
                  <Edit className="h-3.5 w-3.5 mr-1" />
                  Editar
                </Button>
              )}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon">
                    <MoreVertical className="h-4 w-4" />
                    <span className="sr-only">Acciones</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  {onDuplicate && (
                    <DropdownMenuItem onClick={() => onDuplicate(workstation)}>
                      <Copy className="h-4 w-4 mr-2" />
                      Duplicar
                    </DropdownMenuItem>
                  )}
                  {onToggleStatus && (
                    <DropdownMenuItem onClick={() => onToggleStatus(workstation)}>
                      {workstation.status === 'ACTIVE' ? (
                        <>
                          <PowerOff className="h-4 w-4 mr-2" />
                          Desactivar
                        </>
                      ) : (
                        <>
                          <Power className="h-4 w-4 mr-2" />
                          Activar
                        </>
                      )}
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuSeparator />
                  {canDelete && onDelete && (
                    <DropdownMenuItem
                      onClick={() => onDelete(workstation)}
                      className="text-destructive focus:text-destructive"
                    >
                      Eliminar
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </SheetHeader>

        <SheetBody>
          {/* KPIs */}
          <div className="grid grid-cols-3 gap-3">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground">
                Instructivos
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-semibold">{instructives.length}</div>
              {onAddInstructive && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onAddInstructive(workstation)}
                  className="h-6 text-xs px-2 mt-2"
                >
                  <Plus className="h-3 w-3 mr-1" />
                  Agregar
                </Button>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground">
                Máquinas
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-semibold">{machines.length}</div>
              {onManageMachines && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onManageMachines(workstation)}
                  className="h-6 text-xs px-2 mt-2"
                >
                  Gestionar
                </Button>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground">
                Creado
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-sm font-normal">{formatDate(workstation.createdAt)}</div>
            </CardContent>
          </Card>
        </div>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-4">
          <TabsList className="grid w-full grid-cols-4 h-9">
            <TabsTrigger value="resumen" className="text-xs">Resumen</TabsTrigger>
            <TabsTrigger value="instructivos" className="text-xs">Instructivos</TabsTrigger>
            <TabsTrigger value="maquinas" className="text-xs">Máquinas</TabsTrigger>
            <TabsTrigger value="personas" className="text-xs">Personas</TabsTrigger>
          </TabsList>

          {/* Tab Resumen */}
          <TabsContent value="resumen" className="space-y-4 mt-4">
            {/* Descripción */}
            {workstation.description && (
              <Card className="border-2">
                <CardHeader className="bg-muted/30 pb-3">
                  <CardTitle className="text-xs font-semibold flex items-center gap-2">
                    <FileText className="h-3.5 w-3.5" />
                    Descripción
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-3">
                  <p className="text-xs text-foreground leading-relaxed">{workstation.description}</p>
                </CardContent>
              </Card>
            )}

            {/* Grid de información */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {/* Sector */}
              <Card className="group hover:shadow-md transition-all duration-200">
                <CardContent className="p-3">
                  <div className="flex items-center gap-2.5">
                    <div className="h-8 w-8 rounded-lg bg-blue-500/10 flex items-center justify-center shrink-0">
                      <Building2 className="h-4 w-4 text-blue-600" />
                    </div>
                    <div className="flex-1">
                      <p className="text-[10px] text-muted-foreground">Sector</p>
                      <p className="text-xs font-semibold mt-0.5">{workstation.sector.name}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Código */}
              <Card className="group hover:shadow-md transition-all duration-200">
                <CardContent className="p-3">
                  <div className="flex items-center gap-2.5">
                    <div className="h-8 w-8 rounded-lg bg-purple-500/10 flex items-center justify-center shrink-0">
                      <FileText className="h-4 w-4 text-purple-600" />
                    </div>
                    <div className="flex-1">
                      <p className="text-[10px] text-muted-foreground">Código</p>
                      <p className="text-xs font-semibold mt-0.5 font-mono">{workstation.code}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Estado */}
              <Card className="group hover:shadow-md transition-all duration-200">
                <CardContent className="p-3">
                  <div className="flex items-center gap-2.5">
                    <div className={cn(
                      "h-8 w-8 rounded-lg flex items-center justify-center shrink-0",
                      workstation.status === 'ACTIVE' ? 'bg-emerald-500/10' :
                      workstation.status === 'MAINTENANCE' ? 'bg-amber-500/10' :
                      'bg-muted'
                    )}>
                      {workstation.status === 'ACTIVE' ? (
                        <Power className="h-4 w-4 text-emerald-600" />
                      ) : workstation.status === 'MAINTENANCE' ? (
                        <Wrench className="h-4 w-4 text-amber-600" />
                      ) : (
                        <PowerOff className="h-4 w-4 text-muted-foreground" />
                      )}
                    </div>
                    <div className="flex-1">
                      <p className="text-[10px] text-muted-foreground">Estado</p>
                      <Badge
                        variant="outline"
                        className={cn('text-[10px] px-1.5 py-0 h-4 mt-0.5 border', statusColors[workstation.status])}
                      >
                        {statusLabels[workstation.status] || workstation.status}
                      </Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Última actualización */}
              <Card className="group hover:shadow-md transition-all duration-200">
                <CardContent className="p-3">
                  <div className="flex items-center gap-2.5">
                    <div className="h-8 w-8 rounded-lg bg-orange-500/10 flex items-center justify-center shrink-0">
                      <Clock className="h-4 w-4 text-orange-600" />
                    </div>
                    <div className="flex-1">
                      <p className="text-[10px] text-muted-foreground">Última actualización</p>
                      <p className="text-xs font-semibold mt-0.5">{formatDate(workstation.updatedAt)}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Tab Instructivos */}
          <TabsContent value="instructivos" className="space-y-4 mt-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">Instructivos</h3>
              {onAddInstructive && (
                <Button size="sm" onClick={() => onAddInstructive(workstation)} className="h-8 text-xs">
                  <Plus className="h-3 w-3 mr-1" />
                  Agregar instructivo
                </Button>
              )}
            </div>
            <div className="space-y-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
                <Input
                  placeholder="Buscar instructivos..."
                  value={searchInstructives}
                  onChange={(e) => setSearchInstructives(e.target.value)}
                  className="pl-9 h-9 text-xs"
                />
              </div>
            </div>
            {filteredInstructives.length === 0 ? (
              <Card>
                <CardContent className="py-8 text-center">
                  <FileText className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                  <p className="text-xs text-muted-foreground">No hay instructivos</p>
                  {onAddInstructive && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onAddInstructive(workstation)}
                      className="mt-4 h-8 text-xs"
                    >
                      <Plus className="h-3 w-3 mr-1" />
                      Agregar primer instructivo
                    </Button>
                  )}
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {filteredInstructives.map((instr) => (
                  <Card
                    key={instr.id}
                    className="group cursor-pointer hover:shadow-md hover:border-primary/50 transition-all duration-200"
                    onClick={() => handleViewInstructive(instr)}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 space-y-2">
                          <div className="flex items-center gap-2">
                            <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                              <FileText className="h-4 w-4 text-primary" />
                            </div>
                            <div className="flex-1">
                              <h4 className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors">
                                {instr.title}
                              </h4>
                              {instr.fileName && (
                                <p className="text-xs text-muted-foreground mt-0.5">{instr.fileName}</p>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-3 ml-10 flex-wrap">
                            {instr.createdBy && (
                              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                <Users className="h-3 w-3" />
                                <span>{instr.createdBy.name}</span>
                              </div>
                            )}
                            {instr.createdAt && (
                              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                <Clock className="h-3 w-3" />
                                <span>{formatDate(instr.createdAt)}</span>
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <div className="h-8 w-8 rounded-lg bg-muted/50 group-hover:bg-primary/10 flex items-center justify-center transition-colors">
                            <Eye className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* Tab Máquinas */}
          <TabsContent value="maquinas" className="space-y-4 mt-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">Máquinas asignadas</h3>
              {onManageMachines && (
                <Button size="sm" onClick={() => onManageMachines(workstation)} className="h-8 text-xs">
                  Gestionar
                </Button>
              )}
            </div>
            {machines.length === 0 ? (
              <Card>
                <CardContent className="py-8 text-center">
                  <Wrench className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                  <p className="text-xs text-muted-foreground">No hay máquinas asignadas</p>
                  {onManageMachines && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onManageMachines(workstation)}
                      className="mt-4 h-8 text-xs"
                    >
                      Asignar máquinas
                    </Button>
                  )}
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {machines.map((machine) => (
                  <Card key={machine.id} className="group hover:shadow-md hover:border-primary/50 transition-all duration-200">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3 flex-1">
                          <div className="h-10 w-10 rounded-lg bg-amber-500/10 flex items-center justify-center shrink-0">
                            <Wrench className="h-5 w-5 text-amber-600" />
                          </div>
                          <div className="flex-1">
                            <h4 className="text-sm font-semibold text-foreground">{machine.name}</h4>
                            <p className="text-xs text-muted-foreground">Máquina asignada</p>
                          </div>
                        </div>
                        <Badge variant="outline" className="text-xs">
                          Asignada
                        </Badge>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* Tab Personas */}
          <TabsContent value="personas" className="space-y-4 mt-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">Empleados asignados</h3>
            </div>
            <Card className="border-dashed">
              <CardContent className="py-12 text-center">
                <Users className="h-12 w-12 text-muted-foreground mx-auto mb-3 opacity-50" />
                <p className="text-sm font-medium text-foreground mb-1">No hay empleados asignados</p>
                <p className="text-xs text-muted-foreground">
                  Los empleados que trabajan en este puesto aparecerán aquí
                </p>
              </CardContent>
            </Card>
          </TabsContent>
          </Tabs>
        </SheetBody>
      </SheetContent>

      {/* Dialog para ver instructivo */}
      <Dialog open={instructiveDialogOpen} onOpenChange={setInstructiveDialogOpen}>
        <DialogContent size="xl">
          <DialogHeader>
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <DialogTitle className="text-xl font-bold mb-2">
                  {selectedInstructive?.title || 'Instructivo'}
                </DialogTitle>
                <div className="flex items-center gap-2 flex-wrap">
                  {selectedInstructive?.scope && (
                    <Badge variant="outline" className="text-xs">
                      {selectedInstructive.scope === 'EQUIPMENT' ? 'Equipo' :
                       selectedInstructive.scope === 'MACHINES' ? 'Máquinas' :
                       selectedInstructive.scope === 'COMPONENTS' ? 'Componentes' : selectedInstructive.scope}
                    </Badge>
                  )}
                  {selectedInstructive?.createdBy && (
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Users className="h-3.5 w-3.5" />
                      <span>{selectedInstructive.createdBy.name}</span>
                    </div>
                  )}
                  {selectedInstructive?.createdAt && (
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Clock className="h-3.5 w-3.5" />
                      <span>{formatDate(selectedInstructive.createdAt)}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </DialogHeader>

          <DialogBody>
            <div className="space-y-4">
            {/* Grid de 2 columnas para mejor organización */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {/* Columna principal - Contenido */}
              <div className="lg:col-span-2 space-y-4">
                {/* Contenido HTML - Estilo Word */}
                {selectedInstructive?.contentHtml && (
                  <Card className="border-2">
                    <CardHeader className="bg-muted/30">
                      <CardTitle className="text-sm font-semibold flex items-center gap-2">
                        <FileText className="h-4 w-4" />
                        Contenido del Instructivo
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="bg-white dark:bg-card">
                      <div
                        className="prose prose-sm max-w-none dark:prose-invert
                          [&_h1]:text-2xl [&_h1]:font-bold [&_h1]:mb-4 [&_h1]:mt-6 [&_h1]:text-gray-900 dark:[&_h1]:text-gray-100
                          [&_h2]:text-xl [&_h2]:font-bold [&_h2]:mb-3 [&_h2]:mt-5 [&_h2]:text-gray-800 dark:[&_h2]:text-gray-200
                          [&_h3]:text-lg [&_h3]:font-semibold [&_h3]:mb-2 [&_h3]:mt-4 [&_h3]:text-gray-700 dark:[&_h3]:text-gray-300
                          [&_p]:text-sm [&_p]:leading-relaxed [&_p]:mb-3 [&_p]:text-gray-700 dark:[&_p]:text-gray-300
                          [&_ul]:list-disc [&_ul]:pl-6 [&_ul]:mb-3 [&_ul]:space-y-1
                          [&_ol]:list-decimal [&_ol]:pl-6 [&_ol]:mb-3 [&_ol]:space-y-1
                          [&_li]:text-sm [&_li]:text-gray-700 dark:[&_li]:text-gray-300
                          [&_strong]:font-semibold [&_strong]:text-gray-900 dark:[&_strong]:text-gray-100
                          [&_em]:italic
                          [&_table]:border-collapse [&_table]:w-full [&_table]:my-4
                          [&_th]:border [&_th]:border-gray-300 [&_th]:bg-gray-100 dark:[&_th]:bg-gray-800 [&_th]:p-2 [&_th]:text-left [&_th]:font-semibold [&_th]:text-sm
                          [&_td]:border [&_td]:border-gray-300 [&_td]:p-2 [&_td]:text-sm
                          [&_blockquote]:border-l-4 [&_blockquote]:border-gray-300 [&_blockquote]:pl-4 [&_blockquote]:italic [&_blockquote]:my-4
                          [&_code]:bg-gray-100 dark:[&_code]:bg-gray-800 [&_code]:px-1 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-xs [&_code]:font-mono
                          [&_pre]:bg-gray-100 dark:[&_pre]:bg-gray-800 [&_pre]:p-3 [&_pre]:rounded [&_pre]:overflow-x-auto [&_pre]:my-3
                          [&_img]:max-w-full [&_img]:h-auto [&_img]:my-4 [&_img]:rounded [&_img]:shadow-sm
                          py-6 px-8"
                        dangerouslySetInnerHTML={{ __html: selectedInstructive.contentHtml }}
                      />
                    </CardContent>
                  </Card>
                )}

                {/* Archivo adjunto */}
                {selectedInstructive?.fileName && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-sm font-semibold flex items-center gap-2">
                        <FileText className="h-4 w-4" />
                        Archivo Adjunto
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                            <FileText className="h-5 w-5 text-primary" />
                          </div>
                          <div>
                            <p className="text-sm font-medium">{selectedInstructive.fileName}</p>
                            {selectedInstructive.fileSize && (
                              <p className="text-xs text-muted-foreground">
                                {(selectedInstructive.fileSize / 1024).toFixed(2)} KB
                              </p>
                            )}
                          </div>
                        </div>
                        {selectedInstructive.fileUrl && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => window.open(selectedInstructive.fileUrl, '_blank')}
                            className="h-8 text-xs"
                          >
                            Descargar
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>

              {/* Columna lateral - Información y asociaciones */}
              <div className="space-y-4">
                {/* Asociaciones del instructivo */}
                {(() => {
                  // Parsear machineIds y componentIds del instructivo
                  const machineIds = (() => {
                    try {
                      if (Array.isArray(selectedInstructive?.machineIds)) {
                        return selectedInstructive.machineIds;
                      }
                      if (typeof selectedInstructive?.machineIds === 'string') {
                        return JSON.parse(selectedInstructive.machineIds);
                      }
                      return [];
                    } catch {
                      return [];
                    }
                  })();

                  const componentIds = (() => {
                    try {
                      if (Array.isArray(selectedInstructive?.componentIds)) {
                        return selectedInstructive.componentIds;
                      }
                      if (typeof selectedInstructive?.componentIds === 'string') {
                        return JSON.parse(selectedInstructive.componentIds);
                      }
                      return [];
                    } catch {
                      return [];
                    }
                  })();

                  const totalAssociations = machineIds.length + componentIds.length;

                  if (totalAssociations === 0) return null;

                  return (
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-sm font-semibold flex items-center gap-2">
                          <Wrench className="h-4 w-4" />
                          Asociaciones
                          <Badge variant="secondary" className="ml-auto text-xs">
                            {totalAssociations}
                          </Badge>
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-3">
                          {/* Máquinas */}
                          {machineIds.length > 0 && (
                            <div className="space-y-2">
                              <div className="flex items-center gap-1.5">
                                <Wrench className="h-3.5 w-3.5 text-amber-600" />
                                <span className="text-xs font-medium text-muted-foreground">
                                  Máquinas ({machineIds.length})
                                </span>
                              </div>
                              <div className="space-y-1.5 pl-5">
                                {machineIds.map((id: any) => (
                                  <div
                                    key={`machine-${id}`}
                                    className="flex items-center gap-2 p-2 rounded-lg bg-amber-500/5 border border-amber-500/20"
                                  >
                                    <div className="h-6 w-6 rounded bg-amber-500/10 flex items-center justify-center shrink-0">
                                      <Wrench className="h-3 w-3 text-amber-600" />
                                    </div>
                                    <span className="text-xs font-medium flex-1">
                                      {machines.find(m => m.id === id || m.id === String(id))?.name || `Máquina #${id}`}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Componentes y Subcomponentes */}
                          {componentIds.length > 0 && (
                            <div className="space-y-2">
                              <div className="flex items-center gap-1.5">
                                <Building2 className="h-3.5 w-3.5 text-purple-600" />
                                <span className="text-xs font-medium text-muted-foreground">
                                  Componentes y Subcomponentes ({componentIds.length})
                                </span>
                              </div>
                              <div className="space-y-1.5 pl-5">
                                {loadingComponents ? (
                                  <div className="text-xs text-muted-foreground py-2">Cargando...</div>
                                ) : (
                                  componentIds.map((id: any) => {
                                    const component = componentsMap.get(id);
                                    const isSubcomponent = component?.parentId !== null && component?.parentId !== undefined;
                                    const displayName = component?.name || `Componente #${id}`;
                                    const typeLabel = isSubcomponent ? 'Subcomponente' : 'Componente';

                                    return (
                                      <div
                                        key={`component-${id}`}
                                        className="flex items-center gap-2 p-2 rounded-lg bg-purple-500/5 border border-purple-500/20"
                                      >
                                        <div className="h-6 w-6 rounded bg-purple-500/10 flex items-center justify-center shrink-0">
                                          <Building2 className="h-3 w-3 text-purple-600" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                          <div className="flex items-center gap-1.5">
                                            <span className="text-xs font-medium truncate">
                                              {displayName}
                                            </span>
                                            <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4">
                                              {typeLabel}
                                            </Badge>
                                          </div>
                                          {component?.code && (
                                            <p className="text-[10px] text-muted-foreground">
                                              Código: {component.code}
                                            </p>
                                          )}
                                        </div>
                                      </div>
                                    );
                                  })
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })()}

                {/* Información adicional */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm font-semibold flex items-center gap-2">
                      <Building2 className="h-4 w-4" />
                      Información
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="space-y-2 text-xs">
                      {selectedInstructive?.createdBy && (
                        <div className="flex items-start gap-2">
                          <Users className="h-3.5 w-3.5 text-muted-foreground mt-0.5" />
                          <div className="flex-1">
                            <p className="text-muted-foreground">Creado por</p>
                            <p className="font-medium">{selectedInstructive.createdBy.name}</p>
                          </div>
                        </div>
                      )}
                      {selectedInstructive?.createdAt && (
                        <div className="flex items-start gap-2">
                          <Clock className="h-3.5 w-3.5 text-muted-foreground mt-0.5" />
                          <div className="flex-1">
                            <p className="text-muted-foreground">Fecha de creación</p>
                            <p className="font-medium">{formatDate(selectedInstructive.createdAt)}</p>
                          </div>
                        </div>
                      )}
                      {selectedInstructive?.updatedAt && selectedInstructive.updatedAt !== selectedInstructive.createdAt && (
                        <div className="flex items-start gap-2">
                          <Clock className="h-3.5 w-3.5 text-muted-foreground mt-0.5" />
                          <div className="flex-1">
                            <p className="text-muted-foreground">Última modificación</p>
                            <p className="font-medium">{formatDate(selectedInstructive.updatedAt)}</p>
                          </div>
                        </div>
                      )}
                      {selectedInstructive?.scope && (
                        <div className="flex items-start gap-2">
                          <FileText className="h-3.5 w-3.5 text-muted-foreground mt-0.5" />
                          <div className="flex-1">
                            <p className="text-muted-foreground">Alcance</p>
                            <p className="font-medium">
                              {selectedInstructive.scope === 'EQUIPMENT' ? 'Equipo' :
                               selectedInstructive.scope === 'MACHINES' ? 'Máquinas' :
                               selectedInstructive.scope === 'COMPONENTS' ? 'Componentes' :
                               selectedInstructive.scope}
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
            </div>
          </DialogBody>
        </DialogContent>
      </Dialog>
    </Sheet>
  );
}

