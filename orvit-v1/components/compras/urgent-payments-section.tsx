'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
 Clock,
 DollarSign,
 Building2,
 Calendar,
 ChevronRight,
 FileText
} from 'lucide-react';

interface PaymentRequestItem {
 id: string;
 numero: string;
 proveedor: string;
 proveedorId: number;
 solicitante: string;
 fecha: string;
 fechaRequerida: string;
 estado: string;
 monto: number;
 items: number;
 prioridad: 'baja' | 'media' | 'alta' | 'urgente';
 observaciones: string | null;
}

export function UrgentPaymentsSection() {
 const router = useRouter();
 const { user } = useAuth();
 const [solicitudes, setSolicitudes] = useState<PaymentRequestItem[]>([]);
 const [loading, setLoading] = useState(true);

 const loadSolicitudes = async () => {
 if (!user?.companies?.[0]?.companyId) return;

 setLoading(true);
 try {
 const companyId = user.companies[0].companyId;
 const response = await fetch(`/api/compras/solicitudes?companyId=${companyId}&_t=${Date.now()}`);

 if (!response.ok) {
 throw new Error('Error al cargar solicitudes');
 }

 const data = await response.json();

 // Filtrar por prioridad (urgente, alta, media - excluir baja)
 // y por estado (pendiente, en_revision - solicitudes activas)
 const filtered = (data.solicitudes || []).filter((s: PaymentRequestItem) => {
 const prioridadValida = ['urgente', 'alta', 'media'].includes(s.prioridad);
 const estadoActivo = ['pendiente', 'en_revision'].includes(s.estado);
 return prioridadValida && estadoActivo;
 });

 // Ordenar por prioridad (urgente primero)
 const prioridadOrden: Record<string, number> = { urgente: 0, alta: 1, media: 2, baja: 3 };
 filtered.sort((a: PaymentRequestItem, b: PaymentRequestItem) =>
 prioridadOrden[a.prioridad] - prioridadOrden[b.prioridad]
 );

 setSolicitudes(filtered);
 } catch (error) {
 console.error('Error loading solicitudes:', error);
 setSolicitudes([]);
 } finally {
 setLoading(false);
 }
 };

 useEffect(() => {
 if (user?.companies?.[0]?.companyId) {
 loadSolicitudes();
 }
 }, [user?.companies]);

 const handleVerSolicitud = (solicitud: PaymentRequestItem) => {
 router.push(`/administracion/compras/solicitudes/${solicitud.id}`);
 };

 const formatCurrency = (amount: number) => {
 return new Intl.NumberFormat('es-AR', {
 style: 'currency',
 currency: 'ARS',
 maximumFractionDigits: 0
 }).format(amount);
 };

 const formatDate = (dateStr: string) => {
 const d = new Date(dateStr);
 const day = String(d.getDate()).padStart(2, '0');
 const month = String(d.getMonth() + 1).padStart(2, '0');
 const year = d.getFullYear();
 return `${day}/${month}/${year}`;
 };

 const getPrioridadLabel = (prioridad: string) => {
 const labels: Record<string, string> = {
 urgente: 'Urgente',
 alta: 'Alta',
 media: 'Media',
 baja: 'Baja'
 };
 return labels[prioridad] || prioridad;
 };

 if (loading) {
 return (
 <Card>
 <CardHeader>
 <CardTitle className="text-sm font-medium flex items-center gap-2">
 <Clock className="w-4 h-4" />
 Solicitudes Prioritarias
 </CardTitle>
 </CardHeader>
 <CardContent>
 <p className="text-sm text-muted-foreground">Cargando...</p>
 </CardContent>
 </Card>
 );
 }

 if (solicitudes.length === 0) {
 return (
 <Card>
 <CardHeader>
 <CardTitle className="text-sm font-medium flex items-center gap-2">
 <Clock className="w-4 h-4" />
 Solicitudes Prioritarias
 </CardTitle>
 </CardHeader>
 <CardContent>
 <p className="text-sm text-muted-foreground">No hay solicitudes de pago prioritarias pendientes</p>
 </CardContent>
 </Card>
 );
 }

 return (
 <Card>
 <CardHeader>
 <CardTitle className="text-sm font-medium flex items-center gap-2">
 <Clock className="w-4 h-4" />
 Solicitudes Prioritarias
 <Badge variant="secondary" className="ml-2">
 {solicitudes.length}
 </Badge>
 </CardTitle>
 </CardHeader>
 <CardContent>
 <div className="space-y-3">
 {solicitudes.map((solicitud) => (
 <div
 key={solicitud.id}
 className="p-4 rounded-lg border hover:bg-muted/50 transition-colors cursor-pointer"
 onClick={() => handleVerSolicitud(solicitud)}
 >
 <div className="flex items-start justify-between gap-4">
 <div className="flex-1">
 <div className="flex items-center gap-2 mb-2">
 <Badge variant="outline" className="text-xs">
 {getPrioridadLabel(solicitud.prioridad)}
 </Badge>
 <span className="font-semibold text-sm">
 {solicitud.numero}
 </span>
 <Badge variant="secondary" className="text-xs">
 {solicitud.items} {solicitud.items === 1 ? 'comprobante' : 'comprobantes'}
 </Badge>
 </div>

 <div className="flex items-center gap-2 mb-2">
 <Building2 className="w-4 h-4 text-muted-foreground" />
 <span className="font-medium text-sm">{solicitud.proveedor}</span>
 </div>

 <div className="flex items-center gap-4 text-xs text-muted-foreground">
 <div className="flex items-center gap-1">
 <Calendar className="w-3 h-3" />
 <span>Solicitado: {formatDate(solicitud.fecha)}</span>
 </div>
 <div className="flex items-center gap-1">
 <FileText className="w-3 h-3" />
 <span>Por: {solicitud.solicitante}</span>
 </div>
 <div className="flex items-center gap-1">
 <DollarSign className="w-3 h-3" />
 <span className="font-semibold">{formatCurrency(solicitud.monto)}</span>
 </div>
 </div>
 </div>

 <div className="flex items-center">
 <Button
 size="sm"
 variant="ghost"
 onClick={(e) => {
 e.stopPropagation();
 handleVerSolicitud(solicitud);
 }}
 >
 Ver <ChevronRight className="w-4 h-4 ml-1" />
 </Button>
 </div>
 </div>
 </div>
 ))}
 </div>
 </CardContent>
 </Card>
 );
}
