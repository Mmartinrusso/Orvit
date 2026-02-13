'use client';

import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { BookOpen, Edit } from 'lucide-react';

interface NotesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  moduleName: string;
  storageKey: string;
}

export function NotesDialog({ open, onOpenChange, moduleName, storageKey }: NotesDialogProps) {
  const [notesContent, setNotesContent] = useState('');
  const [isEditingNotes, setIsEditingNotes] = useState(false);

  // Cargar notas al abrir el modal
  useEffect(() => {
    if (open) {
      const savedNotes = localStorage.getItem(storageKey) || '';
      setNotesContent(savedNotes);
      setIsEditingNotes(false);
    }
  }, [open, storageKey]);

  const handleSave = () => {
    localStorage.setItem(storageKey, notesContent);
    setIsEditingNotes(false);
  };

  const handleCancel = () => {
    const savedNotes = localStorage.getItem(storageKey) || '';
    setNotesContent(savedNotes);
    setIsEditingNotes(false);
  };

  const handleEdit = () => {
    setIsEditingNotes(true);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-amber-700" />
            Notas de {moduleName}
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          {isEditingNotes ? (
            <div className="space-y-2">
              <label className="text-sm font-medium">Notas Generales</label>
              <Textarea
                value={notesContent}
                onChange={(e) => setNotesContent(e.target.value)}
                placeholder={`Escribe notas generales sobre ${moduleName.toLowerCase()}...`}
                rows={10}
                className="min-h-[250px]"
              />
              <p className="text-xs text-muted-foreground">
                Puedes agregar observaciones, recordatorios o cualquier información relevante.
              </p>
            </div>
          ) : (
            <>
              {notesContent ? (
                <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
                  <p className="text-sm text-amber-900 whitespace-pre-wrap leading-relaxed">
                    {notesContent}
                  </p>
                </div>
              ) : (
                <div className="p-8 text-center">
                  <BookOpen className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                  <p className="text-muted-foreground">
                    No hay notas registradas.
                  </p>
                  <p className="text-sm text-muted-foreground mt-2">
                    Haz clic en &quot;Editar&quot; para agregar notas.
                  </p>
                </div>
              )}
            </>
          )}
          
          <div className="flex justify-end gap-2">
            {isEditingNotes ? (
              <>
                <Button variant="outline" onClick={handleCancel}>
                  Cancelar
                </Button>
                <Button onClick={handleSave}>
                  Guardar
                </Button>
              </>
            ) : (
              <>
                <Button variant="outline" onClick={handleEdit}>
                  <Edit className="h-4 w-4 mr-2" />
                  {notesContent ? 'Editar' : 'Agregar Notas'}
                </Button>
                <Button variant="outline" onClick={() => onOpenChange(false)}>
                  Cerrar
                </Button>
              </>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

