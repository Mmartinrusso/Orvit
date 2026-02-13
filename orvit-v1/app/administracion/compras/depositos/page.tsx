'use client';

import { useEffect, useState } from 'react';
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
  TableRow
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
  Warehouse,
  Plus,
  Search,
  Edit,
  Trash2,
  Package,
  Star,
  MapPin
} from 'lucide-react';
import { toast } from 'sonner';

interface Deposito {
  id: number;
  codigo: string;
  nombre: string;
  descripcion?: string;
  direccion?: string;
  isDefault: boolean;
  isActive: boolean;
  createdAt: string;
  _count: {
    stockLocations: number;
    goodsReceipts: number;
  };
}

export default function DepositosPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [depositos, setDepositos] = useState<Deposito[]>([]);
  const [loading, setLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingDeposito, setEditingDeposito] = useState<Deposito | null>(null);
  const [formData, setFormData] = useState({
    codigo: '',
    nombre: '',
    descripcion: '',
    direccion: '',
    isDefault: false
  });
  const [saving, setSaving] = useState(false);

  const loadDepositos = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/compras/depositos?includeInactive=true');
      if (!response.ok) throw new Error('Error al obtener depósitos');
      const data = await response.json();
      setDepositos(data);
    } catch (error) {
      console.error('Error:', error);
      toast.error('Error al cargar depósitos');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDepositos();
  }, []);

  const handleOpenModal = (deposito?: Deposito) => {
    if (deposito) {
      setEditingDeposito(deposito);
      setFormData({
        codigo: deposito.codigo,
        nombre: deposito.nombre,
        descripcion: deposito.descripcion || '',
        direccion: deposito.direccion || '',
        isDefault: deposito.isDefault
      });
    } else {
      setEditingDeposito(null);
      setFormData({
        codigo: '',
        nombre: '',
        descripcion: '',
        direccion: '',
        isDefault: false
      });
    }
    setIsModalOpen(true);
  };

  const handleSave = async () => {
    if (!formData.codigo.trim() || !formData.nombre.trim()) {
      toast.error('Código y nombre son requeridos');
      return;
    }

    setSaving(true);
    try {
      const url = editingDeposito
        ? `/api/compras/depositos/${editingDeposito.id}`
        : '/api/compras/depositos';

      const response = await fetch(url, {
        method: editingDeposito ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Error al guardar');
      }

      toast.success(editingDeposito ? 'Depósito actualizado' : 'Depósito creado');
      setIsModalOpen(false);
      loadDepositos();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (deposito: Deposito) => {
    if (!confirm(`¿Desactivar el depósito "${deposito.nombre}"?`)) return;

    try {
      const response = await fetch(`/api/compras/depositos/${deposito.id}`, {
        method: 'DELETE'
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Error al eliminar');
      }

      toast.success('Depósito desactivado');
      loadDepositos();
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const filteredDepositos = depositos.filter(d =>
    d.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
    d.codigo.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="m-3 rounded-2xl surface-card dashboard-surface px-6 md:px-8 py-6 space-y-6">
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold mb-2">Depósitos</h1>
          <p className="text-sm md:text-base text-muted-foreground">
            Gestiona los depósitos y almacenes de la empresa
          </p>
        </div>
        <Button onClick={() => handleOpenModal()}>
          <Plus className="w-4 h-4 mr-2" />
          Nuevo Depósito
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Depósitos</p>
                <p className="text-2xl font-bold">{depositos.filter(d => d.isActive).length}</p>
              </div>
              <Warehouse className="w-8 h-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Items en Stock</p>
                <p className="text-2xl font-bold">
                  {depositos.reduce((acc, d) => acc + d._count.stockLocations, 0)}
                </p>
              </div>
              <Package className="w-8 h-8 text-green-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Recepciones</p>
                <p className="text-2xl font-bold">
                  {depositos.reduce((acc, d) => acc + d._count.goodsReceipts, 0)}
                </p>
              </div>
              <Package className="w-8 h-8 text-purple-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filtros */}
      <Card>
        <CardContent className="p-4">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nombre o código..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>
        </CardContent>
      </Card>

      {/* Tabla */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground">Cargando depósitos...</p>
            </div>
          ) : filteredDepositos.length === 0 ? (
            <div className="text-center py-12">
              <Warehouse className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">No se encontraron depósitos</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Código</TableHead>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Dirección</TableHead>
                  <TableHead>Items</TableHead>
                  <TableHead>Recepciones</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredDepositos.map((deposito) => (
                  <TableRow key={deposito.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {deposito.codigo}
                        {deposito.isDefault && (
                          <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="font-medium">{deposito.nombre}</TableCell>
                    <TableCell>
                      {deposito.direccion ? (
                        <div className="flex items-center gap-1 text-sm text-muted-foreground">
                          <MapPin className="w-3 h-3" />
                          {deposito.direccion}
                        </div>
                      ) : '-'}
                    </TableCell>
                    <TableCell>{deposito._count.stockLocations}</TableCell>
                    <TableCell>{deposito._count.goodsReceipts}</TableCell>
                    <TableCell>
                      <Badge variant={deposito.isActive ? 'default' : 'secondary'}>
                        {deposito.isActive ? 'Activo' : 'Inactivo'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleOpenModal(deposito)}
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        {deposito.isActive && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-destructive"
                            onClick={() => handleDelete(deposito)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingDeposito ? 'Editar Depósito' : 'Nuevo Depósito'}
            </DialogTitle>
            <DialogDescription>
              {editingDeposito ? 'Modifica los datos del depósito' : 'Ingresa los datos del nuevo depósito'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="codigo">Código *</Label>
                <Input
                  id="codigo"
                  value={formData.codigo}
                  onChange={(e) => setFormData({ ...formData, codigo: e.target.value })}
                  placeholder="DEP001"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="nombre">Nombre *</Label>
                <Input
                  id="nombre"
                  value={formData.nombre}
                  onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                  placeholder="Depósito Central"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="direccion">Dirección</Label>
              <Input
                id="direccion"
                value={formData.direccion}
                onChange={(e) => setFormData({ ...formData, direccion: e.target.value })}
                placeholder="Av. Corrientes 1234, CABA"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="descripcion">Descripción</Label>
              <Textarea
                id="descripcion"
                value={formData.descripcion}
                onChange={(e) => setFormData({ ...formData, descripcion: e.target.value })}
                placeholder="Descripción del depósito..."
              />
            </div>

            <div className="flex items-center space-x-2">
              <Switch
                id="isDefault"
                checked={formData.isDefault}
                onCheckedChange={(checked) => setFormData({ ...formData, isDefault: checked })}
              />
              <Label htmlFor="isDefault">Depósito por defecto</Label>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsModalOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? 'Guardando...' : 'Guardar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
