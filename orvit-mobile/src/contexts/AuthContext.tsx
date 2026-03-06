import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import {
  getAccessToken,
  setTokens,
  clearTokens,
  getStoredUser,
  setStoredUser,
} from "@/lib/storage";
import { mobileLogin } from "@/api/chat";
import { apiFetch } from "@/api/client";
import { disconnectPusher } from "@/lib/pusher";
import type { AuthUser } from "@/types/chat";

interface AuthState {
  user: AuthUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthState>({
  user: null,
  isLoading: true,
  isAuthenticated: false,
  login: async () => {},
  logout: async () => {},
  refreshUser: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Restore session on mount
  useEffect(() => {
    (async () => {
      try {
        const token = await getAccessToken();
        const storedUser = await getStoredUser();
        if (token && storedUser) {
          setUser(JSON.parse(storedUser));
        }
      } catch {
        // Corrupted storage — clear
        await clearTokens();
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const platform =
      (await import("react-native")).Platform.OS === "ios" ? "ios" : "android";

    const response = await mobileLogin(email, password, { platform });

    await setTokens(response.tokens.accessToken, response.tokens.refreshToken);
    await setStoredUser(JSON.stringify(response.user));
    setUser(response.user);
  }, []);

  const logout = useCallback(async () => {
    disconnectPusher();
    await clearTokens();
    setUser(null);
  }, []);

  const refreshUser = useCallback(async () => {
    try {
      const token = await getAccessToken();
      if (!token) return;
      const data = await apiFetch<Partial<AuthUser>>("/api/auth/me?refresh=true");
      // Merge server data with current user (server may not return companyId/companyName)
      setUser((prev) => {
        if (!prev) return prev;
        const merged = { ...prev, ...data };
        setStoredUser(JSON.stringify(merged));
        return merged;
      });
    } catch {
      // Silently fail — user stays with current data
    }
  }, []);

  const value = React.useMemo(
    () => ({
      user,
      isLoading,
      isAuthenticated: !!user,
      login,
      logout,
      refreshUser,
    }),
    [user, isLoading, login, logout, refreshUser]
  );

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
