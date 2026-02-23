'use client';

import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { formatDate } from '@/lib/date-utils';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Folder,
  FolderOpen,
  FolderPlus,
  FileText,
  File,
  ChevronRight,
  ChevronDown,
  MoreVertical,
  Eye,
  Trash2,
  FolderInput,
  Download,
  Loader2,
  Search,
  X,
  Image as ImageIcon,
  FileSpreadsheet,
  GripVertical,
  Pencil,
  Check,
  FolderX,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { FileViewer, getFileType as getFileViewerType } from '@/components/ui/file-viewer';

// Carpetas predefinidas comunes
const DEFAULT_PREDEFINED_FOLDERS = [
  { id: 'manuales', name: 'Manuales', icon: '📘', order: 0 },
  { id: 'planos', name: 'Planos', icon: '📐', order: 1 },
  { id: 'certificados', name: 'Certificados', icon: '📜', order: 2 },
  { id: 'fotos', name: 'Fotos', icon: '📷', order: 3 },
  { id: 'garantias', name: 'Garantías', icon: '🛡️', order: 4 },
  { id: 'informes', name: 'Informes', icon: '📊', order: 5 },
  { id: 'modelos-3d', name: 'Modelos 3D', icon: '📦', order: 6 },
];

// Storage key para guardar configuración de carpetas
const FOLDER_CONFIG_KEY = 'document_folder_config';

interface FolderConfig {
  id: string;
  name: string;
  icon: string;
  order: number;
  isCustom?: boolean;
}

interface DocumentItem {
  id: number | string;
  url: string;
  fileName: string;
  originalName?: string;
  name?: string;
  type?: string;
  fileSize?: number;
  uploadDate?: string;
  folder?: string | null;
  uploadedBy?: {
    id: number;
    name: string;
    email: string;
  };
}

interface DocumentFolderViewerProps {
  documents: DocumentItem[];
  loading?: boolean;
  error?: string | null;
  canEdit?: boolean;
  onDelete?: (id: string | number) => void;
  onMoveToFolder?: (docId: string | number, folder: string | null) => void;
  onCreateFolder?: (folderName: string) => void;
  storageKey?: string; // Key para persistir configuración de carpetas
}

