'use client';

import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useApiMutation, createFetchMutation } from '@/hooks/use-api-mutation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
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
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Plus,
  Save,
  Trash2,
  ChevronUp,
  ChevronDown,
  Palette,
  Columns,
  PenLine,
  CreditCard,
  Star,
  GripVertical,
  Eye,
  Pencil,
  X,
  LayoutTemplate,
  Sliders,
  Check,
  Sparkles,
  Upload,
  ImageIcon,
  Loader2,
  AlignStartVertical,
  AlignEndVertical,
  FileText,
} from 'lucide-react';
import { useCompany } from '@/contexts/CompanyContext';
import { useConfirm } from '@/components/ui/confirm-dialog-provider';

// ─── Types ───────────────────────────────────────────────────────────────────

type ColumnField = 'codigo' | 'descripcion' | 'cantidad' | 'unidad' | 'precio_unitario' | 'descuento' | 'subtotal' | 'peso' | 'notas_item';
type LogoPosition = 'top-left' | 'top-center' | 'top-right' | 'none';
type HeaderLayout = 'classic' | 'centered' | 'banner' | 'compact';
type LogoSize = 'small' | 'medium' | 'large';
type FontFamily = 'sans' | 'serif' | 'mono';
type SeparatorStyle = 'solid' | 'dashed' | 'double' | 'none';
type SeparatorWeight = 'thin' | 'medium' | 'thick';
type TableBorderRadius = 'none' | 'sm' | 'md';
type ColumnAlign = 'left' | 'right' | 'center';
type ColumnFormat = 'currency' | 'number' | 'text' | 'percentage';

interface TemplateColumn {
  field: ColumnField;
  label: string;
  visible: boolean;
  width?: string;
  align?: ColumnAlign;
  format?: ColumnFormat;
}

interface PaymentPreset {
  label: string;
  value: string;
}

interface QuoteTemplate {
  id: number;
  nombre: string;
  isDefault: boolean;
  // Layout
  headerLayout: HeaderLayout;
  logoPosition: LogoPosition;
  logoSize: LogoSize;
  // Colors & fonts
  primaryColor: string;
  accentColor: string;
  fontFamily: FontFamily;
  showBorder: boolean;
  watermark: string | null;
  // Separators
  separatorStyle: SeparatorStyle;
  separatorWeight: SeparatorWeight;
  // Table
  tableZebraRows: boolean;
  tableHeaderFill: boolean;
  tableBorderRadius: TableBorderRadius;
  // Header fields
  labelDocumento: string;
  showNumero: boolean;
  showFecha: boolean;
  showVencimiento: boolean;
  // Columns
  columns: TemplateColumn[];
  // Footer
  showSubtotal: boolean;
  showIVA: boolean;
  showTotal: boolean;
  showCondiciones: boolean;
  notasFooter: string | null;
  // Firma
  firmaHabilitada: boolean;
  firmaNombre: string | null;
  firmaCargo: string | null;
  firmaImagen: string | null;
  // Online approval
  allowOnlineApproval: boolean;
  approvalMessage: string | null;
  // Payment presets
  paymentConditionPresets: PaymentPreset[];
  // Preset applied
  preset?: string | null;
  // Notas position in document
  notasPosition: 'before_items' | 'after_totals';
  // Logo específico para cotizaciones (distinto al logo general de la empresa)
  logoUrl?: string | null;
}

// ─── Presets ──────────────────────────────────────────────────────────────────

type PresetVisual = Pick<QuoteTemplate,
  'headerLayout' | 'logoPosition' | 'logoSize' | 'primaryColor' | 'accentColor' | 'fontFamily' |
  'showBorder' | 'separatorStyle' | 'separatorWeight' | 'tableZebraRows' | 'tableHeaderFill' | 'tableBorderRadius' | 'preset'
>;

interface PresetDef {
  id: string;
  name: string;
  description: string;
  config: PresetVisual;
}

const PRESETS: PresetDef[] = [
  {
    id: 'minimal',
    name: 'Minimal',
    description: 'Limpio, sin bordes ni líneas',
    config: {
      headerLayout: 'classic', logoPosition: 'top-left', logoSize: 'small',
      primaryColor: '#1a1a1a', accentColor: '#6b7280', fontFamily: 'sans',
      showBorder: false, separatorStyle: 'none', separatorWeight: 'thin',
      tableZebraRows: false, tableHeaderFill: false, tableBorderRadius: 'none', preset: 'minimal',
    },
  },
  {
    id: 'profesional',
    name: 'Profesional',
    description: 'Clásico, formal y con borde',
    config: {
      headerLayout: 'classic', logoPosition: 'top-left', logoSize: 'medium',
      primaryColor: '#0f3460', accentColor: '#16213e', fontFamily: 'sans',
      showBorder: true, separatorStyle: 'solid', separatorWeight: 'thin',
      tableZebraRows: false, tableHeaderFill: true, tableBorderRadius: 'none', preset: 'profesional',
    },
  },
  {
    id: 'moderno',
    name: 'Moderno',
    description: 'Banner de color, con zebra',
    config: {
      headerLayout: 'banner', logoPosition: 'top-center', logoSize: 'large',
      primaryColor: '#6366f1', accentColor: '#4f46e5', fontFamily: 'sans',
      showBorder: false, separatorStyle: 'none', separatorWeight: 'thin',
      tableZebraRows: true, tableHeaderFill: true, tableBorderRadius: 'sm', preset: 'moderno',
    },
  },
  {
    id: 'clasico',
    name: 'Clásico',
    description: 'Centrado, serif, doble línea',
    config: {
      headerLayout: 'centered', logoPosition: 'top-center', logoSize: 'medium',
      primaryColor: '#2c1810', accentColor: '#8b4513', fontFamily: 'serif',
      showBorder: true, separatorStyle: 'double', separatorWeight: 'medium',
      tableZebraRows: false, tableHeaderFill: true, tableBorderRadius: 'none', preset: 'clasico',
    },
  },
  {
    id: 'tecnico',
    name: 'Técnico',
    description: 'Compacto, monospace, punteado',
    config: {
      headerLayout: 'compact', logoPosition: 'top-left', logoSize: 'small',
      primaryColor: '#374151', accentColor: '#6b7280', fontFamily: 'mono',
      showBorder: true, separatorStyle: 'dashed', separatorWeight: 'thin',
      tableZebraRows: true, tableHeaderFill: true, tableBorderRadius: 'none', preset: 'tecnico',
    },
  },
];

// ─── Defaults ─────────────────────────────────────────────────────────────────

const DEFAULT_COLUMNS: TemplateColumn[] = [
  { field: 'codigo', label: 'CÓDIGO', visible: false, width: '80px', align: 'left', format: 'text' },
  { field: 'descripcion', label: 'DESCRIPCIÓN', visible: true, align: 'left', format: 'text' },
  { field: 'cantidad', label: 'CANT.', visible: true, width: '70px', align: 'right', format: 'number' },
  { field: 'unidad', label: 'UD.', visible: false, width: '60px', align: 'center', format: 'text' },
  { field: 'precio_unitario', label: 'UNITARIO', visible: true, width: '110px', align: 'right', format: 'currency' },
  { field: 'descuento', label: 'DESC.', visible: false, width: '70px', align: 'right', format: 'percentage' },
  { field: 'subtotal', label: 'IMPORTE', visible: true, width: '110px', align: 'right', format: 'currency' },
  { field: 'peso', label: 'PESO', visible: false, width: '70px', align: 'right', format: 'number' },
  { field: 'notas_item', label: 'NOTAS', visible: false, align: 'left', format: 'text' },
];

