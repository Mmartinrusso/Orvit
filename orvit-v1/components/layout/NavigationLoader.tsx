'use client';

import React from 'react';
import { useNavigation } from '@/contexts/NavigationContext';
import { Loader2 } from 'lucide-react';

export default function NavigationLoader() {
  const { isNavigating } = useNavigation();

  if (!isNavigating) return null;

  return (
    <div
      className="absolute inset-0 z-50 flex items-center justify-center bg-background/50 backdrop-blur-sm pointer-events-none"
    >
      <Loader2 className="h-12 w-12 animate-spin text-primary pointer-events-auto" />
    </div>
  );
}

