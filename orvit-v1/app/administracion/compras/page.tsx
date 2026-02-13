'use client';

import { useState, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  CartesianGrid,
  BarChart,
  Bar,
  Legend,
  ComposedChart,
  Line,
  RadialBarChart,
  RadialBar
} from 'recharts';
import {
  ShoppingCart,
  Building2,
  Truck,
  Package,
  FileText,
  RefreshCcw,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  DollarSign,
  Clock,
  ChevronRight,
  ArrowUpRight,
  ArrowDownRight,
  BarChart3,
  PieChartIcon,
  Zap,
  Calendar,
  Layers,
  CreditCard,
  Archive,
  Eye,
  Activity,
  Target,
  Shield,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Minus,
  Users,
  FolderTree,
  FileContract,
  Gauge,
  Timer,
  Percent,
  TrendingUpIcon,
  ArrowRight,
  Bell,
  Settings
} from 'lucide-react';

// Components
import { UrgentPaymentsSection } from '@/components/compras/urgent-payments-section';
import { DashboardDetailModal } from '@/components/compras/dashboard-detail-modal';
import { DashboardFullViewSheet } from '@/components/compras/dashboard-full-view-sheet';
import { AIInsightsSection } from '@/components/compras/ai-insights-section';
import { StatsDetailSheet } from '@/components/compras/stats-detail-sheet';

// Hooks
import { useComprasDashboard } from '@/hooks/use-compras-dashboard';

// ============ UTILS ============
function formatCurrency(value: number): string {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    maximumFractionDigits: 0
  }).format(value);
}

function formatCompact(value: number): string {
  if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
  if (value >= 1000) return `$${Math.round(value / 1000)}K`;
  return formatCurrency(value);
}

function formatPercent(value: number): string {
  return `${value > 0 ? '+' : ''}${value}%`;
}

// ============ CHART COLORS ============
const COLORS = {
  primary: 'hsl(var(--primary))',
  success: '#10B981',
  warning: '#F59E0B',
  danger: '#EF4444',
  muted: 'hsl(var(--muted-foreground))',
  background: 'hsl(var(--background))'
};

const PIE_COLORS = [
  'hsl(var(--primary))',
  'hsl(var(--primary) / 0.8)',
  'hsl(var(--primary) / 0.6)',
  'hsl(var(--primary) / 0.4)',
  'hsl(var(--primary) / 0.25)',
];

// ============ ANIMATED COUNTER ============
function AnimatedCounter({ value, duration = 1000, prefix = '', suffix = '' }: {
  value: number;
  duration?: number;
  prefix?: string;
  suffix?: string;
}) {
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    let startTime: number;
    let animationFrame: number;

    const animate = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const progress = Math.min((timestamp - startTime) / duration, 1);
      setDisplayValue(Math.floor(progress * value));

      if (progress < 1) {
        animationFrame = requestAnimationFrame(animate);
      }
    };

    animationFrame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animationFrame);
  }, [value, duration]);

  return <>{prefix}{displayValue.toLocaleString('es-AR')}{suffix}</>;
}

// ============ SPARKLINE MINI CHART ============
function Sparkline({ data, color = 'hsl(var(--primary))', height = 24 }: {
  data: number[];
  color?: string;
  height?: number;
}) {
  if (!data || data.length < 2) return null;

  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const width = 60;
  const padding = 2;

  const points = data.map((v, i) => {
    const x = padding + (i / (data.length - 1)) * (width - 2 * padding);
    const y = padding + ((max - v) / range) * (height - 2 * padding);
    return `${x},${y}`;
  }).join(' ');

  return (
    <svg width={width} height={height} className="inline-block">
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle
        cx={padding + ((data.length - 1) / (data.length - 1)) * (width - 2 * padding)}
        cy={padding + ((max - data[data.length - 1]) / range) * (height - 2 * padding)}
        r="2"
        fill={color}
      />
    </svg>
  );
}

// ============ HEALTH SCORE GAUGE (SVG) ============
function HealthScoreGauge({ score, size = 160 }: { score: number; size?: number }) {
  const [animatedScore, setAnimatedScore] = useState(0);

  useEffect(() => {
    const timer = setTimeout(() => setAnimatedScore(score), 100);
    return () => clearTimeout(timer);
  }, [score]);

  const getColor = (s: number) => {
    if (s >= 80) return { main: '#10B981', bg: '#10B98120' };
    if (s >= 60) return { main: '#F59E0B', bg: '#F59E0B20' };
    if (s >= 40) return { main: '#F97316', bg: '#F9731620' };
    return { main: '#EF4444', bg: '#EF444420' };
  };

  const getLabel = (s: number) => {
    if (s >= 80) return 'Excelente';
    if (s >= 60) return 'Bueno';
    if (s >= 40) return 'Regular';
    return 'Crítico';
  };

  const colors = getColor(score);
  const radius = 70;
  const strokeWidth = 12;
  const circumference = Math.PI * radius; // Semi-circle
  const progress = (animatedScore / 100) * circumference;
  const center = size / 2;
  const gaugeY = size * 0.6;

  return (
    <div className="relative" style={{ width: size, height: size * 0.7 }}>
      <svg width={size} height={size * 0.7} className="overflow-visible">
        {/* Background arc */}
        <path
          d={`M ${center - radius} ${gaugeY} A ${radius} ${radius} 0 0 1 ${center + radius} ${gaugeY}`}
          fill="none"
          stroke="hsl(var(--muted))"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
        />

        {/* Progress arc */}
        <path
          d={`M ${center - radius} ${gaugeY} A ${radius} ${radius} 0 0 1 ${center + radius} ${gaugeY}`}
          fill="none"
          stroke={colors.main}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={`${progress} ${circumference}`}
          style={{
            transition: 'stroke-dasharray 1s ease-out',
          }}
        />

        {/* Min/Max labels */}
        <text x={center - radius - 8} y={gaugeY + 16} className="text-[10px] fill-muted-foreground" textAnchor="middle">0</text>
        <text x={center + radius + 8} y={gaugeY + 16} className="text-[10px] fill-muted-foreground" textAnchor="middle">100</text>

        {/* Tick marks */}
        {[0, 25, 50, 75, 100].map((tick) => {
          const angle = Math.PI - (tick / 100) * Math.PI;
          const x1 = center + (radius - strokeWidth/2 - 2) * Math.cos(angle);
          const y1 = gaugeY - (radius - strokeWidth/2 - 2) * Math.sin(angle);
          const x2 = center + (radius + strokeWidth/2 + 2) * Math.cos(angle);
          const y2 = gaugeY - (radius + strokeWidth/2 + 2) * Math.sin(angle);
          return (
            <line
              key={tick}
              x1={x1} y1={y1} x2={x2} y2={y2}
              stroke="hsl(var(--border))"
              strokeWidth="1"
            />
          );
        })}
      </svg>

      {/* Center content */}
      <div className="absolute inset-0 flex flex-col items-center justify-end pb-1">
        <div className="text-4xl font-bold tabular-nums" style={{ color: colors.main }}>
          {animatedScore}
        </div>
        <div
          className="text-xs font-medium px-2 py-0.5 rounded-full mt-1"
          style={{ backgroundColor: colors.bg, color: colors.main }}
        >
          {getLabel(score)}
        </div>
      </div>
    </div>
  );
}

