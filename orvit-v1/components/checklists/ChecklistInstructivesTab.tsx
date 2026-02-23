'use client';

import React, { useState, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { RichTextEditor } from '@/components/ui/rich-text-editor';
import { sanitizeHtml } from '@/lib/sanitize';
import {
  BookOpen,
  Plus,
  FileText,
  AlertCircle,
  Trash2,
  Edit3,
  Loader2
} from 'lucide-react';
import { useChecklistInstructives, ChecklistInstructive } from '@/hooks/mantenimiento/use-checklist-instructives';
import { useUpsertChecklistInstructives } from '@/hooks/mantenimiento/use-upsert-checklist-instructives';
import { useToast } from '@/hooks/use-toast';

interface ChecklistInstructivesTabProps {
  checklistId: number;
}

interface DraftInstructive {
  id: string;
  title: string;
  content: string;
}

// Utilidad para validar si el HTML está vacío (ignorando <br>, <p><br></p>, etc.)
function isContentEmpty(html: string): boolean {
  if (!html || html.trim() === '') return true;
  
  // Remover espacios, saltos de línea y tags vacíos comunes
  const cleaned = html
    .replace(/<br\s*\/?>/gi, '')
    .replace(/<p><\/p>/gi, '')
    .replace(/<p>\s*<\/p>/gi, '')
    .replace(/&nbsp;/gi, '')
    .replace(/\s+/g, '')
    .trim();
  
  return cleaned === '' || cleaned === '<p></p>';
}

export function ChecklistInstructivesTab({ checklistId }: ChecklistInstructivesTabProps) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data: existingInstructives = [], isLoading, error, refetch } = useChecklistInstructives(checklistId);
  const { mutate: upsertInstructives, isPending: isSaving } = useUpsertChecklistInstructives();
  
  const [draftInstructives, setDraftInstructives] = useState<DraftInstructive[]>([]);
  const [currentInstructive, setCurrentInstructive] = useState({ title: '', content: '' });
  const [editingId, setEditingId] = useState<string | number | null>(null);

  // Combinar instructivos existentes con drafts
  const allInstructives = useMemo(() => {
    const existing = existingInstructives.map(inst => ({
      id: inst.id,
      title: inst.title,
      content: inst.content,
      isDraft: false,
      createdAt: inst.createdAt,
      updatedAt: inst.updatedAt,
    }));
    
    const drafts = draftInstructives.map(draft => ({
      id: draft.id,
      title: draft.title,
      content: draft.content,
      isDraft: true,
    }));
    
    return [...existing, ...drafts];
  }, [existingInstructives, draftInstructives]);

  // Validar si se puede agregar
  const canAdd = useMemo(() => {
    return currentInstructive.title.trim().length >= 3 && !isContentEmpty(currentInstructive.content);
  }, [currentInstructive.title, currentInstructive.content]);

  // Validar si hay cambios para guardar
  const hasChanges = useMemo(() => {
    return draftInstructives.length > 0 || editingId !== null;
  }, [draftInstructives.length, editingId]);

  const handleAddInstructive = () => {
    if (!canAdd) {
      toast({
        title: 'Error',
        description: 'Por favor completa el título (mínimo 3 caracteres) y el contenido del instructivo',
        variant: 'destructive',
      });
      return;
    }

    const newInstructive: DraftInstructive = {
      id: `draft_${Date.now()}`,
      title: currentInstructive.title.trim(),
      content: currentInstructive.content,
    };

    setDraftInstructives(prev => [...prev, newInstructive]);
    setCurrentInstructive({ title: '', content: '' });
    
    toast({
      title: 'Instructivo agregado',
      description: 'El instructivo ha sido agregado. Recuerda guardar los cambios.',
    });
  };

  const handleDeleteDraft = (id: string) => {
    setDraftInstructives(prev => prev.filter(inst => inst.id !== id));
    toast({
      title: 'Instructivo eliminado',
      description: 'El instructivo ha sido eliminado de los borradores.',
    });
  };

  const handleEdit = (id: string | number) => {
    const instructive = allInstructives.find(inst => inst.id === id);
    if (instructive) {
      setCurrentInstructive({
        title: instructive.title,
        content: instructive.content,
      });
      setEditingId(id);
      
      // Si es un draft, eliminarlo de la lista de drafts
      if (instructive.isDraft) {
        setDraftInstructives(prev => prev.filter(inst => inst.id !== id));
      }
    }
  };

  const handleSave = () => {
    if (allInstructives.length === 0) {
      toast({
        title: 'Error',
        description: 'No hay instructivos para guardar',
        variant: 'destructive',
      });
      return;
    }

    // Preparar instructivos para guardar
    const instructivesToSave = allInstructives
      .filter(inst => !inst.isDraft || inst.id !== editingId) // Excluir el que se está editando si es draft
      .map(inst => ({
        id: inst.isDraft ? undefined : inst.id,
        title: inst.title,
        content: inst.content,
      }));

    // Si hay uno en edición, agregarlo/actualizarlo
    if (editingId !== null) {
      const editingInstructive = allInstructives.find(inst => inst.id === editingId);
      if (editingInstructive) {
        const existingIndex = instructivesToSave.findIndex(inst => 
          !editingInstructive.isDraft && inst.id === editingInstructive.id
        );
        
        if (existingIndex >= 0) {
          // Actualizar existente
          instructivesToSave[existingIndex] = {
            id: editingInstructive.id,
            title: currentInstructive.title.trim(),
            content: currentInstructive.content,
          };
        } else {
          // Agregar nuevo
          instructivesToSave.push({
            title: currentInstructive.title.trim(),
            content: currentInstructive.content,
          });
        }
      }
    }

    upsertInstructives(
      {
        checklistId,
        instructives: instructivesToSave,
      },
      {
        onSuccess: () => {
          toast({
            title: 'Instructivos guardados',
            description: 'Los instructivos se han guardado correctamente',
          });
          setDraftInstructives([]);
          setCurrentInstructive({ title: '', content: '' });
          setEditingId(null);
        },
        onError: (error) => {
          toast({
            title: 'Error',
            description: error.message || 'No se pudieron guardar los instructivos',
            variant: 'destructive',
          });
        },
      }
    );
  };

  // Estados de carga
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-64" />
          <Skeleton className="h-4 w-full mt-2" />
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-10 w-full" />
          </div>
          <div className="space-y-2">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-64 w-full" />
          </div>
          <div className="flex gap-2">
            <Skeleton className="h-10 w-40" />
            <Skeleton className="h-10 w-40" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Error al cargar los instructivos</AlertTitle>
        <AlertDescription className="flex items-center justify-between">
          <span>No se pudieron cargar los instructivos del checklist.</span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              queryClient.invalidateQueries({ queryKey: ['checklist-instructives', checklistId] });
              refetch();
            }}
            className="ml-4"
          >
            Reintentar
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm">
            <BookOpen className="h-3.5 w-3.5" />
            Instructivos del Checklist
          </CardTitle>
          <p className="text-xs text-muted-foreground mt-2">
            Crea instructivos detallados con imágenes para guiar la ejecución del checklist. 
            Puedes pegar imágenes directamente con Ctrl+V o Cmd+V.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Formulario para nuevo/editar instructivo */}
          <div className="space-y-4">
            <h4 className="font-medium text-xs">
              {editingId !== null ? 'Editar instructivo' : draftInstructives.length > 0 ? 'Agregar otro instructivo' : 'Crear nuevo instructivo'}
            </h4>
            
            <div className="space-y-2">
              <Label htmlFor="instructiveTitle" className="text-xs">Título del instructivo *</Label>
              <Input
                id="instructiveTitle"
                value={currentInstructive.title}
                onChange={(e) => setCurrentInstructive({ ...currentInstructive, title: e.target.value })}
                placeholder="Ej: Procedimiento de limpieza de filtros"
                className="h-9 text-sm"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="instructiveContent" className="text-xs">Contenido del instructivo *</Label>
              <RichTextEditor
                value={currentInstructive.content}
                onChange={(content) => setCurrentInstructive({ ...currentInstructive, content })}
                placeholder="Escribe el contenido del instructivo aquí... Puedes pegar imágenes con Ctrl+V o Cmd+V"
              />
            </div>

            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={editingId !== null ? () => {
                  setCurrentInstructive({ title: '', content: '' });
                  setEditingId(null);
                } : handleAddInstructive}
                disabled={!canAdd}
                className="flex-1 h-9 text-xs"
              >
                {editingId !== null ? (
                  <>
                    Cancelar Edición
                  </>
                ) : (
                  <>
                    <Plus className="h-3.5 w-3.5 mr-2" />
                    Agregar Instructivo
                  </>
                )}
              </Button>
              
              <Button
                type="button"
                size="sm"
                onClick={handleSave}
                disabled={isSaving || allInstructives.length === 0}
                className="flex-1 h-9 text-xs"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" />
                    Guardando...
                  </>
                ) : (
                  <>
                    <FileText className="h-3.5 w-3.5 mr-2" />
                    Guardar Instructivos
                  </>
                )}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Lista de instructivos existentes */}
      {allInstructives.length > 0 ? (
        <div className="space-y-3">
          <h4 className="font-medium text-xs">Instructivos agregados ({allInstructives.length})</h4>
          {allInstructives.map((instructive) => (
            <Card key={instructive.id} className="border rounded-lg">
              <CardContent className="p-4 bg-muted/30">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h5 className="font-medium text-sm">{instructive.title}</h5>
                      {instructive.isDraft && (
                        <span className="text-xs bg-warning-muted text-warning-muted-foreground px-2 py-0.5 rounded">
                          Borrador
                        </span>
                      )}
                    </div>
                    {instructive.createdAt && (
                      <p className="text-xs text-muted-foreground mb-2">
                        {new Date(instructive.createdAt).toLocaleDateString('es-AR', {
                          day: '2-digit',
                          month: '2-digit',
                          year: 'numeric',
                        })}
                      </p>
                    )}
                    <div 
                      className="text-xs text-muted-foreground mt-2 prose prose-sm max-w-none"
                      dangerouslySetInnerHTML={{
                        __html: sanitizeHtml(instructive.content.substring(0, 200) + (instructive.content.length > 200 ? '...' : ''))
                      }}
                    />
                    {instructive.content.length > 200 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          // Aquí podrías abrir un modal para ver el contenido completo
                          // Por ahora, simplemente editamos
                          handleEdit(instructive.id);
                        }}
                        className="mt-2 h-7 text-xs"
                      >
                        Ver completo / Editar
                      </Button>
                    )}
                  </div>
                  <div className="flex gap-1 ml-4">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => handleEdit(instructive.id)}
                      className="text-primary hover:bg-primary/10"
                      title="Editar instructivo"
                    >
                      <Edit3 className="h-4 w-4" />
                    </Button>
                    {instructive.isDraft && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteDraft(instructive.id as string)}
                        className="text-destructive hover:bg-destructive/10"
                        title="Eliminar borrador"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <BookOpen className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-sm text-muted-foreground">No hay instructivos cargados</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

