'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Hash, Save, RefreshCw, Info } from 'lucide-react';
import { toast } from 'sonner';

// =====================================================
// TYPES
// =====================================================

interface NumberFormatConfig {
  quote: string;
  order: string;
  delivery: string;
  invoice: string;
  payment: string;
  remito: string;
  padLength: number;
  includeYear: boolean;
  includeMonth: boolean;
  separator: string;
}

interface DocumentPrefixes {
  quotePrefix: string;
  salePrefix: string;
  deliveryPrefix: string;
  invoicePrefix: string;
  paymentPrefix: string;
  remitoPrefix: string;
  puntoVenta: string;
}

interface NumberFormatConfigProps {
  config: {
    numberFormatConfig?: Partial<NumberFormatConfig>;
  } & DocumentPrefixes;
  onSave: (updates: Partial<NumberFormatConfig & DocumentPrefixes>) => Promise<void>;
}

// =====================================================
// DEFAULT CONFIG
// =====================================================

const DEFAULT_FORMAT_CONFIG: NumberFormatConfig = {
  quote: '{prefix}-{number}',
  order: '{prefix}-{number}',
  delivery: '{prefix}-{number}',
  invoice: '{prefix}-{pv}-{number}',
  payment: '{prefix}-{number}',
  remito: '{prefix}-{number}',
  padLength: 6,
  includeYear: false,
  includeMonth: false,
  separator: '-',
};

const FORMAT_OPTIONS = [
  { value: '{prefix}-{number}', label: 'Prefijo-Número', example: 'COT-000001' },
  { value: '{prefix}{separator}{year}-{number}', label: 'Prefijo-Año-Número', example: 'COT-2025-000001' },
  { value: '{prefix}{separator}{year}{month}-{number}', label: 'Prefijo-AñoMes-Número', example: 'COT-202501-000001' },
  { value: '{year}{month}-{prefix}-{number}', label: 'AñoMes-Prefijo-Número', example: '202501-COT-000001' },
  { value: '{prefix}-{pv}-{number}', label: 'Prefijo-PV-Número (Facturas)', example: 'FA-0001-00000001' },
];

// =====================================================
// COMPONENT
// =====================================================

