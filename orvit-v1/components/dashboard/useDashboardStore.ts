import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type ComparisonMode = '2months' | 'range-vs-range' | 'multi-mes' | 'yoy' | 'index100';
export type TimeRange = '3m' | '6m' | '12m' | '24m' | 'custom';
export type ViewMode = 'compact' | 'detailed';
export type ChartType = 'barras' | 'linea' | 'area' | 'pastel' | 'waterfall';
export type Category = 'all' | 'ventas' | 'costos' | 'sueldos' | 'produccion' | 'insumos';

export interface TimeRangeSelection {
  start: string;
  end: string;
}

export interface DashboardFilters {
  comparisonMode: ComparisonMode;
  timeRange: TimeRange;
  customRange?: TimeRangeSelection;
  rangeA?: TimeRangeSelection;
  rangeB?: TimeRangeSelection;
  baseMonth?: string;
  category: Category;
  chartType: ChartType;
  viewMode: ViewMode;
  nominalVsAdjusted: 'nominal' | 'adjusted';
  fxNormalized: boolean;
  showOnlyVariationsAbove: number;
  showOutliers: boolean;
  selectedMonths: string[];
  pinnedMonths: string[];
}

interface DashboardStore {
  filters: DashboardFilters;
  updateFilter: <K extends keyof DashboardFilters>(key: K, value: DashboardFilters[K]) => void;
  resetFilters: () => void;
  saveView: (name: string) => void;
  loadView: (name: string) => void;
}

const defaultFilters: DashboardFilters = {
  comparisonMode: '2months',
  timeRange: '12m',
  category: 'all',
  chartType: 'barras',
  viewMode: 'detailed',
  nominalVsAdjusted: 'nominal',
  fxNormalized: false,
  showOnlyVariationsAbove: 0,
  showOutliers: true,
  selectedMonths: [],
  pinnedMonths: [],
};

export const useDashboardStore = create<DashboardStore>()(
  persist(
    (set, get) => ({
      filters: defaultFilters,
      
      updateFilter: (key, value) =>
        set((state) => ({
          filters: { ...state.filters, [key]: value },
        })),
      
      resetFilters: () =>
        set({ filters: defaultFilters }),
      
      saveView: (name: string) => {
        const currentFilters = get().filters;
        const savedViews = JSON.parse(localStorage.getItem('dashboard-views') || '{}');
        savedViews[name] = currentFilters;
        localStorage.setItem('dashboard-views', JSON.stringify(savedViews));
      },
      
      loadView: (name: string) => {
        const savedViews = JSON.parse(localStorage.getItem('dashboard-views') || '{}');
        const view = savedViews[name];
        if (view) {
          set({ filters: view });
        }
      },
    }),
    {
      name: 'dashboard-store',
      partialize: (state) => ({ filters: state.filters }),
    }
  )
);
