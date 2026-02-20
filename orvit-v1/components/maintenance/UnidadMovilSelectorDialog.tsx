'use client';

import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogBody, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Search, Truck, Gauge, Calendar, Loader2 } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

interface UnidadMovil {
 id: number;
 nombre: string;
 tipo: string;
 estado: string;
 kilometraje: number;
 proximoMantenimiento?: string;
}

interface UnidadMovilSelectorDialogProps {
 isOpen: boolean;
 onClose: () => void;
 companyId: number;
 sectorId: number;
 onSelectUnidad: (unidad: UnidadMovil) => void;
}

export default function UnidadMovilSelectorDialog({
 isOpen,
 onClose,
 companyId,
 sectorId,
 onSelectUnidad
}: UnidadMovilSelectorDialogProps) {
 
 const [unidades, setUnidades] = useState<UnidadMovil[]>([]);
 const [filteredUnidades, setFilteredUnidades] = useState<UnidadMovil[]>([]);
 const [searchTerm, setSearchTerm] = useState('');
 const [loading, setLoading] = useState(false);

 const fetchUnidades = async () => {
 setLoading(true);
 try {
 const response = await fetch(`/api/mantenimiento/unidades-moviles?companyId=${companyId}`);
 const result = await response.json();
 
 if (result.success) {
 setUnidades(result.unidades);
 setFilteredUnidades(result.unidades);
 } else {
 toast({
 title: "Error",
 description: "No se pudieron cargar las unidades móviles",
 variant: "destructive"
 });
 }
 } catch (error) {
 console.error('Error fetching unidades:', error);
 toast({
 title: "Error",
 description: "Error al cargar las unidades móviles",
 variant: "destructive"
 });
 } finally {
 setLoading(false);
 }
 };

 useEffect(() => {
 if (isOpen) {
 fetchUnidades();
 setSearchTerm('');
 }
 }, [isOpen, companyId, sectorId]);

 useEffect(() => {
 if (searchTerm) {
 const filtered = unidades.filter(unidad =>
 unidad.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
 unidad.tipo.toLowerCase().includes(searchTerm.toLowerCase())
 );
 setFilteredUnidades(filtered);
 } else {
 setFilteredUnidades(unidades);
 }
 }, [searchTerm, unidades]);

 const handleSelectUnidad = (unidad: UnidadMovil) => {
 onSelectUnidad(unidad);
 onClose();
 };

 const getEstadoBadge = (estado: string) => {
 switch (estado.toUpperCase()) {
 case 'ACTIVE':
 case 'ACTIVO':
 return <Badge variant="default" className="bg-success-muted text-success-muted-foreground">Activo</Badge>;
 case 'INACTIVE':
 case 'INACTIVO':
 return <Badge variant="secondary">Inactivo</Badge>;
 case 'MAINTENANCE':
 case 'MANTENIMIENTO':
 return <Badge variant="destructive">En Mantenimiento</Badge>;
 default:
 return <Badge variant="outline">{estado}</Badge>;
 }
 };

 const formatKilometraje = (km: number) => {
 return new Intl.NumberFormat('es-AR').format(km);
 };

 const formatDate = (dateString?: string) => {
 if (!dateString) return 'No programado';
 try {
 return new Date(dateString).toLocaleDateString('es-AR');
 } catch {
 return 'Fecha inválida';
 }
 };

 return (
 <Dialog open={isOpen} onOpenChange={onClose}>
 <DialogContent size="lg">
 <DialogHeader>
 <DialogTitle className="flex items-center gap-2">
 <Truck className="h-5 w-5" />
 Seleccionar Unidad Móvil
 </DialogTitle>
 <DialogDescription>
 Elige la unidad móvil para la cual quieres ejecutar el checklist
 </DialogDescription>
 </DialogHeader>

 <DialogBody>
 {/* Barra de búsqueda */}
 <div className="relative mb-4">
 <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
 <Input
 placeholder="Buscar por nombre o tipo de unidad..."
 value={searchTerm}
 onChange={(e) => setSearchTerm(e.target.value)}
 className="pl-10"
 />
 </div>

 {/* Lista de unidades */}
 <div className="space-y-3">
 {loading ? (
 <div className="flex justify-center items-center h-32">
 <Loader2 className="h-8 w-8 animate-spin text-primary" />
 </div>
 ) : filteredUnidades.length === 0 ? (
 <div className="text-center py-8 text-muted-foreground">
 {searchTerm ? 'No se encontraron unidades que coincidan con la búsqueda' : 'No hay unidades móviles disponibles'}
 </div>
 ) : (
 filteredUnidades.map((unidad) => (
 <Card 
 key={unidad.id} 
 className="cursor-pointer hover:bg-accent transition-colors"
 onClick={() => handleSelectUnidad(unidad)}
 >
 <CardContent className="p-4">
 <div className="flex justify-between items-start">
 <div className="flex-1">
 <div className="flex items-center gap-3 mb-2">
 <div className="bg-info-muted p-2 rounded-lg">
 <Truck className="h-5 w-5 text-info-muted-foreground" />
 </div>
 <div>
 <h3 className="font-semibold text-lg">{unidad.nombre}</h3>
 <p className="text-sm text-foreground">{unidad.tipo}</p>
 </div>
 </div>
 
 <div className="flex gap-4 text-sm">
 <div className="flex items-center gap-1">
 {getEstadoBadge(unidad.estado)}
 </div>
 <div className="flex items-center gap-1 text-foreground">
 <Gauge className="h-3 w-3" />
 <span>{formatKilometraje(unidad.kilometraje)} km</span>
 </div>
 <div className="flex items-center gap-1 text-foreground">
 <Calendar className="h-3 w-3" />
 <span>Próximo: {formatDate(unidad.proximoMantenimiento)}</span>
 </div>
 </div>
 </div>
 
 <Button 
 variant="outline" 
 size="sm"
 onClick={(e) => {
 e.stopPropagation();
 handleSelectUnidad(unidad);
 }}
 >
 Seleccionar
 </Button>
 </div>
 </CardContent>
 </Card>
 ))
 )}
 </div>
 </DialogBody>

 <DialogFooter>
 <Button variant="outline" onClick={onClose} size="default">
 Cancelar
 </Button>
 </DialogFooter>
 </DialogContent>
 </Dialog>
 );
}
