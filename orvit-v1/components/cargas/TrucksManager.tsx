'use client';

// ✅ OPTIMIZACIÓN: Desactivar logs en producción
const DEBUG = false;
const log = DEBUG ? (...args: unknown[]) => { /* debug */ } : () => {};

import { useState, useEffect, useRef, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAdminCatalogs } from '@/hooks/use-admin-catalogs';
import { usePermissionRobust } from '@/hooks/use-permissions-robust';
import { useCargasBootstrap } from '@/hooks/use-cargas-bootstrap'; // ✨ OPTIMIZACIÓN: Bootstrap consolidado
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogBody,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Textarea } from '@/components/ui/textarea';
import { Truck, Plus, Edit, Trash2, Check, ChevronsUpDown, Eye, Search, LayoutGrid, Table2, Filter, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { useConfirm } from '@/components/ui/confirm-dialog-provider';

interface TruckData {
  id: number;
  internalId?: number | null;
  name: string;
  type: 'CHASIS' | 'EQUIPO' | 'SEMI';
  length: number;
  chasisLength?: number | null;
  acopladoLength?: number | null;
  chasisWeight?: number | null;
  acopladoWeight?: number | null;
  maxWeight?: number | null;
  isOwn?: boolean;
  client?: string | null;
  description?: string | null;
  isActive: boolean;
}

interface TrucksManagerProps {
  companyId: number;
}

interface ClientData {
  id: string;
  name: string;
  address?: string;
}

export default function TrucksManager({ companyId }: TrucksManagerProps) {
  const confirm = useConfirm();

  // ✨ OPTIMIZACIÓN: Usar catálogos consolidados
  const { data: catalogsData } = useAdminCatalogs(companyId);
  
  // ✨ OPTIMIZACIÓN: Usar bootstrap consolidado (trucks en una sola request compartida)
  const { data: bootstrapData, isLoading: bootstrapLoading, refetch: refetchBootstrap } = useCargasBootstrap(companyId);
  
  // ✨ PERMISOS: Verificar permisos de cargas
  const { hasPermission: canView } = usePermissionRobust('cargas.view');
  const { hasPermission: canManageTrucks } = usePermissionRobust('cargas.manage_trucks');
  
  // ✨ OPTIMIZACIÓN: Usar datos del bootstrap en lugar de state local
  const trucks = bootstrapData?.trucks || [];
  const [clients, setClients] = useState<ClientData[]>([]);
  const loading = bootstrapLoading;
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingTruck, setEditingTruck] = useState<TruckData | null>(null);
  const [viewingTruck, setViewingTruck] = useState<TruckData | null>(null);
  const [clientSearchOpen, setClientSearchOpen] = useState(false);
  const [clientSearchValue, setClientSearchValue] = useState('');
  
  // Estados para búsqueda, filtros y vista
  const [viewMode, setViewMode] = useState<'card' | 'table'>('table');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'ALL' | 'CHASIS' | 'EQUIPO' | 'SEMI'>('ALL');
  const [filterClient, setFilterClient] = useState<string>('ALL');
  const [formData, setFormData] = useState({
    name: '',
    type: 'CHASIS' as 'CHASIS' | 'EQUIPO' | 'SEMI',
    length: '',
    chasisLength: '',
    acopladoLength: '',
    chasisWeight: '',
    acopladoWeight: '',
    maxWeight: '',
    isOwn: true,
    client: '',
    description: '',
  });
  const { toast } = useToast();

  // ✨ PERMISOS: Si no puede ver, no mostrar nada
  if (!canView) {
    return (
      <div className="flex items-center justify-center p-8">
        <p className="text-muted-foreground">No tienes permisos para ver camiones.</p>
      </div>
    );
  }
  
  // ✨ OPTIMIZADO: Ya no necesitamos loadTrucks, se obtiene del bootstrap
  const lastCatalogsDataRef = useRef<string | null>(null);
  
  // ✨ OPTIMIZADO: Solo procesar clients desde catalogsData cuando cambie
  useEffect(() => {
    if (!catalogsData?.clients) return;
    
    const clientsKey = JSON.stringify(catalogsData.clients.length);
    if (clientsKey === lastCatalogsDataRef.current) return;
    
    lastCatalogsDataRef.current = clientsKey;
    setClients(catalogsData.clients as any[] || []);
  }, [catalogsData?.clients]);

  // Función helper para refrescar datos después de crear/editar/eliminar
  const refreshTrucks = async () => {
    await refetchBootstrap();
  };

  // ✨ OPTIMIZACIÓN: loadClients ahora usa catalogsData (ya no hace fetch)
  // Los clients se cargan desde el efecto que procesa catalogsData

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const url = editingTruck ? `/api/trucks/${editingTruck.id}` : '/api/trucks';
      const method = editingTruck ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...formData,
          length: formData.type === 'EQUIPO' 
            ? (parseFloat(formData.chasisLength || '0') + parseFloat(formData.acopladoLength || '0'))
            : parseFloat(formData.length),
          chasisLength: formData.type === 'EQUIPO' ? (formData.chasisLength ? parseFloat(formData.chasisLength) : null) : null,
          acopladoLength: formData.type === 'EQUIPO' ? (formData.acopladoLength ? parseFloat(formData.acopladoLength) : null) : null,
          chasisWeight: formData.type === 'EQUIPO' ? (formData.chasisWeight ? parseFloat(formData.chasisWeight) : null) : null,
          acopladoWeight: formData.type === 'EQUIPO' ? (formData.acopladoWeight ? parseFloat(formData.acopladoWeight) : null) : null,
          maxWeight: formData.type === 'EQUIPO' 
            ? (formData.chasisWeight && formData.acopladoWeight 
                ? (parseFloat(formData.chasisWeight || '0') + parseFloat(formData.acopladoWeight || '0'))
                : null)
            : (formData.maxWeight ? parseFloat(formData.maxWeight) : null),
          isOwn: formData.isOwn,
          client: formData.isOwn ? null : (formData.client || null),
        }),
      });

      if (response.ok) {
        toast({
          title: 'Éxito',
          description: editingTruck
            ? 'Camión actualizado correctamente'
            : 'Camión creado correctamente',
        });
        setIsDialogOpen(false);
        resetForm();
        refreshTrucks();
      } else {
        const error = await response.json();
        toast({
          title: 'Error',
          description: error.error || 'Error al guardar el camión',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error saving truck:', error);
      toast({
        title: 'Error',
        description: 'Error al guardar el camión',
        variant: 'destructive',
      });
    }
  };

  const handleEdit = (truck: TruckData) => {
    setEditingTruck(truck);
    setFormData({
      name: truck.name,
      type: truck.type,
      length: truck.type === 'EQUIPO' ? '' : truck.length.toString(),
      chasisLength: truck.chasisLength?.toString() || '',
      acopladoLength: truck.acopladoLength?.toString() || '',
      chasisWeight: truck.chasisWeight?.toString() || '',
      acopladoWeight: truck.acopladoWeight?.toString() || '',
      maxWeight: truck.maxWeight?.toString() || '',
      isOwn: truck.isOwn ?? true,
      client: truck.client || '',
      description: truck.description || '',
    });
    setClientSearchValue(truck.client || '');
    setIsDialogOpen(true);
  };

  const handleDelete = async (id: number) => {
    const ok = await confirm({
      title: 'Eliminar camión',
      description: '¿Está seguro de que desea eliminar este camión?',
      confirmText: 'Eliminar',
      variant: 'destructive',
    });
    if (!ok) {
      return;
    }

    try {
      const response = await fetch(`/api/trucks/${id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        toast({
          title: 'Éxito',
          description: 'Camión eliminado correctamente',
        });
        refreshTrucks();
      } else {
        toast({
          title: 'Error',
          description: 'Error al eliminar el camión',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error deleting truck:', error);
      toast({
        title: 'Error',
        description: 'Error al eliminar el camión',
        variant: 'destructive',
      });
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      type: 'CHASIS',
      length: '',
      chasisLength: '',
      acopladoLength: '',
      chasisWeight: '',
      acopladoWeight: '',
      maxWeight: '',
      isOwn: true,
      client: '',
      description: '',
    });
    setEditingTruck(null);
    setClientSearchOpen(false);
    setClientSearchValue('');
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'CHASIS':
        return 'Chasis';
      case 'EQUIPO':
        return 'Equipo';
      case 'SEMI':
        return 'Semi';
      default:
        return type;
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'CHASIS':
        return 'bg-info';
      case 'EQUIPO':
        return 'bg-success';
      case 'SEMI':
        return 'bg-warning';
      default:
        return 'bg-muted-foreground';
    }
  };

  // Filtrar y buscar camiones
  const filteredTrucks = trucks.filter((truck) => {
    // Filtro por tipo
    if (filterType !== 'ALL' && truck.type !== filterType) {
      return false;
    }
    
    // Filtro por cliente
    if (filterClient !== 'ALL') {
      if (filterClient === 'PROPIO' && !truck.isOwn) return false;
      if (filterClient === 'CLIENTE' && truck.isOwn) return false;
      if (filterClient !== 'PROPIO' && filterClient !== 'CLIENTE' && truck.client !== filterClient) return false;
    }
    
    // Búsqueda por nombre, ID interno o cliente
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      const matchesName = truck.name.toLowerCase().includes(query);
      const matchesInternalId = truck.internalId?.toString().includes(query);
      const matchesClient = truck.client?.toLowerCase().includes(query);
      if (!matchesName && !matchesInternalId && !matchesClient) {
        return false;
      }
    }
    
    return true;
  });

  // Obtener lista única de clientes para el filtro
  const uniqueClients = Array.from(new Set(trucks.filter(t => t.client).map(t => t.client!))).sort();

  return (
    <div className="space-y-4">
      {/* Dialog para crear/editar camión */}
      <Dialog open={isDialogOpen} onOpenChange={(open) => {
        setIsDialogOpen(open);
        if (!open) resetForm();
      }}>
        <DialogTrigger asChild>
          <span className="hidden" />
        </DialogTrigger>
          <DialogContent size="default">
            <DialogHeader>
              <DialogTitle>
                {editingTruck ? 'Editar Camión' : 'Nuevo Camión'}
              </DialogTitle>
              <DialogDescription>
                {editingTruck
                  ? 'Modifique los datos del camión'
                  : 'Complete los datos del nuevo camión'}
              </DialogDescription>
            </DialogHeader>
            <DialogBody>
            <form onSubmit={handleSubmit}>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Nombre / Patente *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) =>
                      setFormData({ ...formData, name: e.target.value })
                    }
                    required
                    placeholder="Ej: ABC-123"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="type">Tipo *</Label>
                  <Select
                    value={formData.type}
                    onValueChange={(value: 'CHASIS' | 'EQUIPO' | 'SEMI') =>
                      setFormData({ ...formData, type: value, length: '', chasisLength: '', acopladoLength: '' })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="CHASIS">Chasis</SelectItem>
                      <SelectItem value="EQUIPO">Equipo</SelectItem>
                      <SelectItem value="SEMI">Semi</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="isOwn">Tipo de Camión</Label>
                  <Select
                    value={formData.isOwn ? 'own' : 'client'}
                    onValueChange={(value) =>
                      setFormData({ ...formData, isOwn: value === 'own', client: value === 'own' ? '' : formData.client })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="own">Propio</SelectItem>
                      <SelectItem value="client">De Cliente</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {!formData.isOwn && (
                  <div className="space-y-2">
                    <Label htmlFor="client">Cliente *</Label>
                    {clients.length > 0 ? (
                      <Popover open={clientSearchOpen} onOpenChange={setClientSearchOpen}>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            role="combobox"
                            aria-expanded={clientSearchOpen}
                            className="w-full justify-between"
                          >
                            {formData.client
                              ? clients.find((c) => c.name === formData.client)?.name || formData.client
                              : 'Buscar cliente...'}
                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-[400px] p-0" align="start">
                          <Command>
                            <CommandInput 
                              placeholder="Buscar cliente..." 
                              value={clientSearchValue}
                              onValueChange={setClientSearchValue}
                            />
                            <CommandList>
                              <CommandEmpty>No se encontró el cliente.</CommandEmpty>
                              <CommandGroup>
                                {clients
                                  .filter((client) =>
                                    client.name.toLowerCase().includes(clientSearchValue.toLowerCase()) ||
                                    (client.address && client.address.toLowerCase().includes(clientSearchValue.toLowerCase()))
                                  )
                                  .map((client) => (
                                    <CommandItem
                                      key={client.id}
                                      value={client.name}
                                      onSelect={() => {
                                        setFormData({ ...formData, client: client.name });
                                        setClientSearchOpen(false);
                                        setClientSearchValue('');
                                      }}
                                    >
                                      <Check
                                        className={cn(
                                          'mr-2 h-4 w-4',
                                          formData.client === client.name ? 'opacity-100' : 'opacity-0'
                                        )}
                                      />
                                      <div className="flex flex-col">
                                        <span>{client.name}</span>
                                        {client.address && (
                                          <span className="text-xs text-muted-foreground">{client.address}</span>
                                        )}
                                      </div>
                                    </CommandItem>
                                  ))}
                              </CommandGroup>
                            </CommandList>
                          </Command>
                        </PopoverContent>
                      </Popover>
                    ) : (
                      <Input
                        id="client"
                        value={formData.client}
                        onChange={(e) =>
                          setFormData({ ...formData, client: e.target.value })
                        }
                        placeholder="Nombre del cliente"
                        required={!formData.isOwn}
                      />
                    )}
                  </div>
                )}

                {formData.type === 'EQUIPO' ? (
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="chasisLength">Largo Chasis (metros) *</Label>
                      <Input
                        id="chasisLength"
                        type="number"
                        step="0.01"
                        min="0"
                        value={formData.chasisLength}
                        onChange={(e) =>
                          setFormData({ ...formData, chasisLength: e.target.value })
                        }
                        required
                        placeholder="Ej: 6.5"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="acopladoLength">Largo Acoplado (metros) *</Label>
                      <Input
                        id="acopladoLength"
                        type="number"
                        step="0.01"
                        min="0"
                        value={formData.acopladoLength}
                        onChange={(e) =>
                          setFormData({ ...formData, acopladoLength: e.target.value })
                        }
                        required
                        placeholder="Ej: 7.0"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="chasisWeight">Peso Chasis (toneladas) *</Label>
                      <Input
                        id="chasisWeight"
                        type="number"
                        step="0.01"
                        min="0"
                        value={formData.chasisWeight}
                        onChange={(e) =>
                          setFormData({ ...formData, chasisWeight: e.target.value })
                        }
                        required
                        placeholder="Ej: 12.5"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="acopladoWeight">Peso Acoplado (toneladas) *</Label>
                      <Input
                        id="acopladoWeight"
                        type="number"
                        step="0.01"
                        min="0"
                        value={formData.acopladoWeight}
                        onChange={(e) =>
                          setFormData({ ...formData, acopladoWeight: e.target.value })
                        }
                        required
                        placeholder="Ej: 13.0"
                      />
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="length">Largo máximo (metros) *</Label>
                      <Input
                        id="length"
                        type="number"
                        step="0.01"
                        min="0"
                        value={formData.length}
                        onChange={(e) =>
                          setFormData({ ...formData, length: e.target.value })
                        }
                        required
                        placeholder="Ej: 13.5"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="maxWeight">Peso máximo (toneladas)</Label>
                      <Input
                        id="maxWeight"
                        type="number"
                        step="0.01"
                        min="0"
                        value={formData.maxWeight}
                        onChange={(e) =>
                          setFormData({ ...formData, maxWeight: e.target.value })
                        }
                        placeholder="Ej: 25.5"
                      />
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="description">Descripción</Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) =>
                      setFormData({ ...formData, description: e.target.value })
                    }
                    placeholder="Información adicional del camión"
                    rows={3}
                  />
                </div>
              </div>
            </form>
            </DialogBody>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                size="default"
                onClick={() => {
                  setIsDialogOpen(false);
                  resetForm();
                }}
              >
                Cancelar
              </Button>
              <Button type="submit" size="default" onClick={handleSubmit}>
                {editingTruck ? 'Actualizar' : 'Crear'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

      {/* Controles de búsqueda, filtros y vista */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div className="flex-1 w-full sm:w-auto flex gap-2">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nombre, ID interno o cliente..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
            {searchQuery && (
              <Button
                variant="ghost"
                size="sm"
                className="absolute right-1 top-1/2 transform -translate-y-1/2 h-7 w-7 p-0"
                onClick={() => setSearchQuery('')}
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
        
        <div className="flex gap-2 flex-wrap">
          {/* Filtro por tipo */}
          <Select value={filterType} onValueChange={(value: any) => setFilterType(value)}>
            <SelectTrigger className="w-[140px]">
              <Filter className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Tipo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Todos los tipos</SelectItem>
              <SelectItem value="CHASIS">Chasis</SelectItem>
              <SelectItem value="EQUIPO">Equipo</SelectItem>
              <SelectItem value="SEMI">Semi</SelectItem>
            </SelectContent>
          </Select>
          
          {/* Filtro por cliente */}
          <Select value={filterClient} onValueChange={setFilterClient}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Cliente" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Todos los clientes</SelectItem>
              <SelectItem value="PROPIO">Propios</SelectItem>
              <SelectItem value="CLIENTE">De Cliente</SelectItem>
              {uniqueClients.map((client) => (
                <SelectItem key={client} value={client}>{client}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          
          {/* Toggle de vista */}
          <div className="flex border rounded-md">
            <Button
              variant={viewMode === 'card' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('card')}
              className="rounded-r-none"
            >
              <LayoutGrid className="h-4 w-4" />
            </Button>
            <Button
              variant={viewMode === 'table' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('table')}
              className="rounded-l-none"
            >
              <Table2 className="h-4 w-4" />
            </Button>
          </div>

          {/* Botón nuevo camión */}
          {canManageTrucks && (
            <Button onClick={() => { resetForm(); setIsDialogOpen(true); }}>
              <Plus className="h-4 w-4 mr-2" />
              Nuevo Camión
            </Button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <p className="text-muted-foreground">Cargando camiones...</p>
        </div>
      ) : trucks.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Truck className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground text-center">
              No hay camiones registrados. Cree uno para comenzar.
            </p>
          </CardContent>
        </Card>
      ) : filteredTrucks.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Truck className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground text-center">
              No se encontraron camiones con los filtros aplicados.
            </p>
          </CardContent>
        </Card>
      ) : viewMode === 'card' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredTrucks.map((truck) => (
            <Card 
              key={truck.id}
              className="group hover:shadow-lg transition-shadow cursor-pointer relative"
              onClick={() => setViewingTruck(truck)}
            >
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-lg font-bold">{truck.name}</CardTitle>
                    <p className="text-xs text-muted-foreground mt-1">ID: {truck.id}</p>
                    {truck.internalId && (
                      <p className="text-xs text-muted-foreground mt-0.5">ID Interno: {truck.internalId}</p>
                    )}
                  </div>
                  <Badge className={cn(getTypeColor(truck.type), 'text-white')}>
                    {getTypeLabel(truck.type)}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="space-y-2.5">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Largo:</span>
                    <span className="font-medium">{truck.length} m</span>
                  </div>
                  {truck.maxWeight && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Peso máx:</span>
                      <span className="font-medium">{truck.maxWeight} Tn</span>
                    </div>
                  )}
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Tipo:</span>
                    <Badge variant={truck.isOwn ? 'default' : 'outline'} className={truck.isOwn ? 'bg-black text-white' : ''}>
                      {truck.isOwn ? 'Propio' : 'De Cliente'}
                    </Badge>
                  </div>
                  {!truck.isOwn && truck.client && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Cliente:</span>
                      <span className="font-medium">{truck.client}</span>
                    </div>
                  )}
                  {truck.description && (
                    <p className="text-sm text-muted-foreground line-clamp-2 mt-2 pt-2 border-t">
                      {truck.description}
                    </p>
                  )}
                  {canManageTrucks && (
                  <div className="flex gap-2 pt-4 opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleEdit(truck)}
                      className="flex-1"
                    >
                      <Edit className="h-4 w-4 mr-2" />
                      Editar
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDelete(truck.id)}
                      className="flex-1 text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Eliminar
                    </Button>
                  </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="border-2 border-border rounded-lg overflow-hidden bg-card shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-muted border-b-2 border-border sticky top-0 z-10">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-foreground">ID</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-foreground">Nombre</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-foreground">Tipo</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-foreground">Largo</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-foreground">Peso máx</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-foreground">Propiedad</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-foreground">Cliente</th>
                  {canManageTrucks && (
                    <th className="px-4 py-3 text-left text-sm font-semibold text-foreground">Acciones</th>
                  )}
                </tr>
              </thead>
              <tbody>
                {filteredTrucks.map((truck) => (
                  <tr 
                    key={truck.id} 
                    className="border-b border-border hover:bg-muted/50 cursor-pointer transition-colors bg-background"
                    onClick={() => setViewingTruck(truck)}
                  >
                    <td className="px-4 py-3 text-sm font-medium">{truck.id}</td>
                    <td className="px-4 py-3 text-sm font-medium">{truck.name}</td>
                    <td className="px-4 py-3 text-sm">
                      <Badge className={cn(getTypeColor(truck.type), 'text-white')}>
                        {getTypeLabel(truck.type)}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-sm">{truck.length} m</td>
                    <td className="px-4 py-3 text-sm">{truck.maxWeight ? `${truck.maxWeight} Tn` : '-'}</td>
                    <td className="px-4 py-3 text-sm">
                      <Badge variant={truck.isOwn ? 'default' : 'outline'} className={truck.isOwn ? 'bg-black text-white' : ''}>
                        {truck.isOwn ? 'Propio' : 'De Cliente'}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-sm">{truck.client || '-'}</td>
                    {canManageTrucks && (
                      <td className="px-4 py-3 text-sm">
                        <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEdit(truck)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(truck.id)}
                            className="text-destructive hover:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Dialog para ver detalles del camión */}
      <Dialog open={!!viewingTruck} onOpenChange={(open) => !open && setViewingTruck(null)}>
        <DialogContent size="lg">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-primary/10 rounded-lg">
                  <Truck className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <DialogTitle className="text-2xl font-bold">{viewingTruck?.name}</DialogTitle>
                  <DialogDescription className="text-sm mt-1">
              Información completa del camión
            </DialogDescription>
                </div>
              </div>
            </div>
          </DialogHeader>
          <DialogBody>
          {viewingTruck && (
            <div className="space-y-5">
              {/* Información Básica */}
              <Card className="border-2">
                <CardHeader className="bg-muted/50 pb-3">
                  <CardTitle className="text-base font-semibold flex items-center gap-2">
                    <div className="h-1.5 w-1.5 rounded-full bg-primary"></div>
                    Información Básica
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-4">
                  <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Nombre / Patente
                      </Label>
                      <p className="text-base font-semibold">{viewingTruck.name}</p>
                </div>
                    <div className="space-y-2">
                      <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Tipo
                      </Label>
                      <div>
                        <Badge className={cn(getTypeColor(viewingTruck.type), 'text-sm px-3 py-1')}>
                    {getTypeLabel(viewingTruck.type)}
                  </Badge>
                </div>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Propiedad
                      </Label>
                      <div>
                        <Badge variant={viewingTruck.isOwn ? 'default' : 'secondary'} className="text-sm px-3 py-1">
                          {viewingTruck.isOwn ? 'Propio' : 'De Cliente'}
                        </Badge>
                      </div>
                    </div>
                    {!viewingTruck.isOwn && viewingTruck.client && (
                      <div className="space-y-2">
                        <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          Cliente Dueño
                        </Label>
                        <p className="text-base font-semibold">{viewingTruck.client}</p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Dimensiones */}
              <Card className="border-2">
                <CardHeader className="bg-muted/50 pb-3">
                  <CardTitle className="text-base font-semibold flex items-center gap-2">
                    <div className="h-1.5 w-1.5 rounded-full bg-info"></div>
                    Dimensiones
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-4">
                {viewingTruck.type === 'EQUIPO' ? (
                    <div className="grid grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          Largo Chasis
                        </Label>
                        <p className="text-base font-semibold">
                        {viewingTruck.chasisLength !== null && viewingTruck.chasisLength !== undefined 
                          ? `${viewingTruck.chasisLength} m` 
                            : <span className="text-muted-foreground italic">No especificado</span>}
                      </p>
                    </div>
                      <div className="space-y-2">
                        <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          Largo Acoplado
                        </Label>
                        <p className="text-base font-semibold">
                        {viewingTruck.acopladoLength !== null && viewingTruck.acopladoLength !== undefined 
                          ? `${viewingTruck.acopladoLength} m` 
                            : <span className="text-muted-foreground italic">No especificado</span>}
                      </p>
                    </div>
                    </div>
                ) : (
                    <div className="space-y-2">
                      <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Largo
                      </Label>
                      <p className="text-base font-semibold">{viewingTruck.length} m</p>
                  </div>
                )}
                </CardContent>
              </Card>

              {/* Peso */}
              {viewingTruck.type === 'EQUIPO' ? (
                <Card className="border-2">
                  <CardHeader className="bg-muted/50 pb-3">
                    <CardTitle className="text-base font-semibold flex items-center gap-2">
                      <div className="h-1.5 w-1.5 rounded-full bg-warning"></div>
                      Peso
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-4">
                    <div className="grid grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          Peso Chasis
                        </Label>
                        <p className="text-base font-semibold">
                          {viewingTruck.chasisWeight !== null && viewingTruck.chasisWeight !== undefined 
                            ? `${viewingTruck.chasisWeight} Tn` 
                            : <span className="text-muted-foreground italic">No especificado</span>}
                        </p>
                  </div>
                      <div className="space-y-2">
                        <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          Peso Acoplado
                        </Label>
                        <p className="text-base font-semibold">
                          {viewingTruck.acopladoWeight !== null && viewingTruck.acopladoWeight !== undefined 
                            ? `${viewingTruck.acopladoWeight} Tn` 
                            : <span className="text-muted-foreground italic">No especificado</span>}
                        </p>
                </div>
                  </div>
                  </CardContent>
                </Card>
              ) : viewingTruck.maxWeight ? (
                <Card className="border-2">
                  <CardHeader className="bg-muted/50 pb-3">
                    <CardTitle className="text-base font-semibold flex items-center gap-2">
                      <div className="h-1.5 w-1.5 rounded-full bg-warning"></div>
                      Peso
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-4">
                    <div className="space-y-2">
                      <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Peso Máximo
                      </Label>
                      <p className="text-base font-semibold">{viewingTruck.maxWeight} Tn</p>
              </div>
                  </CardContent>
                </Card>
              ) : null}

              {/* Descripción */}
              {viewingTruck.description && (
                <Card className="border-2">
                  <CardHeader className="bg-muted/50 pb-3">
                    <CardTitle className="text-base font-semibold flex items-center gap-2">
                      <div className="h-1.5 w-1.5 rounded-full bg-success"></div>
                      Descripción
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-4">
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">
                      {viewingTruck.description}
                    </p>
                  </CardContent>
                </Card>
              )}

              {/* Acciones */}
              {canManageTrucks && (
                <div className="flex gap-3 pt-4 border-t">
                <Button
                  variant="outline"
                  onClick={() => {
                    setViewingTruck(null);
                    handleEdit(viewingTruck);
                  }}
                    className="flex-1 h-11 font-medium"
                >
                  <Edit className="h-4 w-4 mr-2" />
                  Editar
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setViewingTruck(null);
                    handleDelete(viewingTruck.id);
                  }}
                    className="flex-1 h-11 font-medium text-destructive hover:text-destructive hover:bg-destructive/10 border-destructive/20"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Eliminar
                </Button>
              </div>
              )}
            </div>
          )}
          </DialogBody>
        </DialogContent>
      </Dialog>
    </div>
  );
}

