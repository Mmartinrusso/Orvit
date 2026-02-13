'use client';

import { useEffect, useState } from 'react';
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
  FileText,
  Plus,
  Search,
  Eye,
  Check,
  X,
  ArrowDownCircle,
  ArrowUpCircle,
  Filter
} from 'lucide-react';
import { toast } from 'sonner';
import { DatePicker } from '@/components/ui/date-picker';
import { useViewMode } from '@/contexts/ViewModeContext';

interface NotaCreditoDebito {
  id: number;
  tipo: 'NOTA_CREDITO' | 'NOTA_DEBITO';
  numero: string;
  numeroSerie: string;
  fechaEmision: string;
  motivo: string;
  neto: number;
  iva21: number;
  iva105: number;
  iva27: number;
  total: number;
  estado: string;
  aplicada: boolean;
  cae?: string;
  notas?: string;
  proveedor: { id: number; name: string; cuit?: string };
  factura?: { id: number; numero_factura: string; monto_total: number };
  createdByUser?: { id: number; name: string };
  _count?: { items: number };
}

interface Proveedor {
  id: number;
  name: string;
  cuit?: string;
}

interface Factura {
  id: number;
  numero_factura: string;
  punto_venta: string;
  monto_total: number;
}

const estadoColors: Record<string, string> = {
  'PENDIENTE': 'secondary',
  'APROBADA': 'default',
  'RECHAZADA': 'destructive',
  'APLICADA': 'outline',
  'ANULADA': 'destructive'
};

