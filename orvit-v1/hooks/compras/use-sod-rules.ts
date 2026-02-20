'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';

interface SoDRule {
  id: number;
  companyId: number;
  ruleCode: string;
  name: string;
  description?: string;
  action1: string;
  action2: string;
  scope: 'SAME_DOCUMENT' | 'SAME_SUPPLIER' | 'GLOBAL';
  isEnabled: boolean;
  isSystemRule: boolean;
  createdAt: string;
}

const SOD_RULES_KEY = 'compras-sod-rules';

async function fetchSoDRules(): Promise<SoDRule[]> {
  const res = await fetch('/api/compras/sod-rules');
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  return data.rules || [];
}

export function useSoDRules(enabled = true) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: [SOD_RULES_KEY],
    queryFn: fetchSoDRules,
    enabled,
    staleTime: 2 * 60 * 1000,
  });

  return {
    rules: query.data ?? [],
    isLoading: query.isLoading,
    invalidate: () => queryClient.invalidateQueries({ queryKey: [SOD_RULES_KEY] }),
  };
}

export type { SoDRule };
