'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { useConfirm } from '@/components/ui/confirm-dialog-provider';
import { useAuth } from '@/contexts/AuthContext';
import {
  Plus,
  Edit,
  Trash2,
  Users,
  MapPin,
  Building,
  Download,
  Wrench,
  Briefcase,
  CheckCircle,
  FileText,
} from 'lucide-react';

interface WorkSector {
  id: number;
  companyId: number;
  name: string;
  code: string | null;
  description: string | null;
  costCenterId: number | null;
  isActive: boolean;
  employeeCount: number;
}

interface AvailableSector {
  id: string | number;
  name: string;
  description: string | null;
  type: 'predefined' | 'maintenance';
  areaName?: string;
  fullName?: string;
}

interface SectorsResponse {
  sectors: WorkSector[];
  total: number;
}

interface AvailableResponse {
  predefined: AvailableSector[];
  maintenance: AvailableSector[];
  totalAvailable: number;
}

export default function SectoresPage() {
  const confirm = useConfirm();
  const queryClient = useQueryClient();
  const { hasPermission } = useAuth();
  const canManageNominas = hasPermission('ingresar_nominas');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingSector, setEditingSector] = useState<WorkSector | null>(null);
  const [selectedSectors, setSelectedSectors] = useState<AvailableSector[]>([]);
  const [formData, setFormData] = useState({
    name: '',
    code: '',
    description: '',
  });

  // Fetch sectores existentes
  const { data, isLoading, error } = useQuery<SectorsResponse>({
    queryKey: ['work-sectors'],
    queryFn: async () => {
      const res = await fetch('/api/nominas/sectores');
      if (!res.ok) throw new Error('Error al cargar sectores');
      return res.json();
    },
  });

  // Fetch sectores disponibles para importar
  const { data: availableData, isLoading: loadingAvailable } = useQuery<AvailableResponse>({
    queryKey: ['available-sectors'],
    queryFn: async () => {
      const res = await fetch('/api/nominas/sectores/available');
      if (!res.ok) throw new Error('Error al cargar sectores disponibles');
      return res.json();
    },
  });

  // Create/Update mutation
  const saveMutation = useMutation({
    mutationFn: async (data: typeof formData & { id?: number }) => {
      const method = data.id ? 'PUT' : 'POST';
      const res = await fetch('/api/nominas/sectores', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Error al guardar');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['work-sectors'] });
      queryClient.invalidateQueries({ queryKey: ['available-sectors'] });
      toast.success(editingSector ? 'Sector actualizado' : 'Sector creado');
      handleCloseDialog();
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  // Import mutation
  const importMutation = useMutation({
    mutationFn: async (sectors: AvailableSector[]) => {
      const res = await fetch('/api/nominas/sectores/available', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sectors }),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Error al importar');
      }
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['work-sectors'] });
      queryClient.invalidateQueries({ queryKey: ['available-sectors'] });
      toast.success(data.message);
      setSelectedSectors([]);
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/nominas/sectores?id=${id}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Error al eliminar');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['work-sectors'] });
      queryClient.invalidateQueries({ queryKey: ['available-sectors'] });
      toast.success('Sector eliminado');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const handleOpenDialog = (sector?: WorkSector) => {
    if (sector) {
      setEditingSector(sector);
      setFormData({
        name: sector.name,
        code: sector.code || '',
        description: sector.description || '',
      });
    } else {
      setEditingSector(null);
      setFormData({ name: '', code: '', description: '' });
    }
    setIsDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setEditingSector(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    saveMutation.mutate({
      ...formData,
      id: editingSector?.id,
    });
  };

  const toggleSectorSelection = (sector: AvailableSector) => {
    setSelectedSectors(prev => {
      const exists = prev.find(s => s.id === sector.id && s.type === sector.type);
      if (exists) {
        return prev.filter(s => !(s.id === sector.id && s.type === sector.type));
      }
      return [...prev, sector];
    });
  };

  const isSectorSelected = (sector: AvailableSector) => {
    return selectedSectors.some(s => s.id === sector.id && s.type === sector.type);
  };

  const handleImport = () => {
    if (selectedSectors.length === 0) {
      toast.error('Selecciona al menos un sector');
      return;
    }
    importMutation.mutate(selectedSectors);
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="border-b border-border">
          <div className="px-4 md:px-6 py-3">
            <Skeleton className="h-7 w-48" />
            <Skeleton className="h-4 w-64 mt-2" />
          </div>
        </div>
        <div className="px-4 md:px-6 pb-6 space-y-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="py-10 text-center">
            <p className="text-muted-foreground">Error al cargar los sectores</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const sectors = data?.sectors || [];
  const predefinedSectors = availableData?.predefined || [];
  const maintenanceSectors = availableData?.maintenance || [];
  const hasAvailable = predefinedSectors.length > 0 || maintenanceSectors.length > 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="border-b border-border">
        <div className="px-4 md:px-6 py-3">
          <h1 className="text-xl md:text-2xl font-semibold tracking-tight">
            Sectores de Trabajo
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Gestiona las areas y sectores de trabajo para asignacion de empleados
          </p>
        </div>
      </div>

      {/* Dialog for manual creation */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <form onSubmit={handleSubmit}>
            <DialogHeader>
              <DialogTitle>
                {editingSector ? 'Editar Sector' : 'Nuevo Sector'}
              </DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="name">Nombre *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Ej: Albanileria"
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="code">Codigo</Label>
                <Input
                  id="code"
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                  placeholder="Ej: ALB"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="description">Descripcion</Label>
                <Input
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Descripcion opcional..."
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={handleCloseDialog}>
                Cancelar
              </Button>
              <Button type="submit" disabled={saveMutation.isPending}>
                {saveMutation.isPending ? 'Guardando...' : 'Guardar'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Content */}
      <div className="px-4 md:px-6 pb-6">
        <Tabs defaultValue={sectors.length > 0 ? "mis-sectores" : "importar"} className="space-y-6">
          <TabsList>
            <TabsTrigger value="mis-sectores" className="gap-2">
              <CheckCircle className="h-4 w-4" />
              Mis Sectores ({sectors.length})
            </TabsTrigger>
            <TabsTrigger value="importar" className="gap-2">
              <Download className="h-4 w-4" />
              Importar {hasAvailable && `(${predefinedSectors.length + maintenanceSectors.length})`}
            </TabsTrigger>
          </TabsList>

          {/* Tab: Mis Sectores */}
          <TabsContent value="mis-sectores" className="space-y-4">
            <div className="flex justify-end">
              {canManageNominas && (
                <Button onClick={() => handleOpenDialog()}>
                  <Plus className="mr-2 h-4 w-4" />
                  Nuevo Sector
                </Button>
              )}
            </div>

            {sectors.length === 0 ? (
              <Card>
                <CardContent className="py-10 text-center">
                  <MapPin className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                  <h3 className="text-lg font-medium mb-2">Sin sectores</h3>
                  <p className="text-muted-foreground mb-4">
                    Ve a "Importar" para usar tus sectores de mantenimiento o crea uno nuevo
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {sectors.map((sector) => (
                  <Card key={sector.id} className="hover:shadow-md transition-shadow">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <div className="p-2 rounded-lg bg-muted">
                            <Building className="h-5 w-5 text-muted-foreground" />
                          </div>
                          <div>
                            <h3 className="font-semibold">{sector.name}</h3>
                            {sector.code && (
                              <Badge variant="outline" className="text-xs mt-1">
                                {sector.code}
                              </Badge>
                            )}
                          </div>
                        </div>
                        {!sector.isActive && (
                          <Badge variant="destructive">Inactivo</Badge>
                        )}
                      </div>

                      {sector.description && (
                        <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
                          {sector.description}
                        </p>
                      )}

                      <div className="flex items-center justify-between pt-3 border-t">
                        <div className="flex items-center gap-1 text-sm text-muted-foreground">
                          <Users className="h-4 w-4" />
                          <span>{sector.employeeCount} empleados</span>
                        </div>
                        <div className="flex items-center gap-1">
                          {canManageNominas && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => handleOpenDialog(sector)}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                          )}
                          {canManageNominas && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={async () => {
                                if (sector.employeeCount > 0) {
                                  toast.error('No se puede eliminar un sector con empleados');
                                  return;
                                }
                                const ok = await confirm({
                                  title: 'Eliminar sector',
                                  description: '¿Eliminar este sector?',
                                  confirmText: 'Eliminar',
                                  variant: 'destructive',
                                });
                                if (ok) {
                                  deleteMutation.mutate(sector.id);
                                }
                              }}
                              disabled={sector.employeeCount > 0}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* Tab: Importar */}
          <TabsContent value="importar" className="space-y-6">
            {loadingAvailable ? (
              <div className="space-y-4">
                <Skeleton className="h-32" />
                <Skeleton className="h-32" />
              </div>
            ) : !hasAvailable ? (
              <Card>
                <CardContent className="py-10 text-center">
                  <CheckCircle className="w-12 h-12 mx-auto mb-4 text-success" />
                  <h3 className="text-lg font-medium mb-2">Todo importado</h3>
                  <p className="text-muted-foreground">
                    Ya tienes todos los sectores disponibles. Puedes crear sectores personalizados en "Mis Sectores".
                  </p>
                </CardContent>
              </Card>
            ) : (
              <>
                {/* Sectores Predefinidos */}
                {predefinedSectors.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base flex items-center gap-2">
                        <Briefcase className="h-5 w-5" />
                        Sectores Comunes
                      </CardTitle>
                      <CardDescription>
                        Sectores tipicos que puedes agregar rapidamente
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="grid gap-3 sm:grid-cols-2">
                        {predefinedSectors.map((sector) => (
                          <div
                            key={`pre-${sector.id}`}
                            className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                              isSectorSelected(sector)
                                ? 'border-primary bg-primary/5'
                                : 'hover:bg-muted/50'
                            }`}
                            onClick={() => toggleSectorSelection(sector)}
                          >
                            <Checkbox
                              checked={isSectorSelected(sector)}
                              onCheckedChange={() => toggleSectorSelection(sector)}
                            />
                            <div className="flex-1 min-w-0">
                              <p className="font-medium">{sector.name}</p>
                              {sector.description && (
                                <p className="text-xs text-muted-foreground truncate">
                                  {sector.description}
                                </p>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Sectores de Mantenimiento */}
                {maintenanceSectors.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base flex items-center gap-2">
                        <Wrench className="h-5 w-5" />
                        Sectores de Mantenimiento
                      </CardTitle>
                      <CardDescription>
                        Importa los sectores existentes de tu sistema de mantenimiento
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                        {maintenanceSectors.map((sector) => (
                          <div
                            key={`maint-${sector.id}`}
                            className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                              isSectorSelected(sector)
                                ? 'border-primary bg-primary/5'
                                : 'hover:bg-muted/50'
                            }`}
                            onClick={() => toggleSectorSelection(sector)}
                          >
                            <Checkbox
                              checked={isSectorSelected(sector)}
                              onCheckedChange={() => toggleSectorSelection(sector)}
                            />
                            <div className="flex-1 min-w-0">
                              <p className="font-medium">{sector.name}</p>
                              {sector.areaName && (
                                <Badge variant="outline" className="text-xs mt-1">
                                  {sector.areaName}
                                </Badge>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Boton de importar */}
                {selectedSectors.length > 0 && canManageNominas && (
                  <div className="flex items-center justify-between p-4 rounded-lg bg-muted">
                    <span className="text-sm">
                      {selectedSectors.length} sector(es) seleccionado(s)
                    </span>
                    <Button
                      onClick={handleImport}
                      disabled={importMutation.isPending}
                    >
                      {importMutation.isPending ? 'Importando...' : (
                        <>
                          <Download className="mr-2 h-4 w-4" />
                          Importar Seleccionados
                        </>
                      )}
                    </Button>
                  </div>
                )}

                {/* Info box */}
                <Card className="bg-info-muted border-info-muted">
                  <CardContent className="py-4">
                    <div className="flex gap-3">
                      <FileText className="h-5 w-5 text-info-muted-foreground flex-shrink-0 mt-0.5" />
                      <div className="text-sm">
                        <p className="font-medium text-info-muted-foreground">
                          Sectores para asignacion de empleados
                        </p>
                        <p className="text-info-muted-foreground mt-1">
                          Los sectores te permiten organizar a tus empleados por area de trabajo.
                          Puedes importar los sectores de mantenimiento existentes o crear sectores personalizados.
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
