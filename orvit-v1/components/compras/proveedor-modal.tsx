'use client';

// ✅ OPTIMIZACIÓN: Desactivar logs en producción
const DEBUG = false;
const log = DEBUG ? (...args: unknown[]) => { /* debug */ } : () => {};
const logError = DEBUG ? console.error.bind(console) : () => {};

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogBody } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, Building2, Phone, Mail, MapPin, FileText, User, CreditCard, Search, Plus, Trash2, List } from 'lucide-react';
import { toast } from 'sonner';
import { useCompany } from '@/contexts/CompanyContext';
import { validateCUIT } from '@/lib/ventas/cuit-validator';

const proveedorSchema = z.object({
 nombre: z.string().min(1, 'El nombre es requerido'),
 razonSocial: z.string().min(1, 'La razón social es requerida'),
 codigo: z.string().optional().or(z.literal('')),
 cuit: z.string().min(1, 'El CUIT es requerido').refine(
 (val) => validateCUIT(val).valid,
 (val) => ({ message: validateCUIT(val).error || 'CUIT inválido' })
 ),
 email: z.string().email('Email inválido').optional().or(z.literal('')),
 telefono: z.string().optional().or(z.literal('')),
 direccion: z.string().optional().or(z.literal('')),
 ciudad: z.string().optional().or(z.literal('')),
 codigoPostal: z.string().optional().or(z.literal('')),
 provincia: z.string().optional().or(z.literal('')),
 contactoNombre: z.string().optional().or(z.literal('')),
 contactoTelefono: z.string().optional().or(z.literal('')),
 contactoEmail: z.string().email('Email inválido').optional().or(z.literal('')),
 condicionesPago: z.string().optional().or(z.literal('')),
 notas: z.string().optional().or(z.literal('')),
 // Datos bancarios
 cbu: z.string().optional().or(z.literal('')),
 aliasCbu: z.string().optional().or(z.literal('')),
 banco: z.string().optional().or(z.literal('')),
 tipoCuenta: z.string().optional().or(z.literal('')),
 numeroCuenta: z.string().optional().or(z.literal('')),
 // Datos fiscales adicionales
 condicionIva: z.string().optional().or(z.literal('')),
 ingresosBrutos: z.string().optional().or(z.literal('')),
 isActive: z.boolean()
});

type ProveedorFormData = z.infer<typeof proveedorSchema>;

interface Proveedor {
 id?: string;
 nombre: string;
 razonSocial: string;
 codigo?: string;
 cuit: string;
 email?: string;
 telefono?: string;
 direccion?: string;
 ciudad?: string;
 codigoPostal?: string;
 provincia?: string;
 contactoNombre?: string;
 contactoTelefono?: string;
 contactoEmail?: string;
 condicionesPago?: string;
 notas?: string;
 // Datos bancarios
 cbu?: string;
 aliasCbu?: string;
 banco?: string;
 tipoCuenta?: string;
 numeroCuenta?: string;
 // Datos fiscales adicionales
 condicionIva?: string;
 ingresosBrutos?: string;
 estado: 'activo' | 'inactivo';
 ordenesCompletadas?: number;
 montoTotal?: number;
}

interface ProveedorModalProps {
 proveedor?: Proveedor | null;
 isOpen: boolean;
 onClose: () => void;
 onProveedorSaved: (proveedor: Proveedor) => void;
}

