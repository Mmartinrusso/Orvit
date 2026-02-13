'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';

/**
 * Redirige a /administracion/configuracion?tab=company
 * La configuración de Discord ahora está en Configuración > Empresa > Discord
 */
export default function DiscordRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/administracion/configuracion?tab=company');
  }, [router]);

  return (
    <div className="flex items-center justify-center h-[60vh]">
      <div className="flex flex-col items-center gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">Redirigiendo a Configuración...</p>
      </div>
    </div>
  );
}
