'use client';

import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useCompany } from '@/contexts/CompanyContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import {
  QrCode,
  Plus,
  Search,
  RefreshCw,
  Download,
  Printer,
  Eye,
  Cog,
  Wrench,
  Package,
} from 'lucide-react';

interface QRCodeItem {
  id: number;
  code: string;
  entityType: string;
  entityId: number;
  entityName: string;
  createdAt: string;
  scannedCount: number;
  lastScannedAt: string | null;
}

const ENTITY_TYPE_CONFIG: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  MACHINE: { label: 'Máquina', icon: <Cog className="h-4 w-4" />, color: 'bg-blue-100 text-blue-800' },
  COMPONENT: { label: 'Componente', icon: <Wrench className="h-4 w-4" />, color: 'bg-purple-100 text-purple-800' },
  TOOL: { label: 'Herramienta', icon: <Wrench className="h-4 w-4" />, color: 'bg-amber-100 text-amber-800' },
  SPARE_PART: { label: 'Repuesto', icon: <Package className="h-4 w-4" />, color: 'bg-green-100 text-green-800' },
};

export default function QRCodesPage() {
  const { currentCompany } = useCompany();
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['qr-codes', currentCompany?.id, typeFilter],
    queryFn: async () => {
      const params = new URLSearchParams({
        companyId: String(currentCompany?.id),
      });
      if (typeFilter !== 'all') params.append('entityType', typeFilter);

      const res = await fetch(`/api/qr?${params}`);
      if (!res.ok) throw new Error('Error al cargar códigos QR');
      return res.json();
    },
    enabled: !!currentCompany?.id,
  });

  const qrCodes: QRCodeItem[] = data?.qrCodes || [];
  const summary = data?.summary || {};

  const filteredCodes = qrCodes.filter(qr =>
    qr.code.toLowerCase().includes(search.toLowerCase()) ||
    qr.entityName?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <QrCode className="h-6 w-6" />
            Códigos QR
          </h1>
          <p className="text-muted-foreground">
            Generación y gestión de códigos QR para activos
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => refetch()} variant="outline" size="sm">
            <RefreshCw className="h-4 w-4 mr-2" />
            Actualizar
          </Button>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="h-4 w-4 mr-2" />
                Generar QR
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Generar Código QR</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Tipo de Activo</Label>
                  <Select defaultValue="MACHINE">
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="MACHINE">Máquina</SelectItem>
                      <SelectItem value="COMPONENT">Componente</SelectItem>
                      <SelectItem value="TOOL">Herramienta</SelectItem>
                      <SelectItem value="SPARE_PART">Repuesto</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Seleccionar Activo</Label>
                  <Select>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">Máquina de ejemplo</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button className="w-full" onClick={() => setIsDialogOpen(false)}>
                  Generar Código QR
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total QR</p>
                <p className="text-2xl font-bold">{summary.total || 0}</p>
              </div>
              <QrCode className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Máquinas</p>
                <p className="text-2xl font-bold">{summary.machines || 0}</p>
              </div>
              <Cog className="h-8 w-8 text-purple-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Herramientas</p>
                <p className="text-2xl font-bold">{summary.tools || 0}</p>
              </div>
              <Wrench className="h-8 w-8 text-amber-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Escaneos Hoy</p>
                <p className="text-2xl font-bold text-green-600">{summary.scansToday || 0}</p>
              </div>
              <Eye className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por código o nombre..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Tipo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los tipos</SelectItem>
            <SelectItem value="MACHINE">Máquinas</SelectItem>
            <SelectItem value="COMPONENT">Componentes</SelectItem>
            <SelectItem value="TOOL">Herramientas</SelectItem>
            <SelectItem value="SPARE_PART">Repuestos</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* QR Codes Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {isLoading ? (
          Array(8).fill(0).map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="pt-6">
                <div className="h-32 bg-muted rounded mb-4" />
                <div className="h-4 bg-muted rounded w-3/4 mb-2" />
                <div className="h-4 bg-muted rounded w-1/2" />
              </CardContent>
            </Card>
          ))
        ) : filteredCodes.length === 0 ? (
          <div className="col-span-full text-center py-12">
            <QrCode className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No se encontraron códigos QR</p>
            <Button variant="outline" className="mt-4" onClick={() => setIsDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Generar primer código QR
            </Button>
          </div>
        ) : (
          filteredCodes.map((qr) => {
            const typeConfig = ENTITY_TYPE_CONFIG[qr.entityType] || { label: qr.entityType, icon: <QrCode className="h-4 w-4" />, color: 'bg-gray-100' };

            return (
              <Card key={qr.id} className="hover:shadow-md transition-shadow">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <Badge className={typeConfig.color}>
                      <span className="flex items-center gap-1">
                        {typeConfig.icon}
                        {typeConfig.label}
                      </span>
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {qr.scannedCount} escaneos
                    </span>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-col items-center mb-4">
                    <div className="w-24 h-24 bg-muted rounded flex items-center justify-center">
                      <QrCode className="h-16 w-16 text-muted-foreground" />
                    </div>
                  </div>
                  <div className="text-center mb-4">
                    <p className="font-medium truncate">{qr.entityName}</p>
                    <p className="text-xs text-muted-foreground font-mono">{qr.code}</p>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" className="flex-1">
                      <Eye className="h-4 w-4 mr-1" />
                      Ver
                    </Button>
                    <Button variant="outline" size="sm" className="flex-1">
                      <Download className="h-4 w-4 mr-1" />
                      Descargar
                    </Button>
                    <Button variant="outline" size="sm">
                      <Printer className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}
