'use client';

import { formatNumber } from '@/lib/utils';
import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
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
  FolderKanban,
  Plus,
  Search,
  Edit,
  Trash2,
  Calendar,
  DollarSign,
  TrendingUp
} from 'lucide-react';
import { toast } from 'sonner';
import { DatePicker } from '@/components/ui/date-picker';
import { useConfirm } from '@/components/ui/confirm-dialog-provider';

interface Proyecto {
  id: number;
  codigo: string;
  nombre: string;
  descripcion?: string;
  fechaInicio?: string;
  fechaFin?: string;
  presupuesto?: number;
  estado: string;
  _count: { purchaseOrders: number; receipts: number };
  _sum?: { gastado: number };
}

const estadoColors: Record<string, string> = {
  'activo': 'default',
  'pausado': 'secondary',
  'completado': 'outline',
  'cancelado': 'destructive'
};

const estadoLabels: Record<string, string> = {
  'activo': 'Activo',
  'pausado': 'Pausado',
  'completado': 'Completado',
  'cancelado': 'Cancelado'
};

export default function ProyectosPage() {
  const confirm = useConfirm();
  const [searchTerm, setSearchTerm] = useState('');
  const [proyectos, setProyectos] = useState<Proyecto[]>([]);
  const [loading, setLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProyecto, setEditingProyecto] = useState<Proyecto | null>(null);
  const [formData, setFormData] = useState({
    codigo: '',
    nombre: '',
    descripcion: '',
    fechaInicio: '',
    fechaFin: '',
    presupuesto: '',
    estado: 'activo'
  });
  const [saving, setSaving] = useState(false);

  const loadProyectos = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/compras/proyectos?includeInactive=true');
      if (!response.ok) throw new Error('Error al obtener proyectos');
      const data = await response.json();
      setProyectos(data.data || data);
    } catch (error) {
      console.error('Error:', error);
      toast.error('Error al cargar proyectos');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProyectos();
  }, []);

  const handleOpenModal = (proyecto?: Proyecto) => {
    if (proyecto) {
      setEditingProyecto(proyecto);
      setFormData({
        codigo: proyecto.codigo,
        nombre: proyecto.nombre,
        descripcion: proyecto.descripcion || '',
        fechaInicio: proyecto.fechaInicio ? proyecto.fechaInicio.split('T')[0] : '',
        fechaFin: proyecto.fechaFin ? proyecto.fechaFin.split('T')[0] : '',
        presupuesto: proyecto.presupuesto?.toString() || '',
        estado: proyecto.estado
      });
    } else {
      setEditingProyecto(null);
      setFormData({
        codigo: '',
        nombre: '',
        descripcion: '',
        fechaInicio: '',
        fechaFin: '',
        presupuesto: '',
        estado: 'activo'
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
      const url = editingProyecto
        ? `/api/compras/proyectos/${editingProyecto.id}`
        : '/api/compras/proyectos';

      const response = await fetch(url, {
        method: editingProyecto ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          presupuesto: formData.presupuesto ? parseFloat(formData.presupuesto) : null,
          fechaInicio: formData.fechaInicio || null,
          fechaFin: formData.fechaFin || null
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Error al guardar');
      }

      toast.success(editingProyecto ? 'Proyecto actualizado' : 'Proyecto creado');
      setIsModalOpen(false);
      loadProyectos();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (proyecto: Proyecto) => {
    const ok = await confirm({
      title: 'Cancelar proyecto',
      description: `¿Cancelar proyecto "${proyecto.nombre}"?`,
      confirmText: 'Eliminar',
      variant: 'destructive',
    });
    if (!ok) return;

    try {
      const response = await fetch(`/api/compras/proyectos/${proyecto.id}`, {
        method: 'DELETE'
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Error al eliminar');
      }

      toast.success('Proyecto cancelado');
      loadProyectos();
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const formatCurrency = (value: number | undefined) => {
    if (!value) return '-';
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS'
    }).format(value);
  };

  const getProgressPercent = (proyecto: Proyecto) => {
    if (!proyecto.presupuesto || !proyecto._sum?.gastado) return 0;
    return Math.min((proyecto._sum.gastado / proyecto.presupuesto) * 100, 100);
  };

  const filteredProyectos = proyectos.filter(p =>
    p.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.codigo.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const activos = proyectos.filter(p => p.estado === 'activo').length;
  const presupuestoTotal = proyectos
    .filter(p => p.estado === 'activo')
    .reduce((acc, p) => acc + (p.presupuesto || 0), 0);
  const gastadoTotal = proyectos
    .filter(p => p.estado === 'activo')
    .reduce((acc, p) => acc + (p._sum?.gastado || 0), 0);

  return (
    <div className="m-3 rounded-2xl surface-card dashboard-surface px-6 md:px-8 py-6 space-y-6">
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold mb-2">Proyectos</h1>
          <p className="text-sm md:text-base text-muted-foreground">
            Gestiona proyectos y controla presupuestos
          </p>
        </div>
        <Button onClick={() => handleOpenModal()}>
          <Plus className="w-4 h-4 mr-2" />
          Nuevo Proyecto
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Proyectos Activos</p>
                <p className="text-2xl font-bold">{activos}</p>
              </div>
              <FolderKanban className="w-8 h-8 text-info-muted-foreground" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Presupuesto Total</p>
                <p className="text-2xl font-bold">{formatCurrency(presupuestoTotal)}</p>
              </div>
              <DollarSign className="w-8 h-8 text-success" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Gastado</p>
                <p className="text-2xl font-bold">{formatCurrency(gastadoTotal)}</p>
              </div>
              <TrendingUp className="w-8 h-8 text-warning-muted-foreground" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Disponible</p>
                <p className="text-2xl font-bold">{formatCurrency(presupuestoTotal - gastadoTotal)}</p>
              </div>
              <Calendar className="w-8 h-8 text-purple-500" />
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
              <p className="text-muted-foreground">Cargando proyectos...</p>
            </div>
          ) : filteredProyectos.length === 0 ? (
            <div className="text-center py-12">
              <FolderKanban className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">No hay proyectos</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Código</TableHead>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Presupuesto</TableHead>
                  <TableHead>Progreso</TableHead>
                  <TableHead>Órdenes</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredProyectos.map((proyecto) => (
                  <TableRow key={proyecto.id}>
                    <TableCell>{proyecto.codigo}</TableCell>
                    <TableCell>
                      <div>
                        <p className="font-medium">{proyecto.nombre}</p>
                        {proyecto.descripcion && (
                          <p className="text-xs text-muted-foreground truncate max-w-[200px]">
                            {proyecto.descripcion}
                          </p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={estadoColors[proyecto.estado] as any}>
                        {estadoLabels[proyecto.estado] || proyecto.estado}
                      </Badge>
                    </TableCell>
                    <TableCell>{formatCurrency(proyecto.presupuesto)}</TableCell>
                    <TableCell>
                      <div className="w-24">
                        <Progress value={getProgressPercent(proyecto)} className="h-2" />
                        <p className="text-xs text-muted-foreground mt-1">
                          {getProgressPercentformatNumber(proyecto, 0)}%
                        </p>
                      </div>
                    </TableCell>
                    <TableCell>{proyecto._count.purchaseOrders}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button variant="ghost" size="sm" onClick={() => handleOpenModal(proyecto)}>
                          <Edit className="w-4 h-4" />
                        </Button>
                        {proyecto.estado === 'activo' && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-destructive"
                            onClick={() => handleDelete(proyecto)}
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
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingProyecto ? 'Editar Proyecto' : 'Nuevo Proyecto'}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Código *</Label>
                <Input
                  value={formData.codigo}
                  onChange={(e) => setFormData({ ...formData, codigo: e.target.value })}
                  placeholder="PROY-001"
                />
              </div>
              <div className="space-y-2">
                <Label>Estado</Label>
                <Select
                  value={formData.estado}
                  onValueChange={(v) => setFormData({ ...formData, estado: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="activo">Activo</SelectItem>
                    <SelectItem value="pausado">Pausado</SelectItem>
                    <SelectItem value="completado">Completado</SelectItem>
                    <SelectItem value="cancelado">Cancelado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Nombre *</Label>
              <Input
                value={formData.nombre}
                onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                placeholder="Nombre del proyecto"
              />
            </div>

            <div className="space-y-2">
              <Label>Descripción</Label>
              <Textarea
                value={formData.descripcion}
                onChange={(e) => setFormData({ ...formData, descripcion: e.target.value })}
                placeholder="Descripción del proyecto..."
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Fecha Inicio</Label>
                <DatePicker
                  value={formData.fechaInicio}
                  onChange={(date) => setFormData({ ...formData, fechaInicio: date })}
                  placeholder="Seleccionar fecha"
                />
              </div>
              <div className="space-y-2">
                <Label>Fecha Fin</Label>
                <DatePicker
                  value={formData.fechaFin}
                  onChange={(date) => setFormData({ ...formData, fechaFin: date })}
                  placeholder="Seleccionar fecha"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Presupuesto</Label>
              <Input
                type="number"
                value={formData.presupuesto}
                onChange={(e) => setFormData({ ...formData, presupuesto: e.target.value })}
                placeholder="0.00"
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
