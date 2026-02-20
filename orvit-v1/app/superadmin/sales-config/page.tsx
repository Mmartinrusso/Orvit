'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogBody,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Users,
  MapPin,
  Truck,
  Briefcase,
  Plus,
  Pencil,
  Trash2,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import { useConfirm } from '@/components/ui/confirm-dialog-provider';

interface Company {
  id: number;
  name: string;
}

interface ConfigItem {
  id: string;
  name: string;
  description?: string;
  phone?: string;
  email?: string;
  isActive: boolean;
}

type ConfigType = 'client-types' | 'delivery-zones' | 'transport-companies' | 'business-sectors';

const CONFIG_LABELS: Record<ConfigType, { singular: string; plural: string; icon: any }> = {
  'client-types': { singular: 'Tipo de Cliente', plural: 'Tipos de Cliente', icon: Users },
  'delivery-zones': { singular: 'Zona de Reparto', plural: 'Zonas de Reparto', icon: MapPin },
  'transport-companies': { singular: 'Transporte', plural: 'Transportes', icon: Truck },
  'business-sectors': { singular: 'Rubro/Sector', plural: 'Rubros/Sectores', icon: Briefcase },
};

export default function SalesConfigPage() {
  const confirm = useConfirm();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [selectedCompany, setSelectedCompany] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingItems, setLoadingItems] = useState(false);
  const [activeTab, setActiveTab] = useState<ConfigType>('client-types');

  // Items por tipo
  const [items, setItems] = useState<Record<ConfigType, ConfigItem[]>>({
    'client-types': [],
    'delivery-zones': [],
    'transport-companies': [],
    'business-sectors': [],
  });

  // Dialog state
  const [showDialog, setShowDialog] = useState(false);
  const [editingItem, setEditingItem] = useState<ConfigItem | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    phone: '',
    email: '',
  });
  const [saving, setSaving] = useState(false);

  // Cargar empresas
  useEffect(() => {
    async function fetchCompanies() {
      try {
        const res = await fetch('/api/superadmin/companies');
        if (res.ok) {
          const data = await res.json();
          setCompanies(data.companies || []);
        }
      } catch (error) {
        console.error('Error cargando empresas:', error);
        toast.error('Error al cargar empresas');
      } finally {
        setLoading(false);
      }
    }
    fetchCompanies();
  }, []);

  // Cargar items cuando cambia la empresa o el tab
  useEffect(() => {
    if (!selectedCompany) return;

    async function fetchItems() {
      setLoadingItems(true);
      try {
        const res = await fetch(
          `/api/superadmin/sales-config/${activeTab}?companyId=${selectedCompany}`
        );
        if (res.ok) {
          const data = await res.json();
          const key = activeTab.replace(/-/g, '') as string;
          // El nombre de la propiedad en la respuesta
          const propName = activeTab === 'client-types' ? 'clientTypes'
            : activeTab === 'delivery-zones' ? 'deliveryZones'
            : activeTab === 'transport-companies' ? 'transportCompanies'
            : 'businessSectors';
          setItems(prev => ({
            ...prev,
            [activeTab]: data[propName] || [],
          }));
        }
      } catch (error) {
        console.error('Error cargando items:', error);
        toast.error('Error al cargar datos');
      } finally {
        setLoadingItems(false);
      }
    }
    fetchItems();
  }, [selectedCompany, activeTab]);

  const handleOpenDialog = (item?: ConfigItem) => {
    if (item) {
      setEditingItem(item);
      setFormData({
        name: item.name,
        description: item.description || '',
        phone: item.phone || '',
        email: item.email || '',
      });
    } else {
      setEditingItem(null);
      setFormData({ name: '', description: '', phone: '', email: '' });
    }
    setShowDialog(true);
  };

  const handleSave = async () => {
    if (!formData.name.trim() || !selectedCompany) {
      toast.error('El nombre es requerido');
      return;
    }

    setSaving(true);
    try {
      const url = `/api/superadmin/sales-config/${activeTab}`;
      const method = editingItem ? 'PUT' : 'POST';
      const body = editingItem
        ? { id: editingItem.id, ...formData }
        : { ...formData, companyId: selectedCompany };

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        const saved = await res.json();
        setItems(prev => ({
          ...prev,
          [activeTab]: editingItem
            ? prev[activeTab].map(i => (i.id === saved.id ? saved : i))
            : [...prev[activeTab], saved],
        }));
        setShowDialog(false);
        toast.success(editingItem ? 'Actualizado correctamente' : 'Creado correctamente');
      } else {
        const error = await res.json();
        toast.error(error.error || 'Error al guardar');
      }
    } catch (error) {
      console.error('Error guardando:', error);
      toast.error('Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (item: ConfigItem) => {
    try {
      const res = await fetch(`/api/superadmin/sales-config/${activeTab}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: item.id, isActive: !item.isActive }),
      });

      if (res.ok) {
        const updated = await res.json();
        setItems(prev => ({
          ...prev,
          [activeTab]: prev[activeTab].map(i => (i.id === updated.id ? updated : i)),
        }));
        toast.success(updated.isActive ? 'Activado' : 'Desactivado');
      }
    } catch (error) {
      console.error('Error actualizando estado:', error);
      toast.error('Error al actualizar');
    }
  };

  const handleDelete = async (item: ConfigItem) => {
    const ok = await confirm({
      title: 'Eliminar elemento',
      description: `¿Eliminar "${item.name}"? Esta acción no se puede deshacer.`,
      confirmText: 'Eliminar',
      variant: 'destructive',
    });
    if (!ok) return;

    try {
      const res = await fetch(`/api/superadmin/sales-config/${activeTab}?id=${item.id}`, {
        method: 'DELETE',
      });

      if (res.ok) {
        setItems(prev => ({
          ...prev,
          [activeTab]: prev[activeTab].filter(i => i.id !== item.id),
        }));
        toast.success('Eliminado correctamente');
      } else {
        const error = await res.json();
        toast.error(error.error || 'Error al eliminar');
      }
    } catch (error) {
      console.error('Error eliminando:', error);
      toast.error('Error al eliminar');
    }
  };

  const currentConfig = CONFIG_LABELS[activeTab];
  const currentItems = items[activeTab];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Configuracion de Ventas</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Administra los catalogos de configuracion para el modulo de Ventas
        </p>
      </div>

      {/* Selector de Empresa */}
      <Card>
        <CardHeader>
          <CardTitle>Seleccionar Empresa</CardTitle>
          <CardDescription>
            Elige una empresa para configurar sus catalogos
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Select
            value={selectedCompany?.toString() || ''}
            onValueChange={(value) => setSelectedCompany(parseInt(value))}
          >
            <SelectTrigger className="w-full md:w-80">
              <SelectValue placeholder="Selecciona una empresa..." />
            </SelectTrigger>
            <SelectContent>
              {companies.map((company) => (
                <SelectItem key={company.id} value={company.id.toString()}>
                  {company.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {selectedCompany && (
        <Card>
          <CardContent className="pt-6">
            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as ConfigType)}>
              <TabsList className="w-full justify-start overflow-x-auto">
                {(Object.keys(CONFIG_LABELS) as ConfigType[]).map((key) => {
                  const config = CONFIG_LABELS[key];
                  const Icon = config.icon;
                  return (
                    <TabsTrigger key={key} value={key}>
                      <Icon className="w-4 h-4 mr-2" />
                      {config.plural}
                    </TabsTrigger>
                  );
                })}
              </TabsList>

              {(Object.keys(CONFIG_LABELS) as ConfigType[]).map((key) => (
                <TabsContent key={key} value={key} className="mt-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold">
                      {CONFIG_LABELS[key].plural}
                    </h3>
                    <Button onClick={() => handleOpenDialog()}>
                      <Plus className="w-4 h-4 mr-2" />
                      Nuevo
                    </Button>
                  </div>

                  {loadingItems ? (
                    <div className="flex items-center justify-center h-32">
                      <Loader2 className="h-6 w-6 animate-spin text-primary" />
                    </div>
                  ) : currentItems.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-center">
                      <AlertCircle className="h-12 w-12 text-muted-foreground/50 mb-4" />
                      <p className="text-muted-foreground">
                        No hay {CONFIG_LABELS[key].plural.toLowerCase()} configurados
                      </p>
                      <Button variant="outline" className="mt-4" onClick={() => handleOpenDialog()}>
                        <Plus className="w-4 h-4 mr-2" />
                        Crear {CONFIG_LABELS[key].singular}
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {currentItems.map((item) => (
                        <div
                          key={item.id}
                          className="flex items-center justify-between p-4 rounded-lg border bg-card"
                        >
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <span className="font-medium">{item.name}</span>
                              {!item.isActive && (
                                <Badge variant="outline" className="text-muted-foreground">
                                  Inactivo
                                </Badge>
                              )}
                            </div>
                            {item.description && (
                              <p className="text-sm text-muted-foreground mt-1">
                                {item.description}
                              </p>
                            )}
                            {(item.phone || item.email) && (
                              <p className="text-xs text-muted-foreground mt-1">
                                {item.phone && <span>{item.phone}</span>}
                                {item.phone && item.email && <span> | </span>}
                                {item.email && <span>{item.email}</span>}
                              </p>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <Switch
                              checked={item.isActive}
                              onCheckedChange={() => handleToggleActive(item)}
                            />
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleOpenDialog(item)}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDelete(item)}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </TabsContent>
              ))}
            </Tabs>
          </CardContent>
        </Card>
      )}

      {/* Dialog para crear/editar */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingItem ? `Editar ${currentConfig.singular}` : `Nuevo ${currentConfig.singular}`}
            </DialogTitle>
          </DialogHeader>
          <DialogBody>
            <div className="space-y-4">
              <div>
                <Label htmlFor="name">Nombre *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder={`Nombre del ${currentConfig.singular.toLowerCase()}`}
                  autoFocus
                />
              </div>
              <div>
                <Label htmlFor="description">Descripcion</Label>
                <Input
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Descripcion opcional"
                />
              </div>
              {activeTab === 'transport-companies' && (
                <>
                  <div>
                    <Label htmlFor="phone">Telefono</Label>
                    <Input
                      id="phone"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      placeholder="Telefono de contacto"
                    />
                  </div>
                  <div>
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      placeholder="Email de contacto"
                    />
                  </div>
                </>
              )}
            </div>
          </DialogBody>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {editingItem ? 'Guardar' : 'Crear'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