const BLANK_TEMPLATE: Omit<QuoteTemplate, 'id'> = {
  nombre: 'Nuevo Template',
  isDefault: false,
  headerLayout: 'classic',
  logoPosition: 'top-left',
  logoSize: 'medium',
  primaryColor: '#000000',
  accentColor: '#666666',
  fontFamily: 'sans',
  showBorder: true,
  watermark: null,
  separatorStyle: 'solid',
  separatorWeight: 'thin',
  tableZebraRows: false,
  tableHeaderFill: true,
  tableBorderRadius: 'none',
  labelDocumento: 'PRESUPUESTO',
  showNumero: true,
  showFecha: true,
  showVencimiento: true,
  columns: DEFAULT_COLUMNS,
  showSubtotal: true,
  showIVA: true,
  showTotal: true,
  showCondiciones: true,
  notasFooter: null,
  firmaHabilitada: false,
  firmaNombre: null,
  firmaCargo: null,
  firmaImagen: null,
  allowOnlineApproval: false,
  approvalMessage: null,
  paymentConditionPresets: [
    { label: 'Contado', value: 'Pago al contado' },
    { label: '30 días', value: 'Pago a 30 días de la factura' },
  ],
  preset: null,
  notasPosition: 'after_totals' as const,
  logoUrl: null,
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getSepBorder(style: SeparatorStyle, weight: SeparatorWeight, color: string): string {
  if (style === 'none') return 'none';
  const px = { thin: 1, medium: 2, thick: 4 }[weight];
  if (style === 'double') return `${px + 2}px double ${color}`;
  return `${px}px ${style} ${color}`;
}

const LOGO_DIM: Record<LogoSize, { w: number; h: number }> = {
  small: { w: 60, h: 32 },
  medium: { w: 88, h: 44 },
  large: { w: 130, h: 64 },
};

const TABLE_RADIUS: Record<TableBorderRadius, string> = {
  none: '0', sm: '4px', md: '8px',
};

// ─── Preview ──────────────────────────────────────────────────────────────────

function TemplatePreview({ tpl }: { tpl: Omit<QuoteTemplate, 'id'> }) {
  const visibleCols = tpl.columns.filter(c => c.visible);
  const fontClass = tpl.fontFamily === 'serif' ? 'font-serif' : tpl.fontFamily === 'mono' ? 'font-mono' : 'font-sans';

  const SAMPLE_ITEMS = [
    { codigo: '001', descripcion: 'Producto de ejemplo A', cantidad: 10, unidad: 'UN', precio_unitario: 2500, descuento: 0, subtotal: 25000, peso: 2, notas_item: '' },
    { codigo: '002', descripcion: 'Servicio de ejemplo B', cantidad: 1, unidad: 'HS', precio_unitario: 8500, descuento: 5, subtotal: 8075, peso: 0, notas_item: 'Instalación incluida' },
  ];

  const formatVal = (item: Record<string, unknown>, col: TemplateColumn): string => {
    const v = item[col.field];
    if (v === null || v === undefined || v === '') return '';
    if (col.format === 'currency') return `$ ${Number(v).toLocaleString('es-AR', { minimumFractionDigits: 2 })}`;
    if (col.format === 'percentage') return `${v}%`;
    return String(v);
  };

  const logoDim = LOGO_DIM[tpl.logoSize];
  const sepBorder = getSepBorder(tpl.separatorStyle, tpl.separatorWeight, tpl.primaryColor);
  const tblRadius = TABLE_RADIUS[tpl.tableBorderRadius];

  const LogoBox = ({ invert = false }: { invert?: boolean }) => (
    <div style={{
      width: logoDim.w, height: logoDim.h, borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center',
      border: `2px dashed ${invert ? 'rgba(255,255,255,0.6)' : tpl.accentColor}`,
      color: invert ? 'rgba(255,255,255,0.8)' : tpl.accentColor, fontSize: 9, fontWeight: 700, flexShrink: 0,
    }}>
      LOGO
    </div>
  );

  const DocInfo = ({ invert = false }: { invert?: boolean }) => {
    const c = invert ? 'rgba(255,255,255,0.9)' : tpl.primaryColor;
    const c2 = invert ? 'rgba(255,255,255,0.65)' : tpl.accentColor;
    return (
      <div style={{ textAlign: 'right' }}>
        <p style={{ fontSize: 14, fontWeight: 900, textTransform: 'uppercase', letterSpacing: 2, color: c }}>{tpl.labelDocumento}</p>
        {tpl.showNumero && <p style={{ fontSize: 9, fontFamily: 'monospace', marginTop: 1, color: c2 }}>N° 00001-00000001</p>}
        {tpl.showFecha && <p style={{ fontSize: 9, marginTop: 1, color: c2 }}>Fecha: 15/02/2026</p>}
        {tpl.showVencimiento && <p style={{ fontSize: 9, color: c2 }}>Válido hasta: 22/02/2026</p>}
      </div>
    );
  };

  const EmpresaInfo = ({ invert = false, centered = false }: { invert?: boolean; centered?: boolean }) => {
    const c = invert ? 'rgba(255,255,255,0.9)' : tpl.primaryColor;
    const c2 = invert ? 'rgba(255,255,255,0.65)' : tpl.accentColor;
    return (
      <div style={{ textAlign: centered ? 'center' : 'left' }}>
        <p style={{ fontSize: 11, fontWeight: 700, color: c }}>MI EMPRESA S.A.</p>
        <p style={{ fontSize: 9, color: c2 }}>CUIT 20-12345678-9 · info@empresa.com</p>
      </div>
    );
  };

  // ── Header variants
  const renderHeader = () => {
    if (tpl.headerLayout === 'banner') {
      return (
        <div style={{ backgroundColor: tpl.primaryColor, margin: '-24px -24px 16px -24px', padding: '16px 24px', display: 'flex', alignItems: 'center', gap: 16 }}>
          {tpl.logoPosition !== 'none' && <LogoBox invert />}
          <EmpresaInfo invert />
          <div style={{ marginLeft: 'auto' }}>
            <DocInfo invert />
          </div>
        </div>
      );
    }

    if (tpl.headerLayout === 'centered') {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, textAlign: 'center', paddingBottom: 8 }}>
          {tpl.logoPosition !== 'none' && <LogoBox />}
          <EmpresaInfo centered />
          <DocInfo />
        </div>
      );
    }

    if (tpl.headerLayout === 'compact') {
      return (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, alignItems: 'start' }}>
          <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
            {tpl.logoPosition !== 'none' && <LogoBox />}
            <EmpresaInfo />
          </div>
          <div>
            <DocInfo />
            <div style={{ marginTop: 8, paddingTop: 6, borderTop: sepBorder !== 'none' ? sepBorder : `1px solid ${tpl.primaryColor}20` }}>
              <p style={{ fontSize: 10, fontWeight: 700, color: tpl.primaryColor }}>CLIENTE DEMO S.A.</p>
              <p style={{ fontSize: 9, color: tpl.accentColor }}>Dirección del cliente · Ciudad</p>
              {tpl.showCondiciones && <p style={{ fontSize: 9, color: tpl.accentColor, marginTop: 2 }}>Cond.: Pago a 30 días</p>}
            </div>
          </div>
        </div>
      );
    }

    // classic (default)
    const logoLeft = tpl.logoPosition === 'top-left';
    const logoRight = tpl.logoPosition === 'top-right';
    return (
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
        {logoLeft && tpl.logoPosition !== 'none' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <LogoBox />
            <EmpresaInfo />
          </div>
        )}
        {!logoLeft && !logoRight && tpl.logoPosition !== 'none' && null}
        {tpl.logoPosition === 'none' && <EmpresaInfo />}
        <DocInfo />
        {logoRight && tpl.logoPosition !== 'none' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-end' }}>
            <LogoBox />
            <EmpresaInfo />
          </div>
        )}
      </div>
    );
  };

  const showClienteSection = tpl.headerLayout !== 'compact';

  return (
    <div className={cn('bg-white text-black shadow-sm text-xs leading-snug', fontClass, tpl.showBorder && 'border border-gray-300')}
         style={{ minHeight: 420, position: 'relative' }}>

      {/* Watermark */}
      {tpl.watermark && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none"
             style={{ opacity: 0.08, fontSize: 64, fontWeight: 900, color: tpl.primaryColor, transform: 'rotate(-30deg)', textTransform: 'uppercase', letterSpacing: 4 }}>
          {tpl.watermark}
        </div>
      )}

      <div className="p-6 space-y-4 relative z-10">
        {/* Header */}
        {renderHeader()}

        {/* Separator after header (skip for banner — it already has color) */}
        {tpl.headerLayout !== 'banner' && sepBorder !== 'none' && (
          <div style={{ borderTop: sepBorder, marginTop: 4 }} />
        )}

        {/* Cliente band (skip for compact — already inside header) */}
        {showClienteSection && (
          <div style={{
            padding: '6px 12px',
            borderTop: sepBorder !== 'none' ? sepBorder : `2px solid ${tpl.primaryColor}`,
            borderBottom: sepBorder !== 'none' ? sepBorder : `2px solid ${tpl.primaryColor}`,
          }}>
            <p style={{ fontWeight: 700, textAlign: 'center', color: tpl.primaryColor }}>CLIENTE DEMO S.A.</p>
            {tpl.showCondiciones && <p style={{ textAlign: 'center', fontSize: 9, marginTop: 2, color: tpl.accentColor }}>Pago a 30 días</p>}
          </div>
        )}

        {/* Tabla de items */}
        <div style={{ borderRadius: tblRadius, overflow: tblRadius !== '0' ? 'hidden' : undefined }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{
                backgroundColor: tpl.tableHeaderFill ? tpl.primaryColor : 'transparent',
                borderBottom: tpl.tableHeaderFill ? 'none' : sepBorder !== 'none' ? sepBorder : `2px solid ${tpl.primaryColor}`,
              }}>
                {visibleCols.map(col => (
                  <th key={col.field}
                      style={{
                        padding: '4px 4px',
                        fontWeight: 700,
                        fontSize: 9,
                        textTransform: 'uppercase',
                        color: tpl.tableHeaderFill ? 'white' : tpl.primaryColor,
                        textAlign: col.align === 'right' ? 'right' : col.align === 'center' ? 'center' : 'left',
                        width: col.width,
                      }}>
                    {col.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {SAMPLE_ITEMS.map((item, i) => (
                <tr key={i} style={{
                  borderBottom: sepBorder !== 'none' ? `1px solid ${tpl.accentColor}30` : `1px solid #e5e7eb`,
                  backgroundColor: tpl.tableZebraRows && i % 2 !== 0 ? `${tpl.primaryColor}0d` : 'transparent',
                }}>
                  {visibleCols.map(col => (
                    <td key={col.field} style={{
                      padding: '3px 4px',
                      textAlign: col.align === 'right' ? 'right' : col.align === 'center' ? 'center' : 'left',
                      fontVariantNumeric: col.align === 'right' ? 'tabular-nums' : undefined,
                    }}>
                      {formatVal(item as Record<string, unknown>, col)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Totales */}
        <div style={{ display: 'flex', gap: 32, borderTop: sepBorder !== 'none' ? sepBorder : `2px solid ${tpl.primaryColor}`, paddingTop: 8 }}>
          <div style={{ flex: 1 }}>
            {tpl.notasFooter && <p style={{ fontSize: 9, color: tpl.accentColor }}>{tpl.notasFooter}</p>}
          </div>
          <div style={{ minWidth: 140 }}>
            {tpl.showSubtotal && (
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, marginBottom: 2 }}>
                <span style={{ color: tpl.accentColor }}>Subtotal:</span><span style={{ fontVariantNumeric: 'tabular-nums' }}>$ 33.075,00</span>
              </div>
            )}
            {tpl.showIVA && (
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, marginBottom: 2 }}>
                <span style={{ color: tpl.accentColor }}>IVA 21%:</span><span style={{ fontVariantNumeric: 'tabular-nums' }}>$ 6.945,75</span>
              </div>
            )}
            {tpl.showTotal && (
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, fontWeight: 900, borderTop: `1px solid ${tpl.primaryColor}`, paddingTop: 2, marginTop: 2, color: tpl.primaryColor }}>
                <span>TOTAL:</span><span style={{ fontVariantNumeric: 'tabular-nums' }}>$ 40.020,75</span>
              </div>
            )}
          </div>
        </div>

        {/* Firma */}
        {tpl.firmaHabilitada && (
          <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: 16 }}>
            <div style={{ textAlign: 'center', minWidth: 140 }}>
              {tpl.firmaImagen ? (
                <img src={tpl.firmaImagen} style={{ height: 48, margin: '0 auto', objectFit: 'contain' }} alt="firma" />
              ) : (
                <div style={{ height: 40, borderBottom: `1px solid ${tpl.primaryColor}`, marginBottom: 4 }} />
              )}
              {tpl.firmaNombre && <p style={{ fontSize: 9, fontWeight: 700 }}>{tpl.firmaNombre}</p>}
              {tpl.firmaCargo && <p style={{ fontSize: 9, color: tpl.accentColor }}>{tpl.firmaCargo}</p>}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Preset Mini Preview ──────────────────────────────────────────────────────

function PresetMiniPreview({ p, active }: { p: PresetDef; active: boolean }) {
  const { config: c } = p;
  const sepStyle = c.separatorStyle === 'none' ? 'none'
    : c.separatorStyle === 'dashed' ? `1px dashed ${c.primaryColor}60`
    : c.separatorStyle === 'double' ? `2px double ${c.primaryColor}60`
    : `1px solid ${c.primaryColor}60`;
  const radius = c.tableBorderRadius === 'md' ? 3 : c.tableBorderRadius === 'sm' ? 2 : 0;

  return (
    <div style={{
      width: 72, height: 96, backgroundColor: 'white', borderRadius: 5,
      border: `2px solid ${active ? c.primaryColor : '#e5e7eb'}`,
      overflow: 'hidden', position: 'relative', flexShrink: 0,
      boxShadow: active ? `0 0 0 3px ${c.primaryColor}30` : undefined,
    }}>
      {/* Header */}
      {c.headerLayout === 'banner' ? (
        <div style={{ backgroundColor: c.primaryColor, height: 18, display: 'flex', alignItems: 'center', padding: '0 4px', gap: 3 }}>
          <div style={{ width: 10, height: 8, border: '1px solid rgba(255,255,255,0.5)', borderRadius: 1 }} />
          <div style={{ flex: 1, height: 2.5, backgroundColor: 'rgba(255,255,255,0.7)', borderRadius: 1 }} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 1, alignItems: 'flex-end' }}>
            <div style={{ width: 16, height: 2, backgroundColor: 'white', borderRadius: 1 }} />
            <div style={{ width: 10, height: 1.5, backgroundColor: 'rgba(255,255,255,0.6)', borderRadius: 1 }} />
          </div>
        </div>
      ) : c.headerLayout === 'centered' ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '4px 4px 2px', gap: 2 }}>
          <div style={{ width: 14, height: 9, border: `1.5px dashed ${c.primaryColor}`, borderRadius: 1 }} />
          <div style={{ width: 32, height: 2.5, backgroundColor: c.primaryColor, borderRadius: 1 }} />
          <div style={{ width: 22, height: 1.5, backgroundColor: c.accentColor + '80', borderRadius: 1 }} />
        </div>
      ) : c.headerLayout === 'compact' ? (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2, padding: '3px 4px 2px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <div style={{ width: 10, height: 8, border: `1.5px dashed ${c.primaryColor}`, borderRadius: 1 }} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              <div style={{ width: 16, height: 2, backgroundColor: c.primaryColor, borderRadius: 1 }} />
              <div style={{ width: 12, height: 1.5, backgroundColor: c.accentColor + '60', borderRadius: 1 }} />
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 1, alignItems: 'flex-end' }}>
            <div style={{ width: 20, height: 2.5, backgroundColor: c.primaryColor, borderRadius: 1 }} />
            <div style={{ width: 14, height: 1.5, backgroundColor: c.accentColor + '60', borderRadius: 1 }} />
          </div>
        </div>
      ) : (
        // classic
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '4px 4px 2px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <div style={{ width: 12, height: 10, border: `1.5px dashed ${c.primaryColor}`, borderRadius: 1 }} />
            <div style={{ width: 20, height: 1.5, backgroundColor: c.primaryColor, borderRadius: 1 }} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 1, alignItems: 'flex-end' }}>
            <div style={{ width: 22, height: 2.5, backgroundColor: c.primaryColor, borderRadius: 1 }} />
            <div style={{ width: 14, height: 1.5, backgroundColor: c.accentColor + '60', borderRadius: 1 }} />
          </div>
        </div>
      )}

      {/* Separator */}
      {sepStyle !== 'none' && (
        <div style={{ borderTop: sepStyle, margin: '0 4px 2px' }} />
      )}

      {/* Cliente band */}
      <div style={{ backgroundColor: c.primaryColor + '18', margin: '1px 0 2px', padding: '1.5px 4px', display: 'flex', justifyContent: 'center' }}>
        <div style={{ width: 30, height: 2, backgroundColor: c.primaryColor, borderRadius: 1 }} />
      </div>

      {/* Table */}
      <div style={{ margin: '0 4px', borderRadius: radius, overflow: 'hidden' }}>
        <div style={{ backgroundColor: c.tableHeaderFill ? c.primaryColor : 'transparent', padding: '2px 3px', display: 'grid', gridTemplateColumns: '3fr 1fr 1fr', gap: 2, marginBottom: 1 }}>
          {[0, 1, 2].map(i => (
            <div key={i} style={{ height: 2, backgroundColor: c.tableHeaderFill ? 'rgba(255,255,255,0.85)' : c.primaryColor, borderRadius: 1, opacity: c.tableHeaderFill ? 1 : 0.7 }} />
          ))}
        </div>
        {[0, 1, 2].map(row => (
          <div key={row} style={{
            display: 'grid', gridTemplateColumns: '3fr 1fr 1fr', padding: '1.5px 3px', gap: 2,
            backgroundColor: c.tableZebraRows && row % 2 !== 0 ? c.primaryColor + '14' : 'transparent',
          }}>
            <div style={{ height: 1.5, backgroundColor: '#00000018', borderRadius: 1 }} />
            <div style={{ height: 1.5, backgroundColor: '#00000012', borderRadius: 1 }} />
            <div style={{ height: 1.5, backgroundColor: '#00000012', borderRadius: 1 }} />
          </div>
        ))}
      </div>

      {/* Total */}
      <div style={{ position: 'absolute', bottom: 4, right: 4, display: 'flex', flexDirection: 'column', gap: 1, alignItems: 'flex-end' }}>
        <div style={{ width: 22, height: 1.5, backgroundColor: c.accentColor + '50', borderRadius: 1 }} />
        <div style={{ width: 26, height: 2.5, backgroundColor: c.primaryColor, borderRadius: 1 }} />
      </div>

      {/* Active checkmark */}
      {active && (
        <div style={{ position: 'absolute', top: 3, right: 3, width: 12, height: 12, borderRadius: '50%', backgroundColor: c.primaryColor, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Check style={{ width: 8, height: 8, color: 'white', strokeWidth: 3 }} />
        </div>
      )}
    </div>
  );
}

