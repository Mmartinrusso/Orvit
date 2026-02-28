'use client';

import { ReactNode } from 'react';
import { PermissionGuard } from '@/components/auth/PermissionGuard';

interface VentasLayoutProps {
  children: ReactNode;
}

export default function VentasLayout({ children }: VentasLayoutProps) {
  return (
    <PermissionGuard permission="ventas.ingresar">
      <div className="h-full w-full">
        <div className="container mx-auto p-4 md:p-6 max-w-[1600px]">
          {children}
        </div>
      </div>
    </PermissionGuard>
  );
}
