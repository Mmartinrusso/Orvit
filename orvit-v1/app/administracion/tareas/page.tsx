"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

/**
 * Redirect from old /administracion/tareas to unified /administracion/agenda
 * Preserves tab and query params for backwards compatibility (e.g., notification links).
 */
export default function TareasRedirect() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    // Build the new URL preserving relevant query params
    const params = new URLSearchParams();

    const tab = searchParams.get('tab');
    const openTask = searchParams.get('openTask');
    const type = searchParams.get('type');

    // Map tab to the unified agenda tab name (they're the same)
    if (tab) params.set('tab', tab);
    if (openTask) params.set('openTask', openTask);
    if (type) params.set('type', type);

    // Default to "tareas" tab when coming from old route without a specific tab
    if (!tab) params.set('tab', 'tareas');

    const queryString = params.toString();
    router.replace(`/administracion/agenda${queryString ? `?${queryString}` : ''}`);
  }, [router, searchParams]);

  return (
    <div className="flex items-center justify-center h-64">
      <div className="flex items-center space-x-2">
        <div className="animate-spin h-4 w-4 border-2 border-primary border-t-transparent rounded-full" />
        <span className="text-sm text-muted-foreground">Redirigiendo a Agenda...</span>
      </div>
    </div>
  );
}