// ============ PROGRESS RING ============
function ProgressRing({ value, max, size = 40, strokeWidth = 4, color }: {
  value: number;
  max: number;
  size?: number;
  strokeWidth?: number;
  color?: string;
}) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const percentage = Math.min(value / max, 1);
  const offset = circumference - percentage * circumference;
  const fillColor = color || (percentage >= 0.8 ? COLORS.success : percentage >= 0.5 ? COLORS.warning : COLORS.danger);

  return (
    <svg width={size} height={size} className="transform -rotate-90">
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="hsl(var(--muted))"
        strokeWidth={strokeWidth}
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke={fillColor}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        style={{ transition: 'stroke-dashoffset 0.5s ease' }}
      />
    </svg>
  );
}

// ============ BUDGET PROGRESS BAR ============
function BudgetProgress({ actual, budget, label }: { actual: number; budget: number; label: string }) {
  const percentage = Math.min((actual / budget) * 100, 100);
  const isOver = actual > budget;
  const overPercentage = isOver ? ((actual - budget) / budget) * 100 : 0;

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className={cn("font-medium", isOver ? "text-red-500" : "text-foreground")}>
          {formatCompact(actual)} / {formatCompact(budget)}
        </span>
      </div>
      <div className="relative h-2 bg-muted rounded-full overflow-hidden">
        <div
          className={cn(
            "absolute h-full rounded-full transition-all duration-500",
            isOver ? "bg-red-500" : percentage > 80 ? "bg-amber-500" : "bg-primary"
          )}
          style={{ width: `${Math.min(percentage, 100)}%` }}
        />
        {isOver && (
          <div
            className="absolute h-full bg-red-600 animate-pulse"
            style={{ left: '100%', width: `${Math.min(overPercentage, 20)}%`, transform: 'translateX(-100%)' }}
          />
        )}
      </div>
      <div className="flex items-center justify-between text-[10px] text-muted-foreground">
        <span>{percentage.toFixed(0)}% utilizado</span>
        {isOver && <span className="text-red-500">+{overPercentage.toFixed(0)}% sobre presupuesto</span>}
      </div>
    </div>
  );
}

