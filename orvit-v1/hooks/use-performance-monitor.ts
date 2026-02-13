'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

interface PerformanceMetrics {
  cacheHits: number;
  cacheMisses: number;
  cacheHitRate: number;
  totalCacheEntries: number;
  pendingRequests: number;
  totalRequests: number;
  deduplicatedRequests: number;
  savedRequests: number;
  averageResponseTime: number;
  fastestResponse: number;
  slowestResponse: number;
  cacheByType: {
    static: number;
    medium: number;
    dynamic: number;
    critical: number;
  };
}

// Almacenamiento global de métricas
const performanceMetrics = {
  cacheHits: 0,
  cacheMisses: 0,
  totalRequests: 0,
  deduplicatedRequests: 0,
  responseTimes: [] as number[],
  startTime: Date.now(),
};

// Funciones para registrar eventos de cache
export const recordCacheHit = () => {
  performanceMetrics.cacheHits++;
};

export const recordCacheMiss = () => {
  performanceMetrics.cacheMisses++;
};

export const recordDeduplication = () => {
  performanceMetrics.deduplicatedRequests++;
};

export const recordRequest = (responseTime: number) => {
  performanceMetrics.totalRequests++;
  performanceMetrics.responseTimes.push(responseTime);
  if (performanceMetrics.responseTimes.length > 100) {
    performanceMetrics.responseTimes.shift();
  }
};

/**
 * ✨ HOOK: Monitor de rendimiento del sistema
 */
export function usePerformanceMonitor() {
  const [metrics, setMetrics] = useState<PerformanceMetrics | null>(null);
  const [isMonitoring, setIsMonitoring] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const calculateMetrics = useCallback((): PerformanceMetrics => {
    const totalCacheOperations = performanceMetrics.cacheHits + performanceMetrics.cacheMisses;
    const responseTimes = performanceMetrics.responseTimes;
    
    return {
      cacheHits: performanceMetrics.cacheHits,
      cacheMisses: performanceMetrics.cacheMisses,
      cacheHitRate: totalCacheOperations > 0 
        ? (performanceMetrics.cacheHits / totalCacheOperations) * 100 
        : 0,
      totalCacheEntries: 0, // Se puede conectar con el cache global
      pendingRequests: 0,
      totalRequests: performanceMetrics.totalRequests,
      deduplicatedRequests: performanceMetrics.deduplicatedRequests,
      savedRequests: performanceMetrics.deduplicatedRequests + performanceMetrics.cacheHits,
      averageResponseTime: responseTimes.length > 0 
        ? responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length 
        : 0,
      fastestResponse: responseTimes.length > 0 ? Math.min(...responseTimes) : 0,
      slowestResponse: responseTimes.length > 0 ? Math.max(...responseTimes) : 0,
      cacheByType: { static: 0, medium: 0, dynamic: 0, critical: 0 },
    };
  }, []);

  const startMonitoring = useCallback(() => {
    if (intervalRef.current) return () => {};
    
    setIsMonitoring(true);
    intervalRef.current = setInterval(() => {
      setMetrics(calculateMetrics());
    }, 1000);
    
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      setIsMonitoring(false);
    };
  }, [calculateMetrics]);

  const stopMonitoring = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setIsMonitoring(false);
  }, []);

  const resetMetrics = useCallback(() => {
    performanceMetrics.cacheHits = 0;
    performanceMetrics.cacheMisses = 0;
    performanceMetrics.totalRequests = 0;
    performanceMetrics.deduplicatedRequests = 0;
    performanceMetrics.responseTimes = [];
    performanceMetrics.startTime = Date.now();
    setMetrics(null);
  }, []);

  const getPerformanceReport = useCallback(() => {
    const currentMetrics = calculateMetrics();
    const uptime = Date.now() - performanceMetrics.startTime;
    
    return {
      ...currentMetrics,
      uptime,
      requestsPerMinute: (currentMetrics.totalRequests / (uptime / 60000)).toFixed(2),
      cacheEfficiency: {
        excellent: currentMetrics.cacheHitRate >= 80,
        good: currentMetrics.cacheHitRate >= 60,
        poor: currentMetrics.cacheHitRate < 40,
      },
      networkSavings: {
        requestsSaved: currentMetrics.savedRequests,
        percentageSaved: currentMetrics.totalRequests > 0 
          ? ((currentMetrics.savedRequests / currentMetrics.totalRequests) * 100).toFixed(1)
          : '0',
      },
    };
  }, [calculateMetrics]);

  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      const cleanup = startMonitoring();
      return cleanup;
    }
  }, [startMonitoring]);

  return {
    metrics,
    isMonitoring,
    startMonitoring,
    stopMonitoring,
    resetMetrics,
    getPerformanceReport,
  };
}

export function usePerformanceStats() {
  const { metrics, getPerformanceReport } = usePerformanceMonitor();
  
  return {
    cacheHitRate: metrics?.cacheHitRate || 0,
    savedRequests: metrics?.savedRequests || 0,
    averageResponseTime: metrics?.averageResponseTime || 0,
    getReport: getPerformanceReport,
  };
}
