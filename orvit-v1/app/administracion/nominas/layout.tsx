'use client';

import { ReactNode } from 'react';

interface NominasLayoutProps {
  children: ReactNode;
}

export default function NominasLayout({ children }: NominasLayoutProps) {
  // Simple layout que solo pasa el children sin interferir con el MainLayout
  return <>{children}</>;
}
