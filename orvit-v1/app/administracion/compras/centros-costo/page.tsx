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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Building,
  Plus,
  Search,
  Edit,
  Trash2,
  ChevronRight,
  FolderTree
} from 'lucide-react';
import { toast } from 'sonner';
import { useConfirm } from '@/components/ui/confirm-dialog-provider';

interface CentroCosto {
  id: number;
  codigo: string;
  nombre: string;
  descripcion?: string;
  isActive: boolean;
  parentId?: number;
  parent?: { id: number; codigo: string; nombre: string };
  children?: CentroCosto[];
  _count: { purchaseOrders: number; receipts: number };
}

export default function CentrosCostoPage() {
  const confirm = useConfirm();
  const [searchTerm, setSearchTerm] = useState('');
  const [centrosCosto, setCentrosCosto] = useState<CentroCosto[]>([]);
  const [loading, setLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCentro, setEditingCentro] = useState<CentroCosto | null>(null);
  const [formData, setFormData] = useState({
    codigo: '',
    nombre: '',
    descripcion: '',
    parentId: ''
  });
  const [saving, setSaving] = useState(false);

  const loadCentrosCosto = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/compras/centros-costo?includeInactive=true&flat=true');
      if (!response.ok) throw new Error('Error al obtener centros de costo');
      const data = await response.json();
      setCentrosCosto(data);
    } catch (error) {
      console.error('Error:', error);
      toast.error('Error al cargar centros de costo');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCentrosCosto();
  }, []);

  const handleOpenModal = (centro?: CentroCosto) => {
    if (centro) {
      setEditingCentro(centro);
      setFormData({
        codigo: centro.codigo,
        nombre: centro.nombre,
        descripcion: centro.descripcion || '',
        parentId: centro.parentId?.toString() || ''
      });
    } else {
      setEditingCentro(null);
      setFormData({ codigo: '', nombre: '', descripcion: '', parentId: '' });
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
      const url = editingCentro
        ? `/api/compras/centros-costo/${editingCentro.id}`
        : '/api/compras/centros-costo';

      const response = await fetch(url, {
        method: editingCentro ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          parentId: formData.parentId || null
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Error al guardar');
      }

      toast.success(editingCentro ? 'Centro actualizado' : 'Centro creado');
      setIsModalOpen(false);
      loadCentrosCosto();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (centro: CentroCosto) => {
    const ok = await confirm({
      title: 'Desactivar centro de costo',
      description: `¿Desactivar "${centro.nombre}"?`,
      confirmText: 'Eliminar',
      variant: 'destructive',
    });
    if (!ok) return;

    try {
      const response = await fetch(`/api/compras/centros-costo/${centro.id}`, {
        method: 'DELETE'
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Error al eliminar');
      }

      toast.success('Centro desactivado');
      loadCentrosCosto();
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const filteredCentros = centrosCosto.filter(c =>
    c.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.codigo.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="m-3 rounded-2xl surface-card dashboard-surface px-6 md:px-8 py-6 space-y-6">
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold mb-2">Centros de Costo</h1>
          <p className="text-sm md:text-base text-muted-foreground">
            Organiza las compras por centros de costo
          </p>
        </div>
        <Button onClick={() => handleOpenModal()}>
          <Plus className="w-4 h-4 mr-2" />
          Nuevo Centro
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Centros</p>
                <p className="text-2xl font-bold">{centrosCosto.filter(c => c.isActive).length}</p>
              </div>
              <Building className="w-8 h-8 text-info-muted-foreground" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Órdenes Asignadas</p>
                <p className="text-2xl font-bold">
                  {centrosCosto.reduce((acc, c) => acc + c._count.purchaseOrders, 0)}
                </p>
              </div>
              <FolderTree className="w-8 h-8 text-success" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Facturas</p>
                <p className="text-2xl font-bold">
                  {centrosCosto.reduce((acc, c) => acc + c._count.receipts, 0)}
                </p>
              </div>
              <Building className="w-8 h-8 text-purple-500" />
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
              <p className="text-muted-foreground">Cargando centros de costo...</p>
            </div>
          ) : filteredCentros.length === 0 ? (
            <div className="text-center py-12">
              <Building className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">No hay centros de costo</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Código</TableHead>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Centro Padre</TableHead>
                  <TableHead>Órdenes</TableHead>
                  <TableHead>Facturas</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredCentros.map((centro) => (
                  <TableRow key={centro.id}>
                    <TableCell>{centro.codigo}</TableCell>
                    <TableCell className="font-medium">{centro.nombre}</TableCell>
                    <TableCell>
                      {centro.parent ? (
                        <span className="text-sm text-muted-foreground">
                          {centro.parent.codigo} - {centro.parent.nombre}
                        </span>
                      ) : '-'}
                    </TableCell>
                    <TableCell>{centro._count.purchaseOrders}</TableCell>
                    <TableCell>{centro._count.receipts}</TableCell>
                    <TableCell>
                      <Badge variant={centro.isActive ? 'default' : 'secondary'}>
                        {centro.isActive ? 'Activo' : 'Inactivo'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button variant="ghost" size="sm" onClick={() => handleOpenModal(centro)}>
                          <Edit className="w-4 h-4" />
                        </Button>
                        {centro.isActive && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-destructive"
                            onClick={() => handleDelete(centro)}
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
            <DialogTitle>{editingCentro ? 'Editar Centro' : 'Nuevo Centro'}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Código *</Label>
                <Input
                  value={formData.codigo}
                  onChange={(e) => setFormData({ ...formData, codigo: e.target.value })}
                  placeholder="CC001"
                />
              </div>
              <div className="space-y-2">
                <Label>Nombre *</Label>
                <Input
                  value={formData.nombre}
                  onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                  placeholder="Administración"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Centro Padre (opcional)</Label>
              <Select
                value={formData.parentId}
                onValueChange={(v) => setFormData({ ...formData, parentId: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Sin padre" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Sin padre</SelectItem>
                  {centrosCosto
                    .filter(c => c.id !== editingCentro?.id && c.isActive)
                    .map((c) => (
                      <SelectItem key={c.id} value={c.id.toString()}>
                        {c.codigo} - {c.nombre}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Descripción</Label>
              <Textarea
                value={formData.descripcion}
                onChange={(e) => setFormData({ ...formData, descripcion: e.target.value })}
                placeholder="Descripción..."
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsModalOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? 'Guardando...' : 'Guardar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
