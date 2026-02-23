'use client';

import { useState, useEffect } from 'react';
import { formatDate } from '@/lib/date-utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
 Sheet,
 SheetContent,
 SheetHeader,
 SheetTitle,
 SheetFooter,
} from '@/components/ui/sheet';
import {
 Dialog,
 DialogContent,
 DialogHeader,
 DialogTitle,
 DialogDescription,
 DialogBody,
 DialogFooter,
} from '@/components/ui/dialog';
import {
 Table,
 TableBody,
 TableCell,
 TableHead,
 TableHeader,
 TableRow,
} from '@/components/ui/table';
import {
 Card,
 CardContent,
 CardHeader,
 CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
 Select,
 SelectContent,
 SelectItem,
 SelectTrigger,
 SelectValue,
} from '@/components/ui/select';
import {
 Tabs,
 TabsContent,
 TabsList,
 TabsTrigger,
} from '@/components/ui/tabs';
import { toast } from 'sonner';
import { cn, formatCurrency } from '@/lib/utils';
import {
 Plus,
 Search,
 Loader2,
 FileText,
 Shield,
 Wrench,
 CalendarClock,
 AlertTriangle,
 DollarSign,
 Building2,
 Cog,
 Calendar,
 Eye,
 Edit,
 Trash2,
 Clock,
 CheckCircle2,
 XCircle,
 RefreshCw,
} from 'lucide-react';

interface ServiceContract {
 id: number;
 numero: string;
 nombre: string;
 descripcion: string | null;
 tipo: string;
 estado: string;
 proveedorId: number;
 fechaInicio: string;
 fechaFin: string | null;
 diasAviso: number;
 renovacionAuto: boolean;
 montoTotal: number | null;
 frecuenciaPago: string;
 montoPeriodo: number | null;
 moneda: string;
 machineId: number | null;
 polizaNumero: string | null;
 aseguradora: string | null;
 cobertura: string | null;
 sumaAsegurada: number | null;
 deducible: number | null;
 franquicia: number | null;
 contactoNombre: string | null;
 contactoTelefono: string | null;
 contactoEmail: string | null;
 documentos: any | null;
 notas: string | null;
 proveedor: { id: number; name: string; cuit: string | null };
 machine?: { id: number; name: string; nickname: string | null } | null;
 createdBy: { id: number; name: string };
 _count: { pagos: number; alertas: number };
}

interface Proveedor {
 id: number;
 name: string;
 cuit: string | null;
}

interface Machine {
 id: number;
 name: string;
 nickname: string | null;
}

const TIPOS = [
 { value: 'SEGURO_MAQUINARIA', label: 'Seguro de Maquinaria', icon: Shield },
 { value: 'SEGURO_VEHICULO', label: 'Seguro de Vehículo', icon: Shield },
 { value: 'SEGURO_INSTALACIONES', label: 'Seguro de Instalaciones', icon: Shield },
 { value: 'SEGURO_RESPONSABILIDAD', label: 'Seguro RC', icon: Shield },
 { value: 'SERVICIO_TECNICO', label: 'Servicio Técnico', icon: Wrench },
 { value: 'MANTENIMIENTO_PREVENTIVO', label: 'Mant. Preventivo', icon: Cog },
 { value: 'CALIBRACION', label: 'Calibración', icon: Cog },
 { value: 'CERTIFICACION', label: 'Certificación', icon: FileText },
 { value: 'ALQUILER_EQUIPO', label: 'Alquiler de Equipo', icon: Building2 },
 { value: 'LICENCIA_SOFTWARE', label: 'Licencia Software', icon: FileText },
 { value: 'CONSULTORIA', label: 'Consultoría', icon: FileText },
 { value: 'VIGILANCIA', label: 'Vigilancia', icon: Shield },
 { value: 'LIMPIEZA', label: 'Limpieza', icon: Building2 },
 { value: 'TRANSPORTE', label: 'Transporte', icon: Building2 },
 { value: 'OTRO', label: 'Otro', icon: FileText },
];

const FRECUENCIAS = [
 { value: 'UNICO', label: 'Pago Único' },
 { value: 'MENSUAL', label: 'Mensual' },
 { value: 'BIMESTRAL', label: 'Bimestral' },
 { value: 'TRIMESTRAL', label: 'Trimestral' },
 { value: 'CUATRIMESTRAL', label: 'Cuatrimestral' },
 { value: 'SEMESTRAL', label: 'Semestral' },
 { value: 'ANUAL', label: 'Anual' },
];

