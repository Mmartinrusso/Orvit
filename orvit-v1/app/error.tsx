'use client';

import { useEffect } from 'react';
import { AlertCircle, RefreshCw, Home } from 'lucide-react';
import * as Sentry from '@sentry/nextjs';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('App error:', error);
    Sentry.captureException(error);
  }, [error]);

  const isDbError = error.message?.includes('database') ||
    error.message?.includes('prisma') ||
    error.message?.includes('connection');

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="text-center max-w-md">
        <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mx-auto mb-4">
          <AlertCircle className="h-8 w-8 text-destructive" />
        </div>
        <h2 className="text-xl font-semibold text-foreground mb-2">
          {isDbError ? 'Error de conexión' : 'Algo salió mal'}
        </h2>
        <p className="text-sm text-muted-foreground mb-6">
          {isDbError
            ? 'No se pudo conectar con el servidor. Verificá tu conexión e intentá de nuevo.'
            : 'Ocurrió un error inesperado. Intentá recargar la página.'}
        </p>
        <div className="flex items-center justify-center gap-3">
          <button
            onClick={reset}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
          >
            <RefreshCw className="h-4 w-4" />
            Reintentar
          </button>
          <a
            href="/empresas"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-border text-sm font-medium hover:bg-muted transition-colors"
          >
            <Home className="h-4 w-4" />
            Inicio
          </a>
        </div>
        {error.digest && (
          <p className="text-xs text-muted-foreground mt-4">
            Código: {error.digest}
          </p>
        )}
      </div>
    </div>
  );
}
