/**
 * UTILIDADES DE PERFORMANCE PARA REACT
 * 
 * Helpers y wrappers para optimización de componentes
 */

import React, { ComponentType, LazyExoticComponent } from 'react';
import dynamic from 'next/dynamic';

// ============================================================================
// SKELETON COMPONENTS
// ============================================================================

/**
 * Skeleton genérico para estados de carga
 */
export const Skeleton = ({ className = '', height = '20px', width = '100%' }: {
  className?: string;
  height?: string;
  width?: string;
}) => {
  return (
    <div
      className={`animate-pulse bg-muted rounded ${className}`}
      style={{ height, width }}
    />
  );
};

/**
 * Skeleton para tablas
 */
export const TableSkeleton = ({ rows = 5, cols = 4 }: { rows?: number; cols?: number }) => {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <div key={rowIndex} className="flex gap-4">
          {Array.from({ length: cols }).map((_, colIndex) => (
            <Skeleton key={colIndex} height="40px" width={`${100 / cols}%`} />
          ))}
        </div>
      ))}
    </div>
  );
};

/**
 * Skeleton para cards
 */
export const CardSkeleton = () => {
  return (
    <div className="border rounded-lg p-4 space-y-3">
      <Skeleton height="24px" width="60%" />
      <Skeleton height="16px" width="80%" />
      <Skeleton height="16px" width="40%" />
    </div>
  );
};

/**
 * Skeleton para dashboard
 */
export const DashboardSkeleton = () => {
  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <CardSkeleton key={i} />
        ))}
      </div>
      
      {/* Gráfico principal */}
      <div className="border rounded-lg p-4">
        <Skeleton height="300px" width="100%" />
      </div>
      
      {/* Tabla */}
      <TableSkeleton rows={5} cols={5} />
    </div>
  );
};

// ============================================================================
// LAZY LOADING WRAPPERS
// ============================================================================

/**
 * Wrapper para lazy loading de componentes con skeleton
 */
export function lazyLoadWithSkeleton<T extends ComponentType<any>>(
  importFunc: () => Promise<{ default: T }>,
  SkeletonComponent: ComponentType = () => <Skeleton height="200px" />,
  options?: {
    ssr?: boolean;
  }
): LazyExoticComponent<T> {
  return dynamic(importFunc, {
    loading: () => <SkeletonComponent />,
    ssr: options?.ssr ?? true,
  });
}

/**
 * Lazy load específico para dashboards (sin SSR)
 */
export function lazyLoadDashboard<T extends ComponentType<any>>(
  importFunc: () => Promise<{ default: T }>
): LazyExoticComponent<T> {
  return dynamic(importFunc, {
    loading: () => <DashboardSkeleton />,
    ssr: false, // Dashboards no necesitan SSR
  });
}

/**
 * Lazy load específico para modales (sin SSR)
 */
export function lazyLoadModal<T extends ComponentType<any>>(
  importFunc: () => Promise<{ default: T }>
): LazyExoticComponent<T> {
  return dynamic(importFunc, {
    loading: () => null, // Modales no muestran skeleton
    ssr: false,
  });
}

// ============================================================================
// MEMOIZATION HELPERS
// ============================================================================

/**
 * Comparador shallow para React.memo
 */
export function shallowEqual(objA: any, objB: any): boolean {
  if (Object.is(objA, objB)) {
    return true;
  }

  if (
    typeof objA !== 'object' ||
    objA === null ||
    typeof objB !== 'object' ||
    objB === null
  ) {
    return false;
  }

  const keysA = Object.keys(objA);
  const keysB = Object.keys(objB);

  if (keysA.length !== keysB.length) {
    return false;
  }

  for (let i = 0; i < keysA.length; i++) {
    const key = keysA[i];
    if (
      !Object.prototype.hasOwnProperty.call(objB, key) ||
      !Object.is(objA[key], objB[key])
    ) {
      return false;
    }
  }

  return true;
}

/**
 * Comparador para items de lista (solo compara ID y campos críticos)
 */
export function createListItemComparator<T extends { id: number | string }>(
  criticalFields: (keyof T)[] = []
) {
  return (prevProps: { item: T }, nextProps: { item: T }): boolean => {
    // Siempre comparar ID
    if (prevProps.item.id !== nextProps.item.id) {
      return false;
    }

    // Comparar campos críticos
    for (const field of criticalFields) {
      if (prevProps.item[field] !== nextProps.item[field]) {
        return false;
      }
    }

    return true;
  };
}

// ============================================================================
// PERFORMANCE MONITORING
// ============================================================================

/**
 * Hook para medir performance de componente (desarrollo)
 */
export function usePerformanceMonitor(componentName: string) {
  if (process.env.NODE_ENV === 'development') {
    const renderCountRef = React.useRef(0);

    React.useEffect(() => {
      renderCountRef.current += 1;
      console.log(`[Performance] ${componentName} rendered ${renderCountRef.current} times`);
    });

    return {
      renderCount: renderCountRef.current,
      logRender: () => console.log(`[Performance] ${componentName} rendered`),
    };
  }

  return {
    renderCount: 0,
    logRender: () => {},
  };
}

/**
 * HOC para medir renders de componente
 */
export function withPerformanceMonitor<P extends object>(
  Component: ComponentType<P>,
  componentName?: string
): ComponentType<P> {
  const name = componentName || Component.displayName || Component.name || 'Component';

  return (props: P) => {
    usePerformanceMonitor(name);
    return <Component {...props} />;
  };
}

// ============================================================================
// TAB OPTIMIZATION
// ============================================================================

/**
 * Hook para lazy mount de tabs
 */
export function useLazyTab(tabValue: string, activeTab: string) {
  const hasBeenActiveRef = React.useRef(false);

  React.useEffect(() => {
    if (activeTab === tabValue) {
      hasBeenActiveRef.current = true;
    }
  }, [activeTab, tabValue]);

  return {
    isActive: activeTab === tabValue,
    shouldMount: hasBeenActiveRef.current, // Solo monta una vez que fue activa
    shouldRender: activeTab === tabValue, // Renderiza solo cuando está activa
  };
}

// ============================================================================
// DEBOUNCE Y THROTTLE
// ============================================================================

/**
 * Hook para debounce de valores
 */
export function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = React.useState<T>(value);

  React.useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

/**
 * Hook para throttle de funciones
 */
export function useThrottle<T extends (...args: any[]) => any>(
  func: T,
  delay: number
): T {
  const lastRunRef = React.useRef<number>(0);
  const timeoutRef = React.useRef<NodeJS.Timeout>();

  return React.useCallback(
    ((...args: Parameters<T>) => {
      const now = Date.now();

      if (now - lastRunRef.current >= delay) {
        func(...args);
        lastRunRef.current = now;
      } else {
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
        }
        timeoutRef.current = setTimeout(() => {
          func(...args);
          lastRunRef.current = Date.now();
        }, delay - (now - lastRunRef.current));
      }
    }) as T,
    [func, delay]
  );
}

// ============================================================================
// EXPORTS
// ============================================================================

export default {
  Skeleton,
  TableSkeleton,
  CardSkeleton,
  DashboardSkeleton,
  lazyLoadWithSkeleton,
  lazyLoadDashboard,
  lazyLoadModal,
  shallowEqual,
  createListItemComparator,
  usePerformanceMonitor,
  withPerformanceMonitor,
  useLazyTab,
  useDebounce,
  useThrottle,
};

