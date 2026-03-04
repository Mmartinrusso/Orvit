'use client';

import { Suspense } from 'react';
import dynamic from 'next/dynamic';

const AgendaV2Page = dynamic(
  () => import('@/components/agendav2/AgendaV2Page').then(m => ({ default: m.AgendaV2Page })),
  {
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center h-64 gap-2">
        <div className="animate-spin h-4 w-4 border-2 border-gray-300 border-t-gray-600 rounded-full" />
        <span className="text-sm text-muted-foreground">Cargando agenda...</span>
      </div>
    ),
  }
);

export default function AgendaPage() {
  return (
    <Suspense>
      <AgendaV2Page />
    </Suspense>
  );
}
