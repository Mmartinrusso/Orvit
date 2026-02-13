'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Loader2, Save, DollarSign } from 'lucide-react';
import { toast } from 'sonner';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface CurrencyConfigProps {
  companyId: number;
}

const AVAILABLE_CURRENCIES = [
  { code: 'ARS', name: 'Peso Argentino', symbol: '$' },
  { code: 'USD', name: 'Dólar Estadounidense', symbol: 'US$' },
  { code: 'EUR', name: 'Euro', symbol: '€' },
  { code: 'BRL', name: 'Real Brasileño', symbol: 'R$' },
  { code: 'CLP', name: 'Peso Chileno', symbol: 'CLP$' },
  { code: 'UYU', name: 'Peso Uruguayo', symbol: '$U' },
];

export function CurrencyConfig({ companyId }: CurrencyConfigProps) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [config, setConfig] = useState<any>(null);
  const [enabledCurrencies, setEnabledCurrencies] = useState<string[]>(['ARS', 'USD']);

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

      if (data.monedasHabilitadas) {
        const currencies = JSON.parse(data.monedasHabilitadas as string);
        setEnabledCurrencies(currencies);
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

      if (enabledCurrencies.length === 0) {
        toast.error('Debe habilitar al menos una moneda');
        return;
      }

      if (!enabledCurrencies.includes(config.monedaPrincipal)) {
        toast.error('La moneda principal debe estar habilitada');
        return;
      }

      const response = await fetch(`/api/ventas/configuracion`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId,
          monedasHabilitadas: JSON.stringify(enabledCurrencies),
          monedaPrincipal: config.monedaPrincipal,
          permiteCambioMoneda: config.permiteCambioMoneda,
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

  const handleToggleCurrency = (currencyCode: string, checked: boolean) => {
    if (checked) {
      setEnabledCurrencies([...enabledCurrencies, currencyCode]);
    } else {
      // No permitir deshabilitar si es la única o si es la principal
      if (enabledCurrencies.length === 1) {
        toast.error('Debe haber al menos una moneda habilitada');
        return;
      }
      if (currencyCode === config.monedaPrincipal) {
        toast.error('No puede deshabilitar la moneda principal. Cambie primero la moneda principal.');
        return;
      }
      setEnabledCurrencies(enabledCurrencies.filter((c) => c !== currencyCode));
    }
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
          <CardTitle>Monedas Habilitadas</CardTitle>
          <CardDescription>
            Seleccione las monedas que su empresa utilizará en ventas
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3">
            {AVAILABLE_CURRENCIES.map((currency) => {
              const isEnabled = enabledCurrencies.includes(currency.code);
              const isPrincipal = currency.code === config?.monedaPrincipal;

              return (
                <div
                  key={currency.code}
                  className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center space-x-3">
                    <Checkbox
                      id={currency.code}
                      checked={isEnabled}
                      onCheckedChange={(checked) =>
                        handleToggleCurrency(currency.code, checked as boolean)
                      }
                    />
                    <div className="flex items-center space-x-2">
                      <DollarSign className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <Label htmlFor={currency.code} className="cursor-pointer font-medium">
                          {currency.code} - {currency.name}
                        </Label>
                        <p className="text-xs text-muted-foreground">Símbolo: {currency.symbol}</p>
                      </div>
                    </div>
                  </div>
                  {isPrincipal && (
                    <div className="px-2 py-1 bg-primary/10 text-primary text-xs font-medium rounded">
                      Principal
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <p className="text-xs text-muted-foreground mt-4">
            Las monedas habilitadas estarán disponibles en cotizaciones, órdenes de venta y facturas
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Moneda Principal</CardTitle>
          <CardDescription>
            Moneda por defecto para nuevos documentos
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Moneda por Defecto</Label>
            <Select
              value={config?.monedaPrincipal || 'ARS'}
              onValueChange={(value) => setConfig({ ...config, monedaPrincipal: value })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {enabledCurrencies.map((currencyCode) => {
                  const currency = AVAILABLE_CURRENCIES.find((c) => c.code === currencyCode);
                  return (
                    <SelectItem key={currencyCode} value={currencyCode}>
                      {currency?.symbol} {currencyCode} - {currency?.name}
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Se usará como moneda por defecto al crear cotizaciones y órdenes
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Opciones Adicionales</CardTitle>
          <CardDescription>
            Configure el comportamiento de cambio de moneda
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Permitir Cambio de Moneda</Label>
              <p className="text-xs text-muted-foreground">
                Permitir seleccionar moneda diferente a la principal en documentos
              </p>
            </div>
            <Switch
              checked={config?.permiteCambioMoneda !== false}
              onCheckedChange={(checked) =>
                setConfig({ ...config, permiteCambioMoneda: checked })
              }
            />
          </div>

          {!config?.permiteCambioMoneda && (
            <div className="p-3 bg-muted rounded-lg">
              <p className="text-sm text-muted-foreground">
                ⚠️ Si deshabilita el cambio de moneda, todos los documentos se crearán en{' '}
                <strong>{config?.monedaPrincipal || 'ARS'}</strong>
              </p>
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
