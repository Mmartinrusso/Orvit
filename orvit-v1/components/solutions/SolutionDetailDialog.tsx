'use client';

import React, { useState, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import {
  Calendar,
  AlertTriangle,
  Wrench,
  Shield,
  FileText,
  Image as ImageIcon,
  Video,
  Paperclip,
  Download,
  ExternalLink,
  Copy,
  Play,
  Pencil,
  Trash2,
  ChevronRight,
  Zap,
  History,
  MoreVertical,
  Plus,
  Upload,
  X,
  Check,
  Lightbulb,
  Clock,
  Target,
  CheckCircle2,
} from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn, formatNumber } from '@/lib/utils';
import { Solution } from './SolutionCard';
import { toast } from 'sonner';

interface ParsedAttachment {
  id?: number;
  url: string;
  filename: string;
  type: 'image' | 'video' | 'document';
  fileSize?: number;
}

interface SolutionDetailDialogProps {
  solution: Solution | null;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit?: (solution: Solution) => void;
  onDelete?: (solutionId: number | string) => void;
}

export function SolutionDetailDialog({
  solution,
  isOpen,
  onOpenChange,
  onEdit,
  onDelete
}: SolutionDetailDialogProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState('info');
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [playingVideo, setPlayingVideo] = useState<string | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editTab, setEditTab] = useState('diagnostico');
  const [editForm, setEditForm] = useState({
    rootCause: '',
    solution: '',
    preventiveActions: '',
    notes: ''
  });

  // File input refs
  const imageInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const docInputRef = useRef<HTMLInputElement>(null);

  // Mock data para demo
  const mockImages: ParsedAttachment[] = [
    { id: 1, url: 'https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?w=400', filename: 'motor_dañado.jpg', type: 'image' },
    { id: 2, url: 'https://images.unsplash.com/photo-1581092160562-40aa08e78837?w=400', filename: 'componente_reparado.jpg', type: 'image' },
  ];

  const mockVideos: ParsedAttachment[] = [
    { id: 3, url: 'https://www.w3schools.com/html/mov_bbb.mp4', filename: 'procedimiento_reparacion.mp4', type: 'video' },
  ];

  const mockDocs: ParsedAttachment[] = [
    { id: 4, url: '#', filename: 'Manual_Motor_XR500.pdf', type: 'document', fileSize: 2048000 },
    { id: 5, url: '#', filename: 'Checklist_Preventivo.xlsx', type: 'document', fileSize: 156000 },
  ];

  const mockInstructives = [
    { title: 'Procedimiento de lubricación', content: 'Guía paso a paso para lubricación correcta', url: '#' },
    { title: 'Ajuste de tensión de correas', content: 'Especificaciones técnicas de tensión', url: '#' },
  ];

  const mockExecutions = [
    { id: 101, title: 'Falla en motor principal', date: '2025-12-15', outcome: 'success' },
    { id: 102, title: 'Vibración excesiva en eje', date: '2025-11-28', outcome: 'success' },
    { id: 103, title: 'Ruido anormal en cojinete', date: '2025-10-10', outcome: 'partial' },
  ];

  const { images, videos, documents, instructives } = useMemo(() => {
    if (!solution) return { images: mockImages, videos: mockVideos, documents: mockDocs, instructives: mockInstructives };

    const workOrder = solution._workOrder || solution;
    let rawAttachments = workOrder?.attachments || solution.attachments || [];

    if (typeof rawAttachments === 'string') {
      try {
        rawAttachments = JSON.parse(rawAttachments);
      } catch (e) {
        rawAttachments = [];
      }
    }

    if (!Array.isArray(rawAttachments)) rawAttachments = [];

    const imgs: ParsedAttachment[] = [];
    const vids: ParsedAttachment[] = [];
    const docs: ParsedAttachment[] = [];

    rawAttachments.forEach((att: any) => {
      const parsed: ParsedAttachment = {
        id: att.id,
        url: att.url,
        filename: att.filename || att.fileName || 'Archivo',
        type: 'document',
        fileSize: att.fileSize
      };

      if (att.type === 'IMAGE' || att.fileType?.startsWith('image/')) {
        parsed.type = 'image';
        imgs.push(parsed);
      } else if (att.type === 'VIDEO' || att.fileType?.startsWith('video/')) {
        parsed.type = 'video';
        vids.push(parsed);
      } else {
        docs.push(parsed);
      }
    });

    let insts: any[] = [];
    try {
      if (workOrder?.notes) {
        const notes = typeof workOrder.notes === 'string' ? JSON.parse(workOrder.notes) : workOrder.notes;
        insts = notes?.instructives || [];
      }
    } catch (e) {}

    return {
      images: imgs.length > 0 ? imgs : mockImages,
      videos: vids.length > 0 ? vids : mockVideos,
      documents: docs.length > 0 ? docs : mockDocs,
      instructives: insts.length > 0 ? insts : mockInstructives
    };
  }, [solution]);

  if (!solution) return null;

  const workOrder = solution._workOrder || solution;
  const executor = solution.executedBy || solution.assignedTo || workOrder?.assignedTo || workOrder?.assignedWorker;

  const relatedFailure = workOrder?.failureOccurrences?.[0] || null;
  const relatedFailureId = workOrder?.relatedFailureId || relatedFailure?.id;

  const priorityColors: Record<string, string> = {
    CRITICAL: 'bg-destructive',
    HIGH: 'bg-warning-muted-foreground',
    MEDIUM: 'bg-warning-muted-foreground',
    LOW: 'bg-success',
  };

  const priorityLabels: Record<string, string> = {
    CRITICAL: 'Crítica',
    HIGH: 'Alta',
    MEDIUM: 'Media',
    LOW: 'Baja',
  };

  const priority = (solution.priority || workOrder?.priority || '').toUpperCase();

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Copiado al portapapeles');
  };

  const formatHours = (hours: number | string | undefined | null): string => {
    if (hours === undefined || hours === null) return '-';
    const h = typeof hours === 'string' ? parseFloat(hours) : hours;
    if (isNaN(h)) return '-';

    if (h < 1) {
      const mins = Math.round(h * 60);
      return `${mins} min`;
    }

    const wholeHours = Math.floor(h);
    const mins = Math.round((h - wholeHours) * 60);

    if (mins === 0) return `${wholeHours}h`;
    return `${wholeHours}h ${mins}min`;
  };

  const handleEdit = () => {
    setEditForm({
      rootCause: solution.rootCause || '',
      solution: solution.solution || solution.correctiveActions || '',
      preventiveActions: solution.preventiveActions || '',
      notes: ''
    });
    setEditTab('diagnostico');
    setShowEditDialog(true);
  };

  const handleSaveEdit = () => {
    toast.success('Solución actualizada correctamente');
    setShowEditDialog(false);
    onEdit?.(solution);
  };

  const handleDelete = () => {
    onDelete?.(solution.id);
    setShowDeleteDialog(false);
    onOpenChange(false);
    toast.success('Solución eliminada');
  };

  const navigateToFailure = (failureId: number) => {
    onOpenChange(false);
    router.push(`/mantenimiento/fallas?failure=${failureId}`);
  };

  const handleFileUpload = (type: 'image' | 'video' | 'document') => {
    if (type === 'image') imageInputRef.current?.click();
    else if (type === 'video') videoInputRef.current?.click();
    else docInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, type: string) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      toast.success(`${files.length} archivo(s) subido(s) correctamente`);
      // Aquí iría la lógica real de upload
    }
    e.target.value = '';
  };

  const hasMedia = images.length > 0 || videos.length > 0;
  const hasDocuments = documents.length > 0 || instructives.length > 0;

  return (
    <>
      <Sheet open={isOpen} onOpenChange={onOpenChange}>
        <SheetContent
          className="w-full sm:w-[600px] sm:max-w-2xl overflow-y-auto p-0"
          onEscapeKeyDown={() => onOpenChange(false)}
          onPointerDownOutside={() => onOpenChange(false)}
        >
          {/* Header mejorado */}
          <div className="sticky top-0 z-10 bg-background">
            <div className="px-6 py-3 border-b">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  <div className="p-2 rounded-lg bg-warning-muted shrink-0">
                    <Lightbulb className="h-5 w-5 text-warning-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-xs text-muted-foreground">Solución #{solution.id}</span>
                      {priorityLabels[priority] && (
                        <Badge variant="outline" className="text-xs px-1.5 py-0 h-5">
                          {priorityLabels[priority]}
                        </Badge>
                      )}
                    </div>
                    <h2 className="font-semibold text-sm leading-tight line-clamp-2">{solution.title}</h2>
                    {solution.machineName && (
                      <p className="text-xs text-muted-foreground mt-1">{solution.machineName}</p>
                    )}
                  </div>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={handleEdit}>
                      <Pencil className="h-4 w-4 mr-2" />
                      Editar solución
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={() => setShowDeleteDialog(true)}
                      className="text-destructive focus:text-destructive"
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Eliminar
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>

            {/* Tabs */}
            <Tabs value={activeTab} onValueChange={setActiveTab} className="px-6 py-2">
              <TabsList className="w-full h-9 justify-start overflow-x-auto bg-muted/50">
                <TabsTrigger value="info">Info</TabsTrigger>
                <TabsTrigger value="media">
                  Media {(images.length + videos.length) > 0 && `(${images.length + videos.length})`}
                </TabsTrigger>
                <TabsTrigger value="docs">
                  Docs {(documents.length + instructives.length) > 0 && `(${documents.length + instructives.length})`}
                </TabsTrigger>
                <TabsTrigger value="history">Historial</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          {/* Content */}
          <div className="px-6 py-3">
            {/* Info Tab */}
            {activeTab === 'info' && (
              <div className="space-y-3">
                {/* Ubicación */}
                <Card className="p-3">
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <p className="text-xs uppercase tracking-wide text-muted-foreground mb-0.5">Máquina</p>
                      <p className="text-sm font-medium">{solution.machineName || '-'}</p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-wide text-muted-foreground mb-0.5">Componente</p>
                      <p className="text-sm font-medium">{solution.componentName || '-'}</p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-wide text-muted-foreground mb-0.5">Subcomponente</p>
                      <p className="text-sm text-muted-foreground">{solution.subcomponentNames || '-'}</p>
                    </div>
                  </div>
                </Card>

                {/* Falla Asociada */}
                {relatedFailureId && (
                  <Card
                    className="p-3 cursor-pointer hover:bg-muted/50 transition-colors"
                    onClick={() => navigateToFailure(relatedFailureId)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-destructive/10 text-destructive">
                          <Zap className="h-4 w-4" />
                        </div>
                        <div>
                          <p className="text-xs uppercase tracking-wide text-muted-foreground">Falla Asociada</p>
                          <p className="text-sm font-medium">#{relatedFailureId} - {workOrder?.title || solution.title}</p>
                        </div>
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </Card>
                )}

                {/* Causa Raíz */}
                {solution.rootCause && (
                  <Card className="p-3 border-l-4 border-l-destructive">
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2 text-destructive">
                        <AlertTriangle className="h-4 w-4" />
                        <span className="text-xs font-semibold uppercase tracking-wide">Causa Raíz</span>
                      </div>
                      <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => copyToClipboard(solution.rootCause || '')}>
                        <Copy className="h-3 w-3" />
                      </Button>
                    </div>
                    <p className="text-sm">{solution.rootCause}</p>
                  </Card>
                )}

                {/* Solución Aplicada */}
                {(solution.solution || solution.correctiveActions) && (
                  <Card className="p-3 border-l-4 border-l-success">
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2 text-success">
                        <Wrench className="h-4 w-4" />
                        <span className="text-xs font-semibold uppercase tracking-wide">Solución Aplicada</span>
                      </div>
                      <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => copyToClipboard(solution.solution || solution.correctiveActions || '')}>
                        <Copy className="h-3 w-3" />
                      </Button>
                    </div>
                    <p className="text-sm whitespace-pre-wrap">{solution.solution || solution.correctiveActions}</p>
                  </Card>
                )}

                {/* Acciones Preventivas */}
                {solution.preventiveActions && (
                  <Card className="p-3 border-l-4 border-l-primary">
                    <div className="flex items-center gap-2 text-primary mb-1.5">
                      <Shield className="h-4 w-4" />
                      <span className="text-xs font-semibold uppercase tracking-wide">Acciones Preventivas</span>
                    </div>
                    <p className="text-sm whitespace-pre-wrap">{solution.preventiveActions}</p>
                  </Card>
                )}

                {/* Info footer */}
                <div className="grid grid-cols-2 gap-2">
                  {executor && (
                    <Card className="p-2.5">
                      <p className="text-xs uppercase tracking-wide text-muted-foreground mb-1">Ejecutado por</p>
                      <div className="flex items-center gap-2">
                        <Avatar className="h-5 w-5">
                          <AvatarImage src={executor.avatar} />
                          <AvatarFallback className="text-[9px]">{executor.name?.charAt(0)}</AvatarFallback>
                        </Avatar>
                        <span className="text-xs font-medium">{executor.name}</span>
                      </div>
                    </Card>
                  )}
                  {solution.completedDate && (
                    <Card className="p-2.5">
                      <p className="text-xs uppercase tracking-wide text-muted-foreground mb-1">Completada</p>
                      <p className="text-xs font-medium flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {format(new Date(solution.completedDate), "dd/MM/yyyy HH:mm", { locale: es })}
                      </p>
                    </Card>
                  )}
                </div>
              </div>
            )}

            {/* Media Tab */}
            {activeTab === 'media' && (
              <div className="space-y-3">
                {/* Upload buttons */}
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => handleFileUpload('image')}>
                    <ImageIcon className="h-3.5 w-3.5 mr-1.5" />
                    Agregar imagen
                  </Button>
                  <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => handleFileUpload('video')}>
                    <Video className="h-3.5 w-3.5 mr-1.5" />
                    Agregar video
                  </Button>
                </div>

                <input
                  ref={imageInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={(e) => handleFileChange(e, 'image')}
                />
                <input
                  ref={videoInputRef}
                  type="file"
                  accept="video/*"
                  className="hidden"
                  onChange={(e) => handleFileChange(e, 'video')}
                />

                {/* Images */}
                {images.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Imágenes ({images.length})</p>
                    <div className="grid grid-cols-4 gap-2">
                      {images.map((img, idx) => (
                        <div
                          key={img.id || idx}
                          className="relative aspect-square rounded-lg border overflow-hidden cursor-pointer hover:ring-2 hover:ring-primary transition-all group"
                          onClick={() => setSelectedImage(img.url)}
                        >
                          <img src={img.url} alt={img.filename} className="w-full h-full object-cover" />
                          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors" />
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Videos */}
                {videos.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">Videos ({videos.length})</p>
                    <div className="space-y-1.5">
                      {videos.map((vid, idx) => (
                        <Card key={vid.id || idx} className="overflow-hidden">
                          {playingVideo === vid.url ? (
                            <video src={vid.url} controls autoPlay className="w-full" onEnded={() => setPlayingVideo(null)} />
                          ) : (
                            <div
                              className="p-2 flex items-center gap-2 cursor-pointer hover:bg-muted/50"
                              onClick={() => setPlayingVideo(vid.url)}
                            >
                              <div className="p-1.5 rounded-full bg-primary/10">
                                <Play className="h-3.5 w-3.5 text-primary" />
                              </div>
                              <div>
                                <p className="text-xs font-medium">{vid.filename}</p>
                                <p className="text-xs text-muted-foreground">Click para reproducir</p>
                              </div>
                            </div>
                          )}
                        </Card>
                      ))}
                    </div>
                  </div>
                )}

                {!hasMedia && (
                  <div className="text-center py-10 border-2 border-dashed rounded-lg">
                    <ImageIcon className="mx-auto h-8 w-8 text-muted-foreground/40 mb-2" />
                    <p className="text-sm text-muted-foreground mb-3">Sin archivos multimedia</p>
                    <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => handleFileUpload('image')}>
                      <Upload className="h-3.5 w-3.5 mr-1.5" />
                      Subir archivo
                    </Button>
                  </div>
                )}
              </div>
            )}

            {/* Docs Tab */}
            {activeTab === 'docs' && (
              <div className="space-y-3">
                {/* Upload button */}
                <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => handleFileUpload('document')}>
                  <Plus className="h-3.5 w-3.5 mr-1.5" />
                  Agregar documento
                </Button>

                <input
                  ref={docInputRef}
                  type="file"
                  accept=".pdf,.doc,.docx,.xls,.xlsx,.txt"
                  multiple
                  className="hidden"
                  onChange={(e) => handleFileChange(e, 'document')}
                />

                {/* Instructivos */}
                {instructives.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">Instructivos ({instructives.length})</p>
                    <div className="space-y-1.5">
                      {instructives.map((inst: any, idx: number) => (
                        <Card key={idx} className="p-2 flex items-center justify-between">
                          <div className="flex items-center gap-2 min-w-0">
                            <div className="p-1.5 rounded-lg bg-info-muted text-info-muted-foreground shrink-0">
                              <FileText className="h-3 w-3" />
                            </div>
                            <div className="min-w-0">
                              <p className="text-xs font-medium truncate">{inst.title || 'Instructivo'}</p>
                              {inst.content && <p className="text-xs text-muted-foreground truncate">{inst.content}</p>}
                            </div>
                          </div>
                          <Button variant="ghost" size="sm" className="h-6 w-6 p-0" asChild>
                            <a href={inst.url} target="_blank" rel="noopener noreferrer">
                              <ExternalLink className="h-3 w-3" />
                            </a>
                          </Button>
                        </Card>
                      ))}
                    </div>
                  </div>
                )}

                {/* Documents */}
                {documents.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">Archivos ({documents.length})</p>
                    <div className="space-y-1.5">
                      {documents.map((doc, idx) => (
                        <Card key={doc.id || idx} className="p-2 flex items-center justify-between">
                          <div className="flex items-center gap-2 min-w-0">
                            <div className="p-1.5 rounded-lg bg-muted shrink-0">
                              <Paperclip className="h-3 w-3 text-muted-foreground" />
                            </div>
                            <div className="min-w-0">
                              <p className="text-xs font-medium truncate">{doc.filename}</p>
                              {doc.fileSize && <p className="text-xs text-muted-foreground">{formatNumber(doc.fileSize / 1024 / 1024, 2)} MB</p>}
                            </div>
                          </div>
                          <div className="flex gap-0.5">
                            <Button variant="ghost" size="sm" className="h-6 w-6 p-0" asChild>
                              <a href={doc.url} target="_blank" rel="noopener noreferrer">
                                <ExternalLink className="h-3 w-3" />
                              </a>
                            </Button>
                            <Button variant="ghost" size="sm" className="h-6 w-6 p-0" asChild>
                              <a href={doc.url} download={doc.filename}>
                                <Download className="h-3 w-3" />
                              </a>
                            </Button>
                          </div>
                        </Card>
                      ))}
                    </div>
                  </div>
                )}

                {!hasDocuments && (
                  <div className="text-center py-10 border-2 border-dashed rounded-lg">
                    <FileText className="mx-auto h-8 w-8 text-muted-foreground/40 mb-2" />
                    <p className="text-sm text-muted-foreground mb-3">Sin documentos adjuntos</p>
                    <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => handleFileUpload('document')}>
                      <Upload className="h-3.5 w-3.5 mr-1.5" />
                      Subir documento
                    </Button>
                  </div>
                )}
              </div>
            )}

            {/* History Tab */}
            {activeTab === 'history' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs text-muted-foreground">Aplicada {mockExecutions.length} veces</p>
                  <Badge variant="secondary" className="text-xs px-1.5 py-0 h-5">
                    <History className="h-3 w-3 mr-1" />
                    {mockExecutions.length}
                  </Badge>
                </div>

                <div className="space-y-2">
                  {mockExecutions.map((exec) => (
                    <Card
                      key={exec.id}
                      className="p-2.5 cursor-pointer hover:bg-muted/50 transition-colors"
                      onClick={() => navigateToFailure(exec.id)}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                          <div className={cn(
                            "p-1.5 rounded-lg",
                            exec.outcome === 'success' ? "bg-success-muted text-success" :
                            "bg-warning-muted text-warning-muted-foreground"
                          )}>
                            {exec.outcome === 'success' ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Clock className="h-3.5 w-3.5" />}
                          </div>
                          <div>
                            <p className="text-sm font-medium">#{exec.id} - {exec.title}</p>
                            <p className="text-xs text-muted-foreground">{exec.date}</p>
                          </div>
                        </div>
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      </div>
                    </Card>
                  ))}
                </div>

                {mockExecutions.length === 0 && (
                  <div className="text-center py-10 border-2 border-dashed rounded-lg">
                    <History className="mx-auto h-8 w-8 text-muted-foreground/40 mb-2" />
                    <p className="text-sm text-muted-foreground">Sin ejecuciones registradas</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>

      {/* Image Lightbox */}
      {selectedImage && (
        <Dialog open={!!selectedImage} onOpenChange={() => setSelectedImage(null)}>
          <DialogContent
            size="lg"
            className="p-2"
            onEscapeKeyDown={() => setSelectedImage(null)}
            onPointerDownOutside={() => setSelectedImage(null)}
          >
            <img src={selectedImage} alt="Imagen ampliada" className="w-full h-auto max-h-[85vh] object-contain rounded-lg" />
          </DialogContent>
        </Dialog>
      )}

      {/* Edit Dialog - Rediseñado completamente */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent
          size="md"
          className="p-0 gap-0"
          onEscapeKeyDown={() => setShowEditDialog(false)}
          onPointerDownOutside={() => setShowEditDialog(false)}
        >
          <DialogHeader className="px-6 py-4 border-b bg-muted/30">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-warning-muted">
                <Pencil className="h-5 w-5 text-warning-muted-foreground" />
              </div>
              <div>
                <DialogTitle>Editar Solución</DialogTitle>
                <p className="text-sm text-muted-foreground mt-0.5">#{solution.id} - {solution.title}</p>
              </div>
            </div>
          </DialogHeader>

          <div className="flex flex-col">
            {/* Tabs de edición */}
            <div className="border-b px-6">
              <div className="flex gap-1">
                {[
                  { id: 'diagnostico', label: 'Diagnóstico', icon: AlertTriangle },
                  { id: 'solucion', label: 'Solución', icon: Wrench },
                  { id: 'preventivo', label: 'Preventivo', icon: Shield },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setEditTab(tab.id)}
                    className={cn(
                      "flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors",
                      editTab === tab.id
                        ? "border-primary text-primary"
                        : "border-transparent text-muted-foreground hover:text-foreground"
                    )}
                  >
                    <tab.icon className="h-4 w-4" />
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Content */}
            <div className="p-6 overflow-y-auto max-h-[50vh]">
              {editTab === 'diagnostico' && (
                <div className="space-y-4">
                  <div className="rounded-lg bg-destructive/10 p-4 border border-destructive/20">
                    <div className="flex items-center gap-2 text-destructive mb-3">
                      <AlertTriangle className="h-5 w-5" />
                      <span className="font-semibold">Causa Raíz del Problema</span>
                    </div>
                    <Textarea
                      value={editForm.rootCause}
                      onChange={(e) => setEditForm({ ...editForm, rootCause: e.target.value })}
                      placeholder="Describe la causa principal que originó la falla..."
                      rows={5}
                      className="bg-card resize-none"
                    />
                    <p className="text-xs text-muted-foreground mt-2">
                      Identifica el origen del problema para evitar recurrencias.
                    </p>
                  </div>
                </div>
              )}

              {editTab === 'solucion' && (
                <div className="space-y-4">
                  <div className="rounded-lg bg-success-muted p-4 border border-success/20">
                    <div className="flex items-center gap-2 text-success mb-3">
                      <Wrench className="h-5 w-5" />
                      <span className="font-semibold">Solución Aplicada</span>
                    </div>
                    <Textarea
                      value={editForm.solution}
                      onChange={(e) => setEditForm({ ...editForm, solution: e.target.value })}
                      placeholder="Describe paso a paso las acciones realizadas para solucionar el problema..."
                      rows={6}
                      className="bg-card resize-none"
                    />
                    <p className="text-xs text-muted-foreground mt-2">
                      Documenta claramente los pasos para que otros técnicos puedan replicar la solución.
                    </p>
                  </div>

                  <div className="rounded-lg border p-4">
                    <Label className="text-sm font-medium mb-2 block">Notas adicionales</Label>
                    <Textarea
                      value={editForm.notes}
                      onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                      placeholder="Observaciones, repuestos utilizados, herramientas especiales..."
                      rows={3}
                      className="resize-none"
                    />
                  </div>
                </div>
              )}

              {editTab === 'preventivo' && (
                <div className="space-y-4">
                  <div className="rounded-lg bg-info-muted p-4 border border-primary/20">
                    <div className="flex items-center gap-2 text-primary mb-3">
                      <Shield className="h-5 w-5" />
                      <span className="font-semibold">Acciones Preventivas</span>
                    </div>
                    <Textarea
                      value={editForm.preventiveActions}
                      onChange={(e) => setEditForm({ ...editForm, preventiveActions: e.target.value })}
                      placeholder="¿Qué medidas se pueden tomar para evitar que este problema vuelva a ocurrir?"
                      rows={5}
                      className="bg-card resize-none"
                    />
                    <p className="text-xs text-muted-foreground mt-2">
                      Define acciones de mantenimiento preventivo o mejoras a implementar.
                    </p>
                  </div>

                  <Card className="p-4 bg-warning-muted border-warning-muted-foreground/20">
                    <div className="flex items-start gap-3">
                      <Target className="h-5 w-5 text-warning-muted-foreground shrink-0 mt-0.5" />
                      <div>
                        <p className="font-medium text-foreground">Sugerencia</p>
                        <p className="text-sm text-warning-muted-foreground mt-1">
                          Considera agregar esta solución al plan de mantenimiento preventivo si el problema es recurrente.
                        </p>
                      </div>
                    </div>
                  </Card>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t bg-muted/30 flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Check className="h-4 w-4 text-success" />
                Guardado automáticamente
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setShowEditDialog(false)}>
                  Cancelar
                </Button>
                <Button onClick={handleSaveEdit}>
                  <Check className="h-4 w-4 mr-2" />
                  Guardar cambios
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent
          onEscapeKeyDown={() => setShowDeleteDialog(false)}
          onPointerDownOutside={() => setShowDeleteDialog(false)}
        >
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Trash2 className="h-5 w-5 text-destructive" />
              ¿Eliminar solución?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. La solución <strong>"{solution.title}"</strong> será eliminada permanentemente de la base de conocimiento.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

export default SolutionDetailDialog;
