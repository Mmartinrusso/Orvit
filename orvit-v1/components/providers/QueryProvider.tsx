'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
// import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { useState, type ReactNode } from 'react';

interface QueryProviderProps {
  children: ReactNode;
}

/**
 * ✨ PROVIDER OPTIMIZADO: React Query para toda la aplicación
 * 
 * Configuración de alto rendimiento:
 * - retry: 1 (solo 1 reintento en caso de error)
 * - refetchOnWindowFocus: false (no refetch al volver a la ventana)
 * - refetchOnMount: false (no refetch al montar si hay datos en cache)
 * - refetchOnReconnect: false (no refetch al reconectar)
 * - staleTime: 5 minutos (datos considerados frescos por más tiempo)
 * - gcTime: 30 minutos (mantener en cache más tiempo)
 */
export function QueryProvider({ children }: QueryProviderProps) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            retry: 1,
            refetchOnWindowFocus: false,
            refetchOnMount: false,
            refetchOnReconnect: false,
            staleTime: 5 * 60 * 1000, // 5 minutos - datos frescos por más tiempo
            gcTime: 30 * 60 * 1000, // 30 minutos - mantener en cache
          },
          mutations: {
            retry: 0,
          },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      {/* Devtools desactivados */}
      {/* {process.env.NODE_ENV === 'development' && (
        <ReactQueryDevtools initialIsOpen={false} position="bottom" />
      )} */}
    </QueryClientProvider>
  );
}