export function ProveedorModal({ 
 proveedor, 
 isOpen, 
 onClose, 
 onProveedorSaved 
}: ProveedorModalProps) {
 const { currentCompany } = useCompany();
 const [isLoading, setIsLoading] = useState(false);
 const [isLoadingArca, setIsLoadingArca] = useState(false);
 const isEditing = !!proveedor;

 // Conceptos de gasto predefinidos
 const [conceptosProveedor, setConceptosProveedor] = useState<
  Array<{ id?: number; descripcion: string; monto: string; isNew?: boolean; toDelete?: boolean }>
 >([]);
 const [conceptosOriginales, setConceptosOriginales] = useState<Array<{ id: number; descripcion: string; monto: string }>>([]);

 const {
 register,
 handleSubmit,
 reset,
 setValue,
 watch,
 formState: { errors }
 } = useForm<ProveedorFormData>({
 resolver: zodResolver(proveedorSchema),
 defaultValues: {
 nombre: '',
 razonSocial: '',
 codigo: '',
 cuit: '',
 email: '',
 telefono: '',
 direccion: '',
 ciudad: '',
 codigoPostal: '',
 provincia: '',
 contactoNombre: '',
 contactoTelefono: '',
 contactoEmail: '',
 condicionesPago: '',
 notas: '',
 cbu: '',
 aliasCbu: '',
 banco: '',
 tipoCuenta: '',
 numeroCuenta: '',
 condicionIva: '',
 ingresosBrutos: '',
 isActive: true
 }
 });

 const isActive = watch('isActive');

 // Resetear formulario cuando cambia el proveedor o se abre/cierra el modal
 useEffect(() => {
 log('[PROVEEDOR MODAL] useEffect - isOpen:', isOpen, 'proveedor recibido:', proveedor);
 if (isOpen) {
 if (proveedor) {
 log('[PROVEEDOR MODAL] Reseteando formulario con datos del proveedor (edición):', proveedor);
 reset({
 nombre: proveedor.nombre || '',
 razonSocial: proveedor.razonSocial || '',
 codigo: proveedor.codigo || '',
 cuit: proveedor.cuit || '',
 email: proveedor.email || '',
 telefono: proveedor.telefono || '',
 direccion: proveedor.direccion || '',
 ciudad: proveedor.ciudad || '',
 codigoPostal: proveedor.codigoPostal || '',
 provincia: proveedor.provincia || '',
 contactoNombre: proveedor.contactoNombre || '',
 contactoTelefono: proveedor.contactoTelefono || '',
 contactoEmail: proveedor.contactoEmail || '',
 condicionesPago: proveedor.condicionesPago || '',
 notas: proveedor.notas || '',
 cbu: proveedor.cbu || '',
 aliasCbu: proveedor.aliasCbu || '',
 banco: proveedor.banco || '',
 tipoCuenta: proveedor.tipoCuenta || '',
 numeroCuenta: proveedor.numeroCuenta || '',
 condicionIva: proveedor.condicionIva || '',
 ingresosBrutos: proveedor.ingresosBrutos || '',
 isActive: proveedor.estado === 'activo'
 });
 } else {
 log('[PROVEEDOR MODAL] Reseteando formulario vacío (nuevo proveedor)');
 reset({
 nombre: '',
 razonSocial: '',
 codigo: '',
 cuit: '',
 email: '',
 telefono: '',
 direccion: '',
 ciudad: '',
 codigoPostal: '',
 provincia: '',
 contactoNombre: '',
 contactoTelefono: '',
 contactoEmail: '',
 condicionesPago: '',
 notas: '',
 cbu: '',
 aliasCbu: '',
 banco: '',
 tipoCuenta: '',
 numeroCuenta: '',
 condicionIva: '',
 ingresosBrutos: '',
 isActive: true
 });
 setConceptosProveedor([]);
 setConceptosOriginales([]);
 }
 }
 }, [proveedor, isOpen, reset]);

 // Cargar conceptos al abrir en modo edición
 useEffect(() => {
 if (isOpen && proveedor?.id) {
 fetch(`/api/compras/proveedores/${proveedor.id}/conceptos`)
 .then(r => r.ok ? r.json() : [])
 .then((data: Array<{ id: number; descripcion: string; monto: string | null }>) => {
 const mapped = data.map(c => ({
 id: c.id,
 descripcion: c.descripcion,
 monto: c.monto != null ? String(c.monto) : '',
 }));
 setConceptosProveedor(mapped);
 setConceptosOriginales(mapped);
 })
 .catch(() => {});
 }
 }, [isOpen, proveedor?.id]);

 const formatCuit = (value: string) => {
 // Remover todo lo que no sea número
 const numbers = value.replace(/\D/g, '');
 
 // Formatear como XX-XXXXXXXX-X
 if (numbers.length <= 2) {
 return numbers;
 } else if (numbers.length <= 10) {
 return `${numbers.slice(0, 2)}-${numbers.slice(2)}`;
 } else {
 return `${numbers.slice(0, 2)}-${numbers.slice(2, 10)}-${numbers.slice(10, 11)}`;
 }
 };

 const consultarArca = async (cuit: string) => {
 setIsLoadingArca(true);
 try {
 const response = await fetch(`/api/arca?cuit=${cuit.replace(/-/g, '')}`);
 if (!response.ok) {
 throw new Error('Error al consultar ARCA');
 }

 const data = await response.json();

 // Solo autocompletar campos que estén vacíos — no sobreescribir lo que el usuario ya escribió
 const setIfEmpty = (field: keyof ProveedorFormData, value: string) => {
 const current = watch(field) as string;
 if (!current || current.trim() === '') {
 setValue(field, value);
 }
 };

 // Información básica
 if (data.razonSocial) {
 setIfEmpty('razonSocial', data.razonSocial);
 }
 if (data.nombreFantasia) {
 setIfEmpty('nombre', data.nombreFantasia);
 } else if (data.razonSocial) {
 setIfEmpty('nombre', data.razonSocial);
 }

 // Dirección
 if (data.domicilio) {
 let direccionCompleta = data.domicilio;
 if (data.piso) direccionCompleta += ` Piso ${data.piso}`;
 if (data.departamento) direccionCompleta += ` Depto ${data.departamento}`;
 setIfEmpty('direccion', direccionCompleta);
 }
 if (data.localidad) setIfEmpty('ciudad', data.localidad);
 if (data.provincia) setIfEmpty('provincia', data.provincia);
 if (data.codigoPostal) setIfEmpty('codigoPostal', data.codigoPostal);

 // Datos fiscales
 if (data.condicionIva) setIfEmpty('condicionIva', data.condicionIva);
 if (data.ingresosBrutos) setIfEmpty('ingresosBrutos', data.ingresosBrutos);

 // Contacto
 if (data.email) setIfEmpty('email', data.email);
 if (data.telefono) setIfEmpty('telefono', data.telefono);

 const camposCargados = [
 data.razonSocial && 'Razón Social',
 data.nombreFantasia && 'Nombre Comercial',
 data.domicilio && 'Dirección',
 data.localidad && 'Ciudad',
 data.provincia && 'Provincia',
 data.codigoPostal && 'Código Postal',
 data.condicionIva && 'Condición IVA',
 data.ingresosBrutos && 'Ingresos Brutos',
 data.email && 'Email',
 data.telefono && 'Teléfono',
 ].filter(Boolean);

 toast.success(`Datos de ARCA cargados: ${camposCargados.length} campos autocompletados`);
 } catch (error) {
 logError('Error consultando ARCA:', error);
 if (error instanceof Error && !error.message.includes('404')) {
 toast.error('Error al consultar ARCA. Puedes continuar completando los datos manualmente.');
 }
 } finally {
 setIsLoadingArca(false);
 }
 };

 const handleCuitChange = (e: React.ChangeEvent<HTMLInputElement>) => {
 const formatted = formatCuit(e.target.value);
 setValue('cuit', formatted, { shouldValidate: true });
 
 // Consultar ARCA cuando el CUIT está completo
 if (formatted.length === 13 && !isEditing) {
 consultarArca(formatted);
 }
 };

 const onSubmit = async (data: ProveedorFormData) => {
 log('[PROVEEDOR MODAL] 🚀 onSubmit iniciado');
 log('[PROVEEDOR MODAL] datos del formulario:', data);
 log('[PROVEEDOR MODAL] isEditing:', isEditing);
 log('[PROVEEDOR MODAL] proveedor actual:', proveedor);
 
 if (!currentCompany?.id) {
 log('[PROVEEDOR MODAL] ❌ No hay empresa seleccionada');
 toast.error('No hay empresa seleccionada');
 return;
 }

 setIsLoading(true);
 try {
 // Ensure CUIT is stored in formatted XX-XXXXXXXX-X format
 const cuitResult = validateCUIT(data.cuit);
 const formattedCuit = cuitResult.formatted || data.cuit;

 const payload = {
 nombre: data.nombre,
 razonSocial: data.razonSocial,
 codigo: data.codigo || undefined,
 cuit: formattedCuit,
 email: data.email || undefined,
 telefono: data.telefono || undefined,
 direccion: data.direccion || undefined,
 ciudad: data.ciudad || undefined,
 codigoPostal: data.codigoPostal || undefined,
 provincia: data.provincia || undefined,
 contactoNombre: data.contactoNombre || undefined,
 contactoTelefono: data.contactoTelefono || undefined,
 contactoEmail: data.contactoEmail || undefined,
 condicionesPago: data.condicionesPago || undefined,
 notas: data.notas || undefined,
 cbu: data.cbu || undefined,
 aliasCbu: data.aliasCbu || undefined,
 banco: data.banco || undefined,
 tipoCuenta: data.tipoCuenta || undefined,
 numeroCuenta: data.numeroCuenta || undefined,
 condicionIva: data.condicionIva || undefined,
 ingresosBrutos: data.ingresosBrutos || undefined,
 isActive: data.isActive,
 };

 let response: Response;
 const url = isEditing && proveedor?.id 
 ? `/api/compras/proveedores/${proveedor.id}`
 : '/api/compras/proveedores';
 const method = isEditing && proveedor?.id ? 'PUT' : 'POST';
 
 log('[PROVEEDOR MODAL] 📤 Enviando request:', { url, method, payload });
 
 if (isEditing && proveedor?.id) {
 log('[PROVEEDOR MODAL] Enviando PUT a /api/compras/proveedores/', proveedor.id);
 response = await fetch(`/api/compras/proveedores/${proveedor.id}`, {
 method: 'PUT',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify(payload),
 });
 } else {
 log('[PROVEEDOR MODAL] Enviando POST a /api/compras/proveedores');
 response = await fetch('/api/compras/proveedores', {
 method: 'POST',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify(payload),
 });
 }

 log('[PROVEEDOR MODAL] 📥 Respuesta recibida:', { 
 ok: response.ok, 
 status: response.status, 
 statusText: response.statusText 
 });

 if (!response.ok) {
 const errorData = await response.json().catch(() => null);
 logError('[PROVEEDOR MODAL] ❌ Error en la respuesta:', errorData);
 throw new Error(errorData?.error || 'Error en la API de proveedores');
 }

 const saved = await response.json();
 log('[PROVEEDOR MODAL] ✅ Proveedor guardado exitosamente:', saved);
 const savedProveedor: Proveedor = {
 id: saved.id ? String(saved.id) : (proveedor?.id || `prov-${Date.now()}`),
 nombre: saved.name || payload.nombre,
 razonSocial: saved.razon_social || payload.razonSocial,
 codigo: saved.codigo || payload.codigo,
 cuit: saved.cuit || payload.cuit,
 email: saved.email || payload.email,
 telefono: saved.phone || payload.telefono,
 direccion: saved.address || payload.direccion,
 ciudad: payload.ciudad,
 codigoPostal: payload.codigoPostal,
 provincia: payload.provincia,
 contactoNombre: saved.contact_person || payload.contactoNombre,
 contactoTelefono: payload.contactoTelefono,
 contactoEmail: payload.contactoEmail,
 condicionesPago: payload.condicionesPago,
 notas: payload.notas,
 cbu: payload.cbu,
 aliasCbu: payload.aliasCbu,
 banco: payload.banco,
 tipoCuenta: payload.tipoCuenta,
 numeroCuenta: payload.numeroCuenta,
 condicionIva: payload.condicionIva,
 ingresosBrutos: payload.ingresosBrutos,
 estado: data.isActive ? 'activo' : 'inactivo',
 ordenesCompletadas: proveedor?.ordenesCompletadas || 0,
 montoTotal: proveedor?.montoTotal || 0,
 };

 // Sincronizar conceptos de gasto
 const proveedorIdGuardado = String(saved.id || proveedor?.id || '');
 if (proveedorIdGuardado) {
 const conceptosActivos = conceptosProveedor.filter(c => !c.toDelete);
 // Eliminar los marcados para borrar
 const paraEliminar = conceptosProveedor.filter(c => c.toDelete && c.id);
 await Promise.all(paraEliminar.map(c =>
 fetch(`/api/compras/proveedores/${proveedorIdGuardado}/conceptos?conceptoId=${c.id}`, { method: 'DELETE' })
 ));
 // Crear los nuevos
 const paraCrear = conceptosActivos.filter(c => !c.id && c.descripcion.trim());
 await Promise.all(paraCrear.map((c, idx) =>
 fetch(`/api/compras/proveedores/${proveedorIdGuardado}/conceptos`, {
 method: 'POST',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify({ descripcion: c.descripcion.trim(), monto: c.monto || null, orden: idx }),
 })
 ));
 // Actualizar los existentes que cambiaron
 const paraActualizar = conceptosActivos.filter(c => c.id && !c.isNew);
 await Promise.all(paraActualizar.map((c, idx) => {
 const original = conceptosOriginales.find(o => o.id === c.id);
 if (!original || (original.descripcion === c.descripcion && original.monto === c.monto)) return;
 return fetch(`/api/compras/proveedores/${proveedorIdGuardado}/conceptos?conceptoId=${c.id}`, {
 method: 'PUT',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify({ descripcion: c.descripcion.trim(), monto: c.monto || null, orden: idx }),
 });
 }));
 }

 toast.success(isEditing ? 'Proveedor actualizado correctamente' : 'Proveedor creado correctamente');
 log('[PROVEEDOR MODAL] 🔄 Ejecutando callback onProveedorSaved con:', savedProveedor);
 onProveedorSaved(savedProveedor);
 log('[PROVEEDOR MODAL] 🔄 Ejecutando onClose');
 onClose();
 } catch (error) {
 logError('[PROVEEDOR MODAL] ❌ Error saving proveedor:', error);
 const msg = error instanceof Error ? error.message : null;
 toast.error(msg && msg !== 'Error en la API de proveedores' ? msg : (isEditing ? 'Error al actualizar proveedor' : 'Error al crear proveedor'));
 } finally {
 setIsLoading(false);
 }
 };

 return (
 <Dialog open={isOpen} onOpenChange={onClose}>
 <DialogContent size="xl">
 <DialogHeader>
 <DialogTitle className="flex items-center gap-2">
 <Building2 className="h-6 w-6 text-info-muted-foreground" />
 {isEditing ? 'Editar Proveedor' : 'Nuevo Proveedor'}
 </DialogTitle>
 </DialogHeader>

 <DialogBody>
 <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" autoComplete="off">
 <Tabs defaultValue="general" className="w-full">
 <TabsList className="w-full justify-start overflow-x-auto">
 <TabsTrigger value="general">
 <FileText className="w-4 h-4 mr-2" />
 Datos Generales
 </TabsTrigger>
 <TabsTrigger value="fiscal">
 <Building2 className="w-4 h-4 mr-2" />
 Datos Fiscales
 </TabsTrigger>
 <TabsTrigger value="bancario">
 <CreditCard className="w-4 h-4 mr-2" />
 Datos Bancarios
 </TabsTrigger>
 <TabsTrigger value="conceptos">
 <List className="w-4 h-4 mr-2" />
 Conceptos de Gasto
 </TabsTrigger>
 </TabsList>

 {/* Tab: Datos Generales */}
 <TabsContent value="general" className="space-y-4 mt-4">
 {/* Información Básica */}
 <div className="space-y-4">
 <h3 className="text-lg font-semibold border-b pb-2">Información Básica</h3>
 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
 <div>
 <Label htmlFor="nombre">Nombre Comercial *</Label>
 <Input
 id="nombre"
 {...register('nombre')}
 placeholder="ej. Proveedor ABC S.A."
 autoFocus
 />
 {errors.nombre && (
 <p className="text-sm text-destructive mt-1">{errors.nombre.message}</p>
 )}
 </div>

 <div>
 <Label htmlFor="razonSocial">Razón Social *</Label>
 <Input
 id="razonSocial"
 {...register('razonSocial')}
 placeholder="ej. Proveedor ABC Sociedad Anónima"
 />
 {errors.razonSocial && (
 <p className="text-sm text-destructive mt-1">{errors.razonSocial.message}</p>
 )}
 </div>

 <div className="md:col-span-2 flex items-center space-x-2">
 <Switch
 id="isActive"
 checked={isActive}
 onCheckedChange={(checked) => setValue('isActive', checked)}
 />
 <Label htmlFor="isActive" className="cursor-pointer">
 Proveedor activo
 </Label>
 </div>
 </div>
 </div>

 {/* Dirección */}
 <div className="space-y-4">
 <h3 className="text-lg font-semibold border-b pb-2">Dirección</h3>
 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
 <div className="md:col-span-2">
 <Label htmlFor="direccion">Dirección</Label>
 <Input
 id="direccion"
 {...register('direccion')}
 placeholder="Av. Corrientes 1234"
 />
 </div>

 <div>
 <Label htmlFor="ciudad">Ciudad</Label>
 <Input
 id="ciudad"
 {...register('ciudad')}
 placeholder="Buenos Aires"
 />
 </div>

 <div>
 <Label htmlFor="codigoPostal">Código Postal</Label>
 <Input
 id="codigoPostal"
 {...register('codigoPostal')}
 placeholder="C1000"
 />
 </div>

 <div className="md:col-span-2">
 <Label htmlFor="provincia">Provincia</Label>
 <Input
 id="provincia"
 {...register('provincia')}
 placeholder="Ciudad Autónoma de Buenos Aires"
 />
 </div>
 </div>
 </div>

 {/* Contacto Principal */}
 <div className="space-y-4">
 <h3 className="text-lg font-semibold border-b pb-2">Contacto Principal</h3>
 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
 <div>
 <Label htmlFor="contactoNombre">Nombre del Contacto</Label>
 <Input
 id="contactoNombre"
 {...register('contactoNombre')}
 placeholder="Juan Pérez"
 />
 </div>

 <div>
 <Label htmlFor="contactoTelefono">Teléfono del Contacto</Label>
 <Input
 id="contactoTelefono"
 {...register('contactoTelefono')}
 placeholder="+54 11 1234-5678"
 />
 </div>

 <div className="md:col-span-2">
 <Label htmlFor="contactoEmail">Email del Contacto</Label>
 <Input
 id="contactoEmail"
 type="email"
 {...register('contactoEmail')}
 placeholder="juan.perez@proveedor.com"
 />
 {errors.contactoEmail && (
 <p className="text-sm text-destructive mt-1">{errors.contactoEmail.message}</p>
 )}
 </div>
 </div>
 </div>

 {/* Condiciones de Pago */}
 <div className="space-y-4">
 <h3 className="text-lg font-semibold border-b pb-2">Condiciones de Pago</h3>
 <div>
 <Label htmlFor="condicionesPago">Condiciones de Pago</Label>
 <Textarea
 id="condicionesPago"
 {...register('condicionesPago')}
 placeholder="ej. 30 días, cheque a fecha, etc."
 rows={3}
 />
 </div>
 </div>

 {/* Observaciones */}
 <div className="space-y-4">
 <h3 className="text-lg font-semibold border-b pb-2">Observaciones</h3>
 <div>
 <Label htmlFor="notas">Notas Adicionales</Label>
 <Textarea
 id="notas"
 {...register('notas')}
 placeholder="Información adicional sobre el proveedor"
 rows={3}
 />
 </div>
 </div>
 </TabsContent>

 {/* Tab: Datos Fiscales */}
 <TabsContent value="fiscal" className="space-y-4 mt-4">
 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
 <div>
 <Label htmlFor="cuit">CUIT *</Label>
 <div className="flex gap-2">
 <Input
 id="cuit"
 {...register('cuit')}
 placeholder="20-12345678-9"
 onChange={handleCuitChange}
 maxLength={13}
 className="flex-1"
 />
 <Button
 type="button"
 variant="outline"
 size="icon"
 onClick={() => {
 const cuitValue = watch('cuit');
 if (cuitValue && cuitValue.length === 13) {
 consultarArca(cuitValue);
 } else {
 toast.error('Ingrese un CUIT válido para consultar ARCA');
 }
 }}
 disabled={isLoadingArca}
 title="Consultar ARCA"
 >
 {isLoadingArca ? (
 <Loader2 className="h-4 w-4 animate-spin" />
 ) : (
 <Search className="h-4 w-4" />
 )}
 </Button>
 </div>
 {errors.cuit && (
 <p className="text-sm text-destructive mt-1">{errors.cuit.message}</p>
 )}
 <p className="text-xs text-muted-foreground mt-1">
 Ingrese el CUIT completo para consultar datos automáticamente desde ARCA
 </p>
 </div>

 <div>
 <Label htmlFor="codigo">ID / Código del Proveedor</Label>
 <Input
 id="codigo"
 {...register('codigo')}
 placeholder="Ej: PROV-001"
 />
 </div>

 <div>
 <Label htmlFor="condicionIva">Condición IVA</Label>
 <select
 id="condicionIva"
 className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
 {...register('condicionIva')}
 >
 <option value="">Seleccionar condición</option>
 <option value="Responsable Inscripto">Responsable Inscripto</option>
 <option value="Monotributo">Monotributo</option>
 <option value="Exento">Exento</option>
 <option value="Consumidor Final">Consumidor Final</option>
 <option value="No Responsable">No Responsable</option>
 </select>
 </div>

 <div>
 <Label htmlFor="ingresosBrutos">Ingresos Brutos</Label>
 <Input
 id="ingresosBrutos"
 {...register('ingresosBrutos')}
 placeholder="Ej: 30-12345678-9"
 />
 </div>
 </div>
 </TabsContent>

 {/* Tab: Datos Bancarios */}
 <TabsContent value="bancario" className="space-y-4 mt-4">
 <div className="space-y-4">
 <h3 className="text-lg font-semibold border-b pb-2">Información Bancaria</h3>
 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
 <div>
 <Label htmlFor="cbu">CBU</Label>
 <Input
 id="cbu"
 {...register('cbu')}
 placeholder="0000000000000000000000"
 maxLength={22}
 />
 <p className="text-xs text-muted-foreground mt-1">
 22 dígitos sin espacios ni guiones
 </p>
 </div>

 <div>
 <Label htmlFor="aliasCbu">Alias CBU</Label>
 <Input
 id="aliasCbu"
 {...register('aliasCbu')}
 placeholder="ej. PROVEEDOR.ABC"
 maxLength={20}
 />
 </div>

 <div>
 <Label htmlFor="banco">Banco</Label>
 <Input
 id="banco"
 {...register('banco')}
 placeholder="Nombre del banco"
 />
 </div>

 <div>
 <Label htmlFor="tipoCuenta">Tipo de Cuenta</Label>
 <Input
 id="tipoCuenta"
 {...register('tipoCuenta')}
 placeholder="Caja de Ahorro, Cuenta Corriente, etc."
 />
 </div>

 <div className="md:col-span-2">
 <Label htmlFor="numeroCuenta">Número de Cuenta</Label>
 <Input
 id="numeroCuenta"
 {...register('numeroCuenta')}
 placeholder="Número de cuenta bancaria"
 />
 </div>
 </div>
 </div>
 </TabsContent>

 {/* Tab: Conceptos de Gasto */}
 <TabsContent value="conceptos" className="space-y-4 mt-4">
 <div className="space-y-3">
 <p className="text-sm text-muted-foreground">
 Estos conceptos se autocompletarán al seleccionar este proveedor en una factura de costo indirecto.
 </p>

 {conceptosProveedor.filter(c => !c.toDelete).length === 0 ? (
 <div className="text-center py-8 text-muted-foreground border-2 border-dashed rounded-lg">
 <List className="w-8 h-8 mx-auto mb-2 opacity-40" />
 <p className="text-sm font-medium">Sin conceptos definidos</p>
 <p className="text-xs mt-1 opacity-70">Agregá los conceptos habituales de este proveedor</p>
 </div>
 ) : (
 <div className="space-y-2">
 <div className="grid grid-cols-[1fr_120px_40px] gap-2 px-1">
 <span className="text-xs text-muted-foreground font-medium">Descripción</span>
 <span className="text-xs text-muted-foreground font-medium">Monto (opcional)</span>
 <span />
 </div>
 {conceptosProveedor.map((concepto, realIdx) => {
 if (concepto.toDelete) return null;
 return (
 <div key={concepto.id ?? `new-${realIdx}`} className="grid grid-cols-[1fr_120px_40px] gap-2 items-center">
 <Input
 value={concepto.descripcion}
 onChange={(e) => setConceptosProveedor(prev =>
 prev.map((c, i) => i === realIdx ? { ...c, descripcion: e.target.value } : c)
 )}
 placeholder="ej. Conectividad Dedicada"
 />
 <Input
 value={concepto.monto}
 onChange={(e) => setConceptosProveedor(prev =>
 prev.map((c, i) => i === realIdx ? { ...c, monto: e.target.value } : c)
 )}
 placeholder="0.00"
 type="number"
 min="0"
 step="0.01"
 />
 <Button
 type="button"
 variant="ghost"
 size="icon"
 className="text-muted-foreground hover:text-destructive"
 onClick={() => {
 if (concepto.id) {
 setConceptosProveedor(prev => prev.map((c, i) => i === realIdx ? { ...c, toDelete: true } : c));
 } else {
 setConceptosProveedor(prev => prev.filter((_, i) => i !== realIdx));
 }
 }}
 >
 <Trash2 className="w-4 h-4" />
 </Button>
 </div>
 );
 })}
 </div>
 )}

 <Button
 type="button"
 variant="outline"
 size="sm"
 onClick={() => setConceptosProveedor(prev => [...prev, { descripcion: '', monto: '', isNew: true }])}
 >
 <Plus className="w-4 h-4 mr-2" />
 Agregar concepto
 </Button>
 </div>
 </TabsContent>

 </Tabs>
 </form>
 </DialogBody>

 <DialogFooter>
 <Button type="button" variant="outline" size="default" onClick={onClose} disabled={isLoading}>
 Cancelar
 </Button>
 <Button type="submit" size="default" disabled={isLoading} onClick={handleSubmit(onSubmit)}>
 {isLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
 {isEditing ? 'Actualizar' : 'Crear'} Proveedor
 </Button>
 </DialogFooter>
 </DialogContent>
 </Dialog>
 );
}