// ─── Column Sorter ────────────────────────────────────────────────────────────

function ColumnSorter({ columns, onChange }: { columns: TemplateColumn[], onChange: (cols: TemplateColumn[]) => void }) {
  const move = (idx: number, dir: -1 | 1) => {
    const next = [...columns];
    const swap = idx + dir;
    if (swap < 0 || swap >= next.length) return;
    [next[idx], next[swap]] = [next[swap], next[idx]];
    onChange(next);
  };

  const toggle = (idx: number) => {
    const next = [...columns];
    next[idx] = { ...next[idx], visible: !next[idx].visible };
    onChange(next);
  };

  const updateLabel = (idx: number, label: string) => {
    const next = [...columns];
    next[idx] = { ...next[idx], label };
    onChange(next);
  };

  return (
    <div className="space-y-1.5">
      {columns.map((col, idx) => (
        <div key={col.field} className={cn('flex items-center gap-2 px-2 py-1.5 rounded-md border text-sm', col.visible ? 'bg-background' : 'bg-muted/30 opacity-60')}>
          <GripVertical className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
          <Switch checked={col.visible} onCheckedChange={() => toggle(idx)} className="flex-shrink-0 scale-75" />
          <Input
            value={col.label}
            onChange={e => updateLabel(idx, e.target.value)}
            className="h-7 text-xs flex-1 min-w-0"
            disabled={!col.visible}
          />
          <span className="text-xs text-muted-foreground font-mono w-20 flex-shrink-0">{col.field}</span>
          <div className="flex gap-0.5 flex-shrink-0">
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => move(idx, -1)} disabled={idx === 0}>
              <ChevronUp className="h-3 w-3" />
            </Button>
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => move(idx, 1)} disabled={idx === columns.length - 1}>
              <ChevronDown className="h-3 w-3" />
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Payment Presets Editor ───────────────────────────────────────────────────

function PaymentPresetsEditor({ presets, onChange }: { presets: PaymentPreset[], onChange: (p: PaymentPreset[]) => void }) {
  const [editing, setEditing] = useState<number | null>(null);
  const [form, setForm] = useState({ label: '', value: '' });

  const startAdd = () => { setForm({ label: '', value: '' }); setEditing(-1); };
  const startEdit = (idx: number) => { setForm({ ...presets[idx] }); setEditing(idx); };

  const save = () => {
    if (!form.label.trim() || !form.value.trim()) return;
    if (editing === -1) {
      onChange([...presets, { ...form }]);
    } else if (editing !== null) {
      const next = [...presets];
      next[editing] = { ...form };
      onChange(next);
    }
    setEditing(null);
  };

  const remove = (idx: number) => onChange(presets.filter((_, i) => i !== idx));

  return (
    <div className="space-y-2">
      {presets.map((p, idx) => (
        <div key={idx} className="flex items-start gap-2 p-2 rounded-md border text-sm bg-muted/20">
          <div className="flex-1 min-w-0">
            <p className="font-medium text-xs">{p.label}</p>
            <p className="text-xs text-muted-foreground truncate">{p.value}</p>
          </div>
          <Button variant="ghost" size="icon" className="h-6 w-6 flex-shrink-0" onClick={() => startEdit(idx)}>
            <Pencil className="h-3 w-3" />
          </Button>
          <Button variant="ghost" size="icon" className="h-6 w-6 flex-shrink-0 text-destructive" onClick={() => remove(idx)}>
            <X className="h-3 w-3" />
          </Button>
        </div>
      ))}
      {editing !== null ? (
        <div className="p-2 rounded-md border space-y-2 bg-muted/10">
          <Input placeholder="Etiqueta (ej: 30 días)" value={form.label} onChange={e => setForm(f => ({ ...f, label: e.target.value }))} className="h-8 text-xs" />
          <Textarea placeholder="Texto completo (ej: Pago a 30 días de la factura)" value={form.value} onChange={e => setForm(f => ({ ...f, value: e.target.value }))} className="text-xs resize-none h-16" />
          <div className="flex gap-1">
            <Button size="sm" className="h-7 text-xs" onClick={save}>Guardar</Button>
            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setEditing(null)}>Cancelar</Button>
          </div>
        </div>
      ) : (
        <Button variant="outline" size="sm" className="w-full h-8 text-xs" onClick={startAdd}>
          <Plus className="h-3.5 w-3.5 mr-1" /> Agregar condición
        </Button>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function CotizacionesConfigPage() {
  const { currentCompany } = useCompany();
  const confirm = useConfirm();
  const [templates, setTemplates] = useState<QuoteTemplate[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [draft, setDraft] = useState<Omit<QuoteTemplate, 'id'>>(BLANK_TEMPLATE);
  const [loading, setLoading] = useState(true);
  const [showNewDialog, setShowNewDialog] = useState(false);
  const [newName, setNewName] = useState('');
  const [isLogoUploading, setIsLogoUploading] = useState(false);

  // — Plantillas de texto
  const [textTpls, setTextTpls] = useState<{ id: number; tipo: string; nombre: string; contenido: string }[]>([]);
  const [txtForm, setTxtForm] = useState({ tipo: 'NOTA', nombre: '', contenido: '' });
  const [txtEditing, setTxtEditing] = useState<number | null>(null); // id del item editando
  const [txtAdding, setTxtAdding] = useState(false);

  const selected = templates.find(t => t.id === selectedId);

  const loadTemplates = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/configuracion/cotizaciones');
      const data = await res.json();
      if (data.templates) {
        setTemplates(data.templates);
        const def = data.templates.find((t: QuoteTemplate) => t.isDefault) ?? data.templates[0];
        if (def && !selectedId) {
          setSelectedId(def.id);
          const { id, ...rest } = def;
          setDraft(rest);
        }
      }
    } catch {
      toast.error('Error al cargar templates');
    } finally {
      setLoading(false);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const loadTextTpls = useCallback(async () => {
    try {
      const res = await fetch('/api/configuracion/cotizaciones/text-templates');
      if (res.ok) setTextTpls(await res.json());
    } catch { /* non-critical */ }
  }, []);

  useEffect(() => { loadTemplates(); loadTextTpls(); }, [loadTemplates, loadTextTpls]);

  const selectTemplate = (t: QuoteTemplate) => {
    setSelectedId(t.id);
    const { id, ...rest } = t;
    setDraft(rest);
  };

  const update = <K extends keyof Omit<QuoteTemplate, 'id'>>(key: K, val: Omit<QuoteTemplate, 'id'>[K]) => {
    setDraft(d => ({ ...d, [key]: val }));
  };

  // Apply a full preset
  const applyPreset = (preset: PresetDef) => {
    setDraft(d => ({ ...d, ...preset.config }));
    toast.success(`Preset "${preset.name}" aplicado`, { duration: 1500 });
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { toast.error('Solo se permiten imágenes'); return; }
    setIsLogoUploading(true);
    toast.loading('Subiendo logo...', { id: 'logo-upload' });
    try {
      const formData = new FormData();
      formData.set('file', file);
      formData.set('entityType', 'quoteTemplate');
      formData.set('fileType', 'logo');
      const uploadRes = await fetch('/api/upload', { method: 'POST', body: formData });
      if (!uploadRes.ok) throw new Error('Error al subir imagen');
      const { url } = await uploadRes.json();
      // Guardar en el draft del template — no afecta el logo general de la empresa
      setDraft(prev => ({ ...prev, logoUrl: url }));
      toast.success('Logo cargado — guardá el template para aplicarlo', { id: 'logo-upload' });
    } catch (e: any) {
      toast.error(e.message || 'Error al subir logo', { id: 'logo-upload' });
    } finally {
      setIsLogoUploading(false);
      e.target.value = '';
    }
  };

  // ── Mutations ──────────────────────────────────────────────────────────────

  const saveMutation = useApiMutation<{ template?: { id: number } }, Omit<QuoteTemplate, 'id'> & { _selectedId?: number | null }>({
    mutationFn: async (vars) => {
      const id = vars._selectedId;
      const { _selectedId, ...body } = vars;
      const url = id ? `/api/configuracion/cotizaciones/${id}` : '/api/configuracion/cotizaciones';
      const method = id ? 'PATCH' : 'POST';
      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error');
      return data;
    },
    successMessage: 'Template guardado',
    errorMessage: 'Error al guardar',
    onSuccess: (data) => {
      loadTemplates();
      if (data.template?.id && !selectedId) setSelectedId(data.template.id);
    },
  });

  const createNewMutation = useApiMutation<{ template?: QuoteTemplate }, Omit<QuoteTemplate, 'id'>>({
    mutationFn: createFetchMutation({ url: '/api/configuracion/cotizaciones', method: 'POST' }),
    successMessage: 'Template creado',
    errorMessage: 'Error al crear',
    onSuccess: (data) => {
      setShowNewDialog(false);
      setNewName('');
      loadTemplates();
      if (data.template?.id) {
        setSelectedId(data.template.id);
        const { id, ...rest } = data.template;
        setDraft(rest);
      }
    },
  });

  const deleteMutation = useApiMutation<unknown, { id: number }>({
    mutationFn: createFetchMutation({ url: (vars) => `/api/configuracion/cotizaciones/${vars.id}`, method: 'DELETE' }),
    successMessage: 'Template eliminado',
    errorMessage: 'Error al eliminar',
    onSuccess: () => {
      setSelectedId(null);
      loadTemplates();
    },
  });

  const save = () => {
    saveMutation.mutate({ ...draft, _selectedId: selectedId } as any);
  };

  const createNew = () => {
    if (!newName.trim()) return;
    createNewMutation.mutate({ ...BLANK_TEMPLATE, nombre: newName.trim() } as any);
  };

  const deleteTemplate = async () => {
    if (!selectedId) return;
    const confirmed = await confirm({
      title: '¿Estás seguro?',
      description: '¿Eliminar este template? Esta acción no se puede deshacer.',
      variant: 'destructive',
    });
    if (!confirmed) return;
    deleteMutation.mutate({ id: selectedId });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex flex-col items-center gap-3">
          <div className="h-10 w-10 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
          <p className="text-sm text-muted-foreground">Cargando templates...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-120px)] flex flex-col gap-4 p-4">

      {/* Header */}
      <div className="flex items-center justify-between flex-shrink-0">
        <div>
          <h1 className="text-xl font-bold">Templates de Cotización</h1>
          <p className="text-sm text-muted-foreground">Configurá cómo se ve el presupuesto para tus clientes</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowNewDialog(true)}>
            <Plus className="h-4 w-4 mr-1" /> Nuevo template
          </Button>
          <Button size="sm" onClick={save} disabled={saveMutation.isPending}>
            <Save className="h-4 w-4 mr-1" /> Guardar cambios
          </Button>
        </div>
      </div>

      {/* Template selector */}
      {templates.length > 0 && (
        <div className="flex gap-2 flex-wrap flex-shrink-0">
          {templates.map(t => (
            <button
              key={t.id}
              onClick={() => selectTemplate(t)}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-sm font-medium transition-all',
                selectedId === t.id ? 'bg-primary text-primary-foreground border-primary' : 'bg-background hover:bg-muted/50'
              )}
            >
              {t.isDefault && <Star className="h-3 w-3" />}
              {t.nombre}
            </button>
          ))}
        </div>
      )}

      {/* ── Logo para cotizaciones (independiente del logo general de la empresa) ── */}
      <div className="flex-shrink-0 border rounded-xl p-4 bg-muted/20">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="h-12 w-20 rounded-lg border-2 border-dashed border-muted-foreground/30 flex items-center justify-center bg-background overflow-hidden flex-shrink-0">
              {draft.logoUrl ? (
                <img src={draft.logoUrl} alt="Logo cotizaciones" className="h-full w-full object-contain p-1" />
              ) : currentCompany?.logo ? (
                <img src={currentCompany.logo} alt="Logo empresa (fallback)" className="h-full w-full object-contain p-1 opacity-40" />
              ) : (
                <ImageIcon className="h-5 w-5 text-muted-foreground/40" />
              )}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold">Logo para cotizaciones</p>
              <p className="text-xs text-muted-foreground leading-relaxed">
                {draft.logoUrl
                  ? 'Logo personalizado para este template'
                  : currentCompany?.logo
                    ? 'Usando el logo general (en gris) — subí uno específico para cotizaciones si querés otro'
                    : 'Sin logo — podés subir uno específico para este template'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {draft.logoUrl && (
              <Button
                variant="ghost"
                size="sm"
                className="text-muted-foreground hover:text-destructive"
                onClick={() => setDraft(prev => ({ ...prev, logoUrl: null }))}
              >
                Quitar
              </Button>
            )}
            <Button variant="outline" size="sm" disabled={isLogoUploading} asChild>
              <label className="cursor-pointer">
                {isLogoUploading ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Upload className="h-3.5 w-3.5 mr-1.5" />}
                {isLogoUploading ? 'Subiendo...' : draft.logoUrl ? 'Cambiar' : 'Subir logo'}
                <input type="file" accept="image/*" onChange={handleLogoUpload} className="hidden" />
              </label>
            </Button>
          </div>
        </div>
      </div>

      {/* ── Preset Gallery ── */}
      <div className="flex-shrink-0">
        <div className="flex items-center gap-2 mb-2">
          <Sparkles className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Estilos prediseñados</span>
          <span className="text-xs text-muted-foreground">— hacé click para aplicar como punto de partida</span>
        </div>
        <div className="flex gap-3 overflow-x-auto pb-1">
          {PRESETS.map(preset => (
            <button
              key={preset.id}
              onClick={() => applyPreset(preset)}
              className="flex flex-col items-center gap-2 group flex-shrink-0"
            >
              <PresetMiniPreview p={preset} active={draft.preset === preset.id} />
              <div className="text-center">
                <p className={cn(
                  'text-xs font-semibold leading-none',
                  draft.preset === preset.id ? 'text-primary' : 'text-foreground group-hover:text-primary'
                )}>
                  {preset.name}
                </p>
                <p className="text-[9px] text-muted-foreground mt-0.5 leading-none">{preset.description}</p>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Main layout: Config 40% | Preview 60% */}
      <div className="flex-1 flex gap-4 min-h-0">

        {/* Config panel */}
        <div className="w-2/5 flex-shrink-0 flex flex-col border rounded-xl overflow-hidden">
          <Tabs defaultValue="visual" className="flex flex-col h-full">
            <div className="border-b bg-muted/30 flex-shrink-0">
              <TabsList className="h-9 w-full rounded-none bg-transparent border-0 gap-0 flex">
                <TabsTrigger value="visual" className="flex-1 rounded-none data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:shadow-none text-xs">
                  <Palette className="h-3 w-3 mr-1" /> Visual
                </TabsTrigger>
                <TabsTrigger value="disenio" className="flex-1 rounded-none data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:shadow-none text-xs">
                  <Sliders className="h-3 w-3 mr-1" /> Diseño
                </TabsTrigger>
                <TabsTrigger value="columnas" className="flex-1 rounded-none data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:shadow-none text-xs">
                  <Columns className="h-3 w-3 mr-1" /> Columnas
                </TabsTrigger>
                <TabsTrigger value="firma" className="flex-1 rounded-none data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:shadow-none text-xs">
                  <PenLine className="h-3 w-3 mr-1" /> Firma
                </TabsTrigger>
                <TabsTrigger value="condiciones" className="flex-1 rounded-none data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:shadow-none text-xs">
                  <CreditCard className="h-3 w-3 mr-1" /> Cond.
                </TabsTrigger>
                <TabsTrigger value="plantillas" className="flex-1 rounded-none data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:shadow-none text-xs">
                  <FileText className="h-3 w-3 mr-1" /> Textos
                </TabsTrigger>
              </TabsList>
            </div>

            <div className="flex-1 overflow-y-auto">

              {/* ── TAB: Visual ── */}
              <TabsContent value="visual" className="p-4 space-y-4 mt-0">
                <div className="space-y-2">
                  <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Nombre del template</Label>
                  <Input value={draft.nombre} onChange={e => update('nombre', e.target.value)} className="h-8 text-sm" />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-sm font-medium">Template por defecto</Label>
                    <p className="text-xs text-muted-foreground">Se usa cuando no se elige uno específico</p>
                  </div>
                  <Switch checked={draft.isDefault} onCheckedChange={v => update('isDefault', v)} />
                </div>

                <div className="space-y-2">
                  <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Título del documento</Label>
                  <Input value={draft.labelDocumento} onChange={e => update('labelDocumento', e.target.value)} className="h-8 text-sm" placeholder="PRESUPUESTO" />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Color principal</Label>
                    <div className="flex items-center gap-2">
                      <input type="color" value={draft.primaryColor} onChange={e => update('primaryColor', e.target.value)} className="h-8 w-12 rounded cursor-pointer border" />
                      <Input value={draft.primaryColor} onChange={e => update('primaryColor', e.target.value)} className="h-8 text-xs font-mono" />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Color secundario</Label>
                    <div className="flex items-center gap-2">
                      <input type="color" value={draft.accentColor} onChange={e => update('accentColor', e.target.value)} className="h-8 w-12 rounded cursor-pointer border" />
                      <Input value={draft.accentColor} onChange={e => update('accentColor', e.target.value)} className="h-8 text-xs font-mono" />
                    </div>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Tipografía</Label>
                  <Select value={draft.fontFamily} onValueChange={v => update('fontFamily', v as FontFamily)}>
                    <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="sans">Sans-serif (moderna)</SelectItem>
                      <SelectItem value="serif">Serif (clásica)</SelectItem>
                      <SelectItem value="mono">Monospace (técnica)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* ── Layout del header ── */}
                <div className="space-y-2">
                  <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Layout del header</Label>
                  <div className="grid grid-cols-2 gap-2">
                    {([
                      { value: 'classic' as HeaderLayout, label: 'Clásico', desc: 'Logo izq · info der' },
                      { value: 'centered' as HeaderLayout, label: 'Centrado', desc: 'Logo y texto centrados' },
                      { value: 'banner' as HeaderLayout, label: 'Banner', desc: 'Faja de color full-width' },
                      { value: 'compact' as HeaderLayout, label: 'Compacto', desc: 'Grid 2 columnas' },
                    ]).map(opt => (
                      <button
                        key={opt.value}
                        onClick={() => update('headerLayout', opt.value)}
                        className={cn(
                          'p-2 rounded-lg border-2 text-left transition-all',
                          draft.headerLayout === opt.value ? 'border-primary bg-primary/5' : 'border-muted hover:border-muted-foreground/40'
                        )}
                      >
                        {/* Mini header sketch */}
                        <div className="mb-1.5 h-8 rounded bg-muted/30 border border-muted overflow-hidden flex flex-col justify-start p-1 gap-0.5">
                          {opt.value === 'banner' && (
                            <div className="w-full h-3 rounded-sm flex items-center px-1 gap-1" style={{ backgroundColor: draft.primaryColor }}>
                              <div className="w-3 h-2 border border-white/50 rounded-sm flex-shrink-0" />
                              <div className="flex-1 h-1 bg-white/60 rounded-sm" />
                              <div className="w-4 h-1 bg-white/80 rounded-sm" />
                            </div>
                          )}
                          {opt.value === 'centered' && (
                            <div className="flex flex-col items-center gap-0.5">
                              <div className="w-5 h-3 border border-muted-foreground/30 rounded-sm" />
                              <div className="w-8 h-1 rounded-sm" style={{ backgroundColor: draft.primaryColor + '80' }} />
                            </div>
                          )}
                          {opt.value === 'compact' && (
                            <div className="grid grid-cols-2 gap-1">
                              <div className="flex items-center gap-0.5">
                                <div className="w-3 h-3 border border-muted-foreground/30 rounded-sm" />
                                <div className="flex-1 h-1 rounded-sm" style={{ backgroundColor: draft.primaryColor + '60' }} />
                              </div>
                              <div className="flex flex-col items-end gap-0.5">
                                <div className="w-5 h-1 rounded-sm" style={{ backgroundColor: draft.primaryColor + '80' }} />
                                <div className="w-3 h-0.5 rounded-sm bg-muted-foreground/30" />
                              </div>
                            </div>
                          )}
                          {opt.value === 'classic' && (
                            <div className="flex justify-between items-start">
                              <div className="w-4 h-3 border border-muted-foreground/30 rounded-sm" />
                              <div className="flex flex-col items-end gap-0.5">
                                <div className="w-6 h-1.5 rounded-sm" style={{ backgroundColor: draft.primaryColor + '80' }} />
                                <div className="w-4 h-0.5 rounded-sm bg-muted-foreground/30" />
                              </div>
                            </div>
                          )}
                        </div>
                        <p className="text-xs font-semibold">{opt.label}</p>
                        <p className="text-[9px] text-muted-foreground">{opt.desc}</p>
                      </button>
                    ))}
                  </div>
                </div>

                {/* ── Logo options ── */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Posición del logo</Label>
                    <Select value={draft.logoPosition} onValueChange={v => update('logoPosition', v as LogoPosition)}>
                      <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="top-left">Izquierda</SelectItem>
                        <SelectItem value="top-center">Centro</SelectItem>
                        <SelectItem value="top-right">Derecha</SelectItem>
                        <SelectItem value="none">Sin logo</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Tamaño del logo</Label>
                    <Select value={draft.logoSize} onValueChange={v => update('logoSize', v as LogoSize)}>
                      <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="small">Pequeño (60 × 32 px)</SelectItem>
                        <SelectItem value="medium">Mediano (88 × 44 px)</SelectItem>
                        <SelectItem value="large">Grande (130 × 64 px)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Marca de agua (opcional)</Label>
                  <Input value={draft.watermark ?? ''} onChange={e => update('watermark', e.target.value || null)} className="h-8 text-sm" placeholder="ej: BORRADOR" />
                </div>

                <div className="border rounded-lg p-3 space-y-2">
                  <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Mostrar en header</Label>
                  {([['showNumero', 'Número de documento'], ['showFecha', 'Fecha de emisión'], ['showVencimiento', 'Fecha de vencimiento']] as const).map(([key, label]) => (
                    <div key={key} className="flex items-center justify-between">
                      <span className="text-sm">{label}</span>
                      <Switch checked={draft[key] as boolean} onCheckedChange={v => update(key, v)} />
                    </div>
                  ))}
                </div>

                <div className="border rounded-lg p-3 space-y-2">
                  <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Mostrar en footer</Label>
                  {([['showSubtotal', 'Subtotal'], ['showIVA', 'IVA'], ['showTotal', 'Total'], ['showCondiciones', 'Condiciones de pago']] as const).map(([key, label]) => (
                    <div key={key} className="flex items-center justify-between">
                      <span className="text-sm">{label}</span>
                      <Switch checked={draft[key] as boolean} onCheckedChange={v => update(key, v)} />
                    </div>
                  ))}
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs text-muted-foreground">Notas pre-cargadas</Label>
                    <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                      {draft.notasPosition === 'before_items' ? 'Posición: arriba' : 'Posición: al pie'}
                    </span>
                  </div>
                  <Textarea
                    value={draft.notasFooter ?? ''}
                    onChange={e => update('notasFooter', e.target.value || null)}
                    className="text-xs resize-none h-16"
                    placeholder="ej: Precios en pesos. Válido por 15 días."
                  />
                  <p className="text-[10px] text-muted-foreground">Se pre-carga al crear cotizaciones con este template, pero es editable por cotización</p>
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-sm font-medium">Borde exterior</Label>
                    <p className="text-xs text-muted-foreground">Muestra un borde alrededor del documento</p>
                  </div>
                  <Switch checked={draft.showBorder} onCheckedChange={v => update('showBorder', v)} />
                </div>

                {selectedId && (
                  <div className="pt-2 border-t">
                    <Button variant="outline" size="sm" className="text-destructive hover:bg-destructive/5 w-full" onClick={deleteTemplate}>
                      <Trash2 className="h-3.5 w-3.5 mr-1" /> Eliminar template
                    </Button>
                  </div>
                )}
              </TabsContent>

              {/* ── TAB: Diseño ── */}
              <TabsContent value="disenio" className="p-4 space-y-5 mt-0">

                {/* Separadores */}
                <div className="space-y-3">
                  <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Separadores / líneas</Label>

                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Estilo</Label>
                    <div className="grid grid-cols-2 gap-2">
                      {([
                        { value: 'solid' as SeparatorStyle, label: 'Sólido' },
                        { value: 'dashed' as SeparatorStyle, label: 'Punteado' },
                        { value: 'double' as SeparatorStyle, label: 'Doble' },
                        { value: 'none' as SeparatorStyle, label: 'Sin línea' },
                      ]).map(opt => (
                        <button
                          key={opt.value}
                          onClick={() => update('separatorStyle', opt.value)}
                          className={cn(
                            'p-2 rounded-lg border-2 text-center transition-all',
                            draft.separatorStyle === opt.value ? 'border-primary bg-primary/5' : 'border-muted hover:border-muted-foreground/40'
                          )}
                        >
                          <div className="flex items-center justify-center h-5 mb-1">
                            {opt.value === 'none' ? (
                              <span className="text-xs text-muted-foreground">sin línea</span>
                            ) : (
                              <div className="w-full" style={{
                                borderTop: opt.value === 'double'
                                  ? '3px double #666'
                                  : `2px ${opt.value} #666`,
                              }} />
                            )}
                          </div>
                          <p className="text-xs font-medium">{opt.label}</p>
                        </button>
                      ))}
                    </div>
                  </div>

                  {draft.separatorStyle !== 'none' && (
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">Grosor</Label>
                      <div className="flex gap-2">
                        {([
                          { value: 'thin' as SeparatorWeight, label: 'Fino', px: '1px' },
                          { value: 'medium' as SeparatorWeight, label: 'Medio', px: '2px' },
                          { value: 'thick' as SeparatorWeight, label: 'Grueso', px: '4px' },
                        ]).map(opt => (
                          <button
                            key={opt.value}
                            onClick={() => update('separatorWeight', opt.value)}
                            className={cn(
                              'flex-1 py-2 px-2 rounded-lg border-2 text-center transition-all',
                              draft.separatorWeight === opt.value ? 'border-primary bg-primary/5' : 'border-muted hover:border-muted-foreground/40'
                            )}
                          >
                            <div className="flex items-center justify-center mb-1" style={{ height: '12px' }}>
                              <div className="w-6" style={{
                                borderTop: `${opt.px} ${draft.separatorStyle === 'dashed' ? 'dashed' : 'solid'} #666`,
                              }} />
                            </div>
                            <p className="text-xs font-medium">{opt.label}</p>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <div className="border-t" />

                {/* Tabla */}
                <div className="space-y-3">
                  <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Tabla de productos</Label>

                  <div className="flex items-center justify-between">
                    <div>
                      <Label className="text-sm font-medium">Header con relleno de color</Label>
                      <p className="text-xs text-muted-foreground">El encabezado usa el color principal</p>
                    </div>
                    <Switch checked={draft.tableHeaderFill} onCheckedChange={v => update('tableHeaderFill', v)} />
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <Label className="text-sm font-medium">Filas alternadas (zebra)</Label>
                      <p className="text-xs text-muted-foreground">Filas pares con fondo suave de color</p>
                    </div>
                    <Switch checked={draft.tableZebraRows} onCheckedChange={v => update('tableZebraRows', v)} />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Radio de bordes de la tabla</Label>
                    <div className="flex gap-2">
                      {([
                        { value: 'none' as TableBorderRadius, label: 'Sin radio', preview: 'rounded-none' },
                        { value: 'sm' as TableBorderRadius, label: 'Suave', preview: 'rounded' },
                        { value: 'md' as TableBorderRadius, label: 'Redondeado', preview: 'rounded-lg' },
                      ]).map(opt => (
                        <button
                          key={opt.value}
                          onClick={() => update('tableBorderRadius', opt.value)}
                          className={cn(
                            'flex-1 py-2 px-2 rounded-lg border-2 text-center transition-all',
                            draft.tableBorderRadius === opt.value ? 'border-primary bg-primary/5' : 'border-muted hover:border-muted-foreground/40'
                          )}
                        >
                          <div className="flex justify-center mb-1">
                            <div className={cn('w-10 h-5 border-2 border-current bg-muted/30', opt.preview)} />
                          </div>
                          <p className="text-xs font-medium">{opt.label}</p>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="border-t" />

                {/* Posición de notas */}
                <div className="space-y-3">
                  <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Posición de las notas</Label>
                  <div className="grid grid-cols-2 gap-2">
                    {([
                      {
                        value: 'before_items' as const,
                        label: 'Arriba de productos',
                        desc: 'Las notas aparecen antes de la tabla',
                        icon: AlignStartVertical,
                      },
                      {
                        value: 'after_totals' as const,
                        label: 'Al pie del documento',
                        desc: 'Las notas aparecen después de los totales',
                        icon: AlignEndVertical,
                      },
                    ]).map(opt => {
                      const Icon = opt.icon;
                      return (
                        <button
                          key={opt.value}
                          onClick={() => update('notasPosition', opt.value)}
                          className={cn(
                            'p-3 rounded-lg border-2 text-left transition-all space-y-1.5',
                            draft.notasPosition === opt.value ? 'border-primary bg-primary/5' : 'border-muted hover:border-muted-foreground/40'
                          )}
                        >
                          <Icon className={cn('h-4 w-4', draft.notasPosition === opt.value ? 'text-primary' : 'text-muted-foreground')} />
                          <p className="text-xs font-semibold leading-tight">{opt.label}</p>
                          <p className="text-[10px] text-muted-foreground leading-tight">{opt.desc}</p>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </TabsContent>

              {/* ── TAB: Columnas ── */}
              <TabsContent value="columnas" className="p-4 mt-0">
                <p className="text-xs text-muted-foreground mb-3">Activá las columnas que querés mostrar en la tabla de productos. Reordenalas con las flechas.</p>
                <ColumnSorter columns={draft.columns} onChange={cols => update('columns', cols)} />
              </TabsContent>

              {/* ── TAB: Firma ── */}
              <TabsContent value="firma" className="p-4 space-y-4 mt-0">
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-sm font-medium">Habilitar firma</Label>
                    <p className="text-xs text-muted-foreground">Muestra una sección de firma al pie</p>
                  </div>
                  <Switch checked={draft.firmaHabilitada} onCheckedChange={v => update('firmaHabilitada', v)} />
                </div>

                {draft.firmaHabilitada && (
                  <>
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">Nombre</Label>
                      <Input value={draft.firmaNombre ?? ''} onChange={e => update('firmaNombre', e.target.value || null)} className="h-8 text-sm" placeholder="ej: Juan Pérez" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">Cargo</Label>
                      <Input value={draft.firmaCargo ?? ''} onChange={e => update('firmaCargo', e.target.value || null)} className="h-8 text-sm" placeholder="ej: Gerente Comercial" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">URL imagen de firma (PNG/SVG)</Label>
                      <Input value={draft.firmaImagen ?? ''} onChange={e => update('firmaImagen', e.target.value || null)} className="h-8 text-sm" placeholder="https://..." />
                    </div>
                  </>
                )}

                <div className="flex items-center justify-between pt-2 border-t">
                  <div>
                    <Label className="text-sm font-medium">Aprobación online</Label>
                    <p className="text-xs text-muted-foreground">El cliente puede aprobar el presupuesto desde un link</p>
                  </div>
                  <Switch checked={draft.allowOnlineApproval} onCheckedChange={v => update('allowOnlineApproval', v)} />
                </div>

                {draft.allowOnlineApproval && (
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Mensaje al cliente al aprobar</Label>
                    <Textarea
                      value={draft.approvalMessage ?? ''}
                      onChange={e => update('approvalMessage', e.target.value || null)}
                      className="text-xs resize-none h-20"
                      placeholder="Gracias por aprobar el presupuesto. Nos comunicaremos para coordinar los próximos pasos."
                    />
                  </div>
                )}
              </TabsContent>

              {/* ── TAB: Condiciones ── */}
              <TabsContent value="condiciones" className="p-4 mt-0">
                <p className="text-xs text-muted-foreground mb-3">Definí las condiciones de pago predefinidas para usar rápidamente al crear presupuestos.</p>
                <PaymentPresetsEditor
                  presets={draft.paymentConditionPresets}
                  onChange={presets => update('paymentConditionPresets', presets)}
                />
              </TabsContent>

              {/* ── TAB: Plantillas de texto ── */}
              <TabsContent value="plantillas" className="p-4 mt-0 space-y-4">
                <p className="text-xs text-muted-foreground">
                  Mensajes reutilizables para <strong>Notas</strong>, <strong>Condiciones de pago</strong> y <strong>Condiciones de entrega</strong>.
                  Aparecen como botones de selección rápida al crear cotizaciones.
                </p>

                {/* Lista de plantillas agrupada por tipo */}
                {(['NOTA', 'PAGO', 'ENTREGA'] as const).map(tipo => {
                  const tipoLabel = { NOTA: 'Notas', PAGO: 'Condiciones de pago', ENTREGA: 'Condiciones de entrega' }[tipo];
                  const items = textTpls.filter(t => t.tipo === tipo);
                  return (
                    <div key={tipo} className="space-y-2">
                      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{tipoLabel}</p>
                      {items.map(t => (
                        <div key={t.id} className="flex items-start gap-2 p-2 rounded-md border text-sm bg-muted/20">
                          {txtEditing === t.id ? (
                            <div className="flex-1 space-y-2">
                              <Input
                                value={txtForm.nombre}
                                onChange={e => setTxtForm(f => ({ ...f, nombre: e.target.value }))}
                                className="h-7 text-xs"
                                placeholder="Nombre del botón"
                              />
                              <Textarea
                                value={txtForm.contenido}
                                onChange={e => setTxtForm(f => ({ ...f, contenido: e.target.value }))}
                                className="text-xs resize-none h-16"
                                placeholder="Texto completo..."
                              />
                              <div className="flex gap-1">
                                <Button size="sm" className="h-7 text-xs" onClick={async () => {
                                  const res = await fetch(`/api/configuracion/cotizaciones/text-templates/${t.id}`, {
                                    method: 'PUT',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({ nombre: txtForm.nombre, contenido: txtForm.contenido }),
                                  });
                                  if (res.ok) { await loadTextTpls(); setTxtEditing(null); toast.success('Actualizado'); }
                                  else toast.error('Error al actualizar');
                                }}>Guardar</Button>
                                <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setTxtEditing(null)}>Cancelar</Button>
                              </div>
                            </div>
                          ) : (
                            <>
                              <div className="flex-1 min-w-0">
                                <p className="font-medium text-xs">{t.nombre}</p>
                                <p className="text-xs text-muted-foreground line-clamp-2">{t.contenido}</p>
                              </div>
                              <Button variant="ghost" size="icon" className="h-6 w-6 flex-shrink-0" onClick={() => {
                                setTxtEditing(t.id);
                                setTxtForm({ tipo: t.tipo, nombre: t.nombre, contenido: t.contenido });
                              }}>
                                <Pencil className="h-3 w-3" />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-6 w-6 flex-shrink-0 text-destructive" onClick={async () => {
                                const ok = await confirm({ title: 'Eliminar plantilla', description: `¿Eliminar "${t.nombre}"?`, confirmLabel: 'Eliminar', variant: 'destructive' });
                                if (!ok) return;
                                const res = await fetch(`/api/configuracion/cotizaciones/text-templates/${t.id}`, { method: 'DELETE' });
                                if (res.ok) { await loadTextTpls(); toast.success('Eliminado'); }
                                else toast.error('Error al eliminar');
                              }}>
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </>
                          )}
                        </div>
                      ))}
                      {/* Add new of this type */}
                      {txtAdding && txtForm.tipo === tipo ? (
                        <div className="p-2 rounded-md border space-y-2 bg-muted/10">
                          <Input
                            placeholder="Nombre del botón (ej: Pago 30 días)"
                            value={txtForm.nombre}
                            onChange={e => setTxtForm(f => ({ ...f, nombre: e.target.value }))}
                            className="h-8 text-xs"
                            autoFocus
                          />
                          <Textarea
                            placeholder="Texto que se inserta al seleccionar..."
                            value={txtForm.contenido}
                            onChange={e => setTxtForm(f => ({ ...f, contenido: e.target.value }))}
                            className="text-xs resize-none h-20"
                          />
                          <div className="flex gap-1">
                            <Button size="sm" className="h-7 text-xs" onClick={async () => {
                              if (!txtForm.nombre.trim() || !txtForm.contenido.trim()) return;
                              const res = await fetch('/api/configuracion/cotizaciones/text-templates', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ tipo, nombre: txtForm.nombre, contenido: txtForm.contenido }),
                              });
                              if (res.ok) {
                                await loadTextTpls();
                                setTxtAdding(false);
                                setTxtForm({ tipo: 'NOTA', nombre: '', contenido: '' });
                                toast.success('Plantilla creada');
                              } else toast.error('Error al crear plantilla');
                            }}>
                              Guardar
                            </Button>
                            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setTxtAdding(false)}>Cancelar</Button>
                          </div>
                        </div>
                      ) : (
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full h-8 text-xs"
                          onClick={() => { setTxtAdding(true); setTxtEditing(null); setTxtForm({ tipo, nombre: '', contenido: '' }); }}
                        >
                          <Plus className="h-3.5 w-3.5 mr-1" /> Agregar {tipoLabel.toLowerCase()}
                        </Button>
                      )}
                    </div>
                  );
                })}
              </TabsContent>
            </div>
          </Tabs>
        </div>

        {/* Preview panel */}
        <div className="flex-1 flex flex-col min-h-0">
          <div className="flex items-center gap-2 mb-3 flex-shrink-0">
            <Eye className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium text-muted-foreground">Vista previa en tiempo real</span>
            <Badge variant="secondary" className="text-xs">{draft.labelDocumento || 'PRESUPUESTO'}</Badge>
            {draft.preset && (
              <Badge variant="outline" className="text-xs capitalize">
                <Sparkles className="h-2.5 w-2.5 mr-1" />{draft.preset}
              </Badge>
            )}
          </div>
          <div className="flex-1 overflow-y-auto rounded-xl border bg-muted/20 p-4">
            <TemplatePreview tpl={draft} />
          </div>
        </div>
      </div>

      {/* New template dialog */}
      <Dialog open={showNewDialog} onOpenChange={setShowNewDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Nuevo template</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <Label className="text-sm">Nombre del template</Label>
            <Input
              value={newName}
              onChange={e => setNewName(e.target.value)}
              placeholder="ej: Template Express"
              onKeyDown={e => e.key === 'Enter' && createNew()}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewDialog(false)}>Cancelar</Button>
            <Button onClick={createNew} disabled={!newName.trim() || createNewMutation.isPending}>Crear</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
