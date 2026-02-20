'use client';

import { useState, useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useCompany } from '@/contexts/CompanyContext';
import { cn } from '@/lib/utils';
import RecetasV2 from '@/components/recetas/RecetasV2';
import { IndirectViewV2 } from '@/components/costos/v2/IndirectViewV2';
import { PurchasesViewV2 } from '@/components/costos/v2/PurchasesViewV2';
import { ProductionViewV2 } from '@/components/costos/v2/ProductionViewV2';
import { SalesViewV2 } from '@/components/costos/v2/SalesViewV2';
import { PayrollViewV2 } from '@/components/costos/v2/PayrollViewV2';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  LayoutDashboard,
  Users,
  ShoppingCart,
  Building2,
  Factory,
  Receipt,
  Settings2,
  ChevronRight,
  TrendingUp,
  TrendingDown,
  DollarSign,
  AlertCircle,
  CheckCircle2,
  RefreshCw,
  Download,
  Calendar,
  Target,
  PieChart,
  BarChart3,
  ArrowUpRight,
  ArrowDownRight,
  Sparkles,
  Layers,
  GitBranch,
  Link2,
  Lock,
  Plus,
  Edit,
  Trash2,
  Star,
  BookMarked,
  Zap,
  Shield,
  Truck,
  Package,
  Calculator,
  Shuffle,
  ChefHat,
  Percent,
  Clock,
  User,
  Beaker,
  Activity,
  Wallet,
  CreditCard,
  TrendingDown as TrendDownIcon,
  CircleDollarSign,
  PiggyBank,
  LineChart,
  AreaChart,
  ArrowRight,
  Eye,
  Filter,
  MoreHorizontal,
  Info,
  XCircle,
  Banknote,
  Scale,
  Gauge,
  Timer,
  Award,
  Flame,
  Snowflake,
  Sun,
  Moon,
  Lightbulb,
  Box,
  Boxes,
  FileText,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  AlertTriangle,
  Link,
  BarChart2,
  PackageSearch,
  Grid3X3,
  ThumbsUp,
  ThumbsDown,
} from 'lucide-react';
import { toast } from 'sonner';

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';

// Import existing components
import DistribucionCostos from '@/components/configuracion/DistribucionCostos';
import { CalculadoraCostosEmbedded } from '@/components/costos/CalculadoraCostosEmbedded';
import { CostVersionToggle } from '@/components/costos/CostVersionToggle';
import CostDistributionMatrix from '@/components/configuracion/CostDistributionMatrix';
import EmployeeCostDistributionMatrix from '@/components/configuracion/EmployeeCostDistributionMatrix';
import { RentabilidadView } from '@/components/costos/v2/RentabilidadView';

interface ExecutiveDashboardV2Props {
  selectedMonth: string;
  companyId: string;
  onMonthChange?: (month: string) => void;
}

// Secciones del Centro de Costos V2
const COST_SECTIONS = [
  { id: 'overview', name: 'Vista General', description: 'Dashboard ejecutivo consolidado', icon: LayoutDashboard, status: 'active', group: 'main' },
  { id: 'nominas', name: 'Nóminas', description: 'Costos laborales automáticos', icon: Users, status: 'connected', source: 'PayrollRun', group: 'costos' },
  { id: 'compras', name: 'Compras', description: 'Recepciones de mercadería', icon: ShoppingCart, status: 'connected', source: 'GoodsReceipt', group: 'costos' },
  { id: 'indirectos', name: 'Indirectos', description: 'Servicios y gastos fijos', icon: Building2, status: 'connected', source: 'COMPRAS', group: 'costos' },
  { id: 'produccion', name: 'Producción', description: 'Consumo de insumos', icon: Factory, status: 'connected', source: 'MonthlyProduction', group: 'costos' },
  { id: 'ventas', name: 'Ventas', description: 'Ingresos y márgenes', icon: Receipt, status: 'connected', source: 'SalesInvoice', group: 'costos' },
  { id: 'distribucion', name: 'Distribución', description: 'Asignación de costos', icon: Shuffle, status: 'active', group: 'herramientas' },
  { id: 'rentabilidad', name: 'Rentabilidad', description: 'P&L real por producto', icon: TrendingUp, status: 'active', group: 'herramientas' },
  { id: 'calculadora', name: 'Calculadora', description: 'Simulador de costos', icon: Calculator, status: 'active', group: 'herramientas' },
  { id: 'recetas', name: 'Recetas', description: 'Fórmulas y composición', icon: ChefHat, status: 'active', group: 'herramientas' },
  { id: 'config', name: 'Configuración', description: 'Fuentes y ajustes', icon: Settings2, status: 'active', group: 'sistema' },
] as const;

type SectionId = typeof COST_SECTIONS[number]['id'];

const formatCurrency = (value: number): string => {
  return (value ?? 0).toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
};

const formatPercent = (value: number): string => (value ?? 0).toFixed(1) + '%';

const STATUS_STYLES = {
  active: { bg: 'bg-success-muted', text: 'text-success', label: 'Activo' },
  connected: { bg: 'bg-info-muted', text: 'text-info-muted-foreground', label: 'Conectado' },
  partial: { bg: 'bg-warning-muted', text: 'text-warning-muted-foreground', label: 'Parcial' },
  pending: { bg: 'bg-muted', text: 'text-muted-foreground', label: 'Pendiente' },
};

// Mock data para gráficos
const MONTHLY_DATA = [
  { month: 'Ago', ingresos: 2100000, costos: 1650000, margen: 450000 },
  { month: 'Sep', ingresos: 2250000, costos: 1720000, margen: 530000 },
  { month: 'Oct', ingresos: 2180000, costos: 1690000, margen: 490000 },
  { month: 'Nov', ingresos: 2320000, costos: 1780000, margen: 540000 },
  { month: 'Dic', ingresos: 2380000, costos: 1820000, margen: 560000 },
  { month: 'Ene', ingresos: 2450000, costos: 1890000, margen: 560000 },
];

const COST_BREAKDOWN = [
  { name: 'Nóminas', value: 780000, percent: 41.3, color: 'bg-info', trend: 5.2 },
  { name: 'Compras', value: 520000, percent: 27.5, color: 'bg-success', trend: 8.5 },
  { name: 'Indirectos', value: 290000, percent: 15.3, color: 'bg-warning', trend: 3.2 },
  { name: 'Producción', value: 180000, percent: 9.5, color: 'bg-violet-500', trend: 12.3 },
  { name: 'Otros', value: 120000, percent: 6.4, color: 'bg-muted-foreground', trend: -2.1 },
];

// ============================================
// SISTEMA DE TEMAS DE COLORES
// ============================================
type ColorTheme = 'neutral' | 'blue' | 'green' | 'purple' | 'custom';

interface ThemeConfig {
  name: string;
  primary: string;
  secondary: string;
  accent: string;
  muted: string;
  chart1: string;
  chart2: string;
  chart3: string;
  chart4: string;
  chart5: string;
}

const COLOR_THEMES: Record<ColorTheme, ThemeConfig> = {
  neutral: {
    name: 'Neutro',
    primary: 'slate',
    secondary: 'gray',
    accent: 'zinc',
    muted: 'stone',
    chart1: 'bg-slate-600',
    chart2: 'bg-gray-500',
    chart3: 'bg-zinc-400',
    chart4: 'bg-stone-500',
    chart5: 'bg-neutral-400',
  },
  blue: {
    name: 'Azul Corporativo',
    primary: 'blue',
    secondary: 'sky',
    accent: 'indigo',
    muted: 'slate',
    chart1: 'bg-blue-600',
    chart2: 'bg-sky-500',
    chart3: 'bg-indigo-500',
    chart4: 'bg-cyan-500',
    chart5: 'bg-blue-400',
  },
  green: {
    name: 'Verde Natural',
    primary: 'emerald',
    secondary: 'green',
    accent: 'teal',
    muted: 'slate',
    chart1: 'bg-emerald-600',
    chart2: 'bg-green-500',
    chart3: 'bg-teal-500',
    chart4: 'bg-lime-500',
    chart5: 'bg-emerald-400',
  },
  purple: {
    name: 'Púrpura Moderno',
    primary: 'violet',
    secondary: 'purple',
    accent: 'fuchsia',
    muted: 'slate',
    chart1: 'bg-violet-600',
    chart2: 'bg-purple-500',
    chart3: 'bg-fuchsia-500',
    chart4: 'bg-pink-500',
    chart5: 'bg-violet-400',
  },
  custom: {
    name: 'Personalizado',
    primary: 'slate',
    secondary: 'gray',
    accent: 'blue',
    muted: 'stone',
    chart1: 'bg-slate-600',
    chart2: 'bg-blue-500',
    chart3: 'bg-emerald-500',
    chart4: 'bg-amber-500',
    chart5: 'bg-rose-500',
  },
};

// Colores hex por tema — sincroniza COLOR_THEMES con userColors hex
const THEME_HEX_COLORS: Record<Exclude<ColorTheme, 'custom'>, Partial<UserColorPreferences>> = {
  neutral: { chart1: '#475569', chart2: '#64748b', chart3: '#94a3b8', chart4: '#78716c', chart5: '#57534e', chart6: '#6b7280' },
  blue:    { chart1: '#2563eb', chart2: '#0ea5e9', chart3: '#6366f1', chart4: '#06b6d4', chart5: '#7c3aed', chart6: '#60a5fa' },
  green:   { chart1: '#059669', chart2: '#16a34a', chart3: '#0d9488', chart4: '#65a30d', chart5: '#10b981', chart6: '#34d399' },
  purple:  { chart1: '#7c3aed', chart2: '#9333ea', chart3: '#d946ef', chart4: '#db2777', chart5: '#6366f1', chart6: '#a78bfa' },
};

// ============================================
// SISTEMA DE TEMPLATES
// ============================================
type TemplateId = 'executive' | 'financial' | 'operational' | 'minimal' | 'custom';

interface DashboardTemplate {
  id: TemplateId;
  name: string;
  description: string;
  icon: any;
  layout: {
    showKPIs: boolean;
    kpiCount: number;
    showMainChart: boolean;
    showDonut: boolean;
    showTopLists: boolean;
    showComparison: boolean;
    showAlerts: boolean;
    showPerformance: boolean;
    showTrends: boolean;
    columns: number;
  };
}

const DASHBOARD_TEMPLATES: DashboardTemplate[] = [
  {
    id: 'executive',
    name: 'Ejecutivo',
    description: 'Vista completa con todos los KPIs, gráficos y métricas',
    icon: LayoutDashboard,
    layout: {
      showKPIs: true, kpiCount: 5, showMainChart: true, showDonut: true,
      showTopLists: true, showComparison: true, showAlerts: true, showPerformance: true, showTrends: true, columns: 3
    }
  },
  {
    id: 'financial',
    name: 'Financiero',
    description: 'Enfocado en ingresos, costos y márgenes',
    icon: CircleDollarSign,
    layout: {
      showKPIs: true, kpiCount: 6, showMainChart: true, showDonut: true,
      showTopLists: false, showComparison: true, showAlerts: false, showPerformance: false, showTrends: true, columns: 2
    }
  },
  {
    id: 'operational',
    name: 'Operativo',
    description: 'Métricas de producción y eficiencia',
    icon: Activity,
    layout: {
      showKPIs: true, kpiCount: 6, showMainChart: true, showDonut: false,
      showTopLists: true, showComparison: false, showAlerts: true, showPerformance: true, showTrends: true, columns: 4
    }
  },
  {
    id: 'minimal',
    name: 'Minimalista',
    description: 'Solo KPIs principales y gráfico de evolución',
    icon: Sparkles,
    layout: {
      showKPIs: true, kpiCount: 4, showMainChart: true, showDonut: false,
      showTopLists: false, showComparison: false, showAlerts: false, showPerformance: false, showTrends: false, columns: 2
    }
  },
  {
    id: 'custom',
    name: 'Personalizado',
    description: 'Configura tu propia vista',
    icon: Settings2,
    layout: {
      showKPIs: true, kpiCount: 5, showMainChart: true, showDonut: true,
      showTopLists: true, showComparison: true, showAlerts: true, showPerformance: true, showTrends: true, columns: 3
    }
  },
];

// Más datos mock para estadísticas extendidas
const EXTENDED_STATS = {
  nominas: {
    horasExtras: 245, horasNormales: 3840, ausentismo: 2.3, rotacion: 1.2,
    costoHoraPromedio: 850, beneficios: 95000, anticipos: 45000,
    porTurno: [{ name: 'Mañana', value: 320000 }, { name: 'Tarde', value: 280000 }, { name: 'Noche', value: 180000 }],
    porAntigüedad: [{ range: '0-1 año', count: 5, cost: 125000 }, { range: '1-3 años', count: 8, cost: 280000 }, { range: '3-5 años', count: 7, cost: 245000 }, { range: '+5 años', count: 4, cost: 130000 }],
  },
  compras: {
    diasPagoPromedio: 32, ordenesAbiertas: 8, itemsPendientes: 45, devoluciones: 2,
    ahorroNegociado: 28500, precioVsPresup: -3.2,
    porDia: [42000, 38000, 55000, 48000, 62000, 45000, 52000],
    concentracion: { top3: 75.9, top5: 88.2 },
  },
  indirectos: {
    variacionAnual: 8.5, presupuestoRestante: 45000, alertasConsumo: 2,
    porMes: [265000, 272000, 278000, 281000, 285000, 290000],
    fijosVsVariables: { fijos: 210000, variables: 80000 },
  },
  produccion: {
    rendimiento: 97.2, merma: 2.8, horasMaquina: 1280, paradas: 12,
    costoKwh: 125, consumoEnergia: 45000,
    eficienciaPorLinea: [{ name: 'Línea 1', value: 98.5 }, { name: 'Línea 2', value: 96.8 }, { name: 'Línea 3', value: 97.1 }],
  },
  ventas: {
    ticketPromedio: 58300, clientesActivos: 42, clientesNuevos: 5,
    descuentosOtorgados: 125000, bonificaciones: 45000,
    porCanal: [{ name: 'Mayorista', value: 1450000 }, { name: 'Minorista', value: 680000 }, { name: 'Online', value: 320000 }],
    porZona: [{ name: 'Norte', value: 890000 }, { name: 'Centro', value: 1020000 }, { name: 'Sur', value: 540000 }],
  }
};

// Tipo para los colores del usuario
interface UserColorPreferences {
  themeName: string;
  chart1: string;
  chart2: string;
  chart3: string;
  chart4: string;
  chart5: string;
  chart6: string;
  progressPrimary: string;
  progressSecondary: string;
  progressWarning: string;
  progressDanger: string;
  kpiPositive: string;
  kpiNegative: string;
  kpiNeutral: string;
  cardHighlight: string;
  cardMuted: string;
  donut1: string;
  donut2: string;
  donut3: string;
  donut4: string;
  donut5: string;
}

const DEFAULT_COLORS: UserColorPreferences = {
  themeName: 'Predeterminado',
  chart1: '#3b82f6',
  chart2: '#10b981',
  chart3: '#f59e0b',
  chart4: '#8b5cf6',
  chart5: '#06b6d4',
  chart6: '#ef4444',
  progressPrimary: '#3b82f6',
  progressSecondary: '#10b981',
  progressWarning: '#f59e0b',
  progressDanger: '#ef4444',
  kpiPositive: '#10b981',
  kpiNegative: '#ef4444',
  kpiNeutral: '#64748b',
  cardHighlight: '#ede9fe',
  cardMuted: '#f1f5f9',
  donut1: '#3b82f6',
  donut2: '#10b981',
  donut3: '#f59e0b',
  donut4: '#8b5cf6',
  donut5: '#94a3b8',
};

