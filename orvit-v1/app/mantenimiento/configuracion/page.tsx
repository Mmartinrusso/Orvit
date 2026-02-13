'use client';

import { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

/**
 * Redirige a /administracion/configuracion
 * La página de configuración es la misma para ambos módulos
 */
export default function ConfiguracionRedirect() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const tab = searchParams?.get('tab');
    const targetUrl = tab
      ? `/administracion/configuracion?tab=${tab}`
      : '/administracion/configuracion';
    router.replace(targetUrl);
  }, [router, searchParams]);

  return (
    <div className="h-screen flex items-center justify-center">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
    </div>
  );
}
