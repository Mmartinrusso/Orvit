'use client';

import { ReactNode } from 'react';

interface ComprasLayoutProps {
  children: ReactNode;
}

export default function ComprasLayout({ children }: ComprasLayoutProps) {
  // Simple layout que solo pasa el children sin interferir con el MainLayout
  return <>{children}</>;
}

