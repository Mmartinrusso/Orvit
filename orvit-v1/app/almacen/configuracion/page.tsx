'use client';

import { useState, useEffect } from 'react';
import { useCompany } from '@/contexts/CompanyContext';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Settings, Save, Package, FileSignature, Loader2, ShieldAlert } from 'lucide-react';
import { toast } from 'sonner';

interface AlmacenSettings {
  requireDespachoSignature: boolean;
}

export default function AlmacenConfiguracionPage() {
  const { currentCompany } = useCompany();
  const { hasPermission } = useAuth();
  const canManageAll = hasPermission('almacen.manage_all');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<AlmacenSettings>({
    requireDespachoSignature: false,
  });

  useEffect(() => {
    const fetchSettings = async () => {
      if (!currentCompany) return;

      try {
        const res = await fetch(`/api/companies/${currentCompany.id}/settings`);
        if (res.ok) {
          const data = await res.json();
          setSettings({
            requireDespachoSignature: data.requireDespachoSignature ?? false,
          });
        }
      } catch (error) {
        console.error('Error fetching settings:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchSettings();
  }, [currentCompany]);

  const handleSave = async () => {
    if (!currentCompany) return;

    setSaving(true);
    try {
      const res = await fetch(`/api/companies/${currentCompany.id}/settings`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requireDespachoSignature: settings.requireDespachoSignature,
        }),
      });

      if (res.ok) {
        toast.success('Configuración guardada');
      } else {
        throw new Error('Error al guardar');
      }
    } catch (error) {
      toast.error('Error al guardar configuración');
    } finally {
      setSaving(false);
    }
  };

  if (!canManageAll) {
    return (
      <div className="p-6">
        <div className="flex flex-col items-center justify-center h-64 gap-3">
          <ShieldAlert className="h-10 w-10 text-muted-foreground" />
          <p className="text-muted-foreground text-sm">No tiene permisos para acceder a esta configuración.</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
            <Settings className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Configuración de Almacén</h1>
            <p className="text-sm text-muted-foreground">
              Ajustes del módulo de almacén
            </p>
          </div>
        </div>
        <Button onClick={handleSave} disabled={saving} className="gap-2">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Guardar Cambios
        </Button>
      </div>

      <div className="grid gap-6 max-w-2xl">
        {/* Despachos Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Package className="h-5 w-5" />
              Despachos
            </CardTitle>
            <CardDescription>
              Configuración de los procesos de despacho
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Signature Requirement */}
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <Label htmlFor="require-signature" className="flex items-center gap-2">
                  <FileSignature className="h-4 w-4 text-muted-foreground" />
                  Firma obligatoria al recibir
                </Label>
                <p className="text-sm text-muted-foreground">
                  Requerir firma digital del receptor para confirmar la recepción de un despacho
                </p>
              </div>
              <Switch
                id="require-signature"
                checked={settings.requireDespachoSignature}
                onCheckedChange={(checked) =>
                  setSettings({ ...settings, requireDespachoSignature: checked })
                }
              />
            </div>

            <Separator />

            <div className="rounded-lg bg-muted/50 p-4">
              <p className="text-sm text-muted-foreground">
                <strong>Nota:</strong> Cuando la firma está habilitada, el receptor deberá firmar
                digitalmente en el dispositivo para confirmar que recibió los materiales.
                La firma se almacena de forma segura junto con la fecha y hora de recepción.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
