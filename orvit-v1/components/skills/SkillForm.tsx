'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Loader2 } from 'lucide-react';
import type { Skill } from '@/lib/types';

interface SkillFormProps {
  skill?: Skill | null;
  categories: string[];
  onSubmit: (data: Partial<Skill>) => Promise<void>;
  onCancel: () => void;
  isLoading?: boolean;
}

export function SkillForm({ skill, categories, onSubmit, onCancel, isLoading }: SkillFormProps) {
  const [formData, setFormData] = useState({
    name: skill?.name || '',
    code: skill?.code || '',
    description: skill?.description || '',
    category: skill?.category || '',
    isCertificationRequired: skill?.isCertificationRequired || false,
    certificationValidityDays: skill?.certificationValidityDays || '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSubmit({
      name: formData.name,
      code: formData.code || undefined,
      description: formData.description || undefined,
      category: formData.category || undefined,
      isCertificationRequired: formData.isCertificationRequired,
      certificationValidityDays: formData.certificationValidityDays
        ? Number(formData.certificationValidityDays)
        : undefined,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="name">Nombre *</Label>
          <Input
            id="name"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            placeholder="Ej: Soldadura MIG"
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="code">Código</Label>
          <Input
            id="code"
            value={formData.code}
            onChange={(e) => setFormData({ ...formData, code: e.target.value })}
            placeholder="Ej: SOLD-MIG-001"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="category">Categoría</Label>
        <Input
          id="category"
          value={formData.category}
          onChange={(e) => setFormData({ ...formData, category: e.target.value })}
          placeholder="Ej: Soldadura, Electricidad, Mecánica"
          list="categories"
        />
        <datalist id="categories">
          {categories.map((cat) => (
            <option key={cat} value={cat} />
          ))}
        </datalist>
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Descripción</Label>
        <Textarea
          id="description"
          value={formData.description}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          placeholder="Descripción de la habilidad..."
          rows={3}
        />
      </div>

      <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
        <div className="space-y-0.5">
          <Label htmlFor="certification">Requiere Certificación</Label>
          <p className="text-sm text-muted-foreground">
            Los usuarios necesitarán una certificación válida
          </p>
        </div>
        <Switch
          id="certification"
          checked={formData.isCertificationRequired}
          onCheckedChange={(checked) =>
            setFormData({ ...formData, isCertificationRequired: checked })
          }
        />
      </div>

      {formData.isCertificationRequired && (
        <div className="space-y-2">
          <Label htmlFor="validityDays">Días de Validez de Certificación</Label>
          <Input
            id="validityDays"
            type="number"
            min="1"
            value={formData.certificationValidityDays}
            onChange={(e) =>
              setFormData({ ...formData, certificationValidityDays: e.target.value })
            }
            placeholder="Ej: 365 (dejar vacío si no expira)"
          />
        </div>
      )}

      <div className="flex justify-end gap-2 pt-4">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit" disabled={isLoading || !formData.name}>
          {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {skill ? 'Actualizar' : 'Crear'} Habilidad
        </Button>
      </div>
    </form>
  );
}

export default SkillForm;
