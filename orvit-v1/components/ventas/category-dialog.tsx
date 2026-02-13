'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogBody, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, FolderPlus } from 'lucide-react';
import { Category } from '@/lib/types/sales';
import { toast } from 'sonner';

const categorySchema = z.object({
  name: z.string().min(1, 'El nombre es requerido'),
  description: z.string().optional()
});

type CategoryFormData = z.infer<typeof categorySchema>;

interface CategoryDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onCategoryCreated: (category: Category) => void;
  category?: Category; // Para edición
}

export function CategoryDialog({ isOpen, onClose, onCategoryCreated, category }: CategoryDialogProps) {
  const [isLoading, setIsLoading] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors }
  } = useForm<CategoryFormData>({
    resolver: zodResolver(categorySchema),
    defaultValues: {
      name: category?.name || '',
      description: category?.description || ''
    }
  });

  const onSubmit = async (data: CategoryFormData) => {
    setIsLoading(true);
    try {
      const url = category ? `/api/categories/${category.id}` : '/api/categories';
      const method = category ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(data)
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Error al guardar categoría');
      }

      const savedCategory = await response.json();
      onCategoryCreated(savedCategory);
      
      toast.success(
        category 
          ? 'Categoría actualizada correctamente'
          : 'Categoría creada correctamente'
      );
      
      reset();
      onClose();
    } catch (error) {
      console.error('Error saving category:', error);
      toast.error(error instanceof Error ? error.message : 'Error al guardar categoría');
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent size="sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FolderPlus className="w-5 h-5" />
            {category ? 'Editar Categoria' : 'Nueva Categoria'}
          </DialogTitle>
        </DialogHeader>

        <DialogBody>
          <form id="category-form" onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <Label htmlFor="name">Nombre de la Categoria *</Label>
              <Input
                id="name"
                {...register('name')}
                placeholder="Ej: Bloques, Cemento, Arena..."
                className={errors.name ? 'border-destructive' : ''}
              />
              {errors.name && (
                <p className="text-sm text-destructive mt-1">{errors.name.message}</p>
              )}
            </div>

            <div>
              <Label htmlFor="description">Descripcion (opcional)</Label>
              <Textarea
                id="description"
                {...register('description')}
                placeholder="Descripcion de la categoria..."
                rows={3}
              />
            </div>
          </form>
        </DialogBody>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={handleClose}
            disabled={isLoading}
          >
            Cancelar
          </Button>
          <Button
            type="submit"
            form="category-form"
            disabled={isLoading}
          >
            {isLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            {category ? 'Actualizar' : 'Crear Categoria'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
} 