'use client';

import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogBody, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Save,
  Tag,
  Palette,
  Loader2
} from 'lucide-react';
import { toast } from 'sonner';

interface Category {
  id?: number;
  name: string;
  description: string;
  icon: string;
  color: string;
}

interface CategoryDialogProps {
  isOpen: boolean;
  onClose: () => void;
  category?: Category | null;
  mode: 'create' | 'edit';
  onSave?: (category: Category) => void;
}

const AVAILABLE_ICONS = [
  { value: '🔨', label: 'Martillo' },
  { value: '🔧', label: 'Llave' },
  { value: '⚡', label: 'Eléctrico' },
  { value: '🔩', label: 'Tornillos' },
  { value: '📐', label: 'Medición' },
  { value: '🧰', label: 'Caja de herramientas' },
  { value: '⚙️', label: 'Engranaje' },
  { value: '🔌', label: 'Enchufe' },
  { value: '💡', label: 'Bombilla' },
  { value: '🛠️', label: 'Herramientas' },
  { value: '🔬', label: 'Microscopio' },
  { value: '📏', label: 'Regla' },
  { value: '🗜️', label: 'Prensa' },
  { value: '⛽', label: 'Combustible' },
  { value: '🧪', label: 'Químicos' }
];

const AVAILABLE_COLORS = [
  { value: 'blue', label: 'Azul', class: 'bg-blue-500' },
  { value: 'green', label: 'Verde', class: 'bg-green-500' },
  { value: 'red', label: 'Rojo', class: 'bg-red-500' },
  { value: 'yellow', label: 'Amarillo', class: 'bg-yellow-500' },
  { value: 'purple', label: 'Morado', class: 'bg-purple-500' },
  { value: 'pink', label: 'Rosa', class: 'bg-pink-500' },
  { value: 'indigo', label: 'Índigo', class: 'bg-indigo-500' },
  { value: 'orange', label: 'Naranja', class: 'bg-orange-500' },
  { value: 'teal', label: 'Verde azulado', class: 'bg-teal-500' },
  { value: 'gray', label: 'Gris', class: 'bg-gray-500' }
];

