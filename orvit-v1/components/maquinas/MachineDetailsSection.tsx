'use client';

import React, { useState } from 'react';
import { Machine, MachineStatus } from '@/lib/types';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  Tag,
  Calendar,
  Building2,
  FileText,
  Cog,
  QrCode,
  MapPin,
  Info,
  Settings,
  Wrench,
  Hash,
  Factory,
  Clock,
  ZoomIn,
  Download,
  Share2,
  Copy,
  Shield,
  ShieldAlert,
  ShieldCheck,
  AlertTriangle
} from 'lucide-react';
import { differenceInDays, isPast, format as formatDate } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { toast } from 'sonner';

interface MachineDetailsSectionProps {
  machine: Machine;
  sectors: Array<{ id: string | number; name: string }>;
}

export function MachineDetailsSection({ machine, sectors }: MachineDetailsSectionProps) {
  const [showImageModal, setShowImageModal] = useState(false);
  const [showQRModal, setShowQRModal] = useState(false);

  const getMachineTypeLabel = (type: string) => {
    const normalizedType = type?.toLowerCase();
    switch (normalizedType) {
      case 'production': return 'Producción';
      case 'maintenance': return 'Mantenimiento';
      case 'utility': return 'Utilidad';
      case 'packaging': return 'Empaque';
      case 'transportation': return 'Transporte';
      case 'other': return 'Otro';
      default: return type || 'Sin especificar';
    }
  };

  const getMachineStatusBadge = (status: string) => {
    switch (status) {
      case 'ACTIVE':
      case MachineStatus.ACTIVE:
        return <Badge className="bg-green-500 text-white">Activo</Badge>;
      case 'OUT_OF_SERVICE':
      case MachineStatus.OUT_OF_SERVICE:
        return <Badge className="bg-amber-500 text-white">Fuera de servicio</Badge>;
      case 'DECOMMISSIONED':
      case MachineStatus.DECOMMISSIONED:
        return <Badge variant="destructive">Baja</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const sectorName = sectors.find(
    s => parseInt(String(s.id), 10) === parseInt(String(machine.sectorId), 10)
  )?.name || `Sector ID: ${machine.sectorId}`;

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copiado al portapapeles`);
  };

  const qrUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/m/${machine.id}`
    : `/m/${machine.id}`;

  // Campo informativo reutilizable
  const InfoField = ({ label, value, icon: Icon, copyable = false }: {
    label: string;
    value: React.ReactNode;
    icon?: any;
    copyable?: boolean;
  }) => (
    <div className="flex items-start gap-3 py-2">
      {Icon && <Icon className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />}
      <div className="flex-1 min-w-0">
        <p className="text-[11px] text-muted-foreground uppercase tracking-wide">{label}</p>
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium truncate">{value || <span className="text-muted-foreground font-normal">No especificado</span>}</p>
          {copyable && value && (
            <Button
              variant="ghost"
              size="icon"
              className="h-5 w-5 opacity-50 hover:opacity-100"
              onClick={() => copyToClipboard(String(value), label)}
            >
              <Copy className="h-3 w-3" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );

  // Calcular estado de garantía
  const getWarrantyStatus = () => {
    if (!machine.warrantyExpiration) return null;

    const expirationDate = typeof machine.warrantyExpiration === 'string'
      ? new Date(machine.warrantyExpiration)
      : machine.warrantyExpiration;

    if (isNaN(expirationDate.getTime())) return null;

    const today = new Date();
    const daysUntilExpiration = differenceInDays(expirationDate, today);
    const isExpired = isPast(expirationDate);

    return {
      expirationDate,
      daysUntilExpiration,
      isExpired,
      isExpiringSoon: !isExpired && daysUntilExpiration <= 30,
      isWarning: !isExpired && daysUntilExpiration > 30 && daysUntilExpiration <= 90
    };
  };

  const warrantyStatus = getWarrantyStatus();

  return (
    <div className="space-y-4">
      {/* ✨ Alerta de Garantía */}
      {warrantyStatus && (warrantyStatus.isExpired || warrantyStatus.isExpiringSoon) && (
        <Card className={`border-l-4 ${warrantyStatus.isExpired ? 'border-l-red-500 bg-red-50 dark:bg-red-950/20' : 'border-l-amber-500 bg-amber-50 dark:bg-amber-950/20'}`}>
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              {warrantyStatus.isExpired ? (
                <ShieldAlert className="h-6 w-6 text-red-500 flex-shrink-0 mt-0.5" />
              ) : (
                <AlertTriangle className="h-6 w-6 text-amber-500 flex-shrink-0 mt-0.5" />
              )}
              <div className="flex-1">
                <h3 className={`font-semibold ${warrantyStatus.isExpired ? 'text-red-800 dark:text-red-300' : 'text-amber-800 dark:text-amber-300'}`}>
                  {warrantyStatus.isExpired ? '¡Garantía Vencida!' : '¡Garantía por Vencer!'}
                </h3>
                <p className={`text-sm mt-1 ${warrantyStatus.isExpired ? 'text-red-600 dark:text-red-400' : 'text-amber-600 dark:text-amber-400'}`}>
                  {warrantyStatus.isExpired
                    ? `La garantía de esta máquina venció el ${formatDate(warrantyStatus.expirationDate, 'dd MMM yyyy', { locale: es })}.`
                    : `La garantía vence en ${warrantyStatus.daysUntilExpiration} día${warrantyStatus.daysUntilExpiration !== 1 ? 's' : ''} (${formatDate(warrantyStatus.expirationDate, 'dd MMM yyyy', { locale: es })}).`
                  }
                </p>
                {machine.warrantySupplier && (
                  <p className={`text-xs mt-2 ${warrantyStatus.isExpired ? 'text-red-500 dark:text-red-400' : 'text-amber-500 dark:text-amber-400'}`}>
                    Proveedor: {machine.warrantySupplier}
                  </p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Columna 1: Foto y QR */}
        <Card className="lg:row-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Cog className="h-4 w-4" />
              Identificación Visual
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Foto de la máquina */}
            <div
              className="relative aspect-video rounded-lg overflow-hidden bg-muted cursor-pointer group"
              onClick={() => (machine.imageUrl || machine.logo) && setShowImageModal(true)}
            >
              {(machine.imageUrl || machine.logo) ? (
                <>
                  <img
                    src={machine.imageUrl || machine.logo}
                    alt={machine.name}
                    className="w-full h-full object-cover transition-transform group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                    <ZoomIn className="h-8 w-8 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                </>
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <Cog className="h-16 w-16 text-muted-foreground/30" />
                </div>
              )}
            </div>

            <Separator />

            {/* QR Code */}
            <div className="text-center space-y-2">
              <p className="text-xs text-muted-foreground">Código QR para acceso móvil</p>
              <div
                className="mx-auto w-24 h-24 bg-white rounded-lg p-2 border cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => setShowQRModal(true)}
              >
                <img
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=80x80&data=${encodeURIComponent(qrUrl)}`}
                  alt="QR Code"
                  className="w-full h-full"
                />
              </div>
              <div className="flex justify-center gap-2">
                <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => setShowQRModal(true)}>
                  <ZoomIn className="h-3 w-3 mr-1" />
                  Ampliar
                </Button>
                <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => copyToClipboard(qrUrl, 'URL')}>
                  <Share2 className="h-3 w-3 mr-1" />
                  Compartir
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Columna 2: Información General */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Info className="h-4 w-4" />
              Información General
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            <InfoField label="Nombre" value={machine.name} icon={Tag} />
            {machine.nickname && (
              <InfoField label="Apodo" value={`"${machine.nickname}"`} />
            )}
            <InfoField label="Estado" value={getMachineStatusBadge(machine.status)} />
            <InfoField label="Tipo" value={getMachineTypeLabel(machine.type)} icon={Settings} />
            <InfoField label="Marca" value={machine.brand} icon={Factory} />
            <InfoField label="Modelo" value={machine.model} />
          </CardContent>
        </Card>

        {/* Columna 3: Identificación */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Hash className="h-4 w-4" />
              Identificación
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            <InfoField label="ID Interno" value={machine.id} icon={Hash} copyable />
            <InfoField label="Número de Serie" value={machine.serialNumber} icon={Tag} copyable />
            <InfoField label="Código de Activo" value={machine.assetCode} copyable />
            <InfoField label="Código SAP" value={machine.sapCode} copyable />
          </CardContent>
        </Card>

        {/* Columna 4: Ubicación */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <MapPin className="h-4 w-4" />
              Ubicación
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            <InfoField label="Sector" value={sectorName} icon={Building2} />
            <InfoField label="Línea de Producción" value={machine.productionLine} />
            <InfoField label="Posición" value={machine.position} />
          </CardContent>
        </Card>

        {/* Columna 5: Fechas */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Fechas Importantes
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            <InfoField
              label="Fecha de Alta"
              value={machine.acquisitionDate ? format(new Date(machine.acquisitionDate), 'dd MMM yyyy', { locale: es }) : null}
              icon={Calendar}
            />
            <InfoField
              label="Año de Fabricación"
              value={machine.manufacturingYear}
            />
            <InfoField
              label="Fecha de Instalación"
              value={machine.installationDate ? format(new Date(machine.installationDate), 'dd MMM yyyy', { locale: es }) : null}
            />
            <InfoField
              label="Última Actualización"
              value={machine.updatedAt ? format(new Date(machine.updatedAt), 'dd MMM yyyy HH:mm', { locale: es }) : null}
              icon={Clock}
            />
          </CardContent>
        </Card>

        {/* ✨ Columna 6: Garantía */}
        {machine.warrantyExpiration && (
          <Card className={warrantyStatus?.isExpired ? 'border-red-200 dark:border-red-800' : warrantyStatus?.isExpiringSoon ? 'border-amber-200 dark:border-amber-800' : ''}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                {warrantyStatus?.isExpired ? (
                  <ShieldAlert className="h-4 w-4 text-red-500" />
                ) : warrantyStatus?.isExpiringSoon ? (
                  <Shield className="h-4 w-4 text-amber-500" />
                ) : (
                  <ShieldCheck className="h-4 w-4 text-green-500" />
                )}
                Garantía
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-1">
              <InfoField
                label="Vencimiento"
                value={
                  <span className={`${warrantyStatus?.isExpired ? 'text-red-600 dark:text-red-400 font-medium' : warrantyStatus?.isExpiringSoon ? 'text-amber-600 dark:text-amber-400 font-medium' : ''}`}>
                    {format(new Date(machine.warrantyExpiration), 'dd MMM yyyy', { locale: es })}
                  </span>
                }
                icon={Calendar}
              />
              {warrantyStatus && !warrantyStatus.isExpired && (
                <InfoField
                  label="Días Restantes"
                  value={
                    <span className={warrantyStatus.isExpiringSoon ? 'text-amber-600 dark:text-amber-400 font-medium' : 'text-green-600 dark:text-green-400'}>
                      {warrantyStatus.daysUntilExpiration} días
                    </span>
                  }
                />
              )}
              {machine.warrantySupplier && (
                <InfoField
                  label="Proveedor"
                  value={machine.warrantySupplier}
                  icon={Building2}
                />
              )}
              {machine.warrantyCoverage && (
                <InfoField
                  label="Cobertura"
                  value={machine.warrantyCoverage}
                />
              )}
            </CardContent>
          </Card>
        )}
      </div>

      {/* Especificaciones Técnicas */}
      {(machine.power || machine.voltage || machine.weight || machine.dimensions || machine.technicalNotes) && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Wrench className="h-4 w-4" />
              Especificaciones Técnicas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {machine.power && (
                <InfoField label="Potencia" value={machine.power} />
              )}
              {machine.voltage && (
                <InfoField label="Voltaje" value={machine.voltage} />
              )}
              {machine.weight && (
                <InfoField label="Peso" value={machine.weight} />
              )}
              {machine.dimensions && (
                <InfoField label="Dimensiones" value={machine.dimensions} />
              )}
            </div>
            {machine.technicalNotes && (
              <div className="mt-4 p-3 bg-muted/50 rounded-lg">
                <p className="text-xs text-muted-foreground mb-1">Notas Técnicas</p>
                <p className="text-sm">{machine.technicalNotes}</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Modal de imagen ampliada */}
      <Dialog open={showImageModal} onOpenChange={setShowImageModal}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>{machine.name}</DialogTitle>
          </DialogHeader>
          {(machine.imageUrl || machine.logo) && (
            <img
              src={machine.imageUrl || machine.logo}
              alt={machine.name}
              className="w-full h-auto rounded-lg"
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Modal de QR ampliado */}
      <Dialog open={showQRModal} onOpenChange={setShowQRModal}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-center">Código QR - {machine.name}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col items-center gap-4 py-4">
            <div className="bg-white p-4 rounded-lg">
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(qrUrl)}`}
                alt="QR Code"
                className="w-48 h-48"
              />
            </div>
            <p className="text-xs text-muted-foreground text-center break-all">{qrUrl}</p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => copyToClipboard(qrUrl, 'URL')}>
                <Copy className="h-4 w-4 mr-2" />
                Copiar URL
              </Button>
              <Button variant="outline" size="sm" asChild>
                <a
                  href={`https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=${encodeURIComponent(qrUrl)}&format=png`}
                  download={`QR-${machine.name}.png`}
                >
                  <Download className="h-4 w-4 mr-2" />
                  Descargar
                </a>
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
