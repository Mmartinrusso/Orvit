'use client';

import MainLayout from '@/components/layout/MainLayout';

interface CuentaLayoutProps {
  children: React.ReactNode;
}

export default function CuentaLayout({ children }: CuentaLayoutProps) {
  return (
    <MainLayout>
      {children}
    </MainLayout>
  );
}
