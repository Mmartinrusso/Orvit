"use client";

import { usePusherSync } from "@/hooks/use-pusher-sync";
import { useCompany } from "@/contexts/CompanyContext";

/**
 * Invisible provider that connects to Pusher and auto-syncs data.
 * Mount inside CompanyProvider so it has access to companyId.
 */
export function PusherSyncProvider({ children }: { children: React.ReactNode }) {
  const { currentCompany } = useCompany();
  usePusherSync(currentCompany?.id);
  return <>{children}</>;
}
