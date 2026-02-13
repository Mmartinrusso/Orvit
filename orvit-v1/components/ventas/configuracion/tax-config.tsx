'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Loader2, Plus, X, Save } from 'lucide-react';
import { toast } from 'sonner';

interface TaxConfigProps {
  companyId: number;
}

export function TaxConfig({ companyId }: TaxConfigProps) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [config, setConfig] = useState<any>(null);
  const [ivaRates, setIvaRates] = useState<number[]>([21, 10.5, 27, 0]);
  const [newRate, setNewRate] = useState('');

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/ventas/configuracion?companyId=${companyId}`);
      if (!response.ok) throw new Error('Error loading config');

      const data = await response.json();
      setConfig(data);

      if (data.ivaRates) {
        setIvaRates(JSON.parse(data.ivaRates as string));
      }
    } catch (error) {
      console.error('Error loading config:', error);
      toast.error('Error al cargar configuración');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);

      const response = await fetch(`/api/ventas/configuracion`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId,
          ivaRates: JSON.stringify(ivaRates),
          tasaIvaDefault: config.tasaIvaDefault,
          percepcionIvaHabilitada: config.percepcionIvaHabilitada,
          percepcionIvaTasa: config.percepcionIvaTasa,
          percepcionIIBBHabilitada: config.percepcionIIBBHabilitada,
          percepcionIIBBTasa: config.percepcionIIBBTasa,
        }),
      });

      if (!response.ok) throw new Error('Error saving config');

      toast.success('Configuración guardada correctamente');
    } catch (error) {
      console.error('Error saving config:', error);
      toast.error('Error al guardar configuración');
    } finally {
      setSaving(false);
    }
  };

  const handleAddRate = () => {
    const rate = parseFloat(newRate);
    if (isNaN(rate) || rate < 0 || rate > 100) {
      toast.error('Ingrese una alícuota válida (0-100)');
      return;
    }
    if (ivaRates.includes(rate)) {
      toast.error('Esta alícuota ya existe');
      return;
    }
    setIvaRates([...ivaRates, rate].sort((a, b) => b - a));
    setNewRate('');
  };

  const handleRemoveRate = (rate: number) => {
    setIvaRates(ivaRates.filter((r) => r !== rate));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>IVA y Alícuotas</CardTitle>
          <CardDescription>
            Configure las alícuotas de IVA permitidas y la tasa por defecto
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Tasa IVA por Defecto (%)</Label>
            <Input
              type="number"
              step="0.1"
              min="0"
              max="100"
              value={config?.tasaIvaDefault || 21}
              onChange={(e) => setConfig({ ...config, tasaIvaDefault: parseFloat(e.target.value) })}
            />
            <p className="text-xs text-muted-foreground">
              Se usará cuando no se especifique una alícuota
            </p>
          </div>

          <div className="space-y-2">
            <Label>Alícuotas de IVA Permitidas</Label>
            <div className="flex flex-wrap gap-2 mb-2">
              {ivaRates.map((rate) => (
                <Badge key={rate} variant="secondary" className="flex items-center gap-1 px-3 py-1">
                  {rate}%
                  {rate !== 21 && (
                    <button
                      onClick={() => handleRemoveRate(rate)}
                      className="ml-1 hover:text-destructive"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  )}
                </Badge>
              ))}
            </div>
            <div className="flex gap-2">
              <Input
                type="number"
                step="0.1"
                min="0"
                max="100"
                placeholder="Nueva alícuota"
                value={newRate}
                onChange={(e) => setNewRate(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleAddRate()}
              />
              <Button onClick={handleAddRate} variant="outline" size="icon">
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Comunes: 21%, 10.5%, 27%, 0% (exento)
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Percepciones</CardTitle>
          <CardDescription>
            Configure percepciones de IVA e Ingresos Brutos
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Percepción IVA</Label>
              <p className="text-xs text-muted-foreground">
                Aplicar percepción de IVA en documentos
              </p>
            </div>
            <Switch
              checked={config?.percepcionIvaHabilitada || false}
              onCheckedChange={(checked) =>
                setConfig({ ...config, percepcionIvaHabilitada: checked })
              }
            />
          </div>

          {config?.percepcionIvaHabilitada && (
            <div className="space-y-2 ml-6">
              <Label>Tasa de Percepción IVA (%)</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                max="100"
                value={config?.percepcionIvaTasa || 0}
                onChange={(e) =>
                  setConfig({ ...config, percepcionIvaTasa: parseFloat(e.target.value) })
                }
              />
            </div>
          )}

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Percepción IIBB</Label>
              <p className="text-xs text-muted-foreground">
                Aplicar percepción de Ingresos Brutos
              </p>
            </div>
            <Switch
              checked={config?.percepcionIIBBHabilitada || false}
              onCheckedChange={(checked) =>
                setConfig({ ...config, percepcionIIBBHabilitada: checked })
              }
            />
          </div>

          {config?.percepcionIIBBHabilitada && (
            <div className="space-y-2 ml-6">
              <Label>Tasa de Percepción IIBB (%)</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                max="100"
                value={config?.percepcionIIBBTasa || 0}
                onChange={(e) =>
                  setConfig({ ...config, percepcionIIBBTasa: parseFloat(e.target.value) })
                }
              />
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving}>
          {saving ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Guardando...
            </>
          ) : (
            <>
              <Save className="mr-2 h-4 w-4" />
              Guardar Cambios
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
