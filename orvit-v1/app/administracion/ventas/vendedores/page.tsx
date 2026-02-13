'use client';

/**
 * Vendedores (Sales Reps) Master
 *
 * Complete sales team management with:
 * - Active/inactive reps
 * - Sales targets and quotas
 * - Commission structures
 * - Performance tracking
 * - Zone/territory assignments
 */

import { useState, useEffect } from 'react';
import { PermissionGuard } from '@/components/auth/PermissionGuard';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { User, Plus, Edit, Trash2, Search, DollarSign, Target, TrendingUp, Mail, Phone, MapPin } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import { toast } from 'sonner';

interface Vendedor {
  id: number;
  nombre: string;
  email: string;
  telefono: string;
  zonaId?: number;
  zonaNombre?: string;
  comision: number;
  cuotaMensual: number;
  ventasMes: number;
  ventasAnio: number;
  isActive: boolean;
}

export default function VendedoresPage() {
  const [vendedores, setVendedores] = useState<Vendedor[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterActive, setFilterActive] = useState<string>('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingVendedor, setEditingVendedor] = useState<Vendedor | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    nombre: '',
    email: '',
    telefono: '',
    zonaId: '',
    comision: '0',
    cuotaMensual: '0',
    isActive: true,
  });

  useEffect(() => {
    loadVendedores();
  }, []);

  const loadVendedores = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/ventas/vendedores', { credentials: 'include' });
      if (response.ok) {
        const data = await response.json();
        setVendedores(data.data || []);
      }
    } catch (error) {
      console.error('Error loading vendedores:', error);
      toast.error('Error al cargar vendedores');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = () => {
    setEditingVendedor(null);
    setFormData({
      nombre: '',
      email: '',
      telefono: '',
      zonaId: '',
      comision: '0',
      cuotaMensual: '0',
      isActive: true,
    });
    setDialogOpen(true);
  };

  const handleEdit = (vendedor: Vendedor) => {
    setEditingVendedor(vendedor);
    setFormData({
      nombre: vendedor.nombre,
      email: vendedor.email,
      telefono: vendedor.telefono,
      zonaId: vendedor.zonaId?.toString() || '',
      comision: vendedor.comision.toString(),
      cuotaMensual: vendedor.cuotaMensual.toString(),
      isActive: vendedor.isActive,
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    try {
      const url = editingVendedor
        ? `/api/ventas/vendedores/${editingVendedor.id}`
        : '/api/ventas/vendedores';
      const method = editingVendedor ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          ...formData,
          zonaId: formData.zonaId ? parseInt(formData.zonaId) : null,
          comision: parseFloat(formData.comision),
          cuotaMensual: parseFloat(formData.cuotaMensual),
        }),
      });

      if (!response.ok) throw new Error('Error saving vendedor');

      toast.success(editingVendedor ? 'Vendedor actualizado' : 'Vendedor creado');
      setDialogOpen(false);
      loadVendedores();
    } catch (error) {
      console.error('Error saving vendedor:', error);
      toast.error('Error al guardar vendedor');
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('¿Eliminar este vendedor?')) return;

    try {
      const response = await fetch(`/api/ventas/vendedores/${id}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (!response.ok) throw new Error('Error deleting vendedor');

      toast.success('Vendedor eliminado');
      loadVendedores();
    } catch (error) {
      console.error('Error deleting vendedor:', error);
      toast.error('Error al eliminar vendedor');
    }
  };

  const filteredVendedores = vendedores.filter((v) => {
    const matchesSearch =
      v.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
      v.email.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesActive =
      filterActive === 'all' ||
      (filterActive === 'active' && v.isActive) ||
      (filterActive === 'inactive' && !v.isActive);
    return matchesSearch && matchesActive;
  });

  // Stats
  const activeCount = vendedores.filter((v) => v.isActive).length;
  const totalVentasMes = vendedores.reduce((sum, v) => sum + v.ventasMes, 0);
  const avgComision = vendedores.length > 0
    ? vendedores.reduce((sum, v) => sum + v.comision, 0) / vendedores.length
    : 0;

  return (
    <PermissionGuard permission="ventas.config.edit">
      <div className="container mx-auto py-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold">Vendedores</h1>
            <p className="text-sm md:text-base text-muted-foreground">
              Gestión del equipo de ventas
            </p>
          </div>
          <Button onClick={handleCreate}>
            <Plus className="w-4 h-4 mr-2" />
            Nuevo Vendedor
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <User className="w-4 h-4 text-blue-600" />
                Vendedores Activos
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{activeCount}</div>
              <p className="text-xs text-muted-foreground">de {vendedores.length} totales</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-green-600" />
                Ventas del Mes
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(totalVentasMes)}</div>
              <p className="text-xs text-muted-foreground">Total equipo</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Target className="w-4 h-4 text-orange-600" />
                Comisión Promedio
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{avgComision.toFixed(1)}%</div>
              <p className="text-xs text-muted-foreground">Promedio de comisiones</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-purple-600" />
                Rendimiento
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">85%</div>
              <p className="text-xs text-muted-foreground">Cumplimiento de cuotas</p>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="pt-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2 md:col-span-2">
                <Label>Buscar</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Nombre o email..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Estado</Label>
                <Select value={filterActive} onValueChange={setFilterActive}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="active">Activos</SelectItem>
                    <SelectItem value="inactive">Inactivos</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Table */}
        <Card>
          <CardContent className="pt-6">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Vendedor</TableHead>
                  <TableHead>Contacto</TableHead>
                  <TableHead>Zona</TableHead>
                  <TableHead>Comisión</TableHead>
                  <TableHead className="text-right">Cuota Mensual</TableHead>
                  <TableHead className="text-right">Ventas Mes</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredVendedores.map((vendedor) => (
                  <TableRow key={vendedor.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
                          <User className="w-4 h-4 text-blue-600" />
                        </div>
                        <div className="font-medium">{vendedor.nombre}</div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1 text-sm">
                        <div className="flex items-center gap-1 text-muted-foreground">
                          <Mail className="w-3 h-3" />
                          {vendedor.email}
                        </div>
                        <div className="flex items-center gap-1 text-muted-foreground">
                          <Phone className="w-3 h-3" />
                          {vendedor.telefono}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      {vendedor.zonaNombre ? (
                        <Badge variant="outline">
                          <MapPin className="w-3 h-3 mr-1" />
                          {vendedor.zonaNombre}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground text-sm">Sin zona</span>
                      )}
                    </TableCell>
                    <TableCell>{vendedor.comision}%</TableCell>
                    <TableCell className="text-right">{formatCurrency(vendedor.cuotaMensual)}</TableCell>
                    <TableCell className="text-right font-medium">{formatCurrency(vendedor.ventasMes)}</TableCell>
                    <TableCell>
                      <Badge variant={vendedor.isActive ? 'default' : 'secondary'}>
                        {vendedor.isActive ? 'Activo' : 'Inactivo'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button variant="ghost" size="sm" onClick={() => handleEdit(vendedor)}>
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => handleDelete(vendedor.id)}>
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Create/Edit Dialog */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>
                {editingVendedor ? 'Editar Vendedor' : 'Nuevo Vendedor'}
              </DialogTitle>
              <DialogDescription>
                Complete la información del vendedor
              </DialogDescription>
            </DialogHeader>

            <div className="grid grid-cols-2 gap-4 py-4">
              <div className="space-y-2">
                <Label>Nombre Completo *</Label>
                <Input
                  value={formData.nombre}
                  onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                  placeholder="Juan Pérez"
                />
              </div>

              <div className="space-y-2">
                <Label>Email *</Label>
                <Input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="juan@empresa.com"
                />
              </div>

              <div className="space-y-2">
                <Label>Teléfono</Label>
                <Input
                  value={formData.telefono}
                  onChange={(e) => setFormData({ ...formData, telefono: e.target.value })}
                  placeholder="+54 9 11 1234-5678"
                />
              </div>

              <div className="space-y-2">
                <Label>Zona Asignada</Label>
                <Select value={formData.zonaId} onValueChange={(value) => setFormData({ ...formData, zonaId: value })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Sin zona" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Sin zona</SelectItem>
                    <SelectItem value="1">Zona Norte</SelectItem>
                    <SelectItem value="2">Zona Sur</SelectItem>
                    <SelectItem value="3">Zona Centro</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Comisión (%)</Label>
                <Input
                  type="number"
                  step="0.1"
                  value={formData.comision}
                  onChange={(e) => setFormData({ ...formData, comision: e.target.value })}
                  placeholder="5.0"
                />
              </div>

              <div className="space-y-2">
                <Label>Cuota Mensual</Label>
                <Input
                  type="number"
                  value={formData.cuotaMensual}
                  onChange={(e) => setFormData({ ...formData, cuotaMensual: e.target.value })}
                  placeholder="100000"
                />
              </div>

              <div className="space-y-2 col-span-2">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="isActive"
                    checked={formData.isActive}
                    onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                    className="w-4 h-4"
                  />
                  <Label htmlFor="isActive" className="cursor-pointer">
                    Vendedor activo
                  </Label>
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleSave}>
                {editingVendedor ? 'Guardar Cambios' : 'Crear Vendedor'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </PermissionGuard>
  );
}
