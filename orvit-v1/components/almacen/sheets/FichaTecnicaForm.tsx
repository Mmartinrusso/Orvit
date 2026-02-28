'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { InstructiveFileUpload } from '@/components/ui/InstructiveFileUpload';
import {
  FlaskConical,
  Thermometer,
  ShieldAlert,
  Paperclip,
  Save,
  Loader2,
  ExternalLink,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import { toast } from 'sonner';

interface FileAttachment {
  url: string;
  name: string;
  size: number;
  type: string;
}

interface FichaTecnicaData {
  id?: number;
  density: string;
  viscosity: string;
  ph: string;
  flashPoint: string;
  color: string;
  odor: string;
  storageTemp: string;
  storageConditions: string;
  shelfLifeDays: string;
  casNumber: string;
  hazardClass: string;
  sdsUrl: string;
  documents: FileAttachment[];
  notes: string;
  updatedAt?: string;
}

const EMPTY_FORM: FichaTecnicaData = {
  density: '',
  viscosity: '',
  ph: '',
  flashPoint: '',
  color: '',
  odor: '',
  storageTemp: '',
  storageConditions: '',
  shelfLifeDays: '',
  casNumber: '',
  hazardClass: '',
  sdsUrl: '',
  documents: [],
  notes: '',
};

interface FichaTecnicaFormProps {
  supplyId: number;
  onSaved?: () => void;
}

export function FichaTecnicaForm({ supplyId, onSaved }: FichaTecnicaFormProps) {
  const [form, setForm] = useState<FichaTecnicaData>(EMPTY_FORM);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!supplyId) return;
    setIsLoading(true);
    fetch(`/api/insumos/insumos/${supplyId}/ficha-tecnica`)
      .then((r) => r.json())
      .then(({ sheet }) => {
        if (sheet) {
          setForm({
            id: sheet.id,
            density: sheet.density != null ? String(sheet.density) : '',
            viscosity: sheet.viscosity != null ? String(sheet.viscosity) : '',
            ph: sheet.ph != null ? String(sheet.ph) : '',
            flashPoint: sheet.flashPoint != null ? String(sheet.flashPoint) : '',
            color: sheet.color ?? '',
            odor: sheet.odor ?? '',
            storageTemp: sheet.storageTemp ?? '',
            storageConditions: sheet.storageConditions ?? '',
            shelfLifeDays: sheet.shelfLifeDays != null ? String(sheet.shelfLifeDays) : '',
            casNumber: sheet.casNumber ?? '',
            hazardClass: sheet.hazardClass ?? '',
            sdsUrl: sheet.sdsUrl ?? '',
            documents: sheet.documents ?? [],
            notes: sheet.notes ?? '',
            updatedAt: sheet.updatedAt,
          });
        } else {
          setForm(EMPTY_FORM);
        }
      })
      .catch(() => toast.error('Error al cargar la ficha técnica'))
      .finally(() => setIsLoading(false));
  }, [supplyId]);

  const set = (field: keyof FichaTecnicaData, value: string | FileAttachment[]) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const res = await fetch(`/api/insumos/insumos/${supplyId}/ficha-tecnica`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          density: form.density !== '' ? Number(form.density) : null,
          viscosity: form.viscosity !== '' ? Number(form.viscosity) : null,
          ph: form.ph !== '' ? Number(form.ph) : null,
          flashPoint: form.flashPoint !== '' ? Number(form.flashPoint) : null,
          color: form.color || null,
          odor: form.odor || null,
          storageTemp: form.storageTemp || null,
          storageConditions: form.storageConditions || null,
          shelfLifeDays: form.shelfLifeDays !== '' ? Number(form.shelfLifeDays) : null,
          casNumber: form.casNumber || null,
          hazardClass: form.hazardClass || null,
          sdsUrl: form.sdsUrl || null,
          documents: form.documents,
          notes: form.notes || null,
        }),
      });
      if (!res.ok) throw new Error();
      const { sheet } = await res.json();
      setForm((prev) => ({ ...prev, id: sheet.id, updatedAt: sheet.updatedAt }));
      toast.success('Ficha técnica guardada');
      onSaved?.();
    } catch {
      toast.error('Error al guardar la ficha técnica');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin mr-2" />
        Cargando ficha técnica...
      </div>
    );
  }

  return (
    <div className="space-y-4 pb-4">
      {/* Propiedades Físicas */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <FlaskConical className="h-4 w-4 text-primary" />
            Propiedades Físicas
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Densidad (g/cm³)</Label>
              <Input
                type="number"
                step="0.001"
                placeholder="1.025"
                value={form.density}
                onChange={(e) => set('density', e.target.value)}
                className="h-8 text-sm"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Viscosidad (mPa·s)</Label>
              <Input
                type="number"
                step="0.1"
                placeholder="50"
                value={form.viscosity}
                onChange={(e) => set('viscosity', e.target.value)}
                className="h-8 text-sm"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">pH</Label>
              <Input
                type="number"
                step="0.1"
                min="0"
                max="14"
                placeholder="7.0"
                value={form.ph}
                onChange={(e) => set('ph', e.target.value)}
                className="h-8 text-sm"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Punto de Inflamación (°C)</Label>
              <Input
                type="number"
                step="1"
                placeholder="80"
                value={form.flashPoint}
                onChange={(e) => set('flashPoint', e.target.value)}
                className="h-8 text-sm"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Color</Label>
              <Input
                placeholder="Incoloro / Amarillo..."
                value={form.color}
                onChange={(e) => set('color', e.target.value)}
                className="h-8 text-sm"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Olor</Label>
              <Input
                placeholder="Inodoro / Característico..."
                value={form.odor}
                onChange={(e) => set('odor', e.target.value)}
                className="h-8 text-sm"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Almacenamiento */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Thermometer className="h-4 w-4 text-orange-500" />
            Almacenamiento
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Temperatura de almacenamiento</Label>
              <Input
                placeholder="5-25°C"
                value={form.storageTemp}
                onChange={(e) => set('storageTemp', e.target.value)}
                className="h-8 text-sm"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Vida útil (días)</Label>
              <Input
                type="number"
                min="1"
                placeholder="365"
                value={form.shelfLifeDays}
                onChange={(e) => set('shelfLifeDays', e.target.value)}
                className="h-8 text-sm"
              />
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Condiciones de almacenamiento</Label>
            <Textarea
              placeholder="Lugar fresco y seco, alejado de fuentes de calor e ignición..."
              value={form.storageConditions}
              onChange={(e) => set('storageConditions', e.target.value)}
              rows={2}
              className="text-sm resize-none"
            />
          </div>
        </CardContent>
      </Card>

      {/* Seguridad / MSDS */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <ShieldAlert className="h-4 w-4 text-destructive" />
            Seguridad / MSDS
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Número CAS</Label>
              <Input
                placeholder="67-64-1"
                value={form.casNumber}
                onChange={(e) => set('casNumber', e.target.value)}
                className="h-8 text-sm"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Clase de peligro</Label>
              <Input
                placeholder="Líquido inflamable, Clase 3"
                value={form.hazardClass}
                onChange={(e) => set('hazardClass', e.target.value)}
                className="h-8 text-sm"
              />
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">URL Hoja de Seguridad (SDS)</Label>
            <div className="flex gap-2">
              <Input
                placeholder="https://..."
                value={form.sdsUrl}
                onChange={(e) => set('sdsUrl', e.target.value)}
                className="h-8 text-sm flex-1"
              />
              {form.sdsUrl && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 px-2 flex-shrink-0"
                  onClick={() => window.open(form.sdsUrl, '_blank')}
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Documentos Adjuntos */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Paperclip className="h-4 w-4 text-muted-foreground" />
            Documentos Adjuntos
          </CardTitle>
        </CardHeader>
        <CardContent>
          <InstructiveFileUpload
            entityType="supply"
            entityId={String(supplyId)}
            attachments={form.documents}
            onAttachmentsChange={(attachments) => set('documents', attachments)}
            title=""
            description="Especificaciones técnicas, certificados, fichas de datos"
            maxFiles={5}
          />
        </CardContent>
      </Card>

      {/* Notas */}
      <div className="space-y-1">
        <Label className="text-xs text-muted-foreground">Notas adicionales</Label>
        <Textarea
          placeholder="Observaciones generales sobre este insumo..."
          value={form.notes}
          onChange={(e) => set('notes', e.target.value)}
          rows={2}
          className="text-sm resize-none"
        />
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between pt-2 border-t">
        {form.updatedAt ? (
          <p className="text-xs text-muted-foreground">
            Última actualización:{' '}
            {formatDistanceToNow(new Date(form.updatedAt), { addSuffix: true, locale: es })}
          </p>
        ) : (
          <p className="text-xs text-muted-foreground">Sin datos guardados aún</p>
        )}
        <Button onClick={handleSave} disabled={isSaving} size="sm">
          {isSaving ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Save className="h-4 w-4 mr-2" />
          )}
          Guardar ficha
        </Button>
      </div>
    </div>
  );
}
