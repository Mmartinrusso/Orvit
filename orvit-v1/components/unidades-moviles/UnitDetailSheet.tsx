'use client';

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetBody,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider,
} from '@/components/ui/tooltip';
import {
  Edit,
  MoreVertical,
  MapPin,
  Gauge,
  Calendar,
  Clock,
  Wrench,
  FileText,
  CheckCircle2,
  Zap,
  CalendarClock,
  AlertTriangle,
  History,
  Copy,
  Trash2,
  Upload,
  Download,
  X,
  File,
  Image as ImageIcon,
  Loader2,
  Eye,
} from 'lucide-react';
import { FileViewer } from '@/components/ui/file-viewer';
import { useDocuments } from '@/hooks/maintenance/use-documents';
import { useQueryClient } from '@tanstack/react-query';
import { UnidadMovil } from './UnitCard';
import { KilometrajeHistory } from './KilometrajeHistory';
import { cn } from '@/lib/utils';
import { format, formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';

interface TimelineEvent {
  id: string;
  type: 'maintenance' | 'failure' | 'workorder' | 'status_change' | 'meter_update';
  title: string;
  description?: string;
  date: string;
  icon: 'wrench' | 'alert' | 'check' | 'settings' | 'gauge';
  status?: 'success' | 'warning' | 'danger' | 'info';
}

interface UnitDetailSheetProps {
  unidad: UnidadMovil | null;
  isOpen: boolean;
  onClose: () => void;
  onEdit?: (unidad: UnidadMovil) => void;
  onDelete?: (unidad: UnidadMovil) => void;
  onDuplicate?: (unidad: UnidadMovil) => void;
  onCreateWorkOrder?: (unidad: UnidadMovil) => void;
  onReportFailure?: (unidad: UnidadMovil) => void;
  onScheduleService?: (unidad: UnidadMovil) => void;
  canEdit?: boolean;
  canDelete?: boolean;
  canReportFailure?: boolean;
  workOrders?: Array<{
    id: number;
    title: string;
    status: string;
    priority: string;
    scheduledDate?: string;
    createdAt?: string;
    completedAt?: string;
  }>;
  maintenanceHistory?: TimelineEvent[];
}

const estadoLabels: Record<string, string> = {
  'ACTIVO': 'Activo',
  'MANTENIMIENTO': 'En reparación',
  'FUERA_SERVICIO': 'Fuera de servicio',
  'DESHABILITADO': 'Baja',
};

const estadoColors: Record<string, string> = {
  'ACTIVO': 'bg-success-muted text-success border-success/20',
  'MANTENIMIENTO': 'bg-warning-muted text-warning-muted-foreground border-warning-muted-foreground/20',
  'FUERA_SERVICIO': 'bg-destructive/10 text-destructive border-destructive/20',
  'DESHABILITADO': 'bg-muted text-muted-foreground border-border',
};

const timelineIconMap = {
  wrench: Wrench,
  alert: AlertTriangle,
  check: CheckCircle2,
  settings: Gauge,
  gauge: Gauge,
};

const timelineStatusColors = {
  success: 'bg-muted text-foreground',
  warning: 'bg-muted text-foreground',
  danger: 'bg-destructive/10 text-destructive',
  info: 'bg-muted text-foreground',
};

const ALLOWED_EXTENSIONS = ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'jpg', 'jpeg', 'png', 'gif', 'webp', 'txt'];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