export default function CategoryDialog({ isOpen, onClose, category, mode, onSave }: CategoryDialogProps) {
  const [formData, setFormData] = useState<Category>({
    name: '',
    description: '',
    icon: '🔨',
    color: 'blue'
  });
  
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      if (category && mode === 'edit') {
        setFormData({
          ...category
        });
      } else if (mode === 'create') {
        setFormData({
          name: '',
          description: '',
          icon: '🔨',
          color: 'blue'
        });
      }
    }
  }, [isOpen, category, mode]);

  const handleSave = async () => {
    if (!formData.name) {
      toast.error('El nombre de la categoría es requerido');
      return;
    }

    setIsLoading(true);
    try {
      let response;
      
      if (mode === 'create') {
        response = await fetch('/api/tools/categories', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData)
        });
      } else if (mode === 'edit' && category?.id) {
        response = await fetch(`/api/tools/categories/${category.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData)
        });
      }

      if (response && response.ok) {
        const data = await response.json();
        toast.success(data.message || 'Operación exitosa');
        onSave?.(data.category);
        onClose();
      } else {
        throw new Error('Error en la operación');
      }
    } catch (error) {
      toast.error('Error al guardar la categoría');
    } finally {
      setIsLoading(false);
    }
  };

  const getColorClass = (color: string) => {
    const colorObj = AVAILABLE_COLORS.find(c => c.value === color);
    return colorObj?.class || 'bg-blue-500';
  };

  const title = mode === 'create' ? 'Nueva Categoría' : 'Editar Categoría';

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent size="md">
        <DialogHeader>
          <DialogTitle className="text-2xl flex items-center gap-2">
            <Tag className="h-6 w-6 text-info-muted-foreground" />
            {title}
          </DialogTitle>
        </DialogHeader>

        <DialogBody>
        <div className="space-y-6">
          {/* Vista previa */}
          <div className="bg-muted p-4 rounded-lg border">
            <h3 className="font-semibold text-foreground mb-3">Vista Previa</h3>
            <div className="flex items-center gap-3">
              <div className={cn('w-12 h-12 rounded-lg flex items-center justify-center text-white text-xl', getColorClass(formData.color))}>
                {formData.icon}
              </div>
              <div>
                <h4 className="font-semibold text-lg text-foreground">{formData.name || 'Nombre de categoría'}</h4>
                <p className="text-sm text-foreground">{formData.description || 'Descripción de la categoría'}</p>
              </div>
            </div>
          </div>

          {/* Información básica */}
          <div className="bg-info-muted p-4 rounded-lg border">
            <h3 className="font-semibold text-info-muted-foreground mb-3 flex items-center gap-2">
              <Tag className="h-4 w-4" />
              Información Básica
            </h3>
            
            <div className="space-y-4">
              <div>
                <Label htmlFor="name">Nombre de Categoría *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Ej: Herramientas Manuales"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      e.stopPropagation();
                      // Buscar el siguiente elemento focusable
                      const currentElement = e.target as HTMLElement;
                      const focusableElements = Array.from(document.querySelectorAll('input, button, select, textarea, [tabindex]:not([tabindex="-1"])'));
                      const currentIndex = focusableElements.indexOf(currentElement);
                      const nextElement = focusableElements[currentIndex + 1] as HTMLElement;
                      
                      if (nextElement) {
                        nextElement.focus();
                      }
                    }
                  }}
                />
              </div>

              <div>
                <Label htmlFor="description">Descripción</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Descripción de la categoría..."
                  rows={3}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      e.stopPropagation();
                      // Buscar el siguiente elemento focusable
                      const currentElement = e.target as HTMLElement;
                      const focusableElements = Array.from(document.querySelectorAll('input, button, select, textarea, [tabindex]:not([tabindex="-1"])'));
                      const currentIndex = focusableElements.indexOf(currentElement);
                      const nextElement = focusableElements[currentIndex + 1] as HTMLElement;
                      
                      if (nextElement) {
                        nextElement.focus();
                      }
                    }
                  }}
                />
              </div>
            </div>
          </div>

          {/* Apariencia */}
          <div className="bg-success-muted p-4 rounded-lg border">
            <h3 className="font-semibold text-success mb-3 flex items-center gap-2">
              <Palette className="h-4 w-4" />
              Apariencia
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="icon">Icono</Label>
                <Select 
                  value={formData.icon} 
                  onValueChange={(value) => setFormData(prev => ({ ...prev, icon: value }))}
                >
                  <SelectTrigger
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        e.stopPropagation();
                        // Buscar el siguiente elemento focusable
                        const currentElement = e.target as HTMLElement;
                        const focusableElements = Array.from(document.querySelectorAll('input, button, select, textarea, [tabindex]:not([tabindex="-1"])'));
                        const currentIndex = focusableElements.indexOf(currentElement);
                        const nextElement = focusableElements[currentIndex + 1] as HTMLElement;
                        
                        if (nextElement) {
                          nextElement.focus();
                        }
                      }
                    }}
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {AVAILABLE_ICONS.map((icon) => (
                      <SelectItem key={icon.value} value={icon.value}>
                        <div className="flex items-center gap-2">
                          <span className="text-lg">{icon.value}</span>
                          <span>{icon.label}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="color">Color</Label>
                <Select 
                  value={formData.color} 
                  onValueChange={(value) => setFormData(prev => ({ ...prev, color: value }))}
                >
                  <SelectTrigger
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        e.stopPropagation();
                        // Buscar el siguiente elemento focusable
                        const currentElement = e.target as HTMLElement;
                        const focusableElements = Array.from(document.querySelectorAll('input, button, select, textarea, [tabindex]:not([tabindex="-1"])'));
                        const currentIndex = focusableElements.indexOf(currentElement);
                        const nextElement = focusableElements[currentIndex + 1] as HTMLElement;
                        
                        if (nextElement) {
                          nextElement.focus();
                        }
                      }
                    }}
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {AVAILABLE_COLORS.map((color) => (
                      <SelectItem key={color.value} value={color.value}>
                        <div className="flex items-center gap-2">
                          <div className={cn('w-4 h-4 rounded', color.class)}></div>
                          <span>{color.label}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        </div>
        </DialogBody>

        <DialogFooter>
          <Button variant="outline" size="sm" onClick={onClose}>
            Cancelar
          </Button>

          <Button size="sm" onClick={handleSave} disabled={isLoading}>
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Guardando...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                {mode === 'create' ? 'Crear Categoría' : 'Guardar Cambios'}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
} 