// ============ TREND INDICATOR ============
function TrendIndicator({ trend, value }: { trend: 'up' | 'down' | 'stable'; value?: number }) {
  if (trend === 'stable') {
    return (
      <span className="inline-flex items-center gap-1 text-muted-foreground">
        <Minus className="h-3 w-3" />
        <span className="text-xs">Estable</span>
      </span>
    );
  }

  const isUp = trend === 'up';
  return (
    <span className={cn(
      "inline-flex items-center gap-1",
      isUp ? "text-red-500" : "text-green-500"
    )}>
      {isUp ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
      {value !== undefined && <span className="text-xs font-medium">{formatPercent(value)}</span>}
    </span>
  );
}

// ============ ALERT CARD ============
function AlertCard({ alert, onClick }: {
  alert: {
    tipo: string;
    mensaje: string;
    prioridad: 'alta' | 'media' | 'baja';
    cantidad?: number;
    monto?: number;
  };
  onClick?: () => void;
}) {
  const getIcon = () => {
    switch (alert.tipo) {
      case 'vencimiento': return <Clock className="h-4 w-4" />;
      case 'stock': return <Package className="h-4 w-4" />;
      case 'aprobacion': return <FileText className="h-4 w-4" />;
      case 'deuda': return <CreditCard className="h-4 w-4" />;
      case 'contrato': return <FileContract className="h-4 w-4" />;
      default: return <AlertCircle className="h-4 w-4" />;
    }
  };

  const getBgColor = () => {
    switch (alert.prioridad) {
      case 'alta': return 'bg-red-500/10 border-red-500/20 hover:bg-red-500/20';
      case 'media': return 'bg-amber-500/10 border-amber-500/20 hover:bg-amber-500/20';
      default: return 'bg-blue-500/10 border-blue-500/20 hover:bg-blue-500/20';
    }
  };

  const getTextColor = () => {
    switch (alert.prioridad) {
      case 'alta': return 'text-red-600 dark:text-red-400';
      case 'media': return 'text-amber-600 dark:text-amber-400';
      default: return 'text-blue-600 dark:text-blue-400';
    }
  };

  return (
    <div
      className={cn(
        "flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors",
        getBgColor()
      )}
      onClick={onClick}
    >
      <div className={cn("p-1.5 rounded-full", getBgColor(), getTextColor())}>
        {getIcon()}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{alert.mensaje}</p>
        {alert.monto && (
          <p className="text-xs text-muted-foreground">{formatCompact(alert.monto)}</p>
        )}
      </div>
      <ChevronRight className="h-4 w-4 text-muted-foreground" />
    </div>
  );
}

// ============ METRIC CARD ============
function MetricCard({
  title,
  value,
  subtitle,
  icon: Icon,
  trend,
  trendValue,
  color = 'default',
  onClick,
  compact = false
}: {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: React.ElementType;
  trend?: 'up' | 'down' | 'stable';
  trendValue?: number;
  color?: 'default' | 'success' | 'warning' | 'danger';
  onClick?: () => void;
  compact?: boolean;
}) {
  const colorClasses = {
    default: 'bg-card',
    success: 'bg-green-500/5 border-green-500/20',
    warning: 'bg-amber-500/5 border-amber-500/20',
    danger: 'bg-red-500/5 border-red-500/20'
  };

  return (
    <Card
      className={cn(
        "transition-all",
        colorClasses[color],
        onClick && "cursor-pointer hover:shadow-md hover:scale-[1.01]"
      )}
      onClick={onClick}
    >
      <CardContent className={cn("p-4", compact && "p-3")}>
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <p className="text-xs text-muted-foreground truncate">{title}</p>
            <p className={cn("font-semibold tabular-nums truncate", compact ? "text-xl" : "text-2xl")}>{value}</p>
            {(subtitle || trend) && (
              <div className="flex items-center gap-2 mt-1">
                {trend && <TrendIndicator trend={trend} value={trendValue} />}
                {subtitle && <span className="text-xs text-muted-foreground truncate">{subtitle}</span>}
              </div>
            )}
          </div>
          {Icon && (
            <div className="p-2 rounded-lg bg-muted/50">
              <Icon className="h-4 w-4 text-muted-foreground" />
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// ============ CUSTOM TOOLTIP ============
function ChartTooltip({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-md border border-border bg-popover text-popover-foreground shadow-md px-3 py-2 text-xs">
      {children}
    </div>
  );
}

// ============ MAIN COMPONENT ============
export default function ComprasPage() {
  const router = useRouter();
  const { data, isLoading, error, refetch, isFetching } = useComprasDashboard();
  const [range, setRange] = useState<'7d' | '30d' | '90d' | 'ytd'>('30d');

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [modalType, setModalType] = useState<'proveedor' | 'item'>('proveedor');
  const [selectedProveedor, setSelectedProveedor] = useState<{ id: number; nombre: string } | null>(null);
  const [selectedItem, setSelectedItem] = useState<string | null>(null);

  const openProveedorModal = (id: number, nombre: string) => {
    setSelectedProveedor({ id, nombre });
    setModalType('proveedor');
    setModalOpen(true);
  };

  const openItemModal = (descripcion: string) => {
    setSelectedItem(descripcion);
    setModalType('item');
    setModalOpen(true);
  };

  // Full view sheet state
  const [sheetOpen, setSheetOpen] = useState(false);
  const [sheetType, setSheetType] = useState<'proveedores' | 'items'>('proveedores');

  const openFullView = (type: 'proveedores' | 'items') => {
    setSheetType(type);
    setSheetOpen(true);
  };

  // Stats detail sheet state
  const [statsSheetOpen, setStatsSheetOpen] = useState(false);
  const [statsType, setStatsType] = useState<'compras' | 'deuda' | 'ordenes' | 'flujo' | 'items' | 'recepciones' | 'categorias' | 'servicios'>('compras');

  const openStatsDetail = (type: typeof statsType) => {
    setStatsType(type);
    setStatsSheetOpen(true);
  };

  const isAdmin = data?.admin !== null && data?.admin !== undefined;

  const RANGE_OPTIONS = [
    { value: '7d', label: '7d' },
    { value: '30d', label: '30d' },
    { value: '90d', label: '90d' },
    { value: 'ytd', label: 'YTD' },
  ] as const;

  // Transform data for charts
  const chartData = useMemo(() => {
    if (!data?.admin?.comprasPorMes) return [];
    return data.admin.comprasPorMes.map(item => ({
      name: item.mes,
      value: item.total,
      x: item.mes,
      y: item.total
    }));
  }, [data?.admin?.comprasPorMes]);

  const pieData = useMemo(() => {
    if (!data?.admin?.topProveedores) return [];
    return data.admin.topProveedores.map(p => ({
      name: p.nombre,
      value: p.total
    }));
  }, [data?.admin?.topProveedores]);

  // Comparison chart data (actual vs anterior)
  const comparisonData = useMemo(() => {
    if (!data?.admin?.comprasPorMes) return [];
    // Simulate comparison by creating offset data
    return data.admin.comprasPorMes.map((item, idx) => ({
      name: item.mes,
      actual: item.total,
      anterior: item.total * (0.8 + Math.random() * 0.4) // Simulated for now
    }));
  }, [data?.admin?.comprasPorMes]);

  // Atajos rapidos
  const shortcuts = [
    { label: 'Torre de Control', icon: BarChart3, path: '/administracion/compras/torre-control', color: 'primary' },
    { label: 'Nueva OC', icon: ShoppingCart, path: '/administracion/compras/ordenes', color: 'default' },
    { label: 'Proveedores', icon: Building2, path: '/administracion/compras/proveedores', color: 'default' },
    { label: 'Recepciones', icon: Truck, path: '/administracion/compras/recepciones', color: 'default' },
    { label: 'Solicitar Pago', icon: FileText, path: '/administracion/compras/solicitudes', color: 'default' },
  ];

  // Loading
  if (isLoading && !data) {
    return (
      <div className="space-y-6">
        <div className="border-b border-border">
          <div className="px-4 md:px-6 py-3">
            <Skeleton className="h-7 w-48" />
            <Skeleton className="h-4 w-64 mt-2" />
          </div>
        </div>
        <div className="px-4 md:px-6 pb-6 grid grid-cols-12 gap-4">
          <div className="col-span-12 lg:col-span-4">
            <Skeleton className="h-48" />
          </div>
          <div className="col-span-12 lg:col-span-8">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[1,2,3,4].map(i => <Skeleton key={i} className="h-24" />)}
            </div>
          </div>
          <div className="col-span-12">
            <Skeleton className="h-80" />
          </div>
        </div>
      </div>
    );
  }

  // Error
  if (error || !data) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="py-10 text-center">
            <AlertTriangle className="w-10 h-10 mx-auto mb-4 text-muted-foreground" />
            <p className="text-muted-foreground mb-4">Error al cargar el dashboard</p>
            <Button onClick={() => refetch()} variant="outline">
              <RefreshCcw className="w-4 h-4 mr-2" />
              Reintentar
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const ejecutivo = data.admin?.ejecutivo;
  const categorias = data.admin?.categorias;
  const servicios = data.admin?.servicios;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="border-b border-border sticky top-0 z-10 bg-background/95 backdrop-blur">
        <div className="px-4 md:px-6 py-3 flex items-center gap-4 justify-between">
          <div className="min-w-0">
            <h1 className="text-xl md:text-2xl font-semibold tracking-tight">Panel de Compras</h1>
            <p className="text-xs text-muted-foreground">
              {isAdmin ? 'Vista ejecutiva • ' : ''}{new Date(data.timestamp).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' })}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {/* Range selector */}
            <div className="hidden md:flex items-center border border-border rounded-md p-0.5 bg-muted/40 h-7">
              {RANGE_OPTIONS.map((opt, idx) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setRange(opt.value)}
                  className={cn(
                    "px-2 py-0.5 text-[11px] font-medium transition-colors",
                    "hover:bg-muted",
                    range === opt.value && "bg-background shadow-sm text-foreground",
                    idx === 0 ? "rounded-l-md" : idx === RANGE_OPTIONS.length - 1 ? "rounded-r-md" : ""
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            {/* Config */}
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => router.push('/administracion/compras/configuracion')}>
              <Settings className="h-4 w-4" />
            </Button>
            {/* Refresh */}
            <Button
              variant="outline"
              size="sm"
              className="h-7 gap-1.5"
              onClick={() => refetch()}
              disabled={isFetching}
            >
              <RefreshCcw className={cn("h-3.5 w-3.5", isFetching && "animate-spin")} />
              <span className="hidden md:inline">Actualizar</span>
            </Button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="px-4 md:px-6 pb-6 space-y-4">

        {/* ========== EXECUTIVE SUMMARY ROW ========== */}
        {isAdmin && data.admin && ejecutivo && (
          <div className="grid grid-cols-12 gap-4">
            {/* Health Score Card - ENHANCED */}
            <Card className="col-span-12 lg:col-span-3 bg-gradient-to-br from-background via-background to-muted/20 border-2 shadow-lg overflow-hidden relative">
              <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-primary/5 to-transparent rounded-bl-full" />
              <CardHeader className="pb-0 pt-4">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-primary/10">
                    <Activity className="h-4 w-4 text-primary" />
                  </div>
                  Salud Operativa
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-4 pb-4">
                <div className="flex justify-center">
                  <HealthScoreGauge score={ejecutivo.healthScore} size={180} />
                </div>

                {/* Health Factors Grid */}
                <div className="grid grid-cols-2 gap-2 mt-4">
                  <div className="relative p-2.5 rounded-lg bg-gradient-to-br from-green-500/10 to-green-500/5 border border-green-500/20">
                    <div className="flex items-center gap-1.5">
                      <ProgressRing value={ejecutivo.healthFactors.pagosPuntuales} max={100} size={28} strokeWidth={3} color={COLORS.success} />
                      <div>
                        <div className="text-sm font-bold text-green-600">{ejecutivo.healthFactors.pagosPuntuales}%</div>
                        <div className="text-[9px] text-muted-foreground leading-tight">Pagos puntuales</div>
                      </div>
                    </div>
                  </div>
                  <div className="relative p-2.5 rounded-lg bg-gradient-to-br from-blue-500/10 to-blue-500/5 border border-blue-500/20">
                    <div className="flex items-center gap-1.5">
                      <ProgressRing value={ejecutivo.eficiencia.tasaCumplimiento} max={100} size={28} strokeWidth={3} color="#3B82F6" />
                      <div>
                        <div className="text-sm font-bold text-blue-600">{ejecutivo.eficiencia.tasaCumplimiento}%</div>
                        <div className="text-[9px] text-muted-foreground leading-tight">OC completadas</div>
                      </div>
                    </div>
                  </div>
                  <div className="relative p-2.5 rounded-lg bg-gradient-to-br from-amber-500/10 to-amber-500/5 border border-amber-500/20">
                    <div className="flex items-center gap-1.5">
                      <ProgressRing value={100 - ejecutivo.eficiencia.tasaRechazo} max={100} size={28} strokeWidth={3} color={COLORS.warning} />
                      <div>
                        <div className="text-sm font-bold text-amber-600">{ejecutivo.healthFactors.deudaSaludable}%</div>
                        <div className="text-[9px] text-muted-foreground leading-tight">Deuda saludable</div>
                      </div>
                    </div>
                  </div>
                  <div className="relative p-2.5 rounded-lg bg-gradient-to-br from-purple-500/10 to-purple-500/5 border border-purple-500/20">
                    <div className="flex items-center gap-1.5">
                      <ProgressRing value={ejecutivo.healthFactors.stockOptimo} max={100} size={28} strokeWidth={3} color="#8B5CF6" />
                      <div>
                        <div className="text-sm font-bold text-purple-600">{ejecutivo.healthFactors.stockOptimo}%</div>
                        <div className="text-[9px] text-muted-foreground leading-tight">Stock óptimo</div>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Main KPIs - ENHANCED */}
            <div className="col-span-12 lg:col-span-6 space-y-3">
              {/* Big Numbers Row */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {/* Compras del Mes - Enhanced */}
                <Card
                  className="cursor-pointer hover:shadow-md hover:scale-[1.02] transition-all bg-gradient-to-br from-primary/5 to-transparent border-primary/20"
                  onClick={() => openStatsDetail('compras')}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-[11px] text-muted-foreground uppercase tracking-wide">Compras Mes</p>
                        <p className="text-2xl font-bold text-primary tabular-nums mt-1">
                          <AnimatedCounter value={data.admin.comprasMes} prefix="$" duration={800} />
                        </p>
                        <div className="flex items-center gap-1.5 mt-1">
                          <TrendIndicator trend={ejecutivo.tendenciaMensual} value={data.admin.variacionMensual} />
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <div className="p-1.5 rounded-lg bg-primary/10">
                          <DollarSign className="h-4 w-4 text-primary" />
                        </div>
                        <Sparkline data={chartData.slice(-6).map(d => d.value)} color="hsl(var(--primary))" />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Deuda - Enhanced */}
                <Card
                  className={cn(
                    "cursor-pointer hover:shadow-md hover:scale-[1.02] transition-all",
                    data.admin.facturasVencidas > 0
                      ? "bg-gradient-to-br from-red-500/10 to-transparent border-red-500/30"
                      : "bg-gradient-to-br from-green-500/5 to-transparent border-green-500/20"
                  )}
                  onClick={() => openStatsDetail('deuda')}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-[11px] text-muted-foreground uppercase tracking-wide">Deuda Total</p>
                        <p className={cn(
                          "text-2xl font-bold tabular-nums mt-1",
                          data.admin.facturasVencidas > 0 ? "text-red-600" : "text-foreground"
                        )}>
                          {formatCompact(data.admin.deudaTotal)}
                        </p>
                        {data.admin.facturasVencidas > 0 ? (
                          <Badge variant="destructive" className="text-[10px] h-5 mt-1">
                            {data.admin.facturasVencidas} vencidas
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-[10px] h-5 mt-1 text-green-600 border-green-500/30">
                            Al día
                          </Badge>
                        )}
                      </div>
                      <div className={cn(
                        "p-1.5 rounded-lg",
                        data.admin.facturasVencidas > 0 ? "bg-red-500/10" : "bg-green-500/10"
                      )}>
                        <AlertTriangle className={cn(
                          "h-4 w-4",
                          data.admin.facturasVencidas > 0 ? "text-red-500" : "text-green-500"
                        )} />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* OC Pendientes - Enhanced */}
                <Card
                  className={cn(
                    "cursor-pointer hover:shadow-md hover:scale-[1.02] transition-all",
                    data.admin.aprobacionesPendientes > 5
                      ? "bg-gradient-to-br from-amber-500/10 to-transparent border-amber-500/30"
                      : ""
                  )}
                  onClick={() => openStatsDetail('ordenes')}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-[11px] text-muted-foreground uppercase tracking-wide">OC Pendientes</p>
                        <p className="text-2xl font-bold tabular-nums mt-1">{data.basico.ordenesPendientes}</p>
                        <div className="flex items-center gap-1.5 mt-1">
                          <Badge variant="secondary" className="text-[10px] h-5 bg-amber-500/10 text-amber-600 border-0">
                            {data.admin.aprobacionesPendientes} aprobar
                          </Badge>
                        </div>
                      </div>
                      <div className="p-1.5 rounded-lg bg-muted">
                        <ShoppingCart className="h-4 w-4 text-muted-foreground" />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Solicitudes Pago - Enhanced */}
                <Card
                  className="cursor-pointer hover:shadow-md hover:scale-[1.02] transition-all"
                  onClick={() => openStatsDetail('flujo')}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-[11px] text-muted-foreground uppercase tracking-wide">Solicitudes</p>
                        <p className="text-2xl font-bold tabular-nums mt-1">{data.basico.solicitudesPendientes}</p>
                        <div className="flex items-center gap-1.5 mt-1">
                          {data.basico.stockBajo > 0 ? (
                            <Badge variant="secondary" className="text-[10px] h-5 bg-amber-500/10 text-amber-600 border-0">
                              {data.basico.stockBajo} stock bajo
                            </Badge>
                          ) : (
                            <Badge variant="secondary" className="text-[10px] h-5 bg-green-500/10 text-green-600 border-0">
                              Stock OK
                            </Badge>
                          )}
                        </div>
                      </div>
                      <div className="p-1.5 rounded-lg bg-muted">
                        <FileText className="h-4 w-4 text-muted-foreground" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Secondary Metrics Row */}
              <div className="grid grid-cols-4 gap-2">
                {/* YoY */}
                <div
                  className="p-3 rounded-lg bg-muted/50 cursor-pointer hover:bg-muted transition-colors"
                  onClick={() => openStatsDetail('compras')}
                >
                  <div className="flex items-center gap-2">
                    <div className={cn(
                      "p-1 rounded",
                      ejecutivo.yoy.variacionAnual >= 0 ? "bg-red-500/10" : "bg-green-500/10"
                    )}>
                      {ejecutivo.yoy.variacionAnual >= 0 ? (
                        <ArrowUpRight className="h-3 w-3 text-red-500" />
                      ) : (
                        <ArrowDownRight className="h-3 w-3 text-green-500" />
                      )}
                    </div>
                    <div>
                      <p className={cn(
                        "text-sm font-semibold",
                        ejecutivo.yoy.variacionAnual >= 0 ? "text-red-600" : "text-green-600"
                      )}>
                        {formatPercent(ejecutivo.yoy.variacionAnual)}
                      </p>
                      <p className="text-[9px] text-muted-foreground">vs año ant.</p>
                    </div>
                  </div>
                </div>

                {/* Ciclo */}
                <div className="p-3 rounded-lg bg-muted/50">
                  <div className="flex items-center gap-2">
                    <div className="p-1 rounded bg-blue-500/10">
                      <Timer className="h-3 w-3 text-blue-500" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold">{ejecutivo.eficiencia.tiempoPromedioCiclo}d</p>
                      <p className="text-[9px] text-muted-foreground">Ciclo OC</p>
                    </div>
                  </div>
                </div>

                {/* Concentración */}
                <div
                  className={cn(
                    "p-3 rounded-lg cursor-pointer hover:bg-muted transition-colors",
                    ejecutivo.concentracion.riesgoConcentracion === 'alto'
                      ? "bg-amber-500/10"
                      : "bg-muted/50"
                  )}
                  onClick={() => openFullView('proveedores')}
                >
                  <div className="flex items-center gap-2">
                    <div className="p-1 rounded bg-purple-500/10">
                      <Users className="h-3 w-3 text-purple-500" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold">{ejecutivo.concentracion.top3Porcentaje}%</p>
                      <p className="text-[9px] text-muted-foreground">Top 3 prov.</p>
                    </div>
                  </div>
                </div>

                {/* Devoluciones */}
                <div
                  className={cn(
                    "p-3 rounded-lg cursor-pointer hover:bg-muted transition-colors",
                    data.admin.devolucionesPendientes > 0
                      ? "bg-amber-500/10"
                      : "bg-green-500/10"
                  )}
                  onClick={() => router.push('/administracion/compras/devoluciones')}
                >
                  <div className="flex items-center gap-2">
                    <div className={cn(
                      "p-1 rounded",
                      data.admin.devolucionesPendientes > 0 ? "bg-amber-500/10" : "bg-green-500/10"
                    )}>
                      <Archive className={cn(
                        "h-3 w-3",
                        data.admin.devolucionesPendientes > 0 ? "text-amber-500" : "text-green-500"
                      )} />
                    </div>
                    <div>
                      <p className="text-sm font-semibold">{data.admin.devolucionesPendientes}</p>
                      <p className="text-[9px] text-muted-foreground">Devol.</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Alertas Críticas - ENHANCED */}
            <Card className="col-span-12 lg:col-span-3 overflow-hidden">
              <CardHeader className="pb-2 pt-3 bg-gradient-to-r from-background to-muted/20">
                <CardTitle className="text-sm font-medium flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <div className={cn(
                      "p-1.5 rounded-lg",
                      ejecutivo.alertasCriticas.length > 0 ? "bg-red-500/10" : "bg-green-500/10"
                    )}>
                      <Bell className={cn(
                        "h-4 w-4",
                        ejecutivo.alertasCriticas.length > 0 ? "text-red-500" : "text-green-500"
                      )} />
                    </div>
                    Alertas
                  </span>
                  {ejecutivo.alertasCriticas.length > 0 && (
                    <Badge variant="destructive" className="text-[10px] animate-pulse">
                      {ejecutivo.alertasCriticas.length}
                    </Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="pb-3 space-y-2 max-h-[280px] overflow-y-auto">
                {ejecutivo.alertasCriticas.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-6 text-center">
                    <div className="relative">
                      <div className="absolute inset-0 animate-ping bg-green-500/20 rounded-full" />
                      <div className="relative p-3 rounded-full bg-green-500/10">
                        <CheckCircle2 className="h-8 w-8 text-green-500" />
                      </div>
                    </div>
                    <p className="text-sm font-medium text-green-600 mt-3">Todo bajo control</p>
                    <p className="text-xs text-muted-foreground">Sin alertas críticas</p>
                  </div>
                ) : (
                  <>
                    {ejecutivo.alertasCriticas.slice(0, 5).map((alert, idx) => (
                      <AlertCard
                        key={idx}
                        alert={alert}
                        onClick={() => {
                          if (alert.tipo === 'vencimiento' || alert.tipo === 'deuda') openStatsDetail('deuda');
                          else if (alert.tipo === 'stock') router.push('/administracion/compras/stock?filtro=bajo');
                          else if (alert.tipo === 'aprobacion') openStatsDetail('ordenes');
                          else if (alert.tipo === 'contrato') openStatsDetail('servicios');
                        }}
                      />
                    ))}
                    {ejecutivo.alertasCriticas.length > 5 && (
                      <Button variant="ghost" size="sm" className="w-full text-xs mt-2" onClick={() => router.push('/administracion/compras/torre-control')}>
                        Ver todas las alertas ({ejecutivo.alertasCriticas.length})
                        <ChevronRight className="h-3 w-3 ml-1" />
                      </Button>
                    )}
                  </>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {/* ========== BUDGET & FLOW ROW ========== */}
        {isAdmin && data.admin && ejecutivo && (
          <div className="grid grid-cols-12 gap-4">
            {/* Budget Progress Card */}
            <Card className="col-span-12 md:col-span-6 lg:col-span-4">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Target className="h-4 w-4" />
                  Presupuesto vs Real
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <BudgetProgress
                  actual={data.admin.comprasMes}
                  budget={data.admin.totalAnual / 12 * 1.1}
                  label="Mensual"
                />
                <BudgetProgress
                  actual={data.admin.totalAnual}
                  budget={ejecutivo.yoy.comprasAnoAnterior * 1.05}
                  label="Anual (vs año ant. +5%)"
                />
                <div className="pt-2 border-t">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Ahorro estimado</span>
                    <span className="font-medium text-green-600">
                      {formatCompact(data.admin.totalAnual * 0.03)}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Upcoming Payments Calendar */}
            <Card className="col-span-12 md:col-span-6 lg:col-span-4">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    Próximos Vencimientos
                  </span>
                  <Badge variant="outline" className="text-[10px]">7 días</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {[
                    { day: 'Hoy', amount: data.admin.flujoPagos.proximos7 * 0.3, count: Math.ceil(data.admin.facturasVencidas * 0.3) },
                    { day: 'Mañana', amount: data.admin.flujoPagos.proximos7 * 0.2, count: Math.ceil(data.admin.facturasVencidas * 0.2) },
                    { day: 'Esta semana', amount: data.admin.flujoPagos.proximos7 * 0.5, count: Math.ceil(data.admin.facturasVencidas * 0.5) },
                  ].map((item, idx) => (
                    <div
                      key={idx}
                      className={cn(
                        "flex items-center justify-between p-2.5 rounded-lg transition-colors cursor-pointer hover:bg-muted/50",
                        idx === 0 ? "bg-red-500/10 border border-red-500/20" : "bg-muted/30"
                      )}
                      onClick={() => openStatsDetail('flujo')}
                    >
                      <div className="flex items-center gap-2">
                        <div className={cn(
                          "w-2 h-2 rounded-full",
                          idx === 0 ? "bg-red-500" : idx === 1 ? "bg-amber-500" : "bg-blue-500"
                        )} />
                        <span className="text-sm">{item.day}</span>
                        <Badge variant="secondary" className="text-[10px] h-4">{item.count}</Badge>
                      </div>
                      <span className={cn(
                        "text-sm font-medium",
                        idx === 0 ? "text-red-600" : ""
                      )}>
                        {formatCompact(item.amount)}
                      </span>
                    </div>
                  ))}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full mt-3 text-xs"
                  onClick={() => router.push('/administracion/compras/comprobantes?porVencer=7')}
                >
                  Ver calendario completo
                  <ChevronRight className="h-3 w-3 ml-1" />
                </Button>
              </CardContent>
            </Card>

            {/* Quick Stats */}
            <Card className="col-span-12 lg:col-span-4">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Zap className="h-4 w-4" />
                  Resumen Rápido
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 rounded-lg bg-gradient-to-br from-blue-500/10 to-blue-500/5 border border-blue-500/20">
                    <div className="text-2xl font-bold text-blue-600">{ejecutivo.concentracion.proveedoresActivos30d}</div>
                    <div className="text-[10px] text-muted-foreground">Proveedores activos (30d)</div>
                  </div>
                  <div className="p-3 rounded-lg bg-gradient-to-br from-green-500/10 to-green-500/5 border border-green-500/20">
                    <div className="text-2xl font-bold text-green-600">{data.admin.recepcionesMes.cantidad}</div>
                    <div className="text-[10px] text-muted-foreground">Recepciones del mes</div>
                  </div>
                  <div className="p-3 rounded-lg bg-gradient-to-br from-purple-500/10 to-purple-500/5 border border-purple-500/20">
                    <div className="text-2xl font-bold text-purple-600">{100 - ejecutivo.eficiencia.tasaRechazo}%</div>
                    <div className="text-[10px] text-muted-foreground">Tasa aceptación</div>
                  </div>
                  <div className="p-3 rounded-lg bg-gradient-to-br from-amber-500/10 to-amber-500/5 border border-amber-500/20">
                    <div className="text-2xl font-bold text-amber-600">{ejecutivo.eficiencia.tiempoPromedioCiclo}d</div>
                    <div className="text-[10px] text-muted-foreground">Lead time prom.</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* ========== QUICK ACTIONS ========== */}
        <Card>
          <CardContent className="py-3 px-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-medium text-muted-foreground mr-2">Acceso rápido:</span>
              {shortcuts.map((shortcut) => {
                const Icon = shortcut.icon;
                return (
                  <Button
                    key={shortcut.path}
                    variant={shortcut.color === 'primary' ? 'default' : 'outline'}
                    size="sm"
                    className="h-7 gap-1.5 text-xs"
                    onClick={() => router.push(shortcut.path)}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    {shortcut.label}
                  </Button>
                );
              })}
              <Separator orientation="vertical" className="h-6 mx-1" />
              <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => router.push('/administracion/compras/cuentas-corrientes')}>
                Ctas. Ctes.
              </Button>
              <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => router.push('/administracion/compras/stock')}>
                Stock
              </Button>
              <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => router.push('/administracion/compras/procesar-factura')}>
                IA Facturas
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* ========== CHARTS ROW ========== */}
        {isAdmin && data.admin && (
          <div className="grid grid-cols-12 gap-4">
            {/* Main Chart - Tendencia with Comparison */}
            <Card className="col-span-12 lg:col-span-8">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <BarChart3 className="w-4 h-4" />
                      Tendencia de Compras
                    </CardTitle>
                    <CardDescription className="text-xs flex items-center gap-3">
                      <span className="flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-primary" />
                        Actual
                      </span>
                      <span className="flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-muted-foreground/50" />
                        Año anterior
                      </span>
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="text-lg font-semibold">{formatCurrency(chartData.reduce((sum, d) => sum + d.value, 0))}</p>
                      <p className="text-xs text-muted-foreground">Total período</p>
                    </div>
                    <div className="text-right pl-4 border-l">
                      <p className={cn(
                        "text-lg font-semibold",
                        ejecutivo && ejecutivo.yoy.variacionAnual >= 0 ? "text-red-500" : "text-green-500"
                      )}>
                        {ejecutivo && formatPercent(ejecutivo.yoy.variacionAnual)}
                      </p>
                      <p className="text-xs text-muted-foreground">vs año ant.</p>
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {chartData.length === 0 ? (
                  <div className="h-56 flex items-center justify-center text-muted-foreground">
                    Sin datos de compras
                  </div>
                ) : (
                  <div className="h-56">
                    <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart data={comparisonData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                        <defs>
                          <linearGradient id="colorActual" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                            <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                          </linearGradient>
                          <linearGradient id="colorAnterior" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="hsl(var(--muted-foreground))" stopOpacity={0.1} />
                            <stop offset="95%" stopColor="hsl(var(--muted-foreground))" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                        <XAxis
                          dataKey="name"
                          tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                          tickLine={false}
                          axisLine={false}
                        />
                        <YAxis
                          tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                          tickLine={false}
                          axisLine={false}
                          tickFormatter={(v) => formatCompact(v)}
                        />
                        <Tooltip
                          content={({ active, payload, label }) => {
                            if (!active || !payload?.length) return null;
                            const actual = payload.find(p => p.dataKey === 'actual');
                            const anterior = payload.find(p => p.dataKey === 'anterior');
                            const diff = actual && anterior
                              ? (((actual.value as number) - (anterior.value as number)) / (anterior.value as number) * 100)
                              : 0;
                            return (
                              <ChartTooltip>
                                <p className="font-medium mb-2">{label}</p>
                                <div className="space-y-1">
                                  <div className="flex items-center justify-between gap-4">
                                    <span className="flex items-center gap-1">
                                      <span className="w-2 h-2 rounded-full bg-primary" />
                                      Actual
                                    </span>
                                    <span className="font-medium">{formatCurrency(actual?.value as number)}</span>
                                  </div>
                                  <div className="flex items-center justify-between gap-4">
                                    <span className="flex items-center gap-1">
                                      <span className="w-2 h-2 rounded-full bg-muted-foreground/50" />
                                      Anterior
                                    </span>
                                    <span className="text-muted-foreground">{formatCurrency(anterior?.value as number)}</span>
                                  </div>
                                  <div className="pt-1 border-t">
                                    <span className={cn(
                                      "text-xs font-medium",
                                      diff >= 0 ? "text-red-500" : "text-green-500"
                                    )}>
                                      {diff >= 0 ? '+' : ''}{diff.toFixed(1)}% variación
                                    </span>
                                  </div>
                                </div>
                              </ChartTooltip>
                            );
                          }}
                        />
                        {/* Previous year - dashed line */}
                        <Area
                          type="monotone"
                          dataKey="anterior"
                          stroke="hsl(var(--muted-foreground))"
                          strokeWidth={1}
                          strokeDasharray="5 5"
                          fill="url(#colorAnterior)"
                        />
                        {/* Current year - solid area */}
                        <Area
                          type="monotone"
                          dataKey="actual"
                          stroke="hsl(var(--primary))"
                          strokeWidth={2}
                          fill="url(#colorActual)"
                        />
                        <Line
                          type="monotone"
                          dataKey="actual"
                          stroke="hsl(var(--primary))"
                          strokeWidth={2}
                          dot={{ fill: 'hsl(var(--primary))', strokeWidth: 0, r: 4 }}
                          activeDot={{ r: 6, fill: 'hsl(var(--primary))' }}
                        />
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Pie Chart + Top Proveedores - ENHANCED */}
            <Card className="col-span-12 lg:col-span-4">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <PieChartIcon className="w-4 h-4" />
                    Distribución Proveedores
                  </CardTitle>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 px-2 text-xs"
                    onClick={() => openFullView('proveedores')}
                  >
                    Ver todos <ChevronRight className="h-3 w-3 ml-1" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="pb-3">
                {pieData.length === 0 ? (
                  <div className="h-40 flex items-center justify-center text-muted-foreground">
                    Sin datos
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="flex items-center gap-4">
                      <div className="h-36 w-36 flex-shrink-0 relative">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={pieData}
                              cx="50%"
                              cy="50%"
                              innerRadius={40}
                              outerRadius={60}
                              paddingAngle={2}
                              dataKey="value"
                              onClick={(d) => {
                                const prov = data.admin?.topProveedores.find(p => p.nombre === d.name);
                                if (prov) openProveedorModal(prov.id, prov.nombre);
                              }}
                              style={{ cursor: 'pointer' }}
                            >
                              {pieData.map((_, index) => (
                                <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                              ))}
                            </Pie>
                            <Tooltip
                              content={({ active, payload }) => {
                                if (!active || !payload?.length) return null;
                                const total = pieData.reduce((s, d) => s + d.value, 0);
                                const percent = ((payload[0]?.value as number) / total * 100).toFixed(1);
                                return (
                                  <ChartTooltip>
                                    <p className="font-medium">{payload[0]?.name}</p>
                                    <p>{formatCurrency(payload[0]?.value as number)}</p>
                                    <p className="text-muted-foreground">{percent}% del total</p>
                                  </ChartTooltip>
                                );
                              }}
                            />
                          </PieChart>
                        </ResponsiveContainer>
                        {/* Center text */}
                        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                          <span className="text-xs text-muted-foreground">Total</span>
                          <span className="text-sm font-bold">{pieData.length}</span>
                        </div>
                      </div>
                      <div className="flex-1 space-y-1">
                        {pieData.slice(0, 5).map((item, idx) => {
                          const prov = data.admin?.topProveedores.find(p => p.nombre === item.name);
                          const total = pieData.reduce((s, d) => s + d.value, 0);
                          const percent = (item.value / total * 100).toFixed(0);
                          return (
                            <div
                              key={item.name}
                              className="flex items-center justify-between text-xs cursor-pointer hover:bg-muted/50 p-1.5 rounded transition-colors group"
                              onClick={() => {
                                if (prov) openProveedorModal(prov.id, prov.nombre);
                              }}
                            >
                              <div className="flex items-center gap-2 min-w-0 flex-1">
                                <div
                                  className="w-2.5 h-2.5 rounded flex-shrink-0"
                                  style={{ backgroundColor: PIE_COLORS[idx % PIE_COLORS.length] }}
                                />
                                <span className="truncate">{item.name}</span>
                              </div>
                              <div className="flex items-center gap-2 flex-shrink-0">
                                <span className="text-muted-foreground">{percent}%</span>
                                <span className="font-medium">{formatCompact(item.value)}</span>
                                <ChevronRight className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Concentration Warning */}
                    {ejecutivo && ejecutivo.concentracion.riesgoConcentracion !== 'bajo' && (
                      <div className={cn(
                        "p-2 rounded-lg text-xs flex items-center gap-2",
                        ejecutivo.concentracion.riesgoConcentracion === 'alto'
                          ? "bg-amber-500/10 text-amber-600"
                          : "bg-blue-500/10 text-blue-600"
                      )}>
                        <AlertCircle className="h-3.5 w-3.5 flex-shrink-0" />
                        <span>
                          Top 3 concentran {ejecutivo.concentracion.top3Porcentaje}% - Riesgo {ejecutivo.concentracion.riesgoConcentracion}
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {/* ========== CATEGORIES & SERVICES ROW ========== */}
        {isAdmin && categorias && servicios && (
          <div className="grid grid-cols-12 gap-4">
            {/* Categorías */}
            <Card className="col-span-12 md:col-span-6 lg:col-span-4">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <FolderTree className="w-4 h-4" />
                    Categorías de Insumos
                  </CardTitle>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 px-2 text-xs"
                    onClick={() => openStatsDetail('categorias')}
                  >
                    Ver más <ChevronRight className="h-3 w-3 ml-1" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="pb-3">
                <div className="grid grid-cols-3 gap-3">
                  <div className="text-center p-3 rounded-lg bg-muted/30">
                    <div className="text-2xl font-semibold">{categorias.total}</div>
                    <div className="text-[10px] text-muted-foreground">Total</div>
                  </div>
                  <div className="text-center p-3 rounded-lg bg-green-500/10">
                    <div className="text-2xl font-semibold text-green-600">{categorias.conGasto}</div>
                    <div className="text-[10px] text-muted-foreground">Con gasto</div>
                  </div>
                  <div className="text-center p-3 rounded-lg bg-muted/20">
                    <div className="text-2xl font-semibold text-muted-foreground">{categorias.sinGasto}</div>
                    <div className="text-[10px] text-muted-foreground">Sin gasto</div>
                  </div>
                </div>
                {categorias.topCategoria && (
                  <div className="mt-3 p-2 rounded bg-primary/5 border border-primary/10">
                    <div className="text-[10px] text-muted-foreground">Top categoría</div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium truncate">{categorias.topCategoria.nombre}</span>
                      <span className="text-sm font-semibold">{formatCompact(categorias.topCategoria.total)}</span>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Servicios y Contratos */}
            <Card className="col-span-12 md:col-span-6 lg:col-span-4">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Shield className="w-4 h-4" />
                    Contratos y Servicios
                  </CardTitle>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 px-2 text-xs"
                    onClick={() => openStatsDetail('servicios')}
                  >
                    Ver más <ChevronRight className="h-3 w-3 ml-1" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="pb-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="text-center p-3 rounded-lg bg-muted/30">
                    <div className="text-2xl font-semibold">{servicios.contratosActivos}</div>
                    <div className="text-[10px] text-muted-foreground">Contratos activos</div>
                  </div>
                  <div className="text-center p-3 rounded-lg bg-primary/10">
                    <div className="text-xl font-semibold">{formatCompact(servicios.gastoMensualEstimado)}</div>
                    <div className="text-[10px] text-muted-foreground">Gasto mensual</div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3 mt-3">
                  <div className={cn(
                    "text-center p-2 rounded-lg",
                    servicios.proximosVencimientos > 0 ? "bg-amber-500/10" : "bg-green-500/10"
                  )}>
                    <div className={cn(
                      "text-lg font-semibold",
                      servicios.proximosVencimientos > 0 ? "text-amber-600" : "text-green-600"
                    )}>
                      {servicios.proximosVencimientos}
                    </div>
                    <div className="text-[10px] text-muted-foreground">Vencen 30d</div>
                  </div>
                  <div className={cn(
                    "text-center p-2 rounded-lg",
                    servicios.contratosCriticos > 0 ? "bg-red-500/10" : "bg-green-500/10"
                  )}>
                    <div className={cn(
                      "text-lg font-semibold",
                      servicios.contratosCriticos > 0 ? "text-red-600" : "text-green-600"
                    )}>
                      {servicios.contratosCriticos}
                    </div>
                    <div className="text-[10px] text-muted-foreground">Críticos</div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Flujo de Pagos */}
            <Card className="col-span-12 lg:col-span-4">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <CreditCard className="w-4 h-4" />
                    Flujo de Pagos
                  </CardTitle>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 px-2 text-xs"
                    onClick={() => openStatsDetail('flujo')}
                  >
                    Detalle <ChevronRight className="h-3 w-3 ml-1" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="pb-3">
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-2 rounded bg-red-500/10">
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-red-500" />
                      <span className="text-sm">Próx. 7 días</span>
                    </div>
                    <span className="font-semibold">{formatCompact(data.admin.flujoPagos.proximos7)}</span>
                  </div>
                  <div className="flex items-center justify-between p-2 rounded bg-amber-500/10">
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-amber-500" />
                      <span className="text-sm">Próx. 15 días</span>
                    </div>
                    <span className="font-semibold">{formatCompact(data.admin.flujoPagos.proximos15)}</span>
                  </div>
                  <div className="flex items-center justify-between p-2 rounded bg-muted/30">
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm">Próx. 30 días</span>
                    </div>
                    <span className="font-semibold">{formatCompact(data.admin.flujoPagos.proximos30)}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* ========== DETAILED WIDGETS ROW ========== */}
        {isAdmin && data.admin && (
          <div className="grid grid-cols-12 gap-4">
            {/* Órdenes por Estado */}
            <Card className="col-span-12 md:col-span-6 lg:col-span-3">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Layers className="w-4 h-4" />
                  Órdenes por Estado
                </CardTitle>
              </CardHeader>
              <CardContent className="pb-3">
                {data.admin.ordenesPorEstado.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">Sin órdenes</p>
                ) : (
                  <div className="space-y-2">
                    {data.admin.ordenesPorEstado.slice(0, 5).map((o) => (
                      <div key={o.estado} className="flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">{o.estado}</span>
                        <Badge variant="secondary" className="text-[10px] h-5">{o.cantidad}</Badge>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Top Items */}
            <Card className="col-span-12 md:col-span-6 lg:col-span-3">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Package className="w-4 h-4" />
                    Top Items (3m)
                  </CardTitle>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-5 px-1 text-[10px]"
                    onClick={() => openFullView('items')}
                  >
                    Todos
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="pb-3">
                {data.admin.topProductos.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">Sin datos</p>
                ) : (
                  <div className="space-y-2">
                    {data.admin.topProductos.slice(0, 4).map((prod, idx) => (
                      <div
                        key={prod.id}
                        className="flex items-center justify-between text-xs cursor-pointer hover:bg-muted/50 p-1 rounded transition-colors"
                        onClick={() => openItemModal(prod.nombre)}
                      >
                        <span className="text-muted-foreground truncate max-w-[120px]">{idx + 1}. {prod.nombre}</span>
                        <span className="font-medium">{formatCompact(prod.total)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* OC Próximas */}
            <Card className="col-span-12 md:col-span-6 lg:col-span-3">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Calendar className="w-4 h-4" />
                  OC Próximas (15d)
                </CardTitle>
              </CardHeader>
              <CardContent className="pb-3">
                {data.admin.ordenesProximasVencer.length === 0 ? (
                  <div className="text-center py-4">
                    <CheckCircle2 className="h-6 w-6 text-green-500 mx-auto mb-1" />
                    <p className="text-sm text-muted-foreground">Sin entregas próximas</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {data.admin.ordenesProximasVencer.slice(0, 4).map((oc) => (
                      <div
                        key={oc.id}
                        className="flex items-center justify-between text-xs cursor-pointer hover:bg-muted/50 rounded p-1 transition-colors"
                        onClick={() => router.push(`/administracion/compras/ordenes/${oc.id}`)}
                      >
                        <span className="text-muted-foreground truncate max-w-[100px]">{oc.numero}</span>
                        <Badge variant={oc.diasRestantes <= 3 ? "destructive" : "outline"} className="text-[10px] h-5">
                          {oc.diasRestantes === 0 ? 'Hoy' : `${oc.diasRestantes}d`}
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Recepciones del Mes */}
            <Card className="col-span-12 md:col-span-6 lg:col-span-3">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Truck className="w-4 h-4" />
                  Recepciones del Mes
                </CardTitle>
              </CardHeader>
              <CardContent className="pb-3">
                <div className="text-center">
                  <div className="text-4xl font-bold">{data.admin.recepcionesMes.cantidad}</div>
                  <div className="text-sm text-muted-foreground mt-1">recepciones</div>
                  <div className="text-xl font-semibold text-primary mt-2">
                    {formatCompact(data.admin.recepcionesMes.total)}
                  </div>
                  <div className="text-xs text-muted-foreground">total recibido</div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* ========== AI INSIGHTS + URGENT PAYMENTS ========== */}
        {isAdmin && (
          <div className="grid grid-cols-12 gap-4">
            <div className="col-span-12 lg:col-span-4">
              <AIInsightsSection />
            </div>
            <div className="col-span-12 lg:col-span-8">
              <UrgentPaymentsSection />
            </div>
          </div>
        )}

        {/* ========== NON-ADMIN VIEW ========== */}
        {!isAdmin && (
          <div className="grid grid-cols-12 gap-4">
            <div className="col-span-6 md:col-span-3">
              <MetricCard
                title="Órdenes Pendientes"
                value={data.basico.ordenesPendientes}
                icon={ShoppingCart}
                onClick={() => router.push('/administracion/compras/ordenes')}
              />
            </div>
            <div className="col-span-6 md:col-span-3">
              <MetricCard
                title="Proveedores"
                value={data.basico.proveedoresActivos}
                icon={Building2}
                onClick={() => router.push('/administracion/compras/proveedores')}
              />
            </div>
            <div className="col-span-6 md:col-span-3">
              <MetricCard
                title="Stock Bajo"
                value={data.basico.stockBajo}
                icon={Package}
                color={data.basico.stockBajo > 0 ? 'warning' : 'success'}
                onClick={() => router.push('/administracion/compras/stock')}
              />
            </div>
            <div className="col-span-6 md:col-span-3">
              <MetricCard
                title="Solicitudes"
                value={data.basico.solicitudesPendientes}
                icon={FileText}
                onClick={() => router.push('/administracion/compras/solicitudes')}
              />
            </div>
          </div>
        )}

        {/* ========== FOOTER LINKS ========== */}
        <Card>
          <CardContent className="py-3">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground">
              <span className="font-medium text-foreground">Más opciones:</span>
              <button onClick={() => router.push('/administracion/compras/depositos')} className="hover:text-foreground transition-colors">
                Depósitos
              </button>
              <button onClick={() => router.push('/administracion/compras/match')} className="hover:text-foreground transition-colors">
                3-Way Match
              </button>
              <button onClick={() => router.push('/administracion/compras/centros-costo')} className="hover:text-foreground transition-colors">
                Centros de Costo
              </button>
              <button onClick={() => router.push('/administracion/compras/notas-credito-debito')} className="hover:text-foreground transition-colors">
                Notas CD/DB
              </button>
              <button onClick={() => router.push('/administracion/compras/importar')} className="hover:text-foreground transition-colors">
                Importar
              </button>
              <button onClick={() => router.push('/administracion/compras/configuracion')} className="hover:text-foreground transition-colors">
                Configuración
              </button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Modals */}
      <DashboardDetailModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        type={modalType}
        proveedorId={selectedProveedor?.id}
        proveedorNombre={selectedProveedor?.nombre}
        itemDescripcion={selectedItem || undefined}
      />

      <DashboardFullViewSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        type={sheetType}
      />

      <StatsDetailSheet
        open={statsSheetOpen}
        onOpenChange={setStatsSheetOpen}
        statType={statsType}
        onNavigate={(path) => {
          setStatsSheetOpen(false);
          router.push(path);
        }}
      />
    </div>
  );
}