const ESTADOS = [
 { value: 'ACTIVO', label: 'Activo', color: 'bg-success-muted text-success-muted-foreground' },
 { value: 'POR_VENCER', label: 'Por Vencer', color: 'bg-warning-muted text-warning-muted-foreground' },
 { value: 'VENCIDO', label: 'Vencido', color: 'bg-destructive/10 text-destructive' },
 { value: 'SUSPENDIDO', label: 'Suspendido', color: 'bg-muted text-foreground' },
 { value: 'CANCELADO', label: 'Cancelado', color: 'bg-muted text-foreground' },
 { value: 'BORRADOR', label: 'Borrador', color: 'bg-info-muted text-info-muted-foreground' },
];

const getEstadoBadge = (estado: string) => {
 const found = ESTADOS.find((e) => e.value === estado);
 return found || { label: estado, color: 'bg-muted text-foreground' };
};

const getTipoInfo = (tipo: string) => {
 return TIPOS.find((t) => t.value === tipo) || { label: tipo, icon: FileText };
};

export function ServiciosManager() {
 const [contracts, setContracts] = useState<ServiceContract[]>([]);
 const [loading, setLoading] = useState(true);
 const [search, setSearch] = useState('');
 const [filterTipo, setFilterTipo] = useState<string>('all');
 const [filterEstado, setFilterEstado] = useState<string>('all');
 const [sheetOpen, setSheetOpen] = useState(false);
 const [detailSheet, setDetailSheet] = useState(false);
 const [selectedContract, setSelectedContract] = useState<ServiceContract | null>(null);
 const [deleteModalOpen, setDeleteModalOpen] = useState(false);
 const [submitting, setSubmitting] = useState(false);
 const [kpis, setKpis] = useState({
 byEstado: [] as any[],
 porVencer: 0,
 gastoMensualEstimado: 0,
 });

 // Data for selects
 const [proveedores, setProveedores] = useState<Proveedor[]>([]);
 const [machines, setMachines] = useState<Machine[]>([]);

 // Form state
 const [formData, setFormData] = useState({
 numero: '',
 nombre: '',
 descripcion: '',
 tipo: 'SERVICIO_TECNICO',
 proveedorId: '',
 fechaInicio: '',
 fechaFin: '',
 diasAviso: 30,
 renovacionAuto: false,
 montoTotal: '',
 frecuenciaPago: 'MENSUAL',
 montoPeriodo: '',
 moneda: 'ARS',
 machineId: '',
 polizaNumero: '',
 aseguradora: '',
 cobertura: '',
 sumaAsegurada: '',
 deducible: '',
 franquicia: '',
 contactoNombre: '',
 contactoTelefono: '',
 contactoEmail: '',
 notas: '',
 });

 useEffect(() => {
 fetchContracts();
 fetchProveedores();
 fetchMachines();
 }, [filterTipo, filterEstado]);

 const fetchContracts = async () => {
 try {
 let url = '/api/compras/servicios?';
 if (filterTipo !== 'all') url += `tipo=${filterTipo}&`;
 if (filterEstado !== 'all') url += `estado=${filterEstado}&`;
 if (search) url += `search=${encodeURIComponent(search)}&`;

 const res = await fetch(url);
 if (res.ok) {
 const data = await res.json();
 setContracts(data.contracts || []);
 setKpis(data.kpis || { byEstado: [], porVencer: 0, gastoMensualEstimado: 0 });
 }
 } catch (error) {
 toast.error('Error al cargar contratos');
 } finally {
 setLoading(false);
 }
 };

 const fetchProveedores = async () => {
 try {
 const res = await fetch('/api/compras/proveedores?limit=500');
 if (res.ok) {
 const data = await res.json();
 setProveedores(data.proveedores || []);
 }
 } catch (error) {
 console.error('Error fetching proveedores:', error);
 }
 };

 const fetchMachines = async () => {
 try {
 const res = await fetch('/api/machines?limit=500');
 if (res.ok) {
 const data = await res.json();
 setMachines(data.machines || []);
 }
 } catch (error) {
 console.error('Error fetching machines:', error);
 }
 };

 const handleSubmit = async () => {
 if (!formData.numero.trim()) {
 toast.error('El número de contrato es requerido');
 return;
 }
 if (!formData.nombre.trim()) {
 toast.error('El nombre es requerido');
 return;
 }
 if (!formData.proveedorId) {
 toast.error('El proveedor es requerido');
 return;
 }
 if (!formData.fechaInicio) {
 toast.error('La fecha de inicio es requerida');
 return;
 }

 setSubmitting(true);
 try {
 const payload = {
 ...formData,
 proveedorId: parseInt(formData.proveedorId),
 machineId: formData.machineId ? parseInt(formData.machineId) : null,
 montoTotal: formData.montoTotal ? parseFloat(formData.montoTotal) : null,
 montoPeriodo: formData.montoPeriodo ? parseFloat(formData.montoPeriodo) : null,
 sumaAsegurada: formData.sumaAsegurada ? parseFloat(formData.sumaAsegurada) : null,
 deducible: formData.deducible ? parseFloat(formData.deducible) : null,
 franquicia: formData.franquicia ? parseFloat(formData.franquicia) : null,
 };

 const url = selectedContract
 ? `/api/compras/servicios/${selectedContract.id}`
 : '/api/compras/servicios';
 const method = selectedContract ? 'PATCH' : 'POST';

 const res = await fetch(url, {
 method,
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify(payload),
 });

 const data = await res.json();

 if (!res.ok) {
 throw new Error(data.error || 'Error al guardar');
 }

 toast.success(selectedContract ? 'Contrato actualizado' : 'Contrato creado');
 setSheetOpen(false);
 resetForm();
 fetchContracts();
 } catch (error: any) {
 toast.error(error.message || 'Error al guardar contrato');
 } finally {
 setSubmitting(false);
 }
 };

 const handleDelete = async () => {
 if (!selectedContract) return;

 setSubmitting(true);
 try {
 const res = await fetch(`/api/compras/servicios/${selectedContract.id}`, {
 method: 'DELETE',
 });

 const data = await res.json();

 if (!res.ok) {
 throw new Error(data.error || 'Error al eliminar');
 }

 toast.success(data.message || 'Contrato eliminado');
 setDeleteModalOpen(false);
 setSelectedContract(null);
 fetchContracts();
 } catch (error: any) {
 toast.error(error.message || 'Error al eliminar contrato');
 } finally {
 setSubmitting(false);
 }
 };

 const resetForm = () => {
 setFormData({
 numero: '',
 nombre: '',
 descripcion: '',
 tipo: 'SERVICIO_TECNICO',
 proveedorId: '',
 fechaInicio: '',
 fechaFin: '',
 diasAviso: 30,
 renovacionAuto: false,
 montoTotal: '',
 frecuenciaPago: 'MENSUAL',
 montoPeriodo: '',
 moneda: 'ARS',
 machineId: '',
 polizaNumero: '',
 aseguradora: '',
 cobertura: '',
 sumaAsegurada: '',
 deducible: '',
 franquicia: '',
 contactoNombre: '',
 contactoTelefono: '',
 contactoEmail: '',
 notas: '',
 });
 setSelectedContract(null);
 };

 const openEditSheet = (contract: ServiceContract) => {
 setSelectedContract(contract);
 setFormData({
 numero: contract.numero,
 nombre: contract.nombre,
 descripcion: contract.descripcion || '',
 tipo: contract.tipo,
 proveedorId: contract.proveedorId.toString(),
 fechaInicio: contract.fechaInicio.split('T')[0],
 fechaFin: contract.fechaFin?.split('T')[0] || '',
 diasAviso: contract.diasAviso,
 renovacionAuto: contract.renovacionAuto,
 montoTotal: contract.montoTotal?.toString() || '',
 frecuenciaPago: contract.frecuenciaPago,
 montoPeriodo: contract.montoPeriodo?.toString() || '',
 moneda: contract.moneda,
 machineId: contract.machineId?.toString() || '',
 polizaNumero: contract.polizaNumero || '',
 aseguradora: contract.aseguradora || '',
 cobertura: contract.cobertura || '',
 sumaAsegurada: contract.sumaAsegurada?.toString() || '',
 deducible: contract.deducible?.toString() || '',
 franquicia: contract.franquicia?.toString() || '',
 contactoNombre: contract.contactoNombre || '',
 contactoTelefono: contract.contactoTelefono || '',
 contactoEmail: contract.contactoEmail || '',
 notas: contract.notas || '',
 });
 setSheetOpen(true);
 };

 const isSeguro = formData.tipo.startsWith('SEGURO');

 const diasParaVencer = (fechaFin: string | null) => {
 if (!fechaFin) return null;
 return Math.ceil((new Date(fechaFin).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
 };

 if (loading) {
 return (
 <div className="flex items-center justify-center h-48">
 <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
 </div>
 );
 }

 return (
 <div className="space-y-4">
 {/* KPIs */}
 <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
 <Card>
 <CardContent className="pt-4">
 <div className="flex items-center gap-3">
 <div className="p-2 bg-success-muted rounded-lg">
 <CheckCircle2 className="h-5 w-5 text-success" />
 </div>
 <div>
 <p className="text-sm text-muted-foreground">Contratos Activos</p>
 <p className="text-2xl font-bold">
 {kpis.byEstado.find((e: any) => e.estado === 'ACTIVO')?._count || 0}
 </p>
 </div>
 </div>
 </CardContent>
 </Card>

 <Card>
 <CardContent className="pt-4">
 <div className="flex items-center gap-3">
 <div className="p-2 bg-warning-muted rounded-lg">
 <AlertTriangle className="h-5 w-5 text-warning-muted-foreground" />
 </div>
 <div>
 <p className="text-sm text-muted-foreground">Por Vencer (30 días)</p>
 <p className="text-2xl font-bold">{kpis.porVencer}</p>
 </div>
 </div>
 </CardContent>
 </Card>

 <Card>
 <CardContent className="pt-4">
 <div className="flex items-center gap-3">
 <div className="p-2 bg-destructive/10 rounded-lg">
 <XCircle className="h-5 w-5 text-destructive" />
 </div>
 <div>
 <p className="text-sm text-muted-foreground">Vencidos</p>
 <p className="text-2xl font-bold">
 {kpis.byEstado.find((e: any) => e.estado === 'VENCIDO')?._count || 0}
 </p>
 </div>
 </div>
 </CardContent>
 </Card>

 <Card>
 <CardContent className="pt-4">
 <div className="flex items-center gap-3">
 <div className="p-2 bg-info-muted rounded-lg">
 <DollarSign className="h-5 w-5 text-info-muted-foreground" />
 </div>
 <div>
 <p className="text-sm text-muted-foreground">Gasto Mensual Est.</p>
 <p className="text-2xl font-bold">
 {formatCurrency(kpis.gastoMensualEstimado)}
 </p>
 </div>
 </div>
 </CardContent>
 </Card>
 </div>

 {/* Filters */}
 <div className="flex flex-wrap items-center gap-4">
 <div className="relative flex-1 min-w-[200px] max-w-[300px]">
 <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
 <Input
 placeholder="Buscar contrato..."
 value={search}
 onChange={(e) => setSearch(e.target.value)}
 onKeyDown={(e) => e.key === 'Enter' && fetchContracts()}
 className="pl-9"
 />
 </div>

 <Select value={filterTipo} onValueChange={setFilterTipo}>
 <SelectTrigger className="w-[180px]">
 <SelectValue placeholder="Todos los tipos" />
 </SelectTrigger>
 <SelectContent>
 <SelectItem value="all">Todos los tipos</SelectItem>
 {TIPOS.map((t) => (
 <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
 ))}
 </SelectContent>
 </Select>

 <Select value={filterEstado} onValueChange={setFilterEstado}>
 <SelectTrigger className="w-[150px]">
 <SelectValue placeholder="Todos los estados" />
 </SelectTrigger>
 <SelectContent>
 <SelectItem value="all">Todos los estados</SelectItem>
 {ESTADOS.map((e) => (
 <SelectItem key={e.value} value={e.value}>{e.label}</SelectItem>
 ))}
 </SelectContent>
 </Select>

 <Button className="ml-auto" onClick={() => { resetForm(); setSheetOpen(true); }}>
 <Plus className="h-4 w-4 mr-2" />
 Nuevo Contrato
 </Button>
 </div>

 {/* Table */}
 <div className="border rounded-lg">
 <Table>
 <TableHeader>
 <TableRow>
 <TableHead className="w-[200px]">Contrato</TableHead>
 <TableHead>Proveedor</TableHead>
 <TableHead className="text-center">Tipo</TableHead>
 <TableHead className="text-center">Estado</TableHead>
 <TableHead className="text-right">Monto</TableHead>
 <TableHead className="text-center">Vencimiento</TableHead>
 <TableHead className="text-right">Acciones</TableHead>
 </TableRow>
 </TableHeader>
 <TableBody>
 {contracts.length === 0 ? (
 <TableRow>
 <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
 No hay contratos de servicios
 </TableCell>
 </TableRow>
 ) : (
 contracts.map((contract) => {
 const tipoInfo = getTipoInfo(contract.tipo);
 const estadoBadge = getEstadoBadge(contract.estado);
 const Icon = tipoInfo.icon;
 const dias = diasParaVencer(contract.fechaFin);

 return (
 <TableRow key={contract.id}>
 <TableCell>
 <div>
 <p className="font-medium">{contract.nombre}</p>
 <p className="text-sm text-muted-foreground">#{contract.numero}</p>
 </div>
 </TableCell>
 <TableCell>
 <div>
 <p>{contract.proveedor.name}</p>
 {contract.machine && (
 <p className="text-sm text-muted-foreground">
 Máq: {contract.machine.name}
 </p>
 )}
 </div>
 </TableCell>
 <TableCell className="text-center">
 <div className="flex items-center justify-center gap-1">
 <Icon className="h-4 w-4 text-muted-foreground" />
 <span className="text-sm">{tipoInfo.label}</span>
 </div>
 </TableCell>
 <TableCell className="text-center">
 <Badge className={estadoBadge.color}>
 {estadoBadge.label}
 </Badge>
 </TableCell>
 <TableCell className="text-right">
 {contract.montoPeriodo ? (
 <div>
 <p>{formatCurrency(Number(contract.montoPeriodo))}</p>
 <p className="text-xs text-muted-foreground">
 /{FRECUENCIAS.find((f) => f.value === contract.frecuenciaPago)?.label || contract.frecuenciaPago}
 </p>
 </div>
 ) : '-'}
 </TableCell>
 <TableCell className="text-center">
 {contract.fechaFin ? (
 <div>
 <p>{formatDate(contract.fechaFin)}</p>
 {dias !== null && (
 <p className={cn('text-xs', dias <= 30 ? 'text-destructive' : 'text-muted-foreground')}>
 {dias > 0 ? `${dias} días` : 'Vencido'}
 </p>
 )}
 </div>
 ) : (
 <span className="text-muted-foreground">Sin vencimiento</span>
 )}
 </TableCell>
 <TableCell className="text-right">
 <div className="flex items-center justify-end gap-1">
 <Button
 variant="ghost"
 size="icon"
 onClick={() => { setSelectedContract(contract); setDetailSheet(true); }}
 aria-label="Ver detalle"
 >
 <Eye className="h-4 w-4" />
 </Button>
 <Button
 variant="ghost"
 size="icon"
 onClick={() => openEditSheet(contract)}
 aria-label="Editar"
 >
 <Edit className="h-4 w-4" />
 </Button>
 <Button
 variant="ghost"
 size="icon"
 className="text-destructive"
 onClick={() => { setSelectedContract(contract); setDeleteModalOpen(true); }}
 aria-label="Eliminar"
 >
 <Trash2 className="h-4 w-4" />
 </Button>
 </div>
 </TableCell>
 </TableRow>
 );
 })
 )}
 </TableBody>
 </Table>
 </div>

 {/* Create/Edit Sheet */}
 <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
 <SheetContent size="md" className="overflow-y-auto">
 <SheetHeader>
 <SheetTitle>
 {selectedContract ? 'Editar Contrato' : 'Nuevo Contrato de Servicio'}
 </SheetTitle>
 </SheetHeader>

 <Tabs defaultValue="general" className="mt-4">
 <TabsList className="w-full justify-start overflow-x-auto">
 <TabsTrigger value="general">General</TabsTrigger>
 <TabsTrigger value="costos">Costos</TabsTrigger>
 {isSeguro && <TabsTrigger value="seguro">Seguro</TabsTrigger>}
 </TabsList>

 <TabsContent value="general" className="space-y-4">
 <div className="grid grid-cols-2 gap-4">
 <div className="space-y-2">
 <Label>Número *</Label>
 <Input
 value={formData.numero}
 onChange={(e) => setFormData({ ...formData, numero: e.target.value })}
 placeholder="POL-001"
 />
 </div>
 <div className="space-y-2">
 <Label>Tipo *</Label>
 <Select value={formData.tipo} onValueChange={(v) => setFormData({ ...formData, tipo: v })}>
 <SelectTrigger>
 <SelectValue />
 </SelectTrigger>
 <SelectContent>
 {TIPOS.map((t) => (
 <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
 ))}
 </SelectContent>
 </Select>
 </div>
 </div>

 <div className="space-y-2">
 <Label>Nombre *</Label>
 <Input
 value={formData.nombre}
 onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
 placeholder="Seguro contra incendio - Caldera"
 />
 </div>

 <div className="space-y-2">
 <Label>Descripción</Label>
 <Textarea
 value={formData.descripcion}
 onChange={(e) => setFormData({ ...formData, descripcion: e.target.value })}
 placeholder="Detalles del contrato..."
 />
 </div>

 <div className="space-y-2">
 <Label>Proveedor *</Label>
 <Select value={formData.proveedorId} onValueChange={(v) => setFormData({ ...formData, proveedorId: v })}>
 <SelectTrigger>
 <SelectValue placeholder="Seleccionar proveedor" />
 </SelectTrigger>
 <SelectContent>
 {proveedores.map((p) => (
 <SelectItem key={p.id} value={p.id.toString()}>
 {p.name} {p.cuit && `(${p.cuit})`}
 </SelectItem>
 ))}
 </SelectContent>
 </Select>
 </div>

 <div className="space-y-2">
 <Label>Máquina/Equipo (opcional)</Label>
 <Select value={formData.machineId} onValueChange={(v) => setFormData({ ...formData, machineId: v })}>
 <SelectTrigger>
 <SelectValue placeholder="Sin máquina asociada" />
 </SelectTrigger>
 <SelectContent>
 <SelectItem value="">Sin máquina</SelectItem>
 {machines.map((m) => (
 <SelectItem key={m.id} value={m.id.toString()}>
 {m.name} {m.nickname && `(${m.nickname})`}
 </SelectItem>
 ))}
 </SelectContent>
 </Select>
 </div>

 <div className="grid grid-cols-2 gap-4">
 <div className="space-y-2">
 <Label>Fecha Inicio *</Label>
 <Input
 type="date"
 value={formData.fechaInicio}
 onChange={(e) => setFormData({ ...formData, fechaInicio: e.target.value })}
 />
 </div>
 <div className="space-y-2">
 <Label>Fecha Fin</Label>
 <Input
 type="date"
 value={formData.fechaFin}
 onChange={(e) => setFormData({ ...formData, fechaFin: e.target.value })}
 />
 </div>
 </div>

 <div className="grid grid-cols-2 gap-4">
 <div className="space-y-2">
 <Label>Días Aviso Vencimiento</Label>
 <Input
 type="number"
 value={formData.diasAviso}
 onChange={(e) => setFormData({ ...formData, diasAviso: parseInt(e.target.value) || 30 })}
 />
 </div>
 <div className="space-y-2 flex items-end">
 <label className="flex items-center gap-2 cursor-pointer">
 <input
 type="checkbox"
 checked={formData.renovacionAuto}
 onChange={(e) => setFormData({ ...formData, renovacionAuto: e.target.checked })}
 className="rounded"
 />
 <span>Renovación Automática</span>
 </label>
 </div>
 </div>

 <div className="space-y-2">
 <Label>Notas</Label>
 <Textarea
 value={formData.notas}
 onChange={(e) => setFormData({ ...formData, notas: e.target.value })}
 placeholder="Notas internas..."
 />
 </div>
 </TabsContent>

 <TabsContent value="costos" className="space-y-4">
 <div className="grid grid-cols-2 gap-4">
 <div className="space-y-2">
 <Label>Frecuencia de Pago</Label>
 <Select value={formData.frecuenciaPago} onValueChange={(v) => setFormData({ ...formData, frecuenciaPago: v })}>
 <SelectTrigger>
 <SelectValue />
 </SelectTrigger>
 <SelectContent>
 {FRECUENCIAS.map((f) => (
 <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
 ))}
 </SelectContent>
 </Select>
 </div>
 <div className="space-y-2">
 <Label>Moneda</Label>
 <Select value={formData.moneda} onValueChange={(v) => setFormData({ ...formData, moneda: v })}>
 <SelectTrigger>
 <SelectValue />
 </SelectTrigger>
 <SelectContent>
 <SelectItem value="ARS">ARS</SelectItem>
 <SelectItem value="USD">USD</SelectItem>
 <SelectItem value="EUR">EUR</SelectItem>
 </SelectContent>
 </Select>
 </div>
 </div>

 <div className="grid grid-cols-2 gap-4">
 <div className="space-y-2">
 <Label>Monto por Período</Label>
 <Input
 type="number"
 step="0.01"
 value={formData.montoPeriodo}
 onChange={(e) => setFormData({ ...formData, montoPeriodo: e.target.value })}
 placeholder="0.00"
 />
 </div>
 <div className="space-y-2">
 <Label>Monto Total</Label>
 <Input
 type="number"
 step="0.01"
 value={formData.montoTotal}
 onChange={(e) => setFormData({ ...formData, montoTotal: e.target.value })}
 placeholder="0.00"
 />
 </div>
 </div>

 <div className="p-4 bg-muted rounded-lg">
 <h4 className="font-medium mb-2">Contacto del Proveedor</h4>
 <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
 <div className="space-y-2">
 <Label>Nombre</Label>
 <Input
 value={formData.contactoNombre}
 onChange={(e) => setFormData({ ...formData, contactoNombre: e.target.value })}
 />
 </div>
 <div className="space-y-2">
 <Label>Teléfono</Label>
 <Input
 value={formData.contactoTelefono}
 onChange={(e) => setFormData({ ...formData, contactoTelefono: e.target.value })}
 />
 </div>
 <div className="space-y-2">
 <Label>Email</Label>
 <Input
 type="email"
 value={formData.contactoEmail}
 onChange={(e) => setFormData({ ...formData, contactoEmail: e.target.value })}
 />
 </div>
 </div>
 </div>
 </TabsContent>

 {isSeguro && (
 <TabsContent value="seguro" className="space-y-4">
 <div className="grid grid-cols-2 gap-4">
 <div className="space-y-2">
 <Label>Número de Póliza</Label>
 <Input
 value={formData.polizaNumero}
 onChange={(e) => setFormData({ ...formData, polizaNumero: e.target.value })}
 />
 </div>
 <div className="space-y-2">
 <Label>Aseguradora</Label>
 <Input
 value={formData.aseguradora}
 onChange={(e) => setFormData({ ...formData, aseguradora: e.target.value })}
 />
 </div>
 </div>

 <div className="space-y-2">
 <Label>Cobertura</Label>
 <Textarea
 value={formData.cobertura}
 onChange={(e) => setFormData({ ...formData, cobertura: e.target.value })}
 placeholder="Detalle de la cobertura..."
 />
 </div>

 <div className="grid grid-cols-3 gap-4">
 <div className="space-y-2">
 <Label>Suma Asegurada</Label>
 <Input
 type="number"
 step="0.01"
 value={formData.sumaAsegurada}
 onChange={(e) => setFormData({ ...formData, sumaAsegurada: e.target.value })}
 />
 </div>
 <div className="space-y-2">
 <Label>Deducible</Label>
 <Input
 type="number"
 step="0.01"
 value={formData.deducible}
 onChange={(e) => setFormData({ ...formData, deducible: e.target.value })}
 />
 </div>
 <div className="space-y-2">
 <Label>Franquicia</Label>
 <Input
 type="number"
 step="0.01"
 value={formData.franquicia}
 onChange={(e) => setFormData({ ...formData, franquicia: e.target.value })}
 />
 </div>
 </div>
 </TabsContent>
 )}
 </Tabs>

 <SheetFooter className="mt-6">
 <Button variant="outline" onClick={() => setSheetOpen(false)}>
 Cancelar
 </Button>
 <Button onClick={handleSubmit} disabled={submitting}>
 {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
 {selectedContract ? 'Guardar' : 'Crear Contrato'}
 </Button>
 </SheetFooter>
 </SheetContent>
 </Sheet>

 {/* Detail Sheet */}
 <Sheet open={detailSheet} onOpenChange={setDetailSheet}>
 <SheetContent size="md">
 <SheetHeader>
 <SheetTitle>{selectedContract?.nombre}</SheetTitle>
 </SheetHeader>

 {selectedContract && (
 <div className="mt-4 space-y-4">
 <div className="grid grid-cols-2 gap-4">
 <div>
 <p className="text-sm text-muted-foreground">Número</p>
 <p className="font-medium">#{selectedContract.numero}</p>
 </div>
 <div>
 <p className="text-sm text-muted-foreground">Estado</p>
 <Badge className={getEstadoBadge(selectedContract.estado).color}>
 {getEstadoBadge(selectedContract.estado).label}
 </Badge>
 </div>
 </div>

 <div>
 <p className="text-sm text-muted-foreground">Proveedor</p>
 <p className="font-medium">{selectedContract.proveedor.name}</p>
 </div>

 {selectedContract.machine && (
 <div>
 <p className="text-sm text-muted-foreground">Máquina</p>
 <p className="font-medium">{selectedContract.machine.name}</p>
 </div>
 )}

 <div className="grid grid-cols-2 gap-4">
 <div>
 <p className="text-sm text-muted-foreground">Fecha Inicio</p>
 <p>{formatDate(selectedContract.fechaInicio)}</p>
 </div>
 <div>
 <p className="text-sm text-muted-foreground">Fecha Fin</p>
 <p>
 {selectedContract.fechaFin
 ? formatDate(selectedContract.fechaFin)
 : 'Sin vencimiento'}
 </p>
 </div>
 </div>

 {selectedContract.montoPeriodo && (
 <div className="p-4 bg-muted rounded-lg">
 <div className="flex items-center justify-between">
 <div>
 <p className="text-sm text-muted-foreground">Monto por período</p>
 <p className="text-xl font-bold">
 {formatCurrency(Number(selectedContract.montoPeriodo))}
 </p>
 </div>
 <div className="text-right">
 <p className="text-sm text-muted-foreground">Frecuencia</p>
 <p>
 {FRECUENCIAS.find((f) => f.value === selectedContract.frecuenciaPago)?.label}
 </p>
 </div>
 </div>
 </div>
 )}

 {selectedContract.polizaNumero && (
 <div className="p-4 border rounded-lg">
 <h4 className="font-medium mb-2 flex items-center gap-2">
 <Shield className="h-4 w-4" />
 Datos del Seguro
 </h4>
 <div className="grid grid-cols-2 gap-4 text-sm">
 <div>
 <p className="text-muted-foreground">Póliza</p>
 <p>{selectedContract.polizaNumero}</p>
 </div>
 {selectedContract.aseguradora && (
 <div>
 <p className="text-muted-foreground">Aseguradora</p>
 <p>{selectedContract.aseguradora}</p>
 </div>
 )}
 {selectedContract.sumaAsegurada && (
 <div>
 <p className="text-muted-foreground">Suma Asegurada</p>
 <p>{formatCurrency(Number(selectedContract.sumaAsegurada))}</p>
 </div>
 )}
 </div>
 </div>
 )}

 {selectedContract.notas && (
 <div>
 <p className="text-sm text-muted-foreground">Notas</p>
 <p className="text-sm">{selectedContract.notas}</p>
 </div>
 )}
 </div>
 )}
 </SheetContent>
 </Sheet>

 {/* Delete Modal */}
 <Dialog open={deleteModalOpen} onOpenChange={setDeleteModalOpen}>
 <DialogContent size="sm">
 <DialogHeader>
 <DialogTitle>Eliminar Contrato</DialogTitle>
 <DialogDescription>
 Esta acción no se puede deshacer.
 </DialogDescription>
 </DialogHeader>
 <DialogBody className="space-y-3">
 <p>
 ¿Estás seguro de eliminar el contrato <strong>{selectedContract?.nombre}</strong>?
 </p>
 {(selectedContract?._count?.pagos || 0) > 0 && (
 <p className="text-muted-foreground text-sm">
 Este contrato tiene pagos registrados. Se marcará como cancelado en lugar de eliminarse.
 </p>
 )}
 </DialogBody>
 <DialogFooter>
 <Button variant="outline" onClick={() => setDeleteModalOpen(false)}>
 Cancelar
 </Button>
 <Button variant="destructive" onClick={handleDelete} disabled={submitting}>
 {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
 {(selectedContract?._count?.pagos || 0) > 0 ? 'Cancelar Contrato' : 'Eliminar'}
 </Button>
 </DialogFooter>
 </DialogContent>
 </Dialog>
 </div>
 );
}