export function NumberFormatConfig({ config, onSave }: NumberFormatConfigProps) {
  const [formatConfig, setFormatConfig] = useState<NumberFormatConfig>({
    ...DEFAULT_FORMAT_CONFIG,
    ...(config?.numberFormatConfig || {}),
  });

  const [prefixes, setPrefixes] = useState<DocumentPrefixes>({
    quotePrefix: config?.quotePrefix || 'COT',
    salePrefix: config?.salePrefix || 'VTA',
    deliveryPrefix: config?.deliveryPrefix || 'ENT',
    invoicePrefix: config?.invoicePrefix || 'FA',
    paymentPrefix: config?.paymentPrefix || 'REC',
    remitoPrefix: config?.remitoPrefix || 'REM',
    puntoVenta: config?.puntoVenta || '0001',
  });

  const [saving, setSaving] = useState(false);

  const generatePreview = (docType: keyof NumberFormatConfig, format: string): string => {
    const now = new Date();
    const year = now.getFullYear().toString();
    const month = (now.getMonth() + 1).toString().padStart(2, '0');

    let prefixKey: keyof DocumentPrefixes;
    switch (docType) {
      case 'quote':
        prefixKey = 'quotePrefix';
        break;
      case 'order':
        prefixKey = 'salePrefix';
        break;
      case 'delivery':
        prefixKey = 'deliveryPrefix';
        break;
      case 'invoice':
        prefixKey = 'invoicePrefix';
        break;
      case 'payment':
        prefixKey = 'paymentPrefix';
        break;
      case 'remito':
        prefixKey = 'remitoPrefix';
        break;
      default:
        prefixKey = 'quotePrefix';
    }

    const prefix = prefixes[prefixKey];
    const number = '1'.padStart(formatConfig.padLength, '0');

    return format
      .replace('{prefix}', prefix)
      .replace('{year}', year)
      .replace('{month}', month)
      .replace('{number}', number)
      .replace('{pv}', prefixes.puntoVenta)
      .replace('{separator}', formatConfig.separator);
  };

  const handlePrefixChange = (key: keyof DocumentPrefixes, value: string) => {
    setPrefixes(prev => ({ ...prev, [key]: value.toUpperCase() }));
  };

  const handleFormatChange = (docType: keyof NumberFormatConfig, format: string) => {
    setFormatConfig(prev => ({ ...prev, [docType]: format }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave({
        ...prefixes,
        numberFormatConfig: formatConfig,
      });
      toast.success('Configuración guardada');
    } catch (error) {
      toast.error('Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  const DocumentFormatCard = ({
    docType,
    label,
    prefixKey,
    showPuntoVenta = false,
  }: {
    docType: keyof NumberFormatConfig;
    label: string;
    prefixKey: keyof DocumentPrefixes;
    showPuntoVenta?: boolean;
  }) => (
    <div className="border rounded-lg p-4 space-y-4">
      <div className="flex items-center justify-between">
        <Label className="text-base font-medium">{label}</Label>
        <Badge variant="outline" className="font-mono">
          {generatePreview(docType, formatConfig[docType] as string)}
        </Badge>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label className="text-sm">Prefijo</Label>
          <Input
            value={prefixes[prefixKey]}
            onChange={(e) => handlePrefixChange(prefixKey, e.target.value)}
            maxLength={10}
            className="font-mono"
          />
        </div>

        {showPuntoVenta && (
          <div className="space-y-2">
            <Label className="text-sm">Punto de Venta</Label>
            <Input
              value={prefixes.puntoVenta}
              onChange={(e) => handlePrefixChange('puntoVenta', e.target.value)}
              maxLength={5}
              className="font-mono"
            />
          </div>
        )}

        <div className="space-y-2 col-span-2">
          <Label className="text-sm">Formato</Label>
          <Select
            value={formatConfig[docType] as string}
            onValueChange={(v) => handleFormatChange(docType, v)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {FORMAT_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  <div className="flex items-center justify-between w-full">
                    <span>{opt.label}</span>
                    <span className="text-xs text-muted-foreground ml-4 font-mono">
                      {opt.example}
                    </span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Hash className="w-5 h-5" />
            <CardTitle>Formato de Numeración</CardTitle>
          </div>
          <CardDescription>
            Personaliza cómo se generan los números de documentos.
            Cada tipo de documento puede tener su propio formato.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Global Options */}
          <div className="bg-muted rounded-lg p-4 space-y-4">
            <div className="flex items-center gap-2 mb-2">
              <Info className="w-4 h-4" />
              <span className="font-medium text-sm">Opciones Globales</span>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Longitud del Número</Label>
                <Select
                  value={formatConfig.padLength.toString()}
                  onValueChange={(v) => setFormatConfig(prev => ({ ...prev, padLength: parseInt(v) }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="4">4 dígitos (0001)</SelectItem>
                    <SelectItem value="5">5 dígitos (00001)</SelectItem>
                    <SelectItem value="6">6 dígitos (000001)</SelectItem>
                    <SelectItem value="8">8 dígitos (00000001)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Separador</Label>
                <Select
                  value={formatConfig.separator}
                  onValueChange={(v) => setFormatConfig(prev => ({ ...prev, separator: v }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="-">Guión (-)</SelectItem>
                    <SelectItem value="/">Barra (/)</SelectItem>
                    <SelectItem value=".">Punto (.)</SelectItem>
                    <SelectItem value="_">Guión Bajo (_)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Incluir Año</Label>
                <div className="flex items-center h-10">
                  <Switch
                    checked={formatConfig.includeYear}
                    onCheckedChange={(checked) =>
                      setFormatConfig(prev => ({ ...prev, includeYear: checked }))
                    }
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Document Formats */}
          <div className="grid grid-cols-2 gap-4">
            <DocumentFormatCard
              docType="quote"
              label="Cotizaciones"
              prefixKey="quotePrefix"
            />
            <DocumentFormatCard
              docType="order"
              label="Órdenes de Venta"
              prefixKey="salePrefix"
            />
            <DocumentFormatCard
              docType="delivery"
              label="Entregas"
              prefixKey="deliveryPrefix"
            />
            <DocumentFormatCard
              docType="remito"
              label="Remitos"
              prefixKey="remitoPrefix"
            />
            <DocumentFormatCard
              docType="invoice"
              label="Facturas"
              prefixKey="invoicePrefix"
              showPuntoVenta
            />
            <DocumentFormatCard
              docType="payment"
              label="Recibos"
              prefixKey="paymentPrefix"
            />
          </div>

          {/* Preview Section */}
          <div className="border rounded-lg p-4">
            <h4 className="font-medium mb-3">Vista Previa de Próximos Números</h4>
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Cotización:</span>{' '}
                <code className="bg-muted px-2 py-0.5 rounded">{generatePreview('quote', formatConfig.quote)}</code>
              </div>
              <div>
                <span className="text-muted-foreground">Orden:</span>{' '}
                <code className="bg-muted px-2 py-0.5 rounded">{generatePreview('order', formatConfig.order)}</code>
              </div>
              <div>
                <span className="text-muted-foreground">Entrega:</span>{' '}
                <code className="bg-muted px-2 py-0.5 rounded">{generatePreview('delivery', formatConfig.delivery)}</code>
              </div>
              <div>
                <span className="text-muted-foreground">Remito:</span>{' '}
                <code className="bg-muted px-2 py-0.5 rounded">{generatePreview('remito', formatConfig.remito)}</code>
              </div>
              <div>
                <span className="text-muted-foreground">Factura:</span>{' '}
                <code className="bg-muted px-2 py-0.5 rounded">{generatePreview('invoice', formatConfig.invoice)}</code>
              </div>
              <div>
                <span className="text-muted-foreground">Recibo:</span>{' '}
                <code className="bg-muted px-2 py-0.5 rounded">{generatePreview('payment', formatConfig.payment)}</code>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Save Button */}
      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving}>
          <Save className="w-4 h-4 mr-2" />
          {saving ? 'Guardando...' : 'Guardar Configuración'}
        </Button>
      </div>
    </div>
  );
}
