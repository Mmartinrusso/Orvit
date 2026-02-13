'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { 
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Plus, Check, X } from 'lucide-react';
import { toast } from 'sonner';
import { useCompany } from '@/contexts/CompanyContext';

interface Option {
  id: number | string;
  name: string;
  [key: string]: any;
}

interface CreatableSelectProps {
  value: string;
  onValueChange: (value: string) => void;
  options: Option[];
  onRefresh: () => void;
  placeholder: string;
  createLabel: string;
  apiEndpoint: string;
  disabled?: boolean;
  createFields?: {
    name: string;
    label: string;
    type?: 'text' | 'email' | 'tel';
    placeholder?: string;
    required?: boolean;
  }[];
}

export default function CreatableSelect({
  value,
  onValueChange,
  options,
  onRefresh,
  placeholder,
  createLabel,
  apiEndpoint,
  disabled = false,
  createFields = [{ name: 'name', label: 'Nombre', required: true }]
}: CreatableSelectProps) {
  const { currentCompany } = useCompany();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [formData, setFormData] = useState<Record<string, string>>({});

  useEffect(() => {
    // Inicializar formData con campos vacíos
    const initialData: Record<string, string> = {};
    createFields.forEach(field => {
      initialData[field.name] = '';
    });
    setFormData(initialData);
  }, [createFields]);

  const handleCreate = async () => {
    if (!currentCompany) {
      toast.error('Selecciona una empresa primero');
      return;
    }

    // Validar campos requeridos
    const requiredFields = createFields.filter(field => field.required);
    const missingFields = requiredFields.filter(field => !formData[field.name]?.trim());

    if (missingFields.length > 0) {
      toast.error(`Los siguientes campos son requeridos: ${missingFields.map(f => f.label).join(', ')}`);
      return;
    }

    setIsCreating(true);
    try {
      const response = await fetch(apiEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          companyId: currentCompany.id
        })
      });

      if (response.ok) {
        const data = await response.json();
        toast.success(data.message || `${createLabel} creado exitosamente`);
        
        // Limpiar formulario
        const initialData: Record<string, string> = {};
        createFields.forEach(field => {
          initialData[field.name] = '';
        });
        setFormData(initialData);
        
        // Cerrar diálogo
        setIsCreateDialogOpen(false);
        
        // Refrescar opciones
        onRefresh();
        
        // Seleccionar el nuevo elemento creado
        if (data.category || data.location || data.supplier) {
          const newItem = data.category || data.location || data.supplier;
          onValueChange(newItem.name);
        }
      } else {
        const error = await response.json();
        toast.error(error.error || `Error al crear ${createLabel.toLowerCase()}`);
      }
    } catch (error) {
      toast.error(`Error al crear ${createLabel.toLowerCase()}`);
    } finally {
      setIsCreating(false);
    }
  };

  const handleInputChange = (fieldName: string, value: string) => {
    setFormData(prev => ({ ...prev, [fieldName]: value }));
  };

  return (
    <>
      <Select value={value} onValueChange={onValueChange} disabled={disabled}>
        <SelectTrigger>
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {/* Opción para crear nuevo */}
          <div className="p-1">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="w-full justify-start text-blue-600 hover:text-blue-700 hover:bg-blue-50"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setIsCreateDialogOpen(true);
              }}
            >
              <Plus className="h-4 w-4 mr-2" />
              {createLabel}
            </Button>
          </div>
          
          {/* Separador */}
          {options.length > 0 && (
            <div className="border-t my-1"></div>
          )}
          
          {/* Opciones existentes */}
          {options.map((option) => (
            <SelectItem key={option.id} value={option.name}>
              {option.name}
            </SelectItem>
          ))}
          
          {options.length === 0 && (
            <div className="p-2 text-sm text-gray-500 text-center">
              No hay opciones disponibles
            </div>
          )}
        </SelectContent>
      </Select>

      {/* Diálogo para crear nuevo elemento */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent size="sm" className="max-h-[calc(100vh-2rem)] sm:max-h-[calc(100vh-3rem)] md:max-h-[calc(100vh-4rem)]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="h-5 w-5 text-blue-600" />
              {createLabel}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {createFields.map((field) => (
              <div key={field.name}>
                <Label htmlFor={field.name}>
                  {field.label}
                  {field.required && <span className="text-red-500 ml-1">*</span>}
                </Label>
                <Input
                  id={field.name}
                  type={field.type || 'text'}
                  value={formData[field.name] || ''}
                  onChange={(e) => handleInputChange(field.name, e.target.value)}
                  placeholder={field.placeholder || `Ingresa ${field.label.toLowerCase()}`}
                />
              </div>
            ))}
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button
              variant="outline"
              onClick={() => setIsCreateDialogOpen(false)}
              disabled={isCreating}
            >
              <X className="h-4 w-4 mr-2" />
              Cancelar
            </Button>
            <Button onClick={handleCreate} disabled={isCreating}>
              {isCreating ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Creando...
                </>
              ) : (
                <>
                  <Check className="h-4 w-4 mr-2" />
                  Crear
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
} 