export function UnitDetailSheet({
  unidad,
  isOpen,
  onClose,
  onEdit,
  onDelete,
  onDuplicate,
  onCreateWorkOrder,
  onReportFailure,
  onScheduleService,
  canEdit = false,
  canDelete = false,
  canReportFailure = false,
  workOrders = [],
  maintenanceHistory = [],
}: UnitDetailSheetProps) {
  const [activeTab, setActiveTab] = useState('resumen');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();

  // Estado para el visor de archivos
  const [viewerOpen, setViewerOpen] = useState(false);
  const [selectedDoc, setSelectedDoc] = useState<{ url: string; fileName: string } | null>(null);

  const documentsQuery = useDocuments({
    entityType: 'unidad_movil',
    entityId: unidad?.id,
    enabled: !!unidad?.id && isOpen,
    staleTime: 60 * 1000
  });

  useEffect(() => {
    if (isOpen) {
      setActiveTab('resumen');
      setUploadError(null);
    }
  }, [isOpen]);

  const handleFileUpload = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0 || !unidad) return;

    const file = files[0];

    // Validate file extension
    const fileExt = file.name.split('.').pop()?.toLowerCase();
    if (!fileExt || !ALLOWED_EXTENSIONS.includes(fileExt)) {
      setUploadError('Tipo de archivo no permitido');
      return;
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      setUploadError('El archivo es demasiado grande. Máximo 10MB');
      return;
    }

    setIsUploading(true);
    setUploadError(null);

    try {
      // 1. Upload to S3
      const formData = new FormData();
      formData.append('file', file);
      formData.append('entityType', 'unidad_movil');
      formData.append('entityId', unidad.id.toString());
      formData.append('fileType', 'document');

      const uploadRes = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      if (!uploadRes.ok) {
        throw new Error('Error al subir archivo');
      }

      const uploadData = await uploadRes.json();

      // 2. Create document record
      const docRes = await fetch('/api/documents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entityType: 'unidad_movil',
          entityId: unidad.id.toString(),
          url: uploadData.url,
          fileName: uploadData.fileName || file.name,
          originalName: uploadData.originalName || file.name,
          fileSize: file.size,
        }),
      });

      if (!docRes.ok) {
        throw new Error('Error al guardar documento');
      }

      // Refresh documents list
      queryClient.invalidateQueries({ queryKey: ['documents', 'unidad_movil', String(unidad.id)] });

      // Clear file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : 'Error al subir archivo');
    } finally {
      setIsUploading(false);
    }
  }, [unidad, queryClient]);

  const handleDeleteDocument = useCallback(async (docId: number) => {
    if (!unidad) return;

    try {
      const res = await fetch(`/api/documents/${docId}`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        throw new Error('Error al eliminar documento');
      }

      queryClient.invalidateQueries({ queryKey: ['documents', 'unidad_movil', String(unidad.id)] });
    } catch (error) {
      console.error('Error deleting document:', error);
    }
  }, [unidad, queryClient]);

  const formatFileSize = (bytes: number | null | undefined) => {
    if (!bytes) return '';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const getFileIcon = (fileName: string) => {
    const ext = fileName?.split('.').pop()?.toLowerCase();
    if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext || '')) {
      return <ImageIcon className="h-4 w-4" />;
    }
    return <File className="h-4 w-4" />;
  };

  const timeline = useMemo(() => {
    if (maintenanceHistory.length > 0) return maintenanceHistory;

    const events: TimelineEvent[] = workOrders.map(wo => ({
      id: `wo-${wo.id}`,
      type: 'workorder' as const,
      title: wo.title,
      description: `OT #${wo.id} - ${wo.status}`,
      date: wo.completedAt || wo.createdAt || new Date().toISOString(),
      icon: wo.status === 'COMPLETED' ? 'check' as const : 'wrench' as const,
      status: wo.status === 'COMPLETED' ? 'success' as const : 'info' as const,
    }));

    if (unidad?.ultimoMantenimiento) {
      events.push({
        id: 'last-maintenance',
        type: 'maintenance',
        title: 'Mantenimiento preventivo completado',
        description: 'Service programado realizado',
        date: typeof unidad.ultimoMantenimiento === 'string'
          ? unidad.ultimoMantenimiento
          : unidad.ultimoMantenimiento.toISOString(),
        icon: 'check',
        status: 'success',
      });
    }

    return events.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [maintenanceHistory, workOrders, unidad]);

  if (!unidad) return null;

  const formatMeter = (km: number) => `${km.toLocaleString()} km`;

  const formatDate = (date?: string | Date) => {
    if (!date) return 'Sin dato';
    try {
      const dateObj = typeof date === 'string' ? new Date(date) : date;
      return format(dateObj, 'dd/MM/yyyy', { locale: es });
    } catch {
      return 'Sin dato';
    }
  };

  const formatNextService = (date?: string | Date) => {
    if (!date) return null;
    try {
      const dateObj = typeof date === 'string' ? new Date(date) : date;
      const now = new Date();
      const diffDays = Math.ceil((dateObj.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

      if (diffDays < 0) {
        return { text: 'Vencido', days: Math.abs(diffDays), isOverdue: true };
      } else if (diffDays === 0) {
        return { text: 'Hoy', days: 0, isOverdue: false };
      } else if (diffDays <= 7) {
        return { text: `en ${diffDays} día${diffDays > 1 ? 's' : ''}`, days: diffDays, isOverdue: false };
      } else {
        return { text: format(dateObj, 'dd MMM yyyy', { locale: es }), days: diffDays, isOverdue: false };
      }
    } catch {
      return null;
    }
  };

  const nextService = formatNextService(unidad.proximoMantenimiento);
  const openWorkOrders = workOrders.filter(wo =>
    wo.status === 'PENDING' || wo.status === 'IN_PROGRESS'
  );
  const completedWorkOrders = workOrders.filter(wo => wo.status === 'COMPLETED');

  return (
    <TooltipProvider delayDuration={300}>
      <Sheet open={isOpen} onOpenChange={onClose}>
        <SheetContent side="right" size="md">
          <SheetHeader className="pb-4 border-b">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <SheetTitle className="text-base font-semibold line-clamp-2">
                  {unidad.nombre || 'Sin nombre'}
                </SheetTitle>
                <SheetDescription className="mt-1 text-xs text-muted-foreground">
                  {unidad.tipo} • {unidad.marca} {unidad.modelo} • {unidad.año}
                </SheetDescription>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Badge
                  variant="outline"
                  className={cn('text-[10px] px-2 py-0 h-5 border', estadoColors[unidad.estado])}
                >
                  {estadoLabels[unidad.estado] || unidad.estado}
                </Badge>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-48">
                    {canEdit && onEdit && (
                      <DropdownMenuItem onClick={() => onEdit(unidad)}>
                        <Edit className="h-4 w-4 mr-2" />
                        Editar
                      </DropdownMenuItem>
                    )}
                    {onDuplicate && (
                      <DropdownMenuItem onClick={() => onDuplicate(unidad)}>
                        <Copy className="h-4 w-4 mr-2" />
                        Duplicar
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuSeparator />
                    {onCreateWorkOrder && (
                      <DropdownMenuItem onClick={() => onCreateWorkOrder(unidad)}>
                        <Wrench className="h-4 w-4 mr-2" />
                        Crear OT
                      </DropdownMenuItem>
                    )}
                    {canReportFailure && onReportFailure && (
                      <DropdownMenuItem onClick={() => onReportFailure(unidad)}>
                        <Zap className="h-4 w-4 mr-2" />
                        Reportar Falla
                      </DropdownMenuItem>
                    )}
                    {onScheduleService && (
                      <DropdownMenuItem onClick={() => onScheduleService(unidad)}>
                        <CalendarClock className="h-4 w-4 mr-2" />
                        Programar Service
                      </DropdownMenuItem>
                    )}
                    {canDelete && onDelete && (
                      <>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={() => onDelete(unidad)}
                          className="text-destructive focus:text-destructive"
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Eliminar
                        </DropdownMenuItem>
                      </>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          </SheetHeader>

          <SheetBody>
            {/* Urgency Alert */}
            {nextService?.isOverdue && (
              <div className="mt-4 p-3 rounded-lg border border-destructive/30 bg-destructive/5">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-destructive" />
                  <span className="text-xs font-medium text-destructive">
                    Mantenimiento vencido hace {nextService.days} días
                  </span>
                </div>
              </div>
            )}

            <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-4">
              <TabsList className="w-full justify-start overflow-x-auto h-9">
                <TabsTrigger value="resumen" className="text-xs">Resumen</TabsTrigger>
                <TabsTrigger value="km" className="text-xs">Km</TabsTrigger>
                <TabsTrigger value="ots" className="text-xs">OTs</TabsTrigger>
                <TabsTrigger value="docs" className="text-xs">Docs</TabsTrigger>
                <TabsTrigger value="historial" className="text-xs">Historial</TabsTrigger>
              </TabsList>

              {/* Tab Resumen */}
              <TabsContent value="resumen" className="space-y-4 mt-4">
                {/* Info básica */}
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="flex items-start gap-2">
                    <MapPin className="h-3.5 w-3.5 text-muted-foreground mt-0.5" />
                    <div>
                      <p className="text-muted-foreground">Sector</p>
                      <p className="font-medium">{unidad.sector?.name || 'Sin asignar'}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <Gauge className="h-3.5 w-3.5 text-muted-foreground mt-0.5" />
                    <div>
                      <p className="text-muted-foreground">Medidor</p>
                      <p className="font-medium">
                        {unidad.kilometraje !== null && unidad.kilometraje !== undefined
                          ? formatMeter(unidad.kilometraje)
                          : 'Sin dato'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <Calendar className="h-3.5 w-3.5 text-muted-foreground mt-0.5" />
                    <div>
                      <p className="text-muted-foreground">Próximo service</p>
                      <p className={cn(
                        'font-medium',
                        nextService?.isOverdue && 'text-destructive'
                      )}>
                        {nextService?.text || 'Sin programar'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <Clock className="h-3.5 w-3.5 text-muted-foreground mt-0.5" />
                    <div>
                      <p className="text-muted-foreground">Último service</p>
                      <p className="font-medium">
                        {unidad.ultimoMantenimiento
                          ? formatDate(unidad.ultimoMantenimiento)
                          : 'Sin dato'}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Datos adicionales */}
                <Card>
                  <CardHeader className="py-3">
                    <CardTitle className="text-xs font-medium">Datos generales</CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0 space-y-2 text-xs">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Patente</span>
                      <span className="font-medium">{unidad.patente || '-'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Año</span>
                      <span className="font-medium">{unidad.año || '-'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">OTs abiertas</span>
                      <span className="font-medium">{openWorkOrders.length}</span>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Tab Kilometraje */}
              <TabsContent value="km" className="mt-4">
                <KilometrajeHistory
                  unidadId={unidad.id}
                  unidadNombre={unidad.nombre}
                  kilometrajeActual={unidad.kilometraje || 0}
                  canEdit={canEdit}
                />
              </TabsContent>

              {/* Tab OTs */}
              <TabsContent value="ots" className="space-y-3 mt-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">
                    {workOrders.length} {workOrders.length === 1 ? 'orden' : 'órdenes'}
                  </span>
                  {onCreateWorkOrder && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onCreateWorkOrder(unidad)}
                      className="h-7 text-xs"
                    >
                      <Wrench className="h-3 w-3 mr-1" />
                      Nueva OT
                    </Button>
                  )}
                </div>

                {workOrders.length === 0 ? (
                  <div className="py-8 text-center">
                    <Wrench className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                    <p className="text-xs text-muted-foreground">Sin órdenes de trabajo</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {workOrders.map((wo) => (
                      <Card key={wo.id} className="p-3">
                        <h4 className="text-xs font-medium">{wo.title}</h4>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant="outline" className="text-[10px] h-4">
                            {wo.status}
                          </Badge>
                          {wo.scheduledDate && (
                            <span className="text-[10px] text-muted-foreground">
                              {formatDate(wo.scheduledDate)}
                            </span>
                          )}
                        </div>
                      </Card>
                    ))}
                  </div>
                )}
              </TabsContent>

              {/* Tab Documentos */}
              <TabsContent value="docs" className="space-y-3 mt-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <FileText className="h-3 w-3" />
                    {documentsQuery.data?.length || 0} documentos
                  </span>
                  {canEdit && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isUploading}
                      className="h-7 text-xs"
                    >
                      {isUploading ? (
                        <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                      ) : (
                        <Upload className="h-3 w-3 mr-1" />
                      )}
                      Subir
                    </Button>
                  )}
                </div>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept={ALLOWED_EXTENSIONS.map(ext => `.${ext}`).join(',')}
                  onChange={handleFileUpload}
                  className="hidden"
                  disabled={isUploading}
                />

                {uploadError && (
                  <div className="text-xs text-destructive bg-destructive/10 p-2 rounded">
                    {uploadError}
                  </div>
                )}

                {documentsQuery.isLoading ? (
                  <div className="py-8 text-center">
                    <Loader2 className="h-6 w-6 text-muted-foreground mx-auto mb-2 animate-spin" />
                    <p className="text-xs text-muted-foreground">Cargando...</p>
                  </div>
                ) : !documentsQuery.data || documentsQuery.data.length === 0 ? (
                  <div className="py-8 text-center">
                    <FileText className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                    <p className="text-xs text-muted-foreground">Sin documentos</p>
                    {canEdit && (
                      <p className="text-[10px] text-muted-foreground mt-1">
                        Sube seguros, certificados y más
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="space-y-2">
                    {documentsQuery.data.map((doc: any) => (
                      <div
                        key={doc.id}
                        className="flex items-center justify-between p-2 bg-muted/50 rounded-lg border"
                      >
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          {getFileIcon(doc.originalName || doc.fileName)}
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium truncate">
                              {doc.originalName || doc.fileName || 'Documento'}
                            </p>
                            <p className="text-[10px] text-muted-foreground">
                              {formatFileSize(doc.fileSize)}
                              {doc.uploadDate && (
                                <> • {format(new Date(doc.uploadDate), 'dd/MM/yyyy', { locale: es })}</>
                              )}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setSelectedDoc({
                                url: doc.url,
                                fileName: doc.originalName || doc.fileName || 'Documento'
                              });
                              setViewerOpen(true);
                            }}
                            className="h-7 w-7 p-0"
                            title="Ver archivo"
                          >
                            <Eye className="h-3 w-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => window.open(doc.url, '_blank')}
                            className="h-7 w-7 p-0"
                            title="Descargar"
                          >
                            <Download className="h-3 w-3" />
                          </Button>
                          {canEdit && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteDocument(doc.id)}
                              className="h-7 w-7 p-0 text-destructive hover:bg-destructive/10"
                            >
                              <X className="h-3 w-3" />
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>

              {/* Tab Historial */}
              <TabsContent value="historial" className="space-y-3 mt-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <History className="h-3 w-3" />
                    {timeline.length} eventos
                  </span>
                  {workOrders.length > 0 && (
                    <span className="text-[10px] text-muted-foreground">
                      {completedWorkOrders.length} completadas
                    </span>
                  )}
                </div>

                {timeline.length === 0 ? (
                  <div className="py-8 text-center">
                    <History className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                    <p className="text-xs text-muted-foreground">Sin historial</p>
                  </div>
                ) : (
                  <div className="relative">
                    <div className="absolute left-3 top-2 bottom-2 w-px bg-border" />
                    <div className="space-y-2">
                      {timeline.map((event) => {
                        const IconComponent = timelineIconMap[event.icon] || Clock;
                        const statusColor = event.status ? timelineStatusColors[event.status] : 'bg-muted';

                        return (
                          <div key={event.id} className="relative flex gap-3 pl-0">
                            <div className={cn(
                              'relative z-10 p-1 rounded-full shrink-0',
                              statusColor
                            )}>
                              <IconComponent className="h-3 w-3" />
                            </div>
                            <div className="flex-1 min-w-0 py-0.5">
                              <p className="text-xs font-medium truncate">{event.title}</p>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <p className="text-[10px] text-muted-foreground">
                                    {formatDistanceToNow(new Date(event.date), { addSuffix: true, locale: es })}
                                  </p>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p className="text-xs">{formatDate(event.date)}</p>
                                </TooltipContent>
                              </Tooltip>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </SheetBody>
        </SheetContent>
      </Sheet>

      {/* Visor de archivos */}
      {selectedDoc && (
        <FileViewer
          url={selectedDoc.url}
          fileName={selectedDoc.fileName}
          open={viewerOpen}
          onClose={() => {
            setViewerOpen(false);
            setSelectedDoc(null);
          }}
        />
      )}
    </TooltipProvider>
  );
}