export function DocumentFolderViewer({
  documents,
  loading = false,
  error = null,
  canEdit = false,
  onDelete,
  onMoveToFolder,
  storageKey = 'default',
}: DocumentFolderViewerProps) {
  // Estados de carpetas
  const [folderConfigs, setFolderConfigs] = useState<FolderConfig[]>([]);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set(['_sin_carpeta']));

  // Estados de búsqueda
  const [searchTerm, setSearchTerm] = useState('');

  // Estados de visualización de documentos
  const [showFileViewer, setShowFileViewer] = useState(false);
  const [selectedDocument, setSelectedDocument] = useState<{ url: string; fileName: string } | null>(null);

  // Estados de drag & drop para documentos
  const [draggingDoc, setDraggingDoc] = useState<DocumentItem | null>(null);
  const [dragOverFolder, setDragOverFolder] = useState<string | null>(null);

  // Estados de drag & drop para carpetas
  const [draggingFolder, setDraggingFolder] = useState<string | null>(null);
  const [dragOverFolderReorder, setDragOverFolderReorder] = useState<string | null>(null);

  // Estados de edición
  const [editingFolderId, setEditingFolderId] = useState<string | null>(null);
  const [editingFolderName, setEditingFolderName] = useState('');
  const editInputRef = useRef<HTMLInputElement>(null);

  // Estados de diálogos
  const [showNewFolderDialog, setShowNewFolderDialog] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [movingDoc, setMovingDoc] = useState<DocumentItem | null>(null);

  // Cargar configuración de carpetas desde localStorage
  useEffect(() => {
    const fullKey = `${FOLDER_CONFIG_KEY}_${storageKey}`;
    const saved = localStorage.getItem(fullKey);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setFolderConfigs(parsed);
      } catch {
        setFolderConfigs([...DEFAULT_PREDEFINED_FOLDERS]);
      }
    } else {
      setFolderConfigs([...DEFAULT_PREDEFINED_FOLDERS]);
    }
  }, [storageKey]);

  // Guardar configuración de carpetas
  const saveFolderConfigs = useCallback((configs: FolderConfig[]) => {
    const fullKey = `${FOLDER_CONFIG_KEY}_${storageKey}`;
    localStorage.setItem(fullKey, JSON.stringify(configs));
    setFolderConfigs(configs);
  }, [storageKey]);

  // Obtener todas las carpetas (configuradas + las que tienen documentos)
  const allFolders = useMemo(() => {
    const docFolders = documents
      .map(d => d.folder)
      .filter((f): f is string => !!f);
    const uniqueDocFolders = [...new Set(docFolders)];

    // Combinar carpetas configuradas con las de documentos
    const configuredIds = new Set(folderConfigs.map(f => f.id));
    const additionalFolders: FolderConfig[] = uniqueDocFolders
      .filter(f => !configuredIds.has(f))
      .map((f, i) => ({
        id: f,
        name: f,
        icon: '📁',
        order: folderConfigs.length + i,
        isCustom: true,
      }));

    return [...folderConfigs, ...additionalFolders].sort((a, b) => a.order - b.order);
  }, [documents, folderConfigs]);

  // Agrupar documentos por carpeta
  const documentsByFolder = useMemo(() => {
    const grouped: Record<string, DocumentItem[]> = {
      _sin_carpeta: [],
    };

    // Inicializar todas las carpetas
    allFolders.forEach(f => {
      grouped[f.id] = [];
    });

    // Filtrar por búsqueda y agrupar
    documents
      .filter(doc => {
        if (!searchTerm) return true;
        const name = (doc.originalName || doc.fileName || '').toLowerCase();
        return name.includes(searchTerm.toLowerCase());
      })
      .forEach(doc => {
        const folder = doc.folder || '_sin_carpeta';
        if (!grouped[folder]) grouped[folder] = [];
        grouped[folder].push(doc);
      });

    return grouped;
  }, [documents, allFolders, searchTerm]);

  // Helpers
  const getFileType = (fileName: string): 'pdf' | 'docx' | 'image' | 'excel' | 'other' => {
    const extension = fileName.toLowerCase().split('.').pop();
    if (extension === 'pdf') return 'pdf';
    if (extension === 'docx' || extension === 'doc') return 'docx';
    if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(extension || '')) return 'image';
    if (['xls', 'xlsx', 'csv'].includes(extension || '')) return 'excel';
    return 'other';
  };

  const getFileIcon = (fileName: string) => {
    const fileType = getFileType(fileName);
    switch (fileType) {
      case 'pdf':
        return <FileText className="h-4 w-4 text-destructive" />;
      case 'docx':
        return <File className="h-4 w-4 text-info" />;
      case 'image':
        return <ImageIcon className="h-4 w-4 text-success" />;
      case 'excel':
        return <FileSpreadsheet className="h-4 w-4 text-success" />;
      default:
        return <FileText className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getFolderInfo = (folderId: string): FolderConfig => {
    const configured = allFolders.find(f => f.id === folderId);
    if (configured) return configured;
    return { id: folderId, name: folderId, icon: '📁', order: 999 };
  };

  const handleViewDocument = (url: string, fileName: string) => {
    setSelectedDocument({ url, fileName });
    setShowFileViewer(true);
  };

  const toggleFolder = (folderId: string) => {
    setExpandedFolders(prev => {
      const newSet = new Set(prev);
      if (newSet.has(folderId)) {
        newSet.delete(folderId);
      } else {
        newSet.add(folderId);
      }
      return newSet;
    });
  };

  // ===== DRAG & DROP PARA DOCUMENTOS =====
  const handleDocDragStart = (e: React.DragEvent, doc: DocumentItem) => {
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', JSON.stringify({ type: 'document', id: doc.id }));
    setDraggingDoc(doc);
  };

  const handleDocDragEnd = () => {
    setDraggingDoc(null);
    setDragOverFolder(null);
  };

  const handleFolderDragOver = (e: React.DragEvent, folderId: string) => {
    e.preventDefault();
    e.stopPropagation();

    // Verificar si estamos arrastrando un documento (usar state o dataTransfer como fallback)
    const hasDocumentData = e.dataTransfer.types.includes('text/plain');

    if (draggingDoc || hasDocumentData) {
      e.dataTransfer.dropEffect = 'move';
      setDragOverFolder(folderId);
    }
  };

  const handleFolderDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOverFolder(null);
  };

  const handleFolderDrop = async (e: React.DragEvent, targetFolderId: string) => {
    e.preventDefault();
    e.stopPropagation();

    setDragOverFolder(null);

    // Intentar obtener el documento del state o del dataTransfer
    let docToMove = draggingDoc;

    if (!docToMove) {
      // Fallback: leer del dataTransfer
      try {
        const data = e.dataTransfer.getData('text/plain');
        if (data) {
          const parsed = JSON.parse(data);
          if (parsed.type === 'document' && parsed.id) {
            // Buscar el documento en la lista
            docToMove = documents.find(d => d.id === parsed.id || String(d.id) === String(parsed.id)) || null;
          }
        }
      } catch {
        // Ignorar errores de parsing
      }
    }

    if (docToMove && onMoveToFolder) {
      const folder = targetFolderId === '_sin_carpeta' ? null : targetFolderId;
      await onMoveToFolder(docToMove.id, folder);
      toast.success(`Documento movido a "${targetFolderId === '_sin_carpeta' ? 'Sin carpeta' : getFolderInfo(targetFolderId).name}"`);
    }

    setDraggingDoc(null);
  };

  // ===== DRAG & DROP PARA REORDENAR CARPETAS =====
  const handleFolderReorderDragStart = (e: React.DragEvent, folderId: string) => {
    if (!canEdit) return;
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', JSON.stringify({ type: 'folder', id: folderId }));
    setDraggingFolder(folderId);
  };

  const handleFolderReorderDragEnd = () => {
    setDraggingFolder(null);
    setDragOverFolderReorder(null);
  };

  const handleFolderReorderDragOver = (e: React.DragEvent, targetFolderId: string) => {
    e.preventDefault();
    if (draggingFolder && draggingFolder !== targetFolderId) {
      e.dataTransfer.dropEffect = 'move';
      setDragOverFolderReorder(targetFolderId);
    }
  };

  const handleFolderReorderDrop = (e: React.DragEvent, targetFolderId: string) => {
    e.preventDefault();
    e.stopPropagation();

    if (!draggingFolder || draggingFolder === targetFolderId) {
      setDraggingFolder(null);
      setDragOverFolderReorder(null);
      return;
    }

    // Reordenar carpetas
    const draggedIndex = allFolders.findIndex(f => f.id === draggingFolder);
    const targetIndex = allFolders.findIndex(f => f.id === targetFolderId);

    if (draggedIndex !== -1 && targetIndex !== -1) {
      const newConfigs = [...allFolders];
      const [removed] = newConfigs.splice(draggedIndex, 1);
      newConfigs.splice(targetIndex, 0, removed);

      // Actualizar órdenes
      const reordered = newConfigs.map((f, i) => ({ ...f, order: i }));
      saveFolderConfigs(reordered);
      toast.success('Carpetas reordenadas');
    }

    setDraggingFolder(null);
    setDragOverFolderReorder(null);
  };

  // ===== RENOMBRAR CARPETAS =====
  const startEditingFolder = (folderId: string) => {
    const folder = getFolderInfo(folderId);
    setEditingFolderId(folderId);
    setEditingFolderName(folder.name);
    // Focus input después del render
    setTimeout(() => editInputRef.current?.focus(), 50);
  };

  const finishEditingFolder = () => {
    if (!editingFolderId || !editingFolderName.trim()) {
      setEditingFolderId(null);
      return;
    }

    const newConfigs = allFolders.map(f =>
      f.id === editingFolderId
        ? { ...f, name: editingFolderName.trim() }
        : f
    );
    saveFolderConfigs(newConfigs);
    toast.success('Carpeta renombrada');
    setEditingFolderId(null);
  };

  const handleEditKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      finishEditingFolder();
    } else if (e.key === 'Escape') {
      setEditingFolderId(null);
    }
  };

  // ===== CREAR CARPETA =====
  const handleCreateFolder = () => {
    if (!newFolderName.trim()) return;

    const folderId = newFolderName.trim().toLowerCase().replace(/\s+/g, '_');

    // Verificar si ya existe
    if (allFolders.some(f => f.id === folderId)) {
      toast.error('Ya existe una carpeta con ese nombre');
      return;
    }

    const newFolder: FolderConfig = {
      id: folderId,
      name: newFolderName.trim(),
      icon: '📁',
      order: allFolders.length,
      isCustom: true,
    };

    saveFolderConfigs([...allFolders, newFolder]);
    setExpandedFolders(prev => new Set([...prev, folderId]));
    setShowNewFolderDialog(false);
    setNewFolderName('');
    toast.success(`Carpeta "${newFolderName.trim()}" creada`);
  };

  // ===== ELIMINAR CARPETA =====
  const handleDeleteFolder = (folderId: string) => {
    const docsInFolder = documentsByFolder[folderId]?.length || 0;
    if (docsInFolder > 0) {
      toast.error(`No se puede eliminar: hay ${docsInFolder} documento(s) en la carpeta`);
      return;
    }

    const newConfigs = allFolders.filter(f => f.id !== folderId);
    saveFolderConfigs(newConfigs);
    toast.success('Carpeta eliminada');
  };

  // ===== MOVER DOCUMENTO (modal) =====
  const handleMoveDoc = async (docId: string | number, targetFolder: string | null) => {
    if (onMoveToFolder) {
      await onMoveToFolder(docId, targetFolder);
      setMovingDoc(null);
      toast.success('Documento movido');
    }
  };

  // ===== RENDER DOCUMENTO =====
  const renderDocument = (doc: DocumentItem) => (
    <div
      key={doc.id}
      draggable={canEdit}
      onDragStart={(e) => handleDocDragStart(e, doc)}
      onDragEnd={handleDocDragEnd}
      className={cn(
        "flex items-center gap-2 p-2 rounded-lg hover:bg-muted/50 transition group",
        draggingDoc?.id === doc.id && "opacity-50 bg-primary/10",
        canEdit && "cursor-grab active:cursor-grabbing"
      )}
    >
      {canEdit && (
        <GripVertical className="h-3 w-3 text-muted-foreground/50 opacity-0 group-hover:opacity-100 transition flex-shrink-0" />
      )}
      <span className="flex-shrink-0">{getFileIcon(doc.originalName || doc.fileName)}</span>
      <button
        className="flex-1 text-left text-sm font-medium hover:text-primary transition truncate"
        onClick={() => handleViewDocument(doc.url, doc.originalName || doc.fileName)}
        title={doc.originalName || doc.fileName}
      >
        {doc.originalName || doc.fileName}
      </button>
      <span className="text-xs text-muted-foreground whitespace-nowrap hidden sm:block">
        {doc.uploadDate ? formatDate(doc.uploadDate) : ''}
      </span>
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              className="p-1 rounded hover:bg-muted"
              onClick={() => handleViewDocument(doc.url, doc.originalName || doc.fileName)}
            >
              <Eye className="h-3.5 w-3.5 text-muted-foreground" />
            </button>
          </TooltipTrigger>
          <TooltipContent>Ver</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <a
              href={doc.url}
              download
              className="p-1 rounded hover:bg-muted"
              onClick={(e) => e.stopPropagation()}
            >
              <Download className="h-3.5 w-3.5 text-muted-foreground" />
            </a>
          </TooltipTrigger>
          <TooltipContent>Descargar</TooltipContent>
        </Tooltip>
        {canEdit && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="p-1 rounded hover:bg-muted">
                <MoreVertical className="h-3.5 w-3.5 text-muted-foreground" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem onClick={() => setMovingDoc(doc)}>
                <FolderInput className="h-4 w-4 mr-2" />
                Mover a carpeta
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              {onDelete && (
                <DropdownMenuItem
                  onClick={() => onDelete(doc.id)}
                  className="text-destructive focus:text-destructive"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Eliminar
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    </div>
  );

  // ===== RENDER CARPETA =====
  const renderFolder = (folder: FolderConfig) => {
    const folderId = folder.id;
    const docs = documentsByFolder[folderId] || [];
    const isExpanded = expandedFolders.has(folderId);
    const hasDocuments = docs.length > 0;
    const isEditing = editingFolderId === folderId;
    const isDragOver = dragOverFolder === folderId;
    const isDragging = draggingFolder === folderId;
    const isReorderTarget = dragOverFolderReorder === folderId;

    return (
      <Collapsible
        key={folderId}
        open={isExpanded}
        onOpenChange={() => !isEditing && toggleFolder(folderId)}
      >
        <div
          className={cn(
            "relative rounded-lg transition-all",
            isDragOver && "ring-2 ring-primary bg-primary/10",
            isDragging && "opacity-50",
            isReorderTarget && "border-t-2 border-primary"
          )}
          onDragOver={(e) => handleFolderDragOver(e, folderId)}
          onDragLeave={handleFolderDragLeave}
          onDrop={(e) => handleFolderDrop(e, folderId)}
        >
          <div
            draggable={canEdit && !isEditing}
            onDragStart={(e) => handleFolderReorderDragStart(e, folderId)}
            onDragEnd={handleFolderReorderDragEnd}
            onDragOver={(e) => {
              if (draggingFolder) {
                handleFolderReorderDragOver(e, folderId);
              }
            }}
            onDrop={(e) => {
              if (draggingFolder) {
                handleFolderReorderDrop(e, folderId);
              }
            }}
            className={cn(
              "flex items-center",
              canEdit && !isEditing && "cursor-grab active:cursor-grabbing"
            )}
          >
            {canEdit && (
              <div className="p-1 opacity-30 hover:opacity-100 transition">
                <GripVertical className="h-4 w-4 text-muted-foreground" />
              </div>
            )}
            <CollapsibleTrigger asChild>
              <button
                className={cn(
                  "flex-1 flex items-center gap-2 p-2 rounded-lg hover:bg-muted/50 transition",
                  !hasDocuments && !isDragOver && "opacity-50"
                )}
                disabled={isEditing}
              >
                {isExpanded ? (
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                )}
                {isExpanded ? (
                  <FolderOpen className="h-4 w-4 text-warning" />
                ) : (
                  <Folder className="h-4 w-4 text-warning" />
                )}
                <span className="mr-1">{folder.icon}</span>

                {isEditing ? (
                  <div className="flex items-center gap-1 flex-1" onClick={(e) => e.stopPropagation()}>
                    <Input
                      ref={editInputRef}
                      value={editingFolderName}
                      onChange={(e) => setEditingFolderName(e.target.value)}
                      onKeyDown={handleEditKeyDown}
                      onBlur={finishEditingFolder}
                      className="h-6 text-sm py-0 px-1"
                      autoFocus
                    />
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-6 w-6 p-0"
                      onClick={(e) => {
                        e.stopPropagation();
                        finishEditingFolder();
                      }}
                    >
                      <Check className="h-3 w-3" />
                    </Button>
                  </div>
                ) : (
                  <span
                    className="flex-1 text-left text-sm font-medium"
                    onDoubleClick={(e) => {
                      if (canEdit) {
                        e.stopPropagation();
                        startEditingFolder(folderId);
                      }
                    }}
                  >
                    {folder.name}
                  </span>
                )}

                <Badge variant="secondary" className="h-5 px-1.5 text-xs">
                  {docs.length}
                </Badge>
              </button>
            </CollapsibleTrigger>

            {canEdit && !isEditing && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="p-1 rounded hover:bg-muted opacity-0 group-hover:opacity-100 transition">
                    <MoreVertical className="h-4 w-4 text-muted-foreground" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-40">
                  <DropdownMenuItem onClick={() => startEditingFolder(folderId)}>
                    <Pencil className="h-4 w-4 mr-2" />
                    Renombrar
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => handleDeleteFolder(folderId)}
                    className="text-destructive focus:text-destructive"
                    disabled={docs.length > 0}
                  >
                    <FolderX className="h-4 w-4 mr-2" />
                    Eliminar carpeta
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </div>
        <CollapsibleContent>
          <div className="ml-6 pl-2 border-l space-y-0.5">
            {docs.length === 0 ? (
              <p className="text-xs text-muted-foreground py-2 pl-2">
                {isDragOver ? '🎯 Soltar documento aquí' : 'Sin documentos'}
              </p>
            ) : (
              docs.map(renderDocument)
            )}
          </div>
        </CollapsibleContent>
      </Collapsible>
    );
  };

  // Loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="animate-spin h-5 w-5 text-muted-foreground" />
        <span className="ml-2 text-sm text-muted-foreground">Cargando documentos...</span>
      </div>
    );
  }

  // Empty state
  if (documents.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="h-16 w-16 mx-auto mb-4 rounded-full bg-muted flex items-center justify-center">
          <Folder className="h-8 w-8 text-muted-foreground" />
        </div>
        <h3 className="text-sm font-medium mb-1">No hay documentos</h3>
        <p className="text-xs text-muted-foreground">
          Se mostrarán aquí cuando se agreguen
        </p>
      </div>
    );
  }

  const totalDocs = documents.length;
  const filteredDocs = Object.values(documentsByFolder).flat().length;

  // Carpetas con documentos y sin documentos
  const foldersWithDocs = allFolders.filter(f => (documentsByFolder[f.id]?.length || 0) > 0);
  const emptyFolders = allFolders.filter(f => (documentsByFolder[f.id]?.length || 0) === 0);

  return (
    <TooltipProvider>
      <div className="space-y-4">
        {/* Header con búsqueda y acciones */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar documentos..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 h-9 text-sm"
            />
            {searchTerm && (
              <button
                className="absolute right-2 top-1/2 -translate-y-1/2"
                onClick={() => setSearchTerm('')}
              >
                <X className="h-4 w-4 text-muted-foreground" />
              </button>
            )}
          </div>
          {canEdit && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-9 gap-1.5"
                  onClick={() => setShowNewFolderDialog(true)}
                >
                  <FolderPlus className="h-4 w-4" />
                  <span className="hidden sm:inline">Nueva carpeta</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent>Crear nueva carpeta</TooltipContent>
            </Tooltip>
          )}
        </div>

        {/* Instrucciones de drag & drop */}
        {canEdit && draggingDoc && (
          <div className="text-xs text-center text-muted-foreground bg-muted/50 py-2 rounded-lg animate-pulse">
            🎯 Arrastra el documento sobre una carpeta para moverlo
          </div>
        )}

        {/* Contador de resultados */}
        {searchTerm && (
          <p className="text-xs text-muted-foreground">
            Mostrando {filteredDocs} de {totalDocs} documentos
          </p>
        )}

        {/* Lista de carpetas */}
        <Card>
          <CardContent className="p-2 space-y-1 group">
            {/* Carpetas con documentos primero */}
            {foldersWithDocs.map(folder => renderFolder(folder))}

            {/* Carpetas vacías colapsadas */}
            {emptyFolders.length > 0 && (
              <Collapsible>
                <CollapsibleTrigger asChild>
                  <button className="w-full flex items-center gap-2 p-2 rounded-lg hover:bg-muted/50 transition text-muted-foreground text-xs">
                    <ChevronRight className="h-3 w-3" />
                    <span>Carpetas vacías ({emptyFolders.length})</span>
                  </button>
                </CollapsibleTrigger>
                <CollapsibleContent className="space-y-1">
                  {emptyFolders.map(folder => renderFolder(folder))}
                </CollapsibleContent>
              </Collapsible>
            )}

            {/* Sin carpeta */}
            {documentsByFolder._sin_carpeta.length > 0 && (
              <div
                className={cn(
                  "rounded-lg transition-all",
                  dragOverFolder === '_sin_carpeta' && "ring-2 ring-primary bg-primary/10"
                )}
                onDragOver={(e) => handleFolderDragOver(e, '_sin_carpeta')}
                onDragLeave={handleFolderDragLeave}
                onDrop={(e) => handleFolderDrop(e, '_sin_carpeta')}
              >
                <Collapsible
                  open={expandedFolders.has('_sin_carpeta')}
                  onOpenChange={() => toggleFolder('_sin_carpeta')}
                >
                  <CollapsibleTrigger asChild>
                    <button className="w-full flex items-center gap-2 p-2 rounded-lg hover:bg-muted/50 transition">
                      {expandedFolders.has('_sin_carpeta') ? (
                        <ChevronDown className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      )}
                      <FileText className="h-4 w-4 text-muted-foreground" />
                      <span className="flex-1 text-left text-sm text-muted-foreground">Sin carpeta</span>
                      <Badge variant="outline" className="h-5 px-1.5 text-xs">
                        {documentsByFolder._sin_carpeta.length}
                      </Badge>
                    </button>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="ml-6 pl-2 border-l space-y-0.5">
                      {documentsByFolder._sin_carpeta.map(renderDocument)}
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              </div>
            )}
          </CardContent>
        </Card>

        {error && <p className="text-xs text-destructive">{error}</p>}

        {/* Visor de archivos universal */}
        {selectedDocument && (
          <FileViewer
            url={selectedDocument.url}
            fileName={selectedDocument.fileName}
            open={showFileViewer}
            onClose={() => {
              setShowFileViewer(false);
              setSelectedDocument(null);
            }}
          />
        )}

        {/* Modal de mover a carpeta */}
        <Dialog open={!!movingDoc} onOpenChange={() => setMovingDoc(null)}>
          <DialogContent size="sm">
            <DialogHeader>
              <DialogTitle className="text-sm flex items-center gap-2">
                <FolderInput className="h-4 w-4" />
                Mover documento
              </DialogTitle>
            </DialogHeader>
            <div className="py-4">
              <p className="text-xs text-muted-foreground mb-3">
                Selecciona la carpeta destino para "{movingDoc?.originalName || movingDoc?.fileName}"
              </p>
              <div className="space-y-1 max-h-64 overflow-y-auto">
                {/* Sin carpeta */}
                <button
                  className={cn(
                    "w-full flex items-center gap-2 p-2 rounded-lg hover:bg-muted/50 transition text-sm",
                    !movingDoc?.folder && "bg-muted"
                  )}
                  onClick={() => movingDoc && handleMoveDoc(movingDoc.id, null)}
                >
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  Sin carpeta
                </button>
                {/* Todas las carpetas */}
                {allFolders.map(folder => (
                  <button
                    key={folder.id}
                    className={cn(
                      "w-full flex items-center gap-2 p-2 rounded-lg hover:bg-muted/50 transition text-sm",
                      movingDoc?.folder === folder.id && "bg-muted"
                    )}
                    onClick={() => movingDoc && handleMoveDoc(movingDoc.id, folder.id)}
                  >
                    <span>{folder.icon}</span>
                    <Folder className="h-4 w-4 text-warning" />
                    {folder.name}
                  </button>
                ))}
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Dialog nueva carpeta */}
        <Dialog open={showNewFolderDialog} onOpenChange={setShowNewFolderDialog}>
          <DialogContent size="sm">
            <DialogHeader>
              <DialogTitle className="text-sm flex items-center gap-2">
                <FolderPlus className="h-4 w-4" />
                Nueva carpeta
              </DialogTitle>
            </DialogHeader>
            <div className="py-4">
              <Input
                placeholder="Nombre de la carpeta"
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleCreateFolder()}
                autoFocus
              />
              <p className="text-xs text-muted-foreground mt-2">
                Tip: Puedes arrastrar documentos directamente sobre las carpetas
              </p>
            </div>
            <DialogFooter>
              <Button variant="outline" size="sm" onClick={() => setShowNewFolderDialog(false)}>
                Cancelar
              </Button>
              <Button size="sm" onClick={handleCreateFolder} disabled={!newFolderName.trim()}>
                Crear carpeta
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </TooltipProvider>
  );
}

export default DocumentFolderViewer;
