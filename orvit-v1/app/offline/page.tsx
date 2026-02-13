'use client';

import { WifiOff, RefreshCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function OfflinePage() {
  const handleRetry = () => {
    window.location.reload();
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="text-center max-w-md">
        <div className="mb-6">
          <div className="mx-auto w-20 h-20 bg-gray-200 rounded-full flex items-center justify-center mb-4">
            <WifiOff className="h-10 w-10 text-gray-500" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            Sin conexión
          </h1>
          <p className="text-gray-600">
            No tienes conexión a internet. Verifica tu conexión e intenta de nuevo.
          </p>
        </div>

        <Button onClick={handleRetry} className="w-full">
          <RefreshCcw className="h-4 w-4 mr-2" />
          Reintentar
        </Button>

        <p className="mt-6 text-sm text-gray-500">
          Algunas funciones de ORVIT requieren conexión a internet para funcionar correctamente.
        </p>
      </div>
    </div>
  );
}