export function ExecutiveDashboardV2({ selectedMonth, companyId, onMonthChange }: ExecutiveDashboardV2Props) {
  const [activeSection, setActiveSection] = useState<SectionId>('overview');
  const [currentMonth, setCurrentMonth] = useState(selectedMonth);

  // Sistema de temas y templates — persisten en localStorage
  const [colorTheme, setColorTheme] = useState<ColorTheme>(() => {
    if (typeof window === 'undefined') return 'neutral';
    return (localStorage.getItem('costos-color-theme') as ColorTheme) ?? 'neutral';
  });
  const [activeTemplate, setActiveTemplate] = useState<TemplateId>(() => {
    if (typeof window === 'undefined') return 'executive';
    return (localStorage.getItem('costos-template') as TemplateId) ?? 'executive';
  });
  const [customLayout, setCustomLayout] = useState(DASHBOARD_TEMPLATES[4].layout);
  const [showTemplateDialog, setShowTemplateDialog] = useState(false);

  // Colores guardados en DB (fuente de verdad para modo 'custom')
  const [dbColors, setDbColors] = useState<UserColorPreferences>(DEFAULT_COLORS);
  const [colorsLoading, setColorsLoading] = useState(true);

  // Colores efectivos: si el tema es 'custom' usa DB colors, si no aplica el tema encima
  const userColors = useMemo<UserColorPreferences>(() => {
    if (colorTheme === 'custom') return dbColors;
    return { ...dbColors, ...THEME_HEX_COLORS[colorTheme] };
  }, [dbColors, colorTheme]);

  // Cargar preferencias de colores al montar
  useEffect(() => {
    const loadColorPreferences = async () => {
      try {
        setColorsLoading(true);
        const response = await fetch(`/api/costos/color-preferences?companyId=${companyId}`);
        if (response.ok) {
          const data = await response.json();
          if (data.colors) {
            setDbColors(data.colors);
          }
        }
      } catch (error) {
        console.error('Error loading color preferences:', error);
      } finally {
        setColorsLoading(false);
      }
    };
    loadColorPreferences();
  }, [companyId]);

  // Handlers con persistencia
  const handleColorThemeChange = (t: ColorTheme) => {
    setColorTheme(t);
    localStorage.setItem('costos-color-theme', t);
  };

  const handleTemplateChange = (t: TemplateId) => {
    setActiveTemplate(t);
    localStorage.setItem('costos-template', t);
  };

  const theme = COLOR_THEMES[colorTheme];
  const template = DASHBOARD_TEMPLATES.find(t => t.id === activeTemplate) || DASHBOARD_TEMPLATES[0];
  const layout = activeTemplate === 'custom' ? customLayout : template.layout;

  const currentSectionData = COST_SECTIONS.find(s => s.id === activeSection);

  const handleMonthChange = (month: string) => {
    setCurrentMonth(month);
    onMonthChange?.(month);
  };

  const monthOptions = Array.from({ length: 12 }, (_, i) => {
    const now = new Date();
    const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
    return {
      value: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`,
      label: date.toLocaleDateString('es-AR', { month: 'long', year: 'numeric' }),
    };
  });

  const groupedSections = {
    main: COST_SECTIONS.filter(s => s.group === 'main'),
    costos: COST_SECTIONS.filter(s => s.group === 'costos'),
    herramientas: COST_SECTIONS.filter(s => s.group === 'herramientas'),
    sistema: COST_SECTIONS.filter(s => s.group === 'sistema'),
  };

  return (
    <TooltipProvider>
      <div className="flex h-[calc(100vh-4rem)]">
        {/* Sidebar */}
        <aside className="w-72 border-r bg-gradient-to-b from-muted/50 to-muted/20 flex flex-col">
          <div className="p-4 border-b">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-gradient-to-br from-primary to-primary/80 shadow-lg">
                <Layers className="w-5 h-5 text-primary-foreground" />
              </div>
              <div>
                <h1 className="text-base font-bold">Centro de Costos</h1>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="text-[10px] h-4">V2</Badge>
                  <span className="text-[10px] text-muted-foreground">Consolidación automática</span>
                </div>
              </div>
            </div>
          </div>

          {/* Período */}
          <div className="p-4 border-b">
            <Label className="text-[10px] text-muted-foreground uppercase tracking-wider mb-2 block">Período Activo</Label>
            <Select value={currentMonth} onValueChange={handleMonthChange}>
              <SelectTrigger className="h-9 bg-background">
                <Calendar className="w-3.5 h-3.5 mr-2 text-muted-foreground" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {monthOptions.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value} className="text-sm">{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Navegación */}
          <ScrollArea className="flex-1 p-3">
            <nav className="space-y-4">
              {groupedSections.main.map((section) => (
                <SidebarButton key={section.id} section={section} isActive={activeSection === section.id} onClick={() => setActiveSection(section.id)} />
              ))}

              <div>
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2 px-3">Módulos de Costos</p>
                <div className="space-y-1">
                  {groupedSections.costos.map((section) => (
                    <SidebarButton key={section.id} section={section} isActive={activeSection === section.id} onClick={() => setActiveSection(section.id)} />
                  ))}
                </div>
              </div>

              <div>
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2 px-3">Herramientas</p>
                <div className="space-y-1">
                  {groupedSections.herramientas.map((section) => (
                    <SidebarButton key={section.id} section={section} isActive={activeSection === section.id} onClick={() => setActiveSection(section.id)} />
                  ))}
                </div>
              </div>

              <div>
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2 px-3">Sistema</p>
                <div className="space-y-1">
                  {groupedSections.sistema.map((section) => (
                    <SidebarButton key={section.id} section={section} isActive={activeSection === section.id} onClick={() => setActiveSection(section.id)} />
                  ))}
                </div>
              </div>
            </nav>
          </ScrollArea>

          {/* Footer sidebar */}
          <div className="p-3 border-t space-y-3">
            {/* Selector de Tema */}
            <div className="p-3 bg-background rounded-lg border">
              <div className="flex items-center gap-2 mb-2">
                <Sun className="w-3.5 h-3.5 text-muted-foreground" />
                <span className="text-xs font-medium">Tema de Colores</span>
              </div>
              <Select value={colorTheme} onValueChange={(v) => handleColorThemeChange(v as ColorTheme)}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(COLOR_THEMES).map(([key, t]) => (
                    <SelectItem key={key} value={key} className="text-xs">
                      <div className="flex items-center gap-2">
                        <div className={cn('w-3 h-3 rounded', t.chart1)} />
                        {t.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Selector de Template (solo en overview) */}
            {activeSection === 'overview' && (
              <div className="p-3 bg-background rounded-lg border">
                <div className="flex items-center gap-2 mb-2">
                  <LayoutDashboard className="w-3.5 h-3.5 text-muted-foreground" />
                  <span className="text-xs font-medium">Template</span>
                </div>
                <Select value={activeTemplate} onValueChange={(v) => handleTemplateChange(v as TemplateId)}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DASHBOARD_TEMPLATES.map((t) => (
                      <SelectItem key={t.id} value={t.id} className="text-xs">
                        <div className="flex items-center gap-2">
                          <t.icon className="w-3 h-3" />
                          {t.name}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {activeTemplate === 'custom' && (
                  <Button variant="ghost" size="sm" className="w-full mt-2 h-7 text-xs" onClick={() => setShowTemplateDialog(true)}>
                    <Settings2 className="w-3 h-3 mr-1" />
                    Personalizar
                  </Button>
                )}
              </div>
            )}

            <div className="p-3 bg-background rounded-lg border">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <GitBranch className="w-3.5 h-3.5 text-muted-foreground" />
                  <span className="text-xs font-medium">Fuentes</span>
                </div>
                <span className="text-xs font-bold text-success">4/5</span>
              </div>
              <Progress value={80} className="h-1.5" />
            </div>

            <div className="p-3 bg-background rounded-lg border">
              <div className="flex items-center gap-2 mb-2">
                <Settings2 className="w-3.5 h-3.5 text-muted-foreground" />
                <span className="text-xs font-medium">Modo</span>
              </div>
              <CostVersionToggle companyId={companyId} />
            </div>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 overflow-auto bg-muted/10">
          <div className="p-6">
            {/* Header */}
            <div className="mb-6">
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                <span>Centro de Costos</span>
                <ChevronRight className="w-3 h-3" />
                <span className="text-foreground font-medium">{currentSectionData?.name}</span>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold">{currentSectionData?.name}</h2>
                  <p className="text-sm text-muted-foreground">{currentSectionData?.description}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm">
                    <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
                    Actualizar
                  </Button>
                  <Button variant="outline" size="sm">
                    <Download className="w-3.5 h-3.5 mr-1.5" />
                    Exportar
                  </Button>
                </div>
              </div>
            </div>

            {/* Content */}
            {activeSection === 'overview' && <OverviewSection month={currentMonth} layout={layout} theme={theme} colors={userColors} />}
            {/* Módulos de costos — todos usan los colores del usuario */}
            {activeSection === 'nominas' && (
              <PayrollViewV2 companyId={companyId} selectedMonth={currentMonth} userColors={userColors} />
            )}
            {activeSection === 'compras' && (
              <PurchasesViewV2 companyId={companyId} selectedMonth={currentMonth} userColors={userColors} />
            )}
            {activeSection === 'indirectos' && (
              <IndirectViewV2 companyId={companyId} selectedMonth={currentMonth} userColors={userColors} />
            )}
            {activeSection === 'produccion' && (
              <ProductionViewV2 companyId={companyId} selectedMonth={currentMonth} userColors={userColors} />
            )}
            {activeSection === 'ventas' && (
              <SalesViewV2 companyId={companyId} selectedMonth={currentMonth} userColors={userColors} />
            )}
            {/* Herramientas */}
            {activeSection === 'distribucion' && <DistribucionSection colors={userColors} month={currentMonth} />}
            {activeSection === 'rentabilidad' && <RentabilidadView colors={userColors} month={currentMonth} />}
            {activeSection === 'calculadora' && <CalculadoraSection colors={userColors} month={currentMonth} />}
            {activeSection === 'recetas' && <RecetasV2 />}
            {activeSection === 'config' && <ConfigSection companyId={companyId} colors={userColors} setColors={setDbColors} />}
          </div>
        </main>
      </div>
    </TooltipProvider>
  );
}

// ============================================
// SIDEBAR BUTTON
// ============================================
function SidebarButton({ section, isActive, onClick }: { section: typeof COST_SECTIONS[number]; isActive: boolean; onClick: () => void }) {
  const Icon = section.icon;
  const status = STATUS_STYLES[section.status as keyof typeof STATUS_STYLES];

  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-all',
        isActive && 'bg-primary text-primary-foreground shadow-md',
        !isActive && 'hover:bg-muted/80'
      )}
    >
      <Icon className={cn('w-4 h-4', isActive ? 'text-primary-foreground' : 'text-muted-foreground')} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className={cn('text-sm font-medium truncate', !isActive && 'text-foreground')}>{section.name}</p>
          {!isActive && section.status !== 'active' && (
            <span className={cn('text-[9px] px-1.5 py-0.5 rounded-full font-medium', status.bg, status.text)}>{status.label}</span>
          )}
        </div>
      </div>
      <ChevronRight className={cn('w-4 h-4 transition-transform', isActive && 'rotate-90', !isActive && 'text-muted-foreground')} />
    </button>
  );
}

// ============================================
// OVERVIEW SECTION - CON TEMPLATES Y TEMAS
// ============================================
function OverviewSection({ month, layout, theme, colors }: {
  month: string;
  layout: DashboardTemplate['layout'];
  theme: ThemeConfig;
  colors: UserColorPreferences;
}) {
  // Los colores ahora vienen de las preferencias del usuario
  const chartColors = [colors.chart1, colors.chart2, colors.chart3, colors.chart4, colors.chart5, colors.chart6];
  const donutColors = [colors.donut1, colors.donut2, colors.donut3, colors.donut4, colors.donut5];

  // KPIs a mostrar según el template - usando colores de preferencias
  const allKPIs = [
    { title: 'Ingresos', value: 2450000, change: 12.5, trend: 'up' as const, icon: TrendingUp, hexColor: colors.kpiPositive, subtitle: '42 facturas' },
    { title: 'Costos Totales', value: 1890000, change: 8.2, trend: 'up' as const, icon: Wallet, hexColor: colors.kpiNegative, subtitle: 'vs $1.74M ant.' },
    { title: 'Margen Bruto', value: 560000, change: -3.1, trend: 'down' as const, icon: Target, hexColor: colors.chart1, subtitle: '22.9%' },
    { title: 'Resultado Neto', value: 345000, change: 5.8, trend: 'up' as const, icon: Sparkles, hexColor: colors.chart4, subtitle: '14.1%', highlight: true },
    { title: 'ROI Operativo', value: 18.2, change: 2.1, trend: 'up' as const, icon: Gauge, hexColor: colors.chart5, subtitle: '+2.1pp', isPercent: true },
    { title: 'Margen %', value: 22.9, change: 1.2, trend: 'up' as const, icon: Percent, hexColor: colors.chart3, subtitle: 'Bruto', isPercent: true },
  ];

  const visibleKPIs = allKPIs.slice(0, layout.kpiCount);

  return (
    <div className="space-y-6">
      {/* KPIs Principales */}
      {layout.showKPIs && (
        <div className={cn('grid gap-4', `grid-cols-${Math.min(layout.kpiCount, 6)}`)}>
          {visibleKPIs.map((kpi, i) => (
            <KPICardEnhanced key={i} {...kpi} />
          ))}
        </div>
      )}

      {/* Gráficos principales */}
      {layout.showMainChart && (
        <div className={cn('grid gap-6', layout.showDonut ? 'grid-cols-3' : 'grid-cols-1')}>
          {/* Tendencia 6 meses */}
          <Card className={layout.showDonut ? 'col-span-2' : ''}>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base flex items-center gap-2">
                    <LineChart className="w-4 h-4 text-muted-foreground" />
                    Evolución Últimos 6 Meses
                  </CardTitle>
                  <CardDescription>Ingresos vs Costos vs Margen</CardDescription>
                </div>
                <div className="flex gap-4 text-xs">
                  <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded" style={{ backgroundColor: colors.chart1 }} /><span>Ingresos</span></div>
                  <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded" style={{ backgroundColor: colors.chart2 }} /><span>Costos</span></div>
                  <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded" style={{ backgroundColor: colors.chart3 }} /><span>Margen</span></div>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="h-64 flex items-end gap-4 pt-4">
                {MONTHLY_DATA.map((data, i) => (
                  <div key={i} className="flex-1 flex flex-col items-center gap-2">
                    <div className="w-full flex items-end gap-1 h-48">
                      <div className="flex-1 rounded-t relative group" style={{ height: `${(data.ingresos / 2500000) * 100}%`, backgroundColor: `${colors.chart1}20` }}>
                        <div className="absolute inset-x-0 bottom-0 rounded-t transition-all" style={{ height: '100%', backgroundColor: colors.chart1 }} />
                        <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-foreground text-background text-[10px] px-2 py-1 rounded opacity-0 group-hover:opacity-100 whitespace-nowrap z-10">
                          ${formatCurrency(data.ingresos)}
                        </div>
                      </div>
                      <div className="flex-1 rounded-t relative group" style={{ height: `${(data.costos / 2500000) * 100}%`, backgroundColor: `${colors.chart2}20` }}>
                        <div className="absolute inset-x-0 bottom-0 rounded-t" style={{ height: '100%', backgroundColor: colors.chart2 }} />
                        <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-foreground text-background text-[10px] px-2 py-1 rounded opacity-0 group-hover:opacity-100 whitespace-nowrap z-10">
                          ${formatCurrency(data.costos)}
                        </div>
                      </div>
                      <div className="flex-1 rounded-t relative group" style={{ height: `${(data.margen / 2500000) * 100}%`, backgroundColor: `${colors.chart3}20` }}>
                        <div className="absolute inset-x-0 bottom-0 rounded-t" style={{ height: '100%', backgroundColor: colors.chart3 }} />
                        <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-foreground text-background text-[10px] px-2 py-1 rounded opacity-0 group-hover:opacity-100 whitespace-nowrap z-10">
                          ${formatCurrency(data.margen)}
                        </div>
                      </div>
                    </div>
                    <span className="text-xs text-muted-foreground">{data.month}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Donut de distribución */}
          {layout.showDonut && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <PieChart className="w-4 h-4 text-muted-foreground" />
                  Distribución de Costos
                </CardTitle>
                <CardDescription>Total: $1.890.000</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-center py-4">
                  <DonutChart data={COST_BREAKDOWN} theme={theme} />
                </div>
                <div className="space-y-2 mt-4">
                  {COST_BREAKDOWN.map((item, i) => (
                    <div key={i} className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <div className={cn('w-3 h-3 rounded', theme.primary === 'slate' ? `bg-${['slate', 'gray', 'zinc', 'stone', 'neutral'][i]}-${600 - i * 50}` : item.color)} />
                        <span>{item.name}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="font-medium">${formatCurrency(item.value)}</span>
                        <Badge variant={item.trend > 0 ? 'default' : 'secondary'} className="text-[10px] h-5">
                          {item.trend > 0 ? '+' : ''}{item.trend}%
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Segunda fila - Métricas detalladas */}
      {layout.showTopLists && (
        <div className="grid grid-cols-4 gap-4">
          {/* Top Proveedores */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <ShoppingCart className={cn('w-4 h-4', theme.primary === 'slate' ? 'text-muted-foreground' : 'text-success')} />
                Top Proveedores
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
            {[
              { name: 'Distrib. Norte SA', value: 180000, percent: 34.6 },
              { name: 'Insumos Litoral', value: 120000, percent: 23.1 },
              { name: 'Química Industrial', value: 95000, percent: 18.3 },
            ].map((p, i) => (
              <div key={i} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="truncate">{p.name}</span>
                  <span className="font-medium">${formatCurrency(p.value)}</span>
                </div>
                <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${p.percent}%`, backgroundColor: colors.progressSecondary }} />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Top Clientes */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Users className="w-4 h-4 text-info-muted-foreground" />
              Top Clientes
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {[
              { name: 'Supermerc. Norte', value: 580000, percent: 23.7 },
              { name: 'Distrib. Central', value: 420000, percent: 17.1 },
              { name: 'Minorista Express', value: 310000, percent: 12.7 },
            ].map((c, i) => (
              <div key={i} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="truncate">{c.name}</span>
                  <span className="font-medium">${formatCurrency(c.value)}</span>
                </div>
                <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${c.percent}%`, backgroundColor: colors.chart5 }} />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Top Productos */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Package className="w-4 h-4 text-violet-500" />
              Top Productos
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {[
              { name: 'Premium A', value: 1050000, margin: 32.5 },
              { name: 'Estándar B', value: 910000, margin: 28.1 },
              { name: 'Económico C', value: 490000, margin: 18.4 },
            ].map((p, i) => (
              <div key={i} className="flex items-center justify-between text-xs">
                <span className="truncate">{p.name}</span>
                <div className="flex items-center gap-2">
                  <span className="font-medium">${formatCurrency(p.value)}</span>
                  <Badge variant={p.margin > 25 ? 'default' : 'secondary'} className="text-[10px]">{p.margin}%</Badge>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Métricas Rápidas */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Activity className="w-4 h-4 text-warning-muted-foreground" />
              Métricas Clave
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <MetricRow icon={Users} label="Empleados" value="24" detail="$32.5K prom" />
            <MetricRow icon={Receipt} label="Facturas" value="42" detail="$58.3K prom" />
            <MetricRow icon={Factory} label="Producción" value="1.250" detail="3 productos" />
            <MetricRow icon={ShoppingCart} label="Recepciones" value="18" detail="15 prov." />
          </CardContent>
        </Card>
        </div>
      )}

      {/* Tercera fila - Comparativa y Alertas */}
      {(layout.showComparison || layout.showAlerts) && (
        <div className={cn('grid gap-6', layout.showComparison && layout.showAlerts ? 'grid-cols-3' : 'grid-cols-1')}>
          {/* Comparativa mes anterior */}
          {layout.showComparison && (
            <Card className={layout.showAlerts ? 'col-span-2' : ''}>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-muted-foreground" />
                  Comparativa vs Mes Anterior
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Concepto</TableHead>
                      <TableHead className="text-right">Mes Anterior</TableHead>
                      <TableHead className="text-right">Mes Actual</TableHead>
                      <TableHead className="text-right">Variación</TableHead>
                      <TableHead className="w-32">Tendencia</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {[
                      { name: 'Ingresos', prev: 2180000, curr: 2450000 },
                      { name: 'Nóminas', prev: 741000, curr: 780000 },
                      { name: 'Compras', prev: 479000, curr: 520000 },
                      { name: 'Indirectos', prev: 281000, curr: 290000 },
                      { name: 'Producción', prev: 160000, curr: 180000 },
                      { name: 'Margen Bruto', prev: 519000, curr: 560000 },
                    ].map((row, i) => {
                      const change = ((row.curr - row.prev) / row.prev) * 100;
                      const isPositive = row.name === 'Ingresos' || row.name === 'Margen Bruto' ? change > 0 : change < 0;
                      return (
                        <TableRow key={i}>
                          <TableCell className="font-medium">{row.name}</TableCell>
                          <TableCell className="text-right text-muted-foreground">${formatCurrency(row.prev)}</TableCell>
                          <TableCell className="text-right font-medium">${formatCurrency(row.curr)}</TableCell>
                          <TableCell className={cn('text-right font-medium', isPositive ? 'text-success' : 'text-destructive')}>
                            {change > 0 ? '+' : ''}{change.toFixed(1)}%
                          </TableCell>
                          <TableCell>
                            <MiniSparkline values={[row.prev * 0.95, row.prev * 0.98, row.prev, row.curr * 0.98, row.curr]} color={isPositive ? 'green' : 'red'} />
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}

          {/* Panel de Alertas y Acciones */}
          {layout.showAlerts && (
            <Card className={cn(theme.primary === 'slate' ? 'border-border bg-muted/50' : 'border-warning-muted bg-gradient-to-br from-warning-muted/50 to-warning-muted/30')}>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <AlertCircle className={cn('w-4 h-4', theme.primary === 'slate' ? 'text-muted-foreground' : 'text-warning-muted-foreground')} />
                  Alertas y Pendientes
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <AlertItem icon={Building2} title="3 items indirectos sin valor" description="Completar para este mes" type="warning" />
                <AlertItem icon={TrendingDown} title="Margen bajo en Prod. C" description="18.4% - revisar costos" type="warning" />
                <AlertItem icon={Clock} title="Cierre de mes pendiente" description="Faltan 5 días" type="info" />
                <AlertItem icon={CheckCircle2} title="Nóminas sincronizadas" description="2 liquidaciones cerradas" type="success" />
                <Button variant="outline" size="sm" className="w-full mt-2">
                  <Eye className="w-3.5 h-3.5 mr-1.5" />
                  Ver Todas las Alertas
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Indicadores de Performance */}
      {layout.showPerformance && (
        <div className="grid grid-cols-6 gap-4">
          <PerformanceCard title="Eficiencia Laboral" value={85} target={80} unit="%" icon={Users} color={theme.primary === 'slate' ? 'slate' : 'blue'} />
          <PerformanceCard title="Rotación Stock" value={4.2} target={5} unit="x" icon={Boxes} color={theme.primary === 'slate' ? 'gray' : 'green'} />
          <PerformanceCard title="Días Cobro" value={32} target={30} unit="días" icon={Clock} color={theme.primary === 'slate' ? 'zinc' : 'amber'} inverted />
          <PerformanceCard title="Margen EBITDA" value={14.1} target={15} unit="%" icon={Target} color={theme.primary === 'slate' ? 'stone' : 'violet'} />
          <PerformanceCard title="Cumpl. Presup." value={92} target={100} unit="%" icon={Gauge} color={theme.primary === 'slate' ? 'neutral' : 'cyan'} />
          <PerformanceCard title="Productividad" value={108} target={100} unit="%" icon={Activity} color={theme.primary === 'slate' ? 'slate' : 'emerald'} />
        </div>
      )}

      {/* Tendencias adicionales */}
      {layout.showTrends && (
        <div className="grid grid-cols-2 gap-6">
          {/* Gráfico de Área - Tendencia de Margen */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <AreaChart className="w-4 h-4 text-muted-foreground" />
                Tendencia de Margen (12 meses)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-40 flex items-end gap-1">
                {[18.5, 19.2, 20.1, 19.8, 21.2, 20.5, 21.8, 22.1, 21.5, 22.3, 22.8, 22.9].map((val, i) => (
                  <div key={i} className="flex-1 flex flex-col items-center">
                    <div className={cn('w-full rounded-t', theme.primary === 'slate' ? 'bg-slate-400' : 'bg-blue-400')} style={{ height: `${(val / 25) * 100}%` }} />
                  </div>
                ))}
              </div>
              <div className="flex justify-between text-[10px] text-muted-foreground mt-2">
                <span>Feb 25</span>
                <span>Ene 26</span>
              </div>
            </CardContent>
          </Card>

          {/* KPIs adicionales */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Target className="w-4 h-4 text-muted-foreground" />
                Objetivos del Período
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {[
                { label: 'Ingresos vs Meta', current: 2450000, target: 2500000, unit: '$' },
                { label: 'Reducción Costos', current: 3.2, target: 5, unit: '%' },
                { label: 'Margen Objetivo', current: 22.9, target: 25, unit: '%' },
                { label: 'Satisfacción Cliente', current: 4.5, target: 4.8, unit: '/5' },
              ].map((obj, i) => {
                const progress = (obj.current / obj.target) * 100;
                return (
                  <div key={i} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span>{obj.label}</span>
                      <span className="font-medium">
                        {obj.unit === '$' ? `$${formatCurrency(obj.current)}` : `${obj.current}${obj.unit}`}
                        <span className="text-muted-foreground"> / {obj.unit === '$' ? `$${formatCurrency(obj.target)}` : `${obj.target}${obj.unit}`}</span>
                      </span>
                    </div>
                    <Progress value={Math.min(progress, 100)} className="h-2" />
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </div>
      )}

      {/* NUEVA SECCIÓN: Gráficos Avanzados */}
      {layout.showMainChart && (
        <div className="grid grid-cols-3 gap-6">
          {/* Gráfico de Líneas Multiserie */}
          <Card className="col-span-2">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base flex items-center gap-2">
                    <LineChart className="w-4 h-4 text-muted-foreground" />
                    Evolución Comparativa 6 Meses
                  </CardTitle>
                  <CardDescription>Ingresos, Costos y Margen</CardDescription>
                </div>
                <div className="flex gap-3 text-xs">
                  <div className="flex items-center gap-1.5"><div className="w-3 h-0.5" style={{ backgroundColor: colors.chart1 }} /><span>Ingresos</span></div>
                  <div className="flex items-center gap-1.5"><div className="w-3 h-0.5" style={{ backgroundColor: colors.chart2 }} /><span>Costos</span></div>
                  <div className="flex items-center gap-1.5"><div className="w-3 h-0.5" style={{ backgroundColor: colors.chart3 }} /><span>Margen</span></div>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <LineChartSVG
                data={[
                  { label: 'Ingresos', values: [2100000, 2250000, 2180000, 2320000, 2380000, 2450000] },
                  { label: 'Costos', values: [1650000, 1720000, 1690000, 1780000, 1820000, 1890000] },
                  { label: 'Margen', values: [450000, 530000, 490000, 540000, 560000, 560000] },
                ]}
                height={180}
                colors={[colors.chart1, colors.chart2, colors.chart3]}
              />
              <div className="flex justify-between text-[10px] text-muted-foreground mt-2 px-2">
                {['Ago', 'Sep', 'Oct', 'Nov', 'Dic', 'Ene'].map((m, i) => <span key={i}>{m}</span>)}
              </div>
            </CardContent>
          </Card>

          {/* Radar de KPIs */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Activity className="w-4 h-4 text-muted-foreground" />
                Radar de Performance
              </CardTitle>
            </CardHeader>
            <CardContent className="flex justify-center">
              <RadarChartSimple
                data={[
                  { label: 'Rentab.', value: 82, max: 100 },
                  { label: 'Eficiencia', value: 91, max: 100 },
                  { label: 'Liquidez', value: 75, max: 100 },
                  { label: 'Crec.', value: 88, max: 100 },
                  { label: 'Calidad', value: 95, max: 100 },
                ]}
                size={180}
                color={theme.primary === 'slate' ? 'slate' : 'blue'}
              />
            </CardContent>
          </Card>
        </div>
      )}

      {/* NUEVA SECCIÓN: Gráficos de Área y Waterfall */}
      {layout.showMainChart && (
        <div className="grid grid-cols-2 gap-6">
          {/* Gráfico de Área con Gradiente */}
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base flex items-center gap-2">
                    <AreaChart className="w-4 h-4 text-muted-foreground" />
                    Tendencia de Ingresos
                  </CardTitle>
                  <CardDescription>Últimos 12 meses</CardDescription>
                </div>
                <Badge variant="outline" className="text-xs">+12.5% YoY</Badge>
              </div>
            </CardHeader>
            <CardContent>
              <AreaChartSVG
                data={[1850000, 1920000, 2010000, 1980000, 2100000, 2180000, 2150000, 2250000, 2180000, 2320000, 2380000, 2450000]}
                height={160}
                color={colors.chart1}
              />
              <div className="flex justify-between text-[10px] text-muted-foreground mt-2">
                <span>Feb 25</span>
                <span>Ene 26</span>
              </div>
            </CardContent>
          </Card>

          {/* Waterfall de Resultado */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-muted-foreground" />
                Cascada de Resultado
              </CardTitle>
              <CardDescription>Desglose del resultado neto</CardDescription>
            </CardHeader>
            <CardContent>
              <WaterfallChart
                data={[
                  { label: 'Ingresos', value: 2450000, type: 'start' },
                  { label: 'Nóminas', value: 780000, type: 'subtract' },
                  { label: 'Compras', value: 520000, type: 'subtract' },
                  { label: 'Indirect.', value: 290000, type: 'subtract' },
                  { label: 'Produc.', value: 180000, type: 'subtract' },
                  { label: 'Otros', value: 120000, type: 'subtract' },
                  { label: 'Neto', value: 560000, type: 'total' },
                ]}
                height={160}
              />
            </CardContent>
          </Card>
        </div>
      )}

      {/* NUEVA SECCIÓN: Comparativas y Gauges */}
      {layout.showComparison && (
        <div className="grid grid-cols-4 gap-6">
          {/* Gauges de KPIs críticos */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Margen Bruto</CardTitle>
            </CardHeader>
            <CardContent className="flex justify-center pt-2">
              <GaugeChart value={22.9} max={30} label="Meta: 25%" color={theme.primary === 'slate' ? 'slate' : 'blue'} size={140} />
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">ROI Operativo</CardTitle>
            </CardHeader>
            <CardContent className="flex justify-center pt-2">
              <GaugeChart value={18.2} max={25} label="Meta: 20%" color={theme.primary === 'slate' ? 'slate' : 'green'} size={140} />
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Eficiencia</CardTitle>
            </CardHeader>
            <CardContent className="flex justify-center pt-2">
              <GaugeChart value={91.5} max={100} label="Meta: 95%" color={theme.primary === 'slate' ? 'slate' : 'amber'} size={140} />
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Cumplimiento</CardTitle>
            </CardHeader>
            <CardContent className="flex justify-center pt-2">
              <GaugeChart value={87.3} max={100} label="Meta: 90%" color={theme.primary === 'slate' ? 'slate' : 'violet'} size={140} />
            </CardContent>
          </Card>
        </div>
      )}

      {/* NUEVA SECCIÓN: Barras Comparativas Mes a Mes */}
      {layout.showComparison && (
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-muted-foreground" />
                  Comparativa por Categoría
                </CardTitle>
                <CardDescription>Mes actual vs Mes anterior</CardDescription>
              </div>
              <div className="flex gap-4 text-xs">
                <div className="flex items-center gap-1.5"><div className="w-3 h-3 bg-slate-400 rounded" /><span>Anterior</span></div>
                <div className="flex items-center gap-1.5"><div className="w-3 h-3 bg-blue-500 rounded" /><span>Actual</span></div>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <ComparisonBarChart
              data={[
                { label: 'Nóminas', current: 780000, previous: 755000 },
                { label: 'Compras', current: 520000, previous: 479000 },
                { label: 'Indirect.', current: 290000, previous: 281000 },
                { label: 'Produc.', current: 180000, previous: 160000 },
                { label: 'Otros', current: 120000, previous: 125000 },
              ]}
              height={160}
              color1={theme.primary === 'slate' ? 'bg-slate-600' : 'bg-blue-500'}
              color2="bg-slate-300"
            />
          </CardContent>
        </Card>
      )}

      {/* NUEVA SECCIÓN: Barras Apiladas */}
      {layout.showTopLists && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Layers className="w-4 h-4 text-muted-foreground" />
              Composición de Costos por Mes
            </CardTitle>
            <CardDescription>Distribución de costos en los últimos 6 meses</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-4 text-xs mb-4">
              <div className="flex items-center gap-1.5"><div className="w-3 h-3 bg-blue-600 rounded" /><span>Nóminas</span></div>
              <div className="flex items-center gap-1.5"><div className="w-3 h-3 bg-blue-500 rounded" /><span>Compras</span></div>
              <div className="flex items-center gap-1.5"><div className="w-3 h-3 bg-blue-400 rounded" /><span>Indirectos</span></div>
              <div className="flex items-center gap-1.5"><div className="w-3 h-3 bg-blue-300 rounded" /><span>Producción</span></div>
              <div className="flex items-center gap-1.5"><div className="w-3 h-3 bg-blue-200 rounded" /><span>Otros</span></div>
            </div>
            <StackedBarChart
              data={[
                { label: 'Ago', segments: [{ name: 'Nóminas', value: 720000 }, { name: 'Compras', value: 450000 }, { name: 'Indirectos', value: 265000 }, { name: 'Producción', value: 145000 }, { name: 'Otros', value: 70000 }] },
                { label: 'Sep', segments: [{ name: 'Nóminas', value: 735000 }, { name: 'Compras', value: 470000 }, { name: 'Indirectos', value: 272000 }, { name: 'Producción', value: 155000 }, { name: 'Otros', value: 88000 }] },
                { label: 'Oct', segments: [{ name: 'Nóminas', value: 726000 }, { name: 'Compras', value: 458000 }, { name: 'Indirectos', value: 278000 }, { name: 'Producción', value: 152000 }, { name: 'Otros', value: 76000 }] },
                { label: 'Nov', segments: [{ name: 'Nóminas', value: 741000 }, { name: 'Compras', value: 492000 }, { name: 'Indirectos', value: 281000 }, { name: 'Producción', value: 168000 }, { name: 'Otros', value: 98000 }] },
                { label: 'Dic', segments: [{ name: 'Nóminas', value: 755000 }, { name: 'Compras', value: 508000 }, { name: 'Indirectos', value: 285000 }, { name: 'Producción', value: 172000 }, { name: 'Otros', value: 100000 }] },
                { label: 'Ene', segments: [{ name: 'Nóminas', value: 780000 }, { name: 'Compras', value: 520000 }, { name: 'Indirectos', value: 290000 }, { name: 'Producción', value: 180000 }, { name: 'Otros', value: 120000 }] },
              ]}
              height={200}
              colors={theme.primary === 'slate' ? ['bg-slate-700', 'bg-slate-600', 'bg-slate-500', 'bg-slate-400', 'bg-slate-300'] : ['bg-blue-600', 'bg-blue-500', 'bg-blue-400', 'bg-blue-300', 'bg-blue-200']}
            />
          </CardContent>
        </Card>
      )}

      {/* NUEVA SECCIÓN: Mini Tendencias con Sparklines */}
      {layout.showTrends && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Activity className="w-4 h-4 text-muted-foreground" />
              Tendencias Rápidas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-5 gap-6">
              {[
                { label: 'Ingresos', values: [2100, 2250, 2180, 2320, 2380, 2450], current: '$2.45M', change: '+12.5%', color: 'blue' as const },
                { label: 'Costos', values: [1650, 1720, 1690, 1780, 1820, 1890], current: '$1.89M', change: '+8.2%', color: 'red' as const },
                { label: 'Margen', values: [450, 530, 490, 540, 560, 560], current: '$560K', change: '+5.8%', color: 'green' as const },
                { label: 'Ticket Prom.', values: [52, 54, 53, 56, 57, 58], current: '$58.3K', change: '+3.2%', color: 'amber' as const },
                { label: 'Clientes', values: [38, 39, 40, 41, 41, 42], current: '42', change: '+10.5%', color: 'violet' as const },
              ].map((item, i) => (
                <div key={i} className="space-y-2">
                  <p className="text-xs text-muted-foreground">{item.label}</p>
                  <TrendlineChart values={item.values} color={item.color} width={100} height={32} />
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold">{item.current}</span>
                    <span className={cn('text-xs font-medium', item.color === 'red' ? 'text-destructive' : 'text-success')}>{item.change}</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ============================================
// NÓMINAS SECTION - CON MÁS ESTADÍSTICAS
// ============================================
function NominasSection({ month, theme, colors }: { month: string; theme: ThemeConfig; colors: UserColorPreferences }) {
  const stats = EXTENDED_STATS.nominas;
  const baseColor = theme.primary === 'slate' ? 'slate' : 'blue';

  return (
    <div className="space-y-6">
      <SourceBanner source="PayrollRun" status="connected" detail="2 liquidaciones cerradas" color={baseColor} />

      {/* Primera fila - KPIs principales */}
      <div className="grid grid-cols-6 gap-4">
        <MiniKPIEnhanced title="Costo Empleador" value="$780.000" trend={5.2} icon={Wallet} color={baseColor} />
        <MiniKPIEnhanced title="Sueldos Brutos" value="$620.000" icon={Banknote} color={theme.primary === 'slate' ? 'gray' : 'slate'} />
        <MiniKPIEnhanced title="Cargas Sociales" value="$160.000" subtitle="25.8%" icon={Shield} color={theme.primary === 'slate' ? 'zinc' : 'indigo'} />
        <MiniKPIEnhanced title="Empleados" value="24" subtitle="Activos" icon={Users} color={theme.primary === 'slate' ? 'stone' : 'cyan'} />
        <MiniKPIEnhanced title="Costo Promedio" value="$32.500" subtitle="Por empleado" icon={User} color={theme.primary === 'slate' ? 'neutral' : 'violet'} />
        <MiniKPIEnhanced title="Costo/Hora" value={`$${stats.costoHoraPromedio}`} subtitle="Promedio" icon={Clock} color={theme.primary === 'slate' ? 'slate' : 'amber'} />
      </div>

      {/* Segunda fila - KPIs adicionales */}
      <div className="grid grid-cols-5 gap-4">
        <Card className="bg-muted/30">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-muted-foreground">Horas Extras</span>
              <Timer className="w-4 h-4 text-warning-muted-foreground" />
            </div>
            <p className="text-xl font-bold">{stats.horasExtras}</p>
            <p className="text-xs text-muted-foreground">{((stats.horasExtras / stats.horasNormales) * 100).toFixed(1)}% del total</p>
          </CardContent>
        </Card>
        <Card className="bg-muted/30">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-muted-foreground">Ausentismo</span>
              <XCircle className="w-4 h-4 text-destructive" />
            </div>
            <p className="text-xl font-bold">{stats.ausentismo}%</p>
            <p className="text-xs text-muted-foreground">vs 2.8% mes ant.</p>
          </CardContent>
        </Card>
        <Card className="bg-muted/30">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-muted-foreground">Rotación</span>
              <Shuffle className="w-4 h-4 text-warning-muted-foreground" />
            </div>
            <p className="text-xl font-bold">{stats.rotacion}%</p>
            <p className="text-xs text-muted-foreground">Mensual</p>
          </CardContent>
        </Card>
        <Card className="bg-muted/30">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-muted-foreground">Beneficios</span>
              <Award className="w-4 h-4 text-success" />
            </div>
            <p className="text-xl font-bold">${formatCurrency(stats.beneficios)}</p>
            <p className="text-xs text-muted-foreground">12.2% del total</p>
          </CardContent>
        </Card>
        <Card className="bg-muted/30">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-muted-foreground">Anticipos</span>
              <CreditCard className="w-4 h-4 text-info-muted-foreground" />
            </div>
            <p className="text-xl font-bold">${formatCurrency(stats.anticipos)}</p>
            <p className="text-xs text-muted-foreground">8 empleados</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* Desglose por Categoría */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Desglose por Área</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {[
                { name: 'Producción', value: 320000, employees: 10, color: 'bg-info' },
                { name: 'Administración', value: 180000, employees: 5, color: 'bg-info/80' },
                { name: 'Ventas', value: 150000, employees: 4, color: 'bg-info/60' },
                { name: 'Logística', value: 80000, employees: 3, color: 'bg-info/40' },
                { name: 'Mantenimiento', value: 50000, employees: 2, color: 'bg-info/20' },
              ].map((cat, i) => (
                <div key={i} className="space-y-1.5">
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <div className={cn('w-3 h-3 rounded', cat.color)} />
                      <span>{cat.name}</span>
                      <Badge variant="outline" className="text-[10px]">{cat.employees} emp.</Badge>
                    </div>
                    <span className="font-medium">${formatCurrency(cat.value)}</span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div className={cn('h-full rounded-full', cat.color)} style={{ width: `${(cat.value / 780000) * 100}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Evolución */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Evolución 6 Meses</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-48 flex items-end gap-2">
              {[720000, 735000, 726000, 741000, 755000, 780000].map((val, i) => (
                <div key={i} className="flex-1 flex flex-col items-center gap-1">
                  <div className="w-full bg-info rounded-t transition-all hover:bg-info/90" style={{ height: `${(val / 800000) * 100}%` }} />
                  <span className="text-[10px] text-muted-foreground">{['Ago', 'Sep', 'Oct', 'Nov', 'Dic', 'Ene'][i]}</span>
                </div>
              ))}
            </div>
            <div className="mt-4 flex items-center justify-between text-sm border-t pt-3">
              <span className="text-muted-foreground">Promedio 6 meses</span>
              <span className="font-medium">$742.833</span>
            </div>
          </CardContent>
        </Card>

        {/* Comparativa */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Comparativa</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <ComparisonRow label="vs Mes Anterior" current={780000} previous={755000} />
            <ComparisonRow label="vs Mismo Mes 2025" current={780000} previous={698000} />
            <ComparisonRow label="vs Presupuesto" current={780000} previous={800000} inverted />
            <Separator />
            <div className="grid grid-cols-2 gap-4 text-center">
              <div>
                <p className="text-xs text-muted-foreground">Cargas / Bruto</p>
                <p className="text-lg font-bold text-info-muted-foreground">25.8%</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Costo / Ingreso</p>
                <p className="text-lg font-bold text-info-muted-foreground">31.8%</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabla de Liquidaciones */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Liquidaciones del Período</CardTitle>
            <Button variant="outline" size="sm"><Filter className="w-3.5 h-3.5 mr-1.5" />Filtrar</Button>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Liquidación</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-center">Empleados</TableHead>
                <TableHead className="text-right">Bruto</TableHead>
                <TableHead className="text-right">Cargas</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="text-right">Pagado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow>
                <TableCell className="font-medium">Enero 2026 - #1</TableCell>
                <TableCell><Badge variant="outline">MONTHLY</Badge></TableCell>
                <TableCell><Badge className="bg-success">PAID</Badge></TableCell>
                <TableCell className="text-center">24</TableCell>
                <TableCell className="text-right">$520.000</TableCell>
                <TableCell className="text-right text-muted-foreground">$130.000</TableCell>
                <TableCell className="text-right font-medium text-info-muted-foreground">$650.000</TableCell>
                <TableCell className="text-right text-success">$650.000</TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="font-medium">Enero 2026 - #2</TableCell>
                <TableCell><Badge variant="outline">BONUS</Badge></TableCell>
                <TableCell><Badge className="bg-success">PAID</Badge></TableCell>
                <TableCell className="text-center">12</TableCell>
                <TableCell className="text-right">$100.000</TableCell>
                <TableCell className="text-right text-muted-foreground">$30.000</TableCell>
                <TableCell className="text-right font-medium text-info-muted-foreground">$130.000</TableCell>
                <TableCell className="text-right text-success">$130.000</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Gráficos adicionales */}
      <div className="grid grid-cols-2 gap-6">
        {/* Por Turno */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Clock className="w-4 h-4 text-muted-foreground" />
              Distribución por Turno
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-6">
              <div className="flex-1 space-y-3">
                {stats.porTurno.map((turno, i) => (
                  <div key={i} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span>{turno.name}</span>
                      <span className="font-medium">${formatCurrency(turno.value)}</span>
                    </div>
                    <div className="h-3 bg-muted rounded-full overflow-hidden">
                      <div className={cn('h-full rounded-full', theme.primary === 'slate' ? ['bg-slate-600', 'bg-gray-500', 'bg-zinc-400'][i] : ['bg-blue-600', 'bg-blue-500', 'bg-blue-400'][i])} style={{ width: `${(turno.value / 320000) * 100}%` }} />
                    </div>
                  </div>
                ))}
              </div>
              <div className="text-center p-4 bg-muted/50 rounded-lg">
                <p className="text-xs text-muted-foreground mb-1">Total Turnos</p>
                <p className="text-2xl font-bold">${formatCurrency(780000)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Por Antigüedad */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Award className="w-4 h-4 text-muted-foreground" />
              Costo por Antigüedad
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-40 flex items-end gap-3">
              {stats.porAntigüedad.map((rango, i) => (
                <div key={i} className="flex-1 flex flex-col items-center gap-2">
                  <div className={cn('w-full rounded-t transition-all hover:opacity-80', theme.primary === 'slate' ? ['bg-slate-600', 'bg-gray-500', 'bg-zinc-400', 'bg-stone-500'][i] : ['bg-indigo-600', 'bg-indigo-500', 'bg-indigo-400', 'bg-indigo-300'][i])} style={{ height: `${(rango.cost / 280000) * 100}%` }} />
                  <div className="text-center">
                    <p className="text-[10px] text-muted-foreground">{rango.range}</p>
                    <p className="text-xs font-medium">{rango.count} emp.</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* NUEVOS GRÁFICOS - Línea de tendencia y Área */}
      <div className="grid grid-cols-2 gap-6">
        {/* Gráfico de Líneas - Evolución de Costos Laborales */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base flex items-center gap-2">
                  <LineChart className="w-4 h-4 text-muted-foreground" />
                  Evolución de Costos Laborales
                </CardTitle>
                <CardDescription>Bruto vs Cargas vs Total (12 meses)</CardDescription>
              </div>
              <div className="flex gap-3 text-xs">
                <div className="flex items-center gap-1.5"><div className="w-3 h-0.5" style={{ backgroundColor: colors.chart1 }} /><span>Bruto</span></div>
                <div className="flex items-center gap-1.5"><div className="w-3 h-0.5" style={{ backgroundColor: colors.chart4 }} /><span>Cargas</span></div>
                <div className="flex items-center gap-1.5"><div className="w-3 h-0.5" style={{ backgroundColor: colors.chart5 }} /><span>Total</span></div>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <LineChartSVG
              data={[
                { label: 'Bruto', values: [520000, 535000, 528000, 540000, 545000, 552000, 558000, 565000, 572000, 580000, 595000, 620000] },
                { label: 'Cargas', values: [130000, 134000, 132000, 135000, 136000, 138000, 140000, 141000, 143000, 145000, 149000, 160000] },
                { label: 'Total', values: [650000, 669000, 660000, 675000, 681000, 690000, 698000, 706000, 715000, 725000, 744000, 780000] },
              ]}
              height={160}
              colors={[colors.chart1, colors.chart4, colors.chart5]}
            />
            <div className="flex justify-between text-[10px] text-muted-foreground mt-2">
              <span>Feb 25</span>
              <span>Ene 26</span>
            </div>
          </CardContent>
        </Card>

        {/* Gráfico de Área - Costo por Empleado */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base flex items-center gap-2">
                  <AreaChart className="w-4 h-4 text-muted-foreground" />
                  Costo Promedio por Empleado
                </CardTitle>
                <CardDescription>Tendencia 12 meses</CardDescription>
              </div>
              <Badge variant="outline" className="text-xs">+8.2% YoY</Badge>
            </div>
          </CardHeader>
          <CardContent>
            <AreaChartSVG
              data={[27100, 27900, 27500, 28100, 28400, 28800, 29100, 29400, 29800, 30200, 31000, 32500]}
              height={160}
              color={colors.chart1}
            />
            <div className="flex justify-between text-[10px] text-muted-foreground mt-2">
              <span>Feb 25</span>
              <span>Ene 26</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Gauges de KPIs Laborales */}
      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Costo vs Presupuesto</CardTitle>
          </CardHeader>
          <CardContent className="flex justify-center pt-2">
            <GaugeChart value={97.5} max={100} label="Meta: $800K" color={theme.primary === 'slate' ? 'slate' : 'blue'} size={120} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">% Horas Extras</CardTitle>
          </CardHeader>
          <CardContent className="flex justify-center pt-2">
            <GaugeChart value={6.4} max={10} label="Meta: <5%" color={theme.primary === 'slate' ? 'slate' : 'amber'} size={120} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Ausentismo</CardTitle>
          </CardHeader>
          <CardContent className="flex justify-center pt-2">
            <GaugeChart value={2.3} max={5} label="Meta: <3%" color={theme.primary === 'slate' ? 'slate' : 'green'} size={120} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Costo/Ingreso</CardTitle>
          </CardHeader>
          <CardContent className="flex justify-center pt-2">
            <GaugeChart value={31.8} max={40} label="Meta: <30%" color={theme.primary === 'slate' ? 'slate' : 'violet'} size={120} />
          </CardContent>
        </Card>
      </div>

      {/* Tendencias Rápidas */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Activity className="w-4 h-4 text-muted-foreground" />
            Tendencias de Nómina
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-5 gap-6">
            {[
              { label: 'Costo Total', values: [650, 669, 660, 675, 681, 780], current: '$780K', change: '+3.3%', color: 'blue' as const },
              { label: 'Empleados', values: [22, 22, 23, 23, 24, 24], current: '24', change: '+4.3%', color: 'green' as const },
              { label: 'Horas Extras', values: [180, 195, 210, 225, 238, 245], current: '245h', change: '+2.9%', color: 'amber' as const },
              { label: 'Ausentismo', values: [3.1, 2.8, 2.5, 2.6, 2.4, 2.3], current: '2.3%', change: '-4.2%', color: 'green' as const },
              { label: 'Costo/Hora', values: [780, 795, 810, 825, 840, 850], current: '$850', change: '+1.2%', color: 'violet' as const },
            ].map((item, i) => (
              <div key={i} className="space-y-2">
                <p className="text-xs text-muted-foreground">{item.label}</p>
                <TrendlineChart values={item.values} color={item.color} width={100} height={32} />
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold">{item.current}</span>
                  <span className={cn('text-xs font-medium', item.change.startsWith('-') ? 'text-success' : 'text-warning-muted-foreground')}>{item.change}</span>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Configuración */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Configuración de Importación</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-4 gap-4">
            <ToggleOption title="Solo cerradas" description="PAID o APPROVED" defaultChecked />
            <ToggleOption title="Incluir cargas" description="Contrib. patronales" defaultChecked />
            <ToggleOption title="Por categoría" description="Agrupar empleados" />
            <ToggleOption title="Prorratear SAC" description="Aguinaldo mensual" />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ============================================
// COMPRAS SECTION - DATOS REALES DESDE FACTURAS
// ============================================
function ComprasSection({ month, companyId, theme, colors }: { month: string; companyId: string; theme: ThemeConfig; colors: UserColorPreferences }) {
  const stats = EXTENDED_STATS.compras;
  const baseColor = theme.primary === 'slate' ? 'slate' : 'green';

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['costos-purchases-v2', companyId, month],
    queryFn: async () => {
      const res = await fetch(`/api/costos/purchases?month=${month}`);
      if (!res.ok) throw new Error('Error fetching purchases');
      return res.json();
    },
    enabled: !!companyId && !!month,
  });

  const summary = data?.summary ?? { totalPurchases: 0, receiptCount: 0, supplierCount: 0 };
  const bySupplier: any[] = data?.bySupplier ?? [];
  const details: any[] = data?.details ?? [];
  const hasData = summary.totalPurchases > 0;

  return (
    <div className="space-y-6">
      <SourceBanner source="PurchaseReceipt" status="connected" detail="Facturas imputadas al período" color={baseColor} />

      {/* KPIs principales — reales + operativos */}
      <div className="grid grid-cols-6 gap-4">
        <MiniKPIEnhanced
          title="Total Compras"
          value={isLoading ? '...' : `$${formatCurrency(summary.totalPurchases)}`}
          trend={8.5}
          icon={ShoppingCart}
          color={baseColor}
        />
        <MiniKPIEnhanced title="Facturas" value={isLoading ? '...' : `${summary.receiptCount}`} subtitle="Del período" icon={FileText} color={theme.primary === 'slate' ? 'gray' : 'slate'} />
        <MiniKPIEnhanced title="Proveedores" value={isLoading ? '...' : `${summary.supplierCount}`} subtitle="Distintos" icon={Truck} color={theme.primary === 'slate' ? 'zinc' : 'indigo'} />
        <MiniKPIEnhanced title="OC Abiertas" value={`${stats.ordenesAbiertas}`} subtitle="Pendientes" icon={Package} color={theme.primary === 'slate' ? 'stone' : 'cyan'} />
        <MiniKPIEnhanced title="Ahorro Negoc." value={`$${formatCurrency(stats.ahorroNegociado)}`} subtitle="vs precio lista" icon={PiggyBank} color={theme.primary === 'slate' ? 'neutral' : 'emerald'} />
        <MiniKPIEnhanced title="Precio vs Presup." value={`${stats.precioVsPresup}%`} trend={stats.precioVsPresup} icon={Percent} color={theme.primary === 'slate' ? 'slate' : 'amber'} />
      </div>

      {/* Segunda fila - KPIs adicionales */}
      <div className="grid grid-cols-4 gap-4">
        <Card className="bg-muted/30">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-muted-foreground">Devoluciones</span>
              <XCircle className="w-4 h-4 text-destructive" />
            </div>
            <p className="text-xl font-bold">{stats.devoluciones}</p>
            <p className="text-xs text-muted-foreground">Del período</p>
          </CardContent>
        </Card>
        <Card className="bg-muted/30">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-muted-foreground">Concentración Top 3</span>
              <Percent className="w-4 h-4 text-warning-muted-foreground" />
            </div>
            <p className="text-xl font-bold">{stats.concentracion.top3}%</p>
            <p className="text-xs text-muted-foreground">Top 5: {stats.concentracion.top5}%</p>
          </CardContent>
        </Card>
        <Card className="bg-muted/30">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-muted-foreground">OC Abiertas</span>
              <FileText className="w-4 h-4 text-info-muted-foreground" />
            </div>
            <p className="text-xl font-bold">{stats.ordenesAbiertas}</p>
            <p className="text-xs text-muted-foreground">Pendientes de recepción</p>
          </CardContent>
        </Card>
        <Card className="bg-muted/30">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-muted-foreground">Ahorro Negociado</span>
              <PiggyBank className="w-4 h-4 text-success" />
            </div>
            <p className="text-xl font-bold">${formatCurrency(stats.ahorroNegociado)}</p>
            <p className="text-xs text-muted-foreground">vs precio de lista</p>
          </CardContent>
        </Card>
      </div>

      {/* Gráficos */}
      <div className="grid grid-cols-3 gap-6">
        {/* Evolución diaria */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Compras por Día</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-48 flex items-end gap-1">
              {stats.porDia.map((val, i) => (
                <div key={i} className="flex-1 flex flex-col items-center gap-1">
                  <div
                    className="w-full bg-success rounded-t transition-all hover:opacity-80"
                    style={{ height: `${(val / Math.max(...stats.porDia)) * 100}%` }}
                  />
                  <span className="text-[10px] text-muted-foreground">{['L', 'M', 'X', 'J', 'V', 'S', 'D'][i]}</span>
                </div>
              ))}
            </div>
            <div className="mt-4 flex items-center justify-between text-sm border-t pt-3">
              <span className="text-muted-foreground">Promedio diario</span>
              <span className="font-medium">${formatCurrency(stats.porDia.reduce((a, b) => a + b, 0) / stats.porDia.length)}</span>
            </div>
          </CardContent>
        </Card>

        {/* Comparativa */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Comparativa</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <ComparisonRow label="vs Mes Anterior" current={summary.totalPurchases || 520000} previous={479000} />
            <ComparisonRow label="vs Mismo Mes 2025" current={summary.totalPurchases || 520000} previous={410000} />
            <ComparisonRow label="vs Presupuesto" current={summary.totalPurchases || 520000} previous={540000} inverted />
            <Separator />
            <div className="grid grid-cols-2 gap-4 text-center">
              <div>
                <p className="text-xs text-muted-foreground">Top 3 Prov.</p>
                <p className="text-lg font-bold text-success">{stats.concentracion.top3}%</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Precio vs Presup.</p>
                <p className="text-lg font-bold text-warning-muted-foreground">{stats.precioVsPresup}%</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Concentración proveedores */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Concentración</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {[
                { label: 'Top 3 proveedores', value: stats.concentracion.top3 },
                { label: 'Top 5 proveedores', value: stats.concentracion.top5 },
                { label: 'Resto', value: 100 - stats.concentracion.top5 },
              ].map((item, i) => (
                <div key={i} className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">{item.label}</span>
                    <span className="font-medium">{item.value}%</span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full bg-success transition-all"
                      style={{ width: `${item.value}%`, opacity: 1 - i * 0.25 }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Por Proveedor — datos reales */}
      {hasData && bySupplier.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Compras por Proveedor</CardTitle>
              <Button variant="outline" size="sm" onClick={() => refetch()}>
                <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
                Actualizar
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Proveedor</TableHead>
                  <TableHead className="text-right">Facturas</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="text-right">% del Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {bySupplier.map((s: any) => (
                  <TableRow key={s.supplierId}>
                    <TableCell className="font-medium">{s.supplierName}</TableCell>
                    <TableCell className="text-right">{s.receiptCount}</TableCell>
                    <TableCell className="text-right font-bold" style={{ color: colors.chart1 }}>
                      ${formatCurrency(s.total)}
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      {summary.totalPurchases > 0 ? ((s.total / summary.totalPurchases) * 100).toFixed(1) + '%' : '0%'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Detalle de Facturas — datos reales */}
      {hasData && details.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Detalle de Facturas</CardTitle>
            <CardDescription>
              Mostrando {Math.min(20, details.length)} de {details.length} comprobantes
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Proveedor</TableHead>
                  <TableHead>N° Factura</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Neto</TableHead>
                  <TableHead className="text-right">% del Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {details
                  .sort((a: any, b: any) => b.neto - a.neto)
                  .slice(0, 20)
                  .map((item: any) => (
                    <TableRow key={item.receiptId}>
                      <TableCell className="font-medium">{item.supplierName}</TableCell>
                      <TableCell className="text-muted-foreground text-sm">{item.receiptNumber || '—'}</TableCell>
                      <TableCell className="text-muted-foreground text-sm">{item.tipo || '—'}</TableCell>
                      <TableCell><Badge variant="outline">{item.estado || '—'}</Badge></TableCell>
                      <TableCell className="text-right font-bold" style={{ color: colors.chart1 }}>
                        ${formatCurrency(item.neto)}
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground">
                        {summary.totalPurchases > 0 ? ((item.neto / summary.totalPurchases) * 100).toFixed(1) + '%' : '0%'}
                      </TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {!hasData && !isLoading && (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-8">
              <ShoppingCart className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
              <p className="text-muted-foreground">No hay facturas de compras imputadas en este período.</p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ============================================
// INDIRECTOS SECTION - DATOS REALES DESDE COMPRAS
// ============================================
function IndirectosSection({ month, companyId, theme, colors }: { month: string; companyId: string; theme: ThemeConfig; colors: UserColorPreferences }) {
  return (
    <div className="space-y-6">
      <IndirectViewV2 companyId={companyId} selectedMonth={month} />
    </div>
  );
}

// ============================================
// PRODUCCIÓN SECTION - DATOS REALES DESDE PRODUCCIÓN + RECETAS
// ============================================
function ProduccionSection({ month, companyId, theme, colors }: { month: string; companyId: string; theme: ThemeConfig; colors: UserColorPreferences }) {
  return (
    <div className="space-y-6">
      <ProductionViewV2 companyId={companyId} selectedMonth={month} />
    </div>
  );
}

// ============================================
// VENTAS SECTION - CON MÁS ESTADÍSTICAS
// ============================================
function VentasSection({ month, companyId, colors }: { month: string; companyId: string; colors: UserColorPreferences }) {
  return (
    <div className="space-y-6">
      <SalesViewV2 companyId={companyId} selectedMonth={month} userColors={colors} />
    </div>
  );
}

// ============================================
// WRAPPERS PARA HERRAMIENTAS
// ============================================
function DistribucionSection({ colors, month }: { colors: UserColorPreferences; month?: string }) {
  const { currentCompany } = useCompany();
  const [costDistributions, setCostDistributions] = useState<any[]>([]);
  const [employeeDistributions, setEmployeeDistributions] = useState<any[]>([]);
  const [productCategories, setProductCategories] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [indirectCosts, setIndirectCosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [expandedEmployeeGroups, setExpandedEmployeeGroups] = useState<Set<string>>(new Set());

  // Filter states
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>('all');
  const [selectedCostTypeFilter, setSelectedCostTypeFilter] = useState<string>('all');

  // Dialog states
  const [showMatrixDialog, setShowMatrixDialog] = useState(false);
  const [showEmployeeMatrixDialog, setShowEmployeeMatrixDialog] = useState(false);

  // View mode: 'summary' | 'detailed' | 'tool'
  const [viewMode, setViewMode] = useState<'summary' | 'detailed' | 'tool'>('summary');

  // Mock data for demo/testing
  const MOCK_CATEGORIES = [
    { id: 1, name: 'Adoquines' },
    { id: 2, name: 'Bloques' },
    { id: 3, name: 'Viguetas' },
  ];

  const MOCK_COST_DISTRIBUTIONS = [
    { id: 1, cost_type: 'Electricidad', cost_name: 'Consumo eléctrico planta', product_category_id: 1, productCategoryId: 1, productCategoryName: 'Adoquines', percentage: 40, totalCost: 850000, is_active: true },
    { id: 2, cost_type: 'Electricidad', cost_name: 'Consumo eléctrico planta', product_category_id: 2, productCategoryId: 2, productCategoryName: 'Bloques', percentage: 35, totalCost: 850000, is_active: true },
    { id: 3, cost_type: 'Electricidad', cost_name: 'Consumo eléctrico planta', product_category_id: 3, productCategoryId: 3, productCategoryName: 'Viguetas', percentage: 25, totalCost: 850000, is_active: true },
    { id: 4, cost_type: 'Gas', cost_name: 'Gas industrial', product_category_id: 1, productCategoryId: 1, productCategoryName: 'Adoquines', percentage: 30, totalCost: 420000, is_active: true },
    { id: 5, cost_type: 'Gas', cost_name: 'Gas industrial', product_category_id: 2, productCategoryId: 2, productCategoryName: 'Bloques', percentage: 45, totalCost: 420000, is_active: true },
    { id: 6, cost_type: 'Gas', cost_name: 'Gas industrial', product_category_id: 3, productCategoryId: 3, productCategoryName: 'Viguetas', percentage: 25, totalCost: 420000, is_active: true },
    { id: 7, cost_type: 'Mantenimiento', cost_name: 'Mantenimiento maquinaria', product_category_id: 1, productCategoryId: 1, productCategoryName: 'Adoquines', percentage: 35, totalCost: 380000, is_active: true },
    { id: 8, cost_type: 'Mantenimiento', cost_name: 'Mantenimiento maquinaria', product_category_id: 2, productCategoryId: 2, productCategoryName: 'Bloques', percentage: 40, totalCost: 380000, is_active: true },
    { id: 9, cost_type: 'Mantenimiento', cost_name: 'Mantenimiento maquinaria', product_category_id: 3, productCategoryId: 3, productCategoryName: 'Viguetas', percentage: 25, totalCost: 380000, is_active: true },
    { id: 10, cost_type: 'Alquiler', cost_name: 'Alquiler nave industrial', product_category_id: 1, productCategoryId: 1, productCategoryName: 'Adoquines', percentage: 33, totalCost: 650000, is_active: true },
    { id: 11, cost_type: 'Alquiler', cost_name: 'Alquiler nave industrial', product_category_id: 2, productCategoryId: 2, productCategoryName: 'Bloques', percentage: 34, totalCost: 650000, is_active: true },
    { id: 12, cost_type: 'Alquiler', cost_name: 'Alquiler nave industrial', product_category_id: 3, productCategoryId: 3, productCategoryName: 'Viguetas', percentage: 33, totalCost: 650000, is_active: true },
  ];

  const MOCK_EMPLOYEE_DISTRIBUTIONS = [
    { id: 1, employeeId: 1, employeeName: 'Juan Pérez', employeeLastName: '', productCategoryId: 1, productCategoryName: 'Adoquines', percentage: 60, totalSalary: 280000, role: 'Operario', isMatrixDistribution: false },
    { id: 2, employeeId: 1, employeeName: 'Juan Pérez', employeeLastName: '', productCategoryId: 2, productCategoryName: 'Bloques', percentage: 40, totalSalary: 280000, role: 'Operario', isMatrixDistribution: false },
    { id: 3, employeeId: 2, employeeName: 'María García', employeeLastName: '', productCategoryId: 2, productCategoryName: 'Bloques', percentage: 80, totalSalary: 320000, role: 'Supervisor', isMatrixDistribution: true },
    { id: 4, employeeId: 2, employeeName: 'María García', employeeLastName: '', productCategoryId: 3, productCategoryName: 'Viguetas', percentage: 20, totalSalary: 320000, role: 'Supervisor', isMatrixDistribution: true },
    { id: 5, employeeId: 3, employeeName: 'Carlos López', employeeLastName: '', productCategoryId: 1, productCategoryName: 'Adoquines', percentage: 50, totalSalary: 250000, role: 'Operario', isMatrixDistribution: false },
    { id: 6, employeeId: 3, employeeName: 'Carlos López', employeeLastName: '', productCategoryId: 3, productCategoryName: 'Viguetas', percentage: 50, totalSalary: 250000, role: 'Operario', isMatrixDistribution: false },
    { id: 7, employeeId: 4, employeeName: 'Ana Martínez', employeeLastName: '', productCategoryId: 3, productCategoryName: 'Viguetas', percentage: 100, totalSalary: 290000, role: 'Técnico', isMatrixDistribution: true },
    { id: 8, employeeId: 5, employeeName: 'Roberto Sánchez', employeeLastName: '', productCategoryId: 1, productCategoryName: 'Adoquines', percentage: 33, totalSalary: 350000, role: 'Jefe Producción', isMatrixDistribution: true },
    { id: 9, employeeId: 5, employeeName: 'Roberto Sánchez', employeeLastName: '', productCategoryId: 2, productCategoryName: 'Bloques', percentage: 34, totalSalary: 350000, role: 'Jefe Producción', isMatrixDistribution: true },
    { id: 10, employeeId: 5, employeeName: 'Roberto Sánchez', employeeLastName: '', productCategoryId: 3, productCategoryName: 'Viguetas', percentage: 33, totalSalary: 350000, role: 'Jefe Producción', isMatrixDistribution: true },
  ];

  const MOCK_EMPLOYEES = [
    { id: 1, nombre: 'Juan', apellido: 'Pérez', cargo: 'Operario', salario: 280000 },
    { id: 2, nombre: 'María', apellido: 'García', cargo: 'Supervisor', salario: 320000 },
    { id: 3, nombre: 'Carlos', apellido: 'López', cargo: 'Operario', salario: 250000 },
    { id: 4, nombre: 'Ana', apellido: 'Martínez', cargo: 'Técnico', salario: 290000 },
    { id: 5, nombre: 'Roberto', apellido: 'Sánchez', cargo: 'Jefe Producción', salario: 350000 },
  ];

  const MOCK_INDIRECT_COSTS = [
    { id: 1, name: 'Electricidad', amount: 850000, type: 'utility' },
    { id: 2, name: 'Gas', amount: 420000, type: 'utility' },
    { id: 3, name: 'Mantenimiento', amount: 380000, type: 'service' },
    { id: 4, name: 'Alquiler', amount: 650000, type: 'fixed' },
  ];

  // Fetch real data from API
  const fetchData = async () => {
    if (!currentCompany?.id) return;
    setLoading(true);
    try {
      const currentM = month || new Date().toISOString().slice(0, 7);

      const [distributionRes, employeesRes] = await Promise.all([
        fetch(`/api/costos/indirect/distribution?month=${currentM}`),
        fetch(`/api/costos/empleados?companyId=${currentCompany.id}&limit=100`),
      ]);

      let costs: any[] = [];
      let indirect: any[] = [];
      let cats: any[] = [];
      let emps: any[] = [];

      if (distributionRes.ok) {
        const data = await distributionRes.json();
        // Adaptar shape: categories[] → costDistributions[] + indirectCosts[]
        const categories: any[] = data.categories || [];
        costs = categories.flatMap((cat: any) =>
          (cat.distributions || []).map((d: any) => ({
            id: d.id,
            cost_type: cat.label,
            cost_name: cat.label,
            product_category_id: d.productCategoryId,
            productCategoryId: d.productCategoryId,
            productCategoryName: d.productCategoryName,
            percentage: d.percentage,
            totalCost: cat.monthTotal,
            is_active: true,
          }))
        );
        indirect = categories
          .filter((cat: any) => cat.monthTotal > 0)
          .map((cat: any) => ({
            id: cat.key,
            name: cat.label,
            amount: cat.monthTotal,
            type: 'indirect',
          }));
        // Derivar categorías de productos desde la configuración de distribución
        const catMap = new Map<number, { id: number; name: string }>();
        categories.forEach((cat: any) => {
          (cat.distributions || []).forEach((d: any) => {
            if (d.productCategoryId && !catMap.has(d.productCategoryId)) {
              catMap.set(d.productCategoryId, { id: d.productCategoryId, name: d.productCategoryName });
            }
          });
        });
        cats = Array.from(catMap.values());
      }

      if (employeesRes.ok) {
        const data = await employeesRes.json();
        // /api/costos/empleados responde con: { items: [...], total, page, ... }
        emps = data.items || [];
      }

      setCostDistributions(costs.length > 0 ? costs : MOCK_COST_DISTRIBUTIONS);
      setEmployeeDistributions(MOCK_EMPLOYEE_DISTRIBUTIONS); // empleados: mantener mock hasta que exista API
      setProductCategories(cats.length > 0 ? cats : MOCK_CATEGORIES);
      setEmployees(emps.length > 0 ? emps : MOCK_EMPLOYEES);
      setIndirectCosts(indirect.length > 0 ? indirect : MOCK_INDIRECT_COSTS);

    } catch (error) {
      console.error('Error fetching distribution data:', error);
      setCostDistributions(MOCK_COST_DISTRIBUTIONS);
      setEmployeeDistributions(MOCK_EMPLOYEE_DISTRIBUTIONS);
      setProductCategories(MOCK_CATEGORIES);
      setEmployees(MOCK_EMPLOYEES);
      setIndirectCosts(MOCK_INDIRECT_COSTS);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [currentCompany?.id, month]);

  // Calculate validation warnings - cost types that don't sum to 100%
  const validationWarnings = useMemo(() => {
    const warnings: Array<{ costType: string; totalPercent: number; categories: string[] }> = [];

    // Group by cost_type and sum percentages
    const costTypeGroups = costDistributions.reduce((acc, dist) => {
      const type = dist.cost_type || dist.costType;
      if (!acc[type]) {
        acc[type] = { total: 0, categories: [] as string[] };
      }
      // Ensure percentage is converted to number
      const pct = Number(dist.percentage) || 0;
      acc[type].total += pct;
      acc[type].categories.push(dist.productCategoryName || 'Sin categoría');
      return acc;
    }, {} as Record<string, { total: number; categories: string[] }>);

    Object.entries(costTypeGroups).forEach(([costType, data]) => {
      const total = Number(data.total) || 0;
      if (Math.abs(total - 100) > 0.01) {
        warnings.push({
          costType,
          totalPercent: total,
          categories: data.categories
        });
      }
    });

    return warnings;
  }, [costDistributions]);

  // Group costs by type for collapsible view
  const groupedCosts = useMemo(() => {
    const groups: Record<string, any[]> = {};
    costDistributions.forEach(dist => {
      const type = dist.cost_type || dist.costType || 'Otros';
      if (!groups[type]) groups[type] = [];
      groups[type].push(dist);
    });
    return groups;
  }, [costDistributions]);

  // Calculate real stats
  const distribucionStats = useMemo(() => {
    const totalIndirectos = costDistributions.reduce((sum, cost) => {
      const totalCost = Number(cost.totalCost) || 0;
      const pct = Number(cost.percentage) || 0;
      const amount = totalCost > 0 ? (totalCost * pct) / 100 : 0;
      return sum + amount;
    }, 0);
    const totalEmpleados = employeeDistributions.reduce((sum, emp) => {
      const totalSalary = Number(emp.totalSalary) || 0;
      const pct = Number(emp.percentage) || 0;
      const amount = totalSalary > 0 ? (totalSalary * pct) / 100 : 0;
      return sum + amount;
    }, 0);
    const costTypes = new Set(costDistributions.map(d => d.cost_type || d.costType)).size;

    return {
      totalIndirectos: totalIndirectos + totalEmpleados,
      totalDistribuido: totalIndirectos + totalEmpleados,
      pendiente: 0,
      costosIndirectos: costDistributions.length,
      empleados: employeeDistributions.length,
      categorias: productCategories.length,
      tiposCosto: costTypes,
    };
  }, [costDistributions, employeeDistributions, productCategories]);

  const toggleGroup = (group: string) => {
    setExpandedGroups(prev => {
      const newSet = new Set(prev);
      if (newSet.has(group)) newSet.delete(group);
      else newSet.add(group);
      return newSet;
    });
  };

  const toggleEmployeeGroup = (group: string) => {
    setExpandedEmployeeGroups(prev => {
      const newSet = new Set(prev);
      if (newSet.has(group)) newSet.delete(group);
      else newSet.add(group);
      return newSet;
    });
  };

  // Get unique cost types for filter
  const uniqueCostTypes = useMemo(() => {
    const types = new Set(costDistributions.map(d => d.cost_type || d.costType || 'Otros'));
    return Array.from(types).sort();
  }, [costDistributions]);

  // Filtered cost distributions
  const filteredCostDistributions = useMemo(() => {
    return costDistributions.filter(dist => {
      const matchesCategory = selectedCategoryFilter === 'all' ||
        (dist.product_category_id?.toString() === selectedCategoryFilter ||
         dist.productCategoryId?.toString() === selectedCategoryFilter);
      const matchesCostType = selectedCostTypeFilter === 'all' ||
        (dist.cost_type === selectedCostTypeFilter || dist.costType === selectedCostTypeFilter);
      return matchesCategory && matchesCostType;
    });
  }, [costDistributions, selectedCategoryFilter, selectedCostTypeFilter]);

  // Filtered employee distributions
  const filteredEmployeeDistributions = useMemo(() => {
    return employeeDistributions.filter(emp => {
      const matchesCategory = selectedCategoryFilter === 'all' ||
        emp.productCategoryId?.toString() === selectedCategoryFilter;
      return matchesCategory;
    });
  }, [employeeDistributions, selectedCategoryFilter]);

  // Group employees by category for display
  const groupedEmployees = useMemo(() => {
    const groups: Record<string, any[]> = {};
    filteredEmployeeDistributions.forEach(emp => {
      const catName = emp.productCategoryName || 'Sin categoría';
      if (!groups[catName]) groups[catName] = [];
      groups[catName].push(emp);
    });
    return groups;
  }, [filteredEmployeeDistributions]);

  // Category summary with both indirect and employee costs
  const categorySummary = useMemo(() => {
    return productCategories.map((cat, i) => {
      const catCosts = costDistributions.filter(c =>
        c.product_category_id === cat.id || c.productCategoryId === cat.id
      );
      const catEmployees = employeeDistributions.filter(e => e.productCategoryId === cat.id);

      const totalIndirect = catCosts.reduce((sum, c) => {
        const costVal = Number(c.totalCost) || 0;
        const pct = Number(c.percentage) || 0;
        return sum + (costVal > 0 ? (costVal * pct) / 100 : 0);
      }, 0);

      const totalEmployee = catEmployees.reduce((sum, e) => {
        const salaryVal = Number(e.totalSalary) || 0;
        const pct = Number(e.percentage) || 0;
        return sum + (salaryVal > 0 ? (salaryVal * pct) / 100 : 0);
      }, 0);

      return {
        ...cat,
        totalIndirect,
        totalEmployee,
        total: totalIndirect + totalEmployee,
        configCount: catCosts.length + catEmployees.length,
        color: [colors.donut1, colors.donut2, colors.donut3, colors.donut4, colors.donut5][i % 5]
      };
    });
  }, [productCategories, costDistributions, employeeDistributions, colors]);

  const grandTotal = categorySummary.reduce((sum, cat) => sum + cat.total, 0);

  return (
    <div className="space-y-6">
      {/* Validation Warnings Panel */}
      {validationWarnings.length > 0 && (
        <Card className="border-l-4" style={{ borderLeftColor: colors.progressWarning, backgroundColor: colors.progressWarning + '10' }}>
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 mt-0.5 flex-shrink-0" style={{ color: colors.progressWarning }} />
              <div className="flex-1">
                <p className="font-medium text-sm mb-2">Distribuciones Incompletas</p>
                <p className="text-xs text-muted-foreground mb-3">
                  Los siguientes tipos de costo no suman 100% entre sus categorías destino:
                </p>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                  {validationWarnings.map((warning, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between p-2 rounded-md border"
                      style={{ borderColor: colors.progressWarning + '50', backgroundColor: 'white' }}
                    >
                      <span className="text-xs font-medium truncate">{warning.costType}</span>
                      <Badge
                        variant="outline"
                        className="ml-2 text-[10px]"
                        style={{
                          color: warning.totalPercent > 100 ? colors.kpiNegative : colors.progressWarning,
                          borderColor: warning.totalPercent > 100 ? colors.kpiNegative : colors.progressWarning,
                        }}
                      >
                        {warning.totalPercent.toFixed(1)}%
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Success indicator when all valid */}
      {validationWarnings.length === 0 && costDistributions.length > 0 && (
        <Card className="border-l-4" style={{ borderLeftColor: colors.kpiPositive, backgroundColor: colors.kpiPositive + '10' }}>
          <CardContent className="p-3">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4" style={{ color: colors.kpiPositive }} />
              <span className="text-sm font-medium" style={{ color: colors.kpiPositive }}>
                Todas las distribuciones suman 100% correctamente
              </span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Header con filtros y acciones */}
      <Card>
        <CardContent className="py-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            {/* Filtros */}
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm font-medium">Filtros:</span>
              </div>

              <Select value={selectedCategoryFilter} onValueChange={setSelectedCategoryFilter}>
                <SelectTrigger className="w-[180px] h-9">
                  <SelectValue placeholder="Categoría" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas las categorías</SelectItem>
                  {productCategories.map(cat => (
                    <SelectItem key={cat.id} value={cat.id.toString()}>{cat.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={selectedCostTypeFilter} onValueChange={setSelectedCostTypeFilter}>
                <SelectTrigger className="w-[180px] h-9">
                  <SelectValue placeholder="Tipo de costo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los tipos</SelectItem>
                  {uniqueCostTypes.map(type => (
                    <SelectItem key={type} value={type}>{type}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {(selectedCategoryFilter !== 'all' || selectedCostTypeFilter !== 'all') && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setSelectedCategoryFilter('all');
                    setSelectedCostTypeFilter('all');
                  }}
                >
                  Limpiar filtros
                </Button>
              )}
            </div>

            {/* Acciones */}
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowMatrixDialog(true)}
                className="bg-success-muted hover:bg-success-muted/80 border-success-muted"
              >
                <Grid3X3 className="h-4 w-4 mr-1" />
                Matriz Costos
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowEmployeeMatrixDialog(true)}
                className="bg-info-muted hover:bg-info-muted/80 border-info-muted"
              >
                <Grid3X3 className="h-4 w-4 mr-1" />
                Matriz Empleados
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setViewMode(viewMode === 'tool' ? 'summary' : 'tool')}
              >
                <Settings2 className="h-4 w-4 mr-1" />
                {viewMode === 'tool' ? 'Ver Resumen' : 'Herramienta Completa'}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Vista Herramienta Completa */}
      {viewMode === 'tool' ? (
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base flex items-center gap-2">
                  <Settings2 className="w-4 h-4" style={{ color: colors.chart4 }} />
                  Herramienta de Distribución Completa
                </CardTitle>
                <CardDescription>Configura y ejecuta la distribución de costos indirectos y empleados</CardDescription>
              </div>
              <Badge style={{ backgroundColor: colors.kpiPositive, color: 'white' }}>V1</Badge>
            </div>
          </CardHeader>
          <CardContent>
            <DistribucionCostos />
          </CardContent>
        </Card>
      ) : (
        <>
          {/* KPIs Row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card className="border-l-4" style={{ borderLeftColor: colors.chart4 }}>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-1">
                  <DollarSign className="w-4 h-4" style={{ color: colors.chart4 }} />
                  <span className="text-xs text-muted-foreground">Total Distribuido</span>
                </div>
                <p className="text-xl font-bold">${formatCurrency(grandTotal)}</p>
              </CardContent>
            </Card>

            <Card className="border-l-4" style={{ borderLeftColor: colors.chart1 }}>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-1">
                  <Layers className="w-4 h-4" style={{ color: colors.chart1 }} />
                  <span className="text-xs text-muted-foreground">Costos Indirectos</span>
                </div>
                <p className="text-xl font-bold">{distribucionStats.costosIndirectos}</p>
              </CardContent>
            </Card>

            <Card className="border-l-4" style={{ borderLeftColor: colors.chart2 }}>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-1">
                  <Users className="w-4 h-4" style={{ color: colors.chart2 }} />
                  <span className="text-xs text-muted-foreground">Empleados</span>
                </div>
                <p className="text-xl font-bold">{distribucionStats.empleados}</p>
              </CardContent>
            </Card>

            <Card className="border-l-4" style={{ borderLeftColor: colors.chart3 }}>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-1">
                  <Package className="w-4 h-4" style={{ color: colors.chart3 }} />
                  <span className="text-xs text-muted-foreground">Categorías</span>
                </div>
                <p className="text-xl font-bold">{distribucionStats.categorias}</p>
              </CardContent>
            </Card>
          </div>

          {/* Distribución por Categoría (como V1) */}
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <PieChart className="w-4 h-4" style={{ color: colors.chart2 }} />
                  Distribución por Categoría de Producto
                </CardTitle>
                <Badge variant="secondary" className="text-xs">
                  Total: ${formatCurrency(grandTotal)}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              {/* Barra de distribución proporcional */}
              {grandTotal > 0 && (
                <div className="mb-4">
                  <div className="h-4 rounded-full overflow-hidden bg-muted flex">
                    {categorySummary.filter(cat => cat.total > 0).map((cat, i) => {
                      const pct = (cat.total / grandTotal) * 100;
                      return (
                        <div
                          key={cat.id}
                          className="transition-all duration-500 relative group"
                          style={{ width: `${pct}%`, backgroundColor: cat.color }}
                          title={`${cat.name}: ${pct.toFixed(1)}%`}
                        >
                          {pct > 8 && (
                            <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-white">
                              {pct.toFixed(0)}%
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {categorySummary.filter(cat => cat.total > 0).map(cat => (
                      <div key={cat.id} className="flex items-center gap-1">
                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: cat.color }} />
                        <span className="text-xs text-muted-foreground">{cat.name}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Cards de categoría (como V1) */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {categorySummary.map(cat => {
                  const pct = grandTotal > 0 ? (cat.total / grandTotal) * 100 : 0;
                  const indirectPct = cat.total > 0 ? (cat.totalIndirect / cat.total) * 100 : 0;

                  return (
                    <div
                      key={cat.id}
                      className="p-4 border rounded-lg border-l-4 hover:shadow-md transition-all"
                      style={{ borderLeftColor: cat.color, backgroundColor: cat.color + '08' }}
                    >
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: cat.color }} />
                          <h3 className="font-semibold text-sm">{cat.name}</h3>
                        </div>
                        <div className="flex items-center gap-1">
                          <Badge variant="outline" className="text-[10px]">{cat.configCount} configs</Badge>
                          {pct > 0 && (
                            <Badge className="text-[10px] text-white" style={{ backgroundColor: cat.color }}>
                              {pct.toFixed(1)}%
                            </Badge>
                          )}
                        </div>
                      </div>

                      {/* Indirectos */}
                      <div className="space-y-1 mb-2">
                        <div className="flex justify-between items-center text-xs">
                          <span className="text-muted-foreground flex items-center gap-1">
                            <DollarSign className="h-3 w-3" /> Indirectos
                          </span>
                          <span className="font-semibold" style={{ color: colors.chart1 }}>
                            ${formatCurrency(cat.totalIndirect)}
                          </span>
                        </div>
                        <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full"
                            style={{ width: `${indirectPct}%`, backgroundColor: colors.chart1 }}
                          />
                        </div>
                      </div>

                      {/* Empleados */}
                      <div className="space-y-1 mb-2">
                        <div className="flex justify-between items-center text-xs">
                          <span className="text-muted-foreground flex items-center gap-1">
                            <Users className="h-3 w-3" /> Empleados
                          </span>
                          <span className="font-semibold" style={{ color: colors.chart4 }}>
                            ${formatCurrency(cat.totalEmployee)}
                          </span>
                        </div>
                        <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full"
                            style={{ width: `${100 - indirectPct}%`, backgroundColor: colors.chart4 }}
                          />
                        </div>
                      </div>

                      {/* Total */}
                      <div className="pt-2 border-t flex justify-between items-center">
                        <span className="text-xs font-medium flex items-center gap-1">
                          <CheckCircle2 className="h-3 w-3" /> Total
                        </span>
                        <span className="text-lg font-bold" style={{ color: cat.color }}>
                          ${formatCurrency(cat.total)}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Costos Indirectos Detallados */}
          <Card className="border-t-4" style={{ borderTopColor: colors.chart1 }}>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <Layers className="w-4 h-4" style={{ color: colors.chart4 }} />
                Distribuciones por Tipo de Costo
              </CardTitle>
              <CardDescription>Agrupación colapsable - click para expandir</CardDescription>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setExpandedGroups(new Set(Object.keys(groupedCosts)))}
              >
                Expandir todos
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setExpandedGroups(new Set())}
              >
                Colapsar todos
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="w-5 h-5 animate-spin text-muted-foreground" />
              <span className="ml-2 text-sm text-muted-foreground">Cargando distribuciones...</span>
            </div>
          ) : Object.keys(groupedCosts).length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Layers className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p>No hay distribuciones configuradas</p>
            </div>
          ) : (
            <div className="space-y-2">
              {Object.entries(groupedCosts).map(([costType, costs], groupIndex) => {
                const isExpanded = expandedGroups.has(costType);
                const totalPercent = costs.reduce((sum, c) => sum + (Number(c.percentage) || 0), 0);
                const totalAmount = costs.reduce((sum, c) => {
                  const costVal = Number(c.totalCost) || 0;
                  const pctVal = Number(c.percentage) || 0;
                  const amount = costVal > 0 ? (costVal * pctVal) / 100 : 0;
                  return sum + amount;
                }, 0);
                const isValid = Math.abs(totalPercent - 100) < 0.01;
                const groupColor = [colors.chart1, colors.chart2, colors.chart3, colors.chart4, colors.chart5][groupIndex % 5];

                return (
                  <Collapsible key={costType} open={isExpanded} onOpenChange={() => toggleGroup(costType)}>
                    <CollapsibleTrigger className="w-full">
                      <div
                        className="flex items-center justify-between p-3 rounded-lg border hover:shadow-sm transition-all"
                        style={{ borderLeftWidth: '4px', borderLeftColor: groupColor }}
                      >
                        <div className="flex items-center gap-3">
                          {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                          <span className="font-medium">{costType}</span>
                          <Badge variant="outline" className="text-xs">
                            {costs.length} {costs.length === 1 ? 'distribución' : 'distribuciones'}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-sm font-medium">${formatCurrency(totalAmount)}</span>
                          <Badge
                            variant={isValid ? 'default' : 'outline'}
                            className="text-xs"
                            style={{
                              backgroundColor: isValid ? colors.kpiPositive : 'transparent',
                              color: isValid ? 'white' : totalPercent > 100 ? colors.kpiNegative : colors.progressWarning,
                              borderColor: isValid ? colors.kpiPositive : totalPercent > 100 ? colors.kpiNegative : colors.progressWarning,
                            }}
                          >
                            {totalPercent.toFixed(1)}%
                          </Badge>
                        </div>
                      </div>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <div className="ml-6 mt-2 space-y-2">
                        {costs.map((cost, i) => {
                          const costVal = Number(cost.totalCost) || 0;
                          const pctVal = Number(cost.percentage) || 0;
                          const amount = costVal > 0 ? (costVal * pctVal) / 100 : 0;
                          return (
                            <div
                              key={cost.id || i}
                              className="flex items-center justify-between p-2 rounded-md bg-muted/30 text-sm"
                            >
                              <div className="flex items-center gap-2">
                                <ArrowRight className="w-3 h-3 text-muted-foreground" />
                                <span>{cost.productCategoryName || 'Sin categoría'}</span>
                              </div>
                              <div className="flex items-center gap-3">
                                <span className="text-muted-foreground">{pctVal}%</span>
                                <span className="font-medium">${formatCurrency(amount)}</span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Gráficos y detalles */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Distribución por categoría de producto */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Package className="w-4 h-4" style={{ color: colors.chart3 }} />
              Por Categoría de Producto
            </CardTitle>
            <CardDescription>Costos asignados por destino</CardDescription>
          </CardHeader>
          <CardContent>
            {(() => {
              // Calculate costs per category from real data
              const categoryTotals = productCategories.map((cat, i) => {
                const indirectCosts = costDistributions
                  .filter(c => c.product_category_id === cat.id || c.productCategoryId === cat.id)
                  .reduce((sum, c) => {
                    const costVal = Number(c.totalCost) || 0;
                    const pctVal = Number(c.percentage) || 0;
                    return sum + (costVal > 0 ? (costVal * pctVal) / 100 : 0);
                  }, 0);
                const employeeCosts = employeeDistributions
                  .filter(e => e.productCategoryId === cat.id)
                  .reduce((sum, e) => {
                    const salaryVal = Number(e.totalSalary) || 0;
                    const pctVal = Number(e.percentage) || 0;
                    return sum + (salaryVal > 0 ? (salaryVal * pctVal) / 100 : 0);
                  }, 0);
                return {
                  name: cat.name,
                  total: indirectCosts + employeeCosts,
                  color: [colors.donut1, colors.donut2, colors.donut3, colors.donut4, colors.donut5][i % 5]
                };
              }).filter(c => c.total > 0);

              const maxTotal = Math.max(...categoryTotals.map(c => c.total), 1);

              return categoryTotals.length === 0 ? (
                <div className="text-center py-4 text-muted-foreground text-sm">Sin datos</div>
              ) : (
                <div className="space-y-3">
                  {categoryTotals.slice(0, 5).map((cat, i) => (
                    <div key={i} className="space-y-1">
                      <div className="flex justify-between text-sm">
                        <span className="truncate">{cat.name}</span>
                        <span className="font-medium">${formatCurrency(cat.total)}</span>
                      </div>
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{ width: `${(cat.total / maxTotal) * 100}%`, backgroundColor: cat.color }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              );
            })()}
          </CardContent>
        </Card>

        {/* Distribución por tipo de costo */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Shuffle className="w-4 h-4" style={{ color: colors.chart2 }} />
              Por Tipo de Costo
            </CardTitle>
            <CardDescription>Costos agrupados por tipo</CardDescription>
          </CardHeader>
          <CardContent>
            {(() => {
              // Calculate costs per type from real data
              const typeTotals = Object.entries(groupedCosts).map(([type, costs], i) => ({
                name: type,
                total: costs.reduce((sum, c) => {
                  const costVal = Number(c.totalCost) || 0;
                  const pctVal = Number(c.percentage) || 0;
                  return sum + (costVal > 0 ? (costVal * pctVal) / 100 : 0);
                }, 0),
                percent: costs.reduce((sum, c) => sum + (Number(c.percentage) || 0), 0),
                count: costs.length,
                color: [colors.donut1, colors.donut2, colors.donut3, colors.donut4, colors.donut5][i % 5]
              })).filter(t => t.total > 0);

              const maxTotal = Math.max(...typeTotals.map(t => t.total), 1);

              return typeTotals.length === 0 ? (
                <div className="text-center py-4 text-muted-foreground text-sm">Sin datos</div>
              ) : (
                <div className="space-y-3">
                  {typeTotals.slice(0, 5).map((type, i) => (
                    <div key={i} className="flex items-center gap-3">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: type.color }} />
                      <div className="flex-1">
                        <div className="flex justify-between text-sm">
                          <span className="truncate">{type.name}</span>
                          <span className="font-medium">${formatCurrency(type.total)}</span>
                        </div>
                        <div className="h-1.5 bg-muted rounded-full mt-1 overflow-hidden">
                          <div
                            className="h-full rounded-full"
                            style={{ width: `${(type.total / maxTotal) * 100}%`, backgroundColor: type.color }}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              );
            })()}
          </CardContent>
        </Card>

        {/* Resumen de Validación */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4" style={{ color: colors.kpiPositive }} />
              Estado de Validación
            </CardTitle>
            <CardDescription>Verificación de distribuciones</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {/* Summary */}
              <div className="p-3 rounded-lg border-2 text-center" style={{
                borderColor: validationWarnings.length === 0 ? colors.kpiPositive : colors.progressWarning,
                backgroundColor: validationWarnings.length === 0 ? colors.kpiPositive + '10' : colors.progressWarning + '10'
              }}>
                <p className="text-xs text-muted-foreground">Estado General</p>
                <p className="font-bold" style={{
                  color: validationWarnings.length === 0 ? colors.kpiPositive : colors.progressWarning
                }}>
                  {validationWarnings.length === 0 ? 'Todo Correcto' : `${validationWarnings.length} Advertencias`}
                </p>
              </div>

              {/* Details */}
              <div className="space-y-2">
                <div className="flex items-center justify-between p-2 rounded-md bg-muted/30">
                  <span className="text-sm">Tipos con 100%</span>
                  <Badge style={{ backgroundColor: colors.kpiPositive, color: 'white' }}>
                    {Object.keys(groupedCosts).length - validationWarnings.length}
                  </Badge>
                </div>
                <div className="flex items-center justify-between p-2 rounded-md bg-muted/30">
                  <span className="text-sm">Tipos incompletos</span>
                  <Badge variant={validationWarnings.length > 0 ? 'destructive' : 'secondary'}>
                    {validationWarnings.length}
                  </Badge>
                </div>
                <div className="flex items-center justify-between p-2 rounded-md bg-muted/30">
                  <span className="text-sm">Categorías destino</span>
                  <Badge variant="outline">{productCategories.length}</Badge>
                </div>
              </div>

              {/* Tip */}
              {validationWarnings.length > 0 && (
                <div className="p-2 rounded-md text-xs" style={{ backgroundColor: colors.progressWarning + '20', color: colors.progressWarning }}>
                  <strong>Tip:</strong> Cada tipo de costo debe sumar 100% entre todas las categorías destino.
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Distribución de Empleados */}
          <Card className="border-t-4" style={{ borderTopColor: colors.chart4 }}>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Users className="w-4 h-4" style={{ color: colors.chart4 }} />
                    Distribución de Empleados por Categoría
                  </CardTitle>
                  <CardDescription>Asignación de costos laborales a categorías de producto</CardDescription>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setExpandedEmployeeGroups(new Set(Object.keys(groupedEmployees)))}
                  >
                    Expandir todos
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setExpandedEmployeeGroups(new Set())}
                  >
                    Colapsar todos
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <RefreshCw className="w-5 h-5 animate-spin text-muted-foreground" />
                  <span className="ml-2 text-sm text-muted-foreground">Cargando distribuciones...</span>
                </div>
              ) : Object.keys(groupedEmployees).length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Users className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p>No hay distribuciones de empleados configuradas</p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-3"
                    onClick={() => setShowEmployeeMatrixDialog(true)}
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    Configurar distribución
                  </Button>
                </div>
              ) : (
                <div className="space-y-2">
                  {Object.entries(groupedEmployees).map(([category, empDistributions], groupIndex) => {
                    const isExpanded = expandedEmployeeGroups.has(category);
                    const totalPercent = empDistributions.reduce((sum, e) => sum + (Number(e.percentage) || 0), 0);
                    const totalAmount = empDistributions.reduce((sum, e) => {
                      const salaryVal = Number(e.totalSalary) || 0;
                      const pctVal = Number(e.percentage) || 0;
                      const amount = salaryVal > 0 ? (salaryVal * pctVal) / 100 : 0;
                      return sum + amount;
                    }, 0);
                    const groupColor = [colors.chart1, colors.chart2, colors.chart3, colors.chart4, colors.chart5][groupIndex % 5];

                    return (
                      <Collapsible key={category} open={isExpanded} onOpenChange={() => toggleEmployeeGroup(category)}>
                        <CollapsibleTrigger className="w-full">
                          <div
                            className="flex items-center justify-between p-3 rounded-lg border hover:shadow-sm transition-all"
                            style={{ borderLeftWidth: '4px', borderLeftColor: groupColor }}
                          >
                            <div className="flex items-center gap-3">
                              {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                              <span className="font-medium">{category}</span>
                              <Badge variant="outline" className="text-xs">
                                {empDistributions.length} {empDistributions.length === 1 ? 'empleado' : 'empleados'}
                              </Badge>
                            </div>
                            <div className="flex items-center gap-3">
                              <span className="text-sm font-medium">${formatCurrency(totalAmount)}</span>
                              <Badge
                                variant="default"
                                className="text-xs"
                                style={{ backgroundColor: groupColor, color: 'white' }}
                              >
                                {totalPercent.toFixed(1)}%
                              </Badge>
                            </div>
                          </div>
                        </CollapsibleTrigger>
                        <CollapsibleContent>
                          <div className="ml-6 mt-2 space-y-2">
                            {empDistributions.map((emp, i) => {
                              const salaryVal = Number(emp.totalSalary) || 0;
                              const pctVal = Number(emp.percentage) || 0;
                              const amount = salaryVal > 0 ? (salaryVal * pctVal) / 100 : 0;
                              return (
                                <div
                                  key={emp.id || i}
                                  className="flex items-center justify-between p-2 rounded-md bg-muted/30 text-sm"
                                >
                                  <div className="flex items-center gap-2">
                                    <Users className="w-3 h-3 text-muted-foreground" />
                                    <span>{emp.employeeName || 'Empleado sin nombre'}</span>
                                    {emp.role && (
                                      <Badge variant="secondary" className="text-[10px]">{emp.role}</Badge>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-3">
                                    <span className="text-muted-foreground">{pctVal}%</span>
                                    <span className="font-medium">${formatCurrency(amount)}</span>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </CollapsibleContent>
                      </Collapsible>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}

      {/* Matriz de Distribución de Costos - Component has its own Dialog */}
      <CostDistributionMatrix
        isOpen={showMatrixDialog}
        month={month}
        onClose={() => {
          setShowMatrixDialog(false);
          fetchData();
        }}
        onSave={(distributions) => {
          setShowMatrixDialog(false);
          fetchData();
        }}
      />

      {/* Matriz de Distribución de Empleados - Component has its own Dialog */}
      <EmployeeCostDistributionMatrix
        isOpen={showEmployeeMatrixDialog}
        onClose={() => {
          setShowEmployeeMatrixDialog(false);
          fetchData();
        }}
        onSave={(distributions) => {
          setShowEmployeeMatrixDialog(false);
          fetchData();
        }}
      />
    </div>
  );
}

function CalculadoraSection({ colors, month: initialMonth }: { colors: UserColorPreferences; month: string }) {
  const { currentCompany } = useCompany();

  // State for month navigation
  const [selectedMonth, setSelectedMonth] = useState(initialMonth);

  // Estado real del consolidador
  const [calcData, setCalcData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Parámetros de simulación en browser (no requieren API call)
  const [targetMargin, setTargetMargin] = useState(30); // margen objetivo %
  const [mpVariation, setMpVariation] = useState(0);    // variación MP %
  const [volVariation, setVolVariation] = useState(0);  // variación volumen %
  const [precioVariation, setPrecioVariation] = useState(0); // variación precio venta %

  // Fetch datos reales del consolidador
  useEffect(() => {
    if (!currentCompany?.id) return;
    setLoading(true);
    fetch(`/api/costos/v2/calculator?month=${selectedMonth}`)
      .then((r) => r.ok ? r.json() : null)
      .then((d) => setCalcData(d))
      .catch(() => setCalcData(null))
      .finally(() => setLoading(false));
  }, [currentCompany?.id, selectedMonth]);

  // Month navigation functions
  const navigateMonth = (direction: 'prev' | 'next') => {
    const [year, month] = selectedMonth.split('-').map(Number);
    let newMonth = month + (direction === 'next' ? 1 : -1);
    let newYear = year;

    if (newMonth > 12) {
      newMonth = 1;
      newYear++;
    } else if (newMonth < 1) {
      newMonth = 12;
      newYear--;
    }

    setSelectedMonth(`${newYear}-${String(newMonth).padStart(2, '0')}`);
  };

  const formatMonthDisplay = (monthStr: string) => {
    const [year, month] = monthStr.split('-').map(Number);
    const monthNames = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    return `${monthNames[month - 1]} ${year}`;
  };

  const canNavigatePrev = useMemo(() => {
    const [year, month] = selectedMonth.split('-').map(Number);
    return year > 2020 || (year === 2020 && month > 1);
  }, [selectedMonth]);

  const canNavigateNext = useMemo(() => {
    const now = new Date();
    const [year, month] = selectedMonth.split('-').map(Number);
    return year < now.getFullYear() || (year === now.getFullYear() && month < now.getMonth() + 1);
  }, [selectedMonth]);

  // Check if current month has data (basado en datos reales)
  const hasDataForMonth = useMemo(() => {
    return calcData?.products && calcData.products.length > 0;
  }, [calcData]);

  // Datos derivados del consolidador
  const products: any[] = calcData?.products ?? [];
  const totals = calcData?.totals ?? null;

  // Componente Donut Chart simple
  const DonutChartSimple = ({
    data,
    size = 140,
    centerLabel,
    centerSubLabel
  }: {
    data: { value: number; color: string }[];
    size?: number;
    centerLabel?: string;
    centerSubLabel?: string;
  }) => {
    const total = data.reduce((sum, item) => sum + item.value, 0);
    let cumulativePercent = 0;

    const getCoordinatesForPercent = (percent: number) => {
      const x = Math.cos(2 * Math.PI * percent);
      const y = Math.sin(2 * Math.PI * percent);
      return [x, y];
    };

    const paths = data.map((item, i) => {
      const startPercent = cumulativePercent;
      const slicePercent = item.value / total;
      cumulativePercent += slicePercent;

      const [startX, startY] = getCoordinatesForPercent(startPercent);
      const [endX, endY] = getCoordinatesForPercent(cumulativePercent);
      const largeArcFlag = slicePercent > 0.5 ? 1 : 0;

      const pathD = [
        `M ${startX * 40} ${startY * 40}`,
        `A 40 40 0 ${largeArcFlag} 1 ${endX * 40} ${endY * 40}`,
        `L ${endX * 28} ${endY * 28}`,
        `A 28 28 0 ${largeArcFlag} 0 ${startX * 28} ${startY * 28}`,
        'Z'
      ].join(' ');

      return (
        <path
          key={i}
          d={pathD}
          fill={item.color}
          className="transition-all duration-300 hover:opacity-80"
        />
      );
    });

    return (
      <svg width={size} height={size} viewBox="-50 -50 100 100">
        {paths}
        <circle cx="0" cy="0" r="20" fill="white" />
        {centerLabel && (
          <text x="0" y={centerSubLabel ? "-4" : "4"} textAnchor="middle" className="text-xs font-bold fill-gray-700">
            {centerLabel}
          </text>
        )}
        {centerSubLabel && (
          <text x="0" y="8" textAnchor="middle" className="text-[10px] fill-gray-500">
            {centerSubLabel}
          </text>
        )}
      </svg>
    );
  };

  // Datos reales derivados del consolidador
  const avgCostPerUnit = totals?.avgCostPerUnit ?? 0;
  const avgMarginPct = totals?.avgMarginPercent ?? 0;
  const totalRevenue = totals?.totalRevenue ?? 0;
  const totalCostTotal = totals?.totalCostTotal ?? 0;

  // Punto de equilibrio: costos fijos / (precio - costo variable por unidad)
  // Aproximación: costIndirect total / (avgSalePrice - avgCostPerUnit)
  const avgSalePrice = totals?.avgSalePrice ?? 0;
  const breakEven = useMemo(() => {
    const fixedCosts = totals?.totalCostIndirect ?? 0;
    const contribution = avgSalePrice - (totals?.avgCostPerUnit ?? 0) + (totals?.totalCostIndirect ?? 0) / Math.max(totals?.totalUnitsProduced ?? 1, 1);
    if (contribution <= 0) return 0;
    return Math.round(fixedCosts / contribution);
  }, [totals, avgSalePrice]);

  // Componentes de costo reales
  const componentesCosto = useMemo(() => {
    if (!totals) return [];
    const mat = totals.totalCostMaterials;
    const ind = totals.totalCostIndirect;
    const total = mat + ind;
    if (total === 0) return [];
    return [
      { nombre: 'Materia Prima', porcentaje: total > 0 ? (mat / total) * 100 : 0, valor: mat },
      { nombre: 'Costos Indirectos', porcentaje: total > 0 ? (ind / total) * 100 : 0, valor: ind },
    ];
  }, [totals]);

  // Simulaciones "Qué pasa si..." calculadas en browser sobre datos reales
  const simulaciones = useMemo(() => {
    if (!totals || avgCostPerUnit === 0) return [];
    const matPct = totals.totalCostMaterials / Math.max(totalCostTotal, 1);
    const totalUnits = totals.totalUnitsProduced;

    // Escenario 1: MP varía X%
    const newCostMP = avgCostPerUnit * (1 + (matPct * mpVariation) / 100);
    const newMarginMP = avgSalePrice > 0 ? ((avgSalePrice * (1 + precioVariation / 100) - newCostMP) / (avgSalePrice * (1 + precioVariation / 100))) * 100 : 0;
    const impMP = newMarginMP < avgMarginPct ? 'negativo' : newMarginMP > avgMarginPct ? 'positivo' : 'neutro';

    // Escenario 2: Volumen varía X% (los fijos se diluyen)
    const newTotalUnits = totalUnits * (1 + volVariation / 100);
    const newCostVol = newTotalUnits > 0
      ? (totals.totalCostMaterials + totals.totalCostIndirect) / newTotalUnits
      : avgCostPerUnit;
    const newMarginVol = avgSalePrice > 0 ? ((avgSalePrice - newCostVol) / avgSalePrice) * 100 : 0;
    const impVol = newMarginVol > avgMarginPct ? 'positivo' : newMarginVol < avgMarginPct ? 'negativo' : 'neutro';

    // Escenario 3: Precio de venta varía X%
    const newPrice = avgSalePrice * (1 + precioVariation / 100);
    const newMarginPrecio = newPrice > 0 ? ((newPrice - avgCostPerUnit) / newPrice) * 100 : 0;
    const impPrecio = newMarginPrecio > avgMarginPct ? 'positivo' : newMarginPrecio < avgMarginPct ? 'negativo' : 'neutro';

    return [
      { escenario: `MP ${mpVariation >= 0 ? '+' : ''}${mpVariation}%`, costoUnit: newCostMP, margen: newMarginMP, impacto: impMP },
      { escenario: `Volumen ${volVariation >= 0 ? '+' : ''}${volVariation}%`, costoUnit: newCostVol, margen: newMarginVol, impacto: impVol },
      { escenario: `Precio ${precioVariation >= 0 ? '+' : ''}${precioVariation}%`, costoUnit: avgCostPerUnit, margen: newMarginPrecio, impacto: impPrecio },
    ];
  }, [totals, avgCostPerUnit, avgSalePrice, avgMarginPct, totalCostTotal, mpVariation, volVariation, precioVariation]);

  return (
    <div className="space-y-6">
      {/* Header con navegación de mes e indicador de método */}
      <Card style={{ borderColor: colors.chart2 + '40', backgroundColor: colors.chart2 + '08' }}>
        <CardContent className="py-4">
          <div className="flex items-center justify-between">
            {/* Month Navigation */}
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => navigateMonth('prev')}
                  disabled={!canNavigatePrev}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>

                <div className="flex items-center gap-2 px-3 py-1.5 rounded-md border bg-background min-w-[120px] justify-center">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">{formatMonthDisplay(selectedMonth)}</span>
                </div>

                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => navigateMonth('next')}
                  disabled={!canNavigateNext}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>

              {/* Data availability indicator */}
              {hasDataForMonth ? (
                <Badge style={{ backgroundColor: colors.kpiPositive, color: 'white' }}>
                  <CheckCircle2 className="w-3 h-3 mr-1" />
                  Datos disponibles
                </Badge>
              ) : (
                <Badge variant="secondary">
                  <AlertCircle className="w-3 h-3 mr-1" />
                  Sin producción registrada
                </Badge>
              )}
            </div>

            {/* Indicador de fuente de datos */}
            <div className="flex items-center gap-3">
              <span className="text-sm text-muted-foreground">Fuentes:</span>
              <Badge
                variant="outline"
                className="gap-1.5"
                style={{ borderColor: colors.chart4, color: colors.chart4, backgroundColor: colors.chart4 + '10' }}
              >
                <Factory className="w-3.5 h-3.5" />
                Producción + Indirectos + Ventas
              </Badge>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger>
                    <Info className="w-4 h-4 text-muted-foreground cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs">
                    <p className="text-sm">
                      Los costos se calculan con datos reales:<br />
                      <strong>Materiales:</strong> Consumo de insumos según recetas × precio PPP<br />
                      <strong>Indirectos:</strong> Facturas marcadas como indirecto, distribuidas por categoría de producto según los % configurados
                    </p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* KPIs reales */}
      {loading ? (
        <div className="grid grid-cols-4 gap-4">
          {[0, 1, 2, 3].map((i) => (
            <Card key={i} className="border-l-4 animate-pulse" style={{ borderLeftColor: [colors.chart1, colors.chart2, colors.chart4, colors.kpiPositive][i] }}>
              <CardContent className="p-4">
                <div className="h-4 bg-muted rounded mb-2 w-3/4" />
                <div className="h-8 bg-muted rounded w-1/2" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-4 gap-4">
          <Card className="border-l-4" style={{ borderLeftColor: colors.chart1 }}>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground mb-1">Costo Prom/Unidad</p>
              <p className="text-2xl font-bold">${(avgCostPerUnit).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
              <p className="text-xs text-muted-foreground mt-1">Materiales + Indirectos</p>
            </CardContent>
          </Card>
          <Card className="border-l-4" style={{ borderLeftColor: colors.chart2 }}>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground mb-1">Margen Bruto Prom.</p>
              <p className="text-2xl font-bold" style={{ color: avgMarginPct >= targetMargin ? colors.kpiPositive : colors.kpiNegative }}>
                {formatPercent(avgMarginPct)}
              </p>
              <p className="text-xs text-muted-foreground mt-1">Umbral: {targetMargin}%</p>
            </CardContent>
          </Card>
          <Card className="border-l-4" style={{ borderLeftColor: colors.chart4 }}>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground mb-1">Punto de Equilibrio</p>
              <p className="text-2xl font-bold">{formatCurrency(breakEven)} u</p>
              <p className="text-xs text-muted-foreground mt-1">Indirectos / (precio − costo var.)</p>
            </CardContent>
          </Card>
          <Card className="border-l-4" style={{ borderLeftColor: colors.kpiPositive }}>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground mb-1">Ingresos del Período</p>
              <p className="text-2xl font-bold">${formatCurrency(totalRevenue)}</p>
              <p className="text-xs text-muted-foreground mt-1">Margen: ${formatCurrency(totalRevenue - totalCostTotal)}</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Sección principal */}
      <div className="grid grid-cols-3 gap-6">
        {/* Composición del costo real */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <PieChart className="w-4 h-4" style={{ color: colors.chart2 }} />
              Composición del Costo
            </CardTitle>
            <CardDescription>Desglose por componente — {formatMonthDisplay(selectedMonth)}</CardDescription>
          </CardHeader>
          <CardContent>
            {componentesCosto.length > 0 ? (
              <>
                <div className="flex justify-center mb-4">
                  <DonutChartSimple
                    data={componentesCosto.map((c, i) => ({
                      value: c.porcentaje,
                      color: [colors.donut1, colors.donut2][i]
                    }))}
                    size={140}
                    centerLabel={`$${formatCurrency(totalCostTotal / 1000)}K`}
                    centerSubLabel="Total"
                  />
                </div>
                <div className="space-y-2">
                  {componentesCosto.map((comp, i) => (
                    <div key={i} className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: [colors.donut1, colors.donut2][i] }} />
                        <span>{comp.nombre}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">${formatCurrency(comp.valor)}</span>
                        <span className="text-xs text-muted-foreground">{formatPercent(comp.porcentaje)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-8">Sin datos de costo para este período</p>
            )}
          </CardContent>
        </Card>

        {/* Simulador interactivo */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Beaker className="w-4 h-4" style={{ color: colors.chart4 }} />
              ¿Qué pasa si...?
            </CardTitle>
            <CardDescription>Ajustá las variables y el impacto se calcula solo</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="p-3 rounded-lg border" style={{ borderColor: colors.kpiNeutral + '80' }}>
                <p className="text-xs text-muted-foreground mb-1">Costo Unitario Base (real)</p>
                <p className="text-2xl font-bold">${(avgCostPerUnit).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
              </div>

              {/* Inputs de variación */}
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <label className="text-xs text-muted-foreground w-24">MP varía:</label>
                  <Input
                    type="number"
                    value={mpVariation}
                    onChange={(e) => setMpVariation(Number(e.target.value))}
                    className="h-7 text-sm w-20 text-right"
                  />
                  <span className="text-xs text-muted-foreground">%</span>
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-xs text-muted-foreground w-24">Volumen:</label>
                  <Input
                    type="number"
                    value={volVariation}
                    onChange={(e) => setVolVariation(Number(e.target.value))}
                    className="h-7 text-sm w-20 text-right"
                  />
                  <span className="text-xs text-muted-foreground">%</span>
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-xs text-muted-foreground w-24">Precio venta:</label>
                  <Input
                    type="number"
                    value={precioVariation}
                    onChange={(e) => setPrecioVariation(Number(e.target.value))}
                    className="h-7 text-sm w-20 text-right"
                  />
                  <span className="text-xs text-muted-foreground">%</span>
                </div>
              </div>

              <Separator />

              <div className="space-y-2">
                {simulaciones.map((sim, i) => (
                  <div key={i} className="flex items-center justify-between p-2 rounded-lg bg-muted/30">
                    <div>
                      <p className="text-xs font-medium">{sim.escenario}</p>
                      <p className="text-[10px] text-muted-foreground">Costo: ${sim.costoUnit.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold">{formatPercent(sim.margen)}</p>
                      <Badge
                        variant="outline"
                        className="text-[10px]"
                        style={{
                          color: sim.impacto === 'positivo' ? colors.kpiPositive : sim.impacto === 'negativo' ? colors.kpiNegative : colors.kpiNeutral,
                          borderColor: sim.impacto === 'positivo' ? colors.kpiPositive : sim.impacto === 'negativo' ? colors.kpiNegative : colors.kpiNeutral,
                        }}
                      >
                        {sim.impacto === 'positivo' ? '↑' : sim.impacto === 'negativo' ? '↓' : '→'} {sim.impacto}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Precio sugerido por producto */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Target className="w-4 h-4" style={{ color: colors.chart1 }} />
              Precio Sugerido
            </CardTitle>
            <CardDescription className="flex items-center gap-2">
              Margen objetivo:
              <div className="flex items-center gap-1">
                <Input
                  type="number"
                  value={targetMargin}
                  onChange={(e) => setTargetMargin(Number(e.target.value))}
                  className="h-6 w-16 text-xs text-right"
                  min={0}
                  max={100}
                />
                <span className="text-xs">%</span>
              </div>
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-2">
            {products.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">Sin datos de producción</p>
            ) : (
              <div className="space-y-2">
                {products.map((p: any) => {
                  // precioSugerido = costPerUnit / (1 - targetMargin/100)
                  const sugerido = targetMargin < 100 && p.costPerUnit > 0
                    ? p.costPerUnit / (1 - targetMargin / 100)
                    : 0;
                  const current = p.revenuePriceAvg;
                  const diff = sugerido > 0 && current > 0 ? ((sugerido - current) / current) * 100 : null;
                  return (
                    <div key={p.productId} className="text-xs border rounded p-2 space-y-1">
                      <p className="font-medium truncate" title={p.productName}>{p.productName}</p>
                      <div className="flex justify-between text-muted-foreground">
                        <span>Costo/UN: <span className="text-foreground font-medium">${p.costPerUnit.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span></span>
                        <span>Actual: <span className="text-foreground">${current > 0 ? current.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '—'}</span></span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-muted-foreground">Sugerido con {targetMargin}%:</span>
                        <span className="font-bold" style={{ color: sugerido > 0 ? colors.chart1 : colors.kpiNeutral }}>
                          {sugerido > 0 ? `$${sugerido.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '—'}
                          {diff !== null && (
                            <span className="ml-1 text-[10px]" style={{ color: diff > 0 ? colors.kpiNegative : colors.kpiPositive }}>
                              ({diff > 0 ? '+' : ''}{diff.toFixed(1)}%)
                            </span>
                          )}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Tabla por producto — costos y márgenes reales */}
      {products.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Scale className="w-4 h-4" style={{ color: colors.chart3 }} />
              Detalle por Producto — {formatMonthDisplay(selectedMonth)}
            </CardTitle>
            <CardDescription>Costo de materiales + indirectos distribuidos vs. precio de venta real</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Producto</TableHead>
                  <TableHead className="text-right">Uds. Prod.</TableHead>
                  <TableHead className="text-right">Mat./UN</TableHead>
                  <TableHead className="text-right">Ind./UN</TableHead>
                  <TableHead className="text-right">Costo/UN</TableHead>
                  <TableHead className="text-right">Precio Venta/UN</TableHead>
                  <TableHead className="text-right">Margen Real</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {products.map((p: any) => {
                  const mColor = !p.hasSales
                    ? colors.kpiNeutral
                    : p.marginPercent >= targetMargin
                      ? colors.kpiPositive
                      : colors.kpiNegative;
                  return (
                    <TableRow key={p.productId}>
                      <TableCell className="font-medium text-sm">{p.productName}</TableCell>
                      <TableCell className="text-right text-sm">{formatCurrency(p.unitsProduced)}</TableCell>
                      <TableCell className="text-right text-sm">${p.costMatPerUnit.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                      <TableCell className="text-right text-sm">${p.costIndPerUnit.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                      <TableCell className="text-right text-sm font-semibold">${p.costPerUnit.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                      <TableCell className="text-right text-sm">
                        {p.hasSales ? `$${p.revenuePriceAvg.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : <span className="text-muted-foreground">—</span>}
                      </TableCell>
                      <TableCell className="text-right font-bold" style={{ color: mColor }}>
                        {p.hasSales ? formatPercent(p.marginPercent) : <span className="text-muted-foreground text-sm font-normal">Sin ventas</span>}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Calculadora Completa V2 */}
      <CalculadoraCompletaV2 colors={colors} selectedMonth={selectedMonth} />
    </div>
  );
}

// Sub-component: Calculadora Completa V2 - TOTALMENTE NUEVO
function CalculadoraCompletaV2({ colors, selectedMonth }: { colors: UserColorPreferences; selectedMonth: string }) {
  const { currentCompany } = useCompany();
  const [activeTab, setActiveTab] = useState<'ventas' | 'produccion' | 'simulacion' | 'analisis'>('ventas');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [expandedProducts, setExpandedProducts] = useState<Set<number>>(new Set());
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [showDetailSheet, setShowDetailSheet] = useState(false);
  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);

  // Simulation state
  const [simParams, setSimParams] = useState({
    mpVariation: 0,      // Materia Prima variation %
    moVariation: 0,      // Mano de Obra variation %
    ciVariation: 0,      // Costos Indirectos variation %
    volumenVariation: 0, // Production volume variation %
    precioVariation: 0,  // Sale price variation %
  });

  // Pretensados Cordoba special simulation (company-specific, enabled by superadmin)
  const [pretensadosAllowed, setPretensadosAllowed] = useState(false); // From CostSystemConfig
  const [pretensadosEnabled, setPretensadosEnabled] = useState(false);
  const [pretensadosParams, setPretensadosParams] = useState({
    // Viguetas: días × bancos × metros útiles por banco (1300m)
    viguetasDias: 22,
    viguetasBancos: 0,
    metrosUtilesPorBanco: 1300,
    // Bloques: días × placas × unidades por placa
    bloquesDias: 22,
    bloquesPlacas: 0,
    unidadesPorPlaca: 240,
    // Adoquines: días × m² por día × unidades por m²
    adoquinesDias: 22,
    adoquinesM2PorDia: 0,
    adoquinesUnidadesPorM2: 39.5, // Holanda default (41.35 for Unistone)
  });

  // Fetch CostSystemConfig to check if pretensados sim is allowed
  useEffect(() => {
    const fetchCostConfig = async () => {
      if (!currentCompany?.id) return;
      try {
        const response = await fetch(`/api/costos/config?companyId=${currentCompany.id}`);
        if (response.ok) {
          const data = await response.json();
          setPretensadosAllowed(data.enablePretensadosSim || false);
        }
      } catch (error) {
        console.error('Error fetching cost config:', error);
      }
    };
    fetchCostConfig();
  }, [currentCompany?.id]);

  // Complete mock data with detailed cost breakdown
  const MOCK_PRODUCTS = [
    {
      id: 1, code: '092', name: 'Adoquin Holanda 6cm', category: 'Adoquines', categoryId: 1,
      cost: 150.35, salePrice: 312.52, soldUnits: 45230, producedUnits: 48000, hasRecipe: true,
      costBreakdown: { mp: 67.66, mo: 37.59, ci: 30.07, packaging: 15.03 },
      recipe: { cement: 0.8, sand: 2.5, gravel: 1.2, water: 0.4, additives: 0.05 },
      history: [148.20, 149.50, 150.35, 151.20, 150.80, 150.35],
      supplier: 'Producción Propia', lastUpdate: '2026-01-10',
      efficiency: 96.5, defectRate: 1.2, avgProductionTime: 0.8
    },
    {
      id: 2, code: '091', name: 'Adoquin Holanda 8cm', category: 'Adoquines', categoryId: 1,
      cost: 179.35, salePrice: 300.76, soldUnits: 38450, producedUnits: 41000, hasRecipe: true,
      costBreakdown: { mp: 80.71, mo: 44.84, ci: 35.87, packaging: 17.93 },
      recipe: { cement: 1.0, sand: 3.0, gravel: 1.5, water: 0.5, additives: 0.06 },
      history: [177.00, 178.20, 179.35, 180.10, 179.80, 179.35],
      supplier: 'Producción Propia', lastUpdate: '2026-01-10',
      efficiency: 95.8, defectRate: 1.5, avgProductionTime: 1.0
    },
    {
      id: 3, code: '093', name: 'Adoquin Unistone 8cm', category: 'Adoquines', categoryId: 1,
      cost: 165.91, salePrice: 287.30, soldUnits: 42100, producedUnits: 44500, hasRecipe: true,
      costBreakdown: { mp: 74.66, mo: 41.48, ci: 33.18, packaging: 16.59 },
      recipe: { cement: 0.9, sand: 2.8, gravel: 1.3, water: 0.45, additives: 0.055 },
      history: [163.50, 164.80, 165.91, 166.50, 166.20, 165.91],
      supplier: 'Producción Propia', lastUpdate: '2026-01-10',
      efficiency: 94.6, defectRate: 1.8, avgProductionTime: 0.9
    },
    {
      id: 4, code: '013', name: 'Bloque LT10', category: 'Bloques', categoryId: 2,
      cost: 260.95, salePrice: 420.74, soldUnits: 125600, producedUnits: 130000, hasRecipe: true,
      costBreakdown: { mp: 117.43, mo: 65.24, ci: 52.19, packaging: 26.09 },
      recipe: { cement: 1.5, sand: 4.0, gravel: 2.0, water: 0.7, additives: 0.08 },
      history: [258.00, 259.50, 260.95, 262.10, 261.50, 260.95],
      supplier: 'Producción Propia', lastUpdate: '2026-01-10',
      efficiency: 97.2, defectRate: 0.8, avgProductionTime: 1.2
    },
    {
      id: 5, code: '014', name: 'Bloque LT13', category: 'Bloques', categoryId: 2,
      cost: 331.37, salePrice: 495.31, soldUnits: 98500, producedUnits: 102000, hasRecipe: true,
      costBreakdown: { mp: 149.12, mo: 82.84, ci: 66.27, packaging: 33.14 },
      recipe: { cement: 1.8, sand: 4.5, gravel: 2.3, water: 0.8, additives: 0.09 },
      history: [328.00, 330.00, 331.37, 333.00, 332.20, 331.37],
      supplier: 'Producción Propia', lastUpdate: '2026-01-10',
      efficiency: 96.8, defectRate: 1.0, avgProductionTime: 1.4
    },
    {
      id: 6, code: '03', name: 'Bloque P10', category: 'Bloques', categoryId: 2,
      cost: 306.39, salePrice: 368.89, soldUnits: 156000, producedUnits: 160000, hasRecipe: true,
      costBreakdown: { mp: 137.87, mo: 76.60, ci: 61.28, packaging: 30.64 },
      recipe: { cement: 1.6, sand: 4.2, gravel: 2.1, water: 0.75, additives: 0.085 },
      history: [303.50, 305.00, 306.39, 308.00, 307.20, 306.39],
      supplier: 'Producción Propia', lastUpdate: '2026-01-10',
      efficiency: 97.5, defectRate: 0.7, avgProductionTime: 1.3
    },
    {
      id: 7, code: '032', name: 'Bloque P13', category: 'Bloques', categoryId: 2,
      cost: 331.40, salePrice: 454.33, soldUnits: 87500, producedUnits: 90000, hasRecipe: true,
      costBreakdown: { mp: 149.13, mo: 82.85, ci: 66.28, packaging: 33.14 },
      recipe: { cement: 1.85, sand: 4.6, gravel: 2.35, water: 0.82, additives: 0.092 },
      history: [328.50, 330.00, 331.40, 333.20, 332.30, 331.40],
      supplier: 'Producción Propia', lastUpdate: '2026-01-10',
      efficiency: 96.7, defectRate: 1.1, avgProductionTime: 1.5
    },
    {
      id: 8, code: '031', name: 'Bloque P20 Portante', category: 'Bloques', categoryId: 2,
      cost: 428.65, salePrice: 605.28, soldUnits: 45200, producedUnits: 48000, hasRecipe: true,
      costBreakdown: { mp: 192.89, mo: 107.16, ci: 85.73, packaging: 42.87 },
      recipe: { cement: 2.2, sand: 5.5, gravel: 2.8, water: 1.0, additives: 0.12 },
      history: [425.00, 427.00, 428.65, 430.50, 429.60, 428.65],
      supplier: 'Producción Propia', lastUpdate: '2026-01-10',
      efficiency: 95.5, defectRate: 1.4, avgProductionTime: 1.8
    },
    {
      id: 9, code: '059', name: 'Bloque P20 Tabique', category: 'Bloques', categoryId: 2,
      cost: 396.91, salePrice: 544.83, soldUnits: 32100, producedUnits: 35000, hasRecipe: true,
      costBreakdown: { mp: 178.61, mo: 99.23, ci: 79.38, packaging: 39.69 },
      recipe: { cement: 2.0, sand: 5.0, gravel: 2.5, water: 0.9, additives: 0.11 },
      history: [394.00, 395.50, 396.91, 398.50, 397.70, 396.91],
      supplier: 'Producción Propia', lastUpdate: '2026-01-10',
      efficiency: 94.8, defectRate: 1.6, avgProductionTime: 1.7
    },
    {
      id: 10, code: '060', name: 'Bloque P20 UFD', category: 'Bloques', categoryId: 2,
      cost: 254.84, salePrice: 737.10, soldUnits: 28500, producedUnits: 30000, hasRecipe: true,
      costBreakdown: { mp: 114.68, mo: 63.71, ci: 50.97, packaging: 25.48 },
      recipe: { cement: 1.4, sand: 3.8, gravel: 1.9, water: 0.65, additives: 0.075 },
      history: [252.00, 253.50, 254.84, 256.20, 255.50, 254.84],
      supplier: 'Producción Propia', lastUpdate: '2026-01-10',
      efficiency: 98.0, defectRate: 0.5, avgProductionTime: 1.1
    },
    {
      id: 11, code: 'V-3M', name: 'Vigueta 3 metros', category: 'Viguetas', categoryId: 3,
      cost: 1850.00, salePrice: 2450.00, soldUnits: 8500, producedUnits: 9000, hasRecipe: true,
      costBreakdown: { mp: 832.50, mo: 462.50, ci: 370.00, packaging: 185.00 },
      recipe: { cement: 8.0, steel: 2.5, sand: 12.0, gravel: 6.0, water: 3.0, additives: 0.3 },
      history: [1820.00, 1835.00, 1850.00, 1865.00, 1858.00, 1850.00],
      supplier: 'Producción Propia', lastUpdate: '2026-01-10',
      efficiency: 94.0, defectRate: 2.0, avgProductionTime: 15.0
    },
    {
      id: 12, code: 'V-4M', name: 'Vigueta 4 metros', category: 'Viguetas', categoryId: 3,
      cost: 2350.00, salePrice: 3100.00, soldUnits: 6200, producedUnits: 6500, hasRecipe: true,
      costBreakdown: { mp: 1057.50, mo: 587.50, ci: 470.00, packaging: 235.00 },
      recipe: { cement: 10.0, steel: 3.2, sand: 15.0, gravel: 7.5, water: 4.0, additives: 0.4 },
      history: [2310.00, 2330.00, 2350.00, 2370.00, 2360.00, 2350.00],
      supplier: 'Producción Propia', lastUpdate: '2026-01-10',
      efficiency: 93.5, defectRate: 2.2, avgProductionTime: 18.0
    },
    {
      id: 13, code: 'V-5M', name: 'Vigueta 5 metros', category: 'Viguetas', categoryId: 3,
      cost: 2850.00, salePrice: 3750.00, soldUnits: 4800, producedUnits: 5000, hasRecipe: true,
      costBreakdown: { mp: 1282.50, mo: 712.50, ci: 570.00, packaging: 285.00 },
      recipe: { cement: 12.0, steel: 4.0, sand: 18.0, gravel: 9.0, water: 5.0, additives: 0.5 },
      history: [2800.00, 2825.00, 2850.00, 2875.00, 2862.00, 2850.00],
      supplier: 'Producción Propia', lastUpdate: '2026-01-10',
      efficiency: 93.0, defectRate: 2.5, avgProductionTime: 22.0
    },
    {
      id: 14, code: 'V-6M', name: 'Vigueta 6 metros', category: 'Viguetas', categoryId: 3,
      cost: 3450.00, salePrice: 4500.00, soldUnits: 3219, producedUnits: 3500, hasRecipe: true,
      costBreakdown: { mp: 1552.50, mo: 862.50, ci: 690.00, packaging: 345.00 },
      recipe: { cement: 14.0, steel: 4.8, sand: 21.0, gravel: 10.5, water: 6.0, additives: 0.6 },
      history: [3390.00, 3420.00, 3450.00, 3480.00, 3465.00, 3450.00],
      supplier: 'Producción Propia', lastUpdate: '2026-01-10',
      efficiency: 92.5, defectRate: 2.8, avgProductionTime: 25.0
    },
    {
      id: 15, code: '017', name: 'Bloque SP20M', category: 'Bloques', categoryId: 2,
      cost: 180.00, salePrice: 0, soldUnits: 0, producedUnits: 500, hasRecipe: false,
      costBreakdown: { mp: 0, mo: 0, ci: 0, packaging: 0 },
      recipe: null,
      history: [180.00, 180.00, 180.00, 180.00, 180.00, 180.00],
      supplier: 'Sin asignar', lastUpdate: '2026-01-05',
      efficiency: 0, defectRate: 0, avgProductionTime: 0
    },
    {
      id: 16, code: '018', name: 'Bloque Test', category: 'Bloques', categoryId: 2,
      cost: 0, salePrice: 350.00, soldUnits: 1200, producedUnits: 1500, hasRecipe: false,
      costBreakdown: { mp: 0, mo: 0, ci: 0, packaging: 0 },
      recipe: null,
      history: [0, 0, 0, 0, 0, 0],
      supplier: 'Sin asignar', lastUpdate: '2026-01-05',
      efficiency: 0, defectRate: 0, avgProductionTime: 0
    },
  ];

  const MOCK_CATEGORIES = [
    { id: 1, name: 'Adoquines' },
    { id: 2, name: 'Bloques' },
    { id: 3, name: 'Viguetas' },
  ];

  // Fetch data or use mock
  useEffect(() => {
    const fetchData = async () => {
      if (!currentCompany?.id) return;
      setLoading(true);

      try {
        const [productsRes, categoriesRes] = await Promise.all([
          fetch(`/api/products?companyId=${currentCompany.id}`).catch(() => null),
          fetch(`/api/productos/categorias?companyId=${currentCompany.id}`).catch(() => null),
        ]);

        let prods: any[] = [];
        let cats: any[] = [];

        if (productsRes?.ok) {
          const data = await productsRes.json();
          prods = Array.isArray(data) ? data : data.products || [];
        }
        if (categoriesRes?.ok) {
          const data = await categoriesRes.json();
          cats = Array.isArray(data) ? data : data.categories || [];
        }

        // Use mock if empty
        setProducts(prods.length > 0 ? prods : MOCK_PRODUCTS);
        setCategories(cats.length > 0 ? cats : MOCK_CATEGORIES);
      } catch {
        setProducts(MOCK_PRODUCTS);
        setCategories(MOCK_CATEGORIES);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [currentCompany?.id]);

  // Calculate KPIs
  const kpis = useMemo(() => {
    const total = products.length;
    const withRecipe = products.filter(p => p.hasRecipe).length;
    const withoutRecipe = total - withRecipe;
    const avgCost = products.reduce((sum, p) => sum + (Number(p.cost) || 0), 0) / (total || 1);
    const totalValue = products.reduce((sum, p) => sum + (Number(p.cost) || 0) * (Number(p.producedUnits) || 0), 0);
    const totalRevenue = products.reduce((sum, p) => sum + (Number(p.salePrice) || 0) * (Number(p.soldUnits) || 0), 0);
    const totalCostSold = products.reduce((sum, p) => sum + (Number(p.cost) || 0) * (Number(p.soldUnits) || 0), 0);
    const avgMargin = totalRevenue > 0 ? ((totalRevenue - totalCostSold) / totalRevenue) * 100 : 0;
    const avgEfficiency = products.filter(p => p.efficiency > 0).reduce((sum, p) => sum + (p.efficiency || 0), 0) / (products.filter(p => p.efficiency > 0).length || 1);
    return { total, withRecipe, withoutRecipe, avgCost, totalValue, totalRevenue, totalCostSold, avgMargin, avgEfficiency };
  }, [products]);

  // Filter products by category
  const filteredProducts = useMemo(() => {
    if (categoryFilter === 'all') return products;
    return products.filter(p => p.categoryId?.toString() === categoryFilter || p.category === categoryFilter);
  }, [products, categoryFilter]);

  // Calculate category summary with full details
  const categorySummary = useMemo(() => {
    return categories.map((cat, idx) => {
      const catProducts = products.filter(p => p.categoryId === cat.id || p.category === cat.name);
      const totalSoldUnits = catProducts.reduce((sum, p) => sum + (Number(p.soldUnits) || 0), 0);
      const totalProducedUnits = catProducts.reduce((sum, p) => sum + (Number(p.producedUnits) || 0), 0);
      const totalCostSold = catProducts.reduce((sum, p) => sum + (Number(p.cost) || 0) * (Number(p.soldUnits) || 0), 0);
      const totalCostProduced = catProducts.reduce((sum, p) => sum + (Number(p.cost) || 0) * (Number(p.producedUnits) || 0), 0);
      const totalRevenue = catProducts.reduce((sum, p) => sum + (Number(p.salePrice) || 0) * (Number(p.soldUnits) || 0), 0);
      const margin = totalRevenue > 0 ? ((totalRevenue - totalCostSold) / totalRevenue) * 100 : 0;
      const productCount = catProducts.length;
      const avgCost = catProducts.reduce((sum, p) => sum + (Number(p.cost) || 0), 0) / (productCount || 1);
      const color = [colors.chart1, colors.chart2, colors.chart3, colors.chart4][idx % 4];
      return { ...cat, totalSoldUnits, totalProducedUnits, totalCostSold, totalCostProduced, totalRevenue, margin, productCount, avgCost, color };
    });
  }, [categories, products, colors]);

  // Simulated products with parameter variations
  const simulatedProducts = useMemo(() => {
    return products.map(p => {
      if (!p.costBreakdown || !p.hasRecipe) return { ...p, simCost: p.cost, simMargin: ((p.salePrice - p.cost) / p.salePrice) * 100 };

      const mpFactor = 1 + (simParams.mpVariation / 100);
      const moFactor = 1 + (simParams.moVariation / 100);
      const ciFactor = 1 + (simParams.ciVariation / 100);
      const volFactor = 1 + (simParams.volumenVariation / 100);
      const priceFactor = 1 + (simParams.precioVariation / 100);

      const simMp = (p.costBreakdown.mp || 0) * mpFactor;
      const simMo = (p.costBreakdown.mo || 0) * moFactor;
      const simCi = (p.costBreakdown.ci || 0) * ciFactor / (volFactor || 1); // CI per unit decreases with volume
      const simPack = p.costBreakdown.packaging || 0;

      const simCost = simMp + simMo + simCi + simPack;
      const simPrice = (p.salePrice || 0) * priceFactor;
      const simMargin = simPrice > 0 ? ((simPrice - simCost) / simPrice) * 100 : 0;
      const simUnits = Math.round((p.producedUnits || 0) * volFactor);

      return {
        ...p,
        simCost,
        simPrice,
        simMargin,
        simUnits,
        simBreakdown: { mp: simMp, mo: simMo, ci: simCi, packaging: simPack },
        costDiff: simCost - p.cost,
        marginDiff: simMargin - (p.salePrice > 0 ? ((p.salePrice - p.cost) / p.salePrice) * 100 : 0),
      };
    });
  }, [products, simParams]);

  // Calculate margin for a product
  const getMargin = (p: any) => {
    if (!p.salePrice || !p.cost || p.salePrice === 0) return null;
    return ((p.salePrice - p.cost) / p.salePrice) * 100;
  };

  // Get status badge for margin
  const getStatusBadge = (margin: number | null) => {
    if (margin === null) return { label: 'Sin datos', color: colors.kpiNeutral, bg: colors.kpiNeutral + '20' };
    if (margin >= 30) return { label: 'Excelente', color: colors.kpiPositive, bg: colors.kpiPositive + '20' };
    if (margin >= 20) return { label: 'Bueno', color: colors.chart2, bg: colors.chart2 + '20' };
    if (margin >= 10) return { label: 'Aceptable', color: colors.progressWarning, bg: colors.progressWarning + '20' };
    if (margin > 0) return { label: 'Bajo', color: colors.chart3, bg: colors.chart3 + '20' };
    return { label: 'Pérdida', color: colors.kpiNegative, bg: colors.kpiNegative + '20' };
  };

  const toggleProductExpand = (id: number) => {
    setExpandedProducts(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const openProductDetail = (product: any) => {
    setSelectedProduct(product);
    setShowDetailSheet(true);
  };

  const formatMonthDisplay = (monthStr: string) => {
    const [year, month] = monthStr.split('-').map(Number);
    const monthNames = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
    return `${monthNames[month - 1]} ${year}`;
  };

  // Reset simulation parameters
  const resetSimulation = () => {
    setSimParams({ mpVariation: 0, moVariation: 0, ciVariation: 0, volumenVariation: 0, precioVariation: 0 });
  };

  // Product Detail Sheet Component
  const ProductDetailSheet = ({ product, isOpen, onClose }: { product: any; isOpen: boolean; onClose: () => void }) => {
    if (!product) return null;
    const margin = getMargin(product);
    const status = getStatusBadge(margin);
    const breakEven = product.cost > 0 && product.salePrice > product.cost
      ? Math.ceil(product.cost / (product.salePrice - product.cost) * 100)
      : null;

    return (
      <Sheet open={isOpen} onOpenChange={onClose}>
        <SheetContent size="xl" className="overflow-y-auto">
          <SheetHeader className="pb-4 border-b">
            <SheetTitle className="flex items-center gap-3">
              <div className="p-2 rounded-lg" style={{ backgroundColor: colors.chart1 + '20' }}>
                <Package className="w-5 h-5" style={{ color: colors.chart1 }} />
              </div>
              <div>
                <span className="text-lg">{product.name}</span>
                <p className="text-sm text-muted-foreground font-normal">{product.code} • {product.category}</p>
              </div>
            </SheetTitle>
          </SheetHeader>

          <div className="py-6 space-y-6">
            {/* Status & Key Metrics */}
            <div className="grid grid-cols-3 gap-3">
              <div className="p-3 rounded-lg border text-center" style={{ borderColor: status.color + '50', backgroundColor: status.bg }}>
                <p className="text-xs text-muted-foreground">Estado</p>
                <p className="font-bold" style={{ color: status.color }}>{status.label}</p>
              </div>
              <div className="p-3 rounded-lg border text-center">
                <p className="text-xs text-muted-foreground">Costo</p>
                <p className="font-bold text-lg">${formatCurrency(product.cost)}</p>
              </div>
              <div className="p-3 rounded-lg border text-center">
                <p className="text-xs text-muted-foreground">Precio Venta</p>
                <p className="font-bold text-lg">${formatCurrency(product.salePrice)}</p>
              </div>
            </div>

            {/* Margin & Break-even */}
            <div className="grid grid-cols-2 gap-3">
              <div className="p-4 rounded-lg" style={{ backgroundColor: colors.chart2 + '10' }}>
                <p className="text-xs text-muted-foreground mb-1">Margen de Ganancia</p>
                <p className="text-2xl font-bold" style={{ color: margin && margin > 0 ? colors.kpiPositive : colors.kpiNegative }}>
                  {margin !== null ? `${margin.toFixed(1)}%` : 'N/A'}
                </p>
                <p className="text-xs text-muted-foreground">
                  Ganancia por unidad: ${formatCurrency((product.salePrice || 0) - (product.cost || 0))}
                </p>
              </div>
              <div className="p-4 rounded-lg" style={{ backgroundColor: colors.chart4 + '10' }}>
                <p className="text-xs text-muted-foreground mb-1">Punto de Equilibrio</p>
                <p className="text-2xl font-bold" style={{ color: colors.chart4 }}>
                  {breakEven !== null ? `${breakEven} u` : 'N/A'}
                </p>
                <p className="text-xs text-muted-foreground">
                  Unidades para cubrir costos fijos
                </p>
              </div>
            </div>

            {/* Cost Breakdown */}
            <div className="space-y-3">
              <h4 className="font-semibold flex items-center gap-2">
                <PieChart className="w-4 h-4" style={{ color: colors.chart3 }} />
                Desglose de Costos
              </h4>
              {product.costBreakdown && Object.values(product.costBreakdown).some((v: any) => v > 0) ? (
                <div className="grid grid-cols-4 gap-2">
                  {[
                    { label: 'Materia Prima', key: 'mp', color: colors.donut1, icon: '📦' },
                    { label: 'Mano de Obra', key: 'mo', color: colors.donut2, icon: '👷' },
                    { label: 'C. Indirectos', key: 'ci', color: colors.donut3, icon: '🏭' },
                    { label: 'Packaging', key: 'packaging', color: colors.donut4, icon: '📋' },
                  ].map(item => {
                    const value = product.costBreakdown?.[item.key] || 0;
                    const pct = product.cost > 0 ? (value / product.cost) * 100 : 0;
                    return (
                      <div key={item.key} className="p-3 rounded-lg border" style={{ borderLeftWidth: '4px', borderLeftColor: item.color }}>
                        <p className="text-[10px] text-muted-foreground">{item.icon} {item.label}</p>
                        <p className="font-bold">${formatCurrency(value)}</p>
                        <p className="text-xs" style={{ color: item.color }}>{pct.toFixed(1)}%</p>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="p-4 rounded-lg border border-dashed text-center text-muted-foreground">
                  <AlertTriangle className="w-6 h-6 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">Sin desglose de costos disponible</p>
                </div>
              )}
            </div>

            {/* Production & Sales Stats */}
            <div className="space-y-3">
              <h4 className="font-semibold flex items-center gap-2">
                <BarChart3 className="w-4 h-4" style={{ color: colors.chart1 }} />
                Estadísticas de Producción y Ventas
              </h4>
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-lg bg-muted/30 space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Unidades Producidas</span>
                    <span className="font-medium">{(product.producedUnits || 0).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Unidades Vendidas</span>
                    <span className="font-medium">{(product.soldUnits || 0).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">En Stock</span>
                    <span className="font-medium">{((product.producedUnits || 0) - (product.soldUnits || 0)).toLocaleString()}</span>
                  </div>
                </div>
                <div className="p-3 rounded-lg bg-muted/30 space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Costo Total Prod.</span>
                    <span className="font-medium">${formatCurrency((product.cost || 0) * (product.producedUnits || 0))}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Ingresos Ventas</span>
                    <span className="font-medium">${formatCurrency((product.salePrice || 0) * (product.soldUnits || 0))}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Ganancia Total</span>
                    <span className="font-medium" style={{ color: colors.kpiPositive }}>
                      ${formatCurrency(((product.salePrice || 0) - (product.cost || 0)) * (product.soldUnits || 0))}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Efficiency Metrics */}
            {product.efficiency > 0 && (
              <div className="space-y-3">
                <h4 className="font-semibold flex items-center gap-2">
                  <Gauge className="w-4 h-4" style={{ color: colors.chart2 }} />
                  Métricas de Eficiencia
                </h4>
                <div className="grid grid-cols-3 gap-3">
                  <div className="p-3 rounded-lg text-center" style={{ backgroundColor: colors.kpiPositive + '10' }}>
                    <p className="text-xs text-muted-foreground">Eficiencia</p>
                    <p className="text-xl font-bold" style={{ color: colors.kpiPositive }}>{product.efficiency}%</p>
                  </div>
                  <div className="p-3 rounded-lg text-center" style={{ backgroundColor: colors.kpiNegative + '10' }}>
                    <p className="text-xs text-muted-foreground">Tasa Defectos</p>
                    <p className="text-xl font-bold" style={{ color: colors.kpiNegative }}>{product.defectRate}%</p>
                  </div>
                  <div className="p-3 rounded-lg text-center" style={{ backgroundColor: colors.chart4 + '10' }}>
                    <p className="text-xs text-muted-foreground">Tiempo Prod.</p>
                    <p className="text-xl font-bold" style={{ color: colors.chart4 }}>{product.avgProductionTime}min</p>
                  </div>
                </div>
              </div>
            )}

            {/* Recipe Info */}
            {product.recipe && (
              <div className="space-y-3">
                <h4 className="font-semibold flex items-center gap-2">
                  <FileText className="w-4 h-4" style={{ color: colors.chart3 }} />
                  Receta / Fórmula
                </h4>
                <div className="p-3 rounded-lg border">
                  <div className="grid grid-cols-3 gap-2 text-sm">
                    {Object.entries(product.recipe).map(([key, value]: [string, any]) => (
                      <div key={key} className="flex justify-between">
                        <span className="text-muted-foreground capitalize">{key}</span>
                        <span className="font-medium">{value} kg</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Cost History */}
            {product.history && product.history.some((v: number) => v > 0) && (
              <div className="space-y-3">
                <h4 className="font-semibold flex items-center gap-2">
                  <Activity className="w-4 h-4" style={{ color: colors.chart1 }} />
                  Historial de Costos (6 meses)
                </h4>
                <div className="p-3 rounded-lg border">
                  <TrendlineChart values={product.history} color="blue" width={500} height={60} />
                  <div className="flex justify-between text-xs text-muted-foreground mt-2">
                    {['Ago', 'Sep', 'Oct', 'Nov', 'Dic', 'Ene'].map((m, i) => <span key={i}>{m}</span>)}
                  </div>
                </div>
              </div>
            )}

            {/* Metadata */}
            <div className="p-3 rounded-lg bg-muted/20 text-xs space-y-1">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Proveedor</span>
                <span>{product.supplier || 'N/A'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Última actualización</span>
                <span>{product.lastUpdate || 'N/A'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Tiene receta</span>
                <span className={product.hasRecipe ? 'text-success' : 'text-destructive'}>
                  {product.hasRecipe ? 'Sí' : 'No'}
                </span>
              </div>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    );
  };

  return (
    <div className="space-y-4">
      {/* Header with tabs */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Calculator className="w-5 h-5" style={{ color: colors.chart2 }} />
          Calculadora de Costos V2
        </h2>
        <div className="flex items-center gap-2 p-1 bg-muted/50 rounded-lg border">
          {[
            { id: 'ventas', label: 'Por Ventas', icon: Receipt },
            { id: 'produccion', label: 'Por Producción', icon: Factory },
            { id: 'simulacion', label: 'Simulación', icon: Beaker },
            { id: 'analisis', label: 'Análisis', icon: TrendingUp },
          ].map(tab => (
            <Button
              key={tab.id}
              variant={activeTab === tab.id ? 'default' : 'ghost'}
              size="sm"
              className="h-8 px-3 gap-1.5"
              onClick={() => setActiveTab(tab.id as any)}
              style={activeTab === tab.id ? { backgroundColor: colors.chart2 } : {}}
            >
              <tab.icon className="w-3.5 h-3.5" />
              {tab.label}
            </Button>
          ))}
        </div>
      </div>

      {/* Global KPIs */}
      <div className="grid grid-cols-6 gap-3">
        {[
          { label: 'Productos', value: kpis.total, sub: `${kpis.withRecipe} con receta`, color: colors.chart1, icon: Package },
          { label: 'Sin Receta', value: kpis.withoutRecipe, sub: 'Requieren config', color: colors.progressWarning, icon: AlertTriangle },
          { label: 'Costo Prom.', value: `$${formatCurrency(kpis.avgCost)}`, sub: 'Por unidad', color: colors.chart2, icon: DollarSign },
          { label: 'Margen Prom.', value: `${kpis.avgMargin.toFixed(1)}%`, sub: 'Global', color: kpis.avgMargin > 20 ? colors.kpiPositive : colors.progressWarning, icon: Percent },
          { label: 'Eficiencia', value: `${kpis.avgEfficiency.toFixed(1)}%`, sub: 'Producción', color: colors.chart4, icon: Gauge },
          { label: 'Valor Inv.', value: `$${formatCurrency(kpis.totalValue)}`, sub: 'Valorizado', color: colors.chart3, icon: BarChart2 },
        ].map((kpi, i) => (
          <Card key={i} className="border-l-4" style={{ borderLeftColor: kpi.color }}>
            <CardContent className="p-3">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-[10px] text-muted-foreground">{kpi.label}</p>
                  <p className="text-lg font-bold">{kpi.value}</p>
                  <p className="text-[10px]" style={{ color: kpi.color }}>{kpi.sub}</p>
                </div>
                <kpi.icon className="w-4 h-4 opacity-50" style={{ color: kpi.color }} />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Main Content based on Tab */}
      {activeTab === 'ventas' || activeTab === 'produccion' ? (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base flex items-center gap-2">
                  {activeTab === 'ventas' ? <Receipt className="w-4 h-4" style={{ color: colors.chart1 }} /> : <Factory className="w-4 h-4" style={{ color: colors.chart4 }} />}
                  Costos por {activeTab === 'ventas' ? 'Ventas' : 'Producción'}
                </CardTitle>
                <CardDescription>
                  Distribución basada en unidades {activeTab === 'ventas' ? 'vendidas' : 'producidas'}
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                  <SelectTrigger className="w-[180px] h-8">
                    <SelectValue placeholder="Todas" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas las categorías</SelectItem>
                    {categories.map(cat => (
                      <SelectItem key={cat.id} value={cat.id.toString()}>{cat.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button variant="outline" size="sm" className="h-8"><Download className="h-3.5 w-3.5" /></Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Category Summary Cards */}
            <div className="grid grid-cols-3 gap-3">
              {categorySummary.map((cat) => {
                const units = activeTab === 'ventas' ? cat.totalSoldUnits : cat.totalProducedUnits;
                const cost = activeTab === 'ventas' ? cat.totalCostSold : cat.totalCostProduced;
                return (
                  <div key={cat.id} className="p-3 rounded-lg border-l-4" style={{ borderLeftColor: cat.color, backgroundColor: cat.color + '08' }}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-semibold" style={{ color: cat.color }}>{cat.name}</span>
                      <Badge variant="outline" className="text-[10px]">{cat.productCount} prod.</Badge>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <p className="text-muted-foreground">Unidades</p>
                        <p className="font-semibold">{units.toLocaleString()}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Costo Total</p>
                        <p className="font-semibold">${formatCurrency(cost)}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Ingresos</p>
                        <p className="font-semibold">${formatCurrency(cat.totalRevenue)}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Margen</p>
                        <p className="font-semibold" style={{ color: cat.margin > 20 ? colors.kpiPositive : colors.progressWarning }}>
                          {cat.margin.toFixed(1)}%
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Products Table */}
            <div className="rounded-lg border overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="text-left p-2 font-medium">Producto</th>
                    <th className="text-right p-2 font-medium">Costo Unit.</th>
                    <th className="text-right p-2 font-medium">Precio Venta</th>
                    <th className="text-right p-2 font-medium">Unidades</th>
                    <th className="text-right p-2 font-medium">Costo Total</th>
                    <th className="text-right p-2 font-medium">Margen</th>
                    <th className="text-center p-2 font-medium">Detalle</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr><td colSpan={7} className="text-center py-8"><RefreshCw className="h-5 w-5 animate-spin mx-auto" /></td></tr>
                  ) : filteredProducts.length === 0 ? (
                    <tr><td colSpan={7} className="text-center py-8 text-muted-foreground">No hay productos</td></tr>
                  ) : (
                    filteredProducts.map(product => {
                      const margin = getMargin(product);
                      const status = getStatusBadge(margin);
                      const units = activeTab === 'ventas' ? product.soldUnits : product.producedUnits;
                      const totalCost = (product.cost || 0) * (units || 0);

                      return (
                        <tr key={product.id} className="border-t hover:bg-muted/30 transition-colors">
                          <td className="p-2">
                            <div className="flex items-center gap-2">
                              <Package className="w-4 h-4" style={{ color: colors.chart1 }} />
                              <div>
                                <p className="font-medium">{product.name}</p>
                                <p className="text-xs text-muted-foreground">{product.code} • {product.category}</p>
                              </div>
                            </div>
                          </td>
                          <td className="text-right p-2 font-medium">${formatCurrency(product.cost)}</td>
                          <td className="text-right p-2">${formatCurrency(product.salePrice)}</td>
                          <td className="text-right p-2">{(units || 0).toLocaleString()}</td>
                          <td className="text-right p-2 font-medium">${formatCurrency(totalCost)}</td>
                          <td className="text-right p-2">
                            <Badge className="text-[10px]" style={{ backgroundColor: status.bg, color: status.color }}>
                              {margin !== null ? `${margin.toFixed(1)}%` : 'N/A'}
                            </Badge>
                          </td>
                          <td className="text-center p-2">
                            <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => openProductDetail(product)}>
                              <Eye className="h-4 w-4" />
                            </Button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      ) : activeTab === 'simulacion' ? (
        /* SIMULATION TAB - What-If Analysis */
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base flex items-center gap-2">
                  <Beaker className="w-4 h-4" style={{ color: colors.chart4 }} />
                  Simulador de Escenarios
                </CardTitle>
                <CardDescription>Analiza el impacto de variaciones en costos y precios</CardDescription>
              </div>
              <Button variant="outline" size="sm" onClick={resetSimulation}>
                <RefreshCw className="w-3.5 h-3.5 mr-1" /> Reiniciar
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Simulation Controls */}
            <div className="grid grid-cols-5 gap-4 p-4 rounded-lg" style={{ backgroundColor: colors.chart4 + '08' }}>
              {[
                { key: 'mpVariation', label: 'Materia Prima', icon: '📦' },
                { key: 'moVariation', label: 'Mano de Obra', icon: '👷' },
                { key: 'ciVariation', label: 'C. Indirectos', icon: '🏭' },
                { key: 'volumenVariation', label: 'Volumen Prod.', icon: '📈' },
                { key: 'precioVariation', label: 'Precio Venta', icon: '💰' },
              ].map(param => (
                <div key={param.key} className="space-y-2">
                  <label className="text-xs font-medium flex items-center gap-1">
                    <span>{param.icon}</span> {param.label}
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="range"
                      min="-30"
                      max="30"
                      step="1"
                      value={(simParams as any)[param.key]}
                      onChange={(e) => setSimParams(prev => ({ ...prev, [param.key]: Number(e.target.value) }))}
                      className="flex-1 h-2 bg-muted rounded-lg appearance-none cursor-pointer"
                    />
                    <Badge
                      variant="outline"
                      className="min-w-[50px] justify-center"
                      style={{
                        color: (simParams as any)[param.key] > 0 ? colors.kpiNegative : (simParams as any)[param.key] < 0 ? colors.kpiPositive : colors.kpiNeutral,
                        borderColor: (simParams as any)[param.key] > 0 ? colors.kpiNegative : (simParams as any)[param.key] < 0 ? colors.kpiPositive : colors.kpiNeutral,
                      }}
                    >
                      {(simParams as any)[param.key] > 0 ? '+' : ''}{(simParams as any)[param.key]}%
                    </Badge>
                  </div>
                </div>
              ))}
            </div>

            {/* Pretensados Cordoba - Special Production Simulation (Only if enabled by superadmin) */}
            {pretensadosAllowed && (
              <div className="p-4 rounded-lg border" style={{ borderColor: colors.chart3 + '40', backgroundColor: colors.chart3 + '08' }}>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Factory className="w-5 h-5" style={{ color: colors.chart3 }} />
                    <div>
                      <h4 className="font-semibold text-sm">Simulación por Producción</h4>
                      <p className="text-xs text-muted-foreground">Calcula unidades según días × bancos/placas/m²</p>
                    </div>
                    <Badge variant="outline" className="text-[10px] ml-2" style={{ borderColor: colors.kpiPositive, color: colors.kpiPositive }}>
                      Habilitado por Admin
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">Activar</span>
                    <button
                      onClick={() => setPretensadosEnabled(!pretensadosEnabled)}
                      className={cn('w-10 h-5 rounded-full transition-colors', pretensadosEnabled ? 'bg-success' : 'bg-muted')}
                    >
                      <div className={cn('w-4 h-4 rounded-full bg-white shadow transition-transform', pretensadosEnabled ? 'translate-x-5' : 'translate-x-0.5')} />
                    </button>
                  </div>
                </div>

                {pretensadosEnabled && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-3 gap-4">
                      {/* Viguetas Section */}
                      <div className="space-y-3 p-3 rounded-lg border" style={{ borderColor: colors.donut1 + '30', backgroundColor: colors.donut1 + '05' }}>
                        <div className="flex items-center gap-2 pb-2 border-b" style={{ borderColor: colors.donut1 + '40' }}>
                          <div className="w-3 h-3 rounded" style={{ backgroundColor: colors.donut1 }} />
                          <span className="font-medium text-sm">Viguetas</span>
                        </div>
                        <p className="text-[10px] text-muted-foreground">días × bancos × {pretensadosParams.metrosUtilesPorBanco}m</p>
                        <div className="grid grid-cols-2 gap-2">
                          <div className="space-y-1">
                            <label className="text-[10px] text-muted-foreground">Días</label>
                            <Input
                              type="number"
                              min="0"
                              max="31"
                              value={pretensadosParams.viguetasDias}
                              onChange={(e) => setPretensadosParams(prev => ({ ...prev, viguetasDias: parseInt(e.target.value) || 0 }))}
                              className="h-8 text-sm"
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[10px] text-muted-foreground">Bancos</label>
                            <Input
                              type="number"
                              min="0"
                              value={pretensadosParams.viguetasBancos}
                              onChange={(e) => setPretensadosParams(prev => ({ ...prev, viguetasBancos: parseInt(e.target.value) || 0 }))}
                              className="h-8 text-sm"
                            />
                          </div>
                        </div>
                        <div className="p-2 rounded bg-card/50">
                          <div className="flex justify-between text-xs">
                            <span className="text-muted-foreground">Total:</span>
                            <span className="font-bold" style={{ color: colors.donut1 }}>
                              {(pretensadosParams.viguetasDias * pretensadosParams.viguetasBancos * pretensadosParams.metrosUtilesPorBanco).toLocaleString()} m
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Bloques Section */}
                      <div className="space-y-3 p-3 rounded-lg border" style={{ borderColor: colors.donut2 + '30', backgroundColor: colors.donut2 + '05' }}>
                        <div className="flex items-center gap-2 pb-2 border-b" style={{ borderColor: colors.donut2 + '40' }}>
                          <div className="w-3 h-3 rounded" style={{ backgroundColor: colors.donut2 }} />
                          <span className="font-medium text-sm">Bloques</span>
                        </div>
                        <p className="text-[10px] text-muted-foreground">días × placas × {pretensadosParams.unidadesPorPlaca}u</p>
                        <div className="grid grid-cols-2 gap-2">
                          <div className="space-y-1">
                            <label className="text-[10px] text-muted-foreground">Días</label>
                            <Input
                              type="number"
                              min="0"
                              max="31"
                              value={pretensadosParams.bloquesDias}
                              onChange={(e) => setPretensadosParams(prev => ({ ...prev, bloquesDias: parseInt(e.target.value) || 0 }))}
                              className="h-8 text-sm"
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[10px] text-muted-foreground">Placas</label>
                            <Input
                              type="number"
                              min="0"
                              value={pretensadosParams.bloquesPlacas}
                              onChange={(e) => setPretensadosParams(prev => ({ ...prev, bloquesPlacas: parseInt(e.target.value) || 0 }))}
                              className="h-8 text-sm"
                            />
                          </div>
                        </div>
                        <div className="p-2 rounded bg-card/50">
                          <div className="flex justify-between text-xs">
                            <span className="text-muted-foreground">Total:</span>
                            <span className="font-bold" style={{ color: colors.donut2 }}>
                              {(pretensadosParams.bloquesDias * pretensadosParams.bloquesPlacas * pretensadosParams.unidadesPorPlaca).toLocaleString()} u
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Adoquines Section */}
                      <div className="space-y-3 p-3 rounded-lg border" style={{ borderColor: colors.donut3 + '30', backgroundColor: colors.donut3 + '05' }}>
                        <div className="flex items-center gap-2 pb-2 border-b" style={{ borderColor: colors.donut3 + '40' }}>
                          <div className="w-3 h-3 rounded" style={{ backgroundColor: colors.donut3 }} />
                          <span className="font-medium text-sm">Adoquines</span>
                        </div>
                        <p className="text-[10px] text-muted-foreground">días × m²/día × {pretensadosParams.adoquinesUnidadesPorM2}u/m²</p>
                        <div className="grid grid-cols-2 gap-2">
                          <div className="space-y-1">
                            <label className="text-[10px] text-muted-foreground">Días</label>
                            <Input
                              type="number"
                              min="0"
                              max="31"
                              value={pretensadosParams.adoquinesDias}
                              onChange={(e) => setPretensadosParams(prev => ({ ...prev, adoquinesDias: parseInt(e.target.value) || 0 }))}
                              className="h-8 text-sm"
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[10px] text-muted-foreground">m²/día</label>
                            <Input
                              type="number"
                              min="0"
                              value={pretensadosParams.adoquinesM2PorDia}
                              onChange={(e) => setPretensadosParams(prev => ({ ...prev, adoquinesM2PorDia: parseFloat(e.target.value) || 0 }))}
                              className="h-8 text-sm"
                            />
                          </div>
                        </div>
                        <div className="p-2 rounded bg-card/50">
                          <div className="flex justify-between text-xs">
                            <span className="text-muted-foreground">Total:</span>
                            <span className="font-bold" style={{ color: colors.donut3 }}>
                              {Math.round(pretensadosParams.adoquinesDias * pretensadosParams.adoquinesM2PorDia * pretensadosParams.adoquinesUnidadesPorM2).toLocaleString()} u
                            </span>
                          </div>
                          <div className="flex justify-between text-[10px] mt-1">
                            <span className="text-muted-foreground">m² totales:</span>
                            <span>{(pretensadosParams.adoquinesDias * pretensadosParams.adoquinesM2PorDia).toLocaleString()} m²</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Confirm Button */}
                    <div className="flex items-center justify-between pt-3 border-t">
                      <div className="text-xs text-muted-foreground">
                        <span className="font-medium">Resumen:</span>{' '}
                        Viguetas: {(pretensadosParams.viguetasDias * pretensadosParams.viguetasBancos * pretensadosParams.metrosUtilesPorBanco).toLocaleString()}m |{' '}
                        Bloques: {(pretensadosParams.bloquesDias * pretensadosParams.bloquesPlacas * pretensadosParams.unidadesPorPlaca).toLocaleString()}u |{' '}
                        Adoquines: {Math.round(pretensadosParams.adoquinesDias * pretensadosParams.adoquinesM2PorDia * pretensadosParams.adoquinesUnidadesPorM2).toLocaleString()}u
                      </div>
                      <Button
                        size="sm"
                        onClick={() => {
                          // TODO: Apply calculated quantities to products
                          toast.success(`Cantidades confirmadas: Viguetas: ${(pretensadosParams.viguetasDias * pretensadosParams.viguetasBancos * pretensadosParams.metrosUtilesPorBanco).toLocaleString()} metros, Bloques: ${(pretensadosParams.bloquesDias * pretensadosParams.bloquesPlacas * pretensadosParams.unidadesPorPlaca).toLocaleString()} unidades, Adoquines: ${Math.round(pretensadosParams.adoquinesDias * pretensadosParams.adoquinesM2PorDia * pretensadosParams.adoquinesUnidadesPorM2).toLocaleString()} unidades`);
                        }}
                        style={{ backgroundColor: colors.kpiPositive }}
                      >
                        <CheckCircle2 className="w-4 h-4 mr-1" />
                        Confirmar Cantidades
                      </Button>
                    </div>
                  </div>
                )}

                {!pretensadosEnabled && (
                  <p className="text-xs text-muted-foreground text-center py-2">
                    Active esta opción para simular producción según configuración de planta
                  </p>
                )}
              </div>
            )}

            {/* Simulation Results Summary */}
            <div className="grid grid-cols-4 gap-3">
              {(() => {
                const totalOrigCost = products.reduce((s, p) => s + (p.cost || 0) * (p.producedUnits || 0), 0);
                const totalSimCost = simulatedProducts.reduce((s, p) => s + (p.simCost || p.cost || 0) * (p.simUnits || p.producedUnits || 0), 0);
                const costDiff = totalSimCost - totalOrigCost;
                const avgOrigMargin = kpis.avgMargin;
                const avgSimMargin = simulatedProducts.filter(p => p.simMargin != null).reduce((s, p) => s + (p.simMargin || 0), 0) / (simulatedProducts.filter(p => p.simMargin != null).length || 1);
                const marginDiff = avgSimMargin - avgOrigMargin;
                return [
                  { label: 'Costo Original', value: `$${formatCurrency(totalOrigCost)}`, color: colors.chart1 },
                  { label: 'Costo Simulado', value: `$${formatCurrency(totalSimCost)}`, color: colors.chart4, diff: costDiff },
                  { label: 'Margen Original', value: `${avgOrigMargin.toFixed(1)}%`, color: colors.chart2 },
                  { label: 'Margen Simulado', value: `${avgSimMargin.toFixed(1)}%`, color: colors.chart3, diff: marginDiff },
                ].map((item, i) => (
                  <Card key={i} className="border-l-4" style={{ borderLeftColor: item.color }}>
                    <CardContent className="p-3">
                      <p className="text-[10px] text-muted-foreground">{item.label}</p>
                      <p className="text-lg font-bold">{item.value}</p>
                      {item.diff !== undefined && (
                        <p className="text-xs" style={{ color: item.diff > 0 && i < 2 ? colors.kpiNegative : item.diff < 0 && i < 2 ? colors.kpiPositive : item.diff > 0 ? colors.kpiPositive : colors.kpiNegative }}>
                          {item.diff > 0 ? '+' : ''}{i < 2 ? `$${formatCurrency(item.diff)}` : `${item.diff.toFixed(1)}%`}
                        </p>
                      )}
                    </CardContent>
                  </Card>
                ));
              })()}
            </div>

            {/* Simulated Products Table */}
            <div className="rounded-lg border overflow-hidden max-h-[400px] overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 sticky top-0">
                  <tr>
                    <th className="text-left p-2 font-medium">Producto</th>
                    <th className="text-right p-2 font-medium">Costo Actual</th>
                    <th className="text-right p-2 font-medium">Costo Simulado</th>
                    <th className="text-right p-2 font-medium">Diferencia</th>
                    <th className="text-right p-2 font-medium">Margen Actual</th>
                    <th className="text-right p-2 font-medium">Margen Simulado</th>
                    <th className="text-right p-2 font-medium">Unidades Sim.</th>
                  </tr>
                </thead>
                <tbody>
                  {simulatedProducts.filter(p => p.hasRecipe).map(product => {
                    const origMargin = getMargin(product);
                    return (
                      <tr key={product.id} className="border-t hover:bg-muted/30">
                        <td className="p-2">
                          <p className="font-medium">{product.name}</p>
                          <p className="text-xs text-muted-foreground">{product.code}</p>
                        </td>
                        <td className="text-right p-2">${formatCurrency(product.cost)}</td>
                        <td className="text-right p-2 font-medium">${formatCurrency(product.simCost)}</td>
                        <td className="text-right p-2">
                          <span style={{ color: product.costDiff > 0 ? colors.kpiNegative : product.costDiff < 0 ? colors.kpiPositive : colors.kpiNeutral }}>
                            {product.costDiff > 0 ? '+' : ''}{product.costDiff.toFixed(2)}
                          </span>
                        </td>
                        <td className="text-right p-2">{origMargin !== null ? `${origMargin.toFixed(1)}%` : 'N/A'}</td>
                        <td className="text-right p-2 font-medium" style={{ color: product.simMargin > (origMargin || 0) ? colors.kpiPositive : colors.kpiNegative }}>
                          {product.simMargin.toFixed(1)}%
                        </td>
                        <td className="text-right p-2">{(product.simUnits || 0).toLocaleString()}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Scenario Tips */}
            <div className="p-3 rounded-lg" style={{ backgroundColor: colors.kpiNeutral + '10' }}>
              <div className="flex items-start gap-2">
                <Lightbulb className="w-4 h-4 mt-0.5" style={{ color: colors.progressWarning }} />
                <div className="text-xs">
                  <p className="font-medium">Escenarios sugeridos:</p>
                  <ul className="mt-1 space-y-0.5 text-muted-foreground">
                    <li>• <strong>Inflación MP:</strong> +10% Materia Prima para ver impacto en márgenes</li>
                    <li>• <strong>Aumento productividad:</strong> +20% Volumen con -5% CI por economía de escala</li>
                    <li>• <strong>Subida de precios:</strong> +5% Precio para compensar aumentos de costos</li>
                  </ul>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : (
        /* ANALYSIS TAB - Deep Insights */
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="w-4 h-4" style={{ color: colors.chart3 }} />
              Análisis de Rentabilidad
            </CardTitle>
            <CardDescription>Insights y métricas avanzadas de costos</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Top/Bottom Products */}
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 rounded-lg border" style={{ borderColor: colors.kpiPositive + '40', backgroundColor: colors.kpiPositive + '08' }}>
                <h4 className="font-semibold text-sm flex items-center gap-2 mb-3" style={{ color: colors.kpiPositive }}>
                  <ThumbsUp className="w-4 h-4" /> Top 5 - Mayor Margen
                </h4>
                <div className="space-y-2">
                  {products
                    .filter(p => p.salePrice > 0 && p.cost > 0)
                    .sort((a, b) => ((b.salePrice - b.cost) / b.salePrice) - ((a.salePrice - a.cost) / a.salePrice))
                    .slice(0, 5)
                    .map((p, i) => {
                      const m = ((p.salePrice - p.cost) / p.salePrice) * 100;
                      return (
                        <div key={p.id} className="flex items-center justify-between text-sm">
                          <span className="truncate flex-1">{i + 1}. {p.name}</span>
                          <Badge className="ml-2" style={{ backgroundColor: colors.kpiPositive, color: 'white' }}>{m.toFixed(1)}%</Badge>
                        </div>
                      );
                    })}
                </div>
              </div>
              <div className="p-4 rounded-lg border" style={{ borderColor: colors.kpiNegative + '40', backgroundColor: colors.kpiNegative + '08' }}>
                <h4 className="font-semibold text-sm flex items-center gap-2 mb-3" style={{ color: colors.kpiNegative }}>
                  <ThumbsDown className="w-4 h-4" /> Top 5 - Menor Margen
                </h4>
                <div className="space-y-2">
                  {products
                    .filter(p => p.salePrice > 0 && p.cost > 0)
                    .sort((a, b) => ((a.salePrice - a.cost) / a.salePrice) - ((b.salePrice - b.cost) / b.salePrice))
                    .slice(0, 5)
                    .map((p, i) => {
                      const m = ((p.salePrice - p.cost) / p.salePrice) * 100;
                      return (
                        <div key={p.id} className="flex items-center justify-between text-sm">
                          <span className="truncate flex-1">{i + 1}. {p.name}</span>
                          <Badge className="ml-2" style={{ backgroundColor: m < 10 ? colors.kpiNegative : colors.progressWarning, color: 'white' }}>{m.toFixed(1)}%</Badge>
                        </div>
                      );
                    })}
                </div>
              </div>
            </div>

            {/* Cost Structure Analysis */}
            <div className="p-4 rounded-lg border">
              <h4 className="font-semibold text-sm mb-3 flex items-center gap-2">
                <PieChart className="w-4 h-4" style={{ color: colors.chart2 }} />
                Estructura de Costos Promedio
              </h4>
              {(() => {
                const prods = products.filter(p => p.costBreakdown && Object.values(p.costBreakdown).some((v: any) => v > 0));
                const avgBreakdown = {
                  mp: prods.reduce((s, p) => s + (p.costBreakdown?.mp || 0), 0) / (prods.length || 1),
                  mo: prods.reduce((s, p) => s + (p.costBreakdown?.mo || 0), 0) / (prods.length || 1),
                  ci: prods.reduce((s, p) => s + (p.costBreakdown?.ci || 0), 0) / (prods.length || 1),
                  pkg: prods.reduce((s, p) => s + (p.costBreakdown?.packaging || 0), 0) / (prods.length || 1),
                };
                const total = avgBreakdown.mp + avgBreakdown.mo + avgBreakdown.ci + avgBreakdown.pkg;
                return (
                  <div className="grid grid-cols-4 gap-3">
                    {[
                      { label: 'Materia Prima', value: avgBreakdown.mp, pct: (avgBreakdown.mp / total) * 100, color: colors.donut1 },
                      { label: 'Mano de Obra', value: avgBreakdown.mo, pct: (avgBreakdown.mo / total) * 100, color: colors.donut2 },
                      { label: 'C. Indirectos', value: avgBreakdown.ci, pct: (avgBreakdown.ci / total) * 100, color: colors.donut3 },
                      { label: 'Packaging', value: avgBreakdown.pkg, pct: (avgBreakdown.pkg / total) * 100, color: colors.donut4 },
                    ].map(item => (
                      <div key={item.label} className="text-center">
                        <div className="h-2 rounded-full mb-2" style={{ backgroundColor: item.color + '30' }}>
                          <div className="h-full rounded-full" style={{ width: `${item.pct}%`, backgroundColor: item.color }} />
                        </div>
                        <p className="text-xs text-muted-foreground">{item.label}</p>
                        <p className="font-bold">{item.pct.toFixed(1)}%</p>
                        <p className="text-xs">${formatCurrency(item.value)}</p>
                      </div>
                    ))}
                  </div>
                );
              })()}
            </div>

            {/* Category Performance */}
            <div className="p-4 rounded-lg border">
              <h4 className="font-semibold text-sm mb-3 flex items-center gap-2">
                <BarChart3 className="w-4 h-4" style={{ color: colors.chart1 }} />
                Rendimiento por Categoría
              </h4>
              <div className="space-y-3">
                {categorySummary.map(cat => (
                  <div key={cat.id} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium">{cat.name}</span>
                      <div className="flex items-center gap-3">
                        <span className="text-muted-foreground">{cat.productCount} productos</span>
                        <span>Margen: <strong style={{ color: cat.margin > 20 ? colors.kpiPositive : colors.progressWarning }}>{cat.margin.toFixed(1)}%</strong></span>
                        <span>Ingresos: <strong>${formatCurrency(cat.totalRevenue)}</strong></span>
                      </div>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${cat.margin}%`, backgroundColor: cat.color }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Recommendations */}
            <div className="p-4 rounded-lg" style={{ backgroundColor: colors.chart2 + '10' }}>
              <h4 className="font-semibold text-sm mb-2 flex items-center gap-2">
                <Lightbulb className="w-4 h-4" style={{ color: colors.progressWarning }} />
                Recomendaciones
              </h4>
              <ul className="text-sm space-y-1 text-muted-foreground">
                {kpis.withoutRecipe > 0 && (
                  <li>• <strong style={{ color: colors.progressWarning }}>Configurar recetas:</strong> {kpis.withoutRecipe} productos sin receta impiden cálculos precisos</li>
                )}
                {kpis.avgMargin < 20 && (
                  <li>• <strong style={{ color: colors.kpiNegative }}>Revisar precios:</strong> El margen promedio ({kpis.avgMargin.toFixed(1)}%) está por debajo del objetivo (20%)</li>
                )}
                {kpis.avgEfficiency < 95 && (
                  <li>• <strong style={{ color: colors.chart4 }}>Mejorar eficiencia:</strong> La eficiencia promedio ({kpis.avgEfficiency.toFixed(1)}%) puede optimizarse</li>
                )}
                <li>• <strong style={{ color: colors.kpiPositive }}>Productos estrella:</strong> Enfocarse en productos con margen {'>'}25% para maximizar rentabilidad</li>
              </ul>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Product Detail Sheet */}
      <ProductDetailSheet product={selectedProduct} isOpen={showDetailSheet} onClose={() => setShowDetailSheet(false)} />
    </div>
  );
}

// ============================================
// CONFIG SECTION
// ============================================
function ConfigSection({ companyId, colors: customColors, setColors: setCustomColors }: {
  companyId: string;
  colors: UserColorPreferences;
  setColors: React.Dispatch<React.SetStateAction<UserColorPreferences>>;
}) {
  // Estado local para la configuración
  const [activeConfigTab, setActiveConfigTab] = useState<'sources' | 'colors' | 'period'>('colors');
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // NOTA: Los colores se reciben como props desde el componente padre
  // Ya no cargamos aquí porque el padre ya los cargó

  // Guardar preferencias en el backend (se elimina el useEffect de carga ya que viene del padre)
  const savePreferencesPlaceholder = async () => {
    // Placeholder para mantener estructura - la función real está abajo
  };

  const isLoading = false; // Los colores ya están cargados en el padre

  // Eliminada la función loadPreferences ya que los colores vienen del padre

  // Guardar preferencias en el backend
  const savePreferences = async () => {
    try {
      setIsSaving(true);
      setSaveMessage(null);
      const response = await fetch('/api/costos/color-preferences', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyId, colors: customColors }),
      });

      if (response.ok) {
        setSaveMessage({ type: 'success', text: 'Preferencias guardadas correctamente' });
        setTimeout(() => setSaveMessage(null), 3000);
      } else {
        setSaveMessage({ type: 'error', text: 'Error al guardar preferencias' });
      }
    } catch (error) {
      console.error('Error saving color preferences:', error);
      setSaveMessage({ type: 'error', text: 'Error al guardar preferencias' });
    } finally {
      setIsSaving(false);
    }
  };

  // Paletas predefinidas COMPLETAS (todos los colores)
  const colorPresets = [
    {
      name: 'Corporativo Azul',
      colors: {
        themeName: 'Corporativo Azul',
        chart1: '#1e40af', chart2: '#3b82f6', chart3: '#60a5fa', chart4: '#93c5fd', chart5: '#bfdbfe', chart6: '#dbeafe',
        progressPrimary: '#3b82f6', progressSecondary: '#60a5fa', progressWarning: '#fbbf24', progressDanger: '#ef4444',
        kpiPositive: '#22c55e', kpiNegative: '#ef4444', kpiNeutral: '#64748b',
        cardHighlight: '#dbeafe', cardMuted: '#f1f5f9',
        donut1: '#1e40af', donut2: '#3b82f6', donut3: '#60a5fa', donut4: '#93c5fd', donut5: '#bfdbfe',
      }
    },
    {
      name: 'Verde Natural',
      colors: {
        themeName: 'Verde Natural',
        chart1: '#166534', chart2: '#22c55e', chart3: '#4ade80', chart4: '#86efac', chart5: '#bbf7d0', chart6: '#dcfce7',
        progressPrimary: '#22c55e', progressSecondary: '#4ade80', progressWarning: '#fbbf24', progressDanger: '#ef4444',
        kpiPositive: '#22c55e', kpiNegative: '#ef4444', kpiNeutral: '#64748b',
        cardHighlight: '#dcfce7', cardMuted: '#f0fdf4',
        donut1: '#166534', donut2: '#22c55e', donut3: '#4ade80', donut4: '#86efac', donut5: '#bbf7d0',
      }
    },
    {
      name: 'Tonos Neutros',
      colors: {
        themeName: 'Tonos Neutros',
        chart1: '#1e293b', chart2: '#475569', chart3: '#64748b', chart4: '#94a3b8', chart5: '#cbd5e1', chart6: '#e2e8f0',
        progressPrimary: '#475569', progressSecondary: '#64748b', progressWarning: '#94a3b8', progressDanger: '#64748b',
        kpiPositive: '#475569', kpiNegative: '#94a3b8', kpiNeutral: '#64748b',
        cardHighlight: '#f1f5f9', cardMuted: '#f8fafc',
        donut1: '#1e293b', donut2: '#475569', donut3: '#64748b', donut4: '#94a3b8', donut5: '#cbd5e1',
      }
    },
    {
      name: 'Vibrante Mix',
      colors: {
        themeName: 'Vibrante Mix',
        chart1: '#dc2626', chart2: '#ea580c', chart3: '#eab308', chart4: '#22c55e', chart5: '#0891b2', chart6: '#7c3aed',
        progressPrimary: '#0891b2', progressSecondary: '#22c55e', progressWarning: '#eab308', progressDanger: '#dc2626',
        kpiPositive: '#22c55e', kpiNegative: '#dc2626', kpiNeutral: '#64748b',
        cardHighlight: '#fef3c7', cardMuted: '#fefce8',
        donut1: '#dc2626', donut2: '#ea580c', donut3: '#eab308', donut4: '#22c55e', donut5: '#0891b2',
      }
    },
    {
      name: 'Púrpura Elegante',
      colors: {
        themeName: 'Púrpura Elegante',
        chart1: '#581c87', chart2: '#7c3aed', chart3: '#a78bfa', chart4: '#c4b5fd', chart5: '#ddd6fe', chart6: '#ede9fe',
        progressPrimary: '#7c3aed', progressSecondary: '#a78bfa', progressWarning: '#fbbf24', progressDanger: '#ef4444',
        kpiPositive: '#22c55e', kpiNegative: '#ef4444', kpiNeutral: '#64748b',
        cardHighlight: '#ede9fe', cardMuted: '#faf5ff',
        donut1: '#581c87', donut2: '#7c3aed', donut3: '#a78bfa', donut4: '#c4b5fd', donut5: '#ddd6fe',
      }
    },
    {
      name: 'Océano Profundo',
      colors: {
        themeName: 'Océano Profundo',
        chart1: '#164e63', chart2: '#0891b2', chart3: '#22d3ee', chart4: '#67e8f9', chart5: '#a5f3fc', chart6: '#cffafe',
        progressPrimary: '#0891b2', progressSecondary: '#22d3ee', progressWarning: '#fbbf24', progressDanger: '#ef4444',
        kpiPositive: '#22c55e', kpiNegative: '#ef4444', kpiNeutral: '#64748b',
        cardHighlight: '#cffafe', cardMuted: '#ecfeff',
        donut1: '#164e63', donut2: '#0891b2', donut3: '#22d3ee', donut4: '#67e8f9', donut5: '#a5f3fc',
      }
    },
  ];

  const configTabs = [
    { id: 'colors' as const, label: 'Colores', icon: Sun },
    { id: 'sources' as const, label: 'Fuentes', icon: GitBranch },
    { id: 'period' as const, label: 'Período', icon: Calendar },
  ];

  return (
    <div className="space-y-6">
      {/* Tabs de configuración */}
      <div className="flex gap-2 border-b pb-4">
        {configTabs.map(tab => (
          <Button
            key={tab.id}
            variant={activeConfigTab === tab.id ? 'default' : 'outline'}
            size="sm"
            onClick={() => setActiveConfigTab(tab.id)}
            className="flex items-center gap-2"
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </Button>
        ))}
      </div>

      {/* Tab de Colores */}
      {activeConfigTab === 'colors' && (
        <div className="space-y-6">
          {/* Presets */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-warning-muted-foreground" />
                Paletas Predefinidas
              </CardTitle>
              <CardDescription>Aplica una paleta completa con un click</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-4">
                {colorPresets.map((preset, i) => (
                  <button
                    key={i}
                    onClick={() => setCustomColors(preset.colors)}
                    className={cn(
                      "p-3 border rounded-lg hover:bg-muted/50 transition-colors text-left",
                      customColors.themeName === preset.name && "border-primary bg-primary/5"
                    )}
                  >
                    <p className="text-sm font-medium mb-2">{preset.name}</p>
                    <div className="flex gap-1">
                      {[preset.colors.chart1, preset.colors.chart2, preset.colors.chart3, preset.colors.chart4, preset.colors.chart5, preset.colors.chart6].map((color, j) => (
                        <div key={j} className="w-5 h-5 rounded" style={{ backgroundColor: color }} />
                      ))}
                    </div>
                    {customColors.themeName === preset.name && (
                      <Badge variant="default" className="mt-2 text-[10px]">Activo</Badge>
                    )}
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Colores de Gráficos */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-info-muted-foreground" />
                Colores de Gráficos
              </CardTitle>
              <CardDescription>Personaliza los colores de barras, líneas y áreas</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-6 gap-4">
                {['chart1', 'chart2', 'chart3', 'chart4', 'chart5', 'chart6'].map((key, i) => (
                  <div key={key} className="space-y-2">
                    <Label className="text-xs text-muted-foreground">Serie {i + 1}</Label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={customColors[key as keyof typeof customColors]}
                        onChange={(e) => setCustomColors({ ...customColors, [key]: e.target.value })}
                        className="w-10 h-10 rounded cursor-pointer border-0"
                      />
                      <Input
                        value={customColors[key as keyof typeof customColors]}
                        onChange={(e) => setCustomColors({ ...customColors, [key]: e.target.value })}
                        className="h-8 text-xs font-mono"
                      />
                    </div>
                  </div>
                ))}
              </div>
              {/* Preview */}
              <div className="mt-6 p-4 bg-muted/30 rounded-lg">
                <p className="text-xs text-muted-foreground mb-3">Vista previa</p>
                <div className="flex items-end gap-2 h-24">
                  {[customColors.chart1, customColors.chart2, customColors.chart3, customColors.chart4, customColors.chart5, customColors.chart6].map((color, i) => (
                    <div key={i} className="flex-1 rounded-t" style={{ backgroundColor: color, height: `${30 + (i * 12)}%` }} />
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Colores de Donut/Pie */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <PieChart className="w-4 h-4 text-violet-500" />
                Colores de Gráficos Circulares
              </CardTitle>
              <CardDescription>Personaliza los colores de donut y pie charts</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-5 gap-4">
                {['donut1', 'donut2', 'donut3', 'donut4', 'donut5'].map((key, i) => (
                  <div key={key} className="space-y-2">
                    <Label className="text-xs text-muted-foreground">Segmento {i + 1}</Label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={customColors[key as keyof typeof customColors]}
                        onChange={(e) => setCustomColors({ ...customColors, [key]: e.target.value })}
                        className="w-10 h-10 rounded cursor-pointer border-0"
                      />
                      <Input
                        value={customColors[key as keyof typeof customColors]}
                        onChange={(e) => setCustomColors({ ...customColors, [key]: e.target.value })}
                        className="h-8 text-xs font-mono"
                      />
                    </div>
                  </div>
                ))}
              </div>
              {/* Preview Donut */}
              <div className="mt-6 flex justify-center">
                <div className="relative w-32 h-32">
                  <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
                    {[20, 25, 20, 20, 15].map((percent, i) => {
                      const offset = [0, 20, 45, 65, 85][i];
                      const colors = [customColors.donut1, customColors.donut2, customColors.donut3, customColors.donut4, customColors.donut5];
                      return (
                        <circle
                          key={i}
                          cx="50" cy="50" r="40"
                          fill="none"
                          stroke={colors[i]}
                          strokeWidth="20"
                          strokeDasharray={`${percent * 2.51} 251`}
                          strokeDashoffset={`${-offset * 2.51}`}
                        />
                      );
                    })}
                  </svg>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Colores de Barras de Progreso */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Activity className="w-4 h-4 text-success" />
                Colores de Barras de Progreso
              </CardTitle>
              <CardDescription>Personaliza los colores de las barras de progreso y métricas</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-4 gap-4">
                {[
                  { key: 'progressPrimary', label: 'Primario' },
                  { key: 'progressSecondary', label: 'Secundario' },
                  { key: 'progressWarning', label: 'Advertencia' },
                  { key: 'progressDanger', label: 'Peligro' },
                ].map(({ key, label }) => (
                  <div key={key} className="space-y-2">
                    <Label className="text-xs text-muted-foreground">{label}</Label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={customColors[key as keyof typeof customColors]}
                        onChange={(e) => setCustomColors({ ...customColors, [key]: e.target.value })}
                        className="w-10 h-10 rounded cursor-pointer border-0"
                      />
                      <Input
                        value={customColors[key as keyof typeof customColors]}
                        onChange={(e) => setCustomColors({ ...customColors, [key]: e.target.value })}
                        className="h-8 text-xs font-mono"
                      />
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div className="h-full rounded-full w-2/3" style={{ backgroundColor: customColors[key as keyof typeof customColors] }} />
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Colores de KPIs */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-info-muted-foreground" />
                Colores de Indicadores (KPIs)
              </CardTitle>
              <CardDescription>Personaliza los colores de tendencias positivas, negativas y neutras</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-6">
                {[
                  { key: 'kpiPositive', label: 'Positivo (subidas)', icon: ArrowUpRight },
                  { key: 'kpiNegative', label: 'Negativo (bajadas)', icon: ArrowDownRight },
                  { key: 'kpiNeutral', label: 'Neutro', icon: ArrowRight },
                ].map(({ key, label, icon: Icon }) => (
                  <div key={key} className="space-y-3">
                    <Label className="text-xs text-muted-foreground">{label}</Label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={customColors[key as keyof typeof customColors]}
                        onChange={(e) => setCustomColors({ ...customColors, [key]: e.target.value })}
                        className="w-10 h-10 rounded cursor-pointer border-0"
                      />
                      <Input
                        value={customColors[key as keyof typeof customColors]}
                        onChange={(e) => setCustomColors({ ...customColors, [key]: e.target.value })}
                        className="h-8 text-xs font-mono flex-1"
                      />
                    </div>
                    <div className="flex items-center gap-2 p-2 bg-muted/30 rounded">
                      <Icon className="w-4 h-4" style={{ color: customColors[key as keyof typeof customColors] }} />
                      <span className="text-sm font-medium" style={{ color: customColors[key as keyof typeof customColors] }}>
                        {key === 'kpiPositive' ? '+12.5%' : key === 'kpiNegative' ? '-8.3%' : '0.0%'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Colores de Fondos */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Box className="w-4 h-4 text-muted-foreground" />
                Colores de Fondos
              </CardTitle>
              <CardDescription>Personaliza los colores de fondo de cards destacadas</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-6">
                {[
                  { key: 'cardHighlight', label: 'Card Destacada' },
                  { key: 'cardMuted', label: 'Card Secundaria' },
                ].map(({ key, label }) => (
                  <div key={key} className="space-y-2">
                    <Label className="text-xs text-muted-foreground">{label}</Label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={customColors[key as keyof typeof customColors]}
                        onChange={(e) => setCustomColors({ ...customColors, [key]: e.target.value })}
                        className="w-10 h-10 rounded cursor-pointer border-0"
                      />
                      <Input
                        value={customColors[key as keyof typeof customColors]}
                        onChange={(e) => setCustomColors({ ...customColors, [key]: e.target.value })}
                        className="h-8 text-xs font-mono flex-1"
                      />
                    </div>
                    <div className="p-4 rounded-lg border" style={{ backgroundColor: customColors[key as keyof typeof customColors] }}>
                      <p className="text-sm font-medium">Vista previa de {label.toLowerCase()}</p>
                      <p className="text-xs text-muted-foreground">Así se verá el fondo</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Botones de acción */}
          <div className="flex items-center justify-between pt-4 border-t">
            <Button variant="outline" size="sm" onClick={() => {
              setCustomColors({
                themeName: 'Predeterminado',
                chart1: '#3b82f6', chart2: '#10b981', chart3: '#f59e0b', chart4: '#8b5cf6', chart5: '#06b6d4', chart6: '#ef4444',
                progressPrimary: '#3b82f6', progressSecondary: '#10b981', progressWarning: '#f59e0b', progressDanger: '#ef4444',
                kpiPositive: '#10b981', kpiNegative: '#ef4444', kpiNeutral: '#64748b',
                cardHighlight: '#ede9fe', cardMuted: '#f1f5f9',
                donut1: '#3b82f6', donut2: '#10b981', donut3: '#f59e0b', donut4: '#8b5cf6', donut5: '#94a3b8',
              });
            }}>
              <RefreshCw className="w-4 h-4 mr-1.5" />
              Restaurar Predeterminados
            </Button>
            <div className="flex items-center gap-3">
              {saveMessage && (
                <span className={cn(
                  "text-sm",
                  saveMessage.type === 'success' ? 'text-success' : 'text-destructive'
                )}>
                  {saveMessage.text}
                </span>
              )}
              <Button variant="outline" size="sm">
                <Download className="w-4 h-4 mr-1.5" />
                Exportar Tema
              </Button>
              <Button size="sm" onClick={savePreferences} disabled={isSaving}>
                {isSaving ? (
                  <>
                    <RefreshCw className="w-4 h-4 mr-1.5 animate-spin" />
                    Guardando...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4 mr-1.5" />
                    Guardar Cambios
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Tab de Fuentes */}
      {activeConfigTab === 'sources' && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Fuentes de Datos</CardTitle>
            <CardDescription>Administra las conexiones con otros módulos</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Módulo</TableHead>
                  <TableHead>Fuente</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Registros</TableHead>
                  <TableHead>Última Sync</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {[
                  { mod: 'Nóminas', src: 'PayrollRun', status: 'Activo', records: '2 liquidaciones', sync: 'Hace 2 horas' },
                  { mod: 'Compras', src: 'GoodsReceipt', status: 'Activo', records: '18 recepciones', sync: 'Hace 1 hora' },
                  { mod: 'Indirectos', src: 'MonthlyIndirect', status: 'Parcial', records: '12/15 items', sync: 'Hace 3 horas' },
                  { mod: 'Producción', src: 'MonthlyProduction', status: 'Activo', records: '1.250 unidades', sync: 'Hace 1 hora' },
                  { mod: 'Ventas', src: 'SalesInvoice', status: 'Activo', records: '42 facturas', sync: 'Hace 30 min' },
                ].map((row, i) => (
                  <TableRow key={i}>
                    <TableCell className="font-medium">{row.mod}</TableCell>
                    <TableCell className="text-muted-foreground font-mono text-xs">{row.src}</TableCell>
                    <TableCell><Badge className={row.status === 'Activo' ? 'bg-success' : 'bg-warning'}>{row.status}</Badge></TableCell>
                    <TableCell>{row.records}</TableCell>
                    <TableCell className="text-muted-foreground text-xs">{row.sync}</TableCell>
                    <TableCell><Button variant="ghost" size="sm"><Settings2 className="w-4 h-4" /></Button></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Tab de Período */}
      {activeConfigTab === 'period' && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Cierre de Período</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between p-4 border rounded-lg mb-4">
              <div>
                <p className="font-medium">Período Actual: Enero 2026</p>
                <p className="text-sm text-muted-foreground">Estado: Abierto</p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm"><RefreshCw className="w-4 h-4 mr-1.5" />Recalcular</Button>
                <Button size="sm"><Lock className="w-4 h-4 mr-1.5" />Cerrar Período</Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ============================================
// COMPONENTES AUXILIARES
// ============================================

function KPICardEnhanced({ title, value, change, trend, icon: Icon, color, subtitle, highlight, isPercent }: {
  title: string; value: number; change: number; trend: 'up' | 'down'; icon: any; color: string; subtitle?: string; highlight?: boolean; isPercent?: boolean;
}) {
  const colors: Record<string, string> = {
    emerald: 'text-success', rose: 'text-destructive', blue: 'text-info-muted-foreground', violet: 'text-info-muted-foreground', amber: 'text-warning-muted-foreground',
  };
  return (
    <Card className={cn(highlight && 'border-info-muted bg-gradient-to-br from-info-muted to-info-muted')}>
      <CardContent className="pt-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-muted-foreground font-medium">{title}</span>
          <Icon className={cn('w-4 h-4', colors[color])} />
        </div>
        <div className={cn('text-2xl font-bold', colors[color])}>
          {isPercent ? `${value}%` : `$${formatCurrency(value)}`}
        </div>
        <div className="flex items-center gap-2 mt-1">
          <div className="flex items-center gap-1">
            {trend === 'up' ? <ArrowUpRight className="w-3 h-3 text-success" /> : <ArrowDownRight className="w-3 h-3 text-destructive" />}
            <span className={cn('text-xs font-medium', trend === 'up' ? 'text-success' : 'text-destructive')}>
              {change > 0 ? '+' : ''}{change}%
            </span>
          </div>
          {subtitle && <span className="text-xs text-muted-foreground">{subtitle}</span>}
        </div>
      </CardContent>
    </Card>
  );
}

function MiniKPIEnhanced({ title, value, trend, subtitle, icon: Icon, color }: {
  title: string; value: string; trend?: number; subtitle?: string; icon: any; color: string;
}) {
  const colors: Record<string, string> = {
    blue: 'text-info-muted-foreground', green: 'text-success', amber: 'text-warning-muted-foreground', violet: 'text-info-muted-foreground', cyan: 'text-info-muted-foreground',
    emerald: 'text-success', rose: 'text-destructive', indigo: 'text-info-muted-foreground', slate: 'text-muted-foreground', orange: 'text-warning-muted-foreground',
    yellow: 'text-warning-muted-foreground', lime: 'text-success', teal: 'text-info-muted-foreground', purple: 'text-info-muted-foreground', fuchsia: 'text-info-muted-foreground',
    pink: 'text-info-muted-foreground',
  };
  return (
    <Card>
      <CardContent className="pt-4">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs text-muted-foreground">{title}</span>
          <Icon className={cn('w-4 h-4', colors[color])} />
        </div>
        <p className={cn('text-xl font-bold', colors[color])}>{value}</p>
        <div className="flex items-center gap-2">
          {subtitle && <span className="text-xs text-muted-foreground">{subtitle}</span>}
          {trend !== undefined && (
            <Badge variant={trend > 0 ? 'default' : 'secondary'} className="text-[10px] h-4">
              {trend > 0 ? '+' : ''}{trend}%
            </Badge>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function SourceBanner({ source, status, detail, color }: { source: string; status: 'connected' | 'partial'; detail: string; color: string }) {
  const colors: Record<string, { border: string; bg: string; icon: string; text: string }> = {
    blue: { border: 'border-info-muted', bg: 'bg-info-muted/50', icon: 'text-info-muted-foreground', text: 'text-info-muted-foreground' },
    green: { border: 'border-success-muted', bg: 'bg-success-muted/50', icon: 'text-success', text: 'text-success' },
    amber: { border: 'border-warning-muted', bg: 'bg-warning-muted/50', icon: 'text-warning-muted-foreground', text: 'text-warning-muted-foreground' },
    violet: { border: 'border-info-muted', bg: 'bg-info-muted/50', icon: 'text-info-muted-foreground', text: 'text-info-muted-foreground' },
    cyan: { border: 'border-info-muted', bg: 'bg-info-muted/50', icon: 'text-info-muted-foreground', text: 'text-info-muted-foreground' },
    slate: { border: 'border-border', bg: 'bg-muted/50', icon: 'text-muted-foreground', text: 'text-foreground' },
    gray: { border: 'border-border', bg: 'bg-muted/50', icon: 'text-muted-foreground', text: 'text-foreground' },
  };
  const c = colors[color] || colors.slate;
  return (
    <Card className={cn(c.border, c.bg)}>
      <CardContent className="py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={cn('p-2 rounded-lg', c.bg)}>
              {status === 'connected' ? <Link2 className={cn('w-5 h-5', c.icon)} /> : <AlertCircle className={cn('w-5 h-5', c.icon)} />}
            </div>
            <div>
              <p className={cn('font-medium text-sm', c.text)}>Fuente {status === 'connected' ? 'Conectada' : 'Parcial'}: {source}</p>
              <p className={cn('text-xs', c.icon)}>{detail}</p>
            </div>
          </div>
          <Badge className={status === 'connected' ? 'bg-success' : 'bg-warning'}>
            {status === 'connected' ? 'Conectado' : 'Parcial'}
          </Badge>
        </div>
      </CardContent>
    </Card>
  );
}

function DonutChart({ data, theme }: { data: typeof COST_BREAKDOWN; theme?: ThemeConfig }) {
  const total = data.reduce((acc, d) => acc + d.value, 0);
  let cumulative = 0;
  const neutralColors = ['stroke-slate-600', 'stroke-gray-500', 'stroke-zinc-400', 'stroke-stone-500', 'stroke-neutral-400'];

  return (
    <div className="relative w-40 h-40">
      <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
        {data.map((item, i) => {
          const percent = (item.value / total) * 100;
          const offset = cumulative;
          cumulative += percent;
          const colorClass = theme?.primary === 'slate' ? neutralColors[i % neutralColors.length] : item.color.replace('bg-', 'stroke-');
          return (
            <circle
              key={i}
              cx="50" cy="50" r="40"
              fill="none"
              strokeWidth="20"
              className={colorClass}
              strokeDasharray={`${percent * 2.51} 251`}
              strokeDashoffset={`${-offset * 2.51}`}
            />
          );
        })}
      </svg>
      <div className="absolute inset-0 flex items-center justify-center flex-col">
        <span className="text-2xl font-bold">${(total / 1000000).toFixed(1)}M</span>
        <span className="text-xs text-muted-foreground">Total</span>
      </div>
    </div>
  );
}

function MiniSparkline({ values, color }: { values: number[]; color: 'green' | 'red' }) {
  const max = Math.max(...values);
  const min = Math.min(...values);
  const range = max - min || 1;
  return (
    <div className="flex items-end gap-0.5 h-4">
      {values.map((v, i) => (
        <div
          key={i}
          className={cn('w-1.5 rounded-sm', color === 'green' ? 'bg-success' : 'bg-destructive')}
          style={{ height: `${((v - min) / range) * 100}%`, minHeight: '2px' }}
        />
      ))}
    </div>
  );
}

function MetricRow({ icon: Icon, label, value, detail }: { icon: any; label: string; value: string; detail: string }) {
  return (
    <div className="flex items-center justify-between py-1">
      <div className="flex items-center gap-2">
        <Icon className="w-3.5 h-3.5 text-muted-foreground" />
        <span className="text-xs">{label}</span>
      </div>
      <div className="text-right">
        <span className="text-sm font-medium">{value}</span>
        <span className="text-[10px] text-muted-foreground ml-1">{detail}</span>
      </div>
    </div>
  );
}

function AlertItem({ icon: Icon, title, description, type }: { icon: any; title: string; description: string; type: 'warning' | 'info' | 'success' }) {
  const colors = {
    warning: 'text-warning-muted-foreground bg-warning-muted',
    info: 'text-info-muted-foreground bg-info-muted',
    success: 'text-success bg-success-muted',
  };
  return (
    <div className="flex items-start gap-3 p-2 rounded-lg bg-background border">
      <div className={cn('p-1.5 rounded', colors[type])}>
        <Icon className="w-3.5 h-3.5" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{title}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}

function PerformanceCard({ title, value, target, unit, icon: Icon, color, inverted }: {
  title: string; value: number; target: number; unit: string; icon: any; color: string; inverted?: boolean;
}) {
  const isGood = inverted ? value <= target : value >= target;
  const percent = Math.min((value / target) * 100, 100);
  const colors: Record<string, string> = {
    blue: 'text-info-muted-foreground', green: 'text-success', amber: 'text-warning-muted-foreground', violet: 'text-info-muted-foreground', cyan: 'text-info-muted-foreground', emerald: 'text-success',
  };
  return (
    <Card>
      <CardContent className="pt-4">
        <div className="flex items-center justify-between mb-2">
          <Icon className={cn('w-4 h-4', colors[color])} />
          {isGood ? <CheckCircle2 className="w-3.5 h-3.5 text-success" /> : <AlertCircle className="w-3.5 h-3.5 text-warning-muted-foreground" />}
        </div>
        <p className={cn('text-xl font-bold', colors[color])}>{value}{unit}</p>
        <p className="text-[10px] text-muted-foreground mb-2">{title}</p>
        <Progress value={percent} className="h-1" />
        <p className="text-[10px] text-muted-foreground mt-1">Meta: {target}{unit}</p>
      </CardContent>
    </Card>
  );
}

function ComparisonRow({ label, current, previous, inverted }: { label: string; current: number; previous: number; inverted?: boolean }) {
  const change = ((current - previous) / previous) * 100;
  const isPositive = inverted ? change < 0 : change > 0;
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-muted-foreground">{label}</span>
      <div className="flex items-center gap-2">
        <span className={cn('text-sm font-medium', isPositive ? 'text-success' : 'text-destructive')}>
          {change > 0 ? '+' : ''}{change.toFixed(1)}%
        </span>
        {isPositive ? <ArrowUpRight className="w-3.5 h-3.5 text-success" /> : <ArrowDownRight className="w-3.5 h-3.5 text-destructive" />}
      </div>
    </div>
  );
}

function ToggleOption({ title, description, defaultChecked, disabled }: { title: string; description: string; defaultChecked?: boolean; disabled?: boolean }) {
  return (
    <div className={cn('flex items-center justify-between p-3 rounded-lg border', disabled && 'opacity-50')}>
      <div className="flex-1">
        <p className="text-sm font-medium">{title}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <Switch defaultChecked={defaultChecked} disabled={disabled} />
    </div>
  );
}

// ============================================
// NUEVOS COMPONENTES DE GRÁFICOS VISUALES
// ============================================

// Gráfico de Líneas SVG
function LineChartSVG({ data, height = 160, colors }: {
  data: { label: string; values: number[] }[];
  height?: number;
  colors?: string[];
}) {
  const defaultColors = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#06b6d4'];
  const chartColors = colors || defaultColors;
  const allValues = data.flatMap(d => d.values);
  const maxVal = Math.max(...allValues);
  const minVal = Math.min(...allValues);
  const range = maxVal - minVal || 1;
  const points = data[0]?.values.length || 0;
  const width = 100;

  return (
    <div className="w-full" style={{ height }}>
      <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" className="w-full h-full">
        {/* Grid lines */}
        {[0, 25, 50, 75, 100].map(y => (
          <line key={y} x1="0" y1={y * height / 100} x2={width} y2={y * height / 100} stroke="#e5e7eb" strokeWidth="0.5" />
        ))}
        {/* Lines for each series */}
        {data.map((series, seriesIdx) => {
          const pathPoints = series.values.map((val, i) => {
            const x = (i / (points - 1)) * width;
            const y = height - ((val - minVal) / range) * (height * 0.9) - (height * 0.05);
            return `${x},${y}`;
          }).join(' ');
          return (
            <g key={seriesIdx}>
              <polyline
                points={pathPoints}
                fill="none"
                stroke={chartColors[seriesIdx % chartColors.length]}
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              {/* Dots */}
              {series.values.map((val, i) => {
                const x = (i / (points - 1)) * width;
                const y = height - ((val - minVal) / range) * (height * 0.9) - (height * 0.05);
                return (
                  <circle
                    key={i}
                    cx={x}
                    cy={y}
                    r="3"
                    fill={chartColors[seriesIdx % chartColors.length]}
                    className="opacity-0 hover:opacity-100 transition-opacity cursor-pointer"
                  />
                );
              })}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

// Gráfico de Área SVG con gradiente
function AreaChartSVG({ data, height = 160, color = '#3b82f6', gradientId }: {
  data: number[];
  height?: number;
  color?: string;
  gradientId?: string;
}) {
  const maxVal = Math.max(...data);
  const minVal = Math.min(...data);
  const range = maxVal - minVal || 1;
  const points = data.length;
  const width = 100;
  const id = gradientId || `area-gradient-${Math.random().toString(36).substr(2, 9)}`;

  const pointsArray = data.map((val, i) => {
    const x = (i / (points - 1)) * width;
    const y = height - ((val - minVal) / range) * (height * 0.85) - (height * 0.05);
    return { x, y };
  });

  const polylinePoints = pointsArray.map(p => `${p.x},${p.y}`).join(' ');
  const pathD = pointsArray.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x},${p.y}`).join(' ');
  const areaPath = `M 0,${height} ${pathD} L ${width},${height} Z`;

  return (
    <div className="w-full" style={{ height }}>
      <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" className="w-full h-full">
        <defs>
          <linearGradient id={id} x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor={color} stopOpacity="0.4" />
            <stop offset="100%" stopColor={color} stopOpacity="0.05" />
          </linearGradient>
        </defs>
        {/* Area fill */}
        <path d={areaPath} fill={`url(#${id})`} />
        {/* Line */}
        <polyline
          points={polylinePoints}
          fill="none"
          stroke={color}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
}

// Gráfico de Barras Horizontales
function HorizontalBarChart({ data, maxValue, showValues = true, colorClass = 'bg-blue-500' }: {
  data: { label: string; value: number; color?: string }[];
  maxValue?: number;
  showValues?: boolean;
  colorClass?: string;
}) {
  const max = maxValue || Math.max(...data.map(d => d.value));
  return (
    <div className="space-y-3">
      {data.map((item, i) => (
        <div key={i} className="space-y-1">
          <div className="flex items-center justify-between text-sm">
            <span className="truncate">{item.label}</span>
            {showValues && <span className="font-medium">${formatCurrency(item.value)}</span>}
          </div>
          <div className="h-3 bg-muted rounded-full overflow-hidden">
            <div
              className={cn('h-full rounded-full transition-all', item.color || colorClass)}
              style={{ width: `${(item.value / max) * 100}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

// Gráfico de Barras Apiladas
function StackedBarChart({ data, height = 200, colors }: {
  data: { label: string; segments: { name: string; value: number }[] }[];
  height?: number;
  colors?: string[];
}) {
  const defaultColors = ['bg-blue-600', 'bg-blue-500', 'bg-blue-400', 'bg-blue-300', 'bg-blue-200'];
  const chartColors = colors || defaultColors;
  const maxTotal = Math.max(...data.map(d => d.segments.reduce((acc, s) => acc + s.value, 0)));

  return (
    <div className="flex items-end gap-4" style={{ height }}>
      {data.map((item, i) => {
        const total = item.segments.reduce((acc, s) => acc + s.value, 0);
        const heightPercent = (total / maxTotal) * 100;
        return (
          <div key={i} className="flex-1 flex flex-col items-center gap-2">
            <div
              className="w-full flex flex-col-reverse rounded-t overflow-hidden"
              style={{ height: `${heightPercent}%` }}
            >
              {item.segments.map((seg, j) => (
                <div
                  key={j}
                  className={cn(chartColors[j % chartColors.length])}
                  style={{ height: `${(seg.value / total) * 100}%` }}
                  title={`${seg.name}: $${formatCurrency(seg.value)}`}
                />
              ))}
            </div>
            <span className="text-[10px] text-muted-foreground">{item.label}</span>
          </div>
        );
      })}
    </div>
  );
}

// Gráfico de Gauge/Velocímetro
function GaugeChart({ value, max = 100, label, color = 'blue', size = 120 }: {
  value: number;
  max?: number;
  label?: string;
  color?: string;
  size?: number;
}) {
  const percent = Math.min((value / max) * 100, 100);
  const strokeDasharray = (percent / 100) * 180; // Semicircle
  const colorMap: Record<string, string> = {
    blue: 'stroke-blue-500',
    green: 'stroke-green-500',
    amber: 'stroke-amber-500',
    red: 'stroke-red-500',
    violet: 'stroke-violet-500',
    slate: 'stroke-slate-500',
  };

  return (
    <div className="flex flex-col items-center" style={{ width: size }}>
      <svg viewBox="0 0 100 60" className="w-full">
        {/* Background arc */}
        <path
          d="M 10 50 A 40 40 0 0 1 90 50"
          fill="none"
          stroke="#e5e7eb"
          strokeWidth="8"
          strokeLinecap="round"
        />
        {/* Value arc */}
        <path
          d="M 10 50 A 40 40 0 0 1 90 50"
          fill="none"
          className={colorMap[color] || 'stroke-blue-500'}
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={`${strokeDasharray} 180`}
        />
      </svg>
      <div className="text-center -mt-4">
        <p className="text-xl font-bold">{value.toFixed(1)}%</p>
        {label && <p className="text-xs text-muted-foreground">{label}</p>}
      </div>
    </div>
  );
}

// Gráfico de Comparación Lado a Lado
function ComparisonBarChart({ data, height = 180, color1 = 'bg-blue-500', color2 = 'bg-slate-400' }: {
  data: { label: string; current: number; previous: number }[];
  height?: number;
  color1?: string;
  color2?: string;
}) {
  const maxVal = Math.max(...data.flatMap(d => [d.current, d.previous]));

  return (
    <div className="flex items-end gap-6" style={{ height }}>
      {data.map((item, i) => (
        <div key={i} className="flex-1 flex flex-col items-center gap-2">
          <div className="w-full flex items-end justify-center gap-1 flex-1">
            <div className={cn('w-1/3 rounded-t', color2)} style={{ height: `${(item.previous / maxVal) * 100}%` }} />
            <div className={cn('w-1/3 rounded-t', color1)} style={{ height: `${(item.current / maxVal) * 100}%` }} />
          </div>
          <span className="text-[10px] text-muted-foreground">{item.label}</span>
        </div>
      ))}
    </div>
  );
}

// Mini gráfico de tendencia inline
function TrendlineChart({ values, color = 'blue', width = 80, height = 24 }: {
  values: number[];
  color?: string;
  width?: number;
  height?: number;
}) {
  const max = Math.max(...values);
  const min = Math.min(...values);
  const range = max - min || 1;
  const points = values.length;

  const colorMap: Record<string, string> = {
    blue: '#3b82f6', green: '#10b981', red: '#ef4444', amber: '#f59e0b', violet: '#8b5cf6', slate: '#64748b'
  };
  const strokeColor = colorMap[color] || colorMap.blue;

  const pathPoints = values.map((val, i) => {
    const x = (i / (points - 1)) * width;
    const y = height - ((val - min) / range) * (height * 0.8) - (height * 0.1);
    return `${x},${y}`;
  }).join(' ');

  return (
    <svg width={width} height={height} className="inline-block">
      <polyline
        points={pathPoints}
        fill="none"
        stroke={strokeColor}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// Gráfico de Radar Simple
function RadarChartSimple({ data, size = 160, color = 'blue' }: {
  data: { label: string; value: number; max: number }[];
  size?: number;
  color?: string;
}) {
  const center = size / 2;
  const radius = (size / 2) - 20;
  const angleStep = (2 * Math.PI) / data.length;

  const colorMap: Record<string, { stroke: string; fill: string }> = {
    blue: { stroke: '#3b82f6', fill: 'rgba(59, 130, 246, 0.2)' },
    green: { stroke: '#10b981', fill: 'rgba(16, 185, 129, 0.2)' },
    violet: { stroke: '#8b5cf6', fill: 'rgba(139, 92, 246, 0.2)' },
    slate: { stroke: '#64748b', fill: 'rgba(100, 116, 139, 0.2)' },
  };
  const colors = colorMap[color] || colorMap.blue;

  const points = data.map((item, i) => {
    const angle = i * angleStep - Math.PI / 2;
    const r = (item.value / item.max) * radius;
    return {
      x: center + r * Math.cos(angle),
      y: center + r * Math.sin(angle),
    };
  });

  const polygonPoints = points.map(p => `${p.x},${p.y}`).join(' ');

  return (
    <svg width={size} height={size} className="mx-auto">
      {/* Grid circles */}
      {[0.25, 0.5, 0.75, 1].map(scale => (
        <circle
          key={scale}
          cx={center}
          cy={center}
          r={radius * scale}
          fill="none"
          stroke="#e5e7eb"
          strokeWidth="1"
        />
      ))}
      {/* Axis lines */}
      {data.map((_, i) => {
        const angle = i * angleStep - Math.PI / 2;
        return (
          <line
            key={i}
            x1={center}
            y1={center}
            x2={center + radius * Math.cos(angle)}
            y2={center + radius * Math.sin(angle)}
            stroke="#e5e7eb"
            strokeWidth="1"
          />
        );
      })}
      {/* Data polygon */}
      <polygon
        points={polygonPoints}
        fill={colors.fill}
        stroke={colors.stroke}
        strokeWidth="2"
      />
      {/* Data points */}
      {points.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r="4" fill={colors.stroke} />
      ))}
      {/* Labels */}
      {data.map((item, i) => {
        const angle = i * angleStep - Math.PI / 2;
        const labelR = radius + 15;
        const x = center + labelR * Math.cos(angle);
        const y = center + labelR * Math.sin(angle);
        return (
          <text
            key={i}
            x={x}
            y={y}
            textAnchor="middle"
            dominantBaseline="middle"
            className="text-[9px] fill-muted-foreground"
          >
            {item.label}
          </text>
        );
      })}
    </svg>
  );
}

// Waterfall Chart (Cascada)
function WaterfallChart({ data, height = 200 }: {
  data: { label: string; value: number; type: 'start' | 'add' | 'subtract' | 'total' }[];
  height?: number;
}) {
  let runningTotal = 0;
  const processedData = data.map(item => {
    if (item.type === 'start') {
      runningTotal = item.value;
      return { ...item, start: 0, end: item.value };
    } else if (item.type === 'total') {
      return { ...item, start: 0, end: runningTotal };
    } else {
      const start = runningTotal;
      runningTotal += item.type === 'add' ? item.value : -item.value;
      return { ...item, start: Math.min(start, runningTotal), end: Math.max(start, runningTotal) };
    }
  });

  const maxVal = Math.max(...processedData.map(d => d.end));
  const barWidth = 60;

  return (
    <div className="flex items-end gap-2" style={{ height }}>
      {processedData.map((item, i) => {
        const heightPercent = ((item.end - item.start) / maxVal) * 100;
        const bottomPercent = (item.start / maxVal) * 100;
        const colorClass = item.type === 'start' || item.type === 'total' ? 'bg-info' :
                          item.type === 'add' ? 'bg-success' : 'bg-destructive';
        return (
          <div key={i} className="flex-1 flex flex-col items-center gap-1">
            <div className="w-full relative" style={{ height: '85%' }}>
              <div
                className={cn('absolute left-1/2 -translate-x-1/2 w-3/4 rounded-t', colorClass)}
                style={{ height: `${heightPercent}%`, bottom: `${bottomPercent}%` }}
              />
            </div>
            <span className="text-[9px] text-muted-foreground truncate max-w-full">{item.label}</span>
          </div>
        );
      })}
    </div>
  );
}