export default function NotasCreditoDebitoPage() {
  // ViewMode context - determina si se puede crear T2
  const { mode: viewMode } = useViewMode();

  const [searchTerm, setSearchTerm] = useState('');
  const [filterTipo, setFilterTipo] = useState<string>('');
  const [filterEstado, setFilterEstado] = useState<string>('');
  const [notas, setNotas] = useState<NotaCreditoDebito[]>([]);
  const [proveedores, setProveedores] = useState<Proveedor[]>([]);
  const [facturas, setFacturas] = useState<Factura[]>([]);
  const [loading, setLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [selectedNota, setSelectedNota] = useState<NotaCreditoDebito | null>(null);
  const [formData, setFormData] = useState({
    tipo: 'NOTA_CREDITO',
    proveedorId: '',
    facturaId: '',
    motivo: '',
    neto: '',
    iva21: '',
    fechaEmision: new Date().toISOString().split('T')[0],
    notas: ''
  });
  const [saving, setSaving] = useState(false);

  const loadNotas = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterTipo) params.append('tipo', filterTipo);
      if (filterEstado) params.append('estado', filterEstado);

      const response = await fetch(`/api/compras/notas-credito-debito?${params}`);
      if (!response.ok) throw new Error('Error al obtener notas');
      const data = await response.json();
      setNotas(data.data || []);
    } catch (error) {
      console.error('Error:', error);
      toast.error('Error al cargar notas');
    } finally {
      setLoading(false);
    }
  };

  const loadProveedores = async () => {
    try {
      const response = await fetch('/api/compras/suppliers?limit=100');
      if (response.ok) {
        const data = await response.json();
        setProveedores(data.data || data || []);
      }
    } catch (error) {
      console.error('Error loading suppliers:', error);
    }
  };

  const loadFacturas = async (proveedorId: string) => {
    if (!proveedorId) {
      setFacturas([]);
      return;
    }
    try {
      const response = await fetch(`/api/compras/facturas?supplierId=${proveedorId}&limit=50`);
      if (response.ok) {
        const data = await response.json();
        setFacturas(data.data || data || []);
      }
    } catch (error) {
      console.error('Error loading invoices:', error);
    }
  };

  useEffect(() => {
    loadNotas();
    loadProveedores();
  }, [filterTipo, filterEstado]);

  useEffect(() => {
    if (formData.proveedorId) {
      loadFacturas(formData.proveedorId);
    }
  }, [formData.proveedorId]);

  const handleOpenModal = () => {
    setFormData({
      tipo: 'NOTA_CREDITO',
      proveedorId: '',
      facturaId: '',
      motivo: '',
      neto: '',
      iva21: '',
      fechaEmision: new Date().toISOString().split('T')[0],
      notas: ''
    });
    setFacturas([]);
    setIsModalOpen(true);
  };

  const handleViewDetail = async (nota: NotaCreditoDebito) => {
    try {
      const response = await fetch(`/api/compras/notas-credito-debito/${nota.id}`);
      if (response.ok) {
        const data = await response.json();
        setSelectedNota(data);
        setIsDetailModalOpen(true);
      }
    } catch (error) {
      toast.error('Error al cargar detalle');
    }
  };

  const handleSave = async () => {
    if (!formData.proveedorId || !formData.motivo || !formData.neto) {
      toast.error('Proveedor, motivo y monto neto son requeridos');
      return;
    }

    setSaving(true);
    try {
      const response = await fetch('/api/compras/notas-credito-debito', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          neto: parseFloat(formData.neto),
          iva21: formData.iva21 ? parseFloat(formData.iva21) : parseFloat(formData.neto) * 0.21,
          iva105: 0,
          iva27: 0,
          // DocType: T2 si está en modo Extended, T1 en caso contrario
          docType: viewMode === 'E' ? 'T2' : 'T1',
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Error al guardar');
      }

      toast.success('Nota creada exitosamente');
      setIsModalOpen(false);
      loadNotas();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setSaving(false);
    }
  };

  const handleAction = async (nota: NotaCreditoDebito, accion: string) => {
    const confirmMessages: Record<string, string> = {
      aprobar: `¿Aprobar ${nota.tipo === 'NOTA_CREDITO' ? 'NC' : 'ND'} ${nota.numero}?`,
      rechazar: `¿Rechazar ${nota.tipo === 'NOTA_CREDITO' ? 'NC' : 'ND'} ${nota.numero}?`,
      aplicar: `¿Aplicar ${nota.tipo === 'NOTA_CREDITO' ? 'NC' : 'ND'} ${nota.numero}? Esta acción es irreversible.`,
      anular: `¿Anular ${nota.tipo === 'NOTA_CREDITO' ? 'NC' : 'ND'} ${nota.numero}?`
    };

    if (!confirm(confirmMessages[accion])) return;

    try {
      const response = await fetch(`/api/compras/notas-credito-debito/${nota.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accion })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Error en la operación');
      }

      toast.success(`Nota ${accion === 'aprobar' ? 'aprobada' : accion === 'rechazar' ? 'rechazada' : accion === 'aplicar' ? 'aplicada' : 'anulada'}`);
      loadNotas();
      if (isDetailModalOpen) setIsDetailModalOpen(false);
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS'
    }).format(value);
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('es-AR');
  };

  const filteredNotas = notas.filter(n =>
    n.numero.toLowerCase().includes(searchTerm.toLowerCase()) ||
    n.proveedor.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    n.motivo.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totales = {
    creditos: notas.filter(n => n.tipo === 'NOTA_CREDITO').reduce((acc, n) => acc + n.total, 0),
    debitos: notas.filter(n => n.tipo === 'NOTA_DEBITO').reduce((acc, n) => acc + n.total, 0),
    pendientes: notas.filter(n => n.estado === 'PENDIENTE').length
  };

  return (
    <div className="m-3 rounded-2xl surface-card dashboard-surface px-6 md:px-8 py-6 space-y-6">
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold mb-2">Notas de Crédito/Débito</h1>
          <p className="text-sm md:text-base text-muted-foreground">
            Gestiona notas de crédito y débito de proveedores
          </p>
        </div>
        <Button onClick={handleOpenModal}>
          <Plus className="w-4 h-4 mr-2" />
          Nueva Nota
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Notas de Crédito</p>
                <p className="text-2xl font-bold text-green-600">{formatCurrency(totales.creditos)}</p>
              </div>
              <ArrowDownCircle className="w-8 h-8 text-green-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Notas de Débito</p>
                <p className="text-2xl font-bold text-red-600">{formatCurrency(totales.debitos)}</p>
              </div>
              <ArrowUpCircle className="w-8 h-8 text-red-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Pendientes</p>
                <p className="text-2xl font-bold">{totales.pendientes}</p>
              </div>
              <FileText className="w-8 h-8 text-orange-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filtros */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-4">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por número, proveedor o motivo..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={filterTipo} onValueChange={setFilterTipo}>
              <SelectTrigger className="w-[180px]">
                <Filter className="w-4 h-4 mr-2" />
                <SelectValue placeholder="Tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">Todos</SelectItem>
                <SelectItem value="NOTA_CREDITO">Nota de Crédito</SelectItem>
                <SelectItem value="NOTA_DEBITO">Nota de Débito</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterEstado} onValueChange={setFilterEstado}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Estado" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">Todos</SelectItem>
                <SelectItem value="PENDIENTE">Pendiente</SelectItem>
                <SelectItem value="APROBADA">Aprobada</SelectItem>
                <SelectItem value="APLICADA">Aplicada</SelectItem>
                <SelectItem value="RECHAZADA">Rechazada</SelectItem>
                <SelectItem value="ANULADA">Anulada</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Tabla */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground">Cargando...</p>
            </div>
          ) : filteredNotas.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">No hay notas registradas</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Número</TableHead>
                  <TableHead>Proveedor</TableHead>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Motivo</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredNotas.map((nota) => (
                  <TableRow key={nota.id}>
                    <TableCell>
                      <Badge variant={nota.tipo === 'NOTA_CREDITO' ? 'default' : 'destructive'}>
                        {nota.tipo === 'NOTA_CREDITO' ? 'NC' : 'ND'}
                      </Badge>
                    </TableCell>
                    <TableCell>{nota.numero}</TableCell>
                    <TableCell>
                      <div>
                        <p className="font-medium">{nota.proveedor.name}</p>
                        {nota.proveedor.cuit && (
                          <p className="text-xs text-muted-foreground">{nota.proveedor.cuit}</p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>{formatDate(nota.fechaEmision)}</TableCell>
                    <TableCell className="max-w-[200px] truncate">{nota.motivo}</TableCell>
                    <TableCell className="text-right font-medium">
                      {formatCurrency(nota.total)}
                    </TableCell>
                    <TableCell>
                      <Badge variant={estadoColors[nota.estado] as any}>
                        {nota.estado}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="sm" onClick={() => handleViewDetail(nota)}>
                          <Eye className="w-4 h-4" />
                        </Button>
                        {nota.estado === 'PENDIENTE' && (
                          <>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-green-600"
                              onClick={() => handleAction(nota, 'aprobar')}
                            >
                              <Check className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-destructive"
                              onClick={() => handleAction(nota, 'rechazar')}
                            >
                              <X className="w-4 h-4" />
                            </Button>
                          </>
                        )}
                        {nota.estado === 'APROBADA' && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-blue-600"
                            onClick={() => handleAction(nota, 'aplicar')}
                          >
                            Aplicar
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

      {/* Modal Nueva Nota */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Nueva Nota de Crédito/Débito</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Tipo *</Label>
                <Select
                  value={formData.tipo}
                  onValueChange={(v) => setFormData({ ...formData, tipo: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="NOTA_CREDITO">Nota de Crédito</SelectItem>
                    <SelectItem value="NOTA_DEBITO">Nota de Débito</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Fecha Emisión</Label>
                <DatePicker
                  value={formData.fechaEmision}
                  onChange={(date) => setFormData({ ...formData, fechaEmision: date })}
                  placeholder="Seleccionar fecha"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Proveedor *</Label>
              <Select
                value={formData.proveedorId}
                onValueChange={(v) => setFormData({ ...formData, proveedorId: v, facturaId: '' })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar proveedor" />
                </SelectTrigger>
                <SelectContent>
                  {proveedores.map((p) => (
                    <SelectItem key={p.id} value={p.id.toString()}>
                      {p.name} {p.cuit ? `(${p.cuit})` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {facturas.length > 0 && (
              <div className="space-y-2">
                <Label>Factura de Referencia (opcional)</Label>
                <Select
                  value={formData.facturaId}
                  onValueChange={(v) => setFormData({ ...formData, facturaId: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Sin referencia" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Sin referencia</SelectItem>
                    {facturas.map((f) => (
                      <SelectItem key={f.id} value={f.id.toString()}>
                        {f.punto_venta}-{f.numero_factura} ({formatCurrency(f.monto_total)})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-2">
              <Label>Motivo *</Label>
              <Textarea
                value={formData.motivo}
                onChange={(e) => setFormData({ ...formData, motivo: e.target.value })}
                placeholder="Motivo de la nota..."
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Monto Neto *</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={formData.neto}
                  onChange={(e) => setFormData({ ...formData, neto: e.target.value })}
                  placeholder="0.00"
                />
              </div>
              <div className="space-y-2">
                <Label>IVA 21%</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={formData.iva21}
                  onChange={(e) => setFormData({ ...formData, iva21: e.target.value })}
                  placeholder={formData.neto ? (parseFloat(formData.neto) * 0.21).toFixed(2) : '0.00'}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Notas Adicionales</Label>
              <Textarea
                value={formData.notas}
                onChange={(e) => setFormData({ ...formData, notas: e.target.value })}
                placeholder="Notas adicionales..."
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsModalOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? 'Guardando...' : 'Crear Nota'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Detalle */}
      <Dialog open={isDetailModalOpen} onOpenChange={setIsDetailModalOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {selectedNota?.tipo === 'NOTA_CREDITO' ? 'Nota de Crédito' : 'Nota de Débito'} {selectedNota?.numero}
            </DialogTitle>
          </DialogHeader>

          {selectedNota && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Proveedor</p>
                  <p className="font-medium">{selectedNota.proveedor.name}</p>
                  {selectedNota.proveedor.cuit && (
                    <p className="text-sm text-muted-foreground">{selectedNota.proveedor.cuit}</p>
                  )}
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Fecha Emisión</p>
                  <p className="font-medium">{formatDate(selectedNota.fechaEmision)}</p>
                </div>
              </div>

              {selectedNota.factura && (
                <div>
                  <p className="text-sm text-muted-foreground">Factura de Referencia</p>
                  <p className="font-medium">
                    {selectedNota.factura.numero_factura} - {formatCurrency(selectedNota.factura.monto_total)}
                  </p>
                </div>
              )}

              <div>
                <p className="text-sm text-muted-foreground">Motivo</p>
                <p>{selectedNota.motivo}</p>
              </div>

              <div className="grid grid-cols-4 gap-4 bg-muted/50 p-4 rounded-lg">
                <div>
                  <p className="text-sm text-muted-foreground">Neto</p>
                  <p className="font-medium">{formatCurrency(selectedNota.neto)}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">IVA 21%</p>
                  <p className="font-medium">{formatCurrency(selectedNota.iva21)}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">IVA 10.5%</p>
                  <p className="font-medium">{formatCurrency(selectedNota.iva105)}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total</p>
                  <p className="text-xl font-bold">{formatCurrency(selectedNota.total)}</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <p className="text-sm text-muted-foreground">Estado:</p>
                <Badge variant={estadoColors[selectedNota.estado] as any}>
                  {selectedNota.estado}
                </Badge>
                {selectedNota.aplicada && (
                  <Badge variant="outline">Aplicada</Badge>
                )}
              </div>

              {selectedNota.cae && (
                <div>
                  <p className="text-sm text-muted-foreground">CAE</p>
                  <p>{selectedNota.cae}</p>
                </div>
              )}

              {selectedNota.notas && (
                <div>
                  <p className="text-sm text-muted-foreground">Notas</p>
                  <p className="text-sm whitespace-pre-wrap">{selectedNota.notas}</p>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            {selectedNota?.estado === 'PENDIENTE' && (
              <>
                <Button
                  variant="destructive"
                  onClick={() => handleAction(selectedNota, 'rechazar')}
                >
                  Rechazar
                </Button>
                <Button onClick={() => handleAction(selectedNota, 'aprobar')}>
                  Aprobar
                </Button>
              </>
            )}
            {selectedNota?.estado === 'APROBADA' && (
              <Button onClick={() => handleAction(selectedNota, 'aplicar')}>
                Aplicar Nota
              </Button>
            )}
            <Button variant="outline" onClick={() => setIsDetailModalOpen(false)}>
              Cerrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
