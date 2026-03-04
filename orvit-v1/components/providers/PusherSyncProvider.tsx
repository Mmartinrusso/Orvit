"use client";

import { usePusherSync } from "@/hooks/use-pusher-sync";
import { useCompany } from "@/contexts/CompanyContext";
import { useAuth } from "@/contexts/AuthContext";

/**
 * Invisible provider that connects to Pusher and auto-syncs data.
 * Mount inside CompanyProvider so it has access to companyId.
 * Only activates when user is authenticated.
 */
export function PusherSyncProvider({ children }: { children: React.ReactNode }) {
  const { user, refreshUser } = useAuth();
  const { currentCompany } = useCompany();
  usePusherSync(user ? currentCompany?.id : undefined, { refreshUser });
  return <>{children}</>;
}
