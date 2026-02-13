'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function CuentaPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/cuenta/billing');
  }, [router]);

  return null;
}
